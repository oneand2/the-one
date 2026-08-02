import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { verifyAlipayNotification } from '@/lib/payments/alipay';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function textResponse(body: 'success' | 'fail') {
  return new NextResponse(body, {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

function amountToCents(value: string) {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const [yuan, decimal = ''] = value.split('.');
  return Number(yuan) * 100 + Number(decimal.padEnd(2, '0'));
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string') params[key] = value;
  }

  try {
    if (!verifyAlipayNotification(params)) {
      console.warn('alipay notify signature or merchant verification failed');
      return textResponse('fail');
    }

    if (!['TRADE_SUCCESS', 'TRADE_FINISHED'].includes(params.trade_status)) {
      return textResponse('success');
    }

    const amountCents = amountToCents(params.total_amount || '');
    if (!params.out_trade_no || !params.trade_no || amountCents === null) {
      return textResponse('fail');
    }

    const admin = createAdminClient();
    const { data, error } = await admin.rpc('credit_alipay_order', {
      p_out_trade_no: params.out_trade_no,
      p_alipay_trade_no: params.trade_no,
      p_amount_cents: amountCents,
    });

    if (error) {
      console.error('credit alipay order error:', error);
      return textResponse('fail');
    }

    if (!['credited', 'already_credited'].includes(String(data))) {
      console.warn('alipay notify order validation failed:', data);
      return textResponse('fail');
    }

    return textResponse('success');
  } catch (error) {
    console.error('alipay notify error:', error);
    return textResponse('fail');
  }
}
