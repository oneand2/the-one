import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { generateKeyPairSync, sign, verify } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { NextRequest } from 'next/server';
import { selectWechatPayMode } from '../src/lib/payments/wechatShared';
import * as payer from '../src/lib/payments/wechatPayer';
import * as packages from '../src/lib/payments/coinPackages';
import { invokeWechatPay } from '../src/lib/payments/wechatBrowser';

const realRequire = createRequire(`${process.cwd()}/package.json`);
const wechat = loadIsolatedModule('src/lib/payments/wechat.ts', { 'server-only': {} }) as typeof import('../src/lib/payments/wechat');

const nativeCaps = { native: true, h5: false, jsapi: false };
const allCaps = { native: true, h5: true, jsapi: true };
const mobileUa = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Mobile';
const wechatUa = `${mobileUa} MicroMessenger/8.0`;
const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
const originalEnvironment = { ...process.env };
const configured = {
  WECHAT_PAY_APP_ID: 'wx-native-test', WECHAT_PAY_MCH_ID: 'merchant-test',
  WECHAT_PAY_API_V3_KEY: '01234567890123456789012345678901',
  WECHAT_PAY_PRIVATE_KEY_BASE64: Buffer.from(keys.privateKey.export({ type: 'pkcs8', format: 'pem' })).toString('base64'),
  WECHAT_PAY_CERT_SERIAL_NO: 'TESTSERIAL',
  WECHAT_PAY_PUBLIC_KEY_BASE64: Buffer.from(keys.publicKey.export({ type: 'spki', format: 'pem' })).toString('base64'),
  WECHAT_PAY_PUBLIC_KEY_ID: 'PUB_KEY_ID_TEST', NEXT_PUBLIC_SITE_URL: 'https://shop.example.test',
  WECHAT_PAY_H5_ENABLED: 'true', WECHAT_PAY_JSAPI_ENABLED: 'true',
  WECHAT_PAY_JSAPI_APP_ID: 'wx-official-test', WECHAT_PAY_JSAPI_APP_SECRET: 'official-secret-test',
};
Object.assign(process.env, configured);
after(() => {
  for (const name of Object.keys(configured)) {
    if (originalEnvironment[name] === undefined) delete process.env[name];
    else process.env[name] = originalEnvironment[name];
  }
});

test('selects each browser environment and never uses H5 inside WeChat or without permission', () => {
  assert.equal(selectWechatPayMode(wechatUa, allCaps), 'jsapi');
  assert.equal(selectWechatPayMode(mobileUa, allCaps), 'h5');
  assert.equal(selectWechatPayMode('Mozilla/5.0 Macintosh', allCaps), 'native');
  assert.equal(selectWechatPayMode('Mozilla/5.0 Macintosh', allCaps, true), 'h5');
  for (const ua of [wechatUa, mobileUa]) assert.equal(selectWechatPayMode(ua, nativeCaps, true), 'native');
  assert.equal(selectWechatPayMode(wechatUa, { ...allCaps, jsapi: false }, true), 'native');
  for (const desktop of ['WindowsWechat', 'MacWechat', 'wxwork', 'WeChatWork']) {
    assert.equal(selectWechatPayMode(`${wechatUa} ${desktop}`, allCaps, true), 'native');
  }
});

test('encrypted payer identity is bound to purpose, user, app and expiry', () => {
  const now = Date.now();
  const context: payer.WechatPayContext = { purpose: 'payer', userId: 'user-a', appId: 'wx-a', openid: 'openid-private', issuedAt: now, expiresAt: now + 60_000 };
  const expected = { purpose: 'payer' as const, userId: 'user-a', appId: 'wx-a' };
  const token = payer.sealWechatPayContext(context, 'secret');
  assert.ok(!Buffer.from(token, 'base64url').toString().includes('openid-private'));
  assert.deepEqual(payer.openWechatPayContext(token, 'secret', expected), context);
  for (const changed of [{ userId: 'user-b' }, { appId: 'wx-b' }, { purpose: 'oauth' as const }]) {
    assert.equal(payer.openWechatPayContext(token, 'secret', { ...expected, ...changed }), null);
  }
  assert.equal(payer.openWechatPayContext(token, 'wrong-secret', expected), null);
  const tampered = Buffer.from(token, 'base64url'); tampered[30] ^= 1;
  assert.equal(payer.openWechatPayContext(tampered.toString('base64url'), 'secret', expected), null);
  for (const changed of [{ expiresAt: now - 1 }, { issuedAt: now + 60_000 }, { expiresAt: now + 3600_001 }, { openid: '' }]) {
    assert.equal(payer.openWechatPayContext(payer.sealWechatPayContext({ ...context, ...changed }, 'secret'), 'secret', expected), null);
  }
});

