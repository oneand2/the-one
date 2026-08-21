import { NextResponse } from 'next/server';
import { getWechatLoginConfig } from '@/lib/auth/wechat';
import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const config = getWechatLoginConfig();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }
  if (!config.enabled) {
    return NextResponse.json({ configured: false, bound: false });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('wechat_identities')
    .select('nickname, avatar_url')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('wechat status query failed:', error);
    return NextResponse.json({ error: '暂时无法查询微信绑定状态' }, { status: 500 });
  }

  return NextResponse.json({
    configured: true,
    bound: Boolean(data),
    nickname: data?.nickname ?? null,
    avatarUrl: data?.avatar_url ?? null,
  });
}
