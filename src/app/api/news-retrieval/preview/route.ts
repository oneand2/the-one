import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { retrieveRelevantNews } from '@/utils/newsRetrieval';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * 占问前程检索预览（调试/验证用）。
 *   GET /api/news-retrieval/preview?q=我该不该进AI行业&limit=8
 * 返回扩展出的关键词与命中的新闻条目，便于在接入完整流程前核对检索质量。
 */
export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim() ?? '';
    if (!q) {
      return NextResponse.json({ error: '缺少参数 q' }, { status: 400 });
    }
    const limit = Math.min(20, Math.max(1, Number(searchParams.get('limit')) || 8));

    const { keywords, items } = await retrieveRelevantNews(supabase, q, { limit });
    return NextResponse.json({ question: q, keywords, count: items.length, items });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '检索失败' },
      { status: 500 }
    );
  }
}