test('OAuth uses official account scope and fixed callback; state context has a ten-minute limit', () => {
  const url = new URL(payer.buildWechatPayAuthorizeUrl('wx-a', configured.NEXT_PUBLIC_SITE_URL, 'state-a'));
  assert.equal(url.origin, 'https://open.weixin.qq.com');
  assert.equal(url.searchParams.get('scope'), 'snsapi_base');
  assert.equal(url.searchParams.get('redirect_uri'), 'https://shop.example.test/api/payments/wechat/authorize/callback');
  assert.equal(url.searchParams.get('state'), 'state-a');
  const now = Date.now();
  const context: payer.WechatPayContext = { purpose: 'oauth', userId: 'user-a', appId: 'wx-a', state: 'state-a', packageId: 'insight_100', issuedAt: now, expiresAt: now + 600_001 };
  assert.equal(payer.openWechatPayContext(payer.sealWechatPayContext(context, 'secret'), 'secret', context), null);
});

function signedResponse(data: unknown) {
  const body = JSON.stringify(data);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = 'response-test-nonce';
  return new Response(body, { headers: {
    'wechatpay-timestamp': timestamp, 'wechatpay-nonce': nonce, 'wechatpay-serial': configured.WECHAT_PAY_PUBLIC_KEY_ID,
    'wechatpay-signature': sign('RSA-SHA256', Buffer.from(`${timestamp}\n${nonce}\n${body}\n`), keys.privateKey).toString('base64'),
  } });
}

test('H5 sends server price and trusted client IP and returns only official payment URL', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async (url: string | URL | Request, init?: RequestInit) => {
    assert.equal(url, 'https://api.mch.weixin.qq.com/v3/pay/transactions/h5');
    const body = JSON.parse(String(init?.body));
    assert.equal(body.amount.total, packages.COIN_PACKAGES[0].amountCents);
    assert.equal(body.scene_info.payer_client_ip, '203.0.113.5');
    assert.equal(body.appid, configured.WECHAT_PAY_APP_ID);
    assert.ok(init?.signal);
    return signedResponse({ h5_url: 'https://wx.tenpay.com/cgi-bin/mmpayweb-bin/checkmweb?prepay_id=test' });
  });
  const result = await wechat.createWechatMobileOrder('h5', 'WX-test', packages.COIN_PACKAGES[0], { clientIp: '203.0.113.5' });
  assert.equal(result.mode, 'h5');
  assert.equal(new URL(result.paymentUrl!).searchParams.get('redirect_url'), 'https://shop.example.test/shop?payment=return&channel=wechat&order=WX-test');
  fetchMock.mock.mockImplementation(async () => signedResponse({ h5_url: 'https://evil.example/steal' }));
  await assert.rejects(wechat.createWechatMobileOrder('h5', 'WX-test', packages.COIN_PACKAGES[0], { clientIp: '203.0.113.5' }), /有效付款链接/);
  assert.equal(wechat.getWechatPayerClientIp(new Headers({ 'x-real-ip': '203.0.113.5', 'x-forwarded-for': 'attacker' })), '203.0.113.5');
  assert.throws(() => wechat.getWechatPayerClientIp(new Headers({ 'x-forwarded-for': '203.0.113.5' })));
});

test('JSAPI signs the official account prepay parameters and validates merchant, app and amount', async (t) => {
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.appid, configured.WECHAT_PAY_JSAPI_APP_ID);
    assert.deepEqual(body.payer, { openid: 'payer-test' });
    return signedResponse({ prepay_id: 'wx-prepay-test' });
  });
  const result = await wechat.createWechatMobileOrder('jsapi', 'WX-test', packages.COIN_PACKAGES[0], { openid: 'payer-test' });
  const params = result.jsapiParams!;
  assert.equal(params.signType, 'RSA');
  assert.ok(verify('RSA-SHA256', Buffer.from(`${params.appId}\n${params.timeStamp}\n${params.nonceStr}\n${params.package}\n`), keys.publicKey, Buffer.from(params.paySign, 'base64')));
  const trade = { appid: configured.WECHAT_PAY_JSAPI_APP_ID, mchid: configured.WECHAT_PAY_MCH_ID, out_trade_no: 'WX-test', transaction_id: 'transaction-test', trade_state: 'SUCCESS', amount: { total: 990, currency: 'CNY' } };
  assert.ok(wechat.validateWechatTrade(trade, 'WX-test', 990));
  for (const changed of [{ appid: 'other-app' }, { mchid: 'other-merchant' }, { trade_state: 'NOTPAY' }, { amount: { total: 1, currency: 'CNY' } }, { out_trade_no: 'WX-other' }]) {
    assert.equal(wechat.validateWechatTrade({ ...trade, ...changed }, 'WX-test', 990), false);
  }
  assert.ok(wechat.validateWechatNotification(trade));
  process.env.WECHAT_PAY_JSAPI_ENABLED = 'false';
  assert.ok(wechat.validateWechatTrade(trade, 'WX-test', 990), 'disabling new orders must still accept paid orders');
  process.env.WECHAT_PAY_JSAPI_ENABLED = 'true';
});

