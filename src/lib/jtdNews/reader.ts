import { getAdminUser } from '@/lib/admin/access';
import { createAdminClient } from '@/utils/supabase/admin';

export const readerHeaders = {
  'Cache-Control': 'private, no-store',
  Vary: 'Cookie',
  'X-Content-Type-Options': 'nosniff',
};

// Apply the same reader access check to the archive, articles and photos.
export async function canReadPaper(request: Request) {
  if (process.env.NODE_ENV === 'development' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(new URL(request.url).hostname)) return true;
  if (!request.headers.has('cookie')) return false;
  return Boolean(await getAdminUser());
}

export function validIssueDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(value + 'T00:00:00Z');
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}

export function publishedIssues(columns: string) {
  return createAdminClient().from('jtd_news_editions').select(columns)
    .lte('published_at', new Date().toISOString());
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: readerHeaders });
}
