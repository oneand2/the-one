import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { parseNewsContent } from '@/utils/newsItems';

export const runtime = 'nodejs';
export const maxDuration = 120;

const ADMIN_EMAIL = '892777353@qq.com';

interface WorldNewsRow {
  news_date: string;
  content: string;
}

/**
 * 把 world_news 解析回填到结构化标题库 news_items。
 *
 * Body:
 *   - { date: 'YYYY-MM-DD' }  仅同步指定日期（管理端发布时调用）
 *   - {}                       全量回填所有历史新闻
 *
 * 仅管理员可调用。每个日期先删除旧条目再插入，保证可重复执行（幂等）。
 */
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }
    if (user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: '无权操作' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const date: string | undefined = typeof body?.date === 'string' ? body.date : undefined;

    // 读取待解析的 world_news
    let query = supabase.from('world_news').select('news_date, content');
    if (date) query = query.eq('news_date', date);
    const { data: rows, error: readErr } = await query;
    if (readErr) {
      return NextResponse.json({ error: `读取新闻失败：${readErr.message}` }, { status: 500 });
    }

    const newsRows = (rows ?? []) as WorldNewsRow[];
    if (newsRows.length === 0) {
      return NextResponse.json({ dates: 0, items: 0, message: '没有可同步的新闻' });
    }

    const dates = newsRows.map((r) => r.news_date);

    // 先清掉这些日期的旧条目，保证幂等
    const { error: delErr } = await supabase.from('news_items').delete().in('news_date', dates);
    if (delErr) {
      return NextResponse.json({ error: `清理旧标题库失败：${delErr.message}` }, { status: 500 });
    }

    // 解析并组装插入行
    const insertRows: Array<{
      news_date: string;
      section: string | null;
      title: string;
      summary: string | null;
      source: string | null;
      url: string | null;
    }> = [];

    for (const row of newsRows) {
      const items = parseNewsContent(row.content);
      for (const it of items) {
        insertRows.push({
          news_date: row.news_date,
          section: it.section || null,
          title: it.title,
          summary: it.summary || null,
          source: it.source || null,
          url: it.url || null,
        });
      }
    }

    // 分批插入，避免单次过大
    const CHUNK = 500;
    for (let i = 0; i < insertRows.length; i += CHUNK) {
      const chunk = insertRows.slice(i, i + CHUNK);
      const { error: insErr } = await supabase.from('news_items').insert(chunk);
      if (insErr) {
        return NextResponse.json({ error: `写入标题库失败：${insErr.message}` }, { status: 500 });
      }
    }

    return NextResponse.json({ dates: newsRows.length, items: insertRows.length });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '同步失败' },
      { status: 500 }
    );
  }
}
