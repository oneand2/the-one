import type { SupabaseClient } from '@supabase/supabase-js';
import { isCommunityUUID } from '@/lib/communityModeration';
import { getVipExpiresAt, type VipDuration } from '@/utils/vip';

export class AdminInputError extends Error {}
const invalid = (message: string): never => { throw new AdminInputError(message); };

export function validateMutation(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return invalid('操作信息无效');
  const body = input as Record<string, unknown>;
  if (!isCommunityUUID(body.id)) return invalid('记录编号无效');
  const entity = String(body.entity);
  const action = String(body.action);
  if (entity === 'answers' || entity === 'comments') {
    if (!['hide', 'restore'].includes(action)) return invalid('内容操作无效');
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (reason.length < 2 || reason.length > 300) return invalid('请填写 2—300 字的处理原因');
    return { entity, id: body.id, action, reason };
  }
  if (entity === 'users') {
    if (!['suspend7d', 'resume', 'vip'].includes(action)) return invalid('用户操作无效');
    const duration = String(body.duration) as VipDuration;
    if (action === 'vip' && !['1m', '3m', '6m', '1y', 'lifetime'].includes(duration)) return invalid('会员期限无效');
    return { entity, id: body.id, action, duration };
  }
  if (entity === 'insights' && action === 'save') {
    const fields: Record<string, string> = {};
    const labels: Record<string, string> = { title: '标题', source_label: '简短出处', original_language: '原文语种', original_text: '原文', body: '正文', sources: '完整来源' };
    for (const [key, min, max] of [
      ['title', 2, 5], ['source_label', 2, 24], ['original_language', 2, 12],
      ['original_text', 20, 1600], ['body', 120, 400], ['sources', 1, 6000],
    ] as const) {
      const text = typeof body[key] === 'string' ? body[key].trim() : '';
      if (Array.from(text).length < min || Array.from(text).length > max) return invalid(`${labels[key]}长度应为 ${min}—${max} 字`);
      fields[key] = text;
    }
    if (/[。？！，、；：]/.test(fields.title)) return invalid('标题请使用二至五字的简短题眼，不加标点');
    const paragraphs = fields.body.split(/\n\s*\n/).filter(p => p.trim());
    if (paragraphs.length < 3 || paragraphs.length > 6) return invalid('正文请分为三至六段，段落之间空一行');
    return { entity, id: body.id, action, fields };
  }
  return invalid('不支持这项操作');
}

export async function applyAdminMutation(client: SupabaseClient, adminId: string, input: unknown) {
  const change = validateMutation(input);
  if (change.entity === 'answers' || change.entity === 'comments') {
    const { data, error } = await client.from(`jianzhongsheng_${change.entity}`).update({
      moderation_status: change.action === 'hide' ? 'hidden' : 'visible', moderation_reason: change.reason,
      moderated_by: adminId, moderated_at: new Date().toISOString(),
    }).eq('id', change.id).select('id').maybeSingle();
    if (error) throw new Error('内容状态保存失败');
    if (!data) return invalid('内容不存在或已被删除');
  } else if (change.entity === 'users') {
    if (change.id === adminId && change.action === 'suspend7d') return invalid('不能暂停自己的发言权限');
    const { data: account, error: accountError } = await client.auth.admin.getUserById(change.id);
    if (accountError || !account.user) return invalid('用户不存在');
    const fields = change.action === 'vip'
      ? { vip_expires_at: '' }
      : { community_suspended_until: change.action === 'resume' ? null : new Date(Date.now() + 7 * 86400000).toISOString() };
    // Send ISO dates; preserve existing balances/nicknames through a narrow upsert.
    if (change.action === 'vip') {
      const expiry = getVipExpiresAt(change.duration!);
      fields.vip_expires_at = typeof expiry === 'string' ? expiry : expiry.toISOString();
    }
    const { error } = await client.from('user_profiles').upsert({ user_id: change.id, ...fields }, { onConflict: 'user_id' });
    if (error) throw new Error('用户设置保存失败');
  } else {
    const { data, error } = await client.from('daily_insights').update(change.fields!).eq('id', change.id).select('id').maybeSingle();
    if (error) throw new Error('见闻保存失败');
    if (!data) return invalid('见闻不存在');
  }
}
