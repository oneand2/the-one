import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export const WECHAT_PAY_OAUTH_COOKIE = 'the_one_wechat_pay_oauth';
export const WECHAT_PAYER_COOKIE = 'the_one_wechat_payer';
export const WECHAT_PAY_COOKIE_PATH = '/api/payments/wechat';

export type WechatPayContext = {
  purpose: 'oauth' | 'payer';
  userId: string;
  appId: string;
  issuedAt: number;
  expiresAt: number;
  state?: string;
  packageId?: string;
  openid?: string;
};

/** 独立于网站登录；加密 cookie 中的付款身份不能被页面读取或篡改。 */
export function sealWechatPayContext(context: WechatPayContext, secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', createHash('sha256').update(secret).digest(), iv);
  cipher.setAAD(Buffer.from('the-one:wechat-pay:v1'));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(context), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}

export function openWechatPayContext(
  value: string | undefined, secret: string,
  expected: { purpose: WechatPayContext['purpose']; userId: string; appId: string },
): WechatPayContext | null {
  if (!value || value.length > 4000) return null;
  try {
    const data = Buffer.from(value, 'base64url');
    if (data.length <= 28) return null;
    const decipher = createDecipheriv('aes-256-gcm', createHash('sha256').update(secret).digest(), data.subarray(0, 12));
    decipher.setAAD(Buffer.from('the-one:wechat-pay:v1'));
    decipher.setAuthTag(data.subarray(12, 28));
    const context = JSON.parse(Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString('utf8')) as WechatPayContext;
    const now = Date.now();
    if (context.purpose !== expected.purpose || context.userId !== expected.userId || context.appId !== expected.appId
      || !Number.isSafeInteger(context.issuedAt) || !Number.isSafeInteger(context.expiresAt)
      || context.issuedAt > now || context.expiresAt <= now || context.expiresAt <= context.issuedAt
      || context.expiresAt - context.issuedAt > (expected.purpose === 'oauth' ? 600_000 : 3600_000)) return null;
    if (expected.purpose === 'oauth' && (!context.state || !context.packageId)) return null;
    if (expected.purpose === 'payer' && !context.openid) return null;
    return context;
  } catch {
    return null;
  }
}

export function buildWechatPayAuthorizeUrl(appId: string, siteUrl: string, state: string) {
  const url = new URL('https://open.weixin.qq.com/connect/oauth2/authorize');
  url.searchParams.set('appid', appId);
  url.searchParams.set('redirect_uri', `${siteUrl}/api/payments/wechat/authorize/callback`);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'snsapi_base');
  url.searchParams.set('state', state);
  return `${url.toString()}#wechat_redirect`;
}
