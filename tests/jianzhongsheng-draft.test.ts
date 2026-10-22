import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readJianZhongShengDraft, writeJianZhongShengDraft } from '../src/lib/jianzhongshengDraft';

test('titled drafts survive storage and preserve body paragraphs', () => {
  const draft = { title: '  抽屉里的旧钥匙  ', body: ' 第一段。\n\n第二段。 ' };
  assert.deepEqual(readJianZhongShengDraft(writeJianZhongShengDraft(draft)), {
    title: '抽屉里的旧钥匙', body: '第一段。\n\n第二段。',
  });
});

test('legacy plain-text and JSON-shaped notes retain their full body', () => {
  for (const body of ['以前只保存正文的手记', '{"title":"这也是正文"}', 'null', '[1,2,3]']) {
    assert.deepEqual(readJianZhongShengDraft(body), { title: '', body });
  }
  assert.deepEqual(readJianZhongShengDraft(null), { title: '', body: '' });
});

test('unpublished titles stay marked for recovery when an older cloud copy exists', () => {
  for (const pending of [true, false]) {
    const draft = { title: '改过的标题', body: '修改后的正文', pending };
    assert.deepEqual(readJianZhongShengDraft(writeJianZhongShengDraft(draft)), draft);
  }
});
