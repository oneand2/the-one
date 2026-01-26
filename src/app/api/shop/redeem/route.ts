import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

export const dynamic = 'force-dynamic';

type Body = { code?: string };

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '无效请求体' }, { status: 400 });
  }
  const code = typeof body?.code === 'string' ? body.code.trim() : '';
  if (!code) {
    return NextResponse.json({ error: '请输入兑换码' }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc('redeem_code', {
      p_code: code,
      p_user_id: user.id,
    });
    if (error) {
      if (error.message?.includes('INVALID_OR_USED'))
        return NextResponse.json(
          { error: '兑换码无效或已被使用' },
          { status: 400 }
        );
      console.error('redeem_code rpc error:', error);
      return NextResponse.json(
        { error: error.message || '兑换失败' },
        { status: 500 }
      );
    }
    const added = typeof data === 'number' ? data : 0;
    return NextResponse.json({
      success: true,
      added,
      message: `成功到账 ${added} 铜币`,
    });
  } catch (e) {
    console.error('redeem error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '兑换失败' },
      { status: 500 }
    );
  }
}
