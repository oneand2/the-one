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

/** 微信内不能走 H5；未开通的手机支付方式保留 Native 收款入口。 */
export function selectWechatPayMode(
  userAgent: string,
  capabilities: WechatPayCapabilities,
  mobileHint = false,
): WechatPayMode {
  const desktopWechat = /WindowsWechat|MacWechat|wxwork|WeChatWork/i.test(userAgent);
  if (/MicroMessenger/i.test(userAgent) && !desktopWechat) {
    return capabilities.jsapi ? 'jsapi' : 'native';
  }
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent) || mobileHint;
  return !desktopWechat && mobile && capabilities.h5 ? 'h5' : 'native';
}
