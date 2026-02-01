'use server';

import { headers } from 'next/headers';
import { createClient } from '@/utils/supabase/server';

export type AuthResult = { redirectUrl?: string; error?: string };

export async function login(formData: FormData): Promise<AuthResult> {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const nextUrl = (formData.get('next') as string) || '/';

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
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const confirmPassword = formData.get('confirmPassword') as string;
  const nickname = (formData.get('nickname') as string)?.trim() ?? '';
  const inviteCode = (formData.get('invite_code') as string)?.trim().toUpperCase() ?? '';
  const nextUrl = (formData.get('next') as string) || '/';

  if (password !== confirmPassword) {
    return { error: '两次输入的密码不一致' };
  }

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const headerList = await headers();
  const forwardedProto = headerList.get('x-forwarded-proto');
  const forwardedHost = headerList.get('x-forwarded-host');
  const host = forwardedHost || headerList.get('host');
  const proto = forwardedProto || (host?.includes('localhost') ? 'http' : 'https');
  const baseUrl = siteUrl || (host ? `${proto}://${host}` : 'http://localhost:3000');
  const baseRedirect = `${baseUrl}/auth/callback?next=${encodeURIComponent(nextUrl)}`;
  const redirectWithInvite = inviteCode ? `${baseRedirect}&inviteCode=${encodeURIComponent(inviteCode)}` : baseRedirect;
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectWithInvite,
      data: { nickname: nickname.slice(0, 50), invite_code: inviteCode.slice(0, 32) || undefined },
    },
  });

  if (error) {
    return { error: '注册失败：' + error.message };
  }
  return {
    redirectUrl:
      '/login?message=注册成功！请检查邮箱并点击验证链接。如果没有收到邮件，请检查邮箱的垃圾箱&next=' + encodeURIComponent(nextUrl),
  };
}
