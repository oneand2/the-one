import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getCoinPackage } from '@/lib/payments/coinPackages';
import { createWechatNativeOrder, getWechatPayReadiness } from '@/lib/payments/wechat';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '请先登录后购买服务包' }, { status: 401 });
  }

  if (!getWechatPayReadiness().ready) {
    return NextResponse.json({ error: '微信支付正在完成开通配置，请稍后再试' }, { status: 503 });
  }

  let packageId = '';
  try {
    const body = (await request.json()) as { packageId?: unknown };
    packageId = typeof body.packageId === 'string' ? body.packageId : '';
  } catch {
    return NextResponse.json({ error: '无效请求' }, { status: 400 });
  }

  const coinPackage = getCoinPackage(packageId);
  if (!coinPackage) {
    return NextResponse.json({ error: '服务包不存在' }, { status: 400 });
  }

  const admin = createAdminClient();
  const recentPending = await admin
    .from('wechat_payment_orders')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .gte('created_at', new Date(Date.now() - 60_000).toISOString());
  if (recentPending.error) {
    console.error('check recent wechat payment orders error:', recentPending.error);
    return NextResponse.json({ error: '订单创建失败，请稍后重试' }, { status: 500 });
  }
  if ((recentPending.count || 0) >= 3) {
    return NextResponse.json({ error: '操作过于频繁，请一分钟后再试' }, { status: 429 });
  }

  const outTradeNo = `WX${Date.now()}${randomUUID().replaceAll('-', '').slice(0, 17)}`;
  const { error: insertError } = await admin.from('wechat_payment_orders').insert({
    out_trade_no: outTradeNo,
    user_id: user.id,
    package_id: coinPackage.id,
    subject: `二·${coinPackage.name}数字内容服务包`,
    coins: coinPackage.coins,
    amount_cents: coinPackage.amountCents,
    status: 'pending',
  });

  if (insertError) {
    console.error('create wechat payment order error:', insertError);
    return NextResponse.json({ error: '订单创建失败，请稍后重试' }, { status: 500 });
  }

  try {
    const codeUrl = await createWechatNativeOrder(outTradeNo, coinPackage);
    const qrDataUrl = await QRCode.toDataURL(codeUrl, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 320,
      color: { dark: '#111827', light: '#FFFFFF' },
    });
    return NextResponse.json({ outTradeNo, qrDataUrl, expiresInSeconds: 900 });
  } catch (error) {
    console.error('create wechat native order error:', error);
    await admin
      .from('wechat_payment_orders')
      .delete()
      .eq('out_trade_no', outTradeNo)
      .eq('status', 'pending');
    return NextResponse.json({ error: '微信支付二维码创建失败，请稍后再试' }, { status: 500 });
  }
}
