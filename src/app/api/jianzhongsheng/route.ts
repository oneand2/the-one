import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { moderateCommunityText, isCommunityUUID } from '@/lib/communityModeration';
import { isMissingJianzhongshengTitleColumn, normalizeJianzhongshengTitle } from '@/lib/jianzhongshengTitle';
import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

const TABLE = 'jianzhongsheng_answers';
const MIN_LENGTH = 15;
const MAX_LENGTH = 3000;
const LEGACY_ANSWER_COLUMNS = 'id, user_id, display_id, body, created_at';
const ANSWER_COLUMNS = `${LEGACY_ANSWER_COLUMNS}, title`;

type AnswerRow = {
  id: string;
  user_id: string;
  display_id: string;
  title?: string;
  body: string;
  created_at: string;
};

function validQuestionId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9-]{1,80}$/i.test(value);
}

function publicAnswer(row: AnswerRow, currentUserId?: string) {
  return {
    id: row.id,
    authorId: row.display_id,
    title: row.title ?? '',
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
  const questionId = new URL(request.url).searchParams.get('questionId');
  if (!validQuestionId(questionId)) {
    return NextResponse.json({ error: '问题编号无效' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let blockedUserIds = new Set<string>();
  if (user) {
    const admin = createAdminClient();
    const { data: blocks } = await admin
      .from('jianzhongsheng_user_blocks')
      .select('blocked_user_id')
      .eq('blocker_id', user.id);
    blockedUserIds = new Set((blocks ?? []).map((row) => String(row.blocked_user_id)));
  }
  const initialResult = await supabase
    .from(TABLE)
    .select(ANSWER_COLUMNS)
    .eq('question_id', questionId)
    .order('created_at', { ascending: true })
    .limit(120);
  let data: AnswerRow[] | null = initialResult.data;
  let error = initialResult.error;

  const titlesUnavailable = isMissingJianzhongshengTitleColumn(error);
  if (titlesUnavailable) {
    const fallback = await supabase
      .from(TABLE)
      .select(LEGACY_ANSWER_COLUMNS)
      .eq('question_id', questionId)
      .order('created_at', { ascending: true })
      .limit(120);
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    console.error('jianzhongsheng answers fetch error:', error);
    return NextResponse.json({ answers: [], unavailable: true }, { status: 503 });
  }

  return NextResponse.json({
    ...(titlesUnavailable ? { titlesUnavailable: true } : {}),
    answers: ((data ?? []) as AnswerRow[])
      .filter((row) => !blockedUserIds.has(row.user_id))
      .map((row) => publicAnswer(row, user?.id)),
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '登录后手记才会进入众声' }, { status: 401 });

  let payload: { questionId?: unknown; title?: unknown; body?: unknown };
  try {
    payload = await request.json();
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return NextResponse.json({ error: '手记内容无效' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: '手记内容无效' }, { status: 400 });
  }

  if (!validQuestionId(payload.questionId)) {
    return NextResponse.json({ error: '问题编号无效' }, { status: 400 });
  }
  const title = normalizeJianzhongshengTitle(payload.title);
  if (!title.ok) {
    return NextResponse.json({ error: title.message }, { status: 400 });
  }
  const moderation = moderateCommunityText(payload.body, {
    minLength: MIN_LENGTH,
    maxLength: MAX_LENGTH,
  });
  if (!moderation.ok) {
    return NextResponse.json({ error: moderation.message }, { status: 400 });
  }
  const body = moderation.text;

  const admin = createAdminClient();
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
    return NextResponse.json({ error: '你的众生发布功能暂时停用，请稍后再试或联系支持' }, { status: 403 });
  }
  const nickname = typeof profile?.nickname === 'string' ? profile.nickname.trim().slice(0, 24) : '';
  const displayId = nickname || anonymousDisplayId(user.id);

  const { data: existingAnswer, error: existingError } = await admin
    .from(TABLE)
    .select('moderation_status')
    .eq('question_id', payload.questionId)
    .eq('user_id', user.id)
    .maybeSingle();
  let existing = existingAnswer;
  if (existingError) {
    const fallback = await admin
      .from(TABLE)
      .select('id')
      .eq('question_id', payload.questionId)
      .eq('user_id', user.id)
      .maybeSingle();
    existing = fallback.data ? { moderation_status: 'visible' } : null;
  }
  if (existing && existing.moderation_status !== 'visible') {
    return NextResponse.json({ error: '这则手记正在处理，如需修改请联系支持' }, { status: 403 });
  }

  const answerFields = {
    question_id: payload.questionId,
    user_id: user.id,
    display_id: displayId,
    body,
    updated_at: new Date().toISOString(),
  };
  const initialResult = await admin
    .from(TABLE)
    .upsert({
      ...answerFields,
      // Older clients that omit title must preserve an existing title on update.
      ...(payload.title !== undefined ? { title: title.text } : {}),
    }, { onConflict: 'question_id,user_id' })
    .select(ANSWER_COLUMNS)
    .single();
  let data: AnswerRow | null = initialResult.data;
  let error = initialResult.error;

  if (isMissingJianzhongshengTitleColumn(error)) {
    if (title.text) {
      return NextResponse.json({
        error: '标题功能暂时无法使用，请稍后重试；你的手记尚未发布',
        code: 'TITLE_SCHEMA_UNAVAILABLE',
      }, { status: 503 });
    }
    const fallback = await admin
      .from(TABLE)
      .upsert(answerFields, { onConflict: 'question_id,user_id' })
      .select(LEGACY_ANSWER_COLUMNS)
      .single();
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    console.error('jianzhongsheng answer save error:', error);
    return NextResponse.json({ error: '手记暂时无法进入众声' }, { status: 500 });
  }

  return NextResponse.json({ answer: publicAnswer(data as AnswerRow, user.id) });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  const contentId = new URL(request.url).searchParams.get('id');
  if (!isCommunityUUID(contentId)) {
    return NextResponse.json({ error: '手记编号无效' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: entry } = await admin
    .from(TABLE)
    .select('id, user_id')
    .eq('id', contentId)
    .maybeSingle();
  if (!entry || entry.user_id !== user.id) {
    return NextResponse.json({ error: '只能删除自己的手记' }, { status: 403 });
  }

  await admin.from('jianzhongsheng_comments').delete().eq('entry_id', contentId);
  const { error } = await admin.from(TABLE).delete().eq('id', contentId).eq('user_id', user.id);
  if (error) {
    console.error('jianzhongsheng answer delete error:', error);
    return NextResponse.json({ error: '手记暂时无法删除' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
