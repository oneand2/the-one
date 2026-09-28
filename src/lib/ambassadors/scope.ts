import type { SupabaseClient } from '@supabase/supabase-js';
const SCOPED_TABLES = new Set(['user_profiles', 'user_daily_activity', 'jianzhongsheng_answers', 'jianzhongsheng_comments', 'jianzhongsheng_reports', 'payment_orders', 'wechat_payment_orders', 'apple_iap_transactions']);
export function selectScoped(client: SupabaseClient, table: string, columns: string, options: { count?: 'exact'; head?: boolean } = {}, scope?: string | null) {
  if (scope && !SCOPED_TABLES.has(table)) throw new Error('此数据源不支持推广大使范围');
  const query = client.from(scope ? `ambassador_${table}` : table).select(columns, options);
  return scope ? query.eq('ambassador_id', scope) : query;
}
