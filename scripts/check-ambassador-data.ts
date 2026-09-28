/** Read-only API checks; never print credentials or personal data. */
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import { randomUUID } from 'node:crypto';
import { createAdminClient } from '../src/utils/supabase/admin';
import { loadAdminData, parseAdminQuery } from '../src/lib/admin/data';
dotenv.config({ path: '.env.local', quiet: true });
async function main() {
  const client = createAdminClient();
  const emptyScope = randomUUID();
  for (const view of ['overview','users','answers','comments','reports','orders']) {
    const data = await loadAdminData(client, parseAdminQuery(new URLSearchParams({ view })), emptyScope);
    assert.equal(data.warnings?.length || 0, 0);
    if (view === 'overview') {
      assert.ok(Object.values(data.stats!).every(value => value === 0));
      assert.ok(!('insights' in data.stats!));
    } else { assert.equal(data.total, 0); assert.equal(data.rows?.length, 0); }
    console.log(`${view}: scoped query passed`);
  }
  const { data, error } = await client.rpc('ambassador_performance', { p_ambassador_id: emptyScope });
  assert.equal(error, null); assert.deepEqual(data, []);
  console.log('report: empty scope stays empty');
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Validation failed'); process.exitCode = 1; });
