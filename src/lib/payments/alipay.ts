import 'server-only';

import { AlipaySdk } from 'alipay-sdk';
import type { CoinPackage } from './coinPackages';

type AlipayEnvironment = {
  appId: string;
  privateKey: string;
  publicKey: string;
  sellerId: string;
  siteUrl: string;
  gateway?: string;
  keyType: 'PKCS1' | 'PKCS8';
};

function readSecret(name: string, base64Name: string) {
  const base64Value = process.env[base64Name]?.trim();
  if (base64Value) return Buffer.from(base64Value, 'base64').toString('utf8').trim();
  return process.env[name]?.replace(/\\n/g, '\n').trim() || '';
}

function getEnvironment(): AlipayEnvironment {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
  return {
    appId: process.env.ALIPAY_APP_ID?.trim() || '',
    privateKey: readSecret('ALIPAY_PRIVATE_KEY', 'ALIPAY_PRIVATE_KEY_BASE64'),
    publicKey: readSecret('ALIPAY_PUBLIC_KEY', 'ALIPAY_PUBLIC_KEY_BASE64'),
    sellerId: process.env.ALIPAY_SELLER_ID?.trim() || '',
    siteUrl,
    gateway: process.env.ALIPAY_GATEWAY?.trim() || undefined,
    keyType: process.env.ALIPAY_KEY_TYPE === 'PKCS1' ? 'PKCS1' : 'PKCS8',
  };
}

export function getAlipayReadiness() {
  const env = getEnvironment();
  const missing = [
    ['ALIPAY_APP_ID', env.appId],
    ['ALIPAY_PRIVATE_KEY 或 ALIPAY_PRIVATE_KEY_BASE64', env.privateKey],
    ['ALIPAY_PUBLIC_KEY 或 ALIPAY_PUBLIC_KEY_BASE64', env.publicKey],
    ['ALIPAY_SELLER_ID', env.sellerId],
    ['NEXT_PUBLIC_SITE_URL', process.env.NEXT_PUBLIC_SITE_URL?.trim() || ''],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  return { ready: missing.length === 0, missing };
}

function createSdk() {
  const env = getEnvironment();
  const readiness = getAlipayReadiness();
  if (!readiness.ready) {
    throw new Error(`支付宝配置尚未完成：${readiness.missing.join('、')}`);
  }

  return {
    env,
    sdk: new AlipaySdk({
      appId: env.appId,
      privateKey: env.privateKey,
      alipayPublicKey: env.publicKey,
      signType: 'RSA2',
      keyType: env.keyType,
      ...(env.gateway ? { gateway: env.gateway } : {}),
    }),
  };
}

export function createAlipayPagePayUrl(
  outTradeNo: string,
  coinPackage: CoinPackage,
  displayMode: 'embedded' | 'redirect' = 'redirect'
) {
  const { sdk, env } = createSdk();
  return sdk.pageExecute('alipay.trade.page.pay', 'GET', {
    notifyUrl: `${env.siteUrl}/api/payments/alipay/notify`,
    ...(displayMode === 'redirect'
      ? { returnUrl: `${env.siteUrl}/shop?payment=return&order=${encodeURIComponent(outTradeNo)}` }
      : {}),
    bizContent: {
      out_trade_no: outTradeNo,
      product_code: 'FAST_INSTANT_TRADE_PAY',
      subject: `二·${coinPackage.name}数字内容服务包`,
      body: `${coinPackage.coins}枚站内铜币，用于本平台AI对话与解读服务`,
      total_amount: (coinPackage.amountCents / 100).toFixed(2),
      timeout_express: '30m',
      ...(displayMode === 'embedded'
        ? { qr_pay_mode: '4', qrcode_width: '240' }
        : {}),
    },
  });
}

export function verifyAlipayNotification(params: Record<string, string>) {
  const { sdk, env } = createSdk();
  if (!sdk.checkNotifySignV2(params)) return false;
  if (params.app_id !== env.appId) return false;
  if (params.seller_id !== env.sellerId) return false;
  return true;
}

export async function queryAlipayTrade(outTradeNo: string) {
  const { sdk } = createSdk();
  const result = await sdk.exec(
    'alipay.trade.query',
    { bizContent: { outTradeNo } },
    { validateSign: true }
  );
  return {
    success: result.code === '10000',
    outTradeNo: typeof result.outTradeNo === 'string' ? result.outTradeNo : '',
    tradeNo: typeof result.tradeNo === 'string' ? result.tradeNo : '',
    tradeStatus: typeof result.tradeStatus === 'string' ? result.tradeStatus : '',
    totalAmount: typeof result.totalAmount === 'string' ? result.totalAmount : '',
  };
}
