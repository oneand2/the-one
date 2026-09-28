import { adminJson, getAdminUser, getConsoleAccess, isSameOrigin } from '@/lib/admin/access';
import { AmbassadorInputError, AmbassadorForbiddenError, parseReportDates, resolveScope, saveAmbassador } from '@/lib/ambassadors/server';
import { createAdminClient } from '@/utils/supabase/admin';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const access = await getConsoleAccess();
    if (!access) return adminJson({ error: '无权访问推广后台' }, 403);
    const params = new URL(request.url).searchParams;
    const scope = resolveScope(access, params.get('ambassador'), 'ambassadors');
    const dates = parseReportDates(params);
    const client = createAdminClient();
    const rows = [];
    // PostgREST may cap each response at 1,000 records.
    for (let offset = 0; offset < 100000; offset += 1000) {
      const { data, error } = await client.rpc('ambassador_performance', { p_ambassador_id: scope, p_start: dates.start, p_end: dates.end }).range(offset, offset + 999);
      if (error) throw error;
      rows.push(...data);
      if (data.length < 1000) return adminJson({ rows, access, updatedAt: new Date().toISOString() });
    }
    throw new Error('推广大使数量超出查询范围');
  } catch (error) {
    if (error instanceof AmbassadorInputError) return adminJson({ error: error.message }, 400);
    if (error instanceof AmbassadorForbiddenError) return adminJson({ error: error.message }, 403);
    return adminJson({ error: '推广数据暂时无法读取，请稍后重试' }, 503);
  }
}
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return adminJson({ error: '请求来源无效' }, 403);
  try {
    const owner = await getAdminUser();
    if (!owner) return adminJson({ error: '仅管理员可设置推广大使' }, 403);
    const raw = await request.text();
    if (raw.length > 3000) return adminJson({ error: '提交内容过长' }, 413);
    let input: unknown;
    try { input = JSON.parse(raw); } catch { return adminJson({ error: '设置内容无效' }, 400); }
    await saveAmbassador(createAdminClient(), owner.id, input);
    return adminJson({ ok: true });
  } catch (error) {
    if (error instanceof AmbassadorInputError) return adminJson({ error: error.message }, 400);
    return adminJson({ error: '保存失败，请刷新后核对状态' }, 503);
  }
}
