import { NextResponse } from 'next/server';
import { getAdminUser, isSameOrigin, adminJson } from '@/lib/admin/access';
import { isCommunityUUID } from '@/lib/communityModeration';
import { createAdminClient } from '@/utils/supabase/admin';

export const dynamic = 'force-dynamic';

const STATUSES = new Set(['open', 'resolved', 'dismissed']);
const ACTIONS = new Set(['hide', 'remove', 'restore', 'dismiss', 'suspend7d']);

async function readReports(request: Request) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: '无权限' }, { status: 403 });

  const requestedStatus = new URL(request.url).searchParams.get('status') ?? 'open';
  const status = STATUSES.has(requestedStatus) ? requestedStatus : 'open';
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('jianzhongsheng_reports')
    .select('id, content_type, content_id, reason, details, snapshot_display_id, snapshot_body, status, resolution, created_at, resolved_at')
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) {
    console.error('community reports fetch error:', error);
    return NextResponse.json({ error: '举报列表暂时无法读取' }, { status: 500 });
  }

  const { count: openCount, error: countError } = await admin
    .from('jianzhongsheng_reports')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'open');

  if (countError || openCount === null) return adminJson({ error: '举报统计暂时无法读取' }, 503);
  return adminJson({ reports: data ?? [], openCount });
}

async function updateReport(request: Request) {
  if (!isSameOrigin(request)) return adminJson({ error: '请求来源无效' }, 403);
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: '无权限' }, { status: 403 });

  let payload: { reportId?: unknown; action?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: '操作信息无效' }, { status: 400 });
  }
  if (!payload || typeof payload !== 'object') return adminJson({ error: '操作信息无效' }, 400);
  const reportId = typeof payload.reportId === 'string' ? payload.reportId : '';
  const action = typeof payload.action === 'string' ? payload.action : '';
  if (!isCommunityUUID(reportId) || !ACTIONS.has(action)) {
    return NextResponse.json({ error: '请选择有效操作' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: report, error: readError } = await admin
    .from('jianzhongsheng_reports')
    .select('id, content_type, content_id, target_user_id')
    .eq('id', reportId)
    .maybeSingle();
  if (readError) return adminJson({ error: '举报记录暂时无法读取' }, 503);
  if (!report) return NextResponse.json({ error: '举报记录不存在' }, { status: 404 });

  if (action === 'suspend7d' && (!report.target_user_id || report.target_user_id === user.id)) return adminJson({ error: '不能暂停此账户的发言权限' }, 400);
  const table = report.content_type === 'answer' ? 'jianzhongsheng_answers' : 'jianzhongsheng_comments';
  const now = new Date().toISOString();
  const resolveMatchingReports = async (resolution: string, status = 'resolved') => {
    return admin.from('jianzhongsheng_reports').update({
      status,
      resolution,
      resolved_at: now,
      resolved_by: user.id,
    }).eq('content_type', report.content_type).eq('content_id', report.content_id);
  };

  if (action === 'dismiss') {
    const { error: restoreError } = await admin.from(table).update({
      moderation_status: 'visible',
      moderation_reason: null,
      moderated_at: now,
      moderated_by: user.id,
    }).eq('id', report.content_id);
    if (restoreError) return NextResponse.json({ error: '恢复内容失败' }, { status: 500 });
    const { error } = await resolveMatchingReports('管理员复核后保留内容', 'dismissed');
    if (error) return NextResponse.json({ error: '内容已恢复，但举报状态保存失败' }, { status: 500 });
  } else if (action === 'restore') {
    const { error } = await admin.from(table).update({
      moderation_status: 'visible',
      moderation_reason: null,
      moderated_at: now,
      moderated_by: user.id,
    }).eq('id', report.content_id);
    if (error) return NextResponse.json({ error: '恢复内容失败' }, { status: 500 });
    const { error: reportError } = await resolveMatchingReports('管理员复核后恢复内容', 'dismissed');
    if (reportError) return adminJson({ error: '内容已恢复，但举报状态保存失败，请刷新后重试' }, 500);
  } else {
    const moderationStatus = action === 'remove' ? 'removed' : 'hidden';
    const resolution = action === 'suspend7d'
      ? '内容已隐藏，发布者暂停发言 7 天'
      : action === 'remove'
        ? '内容已移除'
        : '内容已隐藏';
    const { error } = await admin.from(table).update({
      moderation_status: moderationStatus,
      moderation_reason: resolution,
      moderated_at: now,
      moderated_by: user.id,
    }).eq('id', report.content_id);
    if (error) return NextResponse.json({ error: '处理内容失败' }, { status: 500 });

    if (action === 'suspend7d' && report.target_user_id) {
      const suspendedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { error: suspendError } = await admin
        .from('user_profiles')
        .upsert({ user_id: report.target_user_id, community_suspended_until: suspendedUntil }, { onConflict: 'user_id' });
      if (suspendError) return NextResponse.json({ error: '内容已隐藏，但暂停发言失败' }, { status: 500 });
    }
    const { error: reportError } = await resolveMatchingReports(resolution);
    if (reportError) return adminJson({ error: '内容已处理，但举报状态保存失败，请刷新后重试' }, 500);
  }

  return NextResponse.json({ ok: true });
}

export async function GET(request: Request) {
  try { return await readReports(request); }
  catch { return adminJson({ error: '举报列表暂时无法读取，请稍后重试' }, 503); }
}

export async function PATCH(request: Request) {
  try { return await updateReport(request); }
  catch { return adminJson({ error: '操作未完成，请刷新确认当前状态后重试' }, 503); }
}
