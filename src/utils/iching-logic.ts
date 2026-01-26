/**
 * 六爻解卦逻辑
 */

import { type YaoValue } from './liuyaoLogic';
import { findHexagramByCode, type Hexagram } from './iching-data';

export interface HexagramAnalysis {
  mainHexagram: Hexagram | null;
  transformedHexagram: Hexagram | null;
  movingLineTexts: string[];
  movingPositions: number[];
  hasMovingLines: boolean;
}

/**
 * 解析六爻结果，得到本卦、变卦和动爻
 * 
 * @param yaos - 用户摇出的6个爻值数组 [初爻, 二爻, 三爻, 四爻, 五爻, 上爻]
 *              6 = 老阴 (动)
 *              7 = 少阳 (静)
 *              8 = 少阴 (静)
 *              9 = 老阳 (动)
 * @returns 解卦结果
 */
export function analyzeHexagram(yaos: YaoValue[]): HexagramAnalysis {
  if (yaos.length !== 6) {
    throw new Error('必须提供6个爻值');
  }

  // 1. 计算本卦（只看阴阳，不看动静）
  // 6(老阴) -> 0, 8(少阴) -> 0
  // 7(少阳) -> 1, 9(老阳) -> 1
  const mainCode = yaos.map(yao => {
    return (yao === 7 || yao === 9) ? '1' : '0';
  }).join('');

  const mainHexagram = findHexagramByCode(mainCode);

  // 2. 找出动爻位置（值为6或9的位置）
  const movingPositions: number[] = [];
  yaos.forEach((yao, index) => {
    if (yao === 6 || yao === 9) {
      movingPositions.push(index);
    }
  });

  // 3. 计算变卦（动爻变性，静爻不变）
  // 6(老阴) -> 1 (变为阳)
  // 9(老阳) -> 0 (变为阴)
  // 7, 8 保持不变
  let transformedHexagram: Hexagram | null = null;
  if (movingPositions.length > 0) {
    const transformedCode = yaos.map(yao => {
      if (yao === 6) return '1'; // 老阴变阳
      if (yao === 9) return '0'; // 老阳变阴
      return (yao === 7) ? '1' : '0'; // 静爻保持
    }).join('');

    transformedHexagram = findHexagramByCode(transformedCode) || null;
  }

  // 4. 提取动爻的爻辞
  const movingLineTexts: string[] = [];
  if (mainHexagram) {
    movingPositions.forEach(pos => {
      movingLineTexts.push(mainHexagram.lines[pos]);
    });
  }

  return {
    mainHexagram: mainHexagram || null,
    transformedHexagram,
    movingLineTexts,
    movingPositions,
    hasMovingLines: movingPositions.length > 0,
  };
}

/**
 * 获取爻位名称
 */
export function getYaoPositionName(index: number): string {
  const names = ['初', '二', '三', '四', '五', '上'];
  return names[index] || '';
}
