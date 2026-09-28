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
