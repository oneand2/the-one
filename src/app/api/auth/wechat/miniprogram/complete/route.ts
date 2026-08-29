import { NextRequest, NextResponse } from 'next/server';
import { buildAppAbsoluteUrl, getWechatMiniProgramConfig } from '@/lib/auth/wechat';
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

function redirectWithMessage(path: string, message?: string) {
  return NextResponse.redirect(buildAppAbsoluteUrl(path, message));
}

export async function GET(request: NextRequest) {
  const config = getWechatMiniProgramConfig();
  const ticketId = request.nextUrl.searchParams.get('ticket');
  if (!config.enabled) {
    return redirectWithMessage('/login', '小程序登录尚未配置');
  }
  if (!isWechatTicketId(ticketId)) {
    return redirectWithMessage('/login', '微信授权已失效，请重新登录');
  }

  const ticket = await getFreshWechatLoginTicket(ticketId);
  if (!ticket || !ticket.user_id) {
    return redirectWithMessage(
      ticket?.mode === 'bind' ? '/profile' : '/login',
      '微信授权已失效，请重新登录',
    );
  }

  const next = ticket.next_path || (ticket.mode === 'bind' ? '/profile' : '/');
  const response = redirectWithMessage(
    next,
    ticket.mode === 'bind' ? '微信绑定成功' : undefined,
  );
  clearWechatTicketCookie(response, config.siteUrl.startsWith('https://'));

  if (ticket.status === 'consumed' && ticket.mode === 'bind') {
    return response;
  }

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
      .in('status', ['authorized', 'consumed']);
    if (consumed.error) throw consumed.error;
    return response;
  } catch (error) {
    console.error('wechat miniprogram complete failed:', error);
    return redirectWithMessage(
      ticket.mode === 'bind' ? '/profile' : '/login',
      '微信登录失败，请稍后重试',
    );
  }
}
