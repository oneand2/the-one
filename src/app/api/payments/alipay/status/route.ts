import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getAlipayReadiness, queryAlipayTrade } from '@/lib/payments/alipay';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function amountToCents(value: string) {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const [yuan, decimal = ''] = value.split('.');
  return Number(yuan) * 100 + Number(decimal.padEnd(2, '0'));
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const requestUrl = new URL(request.url);
  const outTradeNo = requestUrl.searchParams.get('order')?.trim() || '';
  if (!/^ER[A-Za-z0-9]{20,62}$/.test(outTradeNo)) {
    return NextResponse.json({ error: '订单号无效' }, { status: 400 });
  }

  const orderResult = await supabase
    .from('payment_orders')
    .select('out_trade_no, status, coins, amount_cents, credited_at')
    .eq('out_trade_no', outTradeNo)
    .eq('user_id', user.id)
    .single();
  let data = orderResult.data;

  if (orderResult.error || !data) {
    return NextResponse.json({ error: '订单不存在' }, { status: 404 });
  }

  // 异步通知偶尔可能因网络延迟未到达。用户返回收银台后可触发一次主动查单补偿。
  if (
    data.status === 'pending' &&
    requestUrl.searchParams.get('reconcile') === '1' &&
    getAlipayReadiness().ready
  ) {
    try {
      const trade = await queryAlipayTrade(outTradeNo);
      const amountCents = amountToCents(trade.totalAmount);
      if (
        trade.success &&
        trade.outTradeNo === outTradeNo &&
        trade.tradeNo &&
        ['TRADE_SUCCESS', 'TRADE_FINISHED'].includes(trade.tradeStatus) &&
        amountCents === data.amount_cents
      ) {
        const admin = createAdminClient();
        const { data: creditResult, error: creditError } = await admin.rpc('credit_alipay_order', {
          p_out_trade_no: outTradeNo,
          p_alipay_trade_no: trade.tradeNo,
          p_amount_cents: amountCents,
        });
        if (!creditError && ['credited', 'already_credited'].includes(String(creditResult))) {
          const refreshed = await supabase
            .from('payment_orders')
            .select('out_trade_no, status, coins, amount_cents, credited_at')
            .eq('out_trade_no', outTradeNo)
            .eq('user_id', user.id)
            .single();
          if (refreshed.data) data = refreshed.data;
        }
      }
    } catch (queryError) {
      console.error('alipay trade reconciliation error:', queryError);
    }
  }

  return NextResponse.json(data);
}
