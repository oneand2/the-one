'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import styles from './NewsEditionCard.module.css';

type Cover = { date: string; title: string };

export function NewsEditionCard({ selectedDate, embedded }: { selectedDate: string; embedded?: boolean }) {
  const [loaded, setLoaded] = useState<{ requested: string; edition: Cover } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      const response = await fetch('/api/news/editions?cover=' + encodeURIComponent(selectedDate), {
        signal: controller.signal, cache: 'no-store',
      });
      const edition: Cover | null = response.ok ? await response.json() : null;
      if (!controller.signal.aborted) setLoaded(edition ? { requested: selectedDate, edition } : null);
    })().catch(() => { if (!controller.signal.aborted) setLoaded(null); });
    return () => controller.abort();
  }, [selectedDate]);

  if (!loaded || loaded.requested !== selectedDate) return null;
  const { edition } = loaded;
  const { date } = edition;
  const [year, month, day] = date.split('-');
  const dateLabel = `${year}年${Number(month)}月${Number(day)}日`;

  return (
    <a
      className={styles.card}
      href={`/news/index.html?date=${date}${embedded ? '&embed=ios' : ''}#front`}
      aria-label={`阅读《见天地》${dateLabel}刊：${edition.title}`}
    >
      <div className={styles.masthead}>
        <span className={styles.brand}>
          <Image src="/news/mark.svg" width={19} height={19} alt="" />
          见天地新闻
        </span>
        <span className={styles.issue}>
          {date !== selectedDate && <span>最近一期 · </span>}
          <time dateTime={date} aria-label={dateLabel}>{year}.{month}.{day}</time>
        </span>
      </div>

      <h3 className={styles.headline}>{edition.title}</h3>
      <span className={styles.action}>
        翻开本期
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="m4.5 2.5 3.5 3.5-3.5 3.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </a>
  );
}
