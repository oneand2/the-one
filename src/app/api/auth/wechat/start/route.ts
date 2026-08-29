import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import {
  buildAppAbsoluteUrl,
  buildWechatAuthorizeUrl,
  getWechatLoginConfig,
  sanitizeNextPath,
  signWechatOAuthContext,
  WECHAT_OAUTH_COOKIE,
  WECHAT_OAUTH_MAX_AGE_SECONDS,
  type WechatOAuthMode,
} from '@/lib/auth/wechat';

export const dynamic = 'force-dynamic';

function redirectWithMessage(path: string, message: string) {
  return NextResponse.redirect(buildAppAbsoluteUrl(path, message));
}

export async function GET(request: NextRequest) {
  const config = getWechatLoginConfig();
  const requestedMode = request.nextUrl.searchParams.get('mode');
  const mode: WechatOAuthMode = requestedMode === 'bind' ? 'bind' : 'login';
  const next = sanitizeNextPath(
    request.nextUrl.searchParams.get('next'),
    mode === 'bind' ? '/profile' : '/',
  );

  if (!config.enabled) {
    return redirectWithMessage(
      mode === 'bind' ? '/profile' : '/login',
      '微信登录尚未配置，请稍后再试',
    );
  }

  let bindUserId: string | undefined;
  if (mode === 'bind') {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      const loginUrl = buildAppAbsoluteUrl('/login', '请先登录原账号，再绑定微信');
      loginUrl.searchParams.set('next', '/profile');
      return NextResponse.redirect(loginUrl);
    }
    bindUserId = user.id;
  }

  const state = randomBytes(32).toString('hex');
  const context = signWechatOAuthContext(
    { state, mode, next, bindUserId, issuedAt: Date.now() },
    config.appSecret,
  );
  const callbackUrl = `${config.siteUrl}/api/auth/wechat/callback`;
  const response = NextResponse.redirect(buildWechatAuthorizeUrl(config.appId, callbackUrl, state));
  response.cookies.set(WECHAT_OAUTH_COOKIE, context, {
    httpOnly: true,
    secure: config.siteUrl.startsWith('https://'),
    sameSite: 'lax',
    maxAge: WECHAT_OAUTH_MAX_AGE_SECONDS,
    path: '/api/auth/wechat',
  });
  return response;
}
