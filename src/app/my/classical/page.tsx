'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { getCached, setCached, clearCached, CACHE_KEYS, RECORDS_TTL_MS } from '@/utils/cache';
import { requestAppLogin } from '@/utils/iosEmbed';

export const dynamic = 'force-dynamic';

const KAITI = '"Kaiti SC", KaiTi, STKaiti, "华文楷体", "楷体", Georgia, serif';

type RecordItem = { id: string; params: Record<string, string>; created_at: string };
type ClassicalRow = { id: string; params?: Record<string, string>; input_data?: { params?: Record<string, string> }; created_at: string };

function normalizeClassicalItem(row: ClassicalRow): RecordItem {
  const params = row.params ?? (row.input_data && typeof row.input_data === 'object' ? (row.input_data.params as Record<string, string>) ?? {} : {});
  return { id: row.id, params: params || {}, created_at: row.created_at };
}

// ─── 五行色 ────────────────────────────────────────────────────────────────
const WUXING_COLOR: Record<string, string> = {
  庚: '#B09F73', 辛: '#B09F73', 申: '#B09F73', 酉: '#B09F73',
  甲: '#7a9b85', 乙: '#7a9b85', 寅: '#7a9b85', 卯: '#7a9b85',
  壬: '#6b7c97', 癸: '#6b7c97', 子: '#6b7c97', 亥: '#6b7c97',
  丙: '#ba6e65', 丁: '#ba6e65', 巳: '#ba6e65', 午: '#ba6e65',
  戊: '#8B5F45', 己: '#8B5F45', 辰: '#8B5F45', 戌: '#8B5F45', 丑: '#8B5F45', 未: '#8B5F45',
};
const wc = (c: string) => WUXING_COLOR[c] || '#3a3530';

