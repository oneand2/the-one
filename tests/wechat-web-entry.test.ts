import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import ts from 'typescript';
import * as webEntry from '../src/lib/payments/wechatWebEntry';

test('only external mobile browsers without approved H5 get a webpage entry when JSAPI is available', () => {
  const caps = { native: true, h5: false, jsapi: true };
  for (const userAgent of ['Mozilla/5.0 iPhone Mobile Safari', 'Mozilla/5.0 Android Mobile Chrome']) {
    assert.equal(webEntry.shouldUseWechatWebEntry(userAgent, caps), true);
    assert.equal(webEntry.shouldUseWechatWebEntry(userAgent, { ...caps, h5: true }), false);
    assert.equal(webEntry.shouldUseWechatWebEntry(userAgent, { ...caps, jsapi: false }), false);
  }
  for (const userAgent of ['Macintosh', 'Windows NT Chrome', 'iPhone MicroMessenger/8.0', 'Android wxwork', 'iPhone miniProgram', 'MacWechat']) {
    assert.equal(webEntry.shouldUseWechatWebEntry(userAgent, caps), false);
  }
  assert.equal(webEntry.shouldUseWechatWebEntry('Macintosh', caps, true), true);
  assert.equal(webEntry.shouldUseWechatWebEntry('Windows NT', caps, true), false);
});

test('entry QR contains only a fixed HTTPS website login and validated product selection, never an order or session', () => {
  const origin = 'https://shop.example.test';
  const entry = webEntry.buildWechatWebEntryUrl(origin, 'insight_100');
  const url = new URL(entry);
  assert.equal(url.origin, origin);
  assert.equal(url.pathname, '/login');
  assert.equal(webEntry.getWechatWebEntryPackage(url.searchParams.get('next')!)?.id, 'insight_100');
  assert.equal(webEntry.isWechatWebEntryUrl(entry, origin, 'insight_100'), true);
  assert.equal(webEntry.isWechatWebEntryUrl(entry, origin, 'vip_lifetime'), false);
  assert.equal(webEntry.isWechatWebEntryUrl(entry.replace(origin, 'https://attacker.test'), origin, 'insight_100'), false);
  assert.equal(webEntry.isWechatWebEntryUrl(`${entry}&next=/attacker`, origin, 'insight_100'), false);
  assert.ok(!/ticket|openid|session|weixin:|wxaurl|wxmpurl|order=/i.test(entry));
  assert.throws(() => webEntry.buildWechatWebEntryPath('unknown'));
  for (const path of ['//attacker.test/shop?wechat_web_entry=1&package=insight_100', '/shop?wechat_web_entry=1&package=unknown', '/shop?wechat_web_entry=1&package=insight_100&package=vip_lifetime', '/shop?package=insight_100', '/profile?wechat_web_entry=1&package=insight_100']) {
    assert.equal(webEntry.getWechatWebEntryPackage(path), null);
  }
});

test('web-entry login disables mini-program and QR login while preserving normal sign-in and logged-in accounts', async () => {
  let user: { id: string } | null = null;
  const require = createRequire(`${process.cwd()}/package.json`);
  const replacements: Record<string, unknown> = {
    'next/headers': { headers: async () => new Headers({ 'User-Agent': 'iPhone MicroMessenger/8.0' }) },
    'next/navigation': { redirect: (path: string) => { throw new Error(`redirect:${path}`); } },
    'next/link': 'a',
    './LoginForm': { LoginForm: 'login-form' },
    './login.module.css': {},
    '@/lib/payments/wechatWebEntry': webEntry,
    '@/utils/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }) },
    '@/lib/auth/wechat': {
      getWechatLoginConfig: () => ({ enabled: true }),
      getWechatMiniProgramConfig: () => ({ enabled: true }),
      shouldUseMiniProgramRelay: () => true,
    },
  };
  const code = ts.transpileModule(readFileSync('src/app/login/page.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const exports: { default?: (props: { searchParams: Promise<Record<string, string>> }) => Promise<{ props: { children: Array<{ type: unknown; props: Record<string, unknown> }> } }> } = {};
  new Function('require', 'exports', code)((name: string) => replacements[name] ?? require(name), exports);
  const path = webEntry.buildWechatWebEntryPath('insight_100');
  const render = async (next: string) => exports.default!({ searchParams: Promise.resolve({ next }) });
  const entryPage = await render(path);
  const entryForm = entryPage.props.children.find(child => child.type === 'login-form')!;
  assert.equal(entryForm.props.wechatEnabled, false);
  assert.equal(entryForm.props.wechatRelay, false);
  assert.equal(entryForm.props.next, path);
  assert.match(String(entryForm.props.message), /不会跳转小程序/);
  const normalForm = (await render('/shop')).props.children.find(child => child.type === 'login-form')!;
  assert.equal(normalForm.props.wechatEnabled, true);
  user = { id: 'already-signed-in' };
  await assert.rejects(render(path), error => error instanceof Error && error.message === `redirect:${path}`);
});
