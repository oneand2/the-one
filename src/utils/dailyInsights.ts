export type DailyInsightOrigin = 'china' | 'world';

/**
 * 周稿固定从中国内容开始，中外交错排列。
 * 七日周稿采用四则中国、三则外国，是最接近 3:2 的整数配比。
 */
export function arrangeWeeklyInsights<T extends { origin: string }>(
  stories: readonly T[]
): T[] {
  const china = stories.filter((story) => story.origin === 'china');
  const world = stories.filter((story) => story.origin === 'world');
  const arranged: T[] = [];

  for (let index = 0; index < Math.max(china.length, world.length); index += 1) {
    if (china[index]) arranged.push(china[index]);
    if (world[index]) arranged.push(world[index]);
  }

  return arranged;
}
