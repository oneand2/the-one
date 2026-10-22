import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test, type TestContext } from 'node:test';
import ts from 'typescript';
import * as moderation from '../src/lib/communityModeration';
import * as titles from '../src/lib/jianzhongshengTitle';

const body = '下班经过那家熟悉的小店，又买了一碗热汤带回家。';
const original = {
  id: 'c1859353-f861-4568-aefe-3d4df98dce76',
  user_id: 'writer',
  display_id: '陈佳',
  body,
  created_at: '2026-10-21T01:00:00Z',
};
const missingTitle = { code: '42703', message: 'column jianzhongsheng_answers.title does not exist' };

type Query = { table: string; columns?: string; fields?: Record<string, unknown>; filters: Record<string, unknown> };
type QueryResult = { data: unknown; error?: { code?: string; message: string } | null };

function loadRoute(context: TestContext, options: {
  user?: string | null;
  hasTitleColumn?: boolean;
  nickname?: string;
  suspendedUntil?: string;
  existingStatus?: string;
  readError?: { code: string; message: string };
  rows?: Array<Record<string, unknown>>;
  blockedUserIds?: string[];
} = {}) {
  const queries: Query[] = [];
  const writes: Record<string, unknown>[] = [];
  const rows = options.rows ?? [{ ...original, title: '带回家的热汤' }];
  const client = {
    auth: { async getUser() { return { data: { user: options.user === null ? null : { id: options.user ?? 'writer' } } }; } },
    from(table: string) {
      const query: Query = { table, filters: {} };
      queries.push(query);
      const execute = (): QueryResult => {
        if (table === 'jianzhongsheng_user_blocks') {
          return { data: (options.blockedUserIds ?? []).map(id => ({ blocked_user_id: id })) };
        }
        if (table === 'user_profiles') {
          return { data: { nickname: options.nickname ?? '陈佳', community_suspended_until: options.suspendedUntil } };
        }
        assert.equal(table, 'jianzhongsheng_answers');
        if (options.hasTitleColumn === false && query.columns?.includes('title')) return { data: null, error: missingTitle };
        if (query.fields) {
          writes.push(query.fields);
          return { data: { ...original, title: '带回家的热汤', ...query.fields } };
        }
        if (query.columns === 'moderation_status') {
          return { data: options.existingStatus ? { moderation_status: options.existingStatus } : null };
        }
        if (options.readError) return { data: null, error: options.readError };
        return { data: rows.map(row => {
          if (options.hasTitleColumn !== false) return row;
          const legacy = { ...row };
          delete legacy.title;
          return legacy;
        }) };
      };
      const builder = {
        select(columns: string) { query.columns = columns; return this; },
        eq(column: string, value: unknown) { query.filters[column] = value; return this; },
        order() { return this; },
        limit() { return this; },
        upsert(fields: Record<string, unknown>, config: { onConflict: string }) {
          assert.equal(config.onConflict, 'question_id,user_id');
          query.fields = fields;
          return this;
        },
        async single() { return execute(); },
        async maybeSingle() { return execute(); },
        then(resolve: (value: QueryResult) => unknown, reject?: (error: unknown) => unknown) {
          return Promise.resolve(execute()).then(resolve, reject);
        },
      };
      return builder;
    },
  };
  const replacements: Record<string, unknown> = {
    '@/lib/communityModeration': moderation,
    '@/lib/jianzhongshengTitle': titles,
    '@/utils/supabase/server': { createClient: async () => client },
    '@/utils/supabase/admin': { createAdminClient: () => client },
  };
  const require = createRequire(`${process.cwd()}/package.json`);
  const code = ts.transpileModule(readFileSync('src/app/api/jianzhongsheng/route.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const exports = {} as { GET(request: Request): Promise<Response>; POST(request: Request): Promise<Response> };
  new Function('require', 'exports', code)((name: string) => replacements[name] ?? require(name), exports);
  context.mock.method(console, 'error', () => undefined);
  return { ...exports, queries, writes };
}

function post(payload: unknown) {
  return new Request('https://example.test/api/jianzhongsheng', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
}

test('optional titles trim whitespace, reject invalid types and count Unicode code points', () => {
  assert.deepEqual(titles.normalizeJianzhongshengTitle(undefined), { ok: true, text: '' });
  assert.deepEqual(titles.normalizeJianzhongshengTitle(' \n\t '), { ok: true, text: '' });
  assert.deepEqual(titles.normalizeJianzhongshengTitle('  下班路上的热汤  '), { ok: true, text: '下班路上的热汤' });
  const unicodeTitle = '甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥🌱🌲';
  assert.equal(Array.from(unicodeTitle).length, 24);
  assert.deepEqual(titles.normalizeJianzhongshengTitle(unicodeTitle), { ok: true, text: unicodeTitle });
  assert.equal(titles.normalizeJianzhongshengTitle(`${unicodeTitle}🌳`).ok, false);
  for (const invalid of [null, 12, {}, [], true]) assert.equal(titles.normalizeJianzhongshengTitle(invalid).ok, false);
});

test('titles use community moderation and recheck length after text normalization', () => {
  assert.equal(titles.normalizeJianzhongshengTitle('代开发票').ok, false);
  assert.equal(titles.normalizeJianzhongshengTitle('㍿㍿㍿㍿㍿㍿㍿').ok, false);
});

test('public reads return titles, preserve untitled notes and still filter blocked writers', async context => {
  const route = loadRoute(context, { rows: [
    { ...original, title: '带回家的热汤' },
    { ...original, id: 'old', user_id: 'someone-else' },
    { ...original, id: 'blocked', user_id: 'blocked-writer', title: '看不见的手记' },
  ], blockedUserIds: ['blocked-writer'] });
  const response = await route.GET(new Request('https://example.test/api/jianzhongsheng?questionId=daily-note'));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.deepEqual(result.answers.map((entry: { id: string; title: string }) => [entry.id, entry.title]), [
    [original.id, '带回家的热汤'], ['old', ''],
  ]);
  assert.equal(result.answers[0].mine, true);
  assert.equal(result.answers[1].reportable, true);
});

test('missing title migration falls back to readable history with an explicit capability flag', async context => {
  const route = loadRoute(context, { user: null, hasTitleColumn: false });
  const response = await route.GET(new Request('https://example.test/api/jianzhongsheng?questionId=daily-note'));
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.titlesUnavailable, true);
  assert.equal(result.answers[0].title, '');
  assert.equal(result.answers[0].body, body);
  assert.equal(route.queries.filter(query => query.table === 'jianzhongsheng_answers').length, 2);
});

test('other read failures stay unavailable and do not masquerade as missing titles', async context => {
  const route = loadRoute(context, { user: null, readError: { code: '42501', message: 'permission denied for title' } });
  const response = await route.GET(new Request('https://example.test/api/jianzhongsheng?questionId=daily-note'));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { answers: [], unavailable: true });
  assert.equal(route.queries.length, 1);
});

test('publishing persists the normalized title, body, authenticated ownership and display name', async context => {
  const route = loadRoute(context);
  const response = await route.POST(post({ questionId: 'daily-note', title: '  回家路上  ', body, user_id: 'forged' }));
  assert.equal(response.status, 200);
  assert.equal(route.writes.length, 1);
  assert.equal(route.writes[0].title, '回家路上');
  assert.equal(route.writes[0].user_id, 'writer');
  assert.equal(route.writes[0].display_id, '陈佳');
  assert.equal(route.writes[0].body, body.normalize('NFKC'));
  assert.equal((await response.json()).answer.title, '回家路上');
});

test('legacy requests omit title on write, while explicit blank titles clear it', async context => {
  const route = loadRoute(context);
  const legacyResponse = await route.POST(post({ questionId: 'daily-note', body }));
  assert.equal(legacyResponse.status, 200);
  assert.equal(Object.hasOwn(route.writes[0], 'title'), false);
  assert.equal((await legacyResponse.json()).answer.title, '带回家的热汤');
  const clearResponse = await route.POST(post({ questionId: 'daily-note', title: '   ', body }));
  assert.equal(clearResponse.status, 200);
  assert.equal(route.writes[1].title, '');
});

test('nonempty titles fail clearly before a title migration, without silently saving only the body', async context => {
  const route = loadRoute(context, { hasTitleColumn: false });
  const response = await route.POST(post({ questionId: 'daily-note', title: '带回家的热汤', body }));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, 'TITLE_SCHEMA_UNAVAILABLE');
  assert.deepEqual(route.writes, []);
});

