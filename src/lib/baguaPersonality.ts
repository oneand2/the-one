export const COGNITIVE_FUNCTION_CODES = ['Se', 'Si', 'Ne', 'Ni', 'Te', 'Ti', 'Fe', 'Fi'] as const;

export type CognitiveFunctionCode = (typeof COGNITIVE_FUNCTION_CODES)[number];

export type TrigramName = '乾' | '坤' | '震' | '巽' | '坎' | '离' | '艮' | '兑';

export interface BaguaDimension {
  trigram: TrigramName;
  name: string;
  shortDescription: string;
  description: string;
  /** 三爻自上而下；true 为阳爻，false 为阴爻。 */
  lines: readonly [boolean, boolean, boolean];
}

export const BAGUA_DIMENSIONS: Record<CognitiveFunctionCode, BaguaDimension> = {
  Te: {
    trigram: '乾',
    name: '行健',
    shortDescription: '决断与成事',
    description: '组织现实、明确方向，并推动事情真正发生。',
    lines: [true, true, true],
  },
  Fi: {
    trigram: '坤',
    name: '守真',
    shortDescription: '价值与承载',
    description: '守护内在价值，在包容万物时仍忠于本心。',
    lines: [false, false, false],
  },
  Ne: {
    trigram: '震',
    name: '启变',
    shortDescription: '发想与开新',
    description: '从一个触点生发多种可能，让变化由此启动。',
    lines: [false, false, true],
  },
  Si: {
    trigram: '巽',
    name: '浸润',
    shortDescription: '经验与积累',
    description: '让经验缓慢沉入生活，以细节和惯习形成根基。',
    lines: [true, true, false],
  },
  Ni: {
    trigram: '坎',
    name: '潜象',
    shortDescription: '洞察与预见',
    description: '越过表面，感知尚未显现的趋势与深层规律。',
    lines: [false, true, false],
  },
  Se: {
    trigram: '离',
    name: '显象',
    shortDescription: '感知与临在',
    description: '照见已经显现的世界，在真实体验中把握当下。',
    lines: [true, false, true],
  },
  Ti: {
    trigram: '艮',
    name: '辨界',
    shortDescription: '分析与边界',
    description: '停下来辨明结构、定义与边界，求得内在自洽。',
    lines: [true, false, false],
  },
  Fe: {
    trigram: '兑',
    name: '和悦',
    shortDescription: '共情与交流',
    description: '感知人与人之间的情绪流动，使关系得以相通。',
    lines: [false, true, true],
  },
};

export const BAGUA_DISPLAY_ORDER: readonly CognitiveFunctionCode[] = [
  'Te', 'Fi', 'Ne', 'Si', 'Ni', 'Se', 'Ti', 'Fe',
];

export const BAGUA_CHART_ORDER: readonly CognitiveFunctionCode[] = [
  'Se', 'Si', 'Ne', 'Ni', 'Te', 'Ti', 'Fe', 'Fi',
];

export interface BaguaDoorPosition {
  door: '开门' | '休门' | '生门' | '景门' | '惊门' | '伤门' | '杜门' | '死门';
  role: string;
  layer: '阳面' | '阴面';
  description: string;
}

export const BAGUA_DOOR_POSITIONS: readonly BaguaDoorPosition[] = [
  { door: '开门', role: '主导', layer: '阳面', description: '最自然、最畅通的心智通道' },
  { door: '休门', role: '辅助', layer: '阳面', description: '调节、支持并稳定主导心势' },
  { door: '生门', role: '生发', layer: '阳面', description: '好奇、创造与尚在成长的力量' },
  { door: '景门', role: '向往', layer: '阳面', description: '既被吸引又尚未熟练掌握的远景' },
  { door: '惊门', role: '对立', layer: '阴面', description: '受到威胁时被唤起的警戒心势' },
  { door: '伤门', role: '批评', layer: '阴面', description: '用于纠错，也可能转为苛责与攻击' },
  { door: '杜门', role: '盲点', layer: '阴面', description: '难以觉察、容易受阻的心理通道' },
  { door: '死门', role: '深影', layer: '阴面', description: '极端压力下的瓦解与转化力量' },
];

