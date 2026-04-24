'use server';

import { headers } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

export type AuthResult = { redirectUrl?: string; error?: string; otpEmail?: string };

const PROFILE_TABLE = 'user_profiles';
const INITIAL_COINS = 50;
const INVITE_REWARD = 200;

const NO_EMAIL_SUFFIX = '@no-email.app';

export async function login(formData: FormData): Promise<AuthResult> {
  let email = (formData.get('email') as string)?.trim() ?? '';
  const password = formData.get('password') as string;
  const nextUrl = (formData.get('next') as string) || '/';

  // IP 注册用户：输入的是「用户名」，自动拼接 @no-email.app
  if (email && !email.includes('@')) {
    email = `${email}${NO_EMAIL_SUFFIX}`;
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: '登录失败，请检查邮箱和密码' };
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    const inviteCode = (user?.user_metadata?.invite_code as string | undefined)?.trim()?.toUpperCase();
    if (user && inviteCode) {
      const { error: rewardErr } = await supabase.rpc('apply_invite_reward', {
        p_invite_code: inviteCode,
        p_new_user_id: user.id,
        p_reward: 200,
      });
      if (rewardErr) {
        console.error('Invite reward (login): rpc failed', rewardErr);
      }
    }
  } catch (err) {
    console.error('Invite reward (login): unexpected error', err);
  }
  return { redirectUrl: nextUrl };
}

export async function signup(formData: FormData): Promise<AuthResult> {
  const email = (formData.get('email') as string)?.trim();
  const password = formData.get('password') as string;
  const confirmPassword = formData.get('confirmPassword') as string;
  const nickname = (formData.get('nickname') as string)?.trim() ?? '';
  const inviteCode = (formData.get('invite_code') as string)?.trim().toUpperCase() ?? '';

  if (password !== confirmPassword) {
    return { error: '两次输入的密码不一致' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { nickname: nickname.slice(0, 50), invite_code: inviteCode.slice(0, 32) || undefined },
    },
  });

  if (error) {
    return { error: '注册失败：' + error.message };
  }
  return { otpEmail: email };
}

/** 验证注册 OTP 验证码，验证成功后自动登录并建立用户档案 */
export async function verifySignupOtp(formData: FormData): Promise<AuthResult> {
  const email = (formData.get('email') as string)?.trim();
  const token = (formData.get('token') as string)?.trim();
  const nickname = (formData.get('nickname') as string)?.trim() ?? '';
  const inviteCode = (formData.get('invite_code') as string)?.trim().toUpperCase() ?? '';
  const nextUrl = (formData.get('next') as string) || '/';

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'signup' });

  if (error || !data.user) {
    return { error: '验证码错误或已过期，请重新输入' };
  }

  const uid = data.user.id;

  await supabase
    .from(PROFILE_TABLE)
    .upsert(
      { user_id: uid, nickname, coins_balance: INITIAL_COINS },
      { onConflict: 'user_id', ignoreDuplicates: true },
    );

  if (inviteCode) {
    try {
      const { error: rewardErr } = await supabase.rpc('apply_invite_reward', {
        p_invite_code: inviteCode,
        p_new_user_id: uid,
        p_reward: INVITE_REWARD,
      });
      if (rewardErr) {
        console.error('Invite reward (otp): rpc failed, trying admin fallback', rewardErr);
        const admin = createAdminClient();
        const { data: inviter, error: inviterErr } = await admin
          .from(PROFILE_TABLE)
          .select('user_id, coins_balance')
          .eq('invite_code', inviteCode)
          .single();
        if (!inviterErr && inviter) {
          const inviterId = (inviter as { user_id: string }).user_id;
          if (inviterId !== uid) {
            const cur = (inviter as { coins_balance?: number }).coins_balance ?? 0;
            await admin
              .from(PROFILE_TABLE)
              .update({ coins_balance: cur + INVITE_REWARD })
              .eq('user_id', inviterId);
          }
        }
      }
    } catch (err) {
      console.error('Invite reward (otp): unexpected error', err);
    }
  }

  return { redirectUrl: nextUrl };
}

/** 请求重置密码：向邮箱发送重置链接（仅支持邮箱注册用户） */
export async function requestPasswordReset(formData: FormData): Promise<AuthResult> {
  const email = (formData.get('email') as string)?.trim() ?? '';
  if (!email || !email.includes('@')) {
    return { error: '请输入有效的邮箱地址' };
  }

  const supabase = await createClient();
  const headerList = await headers();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const forwardedProto = headerList.get('x-forwarded-proto');
  const forwardedHost = headerList.get('x-forwarded-host');
  const host = forwardedHost || headerList.get('host');
  const proto = forwardedProto || (host?.includes('localhost') ? 'http' : 'https');
  const baseUrl = siteUrl || (host ? `${proto}://${host}` : 'http://localhost:3000');
  const redirectTo = `${baseUrl}/auth/callback?next=${encodeURIComponent('/reset-password')}`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  if (error) {
    return { error: '发送失败：' + (error.message || '请稍后重试') };
  }
  return {
    redirectUrl:
      '/login?message=已向该邮箱发送重置链接，请查收邮件并点击链接设置新密码。未收到请检查垃圾箱&next=' + encodeURIComponent('/'),
  };
}
