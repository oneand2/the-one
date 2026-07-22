import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import dotenv from 'dotenv';

import { parseNewsContent } from '../src/utils/newsItems';
import { createAdminClient } from '../src/utils/supabase/admin';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

interface CliOptions {
  date: string;
  file: string;
  dryRun: boolean;
}

const EXPECTED_SECTIONS = ['国际与地缘', '金融与科技', '民生与社会'];

function countCharacters(value: string) {
  return Array.from(value.trim()).length;
}

function validateSkillFormat(content: string, date: string) {
  const lines = content.split('\n').map((line) => line.trim());
  const linksTitleIndex = lines.findIndex((line) => line === '**新闻链接查证**');
  if (linksTitleIndex < 0) {
    throw new Error('发布已中止：缺少加粗的“新闻链接查证”板块');
  }

  const bodyLines = lines.slice(0, linksTitleIndex);
  const linkLines = lines.slice(linksTitleIndex + 1).filter(Boolean);
  const boldHeadings = bodyLines.filter((line) => /^\*\*.+\*\*$/.test(line));
  const sectionHeadings = EXPECTED_SECTIONS.map((section) => `**${section}**`);

  for (const section of sectionHeadings) {
    if (bodyLines.filter((line) => line === section).length !== 1) {
      throw new Error(`发布已中止：板块 ${section} 必须且只能出现一次`);
    }
  }
  if (boldHeadings.length !== 9) {
    throw new Error(`发布已中止：正文应有 3 个板块标题和 6 个新闻标题，实际识别到 ${boldHeadings.length} 个加粗标题`);
  }

  const newsTitles = boldHeadings
    .filter((line) => !sectionHeadings.includes(line))
    .map((line) => line.slice(2, -2).trim());
  const longTitles = newsTitles.filter((title) => countCharacters(title) > 20);
  if (longTitles.length > 0) {
    throw new Error(`发布已中止：新闻标题通常不得超过 20 字：${longTitles.join('、')}`);
  }

  const chineseDate = `${Number(date.slice(0, 4))}年${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日`;
  const factIndexes = bodyLines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line.startsWith(chineseDate));
  if (factIndexes.length !== 6) {
    throw new Error(`发布已中止：应有 6 段以 ${chineseDate} 开头的事实段，实际为 ${factIndexes.length} 段`);
  }

  for (const { line: fact, index } of factIndexes) {
    const analysis = bodyLines[index + 1];
    if (!analysis || /^\s*$/.test(analysis) || /^(利好|利空|消息来源)[：:]/.test(analysis)) {
      throw new Error('发布已中止：每条新闻的事实段后必须直接连接分析段，中间不能有空行');
    }
    const factLength = countCharacters(fact);
    const analysisLength = countCharacters(analysis);
    if (factLength < 120 || factLength > 150 || analysisLength < 120 || analysisLength > 150) {
      throw new Error(`发布已中止：事实段和分析段均须为 120–150 字，当前为 ${factLength}/${analysisLength} 字`);
    }
  }

  const bullishLines = bodyLines.filter((line) => /^利好[：:]/.test(line));
  const bearishLines = bodyLines.filter((line) => /^利空[：:]/.test(line));
  const sourceLines = bodyLines.filter((line) => /^消息来源[：:]/.test(line));
  if (bullishLines.length !== 6 || bearishLines.length !== 6 || sourceLines.length !== 6) {
    throw new Error('发布已中止：每条新闻都必须各有一行利好、利空和消息来源');
  }

  for (const line of [...bullishLines, ...bearishLines]) {
    const stockCodes = line.match(/\([A-Za-z0-9.]+\)/g) ?? [];
    if (stockCodes.length < 1 || stockCodes.length > 2 || /无明显|[：:]无(?:$|\s)/.test(line)) {
      throw new Error(`发布已中止：利好/利空必须包含 1–2 只带完整代码的股票：${line}`);
    }
  }
  for (const line of sourceLines) {
    const sources = line.replace(/^消息来源[：:]\s*/, '').split('/').map((source) => source.trim()).filter(Boolean);
    if (sources.length !== 2) {
      throw new Error(`发布已中止：每条新闻必须使用两个交叉核验信源：${line}`);
    }
  }

  const forbiddenBodyMarkers = /<cite|cite|\[\d+\]|[¹²³⁴⁵⁶⁷⁸⁹]/i;
  if (bodyLines.some((line) => line.includes('[') || line.includes(']') || forbiddenBodyMarkers.test(line))) {
    throw new Error('发布已中止：正文含中括号、引用徽章、脚注或上标数字');
  }

  const linkPattern = /^\[([^\]/]+)\/([^\]]+)\]\s+.+\((\d{4}-\d{2}-\d{2})\s+[^)]+\)：(https:\/\/\S+)$/;
  if (linkLines.length !== 6) {
    throw new Error(`发布已中止：新闻链接查证区必须正好有 6 条记录，实际为 ${linkLines.length} 条`);
  }
  for (const line of linkLines) {
    const match = line.match(linkPattern);
    if (!match || match[3] !== date || line.includes('](')) {
      throw new Error(`发布已中止：查证链接格式或日期不符合 skill：${line}`);
    }
  }
}

