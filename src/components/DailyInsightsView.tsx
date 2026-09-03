'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { createClient } from '@/utils/supabase/client';
import { getCached, setCached, CACHE_KEYS } from '@/utils/cache';
import { arrangeWeeklyInsights } from '@/utils/dailyInsights';
import localStoryWeek from '../../content/2026-08-27-week.json';

const KAITI = '"Kaiti SC", KaiTi, STKaiti, "华文楷体", "楷体", Georgia, serif';
const DAY_MS = 24 * 60 * 60 * 1000;

export interface DailyInsight {
  id: string;
  insight_date: string;
  title: string;
  source_label: string;
  original_language: string;
  original_text: string;
  body: string;
  created_at: string;
}

const formatUtcDate = (value: Date) => value.toISOString().slice(0, 10);

const LOCAL_DAILY_INSIGHTS: DailyInsight[] = arrangeWeeklyInsights(localStoryWeek.stories).map(
  (story, index) => {
    const start = new Date(`${localStoryWeek.startDate}T00:00:00Z`).getTime();
    const date = formatUtcDate(new Date(start + index * DAY_MS));
    return {
      id: `local-${date}`,
      insight_date: date,
      title: story.title,
      source_label: story.sourceLabel,
      original_language: story.originalLanguage,
      original_text: story.originalText,
      body: story.body,
      created_at: `${date}T00:00:00+08:00`,
    };
  }
);

/** 本地周稿优先覆盖同日期内容，便于上线前预览。 */
const mergeLocalInsights = (rows: DailyInsight[]) => {
  const localDates = new Set(LOCAL_DAILY_INSIGHTS.map((item) => item.insight_date));
  const currentRows = rows.filter(
    (item) =>
      typeof item.source_label === 'string' &&
      item.source_label.trim().length > 0 &&
      typeof item.original_language === 'string' &&
      item.original_language.trim().length > 0 &&
      typeof item.original_text === 'string' &&
      item.original_text.trim().length > 0 &&
      !localDates.has(item.insight_date)
  );
  return [
    ...LOCAL_DAILY_INSIGHTS,
    ...currentRows,
  ].sort((a, b) => b.insight_date.localeCompare(a.insight_date));
};

/** 每天一篇，取近 120 天足够翻阅存档。 */
const FETCH_LIMIT = 120;

interface Props {
  /** 当前选中的日期 YYYY-MM-DD */
  date: string;
}

