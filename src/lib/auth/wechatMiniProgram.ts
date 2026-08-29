import {
  getWechatMiniProgramConfig,
  type WechatAccessToken,
} from '@/lib/auth/wechat';

type WechatApiError = {
  errcode?: number;
  errmsg?: string;
};

type MiniProgramSession = WechatApiError & {
  openid?: string;
  session_key?: string;
  unionid?: string;
};

type MiniProgramUrlLink = WechatApiError & {
  url_link?: string;
};

type CachedAccessToken = {
  token: string;
  expiresAt: number;
};

let cachedAccessToken: CachedAccessToken | null = null;

async function fetchWechatJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
    ...init,
  });
  if (!response.ok) {
    throw new Error(`微信接口请求失败 (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export async function getMiniProgramAccessToken() {
  const config = getWechatMiniProgramConfig();
  if (!config.enabled) {
    throw new Error('小程序登录尚未配置');
  }

  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedAccessToken.token;
  }

  const url = new URL('https://api.weixin.qq.com/cgi-bin/token');
  url.searchParams.set('grant_type', 'client_credential');
  url.searchParams.set('appid', config.appId);
  url.searchParams.set('secret', config.appSecret);

  const data = await fetchWechatJson<WechatAccessToken>(url.toString());
  if (data.errcode || !data.access_token || !data.expires_in) {
    throw new Error(`无法取得小程序调用凭证 (${data.errcode ?? 'missing_token'})`);
  }

  cachedAccessToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedAccessToken.token;
}

export async function exchangeMiniProgramCode(code: string) {
  const config = getWechatMiniProgramConfig();
  if (!config.enabled) {
    throw new Error('小程序登录尚未配置');
  }

  const url = new URL('https://api.weixin.qq.com/sns/jscode2session');
  url.searchParams.set('appid', config.appId);
  url.searchParams.set('secret', config.appSecret);
  url.searchParams.set('js_code', code);
  url.searchParams.set('grant_type', 'authorization_code');

  const data = await fetchWechatJson<MiniProgramSession>(url.toString());
  if (data.errcode || !data.openid) {
    throw new Error(`小程序登录凭证无效 (${data.errcode ?? 'missing_openid'})`);
  }
  return {
    openid: data.openid,
    unionid: data.unionid,
  };
}

export async function generateMiniProgramUrlLink(ticket: string) {
  const config = getWechatMiniProgramConfig();
  const accessToken = await getMiniProgramAccessToken();
  const data = await fetchWechatJson<MiniProgramUrlLink>(
    `https://api.weixin.qq.com/wxa/generate_urllink?access_token=${encodeURIComponent(accessToken)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        path: config.loginPath,
        query: `ticket=${ticket}`,
        expire_type: 1,
        expire_interval: 1,
        env_version: config.envVersion,
      }),
    },
  );
  if (data.errcode || !data.url_link) {
    throw new Error(`无法打开小程序 (${data.errcode ?? 'missing_url_link'})`);
  }
  return data.url_link;
}
