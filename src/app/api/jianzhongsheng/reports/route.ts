import { NextResponse } from 'next/server';
import { isCommunityUUID, type CommunityContentKind } from '@/lib/communityModeration';
import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

const REASONS = new Set(['sexual', 'hate', 'harassment', 'dangerous', 'spam', 'other']);

type ReportBody = {
  contentType?: unknown;
  contentId?: unknown;
  reason?: unknown;
  details?: unknown;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '登录后才能举报内容' }, { status: 401 });

  let payload: ReportBody;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: '举报信息无效' }, { status: 400 });
  }

  const contentType = payload.contentType as CommunityContentKind;
  const contentId = payload.contentId;
  const reason = typeof payload.reason === 'string' ? payload.reason : '';
  const details = typeof payload.details === 'string' ? payload.details.trim().slice(0, 500) : '';
  if (!['answer', 'comment'].includes(contentType) || !isCommunityUUID(contentId) || !REASONS.has(reason)) {
    return NextResponse.json({ error: '请选择有效的举报原因' }, { status: 400 });
  }

  const admin = createAdminClient();
  const table = contentType === 'answer' ? 'jianzhongsheng_answers' : 'jianzhongsheng_comments';
  const { data: target } = await admin
    .from(table)
    .select('id, user_id, display_id, body, moderation_status')
    .eq('id', contentId)
    .maybeSingle();
  if (!target || target.moderation_status !== 'visible') {
    return NextResponse.json({ error: '这条内容已经无法查看' }, { status: 404 });
  }
  if (target.user_id === user.id) {
    return NextResponse.json({ error: '不能举报自己的内容，可直接删除' }, { status: 400 });
  }

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: recentReports } = await admin
    .from('jianzhongsheng_reports')
    .select('id', { count: 'exact', head: true })
    .eq('reporter_id', user.id)
    .gte('created_at', oneDayAgo);
  if ((recentReports ?? 0) >= 20) {
    return NextResponse.json({ error: '今天提交的举报较多，请稍后再试' }, { status: 429 });
  }

  const { error } = await admin.from('jianzhongsheng_reports').upsert({
    reporter_id: user.id,
    target_user_id: target.user_id,
    content_type: contentType,
    content_id: contentId,
    reason,
    details: details || null,
    snapshot_display_id: target.display_id,
    snapshot_body: target.body,
    status: 'open',
    resolution: null,
    resolved_at: null,
    resolved_by: null,
  }, { onConflict: 'reporter_id,content_type,content_id' });
  if (error) {
    console.error('jianzhongsheng report save error:', error);
    return NextResponse.json({ error: '举报暂时无法提交' }, { status: 500 });
  }

  const { count: reportCount } = await admin
    .from('jianzhongsheng_reports')
    .select('id', { count: 'exact', head: true })
    .eq('content_type', contentType)
    .eq('content_id', contentId)
    .eq('status', 'open');
  if ((reportCount ?? 0) >= 3) {
    await admin.from(table).update({
      moderation_status: 'hidden',
      moderation_reason: '收到多次用户举报，等待管理员复核',
      moderated_at: new Date().toISOString(),
    }).eq('id', contentId);
  }

  return NextResponse.json({ ok: true, message: '举报已收到，我们会尽快处理' });
}

