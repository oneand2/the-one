import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { analyticsWindow, signupSource, summarizeUsers, readActivity, type ActivityRow } from '../src/lib/admin/analytics';
import { loadAdminData, parseAdminQuery } from '../src/lib/admin/data';

const now = Date.parse('2026-09-16T04:00:00Z');
const account = (id: string, created_at: string, provider = 'email', extra = {}) => ({
  id, created_at, email: `${id}@example.test`, app_metadata: { provider }, ...extra,
}) as User;
const accounts = [
  account('old', '2026-09-09T15:59:59Z', 'email', { last_sign_in_at: '2026-09-15T04:00:00Z' }),
  account('new', '2026-09-09T16:00:00Z'),
  account('today', '2026-09-15T16:00:00Z', 'apple'),
  account('future', '2026-09-17T04:00:00Z'),
];
const rows: ActivityRow[] = [
  { user_id: 'old', activity_date: '2026-09-15', last_seen_at: '2026-09-15T01:00:00Z' },
  { user_id: 'old', activity_date: '2026-09-16', last_seen_at: '2026-09-16T01:00:00Z' },
  { user_id: 'today', activity_date: '2026-09-16', last_seen_at: '2026-09-16T01:00:00Z' },
  { user_id: 'deleted', activity_date: '2026-09-16', last_seen_at: '2026-09-16T01:00:00Z' },
];

test('signup method uses original server metadata, not linked identities or editable metadata', () => {
  assert.equal(signupSource(account('wx', '', 'email', { app_metadata: { provider: 'email', signup_source: 'wechat' } })), 'wechat');
  assert.equal(signupSource(account('legacy', '', 'email', { email: 'someone@no-email.app' })), 'legacy');
  assert.equal(signupSource(account('apple', '', 'apple', { email: undefined })), 'apple');
  assert.equal(signupSource(account('bound', '', 'email', { user_metadata: { signup_source: 'wechat' }, identities: [{ provider: 'apple' }] })), 'email');
  assert.equal(signupSource(account('other', '', 'github')), 'unknown');
});
test('calendar windows include Beijing midnight and today, exclude future registrations', () => {
  assert.equal(analyticsWindow(7, now).start, '2026-09-10');
  const result = summarizeUsers(accounts, { rows: [], since: null, available: true }, 7, now);
  assert.equal(result.newUsers, 2);
  assert.equal(result.daily[0].newUsers, 1);
  assert.equal(result.daily[6].newUsers, 1);
  assert.equal(result.loggedInUsers, 1);
  assert.equal(result.signupSources.reduce((sum, v) => sum + v.count, 0), 2);
});
test('activity deduplicates across days, never substitutes logins or fills missing history with zero', () => {
  const result = summarizeUsers(accounts, { rows, since: '2026-09-15T00:00:00Z', available: true }, 7, now);
  assert.equal(result.activeUsers, 2);
  assert.equal(result.daily[4].activeUsers, null);
  assert.equal(result.daily[5].activeUsers, 1);
  assert.equal(result.daily[6].activeUsers, 2);
  assert.equal(summarizeUsers(accounts, { rows: [], since: null, available: true }, 7, now).activeUsers, null);
  assert.equal(summarizeUsers(accounts, { rows: [], since: null, available: false }, 7, now).activeUsers, null);
  assert.equal(summarizeUsers(accounts, { rows: [], since: '2026-09-15T00:00:00Z', available: true }, 7, now).daily[6].activeUsers, 0);
});
test('invalid user statistics filters are rejected', () => {
  for (const query of ['days=365', 'days=abc', 'cohort=secret', 'source=google']) {
    assert.throws(() => parseAdminQuery(new URLSearchParams(query)));
  }
});
test('activity reader reads beyond the first database page and surfaces failures', async () => {
  const offsets: number[] = [];
  const fake = { from(table: string) {
    const query = { select() { return this; }, eq() { return this; }, gte() { return this; }, lte() { return this; }, order() { return this; },
      async maybeSingle() { return { data: { started_at: '2026-09-15T00:00:00Z' }, error: null }; },
      async range(start: number) { offsets.push(start); return { data: start === 0 ? Array(1000).fill(rows[0]) : [rows[1]], error: null }; },
    };
    assert.ok(['user_activity_coverage', 'user_daily_activity'].includes(table));
    return query;
  } } as unknown as SupabaseClient;
  assert.equal((await readActivity(fake, '2026-09-10', '2026-09-16')).rows.length, 1001);
  assert.deepEqual(offsets, [0, 1000]);
  const failed = { from() { return { select() { return this; }, eq() { return this; }, async maybeSingle() { return { error: { message: 'offline' } }; } }; } } as unknown as SupabaseClient;
  await assert.rejects(readActivity(failed, '2026-09-10', '2026-09-16'), /无法读取/);
});
test('active cohort failures cannot look like a successful empty user list', async () => {
  const fake = {
    auth: { admin: { async listUsers() { return { data: { users: accounts }, error: null }; } } },
    from() { throw new Error('database unavailable'); },
  } as unknown as SupabaseClient;
  await assert.rejects(loadAdminData(fake, parseAdminQuery(new URLSearchParams('view=users&cohort=active'))), /不可用/);
});
