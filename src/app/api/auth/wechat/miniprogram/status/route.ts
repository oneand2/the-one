import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  getWechatMiniProgramConfig,
  WECHAT_MP_TICKET_COOKIE,
} from '@/lib/auth/wechat';
import {
  createCookieSupabase,
  establishWechatSession,
} from '@/lib/auth/wechatIdentity';
import { createAdminClient } from '@/utils/supabase/admin';
import {
  clearWechatTicketCookie,
  getFreshWechatLoginTicket,
  isWechatTicketId,
} from '@/lib/auth/wechatTickets';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const config = getWechatMiniProgramConfig();
  if (!config.enabled) {
    return NextResponse.json({ error: '小程序登录尚未配置' }, { status: 503 });
  }

  const cookieStore = await cookies();
  const ticketId = cookieStore.get(WECHAT_MP_TICKET_COOKIE)?.value;
  if (!isWechatTicketId(ticketId)) {
    return NextResponse.json({ status: 'expired', error: '登录已失效，请返回重试' });
  }

  const ticket = await getFreshWechatLoginTicket(ticketId);
  if (!ticket) {
    return NextResponse.json({ status: 'expired', error: '登录已失效，请返回重试' });
  }
  if (ticket.status === 'pending') {
    return NextResponse.json({ status: 'pending' });
  }
  if (ticket.status === 'consumed') {
    return NextResponse.json({ status: 'done', next: ticket.next_path });
  }
  if (!ticket.user_id) {
    return NextResponse.json({ status: 'pending' });
  }

  const response = NextResponse.json({
    status: 'done',
    next: ticket.next_path,
    message: ticket.mode === 'bind' ? '微信绑定成功' : undefined,
  });
  const admin = createAdminClient();
  const supabase = createCookieSupabase(request, response);

  try {
    if (ticket.mode === 'login') {
      await establishWechatSession(supabase, admin, ticket.user_id);
    }
    const consumed = await admin
      .from('wechat_login_tickets')
      .update({ status: 'consumed', updated_at: new Date().toISOString() })
      .eq('id', ticket.id)
      .eq('status', 'authorized');
    if (consumed.error) throw consumed.error;
    clearWechatTicketCookie(response, config.siteUrl.startsWith('https://'));
    return response;
  } catch (error) {
    console.error('wechat miniprogram status consume failed:', error);
    return NextResponse.json({ error: '登录未完成，请稍后重试' }, { status: 502 });
  }
}
