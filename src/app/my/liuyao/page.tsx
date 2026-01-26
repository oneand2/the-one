'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';

type ListItem = { id: string; question: string; date: string; created_at: string };
type DetailRecord = { id: string; question: string; hexagram_info: Record<string, unknown>; date: string; ai_result: string; created_at: string };

function MyLiuyaoContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const [list, setList] = useState<ListItem[]>([]);
  const [detail, setDetail] = useState<DetailRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetch(`/api/records/liuyao?id=${encodeURIComponent(id)}`, { credentials: 'include' })
        .then(async (r) => {
          if (!r.ok) {
            const b = await r.json().catch(() => ({}));
            if (r.status === 401) throw new Error('请先登录');
            throw new Error((b as { error?: string })?.error || '拉取失败');
          }
          return r.json();
        })
        .then(setDetail)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    } else {
      fetch('/api/records/liuyao', { credentials: 'include' })
        .then(async (r) => {
          if (!r.ok) {
            const b = await r.json().catch(() => ({}));
            if (r.status === 401) throw new Error('请先登录');
            if (r.status >= 500) throw new Error('拉取失败，请确认数据库 daoyoushuju 表中包含 input_data (jsonb) 字段');
            throw new Error((b as { error?: string })?.error || '拉取失败');
          }
          return r.json();
        })
        .then(setList)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }
  }, [id]);

  // 详情页
  if (id) {
    return (
      <div className="min-h-screen bg-[#FBF9F4] px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <Link href="/my/liuyao" className="text-sm text-stone-500 hover:text-stone-800 font-sans inline-block mb-6">
            ← 返回六爻解卦记录
          </Link>
          {loading && <div className="py-12 text-center text-stone-500 font-sans">加载中…</div>}
          {error && (
            <div className="py-6 px-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm font-sans">
              {error}
              {error.includes('请先登录') && (
                <Link href="/login?next=/my/liuyao" className="block mt-2 font-medium underline">去登录 →</Link>
              )}
            </div>
          )}
          {!loading && !error && detail && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/80 rounded-xl border border-stone-200 p-6 md:p-8 shadow-sm"
            >
              <div className="mb-6">
                <span className="text-xs text-stone-400 font-sans">
                  {new Date(detail.created_at).toLocaleString('zh-CN')}
                  {detail.date ? ` · ${detail.date}` : ''}
                </span>
              </div>
              {detail.question && (
                <div className="mb-6">
                  <h3 className="text-xs text-stone-500 font-sans uppercase tracking-wider mb-2">所问</h3>
                  <p className="text-stone-800 font-sans leading-relaxed">{detail.question}</p>
                </div>
              )}
              {detail.hexagram_info && typeof detail.hexagram_info === 'object' && (
                <div className="mb-6 pb-6 border-b border-stone-100">
                  <h3 className="text-xs text-stone-500 font-sans uppercase tracking-wider mb-2">卦象</h3>
                  <p className="text-stone-600 font-sans text-sm">
                    {[
                      (detail.hexagram_info as Record<string, string>).mainHexagram,
                      (detail.hexagram_info as Record<string, string>).transformedHexagram,
                    ].filter(Boolean).join(' → ')}
                  </p>
                </div>
              )}
              <div>
                <h3 className="text-xs text-stone-500 font-sans uppercase tracking-wider mb-2">解卦详析</h3>
                <div className="text-stone-700 font-sans text-sm leading-relaxed whitespace-pre-wrap">
                  {detail.ai_result || '（无解卦内容）'}
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    );
  }

  // 列表页
  return (
    <div className="min-h-screen bg-[#FBF9F4] px-4 py-12">
      <div className="max-w-lg mx-auto">
        <Link href="/" className="text-sm text-stone-500 hover:text-stone-800 font-sans inline-block mb-8">
          ← 返回首页
        </Link>
        <h1 className="text-2xl font-serif text-stone-800 mb-2">我的六爻解卦</h1>
        <p className="text-sm text-stone-500 font-sans mb-8">
          仅保存已进行 AI 解卦的记录，点击可查看当时的问题与解卦内容
        </p>

        {loading && <div className="py-12 text-center text-stone-500 font-sans">加载中…</div>}
        {error && (
          <div className="py-6 px-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm font-sans space-y-3">
            <p>{error}</p>
            {error.includes('请先登录') && (
              <Link href="/login?next=/my/liuyao" className="inline-block font-medium underline">去登录 →</Link>
            )}
          </div>
        )}
        {!loading && !error && list.length === 0 && (
          <div className="py-12 text-center text-stone-500 font-sans">
            暂无六爻解卦记录，在「六爻占卜」中起卦并完成 AI 解卦后会自动保存
          </div>
        )}
        {!loading && !error && list.length > 0 && (
          <ul className="space-y-3">
            {list.map((item, i) => (
              <motion.li
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Link
                  href={`/my/liuyao?id=${encodeURIComponent(item.id)}`}
                  className="block px-4 py-4 bg-white/70 border border-stone-200 rounded-xl hover:border-stone-300 hover:shadow-sm transition-all font-sans text-left"
                >
                  <p className="text-stone-800 line-clamp-2 mb-1">
                    {item.question || '（未填写问题）'}
                  </p>
                  <span className="text-stone-400 text-xs">
                    {item.date || new Date(item.created_at).toLocaleString('zh-CN')}
                  </span>
                </Link>
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function MyLiuyaoPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FBF9F4] flex items-center justify-center"><div className="text-stone-500 font-sans">加载中…</div></div>}>
      <MyLiuyaoContent />
    </Suspense>
  );
}
