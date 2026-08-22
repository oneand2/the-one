import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * 用户名注册已关闭。已有 @no-email.app 账户仍可通过登录页的「邮箱或用户名」进入，
 * 档案、铜币和历史记录均保留，本接口不再创建新用户。
 */
export async function POST() {
  return NextResponse.json(
    { error: '用户名注册已关闭，请改用微信或邮箱注册。已有用户名账户仍可登录。' },
    { status: 410 },
  );
}
