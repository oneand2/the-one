export function assertAppendOnly(oldTexts, newTexts) {
  if (!Array.isArray(oldTexts) || oldTexts.length < 1) {
    throw new Error('旧手记为空，已停止');
  }
  if (!Array.isArray(newTexts)) {
    throw new Error('新手记无法读取，已停止');
  }
  for (let index = 0; index < oldTexts.length; index += 1) {
    if (newTexts[index] !== oldTexts[index]) {
      throw new Error(`第 ${index + 1} 篇旧手记被改动，已停止`);
    }
  }
  const added = newTexts.length - oldTexts.length;
  if (added < 2 || added > 4) {
    throw new Error(`新增 ${added} 篇，需要 2 到 4 篇`);
  }
}
