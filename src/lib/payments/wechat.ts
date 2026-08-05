import 'server-only';

import {
  createDecipheriv,
  randomBytes,
  sign,
  timingSafeEqual,
  verify,
} from 'node:crypto';
import type { CoinPackage } from './coinPackages';

type WechatEnvironment = {
  appId: string;
  mchId: string;
  apiV3Key: string;
  privateKey: string;
  merchantCertSerial: string;
  wechatPayPublicKey: string;
  wechatPayPublicKeyId: string;
  siteUrl: string;
};

type WechatEncryptedResource = {
  algorithm: string;
  ciphertext: string;
  associated_data?: string;
  nonce: string;
};

export type WechatPaymentNotification = {
  appid: string;
  mchid: string;
  out_trade_no: string;
  transaction_id: string;
  trade_state: string;
  amount: {
    total: number;
    payer_total?: number;
    currency: string;
    payer_currency?: string;
  };
};

export type WechatTrade = {
  appid?: string;
  mchid?: string;
  out_trade_no?: string;
  transaction_id?: string;
  trade_state?: string;
  amount?: {
    total?: number;
    currency?: string;
  };
};

function readPemSecret(name: string, base64Name: string) {
  const base64Value = process.env[base64Name]?.trim();
  if (base64Value) return Buffer.from(base64Value, 'base64').toString('utf8').trim();
  return process.env[name]?.replace(/\\n/g, '\n').trim() || '';
}

function getEnvironment(): WechatEnvironment {
  return {
    appId: process.env.WECHAT_PAY_APP_ID?.trim() || '',
    mchId: process.env.WECHAT_PAY_MCH_ID?.trim() || '',
    apiV3Key: process.env.WECHAT_PAY_API_V3_KEY?.trim() || '',
    privateKey: readPemSecret('WECHAT_PAY_PRIVATE_KEY', 'WECHAT_PAY_PRIVATE_KEY_BASE64'),
    merchantCertSerial: process.env.WECHAT_PAY_CERT_SERIAL_NO?.trim().toUpperCase() || '',
    wechatPayPublicKey: readPemSecret(
      'WECHAT_PAY_PUBLIC_KEY',
      'WECHAT_PAY_PUBLIC_KEY_BASE64'
    ),
    wechatPayPublicKeyId: process.env.WECHAT_PAY_PUBLIC_KEY_ID?.trim() || '',
    siteUrl: (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, ''),
  };
}

export function getWechatPayReadiness() {
  const env = getEnvironment();
  const missing = [
    ['WECHAT_PAY_APP_ID', env.appId],
    ['WECHAT_PAY_MCH_ID', env.mchId],
    [
      'WECHAT_PAY_API_V3_KEY（必须是32字节）',
      Buffer.byteLength(env.apiV3Key, 'utf8') === 32 ? env.apiV3Key : '',
    ],
    ['WECHAT_PAY_PRIVATE_KEY 或 WECHAT_PAY_PRIVATE_KEY_BASE64', env.privateKey],
    ['WECHAT_PAY_CERT_SERIAL_NO', env.merchantCertSerial],
    ['WECHAT_PAY_PUBLIC_KEY 或 WECHAT_PAY_PUBLIC_KEY_BASE64', env.wechatPayPublicKey],
    ['WECHAT_PAY_PUBLIC_KEY_ID', env.wechatPayPublicKeyId],
    ['NEXT_PUBLIC_SITE_URL', process.env.NEXT_PUBLIC_SITE_URL?.trim() || ''],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  return { ready: missing.length === 0, missing };
}

function requireEnvironment() {
  const readiness = getWechatPayReadiness();
  if (!readiness.ready) {
    throw new Error(`微信支付配置尚未完成：${readiness.missing.join('、')}`);
  }
  return getEnvironment();
}

function signatureMessage(timestamp: string, nonce: string, body: string) {
  return `${timestamp}\n${nonce}\n${body}\n`;
}

function safeStringEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function verifyWechatSignature(
  timestamp: string,
  nonce: string,
  body: string,
  serial: string,
  signature: string,
  env: WechatEnvironment
) {
  const timestampSeconds = Number(timestamp);
  if (!Number.isSafeInteger(timestampSeconds)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds) > 300) return false;
  if (!safeStringEqual(serial, env.wechatPayPublicKeyId)) return false;
  if (signature.startsWith('WECHATPAY/SIGNTEST/')) return false;

  return verify(
    'RSA-SHA256',
    Buffer.from(signatureMessage(timestamp, nonce, body)),
    env.wechatPayPublicKey,
    Buffer.from(signature, 'base64')
  );
}

function authorizationHeader(method: string, canonicalPath: string, body: string, env: WechatEnvironment) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = randomBytes(16).toString('hex');
  const message = `${method}\n${canonicalPath}\n${timestamp}\n${nonce}\n${body}\n`;
  const signature = sign('RSA-SHA256', Buffer.from(message), env.privateKey).toString('base64');

  return `WECHATPAY2-SHA256-RSA2048 mchid="${env.mchId}",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${env.merchantCertSerial}",signature="${signature}"`;
}

