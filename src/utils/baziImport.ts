// ─────────────────────────────────────────────────────────────────────────────
// 八字导入数据构建（供「八字」界面 AI 解析、占问前程等复用同一套八字解析逻辑）
//
// 把一份排盘输入（公历生辰或直接四柱）经 analyzeBazi + generateClassicalBaziData
// 解析为决行藏可用的 BaziImportData：四柱、强弱、用神、十神比例、天干比例等。
// ─────────────────────────────────────────────────────────────────────────────

import { analyzeBazi, generateClassicalBaziData, type BaziInput } from './baziLogic';
import type { BaziImportData } from '@/types/import-data';

export function buildBaziImportData(
  input: BaziInput,
  opts?: { name?: string; gender?: string; birthDate?: string }
): BaziImportData {
  const result = analyzeBazi(input);
  const classicalData = generateClassicalBaziData(input);

  // 十神比例（按 ssDistribution 归一化）
  const shishenRatio: Record<string, number> = {};
  if (result.ssDistribution) {
    const total = Object.values(result.ssDistribution).reduce((sum, val) => sum + (val as number), 0);
    if (total > 0) {
      Object.entries(result.ssDistribution).forEach(([key, val]) => {
        shishenRatio[key] = (val as number) / total;
      });
    }
  }

  // 天干比例（四柱天干各占 0.25）
  const ganRatio: Record<string, number> = {};
  [
    classicalData.pillars.year.gan,
    classicalData.pillars.month.gan,
    classicalData.pillars.day.gan,
    classicalData.pillars.hour.gan,
  ].forEach((gan) => {
    ganRatio[gan] = (ganRatio[gan] || 0) + 0.25;
  });

  return {
    type: 'bazi',
    pillars: classicalData.pillars,
    pattern: result.pattern,
    strength: result.strength,
    strengthPercent: result.peerEnergyPercent,
    favorable: [result.climateGod, result.trueGod].filter(Boolean),
    unfavorable: [],
    shishenRatio,
    ganRatio,
    relationships: {},
    name: opts?.name,
    gender: opts?.gender,
    birthDate: opts?.birthDate,
  };
}