function readOptions(argv: string[]): CliOptions {
  const valueAfter = (flag: string) => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : undefined;
  };

  const date = valueAfter('--date') ?? '';
  const file = valueAfter('--file') ?? '';
  const dryRun = argv.includes('--dry-run');

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('请使用 --date YYYY-MM-DD 指定新闻日期');
  }
  if (!file) {
    throw new Error('请使用 --file <path> 指定新闻 Markdown 文件');
  }

  return { date, file, dryRun };
}

async function main() {
  const options = readOptions(process.argv.slice(2));
  const content = (await readFile(resolve(process.cwd(), options.file), 'utf8')).trim();
  validateSkillFormat(content, options.date);
  const items = parseNewsContent(content);
  const sections = new Set(items.map((item) => item.section).filter(Boolean));
  const missingSources = items.filter((item) => !item.source);
  const missingLinks = items.filter((item) => !item.url);

  if (sections.size !== 3 || EXPECTED_SECTIONS.some((section) => !sections.has(section))) {
    throw new Error(`发布已中止：只允许三个固定板块，实际识别为 ${Array.from(sections).join('、')}`);
  }
  if (items.length !== 6 || EXPECTED_SECTIONS.some((section) => items.filter((item) => item.section === section).length !== 2)) {
    throw new Error(`发布已中止：必须每板块 2 条、总计 6 条，实际识别到 ${items.length} 条`);
  }
  if (missingSources.length > 0) {
    throw new Error(`发布已中止：${missingSources.length} 条新闻缺少消息来源`);
  }
  if (missingLinks.length > 0) {
    throw new Error(`发布已中止：${missingLinks.length} 条新闻未匹配到查证链接`);
  }

  const result = {
    date: options.date,
    sections: sections.size,
    items: items.length,
    dryRun: options.dryRun,
  };

  if (options.dryRun) {
    console.log(JSON.stringify(result));
    return;
  }

  const supabase = createAdminClient();
  const { error: worldNewsError } = await supabase
    .from('world_news')
    .upsert(
      { news_date: options.date, content },
      { onConflict: 'news_date', ignoreDuplicates: false }
    );

  if (worldNewsError) {
    throw new Error(`写入 world_news 失败：${worldNewsError.message}`);
  }

  const { error: deleteError } = await supabase
    .from('news_items')
    .delete()
    .eq('news_date', options.date);

  if (deleteError) {
    throw new Error(`清理旧标题库失败：${deleteError.message}`);
  }

  const rows = items.map((item) => ({
    news_date: options.date,
    section: item.section || null,
    title: item.title,
    summary: item.summary || null,
    source: item.source,
    url: item.url,
  }));

  const { error: insertError } = await supabase.from('news_items').insert(rows);
  if (insertError) {
    throw new Error(`同步标题库失败：${insertError.message}`);
  }

  console.log(JSON.stringify(result));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
