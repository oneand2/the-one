import { createHash, randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getShopPackage, isLifetimeVipPackage } from '@/lib/payments/coinPackages';
import { createWechatNativeOrder, createWechatMobileOrder, getWechatPayReadiness, getWechatPayCapabilities, getWechatMobilePayConfig, getWechatPayerClientIp } from '@/lib/payments/wechat';
import { selectWechatPayMode } from '@/lib/payments/wechatShared';
import { buildWechatWebEntryUrl, shouldUseWechatWebEntry } from '@/lib/payments/wechatWebEntry';
import { buildWechatPayAuthorizeUrl, openWechatPayContext, sealWechatPayContext, WECHAT_PAYER_COOKIE, WECHAT_PAY_COOKIE_PATH, WECHAT_PAY_OAUTH_COOKIE } from '@/lib/payments/wechatPayer';
import { resolveSiteUrl } from '@/lib/auth/wechat';
import { isLifetimeVip } from '@/utils/vip';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== new URL(resolveSiteUrl()).origin) {
    return NextResponse.json({ error: '请从本站发起支付' }, { status: 403 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '请先登录后购买服务包' }, { status: 401 });
  }

  if (!getWechatPayReadiness().ready) {
    return NextResponse.json({ error: '微信支付正在完成开通配置，请稍后再试' }, { status: 503 });
  }

  let packageId = '';
  let mobileHint = false;
  let jsapiAllowed = true;
  let attemptId = '';
  try {
    const body = (await request.json()) as { packageId?: unknown; mobile?: unknown; jsapi?: unknown; attemptId?: unknown };
    packageId = typeof body.packageId === 'string' ? body.packageId : '';
    mobileHint = body.mobile === true;
    jsapiAllowed = body.jsapi !== false;
    if (body.attemptId !== undefined && (typeof body.attemptId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.attemptId))) {
      return NextResponse.json({ error: '无效购买请求' }, { status: 400 });
    }
    attemptId = typeof body.attemptId === 'string' ? body.attemptId : '';
  } catch {
    return NextResponse.json({ error: '无效请求' }, { status: 400 });
  }

  const coinPackage = getShopPackage(packageId);
  if (!coinPackage) {
    return NextResponse.json({ error: '服务包不存在' }, { status: 400 });
  }

  const capabilities = getWechatPayCapabilities();
  const mode = selectWechatPayMode(request.headers.get('user-agent') || '', {
    ...capabilities, jsapi: capabilities.jsapi && jsapiAllowed,
  }, mobileHint);
  if (shouldUseWechatWebEntry(request.headers.get('user-agent') || '', capabilities, mobileHint)) {
    const entryUrl = buildWechatWebEntryUrl(resolveSiteUrl(), packageId);
    const qrDataUrl = await QRCode.toDataURL(entryUrl, {
      errorCorrectionLevel: 'M', margin: 4, width: 720,
      color: { dark: '#171717', light: '#FFFFFF' },
    });
    return NextResponse.json({ mode: 'web_entry', entryUrl, qrDataUrl }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  }
  let openid: string | undefined;
  let clientIp: string | undefined;
  if (mode === 'jsapi') {
    const config = getWechatMobilePayConfig();
    openid = openWechatPayContext(request.cookies.get(WECHAT_PAYER_COOKIE)?.value, config.appSecret,
      { purpose: 'payer', userId: user.id, appId: config.appId })?.openid;
    if (!openid) {
      const state = randomUUID().replaceAll('-', '');
      const now = Date.now();
      const response = NextResponse.json({ mode: 'authorize', authorizationUrl: buildWechatPayAuthorizeUrl(config.appId, resolveSiteUrl(), state) });
      response.headers.set('Cache-Control', 'private, no-store');
      response.cookies.set(WECHAT_PAY_OAUTH_COOKIE, sealWechatPayContext({
        purpose: 'oauth', state, userId: user.id, appId: config.appId, packageId,
        issuedAt: now, expiresAt: now + 600_000,
      }, config.appSecret), {
        httpOnly: true, secure: resolveSiteUrl().startsWith('https://'), sameSite: 'lax',
        path: WECHAT_PAY_COOKIE_PATH, maxAge: 600,
      });
      return response;
    }
  }
  if (mode === 'h5') {
    try { clientIp = getWechatPayerClientIp(request.headers); }
    catch { return NextResponse.json({ error: '暂时无法发起手机微信支付，请稍后重试或选择支付宝' }, { status: 503 }); }
  }

  const admin = createAdminClient();
  if (isLifetimeVipPackage(coinPackage)) {
    const { data: profile } = await admin
      .from('user_profiles')
      .select('vip_expires_at')
      .eq('user_id', user.id)
      .maybeSingle();
    if (isLifetimeVip((profile as { vip_expires_at?: string | null } | null)?.vip_expires_at)) {
      return NextResponse.json({ error: '你已是终身 VIP，无需重复购买' }, { status: 409 });
    }
  }
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

  const outTradeNo = attemptId
    ? `WX${createHash('sha256').update(`${user.id}\0${packageId}\0${attemptId}`).digest('hex').slice(0, 30)}`
    : `WX${Date.now()}${randomUUID().replaceAll('-', '').slice(0, 17)}`;
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
    // 相同账户、商品、购买意向只创建一个订单；数据库唯一键处理并发重试。
    if (insertError.code === '23505') {
      return NextResponse.json({ mode: 'pending', outTradeNo }, { headers: { 'Cache-Control': 'private, no-store' } });
    }
    console.error('create wechat payment order error:', insertError);
    return NextResponse.json({ error: '订单创建失败，请稍后重试' }, { status: 500 });
  }

  try {
    if (mode !== 'native') {
      const payment = await createWechatMobileOrder(mode, outTradeNo, coinPackage, { openid, clientIp });
      return NextResponse.json({ ...payment, outTradeNo, expiresInSeconds: 900 }, { headers: { 'Cache-Control': 'private, no-store' } });
    }
    const codeUrl = await createWechatNativeOrder(outTradeNo, coinPackage);
    const qrDataUrl = await QRCode.toDataURL(codeUrl, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 320,
      color: { dark: '#111827', light: '#FFFFFF' },
    });
    return NextResponse.json({ mode, outTradeNo, qrDataUrl, expiresInSeconds: 900,
      ...(mobileHint ? { notice: '当前浏览器暂不支持直接拉起微信付款。请在手机微信中打开本站付款，或用另一台设备展示下方二维码后扫码；也可选择支付宝。' } : {}),
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('create wechat order error:', error instanceof Error ? error.message : 'unknown');
    // 请求可能已被微信受理；保留订单供异步通知查找，不能因超时删除可入账订单。
    return NextResponse.json({ error: '微信支付订单暂未确认，请先确认支付结果，无需重复购买', outTradeNo }, { status: 502 });
  }
}