test('untitled legacy publishing still succeeds before the title migration', async context => {
  for (const title of [undefined, '   ']) {
    const route = loadRoute(context, { hasTitleColumn: false });
    const response = await route.POST(post({ questionId: 'daily-note', title, body }));
    assert.equal(response.status, 200);
    assert.equal(route.writes.length, 1);
    assert.equal(Object.hasOwn(route.writes[0], 'title'), false);
  }
});

test('invalid title, body and payload never reach publication', async context => {
  const route = loadRoute(context);
  for (const payload of [
    null, [], 7,
    { questionId: 'daily-note', title: null, body },
    { questionId: 'daily-note', title: '甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥子丑寅', body },
    { questionId: 'daily-note', title: '代开发票', body },
    { questionId: 'daily-note', title: '一个标题', body: '太短了' },
    { questionId: 'daily-note', title: '一个标题', body: `${body} 代开发票` },
  ]) assert.equal((await route.POST(post(payload))).status, 400);
  assert.deepEqual(route.writes, []);
});

test('authentication, suspension and moderation restrictions still prevent publishing titled notes', async context => {
  for (const [options, status] of [
    [{ user: null }, 401],
    [{ suspendedUntil: '2999-01-01T00:00:00Z' }, 403],
    [{ existingStatus: 'hidden' }, 403],
  ] as const) {
    const route = loadRoute(context, options);
    assert.equal((await route.POST(post({ questionId: 'daily-note', title: '回家路上', body }))).status, status);
    assert.deepEqual(route.writes, []);
  }
});
