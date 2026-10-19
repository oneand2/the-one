import type { SupabaseClient } from '@supabase/supabase-js';
import { referralCode, REFERRAL_COOKIE } from './shared';

export type ReferralVisit = { token: string; code: string; expiresAt: string };
const TOKEN_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** First valid visit wins. Reopening/re-sharing must never extend its expiry. */
export async function resolveReferralVisit(client: SupabaseClient, token?: string, code?: string): Promise<ReferralVisit | undefined> {
  if (token && TOKEN_PATTERN.test(token)) {
    const { data, error } = await client.from('ambassador_visits')
      .select('token,expires_at,ambassadors!inner(code,active)').eq('token', token)
      .eq('ambassadors.active', true).gt('expires_at', new Date().toISOString()).maybeSingle();
    if (error) throw new Error('推广来源暂时无法确认');
    if (data) {
      const row = data as unknown as { token: string; expires_at: string; ambassadors: { code: string } };
      return { token: row.token, code: row.ambassadors.code, expiresAt: row.expires_at };
    }
  }
  if (!referralCode(code)) return undefined;
  const { data: ambassador, error } = await client.from('ambassadors').select('id,code').eq('code', code!).eq('active', true).maybeSingle();
  if (error) throw new Error('推广来源暂时无法确认');
  if (!ambassador) return undefined;
  const visit = await client.from('ambassador_visits').insert({ ambassador_id: ambassador.id }).select('token,expires_at').single();
  if (visit.error || !visit.data) throw new Error('推广来源暂时无法保存');
  return { token: visit.data.token, code: ambassador.code, expiresAt: visit.data.expires_at };
}

export function referralCookie(visit: ReferralVisit, secure: boolean) {
  return { name: REFERRAL_COOKIE, value: visit.token, httpOnly: true, secure, sameSite: 'lax' as const, path: '/',
    maxAge: Math.max(0, Math.floor((Date.parse(visit.expiresAt) - Date.now()) / 1000)) };
}
