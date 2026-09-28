import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { AmbassadorForbiddenError, AmbassadorInputError, parseReportDates, resolveConsoleAccess, resolveScope, saveAmbassador, validReferralToken } from '../src/lib/ambassadors/server';
import { selectScoped } from '../src/lib/ambassadors/scope';
import { loadAdminData, parseAdminQuery } from '../src/lib/admin/data';
import { ADMIN_EMAIL } from '../src/utils/vip';
const a = 'aeb522e3-9b08-4e4b-a3fb-ebbd0018fb8b';
const b = 'beb522e3-9b08-4e4b-a3fb-ebbd0018fb8b';
const user = { id: a, email: 'a@example.test', email_confirmed_at: '2026-01-01', user_metadata: { role: 'admin' } } as unknown as User;
test('owner remains unrestricted; ambassador scope cannot be removed or changed', () => {
  const access = { role: 'ambassador' as const, ambassadorId: a, name: 'A' };
  assert.equal(resolveScope(access, null, 'orders'), a);
  assert.equal(resolveScope(access, a, 'users'), a);
  for (const value of [b, 'all', '']) {
    if (value) assert.throws(() => resolveScope(access, value, 'users'), AmbassadorForbiddenError);
    else assert.equal(resolveScope(access, value, 'users'), a);
  }
  for (const view of ['settings', 'insights', 'news', 'secret']) assert.throws(() => resolveScope(access, null, view), AmbassadorForbiddenError);
  assert.equal(resolveScope({ role: 'owner', ambassadorId: null, name: '' }, b, 'orders'), b);
  assert.equal(resolveScope({ role: 'owner', ambassadorId: null, name: '' }, null, 'orders'), null);
});
test('only database-assigned active identities authorize ambassadors, never editable metadata', async () => {
  const fake = (data: unknown, error: unknown = null) => ({ from(table: string) {
    assert.equal(table, 'ambassadors');
    return { select() { return this; }, eq(key: string, value: unknown) { if (key === 'active') assert.equal(value, true); return this; }, async maybeSingle() { return { data, error }; } };
  } }) as unknown as SupabaseClient;
  assert.equal(await resolveConsoleAccess(fake(null), user), null);
  assert.equal(await resolveConsoleAccess(fake(null), { ...user, email_confirmed_at: undefined }), null);
  assert.equal((await resolveConsoleAccess(fake({ id: a, name: 'A' }), user))?.ambassadorId, a);
  assert.equal((await resolveConsoleAccess({} as SupabaseClient, { ...user, email: ADMIN_EMAIL }))?.role, 'owner');
  await assert.rejects(resolveConsoleAccess(fake(null, { message: 'offline' }), user));
});
test('date range is inclusive Beijing calendar dates with an exclusive next-day bound', () => {
  assert.deepEqual(parseReportDates(new URLSearchParams('start=2026-09-01&end=2026-09-30')), { start: '2026-08-31T16:00:00.000Z', end: '2026-09-30T16:00:00.000Z' });
  for (const q of ['start=2026-02-30', 'end=2026-13-01', 'start=garbage', 'start=2026-09-30&end=2026-09-01']) assert.throws(() => parseReportDates(new URLSearchParams(q)), AmbassadorInputError);
});
test('all scoped list queries filter in the database before pagination, including Apple', async () => {
  for (const params of ['view=answers','view=comments','view=reports','view=orders&channel=alipay','view=orders&channel=wechat','view=orders&channel=apple']) {
    let scoped = false;
    const fake = { from(table: string) { assert.ok(table.startsWith('ambassador_')); return {
      select(columns: string) { assert.ok(!columns.includes('signed_transaction')); return this; },
      eq(key: string, value: unknown) { if (key === 'ambassador_id') { assert.equal(value, a); scoped = true; } return this; },
      order() { return this; }, async range() { assert.ok(scoped); return { data: [], count: 0, error: null }; },
    }; } } as unknown as SupabaseClient;
    await loadAdminData(fake, parseAdminQuery(new URLSearchParams(params)), a);
  }
  assert.throws(() => selectScoped({} as SupabaseClient, 'daily_insights', '*', {}, a));
});
test('scoped users never return another cohort, even when auth returns multiple pages', async () => {
  const accounts = [{ ...user, created_at: '2026-09-01' }, { ...user, id: b, created_at: '2026-09-01' }];
  const fake = { auth: { admin: { async listUsers({ page }: { page: number }) { return { data: { users: [accounts[page-1]], nextPage: page === 1 ? 2 : null }, error: null }; } } },
    from(table: string) {
      const builder = { select() { return this; }, eq() { return this; }, order() { return this; }, async range() { return { data: [{ user_id: a }], error: null }; }, async in() { return { data: [], error: null }; } };
      if (table === 'user_activity_coverage') throw new Error('unavailable');
      assert.ok(['user_referrals','ambassador_user_profiles'].includes(table));
      return builder;
    },
  } as unknown as SupabaseClient;
  const result = await loadAdminData(fake, parseAdminQuery(new URLSearchParams('view=users')), a);
  assert.equal(result.total, 1); assert.equal(result.rows?.[0].id, a); assert.equal(result.usersAnalytics?.newUsers, 0);
});
test('invalid referral tokens do not reach the database', async () => {
  assert.equal(await validReferralToken({} as SupabaseClient, 'forged'), undefined);
  assert.equal(await validReferralToken({} as SupabaseClient), undefined);
});
test('ambassador setup validates input and disallows an unverified target account', async () => {
  await assert.rejects(saveAmbassador({} as SupabaseClient, a, { action: 'create', userId: b, name: 'B', code: '../../admin' }), AmbassadorInputError);
  await assert.rejects(saveAmbassador({} as SupabaseClient, a, { action: 'status', id: b, active: 'true' }), AmbassadorInputError);
  const fake = { auth: { admin: { async getUserById() { return { data: { user: { id: b } }, error: null }; } } } } as unknown as SupabaseClient;
  await assert.rejects(saveAmbassador(fake, a, { action: 'create', userId: b, name: 'B', code: 'test-b' }), /验证/);
});
