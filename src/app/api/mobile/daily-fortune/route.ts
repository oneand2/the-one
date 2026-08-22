import { NextRequest, NextResponse } from 'next/server';
import { Solar } from 'lunar-javascript';

export const runtime = 'nodejs';

const STEM_WUXING: Record<string, string> = {
  甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水',
};
const ZHI_CANG_GAN: Record<string, Record<string, number>> = {
  子: { 癸: 1 }, 丑: { 己: .7, 癸: .2, 辛: .1 }, 寅: { 甲: .7, 丙: .2, 戊: .1 },
  卯: { 乙: 1 }, 辰: { 戊: .7, 乙: .2, 癸: .1 }, 巳: { 丙: .7, 戊: .2, 庚: .1 },
  午: { 丁: .7, 己: .3 }, 未: { 己: .7, 丁: .2, 乙: .1 }, 申: { 庚: .7, 壬: .2, 戊: .1 },
  酉: { 辛: 1 }, 戌: { 戊: .7, 辛: .2, 丁: .1 }, 亥: { 壬: .8, 甲: .2 },
};
const WUXING_SHENG: Record<string, string> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const WUXING_KE: Record<string, string> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

function relationScore(value: string, useful: string): number {
  if (value === useful) return 25;
  if (WUXING_SHENG[value] === useful) return 10;
  if (WUXING_SHENG[useful] === value) return -10;
  if (WUXING_KE[value] === useful) return -15;
  if (WUXING_KE[useful] === value) return -5;
  return 0;
}
function relationLabel(value: string, useful: string): string {
  if (value === useful) return '用神';
  if (WUXING_SHENG[value] === useful) return '生用神';
  if (WUXING_SHENG[useful] === value) return '泄用神';
  if (WUXING_KE[value] === useful) return '克用神';
  if (WUXING_KE[useful] === value) return '被克';
  return '无关';
}
function level(score: number) {
  if (score >= 95) return { label: '极高', color: '#4e7c4a' };
  if (score >= 87) return { label: '偏高', color: '#5a7a5a' };
  if (score >= 80) return { label: '中等', color: '#6a7a4a' };
  if (score >= 75) return { label: '平稳', color: '#8a7a4a' };
  if (score >= 68) return { label: '略低', color: '#8a6a4a' };
  if (score >= 60) return { label: '偏低', color: '#9a5a4a' };
  return { label: '较低', color: '#9a4a4a' };
}

export async function POST(request: NextRequest) {
  let body: { year?: number; month?: number; day?: number; yongshen?: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: '日期格式无效' }, { status: 400 }); }

  const { year, month, day, yongshen } = body;
  if (!year || !month || !day || !yongshen || !STEM_WUXING[yongshen]) {
    return NextResponse.json({ error: '缺少今日日期或用神' }, { status: 400 });
  }
  try {
    const dayPillar = Solar.fromYmdHms(year, month, day, 12, 0, 0).getLunar().getDayInGanZhi();
    const dayGan = dayPillar[0];
    const dayZhi = dayPillar[1];
    const usefulElement = STEM_WUXING[yongshen];
    const items: Array<Record<string, string | number>> = [];
    const ganElement = STEM_WUXING[dayGan];
    items.push({
      label: '天干', stem: dayGan, wx: ganElement, proportion: .5,
      maxPoints: relationScore(ganElement, usefulElement),
      contribution: relationScore(ganElement, usefulElement) * .5,
      relation: relationLabel(ganElement, usefulElement),
    });
    Object.entries(ZHI_CANG_GAN[dayZhi] ?? {}).forEach(([stem, ratio]) => {
      const element = STEM_WUXING[stem];
      items.push({
        label: `地支${ratio >= .6 ? '主气' : ratio >= .2 ? '中气' : '余气'}`,
        stem, wx: element, proportion: .5 * ratio,
        maxPoints: relationScore(element, usefulElement),
        contribution: relationScore(element, usefulElement) * .5 * ratio,
        relation: relationLabel(element, usefulElement),
      });
    });
    const totalAdj = items.reduce((sum, item) => sum + Number(item.contribution), 0);
    const finalScore = Math.max(55, Math.min(100, Math.round((75 + totalAdj) * 10) / 10));
    return NextResponse.json({ dayPillar, dayGan, dayZhi, yongshen, yongshenWuxing: usefulElement, items, totalAdj, finalScore, level: level(Math.round(finalScore)) });
  } catch {
    return NextResponse.json({ error: '今日能量暂时无法推演' }, { status: 400 });
  }
}
