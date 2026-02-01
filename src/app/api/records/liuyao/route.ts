import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

const TABLE = 'daoyoushuju';
const RECORD_TYPE = 'liuyao';

type LiuyaoPayload = {
  question?: string;
  hexagram_info?: Record<string, unknown>;
  date?: string;
  ai_result?: string;
};

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get('id');
  if (id) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('id, input_data, created_at')
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('type', RECORD_TYPE)
      .single();
    if (error || !data) {
      return NextResponse.json({ error: error?.message || '未找到' }, { status: 404 });
    }
    const p = (data.input_data as LiuyaoPayload) || {};
    return NextResponse.json({
      id: data.id,
      question: p.question ?? '',
      hexagram_info: p.hexagram_info ?? {},
      date: p.date ?? '',
      ai_result: p.ai_result ?? '',
      created_at: data.created_at,
    });
  }

  const { data, error } = await supabase
    .from(TABLE)
    .select('id, input_data, created_at')
    .eq('user_id', user.id)
    .eq('type', RECORD_TYPE)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('liuyao list error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const list = (data || []).map((row: { id: string; input_data: LiuyaoPayload; created_at: string }) => {
    const p = row.input_data || {};
    return {
      id: row.id,
      question: p.question ?? '',
      hexagram_info: p.hexagram_info ?? {},
      date: p.date ?? '',
      ai_result: typeof p.ai_result === 'string' ? p.ai_result : '',
      created_at: row.created_at,
    };
  });
  return NextResponse.json(list);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  let body: { question?: string; hexagram_info?: Record<string, unknown>; date?: string; ai_result?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '无效 JSON' }, { status: 400 });
  }

  const question = body.question ?? '';
  const hexagram_info = body.hexagram_info ?? {};
  const date = body.date ?? '';
  const ai_result = typeof body.ai_result === 'string' ? body.ai_result : '';

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      user_id: user.id,
      type: RECORD_TYPE,
      input_data: { question, hexagram_info, date, ai_result },
    })
    .select('id, created_at')
    .single();

  if (error) {
    console.error('liuyao save error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ id: data.id, created_at: data.created_at });
}
