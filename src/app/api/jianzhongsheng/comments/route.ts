import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { jianZhongShengSpace } from '@/content/jianzhongsheng';
import { isCommunityUUID, moderateCommunityText } from '@/lib/communityModeration';
import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

const TABLE = 'jianzhongsheng_comments';
const MAX_LENGTH = 800;

type CommentRow = {
  id: string;
  entry_id: string;
  user_id: string;
  display_id: string;
  body: string;
  created_at: string;
};

function validEntryId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9-]{1,120}$/i.test(value);
}

function publicComment(row: CommentRow, currentUserId?: string) {
  return {
    id: row.id,
    entryId: row.entry_id,
    authorId: row.display_id,
    body: row.body,
    createdAt: row.created_at,
    mine: currentUserId === row.user_id,
    reportable: Boolean(currentUserId && currentUserId !== row.user_id),
  };
}

function anonymousDisplayId(userId: string) {
  const digest = createHash('sha256').update(`jianzhongsheng:${userId}`).digest();
  const beginnings = ['听雨', '归舟', '远山', '晚潮', '微光', '青禾', '长风', '浮云'];
  const endings = ['客', '人', '灯', '岸', '川', '野', '窗', '渡'];
  return `${beginnings[digest[0] % beginnings.length]}${endings[digest[1] % endings.length]}`;
}

export async function GET(request: Request) {
  const entryId = new URL(request.url).searchParams.get('entryId');
  if (!validEntryId(entryId)) {
    return NextResponse.json({ error: '手记编号无效' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (isCommunityUUID(entryId)) {
    const admin = createAdminClient();
    let { data: answer, error: answerError } = await admin
      .from('jianzhongsheng_answers')
      .select('id, moderation_status')
      .eq('id', entryId)
      .maybeSingle();
    if (answerError) {
      const fallback = await admin
        .from('jianzhongsheng_answers')
        .select('id')
        .eq('id', entryId)
        .maybeSingle();
      answer = fallback.data ? { ...fallback.data, moderation_status: 'visible' } : null;
      answerError = fallback.error;
    }
    if (answerError || !answer || answer.moderation_status !== 'visible') {
      return NextResponse.json({ comments: [], canComment: Boolean(user), unavailable: true }, { status: 404 });
    }
  }
  let blockedUserIds = new Set<string>();
  if (user) {
    const admin = createAdminClient();
    const { data: blocks } = await admin
      .from('jianzhongsheng_user_blocks')
      .select('blocked_user_id')
      .eq('blocker_id', user.id);
    blockedUserIds = new Set((blocks ?? []).map((row) => String(row.blocked_user_id)));
  }
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, entry_id, user_id, display_id, body, created_at')
    .eq('entry_id', entryId)
    .order('created_at', { ascending: true })
    .limit(200);

  if (error) {
    console.error('jianzhongsheng comments fetch error:', error);
    return NextResponse.json({ comments: [], unavailable: true }, { status: 503 });
  }

  return NextResponse.json({
    comments: ((data ?? []) as CommentRow[])
      .filter((row) => !blockedUserIds.has(row.user_id))
      .map((row) => publicComment(row, user?.id)),
    canComment: Boolean(user),
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '登录后才能留下回应' }, { status: 401 });

  let payload: { entryId?: unknown; body?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: '回应内容无效' }, { status: 400 });
  }

  if (!validEntryId(payload.entryId)) {
    return NextResponse.json({ error: '手记编号无效' }, { status: 400 });
  }
  const moderation = moderateCommunityText(payload.body, { minLength: 1, maxLength: MAX_LENGTH });
  if (!moderation.ok) {
    return NextResponse.json({ error: moderation.message }, { status: 400 });
  }
  const body = moderation.text;

  const admin = createAdminClient();
  const isPublishedEntry = jianZhongShengSpace.entries.some((entry) => entry.id === payload.entryId);
  if (!isPublishedEntry && isCommunityUUID(payload.entryId)) {
    let { data: entry, error: entryError } = await admin
      .from('jianzhongsheng_answers')
      .select('id, moderation_status')
      .eq('id', payload.entryId)
      .maybeSingle();
    if (entryError) {
      const fallback = await admin
        .from('jianzhongsheng_answers')
        .select('id')
        .eq('id', payload.entryId)
        .maybeSingle();
      entry = fallback.data ? { ...fallback.data, moderation_status: 'visible' } : null;
      entryError = fallback.error;
    }
    if (entryError) {
      console.error('jianzhongsheng answer validation error:', entryError);
      return NextResponse.json({ error: '这则手记当前无法回应' }, { status: 503 });
    }
    if (!entry || entry.moderation_status !== 'visible') {
      return NextResponse.json({ error: '这则手记当前无法回应' }, { status: 404 });
    }
  } else if (!isPublishedEntry) {
    return NextResponse.json({ error: '这则手记不存在' }, { status: 404 });
  }

  let { data: profile, error: profileError } = await admin
    .from('user_profiles')
    .select('nickname, community_suspended_until')
    .eq('user_id', user.id)
    .maybeSingle();
  if (profileError) {
    const fallback = await admin
      .from('user_profiles')
      .select('nickname')
      .eq('user_id', user.id)
      .maybeSingle();
    profile = fallback.data as typeof profile;
    profileError = fallback.error;
  }
  if (profileError) {
    console.error('jianzhongsheng profile fetch error:', profileError);
  }
  const suspendedUntil = (profile as { community_suspended_until?: string | null } | null)?.community_suspended_until;
  if (suspendedUntil && new Date(suspendedUntil).getTime() > Date.now()) {
    return NextResponse.json({ error: '你的众生回应功能暂时停用，请稍后再试或联系支持' }, { status: 403 });
  }
  const nickname = typeof profile?.nickname === 'string' ? profile.nickname.trim().slice(0, 24) : '';
  const displayId = nickname || anonymousDisplayId(user.id);

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { count } = await admin
    .from(TABLE)
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', fiveMinutesAgo);
  if ((count ?? 0) >= 12) {
    return NextResponse.json({ error: '回应得有些快，请稍后再写' }, { status: 429 });
  }

  const { data, error } = await admin
    .from(TABLE)
    .insert({
      entry_id: payload.entryId,
      user_id: user.id,
      display_id: displayId,
      body,
    })
    .select('id, entry_id, user_id, display_id, body, created_at')
    .single();

  if (error) {
    console.error('jianzhongsheng comment save error:', error);
    return NextResponse.json({ error: '回应暂时未能留下' }, { status: 500 });
  }

  return NextResponse.json({ comment: publicComment(data as CommentRow, user.id) });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  const contentId = new URL(request.url).searchParams.get('id');
  if (!isCommunityUUID(contentId)) {
    return NextResponse.json({ error: '回应编号无效' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: comment } = await admin
    .from(TABLE)
    .select('id, user_id')
    .eq('id', contentId)
    .maybeSingle();
  if (!comment || comment.user_id !== user.id) {
    return NextResponse.json({ error: '只能删除自己的回应' }, { status: 403 });
  }

  const { error } = await admin.from(TABLE).delete().eq('id', contentId).eq('user_id', user.id);
  if (error) {
    console.error('jianzhongsheng comment delete error:', error);
    return NextResponse.json({ error: '回应暂时无法删除' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
