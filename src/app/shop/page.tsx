'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { AlertCircle, Check, Coins, Crown, QrCode, ShieldCheck, X } from 'lucide-react';
import {
  COIN_PACKAGES,
  LIFETIME_VIP_PACKAGE,
  formatCny,
  getShopPackage,
  isLifetimeVipPackage,
  shopDeliveryMessage,
} from '@/lib/payments/coinPackages';
import { requestAppLogin } from '@/utils/iosEmbed';
import { isLifetimeVip } from '@/utils/vip';

type PaymentMessage = { type: 'success' | 'error' | 'info'; text: string } | null;
type PaymentProvider = 'alipay' | 'wechat';
type PaidKind = 'coins' | 'lifetime_vip';
type WechatPayment = {
  outTradeNo: string;
  qrDataUrl: string;
  expiresAt: number;
  packageName: string;
  coins: number;
  kind: PaidKind;
  status: 'pending' | 'paid' | 'expired';
};
type AlipayPayment = {
  outTradeNo: string;
  paymentUrl: string;
  expiresAt: number;
  packageName: string;
  coins: number;
  kind: PaidKind;
  status: 'pending' | 'paid' | 'expired';
};

function paidKind(item: { id?: string; kind?: PaidKind; coins?: number }): PaidKind {
  return isLifetimeVipPackage(item) || item.coins === 0 ? 'lifetime_vip' : 'coins';
}

function deliveryText(item: { id?: string; kind?: PaidKind; coins?: number; package_id?: string }) {
  if (item.package_id === LIFETIME_VIP_PACKAGE.id || paidKind(item) === 'lifetime_vip') {
    return shopDeliveryMessage(LIFETIME_VIP_PACKAGE);
  }
  return shopDeliveryMessage({ id: item.id ?? '', coins: item.coins ?? 0 });
}

function paidItemCaption(item: { packageName: string; coins: number; kind: PaidKind }) {
  return item.kind === 'lifetime_vip' ? item.packageName : `${item.packageName} · ${item.coins} 枚铜币`;
}

function isMobilePaymentDevice() {
  const userAgent = window.navigator.userAgent;
  const isTouchMac = /Macintosh/i.test(userAgent) && window.navigator.maxTouchPoints > 1;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent) || isTouchMac || !window.matchMedia('(min-width: 768px)').matches;
}

