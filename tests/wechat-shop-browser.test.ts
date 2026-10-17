import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import ts from 'typescript';
import * as packages from '../src/lib/payments/coinPackages';
import { isWechatJsapiEnvironment } from '../src/lib/payments/wechatBrowser';
import * as consent from '../src/lib/payments/purchaseConsent';
import * as webEntry from '../src/lib/payments/wechatWebEntry';

type View = {
  type: unknown;
  props: {
    children?: unknown;
    type?: string;
    role?: string;
    checked?: boolean;
    disabled?: boolean;
    href?: string;
    onChange?: (event: { target: { checked: boolean } }) => void;
    onClick?: () => void | Promise<void>;
  };
};

function elements(value: unknown): View[] {
  if (Array.isArray(value)) return value.flatMap(elements);
  if (!value || typeof value !== 'object' || !('props' in value)) return [];
  const view = value as View;
  return [view, ...elements(view.props.children)];
}

function textContent(value: unknown): string {
  if (Array.isArray(value)) return value.map(textContent).join('');
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (value && typeof value === 'object' && 'props' in value) return textContent((value as View).props.children);
  return '';
}

function loadShop(invoke: () => Promise<'ok'>) {
  const hooks: unknown[] = [];
  const effects: Array<() => void> = [];
  let cursor = 0;
  const state = (initial: unknown) => {
    const index = cursor++;
    if (!(index in hooks)) hooks[index] = initial;
    return [hooks[index], (value: unknown) => {
      hooks[index] = typeof value === 'function' ? value(hooks[index]) : value;
    }];
  };
  const replacements: Record<string, unknown> = {
    'next/link': 'a',
    'next/image': 'img',
    react: {
      useState: state,
      useRef: (current: unknown) => state({ current })[0],
      useEffect: (effect: () => void) => effects.push(effect),
      useEffectEvent: (callback: unknown) => callback,
    },
    '@/lib/payments/coinPackages': packages,
    '@/lib/payments/purchaseConsent': consent,
    '@/lib/payments/wechatWebEntry': webEntry,
    '@/lib/payments/wechatBrowser': { isWechatJsapiEnvironment, invokeWechatPay: invoke },
    '@/lib/payments/wechatMiniBrowser': { isMiniProgramPaymentEnvironment: async () => false },
    '@/utils/iosEmbed': { requestAppLogin: () => false },
    '@/utils/vip': { isLifetimeVip: () => false },
  };
  const require = createRequire(`${process.cwd()}/package.json`);
  const code = ts.transpileModule(readFileSync('src/app/shop/page.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const exports: { default?: () => unknown } = {};
  new Function('require', 'exports', code)((name: string) => replacements[name] ?? require(name), exports);
  const render = () => {
    cursor = 0;
    return exports.default!();
  };
  return Object.assign(render, {
    runEffects: async () => {
      effects.splice(0).forEach(effect => effect());
      await new Promise(resolve => setImmediate(resolve));
    },
  });
}

const mobileUa = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Mobile Safari/604.1';
const notice = '当前浏览器暂不支持直接拉起微信付款。请在手机微信中打开本站付款。';

for (const scenario of ['native', 'web_entry', 'authorize', 'jsapi', 'wechat-jsapi'] as const) {
  test(`shop handles ${scenario} without silently sending external browsers to the WeChat-only cashier`, async (context) => {
    const originalWindow = globalThis.window;
    const redirects: string[] = [];
    let invocations = 0;
    const insideWechat = scenario === 'wechat-jsapi';
    try {
      globalThis.window = {
        navigator: { userAgent: `${mobileUa}${insideWechat ? ' MicroMessenger/8.0' : ''}`, maxTouchPoints: 0 },
        crypto: { randomUUID: () => 'aab522e3-9b08-4e4b-a3fb-ebbd0018fb8b' },
        location: { origin: 'https://shop.example.test', assign: (url: string) => redirects.push(url) },
        sessionStorage: { setItem() { assert.fail('external browsers must not store OAuth purchase intent'); } },
      } as unknown as Window & typeof globalThis;
      context.mock.method(globalThis, 'fetch', async (url: URL | RequestInfo, options?: RequestInit) => {
        assert.equal(url, '/api/payments/wechat/create');
        assert.equal(JSON.parse(String(options?.body)).jsapi, insideWechat);
        return Response.json(scenario === 'native'
          ? { mode: 'native', outTradeNo: 'WX-test', qrDataUrl: 'data:image/png;base64,test', notice }
          : scenario === 'web_entry'
            ? { mode: 'web_entry', qrDataUrl: 'data:image/png;base64,test', entryUrl: webEntry.buildWechatWebEntryUrl('https://shop.example.test', packages.LIFETIME_VIP_PACKAGE.id) }
          : scenario === 'authorize'
            ? { mode: 'authorize', authorizationUrl: 'https://open.weixin.qq.com/test' }
            : { mode: 'jsapi', outTradeNo: 'WX-test', jsapiParams: { appId: 'test' } });
      });
      const render = loadShop(async () => { invocations++; return 'ok'; });
      const checkbox = elements(render()).find(view => view.type === 'input' && view.props.type === 'checkbox');
      assert.ok(checkbox?.props.onChange);
      checkbox.props.onChange({ target: { checked: true } });
      const purchase = elements(render()).find(view => view.type === 'button' && textContent(view) === '微信支付');
      assert.ok(purchase?.props.onClick);
      await purchase.props.onClick();
      const result = render();
      assert.deepEqual(redirects, []);
      assert.equal(invocations, insideWechat ? 1 : 0);
      if (scenario === 'web_entry') {
        const dialog = elements(result).find(view => view.props.role === 'dialog');
        assert.ok(dialog);
        assert.match(textContent(dialog), /微信扫一扫 → 从相册选择/);
        assert.match(textContent(dialog), /尚未创建支付订单/);
        assert.ok(!textContent(dialog).includes('二维码将在15分钟后失效'));
        assert.ok(!textContent(dialog).includes('不要从相册识别'));
        assert.equal(elements(dialog).some(view => textContent(view) === '确认支付结果'), false);
        assert.ok(elements(dialog).some(view => view.type === 'a' && textContent(view) === '保存入口码图片'));
      } else if (scenario === 'native') {
        const dialog = elements(result).find(view => view.props.role === 'dialog');
        assert.ok(dialog);
        assert.match(textContent(dialog), /请使用微信扫一扫/);
        assert.ok(textContent(dialog).includes(notice));
      } else if (!insideWechat) {
        assert.match(textContent(result), /当前不在手机微信浏览器中，已停止微信内付款流程/);
        assert.equal(elements(result).some(view => view.props.role === 'dialog'), false);
      } else {
        assert.match(textContent(result), /正在确认到账/);
      }
      assert.equal(elements(result).some(view => view.type === 'button' && textContent(view).includes('正在打开微信支付')), false);
    } finally {
      if (originalWindow === undefined) Reflect.deleteProperty(globalThis, 'window');
      else globalThis.window = originalWindow;
    }
  });
}

test('first purchase requires an unchecked dialog, continues the selected purchase and remembers only confirmed consent', async (context) => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const storage = new Map<string, string>();
  let requests = 0;
  try {
    globalThis.window = {
      navigator: { userAgent: mobileUa, maxTouchPoints: 0 },
      crypto: { randomUUID: () => 'aab522e3-9b08-4e4b-a3fb-ebbd0018fb8b' },
      location: { href: 'https://shop.example.test/shop', search: '' },
      addEventListener() {}, removeEventListener() {},
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
      },
    } as unknown as Window & typeof globalThis;
    globalThis.document = { addEventListener() {}, removeEventListener() {} } as unknown as Document;
    context.mock.method(globalThis, 'fetch', async (url: URL | RequestInfo, options?: RequestInit) => {
      if (url === '/api/user/profile') return Response.json({ user_id: 'buyer-a', coins_balance: 300 });
      requests++;
      assert.equal(url, '/api/payments/wechat/create');
      assert.equal(JSON.parse(String(options?.body)).packageId, packages.LIFETIME_VIP_PACKAGE.id);
      return Response.json({ mode: 'native', outTradeNo: 'WX-test', qrDataUrl: 'data:image/png;base64,test', notice });
    });
    const render = loadShop(async () => 'ok');
    render();
    await render.runEffects();
    const purchase = () => elements(render()).find(view => view.type === 'button' && textContent(view) === '微信支付')!;
    await purchase().props.onClick!();
    let dialog = elements(render()).find(view => view.type === 'dialog')!;
    assert.ok(dialog);
    assert.match(textContent(dialog), /终身 VIP/);
    assert.match(textContent(dialog), /¥398.00/);
    let confirm = elements(dialog).find(view => view.type === 'button' && textContent(view) === '同意并继续付款')!;
    assert.equal(confirm.props.disabled, true);
    await confirm.props.onClick!();
    assert.equal(requests, 0);
    const checkbox = elements(dialog).find(view => view.type === 'input')!;
    assert.equal(checkbox.props.checked, false);
    checkbox.props.onChange!({ target: { checked: true } });
    assert.equal(storage.size, 0);
    const cancel = elements(render()).find(view => view.type === 'button' && textContent(view) === '暂不购买')!;
    await cancel.props.onClick!();
    assert.equal(storage.size, 0);
    assert.equal(requests, 0);
    await purchase().props.onClick!();
    dialog = elements(render()).find(view => view.type === 'dialog')!;
    assert.equal(elements(dialog).find(view => view.type === 'input')!.props.checked, false);
    elements(dialog).find(view => view.type === 'input')!.props.onChange!({ target: { checked: true } });
    confirm = elements(render()).find(view => view.type === 'button' && textContent(view) === '同意并继续付款')!;
    assert.equal(confirm.props.disabled, false);
    await confirm.props.onClick!();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(requests, 1);
    assert.equal(consent.hasPurchaseConsent('buyer-a'), true);
    assert.equal(consent.hasPurchaseConsent('buyer-b'), false);
    assert.equal(elements(render()).some(view => view.type === 'dialog'), false);

    const reopened = loadShop(async () => 'ok');
    reopened();
    await reopened.runEffects();
    assert.equal(elements(reopened()).find(view => view.type === 'input')!.props.checked, true);
    await elements(reopened()).find(view => view.type === 'button' && textContent(view) === '微信支付')!.props.onClick!();
    assert.equal(requests, 2);
    assert.equal(elements(reopened()).some(view => view.type === 'dialog'), false);
    elements(reopened()).find(view => view.type === 'input')!.props.onChange!({ target: { checked: false } });
    assert.equal(consent.hasPurchaseConsent('buyer-a'), false);
    await elements(reopened()).find(view => view.type === 'button' && textContent(view) === '微信支付')!.props.onClick!();
    assert.equal(elements(reopened()).some(view => view.type === 'dialog'), true);
    assert.equal(requests, 2);
  } finally {
    if (originalWindow === undefined) Reflect.deleteProperty(globalThis, 'window');
    else globalThis.window = originalWindow;
    if (originalDocument === undefined) Reflect.deleteProperty(globalThis, 'document');
    else globalThis.document = originalDocument;
  }
});
