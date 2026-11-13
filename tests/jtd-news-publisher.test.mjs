import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { prepare, store } from '../scripts/publish-news-edition.mjs';

const date = '2026-11-13';
const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64');
const key = date + '/' + createHash('sha256').update(image).digest('hex') + '.png';
const issue = {
  date, lunar: '十月初五',
  stories: [{
    id: 'brief', placement: 'brief', category: '民生', section: '交通', city: '重庆',
    title: '新线路开通', deck: '首段今日开通。', paragraphs: ['今日开通首段。'],
    sources: [['官方报道', 'https://example.com/report']],
    photo: { src: '/api/news/media/' + key, width: 1, height: 1,
      alt: '现场', caption: '今日现场', credit: '发布机构', label: '现场图',
      sourceUrl: 'https://example.com/photo' },
  }],
};

async function fixture() {
  let row, reads = 0, uploads = 0, updates = 0;
  let returnedImage = image;
  const db = {
    storage: { from(bucket) {
      assert.equal(bucket, 'jtd-news-photos');
      return {
        async download(requested) {
          assert.equal(requested, key); reads++;
          return { data: new Blob([returnedImage]), error: null };
        },
        async upload() { uploads++; return { error: null }; },
      };
    } },
    from(table) {
      assert.equal(table, 'jtd_news_editions');
      return {
        select() { return { eq() { return { maybeSingle: async () => ({ data: row, error: null }) }; } }; },
        update(content) { return { eq(field, value) {
          assert.equal(field, 'issue_date'); assert.equal(value, date);
          return { eq(revisionField, revision) {
            assert.equal(revisionField, 'revision'); assert.equal(revision, row.revision);
            return { select: async () => {
              row = { ...row, ...content, revision: row.revision + 1 }; updates++;
              return { data: [{ revision: row.revision }], error: null };
            } };
          } };
        } }; },
      };
    },
  };
  const prepared = await prepare(issue, date, {}, () => db);
  row = { ...structuredClone(prepared.fields), revision: 1, published_at: date + 'T00:00:00Z' };
  row.stories[0].paragraphs = ['旧的长短讯正文。'];
  return {
    db, prepared,
    stats: () => ({ reads, uploads, updates }),
    corrupt: () => { returnedImage = Buffer.from('changed'); },
  };
}

test('copy corrections reuse stored photos and still read back their bytes before publication', async () => {
  const f = await fixture();
  assert.match(await store(f.db, f.prepared, { publish: true, 'expect-revision': '1' }), /已更正.*版本 2/);
  assert.deepEqual(f.stats(), { reads: 2, uploads: 0, updates: 1 });
});

test('a changed cloud image blocks the copy correction before writing the issue', async () => {
  const f = await fixture(); f.corrupt();
  await assert.rejects(store(f.db, f.prepared, { publish: true, 'expect-revision': '1' }), /回读与原图不一致/);
  assert.deepEqual(f.stats(), { reads: 2, uploads: 0, updates: 0 });
});

test('new photos are uploaded and checked before the issue is written', async () => {
  const f = await fixture();
  for (const file of f.prepared.files.values()) file.stored = false;
  await store(f.db, f.prepared, { publish: true, 'expect-revision': '1' });
  assert.deepEqual(f.stats(), { reads: 2, uploads: 1, updates: 1 });
});