test('disabled capabilities or missing payer context make no network call; unsigned replies fail closed', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ prepay_id: 'forged' })));
  process.env.WECHAT_PAY_H5_ENABLED = 'false';
  await assert.rejects(wechat.createWechatMobileOrder('h5', 'test', packages.COIN_PACKAGES[0], { clientIp: '203.0.113.5' }));
  process.env.WECHAT_PAY_H5_ENABLED = 'true';
  await assert.rejects(wechat.createWechatMobileOrder('jsapi', 'test', packages.COIN_PACKAGES[0], {}));
  await assert.rejects(wechat.createWechatMobileOrder('h5', 'test', packages.COIN_PACKAGES[0], { clientIp: 'invalid' }));
  assert.equal(fetchMock.mock.callCount(), 0);
  await assert.rejects(wechat.createWechatMobileOrder('jsapi', 'test', packages.COIN_PACKAGES[0], { openid: 'test' }), /签名验证失败/);
});

test('Bridge returns success, cancellation and failure without deciding whether money was credited', async () => {
  const originalWindow = globalThis.window;
  try {
    for (const [err_msg, expected] of [['get_brand_wcpay_request:ok', 'ok'], ['get_brand_wcpay_request:cancel', 'cancel'], ['other', 'fail']]) {
      globalThis.window = {
        setTimeout, clearTimeout,
        WeixinJSBridge: { invoke(_method: string, _params: unknown, callback: (data: { err_msg: string }) => void) { callback({ err_msg }); } },
      } as unknown as Window & typeof globalThis;
      assert.equal(await invokeWechatPay({ appId: 'test', timeStamp: '1', nonceStr: 'test', package: 'prepay_id=test', signType: 'RSA', paySign: 'test' }), expected);
    }
  } finally {
    if (originalWindow === undefined) Reflect.deleteProperty(globalThis, 'window');
    else globalThis.window = originalWindow;
  }
});

// Compile only the route under test and replace external effects with isolated doubles.
function loadIsolatedModule(path: string, dependencies: Record<string, unknown>) {
  const exports: Record<string, unknown> = {};
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function('require', 'exports', code)((name: string) => dependencies[name] ?? realRequire(name), exports);
  return exports;
}

function loadRoute(path: string, dependencies: Record<string, unknown>) {
  return loadIsolatedModule(path, dependencies) as Record<string, (request: NextRequest) => Promise<Response>>;
}

