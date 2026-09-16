import { ADMIN_EMAIL } from '@/utils/vip';

export function isAdminIdentity(user: { email?: string; email_confirmed_at?: string } | null | undefined) {
  return Boolean(user?.email_confirmed_at && user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase());
}

export function isSameOrigin(request: Request) {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false;
  const origin = request.headers.get('origin');
  if (!origin) return true;
  const allowed = new Set([new URL(request.url).origin]);
  // The public origin remains stable when TLS terminates at the deployment proxy.
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    try { allowed.add(new URL(process.env.NEXT_PUBLIC_SITE_URL).origin); } catch { /* Invalid configuration adds no trusted origin. */ }
  }
  return allowed.has(origin);
}
