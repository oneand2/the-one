// ─────────────────────────────────────────────────────────────────────────────

import { getNextNonEmptyLine, isBoldNewsHeading, looksLikeDatedNewsBody, nextNonEmptyLineIsBold, stripNewsHeading } from './newsMarkdown';
// 新闻标题库解析工具
//
// 把 world_news 表里「一天一行」的自由文本 content，解析成一条条结构化新闻：
//   { section 板块, title 标题, summary 正文摘要, source 消息来源, url 原文链接 }
//
// 解析规则与 /admin/news 页面的实时预览（parseContent）保持一致，避免两套逻辑漂移：
//   板块(h1) → 标题(h2) → 正文(text，作为摘要) → 利好/利空 → 消息来源 → 新闻链接查证
// 链接区块（[来源] 标题：URL）按标题回填到对应条目的 url，仅用于溯源。
// ─────────────────────────────────────────────────────────────────────────────

export interface ParsedNewsItem {
  section: string;
  title: string;
  summary: string;
  source: string | null;
  url: string | null;
}

type TokenType =
  | 'h1'
  | 'h2'
  | 'text'
  | 'source'
  | 'bullish'
  | 'bearish'
  | 'links_title'
  | 'link';

interface Token {
  type: TokenType;
  content: string;
}

interface ParsedLink {
  source: string;
  title: string;
  url: string;
}

/**
 * 把整段新闻文本分词为带类型的 token 列表。
 * 该逻辑移植自 /admin/news 的 parseContent，确保与管理端预览结果一致。
 */
function tokenize(text: string): Token[] {
  const lines = text.split('\n');
  const parsed: Token[] = [];

  let lastWasEmpty = false;
  let lastNonEmptyType: Exclude<TokenType, never> | null = null;
  let consecutiveTextCount = 0;
  let hasH1 = false;
  let inLinksSection = false;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const trimmed = line.trim();

    if (trimmed === '') {
      lastWasEmpty = true;
      continue;
    }

    // 「新闻链接查证」标题
    if (trimmed.includes('新闻链接查证') || trimmed.includes('链接查证')) {
      parsed.push({ type: 'links_title', content: trimmed });
      lastWasEmpty = false;
      lastNonEmptyType = 'links_title';
      inLinksSection = true;
      continue;
    }

    // 链接区块内：识别 [来源] 描述：URL
    if (inLinksSection) {
      const linkMatch = trimmed.match(/^\[([^\]]+)\]\s*(.+?)[:：]\s*(https?:\/\/.+)$/);
      if (linkMatch) {
        parsed.push({
          type: 'link',
          content: JSON.stringify({
            source: linkMatch[1],
            title: linkMatch[2],
            url: linkMatch[3],
          }),
        });
        lastWasEmpty = false;
        lastNonEmptyType = 'link';
        continue;
      }
    }

    // 利好 / 利空 / 消息来源
    if (trimmed.startsWith('利好：') || trimmed.startsWith('利好:')) {
      parsed.push({ type: 'bullish', content: trimmed.replace(/^利好[：:]\s*/, '') });
      lastWasEmpty = false;
      lastNonEmptyType = 'bullish';
      consecutiveTextCount = 0;
      continue;
    }
    if (trimmed.startsWith('利空：') || trimmed.startsWith('利空:')) {
      parsed.push({ type: 'bearish', content: trimmed.replace(/^利空[：:]\s*/, '') });
      lastWasEmpty = false;
      lastNonEmptyType = 'bearish';
      consecutiveTextCount = 0;
      continue;
    }
    if (trimmed.startsWith('消息来源：') || trimmed.startsWith('消息来源:')) {
      parsed.push({ type: 'source', content: trimmed.replace(/^消息来源[：:]\s*/, '') });
      lastWasEmpty = false;
      lastNonEmptyType = 'source';
      consecutiveTextCount = 0;
      continue;
    }

    const isMarkdownH1 = /^#{1,2}\s+/.test(trimmed);
    const isMarkdownH2 = /^#{3}\s+/.test(trimmed);
    const isBoldHeading = isBoldNewsHeading(trimmed);
    const boldSectionHeading = isBoldHeading && nextNonEmptyLineIsBold(lines, lineIndex);
    const headingText = stripNewsHeading(trimmed);
    const nextLineStartsBody = looksLikeDatedNewsBody(getNextNonEmptyLine(lines, lineIndex));

    const isVeryShort = headingText.length <= 12;
    const hasNoPunctuation = !/[（()）""'']/.test(headingText);
    const notAfterH2 = lastNonEmptyType !== 'h2';
    const notAfterH1 = lastNonEmptyType !== 'h1';
    const followsCompletedItem =
      lastNonEmptyType === 'source' ||
      lastNonEmptyType === 'bullish' ||
      lastNonEmptyType === 'bearish';

    // 一级标题（板块）
    if (
      (isMarkdownH1 || boldSectionHeading ||
        (!isBoldHeading && (lastWasEmpty || parsed.length === 0 || followsCompletedItem) &&
          !nextLineStartsBody &&
          isVeryShort &&
          hasNoPunctuation &&
          notAfterH2 &&
          notAfterH1)) &&
      !isMarkdownH2
    ) {
      parsed.push({ type: 'h1', content: headingText });
      lastWasEmpty = false;
      lastNonEmptyType = 'h1';
      consecutiveTextCount = 0;
      hasH1 = true;
      inLinksSection = false;
      continue;
    }

    // 二级标题（新闻标题）
    const isPotentialH2 = hasH1 && headingText.length > 12 && headingText.length < 80;
    const shouldBeH2 =
      isMarkdownH2 ||
      (isBoldHeading && !boldSectionHeading) ||
      (lastNonEmptyType === 'h1' && nextLineStartsBody) ||
      (followsCompletedItem && nextLineStartsBody) ||
      (isPotentialH2 &&
        (lastNonEmptyType === 'h1' ||
          lastNonEmptyType === 'source' ||
          followsCompletedItem ||
          (lastWasEmpty && consecutiveTextCount >= 2)));

    if (shouldBeH2) {
      parsed.push({ type: 'h2', content: headingText });
      lastWasEmpty = false;
      lastNonEmptyType = 'h2';
      consecutiveTextCount = 0;
      inLinksSection = false;
      continue;
    }

    // 正文（不在链接区块内才作为正文）
    if (!inLinksSection) {
      parsed.push({ type: 'text', content: trimmed });
      lastWasEmpty = false;
      lastNonEmptyType = 'text';
      consecutiveTextCount++;
    }
  }

  return parsed;
}

