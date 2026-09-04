import { NextResponse } from 'next/server';
import { isCommunityUUID, type CommunityContentKind } from '@/lib/communityModeration';
import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('jianzhongsheng_user_blocks')
    .select('id, blocked_user_id, blocked_display_id, created_at')
    .eq('blocker_id', user.id)
    .order('created_at', { ascending: false });
  if (error) {
    return NextResponse.json({ error: '屏蔽列表暂时无法读取' }, { status: 500 });
  }
  return NextResponse.json({
    blocks: (data ?? []).map((row) => ({
      id: row.id,
      authorId: row.blocked_display_id,
      createdAt: row.created_at,
    })),
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '登录后才能屏蔽用户' }, { status: 401 });

  let payload: { contentType?: unknown; contentId?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: '屏蔽信息无效' }, { status: 400 });
  }
  const contentType = payload.contentType as CommunityContentKind;
  if (!['answer', 'comment'].includes(contentType) || !isCommunityUUID(payload.contentId)) {
    return NextResponse.json({ error: '内容编号无效' }, { status: 400 });
  }

  const admin = createAdminClient();
  const table = contentType === 'answer' ? 'jianzhongsheng_answers' : 'jianzhongsheng_comments';
  const { data: target } = await admin
    .from(table)
    .select('user_id, display_id')
    .eq('id', payload.contentId)
    .maybeSingle();
  if (!target) return NextResponse.json({ error: '内容已经不存在' }, { status: 404 });
  if (target.user_id === user.id) {
    return NextResponse.json({ error: '不能屏蔽自己' }, { status: 400 });
  }

  const { error } = await admin.from('jianzhongsheng_user_blocks').upsert({
    blocker_id: user.id,
    blocked_user_id: target.user_id,
    blocked_display_id: target.display_id,
  }, { onConflict: 'blocker_id,blocked_user_id' });
  if (error) {
    console.error('jianzhongsheng block save error:', error);
    return NextResponse.json({ error: '暂时无法屏蔽此人' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, message: `已屏蔽 ${target.display_id}` });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  const blockId = new URL(request.url).searchParams.get('id');
  if (!isCommunityUUID(blockId)) {
    return NextResponse.json({ error: '屏蔽记录无效' }, { status: 400 });
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from('jianzhongsheng_user_blocks')
    .delete()
    .eq('id', blockId)
    .eq('blocker_id', user.id);
  if (error) return NextResponse.json({ error: '暂时无法取消屏蔽' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

