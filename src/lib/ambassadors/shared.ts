export const REFERRAL_COOKIE = 'ambassador_referral';
export const REFERRAL_DAYS = 30;
export const CODE_PATTERN = /^[a-z0-9][a-z0-9-]{2,31}$/;
export const AMBASSADOR_VIEWS = ['overview', 'users', 'answers', 'comments', 'orders', 'reports', 'ambassadors'];
export type ConsoleAccess = { role: 'owner' | 'ambassador'; ambassadorId: string | null; name: string };
export type AmbassadorReport = {
  id: string; user_id: string; name: string; code: string; active: boolean; created_at: string;
  registered_users: number; new_users: number; paid_users: number; paid_orders: number; paid_cents: number;
  refunded_orders: number; refunded_cents: number; apple_orders: number;
};

export function referralCode(value: unknown) {
  return typeof value === 'string' && CODE_PATTERN.test(value) ? value : undefined;
}

/** Canonicalize only our two production hostnames; never redirect arbitrary hosts. */
export function canonicalSiteRequest(requestUrl: string, siteUrl?: string) {
  if (!siteUrl) return null;
  const request = new URL(requestUrl), site = new URL(siteUrl);
  const hosts = ['the-one-and-the-two.com', 'www.the-one-and-the-two.com'];
  if (!hosts.includes(request.hostname) || !hosts.includes(site.hostname) || request.hostname === site.hostname) return null;
  const target = new URL(request.pathname + request.search, site.origin);
  return target;
}

/** Public codes may travel in shared URLs; private visit tokens never do. */
export function referralLoginPath(search: string) {
  const code = referralCode(new URLSearchParams(search).get('ref'));
  return code ? `/login?ref=${encodeURIComponent(code)}` : '/login';
}
