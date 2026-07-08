'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { DailyFortuneCard } from '@/components/DailyFortuneCard';
import { BaziSheetCard } from '@/components/BaziSheetCard';
import type { TabType } from '@/types/tabs';
import { getDailyHexagram } from '@/utils/dailyHexagram';

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

export const GuanXinView: React.FC<GuanXinViewProps> = ({ onNavigate }) => {
  const today = useMemo(() => {
    const t = new Date();
    return { year: t.getFullYear(), month: t.getMonth() + 1, day: t.getDate() };
  }, []);
  const todayText = `${today.year}.${String(today.month).padStart(2, '0')}.${String(today.day).padStart(2, '0')}`;
  const dailyHexagram = useMemo(
    () => getDailyHexagram(today.year, today.month, today.day),
    [today.year, today.month, today.day],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3 }}
      className="w-full"
    >
      <section className="mb-8 flex items-stretch gap-4">
        <span className="w-px flex-shrink-0 bg-gradient-to-b from-stone-300/80 via-stone-300/50 to-transparent" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5">
                <span className="font-sans text-[10px] tracking-[0.34em] text-stone-400">每 日 一 卦</span>
                <span className="h-px w-3 bg-stone-300/70" aria-hidden />
                <span className="font-sans text-[10px] tracking-[0.22em] text-stone-500">{dailyHexagram.name}</span>
                <span className="font-sans text-[9px] tabular-nums tracking-[0.16em] text-stone-300">
                  {String(dailyHexagram.index).padStart(2, '0')}
                </span>
              </div>
              <h2
                className="mt-2.5 text-[19px] leading-[1.65] tracking-[0.08em] text-stone-800"
                style={{ fontFamily: KAITI }}
              >
                {dailyHexagram.slogan}
              </h2>
            </div>
            <span className="flex-shrink-0 pt-0.5 font-sans text-[10px] tabular-nums tracking-[0.2em] text-stone-400">
              {todayText}
            </span>
          </div>
          <p className="mt-3.5 text-[12.5px] leading-[1.85] text-stone-500" style={{ fontFamily: KAITI }}>
            {dailyHexagram.translation}
          </p>
        </div>
      </section>

      <SectionLabel side={todayText}>今 日 能 量</SectionLabel>
      <DailyFortuneCard year={today.year} month={today.month} day={today.day} />

      <SectionLabel>命 盘 排 演</SectionLabel>
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.08 }}
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
