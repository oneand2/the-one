import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const loginUrl = 'https://www.the-one-and-the-two.com/login';

type MiniPage = {
  data: Record<string, unknown>;
  setData: (data: Record<string, unknown>) => void;
  openLogin: () => void;
  copyLoginUrl: () => void;
  onLoad: (query?: { src?: unknown }) => void;
  onLoadError: () => void;
  retry: () => void;
};

type Navigation = {
  url: string;
  fail: () => void;
  complete: () => void;
};

function loadPage(name: 'index/index' | 'web-login/webview', wx: Record<string, unknown> = {}) {
  let page: MiniPage;
  vm.runInNewContext(readFileSync(`wechat-miniprogram/pages/${name}.js`, 'utf8'), {
    Page: (definition: MiniPage) => {
      page = definition;
      page.setData = data => Object.assign(page.data, data);
    },
    wx,
  });
  return page!;
}

test('home only opens the fixed HTTPS website login after a tap and blocks duplicate navigation', () => {
  const navigations: Navigation[] = [];
  const page = loadPage('index/index', {
    navigateTo: (options: Navigation) => navigations.push(options),
  });
  assert.equal(page.data.loginUrl, loginUrl);
  assert.equal(navigations.length, 0);
  page.openLogin();
  page.openLogin();
  assert.equal(navigations.length, 1);
  const navigation = navigations[0];
  assert.equal(navigation.url, `/pages/web-login/webview?src=${encodeURIComponent(loginUrl)}`);
  assert.equal(page.data.opening, true);
  navigation.complete();
  assert.equal(page.data.opening, false);
  page.openLogin();
  assert.equal(navigations.length, 2);
});

test('navigation failure leaves the home usable without copying anything automatically', () => {
  const messages: string[] = [];
  const page = loadPage('index/index', {
    navigateTo: (options: Navigation) => { options.fail(); options.complete(); },
    showToast: (options: { title: string }) => messages.push(options.title),
  });
  page.openLogin();
  assert.equal(page.data.opening, false);
  assert.deepEqual(messages, ['暂时无法打开，请复制网址后访问']);
});

test('both pages copy only the public login URL on explicit request and explain copy failure', () => {
  for (const name of ['index/index', 'web-login/webview'] as const) {
    const copies: string[] = [];
    const messages: string[] = [];
    const page = loadPage(name, {
      setClipboardData: (options: { data: string; fail: () => void }) => {
        copies.push(options.data);
        options.fail();
      },
      showToast: (options: { title: string }) => messages.push(options.title),
    });
    assert.equal(copies.length, 0);
    page.copyLoginUrl();
    assert.deepEqual(copies, [loginUrl]);
    assert.deepEqual(messages, ['复制未完成，请重试']);
  }
});

test('web-view accepts encoded and already-decoded site URLs without corrupting login ticket parameters', () => {
  const completeUrl = 'https://www.the-one-and-the-two.com/api/auth/wechat/miniprogram/complete?ticket=abc&next=%2Fshop%3Fsource%3Dmini';
  for (const src of [loginUrl, completeUrl, 'https://the-one-and-the-two.com/login']) {
    for (const supplied of [src, encodeURIComponent(src)]) {
      const page = loadPage('web-login/webview');
      page.onLoad({ src: supplied });
      assert.equal(page.data.src, src);
      assert.equal(page.data.loadError, false);
    }
  }
});

test('web-view rejects missing, malformed and external URLs rather than opening them', () => {
  for (const src of [undefined, '', 123, '%E0%A4%A', 'javascript:alert(1)', '//example.com',
    'http://www.the-one-and-the-two.com/login', 'https://www.the-one-and-the-two.com.evil.test/login',
    'https://www.the-one-and-the-two.com@evil.test/login', 'https://evil.test/login']) {
    const page = loadPage('web-login/webview');
    page.onLoad({ src });
    assert.equal(page.data.src, '');
    assert.equal(page.data.loadError, true);
    page.retry();
    assert.equal(page.data.loadError, true);
  }
  const page = loadPage('web-login/webview');
  page.onLoad();
  assert.equal(page.data.loadError, true);
});

test('a web-view load error offers a retry while preserving the original website destination', () => {
  const page = loadPage('web-login/webview');
  page.onLoad({ src: encodeURIComponent(loginUrl) });
  page.onLoadError();
  assert.equal(page.data.loadError, true);
  assert.equal(page.data.src, loginUrl);
  page.retry();
  assert.equal(page.data.loadError, false);
  assert.equal(page.data.src, loginUrl);
});

test('home entry and web-view error handlers are wired to registered mini-program pages', () => {
  const app = JSON.parse(readFileSync('wechat-miniprogram/app.json', 'utf8'));
  assert.ok(app.pages.includes('pages/web-login/webview'));
  const home = readFileSync('wechat-miniprogram/pages/index/index.wxml', 'utf8');
  assert.match(home, /bindtap="openLogin"/);
  assert.match(home, /\{\{loginUrl\}\}/);
  assert.match(home, /bindtap="copyLoginUrl"/);
  const webview = readFileSync('wechat-miniprogram/pages/web-login/webview.wxml', 'utf8');
  assert.match(webview, /binderror="onLoadError"/);
  assert.match(webview, /wx:if="\{\{src && !loadError\}\}"/);
  assert.match(webview, /bindtap="retry"/);
});

test('home uses the same two-line logo geometry as the website login, without a seal frame', () => {
  const logo = readFileSync('wechat-miniprogram/assets/brand-mark.svg', 'utf8');
  const website = readFileSync('src/app/login/LoginForm.tsx', 'utf8');
  const rectangles = logo.match(/<rect[^>]+\/>/g) || [];
  assert.equal(rectangles.length, 2);
  for (const rectangle of rectangles) assert.ok(website.includes(rectangle));
  assert.match(logo, /viewBox="0 0 100 100"/);
  assert.match(logo, /fill="#2c2c2c"/);
  const home = readFileSync('wechat-miniprogram/pages/index/index.wxml', 'utf8');
  assert.match(home, /src="\/assets\/brand-mark.svg"/);
  assert.doesNotMatch(home, /emblem-inner/);
});
