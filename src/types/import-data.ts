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
  // 格局（如：正官格、食神格、从财格等）
  pattern?: string;
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

// 占问前程导入数据（见天地「今日能量」卡片发起，借命理外壳做现实决策参考）
export interface QianchengImportData {
  type: 'qiancheng';
  // 用户的前程问题（也是新闻检索的输入）
  question: string;
  // 完整八字解析（复用八字界面同一套解析逻辑：强弱、用神、十神/天干比例等）
  bazi?: BaziImportData | null;
  // 八字四柱（兜底/简版；当 bazi 缺失时使用）
  pillars?: {
    year: { gan: string; zhi: string };
    month: { gan: string; zhi: string };
    day: { gan: string; zhi: string };
    hour: { gan: string; zhi: string };
  } | null;
  // 是否已知出生时辰（缺失时弱化时柱、不强行推断）
  hasHour: boolean;
  // 用神
  yongshen?: string;
  yongshenWuxing?: string;
  name?: string;
}

// 综合导入数据
export type ImportData = {
  bazi?: BaziImportData[];
  mbti?: MbtiImportData[];
  liuyao?: LiuyaoImportData[];
  qiancheng?: QianchengImportData;
};