async function wechatRequest<T>(method: 'GET' | 'POST', canonicalPath: string, payload?: unknown) {
  const env = requireEnvironment();
  const body = payload === undefined ? '' : JSON.stringify(payload);
  const response = await fetch(`https://api.mch.weixin.qq.com${canonicalPath}`, {
    method,
    headers: {
      Accept: 'application/json',
      Authorization: authorizationHeader(method, canonicalPath, body, env),
      'Content-Type': 'application/json',
      'User-Agent': 'the-one-and-the-two/1.0',
    },
    ...(body ? { body } : {}),
    cache: 'no-store',
  });

  const responseBody = await response.text();
  const timestamp = response.headers.get('wechatpay-timestamp') || '';
  const nonce = response.headers.get('wechatpay-nonce') || '';
  const serial = response.headers.get('wechatpay-serial') || '';
  const responseSignature = response.headers.get('wechatpay-signature') || '';

  if (
    !timestamp ||
    !nonce ||
    !serial ||
    !responseSignature ||
    !verifyWechatSignature(timestamp, nonce, responseBody, serial, responseSignature, env)
  ) {
    throw new Error('微信支付响应签名验证失败');
  }

  let parsed: unknown = {};
  try {
    parsed = responseBody ? JSON.parse(responseBody) : {};
  } catch {
    throw new Error('微信支付返回了无效响应');
  }

  if (!response.ok) {
    const error = parsed as { code?: string; message?: string };
    throw new Error(`微信支付接口错误：${error.code || response.status} ${error.message || ''}`.trim());
  }

  return parsed as T;
}

export async function createWechatNativeOrder(outTradeNo: string, coinPackage: CoinPackage) {
  const env = requireEnvironment();
  const result = await wechatRequest<{ code_url?: string }>('POST', '/v3/pay/transactions/native', {
    appid: env.appId,
    mchid: env.mchId,
    description: `二·${coinPackage.name}数字内容服务包`,
    out_trade_no: outTradeNo,
    time_expire: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    notify_url: `${env.siteUrl}/api/payments/wechat/notify`,
    amount: {
      total: coinPackage.amountCents,
      currency: 'CNY',
    },
  });

  if (!result.code_url?.startsWith('weixin://wxpay/')) {
    throw new Error('微信支付未返回有效二维码链接');
  }
  return result.code_url;
}

export function verifyWechatNotification(
  body: string,
  headers: { timestamp: string; nonce: string; serial: string; signature: string }
) {
  const env = requireEnvironment();
  return verifyWechatSignature(
    headers.timestamp,
    headers.nonce,
    body,
    headers.serial,
    headers.signature,
    env
  );
}

export function decryptWechatResource(resource: WechatEncryptedResource) {
  const env = requireEnvironment();
  if (resource.algorithm !== 'AEAD_AES_256_GCM') {
    throw new Error('不支持的微信支付回调加密算法');
  }

  const encrypted = Buffer.from(resource.ciphertext, 'base64');
  if (encrypted.length <= 16) throw new Error('微信支付回调密文无效');

  const ciphertext = encrypted.subarray(0, -16);
  const authTag = encrypted.subarray(-16);
  const decipher = createDecipheriv(
    'aes-256-gcm',
    Buffer.from(env.apiV3Key, 'utf8'),
    Buffer.from(resource.nonce, 'utf8')
  );
  decipher.setAuthTag(authTag);
  decipher.setAAD(Buffer.from(resource.associated_data || '', 'utf8'));

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  return JSON.parse(plaintext) as WechatPaymentNotification;
}

export async function queryWechatTrade(outTradeNo: string) {
  const env = requireEnvironment();
  const canonicalPath = `/v3/pay/transactions/out-trade-no/${encodeURIComponent(outTradeNo)}?mchid=${encodeURIComponent(env.mchId)}`;
  return wechatRequest<WechatTrade>('GET', canonicalPath);
}

export function validateWechatTrade(trade: WechatTrade, outTradeNo: string, amountCents: number) {
  const env = requireEnvironment();
  return Boolean(
    trade.appid === env.appId &&
      trade.mchid === env.mchId &&
      trade.out_trade_no === outTradeNo &&
      trade.transaction_id &&
      trade.trade_state === 'SUCCESS' &&
      trade.amount?.total === amountCents &&
      trade.amount?.currency === 'CNY'
  );
}

export function validateWechatNotification(notification: WechatPaymentNotification) {
  const env = requireEnvironment();
  return Boolean(
    notification.appid === env.appId &&
      notification.mchid === env.mchId &&
      notification.out_trade_no &&
      notification.transaction_id &&
      notification.trade_state === 'SUCCESS' &&
      Number.isSafeInteger(notification.amount?.total) &&
      notification.amount.total > 0 &&
      notification.amount.currency === 'CNY'
  );
}
