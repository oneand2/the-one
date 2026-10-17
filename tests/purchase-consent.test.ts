import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { hasPurchaseConsent, purchaseConsentKey, PURCHASE_CONSENT_VERSION, savePurchaseConsent } from '../src/lib/payments/purchaseConsent';

test('purchase consent is versioned, account-scoped, revocable and safe when browser storage is unavailable', () => {
  const originalWindow = globalThis.window;
  const storage = new Map<string, string>();
  try {
    globalThis.window = {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
      },
    } as unknown as Window & typeof globalThis;
    assert.equal(hasPurchaseConsent('buyer-a'), false);
    savePurchaseConsent('buyer-a', true);
    assert.equal(hasPurchaseConsent('buyer-a'), true);
    assert.equal(hasPurchaseConsent('buyer-b'), false);
    for (const record of [
      'invalid-json', 'true', 'null',
      JSON.stringify({ version: 'old', acceptedAt: Date.now() }),
      JSON.stringify({ version: PURCHASE_CONSENT_VERSION, acceptedAt: Date.now() + 60_000 }),
      JSON.stringify({ version: PURCHASE_CONSENT_VERSION, acceptedAt: 0 }),
    ]) {
      storage.set(purchaseConsentKey('buyer-a'), record);
      assert.equal(hasPurchaseConsent('buyer-a'), false);
    }
    savePurchaseConsent('buyer-a', true);
    savePurchaseConsent('buyer-a', false);
    assert.equal(hasPurchaseConsent('buyer-a'), false);
    assert.equal(storage.size, 0);
    savePurchaseConsent('', true);
    assert.equal(storage.size, 0);
    Object.defineProperty(globalThis.window, 'localStorage', { get() { throw new Error('Storage blocked'); } });
    assert.equal(hasPurchaseConsent('buyer-a'), false);
    assert.doesNotThrow(() => savePurchaseConsent('buyer-a', true));
    assert.doesNotThrow(() => savePurchaseConsent('buyer-a', false));
    Reflect.deleteProperty(globalThis, 'window');
    assert.equal(hasPurchaseConsent('buyer-a'), false);
    assert.doesNotThrow(() => savePurchaseConsent('buyer-a', true));
  } finally {
    if (originalWindow === undefined) Reflect.deleteProperty(globalThis, 'window');
    else globalThis.window = originalWindow;
  }
});

test('profile response scopes browser consent to the server-authenticated account for both existing and new profiles', async () => {
  let userId: string | null = 'buyer-a';
  let existing = true;
  const database = {
    select() { return this; }, eq() { return this; }, insert() { return this; },
    async single() { return { data: existing ? { nickname: 'Buyer', coins_balance: 300 } : null, error: null }; },
    async maybeSingle() { return { data: null }; },
  };
  const replacements: Record<string, unknown> = {
    '@/lib/userActivity': { scheduleUserActivity() {} },
    '@/utils/supabase/server': { createClient: async () => ({
      auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
      from: () => ({ ...database, insert() { existing = true; return this; } }),
    }) },
  };
  const require = createRequire(`${process.cwd()}/package.json`);
  const exports: { GET?: () => Promise<Response> } = {};
  const code = ts.transpileModule(readFileSync('src/app/api/user/profile/route.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  new Function('require', 'exports', code)((name: string) => replacements[name] ?? require(name), exports);
  assert.equal((await (await exports.GET!()).json()).user_id, 'buyer-a');
  userId = 'buyer-b';
  existing = false;
  assert.equal((await (await exports.GET!()).json()).user_id, 'buyer-b');
  userId = null;
  assert.equal((await exports.GET!()).status, 401);
});
