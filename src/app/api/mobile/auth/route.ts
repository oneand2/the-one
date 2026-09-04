import { NextRequest } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { createMobileAuthClient } from '@/lib/mobileAuth';
import { requestSignupOtp } from '@/utils/authOtp';

export const dynamic = 'force-dynamic';

const PROFILE_TABLE = 'user_profiles';
const NO_EMAIL_SUFFIX = '@no-email.app';

type AuthBody = {
  action?: 'login' | 'signup' | 'verify-signup' | 'apple' | 'logout';
  email?: string;
  password?: string;
  token?: string;
  nickname?: string;
  inviteCode?: string;
  identityToken?: string;
  nonce?: string;
};

function normalizedEmail(value: string) {
  const email = value.trim();
  return email && !email.includes('@') ? `${email}${NO_EMAIL_SUFFIX}` : email;
}

function isMissingRelation(error: { code?: string; message?: string }) {
  const message = (error.message ?? '').toLowerCase();
  return error.code === '42P01' || error.code === 'PGRST205' ||
    message.includes('does not exist') || message.includes('could not find the table');
}

async function ensureProfile(
  supabase: ReturnType<typeof createMobileAuthClient>['supabase'],
  userId: string,
  nickname = '',
) {
  await supabase.from(PROFILE_TABLE).upsert(
    {
      user_id: userId,
      nickname: nickname.trim().slice(0, 50),
    },
    { onConflict: 'user_id', ignoreDuplicates: true },
  );
}

export async function GET(request: NextRequest) {
  const { supabase, json } = createMobileAuthClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return json({ authenticated: false }, { status: 401 });
  return json({
    authenticated: true,
    user: {
      id: user.id,
      email: user.email ?? '',
      nickname: (user.user_metadata?.nickname as string | undefined) ?? '',
    },
  });
}

export async function POST(request: NextRequest) {
  const { supabase, json } = createMobileAuthClient(request);
  let body: AuthBody;
  try {
    body = (await request.json()) as AuthBody;
  } catch {
    return json({ error: '请求格式无效' }, { status: 400 });
  }

  if (body.action === 'login') {
    const email = normalizedEmail(body.email ?? '');
    if (!email || !body.password) return json({ error: '请输入账号和密码' }, { status: 400 });

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: body.password,
    });
    if (error || !data.user) return json({ error: '登录失败，请检查账号和密码' }, { status: 401 });
    await ensureProfile(supabase, data.user.id, (data.user.user_metadata?.nickname as string) ?? '');
    return json({
      authenticated: true,
      user: { id: data.user.id, email: data.user.email ?? '', nickname: data.user.user_metadata?.nickname ?? '' },
    });
  }

  if (body.action === 'signup') {
    const email = normalizedEmail(body.email ?? '');
    if (!email.includes('@') || !body.password || body.password.length < 6) {
      return json({ error: '请输入有效邮箱，密码至少 6 位' }, { status: 400 });
    }
    const nickname = (body.nickname ?? '').trim().slice(0, 50);
    const inviteCode = (body.inviteCode ?? '').trim().toUpperCase().slice(0, 32);
    const result = await requestSignupOtp(supabase, {
      email,
      password: body.password,
      nickname,
      inviteCode,
    });
    if ('error' in result) return json({ error: result.error }, { status: 400 });
    if ('sessionUserId' in result) {
      await ensureProfile(supabase, result.sessionUserId, nickname);
      return json({
        authenticated: true,
        needsVerification: false,
        user: { id: result.sessionUserId, email, nickname },
      });
    }
    return json({ needsVerification: true, email });
  }

  if (body.action === 'verify-signup') {
    const email = normalizedEmail(body.email ?? '');
    if (!email || !body.token) return json({ error: '请输入邮箱验证码' }, { status: 400 });
    const { data, error } = await supabase.auth.verifyOtp({ email, token: body.token.trim(), type: 'signup' });
    if (error || !data.user) return json({ error: '验证码错误或已过期' }, { status: 400 });
    await ensureProfile(supabase, data.user.id, body.nickname ?? '');
    return json({
      authenticated: true,
      user: { id: data.user.id, email: data.user.email ?? '', nickname: data.user.user_metadata?.nickname ?? '' },
    });
  }

  if (body.action === 'apple') {
    if (!body.identityToken || !body.nonce) {
      return json({ error: 'Apple 登录凭据不完整' }, { status: 400 });
    }
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: body.identityToken,
      nonce: body.nonce,
    });
    if (error || !data.user) {
      console.error('native Apple sign-in failed:', error);
      return json({ error: 'Apple 登录失败，请稍后重试' }, { status: 401 });
    }
    const nickname = (body.nickname ?? data.user.user_metadata?.full_name ?? '').toString();
    await ensureProfile(supabase, data.user.id, nickname);
    return json({
      authenticated: true,
      user: { id: data.user.id, email: data.user.email ?? '', nickname },
    });
  }

  if (body.action === 'logout') {
    await supabase.auth.signOut();
    return json({ ok: true });
  }

  return json({ error: '不支持的认证操作' }, { status: 400 });
}

export async function DELETE(request: NextRequest) {
  const { supabase, json } = createMobileAuthClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: '未登录' }, { status: 401 });

  const admin = createAdminClient();
  // Deleting chat_sessions also removes chat_messages through the existing FK cascade.
  const scopedTables = ['wechat_identities', 'chat_sessions', 'daoyoushuju', PROFILE_TABLE];
  for (const table of scopedTables) {
    const { error } = await admin.from(table).delete().eq('user_id', user.id);
    if (error && !isMissingRelation(error)) {
      console.error(`account deletion failed for ${table}:`, error);
      return json({ error: '删除账户数据失败，请稍后重试' }, { status: 500 });
    }
  }

  // Keep the minimum transaction record required for refunds/accounting, but
  // sever the link to the deleted account.
  const { error: anonymizePurchaseError } = await admin
    .from('apple_iap_transactions')
    .update({ user_id: null })
    .eq('user_id', user.id);
  if (
    anonymizePurchaseError &&
    !isMissingRelation(anonymizePurchaseError)
  ) {
    console.error('anonymize Apple purchases failed:', anonymizePurchaseError);
    return json({ error: '处理交易留存记录失败，请联系客服' }, { status: 500 });
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error('delete auth user failed:', deleteError);
    return json({ error: '注销账户失败，请联系客服' }, { status: 500 });
  }
  await supabase.auth.signOut();
  return json({ ok: true });
}
