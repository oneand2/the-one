import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

const PROFILE_TABLE = 'user_profiles';
const INITIAL_COINS = 300;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const { data: row, error: profileError } = await supabase
    .from(PROFILE_TABLE)
    .select('nickname, coins_balance, invite_code, vip_expires_at')
    .eq('user_id', user.id)
    .single();

  if (row) {
    const { data: preferenceRow } = await supabase
      .from(PROFILE_TABLE)
      .select('juexingcang_meditation_default')
      .eq('user_id', user.id)
      .maybeSingle();
    return NextResponse.json({
      nickname: row.nickname ?? '',
      coins_balance: row.coins_balance ?? INITIAL_COINS,
      invite_code: row.invite_code ?? null,
      vip_expires_at: (row as { vip_expires_at?: string | null }).vip_expires_at ?? null,
      juexingcang_meditation_default: (preferenceRow as { juexingcang_meditation_default?: boolean } | null)?.juexingcang_meditation_default ?? true,
    });
  }

  if (profileError && profileError.code !== 'PGRST116') {
    console.error('profile fetch error:', profileError);
  }

  const nickname = (user.user_metadata?.nickname as string)?.trim() ?? '';
  const { data: inserted, error } = await supabase
    .from(PROFILE_TABLE)
    .insert({ user_id: user.id, nickname })
    .select('nickname, coins_balance, invite_code, vip_expires_at')
    .single();

  if (error) {
    console.error('profile ensure insert error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    nickname: inserted.nickname ?? '',
    coins_balance: inserted.coins_balance ?? INITIAL_COINS,
    invite_code: inserted.invite_code ?? null,
    vip_expires_at: (inserted as { vip_expires_at?: string | null }).vip_expires_at ?? null,
    juexingcang_meditation_default: (inserted as { juexingcang_meditation_default?: boolean }).juexingcang_meditation_default ?? true,
  });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  let body: { nickname?: unknown; juexingcang_meditation_default?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '无效 JSON' }, { status: 400 });
  }

  const updates: { user_id: string; nickname?: string; juexingcang_meditation_default?: boolean } = {
    user_id: user.id,
  };
  if (typeof body.nickname === 'string') {
    updates.nickname = body.nickname.trim().slice(0, 50);
  }
  if (typeof body.juexingcang_meditation_default === 'boolean') {
    updates.juexingcang_meditation_default = body.juexingcang_meditation_default;
  }
  if (updates.nickname === undefined && updates.juexingcang_meditation_default === undefined) {
    return NextResponse.json({ error: '没有可保存的设置' }, { status: 400 });
  }

  const { error } = await supabase
    .from(PROFILE_TABLE)
    .upsert(updates, { onConflict: 'user_id' });

  if (error) {
    if (updates.juexingcang_meditation_default !== undefined && /juexingcang_meditation_default|schema cache/i.test(error.message)) {
      return NextResponse.json({ error: '偏好设置正在同步，请先完成数据库更新后再试' }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
