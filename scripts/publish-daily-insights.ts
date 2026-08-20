/**
 * 发布今日见闻。
 *
 *   npm run insights:publish -- --file content/2026-08-18.json
 *   npm run insights:publish -- --file content/2026-08-18.json --dry-run
 *
 * JSON 结构（一天三条，地/时/物 各一）：
 * {
 *   "date": "2026-08-18",
 *   "items": [
 *     { "category": "地", "title": "爸爸日", "body": "第一段\n\n第二段", "sources": "OECD 就业统计" },
 *     { "category": "时", "title": "两段觉", "body": "...", "sources": "..." },
 *     { "category": "物", "title": "八条腕", "body": "...", "sources": "..." }
 *   ]
 * }
 *
 * 校验规则见 docs/jinri-jianwen-content-guide.md。
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import dotenv from 'dotenv';

import { createAdminClient } from '../src/utils/supabase/admin';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const CATEGORIES = ['地', '时', '物'] as const;
type Category = (typeof CATEGORIES)[number];

interface InsightItem {
  category: Category;
  title: string;
  body: string;
  sources?: string;
}

interface InsightFile {
  date: string;
  items: InsightItem[];
}

const countChars = (value: string) => Array.from(value.trim()).length;

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

function validate(payload: InsightFile) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) {
    throw new Error(`发布已中止：date 需为 YYYY-MM-DD，收到 ${payload.date}`);
  }
  if (!Array.isArray(payload.items) || payload.items.length !== 3) {
    throw new Error(`发布已中止：一天必须三条，实际 ${payload.items?.length ?? 0} 条`);
  }

  const seen = new Set<string>();
  for (const item of payload.items) {
    if (!CATEGORIES.includes(item.category)) {
      throw new Error(`发布已中止：类目只能是 地/时/物，收到「${item.category}」`);
    }
    if (seen.has(item.category)) {
      throw new Error(`发布已中止：类目「${item.category}」重复`);
    }
    seen.add(item.category);

    const titleLen = countChars(item.title);
    if (titleLen < 2 || titleLen > 5) {
      throw new Error(`发布已中止：标题「${item.title}」应为二到五字，实际 ${titleLen} 字`);
    }
    if (/[。？！，、；：]/.test(item.title)) {
      throw new Error(`发布已中止：标题「${item.title}」含标点，应为名词性短语而非句子`);
    }

    const paragraphs = item.body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    if (paragraphs.length < 3 || paragraphs.length > 6) {
      throw new Error(
        `发布已中止：「${item.title}」正文应为三到六段，实际 ${paragraphs.length} 段`
      );
    }
    const bodyLen = countChars(item.body);
    if (bodyLen < 120 || bodyLen > 400) {
      throw new Error(`发布已中止：「${item.title}」正文 ${bodyLen} 字，应在 120–400 字之间`);
    }
    if (!item.sources?.trim()) {
      throw new Error(`发布已中止：「${item.title}」缺少 sources，每条必须留档来源`);
    }
  }
}

async function main() {
  const { file, dryRun } = parseArgs();
  const raw = await readFile(resolve(process.cwd(), file), 'utf8');
  const payload = JSON.parse(raw) as InsightFile;

  validate(payload);

  const rows = payload.items.map((item) => ({
    insight_date: payload.date,
    category: item.category,
    title: item.title,
    body: item.body.trim(),
    sources: item.sources?.trim() ?? null,
  }));

  console.log(`校验通过：${payload.date}`);
  for (const row of rows) {
    console.log(`  ${row.category}　${row.title}　${countChars(row.body)} 字`);
  }

  if (dryRun) {
    console.log('--dry-run，未写入数据库');
    return;
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('daily_insights')
    .upsert(rows, { onConflict: 'insight_date,category' });

  if (error) throw new Error(`写入失败：${error.message}`);
  console.log(`已发布 ${payload.date} 的三条见闻`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
