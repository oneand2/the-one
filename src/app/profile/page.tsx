'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { ADMIN_EMAIL, isLifetimeVip } from '@/utils/vip';
import { requestAppLogin } from '@/utils/iosEmbed';

type BlockedAuthor = {
  id: string;
  authorId: string;
  createdAt: string;
};

export default function ProfilePage() {
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [coins, setCoins] = useState<number | null>(null);
  const [vipExpiresAt, setVipExpiresAt] = useState<string | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [vipTargetEmail, setVipTargetEmail] = useState('');
  const [vipDuration, setVipDuration] = useState<'1m' | '3m' | '6m' | '1y' | 'lifetime'>('1m');
  const [vipSubmitting, setVipSubmitting] = useState(false);
  const [vipMessage, setVipMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [meditationDefault, setMeditationDefault] = useState(true);
  const [preferenceSaving, setPreferenceSaving] = useState(false);
  const [blockedAuthors, setBlockedAuthors] = useState<BlockedAuthor[]>([]);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);
  const [wechatStatus, setWechatStatus] = useState<{
    configured: boolean;
    bound: boolean;
    nickname?: string | null;
  } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        if (!requestAppLogin()) router.replace('/login?next=/profile');
        return;
      }
      // 检查是否是管理员
      if (user.email === ADMIN_EMAIL) {
        setIsAdmin(true);
      }
      fetch('/api/user/profile', { credentials: 'include' })
        .then((r) => {
          if (!r.ok) {
            if (r.status === 401) {
              if (!requestAppLogin()) router.replace('/login?next=/profile');
              return null;
            }
            return Promise.reject(new Error(r.status === 404 ? '服务暂不可用，请稍后重试' : '无法加载档案，请检查网络或重新登录'));
          }
          return r.json();
        })
        .then((p) => {
          if (p == null) return;
          setNickname(p.nickname ?? '');
          setInviteCode(p.invite_code ?? null);
          setCoins(p.coins_balance ?? 0);
          setVipExpiresAt(p.vip_expires_at ?? null);
          setMeditationDefault(p.juexingcang_meditation_default ?? true);
        })
        .catch((e) => setError(e instanceof Error ? e.message : '加载失败'))
        .finally(() => setLoading(false));

      fetch('/api/auth/wechat/status', { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : null))
        .then((status) => {
          if (status) setWechatStatus(status);
        })
        .catch(() => {});

      fetch('/api/jianzhongsheng/blocks', { credentials: 'include', cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((payload: { blocks?: BlockedAuthor[] } | null) => setBlockedAuthors(payload?.blocks ?? []))
        .catch(() => {});

      const message = new URLSearchParams(window.location.search).get('message');
      if (message) {
        if (message === '微信绑定成功') {
          setNotice(message);
        } else {
          setError(message);
        }
        window.history.replaceState({}, '', '/profile');
      }
    });
  }, [router]);

  const handleSaveNickname = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ nickname: nickname.trim().slice(0, 50) }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error || '保存失败');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleMeditationDefault = async (nextValue: boolean) => {
    const previous = meditationDefault;
    setMeditationDefault(nextValue);
    setPreferenceSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ juexingcang_meditation_default: nextValue }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || '偏好暂时无法保存');
      setNotice(nextValue ? '宗师模式将默认开启。' : '宗师模式将不再默认开启。');
    } catch (e) {
      setMeditationDefault(previous);
      setError(e instanceof Error ? e.message : '偏好暂时无法保存');
    } finally {
      setPreferenceSaving(false);
    }
  };

  const handleUnblock = async (blockId: string) => {
    setUnblockingId(blockId);
    setError(null);
    try {
      const response = await fetch(`/api/jianzhongsheng/blocks?id=${encodeURIComponent(blockId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || '暂时无法解除屏蔽');
      setBlockedAuthors((current) => current.filter((item) => item.id !== blockId));
      setNotice('已解除屏蔽。');
    } catch (e) {
      setError(e instanceof Error ? e.message : '暂时无法解除屏蔽');
    } finally {
      setUnblockingId(null);
    }
  };

  const handleGenerateInviteCode = async () => {
    setGenLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/user/invite-code', { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error || '生成失败');
      setInviteCode((data as { invite_code?: string }).invite_code ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成失败');
    } finally {
      setGenLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FBF9F4] flex items-center justify-center">
        <p className="text-stone-500 font-sans">加载中…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FBF9F4] px-4 py-12">
      <div className="max-w-md mx-auto">
        <Link href="/" className="text-sm text-stone-500 hover:text-stone-800 font-sans inline-block mb-8">
          ← 返回首页
        </Link>
        <h1 className="text-2xl font-serif text-stone-800 mb-8">个人设置</h1>

        {error && (
          <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm font-sans">
            {error}
          </div>
        )}

        {notice && (
          <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-sans text-emerald-800">
            {notice}
          </div>
        )}

        <div className="space-y-8">
          <div>
            <label className="block text-sm font-sans text-stone-700 mb-2">昵称</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="flex-1 px-4 py-3 bg-white border border-stone-300 rounded-lg text-stone-800 font-sans text-sm focus:outline-none focus:border-stone-600"
                placeholder="用于展示的称呼"
                maxLength={50}
              />
              <button
                type="button"
                onClick={handleSaveNickname}
                disabled={saving}
                className="px-4 py-3 bg-stone-800 text-white font-sans text-sm rounded-lg hover:bg-stone-700 disabled:opacity-60"
              >
                {saving ? '保存中…' : '保存'}
              </button>
            </div>
          </div>

          <section className="border-t border-stone-200/80 pt-6" aria-labelledby="usage-preferences-title">
            <div className="mb-4 flex items-center gap-3">
              <h2 id="usage-preferences-title" className="font-sans text-[11px] tracking-[0.18em] text-stone-600">使用偏好</h2>
              <span className="h-px flex-1 bg-stone-200/80" />
            </div>
            <div className="flex items-center justify-between gap-5 rounded-2xl border border-black/[0.07] bg-[#FDFCF9] px-4 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.035)]">
              <div className="min-w-0">
                <p className="font-sans text-[13px] text-stone-700">默认开启宗师模式</p>
                <p className="mt-1 font-sans text-[10px] leading-5 text-stone-400">
                  关闭后，每次进入决行藏将从普通模式开始；仍可临时开启宗师模式。
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={meditationDefault}
                aria-label="默认开启宗师模式"
                disabled={preferenceSaving}
                onClick={() => void handleMeditationDefault(!meditationDefault)}
                className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400/35 disabled:opacity-50 ${meditationDefault ? 'border-stone-700 bg-stone-700' : 'border-stone-300 bg-stone-100'}`}
              >
                <span className={`absolute left-0 top-[3px] h-5 w-5 rounded-full bg-[#FBF9F4] shadow-sm transition-transform duration-200 ${meditationDefault ? 'translate-x-[23px]' : 'translate-x-[3px]'}`} />
              </button>
            </div>
          </section>

          <section className="border-t border-stone-200/80 pt-6" aria-labelledby="content-privacy-title">
            <div className="mb-3 flex items-center gap-3">
              <h2 id="content-privacy-title" className="font-sans text-[11px] tracking-[0.18em] text-stone-600">内容与隐私</h2>
              <span className="h-px flex-1 bg-stone-200/80" />
            </div>
            <p className="mb-3 font-sans text-[10px] leading-5 text-stone-400">管理你在“见众生”中屏蔽的用户。</p>
            {blockedAuthors.length === 0 ? (
              <p className="rounded-xl border border-stone-200/70 px-4 py-3 font-sans text-[11px] text-stone-400">暂无屏蔽用户</p>
            ) : (
              <div className="divide-y divide-stone-200/70 rounded-2xl border border-stone-200/80 bg-[#FDFCF9] px-4">
                {blockedAuthors.map((block) => (
                  <div key={block.id} className="flex min-h-14 items-center justify-between gap-4">
                    <span className="truncate text-[12px] tracking-[0.1em] text-stone-600" style={{ fontFamily: 'var(--ui-font-kaiti)' }}>
                      {block.authorId}
                    </span>
                    <button
                      type="button"
                      disabled={unblockingId === block.id}
                      onClick={() => void handleUnblock(block.id)}
                      className="min-h-9 shrink-0 font-sans text-[10px] tracking-[0.08em] text-stone-500 underline decoration-stone-300 underline-offset-4 transition-colors hover:text-stone-800 disabled:opacity-40"
                    >
                      {unblockingId === block.id ? '处理中' : '解除屏蔽'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {wechatStatus?.configured && (
            <div className="border-t border-stone-200 pt-6">
              <label className="mb-2 block text-sm font-sans text-stone-700">微信登录</label>
              {wechatStatus.bound ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3">
                  <p className="text-sm font-sans text-emerald-800">已绑定微信</p>
                  {wechatStatus.nickname && (
                    <p className="mt-1 text-xs font-sans text-emerald-700/75">{wechatStatus.nickname}</p>
                  )}
                  <p className="mt-2 text-xs leading-5 text-stone-500">
                    以后可以直接在登录页使用微信进入当前账号。
                  </p>
                </div>
              ) : (
                <div>
                  <p className="mb-3 text-xs leading-5 text-stone-500">
                    绑定后，微信登录仍会进入当前账号，铜币、VIP 和历史记录不会变化。
                  </p>
                  <a
                    href="/api/auth/wechat/start?mode=bind&next=/profile"
                    className="inline-flex rounded-lg border border-[#07C160]/35 bg-[#07C160]/5 px-4 py-2.5 font-sans text-sm text-[#087f3f] transition-colors hover:bg-[#07C160]/10"
                  >
                    绑定微信
                  </a>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-sans text-stone-700 mb-2">邀请码</label>
            <p className="text-xs text-stone-500 font-sans mb-2">
              他人注册时填写你的邀请码，你可获得 200 铜币
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-4 py-3 bg-stone-50 border border-stone-200 rounded-lg font-mono text-stone-800">
                {inviteCode || '—'}
              </div>
              <button
                type="button"
                onClick={handleGenerateInviteCode}
                disabled={genLoading}
                className="px-4 py-3 border border-stone-300 font-sans text-sm rounded-lg hover:bg-stone-50 disabled:opacity-60 text-stone-700"
              >
                {genLoading ? '生成中…' : inviteCode ? '重新生成' : '生成邀请码'}
              </button>
            </div>
          </div>

          {(isLifetimeVip(vipExpiresAt) || (vipExpiresAt && new Date(vipExpiresAt).getTime() > Date.now())) ? (
            <div>
              <label className="block text-sm font-sans text-stone-700 mb-2">会员状态</label>
              <p className="text-lg font-sans text-stone-800 tabular-nums">
                {isLifetimeVip(vipExpiresAt)
                  ? '终身VIP'
                  : (() => {
                      const now = new Date();
                      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                      const exp = new Date(vipExpiresAt!).getTime();
                      const days = Math.ceil((exp - startOfToday.getTime()) / 86400000);
                      return days > 0 ? `${days}天 VIP` : 'VIP';
                    })()}
              </p>
              <p className="text-xs text-stone-500 mt-1">VIP 使用任意功能不消耗铜币</p>
              {!isLifetimeVip(vipExpiresAt) && (
                <Link href="/shop" className="mt-3 inline-block text-sm font-sans text-stone-600 hover:text-stone-800 underline">
                  开通终身 VIP
                </Link>
              )}
            </div>
          ) : (
            coins !== null && (
              <div>
                <label className="block text-sm font-sans text-stone-700 mb-2">铜币余额</label>
                <p className="text-lg font-sans text-stone-800 tabular-nums">{coins} 铜币</p>
                <p className="text-xs text-stone-500 mt-1 mb-3">
                  决行藏每问 2 枚（深度思考 +2，宗师 +20，联网 +2）。也可开通终身 VIP，之后不再消耗铜币。
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent('open-get-coins'))}
                    className="text-sm font-sans text-stone-600 hover:text-stone-800 underline"
                  >
                    获取铜币
                  </button>
                  <Link href="/shop" className="text-sm font-sans text-stone-600 hover:text-stone-800 underline">
                    开通终身 VIP
                  </Link>
                </div>
              </div>
            )
          )}

          {/* 管理员入口 */}
          {isAdmin && (
            <div className="pt-6 border-t border-stone-200 space-y-4">
              <label className="block text-sm font-sans text-stone-700 mb-3">管理员功能</label>
              <Link
                href="/admin/news"
                className="block w-full px-4 py-3 bg-stone-800 text-white text-center font-sans text-sm rounded-lg hover:bg-stone-700 transition-colors"
              >
                发布新闻
              </Link>
              <Link
                href="/admin/community"
                className="block w-full rounded-lg border border-stone-300 px-4 py-3 text-center font-sans text-sm text-stone-700 transition-colors hover:bg-stone-50"
              >
                内容管理
              </Link>
              <div className="pt-4 border-t border-stone-100">
                <p className="text-sm font-sans text-stone-700 mb-2">设置用户为 VIP</p>
                <div className="flex flex-col gap-2">
                  <input
                    type="email"
                    value={vipTargetEmail}
                    onChange={(e) => setVipTargetEmail(e.target.value)}
                    placeholder="目标用户邮箱"
                    className="w-full px-4 py-2 border border-stone-300 rounded-lg text-stone-800 font-sans text-sm focus:outline-none focus:border-stone-600"
                  />
                  <select
                    value={vipDuration}
                    onChange={(e) => setVipDuration(e.target.value as '1m' | '3m' | '6m' | '1y' | 'lifetime')}
                    className="w-full px-4 py-2 border border-stone-300 rounded-lg text-stone-800 font-sans text-sm focus:outline-none focus:border-stone-600"
                  >
                    <option value="1m">1 个月</option>
                    <option value="3m">3 个月</option>
                    <option value="6m">6 个月</option>
                    <option value="1y">1 年</option>
                    <option value="lifetime">终身</option>
                  </select>
                  <button
                    type="button"
                    disabled={vipSubmitting || !vipTargetEmail.trim()}
                    onClick={async () => {
                      setVipMessage(null);
                      setVipSubmitting(true);
                      try {
                        const res = await fetch('/api/admin/set-vip', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          credentials: 'include',
                          body: JSON.stringify({ target_email: vipTargetEmail.trim(), duration: vipDuration }),
                        });
                        const data = await res.json();
                        if (res.ok) {
                          setVipMessage((data as { message?: string }).message ?? '设置成功');
                          setVipTargetEmail('');
                        } else {
                          setVipMessage((data as { error?: string }).error ?? '设置失败');
                        }
                      } catch {
                        setVipMessage('网络错误');
                      } finally {
                        setVipSubmitting(false);
                      }
                    }}
                    className="px-4 py-2 bg-stone-700 text-white font-sans text-sm rounded-lg hover:bg-stone-600 disabled:opacity-60"
                  >
                    {vipSubmitting ? '提交中…' : '设为 VIP'}
                  </button>
                </div>
                {vipMessage && (
                  <p className={`text-sm font-sans mt-2 ${vipMessage.startsWith('已') ? 'text-green-700' : 'text-red-700'}`}>
                    {vipMessage}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
