import { createAdminClient } from '@/utils/supabase/admin';

export const readerHeaders = {
  'Cache-Control': 'private, no-store',
  Vary: 'Cookie',
  'X-Content-Type-Options': 'nosniff',
};

// Published editions are readable by every visitor through the server API.
export async function canReadPaper(_request: Request) {
  return true;
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
