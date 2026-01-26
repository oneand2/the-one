import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

const PROFILE_TABLE = 'user_profiles';
const CODE_LEN = 8;
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateInviteCode(): string {
  let s = '';
  for (let i = 0; i < CODE_LEN; i++) {
    s += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return s;
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  for (let tryCount = 0; tryCount < 5; tryCount++) {
    const code = generateInviteCode();
    const { data, error } = await supabase
      .from(PROFILE_TABLE)
      .update({ invite_code: code })
      .eq('user_id', user.id)
      .select('invite_code')
      .single();

    if (error) {
      if (error.code === '23505') continue;
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ invite_code: data.invite_code ?? code });
  }
  return NextResponse.json({ error: '生成失败，请重试' }, { status: 500 });
}
