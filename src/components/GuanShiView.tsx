'use client';

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { LunarCalendarCard } from '@/components/LunarCalendarCard';
import { ZiwuLiuzhuClock } from '@/components/ZiwuLiuzhuClock';
import { DateSegmentSelect } from '@/components/DateSegmentSelect';
import { DailyInsightsView } from '@/components/DailyInsightsView';

/** 今日见闻开栏年份，日期选择器下限 */
const INSIGHTS_START_YEAR = 2026;

const getDaysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * 见天地：日期 → 黄历 → 子午流注 → 今日见闻
 * 新闻板块已下线，代码保留在 WorldNewsView.tsx，取得资质后可恢复。
 */
export const GuanShiView: React.FC = () => {
  const today = useMemo(() => {
    const t = new Date();
    return { year: t.getFullYear(), month: t.getMonth() + 1, day: t.getDate() };
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>(
    () => `${today.year}-${pad(today.month)}-${pad(today.day)}`
  );

  const parts = useMemo(() => {
    const [year, month, day] = selectedDate.split('-').map(Number);
    return { year, month, day };
  }, [selectedDate]);

  const allYears = useMemo(() => {
    const span = Math.max(1, today.year - INSIGHTS_START_YEAR + 1);
    return Array.from({ length: span }, (_, i) => INSIGHTS_START_YEAR + i).reverse();
  }, [today.year]);

  // 不允许选到未来：今年只到当前月，当月只到今天
  const availableMonths = useMemo(() => {
    const maxMonth = parts.year === today.year ? today.month : 12;
    return Array.from({ length: maxMonth }, (_, i) => i + 1).reverse();
  }, [parts.year, today]);

  const availableDays = useMemo(() => {
    const maxDay =
      parts.year === today.year && parts.month === today.month
        ? today.day
        : getDaysInMonth(parts.year, parts.month);
    return Array.from({ length: maxDay }, (_, i) => i + 1).reverse();
  }, [parts, today]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3 }}
      className="w-full"
    >
      {/* 三段式日期选择器 */}
      <div className="mb-10">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-4">
            <span className="text-xs font-sans text-stone-400 uppercase tracking-wider">选择日期</span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <DateSegmentSelect
              label="年"
              value={parts.year}
              options={allYears}
              onChange={(year) => {
                const maxMonth = year === today.year ? today.month : 12;
                const month = Math.min(parts.month, maxMonth);
                const maxDay =
                  year === today.year && month === today.month
                    ? today.day
                    : getDaysInMonth(year, month);
                setSelectedDate(`${year}-${pad(month)}-${pad(Math.min(parts.day, maxDay))}`);
              }}
            />
            <DateSegmentSelect
              label="月"
              value={parts.month}
              options={availableMonths}
              onChange={(month) => {
                const maxDay =
                  parts.year === today.year && month === today.month
                    ? today.day
                    : getDaysInMonth(parts.year, month);
                setSelectedDate(`${parts.year}-${pad(month)}-${pad(Math.min(parts.day, maxDay))}`);
              }}
            />
            <DateSegmentSelect
              label="日"
              value={parts.day}
              options={availableDays}
              onChange={(day) => {
                setSelectedDate(`${parts.year}-${pad(parts.month)}-${pad(day)}`);
              }}
            />
          </div>
        </div>
      </div>

      {/* 万年历黄历卡片 */}
      <LunarCalendarCard year={parts.year} month={parts.month} day={parts.day} />

      {/* 子午流注钟 */}
      <ZiwuLiuzhuClock />

      {/* 今日见闻 */}
      <div className="mb-4 mt-9 flex items-center gap-3">
        <span className="font-sans text-[10px] tracking-[0.34em] text-stone-400">今日见闻</span>
        <span className="h-px flex-1 bg-stone-200/80" />
      </div>

      <DailyInsightsView date={selectedDate} />

      {/* 声明 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="mt-8 mb-2"
      >
        <div className="flex items-start gap-2 text-[11px] leading-relaxed">
          <span className="text-stone-400/50 flex-shrink-0">|</span>
          <p className="text-stone-500/70 font-sans tracking-wide">
            <span className="text-stone-600/60">声明</span>
            <span className="text-stone-400/50 mx-1.5">·</span>
            见闻为历史与文化资料的整理，力求准确，如有出入欢迎指正。黄历与子午流注属传统文化内容，不构成医疗建议。
          </p>
        </div>
      </motion.div>

      <div className="pb-20 md:pb-10" />
    </motion.div>
  );
};
