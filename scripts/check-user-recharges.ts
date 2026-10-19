/** Read-only integration check. Logs only aggregate counts, never account details. */
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import { createAdminClient } from '../src/utils/supabase/admin';
import { loadAdminData, parseAdminQuery } from '../src/lib/admin/data';
import { readUserRecharges } from '../src/lib/admin/recharges';
import { randomUUID } from 'node:crypto';

dotenv.config({ path: '.env.local', quiet: true });
async function main() {
  const client = createAdminClient();
  const { data: reports, error } = await client.rpc('ambassador_performance');
  assert.equal(error, null);
  for (const report of reports || []) {
    let cents = 0, orders = 0, users = 0;
    for (let page = 1; ; page++) {
      const result = await loadAdminData(client, parseAdminQuery(new URLSearchParams({ view: 'users', page: String(page) })), report.id);
      assert.deepEqual(result.warnings, []);
      for (const row of result.rows || []) {
        assert.equal(typeof row.paid_cents, 'number');
        cents += Number(row.paid_cents); orders += Number(row.paid_orders); users++;
        assert.ok(!('signed_transaction' in row));
      }
      if (page * 25 >= result.total!) break;
    }
    assert.equal(cents, Number(report.paid_cents)); assert.equal(orders, Number(report.paid_orders)); assert.equal(users, Number(report.registered_users));
    console.log(`Scoped user totals match report: ${users} accounts, ${orders} orders`);
  }
  const { data: referrals, error: referralsError } = await client.from('user_referrals').select('user_id').limit(1);
  assert.equal(referralsError, null);
  if (referrals?.[0]) {
    const totals = await readUserRecharges(client, [referrals[0].user_id], randomUUID());
    assert.equal(totals.get(referrals[0].user_id)?.paid_cents, 0);
    for (const channel of ['alipay', 'wechat', 'apple']) {
      const result = await loadAdminData(client, parseAdminQuery(new URLSearchParams({ view: 'orders', channel, user: referrals[0].user_id })), randomUUID());
      assert.equal(result.total, 0);
    }
  }
  console.log('Cross-ambassador amount and per-user order isolation passed');
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Validation failed'); process.exitCode = 1; });
