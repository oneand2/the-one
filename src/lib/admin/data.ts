import type { SupabaseClient, User } from '@supabase/supabase-js';
import { isVip } from '@/utils/vip';

import { analyticsWindow, readActivity, signupSource, summarizeUsers, type ActivityData } from './analytics';
import { SIGNUP_SOURCES, PAGE_SIZE, MODULES, type AdminModule, type AdminRow, type AdminData, type AdminQuery } from './shared';

export function parseAdminQuery(params: URLSearchParams): AdminQuery {
  const view = params.get('view') || 'overview';
  if (!MODULES.includes(view as AdminModule)) throw new Error('未知后台页面');
  const rawPage = params.get('page') || '1';
  if (!/^\d+$/.test(rawPage) || Number(rawPage) < 1 || Number(rawPage) > 100000) throw new Error('页码无效');
  const q = (params.get('q') || '').trim();
  if (q.length > 100) throw new Error('搜索内容不能超过 100 字');
  const days = Number(params.get('days') || '7');
  const cohort = params.get('cohort') || 'all';
  const source = params.get('source') || 'all';
  if (![7, 30].includes(days) || !['all', 'new', 'active', 'login'].includes(cohort) || (source !== 'all' && !Object.hasOwn(SIGNUP_SOURCES, source))) throw new Error('用户统计筛选无效');
  return { view: view as AdminModule, page: Number(rawPage), q, status: params.get('status') || 'all', channel: params.get('channel') || 'alipay', days, cohort, source };
}

export function chinaDay(offset = 0, now = new Date()) {
  return new Date(now.getTime() + 8 * 3600000 + offset * 86400000).toISOString().slice(0, 10);
}

export function literalSearch(q: string) {
  return q.replace(/[\\%_]/g, '\\$&');
}

async function exactCount(client: SupabaseClient, table: string, filter?: { key: string; value: string }, day?: string) {
  let query = client.from(table).select('*', { count: 'exact', head: true });
  if (filter) query = query.eq(filter.key, filter.value);
  if (day) {
    const start = new Date(`${day}T00:00:00+08:00`);
    query = query.gte('created_at', start.toISOString()).lt('created_at', new Date(start.getTime() + 86400000).toISOString());
  }
  const result = await query;
  if (result.error || result.count === null) throw new Error(`${table} 读取失败`);
  return result.count;
}

async function overview(client: SupabaseClient, input: AdminQuery): Promise<AdminData> {
  const warnings: string[] = [];
  async function safe(name: string, task: PromiseLike<number>) {
    try { return await task; } catch { warnings.push(`${name}暂时无法读取，请刷新重试`); return null; }
  }
  const tables = [
    ['profiles', '用户档案', 'user_profiles'], ['answers', '用户手记', 'jianzhongsheng_answers'],
    ['comments', '用户评论', 'jianzhongsheng_comments'], ['reports', '举报记录', 'jianzhongsheng_reports'],
    ['alipay', '支付宝订单', 'payment_orders'], ['wechat', '微信订单', 'wechat_payment_orders'],
    ['apple', 'Apple 交易记录', 'apple_iap_transactions'], ['insights', '今日见闻', 'daily_insights'], ['news', '每日新闻', 'world_news'],
  ];
  const values = await Promise.all(tables.map(([, label, table]) => safe(label, exactCount(client, table))));
  const stats = Object.fromEntries(tables.map(([key], i) => [key, values[i]]));
  stats.users = await safe('注册账户', (async () => {
    const { data, error } = await client.auth.admin.listUsers({ page: 1, perPage: 1 });
    if (error || !('total' in data)) throw new Error('注册账户读取失败');
    return data.total;
  })());
  stats.openReports = await safe('待处理举报', exactCount(client, 'jianzhongsheng_reports', { key: 'status', value: 'open' }));
  stats.vip = await safe('有效会员', (async () => {
    const { count, error } = await client.from('user_profiles').select('*', { count: 'exact', head: true }).gt('vip_expires_at', new Date().toISOString());
    if (error || count === null) throw new Error('会员读取失败');
    return count;
  })());
  const trend = await Promise.all(Array.from({ length: 7 }, async (_, i) => {
    const date = chinaDay(i - 6);
    const [answers, comments] = await Promise.all([
      safe('手记趋势', exactCount(client, 'jianzhongsheng_answers', undefined, date)),
      safe('评论趋势', exactCount(client, 'jianzhongsheng_comments', undefined, date)),
    ]);
    return { date, answers, comments };
  }));
  let usersAnalytics;
  try {
    const accounts = await allUsers(client);
    const window = analyticsWindow(input.days);
    const activity = await activityOrWarning(client, window.start, window.end, warnings);
    usersAnalytics = summarizeUsers(accounts, activity, input.days, window.now);
  } catch { warnings.push('新增与活跃用户统计暂时无法读取'); }
  return { usersAnalytics, stats, trend, sources: tables.map(([, name], i) => ({ name, count: values[i], ok: values[i] !== null })), warnings: [...new Set(warnings)], updatedAt: new Date().toISOString() };
}