const PERSONALITY_NAMES: Record<string, string> = {
  INFJ: '燃灯者',
  ESTP: '涉川者',
  INTJ: '独觉者',
  INFP: '怀玉者',
  ISFP: '游艺者',
  INTP: '格物者',
  ISTP: '游刃者',
  ESFP: '采真者',
  ENFP: '逍遥客',
  ENTP: '纵横者',
  ISTJ: '守常者',
  ISFJ: '素心者',
  ESFJ: '司礼者',
  ESTJ: '司纲者',
  ENTJ: '经纶者',
  ENFJ: '渡人者',
};

export function getBaguaDimension(code: string | null | undefined): BaguaDimension | null {
  if (!code || !COGNITIVE_FUNCTION_CODES.includes(code as CognitiveFunctionCode)) return null;
  return BAGUA_DIMENSIONS[code as CognitiveFunctionCode];
}

export function baguaDimensionLabel(code: string | null | undefined): string {
  const dimension = getBaguaDimension(code);
  return dimension ? `${dimension.trigram}·${dimension.name}` : '未定';
}

export function personalityName(type: string | null | undefined): string {
  if (!type) return '未定之象';
  return PERSONALITY_NAMES[type] ?? '未定之象';
}

const POSITION_TEXT_REPLACEMENTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/主导功能/g, '开门心势'],
  [/第一功能/g, '开门心势'],
  [/辅助功能/g, '休门心势'],
  [/第二功能/g, '休门心势'],
  [/(儿童|第三)功能/g, '生门心势'],
  [/(劣势|第四)功能/g, '景门心势'],
  [/(对立|第五)功能/g, '惊门心势'],
  [/(批评|第六)功能/g, '伤门心势'],
  [/(盲点|第七)功能/g, '杜门心势'],
  [/(恶魔|第八)功能/g, '死门心势'],
];

const FUNCTION_NAME_REPLACEMENTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/外向思维/g, '乾·行健'],
  [/外向思考/g, '乾·行健'],
  [/内向情感/g, '坤·守真'],
  [/外向直觉/g, '震·启变'],
  [/内向感觉/g, '巽·浸润'],
  [/内向直觉/g, '坎·潜象'],
  [/外向感觉/g, '离·显象'],
  [/内向思维/g, '艮·辨界'],
  [/内向思考/g, '艮·辨界'],
  [/外向情感/g, '兑·和悦'],
];

/** 将旧数据中的内部术语转成用户可见的八卦人格语言。 */
export function presentPersonalityText(source: string | null | undefined): string {
  if (!source) return '';
  let text = source;

  Object.entries(PERSONALITY_NAMES).forEach(([type, name]) => {
    text = text.replace(new RegExp(`\\b${type}\\b`, 'g'), `「${name}」`);
  });
  COGNITIVE_FUNCTION_CODES.forEach((code) => {
    text = text.replace(new RegExp(`\\b${code}\\b`, 'g'), baguaDimensionLabel(code));
  });
  POSITION_TEXT_REPLACEMENTS.forEach(([pattern, replacement]) => {
    text = text.replace(pattern, replacement);
  });
  FUNCTION_NAME_REPLACEMENTS.forEach(([pattern, replacement]) => {
    text = text.replace(pattern, replacement);
  });

  return text
    .replace(/荣格八维/g, '八卦人格')
    .replace(/八维认知功能/g, '八卦心势')
    .replace(/八维功能/g, '八卦心势')
    .replace(/认知功能/g, '心势')
    .replace(/八维/g, '八卦')
    .replace(/功能栈/g, '八门心盘')
    .replace(/功能/g, '心势')
    .replace(/-Mask/g, '之面')
    .replace(/-Awakening/g, '觉醒')
    .replace(/-Grounding/g, '扎根')
    .replace(/-Enhancement/g, '增强')
    .replace(/Grip（抓取）/g, '景门失衡')
    .replace(/Grip/g, '景门失衡')
    .replace(/Door Slam/g, '断联')
    .replace(/MBTI/gi, '八卦人格');
}
