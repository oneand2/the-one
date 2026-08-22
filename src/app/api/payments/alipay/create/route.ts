import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { createAlipayPagePayUrl, getAlipayReadiness } from '@/lib/payments/alipay';
import { getCoinPackage } from '@/lib/payments/coinPackages';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '请先登录后购买服务包' }, { status: 401 });
  }

  const readiness = getAlipayReadiness();
  if (!readiness.ready) {
    return NextResponse.json(
      { error: '支付宝支付正在完成开通配置，请稍后再试' },
      { status: 503 }
    );
  }

  let packageId = '';
  let displayMode: 'embedded' | 'redirect' = 'redirect';
  try {
    const body = (await request.json()) as { packageId?: unknown; displayMode?: unknown };
    packageId = typeof body.packageId === 'string' ? body.packageId : '';
    displayMode = body.displayMode === 'embedded' ? 'embedded' : 'redirect';
  } catch {
    return NextResponse.json({ error: '无效请求' }, { status: 400 });
  }

  const coinPackage = getCoinPackage(packageId);
  if (!coinPackage) {
    return NextResponse.json({ error: '服务包不存在' }, { status: 400 });
  }

  const outTradeNo = `ER${Date.now()}${randomUUID().replaceAll('-', '').slice(0, 18)}`;
  const subject = `二·${coinPackage.name}数字内容服务包`;
  const admin = createAdminClient();
  const { error: insertError } = await admin.from('payment_orders').insert({
    out_trade_no: outTradeNo,
    user_id: user.id,
    package_id: coinPackage.id,
    subject,
    coins: coinPackage.coins,
    amount_cents: coinPackage.amountCents,
    status: 'pending',
  });

  if (insertError) {
    console.error('create payment order error:', insertError);
    return NextResponse.json({ error: '订单创建失败，请稍后重试' }, { status: 500 });
  }

  try {
    const paymentUrl = createAlipayPagePayUrl(outTradeNo, coinPackage, displayMode);
    return NextResponse.json({ paymentUrl, outTradeNo });
  } catch (error) {
    console.error('create alipay page url error:', error);
    await admin.from('payment_orders').delete().eq('out_trade_no', outTradeNo).eq('status', 'pending');
    return NextResponse.json({ error: '支付宝收银台创建失败，请稍后重试' }, { status: 500 });
  }
}
