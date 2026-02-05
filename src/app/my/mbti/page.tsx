'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { getCached, setCached, CACHE_KEYS, RECORDS_TTL_MS } from '@/utils/cache';

export const dynamic = 'force-dynamic';

type RecordItem = {
  id: string;
  type: string;
  function_scores: Record<string, number>;
  created_at: string;
};

/** API 可能返回已展开的 type/function_scores，或原始行的 input_data，统一归一为 RecordItem */
function normalizeMbtiItem(row: { id: string; type?: string; function_scores?: Record<string, number>; input_data?: { type?: string; function_scores?: Record<string, number> }; created_at: string }): RecordItem {
  const d = row.input_data && typeof row.input_data === 'object' ? row.input_data : {};
  return {
    id: row.id,
    type: row.type ?? d.type ?? '',
    function_scores: row.function_scores ?? d.function_scores ?? {},
    created_at: row.created_at,
  };
}

export default function MyMbtiPage() {
  const [list, setList] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cached = getCached<unknown[]>(CACHE_KEYS.RECORDS_MBTI);
    if (cached && Array.isArray(cached)) {
      setList(cached.map((row: { id: string; type?: string; function_scores?: Record<string, number>; input_data?: { type?: string; function_scores?: Record<string, number> }; created_at: string }) => normalizeMbtiItem(row)));
      setLoading(false);
    }
    fetch('/api/records/mbti', { credentials: 'include' })
      .then(async (r) => {
        if (r.ok) return r.json();
        const body = await r.json().catch(() => ({}));
        const msg = body?.error || '';
        if (r.status === 401) throw new Error('请先登录');
        if (r.status >= 500) throw new Error('拉取失败，请确认数据库 daoyoushuju 表中包含 input_data (jsonb) 字段');
        throw new Error(msg || '拉取失败');
      })
      .then((data) => {
        const normalized = Array.isArray(data) ? data.map(normalizeMbtiItem) : data;
        setList(normalized);
        if (Array.isArray(data)) setCached(CACHE_KEYS.RECORDS_MBTI, data, RECORDS_TTL_MS);
        return normalized;
      })
      .catch((e) => {
        setError(e.message);
        if (!cached) setList([]);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#FBF9F4] px-4 py-12">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Link
            href="/"
            className="text-sm text-stone-500 hover:text-stone-800 font-sans"
          >
            ← 返回首页
          </Link>
        </div>
        <h1 className="text-2xl font-serif text-stone-800 mb-2">我的八维结果</h1>
        <p className="text-sm text-stone-500 font-sans mb-8">
          点击某条记录可查看该次八维测试的完整报告
        </p>

        {loading && (
          <div className="py-12 text-center text-stone-500 font-sans">加载中…</div>
        )}
        {error && (
          <div className="py-6 px-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm font-sans space-y-3">
            <p>{error}</p>
            {error.includes('请先登录') && (
              <Link href="/login?next=/my/mbti" className="inline-block text-stone-800 font-medium underline">
                去登录 →
              </Link>
            )}
            {error.includes('daoyoushuju') && (
              <p className="text-xs text-stone-500 pt-2">
                后端使用 <code className="bg-stone-200 px-1 rounded">daoyoushuju</code> 表，通过 <code className="bg-stone-200 px-1 rounded">type</code> 区分古典排盘（classical_bazi）与八维结果（mbti），详情存入 <code className="bg-stone-200 px-1 rounded">input_data</code>（JSONB）。
              </p>
            )}
          </div>
        )}
        {!loading && !error && list.length === 0 && (
          <div className="py-12 text-center text-stone-500 font-sans">
            暂无八维测试记录，在「八维」中完成测试后点击「保存结果」即可在此查看
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
                  href={`/report/mbti?id=${encodeURIComponent(item.id)}`}
                  className="block px-4 py-4 bg-white/70 border border-stone-200 rounded-xl hover:border-stone-300 hover:shadow-sm transition-all font-sans"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-stone-800 font-mono font-semibold tracking-wider">
                      {item.type}
                    </span>
                    <span className="text-stone-400 text-xs">
                      {new Date(item.created_at).toLocaleDateString('zh-CN')}
                    </span>
                  </div>
                </Link>
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
