import type { WechatJsapiParams } from './wechatShared';
import { isWechatJsapiUserAgent } from './wechatShared';

type Bridge = {
  invoke(method: string, params: WechatJsapiParams, callback: (result: { err_msg?: string }) => void): void;
};

export function isWechatJsapiEnvironment() {
  if (typeof window === 'undefined') return false;
  return isWechatJsapiUserAgent(window.navigator.userAgent)
    && (window as Window & { __wxjs_environment?: string }).__wxjs_environment !== 'miniprogram';
}

/** Bridge 的 ok 只用于提示；到账以服务端通知或查单为准。 */
export async function invokeWechatPay(params: WechatJsapiParams): Promise<'ok' | 'cancel' | 'fail'> {
  if (!isWechatJsapiEnvironment()) {
    throw new Error('当前不在手机微信浏览器中，无法打开微信内收银台。请在微信中打开本站付款，或改用扫码支付。');
  }
  const bridgeWindow = window as Window & { WeixinJSBridge?: Bridge };
  if (!bridgeWindow.WeixinJSBridge) {
    await new Promise<void>((resolve, reject) => {
      const ready = () => {
        cleanup();
        resolve();
      };
      const timer = window.setTimeout(() => {
        cleanup();
        reject(new Error('微信支付未能打开，请在手机微信中重新打开本页。'));
      }, 8000);
      const cleanup = () => {
        window.clearTimeout(timer);
        document.removeEventListener('WeixinJSBridgeReady', ready);
      };
      document.addEventListener('WeixinJSBridgeReady', ready);
      if (bridgeWindow.WeixinJSBridge) ready();
    });
  }
  const bridge = bridgeWindow.WeixinJSBridge;
  if (!bridge) throw new Error('请在手机微信中打开本页后付款。');
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('尚未收到微信付款结果，请确认订单状态。')), 120_000);
    try {
      bridge.invoke('getBrandWCPayRequest', params, (result) => {
        window.clearTimeout(timer);
        resolve(result.err_msg === 'get_brand_wcpay_request:ok' ? 'ok'
          : result.err_msg === 'get_brand_wcpay_request:cancel' ? 'cancel' : 'fail');
      });
    } catch (error) {
      window.clearTimeout(timer);
      reject(error);
    }
  });
}