async function allUsers(client: SupabaseClient) {
  const users: User[] = [];
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error('用户列表暂时无法读取');
    users.push(...data.users);
    if (!data.nextPage) return users;
  }
  throw new Error('用户规模超出当前搜索范围，请联系维护人员升级查询');
}

async function activityOrWarning(client: SupabaseClient, start: string, end: string, warnings: string[]): Promise<ActivityData> {
  try { return await readActivity(client, start, end); }
  catch { warnings.push('活跃数据暂时不可用，请刷新重试'); return { rows: [], since: null, available: false }; }
}

async function users(client: SupabaseClient, input: AdminQuery): Promise<AdminData> {
  // Auth accounts are authoritative: accounts without a profile must not disappear.
  let accounts = await allUsers(client);
  const warnings: string[] = [];
  const window = analyticsWindow(input.days);
  const activity = await activityOrWarning(client, window.start, window.end, warnings);
  if (input.cohort === 'active' && !activity.available) throw new Error('活跃数据暂时不可用，请刷新重试');
  const usersAnalytics = summarizeUsers(accounts, activity, input.days, window.now);
  const latest = new Map<string, string>();
  for (const row of activity.rows) {
    if (Date.parse(row.last_seen_at) <= window.now && (!latest.has(row.user_id) || row.last_seen_at > latest.get(row.user_id)!)) latest.set(row.user_id, row.last_seen_at);
  }
  const profiles: AdminRow[] = [];
  for (let start = 0; start < accounts.length; start += 100) {
    const { data, error } = await client.from('user_profiles')
      .select('user_id,nickname,coins_balance,vip_expires_at,community_suspended_until')
      .in('user_id', accounts.slice(start, start + 100).map(u => u.id));
    if (error) throw new Error('用户档案暂时无法读取');
    profiles.push(...data);
  }
  // Keep IN filters under proxy URL limits (100 UUIDs per request).
  const byId = new Map(profiles.map(p => [p.user_id, p]));
  if (!['all', 'vip', 'suspended'].includes(input.status)) throw new Error('用户状态无效');
  const needle = input.q.toLowerCase();
  accounts = accounts.filter(u => {
    const p = byId.get(u.id);
    const matches = !needle || [u.id, u.email, p?.nickname].some(v => String(v ?? '').toLowerCase().includes(needle));
    const since = Date.parse(`${window.start}T00:00:00+08:00`);
    const inWindow = (time?: string) => Boolean(time && Date.parse(time) >= since && Date.parse(time) <= window.now);
    const cohortMatches = input.cohort === 'all' || (input.cohort === 'new' ? inWindow(u.created_at) : input.cohort === 'active' ? latest.has(u.id) : inWindow(u.last_sign_in_at));
    return matches && cohortMatches && (input.source === 'all' || signupSource(u) === input.source) && (input.status === 'all' || (input.status === 'vip' ? isVip(p?.vip_expires_at as string | null) : new Date(String(p?.community_suspended_until)).getTime() > Date.now()));
  }).sort((a, b) => {
    const timestamp = (u: User) => input.cohort === 'active' ? latest.get(u.id)! : input.cohort === 'login' ? u.last_sign_in_at! : u.created_at;
    return timestamp(b).localeCompare(timestamp(a)) || a.id.localeCompare(b.id);
  });
  const rows = accounts.slice((input.page - 1) * PAGE_SIZE, input.page * PAGE_SIZE).map(u => ({
    signup_source: signupSource(u), last_activity_at: latest.get(u.id) || null,
    id: u.id, email: u.email || null, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at || null,
    nickname: '', coins_balance: null, vip_expires_at: null, community_suspended_until: null, ...byId.get(u.id),
  }));
  return { usersAnalytics, warnings, rows, total: accounts.length, page: input.page, updatedAt: new Date().toISOString() };
}

