import { NextRequest, NextResponse } from 'next/server';
import {
  buildAppAbsoluteUrl,
  exchangeWechatCode,
  fetchWechatUserInfo,
  getWechatLoginConfig,
  verifyWechatOAuthContext,
  WECHAT_OAUTH_COOKIE,
} from '@/lib/auth/wechat';
import {
  bindWechatToUser,
  createCookieSupabase,
  establishWechatSession,
  loginOrCreateWechatUser,
} from '@/lib/auth/wechatIdentity';
import { createAdminClient } from '@/utils/supabase/admin';

export const dynamic = 'force-dynamic';

function setRedirect(
  response: NextResponse,
  path: string,
  message?: string,
) {
  const url = buildAppAbsoluteUrl(path, message);
  response.headers.set('Location', url.toString());
  return response;
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

  const supabase = createCookieSupabase(request, response);

  try {
    const token = await exchangeWechatCode(code, config.appId, config.appSecret);
    const info = await fetchWechatUserInfo(token.access_token!, token.openid!);
    const profile = {
      appId: config.appId,
      openid: token.openid!,
      unionid: info.unionid || token.unionid,
      nickname: info.nickname?.trim().slice(0, 50) || '',
      avatarUrl: info.headimgurl?.trim() || null,
    };
    const admin = createAdminClient();

    if (context.mode === 'bind') {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !context.bindUserId || user.id !== context.bindUserId) {
        return setRedirect(response, '/login', '原账号登录状态已变化，请重新登录后绑定');
      }
      const bound = await bindWechatToUser(admin, profile, user.id);
      if (bound.error) {
        return setRedirect(response, '/profile', bound.error);
      }
      return setRedirect(response, context.next, '微信绑定成功');
    }

    const userId = await loginOrCreateWechatUser(admin, profile);
    await establishWechatSession(supabase, admin, userId);
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
