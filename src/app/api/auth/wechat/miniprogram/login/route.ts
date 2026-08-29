import { NextRequest, NextResponse } from 'next/server';
import { getWechatMiniProgramConfig } from '@/lib/auth/wechat';
import { exchangeMiniProgramCode } from '@/lib/auth/wechatMiniProgram';
import {
  bindWechatToUser,
  loginOrCreateWechatUser,
} from '@/lib/auth/wechatIdentity';
import { createAdminClient } from '@/utils/supabase/admin';
import {
  buildMiniProgramCompleteUrl,
  getFreshWechatLoginTicket,
  isWechatTicketId,
} from '@/lib/auth/wechatTickets';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const config = getWechatMiniProgramConfig();
  if (!config.enabled) {
    return NextResponse.json({ error: '小程序登录尚未配置' }, { status: 503 });
  }

  let body: { ticket?: unknown; code?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求无效' }, { status: 400 });
  }

  const ticketId = typeof body.ticket === 'string' ? body.ticket : '';
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  if (!isWechatTicketId(ticketId) || !code) {
    return NextResponse.json({ error: '登录凭证无效' }, { status: 400 });
  }

  const ticket = await getFreshWechatLoginTicket(ticketId);
  if (!ticket) {
    return NextResponse.json({ error: '登录已失效，请返回网站重试' }, { status: 410 });
  }
  if (ticket.status === 'consumed') {
    return NextResponse.json({ ok: true, completeUrl: buildMiniProgramCompleteUrl(ticket.id) });
  }
  if (ticket.status === 'authorized' && ticket.user_id) {
    return NextResponse.json({ ok: true, completeUrl: buildMiniProgramCompleteUrl(ticket.id) });
  }

  try {
    const session = await exchangeMiniProgramCode(code);
    if (!session.unionid) {
      console.warn('wechat miniprogram login missing unionid; bind the mini program to the open platform');
      return NextResponse.json(
        { error: '小程序尚未绑定开放平台，无法与网站账号打通' },
        { status: 503 },
      );
    }

    const profile = {
      appId: config.appId,
      openid: session.openid,
      unionid: session.unionid,
      nickname: '',
      avatarUrl: null,
    };
    const admin = createAdminClient();

    let userId: string;
    if (ticket.mode === 'bind') {
      if (!ticket.bind_user_id) {
        return NextResponse.json({ error: '绑定状态已失效，请返回网站重试' }, { status: 410 });
      }
      const bound = await bindWechatToUser(admin, profile, ticket.bind_user_id);
      if (bound.error) {
        return NextResponse.json({ error: bound.error }, { status: 409 });
      }
      userId = ticket.bind_user_id;
    } else {
      userId = await loginOrCreateWechatUser(admin, profile);
    }

    const updated = await admin
      .from('wechat_login_tickets')
      .update({
        status: 'authorized',
        user_id: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticket.id)
      .eq('status', 'pending');
    if (updated.error) throw updated.error;

    return NextResponse.json({
      ok: true,
      completeUrl: buildMiniProgramCompleteUrl(ticket.id),
    });
  } catch (error) {
    console.error('wechat miniprogram login failed:', error);
    return NextResponse.json({ error: '登录未完成，请重试' }, { status: 502 });
  }
}
