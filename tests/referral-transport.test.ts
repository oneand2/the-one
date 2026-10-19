import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import type { SupabaseClient } from '@supabase/supabase-js';
import { NextRequest, type NextResponse } from 'next/server';
import * as shared from '../src/lib/ambassadors/shared';
import * as referrals from '../src/lib/ambassadors/referral';
import * as wechat from '../src/lib/auth/wechat';

const originalSite = process.env.NEXT_PUBLIC_SITE_URL;
const site = 'https://www.the-one-and-the-two.com';
const tokenA = '11111111-1111-4111-8111-111111111111';
const tokenB = '22222222-2222-4222-8222-222222222222';
const expires = new Date(Date.now() + 86400000).toISOString();
const requireReal = createRequire(`${process.cwd()}/package.json`);
function load(path: string, dependencies: Record<string, unknown>) {
  const exports: Record<string, (...args: never[]) => unknown> = {};
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function('require', 'exports', code)((name: string) => dependencies[name] ?? requireReal(name), exports);
  return exports as unknown as Record<string, (request: NextRequest, context?: { params: Promise<{ code: string }> }) => Promise<NextResponse>>;
}
function client() {
  const visits = new Map([[tokenA, { token: tokenA, expires_at: expires, ambassadors: { code: 'xiaoye', active: true } }]]);
  const created: string[] = [];
  let failed = false;
  const fake = { from(table: string) {
    const filters: Record<string, unknown> = {};
    let inserted: Record<string, unknown> | undefined;
    return {
      select() { return this; }, eq(key: string, value: unknown) { filters[key] = value; return this; }, gt() { return this; },
      insert(row: Record<string, unknown>) { inserted = row; return this; },
      async maybeSingle() {
        if (failed) return { data: null, error: { message: 'offline' } };
        if (table === 'ambassadors') return { data: ['xiaoye', 'another'].includes(String(filters.code)) ? { id: String(filters.code), code: String(filters.code) } : null, error: null };
        const visit = visits.get(String(filters.token));
        return { data: visit && visit.ambassadors.active && Date.parse(visit.expires_at) > Date.now() ? visit : null, error: null };
      },
      async single() {
        if (failed) return { data: null, error: { message: 'offline' } };
        assert.equal(table, 'ambassador_visits');
        assert.ok(inserted);
        const token = tokenB;
        visits.set(token, { token, expires_at: expires, ambassadors: { code: String(inserted.ambassador_id), active: true } });
        created.push(token);
        return { data: { token, expires_at: expires }, error: null };
      },
    };
  } } as unknown as SupabaseClient;
  return { fake, visits, created, fail: () => { failed = true; } };
}

test('public URLs preserve referral codes across browsers without exposing private visit tokens', async () => {
  const db = client();
  assert.equal(shared.referralLoginPath('?ref=xiaoye&tab=home'), '/login?ref=xiaoye');
  for (const search of ['?ref=https://evil.test', '?ref=bad code', '?ref=', '?ref=UPPER']) assert.equal(shared.referralLoginPath(search), '/login');
  const first = await referrals.resolveReferralVisit(db.fake, tokenA, 'another');
  assert.equal(first?.token, tokenA); assert.equal(first?.code, 'xiaoye'); assert.equal(db.created.length, 0);
  const browser2 = await referrals.resolveReferralVisit(db.fake, undefined, 'xiaoye');
  assert.equal(browser2?.code, 'xiaoye'); assert.equal(browser2?.token, tokenB);
  assert.equal((await referrals.resolveReferralVisit(db.fake, tokenA, 'xiaoye'))?.expiresAt, expires);
  const cookie = referrals.referralCookie(first!, true);
  assert.ok(cookie.maxAge <= 86400); assert.equal(cookie.httpOnly, true); assert.equal(cookie.secure, true);
});

test('expired/paused sources are not reused, and lookup failures never become untracked signup', async () => {
  const db = client(); db.visits.get(tokenA)!.expires_at = new Date(Date.now() - 1000).toISOString();
  assert.equal((await referrals.resolveReferralVisit(db.fake, tokenA, 'another'))?.code, 'another');
  assert.equal(await referrals.resolveReferralVisit(db.fake, 'forged', 'unknown'), undefined);
  db.visits.get(tokenA)!.expires_at = expires; db.visits.get(tokenA)!.ambassadors.active = false;
  assert.equal(await referrals.resolveReferralVisit(db.fake, tokenA), undefined);
  db.fail(); await assert.rejects(referrals.resolveReferralVisit(db.fake, tokenA, 'xiaoye'), /无法确认/);
});

