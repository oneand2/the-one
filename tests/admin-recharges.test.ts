import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readUserRecharges } from '../src/lib/admin/recharges';
import { loadAdminData, parseAdminQuery } from '../src/lib/admin/data';

const user = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const ambassador = '33333333-3333-4333-8333-333333333333';
const paid = (id: number, amount = 1) => ({ id: String(id), user_id: user, amount_cents: amount, status: 'paid', credited_at: '2026-10-19T00:00:00Z', paid_at: '2026-10-19T00:00:00Z' });

test('lifetime recharge totals page past 1000, combine channels and separate refunds/Apple', async () => {
  const seen: string[] = [];
  const fake = { from(table: string) {
    assert.ok(table.startsWith('ambassador_'));
    let scoped = false;
    return {
      select(columns: string) { assert.ok(!columns.includes('signed_transaction')); assert.ok(!columns.includes('*')); return this; },
      eq(key: string, value: string) {
        if (key === 'ambassador_id') { assert.equal(value, ambassador); scoped = true; }
        else { assert.equal(key, 'environment'); assert.equal(value, 'Production'); }
        return this;
      },
      in(key: string, value: string[]) { if (key === 'user_id') assert.deepEqual(value, [user, other]); else assert.deepEqual(value, ['paid', 'refunded']); return this; },
      order() { return this; },
      async range(offset: number) {
        assert.ok(scoped); seen.push(`${table}:${offset}`);
        const data = table.endsWith('apple_iap_transactions') ? [{ id: 'apple', user_id: user }]
          : table.endsWith('wechat_payment_orders') ? [paid(2000, 599), { ...paid(2001, 300), status: 'refunded' }, { ...paid(2002, 999), credited_at: null }]
          : offset === 0 ? Array.from({ length: 1000 }, (_, i) => paid(i)) : [{ ...paid(1000, 201), paid_at: '2020-01-01T00:00:00Z' }];
        return { data, error: null };
      },
    };
  } } as unknown as SupabaseClient;
  const totals = await readUserRecharges(fake, [user, other], ambassador);
  assert.deepEqual(totals.get(user), { paid_cents: 1800, paid_orders: 1002, refunded_cents: 300, refunded_orders: 1, last_paid_at: '2026-10-19T00:00:00Z', apple_orders: 1 });
  assert.deepEqual(totals.get(other), { paid_cents: 0, paid_orders: 0, refunded_cents: 0, refunded_orders: 0, last_paid_at: null, apple_orders: 0 });
  assert.ok(seen.includes('ambassador_payment_orders:1000'));
});

test('one failed payment channel fails the total instead of returning partial revenue', async () => {
  const fake = { from() { return { select() { return this; }, in() { return this; }, order() { return this; }, async range() { return { data: null, error: { message: 'offline' } }; } }; } } as unknown as SupabaseClient;
  await assert.rejects(readUserRecharges(fake, [user]), /无法读取/);
  assert.equal((await readUserRecharges({} as SupabaseClient, [])).size, 0);
});

test('user order filters cannot remove ambassador scope and apply to every channel before pagination', async () => {
  for (const channel of ['alipay', 'wechat', 'apple']) {
    const filters: string[] = [];
    const fake = { from(table: string) {
      assert.ok(table.startsWith('ambassador_'));
      return { select() { return this; }, eq(key: string, value: string) { filters.push(`${key}:${value}`); return this; }, order() { return this; }, async range() {
        assert.deepEqual(filters, [`ambassador_id:${ambassador}`, `user_id:${other}`]);
        return { data: [], count: 0, error: null };
      } };
    } } as unknown as SupabaseClient;
    const result = await loadAdminData(fake, parseAdminQuery(new URLSearchParams({ view: 'orders', channel, user: other })), ambassador);
    assert.equal(result.total, 0);
  }
  for (const query of ['view=orders&user=invalid', `view=users&user=${user}`, `view=orders&user=${user},${other}`]) assert.throws(() => parseAdminQuery(new URLSearchParams(query)));
});

test('profile-less accounts get totals and payment failure remains visibly unavailable', async () => {
  for (const failure of [false, true]) {
    const fake = {
      auth: { admin: { async listUsers() { return { data: { users: [{ id: user, created_at: '2020-01-01T00:00:00Z' }] }, error: null }; } } },
      from(table: string) {
        if (table === 'user_activity_coverage') throw new Error('unavailable');
        return { select() { return this; }, in() { return this; }, eq() { return this; }, order() { return this; },
          then(resolve: (result: unknown) => unknown) { return Promise.resolve({ data: [], error: null }).then(resolve); },
          async range() { return { data: table === 'payment_orders' ? [paid(1, 1000)] : [], error: failure ? { message: 'offline' } : null }; },
        };
      },
    } as unknown as SupabaseClient;
    const result = await loadAdminData(fake, parseAdminQuery(new URLSearchParams('view=users&days=7')));
    assert.equal(result.rows?.length, 1);
    assert.equal(result.rows?.[0].coins_balance, null);
    if (failure) { assert.equal(result.rows?.[0].paid_cents, undefined); assert.ok(result.warnings?.some(w => w.includes('充值统计暂时不可用'))); }
    else { assert.equal(result.rows?.[0].paid_cents, 1000); assert.equal(result.rows?.[0].paid_orders, 1); }
  }
});
