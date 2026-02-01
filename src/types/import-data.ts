// 决行藏AI导入数据类型定义

// 八字导入数据
export interface BaziImportData {
  type: 'bazi';
  // 基础八字信息
  pillars: {
    year: { gan: string; zhi: string };
    month: { gan: string; zhi: string };
    day: { gan: string; zhi: string };
    hour: { gan: string; zhi: string };
  };
  // 强弱分析
  strength: string; // 身旺 | 身弱 | 中和
  strengthPercent: number;
  // 用神
  favorable: string[];
  unfavorable: string[];
  // 十神比例
  shishenRatio: Record<string, number>;
  // 十天干比例
  ganRatio: Record<string, number>;
  // 合冲关系
  relationships: {
    he?: string[];
    chong?: string[];
    xing?: string[];
    hai?: string[];
  };
  // 八字推导的MBTI（如果有）
  predictedMBTI?: string;
  // 能量分布
  energyProfile?: {
    Ne?: number;
    Ni?: number;
    Se?: number;
    Si?: number;
    Te?: number;
    Ti?: number;
    Fe?: number;
    Fi?: number;
  };
  // 其他信息
  name?: string;
  gender?: string;
  birthDate?: string;
}

// 八维测试导入数据
export interface MbtiImportData {
  type: 'mbti';
  mbtiType: string;
  functionScores: {
    Se: number;
    Si: number;
    Ne: number;
    Ni: number;
    Te: number;
    Ti: number;
    Fe: number;
    Fi: number;
  };
  testDate?: string;
}

// 六爻导入数据
export interface LiuyaoImportData {
  type: 'liuyao';
  question: string;
  yaos: Array<{
    position: number;
    name: string;
    value: number;
    isChanging: boolean;
  }>;
  mainHexagram: {
    title: string;
    description: string;
  };
  transformedHexagram?: {
    title: string;
    description: string;
  };
  hasMovingLines: boolean;
  movingLineTexts: string[];
  /** 按动爻规则得出的解卦依据（卦辞或爻辞），优先于 movingLineTexts 使用 */
  interpretation?: {
    title: string;
    texts: string[];
    type: 'guaci' | 'yaoci';
  };
  aiResult?: string;
  divineDate?: string;
}

// 综合导入数据
export type ImportData = {
  bazi?: BaziImportData[];
  mbti?: MbtiImportData[];
  liuyao?: LiuyaoImportData[];
};
