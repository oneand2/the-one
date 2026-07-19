'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { DailyFortuneCard } from '@/components/DailyFortuneCard';
import { BaziSheetCard } from '@/components/BaziSheetCard';
import type { TabType } from '@/types/tabs';
import {
  getDailyHexagramPeriod,
  getHexagramByIndex,
  type DailyHexagramEntry,
} from '@/utils/dailyHexagram';

const KAITI = '"Kaiti SC", KaiTi, STKaiti, "华文楷体", "楷体", Georgia, serif';

interface GuanXinViewProps {
  onNavigate: (tab: TabType) => void;
}

const SectionLabel: React.FC<{ children: React.ReactNode; side?: string }> = ({ children, side }) => (
  <div className="mb-4 mt-9 flex items-center gap-3 first:mt-0">
    <span className="font-sans text-[10px] tracking-[0.34em] text-stone-400">{children}</span>
    {side && <span className="font-sans text-[10px] tabular-nums tracking-[0.18em] text-stone-300">{side}</span>}
    <span className="h-px flex-1 bg-stone-200/80" />
  </div>
);

const DailyHexagramGlyph: React.FC<{ code: string; name: string }> = ({ code, name }) => {
  const lines = code.length === 6 ? code.split('') : ['0', '0', '0', '0', '0', '0'];

  return (
    <svg
      viewBox="0 0 96 120"
      role="img"
      aria-label={`${name}卦象`}
      className="h-[60px] w-[50px] text-stone-700 sm:h-[76px] sm:w-[64px]"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{`${name}卦象`}</title>
      {lines.map((line, index) => {
        const y = 18 + index * 15;
        return line === '1' ? (
          <rect key={`${index}-${line}`} x="18" y={y} width="60" height="6" rx="1" />
        ) : (
          <g key={`${index}-${line}`}>
            <rect x="18" y={y} width="25" height="6" rx="1" />
            <rect x="53" y={y} width="25" height="6" rx="1" />
          </g>
        );
      })}
    </svg>
  );
};

type DrawState = 'loading' | 'ready' | 'drawing' | 'drawn' | 'error';

const DAILY_HEXAGRAM_LOGIN_URL = `/login?next=${encodeURIComponent('/?tab=guanxin')}`;

