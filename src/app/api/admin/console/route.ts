import { AmbassadorForbiddenError, AmbassadorInputError, parseReportDates, resolveScope } from '@/lib/ambassadors/server';
import { getAdminUser, getConsoleAccess, adminJson, isSameOrigin } from '@/lib/admin/access';
import { loadAdminData, parseAdminQuery } from '@/lib/admin/data';
import { AdminInputError, applyAdminMutation } from '@/lib/admin/mutations';
import { createAdminClient } from '@/utils/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const access = await getConsoleAccess();
    if (!access) return adminJson({ error: '请使用管理员或推广大使账户登录' }, 403);
    let query;
    try { query = parseAdminQuery(new URL(request.url).searchParams); }
    catch (error) { return adminJson({ error: (error as Error).message }, 400); }
    const params = new URL(request.url).searchParams;
    const scope = resolveScope(access, params.get('ambassador'), query.view);
    if (query.view === 'ambassadors') return adminJson({ error: '请使用推广大使页面' }, 400);
    const dates = parseReportDates(params);
    return adminJson(await loadAdminData(createAdminClient(), { ...query, ...dates }, scope));
  } catch (error) {
    if (error instanceof AmbassadorForbiddenError) return adminJson({ error: error.message }, 403);
    if (error instanceof AmbassadorInputError) return adminJson({ error: error.message }, 400);
    console.error('admin console read failed', error instanceof Error ? error.message : 'unknown');
    return adminJson({ error: '数据暂时无法读取，请稍后刷新重试' }, 503);
  }
}

export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) return adminJson({ error: '请求来源无效' }, 403);
  try {
    const user = await getAdminUser();
    if (!user) return adminJson({ error: '请使用管理员账户登录' }, 403);
    const raw = await request.text();
    if (raw.length > 30000) return adminJson({ error: '提交内容过长' }, 413);
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return adminJson({ error: '操作信息无效' }, 400); }
    await applyAdminMutation(createAdminClient(), user.id, body);
    return adminJson({ ok: true });
  } catch (error) {
    if (error instanceof AdminInputError) return adminJson({ error: error.message }, 400);
    console.error('admin console update failed', error instanceof Error ? error.message : 'unknown');
    return adminJson({ error: '保存失败，请刷新确认当前状态后重试' }, 503);
  }
}