/** 归一化标题，便于链接与条目做匹配（去空白、去常见括注尾巴差异） */
function normalizeTitle(s: string): string {
  return s.replace(/\s+/g, '').trim();
}

/**
 * 解析一整天的新闻文本为结构化条目列表。
 * @param content world_news.content 大文本
 */
export function parseNewsContent(content: string): ParsedNewsItem[] {
  if (!content || !content.trim()) return [];

  const tokens = tokenize(content);
  const items: ParsedNewsItem[] = [];
  const links: ParsedLink[] = [];

  let currentSection = '';
  let current: { section: string; title: string; summaryLines: string[]; source: string | null } | null = null;

  const flush = () => {
    if (current) {
      items.push({
        section: current.section,
        title: current.title,
        summary: current.summaryLines.join('\n').trim(),
        source: current.source,
        url: null,
      });
      current = null;
    }
  };

  for (const tk of tokens) {
    switch (tk.type) {
      case 'h1':
        flush();
        currentSection = tk.content;
        break;
      case 'h2':
        flush();
        current = { section: currentSection, title: tk.content, summaryLines: [], source: null };
        break;
      case 'text':
        if (current) current.summaryLines.push(tk.content);
        break;
      case 'bullish':
        if (current) current.summaryLines.push(`利好：${tk.content}`);
        break;
      case 'bearish':
        if (current) current.summaryLines.push(`利空：${tk.content}`);
        break;
      case 'source':
        if (current) current.source = tk.content;
        break;
      case 'link':
        try {
          const l = JSON.parse(tk.content) as ParsedLink;
          if (l?.url) links.push(l);
        } catch {
          /* 忽略坏链接 */
        }
        break;
      default:
        break;
    }
  }
  flush();

  // 把链接按标题回填到对应条目（精确优先，其次互相包含）
  for (const link of links) {
    const lt = normalizeTitle(link.title);
    if (!lt) continue;
    let target = items.find((it) => !it.url && normalizeTitle(it.title) === lt);
    if (!target) {
      target = items.find(
        (it) => !it.url && (normalizeTitle(it.title).includes(lt) || lt.includes(normalizeTitle(it.title)))
      );
    }
    if (target) target.url = link.url;
  }

  // 只保留有标题的有效条目
  return items.filter((it) => it.title && it.title.trim());
}
