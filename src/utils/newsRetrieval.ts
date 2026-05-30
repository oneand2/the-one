// ─────────────────────────────────────────────────────────────────────────────
// 占问前程 · 第 2 级新闻漏斗：相关摘要检索
//
// 流程：
//   1. 用模型把用户问题扩展成一组检索关键词 / 同义概念
//      （例：问「进 AI 行业」→ 人工智能、算力、芯片、大模型、就业 …）
//   2. 在近一年（默认 365 天）的标题库 news_items 里，按关键词对「标题 + 摘要」
//      做模糊匹配，按命中数 + 时间新近度打分，取 Top N。
//   3. 只返回命中条目（含摘要、来源、链接），交由提示词层注入。
//
// 数据真实性：仅检索已入库的真实新闻，链接原样透传，绝不杜撰。
// ─────────────────────────────────────────────────────────────────────────────

import OpenAI from 'openai';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface RetrievedNews {
  news_date: string;
  section: string | null;
  title: string;
  summary: string | null;
  source: string | null;
  url: string | null;
  score: number;
}

interface NewsItemRow {
  news_date: string;
  section: string | null;
  title: string;
  summary: string | null;
  source: string | null;
  url: string | null;
}

const MAX_KEYWORDS = 12;
const MAX_CANDIDATES = 240; // 先粗筛的候选上限，再在内存里精排
const DEFAULT_LIMIT = 8;
const DEFAULT_DAY_WINDOW = 365;

/** 清洗关键词：去空白、去会破坏 PostgREST or() 语法的字符 */
function sanitizeKeyword(kw: string): string {
  return kw.replace(/[%,()]/g, '').trim();
}

/**
 * 用模型把用户问题扩展为检索关键词。失败时回退到对问题做朴素切词。
 */
export async function expandKeywords(question: string): Promise<string[]> {
  const q = (question || '').trim();
  if (!q) return [];

  const fallback = () =>
    Array.from(
      new Set(
        q
          .replace(/[，。？！、,.?!\s]+/g, ' ')
          .split(' ')
          .map((s) => s.trim())
          .filter((s) => s.length >= 2)
      )
    ).slice(0, MAX_KEYWORDS);

  if (!process.env.AI_API_KEY || !process.env.AI_BASE_URL) {
    return fallback();
  }

  try {
    const client = new OpenAI({
      apiKey: process.env.AI_API_KEY,
      baseURL: process.env.AI_BASE_URL,
    });
    const model = process.env.AI_MODEL_NAME || 'deepseek-chat';

    const resp = await client.chat.completions.create({
      model,
      temperature: 0.3,
      max_tokens: 256,
      messages: [
        {
          role: 'system',
          content:
            '你是新闻检索关键词助手。根据用户的处境/问题，扩展出用于在新闻库中检索现实趋势的关键词与相关同义概念。' +
            '要覆盖上下游与近义领域（例如问「进入 AI 行业」应包含「人工智能、算力、芯片、大模型、互联网大厂、就业」等）。' +
            '只输出一个 JSON 字符串数组，包含 5 到 12 个中文关键词，不要任何解释或多余文字。',
        },
        { role: 'user', content: q },
      ],
    });

    const raw = resp.choices?.[0]?.message?.content ?? '';
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) {
      const arr = JSON.parse(match[0]) as unknown;
      if (Array.isArray(arr)) {
        const kws = arr
          .map((x) => (typeof x === 'string' ? sanitizeKeyword(x) : ''))
          .filter((s) => s.length >= 2);
        const uniq = Array.from(new Set(kws)).slice(0, MAX_KEYWORDS);
        if (uniq.length > 0) return uniq;
      }
    }
    return fallback();
  } catch (e) {
    console.warn('关键词扩展失败，回退到朴素切词:', e);
    return fallback();
  }
}

function cutoffDate(dayWindow: number): string {
  const d = new Date();
  d.setDate(d.getDate() - dayWindow);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 命中条目打分：标题命中权重高于摘要，叠加轻微的时间新近度 */
function scoreItem(row: NewsItemRow, keywords: string[], now: number): number {
  const title = row.title || '';
  const summary = row.summary || '';
  let hits = 0;
  for (const kw of keywords) {
    if (title.includes(kw)) hits += 2;
    else if (summary.includes(kw)) hits += 1;
  }
  if (hits === 0) return 0;
  // 时间新近度：越近加成越大（最多约 +1.5），不喧宾夺主
  const ageDays = Math.max(0, (now - new Date(row.news_date).getTime()) / 86400000);
  const recency = Math.max(0, 1.5 - ageDays / 365);
  return hits + recency;
}

/**
 * 检索与问题相关的新闻条目（第 2 级漏斗）。
 *
 * @param supabase 服务端 Supabase 客户端
 * @param question 用户的前程问题
 * @param opts.limit 返回条数（默认 8）
 * @param opts.dayWindow 时间窗（默认 365 天；不足则有多少用多少）
 * @returns { keywords 实际使用的关键词, items 命中并排好序的条目 }
 */
export async function retrieveRelevantNews(
  supabase: SupabaseClient,
  question: string,
  opts?: { limit?: number; dayWindow?: number }
): Promise<{ keywords: string[]; items: RetrievedNews[] }> {
  const limit = opts?.limit ?? DEFAULT_LIMIT;
  const dayWindow = opts?.dayWindow ?? DEFAULT_DAY_WINDOW;

  const keywords = await expandKeywords(question);
  if (keywords.length === 0) return { keywords, items: [] };

  // 构造 PostgREST or 过滤：任一关键词命中标题或摘要
  const orFilter = keywords
    .flatMap((kw) => [`title.ilike.%${kw}%`, `summary.ilike.%${kw}%`])
    .join(',');

  const { data, error } = await supabase
    .from('news_items')
    .select('news_date, section, title, summary, source, url')
    .gte('news_date', cutoffDate(dayWindow))
    .or(orFilter)
    .order('news_date', { ascending: false })
    .limit(MAX_CANDIDATES);

  if (error) {
    console.warn('标题库检索失败:', error.message);
    return { keywords, items: [] };
  }

  const now = Date.now();
  const scored = (data as NewsItemRow[])
    .map((row) => ({ ...row, score: scoreItem(row, keywords, now) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return { keywords, items: scored };
}
