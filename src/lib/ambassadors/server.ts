import type { SupabaseClient, User } from '@supabase/supabase-js';
import { isAdminIdentity } from '@/lib/admin/policy';
import { isCommunityUUID } from '@/lib/communityModeration';
import { AMBASSADOR_VIEWS, CODE_PATTERN, type ConsoleAccess } from './shared';

export class AmbassadorInputError extends Error {}
export class AmbassadorForbiddenError extends Error {}
export async function resolveConsoleAccess(client: SupabaseClient, user: User | null): Promise<ConsoleAccess | null> {
  if (!user) return null;
  if (isAdminIdentity(user)) return { role: 'owner', ambassadorId: null, name: '管理员' };
  if (!user.email_confirmed_at) return null;
  const { data, error } = await client.from('ambassadors').select('id,name').eq('user_id', user.id).eq('active', true).maybeSingle();
  if (error) throw new Error('推广大使身份暂时无法读取');
  return data ? { role: 'ambassador', ambassadorId: data.id, name: data.name } : null;
}
export function resolveScope(access: ConsoleAccess, requested: string | null, view: string) {
  if (access.role === 'ambassador') {
    if (!AMBASSADOR_VIEWS.includes(view) || (requested && requested !== access.ambassadorId)) throw new AmbassadorForbiddenError('只能查看自己名下的数据');
    return access.ambassadorId!;
  }
  if (requested && !isCommunityUUID(requested)) throw new AmbassadorInputError('推广大使编号无效');
  if (requested && !AMBASSADOR_VIEWS.includes(view)) throw new AmbassadorInputError('此页面不支持按推广大使筛选');
  return requested || null;
}
export function parseReportDates(params: URLSearchParams) {
  const start = params.get('start') || '';
  const end = params.get('end') || '';
  const valid = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
  if ((start && !valid(start)) || (end && !valid(end)) || (start && end && start > end)) throw new AmbassadorInputError('日期范围无效');
  return { start: start ? new Date(`${start}T00:00:00+08:00`).toISOString() : null,
    end: end ? new Date(Date.parse(`${end}T00:00:00+08:00`) + 86400000).toISOString() : null };
}
export async function validReferralToken(client: SupabaseClient, token?: string) {
  if (!isCommunityUUID(token)) return undefined;
  const { data, error } = await client.from('ambassador_visits').select('token,ambassadors!inner(active)')
    .eq('token', token).eq('ambassadors.active', true).gt('expires_at', new Date().toISOString()).maybeSingle();
  if (error) throw new Error('推广来源暂时无法确认，请重试');
  return data?.token as string | undefined;
}
export async function saveAmbassador(client: SupabaseClient, ownerId: string, input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AmbassadorInputError('设置内容无效');
  const body = input as Record<string, unknown>;
  if (body.action === 'status') {
    if (!isCommunityUUID(body.id) || typeof body.active !== 'boolean') throw new AmbassadorInputError('大使状态无效');
    const { data, error } = await client.from('ambassadors').update({ active: body.active }).eq('id', body.id).select('id').maybeSingle();
    if (error) throw new Error('状态保存失败');
    if (!data) throw new AmbassadorInputError('推广大使不存在');
    return;
  }
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const code = typeof body.code === 'string' ? body.code.trim().toLowerCase() : '';
  if (body.action !== 'create' || !isCommunityUUID(body.userId) || !name || name.length > 50 || !CODE_PATTERN.test(code)) throw new AmbassadorInputError('请填写用户编号、1—50 字名称和 3—32 位英文小写字母、数字或短横线代号');
  const { data, error } = await client.auth.admin.getUserById(body.userId);
  if (error || !data.user?.email_confirmed_at) throw new AmbassadorInputError('请选择已完成注册验证的用户');
  if (isAdminIdentity(data.user)) throw new AmbassadorInputError('管理员已有全站权限，无需设为推广大使');
  const result = await client.from('ambassadors').insert({ user_id: body.userId, name, code, created_by: ownerId });
  if (result.error?.code === '23505') throw new AmbassadorInputError('此用户已是推广大使，或专属代号已被使用');
  if (result.error) throw new Error('推广大使保存失败');
}
