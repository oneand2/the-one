import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { parseNewsContent } from '@/utils/newsItems';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function localDateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export async function GET(request: NextRequest) {
  const requestedDate = request.nextUrl.searchParams.get('date') ?? localDateString(new Date());
  if (!DATE_RE.test(requestedDate)) {
    return NextResponse.json({ error: '日期格式无效' }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const today = localDateString(new Date());
    const requested = new Date(`${requestedDate}T12:00:00`);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const fallbackDate = localDateString(yesterday);

    const [{ data: exact, error: exactError }, { data: earliest, error: earliestError }] = await Promise.all([
      supabase
        .from('world_news')
        .select('id, news_date, content')
        .eq('news_date', requestedDate)
        .maybeSingle(),
      supabase
        .from('world_news')
        .select('news_date')
        .order('news_date', { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

    if (exactError || earliestError) throw exactError ?? earliestError;

    let row = exact;
    let isYesterdayFallback = false;
    if (!row && requestedDate === today) {
      const { data: fallback, error: fallbackError } = await supabase
        .from('world_news')
        .select('id, news_date, content')
        .eq('news_date', fallbackDate)
        .maybeSingle();
      if (fallbackError) throw fallbackError;
      row = fallback;
      isYesterdayFallback = Boolean(fallback);
    }

    return NextResponse.json({
      requestedDate,
      earliestYear: earliest?.news_date ? Number(String(earliest.news_date).slice(0, 4)) : requested.getFullYear(),
      isYesterdayFallback,
      newsDate: row?.news_date ?? null,
      items: row?.content ? parseNewsContent(row.content) : [],
    });
  } catch (error) {
    console.error('native world news load failed:', error);
    return NextResponse.json({ error: '今日见闻暂时无法读取' }, { status: 500 });
  }
}
