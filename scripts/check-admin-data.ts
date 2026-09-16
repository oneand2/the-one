/** Read-only integration check. Prints counts only, never user data or credentials. */
import dotenv from 'dotenv';
import { createAdminClient } from '../src/utils/supabase/admin';
import { loadAdminData, parseAdminQuery } from '../src/lib/admin/data';

dotenv.config({ path: '.env.local', quiet: true });
async function main() {
  const client = createAdminClient();
  const overview = await loadAdminData(client, parseAdminQuery(new URLSearchParams()));
  if (overview.warnings?.length) throw new Error(overview.warnings.join('; '));
  console.log(JSON.stringify({ view: 'overview', stats: overview.stats, sources: overview.sources }));
  for (const query of ['view=users', 'view=users&page=2', 'view=users&status=vip', 'view=answers', 'view=comments', 'view=reports', 'view=orders&channel=alipay', 'view=orders&channel=wechat', 'view=orders&channel=apple', 'view=insights']) {
    const data = await loadAdminData(client, parseAdminQuery(new URLSearchParams(query)));
    if (!Array.isArray(data.rows) || data.total === undefined) throw new Error(`Invalid result: ${query}`);
    if (data.rows.some(row => 'signed_transaction' in row || 'user_metadata' in row)) throw new Error('Private fields leaked');
    console.log(JSON.stringify({ query, total: data.total, returned: data.rows.length }));
  }
}
main().catch(error => { console.error('Admin data check failed:', error instanceof Error ? error.message : 'unknown'); process.exitCode = 1; });