const UnrevealedHexagram: React.FC<{ drawing: boolean }> = ({ drawing }) => (
  <div className="flex h-[52px] w-[72px] flex-col justify-center gap-1 sm:h-[82px] sm:gap-[7px]" aria-hidden>
    {[0, 1, 2, 3, 4, 5].map((line) => (
      <motion.span
        key={line}
        className="mx-auto block h-[3px] w-12 origin-center rounded-[1px] bg-stone-600"
        animate={drawing
          ? { opacity: [0.35, 0.9, 0.45], scaleX: [0.42, 1, 0.58] }
          : { opacity: 0.32, scaleX: line % 2 === 0 ? 0.72 : 0.48 }}
        transition={drawing
          ? {
              duration: 0.72,
              delay: line * 0.07,
              repeat: Infinity,
              ease: [0.32, 0.72, 0, 1],
            }
          : { duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
      />
    ))}
  </div>
);

const DailyHexagramDraw: React.FC<{ todayText: string }> = ({ todayText }) => {
  const router = useRouter();
  const [drawState, setDrawState] = useState<DrawState>('loading');
  const [periodKey, setPeriodKey] = useState(() => getDailyHexagramPeriod());
  const [hexagram, setHexagram] = useState<DailyHexagramEntry | null>(null);

  const loadDraw = useCallback(async () => {
    const currentPeriod = getDailyHexagramPeriod();
    setPeriodKey(currentPeriod);
    setDrawState('loading');

    try {
      const response = await fetch('/api/daily-hexagram', { credentials: 'include', cache: 'no-store' });
      if (response.status === 401) {
        setHexagram(null);
        setDrawState('ready');
        return;
      }
      if (!response.ok) throw new Error('LOAD_FAILED');

      const payload = await response.json() as { draw?: { hexagramIndex?: number } | null };
      const accountHexagram = payload.draw?.hexagramIndex
        ? getHexagramByIndex(payload.draw.hexagramIndex)
        : null;
      setHexagram(accountHexagram);
      setDrawState(accountHexagram ? 'drawn' : 'ready');
    } catch {
      setDrawState('error');
    }
  }, []);

  useEffect(() => {
    void loadDraw();
  }, [loadDraw]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (getDailyHexagramPeriod() !== periodKey) void loadDraw();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [loadDraw, periodKey]);

  const handleDraw = async () => {
    if (drawState !== 'ready') return;
    setDrawState('drawing');
    const revealAt = Date.now() + 1450;
    let index: number | null = null;

    try {
      const response = await fetch('/api/daily-hexagram', {
        method: 'POST',
        credentials: 'include',
      });
      if (response.status === 401) {
        router.replace(DAILY_HEXAGRAM_LOGIN_URL);
        return;
      }
      if (!response.ok) throw new Error('DRAW_FAILED');

      const payload = await response.json() as { draw?: { hexagramIndex?: number } | null };
      index = payload.draw?.hexagramIndex ?? null;
      if (!index) throw new Error('EMPTY_DRAW');

      const wait = revealAt - Date.now();
      if (wait > 0) await new Promise((resolve) => window.setTimeout(resolve, wait));

      const result = getHexagramByIndex(index);
      if (!result) throw new Error('INVALID_DRAW');
      setHexagram(result);
      setDrawState('drawn');
    } catch {
      setDrawState('error');
    }
  };

  return (
    <section className="mb-10 flex items-stretch gap-4 sm:gap-5" aria-live="polite">
      <span className="w-px flex-shrink-0 bg-gradient-to-b from-stone-300/80 via-stone-300/50 to-transparent" />
      <div className="relative min-w-0 flex-1 pt-0.5">
        <AnimatePresence initial={false} mode="popLayout">
          {drawState === 'loading' ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="flex min-h-[156px] items-center justify-center"
            >
              <span className="font-sans text-[10px] tracking-[0.28em] text-stone-300">静 候 天 时</span>
            </motion.div>
          ) : drawState === 'error' ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
              className="flex min-h-[156px] flex-col items-center justify-center gap-3 text-center"
            >
              <p className="text-[13px] tracking-[0.06em] text-stone-500" style={{ fontFamily: KAITI }}>
                暂时无法读取今日之卦
              </p>
              <button
                type="button"
                onClick={() => void loadDraw()}
                className="font-sans text-[10px] tracking-[0.18em] text-stone-500 underline decoration-stone-300 underline-offset-4 transition-colors hover:text-stone-800"
              >
                重新尝试
              </button>
            </motion.div>
          ) : hexagram && drawState === 'drawn' ? (
            <motion.div
              key={`result-${periodKey}`}
              initial={{ opacity: 0, y: 14, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.75, ease: [0.32, 0.72, 0, 1] }}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-2.5 whitespace-nowrap">
                  <span className="font-sans text-[10px] tracking-[0.34em] text-stone-400">今 日 之 卦</span>
                  <span className="h-px w-3 bg-stone-300/70" aria-hidden />
                  <span className="font-sans text-[10px] tracking-[0.22em] text-stone-500">{hexagram.name}</span>
                  <span className="font-sans text-[9px] tabular-nums tracking-[0.16em] text-stone-300">
                    {String(hexagram.index).padStart(2, '0')}
                  </span>
                </div>
                <span className="flex-shrink-0 font-sans text-[9px] tabular-nums tracking-[0.18em] text-stone-400 sm:text-[10px]">
                  {todayText}
                </span>
              </div>

              <h2
                className="mt-3 text-[21px] leading-[1.55] tracking-[0.1em] text-stone-800 sm:text-[23px]"
                style={{ fontFamily: KAITI }}
              >
                {hexagram.slogan}
              </h2>

              <div className="mt-4 grid grid-cols-[52px_minmax(0,1fr)] items-center gap-4 sm:mt-5 sm:grid-cols-[64px_minmax(0,1fr)] sm:gap-5">
                <div className="flex justify-center">
                  <DailyHexagramGlyph code={hexagram.code} name={hexagram.name} />
                </div>
                <p
                  className="border-l border-stone-200/80 py-0.5 pl-4 text-[13px] leading-[1.9] tracking-[0.025em] text-stone-500 sm:pl-5"
                  style={{ fontFamily: KAITI }}
                >
                  {hexagram.translation}
                </p>
              </div>
              <p className="mt-3 text-right font-sans text-[9px] tracking-[0.2em] text-stone-300">
                此卦留至下个卯时
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="draw"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
            >
              <div className="flex items-center justify-between gap-4">
                <span className="font-sans text-[10px] tracking-[0.34em] text-stone-400">每 日 一 卦</span>
                <span className="font-sans text-[9px] tabular-nums tracking-[0.18em] text-stone-400 sm:text-[10px]">
                  {todayText}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-1 items-center gap-3 sm:mt-5 sm:grid-cols-[minmax(0,1fr)_88px] sm:gap-5">
                <div className="min-w-0">
                  <h2
                    className="text-[22px] leading-[1.5] tracking-[0.1em] text-stone-800 sm:text-[24px]"
                    style={{ fontFamily: KAITI }}
                  >
                    抽取每日一卦
                  </h2>
                  <p className="mt-2 text-[13px] leading-7 tracking-[0.04em] text-stone-500" style={{ fontFamily: KAITI }}>
                    静心一息，聆听上天的指引。
                  </p>
                </div>
                <div className="flex justify-start border-t border-stone-200/70 pt-2 sm:justify-end sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
                  <UnrevealedHexagram drawing={drawState === 'drawing'} />
                </div>
              </div>

              <div className="mt-5 flex flex-col items-start gap-3 border-t border-stone-200/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={handleDraw}
                  disabled={drawState === 'drawing'}
                  className="min-h-11 rounded-full bg-[#3d3935] px-6 py-2.5 font-sans text-[12px] tracking-[0.2em] text-[#f7f3ec] transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-stone-700 active:scale-[0.98] disabled:cursor-wait disabled:bg-stone-500"
                >
                  {drawState === 'drawing' ? '正在成卦…' : '抽取今日一卦'}
                </button>
                <span className="font-sans text-[9px] tracking-[0.18em] text-stone-300">一日一卦 · 卯时更新</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
};

export const GuanXinView: React.FC<GuanXinViewProps> = ({ onNavigate }) => {
  const today = useMemo(() => {
    const t = new Date();
    return { year: t.getFullYear(), month: t.getMonth() + 1, day: t.getDate() };
  }, []);
  const todayText = `${today.year}.${String(today.month).padStart(2, '0')}.${String(today.day).padStart(2, '0')}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3 }}
      className="w-full"
    >
      <DailyHexagramDraw todayText={todayText} />

      <SectionLabel side={todayText}>今 日 能 量</SectionLabel>
      <DailyFortuneCard year={today.year} month={today.month} day={today.day} />

      <SectionLabel>命 盘 排 演</SectionLabel>
      <motion.div
        id="bazi-sheet"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.08 }}
        className="scroll-mt-6"
      >
        <BaziSheetCard />
      </motion.div>

      <SectionLabel>心 智 图 谱</SectionLabel>
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.15 }}
        className="relative overflow-hidden rounded-lg border border-stone-200/80 bg-[#fbf9f4] p-5 shadow-sm"
      >
        <div className="absolute inset-x-5 top-0 h-px bg-stone-300/70" />
        <div className="mb-4 flex items-baseline gap-2">
          <h3 className="text-[17px] leading-none tracking-[0.1em] text-stone-900" style={{ fontFamily: KAITI }}>
            荣格八维
          </h3>
          <span className="font-sans text-[9px] uppercase tracking-[0.28em] text-stone-400">COGNITIVE</span>
        </div>
        <p className="font-sans text-[11px] tracking-[0.16em] text-stone-400">认知功能 · 心智图谱</p>

        <div className="my-4 grid grid-cols-8 gap-px border-y border-stone-200/80 py-2.5">
          {['Ni', 'Ne', 'Si', 'Se', 'Ti', 'Te', 'Fi', 'Fe'].map((item) => (
            <div key={item} className="text-center font-sans text-[11px] tracking-[0.06em] text-stone-500">
              {item}
            </div>
          ))}
        </div>

        <p className="text-[12.5px] leading-7 text-stone-600" style={{ fontFamily: KAITI }}>
          从八个认知功能开始，观察你如何感知、判断、行动与回避。
        </p>

        <button
          type="button"
          onClick={() => onNavigate('mbti')}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-[#3d3935] px-4 py-3 font-sans text-[13px] tracking-[0.14em] text-[#f7f3ec] shadow-sm transition-colors duration-200 hover:bg-stone-700 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400"
        >
          开始测试
          <ArrowRight className="h-4 w-4" strokeWidth={1.7} aria-hidden />
        </button>
      </motion.section>

      <div className="pb-20" />
    </motion.div>
  );
};
