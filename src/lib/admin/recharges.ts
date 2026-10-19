import type { SupabaseClient } from '@supabase/supabase-js';
import { selectScoped } from '@/lib/ambassadors/scope';

export type UserRecharge = {
  paid_cents: number; paid_orders: number; refunded_cents: number; refunded_orders: number;
  last_paid_at: string | null; apple_orders: number;
};

// Read only the displayed accounts, with attribution applied in SQL before paging.
// No activity or registration date filter: subsequent purchases follow the account.
export async function readUserRecharges(client: SupabaseClient, userIds: string[], scope?: string | null) {
  const totals = new Map<string, UserRecharge>(userIds.map(id => [id, {
    paid_cents: 0, paid_orders: 0, refunded_cents: 0, refunded_orders: 0, last_paid_at: null, apple_orders: 0,
  }]));
  if (!userIds.length) return totals;
  for (const table of ['payment_orders', 'wechat_payment_orders', 'apple_iap_transactions']) {
    const apple = table === 'apple_iap_transactions';
    for (let offset = 0; ; offset += 1000) {
      if (offset >= 100000) throw new Error('充值记录超出查询范围');
      let query = selectScoped(client, table, apple ? 'id,user_id' : 'id,user_id,amount_cents,status,paid_at,credited_at', {}, scope)
        .in('user_id', userIds);
      query = apple ? query.eq('environment', 'Production') : query.in('status', ['paid', 'refunded']);
      const { data, error } = await query.order('id').range(offset, offset + 999);
      if (error || !data) throw new Error('用户充值统计暂时无法读取');
      const orders = data as unknown as { id: string; user_id: string; amount_cents: number; status: string; paid_at: string | null; credited_at: string | null }[];
      for (const row of orders) {
        const total = totals.get(row.user_id);
        if (!total) continue;
        if (apple) { total.apple_orders++; continue; }
        if (!Number.isSafeInteger(row.amount_cents) || row.amount_cents < 0) throw new Error('充值金额数据无效');
        if (row.status === 'refunded') {
          total.refunded_cents += row.amount_cents; total.refunded_orders++;
        } else if (row.status === 'paid' && row.credited_at) {
          total.paid_cents += row.amount_cents; total.paid_orders++;
          if (row.paid_at && (!total.last_paid_at || Date.parse(row.paid_at) > Date.parse(total.last_paid_at))) total.last_paid_at = row.paid_at;
        }
        if (!Number.isSafeInteger(total.paid_cents) || !Number.isSafeInteger(total.refunded_cents)) throw new Error('充值金额超出统计范围');
      }
      if (data.length < 1000) break;
    }
  }
  return totals;
}
