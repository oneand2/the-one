import assert from 'node:assert/strict';
import test from 'node:test';
import { GET as editions } from '../src/app/api/news/editions/route';
import { GET as image } from '../src/app/api/news/media/[date]/[file]/route';

test('private newspaper reader restricts every data and media read to a published issue', async t => {
  const day = '2026-11-13';
  const file = 'd'.repeat(64) + '.webp';
  const mediaPath = '/api/news/media/' + day + '/' + file;
  const req = (path: string) => new Request('http://localhost' + path);
  const context = { params: Promise.resolve({ date: day, file }) };
  const env = {
    NODE_ENV: 'development',
    NEXT_PUBLIC_SUPABASE_URL: 'https://paper.example.invalid',
    SUPABASE_SERVICE_ROLE_KEY: 'test-only',
  };
  const previous = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env);
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  let queries: URL[] = [];
  let rows: unknown[] = [];
  t.mock.method(globalThis, 'fetch', async (input: URL | string | Request) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    queries.push(url);
    assert.equal(url.hostname, 'paper.example.invalid');
    if (url.pathname.includes('/storage/')) return new Response(new Uint8Array([1, 2, 3]));
    assert.equal(url.pathname, '/rest/v1/jtd_news_editions');
    assert.match(url.searchParams.get('published_at') || '', /^lte\.\d{4}-/);
    return Response.json(rows);
  });
  const read = (query = '') => editions(req('/api/news/editions?' + query));

  assert.equal((await read('date=2026-02-30')).status, 400);
  assert.equal(queries.length, 0);

  rows = [{ issue_date: day }];
  assert.deepEqual(await (await read()).json(), { dates: [day], next: null });
  assert.equal(queries.at(-1)?.searchParams.get('select'), 'issue_date');
  const result = await read('locate=an-old-story');
  assert.equal(await result.json(), day);
  assert.equal(queries.at(-1)?.searchParams.get('stories'), 'cs.[{"id":"an-old-story"}]');

  rows = [{ issue_date: day, lunar: '初五', stories: [{ id: 'a' }], description: '' }];
  assert.deepEqual(await (await read('date=' + day)).json(), { date: day, lunar: '初五', description: '', stories: [{ id: 'a' }] });
  assert.equal(queries.at(-1)?.searchParams.get('issue_date'), 'eq.' + day);
  rows = [{ issue_date: day, cover: { title: '头版', photo: mediaPath } }];
  assert.equal((await (await read('cover=' + day)).json()).photo, mediaPath);
  assert.equal(queries.at(-1)?.searchParams.get('select'), 'issue_date,cover');
  rows = [];
  assert.equal((await read('date=' + day)).status, 404);

  queries = [];
  assert.equal((await image(req(mediaPath), context)).status, 404);
  assert.equal(queries.length, 1); // Unreferenced images cannot reach Storage.
  assert.equal(queries[0].searchParams.get('stories'), 'cs.' + JSON.stringify([{ photo: { src: mediaPath } }]));
  rows = [{ issue_date: day }];
  const photo = await image(req(mediaPath), context);
  assert.equal(photo.status, 200);
  assert.equal(photo.headers.get('content-type'), 'image/webp');
  assert.equal(photo.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual([...new Uint8Array(await photo.arrayBuffer())], [1, 2, 3]);
  assert.ok(queries.at(-1)?.pathname.endsWith('/jtd-news-photos/' + day + '/' + file));

  queries = [];
  Object.assign(process.env, { NODE_ENV: 'production' });
  assert.equal((await read('cover=' + day)).status, 404);
  assert.equal((await image(req(mediaPath), context)).status, 404);
  assert.equal(queries.length, 0);
});
