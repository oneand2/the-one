'use server';

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
  return { redirectUrl: nextUrl };
}

export async function signup(formData: FormData): Promise<AuthResult> {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const confirmPassword = formData.get('confirmPassword') as string;
  const nickname = (formData.get('nickname') as string)?.trim() ?? '';
  const inviteCode = (formData.get('invite_code') as string)?.trim() ?? '';
  const nextUrl = (formData.get('next') as string) || '/';

  if (password !== confirmPassword) {
    return { error: '两次输入的密码不一致' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback?next=${encodeURIComponent(nextUrl)}`,
      data: { nickname: nickname.slice(0, 50), invite_code: inviteCode.slice(0, 32) || undefined },
    },
  });

  if (error) {
    return { error: '注册失败：' + error.message };
  }
  return {
    redirectUrl:
      '/login?message=注册成功！请检查邮箱并点击验证链接&next=' + encodeURIComponent(nextUrl),
  };
}
