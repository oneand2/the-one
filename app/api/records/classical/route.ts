import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

const TABLE = 'daoyoushuju';
const RECORD_TYPE = 'classical_bazi';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from(TABLE)
    .select('id, input_data, created_at')
    .eq('user_id', user.id)
    .eq('type', RECORD_TYPE)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('classical list error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const list = (data || []).map((row: { id: string; input_data: { params?: Record<string, unknown> }; created_at: string }) => ({
    id: row.id,
    params: (row.input_data && typeof row.input_data === 'object' && row.input_data.params) ? row.input_data.params as Record<string, string> : {},
    created_at: row.created_at,
  }));
  return NextResponse.json(list);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '无效 JSON' }, { status: 400 });
  }

  const params = body.params as Record<string, unknown> | null;
  if (!params || typeof params !== 'object') {
    return NextResponse.json({ error: '缺少 params' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      user_id: user.id,
      type: RECORD_TYPE,
      input_data: { params },
    })
    .select('id, created_at')
    .single();

  if (error) {
    console.error('classical save error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ id: data.id, params, created_at: data.created_at });
}
