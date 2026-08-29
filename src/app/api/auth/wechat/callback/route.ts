import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import {
  buildAppAbsoluteUrl,
  deriveWechatAuthIdentity,
  exchangeWechatCode,
  fetchWechatUserInfo,
  getWechatLoginConfig,
  verifyWechatOAuthContext,
  WECHAT_OAUTH_COOKIE,
} from '@/lib/auth/wechat';
import { createAdminClient } from '@/utils/supabase/admin';

export const dynamic = 'force-dynamic';

type WechatIdentityRow = {
  user_id: string;
  app_id: string;
  openid: string;
  unionid: string | null;
};

function setRedirect(
  response: NextResponse,
  path: string,
  message?: string,
) {
  const url = buildAppAbsoluteUrl(path, message);
  response.headers.set('Location', url.toString());
  return response;
}

async function findWechatIdentity(
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

export async function GET(request: NextRequest) {
  const config = getWechatLoginConfig();
  const response = NextResponse.redirect(buildAppAbsoluteUrl('/'));
  response.cookies.set(WECHAT_OAUTH_COOKIE, '', {
    httpOnly: true,
    secure: config.siteUrl.startsWith('https://'),
    sameSite: 'lax',
    maxAge: 0,
    path: '/api/auth/wechat',
  });

  if (!config.enabled) {
    return setRedirect(response, '/login', '微信登录尚未配置');
  }

  const context = verifyWechatOAuthContext(
    request.cookies.get(WECHAT_OAUTH_COOKIE)?.value,
    config.appSecret,
  );
  const returnedState = request.nextUrl.searchParams.get('state');
  const code = request.nextUrl.searchParams.get('code');
  if (!context || !returnedState || returnedState !== context.state || !code) {
    return setRedirect(
      response,
      context?.mode === 'bind' ? '/profile' : '/login',
      '微信授权已失效，请重新扫码',
    );
  }

  const supabase = createServerClient(
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

  try {
    const token = await exchangeWechatCode(code, config.appId, config.appSecret);
    const info = await fetchWechatUserInfo(token.access_token!, token.openid!);
    const openid = token.openid!;
    const unionid = info.unionid || token.unionid;
    const nickname = info.nickname?.trim().slice(0, 50) || '';
    const avatarUrl = info.headimgurl?.trim() || null;
    const admin = createAdminClient();
    let identity = await findWechatIdentity(admin, config.appId, openid, unionid);

    if (context.mode === 'bind') {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !context.bindUserId || user.id !== context.bindUserId) {
        return setRedirect(response, '/login', '原账号登录状态已变化，请重新登录后绑定');
      }
      if (identity && identity.user_id !== user.id) {
        return setRedirect(response, '/profile', '这个微信已经绑定其他账号');
      }

      const { data: existingForUser, error: existingError } = await admin
        .from('wechat_identities')
        .select('user_id, app_id, openid, unionid')
        .eq('user_id', user.id)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existingForUser && !identity) {
        return setRedirect(response, '/profile', '当前账号已经绑定另一个微信');
      }

      if (!identity) {
        const inserted = await admin.from('wechat_identities').insert({
          user_id: user.id,
          app_id: config.appId,
          openid,
          unionid: unionid || null,
          nickname,
          avatar_url: avatarUrl,
          last_login_at: new Date().toISOString(),
        });
        if (inserted.error) throw inserted.error;
      } else {
        const updated = await admin.from('wechat_identities').update({
          nickname,
          avatar_url: avatarUrl,
          last_login_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('user_id', user.id);
        if (updated.error) throw updated.error;
      }

      return setRedirect(response, context.next, '微信绑定成功');
    }

    if (!identity) {
      const authIdentity = deriveWechatAuthIdentity(config.appId, openid, unionid);
      const created = await admin.auth.admin.createUser({
        id: authIdentity.userId,
        email: authIdentity.email,
        email_confirm: true,
        user_metadata: { nickname, avatar_url: avatarUrl },
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
        app_id: config.appId,
        openid,
        unionid: unionid || null,
        nickname,
        avatar_url: avatarUrl,
        last_login_at: new Date().toISOString(),
      });
      if (inserted.error) {
        identity = await findWechatIdentity(admin, config.appId, openid, unionid);
        if (!identity || identity.user_id !== user.id) throw inserted.error;
      } else {
        identity = { user_id: user.id, app_id: config.appId, openid, unionid: unionid || null };
      }

      const profile = await admin.from('user_profiles').upsert(
        { user_id: user.id, nickname, coins_balance: 50 },
        { onConflict: 'user_id', ignoreDuplicates: true },
      );
      if (profile.error) throw profile.error;
    } else {
      const updated = await admin.from('wechat_identities').update({
        nickname,
        avatar_url: avatarUrl,
        last_login_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('user_id', identity.user_id);
      if (updated.error) throw updated.error;
    }

    const authUser = await admin.auth.admin.getUserById(identity.user_id);
    const email = authUser.data.user?.email;
    if (authUser.error || !email) throw authUser.error || new Error('微信用户缺少登录标识');

    const generated = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    const tokenHash = generated.data.properties?.hashed_token;
    if (generated.error || !tokenHash) throw generated.error || new Error('无法生成登录会话');

    const verified = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' });
    if (verified.error || !verified.data.session) throw verified.error || new Error('无法建立登录会话');

    return setRedirect(response, context.next);
  } catch (error) {
    console.error('wechat oauth callback failed:', error);
    return setRedirect(
      response,
      context.mode === 'bind' ? '/profile' : '/login',
      '微信登录失败，请稍后重试',
    );
  }
}