export default function ShopPage() {
  const [loadingPayment, setLoadingPayment] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [vipExpiresAt, setVipExpiresAt] = useState<string | null>(null);
  const [message, setMessage] = useState<PaymentMessage>(null);
  const [wechatPayment, setWechatPayment] = useState<WechatPayment | null>(null);
  const [alipayPayment, setAlipayPayment] = useState<AlipayPayment | null>(null);
  const [agreementAttention, setAgreementAttention] = useState(false);
  const agreementRef = useRef<HTMLLabelElement>(null);

  useEffect(() => {
    fetch('/api/user/profile', { credentials: 'include' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        setBalance(typeof data?.coins_balance === 'number' ? data.coins_balance : null);
        setVipExpiresAt(typeof data?.vip_expires_at === 'string' ? data.vip_expires_at : null);
      })
      .catch(() => setBalance(null));

    const params = new URLSearchParams(window.location.search);
    const order = params.get('order');
    if (params.get('payment') !== 'return' || !order) return;

    let cancelled = false;
    let attempts = 0;
    setMessage({ type: 'info', text: '正在确认支付结果，请稍候…' });

    const checkOrder = async () => {
      attempts += 1;
      try {
        const reconcile = attempts === 6 ? '&reconcile=1' : '';
        const response = await fetch(`/api/payments/alipay/status?order=${encodeURIComponent(order)}${reconcile}`, {
          credentials: 'include',
          cache: 'no-store',
        });
        const data = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (response.ok && data.status === 'paid' && data.credited_at) {
          setMessage({ type: 'success', text: deliveryText(data) });
          window.dispatchEvent(new CustomEvent('coins-should-refresh'));
          fetch('/api/user/profile', { credentials: 'include', cache: 'no-store' })
            .then((profileResponse) => (profileResponse.ok ? profileResponse.json() : null))
            .then((profile) => {
              if (typeof profile?.coins_balance === 'number') setBalance(profile.coins_balance);
              setVipExpiresAt(typeof profile?.vip_expires_at === 'string' ? profile.vip_expires_at : null);
            })
            .catch(() => undefined);
          return;
        }
        if (attempts < 6) {
          window.setTimeout(checkOrder, 1800);
        } else {
          setMessage({ type: 'info', text: '支付结果仍在同步，可稍后刷新本页或在个人设置中查看余额。' });
        }
      } catch {
        if (!cancelled && attempts < 6) window.setTimeout(checkOrder, 1800);
      }
    };
    void checkOrder();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!wechatPayment || wechatPayment.status !== 'pending') return;

    let cancelled = false;
    let attempts = 0;
    let timer: number | undefined;

    const checkOrder = async () => {
      if (cancelled) return;
      if (Date.now() >= wechatPayment.expiresAt) {
        setWechatPayment((current) => current ? { ...current, status: 'expired' } : null);
        return;
      }

      attempts += 1;
      try {
        const reconcile = attempts === 5 || attempts % 15 === 0 ? '&reconcile=1' : '';
        const response = await fetch(
          `/api/payments/wechat/status?order=${encodeURIComponent(wechatPayment.outTradeNo)}${reconcile}`,
          { credentials: 'include', cache: 'no-store' }
        );
        const data = await response.json().catch(() => ({}));
        if (cancelled) return;

        if (response.ok && data.status === 'paid' && data.credited_at) {
          setWechatPayment((current) => current ? { ...current, status: 'paid' } : null);
          setMessage({ type: 'success', text: deliveryText({ ...data, kind: wechatPayment.kind, coins: wechatPayment.coins }) });
          window.dispatchEvent(new CustomEvent('coins-should-refresh'));
          fetch('/api/user/profile', { credentials: 'include', cache: 'no-store' })
            .then((profileResponse) => (profileResponse.ok ? profileResponse.json() : null))
            .then((profile) => {
              if (typeof profile?.coins_balance === 'number') setBalance(profile.coins_balance);
              setVipExpiresAt(typeof profile?.vip_expires_at === 'string' ? profile.vip_expires_at : null);
            })
            .catch(() => undefined);
          return;
        }
      } catch {
        // 网络波动时继续轮询；服务器回调仍会独立完成入账。
      }

      if (!cancelled) timer = window.setTimeout(checkOrder, 2000);
    };

    void checkOrder();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [wechatPayment]);

  useEffect(() => {
    if (!alipayPayment || alipayPayment.status !== 'pending') return;

    let cancelled = false;
    let attempts = 0;
    let timer: number | undefined;

    const checkOrder = async () => {
      if (cancelled) return;
      if (Date.now() >= alipayPayment.expiresAt) {
        setAlipayPayment((current) => current ? { ...current, status: 'expired' } : null);
        return;
      }

      attempts += 1;
      try {
        const reconcile = attempts === 5 || attempts % 15 === 0 ? '&reconcile=1' : '';
        const response = await fetch(
          `/api/payments/alipay/status?order=${encodeURIComponent(alipayPayment.outTradeNo)}${reconcile}`,
          { credentials: 'include', cache: 'no-store' }
        );
        const data = await response.json().catch(() => ({}));
        if (cancelled) return;

        if (response.ok && data.status === 'paid' && data.credited_at) {
          setAlipayPayment((current) => current ? { ...current, status: 'paid' } : null);
          setMessage({ type: 'success', text: deliveryText({ ...data, kind: alipayPayment.kind, coins: alipayPayment.coins }) });
          window.dispatchEvent(new CustomEvent('coins-should-refresh'));
          fetch('/api/user/profile', { credentials: 'include', cache: 'no-store' })
            .then((profileResponse) => (profileResponse.ok ? profileResponse.json() : null))
            .then((profile) => {
              if (typeof profile?.coins_balance === 'number') setBalance(profile.coins_balance);
              setVipExpiresAt(typeof profile?.vip_expires_at === 'string' ? profile.vip_expires_at : null);
            })
            .catch(() => undefined);
          return;
        }
      } catch {
        // 网络波动时继续轮询；服务器回调仍会独立完成入账。
      }

      if (!cancelled) timer = window.setTimeout(checkOrder, 2000);
    };

    void checkOrder();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [alipayPayment]);

  const focusAgreement = () => {
    setAgreementAttention(true);
    setMessage({ type: 'error', text: '请先阅读并同意服务与退款规则。' });
    agreementRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => {
      agreementRef.current?.querySelector('input')?.focus({ preventScroll: true });
    }, 450);
  };

  const handlePurchase = async (provider: PaymentProvider, packageId: string) => {
    if (!accepted) {
      focusAgreement();
      return;
    }

    const coinPackage = getShopPackage(packageId);
    if (!coinPackage) return;
    const alipayDisplayMode = provider === 'alipay' && !isMobilePaymentDevice() ? 'embedded' : 'redirect';

    setLoadingPayment(`${provider}:${packageId}`);
    setMessage(null);
    try {
      const response = await fetch(`/api/payments/${provider}/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          packageId,
          ...(provider === 'alipay'
            ? { displayMode: alipayDisplayMode }
            : {}),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        if (!requestAppLogin()) {
          window.location.href = `/login?next=${encodeURIComponent('/shop')}`;
        }
        return;
      }
      if (!response.ok) {
        setMessage({ type: 'error', text: data.error || '暂时无法创建订单，请稍后再试。' });
        return;
      }

      if (provider === 'alipay') {
        if (typeof data.paymentUrl !== 'string' || typeof data.outTradeNo !== 'string') {
          setMessage({ type: 'error', text: '支付宝收银台创建失败，请稍后再试。' });
          return;
        }
        if (alipayDisplayMode === 'redirect') {
          window.location.assign(data.paymentUrl);
          return;
        }
        setAlipayPayment({
          outTradeNo: data.outTradeNo,
          paymentUrl: data.paymentUrl,
          expiresAt: Date.now() + 30 * 60 * 1000,
          packageName: coinPackage.name,
          coins: coinPackage.coins,
          kind: paidKind(coinPackage),
          status: 'pending',
        });
        return;
      }

      if (typeof data.outTradeNo !== 'string' || typeof data.qrDataUrl !== 'string') {
        setMessage({ type: 'error', text: '微信支付二维码创建失败，请稍后再试。' });
        return;
      }
      setWechatPayment({
        outTradeNo: data.outTradeNo,
        qrDataUrl: data.qrDataUrl,
        expiresAt: Date.now() + Number(data.expiresInSeconds || 900) * 1000,
        packageName: coinPackage.name,
        coins: coinPackage.coins,
        kind: paidKind(coinPackage),
        status: 'pending',
      });
    } catch {
      setMessage({ type: 'error', text: '网络连接异常，请稍后再试。' });
    } finally {
      setLoadingPayment(null);
    }
  };

  const alreadyLifetime = isLifetimeVip(vipExpiresAt);

  return (
    <main className="min-h-screen bg-[#FBF9F4] px-4 py-12">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="mb-8 inline-block text-sm font-sans text-stone-500 hover:text-stone-800">
          ← 返回首页
        </Link>

        <header className="mb-10 max-w-2xl">
          <p className="mb-3 text-xs tracking-[0.28em] text-stone-500">数字内容服务</p>
          <h1 className="mb-4 text-3xl font-serif text-stone-900">选择服务包</h1>
          <p className="text-sm leading-7 text-stone-600">
            铜币可用于 AI 对话、深度思考、联网检索与 AI 解卦。开通终身 VIP 后，全部功能不再消耗铜币。
            铜币不能转赠、交易、提现或兑换现金。
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {alreadyLifetime && (
              <div className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-stone-900 px-4 py-2 text-sm text-white">
                <Crown className="h-4 w-4" /> 终身 VIP 已开通
              </div>
            )}
            {balance !== null && (
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
                <Coins className="h-4 w-4" /> 当前余额 {balance} 枚
              </div>
            )}
          </div>
        </header>

        {message && (
          <div className={`mb-6 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : message.type === 'error'
                ? 'border-red-200 bg-red-50 text-red-700'
                : 'border-stone-200 bg-white text-stone-700'
          }`}>
            {message.type === 'success' ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>{message.text}</span>
          </div>
        )}

        <article className="mb-5 flex flex-col rounded-2xl border border-stone-700 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between md:gap-10">
          <div className="max-w-xl">
            <p className="text-xs tracking-[0.22em] text-stone-500">一次开通</p>
            <h2 className="mt-2 flex items-center gap-2 text-2xl font-serif text-stone-900">
              <Crown className="h-5 w-5 text-stone-700" />
              {LIFETIME_VIP_PACKAGE.name}
            </h2>
            <p className="mt-3 text-sm leading-7 text-stone-600">{LIFETIME_VIP_PACKAGE.description}</p>
          </div>
          <div className="mt-6 w-full max-w-sm md:mt-0">
            <div className="mb-4 flex items-end justify-between">
              <span className="text-3xl font-serif text-stone-900">{formatCny(LIFETIME_VIP_PACKAGE.amountCents)}</span>
              <span className="text-sm text-stone-500">终身有效</span>
            </div>
            {alreadyLifetime ? (
              <p className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-center text-sm text-stone-600">
                你已开通终身 VIP
              </p>
            ) : (
              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={() => handlePurchase('wechat', LIFETIME_VIP_PACKAGE.id)}
                  disabled={loadingPayment !== null}
                  className="flex items-center justify-center gap-2 rounded-xl bg-[#07C160] px-4 py-3 text-sm text-white transition hover:bg-[#06AD56] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <QrCode className="h-4 w-4" />
                  {loadingPayment === `wechat:${LIFETIME_VIP_PACKAGE.id}` ? '正在生成二维码…' : '微信扫码支付'}
                </button>
                <button
                  type="button"
                  onClick={() => handlePurchase('alipay', LIFETIME_VIP_PACKAGE.id)}
                  disabled={loadingPayment !== null}
                  className="rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-700 transition hover:border-stone-500 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loadingPayment === `alipay:${LIFETIME_VIP_PACKAGE.id}` ? '正在创建订单…' : '支付宝支付'}
                </button>
              </div>
            )}
          </div>
        </article>

        <section className="grid gap-5 md:grid-cols-3" aria-label="铜币服务包">
          {COIN_PACKAGES.map((item) => (
            <article
              key={item.id}
              className={`relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm ${item.featured ? 'border-stone-700' : 'border-stone-200'}`}
            >
              {item.featured && (
                <span className="absolute -top-3 left-6 rounded-full bg-stone-800 px-3 py-1 text-xs text-white">常用选择</span>
              )}
              <h2 className="text-xl font-serif text-stone-900">{item.name}</h2>
              <p className="mt-2 min-h-12 text-sm leading-6 text-stone-500">{item.description}</p>
              <div className="mt-6 flex items-end justify-between">
                <div>
                  <strong className="text-3xl font-serif font-normal text-stone-900">{item.coins}</strong>
                  <span className="ml-1 text-sm text-stone-500">枚铜币</span>
                </div>
                <span className="text-lg text-stone-800">{formatCny(item.amountCents)}</span>
              </div>
              <div className="mt-6 grid gap-2">
                <button
                  type="button"
                  onClick={() => handlePurchase('wechat', item.id)}
                  disabled={loadingPayment !== null}
                  className="flex items-center justify-center gap-2 rounded-xl bg-[#07C160] px-4 py-3 text-sm text-white transition hover:bg-[#06AD56] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <QrCode className="h-4 w-4" />
                  {loadingPayment === `wechat:${item.id}` ? '正在生成二维码…' : '微信扫码支付'}
                </button>
                <button
                  type="button"
                  onClick={() => handlePurchase('alipay', item.id)}
                  disabled={loadingPayment !== null}
                  className="rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-700 transition hover:border-stone-500 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loadingPayment === `alipay:${item.id}` ? '正在创建订单…' : '支付宝支付'}
                </button>
              </div>
            </article>
          ))}
        </section>

        <section className="mt-8 rounded-2xl border border-stone-200 bg-white/80 p-6">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-stone-600" />
            <div className="text-sm leading-7 text-stone-600">
              <h2 className="mb-1 font-medium text-stone-800">清楚、可核验的交付</h2>
              <p>支付成功后，支付宝或微信支付服务器会通知本网站。铜币将增加到当前账户；终身 VIP 开通后，使用全部功能不再消耗铜币。订单与交付全程由系统自动完成。</p>
            </div>
          </div>
        </section>

        <label
          ref={agreementRef}
          className={`mt-6 flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-4 text-sm leading-6 transition ${
            agreementAttention
              ? 'border-red-300 bg-red-50 text-red-800 ring-4 ring-red-100'
              : 'border-transparent text-stone-600'
          }`}
        >
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) => {
              setAccepted(event.target.checked);
              if (event.target.checked) {
                setAgreementAttention(false);
                setMessage(null);
              }
            }}
            className="mt-1 h-4 w-4 accent-stone-800"
          />
          <span className="min-w-0">
            <span className="block">
              我已阅读并同意<Link href="/terms" className="mx-1 underline underline-offset-4">用户服务协议</Link>
              与<Link href="/refund" className="mx-1 underline underline-offset-4">退款与售后规则</Link>，并知晓铜币的用途和消耗方式。
            </span>
            {agreementAttention && (
              <span className="mt-1 block font-medium text-red-700">请勾选这里，再选择支付方式。</span>
            )}
          </span>
        </label>

        <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-stone-500">
          <Link href="/service" className="hover:text-stone-800">服务内容与计费</Link>
          <Link href="/refund" className="hover:text-stone-800">退款与售后</Link>
          <Link href="/privacy" className="hover:text-stone-800">隐私政策</Link>
          <Link href="/operator" className="hover:text-stone-800">经营者信息</Link>
        </div>
      </div>

      {wechatPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/45 px-4 py-8 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="wechat-payment-title"
            className="relative w-full max-w-md rounded-3xl bg-white p-7 text-center shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setWechatPayment(null)}
              aria-label="关闭微信支付窗口"
              className="absolute right-4 top-4 rounded-full p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
            >
              <X className="h-5 w-5" />
            </button>

            {wechatPayment.status === 'paid' ? (
              <div className="py-10">
                <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <Check className="h-8 w-8" />
                </span>
                <h2 id="wechat-payment-title" className="mt-5 text-2xl font-serif text-stone-900">支付成功</h2>
                <p className="mt-3 text-sm leading-6 text-stone-600">
                  {wechatPayment.kind === 'lifetime_vip' ? '终身 VIP 已经开通。' : `${wechatPayment.coins} 枚铜币已经到账。`}
                </p>
                <button
                  type="button"
                  onClick={() => setWechatPayment(null)}
                  className="mt-7 rounded-xl bg-stone-800 px-8 py-3 text-sm text-white hover:bg-stone-700"
                >
                  完成
                </button>
              </div>
            ) : wechatPayment.status === 'expired' ? (
              <div className="py-10">
                <AlertCircle className="mx-auto h-12 w-12 text-amber-600" />
                <h2 id="wechat-payment-title" className="mt-5 text-2xl font-serif text-stone-900">二维码已失效</h2>
                <p className="mt-3 text-sm leading-6 text-stone-600">请关闭窗口后重新选择微信支付。</p>
              </div>
            ) : (
              <>
                <p className="text-xs tracking-[0.22em] text-[#07A951]">微信支付</p>
                <h2 id="wechat-payment-title" className="mt-3 text-2xl font-serif text-stone-900">
                  请使用微信扫一扫
                </h2>
                <p className="mt-2 text-sm text-stone-500">{paidItemCaption(wechatPayment)}</p>
                <div className="mx-auto mt-6 w-fit rounded-2xl border border-stone-200 bg-white p-3 shadow-sm">
                  <Image
                    src={wechatPayment.qrDataUrl}
                    width={320}
                    height={320}
                    unoptimized
                    alt="微信支付二维码"
                    className="h-64 w-64"
                  />
                </div>
                <p className="mt-5 text-sm leading-6 text-stone-600">二维码将在15分钟后失效，付款完成后本页会自动确认到账。</p>
                <p className="mt-2 text-xs leading-5 text-stone-400">请直接打开微信“扫一扫”，不要从相册识别二维码。</p>
              </>
            )}
          </section>
        </div>
      )}

      {alipayPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/45 px-4 py-8 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="alipay-payment-title"
            className="relative w-full max-w-md rounded-3xl bg-white p-7 text-center shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setAlipayPayment(null)}
              aria-label="关闭支付宝支付窗口"
              className="absolute right-4 top-4 z-10 rounded-full p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
            >
              <X className="h-5 w-5" />
            </button>

            {alipayPayment.status === 'paid' ? (
              <div className="py-10">
                <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <Check className="h-8 w-8" />
                </span>
                <h2 id="alipay-payment-title" className="mt-5 text-2xl font-serif text-stone-900">支付成功</h2>
                <p className="mt-3 text-sm leading-6 text-stone-600">
                  {alipayPayment.kind === 'lifetime_vip' ? '终身 VIP 已经开通。' : `${alipayPayment.coins} 枚铜币已经到账。`}
                </p>
                <button
                  type="button"
                  onClick={() => setAlipayPayment(null)}
                  className="mt-7 rounded-xl bg-stone-800 px-8 py-3 text-sm text-white hover:bg-stone-700"
                >
                  完成
                </button>
              </div>
            ) : alipayPayment.status === 'expired' ? (
              <div className="py-10">
                <AlertCircle className="mx-auto h-12 w-12 text-amber-600" />
                <h2 id="alipay-payment-title" className="mt-5 text-2xl font-serif text-stone-900">二维码已失效</h2>
                <p className="mt-3 text-sm leading-6 text-stone-600">请关闭窗口后重新选择支付宝支付。</p>
              </div>
            ) : (
              <>
                <p className="text-xs tracking-[0.22em] text-[#1677FF]">支付宝</p>
                <h2 id="alipay-payment-title" className="mt-3 text-2xl font-serif text-stone-900">
                  请使用支付宝扫一扫
                </h2>
                <p className="mt-2 text-sm text-stone-500">{paidItemCaption(alipayPayment)}</p>
                <div className="mx-auto mt-5 h-[330px] w-full max-w-[360px] overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
                  <iframe
                    src={alipayPayment.paymentUrl}
                    title="支付宝扫码支付"
                    className="h-full w-full border-0 bg-white"
                  />
                </div>
                <p className="mt-4 text-sm leading-6 text-stone-600">付款完成后，本页会自动确认到账。</p>
                <a
                  href={alipayPayment.paymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-xs text-stone-400 underline underline-offset-4 hover:text-stone-600"
                >
                  二维码未显示？在新窗口打开
                </a>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
