'use client';

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { AlertCircle, Check, Coins, Crown, Wallet, ShieldCheck, X } from 'lucide-react';
import type { WechatJsapiParams, WechatPayMode } from '@/lib/payments/wechatShared';
import { invokeWechatPay, isWechatJsapiEnvironment } from '@/lib/payments/wechatBrowser';
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
import { hasPurchaseConsent, savePurchaseConsent } from '@/lib/payments/purchaseConsent';
import { buildWechatWebEntryPath, getWechatWebEntryPackage, isWechatWebEntryUrl } from '@/lib/payments/wechatWebEntry';

type PaymentMessage = { type: 'success' | 'error' | 'info'; text: string } | null;
type PaymentProvider = 'alipay' | 'wechat';
type PaidKind = 'coins' | 'lifetime_vip';
type WechatPayment = {
  outTradeNo: string;
  mode: WechatPayMode | 'web_entry';
  qrDataUrl?: string;
  entryUrl?: string;
  paymentUrl?: string;
  jsapiParams?: WechatJsapiParams;
  notice?: string;
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

function isMobilePaymentDevice(includeNarrowViewport = true) {
  const userAgent = window.navigator.userAgent;
  const isTouchMac = /Macintosh/i.test(userAgent) && window.navigator.maxTouchPoints > 1;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent) || isTouchMac
    || (includeNarrowViewport && !window.matchMedia('(min-width: 768px)').matches);
}

/* —— 宣纸水墨视觉令牌（与 the-one-design 规范一致）；类名须完整出现在源码中以便 Tailwind 扫描 —— */
const easeTransition = 'transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]';
const hairlineCard = 'rounded-2xl border border-stone-900/[0.07] bg-[#FDFCF9] shadow-[0_1px_3px_rgba(0,0,0,0.04)]';
const primaryBtn =
  'flex items-center justify-center gap-2 rounded-[13px] bg-stone-900 px-4 py-3 text-xs tracking-[0.14em] text-[#FBF9F4] ' +
  `${easeTransition} hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-40`;
const secondaryBtn =
  'rounded-[13px] border border-stone-900/10 bg-transparent px-4 py-3 text-xs tracking-[0.14em] text-stone-600 ' +
  `${easeTransition} hover:border-stone-900/25 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-40`;
const eyebrow = 'font-sans text-[10px] tracking-[0.34em] text-stone-400';

