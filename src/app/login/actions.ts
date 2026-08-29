'use server';

import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { requestRecoveryOtp, requestSignupOtp } from '@/utils/authOtp';

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
  const nextUrl = (formData.get('next') as string) || '/';

  if (!email || !email.includes('@')) {
    return { error: '请输入有效的邮箱地址' };
  }

  if (password !== confirmPassword) {
    return { error: '两次输入的密码不一致' };
  }

  const supabase = await createClient();
  const result = await requestSignupOtp(supabase, { email, password, nickname, inviteCode });
  if ('error' in result) return { error: result.error };
  if ('sessionUserId' in result) {
    await supabase.from(PROFILE_TABLE).upsert(
      { user_id: result.sessionUserId, nickname, coins_balance: INITIAL_COINS },
      { onConflict: 'user_id', ignoreDuplicates: true },
    );
    return { redirectUrl: nextUrl };
  }
  return { otpEmail: result.otpEmail };
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

/** 请求重置密码：向邮箱发送验证码（仅支持邮箱注册用户；需在 Supabase 重置密码邮件模板中使用 {{ .Token }}） */
export async function requestPasswordReset(formData: FormData): Promise<AuthResult> {
  const email = (formData.get('email') as string)?.trim() ?? '';
  if (!email || !email.includes('@')) {
    return { error: '请输入有效的邮箱地址' };
  }
  if (email.endsWith(NO_EMAIL_SUFFIX)) {
    return { error: 'IP 注册用户无法通过邮箱找回密码' };
  }

  const supabase = await createClient();
  const result = await requestRecoveryOtp(supabase, email);
  if ('error' in result) return { error: result.error };
  return { otpEmail: result.otpEmail };
}

/** 验证找回密码 OTP 并设置新密码 */
export async function verifyPasswordResetOtp(formData: FormData): Promise<AuthResult> {
  const email = (formData.get('email') as string)?.trim() ?? '';
  const token = (formData.get('token') as string)?.trim() ?? '';
  const password = formData.get('password') as string;
  const confirmPassword = formData.get('confirmPassword') as string;

  if (!email || !token) {
    return { error: '请填写邮箱与验证码' };
  }
  if (password !== confirmPassword) {
    return { error: '两次输入的密码不一致' };
  }
  if (!password || password.length < 6) {
    return { error: '密码至少 6 位' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'recovery' });

  if (error || !data.user) {
    return { error: '验证码错误或已过期，请重新输入' };
  }

  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError) {
    return { error: '设置密码失败：' + (updateError.message || '请稍后重试') };
  }

  await supabase.auth.signOut();
  return { redirectUrl: '/login?message=密码已更新，请使用新密码登录' };
}
