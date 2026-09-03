import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

const TABLE = 'jianzhongsheng_answers';
const MIN_LENGTH = 15;
const MAX_LENGTH = 3000;

type AnswerRow = {
  id: string;
  user_id: string;
  display_id: string;
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
    body: row.body,
    createdAt: row.created_at,
    mine: currentUserId === row.user_id,
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
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, user_id, display_id, body, created_at')
    .eq('question_id', questionId)
    .order('created_at', { ascending: true })
    .limit(120);

  if (error) {
    console.error('jianzhongsheng answers fetch error:', error);
    return NextResponse.json({ answers: [], unavailable: true }, { status: 503 });
  }

  return NextResponse.json({
    answers: ((data ?? []) as AnswerRow[]).map((row) => publicAnswer(row, user?.id)),
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '登录后手记才会进入众声' }, { status: 401 });

  let payload: { questionId?: unknown; body?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: '手记内容无效' }, { status: 400 });
  }

  if (!validQuestionId(payload.questionId)) {
    return NextResponse.json({ error: '问题编号无效' }, { status: 400 });
  }
  const body = typeof payload.body === 'string' ? payload.body.trim() : '';
  if (body.length < MIN_LENGTH || body.length > MAX_LENGTH) {
    return NextResponse.json({ error: `手记需要在 ${MIN_LENGTH}—${MAX_LENGTH} 字之间` }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('nickname')
    .eq('user_id', user.id)
    .maybeSingle();
  const nickname = typeof profile?.nickname === 'string' ? profile.nickname.trim().slice(0, 24) : '';
  const displayId = nickname || anonymousDisplayId(user.id);

  const { data, error } = await supabase
    .from(TABLE)
    .upsert({
      question_id: payload.questionId,
      user_id: user.id,
      display_id: displayId,
      body,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'question_id,user_id' })
    .select('id, user_id, display_id, body, created_at')
    .single();

  if (error) {
    console.error('jianzhongsheng answer save error:', error);
    return NextResponse.json({ error: '手记暂时无法进入众声' }, { status: 500 });
  }

  return NextResponse.json({ answer: publicAnswer(data as AnswerRow, user.id) });
}
