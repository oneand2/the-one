import type { SupabaseClient, User } from '@supabase/supabase-js';
import { SIGNUP_SOURCES, type SignupSource, type UserAnalytics } from './shared';

const DAY = 86400000;
export function chinaDate(time: number) {
  return new Date(time + 8 * 3600000).toISOString().slice(0, 10);
}
export function analyticsWindow(days: number, now = Date.now()) {
  const end = chinaDate(now);
  const endMidnight = Date.parse(`${end}T00:00:00+08:00`);
  return { start: chinaDate(endMidnight - (days - 1) * DAY), end, now };
}

// Only server-managed metadata identifies the original signup method.
// Binding another identity later must not relabel the original registration.
export function signupSource(user: Pick<User, 'app_metadata' | 'email'>): SignupSource {
  const metadata = user.app_metadata || {};
  if (metadata.signup_source) {
    return ['email', 'wechat', 'apple', 'legacy'].includes(metadata.signup_source) ? metadata.signup_source : 'unknown';
  }
  if (metadata.provider === 'apple') return 'apple';
  if (metadata.provider === 'email') {
    if (user.email?.toLowerCase().endsWith('@no-email.app')) return 'legacy';
    if (user.email?.toLowerCase().endsWith('@wechat.the-one-and-the-two.com')) return 'wechat';
    return user.email ? 'email' : 'unknown';
  }
  return 'unknown';
}

export type ActivityRow = { user_id: string; activity_date: string; last_seen_at: string };
export type ActivityData = { rows: ActivityRow[]; since: string | null; available: boolean };
export async function readActivity(client: SupabaseClient, start: string, end: string): Promise<ActivityData> {
  const { data: coverage, error } = await client.from('user_activity_coverage').select('started_at').eq('id', 1).maybeSingle();
  if (error) throw new Error('活跃记录暂时无法读取');
  const rows: ActivityRow[] = [];
  for (let offset = 0; offset < 100000; offset += 1000) {
    const result = await client.from('user_daily_activity').select('user_id,activity_date,last_seen_at')
      .gte('activity_date', start).lte('activity_date', end)
      .order('activity_date').order('user_id').range(offset, offset + 999);
    if (result.error) throw new Error('活跃记录暂时无法读取');
    rows.push(...result.data);
    if (result.data.length < 1000) return { rows, since: coverage?.started_at || null, available: true };
  }
  throw new Error('活跃数据超出查询范围，请联系维护人员升级查询');
}

export function summarizeUsers(accounts: User[], activity: ActivityData, days: number, now = Date.now()): UserAnalytics {
  const { start, end } = analyticsWindow(days, now);
  const startTime = Date.parse(`${start}T00:00:00+08:00`);
  const inWindow = (time?: string) => Boolean(time && Date.parse(time) >= startTime && Date.parse(time) <= now);
  const newAccounts = accounts.filter(u => inWindow(u.created_at));
  const knownIds = new Set(accounts.map(u => u.id));
  const dailyActive = new Map<string, Set<string>>();
  const active = new Set<string>();
  for (const row of activity.rows) {
    if (!knownIds.has(row.user_id) || row.activity_date < start || row.activity_date > end || Date.parse(row.last_seen_at) > now) continue;
    active.add(row.user_id);
    if (!dailyActive.has(row.activity_date)) dailyActive.set(row.activity_date, new Set());
    dailyActive.get(row.activity_date)!.add(row.user_id);
  }
  const sinceDay = activity.since ? chinaDate(Date.parse(activity.since)) : null;
  const collected = activity.available && sinceDay !== null && sinceDay <= end;
  return {
    days, start, end, trackingSince: activity.since, activityAvailable: activity.available,
    newUsers: newAccounts.length, activeUsers: collected ? active.size : null,
    loggedInUsers: accounts.filter(u => inWindow(u.last_sign_in_at)).length,
    daily: Array.from({ length: days }, (_, i) => {
      const date = chinaDate(startTime + i * DAY);
      return { date, newUsers: newAccounts.filter(u => chinaDate(Date.parse(u.created_at)) === date).length,
        activeUsers: collected && date >= sinceDay! ? (dailyActive.get(date)?.size || 0) : null };
    }),
    signupSources: (Object.keys(SIGNUP_SOURCES) as SignupSource[]).map(source => ({ source, count: newAccounts.filter(u => signupSource(u) === source).length })),
  };
}
