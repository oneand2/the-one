import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

const TABLE = 'jianzhongsheng_comments';
const MAX_LENGTH = 500;

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
    comments: ((data ?? []) as CommentRow[]).map((row) => publicComment(row, user?.id)),
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
  const body = typeof payload.body === 'string' ? payload.body.trim() : '';
  if (!body || body.length > MAX_LENGTH) {
    return NextResponse.json({ error: `回应需要在 1—${MAX_LENGTH} 字之间` }, { status: 400 });
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
