import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getDailyHexagramPeriod } from '@/utils/dailyHexagram';

export const dynamic = 'force-dynamic';

const TABLE = 'daoyoushuju';
const RECORD_TYPE = 'daily_hexagram';

type DrawPayload = {
  period_key?: string;
  hexagram_index?: number;
};

function getAccountHexagramIndex(userId: string, periodKey: string) {
  const digest = createHash('sha256')
    .update(`${userId}:${periodKey}`)
    .digest();
  return (digest.readUInt32BE(0) % 64) + 1;
}

function toDraw(row: { id: string; input_data: DrawPayload; created_at: string } | null) {
  const index = row?.input_data?.hexagram_index;
  if (!row || typeof index !== 'number' || !Number.isInteger(index) || index < 1 || index > 64) return null;
  return {
    id: row.id,
    hexagramIndex: index,
    createdAt: row.created_at,
  };
}

async function findCurrentDraw(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  periodKey: string,
) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, input_data, created_at')
    .eq('user_id', userId)
    .eq('type', RECORD_TYPE)
    .contains('input_data', { period_key: periodKey })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return toDraw(data as { id: string; input_data: DrawPayload; created_at: string } | null);
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const periodKey = getDailyHexagramPeriod();
  try {
    const draw = await findCurrentDraw(supabase, user.id, periodKey);
    return NextResponse.json({ periodKey, draw });
  } catch (error) {
    console.error('daily hexagram fetch error:', error);
    return NextResponse.json({ error: '读取每日一卦失败' }, { status: 500 });
  }
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const periodKey = getDailyHexagramPeriod();
  try {
    const existing = await findCurrentDraw(supabase, user.id, periodKey);
    if (existing) return NextResponse.json({ periodKey, draw: existing });

    // Stable for this account and Mao-hour period, including simultaneous draws on two devices.
    const hexagramIndex = getAccountHexagramIndex(user.id, periodKey);
    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        user_id: user.id,
        type: RECORD_TYPE,
        input_data: { period_key: periodKey, hexagram_index: hexagramIndex },
      })
      .select('id, input_data, created_at')
      .single();

    if (error) throw error;
    return NextResponse.json({
      periodKey,
      draw: toDraw(data as { id: string; input_data: DrawPayload; created_at: string }),
    });
  } catch (error) {
    console.error('daily hexagram draw error:', error);
    return NextResponse.json({ error: '抽取每日一卦失败' }, { status: 500 });
  }
}