export default function ShopPage() {
  const [loadingPayment, setLoadingPayment] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [vipExpiresAt, setVipExpiresAt] = useState<string | null>(null);
  const [message, setMessage] = useState<PaymentMessage>(null);
  const [wechatPayment, setWechatPayment] = useState<WechatPayment | null>(null);
  const [alipayPayment, setAlipayPayment] = useState<AlipayPayment | null>(null);
  const [pendingPurchase, setPendingPurchase] = useState<{ provider: PaymentProvider; packageId: string } | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const consentDialogRef = useRef<HTMLDialogElement>(null);
  const consentUserRef = useRef<string | null | undefined>(undefined);
  const paymentMessageRef = useRef<HTMLDivElement>(null);
  const purchaseInFlight = useRef(false);
  const [returnedWechatOrder, setReturnedWechatOrder] = useState<string | null>(null);
  const [checkingWechat, setCheckingWechat] = useState(false);
  const [invokingWechat, setInvokingWechat] = useState(false);
  const [webEntryPackage, setWebEntryPackage] = useState<ReturnType<typeof getShopPackage>>(null);

  useEffect(() => {
    setWebEntryPackage(getWechatWebEntryPackage(`${window.location.pathname}${window.location.search}`));
  }, []);

  const syncConsentUser = useEffectEvent((userId: unknown) => {
    const nextUser = typeof userId === 'string' && userId ? userId : null;
    if (consentUserRef.current === nextUser) return;
    const previousUser = consentUserRef.current;
    consentUserRef.current = nextUser;
    setAccepted(nextUser ? hasPurchaseConsent(nextUser) : false);
    if (previousUser !== undefined) {
      setPendingPurchase(null);
      setConsentChecked(false);
    }
  });

  useEffect(() => {
    if (!pendingPurchase) return;
    const dialog = consentDialogRef.current;
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    if (!dialog.open) dialog.showModal();
    dialog.querySelector<HTMLInputElement>('input[type="checkbox"]')?.focus({ preventScroll: true });
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [pendingPurchase]);

  useEffect(() => {
    if (message && !wechatPayment && !alipayPayment) {
      paymentMessageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [message, wechatPayment, alipayPayment]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      void fetch('/api/user/profile', { credentials: 'include', cache: 'no-store' })
        .then(response => response.ok ? response.json() : null)
        .then(profile => {
          syncConsentUser(profile?.user_id);
          if (typeof profile?.coins_balance === 'number') setBalance(profile.coins_balance);
          if (profile) setVipExpiresAt(profile.vip_expires_at ?? null);
        }).catch(() => {});
    };
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  useEffect(() => {
    fetch('/api/user/profile', { credentials: 'include', cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        syncConsentUser(data?.user_id);
        setBalance(typeof data?.coins_balance === 'number' ? data.coins_balance : null);
        setVipExpiresAt(typeof data?.vip_expires_at === 'string' ? data.vip_expires_at : null);
      })
      .catch(() => setBalance(null));

    const params = new URLSearchParams(window.location.search);
    const order = params.get('order');
    if (params.get('payment') !== 'return' || !order) return;
    if (params.get('channel') === 'wechat') {
      setReturnedWechatOrder(order);
      setMessage({ type: 'info', text: '返回页面不代表付款已完成，请点击“确认支付结果”查看到账情况。' });
      return;
    }

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
    if (!wechatPayment || wechatPayment.mode === 'web_entry' || wechatPayment.status !== 'pending') return;

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

  const updateAccepted = (value: boolean) => {
    setAccepted(value);
    if (consentUserRef.current) savePurchaseConsent(consentUserRef.current, value);
  };

  const openWechatCashier = async (params: WechatJsapiParams) => {
    setInvokingWechat(true);
    try {
      const result = await invokeWechatPay(params);
      setMessage(current => current?.type === 'success' ? current : { type: result === 'fail' ? 'error' : 'info', text: result === 'ok'
        ? '正在确认到账，请稍候…' : result === 'cancel'
          ? '已取消付款，可以继续支付当前订单。' : '微信付款未完成，请重试或确认支付结果。' });
    } catch (error) {
      setMessage(current => current?.type === 'success' ? current : { type: 'error', text: error instanceof Error ? error.message : '微信支付未能打开。' });
    } finally { setInvokingWechat(false); }
  };

  const confirmWechatPayment = async (order: string) => {
    setCheckingWechat(true);
    try {
      const response = await fetch(`/api/payments/wechat/status?order=${encodeURIComponent(order)}&reconcile=1`, {
        credentials: 'include', cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '暂时无法确认订单，请稍后重试。');
      if (data.status === 'paid' && data.credited_at) {
        setWechatPayment(current => current?.outTradeNo === order ? { ...current, status: 'paid' } : current);
        setReturnedWechatOrder(null);
        setMessage({ type: 'success', text: deliveryText(data) });
        window.dispatchEvent(new CustomEvent('coins-should-refresh'));
        const profile = await fetch('/api/user/profile', { credentials: 'include', cache: 'no-store' })
          .then(response => response.ok ? response.json() : null).catch(() => null);
        if (typeof profile?.coins_balance === 'number') setBalance(profile.coins_balance);
        if (profile) setVipExpiresAt(profile.vip_expires_at ?? null);
      } else {
        setMessage({ type: 'info', text: data.status === 'pending'
          ? '暂未确认到账；如已付款，请稍后再次确认，无需重复购买。' : '该订单已结束，请重新选择服务包。' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : '网络连接异常，请稍后重试。' });
    } finally { setCheckingWechat(false); }
  };

  const handlePurchase = async (provider: PaymentProvider, packageId: string, options: { resumeAuthorization?: boolean; consentConfirmed?: boolean } = {}) => {
    if (purchaseInFlight.current) return;
    const coinPackage = getShopPackage(packageId);
    if (!coinPackage) return;
    const resumedConsent = options.resumeAuthorization === true;
    if (!accepted && !resumedConsent && !options.consentConfirmed) {
      setConsentChecked(false);
      setPendingPurchase({ provider, packageId });
      setMessage(null);
      return;
    }

    const alipayDisplayMode = provider === 'alipay' && !isMobilePaymentDevice() ? 'embedded' : 'redirect';

    purchaseInFlight.current = true;
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
            : { mobile: isMobilePaymentDevice(false), jsapi: isWechatJsapiEnvironment(), attemptId: window.crypto.randomUUID() }),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        if (!requestAppLogin()) {
          window.location.href = `/login?next=${encodeURIComponent(webEntryPackage ? buildWechatWebEntryPath(webEntryPackage.id) : '/shop')}`;
        }
        return;
      }
      if (!response.ok) {
        if (provider === 'wechat' && typeof data.outTradeNo === 'string') setReturnedWechatOrder(data.outTradeNo);
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

      if ((data.mode === 'authorize' || data.mode === 'jsapi') && !isWechatJsapiEnvironment()) {
        if (typeof data.outTradeNo === 'string') setReturnedWechatOrder(data.outTradeNo);
        setMessage({ type: 'error', text: '当前不在手机微信浏览器中，已停止微信内付款流程。请刷新页面使用扫码支付，或在微信中打开本站付款。' });
        return;
      }
      if (data.mode === 'web_entry') {
        if (typeof data.entryUrl !== 'string' || typeof data.qrDataUrl !== 'string'
          || !isWechatWebEntryUrl(data.entryUrl, window.location.origin, packageId)) {
          setMessage({ type: 'error', text: '微信网页入口生成失败，请稍后重试。' });
          return;
        }
        setWechatPayment({
          outTradeNo: '', mode: 'web_entry', entryUrl: data.entryUrl, qrDataUrl: data.qrDataUrl,
          expiresAt: 0, packageName: coinPackage.name, coins: coinPackage.coins,
          kind: paidKind(coinPackage), status: 'pending',
        });
        return;
      }
      if (data.mode === 'authorize' && typeof data.authorizationUrl === 'string') {
        if (resumedConsent) {
          setMessage({ type: 'error', text: '微信付款身份未能保存，请重新打开本页后付款。' });
          return;
        }
        // 只恢复这次用户已同意规则并点击的购买，不因普通页面访问自动下单。
        window.sessionStorage.setItem('wechat-pay-intent', JSON.stringify({ packageId, issuedAt: Date.now() }));
        window.location.assign(data.authorizationUrl);
        return;
      }
      if (data.mode === 'pending' && typeof data.outTradeNo === 'string') {
        setReturnedWechatOrder(data.outTradeNo);
        setMessage({ type: 'info', text: '这次购买已有订单，请先确认支付结果，无需重复购买。' });
        return;
      }
      if (typeof data.outTradeNo !== 'string'
        || !['native', 'h5', 'jsapi'].includes(data.mode)
        || (data.mode === 'native' && typeof data.qrDataUrl !== 'string')
        || (data.mode === 'h5' && typeof data.paymentUrl !== 'string')
        || (data.mode === 'jsapi' && !data.jsapiParams)) {
        setMessage({ type: 'error', text: '微信收银台创建失败，请稍后再试。' });
        return;
      }
      setWechatPayment({
        outTradeNo: data.outTradeNo,
        mode: data.mode,
        qrDataUrl: data.qrDataUrl,
        paymentUrl: data.paymentUrl,
        jsapiParams: data.jsapiParams,
        notice: data.notice,
        expiresAt: Date.now() + Number(data.expiresInSeconds || 900) * 1000,
        packageName: coinPackage.name,
        coins: coinPackage.coins,
        kind: paidKind(coinPackage),
        status: 'pending',
      });
      if (data.mode === 'h5') window.location.assign(data.paymentUrl);
      if (data.mode === 'jsapi') await openWechatCashier(data.jsapiParams);
    } catch {
      setMessage({ type: 'error', text: '网络连接异常，请稍后再试。' });
    } finally {
      purchaseInFlight.current = false;
      setLoadingPayment(null);
    }
  };

  const confirmPurchaseConsent = async () => {
    if (!consentChecked || !pendingPurchase || purchaseInFlight.current) return;
    const purchase = pendingPurchase;
    updateAccepted(true);
    setPendingPurchase(null);
    await handlePurchase(purchase.provider, purchase.packageId, { consentConfirmed: true });
  };

  const copyWechatEntryUrl = async () => {
    if (!wechatPayment?.entryUrl) return;
    try {
      await window.navigator.clipboard.writeText(wechatPayment.entryUrl);
      setMessage({ type: 'info', text: '网页链接已复制，也可发到微信聊天后点开。请在微信网页中核对账号和金额再付款。' });
    } catch {
      setMessage({ type: 'error', text: '未能复制，请长按下方网页地址手动复制，或保存入口码图片。' });
    }
  };

  const resumeWechatPurchase = useEffectEvent((packageId: string) => {
    void handlePurchase('wechat', packageId, { resumeAuthorization: true });
  });

  useEffect(() => {
    const url = new URL(window.location.href);
    const authorization = url.searchParams.get('wechat');
    if (!authorization) return;
    const packageId = url.searchParams.get('package');
    url.searchParams.delete('wechat');
    url.searchParams.delete('package');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    let intent: { packageId?: string; issuedAt?: number } | null = null;
    try {
      intent = JSON.parse(window.sessionStorage.getItem('wechat-pay-intent') || 'null');
      window.sessionStorage.removeItem('wechat-pay-intent');
    } catch { /* 存储不可用时请用户重新点击付款。 */ }
    if (authorization === 'authorized' && packageId && intent?.packageId === packageId
      && typeof intent.issuedAt === 'number' && Date.now() >= intent.issuedAt && Date.now() - intent.issuedAt < 600_000) {
      setAccepted(true);
      resumeWechatPurchase(packageId);
    } else {
      setMessage({ type: authorization === 'authorized' ? 'info' : 'error', text: authorization === 'authorized'
        ? '微信已就绪，请选择服务包并付款。' : '微信付款授权未完成，请重新选择微信支付。' });
    }
  }, []);

  const alreadyLifetime = isLifetimeVip(vipExpiresAt);
  const consentPackage = pendingPurchase ? getShopPackage(pendingPurchase.packageId) : null;

  return (
    <main className="min-h-screen bg-[#FBF9F4] px-6 pb-24 pt-14">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/"
          className={`mb-10 inline-block text-[13px] tracking-[0.15em] text-stone-400 ${easeTransition} hover:text-stone-700`}
          style={{ fontFamily: 'var(--ui-font-kaiti)' }}
        >
          ← 返回首页
        </Link>

        <header className="mb-12 max-w-2xl">
          <p className={`mb-4 ${eyebrow}`}>数 字 内 容 服 务</p>
          <h1 className="mb-5 font-serif text-[30px] leading-tight tracking-[0.12em] text-stone-900">选择服务包</h1>
          <p className="text-sm leading-7 text-stone-500">
            铜币可用于 AI 对话、深度思考、联网检索与 AI 解卦。开通终身 VIP 后，全部功能不再消耗铜币。
            铜币不能转赠、交易、提现或兑换现金。
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {alreadyLifetime && (
              <div className="inline-flex items-center gap-2 rounded-full border border-[#B09F73]/30 bg-[#B09F73]/[0.08] px-4 py-1.5 text-xs tracking-[0.08em] text-[#8a7a54]">
                <Crown className="h-3.5 w-3.5" /> 终身 VIP 已开通
              </div>
            )}
            {balance !== null && (
              <div className="inline-flex items-center gap-2 rounded-full bg-stone-900/[0.045] px-4 py-1.5 text-xs tracking-[0.08em] text-stone-500">
                <Coins className="h-3.5 w-3.5 text-[#B09F73]" /> 当前余额 {balance} 枚
              </div>
            )}
          </div>
        </header>

        {webEntryPackage && (
          <section aria-label="微信网页付款" className={`mb-8 p-6 ${hairlineCard}`}>
            <p className={eyebrow}>微 信 网 页 付 款</p>
            <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
              <h2 className="font-serif text-xl tracking-[0.08em]">继续购买{webEntryPackage.name}</h2>
              <span className="font-serif text-2xl">{formatCny(webEntryPackage.amountCents)}</span>
            </div>
            <p className="mt-3 text-[13px] leading-6 text-stone-500">权益将交付给当前登录账号，请先核对右上角账号。识别入口码不会下单或扣费，确认后再付款。</p>
            <button type="button" disabled={loadingPayment !== null} className={`mt-5 w-full ${primaryBtn}`}
              onClick={() => {
                if (!isWechatJsapiEnvironment()) {
                  setMessage({ type: 'info', text: '请在手机微信“扫一扫 → 相册”中识别入口码，进入微信普通网页后再付款。' });
                  return;
                }
                void handlePurchase('wechat', webEntryPackage.id);
              }}>确认账号并使用微信付款</button>
          </section>
        )}

        {message && (
          <div ref={paymentMessageRef} role="status" className={`mb-8 flex flex-wrap items-start gap-3 rounded-[13px] border px-4 py-3 text-[13px] leading-6 ${
            message.type === 'success'
              ? 'border-[#5B7A5B]/25 bg-[#5B7A5B]/[0.07] text-[#4e6b4e]'
              : message.type === 'error'
                ? 'border-[#8A4A4A]/25 bg-[#8A4A4A]/[0.06] text-[#7a4444]'
                : 'border-stone-900/[0.07] bg-[#FDFCF9] text-stone-600'
          }`}>
            {message.type === 'success' ? <Check className="mt-1 h-3.5 w-3.5 shrink-0" /> : <AlertCircle className="mt-1 h-3.5 w-3.5 shrink-0" />}
            <span>{message.text}</span>
            {returnedWechatOrder && (
              <button type="button" disabled={checkingWechat} className={secondaryBtn}
                onClick={() => void confirmWechatPayment(returnedWechatOrder)}>
                {checkingWechat ? '正在确认…' : '确认支付结果'}
              </button>
            )}
          </div>
        )}

        <div className="mb-8 rounded-[18px] bg-stone-900/[0.025] p-px ring-1 ring-stone-900/[0.055]">
          <article className="flex flex-col rounded-[17px] bg-[#FDFCF9] p-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] md:flex-row md:items-center md:justify-between md:gap-10">
            <div className="max-w-xl">
              <p className="font-sans text-[10px] tracking-[0.34em] text-[#B09F73]">一 次 开 通</p>
              <h2 className="mt-3 flex items-center gap-2.5 font-serif text-2xl tracking-[0.08em] text-stone-900">
                <Crown className="h-5 w-5 text-[#B09F73]" />
                {LIFETIME_VIP_PACKAGE.name}
              </h2>
              <p className="mt-3 text-[13px] leading-7 text-stone-500">{LIFETIME_VIP_PACKAGE.description}</p>
            </div>
            <div className="mt-7 w-full max-w-sm md:mt-0">
              <div className="mb-5 flex items-end justify-between">
                <span className="font-serif text-3xl text-stone-900">{formatCny(LIFETIME_VIP_PACKAGE.amountCents)}</span>
                <span className="text-xs tracking-[0.1em] text-stone-400">终身有效</span>
              </div>
              {alreadyLifetime ? (
                <p className="rounded-[13px] border border-stone-900/[0.07] px-4 py-3 text-center text-xs tracking-[0.1em] text-stone-500">
                  你已开通终身 VIP
                </p>
              ) : (
                <div className="grid gap-2.5">
                  <button
                    type="button"
                    onClick={() => handlePurchase('wechat', LIFETIME_VIP_PACKAGE.id)}
                    disabled={loadingPayment !== null}
                    className={primaryBtn}
                  >
                    <Wallet className="h-4 w-4" />
                    {loadingPayment === `wechat:${LIFETIME_VIP_PACKAGE.id}` ? '正在打开微信支付…' : '微信支付'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePurchase('alipay', LIFETIME_VIP_PACKAGE.id)}
                    disabled={loadingPayment !== null}
                    className={secondaryBtn}
                  >
                    {loadingPayment === `alipay:${LIFETIME_VIP_PACKAGE.id}` ? '正在创建订单…' : '支付宝支付'}
                  </button>
                </div>
              )}
            </div>
          </article>
        </div>

        <div className="mb-5 mt-10 flex items-center gap-3">
          <span className={eyebrow}>铜 币 服 务 包</span>
          <span className="h-px flex-1 bg-stone-200/80" />
        </div>

        <section className="grid gap-5 md:grid-cols-3" aria-label="铜币服务包">
          {COIN_PACKAGES.map((item) => (
            <article
              key={item.id}
              className={`relative flex flex-col p-6 ${hairlineCard} ${item.featured ? 'border-stone-900/[0.16]' : ''}`}
            >
              {item.featured && (
                <span className="absolute -top-2.5 left-6 rounded-full bg-[#B09F73]/[0.12] px-2.5 py-0.5 font-sans text-[10px] tracking-[0.14em] text-[#8a7a54]">
                  常用选择
                </span>
              )}
              <h2 className="font-serif text-xl tracking-[0.08em] text-stone-900">{item.name}</h2>
              <p className="mt-2 min-h-12 text-[13px] leading-6 text-stone-500">{item.description}</p>
              <div className="mt-6 flex items-end justify-between">
                <div>
                  <span className="font-serif text-[32px] leading-none text-stone-900">{item.coins}</span>
                  <span className="ml-1.5 text-xs text-stone-400">枚铜币</span>
                </div>
                <span className="font-serif text-lg text-stone-700">{formatCny(item.amountCents)}</span>
              </div>
              <div className="mt-6 grid gap-2.5">
                <button
                  type="button"
                  onClick={() => handlePurchase('wechat', item.id)}
                  disabled={loadingPayment !== null}
                  className={primaryBtn}
                >
                  <Wallet className="h-4 w-4" />
                  {loadingPayment === `wechat:${item.id}` ? '正在打开微信支付…' : '微信支付'}
                </button>
                <button
                  type="button"
                  onClick={() => handlePurchase('alipay', item.id)}
                  disabled={loadingPayment !== null}
                  className={secondaryBtn}
                >
                  {loadingPayment === `alipay:${item.id}` ? '正在创建订单…' : '支付宝支付'}
                </button>
              </div>
            </article>
          ))}
        </section>

        <section className={`mt-10 p-6 ${hairlineCard}`}>
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-stone-400" />
            <div className="text-[13px] leading-7 text-stone-500">
              <h2 className="mb-1 font-serif text-sm tracking-[0.1em] text-stone-800">清楚、可核验的交付</h2>
              <p>支付成功后，支付宝或微信支付服务器会通知本网站。铜币将增加到当前账户；终身 VIP 开通后，使用全部功能不再消耗铜币。订单与交付全程由系统自动完成。</p>
            </div>
          </div>
        </section>

        <label
          className={`mt-8 flex cursor-pointer items-start gap-3 rounded-[13px] border border-transparent px-4 py-4 text-[13px] leading-6 text-stone-500 ${easeTransition}`}
        >
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) => {
              updateAccepted(event.target.checked);
              if (event.target.checked) {
                setMessage(null);
              }
            }}
            className="mt-1 h-4 w-4 accent-stone-800"
          />
          <span className="min-w-0">
            <span className="block">
              我已阅读并同意<Link href="/terms" className="mx-1 text-stone-700 underline underline-offset-4">用户服务协议</Link>
              与<Link href="/refund" className="mx-1 text-stone-700 underline underline-offset-4">退款与售后规则</Link>，并知晓铜币的用途和消耗方式。
            </span>
            {accepted && <span className="mt-1 block text-xs text-stone-400">已确认；当前账号在此浏览器下次购买无需重复勾选，可随时取消。</span>}
          </span>
        </label>

        <div className="mt-10 flex flex-wrap gap-x-7 gap-y-2 text-xs tracking-[0.1em] text-stone-400">
          <Link href="/service" className={`${easeTransition} hover:text-stone-700`}>服务内容与计费</Link>
          <Link href="/refund" className={`${easeTransition} hover:text-stone-700`}>退款与售后</Link>
          <Link href="/privacy" className={`${easeTransition} hover:text-stone-700`}>隐私政策</Link>
          <Link href="/operator" className={`${easeTransition} hover:text-stone-700`}>经营者信息</Link>
        </div>
      </div>

      {pendingPurchase && consentPackage && (
        <dialog
          ref={consentDialogRef}
          aria-labelledby="purchase-consent-title"
          aria-describedby="purchase-consent-description"
          onCancel={(event) => { event.preventDefault(); setPendingPurchase(null); }}
          className="fixed inset-0 m-auto max-h-[calc(100dvh-3rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-[24px] border-0 bg-[var(--ui-color-background)] p-6 text-stone-900 shadow-[0_24px_64px_rgba(28,25,23,0.04)] ring-1 ring-stone-900/[0.08] backdrop:bg-stone-950/40 backdrop:backdrop-blur-sm sm:p-8"
        >
          <button type="button" onClick={() => setPendingPurchase(null)} aria-label="关闭购买确认"
            className={`absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-stone-400 ${easeTransition} hover:bg-stone-100 hover:text-stone-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-500`}>
            <X className="h-4 w-4" />
          </button>
          <p className={eyebrow}>首 次 购 买 确 认</p>
          <h2 id="purchase-consent-title" className="mt-5 font-serif text-2xl tracking-[0.1em]">付款前，请确认</h2>
          <p id="purchase-consent-description" className="mt-3 text-[13px] leading-6 text-stone-500">确认服务与退款规则后，继续刚才选择的付款。</p>
          <div className="mt-6 flex items-center justify-between gap-4 border-y border-stone-900/[0.07] py-4">
            <div>
              <p className="font-serif text-lg tracking-[0.08em]">{consentPackage.name}</p>
              <p className="mt-1 text-xs text-stone-500">{pendingPurchase.provider === 'wechat' ? '微信支付' : '支付宝支付'}{!isLifetimeVipPackage(consentPackage) && ` · ${consentPackage.coins} 枚铜币`}</p>
            </div>
            <span className="shrink-0 font-serif text-2xl">{formatCny(consentPackage.amountCents)}</span>
          </div>
          <label className="mt-6 flex cursor-pointer items-start gap-3 text-[13px] leading-7 text-stone-600">
            <input type="checkbox" checked={consentChecked}
              onChange={(event) => setConsentChecked(event.target.checked)}
              className="mt-1.5 h-4 w-4 shrink-0 accent-stone-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-stone-500" />
            <span>我已阅读并同意<Link href="/terms" target="_blank" rel="noopener noreferrer" className="mx-1 text-stone-900 underline underline-offset-4">用户服务协议</Link>与<Link href="/refund" target="_blank" rel="noopener noreferrer" className="mx-1 text-stone-900 underline underline-offset-4">退款与售后规则</Link>，并知晓所购服务的用途和计费方式。</span>
          </label>
          <p className="mt-3 pl-7 text-[11px] leading-5 text-stone-400">确认后，当前账号在此浏览器将记住选择。下次仍需你点击付款，不会自动扣费。</p>
          <div className="mt-7 grid gap-3">
            <button type="button" disabled={!consentChecked || loadingPayment !== null} onClick={() => void confirmPurchaseConsent()}
              className={`${primaryBtn} min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-500`}>同意并继续付款</button>
            <button type="button" onClick={() => setPendingPurchase(null)} className={`${secondaryBtn} min-h-11`}>暂不购买</button>
          </div>
        </dialog>
      )}

      {wechatPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 px-4 py-8 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="wechat-payment-title"
            className="relative max-h-[calc(100dvh-4rem)] w-full max-w-md overflow-y-auto rounded-[24px] bg-[#FBF9F4] p-8 text-center shadow-[0_24px_64px_rgba(28,25,23,0.04)] ring-1 ring-stone-900/[0.08]"
          >
            <button
              type="button"
              onClick={() => setWechatPayment(null)}
              aria-label="关闭微信支付窗口"
              className={`absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full text-stone-400 ${easeTransition} hover:bg-stone-100 hover:text-stone-700`}
            >
              <X className="h-4 w-4" />
            </button>

            {wechatPayment.status === 'paid' ? (
              <div className="py-8">
                <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#5B7A5B]/10 text-[#5B7A5B]">
                  <Check className="h-7 w-7" />
                </span>
                <h2 id="wechat-payment-title" className="mt-6 font-serif text-2xl tracking-[0.12em] text-stone-900">支付成功</h2>
                <p className="mt-3 text-[13px] leading-6 text-stone-500">
                  {wechatPayment.kind === 'lifetime_vip' ? '终身 VIP 已经开通。' : `${wechatPayment.coins} 枚铜币已经到账。`}
                </p>
                <button
                  type="button"
                  onClick={() => setWechatPayment(null)}
                  className={`mt-8 rounded-[13px] bg-stone-900 px-10 py-3 text-xs tracking-[0.14em] text-[#FBF9F4] ${easeTransition} hover:bg-stone-700`}
                >
                  完成
                </button>
              </div>
            ) : wechatPayment.status === 'expired' ? (
              <div className="py-8">
                <AlertCircle className="mx-auto h-10 w-10 text-[#B09F73]" />
                <h2 id="wechat-payment-title" className="mt-6 font-serif text-2xl tracking-[0.12em] text-stone-900">付款时间已结束</h2>
                <p className="mt-3 text-[13px] leading-6 text-stone-500">如已付款，请先确认支付结果；尚未付款可关闭窗口后重新选择微信支付。</p>
                <button type="button" disabled={checkingWechat} className={`mt-6 ${secondaryBtn}`}
                  onClick={() => void confirmWechatPayment(wechatPayment.outTradeNo)}>
                  {checkingWechat ? '正在确认…' : '确认支付结果'}
                </button>
              </div>
            ) : wechatPayment.mode === 'web_entry' ? (
              <>
                <p className={eyebrow}>微 信 网 页 入 口</p>
                <h2 id="wechat-payment-title" className="mt-4 font-serif text-2xl tracking-[0.1em] text-stone-900">保存入口码，在微信中打开</h2>
                <p className="mt-3 text-xs leading-6 text-stone-500">{paidItemCaption(wechatPayment)} · 请在网页内核对价格</p>
                <div className="mx-auto mt-5 w-fit rounded-2xl border border-stone-900/[0.07] bg-[#FDFCF9] p-3">
                  <Image src={wechatPayment.qrDataUrl!} width={720} height={720} unoptimized alt="微信网页付款入口二维码"
                    className="h-auto w-full max-w-64" />
                </div>
                <p className="mt-5 text-[13px] leading-7 text-stone-600">长按入口码保存图片 → 微信扫一扫 → 从相册选择 → 登录原网站账号后付款。</p>
                <p className="mt-2 text-[11px] leading-5 text-stone-400">这是普通网页入口，不是付款码，也不会跳转小程序。尚未创建支付订单，请在微信网页中核对账号和金额。</p>
                <div className="mt-5 grid gap-3">
                  <a href={wechatPayment.qrDataUrl} download="二-微信网页入口码.png" className={primaryBtn}>保存入口码图片</a>
                  <button type="button" className={secondaryBtn} onClick={() => void copyWechatEntryUrl()}>复制付款网页链接</button>
                </div>
                <p className="mt-3 break-all text-[11px] leading-5 text-stone-400 select-all">{wechatPayment.entryUrl}</p>
                {message && <p role="status" className="mt-3 text-[13px] leading-6 text-stone-600">{message.text}</p>}
              </>
            ) : wechatPayment.mode === 'native' ? (
              <>
                <p className={eyebrow}>微 信 扫 码 支 付</p>
                <h2 id="wechat-payment-title" className="mt-4 font-serif text-2xl tracking-[0.12em] text-stone-900">
                  请使用微信扫一扫
                </h2>
                <p className="mt-2 text-xs tracking-[0.06em] text-stone-400">{paidItemCaption(wechatPayment)}</p>
                {wechatPayment.notice && <p role="status" className="mt-3 text-[13px] leading-6 text-stone-600">{wechatPayment.notice}</p>}
                <div className="mx-auto mt-6 w-fit rounded-2xl border border-stone-900/[0.07] bg-[#FDFCF9] p-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                  <Image
                    src={wechatPayment.qrDataUrl!}
                    width={320}
                    height={320}
                    unoptimized
                    alt="微信支付二维码"
                    className="h-64 w-64"
                  />
                </div>
                <p className="mt-5 text-[13px] leading-6 text-stone-500">二维码将在15分钟后失效，付款完成后本页会自动确认到账。</p>
                <p className="mt-2 text-[11px] leading-5 text-stone-400">请直接打开微信“扫一扫”，不要从相册识别二维码。</p>
              </>
            ) : (
              <>
                <p className={eyebrow}>微 信 支 付</p>
                <h2 id="wechat-payment-title" className="mt-4 font-serif text-2xl tracking-[0.12em] text-stone-900">请在微信中完成付款</h2>
                <p className="mt-3 text-xs leading-6 text-stone-500">{paidItemCaption(wechatPayment)}</p>
                <p className="mt-4 text-[13px] leading-6 text-stone-500">如已付款，请确认到账情况。取消付款后，可继续支付当前订单。</p>
                {message && <p role="status" className="mt-3 text-[13px] leading-6 text-stone-600">{message.text}</p>}
                <div className="mt-6 grid gap-3">
                  <button type="button" className={primaryBtn} disabled={invokingWechat}
                    onClick={() => {
                      if (wechatPayment.mode === 'h5' && wechatPayment.paymentUrl) window.location.assign(wechatPayment.paymentUrl);
                      else if (wechatPayment.jsapiParams) void openWechatCashier(wechatPayment.jsapiParams);
                    }}>
                    {invokingWechat ? '请在微信中确认…' : '继续微信付款'}
                  </button>
                  <button type="button" className={secondaryBtn} disabled={checkingWechat}
                    onClick={() => void confirmWechatPayment(wechatPayment.outTradeNo)}>
                    {checkingWechat ? '正在确认…' : '确认支付结果'}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {alipayPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 px-4 py-8 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="alipay-payment-title"
            className="relative w-full max-w-md rounded-[24px] bg-[#FBF9F4] p-8 text-center shadow-[0_24px_64px_rgba(28,25,23,0.04)] ring-1 ring-stone-900/[0.08]"
          >
            <button
              type="button"
              onClick={() => setAlipayPayment(null)}
              aria-label="关闭支付宝支付窗口"
              className={`absolute right-4 top-4 z-10 flex h-7 w-7 items-center justify-center rounded-full text-stone-400 ${easeTransition} hover:bg-stone-100 hover:text-stone-700`}
            >
              <X className="h-4 w-4" />
            </button>

            {alipayPayment.status === 'paid' ? (
              <div className="py-8">
                <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#5B7A5B]/10 text-[#5B7A5B]">
                  <Check className="h-7 w-7" />
                </span>
                <h2 id="alipay-payment-title" className="mt-6 font-serif text-2xl tracking-[0.12em] text-stone-900">支付成功</h2>
                <p className="mt-3 text-[13px] leading-6 text-stone-500">
                  {alipayPayment.kind === 'lifetime_vip' ? '终身 VIP 已经开通。' : `${alipayPayment.coins} 枚铜币已经到账。`}
                </p>
                <button
                  type="button"
                  onClick={() => setAlipayPayment(null)}
                  className={`mt-8 rounded-[13px] bg-stone-900 px-10 py-3 text-xs tracking-[0.14em] text-[#FBF9F4] ${easeTransition} hover:bg-stone-700`}
                >
                  完成
                </button>
              </div>
            ) : alipayPayment.status === 'expired' ? (
              <div className="py-8">
                <AlertCircle className="mx-auto h-10 w-10 text-[#B09F73]" />
                <h2 id="alipay-payment-title" className="mt-6 font-serif text-2xl tracking-[0.12em] text-stone-900">二维码已失效</h2>
                <p className="mt-3 text-[13px] leading-6 text-stone-500">请关闭窗口后重新选择支付宝支付。</p>
              </div>
            ) : (
              <>
                <p className={eyebrow}>支 付 宝 扫 码 支 付</p>
                <h2 id="alipay-payment-title" className="mt-4 font-serif text-2xl tracking-[0.12em] text-stone-900">
                  请使用支付宝扫一扫
                </h2>
                <p className="mt-2 text-xs tracking-[0.06em] text-stone-400">{paidItemCaption(alipayPayment)}</p>
                <div className="mx-auto mt-6 h-[330px] w-full max-w-[360px] overflow-hidden rounded-2xl border border-stone-900/[0.07] bg-[#FDFCF9] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                  <iframe
                    src={alipayPayment.paymentUrl}
                    title="支付宝扫码支付"
                    className="h-full w-full border-0 bg-white"
                  />
                </div>
                <p className="mt-4 text-[13px] leading-6 text-stone-500">付款完成后，本页会自动确认到账。</p>
                <a
                  href={alipayPayment.paymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`mt-2 inline-block text-[11px] text-stone-400 underline underline-offset-4 ${easeTransition} hover:text-stone-600`}
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
