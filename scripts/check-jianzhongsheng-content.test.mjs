import assert from 'node:assert/strict';
import test from 'node:test';
import { checkJianZhongShengContent } from './check-jianzhongsheng-content.mjs';

const validEntry = {
  id: 'test-note',
  authorId: '王小青',
  title: '晚饭还没凉',
  excerpt: '下班回来，锅里还留着半碗汤。',
  body: '下班回来，锅里还留着半碗汤。\n\n我今年三十岁，仍然学不会估计两个人的饭量。',
};

function checkEntries(entries) {
  return checkJianZhongShengContent(`export const jianZhongShengSpace = ${JSON.stringify({ entries })};`);
}

test('accepts distinct titles and ignores sample comment fields', () => {
  const result = checkEntries([{
    ...validEntry,
    sampleComments: [{ authorId: '小李', body: '我三十岁，也一样' }],
  }, { ...validEntry, id: 'second-note', title: '晚饭，还没凉' }]);
  assert.equal(result.entryCount, 2);
  assert.deepEqual(result.violations, []);
});

test('requires a nonempty title without leading or trailing whitespace', () => {
  for (const title of [undefined, '', ' \n ']) {
    assert.match(checkEntries([{ ...validEntry, title }]).violations.join('\n'), /缺少非空.*title/u);
  }
  assert.match(checkEntries([{ ...validEntry, title: ' 晚饭还没凉 ' }]).violations.join('\n'), /首尾不能包含空白/u);
});

test('counts title length by Unicode code points', () => {
  assert.deepEqual(checkEntries([{ ...validEntry, title: '🌙'.repeat(24) }]).violations, []);
  assert.match(checkEntries([{ ...validEntry, title: '🌙'.repeat(25) }]).violations.join('\n'), /超过 24 个 Unicode 码点/u);
});

test('rejects a title equal to its author name', () => {
  assert.match(checkEntries([{ ...validEntry, title: validEntry.authorId }]).violations.join('\n'), /不能与 authorId 相同/u);
});

test('rejects identical titles after Unicode normalization', () => {
  const result = checkEntries([
    { ...validEntry, title: 'Café' },
    { ...validEntry, id: 'second-note', title: 'Cafe\u0301' },
  ]);
  assert.match(result.violations.join('\n'), /与“test-note”重复/u);
});

test('preserves the age opening rule for excerpts and multiline bodies', () => {
  for (const opening of ['我三十岁，', '今年我30岁，', '十八岁以后，']) {
    for (const field of ['excerpt', 'body']) {
      const result = checkEntries([{ ...validEntry, [field]: `\n ${opening}今天想吃面。` }]);
      assert.match(result.violations.join('\n'), new RegExp(`${field} 以年龄`, 'u'));
    }
  }
});

test('does not silently pass missing entries or computed content', () => {
  assert.match(checkJianZhongShengContent('export const unrelated = [];').violations.join('\n'), /找不到非空/u);
  const source = `export const jianZhongShengSpace = { entries: [{
    id: 'computed', authorId: '小李', title: makeTitle(), excerpt: '今天吃面。', body: '今天吃面。'
  }] };`;
  assert.match(checkJianZhongShengContent(source).violations.join('\n'), /缺少非空的静态字符串 title/u);
});
