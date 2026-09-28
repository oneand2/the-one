/** Explicit live integration check. Creates only disposable test accounts;
 * sends no email, creates no sessions/orders, and deletes its accounts in finally.
 * Run with AMBASSADOR_TEST_CODE=<active code> node --import tsx scripts/check-wechat-referral.ts
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';
import { createAdminClient } from '../src/utils/supabase/admin';
import { deriveWechatAuthIdentity } from '../src/lib/auth/wechat';
import { loginOrCreateWechatUser } from '../src/lib/auth/wechatIdentity';

dotenv.config({ path: '.env.local', quiet: true });

async function main() {
  assert.ok(process.env.AMBASSADOR_TEST_CODE, 'Set AMBASSADOR_TEST_CODE explicitly');
  const admin = createAdminClient();
  const { data: ambassador, error } = await admin.from('ambassadors').select('id')
    .eq('code', process.env.AMBASSADOR_TEST_CODE).eq('active', true).single();
  assert.ifError(error);
  const visit = await admin.from('ambassador_visits').insert({ ambassador_id: ambassador!.id }).select('token').single();
  assert.ifError(visit.error);
  const token = visit.data!.token;
  const ids = new Set<string>();
  async function referral(userId: string) {
    const result = await admin.from('user_referrals').select('ambassador_id').eq('user_id', userId).maybeSingle();
    assert.ifError(result.error);
    return result.data?.ambassador_id;
  }
  const profile = (suffix: string) => ({ appId: 'referral-integration-test', openid: `test-${suffix}-${randomUUID()}`, unionid: `test-union-${randomUUID()}`, nickname: '推广归属临时测试', avatarUrl: null });
  try {
    const fresh = profile('new');
    ids.add(deriveWechatAuthIdentity(fresh.appId, fresh.openid, fresh.unionid).userId);
    const freshId = await loginOrCreateWechatUser(admin, fresh, token);
    assert.equal(await referral(freshId), ambassador!.id, 'new WeChat signup must be attributed during account creation');
    assert.equal(await loginOrCreateWechatUser(admin, fresh, token), freshId);
    assert.equal(await referral(freshId), ambassador!.id, 'repeat login must preserve attribution');
    assert.equal(await loginOrCreateWechatUser(admin, { ...fresh, appId: 'other-test-app', openid: `other-${randomUUID()}` }, token), freshId, 'website and mini program must share the same unionid account');

    const existing = profile('existing');
    ids.add(deriveWechatAuthIdentity(existing.appId, existing.openid, existing.unionid).userId);
    const existingId = await loginOrCreateWechatUser(admin, existing);
    await loginOrCreateWechatUser(admin, existing, token);
    assert.equal(await referral(existingId), undefined, 'an existing account must not acquire a referral on login');

    // This is the same generateLink signup path used by the email OTP mailer,
    // but no email is sent and no bearer token is logged or redeemed.
    const email = `referral-check-${randomUUID()}@ambassador-test.invalid`;
    const generated = await admin.auth.admin.generateLink({ type: 'signup', email,
      password: randomUUID() + 'aA!9', options: { data: { nickname: '推广归属临时测试', ambassador_token: token } } });
    if (generated.data.user) ids.add(generated.data.user.id);
    assert.ifError(generated.error);
    assert.equal(await referral(generated.data.user!.id), ambassador!.id, 'email signup must be attributed');

    const report = await admin.rpc('ambassador_performance', { p_ambassador_id: ambassador!.id });
    assert.ifError(report.error);
    assert.ok(report.data[0].registered_users >= 2);
    console.log('PASS: real Auth API WeChat signup, repeat login, existing account exclusion, email signup and report');
  } finally {
    const cleanupErrors: string[] = [];
    for (const id of ids) {
      const removed = await admin.auth.admin.deleteUser(id);
      if (removed.error && removed.error.status !== 404) cleanupErrors.push(removed.error.message);
    }
    const removedVisit = await admin.from('ambassador_visits').delete().eq('token', token);
    if (removedVisit.error) cleanupErrors.push(removedVisit.error.message);
    assert.deepEqual(cleanupErrors, [], 'test fixtures must be removed');
    console.log('Temporary test accounts and visit removed');
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
