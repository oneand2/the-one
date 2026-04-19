'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { getCached, setCached, CACHE_KEYS, RECORDS_TTL_MS, recordsLiuyaoDetailKey } from '@/utils/cache';

const KAITI = '"Kaiti SC", KaiTi, STKaiti, "华文楷体", "楷体", Georgia, serif';

type YaoInfo = { position: number; name: string; value: number; isChanging: boolean };
type InterpretationInfo = { title: string; texts: string[]; type: 'guaci' | 'yaoci' };
type HexagramInfo = {
  mainHexagram?: string;
  transformedHexagram?: string;
  mainDescription?: string;
  transformedDescription?: string;
  hasMovingLines?: boolean;
  movingLineTexts?: string[];
  interpretation?: InterpretationInfo;
  yaos?: YaoInfo[];
};

type ListItem = {
  id: string;
  question: string;
  date: string;
  created_at: string;
  hexagram_info?: HexagramInfo;
};

type DetailRecord = {
  id: string;
  question: string;
  hexagram_info: HexagramInfo;
  date: string;
  ai_result: string;
  created_at: string;
};

function formatDate(created_at: string, date?: string) {
  if (date) return date;
  return new Date(created_at).toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── 六爻卦象小图（用于列表卡片）──────────────────────────────────────────
function MiniHexagramGlyph({ yaos }: { yaos?: YaoInfo[] }) {
  if (!yaos || yaos.length !== 6) return null;
  return (
    <svg viewBox="0 0 28 36" width="20" height="26" aria-hidden>
      {[...yaos].reverse().map((yao, i) => {
        const y = i * 6 + 1;
        const isYang = yao.value === 7 || yao.value === 9;
        const color = yao.isChanging ? '#a39888' : '#44403c';
        return isYang ? (
          <rect key={i} x="0" y={y} width="28" height="3.5" rx="1.5" fill={color} />
        ) : (
          <g key={i}>
            <rect x="0" y={y} width="12" height="3.5" rx="1.5" fill={color} />
            <rect x="16" y={y} width="12" height="3.5" rx="1.5" fill={color} />
          </g>
        );
      })}
    </svg>
  );
}

// ─── 详情页六爻卦象图 ───────────────────────────────────────────────────────
function HexagramDiagram({ yaos }: { yaos?: YaoInfo[] }) {
  if (!yaos || yaos.length !== 6) return null;
  const YAO_NAMES = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'];
  return (
    <div className="flex flex-col gap-[10px] items-center">
      {[...yaos].reverse().map((yao, revIdx) => {
        const origIdx = 5 - revIdx;
        const isYang = yao.value === 7 || yao.value === 9;
        const lineColor = yao.isChanging ? '#b0a090' : '#2c2826';
        return (
          <div key={origIdx} className="flex items-center gap-3" style={{ width: 200 }}>
            <span
              className="text-right shrink-0 text-[11px]"
              style={{ fontFamily: KAITI, color: '#c4bdb0', width: 28 }}
            >
              {YAO_NAMES[origIdx]}
            </span>
            <svg viewBox="0 0 112 10" width="112" height="10" aria-hidden className="shrink-0">
              {isYang ? (
                <rect x="0" y="0" width="112" height="10" rx="5" fill={lineColor} />
              ) : (
                <>
                  <rect x="0" y="0" width="52" height="10" rx="5" fill={lineColor} />
                  <rect x="60" y="0" width="52" height="10" rx="5" fill={lineColor} />
                </>
              )}
            </svg>
            <div className="shrink-0 w-4 flex items-center justify-center">
              {yao.isChanging && (
                yao.value === 9 ? (
                  <svg viewBox="0 0 10 10" width="9" height="9">
                    <circle cx="5" cy="5" r="4" fill="none" stroke="#a39888" strokeWidth="1.5" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 10 10" width="9" height="9">
                    <line x1="1" y1="1" x2="9" y2="9" stroke="#a39888" strokeWidth="1.5" strokeLinecap="round" />
                    <line x1="9" y1="1" x2="1" y2="9" stroke="#a39888" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                )
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── 分隔线 ────────────────────────────────────────────────────────────────
function Divider() {
  return <div className="w-full h-px" style={{ background: 'rgba(0,0,0,0.06)' }} />;
}

// ─── 区块标签 ──────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="font-sans mb-3"
      style={{ fontSize: 10, color: '#c4bdb0', letterSpacing: '0.20em' }}
    >
      {children}
    </p>
  );
}

// ─── 主内容组件 ────────────────────────────────────────────────────────────
function MyLiuyaoContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const [list, setList] = useState<ListItem[]>([]);
  const [detail, setDetail] = useState<DetailRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const redirectToLogin = () => {
    const base = pathname || '/my/liuyao';
    const next = base + (typeof window !== 'undefined' && window.location.search ? window.location.search : '');
    router.replace(`/login?next=${encodeURIComponent(next)}`);
  };

  useEffect(() => {
    if (id) {
      const detailKey = recordsLiuyaoDetailKey(id);
      const cached = getCached<DetailRecord>(detailKey);
      if (cached) {
        setDetail(cached);
        setLoading(false);
      }
      fetch(`/api/records/liuyao?id=${encodeURIComponent(id)}`, { credentials: 'include' })
        .then(async (r) => {
          if (!r.ok) {
            const b = await r.json().catch(() => ({}));
            if (r.status === 401) throw new Error('请先登录');
            throw new Error((b as { error?: string })?.error || '拉取失败');
          }
          return r.json();
        })
        .then((data) => {
          setDetail(data);
          setCached(detailKey, data, RECORDS_TTL_MS);
        })
        .catch((e) => {
          if (e.message === '请先登录') { redirectToLogin(); return; }
          setError(e.message);
          if (!cached) setDetail(null);
        })
        .finally(() => setLoading(false));
    } else {
      const cached = getCached<ListItem[]>(CACHE_KEYS.RECORDS_LIUYAO);
      if (cached && Array.isArray(cached)) {
        setList(cached);
        setLoading(false);
      }
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
        .then((data) => {
          setList(data);
          setCached(CACHE_KEYS.RECORDS_LIUYAO, data, RECORDS_TTL_MS);
        })
        .catch((e) => {
          if (e.message === '请先登录') { redirectToLogin(); return; }
          setError(e.message);
          if (!cached) setList([]);
        })
        .finally(() => setLoading(false));
    }
  }, [id]);

  // ══════ 详情页 ══════
  if (id) {
    return (
      <div className="min-h-screen px-4 py-10 md:py-16" style={{ background: '#faf8f4' }}>
        <div className="max-w-xl mx-auto">

          {/* 返回 */}
          <Link
            href="/my/liuyao"
            className="inline-flex items-center gap-1.5 mb-10 transition-colors"
            style={{ fontSize: 12, color: '#c4bdb0', letterSpacing: '0.06em', fontFamily: 'system-ui, sans-serif' }}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
            </svg>
            周易解卦记录
          </Link>

          {loading && (
            <div className="py-16 text-center" style={{ color: '#c4bdb0', fontFamily: 'system-ui', fontSize: 13 }}>
              卜卦中…
            </div>
          )}

          {error && (
            <div
              className="py-5 px-5 rounded-xl text-sm"
              style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontFamily: 'system-ui' }}
            >
              {error}
              {error.includes('请先登录') && (
                <Link href="/login?next=/my/liuyao" className="block mt-2 font-medium underline">去登录 →</Link>
              )}
            </div>
          )}

          {!loading && !error && detail && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: [0.25, 0.1, 0.25, 1] }}
              className="overflow-hidden rounded-2xl"
              style={{
                background: '#fdfcf9',
                border: '1px solid rgba(0,0,0,0.07)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}
            >

              {/* ── 头部：时间 ── */}
              <div className="px-6 pt-6 pb-4">
                <p
                  className="font-sans tabular-nums"
                  style={{ fontSize: 11, color: '#c4bdb0', letterSpacing: '0.06em' }}
                >
                  {formatDate(detail.created_at, detail.date)}
                </p>
              </div>

              <Divider />

              {/* ── 所问 ── */}
              {detail.question && (
                <>
                  <div className="px-6 py-5">
                    <SectionLabel>所 问</SectionLabel>
                    <p
                      className="leading-relaxed"
                      style={{ fontFamily: KAITI, fontSize: 16, color: '#1e1c18' }}
                    >
                      {detail.question}
                    </p>
                  </div>
                  <Divider />
                </>
              )}

              {/* ── 卦象 ── */}
              {detail.hexagram_info && (
                <>
                  <div className="px-6 py-6">
                    <SectionLabel>卦 象</SectionLabel>

                    <div className="flex items-start gap-8">
                      {/* 左：卦爻图 */}
                      <div className="shrink-0 pt-1">
                        <HexagramDiagram yaos={detail.hexagram_info.yaos} />
                      </div>

                      {/* 右：卦名 + 变卦 */}
                      <div className="flex-1 space-y-4 pt-1">
                        {/* 本卦 */}
                        <div>
                          <p
                            className="font-sans mb-1"
                            style={{ fontSize: 10, color: '#c4bdb0', letterSpacing: '0.16em' }}
                          >
                            本 卦
                          </p>
                          <p style={{ fontFamily: KAITI, fontSize: 20, color: '#1e1c18', lineHeight: 1.2 }}>
                            {detail.hexagram_info.mainHexagram || '—'}
                          </p>
                          {detail.hexagram_info.mainDescription && (
                            <p
                              className="mt-1.5 leading-relaxed"
                              style={{ fontFamily: KAITI, fontSize: 12, color: '#8a8078' }}
                            >
                              {detail.hexagram_info.mainDescription}
                            </p>
                          )}
                        </div>

                        {/* 变卦 */}
                        {detail.hexagram_info.transformedHexagram && (
                          <div>
                            <p
                              className="font-sans mb-1"
                              style={{ fontSize: 10, color: '#c4bdb0', letterSpacing: '0.16em' }}
                            >
                              变 卦
                            </p>
                            <p style={{ fontFamily: KAITI, fontSize: 20, color: '#6a635a', lineHeight: 1.2 }}>
                              {detail.hexagram_info.transformedHexagram}
                            </p>
                            {detail.hexagram_info.transformedDescription && (
                              <p
                                className="mt-1.5 leading-relaxed"
                                style={{ fontFamily: KAITI, fontSize: 12, color: '#a39888' }}
                              >
                                {detail.hexagram_info.transformedDescription}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 变爻标注 */}
                    {detail.hexagram_info.yaos?.some(y => y.isChanging) && (
                      <div className="mt-5">
                        <p
                          className="font-sans mb-2"
                          style={{ fontSize: 10, color: '#c4bdb0', letterSpacing: '0.16em' }}
                        >
                          变 爻
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {detail.hexagram_info.yaos!.filter(y => y.isChanging).map(y => (
                            <span
                              key={y.position}
                              className="inline-flex items-center gap-1"
                              style={{
                                padding: '3px 10px',
                                borderRadius: 4,
                                background: 'rgba(0,0,0,0.04)',
                                border: '1px solid rgba(0,0,0,0.07)',
                                fontFamily: KAITI,
                                fontSize: 13,
                                color: '#6a635a',
                              }}
                            >
                              {y.name}
                              <span style={{ fontSize: 11, color: '#a39888', marginLeft: 2 }}>
                                {y.value === 9 ? '○' : '×'}
                              </span>
                            </span>
                          ))}
                        </div>
                        <p
                          className="mt-2 font-sans"
                          style={{ fontSize: 10, color: '#c4bdb0' }}
                        >
                          ○ 老阳（阳极生阴）· × 老阴（阴极生阳）
                        </p>
                      </div>
                    )}
                  </div>
                  <Divider />
                </>
              )}

              {/* ── 解卦依据 ── */}
              {detail.hexagram_info?.interpretation && (
                <>
                  <div className="px-6 py-5">
                    <SectionLabel>解卦依据</SectionLabel>
                    <p
                      className="font-sans mb-4"
                      style={{ fontSize: 11, color: '#a39888', letterSpacing: '0.04em' }}
                    >
                      {detail.hexagram_info.interpretation.title}
                    </p>
                    {detail.hexagram_info.interpretation.type === 'yaoci' ? (
                      <div className="space-y-3">
                        {detail.hexagram_info.interpretation.texts.map((text, i) => (
                          <div
                            key={i}
                            className="pl-4"
                            style={{ borderLeft: '2px solid rgba(0,0,0,0.10)' }}
                          >
                            <p
                              className="leading-relaxed"
                              style={{ fontFamily: KAITI, fontSize: 13.5, color: '#3a3530' }}
                            >
                              {text}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {detail.hexagram_info.interpretation.texts.map((text, i) => (
                          <p
                            key={i}
                            className="leading-relaxed"
                            style={{ fontFamily: KAITI, fontSize: 13.5, color: '#5a534c' }}
                          >
                            {text}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                  <Divider />
                </>
              )}

              {/* ── 解卦详析 ── */}
              <div className="px-6 py-6">
                <SectionLabel>解卦详析</SectionLabel>
                <div
                  className="leading-[1.9] whitespace-pre-wrap"
                  style={{ fontFamily: KAITI, fontSize: 14, color: '#3a3530' }}
                >
                  {detail.ai_result || (
                    <span style={{ color: '#c4bdb0', fontFamily: 'system-ui', fontSize: 13 }}>暂无解卦内容</span>
                  )}
                </div>
              </div>

            </motion.div>
          )}
        </div>
      </div>
    );
  }

  // ══════ 列表页 ══════
  return (
    <div className="min-h-screen px-4 py-10 md:py-16" style={{ background: '#faf8f4' }}>
      <div className="max-w-lg mx-auto">

        {/* 返回首页 */}
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
            className="mb-1"
            style={{ fontFamily: KAITI, fontSize: 26, color: '#1e1c18', fontWeight: 400, letterSpacing: '0.02em' }}
          >
            我的周易解卦
          </h1>
          <p
            className="font-sans"
            style={{ fontSize: 12, color: '#c4bdb0', letterSpacing: '0.10em' }}
          >
            历次起卦记录 · 点击查看详情
          </p>
          <div className="mt-4 h-px" style={{ background: 'rgba(0,0,0,0.06)' }} />
        </div>

        {/* 加载态 */}
        {loading && (
          <div className="py-16 text-center" style={{ color: '#c4bdb0', fontFamily: 'system-ui', fontSize: 13 }}>
            卜卦中…
          </div>
        )}

        {/* 错误态 */}
        {error && (
          <div
            className="py-5 px-5 rounded-xl text-sm"
            style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontFamily: 'system-ui' }}
          >
            <p>{error}</p>
            {error.includes('请先登录') && (
              <Link href="/login?next=/my/liuyao" className="inline-block mt-2 font-medium underline">去登录 →</Link>
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
            <span style={{ fontSize: 11 }}>在「六爻占卜」中起卦后将自动保存</span>
          </div>
        )}

        {/* 列表 */}
        {!loading && !error && list.length > 0 && (
          <ul className="space-y-2.5">
            {list.map((item, i) => (
              <motion.li
                key={item.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
              >
                <Link
                  href={`/my/liuyao?id=${encodeURIComponent(item.id)}`}
                  className="group flex items-center gap-4 px-5 py-4 rounded-xl transition-all"
                  style={{
                    background: '#fdfcf9',
                    border: '1px solid rgba(0,0,0,0.07)',
                  }}
                >
                  {/* 卦象小图 */}
                  <div
                    className="shrink-0 flex items-center justify-center rounded-lg"
                    style={{
                      width: 40,
                      height: 48,
                      background: 'rgba(0,0,0,0.025)',
                      border: '1px solid rgba(0,0,0,0.05)',
                    }}
                  >
                    <MiniHexagramGlyph yaos={item.hexagram_info?.yaos} />
                  </div>

                  {/* 文字 */}
                  <div className="flex-1 min-w-0">
                    {/* 卦名 */}
                    {item.hexagram_info?.mainHexagram && (
                      <p
                        className="mb-1 font-sans"
                        style={{ fontSize: 10, color: '#a39888', letterSpacing: '0.12em' }}
                      >
                        {item.hexagram_info.mainHexagram}
                        {item.hexagram_info.transformedHexagram ? ` → ${item.hexagram_info.transformedHexagram}` : ''}
                      </p>
                    )}
                    {/* 问题 */}
                    <p
                      className="line-clamp-2 leading-snug"
                      style={{ fontFamily: KAITI, fontSize: 15, color: '#2c2826' }}
                    >
                      {item.question || '（未填写问题）'}
                    </p>
                    {/* 时间 */}
                    <p
                      className="mt-1.5 font-sans tabular-nums"
                      style={{ fontSize: 10, color: '#c4bdb0' }}
                    >
                      {formatDate(item.created_at, item.date)}
                    </p>
                  </div>

                  {/* 箭头 */}
                  <svg
                    className="shrink-0 opacity-25 group-hover:opacity-50 transition-opacity"
                    width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#44403c" strokeWidth="1.5"
                    strokeLinecap="round" strokeLinejoin="round"
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
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
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ background: '#faf8f4' }}>
          <div style={{ color: '#c4bdb0', fontFamily: 'system-ui', fontSize: 13 }}>卜卦中…</div>
        </div>
      }
    >
      <MyLiuyaoContent />
    </Suspense>
  );
}
