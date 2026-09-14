import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getWechatMiniProgramConfig, WECHAT_MP_TICKET_COOKIE } from '@/lib/auth/wechat';
import { generateMiniProgramUrlLink } from '@/lib/auth/wechatMiniProgram';
import { createAdminClient } from '@/utils/supabase/admin';
import { getFreshWechatLoginTicket, isWechatTicketId } from '@/lib/auth/wechatTickets';

export const dynamic = 'force-dynamic';

export async function GET() {
  const config = getWechatMiniProgramConfig();
  if (!config.enabled) {
    return NextResponse.json({ error: '小程序登录尚未配置' }, { status: 503 });
  }

  const ticketId = (await cookies()).get(WECHAT_MP_TICKET_COOKIE)?.value;
  if (!isWechatTicketId(ticketId)) {
    return NextResponse.json({ error: '登录已失效，请返回重试' }, { status: 401 });
  }

  const ticket = await getFreshWechatLoginTicket(ticketId);
  if (!ticket || ticket.status === 'consumed') {
    return NextResponse.json({ error: '登录已失效，请返回重试' }, { status: 401 });
  }

  if (ticket.url_link) {
    return NextResponse.json({ urlLink: ticket.url_link });
  }

  try {
    const urlLink = await generateMiniProgramUrlLink(ticket.id);
    const admin = createAdminClient();
    const updated = await admin
      .from('wechat_login_tickets')
      .update({ url_link: urlLink, updated_at: new Date().toISOString() })
      .eq('id', ticket.id)
      .eq('status', ticket.status);
    if (updated.error) throw updated.error;
    return NextResponse.json({ urlLink });
  } catch (error) {
    console.error('wechat miniprogram url link failed:', error);
    return NextResponse.json({ error: '暂时无法打开小程序，请稍后重试' }, { status: 502 });
  }
}
