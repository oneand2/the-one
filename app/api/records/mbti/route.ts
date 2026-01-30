import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

const TABLE = 'daoyoushuju';
const RECORD_TYPE = 'mbti';

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
    const p = (data.input_data as { type?: string; function_scores?: Record<string, number> }) || {};
    return NextResponse.json({
      id: data.id,
      type: p.type ?? '',
      function_scores: p.function_scores ?? {},
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
    console.error('mbti list error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const list = (data || []).map((row: { id: string; input_data: { type?: string; function_scores?: Record<string, number> }; created_at: string }) => {
    const p = (row.input_data && typeof row.input_data === 'object' ? row.input_data : {}) as { type?: string; function_scores?: Record<string, number> };
    return {
      id: row.id,
      type: p.type ?? '',
      function_scores: p.function_scores ?? {},
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

  let body: { type?: string; function_scores?: Record<string, number> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '无效 JSON' }, { status: 400 });
  }

  const type = body.type;
  const function_scores = body.function_scores;

  if (!type || typeof type !== 'string') {
    return NextResponse.json({ error: '缺少 type' }, { status: 400 });
  }
  if (!function_scores || typeof function_scores !== 'object') {
    return NextResponse.json({ error: '缺少 function_scores' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      user_id: user.id,
      type: RECORD_TYPE,
      input_data: { type, function_scores },
    })
    .select('id, created_at')
    .single();

  if (error) {
    console.error('mbti save error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ id: data.id, type, created_at: data.created_at });
}
