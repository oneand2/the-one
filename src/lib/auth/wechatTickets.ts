import { NextResponse } from 'next/server';
import {
  getWechatMiniProgramConfig,
  sanitizeNextPath,
  WECHAT_MP_TICKET_COOKIE,
  WECHAT_OAUTH_MAX_AGE_SECONDS,
  type WechatOAuthMode,
} from '@/lib/auth/wechat';
import { createAdminClient } from '@/utils/supabase/admin';

export const WECHAT_TICKET_ID_PATTERN = /^[a-f0-9]{32}$/;

export type WechatLoginTicketRow = {
  id: string;
  mode: WechatOAuthMode;
  next_path: string;
  bind_user_id: string | null;
  status: 'pending' | 'authorized' | 'consumed';
  user_id: string | null;
  url_link: string | null;
  expires_at: string;
};

export function isWechatTicketId(value: string | null | undefined): value is string {
  return Boolean(value && WECHAT_TICKET_ID_PATTERN.test(value));
}

export function setWechatTicketCookie(response: NextResponse, ticketId: string, secure: boolean) {
  response.cookies.set(WECHAT_MP_TICKET_COOKIE, ticketId, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: WECHAT_OAUTH_MAX_AGE_SECONDS,
    path: '/',
  });
}

export function clearWechatTicketCookie(response: NextResponse, secure: boolean) {
  response.cookies.set(WECHAT_MP_TICKET_COOKIE, '', {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
}

export async function insertWechatLoginTicket(input: {
  id: string;
  mode: WechatOAuthMode;
  next: string;
  bindUserId?: string;
}) {
  const admin = createAdminClient();
  const inserted = await admin.from('wechat_login_tickets').insert({
    id: input.id,
    mode: input.mode,
    next_path: sanitizeNextPath(input.next, input.mode === 'bind' ? '/profile' : '/'),
    bind_user_id: input.bindUserId ?? null,
    status: 'pending',
    expires_at: new Date(Date.now() + WECHAT_OAUTH_MAX_AGE_SECONDS * 1000).toISOString(),
  });
  if (inserted.error) throw inserted.error;
}

export async function getFreshWechatLoginTicket(ticketId: string) {
  const admin = createAdminClient();
  const queried = await admin
    .from('wechat_login_tickets')
    .select('id, mode, next_path, bind_user_id, status, user_id, url_link, expires_at')
    .eq('id', ticketId)
    .maybeSingle();
  if (queried.error) throw queried.error;
  const ticket = (queried.data as WechatLoginTicketRow | null) ?? null;
  if (!ticket) return null;
  if (new Date(ticket.expires_at).getTime() <= Date.now()) return null;
  return ticket;
}

export function buildMiniProgramCompleteUrl(ticketId: string) {
  const config = getWechatMiniProgramConfig();
  return `${config.siteUrl}/api/auth/wechat/miniprogram/complete?ticket=${ticketId}`;
}
