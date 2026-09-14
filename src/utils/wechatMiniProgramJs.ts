type WxMiniProgram = {
  navigateTo: (options: { url: string; fail?: () => void }) => void;
  reLaunch: (options: { url: string; fail?: () => void }) => void;
};

type WxNamespace = {
  miniProgram?: WxMiniProgram;
};

function wxNamespace(): WxNamespace | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as Window & { wx?: WxNamespace }).wx;
}

function loadWeixinScript() {
  return new Promise<void>((resolve, reject) => {
    if (wxNamespace()?.miniProgram) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>('script[data-weixin-jssdk="true"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('无法加载微信接口')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://res.wx.qq.com/open/js/jweixin-1.6.0.js';
    script.async = true;
    script.dataset.weixinJssdk = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('无法加载微信接口'));
    document.head.appendChild(script);
  });
}

export async function getWxMiniProgram() {
  try {
    await loadWeixinScript();
  } catch {
    return null;
  }
  return wxNamespace()?.miniProgram ?? null;
}

export async function openMiniProgramLoginPage(ticketId: string) {
  const miniProgram = await getWxMiniProgram();
  if (!miniProgram) return false;
  return new Promise<boolean>((resolve) => {
    miniProgram.navigateTo({
      url: `/pages/web-login/index?ticket=${ticketId}&stay=1`,
      fail: () => resolve(false),
    });
    window.setTimeout(() => resolve(true), 80);
  });
}