test('canonical host redirect precedes cookies and avoids HTTPS termination loops', () => {
  assert.equal(shared.canonicalSiteRequest('https://the-one-and-the-two.com/r/xiaoye?x=1', site)?.href, `${site}/r/xiaoye?x=1`);
  assert.equal(shared.canonicalSiteRequest('http://www.the-one-and-the-two.com/login', site), null);
  assert.equal(shared.canonicalSiteRequest('https://evil.test/r/xiaoye', site), null);
  assert.equal(shared.canonicalSiteRequest('http://localhost:3000/', site), null);
});

test('referral entry redirects to a shareable homepage, retaining first touch and original expiry', async () => {
  process.env.NEXT_PUBLIC_SITE_URL = site;
  try {
    const db = client();
    const route = load('src/app/r/[code]/route.ts', { '@/utils/supabase/admin': { createAdminClient: () => db.fake }, '@/lib/ambassadors/shared': shared, '@/lib/ambassadors/referral': referrals });
    const alias = await route.GET(new NextRequest('https://the-one-and-the-two.com/r/xiaoye'), { params: Promise.resolve({ code: 'xiaoye' }) });
    assert.equal(alias.headers.get('location'), `${site}/r/xiaoye`); assert.equal(alias.headers.get('set-cookie'), null);
    const response = await route.GET(new NextRequest(`${site}/r/another`, { headers: { Cookie: `${shared.REFERRAL_COOKIE}=${tokenA}` } }), { params: Promise.resolve({ code: 'another' }) });
    assert.equal(response.headers.get('location'), `${site}/?ref=xiaoye`);
    assert.ok(!response.headers.get('location')!.includes(tokenA)); assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.ok(response.headers.get('set-cookie')!.includes('HttpOnly')); assert.equal(db.created.length, 0);
  } finally { if (originalSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL; else process.env.NEXT_PUBLIC_SITE_URL = originalSite; }
});

test('shared homepage restores attribution before rendering, preserving it through session refresh and login redirects', async () => {
  const db = client();
  const middleware = load('src/middleware.ts', {
    '@/lib/ambassadors/referral': referrals, '@/lib/ambassadors/shared': shared,
    '@/utils/supabase/admin': { createAdminClient: () => db.fake },
    '@supabase/ssr': { createServerClient: (_url: string, _key: string, options: { cookies: { getAll(): { name: string; value: string }[]; setAll(values: { name: string; value: string; options: { path: string } }[]): void } }) => ({ auth: { async getUser() {
      assert.ok(options.cookies.getAll().some((c: { name: string; value: string }) => c.name === shared.REFERRAL_COOKIE && c.value === tokenB));
      options.cookies.setAll([{ name: 'session-test', value: 'new', options: { path: '/' } }]);
      return { data: { user: null } };
    } } }) },
  });
  const env = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY };
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'; process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test';
  try {
    const response = await middleware.middleware(new NextRequest(`${site}/?ref=xiaoye`));
    assert.ok(response.headers.get('set-cookie')?.includes(`${shared.REFERRAL_COOKIE}=${tokenB}`));
    assert.ok(response.headers.get('set-cookie')?.includes('session-test=new'));
    const protectedResponse = await middleware.middleware(new NextRequest(`${site}/profile?ref=xiaoye`));
    assert.ok(protectedResponse.headers.get('location')?.includes('/login'));
    assert.ok(protectedResponse.headers.get('set-cookie')?.includes(shared.REFERRAL_COOKIE));
    db.fail(); const failed = await middleware.middleware(new NextRequest(`${site}/?ref=xiaoye`)); assert.equal(failed.status, 503);
  } finally {
    if (env.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = env.url;
    if (env.key === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = env.key;
  }
});

test('WeChat start snapshots restored referral in both mini-program ticket and signed desktop OAuth context', async () => {
  process.env.NEXT_PUBLIC_SITE_URL = site;
  const db = client(); let ticket: { ambassadorToken?: string } | undefined;
  const route = load('src/app/api/auth/wechat/start/route.ts', {
    '@/lib/ambassadors/referral': referrals, '@/lib/ambassadors/shared': shared,
    '@/utils/supabase/admin': { createAdminClient: () => db.fake },
    '@/lib/auth/wechat': { ...wechat, getWechatLoginConfig: () => ({ enabled: true, appId: 'wx-test', appSecret: 'test-secret', siteUrl: site }), getWechatMiniProgramConfig: () => ({ enabled: true, siteUrl: site }) },
    '@/lib/auth/wechatTickets': { insertWechatLoginTicket: async (input: { ambassadorToken?: string }) => { ticket = input; }, setWechatTicketCookie: () => {} },
  });
  try {
    const relay = await route.GET(new NextRequest(`${site}/api/auth/wechat/start?mode=login&ref=xiaoye`, { headers: { 'User-Agent': 'iPhone Safari' } }));
    assert.equal(relay.status, 307); assert.equal(ticket?.ambassadorToken, tokenB);
    const desktop = await route.GET(new NextRequest(`${site}/api/auth/wechat/start?mode=login&ref=xiaoye`, { headers: { Cookie: `${shared.REFERRAL_COOKIE}=${tokenA}`, 'User-Agent': 'Macintosh Chrome' } }));
    const sealed = desktop.cookies.get(wechat.WECHAT_OAUTH_COOKIE)!.value;
    assert.equal(wechat.verifyWechatOAuthContext(sealed, 'test-secret')?.ambassadorToken, tokenA);
    assert.equal(wechat.verifyWechatOAuthContext(sealed + 'tampered', 'test-secret'), null);
    assert.ok(!desktop.headers.get('location')!.includes(tokenA));
    db.fail(); ticket = undefined;
    const failed = await route.GET(new NextRequest(`${site}/api/auth/wechat/start?ref=xiaoye`, { headers: { 'User-Agent': 'iPhone' } }));
    assert.ok(failed.headers.get('location')!.includes('message=')); assert.equal(ticket, undefined);
  } finally { if (originalSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL; else process.env.NEXT_PUBLIC_SITE_URL = originalSite; }
});

test('OAuth callback uses the signed start-time referral even when separate referral cookie disappears or changes', async () => {
  for (const cookie of ['', `${shared.REFERRAL_COOKIE}=${tokenB}`]) {
    let captured: string | undefined;
    const context = { state: 'state-a', mode: 'login' as const, next: '/', ambassadorToken: tokenA, issuedAt: Date.now() };
    const route = load('src/app/api/auth/wechat/callback/route.ts', {
      '@/lib/ambassadors/shared': shared,
      '@/lib/ambassadors/server': { validReferralToken: async (_client: unknown, value?: string) => value },
      '@/lib/auth/wechat': { ...wechat, getWechatLoginConfig: () => ({ enabled: true, appId: 'test', siteUrl: site, appSecret: 'secret' }), verifyWechatOAuthContext: () => context, exchangeWechatCode: async () => ({ access_token: 'test', openid: 'test' }), fetchWechatUserInfo: async () => ({}) },
      '@/utils/supabase/admin': { createAdminClient: () => ({}) },
      '@/lib/auth/wechatIdentity': { createCookieSupabase: () => ({}), establishWechatSession: async () => {}, loginOrCreateWechatUser: async (_client: unknown, _profile: unknown, value?: string) => { captured = value; return 'test-user'; } },
    });
    const response = await route.GET(new NextRequest(`${site}/api/auth/wechat/callback?state=state-a&code=test`, { headers: { Cookie: cookie } }));
    assert.equal(response.status, 307); assert.equal(captured, tokenA);
  }
});

test('email signup restores a public referral when its cookie is absent and stops on source lookup failure', async () => {
  const db = client(); let submitted: { ambassadorToken?: string } | undefined;
  const actions = load('src/app/login/actions.ts', {
    'next/headers': { cookies: async () => ({ get: () => undefined }) },
    '@/lib/ambassadors/shared': shared, '@/lib/ambassadors/referral': referrals,
    '@/utils/supabase/admin': { createAdminClient: () => db.fake },
    '@/utils/supabase/server': { createClient: async () => ({}) },
    '@/utils/authOtp': { requestSignupOtp: async (_client: unknown, input: { ambassadorToken?: string }) => { submitted = input; return { otpEmail: 'test@example.invalid' }; } },
  }) as unknown as { signup(input: FormData): Promise<{ error?: string; otpEmail?: string }> };
  const form = new FormData();
  for (const [key, value] of Object.entries({ email: 'test@example.invalid', password: 'password123', confirmPassword: 'password123', ref: 'xiaoye' })) form.set(key, value);
  assert.equal((await actions.signup(form)).otpEmail, 'test@example.invalid'); assert.equal(submitted?.ambassadorToken, tokenB);
  db.fail(); submitted = undefined;
  assert.ok((await actions.signup(form)).error?.includes('推广来源'));
  assert.equal(submitted, undefined);
});
