'use client';

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { LunarCalendarCard } from '@/components/LunarCalendarCard';
import { ZiwuLiuzhuClock } from '@/components/ZiwuLiuzhuClock';
import { DateSegmentSelect } from '@/components/DateSegmentSelect';
import { DailyInsightsView } from '@/components/DailyInsightsView';
import { NewsEditionCard } from '@/components/NewsEditionCard';

/** 今日见闻开栏年份，日期选择器下限 */
const INSIGHTS_START_YEAR = 2026;

const getDaysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

const pad = (n: number) => String(n).padStart(2, '0');

function shanghaiYmd(date = new Date()) {
  const [year, month, day] = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date).split('-').map(Number);
  return { year, month, day };
}

/**
 * 见天地：日期 → 黄历 → 子午流注 → 今日见闻（新闻刊期、见闻正文）
 */
export const GuanShiView: React.FC<{ initialDate?: string | null; embedded?: boolean }> = ({ initialDate, embedded }) => {
  const today = useMemo(() => shanghaiYmd(), []);

  const [selectedDate, setSelectedDate] = useState(() => {
    const current = `${today.year}-${pad(today.month)}-${pad(today.day)}`;
    if (!initialDate || !/^\d{4}-\d{2}-\d{2}$/.test(initialDate)
      || initialDate < `${INSIGHTS_START_YEAR}-01-01` || initialDate > current) return current;
    const [year, month, day] = initialDate.split('-').map(Number);
    return month >= 1 && month <= 12 && day >= 1 && day <= getDaysInMonth(year, month) ? initialDate : current;
  });

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
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3 }}
      className="w-full"
    >
      {/* 三段式日期选择器 */}
      <div className="mb-6">
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
      <section aria-labelledby="daily-readings" className="mt-9">
        <div className="mb-4 flex items-center gap-3">
          <h2 id="daily-readings" style={{ scrollMarginTop: '10rem' }} className="font-sans text-[10px] font-normal tracking-[0.34em] text-stone-400">今日见闻</h2>
          <span aria-hidden="true" className="h-px flex-1 bg-stone-200/80" />
        </div>
        <div className="grid gap-6">
          <NewsEditionCard selectedDate={selectedDate} embedded={embedded} />
          <DailyInsightsView date={selectedDate} />
        </div>
      </section>

      {/* 声明 */}
      <motion.div
        initial={false}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="mt-8"
      >
        <div className="flex items-start gap-2 text-[11px] leading-relaxed">
          <span className="text-stone-400/50 flex-shrink-0">|</span>
          <p className="text-stone-500/70 font-sans tracking-wide">
            <span className="text-stone-600/60">声明</span>
            <span className="text-stone-400/50 mx-1.5">·</span>
            见闻取材于古籍与文化记录，部分为寓言或后世轶事，出处以现存文本为准；如有出入欢迎指正。黄历与子午流注属传统文化内容，不构成医疗建议。
          </p>
        </div>
      </motion.div>

    </motion.div>
  );
};
