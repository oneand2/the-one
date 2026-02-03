import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { ADMIN_EMAIL, getVipExpiresAt, type VipDuration } from '@/utils/vip';

const PROFILE_TABLE = 'user_profiles';
const INITIAL_COINS = 50;

const DURATIONS: VipDuration[] = ['1m', '3m', '6m', '1y', 'lifetime'];

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  let body: { target_email?: string; duration?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '无效 JSON' }, { status: 400 });
  }

  const targetEmail = typeof body.target_email === 'string' ? body.target_email.trim().toLowerCase() : '';
  if (!targetEmail) {
    return NextResponse.json({ error: '请填写目标用户邮箱' }, { status: 400 });
  }

  const duration = body.duration as VipDuration | undefined;
  if (!duration || !DURATIONS.includes(duration)) {
    return NextResponse.json({ error: '请选择有效期限：1m / 3m / 6m / 1y / lifetime' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: listData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const targetUser = listData.users.find((u) => (u.email ?? '').toLowerCase() === targetEmail);
  if (!targetUser) {
    return NextResponse.json({ error: '未找到该邮箱对应的用户' }, { status: 404 });
  }

  const expiresAt = getVipExpiresAt(duration);
  const { data: existing } = await admin.from(PROFILE_TABLE).select('user_id').eq('user_id', targetUser.id).single();

  if (existing) {
    const { error } = await admin
      .from(PROFILE_TABLE)
      .update({ vip_expires_at: expiresAt == null ? null : expiresAt.toISOString() })
      .eq('user_id', targetUser.id);
    if (error) {
      console.error('set-vip update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    const { error } = await admin.from(PROFILE_TABLE).insert({
      user_id: targetUser.id,
      nickname: '',
      coins_balance: INITIAL_COINS,
      vip_expires_at: expiresAt == null ? null : expiresAt.toISOString(),
    });
    if (error) {
      console.error('set-vip insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: true,
    message: duration === 'lifetime' ? '已设置为终身 VIP' : `已设置 VIP，到期时间：${expiresAt?.toISOString() ?? ''}`,
  });
}
