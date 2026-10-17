export type WechatPayMode = 'native' | 'h5' | 'jsapi';

export type WechatPayCapabilities = { native: boolean; h5: boolean; jsapi: boolean };

export type WechatJsapiParams = {
  appId: string;
  timeStamp: string;
  nonceStr: string;
  package: string;
  signType: 'RSA';
  paySign: string;
};

export function isWechatJsapiUserAgent(userAgent: string) {
  return /MicroMessenger/i.test(userAgent)
    && !/WindowsWechat|MacWechat|Windows NT|wxwork|WeChatWork|\bminiProgram\b/i.test(userAgent);
}

/** 微信内不能走 H5；未开通的手机支付方式保留 Native 收款入口。 */
export function selectWechatPayMode(
  userAgent: string,
  capabilities: WechatPayCapabilities,
  mobileHint = false,
): WechatPayMode {
  const desktopWechat = /WindowsWechat|MacWechat|wxwork|WeChatWork/i.test(userAgent);
  if (isWechatJsapiUserAgent(userAgent)) {
    return capabilities.jsapi ? 'jsapi' : 'native';
  }
  if (/MicroMessenger|\bminiProgram\b/i.test(userAgent)) return 'native';
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent) || mobileHint;
  return !desktopWechat && mobile && capabilities.h5 ? 'h5' : 'native';
}
