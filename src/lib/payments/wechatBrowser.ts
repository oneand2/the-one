import type { WechatJsapiParams } from './wechatShared';

type Bridge = {
  invoke(method: string, params: WechatJsapiParams, callback: (result: { err_msg?: string }) => void): void;
};

/** Bridge 的 ok 只用于提示；到账以服务端通知或查单为准。 */
export async function invokeWechatPay(params: WechatJsapiParams): Promise<'ok' | 'cancel' | 'fail'> {
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
