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
  interpretation: HexagramInterpretation | null;
}

export interface HexagramInterpretation {
  title: string;
  texts: string[];
  type: 'guaci' | 'yaoci';
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
  const mainCode = [...yaos].reverse().map(yao => {
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
    const transformedCode = [...yaos].reverse().map(yao => {
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

  const interpretation = buildInterpretation({
    mainHexagram: mainHexagram || null,
    transformedHexagram,
    movingPositions,
    yaos,
  });

  return {
    mainHexagram: mainHexagram || null,
    transformedHexagram,
    movingLineTexts,
    movingPositions,
    hasMovingLines: movingPositions.length > 0,
    interpretation,
  };
}

function buildInterpretation(params: {
  mainHexagram: Hexagram | null;
  transformedHexagram: Hexagram | null;
  movingPositions: number[];
  yaos: YaoValue[];
}): HexagramInterpretation | null {
  const { mainHexagram, transformedHexagram, movingPositions, yaos } = params;
  if (!mainHexagram) return null;

  const movingCount = movingPositions.length;
  const staticPositions = [0, 1, 2, 3, 4, 5].filter(pos => !movingPositions.includes(pos));

  if (movingCount === 0) {
    return {
      title: '本卦卦辞',
      texts: [mainHexagram.description],
      type: 'guaci',
    };
  }

  if (movingCount === 1) {
    const pos = movingPositions[0];
    return {
      title: `本卦${getYaoPositionName(pos)}爻爻辞`,
      texts: [mainHexagram.lines[pos]],
      type: 'yaoci',
    };
  }

  if (movingCount === 2) {
    const [posA, posB] = [...movingPositions].sort((a, b) => a - b);
    const yaoA = yaos[posA];
    const yaoB = yaos[posB];
    const isYinA = yaoA === 6;
    const isYinB = yaoB === 6;
    let primaryPos = posB;
    let secondaryPos = posA;
    // 一阴一阳：取阴爻为主；同阴同阳：取高位为主
    if (isYinA !== isYinB) {
      primaryPos = isYinA ? posA : posB;
      secondaryPos = isYinA ? posB : posA;
    } else {
      primaryPos = Math.max(posA, posB);
      secondaryPos = Math.min(posA, posB);
    }
    return {
      title: `本卦${getYaoPositionName(posA)}爻与${getYaoPositionName(posB)}爻爻辞（以${getYaoPositionName(primaryPos)}爻为主）`,
      texts: [mainHexagram.lines[primaryPos], mainHexagram.lines[secondaryPos]],
      type: 'yaoci',
    };
  }

  if (movingCount === 3) {
    if (transformedHexagram) {
      return {
        title: '本卦与变卦卦辞',
        texts: [
          `本卦：${mainHexagram.description}`,
          `变卦：${transformedHexagram.description}`,
        ],
        type: 'guaci',
      };
    }
    return {
      title: '本卦卦辞',
      texts: [mainHexagram.description],
      type: 'guaci',
    };
  }

  if (movingCount === 4) {
    const pos = staticPositions.length > 0 ? Math.min(...staticPositions) : null;
    if (pos !== null && transformedHexagram) {
      return {
        title: `变卦${getYaoPositionName(pos)}爻爻辞`,
        texts: [transformedHexagram.lines[pos]],
        type: 'yaoci',
      };
    }
  }

  if (movingCount === 5) {
    const pos = staticPositions[0];
    if (pos !== undefined && transformedHexagram) {
      return {
        title: `变卦${getYaoPositionName(pos)}爻爻辞`,
        texts: [transformedHexagram.lines[pos]],
        type: 'yaoci',
      };
    }
  }

  if (movingCount === 6) {
    if (mainHexagram.name === '乾') {
      return {
        title: '用九',
        texts: ['用九：见群龙无首，吉。'],
        type: 'yaoci',
      };
    }
    if (mainHexagram.name === '坤') {
      return {
        title: '用六',
        texts: ['用六：利永贞。'],
        type: 'yaoci',
      };
    }
    if (transformedHexagram) {
      return {
        title: '变卦卦辞',
        texts: [transformedHexagram.description],
        type: 'guaci',
      };
    }
  }

  return {
    title: '本卦卦辞',
    texts: [mainHexagram.description],
    type: 'guaci',
  };
}

/**
 * 获取爻位名称
 */
export function getYaoPositionName(index: number): string {
  const names = ['初', '二', '三', '四', '五', '上'];
  return names[index] || '';
}
