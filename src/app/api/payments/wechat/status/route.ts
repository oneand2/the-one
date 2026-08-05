import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import {
  getWechatPayReadiness,
  queryWechatTrade,
  validateWechatTrade,
} from '@/lib/payments/wechat';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const requestUrl = new URL(request.url);
  const outTradeNo = requestUrl.searchParams.get('order')?.trim() || '';
  if (!/^WX[A-Za-z0-9]{20,62}$/.test(outTradeNo)) {
    return NextResponse.json({ error: '订单号无效' }, { status: 400 });
  }

  const selectOrder = () => supabase
    .from('wechat_payment_orders')
    .select('out_trade_no, status, coins, amount_cents, credited_at, created_at')
    .eq('out_trade_no', outTradeNo)
    .eq('user_id', user.id)
    .single();

  const orderResult = await selectOrder();
  let data = orderResult.data;
  if (orderResult.error || !data) {
    return NextResponse.json({ error: '订单不存在' }, { status: 404 });
  }

  if (
    data.status === 'pending' &&
    requestUrl.searchParams.get('reconcile') === '1' &&
    getWechatPayReadiness().ready
  ) {
    try {
      const trade = await queryWechatTrade(outTradeNo);
      if (
        validateWechatTrade(trade, outTradeNo, data.amount_cents) &&
        trade.transaction_id
      ) {
        const admin = createAdminClient();
        const { data: creditResult, error: creditError } = await admin.rpc('credit_wechat_order', {
          p_out_trade_no: outTradeNo,
          p_transaction_id: trade.transaction_id,
          p_amount_cents: data.amount_cents,
        });
        if (!creditError && ['credited', 'already_credited'].includes(String(creditResult))) {
          const refreshed = await selectOrder();
          if (refreshed.data) data = refreshed.data;
        }
      }
    } catch (queryError) {
      console.error('wechat trade reconciliation error:', queryError);
    }
  }

  return NextResponse.json(data);
}
