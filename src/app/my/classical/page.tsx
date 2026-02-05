'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { getCached, setCached, CACHE_KEYS, RECORDS_TTL_MS } from '@/utils/cache';

export const dynamic = 'force-dynamic';

type RecordItem = { id: string; params: Record<string, string>; created_at: string };

/** API 可能返回已展开的 params，或原始行的 input_data，统一归一为 RecordItem */
function normalizeClassicalItem(row: { id: string; params?: Record<string, string>; input_data?: { params?: Record<string, string> }; created_at: string }): RecordItem {
  const params = row.params ?? (row.input_data && typeof row.input_data === 'object' ? (row.input_data.params as Record<string, string>) ?? {} : {});
  return { id: row.id, params: params || {}, created_at: row.created_at };
}

export default function MyClassicalPage() {
  const [list, setList] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cached = getCached<unknown[]>(CACHE_KEYS.RECORDS_CLASSICAL);
    if (cached && Array.isArray(cached)) {
      setList(cached.map((row: { id: string; params?: Record<string, string>; input_data?: { params?: Record<string, string> }; created_at: string }) => normalizeClassicalItem(row)));
      setLoading(false);
    }
    fetch('/api/records/classical', { credentials: 'include' })
      .then(async (r) => {
        if (r.ok) return r.json();
        const body = await r.json().catch(() => ({}));
        const msg = body?.error || '';
        if (r.status === 401) throw new Error('请先登录');
        if (r.status >= 500) throw new Error('拉取失败，请确认数据库 daoyoushuju 表中包含 input_data (jsonb) 字段');
        throw new Error(msg || '拉取失败');
      })
      .then((data) => {
        const normalized = Array.isArray(data) ? data.map(normalizeClassicalItem) : data;
        setList(normalized);
        if (Array.isArray(data)) setCached(CACHE_KEYS.RECORDS_CLASSICAL, data, RECORDS_TTL_MS);
        return normalized;
      })
      .catch((e) => {
        setError(e.message);
        if (!cached) setList([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const toQuery = (params: Record<string, string>) => {
    return new URLSearchParams(params).toString();
  };

  // 获取五行颜色
  const getWuxingColor = (char: string): string => {
    const wuxingMap: Record<string, string> = {
      '庚': '#B09F73', '辛': '#B09F73', '申': '#B09F73', '酉': '#B09F73',
      '甲': '#7a9b85', '乙': '#7a9b85', '寅': '#7a9b85', '卯': '#7a9b85',
      '壬': '#6b7c97', '癸': '#6b7c97', '子': '#6b7c97', '亥': '#6b7c97',
      '丙': '#ba6e65', '丁': '#ba6e65', '巳': '#ba6e65', '午': '#ba6e65',
      '戊': '#8B5F45', '己': '#8B5F45', '辰': '#8B5F45', '戌': '#8B5F45', '丑': '#8B5F45', '未': '#8B5F45'
    };
    return wuxingMap[char] || '#333333';
  };

  const label = (item: RecordItem) => {
    const p = item.params;
    const namePart = (p.name && String(p.name).trim()) ? `${String(p.name).trim()} · ` : '';
    let main = '';
    if (p.mode === 'bazi' && p.gans && p.zhis) {
      main = `${(p.gans as string).replace(/,/g, '')} ${(p.zhis as string).replace(/,/g, '')}`;
    } else if (p.year && p.month && p.day) {
      main = `${p.year}-${p.month}-${p.day} ${p.hour ?? '?'}:${p.minute ?? '00'}`;
    } else {
      main = new Date(item.created_at).toLocaleString('zh-CN');
    }
    return namePart ? namePart + main : main;
  };

  // 获取八字四柱数据
  const getBaziPillars = (item: RecordItem) => {
    const p = item.params;
    if (p.mode === 'bazi' && p.gans && p.zhis) {
      const gans = (p.gans as string).split(',');
      const zhis = (p.zhis as string).split(',');
      return { gans, zhis };
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FBF9F4] via-[#F8F6F0] to-[#FBF9F4] px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-10">
          <Link
            href="/"
            className="text-sm text-stone-500 hover:text-stone-800 font-sans transition-colors duration-200 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            返回首页
          </Link>
        </div>
        
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-serif text-stone-800 mb-3 tracking-wide">我的古典排盘</h1>
          <div className="w-16 h-1 bg-gradient-to-r from-transparent via-stone-300 to-transparent mx-auto mb-4"></div>
          <p className="text-sm text-stone-500 font-sans">
            点击某条记录可再次查看该次排盘报告
          </p>
        </div>

        {loading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-20 text-center"
          >
            <div className="inline-block">
              <div className="w-8 h-8 border-3 border-stone-300 border-t-stone-600 rounded-full animate-spin mb-4"></div>
              <p className="text-stone-500 font-sans text-sm">加载中…</p>
            </div>
          </motion.div>
        )}
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="py-6 px-6 bg-red-50/80 backdrop-blur-sm border border-red-200 rounded-2xl text-red-700 text-sm font-sans space-y-3 shadow-sm"
          >
            <p className="font-medium">{error}</p>
            {error.includes('请先登录') && (
              <Link href="/login?next=/my/classical" className="inline-flex items-center gap-2 text-stone-800 font-medium hover:gap-3 transition-all duration-200">
                去登录
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            )}
            {error.includes('daoyoushuju') && (
              <p className="text-xs text-stone-600 pt-2 leading-relaxed">
                后端使用 <code className="bg-stone-200 px-1.5 py-0.5 rounded">daoyoushuju</code> 表，通过 <code className="bg-stone-200 px-1.5 py-0.5 rounded">type</code> 区分古典排盘（classical_bazi）与八维结果（mbti），详情存入 <code className="bg-stone-200 px-1.5 py-0.5 rounded">input_data</code>（JSONB）。
              </p>
            )}
          </motion.div>
        )}
        {!loading && !error && list.length === 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="py-20 text-center"
          >
            <div className="inline-flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="space-y-2">
                <p className="text-stone-600 font-sans">暂无古典排盘记录</p>
                <p className="text-stone-400 font-sans text-xs max-w-sm">
                  在首页「八字」中完成排盘并打开报告后，点击「保存该八字」即可保存
                </p>
              </div>
              <Link 
                href="/"
                className="mt-4 px-6 py-2.5 bg-stone-800 text-white font-sans text-sm rounded-lg hover:bg-stone-700 transition-colors duration-200"
              >
                去排盘
              </Link>
            </div>
          </motion.div>
        )}
        {!loading && !error && list.length > 0 && (
          <ul className="space-y-4">
            {list.map((item, i) => {
              const pillars = getBaziPillars(item);
              const p = item.params;
              const namePart = (p.name && String(p.name).trim()) ? String(p.name).trim() : '';
              const genderPart = p.gender || '';
              
              return (
                <motion.li
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Link
                    href={`/report/classical?${toQuery(item.params as Record<string, string>)}`}
                    className="block px-5 py-4 bg-gradient-to-br from-white/90 to-stone-50/50 border border-stone-200 rounded-xl hover:border-stone-300 hover:shadow-md transition-all duration-300 group"
                  >
                    {/* 八字四柱 */}
                    {pillars && pillars.gans.length === 4 && pillars.zhis.length === 4 ? (
                      <div className="flex items-center justify-between gap-6">
                        {/* 左侧：姓名信息 */}
                        <div className="flex flex-col gap-2 min-w-[100px]">
                          {namePart && (
                            <span className="text-stone-800 font-serif text-lg font-medium">
                              {namePart}
                            </span>
                          )}
                          <div className="flex items-center gap-2">
                            {genderPart && (
                              <span className="px-2 py-0.5 bg-stone-100 text-stone-600 text-xs font-sans rounded-full">
                                {genderPart}
                              </span>
                            )}
                            <span className="text-stone-400 text-xs font-sans">
                              {new Date(item.created_at).toLocaleDateString('zh-CN')}
                            </span>
                          </div>
                        </div>

                        {/* 右侧：八字四柱 */}
                        <div className="flex items-center gap-3">
                          {['年柱', '月柱', '日柱', '时柱'].map((pillarName, idx) => (
                            <div key={idx} className="flex flex-col items-center">
                              <div className="text-[9px] text-stone-400 font-sans mb-1.5 tracking-wider opacity-60">
                                {pillarName}
                              </div>
                              <div className="flex flex-col items-center gap-1">
                                {/* 天干 */}
                                <span 
                                  className="text-xl font-serif font-medium tracking-wide transition-all duration-200 group-hover:scale-105"
                                  style={{ color: getWuxingColor(pillars.gans[idx]) }}
                                >
                                  {pillars.gans[idx]}
                                </span>
                                
                                {/* 地支 */}
                                <span 
                                  className="text-xl font-serif font-medium tracking-wide transition-all duration-200 group-hover:scale-105"
                                  style={{ color: getWuxingColor(pillars.zhis[idx]) }}
                                >
                                  {pillars.zhis[idx]}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      /* 日期模式显示 */
                      <div className="flex items-center justify-between gap-6">
                        {/* 左侧：姓名信息 */}
                        <div className="flex flex-col gap-2 min-w-[100px]">
                          {namePart && (
                            <span className="text-stone-800 font-serif text-lg font-medium">
                              {namePart}
                            </span>
                          )}
                          <div className="flex items-center gap-2">
                            {genderPart && (
                              <span className="px-2 py-0.5 bg-stone-100 text-stone-600 text-xs font-sans rounded-full">
                                {genderPart}
                              </span>
                            )}
                            <span className="text-stone-400 text-xs font-sans">
                              {new Date(item.created_at).toLocaleDateString('zh-CN')}
                            </span>
                          </div>
                        </div>

                        {/* 右侧：日期信息 */}
                        <div className="text-stone-600 font-sans text-sm">
                          {p.year && p.month && p.day ? (
                            <div className="flex items-center gap-2">
                              <span className="text-base">
                                {p.year}年{p.month}月{p.day}日 {p.hour ?? '?'}:{String(p.minute ?? '00').padStart(2, '0')}
                              </span>
                              {p.city && (
                                <span className="text-stone-400 text-xs">
                                  · {p.city}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-stone-400">
                              {new Date(item.created_at).toLocaleString('zh-CN')}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </Link>
                </motion.li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
