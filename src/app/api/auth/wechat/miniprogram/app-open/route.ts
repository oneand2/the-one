import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getWechatMiniProgramConfig } from '@/lib/auth/wechat';
import { exchangeMiniProgramCode } from '@/lib/auth/wechatMiniProgram';
import { loginOrCreateWechatUser } from '@/lib/auth/wechatIdentity';
import { createAdminClient } from '@/utils/supabase/admin';
import {
  buildMiniProgramCompleteUrl,
  insertAuthorizedWechatLoginTicket,
} from '@/lib/auth/wechatTickets';

export const dynamic = 'force-dynamic';

const APP_HOME = '/?embed=miniprogram';

export async function POST(request: NextRequest) {
  const config = getWechatMiniProgramConfig();
  if (!config.enabled) {
    return NextResponse.json({ error: '小程序登录尚未配置' }, { status: 503 });
  }

  let body: { code?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求无效' }, { status: 400 });
  }

  const code = typeof body.code === 'string' ? body.code.trim() : '';
  if (!code) {
    return NextResponse.json({ error: '登录凭证无效' }, { status: 400 });
  }

  try {
    const session = await exchangeMiniProgramCode(code);
    if (!session.unionid) {
      console.warn('wechat miniprogram app-open missing unionid');
      return NextResponse.json({ homeUrl: `${config.siteUrl}${APP_HOME}` });
    }

    const admin = createAdminClient();
    const userId = await loginOrCreateWechatUser(admin, {
      appId: config.appId,
      openid: session.openid,
      unionid: session.unionid,
      nickname: '',
      avatarUrl: null,
    });
    const ticketId = randomBytes(16).toString('hex');
    await insertAuthorizedWechatLoginTicket({
      id: ticketId,
      next: APP_HOME,
      userId,
    });

    return NextResponse.json({
      completeUrl: buildMiniProgramCompleteUrl(ticketId),
    });
  } catch (error) {
    console.error('wechat miniprogram app-open failed:', error);
    return NextResponse.json({ homeUrl: `${config.siteUrl}${APP_HOME}` });
  }
}
