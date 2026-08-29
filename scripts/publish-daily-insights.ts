/**
 * 按周发布今日见闻：每天一则故事。
 *
 *   npm run insights:publish -- --file content/2026-08-27-week.json
 *   npm run insights:publish -- --file content/2026-08-27-week.json --dry-run
 *
 * JSON 结构：
 * {
 *   "startDate": "2026-08-27",
 *   "stories": [
 *     {
 *       "title": "道不可言",
 *       "sourceLabel": "《庄子·天道》",
 *       "originalLanguage": "文言",
 *       "originalText": "桓公读书于堂上……",
 *       "body": "第一段\n\n第二段",
 *       "sources": "内部核查来源"
 *     }
 *   ]
 * }
 *
 * stories 必须正好七则，依次对应 startDate 起连续七天。
 * 校验规则见 docs/jinri-jianwen-content-guide.md。
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import dotenv from 'dotenv';

import { createAdminClient } from '../src/utils/supabase/admin';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface StoryItem {
  title: string;
  sourceLabel: string;
  originalLanguage: string;
  originalText: string;
  body: string;
  sources: string;
}

interface StoryWeekFile {
  startDate: string;
  stories: StoryItem[];
}

const countChars = (value: string) => Array.from(value.trim()).length;

const addDays = (date: string, offset: number) => {
  const start = new Date(`${date}T00:00:00Z`);
  return new Date(start.getTime() + offset * DAY_MS).toISOString().slice(0, 10);
};

function parseArgs() {
  const args = process.argv.slice(2);
  let file = '';
  let dryRun = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file') file = args[++i] ?? '';
    else if (args[i] === '--dry-run') dryRun = true;
  }
  if (!file) throw new Error('用法：--file <路径> [--dry-run]');
  return { file, dryRun };
}

function validate(payload: StoryWeekFile) {
  if (!DATE_RE.test(payload.startDate)) {
    throw new Error(`发布已中止：startDate 需为 YYYY-MM-DD，收到 ${payload.startDate}`);
  }
  if (Number.isNaN(new Date(`${payload.startDate}T00:00:00Z`).getTime())) {
    throw new Error(`发布已中止：startDate 不是有效日期，收到 ${payload.startDate}`);
  }
  if (!Array.isArray(payload.stories) || payload.stories.length !== 7) {
    throw new Error(`发布已中止：每周必须七则，实际 ${payload.stories?.length ?? 0} 则`);
  }

  const titles = new Set<string>();
  for (const story of payload.stories) {
    const titleLen = countChars(story.title);
    if (titleLen < 2 || titleLen > 5) {
      throw new Error(`发布已中止：标题「${story.title}」应为二到五字，实际 ${titleLen} 字`);
    }
    if (/[。？！，、；：]/.test(story.title)) {
      throw new Error(`发布已中止：标题「${story.title}」含标点，应为简短题眼`);
    }
    if (titles.has(story.title)) {
      throw new Error(`发布已中止：标题「${story.title}」在本周重复`);
    }
    titles.add(story.title);

    const sourceLabelLen = countChars(story.sourceLabel);
    if (sourceLabelLen < 2 || sourceLabelLen > 24) {
      throw new Error(
        `发布已中止：「${story.title}」的 sourceLabel 应为 2–24 字，实际 ${sourceLabelLen} 字`
      );
    }

    const originalLanguageLen = countChars(story.originalLanguage);
    if (originalLanguageLen < 2 || originalLanguageLen > 12) {
      throw new Error(
        `发布已中止：「${story.title}」的 originalLanguage 应为 2–12 字，实际 ${originalLanguageLen} 字`
      );
    }
    const originalLen = countChars(story.originalText);
    if (originalLen < 20 || originalLen > 1600) {
      throw new Error(
        `发布已中止：「${story.title}」原文 ${originalLen} 字，应在 20–1600 字之间`
      );
    }

    const paragraphs = story.body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    if (paragraphs.length < 3 || paragraphs.length > 6) {
      throw new Error(
        `发布已中止：「${story.title}」正文应为三到六段，实际 ${paragraphs.length} 段`
      );
    }
    const bodyLen = countChars(story.body);
    if (bodyLen < 120 || bodyLen > 400) {
      throw new Error(`发布已中止：「${story.title}」正文 ${bodyLen} 字，应在 120–400 字之间`);
    }
    if (/这个故事告诉我们|由此可见|这说明了/.test(story.body)) {
      throw new Error(`发布已中止：「${story.title}」含显式说理，正文应停在故事本身`);
    }
    if (!story.sources?.trim()) {
      throw new Error(`发布已中止：「${story.title}」缺少 sources`);
    }
  }
}

async function main() {
  const { file, dryRun } = parseArgs();
  const raw = await readFile(resolve(process.cwd(), file), 'utf8');
  const payload = JSON.parse(raw) as StoryWeekFile;

  validate(payload);

  const rows = payload.stories.map((story, index) => ({
    insight_date: addDays(payload.startDate, index),
    title: story.title,
    source_label: story.sourceLabel,
    original_language: story.originalLanguage,
    original_text: story.originalText.trim(),
    body: story.body.trim(),
    sources: story.sources.trim(),
  }));

  console.log(`校验通过：${rows[0].insight_date} 至 ${rows.at(-1)?.insight_date}`);
  for (const row of rows) {
    console.log(
      `  ${row.insight_date}　${row.title}　${row.source_label}　原文 ${countChars(row.original_text)} 字 / 译文 ${countChars(row.body)} 字`
    );
  }

  if (dryRun) {
    console.log('--dry-run，未写入数据库');
    return;
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('daily_insights')
    .upsert(rows, { onConflict: 'insight_date' });

  if (error) throw new Error(`写入失败：${error.message}`);
  console.log(`已发布一周共 ${rows.length} 则见闻`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
