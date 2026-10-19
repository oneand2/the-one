/** Explicit live check: local HTTP + real Auth/database. No provider login, emails,
 * sessions or payments. Creates disposable identities; always removes fixtures.
 * REFERRAL_TEST_BASE_URL=http://127.0.0.1:3040 AMBASSADOR_TEST_CODE=xiaoye node --import tsx scripts/check-referral-transport.ts
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';
import { createAdminClient } from '../src/utils/supabase/admin';
import { REFERRAL_COOKIE } from '../src/lib/ambassadors/shared';
import { deriveWechatAuthIdentity, WECHAT_MP_TICKET_COOKIE } from '../src/lib/auth/wechat';
import { loginOrCreateWechatUser } from '../src/lib/auth/wechatIdentity';

dotenv.config({ path: '.env.local', quiet: true });
async function main() {
  const base = new URL(process.env.REFERRAL_TEST_BASE_URL || '');
  assert.ok(['127.0.0.1', 'localhost'].includes(base.hostname), 'HTTP test must target loopback');
  const code = process.env.AMBASSADOR_TEST_CODE;
  assert.ok(code && /^[a-z0-9][a-z0-9-]{2,31}$/.test(code));
  const admin = createAdminClient();
  const ambassador = await admin.from('ambassadors').select('id').eq('code', code).eq('active', true).single();
  assert.ifError(ambassador.error);
  const visits = new Set<string>(), tickets = new Set<string>(), users = new Set<string>();
  function cookie(response: Response, name: string) {
    const entry = response.headers.getSetCookie().find(c => c.startsWith(`${name}=`));
    return entry?.slice(name.length + 1).split(';')[0];
  }
  async function get(path: string, headers: Record<string, string> = {}) {
    const response = await fetch(new URL(path, base), { headers, redirect: 'manual', signal: AbortSignal.timeout(90000) });
    const token = cookie(response, REFERRAL_COOKIE); if (token) visits.add(token);
    const ticket = cookie(response, WECHAT_MP_TICKET_COOKIE); if (ticket) tickets.add(ticket);
    return response;
  }
  try {
    const entry = await get(`/r/${code}`);
    assert.equal(entry.status, 307);
    const landing = new URL(entry.headers.get('location')!);
    assert.equal(landing.origin, base.origin); assert.equal(landing.searchParams.get('ref'), code);
    const firstToken = cookie(entry, REFERRAL_COOKIE); assert.ok(firstToken);
    assert.ok(!landing.href.includes(firstToken));
    // A different browser receives only the public URL, none of the first browser's cookies.
    const secondBrowser = await get(landing.pathname + landing.search);
    assert.equal(secondBrowser.status, 200);
    const secondToken = cookie(secondBrowser, REFERRAL_COOKIE); assert.ok(secondToken); assert.notEqual(secondToken, firstToken);
    const visit = await admin.from('ambassador_visits').select('ambassador_id,expires_at').eq('token', secondToken).single();
    assert.ifError(visit.error); assert.equal(visit.data!.ambassador_id, ambassador.data!.id);
    console.log('PASS: referral entry → shared homepage → new browser restores source');

    const login = await get(`/login?ref=${code}`, { Cookie: `${REFERRAL_COOKIE}=${secondToken}` });
    assert.equal(login.status, 200); assert.ok((await login.text()).includes(`ref=${code}`));
    const started = await get(`/api/auth/wechat/start?mode=login&next=%2F&ref=${code}`, { Cookie: `${REFERRAL_COOKIE}=${secondToken}`, 'User-Agent': 'Mozilla/5.0 iPhone Safari/604.1' });
    assert.equal(started.status, 307);
    assert.equal(new URL(started.headers.get('location')!).pathname, '/login/wechat-bridge');
    const ticketId = cookie(started, WECHAT_MP_TICKET_COOKIE); assert.ok(ticketId);
    const ticket = await admin.from('wechat_login_tickets').select('ambassador_token').eq('id', ticketId).single();
    assert.ifError(ticket.error); assert.equal(ticket.data!.ambassador_token, secondToken);
    console.log('PASS: login → mini-program ticket keeps the same source');

    const profile = { appId: 'referral-transport-test', openid: `test-${randomUUID()}`, unionid: `test-${randomUUID()}`, nickname: '推广传递临时测试', avatarUrl: null };
    users.add(deriveWechatAuthIdentity(profile.appId, profile.openid, profile.unionid).userId);
    const userId = await loginOrCreateWechatUser(admin, profile, ticket.data!.ambassador_token);
    const assigned = await admin.from('user_referrals').select('ambassador_id').eq('user_id', userId).single();
    assert.ifError(assigned.error); assert.equal(assigned.data!.ambassador_id, ambassador.data!.id);
    assert.equal(await loginOrCreateWechatUser(admin, profile, firstToken), userId);
    console.log('PASS: actual Auth signup captures source; repeat login preserves the account');

    const reopened = await get(`/r/${code}`, { Cookie: `${REFERRAL_COOKIE}=${secondToken}` });
    assert.equal(cookie(reopened, REFERRAL_COOKIE), secondToken);
    const unchanged = await admin.from('ambassador_visits').select('expires_at').eq('token', secondToken).single();
    assert.ifError(unchanged.error); assert.equal(unchanged.data!.expires_at, visit.data!.expires_at);
    console.log('PASS: reopening never resets the original expiry');
  } finally {
    const failures: string[] = [];
    for (const id of users) {
      let cleaned = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        const removed = await admin.auth.admin.deleteUser(id);
        if (!removed.error || removed.error.status === 404) { cleaned = true; break; }
      }
      if (!cleaned) failures.push('test user cleanup failed');
    }
    for (const id of tickets) {
      const removed = await admin.from('wechat_login_tickets').delete().eq('id', id);
      if (removed.error) failures.push('test ticket cleanup failed');
    }
    for (const token of visits) {
      const removed = await admin.from('ambassador_visits').delete().eq('token', token);
      if (removed.error) failures.push('test visit cleanup failed');
    }
    assert.deepEqual(failures, []);
    console.log('Temporary users, tickets and visits removed');
  }
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Validation failed'); process.exitCode = 1; });
