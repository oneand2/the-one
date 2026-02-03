import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

const PROFILE_TABLE = 'user_profiles';
const INITIAL_COINS = 50;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const { data: row } = await supabase
    .from(PROFILE_TABLE)
    .select('nickname, coins_balance, invite_code, vip_expires_at')
    .eq('user_id', user.id)
    .single();

  if (row) {
    return NextResponse.json({
      nickname: row.nickname ?? '',
      coins_balance: row.coins_balance ?? INITIAL_COINS,
      invite_code: row.invite_code ?? null,
      vip_expires_at: (row as { vip_expires_at?: string | null }).vip_expires_at ?? null,
    });
  }

  const nickname = (user.user_metadata?.nickname as string)?.trim() ?? '';
  const { data: inserted, error } = await supabase
    .from(PROFILE_TABLE)
    .insert({ user_id: user.id, nickname, coins_balance: INITIAL_COINS })
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
  });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  let body: { nickname?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '无效 JSON' }, { status: 400 });
  }

  const nickname = typeof body.nickname === 'string' ? body.nickname.trim().slice(0, 50) : undefined;
  if (nickname === undefined) {
    return NextResponse.json({ error: '缺少 nickname' }, { status: 400 });
  }

  const { error } = await supabase
    .from(PROFILE_TABLE)
    .upsert({ user_id: user.id, nickname }, { onConflict: 'user_id' });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
