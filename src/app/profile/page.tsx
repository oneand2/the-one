'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

export default function ProfilePage() {
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [coins, setCoins] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace('/login?next=/profile');
        return;
      }
      fetch('/api/user/profile', { credentials: 'include' })
        .then((r) => {
          if (!r.ok) {
            if (r.status === 401) {
              router.replace('/login?next=/profile');
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
        })
        .catch((e) => setError(e instanceof Error ? e.message : '加载失败'))
        .finally(() => setLoading(false));
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

          {coins !== null && (
            <div>
              <label className="block text-sm font-sans text-stone-700 mb-2">铜币余额</label>
              <p className="text-lg font-sans text-stone-800 tabular-nums">{coins} 铜币</p>
              <p className="text-xs text-stone-500 mt-1 mb-3">
                六爻 AI 解卦 6 枚/次，六济每问 5 枚（深度思考 +2，联网 +3）
              </p>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('open-get-coins'))}
                className="text-sm font-sans text-stone-600 hover:text-stone-800 underline"
              >
                获取铜币
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
