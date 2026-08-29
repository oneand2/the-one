import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import {
  buildAppAbsoluteUrl,
  buildWechatAuthorizeUrl,
  getWechatLoginConfig,
  getWechatMiniProgramConfig,
  isWechatInAppBrowser,
  sanitizeNextPath,
  signWechatOAuthContext,
  WECHAT_OAUTH_COOKIE,
  WECHAT_OAUTH_MAX_AGE_SECONDS,
  type WechatOAuthMode,
} from '@/lib/auth/wechat';
import { insertWechatLoginTicket, setWechatTicketCookie } from '@/lib/auth/wechatTickets';

export const dynamic = 'force-dynamic';

function redirectWithMessage(path: string, message: string) {
  return NextResponse.redirect(buildAppAbsoluteUrl(path, message));
}

export async function GET(request: NextRequest) {
  const config = getWechatLoginConfig();
  const miniProgram = getWechatMiniProgramConfig();
  const requestedMode = request.nextUrl.searchParams.get('mode');
  const mode: WechatOAuthMode = requestedMode === 'bind' ? 'bind' : 'login';
  const next = sanitizeNextPath(
    request.nextUrl.searchParams.get('next'),
    mode === 'bind' ? '/profile' : '/',
  );

  if (!config.enabled && !(miniProgram.enabled && isWechatInAppBrowser(request.headers.get('user-agent')))) {
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

  if (miniProgram.enabled && isWechatInAppBrowser(request.headers.get('user-agent'))) {
    const ticketId = randomBytes(16).toString('hex');
    try {
      await insertWechatLoginTicket({ id: ticketId, mode, next, bindUserId });
    } catch (error) {
      console.error('wechat miniprogram ticket insert failed:', error);
      return redirectWithMessage(
        mode === 'bind' ? '/profile' : '/login',
        '暂时无法打开小程序登录，请稍后重试',
      );
    }

    const response = NextResponse.redirect(buildAppAbsoluteUrl('/login/wechat-bridge'));
    setWechatTicketCookie(response, ticketId, miniProgram.siteUrl.startsWith('https://'));
    return response;
  }

  if (!config.enabled) {
    return redirectWithMessage(
      mode === 'bind' ? '/profile' : '/login',
      '微信登录尚未配置，请稍后再试',
    );
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