export async function loadAdminData(client: SupabaseClient, input: AdminQuery): Promise<AdminData> {
  if (input.view === 'overview' || input.view === 'settings') return overview(client, input);
  if (input.view === 'users') return users(client, input);
  let table: string, columns: string, searchColumn: string, statusColumn: string | null = null;
  let allowed: string[] = ['all'];
  if (input.view === 'answers' || input.view === 'comments') {
    table = `jianzhongsheng_${input.view}`;
    columns = `id,user_id,display_id,body,created_at,moderation_status,moderation_reason,moderated_at,${input.view === 'answers' ? 'question_id' : 'entry_id'}`;
    searchColumn = 'body'; statusColumn = 'moderation_status'; allowed = ['all', 'visible', 'hidden', 'removed'];
  } else if (input.view === 'reports') {
    table = 'jianzhongsheng_reports';
    columns = 'id,content_type,content_id,reason,details,snapshot_display_id,snapshot_body,status,resolution,created_at,resolved_at';
    searchColumn = 'snapshot_body'; statusColumn = 'status'; allowed = ['all', 'open', 'resolved', 'dismissed'];
  } else if (input.view === 'insights') {
    table = 'daily_insights'; columns = 'id,insight_date,title,source_label,original_language,original_text,body,sources,created_at'; searchColumn = 'title';
  } else {
    const channelTables: Record<string, string> = { alipay: 'payment_orders', wechat: 'wechat_payment_orders', apple: 'apple_iap_transactions' };
    table = channelTables[input.channel];
    if (!table) throw new Error('支付渠道无效');
    const apple = input.channel === 'apple';
    columns = apple ? 'id,user_id,transaction_id,product_id,environment,coins,created_at' : 'id,user_id,out_trade_no,subject,package_id,amount_cents,coins,status,paid_at,credited_at,created_at';
    searchColumn = apple ? 'transaction_id' : 'out_trade_no';
    statusColumn = apple ? 'environment' : 'status';
    allowed = apple ? ['all', 'Production', 'Sandbox', 'Xcode'] : ['all', 'paid', 'pending', 'closed', 'refunded'];
  }
  if (!allowed.includes(input.status)) throw new Error('筛选状态无效');
  let query = client.from(table).select(columns, { count: 'exact' });
  if (input.q) query = query.ilike(searchColumn, `%${literalSearch(input.q)}%`);
  if (statusColumn && input.status !== 'all') query = query.eq(statusColumn, input.status);
  const { data, error, count } = await query.order(input.view === 'insights' ? 'insight_date' : 'created_at', { ascending: false }).order('id').range((input.page - 1) * PAGE_SIZE, input.page * PAGE_SIZE - 1);
  if (error || count === null) throw new Error('列表暂时无法读取，请重试');
  return { rows: data as unknown as AdminRow[], total: count, page: input.page, updatedAt: new Date().toISOString() };
}