test('create route enforces origin/login, obtains payer before inserting, and routes all three modes', async () => {
  let userId: string | null = 'user-a';
  let caps = allCaps;
  let inserted = 0;
  let failOrder = false;
  let duplicate = false;
  const orderNumbers: string[] = [];
  const builder = {
    select() { return this; }, eq() { return this; },
    async gte() { return { count: 0, error: null }; },
    async insert(order: { out_trade_no: string }) { inserted++; orderNumbers.push(order.out_trade_no); return { error: duplicate ? { code: '23505' } : null }; },
    async maybeSingle() { return { data: null }; },
  };
  const route = loadRoute('src/app/api/payments/wechat/create/route.ts', {
    '@/utils/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) } }) },
    '@/utils/supabase/admin': { createAdminClient: () => ({ from: () => builder }) },
    '@/lib/payments/coinPackages': packages,
    '@/lib/payments/wechatShared': { selectWechatPayMode },
    '@/lib/payments/wechatPayer': payer,
    '@/lib/auth/wechat': { resolveSiteUrl: () => configured.NEXT_PUBLIC_SITE_URL },
    '@/utils/vip': { isLifetimeVip: () => false },
    '@/lib/payments/wechat': {
      ...wechat, getWechatPayCapabilities: () => caps,
      createWechatNativeOrder: async () => 'weixin://wxpay/test',
      createWechatMobileOrder: async (mode: string) => {
        if (failOrder) throw new Error('simulated timeout');
        return { mode, ...(mode === 'h5' ? { paymentUrl: 'https://wx.tenpay.com/test' } : { jsapiParams: { appId: 'test' } }) };
      },
    },
    qrcode: { toDataURL: async () => 'data:image/png;base64,test' },
  });
  const request = (ua: string, extra: Record<string, string> = {}, attemptId?: string) => new NextRequest('https://shop.example.test/api/payments/wechat/create', {
    method: 'POST', headers: { Origin: configured.NEXT_PUBLIC_SITE_URL, 'User-Agent': ua, 'Content-Type': 'application/json', ...extra },
    body: JSON.stringify({ packageId: 'insight_100', mobile: true, attemptId }),
  });
  assert.equal((await route.POST(request(mobileUa, { Origin: 'https://attacker.example' }))).status, 403);
  userId = null;
  assert.equal((await route.POST(request(mobileUa))).status, 401);
  userId = 'user-a';
  const authorization = await route.POST(request(wechatUa));
  assert.equal((await authorization.json()).mode, 'authorize');
  assert.equal(inserted, 0);
  assert.match(authorization.headers.get('set-cookie')!, /HttpOnly/);
  assert.match(authorization.headers.get('set-cookie')!, /Secure/);
  const now = Date.now();
  const cookie = payer.sealWechatPayContext({ purpose: 'payer', userId: 'user-a', appId: configured.WECHAT_PAY_JSAPI_APP_ID, openid: 'payer-test', issuedAt: now, expiresAt: now + 60_000 }, configured.WECHAT_PAY_JSAPI_APP_SECRET);
  assert.equal((await (await route.POST(request(wechatUa, { Cookie: `${payer.WECHAT_PAYER_COOKIE}=${cookie}` }))).json()).mode, 'jsapi');
  assert.equal((await (await route.POST(request(mobileUa, { 'X-Real-IP': '203.0.113.5' }))).json()).mode, 'h5');
  caps = nativeCaps;
  const fallback = await (await route.POST(request(wechatUa))).json();
  assert.equal(fallback.mode, 'native');
  assert.ok(fallback.notice);
  assert.equal(inserted, 3);
  caps = allCaps;
  failOrder = true;
  const failed = await route.POST(request(mobileUa, { 'X-Real-IP': '203.0.113.5' }));
  assert.equal(failed.status, 502);
  assert.match((await failed.json()).outTradeNo, /^WX/);
  assert.equal(inserted, 4, 'unknown provider outcome retains local order for later notification');
  failOrder = false;
  caps = nativeCaps;
  const attempt = 'aab522e3-9b08-4e4b-a3fb-ebbd0018fb8b';
  await route.POST(request(mobileUa, {}, attempt));
  duplicate = true;
  const repeated = await (await route.POST(request(mobileUa, {}, attempt))).json();
  assert.equal(repeated.mode, 'pending');
  assert.equal(orderNumbers.at(-1), orderNumbers.at(-2), 'retried purchase intent uses the same order');
});

test('OAuth callback rejects mismatched state and user; success returns encrypted payer cookie without login mutation', async () => {
  let userId = 'user-a';
  let exchanges = 0;
  const route = loadRoute('src/app/api/payments/wechat/authorize/callback/route.ts', {
    '@/utils/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: userId } } }) } }) },
    '@/lib/auth/wechat': { resolveSiteUrl: () => configured.NEXT_PUBLIC_SITE_URL, exchangeWechatCode: async () => { exchanges++; return { openid: 'payer-test' }; } },
    '@/lib/payments/wechat': wechat,
    '@/lib/payments/wechatPayer': payer,
  });
  const now = Date.now();
  const token = payer.sealWechatPayContext({ purpose: 'oauth', userId, appId: configured.WECHAT_PAY_JSAPI_APP_ID, state: 'state-test', packageId: 'insight_100', issuedAt: now, expiresAt: now + 60_000 }, configured.WECHAT_PAY_JSAPI_APP_SECRET);
  const request = (state: string) => new NextRequest(`https://shop.example.test/api/payments/wechat/authorize/callback?code=test&state=${state}`, { headers: { Cookie: `${payer.WECHAT_PAY_OAUTH_COOKIE}=${token}` } });
  assert.match((await route.GET(request('wrong-state'))).headers.get('location')!, /auth_failed/);
  userId = 'other-user';
  assert.match((await route.GET(request('state-test'))).headers.get('location')!, /auth_failed/);
  assert.equal(exchanges, 0);
  userId = 'user-a';
  const response = await route.GET(request('state-test'));
  assert.equal(exchanges, 1);
  assert.match(response.headers.get('location')!, /wechat=authorized&package=insight_100/);
  assert.match(response.headers.get('set-cookie')!, /the_one_wechat_payer=/);
  assert.ok(!response.headers.get('set-cookie')!.includes('payer-test'));
});
