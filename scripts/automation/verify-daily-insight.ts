import { readFile } from 'node:fs/promises';

import { createClient } from '@supabase/supabase-js';

import { arrangeWeeklyInsights } from '../../src/utils/dailyInsights';

interface Story {
  title: string;
  origin: 'china' | 'world';
  sourceLabel: string;
}

interface WeekFile {
  startDate: string;
  stories: Story[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(date: string, offset: number): string {
  const start = new Date(`${date}T00:00:00Z`);
  return new Date(start.getTime() + offset * DAY_MS).toISOString().slice(0, 10);
}

const weekPath = process.argv[2];
const date = process.argv[3] ?? '';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!weekPath || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error('用法：verify-daily-insight.ts <week.json> <YYYY-MM-DD>');
  process.exit(1);
}
if (!url || !key) {
  console.error('缺少 Supabase 服务端配置');
  process.exit(1);
}

const payload = JSON.parse(await readFile(weekPath, 'utf8')) as WeekFile;
const ordered = arrangeWeeklyInsights(payload.stories);
const dates = ordered.map((_, index) => addDays(payload.startDate, index));
const index = dates.indexOf(date);
if (index < 0) {
  console.error(`周稿不覆盖 ${date}`);
  process.exit(1);
}
const expected = ordered[index];
if (!expected) {
  console.error(`周稿在 ${date} 没有故事`);
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data, error } = await supabase
  .from('daily_insights')
  .select('title,source_label')
  .eq('insight_date', date);
if (error) {
  console.error(`读取今日见闻失败（${error.code ?? 'unknown'}）`);
  process.exit(1);
}
const rows = data ?? [];
if (rows.length === 0) process.exit(4);
if (rows.length !== 1) {
  console.error(`daily_insights 在 ${date} 有 ${rows.length} 条，需要恰好 1 条`);
  process.exit(3);
}
const row = rows[0];
if (!row || row.title !== expected.title || row.source_label !== expected.sourceLabel) {
  console.error(`回读与周稿不一致：库中「${row?.title ?? ''}」，周稿「${expected.title}」`);
  process.exit(2);
}
console.log(JSON.stringify({ date, title: row.title, source_label: row.source_label }));
