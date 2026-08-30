import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { deriveWechatAuthIdentity } from '@/lib/auth/wechat';
import { createAdminClient } from '@/utils/supabase/admin';

export type WechatIdentityRow = {
  user_id: string;
  app_id: string;
  openid: string;
  unionid: string | null;
};

export type WechatProfile = {
  appId: string;
  openid: string;
  unionid?: string;
  nickname: string;
  avatarUrl: string | null;
};

export function createCookieSupabase(request: NextRequest, response: NextResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );
}

export async function findWechatIdentity(
  admin: ReturnType<typeof createAdminClient>,
  appId: string,
  openid: string,
  unionid?: string,
) {
  if (unionid) {
    const byUnionId = await admin
      .from('wechat_identities')
      .select('user_id, app_id, openid, unionid')
      .eq('unionid', unionid)
      .maybeSingle();
    if (byUnionId.error) throw byUnionId.error;
    if (byUnionId.data) return byUnionId.data as WechatIdentityRow;
  }

  const byOpenId = await admin
    .from('wechat_identities')
    .select('user_id, app_id, openid, unionid')
    .eq('app_id', appId)
    .eq('openid', openid)
    .maybeSingle();
  if (byOpenId.error) throw byOpenId.error;
  return (byOpenId.data as WechatIdentityRow | null) ?? null;
}

async function touchWechatIdentity(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  nickname: string,
  avatarUrl: string | null,
) {
  const updated = await admin.from('wechat_identities').update({
    nickname,
    avatar_url: avatarUrl,
    last_login_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('user_id', userId);
  if (updated.error) throw updated.error;
}

export async function bindWechatToUser(
  admin: ReturnType<typeof createAdminClient>,
  profile: WechatProfile,
  userId: string,
) {
  const identity = await findWechatIdentity(admin, profile.appId, profile.openid, profile.unionid);
  if (identity && identity.user_id !== userId) {
    return { error: '这个微信已经绑定其他账号' as const };
  }

  const { data: existingForUser, error: existingError } = await admin
    .from('wechat_identities')
    .select('user_id, app_id, openid, unionid')
    .eq('user_id', userId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existingForUser && !identity) {
    return { error: '当前账号已经绑定另一个微信' as const };
  }

  if (!identity) {
    const inserted = await admin.from('wechat_identities').insert({
      user_id: userId,
      app_id: profile.appId,
      openid: profile.openid,
      unionid: profile.unionid || null,
      nickname: profile.nickname,
      avatar_url: profile.avatarUrl,
      last_login_at: new Date().toISOString(),
    });
    if (inserted.error) throw inserted.error;
  } else {
    await touchWechatIdentity(admin, userId, profile.nickname, profile.avatarUrl);
  }

  return { error: null };
}

export async function loginOrCreateWechatUser(
  admin: ReturnType<typeof createAdminClient>,
  profile: WechatProfile,
) {
  let identity = await findWechatIdentity(admin, profile.appId, profile.openid, profile.unionid);

  if (!identity) {
    const authIdentity = deriveWechatAuthIdentity(profile.appId, profile.openid, profile.unionid);
    const created = await admin.auth.admin.createUser({
      id: authIdentity.userId,
      email: authIdentity.email,
      email_confirm: true,
      user_metadata: { nickname: profile.nickname, avatar_url: profile.avatarUrl },
      app_metadata: { signup_source: 'wechat' },
    });

    let user = created.data.user;
    if (created.error || !user) {
      const existing = await admin.auth.admin.getUserById(authIdentity.userId);
      user = existing.data.user;
      if (existing.error || !user) throw created.error || existing.error || new Error('无法创建微信用户');
    }

    const inserted = await admin.from('wechat_identities').insert({
      user_id: user.id,
      app_id: profile.appId,
      openid: profile.openid,
      unionid: profile.unionid || null,
      nickname: profile.nickname,
      avatar_url: profile.avatarUrl,
      last_login_at: new Date().toISOString(),
    });
    if (inserted.error) {
      identity = await findWechatIdentity(admin, profile.appId, profile.openid, profile.unionid);
      if (!identity || identity.user_id !== user.id) throw inserted.error;
    } else {
      identity = {
        user_id: user.id,
        app_id: profile.appId,
        openid: profile.openid,
        unionid: profile.unionid || null,
      };
    }

    const profileRow = await admin.from('user_profiles').upsert(
      { user_id: user.id, nickname: profile.nickname, coins_balance: 300 },
      { onConflict: 'user_id', ignoreDuplicates: true },
    );
    if (profileRow.error) throw profileRow.error;
  } else {
    await touchWechatIdentity(admin, identity.user_id, profile.nickname, profile.avatarUrl);
  }

  return identity.user_id;
}

export async function establishWechatSession(
  supabase: ReturnType<typeof createCookieSupabase>,
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
) {
  const authUser = await admin.auth.admin.getUserById(userId);
  const email = authUser.data.user?.email;
  if (authUser.error || !email) throw authUser.error || new Error('微信用户缺少登录标识');

  const generated = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  const tokenHash = generated.data.properties?.hashed_token;
  if (generated.error || !tokenHash) throw generated.error || new Error('无法生成登录会话');

  const verified = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' });
  if (verified.error || !verified.data.session) throw verified.error || new Error('无法建立登录会话');
}
