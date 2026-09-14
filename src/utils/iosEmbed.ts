declare global {
  interface Window {
    __THEONE_IOS_EMBED__?: boolean;
    __THEONE_TAB__?: string | null;
    __THEONE_NAVIGATE__?: (tab: string) => void;
    webkit?: {
      messageHandlers?: {
        theone?: {
          postMessage: (message: { type: string; tab?: string; payload?: unknown }) => void;
        };
      };
    };
  }
}

function nativeBridge() {
  if (typeof window === 'undefined') return undefined;
  return window.webkit?.messageHandlers?.theone;
}

export function isIOSEmbed(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.__THEONE_IOS_EMBED__) return true;
  if (document.documentElement.getAttribute('data-ios-embed') === 'true') return true;
  if (document.querySelector('[data-ios-embed="true"]')) return true;
  return new URLSearchParams(window.location.search).get('embed') === 'ios';
}

export function isMiniProgramEmbed(): boolean {
  if (typeof window === 'undefined') return false;
  if (document.documentElement.getAttribute('data-mp-embed') === 'true') return true;
  try {
    if (window.sessionStorage.getItem('the-one-embed') === 'miniprogram') return true;
  } catch {
    // ignore
  }
  const ua = window.navigator.userAgent || '';
  if (/miniProgram|MiniProgramEnv/i.test(ua)) return true;
  if ((window as Window & { __wxjs_environment?: string }).__wxjs_environment === 'miniprogram') {
    return true;
  }
  return new URLSearchParams(window.location.search).get('embed') === 'miniprogram';
}

export function rememberMiniProgramEmbed() {
  if (typeof window === 'undefined') return;
  if (!isMiniProgramEmbed() && new URLSearchParams(window.location.search).get('embed') !== 'miniprogram') {
    return;
  }
  try {
    window.sessionStorage.setItem('the-one-embed', 'miniprogram');
  } catch {
    // ignore
  }
  document.documentElement.setAttribute('data-mp-embed', 'true');
}

function currentEmbedParam() {
  if (typeof window === 'undefined') return null;
  if (isIOSEmbed()) return 'ios';
  if (isMiniProgramEmbed()) return 'miniprogram';
  return null;
}

export function requestAppLogin(): boolean {
  const bridge = nativeBridge();
  if (!bridge && !isIOSEmbed()) return false;
  try {
    bridge?.postMessage({ type: 'login' });
    return true;
  } catch {
    return isIOSEmbed();
  }
}

export function requestAppStore(): boolean {
  const bridge = nativeBridge();
  if (!bridge && !isIOSEmbed()) return false;
  try {
    bridge?.postMessage({ type: 'store' });
    return true;
  } catch {
    return isIOSEmbed();
  }
}

export function setAppModalBackdropActive(active: boolean): void {
  if (!isIOSEmbed()) return;
  try {
    nativeBridge()?.postMessage({ type: 'modalBackdropChanged', payload: { active } });
  } catch {
    // 原生桥暂不可用时不影响网页弹窗本身。
  }
}

/**
 * 从网页内的独立页面返回首页 tab 前，同步 iOS 壳层的选中状态。
 *
 * iOS WebView 会把原生 tab 记录在 __THEONE_TAB__ 中；如果这里只改 URL，
 * 首页重新挂载时可能会被旧的原生 tab 覆盖，表现为按钮点击后仍停留在原页面。
 */
export function syncAppTab(tab: string): void {
  if (typeof window === 'undefined' || !isIOSEmbed()) return;
  window.__THEONE_TAB__ = tab;
  try {
    nativeBridge()?.postMessage({ type: 'tabChanged', tab });
  } catch {
    // URL 跳转仍会继续；首页挂载时会从 __THEONE_TAB__ 恢复目标 tab。
  }
}

/** 首页 tab 跳转时保留 embed，避免壳里掉回网页登录/安装提示。 */
export function homeHref(tab: string, extra?: Record<string, string>): string {
  const params = new URLSearchParams();
  const embed = currentEmbedParam();
  if (embed) params.set('embed', embed);
  params.set('tab', tab);
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      params.set(key, value);
    }
  }
  return `/?${params.toString()}`;
}

export function withEmbed(pathAndQuery: string): string {
  if (typeof window === 'undefined') return pathAndQuery;
  const embed = currentEmbedParam();
  if (!embed) return pathAndQuery;
  const url = new URL(pathAndQuery, window.location.origin);
  url.searchParams.set('embed', embed);
  return `${url.pathname}${url.search}`;
}