// ─── 四柱组件 ──────────────────────────────────────────────────────────────
function FourPillars({ gans, zhis }: { gans: string[]; zhis: string[] }) {
  const PILLAR_NAMES = ['年', '月', '日', '时'];
  return (
    <div className="flex items-end gap-3">
      {PILLAR_NAMES.map((name, idx) => (
        <div key={idx} className="flex flex-col items-center gap-1">
          <span
            style={{
              fontFamily: KAITI,
              fontSize: 20,
              color: wc(gans[idx] ?? ''),
              lineHeight: 1,
              fontWeight: 400,
            }}
          >
            {gans[idx] ?? '—'}
          </span>
          <span
            style={{
              fontFamily: KAITI,
              fontSize: 20,
              color: wc(zhis[idx] ?? ''),
              lineHeight: 1,
              fontWeight: 400,
            }}
          >
            {zhis[idx] ?? '—'}
          </span>
          <span
            style={{
              fontFamily: 'system-ui, sans-serif',
              fontSize: 9,
              color: '#c4bdb0',
              letterSpacing: '0.06em',
              lineHeight: 1,
              marginTop: 2,
            }}
          >
            {name}柱
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── 确认删除按钮 ──────────────────────────────────────────────────────────
function DeleteButton({ onConfirm, deleting }: { onConfirm: () => void; deleting: boolean }) {
  const [confirming, setConfirming] = useState(false);

  if (deleting) {
    return (
      <div style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c4bdb0" strokeWidth="2">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
      </div>
    );
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1.5" onClick={(e) => e.preventDefault()}>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onConfirm(); setConfirming(false); }}
          style={{
            padding: '2px 8px',
            background: '#3a3530',
            color: '#fdfcf9',
            borderRadius: 4,
            fontSize: 11,
            fontFamily: 'system-ui',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          确认
        </button>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirming(false); }}
          style={{
            padding: '2px 8px',
            background: 'transparent',
            color: '#a39888',
            borderRadius: 4,
            fontSize: 11,
            fontFamily: 'system-ui',
            border: '1px solid rgba(0,0,0,0.10)',
            cursor: 'pointer',
          }}
        >
          取消
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirming(true); }}
      title="删除记录"
      style={{
        width: 28,
        height: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 6,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: '#d4c9bc',
        transition: 'color 0.15s',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#8a6f5e'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#d4c9bc'; }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
        <path d="M10 11v6M14 11v6" />
        <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
      </svg>
    </button>
  );
}

// ─── 主页面 ────────────────────────────────────────────────────────────────
export default function MyClassicalPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [list, setList] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const cached = getCached<ClassicalRow[]>(CACHE_KEYS.RECORDS_CLASSICAL);
    if (cached && Array.isArray(cached)) {
      setList(cached.map(normalizeClassicalItem));
      setLoading(false);
    }
    fetch('/api/records/classical', { credentials: 'include' })
      .then(async (r) => {
        if (r.ok) return r.json();
        const body = await r.json().catch(() => ({}));
        const msg = (body as { error?: string })?.error || '';
        if (r.status === 401) throw new Error('请先登录');
        if (r.status >= 500) throw new Error('拉取失败，请确认数据库 daoyoushuju 表中包含 input_data (jsonb) 字段');
        throw new Error(msg || '拉取失败');
      })
      .then((data) => {
        const normalized = Array.isArray(data) ? data.map(normalizeClassicalItem) : data as RecordItem[];
        setList(normalized);
        if (Array.isArray(data)) setCached(CACHE_KEYS.RECORDS_CLASSICAL, data, RECORDS_TTL_MS);
      })
      .catch((e: Error) => {
        if (e.message === '请先登录') {
          if (!requestAppLogin()) {
            router.replace(`/login?next=${encodeURIComponent(pathname || '/my/classical')}`);
          }
          return;
        }
        setError(e.message);
        if (!cached) setList([]);
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/records/classical?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string })?.error || '删除失败');
      }
      setList((prev) => prev.filter((item) => item.id !== id));
      clearCached(CACHE_KEYS.RECORDS_CLASSICAL);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '删除失败，请重试');
    } finally {
      setDeletingId(null);
    }
  };

  const toQuery = (params: Record<string, string>) => new URLSearchParams(params).toString();

  return (
    <div className="min-h-screen px-4 py-10 md:py-16" style={{ background: '#faf8f4' }}>
      <div className="max-w-2xl mx-auto">

        {/* 返回 */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 mb-10 transition-colors"
          style={{ fontSize: 12, color: '#c4bdb0', letterSpacing: '0.06em', fontFamily: 'system-ui, sans-serif' }}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
          </svg>
          返回首页
        </Link>

        {/* 页头 */}
        <div className="mb-8">
          <h1
            style={{ fontFamily: KAITI, fontSize: 26, color: '#1e1c18', fontWeight: 400, letterSpacing: '0.02em' }}
            className="mb-1"
          >
            我的古典排盘
          </h1>
          <p
            className="font-sans"
            style={{ fontSize: 12, color: '#c4bdb0', letterSpacing: '0.10em' }}
          >
            历次排盘记录 · 点击再次查看报告
          </p>
          <div className="mt-4 h-px" style={{ background: 'rgba(0,0,0,0.06)' }} />
        </div>

        {/* 加载 */}
        {loading && (
          <div className="py-16 text-center" style={{ color: '#c4bdb0', fontFamily: 'system-ui', fontSize: 13 }}>
            排盘中…
          </div>
        )}

        {/* 错误 */}
        {error && (
          <div
            className="py-5 px-5 rounded-xl text-sm"
            style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontFamily: 'system-ui' }}
          >
            <p>{error}</p>
            {error.includes('请先登录') && (
              <Link href="/login?next=/my/classical" className="inline-block mt-2 font-medium underline">去登录 →</Link>
            )}
          </div>
        )}

        {/* 空态 */}
        {!loading && !error && list.length === 0 && (
          <div
            className="py-16 text-center font-sans"
            style={{ fontSize: 13, color: '#c4bdb0', letterSpacing: '0.04em' }}
          >
            尚无记录
            <br />
            <span style={{ fontSize: 11 }}>完成排盘并点击「保存该八字」后将自动保存</span>
          </div>
        )}

        {/* 列表 */}
        {!loading && !error && list.length > 0 && (
          <ul className="space-y-2.5">
            <AnimatePresence initial={false}>
              {list.map((item, i) => {
                const p = item.params;
                const name = (p.name && String(p.name).trim()) ? String(p.name).trim() : '';
                const gender = p.gender || '';
                const isBaziMode = p.mode === 'bazi' && p.gans && p.zhis;
                const gans = isBaziMode ? (p.gans as string).split(',') : [];
                const zhis = isBaziMode ? (p.zhis as string).split(',') : [];
                const dateStr = (p.year && p.month && p.day)
                  ? `${p.year}年${p.month}月${p.day}日 ${p.hour ?? '?'}:${String(p.minute ?? '00').padStart(2, '0')}`
                  : '';

                return (
                  <motion.li
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
                    transition={{ delay: i * 0.04, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
                  >
                    <div
                      className="group flex items-center gap-3 rounded-xl overflow-hidden"
                      style={{
                        background: '#fdfcf9',
                        border: '1px solid rgba(0,0,0,0.07)',
                      }}
                    >
                      {/* 可点击主体 */}
                      <Link
                        href={`/report/classical?${toQuery(p)}`}
                        className="flex-1 min-w-0 flex items-center justify-between gap-4 px-5 py-4"
                      >
                        {/* 左侧：姓名 + 标签 + 时间 */}
                        <div className="flex flex-col gap-1.5 min-w-0">
                          {name ? (
                            <span style={{ fontFamily: KAITI, fontSize: 17, color: '#1e1c18', lineHeight: 1.2 }}>
                              {name}
                            </span>
                          ) : (
                            <span style={{ fontFamily: KAITI, fontSize: 15, color: '#8a8078', lineHeight: 1.2 }}>
                              {dateStr || '未命名'}
                            </span>
                          )}
                          <div className="flex items-center gap-2 flex-wrap">
                            {gender && (
                              <span
                                style={{
                                  fontFamily: 'system-ui',
                                  fontSize: 10,
                                  color: '#a39888',
                                  padding: '1px 7px',
                                  borderRadius: 3,
                                  background: 'rgba(0,0,0,0.04)',
                                  border: '1px solid rgba(0,0,0,0.06)',
                                  letterSpacing: '0.06em',
                                }}
                              >
                                {gender}
                              </span>
                            )}
                            {name && dateStr && (
                              <span style={{ fontFamily: 'system-ui', fontSize: 11, color: '#c4bdb0' }}>
                                {dateStr}
                                {p.city ? ` · ${p.city}` : ''}
                              </span>
                            )}
                            <span
                              className="font-sans tabular-nums"
                              style={{ fontSize: 10, color: '#d4c9bc' }}
                            >
                              {new Date(item.created_at).toLocaleDateString('zh-CN')}
                            </span>
                          </div>
                        </div>

                        {/* 右侧：四柱 或 生日 */}
                        {isBaziMode && gans.length === 4 && zhis.length === 4 ? (
                          <div className="shrink-0">
                            <FourPillars gans={gans} zhis={zhis} />
                          </div>
                        ) : dateStr && !name ? null : dateStr ? (
                          <div className="shrink-0 text-right">
                            <p style={{ fontFamily: 'system-ui', fontSize: 12, color: '#8a8078' }}>
                              {dateStr}
                            </p>
                            {p.city && (
                              <p style={{ fontFamily: 'system-ui', fontSize: 11, color: '#c4bdb0', marginTop: 2 }}>
                                {p.city}
                              </p>
                            )}
                          </div>
                        ) : null}
                      </Link>

                      {/* 删除按钮区（竖向分隔线 + 按钮） */}
                      <div
                        className="flex items-center pr-3"
                        style={{ borderLeft: '1px solid rgba(0,0,0,0.05)' }}
                      >
                        <DeleteButton
                          onConfirm={() => handleDelete(item.id)}
                          deleting={deletingId === item.id}
                        />
                      </div>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </div>
  );
}
