import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { exchangeWechatCode, resolveSiteUrl } from '@/lib/auth/wechat';
import { getWechatMobilePayConfig, getWechatPayCapabilities } from '@/lib/payments/wechat';
import {
  openWechatPayContext, sealWechatPayContext, WECHAT_PAYER_COOKIE,
  WECHAT_PAY_COOKIE_PATH, WECHAT_PAY_OAUTH_COOKIE,
} from '@/lib/payments/wechatPayer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const siteUrl = resolveSiteUrl();
  const returnUrl = new URL('/shop', siteUrl);
  returnUrl.searchParams.set('wechat', 'auth_failed');
  const response = NextResponse.redirect(returnUrl);
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  const options = { httpOnly: true, secure: siteUrl.startsWith('https://'), sameSite: 'lax' as const, path: WECHAT_PAY_COOKIE_PATH };
  response.cookies.set(WECHAT_PAY_OAUTH_COOKIE, '', { ...options, maxAge: 0 });

  const config = getWechatMobilePayConfig();
  if (!getWechatPayCapabilities().jsapi) return response;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return response;
  const context = openWechatPayContext(request.cookies.get(WECHAT_PAY_OAUTH_COOKIE)?.value, config.appSecret,
    { purpose: 'oauth', userId: user.id, appId: config.appId });
  const code = request.nextUrl.searchParams.get('code');
  if (!context || !code || context.state !== request.nextUrl.searchParams.get('state')) return response;
  try {
    const token = await exchangeWechatCode(code, config.appId, config.appSecret);
    const now = Date.now();
    response.cookies.set(WECHAT_PAYER_COOKIE, sealWechatPayContext({
      purpose: 'payer', userId: user.id, appId: config.appId,
      openid: token.openid!, issuedAt: now, expiresAt: now + 3600_000,
    }, config.appSecret), { ...options, maxAge: 3600 });
    returnUrl.searchParams.set('wechat', 'authorized');
    returnUrl.searchParams.set('package', context.packageId!);
    response.headers.set('Location', returnUrl.toString());
  } catch {
    // 不记录 code、access_token 或包含这些凭据的请求 URL。
    console.error('wechat payment payer authorization failed');
  }
  return response;
}
