import { canReadPaper, json, publishedIssues, readerHeaders, validIssueDate } from '@/lib/jtdNews/reader';
import { createAdminClient } from '@/utils/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const types: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif', gif: 'image/gif' };

export async function GET(request: Request, { params }: { params: Promise<{ date: string; file: string }> }) {
  const missing = () => json({ error: '未找到配图' }, 404);
  try {
    if (!await canReadPaper(request)) return missing();
    const { date, file } = await params;
    const match = /^([a-f0-9]{64})\.(jpg|jpeg|png|webp|avif|gif)$/.exec(file);
    if (!validIssueDate(date) || !match) return missing();
    const path = date + '/' + file;
    // Even if another draft uploaded an object for the same day, only photos
    // actually referenced by that day's currently published stories can be read.
    const { data: issue, error } = await publishedIssues('issue_date').eq('issue_date', date)
      .contains('stories', JSON.stringify([{ photo: { src: '/api/news/media/' + path } }])).maybeSingle();
    if (error) throw error;
    if (!issue) return missing();
    const { data, error: downloadError } = await createAdminClient().storage.from('jtd-news-photos').download(path);
    if (downloadError || !data) throw downloadError ?? new Error('missing object');
    return new Response(data, { headers: { ...readerHeaders, 'Content-Type': types[match[2]], 'Content-Length': String(data.size) } });
  } catch {
    return json({ error: '配图暂时无法读取，请稍后重试' }, 503);
  }
}
