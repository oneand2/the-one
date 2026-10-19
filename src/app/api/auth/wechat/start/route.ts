import { resolveReferralVisit } from '@/lib/ambassadors/referral';
import { referralCode, REFERRAL_COOKIE } from '@/lib/ambassadors/shared';
import { createAdminClient } from '@/utils/supabase/admin';
import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import {
  buildAppAbsoluteUrl,
  buildWechatAuthorizeUrl,
  getWechatLoginConfig,
  getWechatMiniProgramConfig,
  sanitizeNextPath,
  shouldUseMiniProgramRelay,
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

  let ambassadorCode = referralCode(request.nextUrl.searchParams.get('ref'));
  const retryLoginPath = () => ambassadorCode ? `/login?ref=${encodeURIComponent(ambassadorCode)}` : '/login';

  const useMiniProgramRelay = miniProgram.enabled && shouldUseMiniProgramRelay(request.headers.get('user-agent'));
  if (!config.enabled && !useMiniProgramRelay) {
    return redirectWithMessage(
      mode === 'bind' ? '/profile' : retryLoginPath(),
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

  let ambassadorToken: string | undefined;
  if (mode === 'login') {
    try {
      const visit = await resolveReferralVisit(createAdminClient(), request.cookies.get(REFERRAL_COOKIE)?.value, ambassadorCode);
      ambassadorToken = visit?.token;
      ambassadorCode = visit?.code || ambassadorCode;
    } catch {
      return redirectWithMessage(retryLoginPath(), '推广来源暂时无法确认，请返回推广链接重试');
    }
  }

  if (useMiniProgramRelay) {
    const ticketId = randomBytes(16).toString('hex');
    try {
      await insertWechatLoginTicket({ id: ticketId, mode, next, bindUserId, ambassadorToken });
    } catch (error) {
      console.error('wechat miniprogram ticket insert failed:', error);
      return redirectWithMessage(
        mode === 'bind' ? '/profile' : retryLoginPath(),
        '暂时无法打开小程序登录，请稍后重试',
      );
    }

    const response = NextResponse.redirect(buildAppAbsoluteUrl('/login/wechat-bridge'));
    setWechatTicketCookie(response, ticketId, miniProgram.siteUrl.startsWith('https://'));
    return response;
  }

  if (!config.enabled) {
    return redirectWithMessage(
      mode === 'bind' ? '/profile' : retryLoginPath(),
      '微信登录尚未配置，请稍后再试',
    );
  }

  const state = randomBytes(32).toString('hex');
  const context = signWechatOAuthContext(
    { state, mode, next, bindUserId, ambassadorToken, ambassadorCode: mode === 'login' ? ambassadorCode : undefined, issuedAt: Date.now() },
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
