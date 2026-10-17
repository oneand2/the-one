import { getShopPackage } from './coinPackages';
import type { WechatPayCapabilities } from './wechatShared';

export function shouldUseWechatWebEntry(userAgent: string, capabilities: WechatPayCapabilities, mobileHint = false) {
  return capabilities.jsapi && !capabilities.h5
    && !/MicroMessenger|WindowsWechat|MacWechat|Windows NT|wxwork|WeChatWork|\bminiProgram\b/i.test(userAgent)
    && (/Android|iPhone|iPad|iPod|Mobile/i.test(userAgent) || mobileHint);
}

export function buildWechatWebEntryPath(packageId: string) {
  if (!getShopPackage(packageId)) throw new Error('服务包不存在');
  return `/shop?${new URLSearchParams({ wechat_web_entry: '1', package: packageId })}`;
}

export function getWechatWebEntryPackage(path: string) {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) return null;
  try {
    const url = new URL(path, 'https://entry.invalid');
    if (url.origin !== 'https://entry.invalid' || url.pathname !== '/shop'
      || url.searchParams.getAll('wechat_web_entry').length !== 1
      || url.searchParams.get('wechat_web_entry') !== '1'
      || url.searchParams.getAll('package').length !== 1) return null;
    return getShopPackage(url.searchParams.get('package') || '');
  } catch {
    return null;
  }
}

export function buildWechatWebEntryUrl(siteUrl: string, packageId: string) {
  const url = new URL('/login', siteUrl);
  url.searchParams.set('next', buildWechatWebEntryPath(packageId));
  return url.toString();
}

export function isWechatWebEntryUrl(value: string, siteUrl: string, packageId: string) {
  try {
    const url = new URL(value);
    return url.origin === new URL(siteUrl).origin && url.pathname === '/login' && !url.hash
      && !url.username && !url.password
      && url.searchParams.getAll('next').length === 1
      && getWechatWebEntryPackage(url.searchParams.get('next') || '')?.id === packageId;
  } catch {
    return false;
  }
}
