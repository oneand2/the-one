import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const WECHAT_AUTHORIZE_URL = 'https://open.weixin.qq.com/connect/qrconnect';
const WECHAT_ACCESS_TOKEN_URL = 'https://api.weixin.qq.com/sns/oauth2/access_token';
const WECHAT_USERINFO_URL = 'https://api.weixin.qq.com/sns/userinfo';

export const WECHAT_OAUTH_COOKIE = 'the_one_wechat_oauth';
export const WECHAT_OAUTH_MAX_AGE_SECONDS = 10 * 60;

export type WechatOAuthMode = 'login' | 'bind';

export type WechatOAuthContext = {
  state: string;
  mode: WechatOAuthMode;
  next: string;
  bindUserId?: string;
  issuedAt: number;
};

type WechatApiError = {
  errcode?: number;
  errmsg?: string;
};

export type WechatAccessToken = WechatApiError & {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  openid?: string;
  scope?: string;
  unionid?: string;
};

export type WechatUserInfo = WechatApiError & {
  openid?: string;
  nickname?: string;
  sex?: number;
  province?: string;
  city?: string;
  country?: string;
  headimgurl?: string;
  privilege?: string[];
  unionid?: string;
};

const PRODUCTION_SITE_URL = 'https://www.the-one-and-the-two.com';

export function resolveSiteUrl() {
  const configured = (process.env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/\/$/, '');
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') return PRODUCTION_SITE_URL;
  return 'http://localhost:3000';
}

export function getWechatLoginConfig() {
  const appId = process.env.WECHAT_LOGIN_APP_ID?.trim() || '';
  const appSecret = process.env.WECHAT_LOGIN_APP_SECRET?.trim() || '';
  const siteUrl = resolveSiteUrl();

  return {
    appId,
    appSecret,
    siteUrl,
    enabled: Boolean(appId && appSecret),
  };
}

export function sanitizeNextPath(value: string | null | undefined, fallback = '/') {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback;
  return value;
}

export function buildAppAbsoluteUrl(path: string, message?: string) {
  const url = new URL(sanitizeNextPath(path), `${resolveSiteUrl()}/`);
  if (message) url.searchParams.set('message', message);
  return url;
}

export function buildWechatAuthorizeUrl(appId: string, redirectUri: string, state: string) {
  const url = new URL(WECHAT_AUTHORIZE_URL);
  url.searchParams.set('appid', appId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'snsapi_login');
  url.searchParams.set('state', state);
  return `${url.toString()}#wechat_redirect`;
}

function encodeContext(context: WechatOAuthContext) {
  return Buffer.from(JSON.stringify(context), 'utf8').toString('base64url');
}

export function signWechatOAuthContext(context: WechatOAuthContext, secret: string) {
  const payload = encodeContext(context);
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyWechatOAuthContext(value: string | undefined, secret: string) {
  if (!value) return null;
  const [payload, suppliedSignature, extra] = value.split('.');
  if (!payload || !suppliedSignature || extra) return null;

  const expectedSignature = createHmac('sha256', secret).update(payload).digest('base64url');
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as WechatOAuthContext;
    const isFresh = Date.now() - parsed.issuedAt <= WECHAT_OAUTH_MAX_AGE_SECONDS * 1000;
    if (!parsed.state || !isFresh || (parsed.mode !== 'login' && parsed.mode !== 'bind')) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function fetchWechatJson<T>(url: URL) {
  const response = await fetch(url, {
    method: 'GET',
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`微信接口请求失败 (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export async function exchangeWechatCode(code: string, appId: string, appSecret: string) {
  const url = new URL(WECHAT_ACCESS_TOKEN_URL);
  url.searchParams.set('appid', appId);
  url.searchParams.set('secret', appSecret);
  url.searchParams.set('code', code);
  url.searchParams.set('grant_type', 'authorization_code');

  const data = await fetchWechatJson<WechatAccessToken>(url);
  if (data.errcode || !data.access_token || !data.openid) {
    throw new Error(`微信授权凭证无效 (${data.errcode ?? 'missing_token'})`);
  }
  return data;
}

export async function fetchWechatUserInfo(accessToken: string, openid: string) {
  const url = new URL(WECHAT_USERINFO_URL);
  url.searchParams.set('access_token', accessToken);
  url.searchParams.set('openid', openid);
  url.searchParams.set('lang', 'zh_CN');

  const data = await fetchWechatJson<WechatUserInfo>(url);
  if (data.errcode) {
    throw new Error(`获取微信用户信息失败 (${data.errcode})`);
  }
  return data;
}

/** 为微信首登生成稳定且不可与普通用户名注册冲突的 Supabase 用户标识。 */
export function deriveWechatAuthIdentity(appId: string, openid: string, unionid?: string) {
  const subject = unionid ? `unionid:${unionid}` : `appid:${appId}:openid:${openid}`;
  const hash = createHash('sha256').update(`the-one:wechat:${subject}`).digest('hex');
  const chars = hash.slice(0, 32).split('');
  chars[12] = '5';
  chars[16] = ((Number.parseInt(chars[16], 16) & 0x3) | 0x8).toString(16);
  const uuidHex = chars.join('');
  const userId = `${uuidHex.slice(0, 8)}-${uuidHex.slice(8, 12)}-${uuidHex.slice(12, 16)}-${uuidHex.slice(16, 20)}-${uuidHex.slice(20)}`;

  return {
    userId,
    email: `wx_${hash}@wechat.the-one-and-the-two.com`,
  };
}