export const DailyInsightsView: React.FC<Props> = ({ date }) => {
  const [list, setList] = useState<DailyInsight[]>(() => mergeLocalInsights([]));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cached = getCached<DailyInsight[]>(CACHE_KEYS.DAILY_INSIGHTS);
    if (cached && cached.length > 0) {
      setList(mergeLocalInsights(cached));
    }

    const fetchInsights = async () => {
      let supabase;
      try {
        supabase = createClient();
      } catch (e) {
        setError(e instanceof Error ? e.message : '配置异常');
        return;
      }

      setLoading(true);
      try {
        const query = supabase
          .from('daily_insights')
          .select(
            'id, insight_date, title, source_label, original_language, original_text, body, created_at'
          )
          .order('insight_date', { ascending: false })
          .limit(FETCH_LIMIT);
        const { data, error: fetchError } = await Promise.race([
          query,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 8000)
          ),
        ]);

        if (fetchError) throw fetchError;

        const rows = mergeLocalInsights((data || []) as DailyInsight[]);
        setList(rows);
        setCached(CACHE_KEYS.DAILY_INSIGHTS, rows);
      } catch (e) {
        setError(e instanceof Error ? e.message : '加载失败');
        if (!cached) setList(mergeLocalInsights([]));
      } finally {
        setLoading(false);
      }
    };

    void fetchInsights();
  }, []);

  /** 当天没有内容时，回落到不晚于所选日期的最近一篇。 */
  const { entry, fallbackDate } = useMemo(() => {
    const exact = list.find((item) => item.insight_date === date);
    if (exact) return { entry: exact, fallbackDate: null as string | null };

    const earlier = list.find((item) => item.insight_date < date);
    return {
      entry: earlier ?? null,
      fallbackDate: earlier?.insight_date ?? null,
    };
  }, [list, date]);

  if (loading && !entry) {
    return (
      <div className="min-h-[200px] flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-stone-300 border-t-stone-600" />
      </div>
    );
  }

  if (error && !entry) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm tracking-wide text-stone-400" style={{ fontFamily: KAITI }}>
          见闻加载失败
        </p>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm tracking-wide text-stone-400" style={{ fontFamily: KAITI }}>
          该日见闻暂未更新
        </p>
      </div>
    );
  }

  const originalMeta =
    entry.original_language === '波斯语'
      ? { lang: 'fa', dir: 'rtl' as const, fontFamily: 'Georgia, serif' }
      : entry.original_language === '古希腊语'
        ? { lang: 'grc', dir: 'ltr' as const, fontFamily: 'Georgia, serif' }
        : entry.original_language === '英语'
          ? { lang: 'en', dir: 'ltr' as const, fontFamily: 'Georgia, serif' }
          : { lang: 'zh-Hans', dir: 'ltr' as const, fontFamily: KAITI };

  return (
    <div>
      {fallbackDate && (
        <div className="mb-6 flex items-center gap-4">
          <div className="h-px flex-1 bg-stone-200/80" />
          <span
            className="whitespace-nowrap text-[11px] tracking-[0.18em] text-stone-400"
            style={{ fontFamily: KAITI }}
          >
            最近一则 · {fallbackDate.slice(5).replace('-', '.')}
          </span>
          <div className="h-px flex-1 bg-stone-200/80" />
        </div>
      )}

      <motion.article
        key={entry.id}
        initial={false}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
      >
        <div className="rounded-[25px] bg-stone-900/[0.035] p-[3px] ring-1 ring-stone-900/[0.035]">
          <div className="relative overflow-hidden rounded-[22px] bg-[#fdfcf8] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_14px_40px_rgba(76,65,51,0.035)] sm:p-6">
            <div className="mb-4 flex items-baseline justify-between gap-4 border-b border-stone-200/50 pb-3">
              <h3 className="font-serif text-[19px] font-normal tracking-[0.08em] text-stone-900">
                {entry.title}
              </h3>
              <span
                className="max-w-[52%] flex-shrink-0 text-right text-[11px] tracking-[0.12em] text-stone-400"
                style={{ fontFamily: KAITI }}
              >
                {entry.source_label}
              </span>
            </div>

            <div className="mb-5 overflow-hidden rounded-[17px] bg-stone-100/70 ring-1 ring-stone-900/[0.045]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/daily-insights/${entry.insight_date}.svg`}
                alt={`${entry.title}题头插画`}
                width={360}
                height={136}
                className="block h-auto w-full"
              />
            </div>

            <section className="mb-7" aria-label={`${entry.original_language}原文`}>
              <div className="mb-3 flex items-center gap-3">
                <span
                  className="text-[11px] tracking-[0.2em] text-stone-500"
                  style={{ fontFamily: KAITI }}
                >
                  原文
                </span>
                <span className="h-px flex-1 bg-stone-200/70" />
                <span className="text-[10px] tracking-[0.12em] text-stone-400">
                  {entry.original_language}
                </span>
              </div>
              <div className="border-l border-[#8a4a4a]/35 pl-4">
                {entry.original_text
                  .split(/\n\s*\n/)
                  .map((paragraph) => paragraph.trim())
                  .filter(Boolean)
                  .map((paragraph, index) => (
                    <p
                      key={index}
                      lang={originalMeta.lang}
                      dir={originalMeta.dir}
                      className="mb-3 whitespace-pre-line text-[13.5px] font-normal leading-[2] text-stone-600 last:mb-0"
                      style={{
                        fontFamily: originalMeta.fontFamily,
                        letterSpacing: entry.original_language === '文言' ? '0.04em' : '0.01em',
                        textAlign: originalMeta.dir === 'rtl' ? 'right' : 'left',
                      }}
                    >
                      {paragraph}
                    </p>
                  ))}
              </div>
            </section>

            <section aria-label="译文">
              <div className="mb-3 flex items-center gap-3">
                <span
                  className="text-[11px] tracking-[0.2em] text-stone-500"
                  style={{ fontFamily: KAITI }}
                >
                  译文
                </span>
                <span className="h-px flex-1 bg-stone-200/70" />
              </div>
              {entry.body
                .split(/\n\s*\n/)
                .map((paragraph) => paragraph.trim())
                .filter(Boolean)
                .map((paragraph, index) => (
                  <p
                    key={index}
                    className="mb-4 font-sans text-[14px] font-normal leading-[1.95] text-stone-700 last:mb-0"
                    style={{ letterSpacing: '0.018em', textAlign: 'justify' }}
                  >
                    {paragraph}
                  </p>
                ))}
            </section>
          </div>
        </div>
      </motion.article>
    </div>
  );
};
