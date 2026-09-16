import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { chinaDay, literalSearch, loadAdminData, parseAdminQuery } from '../src/lib/admin/data';
import { isAdminIdentity } from '../src/lib/admin/policy';
import { ADMIN_EMAIL } from '../src/utils/vip';
import { AdminInputError, applyAdminMutation, validateMutation } from '../src/lib/admin/mutations';

const id = 'eeb522e3-9b08-4e4b-a3fb-ebbd0018fb8b';
const adminId = '6646af70-20bb-4f38-8234-fd2ad7e589ba';

test('date boundaries use Beijing midnight, including year rollover', () => {
  assert.equal(chinaDay(0, new Date('2026-12-31T16:00:00Z')), '2027-01-01');
  assert.equal(chinaDay(-1, new Date('2026-12-31T16:00:00Z')), '2026-12-31');
});
test('query parsing rejects unknown modules and malformed pagination', () => {
  for (const query of ['view=secrets', 'page=NaN', 'page=-1', 'page=1.5', 'page=100001']) {
    assert.throws(() => parseAdminQuery(new URLSearchParams(query)));
  }
  assert.equal(literalSearch('50%_\\'), '50\\%\\_\\\\');
});
test('mutations allow only explicit operations and require an audit reason', () => {
  for (const input of [null, [], { id, entity: 'payment_orders', action: 'paid' }, { id, entity: 'users', action: 'coins' }, { id, entity: 'answers', action: 'hide', reason: '' }, { id, entity: 'users', action: 'vip', duration: 'forever' }]) {
    assert.throws(() => validateMutation(input), AdminInputError);
  }
  const result = validateMutation({ id, entity: 'answers', action: 'hide', reason: ' 垃圾广告 ', user_id: adminId, coins_balance: 999 });
  assert.equal(result.reason, '垃圾广告');
  assert.ok(!('coins_balance' in result));
});
test('moderation persists an audit trail, restore is reversible, missing rows fail', async () => {
  const state = { id, moderation_status: 'visible' } as Record<string, unknown>;
  let exists = true;
  const fake = { from(table: string) {
    assert.equal(table, 'jianzhongsheng_answers');
    return { update(fields: Record<string, unknown>) { return { eq(key: string, value: string) {
      assert.equal(key, 'id'); assert.equal(value, id);
      return { select() { return { async maybeSingle() { if (exists) Object.assign(state, fields); return { data: exists ? { id } : null, error: null }; } }; } };
    } }; } };
  } } as unknown as SupabaseClient;
  await applyAdminMutation(fake, adminId, { id, entity: 'answers', action: 'hide', reason: '内容待复核' });
  assert.equal(state.moderation_status, 'hidden'); assert.equal(state.moderated_by, adminId);
  assert.ok(!Number.isNaN(Date.parse(String(state.moderated_at))));
  await applyAdminMutation(fake, adminId, { id, entity: 'answers', action: 'restore', reason: '复核后恢复' });
  assert.equal(state.moderation_status, 'visible');
  exists = false;
  await assert.rejects(applyAdminMutation(fake, adminId, { id, entity: 'answers', action: 'hide', reason: '内容待复核' }), /不存在/);
});
test('administrator cannot suspend themselves', async () => {
  await assert.rejects(applyAdminMutation({} as SupabaseClient, id, { id, entity: 'users', action: 'suspend7d' }), /自己的/);
});
test('read errors are not represented as empty successful lists', async () => {
  const builder = { select() { return this; }, order() { return this; }, async range() { return { data: null, count: null, error: { message: 'offline' } }; } };
  const fake = { from() { return builder; } } as unknown as SupabaseClient;
  await assert.rejects(loadAdminData(fake, parseAdminQuery(new URLSearchParams('view=answers'))), /无法读取/);
});
test('users without profiles remain visible and searches work beyond the first auth page', async () => {
  const account = (userId: string, email: string) => ({ id: userId, email, created_at: '2026-09-01T00:00:00Z' });
  const fake = {
    auth: { admin: { async listUsers({ page }: { page: number }) { return { data: { users: page === 1 ? [account(id, 'one@example.test')] : [account(adminId, 'two@example.test')], nextPage: page === 1 ? 2 : null }, error: null }; } } },
    from() { return { select() { return { async in() { return { data: [], error: null }; } }; } }; },
  } as unknown as SupabaseClient;
  const result = await loadAdminData(fake, parseAdminQuery(new URLSearchParams('view=users&q=two%40example.test')));
  assert.equal(result.total, 1); assert.equal(result.rows?.[0].id, adminId); assert.equal(result.rows?.[0].coins_balance, null);
});


test('only the verified existing admin identity is accepted', () => {
  assert.equal(isAdminIdentity(null), false);
  assert.equal(isAdminIdentity({ email: ADMIN_EMAIL }), false);
  assert.equal(isAdminIdentity({ email: 'member@example.test', email_confirmed_at: '2026-01-01' }), false);
  assert.equal(isAdminIdentity({ email: ADMIN_EMAIL.toUpperCase(), email_confirmed_at: '2026-01-01' }), true);
});

test('cross-site writes are rejected even when the origin is otherwise trusted', async () => {
  const { isSameOrigin } = await import('../src/lib/admin/policy');
  assert.equal(isSameOrigin(new Request('https://example.test/api/admin/console', { headers: { origin: 'https://example.test' } })), true);
  assert.equal(isSameOrigin(new Request('https://example.test/api/admin/console', { headers: { origin: 'https://evil.test' } })), false);
  assert.equal(isSameOrigin(new Request('https://example.test/api/admin/console', { headers: { origin: 'https://example.test', 'sec-fetch-site': 'cross-site' } })), false);
});

test('VIP changes write only the requested entitlement, preserving balances', async () => {
  let saved: Record<string, unknown> = {};
  const fake = {
    auth: { admin: { async getUserById() { return { data: { user: { id } }, error: null }; } } },
    from(table: string) { assert.equal(table, 'user_profiles'); return { async upsert(fields: Record<string, unknown>) { saved = fields; return { error: null }; } }; },
  } as unknown as SupabaseClient;
  await applyAdminMutation(fake, adminId, { id, entity: 'users', action: 'vip', duration: '1m', coins_balance: 100000 });
  assert.deepEqual(Object.keys(saved).sort(), ['user_id', 'vip_expires_at']);
  assert.ok(Date.parse(String(saved.vip_expires_at)) > Date.now());
});

test('insight edits reject incomplete provenance and malformed paragraphs', () => {
  const draft = { id, entity: 'insights', action: 'save', title: '读书', source_label: '《庄子》', original_language: '文言', original_text: '原文'.repeat(15), body: ['甲'.repeat(45), '乙'.repeat(45), '丙'.repeat(45)].join('\n\n'), sources: '底本与页码' };
  assert.ok(validateMutation(draft).fields);
  assert.throws(() => validateMutation({ ...draft, sources: '' }), AdminInputError);
  assert.throws(() => validateMutation({ ...draft, body: '甲'.repeat(135) }), /三至六段/);
});
