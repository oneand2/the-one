import { canReadPaper, json, publishedIssues, validIssueDate } from '@/lib/jtdNews/reader';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const PAGE = 360;

type Issue = { issue_date: string; lunar: string; description: string; stories: unknown[] };
type Cover = { issue_date: string; cover: { title: string; photo: string; coverPhrases?: string[] } };

export async function GET(request: Request) {
  try {
    if (!await canReadPaper(request)) return json({ error: '未找到刊期' }, 404);
    const params = new URL(request.url).searchParams;
    const date = params.get('date');
    const before = params.get('before');
    const coverDate = params.get('cover');
    const slug = params.get('locate');
    if ([date, before, coverDate].some(v => v !== null && !validIssueDate(v)) ||
      (slug !== null && !/^[a-z0-9-]{1,128}$/.test(slug))) return json({ error: '刊期参数无效' }, 400);

    if (coverDate) {
      const lookup = () => publishedIssues('issue_date,cover');
      let result = await lookup().eq('issue_date', coverDate).maybeSingle<Cover>();
      if (!result.error && !result.data) {
        result = await lookup().order('issue_date', { ascending: false }).limit(1).maybeSingle<Cover>();
      }
      if (result.error) throw result.error;
      return json(result.data ? { date: result.data.issue_date, ...result.data.cover } : null);
    }
    if (date) {
      const result = await publishedIssues('issue_date,lunar,description,stories')
        .eq('issue_date', date).maybeSingle<Issue>();
      if (result.error) throw result.error;
      if (!result.data) return json({ error: '未找到刊期' }, 404);
      const { issue_date, ...edition } = result.data;
      return json({ ...edition, date: issue_date });
    }
    if (slug) {
      const result = await publishedIssues('issue_date').contains('stories', JSON.stringify([{ id: slug }]))
        .order('issue_date', { ascending: false }).limit(1).maybeSingle<{ issue_date: string }>();
      if (result.error) throw result.error;
      return json(result.data?.issue_date ?? null);
    }
    let lookup = publishedIssues('issue_date').order('issue_date', { ascending: false }).limit(PAGE + 1);
    if (before) lookup = lookup.lt('issue_date', before);
    const { data, error } = await lookup.returns<{ issue_date: string }[]>();
    if (error) throw error;
    const dates = data.slice(0, PAGE).map(item => item.issue_date);
    return json({ dates, next: data.length > PAGE ? dates.at(-1) : null });
  } catch {
    return json({ error: '刊期暂时无法读取，请稍后重试' }, 503);
  }
}
