/** Read-only integration check. Prints counts only, never user data or credentials. */
import dotenv from 'dotenv';
import { createAdminClient } from '../src/utils/supabase/admin';
import { loadAdminData, parseAdminQuery } from '../src/lib/admin/data';

dotenv.config({ path: '.env.local', quiet: true });
async function main() {
  const client = createAdminClient();
  const overview = await loadAdminData(client, parseAdminQuery(new URLSearchParams()));
  if (overview.warnings?.length) throw new Error(overview.warnings.join('; '));
  console.log(JSON.stringify({ view: 'overview', stats: overview.stats, sources: overview.sources, usersAnalytics: overview.usersAnalytics }));
  for (const query of ['view=users', 'view=users&page=2', 'view=users&status=vip', 'view=users&cohort=new', 'view=users&cohort=active', 'view=users&cohort=login', 'view=users&days=30&cohort=new&source=wechat', 'view=answers', 'view=comments', 'view=reports', 'view=orders&channel=alipay', 'view=orders&channel=wechat', 'view=orders&channel=apple', 'view=insights']) {
    const data = await loadAdminData(client, parseAdminQuery(new URLSearchParams(query)));
    if (data.warnings?.length) throw new Error(data.warnings.join('; '));
    if (query.includes('cohort=new') && !query.includes('source=') && data.total !== data.usersAnalytics?.newUsers) throw new Error('New user count mismatch');
    if (query.includes('cohort=active') && data.total !== (data.usersAnalytics?.activeUsers ?? 0)) throw new Error('Active user count mismatch');
    if (query.includes('cohort=login') && data.total !== data.usersAnalytics?.loggedInUsers) throw new Error('Login count mismatch');
    if (query.includes('source=wechat') && data.rows?.some(row => row.signup_source !== 'wechat')) throw new Error('Signup source mismatch');
    if (!Array.isArray(data.rows) || data.total === undefined) throw new Error(`Invalid result: ${query}`);
    if (data.rows.some(row => 'signed_transaction' in row || 'user_metadata' in row)) throw new Error('Private fields leaked');
    console.log(JSON.stringify({ query, total: data.total, returned: data.rows.length }));
  }
}
main().catch(error => { console.error('Admin data check failed:', error instanceof Error ? error.message : 'unknown'); process.exitCode = 1; });
