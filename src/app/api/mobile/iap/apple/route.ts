import { NextRequest } from 'next/server';
import { Environment, SignedDataVerifier } from '@apple/app-store-server-library';
import { createAdminClient } from '@/utils/supabase/admin';
import { createMobileAuthClient } from '@/lib/mobileAuth';
import { APPLE_ROOT_CERTIFICATES } from '@/lib/payments/appleRootCertificates';
import { APPLE_LIFETIME_VIP_PRODUCT_ID } from '@/lib/payments/coinPackages';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BUNDLE_ID = process.env.APPLE_BUNDLE_ID?.trim() || 'com.theone.er';
const APPLE_APP_ID = Number(process.env.APPLE_APP_ID || 6801478964);
const PRODUCTS: Record<string, number> = {
  'com.theone.er.coins.100': 100,
  'com.theone.er.coins.360': 360,
  'com.theone.er.coins.800': 800,
};

type PurchaseBody = { signedTransaction?: string };

async function verifyTransaction(signedTransaction: string) {
  const candidates: Array<{ environment: Environment; appAppleId?: number }> = [
    { environment: Environment.PRODUCTION, appAppleId: APPLE_APP_ID },
    { environment: Environment.SANDBOX },
  ];
  if (process.env.APPLE_IAP_ALLOW_XCODE === 'true') {
    candidates.push({ environment: Environment.XCODE });
  }

  let lastError: unknown;
  for (const candidate of candidates) {
    if (candidate.environment === Environment.PRODUCTION && !candidate.appAppleId) continue;
    try {
      const verifier = new SignedDataVerifier(
        APPLE_ROOT_CERTIFICATES,
        true,
        candidate.environment,
        BUNDLE_ID,
        candidate.appAppleId,
      );
      return await verifier.verifyAndDecodeTransaction(signedTransaction);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error('Apple transaction verification failed');
}

export async function POST(request: NextRequest) {
  const { supabase, json } = createMobileAuthClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: '未登录' }, { status: 401 });

  let body: PurchaseBody;
  try {
    body = (await request.json()) as PurchaseBody;
  } catch {
    return json({ error: '交易数据格式无效' }, { status: 400 });
  }
  if (!body.signedTransaction || body.signedTransaction.length > 100_000) {
    return json({ error: '缺少 Apple 交易凭据' }, { status: 400 });
  }

  try {
    const transaction = await verifyTransaction(body.signedTransaction);
    const productId = transaction.productId ?? '';
    const transactionId = transaction.transactionId ?? '';
    const quantity = Math.max(1, transaction.quantity ?? 1);
    const isLifetimeVipProduct = productId === APPLE_LIFETIME_VIP_PRODUCT_ID;
    const unitCoins = isLifetimeVipProduct ? 0 : PRODUCTS[productId];
    const appAccountToken = transaction.appAccountToken?.toLowerCase();

    if (!transactionId || transaction.revocationDate || (!isLifetimeVipProduct && !unitCoins)) {
      return json({ error: '交易商品无效或已退款' }, { status: 400 });
    }
    if (appAccountToken && appAccountToken !== user.id.toLowerCase()) {
      return json({ error: '这笔交易不属于当前登录账户' }, { status: 409 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin.rpc('credit_apple_iap_transaction', {
      p_user_id: user.id,
      p_transaction_id: transactionId,
      p_original_transaction_id: transaction.originalTransactionId ?? transactionId,
      p_product_id: productId,
      p_environment: transaction.environment ?? 'Unknown',
      p_coins: unitCoins * quantity,
      p_signed_transaction: body.signedTransaction,
    });
    if (error) {
      console.error('credit Apple transaction failed:', error);
      if (error.message?.includes('belongs to another account')) {
        return json({ error: '这笔交易已绑定其他账户' }, { status: 409 });
      }
      return json({ error: '交易已验证，但入账失败，请稍后重试' }, { status: 500 });
    }

    const result = Array.isArray(data) ? data[0] : data;
    return json({
      ok: true,
      credited: Boolean(result?.credited),
      coins: result?.coins ?? unitCoins * quantity,
      balance: result?.balance,
      transactionId,
      lifetimeVip: isLifetimeVipProduct,
    });
  } catch (error) {
    console.error('Apple IAP verification failed:', error);
    return json({ error: '无法验证 Apple 交易' }, { status: 400 });
  }
}
