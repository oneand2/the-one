import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test, type TestContext } from 'node:test';
import ts from 'typescript';

type View = {
  type: unknown;
  props: {
    children?: unknown;
    value?: string;
    disabled?: boolean;
    'aria-pressed'?: boolean;
    externalQuestion?: string;
    onChange?: (event: { target: { value: string } }) => void;
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

const LiuYaoView = () => null;
const question = '这份工作还要继续吗？';
const answer = '先梳理收入、成长和精力，再决定是否离职。';

function loadChat(options: {
  getUser: () => Promise<{ data: { user: { id: string } | null } }>;
  request: (url: string, init?: RequestInit) => Promise<Response>;
  navigate: (url: string) => void;
  appLogin: () => boolean;
}) {
  const hooks: unknown[] = [];
  const effects: Array<() => void | (() => void)> = [];
  const cleanups: Array<() => void> = [];
  let cursor = 0;
  const state = (initial: unknown) => {
    const index = cursor++;
    if (!(index in hooks)) hooks[index] = typeof initial === 'function' ? initial() : initial;
    return [hooks[index], (value: unknown) => {
      hooks[index] = typeof value === 'function' ? value(hooks[index]) : value;
    }];
  };
  const searchParams = new URLSearchParams();
  const replacements: Record<string, unknown> = {
    react: {
      useState: state,
      useRef: (current: unknown) => state({ current })[0],
      useEffect: (effect: () => void | (() => void), deps?: unknown[]) => {
        const index = cursor++;
        const previous = hooks[index] as unknown[] | undefined;
        if (!deps || !previous || deps.some((value, i) => !Object.is(value, previous[i]))) effects.push(effect);
        hooks[index] = deps;
      },
    },
    'framer-motion': {
      motion: new Proxy({}, { get: (_target, tag) => `motion.${String(tag)}` }),
      AnimatePresence: 'AnimatePresence',
    },
    'next/navigation': {
      useRouter: () => ({ push: options.navigate, replace: options.navigate }),
      useSearchParams: () => searchParams,
    },
    '@/utils/supabase/client': { createClient: () => ({ auth: { getUser: options.getUser } }) },
    './InsufficientCoinsModal': { InsufficientCoinsModal: () => null },
    './JueXingCangTipModal': { JueXingCangTipModal: () => null },
    './CopperCoinIcon': { CopperCoinIcon: () => null },
    './LiuYaoView': { LiuYaoView },
    '@/utils/cache': { getCached: () => null, setCached() {}, CACHE_KEYS: {}, RECORDS_TTL_MS: 0 },
    '@/utils/fetchWithRetry': { fetchWithRetry: options.request },
    '@/utils/iosEmbed': { requestAppLogin: options.appLogin, homeHref: () => '/?tab=juexingcang' },
    '@/utils/vip': { isVip: () => false },
    '@/lib/baguaPersonality': { personalityName: (value: string) => value },
  };
  const require = createRequire(`${process.cwd()}/package.json`);
  const code = ts.transpileModule(readFileSync('src/components/JueXingCangView.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const exports: { JueXingCangView?: (props: { hideHeader: boolean }) => unknown } = {};
  new Function('require', 'exports', code)((name: string) => replacements[name] ?? require(name), exports);
  const render = () => {
    cursor = 0;
    return exports.JueXingCangView!({ hideHeader: true });
  };
  return Object.assign(render, {
    runEffects: async () => {
      effects.splice(0).forEach(effect => {
        const cleanup = effect();
        if (cleanup) cleanups.push(cleanup);
      });
      await new Promise(resolve => setImmediate(resolve));
    },
    cleanup: () => cleanups.splice(0).forEach(cleanup => cleanup()),
  });
}

function setup(context: TestContext, config: { browserUser: 'null' | 'throw' | 'signed-in'; chat: 'ok' | 'unauthorized' | 'network' }) {
  const originalWindow = globalThis.window;
  const originalStorage = globalThis.localStorage;
  const storage = new Map([['juexingcang-tip-dont-show', 'true']]);
  const localStorage: Storage = {
    get length() { return storage.size; },
    clear: () => storage.clear(),
    key: (index: number) => [...storage.keys()][index] ?? null,
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value); },
    removeItem: (key: string) => { storage.delete(key); },
  };
  const navigations: string[] = [];
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  let authCalls = 0;
  let appLoginCalls = 0;
  globalThis.localStorage = localStorage;
  globalThis.window = {
    localStorage,
    location: { href: 'https://the-one.example.test/?tab=juexingcang', assign: (url: string) => navigations.push(url) },
    history: { replaceState: (_state: unknown, _title: string, url: string) => navigations.push(url) },
    addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true,
    setTimeout, clearTimeout,
  } as unknown as Window & typeof globalThis;
  context.mock.method(console, 'error', () => undefined);
  context.mock.method(console, 'warn', () => undefined);
  context.mock.method(globalThis, 'fetch', async (url: URL | RequestInfo) => {
    assert.equal(url, '/api/user/profile');
    return Response.json({ juexingcang_meditation_default: true });
  });
  const render = loadChat({
    getUser: async () => {
      authCalls++;
      if (config.browserUser === 'throw') throw new TypeError('Failed to fetch');
      return { data: { user: config.browserUser === 'signed-in' ? { id: 'browser-user' } : null } };
    },
    navigate: url => navigations.push(url),
    appLogin: () => { appLoginCalls++; return false; },
    request: async (url, init) => {
      calls.push({ url, init });
      if (url === '/api/chat') {
        if (config.chat === 'network') throw new TypeError('Failed to fetch');
        if (config.chat === 'unauthorized') return Response.json({ error: 'Unauthorized' }, { status: 401 });
        return new Response(answer, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
      if (url === '/api/chat-sessions') {
        if (init?.method === 'POST') return Response.json({ id: 'session-a', title: '新对话' });
        return Response.json([]);
      }
      if (url === '/api/chat-sessions/session-a/messages') return Response.json({ ok: true });
      assert.fail(`Unexpected request: ${url}`);
    },
  });
  context.after(() => {
    render.cleanup();
    if (originalWindow === undefined) Reflect.deleteProperty(globalThis, 'window');
    else globalThis.window = originalWindow;
    if (originalStorage === undefined) Reflect.deleteProperty(globalThis, 'localStorage');
    else globalThis.localStorage = originalStorage;
  });
  const toggle = () => {
    const button = elements(render()).find(view => view.type === 'button' && textContent(view).trim() === '起卦');
    assert.ok(button?.props.onClick);
    return button;
  };
  const typeQuestion = () => {
    const textarea = elements(render()).find(view => view.type === 'textarea');
    assert.ok(textarea?.props.onChange);
    textarea.props.onChange({ target: { value: question } });
  };
  const send = async () => {
    const button = elements(render()).find(view => view.type === 'button' && typeof view.props.disabled === 'boolean');
    assert.ok(button?.props.onClick);
    assert.equal(button.props.disabled, false);
    await button.props.onClick();
  };
  return { render, toggle, typeQuestion, send, navigations, calls, authCalls: () => authCalls, appLoginCalls: () => appLoginCalls };
}

for (const browserUser of ['null', 'throw'] as const) {
  test(`ordinary chat uses the same-origin API when browser getUser would ${browserUser === 'null' ? 'return no user' : 'throw'}`, async context => {
    const chat = setup(context, { browserUser, chat: 'ok' });
    chat.render();
    await chat.render.runEffects();
    assert.equal(chat.toggle().props['aria-pressed'], true);
    await chat.toggle().props.onClick!();
    assert.equal(chat.toggle().props['aria-pressed'], false);
    chat.typeQuestion();
    await chat.send();
    const result = chat.render();
    const request = chat.calls.find(call => call.url === '/api/chat');
    assert.ok(request);
    assert.equal(request.init?.method, 'POST');
    assert.deepEqual(JSON.parse(String(request.init?.body)).messages, [{ role: 'user', content: question }]);
    assert.ok(textContent(result).includes(question));
    assert.ok(textContent(result).includes(answer));
    assert.equal(elements(result).find(view => view.type === 'textarea')?.props.value, '');
    assert.equal(chat.toggle().props['aria-pressed'], false);
    assert.equal(chat.authCalls(), 0);
    assert.equal(chat.appLoginCalls(), 0);
    assert.deepEqual(chat.navigations, []);
    assert.equal(elements(result).some(view => view.type === LiuYaoView), false);
  });
}

test('a chat API 401 preserves the question and disabled casting switch without navigating away', async context => {
  const chat = setup(context, { browserUser: 'signed-in', chat: 'unauthorized' });
  chat.render();
  await chat.render.runEffects();
  await chat.toggle().props.onClick!();
  chat.typeQuestion();
  await chat.send();
  const result = chat.render();
  const textarea = elements(result).find(view => view.type === 'textarea');
  assert.equal(chat.calls.filter(call => call.url === '/api/chat').length, 1);
  assert.ok(textContent(result).includes(question));
  assert.match(textContent(result), /请先登录后再发送。问题已保留/);
  assert.equal(textarea?.props.value, question);
  assert.equal(textarea?.props.disabled, false);
  assert.equal(chat.toggle().props['aria-pressed'], false);
  assert.equal(chat.authCalls(), 0);
  assert.equal(chat.appLoginCalls(), 0);
  assert.deepEqual(chat.navigations, []);
});

test('a chat network error keeps the conversation visible and does not navigate', async context => {
  const chat = setup(context, { browserUser: 'throw', chat: 'network' });
  chat.render();
  await chat.render.runEffects();
  await chat.toggle().props.onClick!();
  chat.typeQuestion();
  await chat.send();
  const result = chat.render();
  assert.equal(chat.calls.filter(call => call.url === '/api/chat').length, 1);
  assert.ok(textContent(result).includes(question));
  assert.match(textContent(result), /网络连接异常，请重试或切换网络/);
  assert.equal(elements(result).find(view => view.type === 'textarea')?.props.disabled, false);
  assert.equal(chat.toggle().props['aria-pressed'], false);
  assert.equal(chat.authCalls(), 0);
  assert.equal(chat.appLoginCalls(), 0);
  assert.deepEqual(chat.navigations, []);
});

test('casting remains enabled by default and enters LiuYaoView instead of calling chat', async context => {
  const chat = setup(context, { browserUser: 'signed-in', chat: 'ok' });
  chat.render();
  await chat.render.runEffects();
  assert.equal(chat.toggle().props['aria-pressed'], true);
  chat.typeQuestion();
  await chat.send();
  const casting = elements(chat.render()).find(view => view.type === LiuYaoView);
  assert.ok(casting);
  assert.equal(casting.props.externalQuestion, question);
  assert.equal(chat.calls.filter(call => call.url === '/api/chat').length, 0);
  assert.equal(chat.authCalls(), 1);
  assert.equal(chat.appLoginCalls(), 0);
  assert.deepEqual(chat.navigations, []);
});
