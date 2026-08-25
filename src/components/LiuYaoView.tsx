'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { tossOnce, getYaoInfo, type YaoInfo } from '@/utils/liuyaoLogic';
import { analyzeHexagram, type HexagramAnalysis } from '@/utils/iching-logic';
import type { ImportData } from '@/types/import-data';
import { clearCached, CACHE_KEYS } from '@/utils/cache';
import { homeHref, syncAppTab } from '@/utils/iosEmbed';

export interface LiuYaoViewProps {
  onNavigateToJuexingcang?: () => void;
  embedded?: boolean;
  externalQuestion?: string;
  onInterpret?: (importData: ImportData, question: string) => void;
  onCancel?: () => void;
}

export const LiuYaoView: React.FC<LiuYaoViewProps> = ({
  onNavigateToJuexingcang,
  embedded = false,
  externalQuestion,
  onInterpret,
  onCancel,
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [question, setQuestion] = useState<string>(embedded && externalQuestion ? externalQuestion : '');
  const [isQuestionSet, setIsQuestionSet] = useState<boolean>(embedded && !!externalQuestion);
  const [yaos, setYaos] = useState<YaoInfo[]>([]);
  const [isTossing, setIsTossing] = useState(false);
  const [hexagramAnalysis, setHexagramAnalysis] = useState<HexagramAnalysis | null>(null);
  const reduceMotion = useReducedMotion();
  const castRunRef = useRef(0);
  
  const pendingImportKey = 'juexingcang-import-pending';
  const inputPresetKey = 'juexingcang-input-preset';
  const presetQuestion = searchParams.get('question');

  // URL 有 question 时始终同步到输入框（如从见天地「占问今日休咎」跳转过来），保证自动填入
  useEffect(() => {
    if (embedded || !presetQuestion) return;

    const syncTimer = window.setTimeout(() => setQuestion(presetQuestion), 0);
    return () => window.clearTimeout(syncTimer);
  }, [embedded, presetQuestion]);

  // 用户确认问题后，六次铜钱结果立即一次性生成并固定；前端只负责逐爻揭示。
  // 这样动画帧率、暂停或页面重绘都不会改变最终卦象。
  useEffect(() => {
    const castQuestion = question.trim();
    if (!isQuestionSet || !castQuestion) return;

    const runID = ++castRunRef.current;
    const completedCast = Array.from({ length: 6 }, () => getYaoInfo(tossOnce()));
    let cancelled = false;

    const reveal = async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
      if (cancelled || castRunRef.current !== runID) return;
      setYaos([]);
      setHexagramAnalysis(null);
      setIsTossing(true);

      if (reduceMotion) {
        setYaos(completedCast);
        setHexagramAnalysis(analyzeHexagram(completedCast.map((yao) => yao.value)));
        setIsTossing(false);
        return;
      }

      await new Promise((resolve) => window.setTimeout(resolve, 260));
      for (let count = 1; count <= completedCast.length; count += 1) {
        if (cancelled || castRunRef.current !== runID) return;
        setYaos(completedCast.slice(0, count));
        if (count < completedCast.length) {
          await new Promise((resolve) => window.setTimeout(resolve, 390));
        }
      }
      await new Promise((resolve) => window.setTimeout(resolve, 360));
      if (!cancelled && castRunRef.current === runID) {
        setHexagramAnalysis(analyzeHexagram(completedCast.map((yao) => yao.value)));
        setIsTossing(false);
      }
    };

    void reveal();
    return () => {
      cancelled = true;
    };
  }, [isQuestionSet, question, reduceMotion]);

  // 确认问题
  const handleConfirmQuestion = () => {
    if (question.trim()) {
      setIsQuestionSet(true);
    }
  };

  const handleDivine = () => {
    const liuyaoData: ImportData = {
      liuyao: [{
        type: 'liuyao',
        question,
        yaos: yaos.map((yao, index) => ({
          position: index,
          name: yao.name,
          value: yao.value,
          isChanging: yao.isChanging,
        })),
        mainHexagram: {
          title: hexagramAnalysis?.mainHexagram?.title || '',
          description: hexagramAnalysis?.mainHexagram?.description || '',
        },
        transformedHexagram: hexagramAnalysis?.transformedHexagram
          ? {
              title: hexagramAnalysis.transformedHexagram.title,
              description: hexagramAnalysis.transformedHexagram.description,
            }
          : undefined,
        hasMovingLines: hexagramAnalysis?.hasMovingLines ?? false,
        movingLineTexts: hexagramAnalysis?.movingLineTexts ?? [],
        interpretation: hexagramAnalysis?.interpretation
          ? {
              title: hexagramAnalysis.interpretation.title,
              texts: hexagramAnalysis.interpretation.texts,
              type: hexagramAnalysis.interpretation.type,
            }
          : undefined,
      }],
    };

    const hexagramInfo = {
      mainHexagram: hexagramAnalysis?.mainHexagram?.title || '',
      transformedHexagram: hexagramAnalysis?.transformedHexagram?.title || '',
      mainDescription: hexagramAnalysis?.mainHexagram?.description || '',
      transformedDescription: hexagramAnalysis?.transformedHexagram?.description || '',
      hasMovingLines: hexagramAnalysis?.hasMovingLines ?? false,
      movingLineTexts: hexagramAnalysis?.movingLineTexts ?? [],
      interpretation: hexagramAnalysis?.interpretation
        ? {
            title: hexagramAnalysis.interpretation.title,
            texts: hexagramAnalysis.interpretation.texts,
            type: hexagramAnalysis.interpretation.type,
          }
        : undefined,
      yaos: yaos.map((yao, index) => ({
        position: index,
        name: yao.name,
        value: yao.value,
        isChanging: yao.isChanging,
      })),
    };

    const saveRecord = async () => {
      try {
        const response = await fetch('/api/records/liuyao', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            question,
            date: new Date().toLocaleString('zh-CN'),
            hexagram_info: hexagramInfo,
            ai_result: '',
          }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          console.warn('保存六爻记录失败:', data?.error || response.statusText);
        } else {
          clearCached(CACHE_KEYS.RECORDS_LIUYAO);
        }
      } catch (error) {
        console.warn('保存六爻记录失败:', error);
      }
    };

    void saveRecord();

    if (embedded && onInterpret) {
      onInterpret(liuyaoData, question);
      return;
    }

    try {
      localStorage.setItem(pendingImportKey, JSON.stringify(liuyaoData));
      localStorage.setItem(inputPresetKey, '请帮我解卦');
    } catch (error) {
      console.warn('写入导入缓存失败:', error);
    }

    if (onNavigateToJuexingcang) {
      onNavigateToJuexingcang();
    } else {
      syncAppTab('juexingcang');
      router.push(homeHref('juexingcang'));
    }
  };

  // 获取爻的符号样式 - 使用 SVG 确保跨浏览器兼容
  const getYaoSymbol = (yao: YaoInfo) => {
    if (yao.value === 7 || yao.value === 9) {
      // 阳爻 —— 使用 SVG 渲染一条完整的线
      return (
        <svg
          viewBox="0 0 112 6"
          className="h-[6px] w-28"
          style={{ width: '112px', height: '6px' }}
          preserveAspectRatio="none"
        >
          <rect
            x="0"
            y="0"
            width="112"
            height="6"
            fill="#44403c"
            rx="1.5"
          />
        </svg>
      );
    } else {
      // 阴爻 - - 使用 SVG 渲染两条断开的线
      return (
        <svg
          viewBox="0 0 112 6"
          className="h-[6px] w-28"
          style={{ width: '112px', height: '6px' }}
          preserveAspectRatio="none"
        >
          <rect
            x="0"
            y="0"
            width="52"
            height="6"
            fill="#44403c"
            rx="1.5"
          />
          <rect
            x="60"
            y="0"
            width="52"
            height="6"
            fill="#44403c"
            rx="1.5"
          />
        </svg>
      );
    }
  };

  return (
    <div className={embedded ? "flex w-full flex-col items-center" : "min-h-screen flex items-center justify-center pt-28 mobile-content-bottom"}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: [0.32, 0.72, 0, 1] }}
        className="w-full space-y-8"
      >
        {/* 嵌入模式取消按钮 */}
        {embedded && onCancel && (
          <motion.button
            onClick={onCancel}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-2 flex min-h-11 items-center gap-1.5 self-start font-sans text-[11px] tracking-[0.12em] text-stone-400 transition-colors hover:text-stone-700"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            取消起卦
          </motion.button>
        )}

        {/* Phase 1: 输入问题阶段 */}
        {!isQuestionSet ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mx-auto flex w-full max-w-md flex-col items-center space-y-8"
          >
            <div className="w-full border-l border-stone-300/70 pl-5">
              <p className="mb-3 font-sans text-[9px] tracking-[0.28em] text-stone-400">所 问 之 事</p>
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && question.trim()) {
                    handleConfirmQuestion();
                  }
                }}
                placeholder="写下此刻最想问清的事"
                className="w-full border-0 border-b border-stone-300 bg-transparent py-3 text-left text-[16px] tracking-[0.04em] text-stone-700 outline-none transition-colors duration-500 focus:border-stone-600"
              />
            </div>

            <motion.button
              onClick={handleConfirmQuestion}
              disabled={!question.trim()}
              className="min-h-11 rounded-full bg-[#3d3935] px-7 py-2.5 font-sans text-[12px] tracking-[0.2em] text-[#f7f3ec] transition-colors duration-500 hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-40"
              whileTap={{ scale: 0.98 }}
            >
              起卦
            </motion.button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.32, 0.72, 0, 1] }}
            className="mx-auto w-full max-w-md border-l border-stone-300/70 pl-5"
          >
            <p className="font-sans text-[9px] tracking-[0.28em] text-stone-400">所 问</p>
            <p className="mt-2 text-[15px] leading-7 tracking-[0.06em] text-stone-700" style={{ fontFamily: '"Kaiti SC", KaiTi, STKaiti, serif' }}>
              {question}
            </p>
          </motion.div>
        )}

        <AnimatePresence>
          {isQuestionSet && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
              className="relative z-10 mx-auto w-full max-w-md space-y-7"
            >
              <div className="flex items-center justify-between border-y border-stone-200/70 py-3">
                <span className="font-sans text-[9px] tracking-[0.3em] text-stone-400">六 爻 成 象</span>
                <span className="font-sans text-[9px] tabular-nums tracking-[0.18em] text-stone-400" aria-live="polite">
                  {hexagramAnalysis ? '卦象已定' : `正在成卦 · ${yaos.length}/6`}
                </span>
              </div>

              <div className="flex min-h-[230px] w-full flex-col items-center justify-center py-4" aria-label={`六爻已显现 ${yaos.length} 爻`}>
                <div className="flex flex-col gap-[15px]">
                  {[5, 4, 3, 2, 1, 0].map((position) => {
                    const yao = yaos[position];
                    const positionName = position === 0 ? '初爻' : position === 5 ? '上爻' : `${['', '二', '三', '四', '五'][position]}爻`;
                    return (
                      <div key={position} className="grid grid-cols-[42px_112px_54px] items-center gap-3">
                        <span className={`text-right font-sans text-[9px] tracking-[0.12em] transition-colors duration-500 ${yao ? 'text-stone-400' : 'text-stone-300/50'}`}>
                          {positionName}
                        </span>
                        <div className="flex h-3 w-28 items-center justify-center">
                          {yao ? (
                            <motion.div
                              key={`${position}-${yao.value}`}
                              initial={{ opacity: 0, scaleX: 0.3, filter: 'blur(3px)' }}
                              animate={{ opacity: 1, scaleX: 1, filter: 'blur(0px)' }}
                              transition={{ duration: 0.58, ease: [0.32, 0.72, 0, 1] }}
                              className="origin-center"
                            >
                              {getYaoSymbol(yao)}
                            </motion.div>
                          ) : (
                            <motion.span
                              className="block h-[4px] w-24 origin-center rounded-[1px] bg-stone-300/60"
                              animate={isTossing
                                ? { opacity: [0.18, 0.48, 0.22], scaleX: [0.48, 0.86, 0.56] }
                                : { opacity: 0.18, scaleX: 0.52 }}
                              transition={isTossing
                                ? { duration: 0.82, delay: position * 0.055, repeat: Infinity, ease: [0.32, 0.72, 0, 1] }
                                : { duration: 0.4 }}
                            />
                          )}
                        </div>
                        <span className="flex items-center gap-1.5 font-sans text-[10px] tracking-[0.08em] text-stone-500">
                          {yao?.name ?? ''}
                          {yao?.isChanging && (
                            <span className="text-[11px] text-[#a66f69]" aria-label="变爻">{yao.value === 9 ? '○' : '×'}</span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-5 font-sans text-[9px] tracking-[0.18em] text-stone-300">自下而上 · 初爻至上爻</p>
              </div>

              {/* 变爻提示 */}
              {yaos.length === 6 && yaos.some(y => y.isChanging) && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-center space-y-2"
                >
                  <div className="text-xs text-[#666666] font-sans">
                    此卦有变爻
                  </div>
                  <div className="text-xs text-[#999999] font-sans">
                    ○ 表示老阳（阳极生阴）· × 表示老阴（阴极生阳）
                  </div>
                </motion.div>
              )}

              {/* 解卦结果 */}
              {yaos.length === 6 && hexagramAnalysis && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, ease: [0.32, 0.72, 0, 1] }}
                  className="space-y-8 border-t border-stone-200/70 pt-8"
                >
                  {/* 本卦与变卦 */}
                  {hexagramAnalysis.mainHexagram && (
                    <div className="flex items-center justify-center gap-6">
                      {/* 本卦 */}
                      <div className="text-center">
                        <p className="text-xs text-[#999999] font-sans mb-2">本卦</p>
                        <p className="text-lg text-[#333333] font-serif">
                          {hexagramAnalysis.mainHexagram.title}
                        </p>
                      </div>

                      {/* 箭头 */}
                      {hexagramAnalysis.hasMovingLines && hexagramAnalysis.transformedHexagram && (
                        <>
                          <div className="text-[#999999]">→</div>
                          
                          {/* 变卦 */}
                          <div className="text-center">
                            <p className="text-xs text-[#999999] font-sans mb-2">变卦</p>
                            <p className="text-lg text-[#333333] font-serif">
                              {hexagramAnalysis.transformedHexagram.title}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* 解卦依据（按动爻规则） */}
                  {hexagramAnalysis.interpretation && (
                    <div className="max-w-md mx-auto space-y-4">
                      <p className="text-xs text-[#999999] font-sans text-center mb-2">
                        {hexagramAnalysis.interpretation.title}
                      </p>

                      {hexagramAnalysis.interpretation.type === 'yaoci' ? (
                        <div className="space-y-4">
                          {hexagramAnalysis.interpretation.texts.map((text, index) => (
                            <motion.div
                              key={`${text}-${index}`}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 1 + index * 0.2 }}
                              className="p-4 border-l-2 border-stone-700"
                            >
                              <p className="text-sm text-[#333333] font-serif font-medium">
                                {text}
                              </p>
                            </motion.div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center space-y-3">
                          {hexagramAnalysis.interpretation.texts.map((text, index) => (
                            <p
                              key={`${text}-${index}`}
                              className="text-sm text-[#666666] font-serif leading-relaxed"
                            >
                              {text}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 决行藏解卦入口：父级 onClick 兜底，避免 motion/transform 导致按钮有时收不到点击 */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25, duration: 0.5 }}
                    className="mt-10 flex cursor-pointer flex-col items-center gap-3"
                    onClick={handleDivine}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleDivine();
                      }
                    }}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDivine();
                      }}
                      className="min-h-11 w-full max-w-sm cursor-pointer rounded-full bg-[#3d3935] px-7 py-3 font-sans text-[12px] tracking-[0.2em] text-[#f7f3ec] transition-colors duration-500 hover:bg-stone-700"
                    >
                      {embedded ? '请解此卦' : '循此卦象，继续问答'}
                    </button>
                    {!embedded && <p className="pointer-events-none font-sans text-[10px] tracking-[0.08em] text-stone-400">进入决行藏继续解卦</p>}
                  </motion.div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {!embedded && (
          <p className="text-center text-xs text-stone-400 font-sans py-6">
            注：卦象是一面古老的镜子，仅供文化阅读与自我观照；现实选择仍应立足事实，由你独立作答。
          </p>
        )}
      </motion.div>

    </div>
  );
};
