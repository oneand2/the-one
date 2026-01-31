'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronDown, Sparkles, Sun, Moon, Zap, Save, Share2, AlertTriangle } from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import questionsData from '../../questions.json';
import mbtiDataRaw from '../../mbti_final_cleaned.json';

// 文本智能分段函数 - 在句号处分段，避免段落过长
const formatTextToParagraphs = (text: string, maxLength: number = 150): string[] => {
  if (!text) return [];
  
  // 先按换行符分割
  const rawParagraphs = text.split(/\n+/).filter(p => p.trim());
  const result: string[] = [];
  
  rawParagraphs.forEach(paragraph => {
    if (paragraph.length <= maxLength) {
      result.push(paragraph.trim());
    } else {
      // 按句号分割长段落
      const sentences = paragraph.split(/(?<=[。！？])/);
      let currentParagraph = '';
      
      sentences.forEach(sentence => {
        if ((currentParagraph + sentence).length <= maxLength) {
          currentParagraph += sentence;
        } else {
          if (currentParagraph.trim()) {
            result.push(currentParagraph.trim());
          }
          currentParagraph = sentence;
        }
      });
      
      if (currentParagraph.trim()) {
        result.push(currentParagraph.trim());
      }
    }
  });
  
  return result;
};

// MBTI类型定义
const MBTI_TYPES = [
  'ESTP', 'ESFP', 'ISTP', 'ISFP',
  'ENTJ', 'ENFJ', 'INTJ', 'INFJ',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'INTP', 'INFP', 'ENTP', 'ENFP'
] as const;

type MBTIType = typeof MBTI_TYPES[number];

// 八维认知功能
const COGNITIVE_FUNCTIONS = ['Se', 'Si', 'Ne', 'Ni', 'Te', 'Ti', 'Fe', 'Fi'] as const;
type CognitiveFunction = typeof COGNITIVE_FUNCTIONS[number];

// 心理位置名称
const SLOT_NAMES = ['Hero', 'Parent', 'Child', 'Inferior', 'Nemesis', 'Critic', 'Trickster', 'Demon'] as const;
type SlotName = typeof SLOT_NAMES[number];

// 心理位置权重（用于能量强度计算）
const SLOT_WEIGHTS: { [key in SlotName]: number } = {
  Hero: 2.0,
  Parent: 1.6,
  Child: 1.2,
  Inferior: 0.5,
  Nemesis: 1.0,
  Critic: 0.8,
  Trickster: 0.1,
  Demon: 0.3
};

// 16个MBTI类型的标准功能栈模板
// 顺序：Hero, Parent, Child, Inferior, Nemesis, Critic, Trickster, Demon
const MBTI_FUNCTION_STACKS: { [key in MBTIType]: CognitiveFunction[] } = {
  'INFJ': ['Ni', 'Fe', 'Ti', 'Se', 'Ne', 'Fi', 'Te', 'Si'],
  'INFP': ['Fi', 'Ne', 'Si', 'Te', 'Fe', 'Ni', 'Se', 'Ti'],
  'INTJ': ['Ni', 'Te', 'Fi', 'Se', 'Ne', 'Ti', 'Fe', 'Si'],
  'INTP': ['Ti', 'Ne', 'Si', 'Fe', 'Te', 'Ni', 'Se', 'Fi'],
  'ISFJ': ['Si', 'Fe', 'Ti', 'Ne', 'Se', 'Fi', 'Te', 'Ni'],
  'ISFP': ['Fi', 'Se', 'Ni', 'Te', 'Fe', 'Si', 'Ne', 'Ti'],
  'ISTJ': ['Si', 'Te', 'Fi', 'Ne', 'Se', 'Ti', 'Fe', 'Ni'],
  'ISTP': ['Ti', 'Se', 'Ni', 'Fe', 'Te', 'Si', 'Ne', 'Fi'],
  'ENFJ': ['Fe', 'Ni', 'Se', 'Ti', 'Fi', 'Ne', 'Si', 'Te'],
  'ENFP': ['Ne', 'Fi', 'Te', 'Si', 'Ni', 'Fe', 'Ti', 'Se'],
  'ENTJ': ['Te', 'Ni', 'Se', 'Fi', 'Ti', 'Ne', 'Si', 'Fe'],
  'ENTP': ['Ne', 'Ti', 'Fe', 'Si', 'Ni', 'Te', 'Fi', 'Se'],
  'ESFJ': ['Fe', 'Si', 'Ne', 'Ti', 'Fi', 'Se', 'Ni', 'Te'],
  'ESFP': ['Se', 'Fi', 'Te', 'Ni', 'Si', 'Fe', 'Ti', 'Ne'],
  'ESTJ': ['Te', 'Si', 'Ne', 'Fi', 'Ti', 'Se', 'Ni', 'Fe'],
  'ESTP': ['Se', 'Ti', 'Fe', 'Ni', 'Si', 'Te', 'Fi', 'Ne']
};

// 认知功能中文名称
const FUNCTION_NAMES: { [key in CognitiveFunction]: string } = {
  'Se': '外向感觉',
  'Si': '内向感觉',
  'Ne': '外向直觉',
  'Ni': '内向直觉',
  'Te': '外向思考',
  'Ti': '内向思考',
  'Fe': '外向情感',
  'Fi': '内向情感'
};

// 对轴关系映射 (Inferior轴)
const INFERIOR_AXIS: { [key in CognitiveFunction]: CognitiveFunction } = {
  'Ni': 'Se', 'Se': 'Ni',
  'Ne': 'Si', 'Si': 'Ne',
  'Ti': 'Fe', 'Fe': 'Ti',
  'Te': 'Fi', 'Fi': 'Te'
};

// 阴影关系映射 (Nemesis轴 - 同轴但内外倾相反)
const NEMESIS_SHADOW: { [key in CognitiveFunction]: CognitiveFunction } = {
  'Ni': 'Ne', 'Ne': 'Ni',
  'Si': 'Se', 'Se': 'Si',
  'Ti': 'Te', 'Te': 'Ti',
  'Fi': 'Fe', 'Fe': 'Fi'
};

// 用户原始数据类型 - 每个功能在8个位置的得分
interface UserRawData {
  slotScores: {
    [func in CognitiveFunction]: {
      [slot: number]: number; // slot 0-7 对应 Hero 到 Demon
    };
  };
}

// 用户位置分配结果
interface UserSlots {
  [slotIndex: number]: {
    function: CognitiveFunction;
    score: number;
    hasConflict?: boolean;
    conflictWith?: CognitiveFunction;
  };
}

// 异化检测结果
interface InsightAlert {
  type: 'mask' | 'loop' | 'blindspot' | 'conflict' | 'grip' | 'critic' | 'demon' | 'hermit' | 'manic' | 'gavel' | 'wanderer' | 
        'inferior_integration' | 'blindspot_integration' | 'critic_integration' | 'demon_integration';
  title: string;
  description: string;
  severity: 'warning' | 'info' | 'critical' | 'positive';
}

// 判断功能类型的辅助函数
const isIntrovertedFunc = (func: CognitiveFunction): boolean => func.endsWith('i');
const isJudgingFunc = (func: CognitiveFunction): boolean => ['Ti', 'Te', 'Fi', 'Fe'].includes(func);
const isPerceivingFunc = (func: CognitiveFunction): boolean => ['Ni', 'Ne', 'Si', 'Se'].includes(func);

// 计算某功能在阳面（前4位：主导、辅助、儿童、劣势）的总得分
const getLightSideScore = (rawData: UserRawData, func: CognitiveFunction): number => {
  let total = 0;
  for (let i = 0; i < 4; i++) {
    total += rawData.slotScores[func][i] || 0;
  }
  return total;
};

// 计算某功能在阴面（后4位：对立、批评、盲点、恶魔）的总得分
const getShadowSideScore = (rawData: UserRawData, func: CognitiveFunction): number => {
  let total = 0;
  for (let i = 4; i < 8; i++) {
    total += rawData.slotScores[func][i] || 0;
  }
  return total;
};

// 题目选项类型
interface Option {
  id: string;
  text: string;
  target_types: MBTIType[];
  weight: number;
}

// 题目类型
interface Question {
  id: number;
  category: string;
  question: string;
  options: Option[];
}

// 用户选择类型
interface UserAnswer {
  questionId: number;
  weights: { [optionId: string]: number };
}

// 测试结果类型（对外可用于从保存的记录还原）
export interface TestResult {
  type: MBTIType;
  score: number;
  shadowType: MBTIType;
  functionScores: { [key in CognitiveFunction]: number };
  // 新增：位置分配结果
  userSlots?: UserSlots;
  // 新增：功能能量强度（用于雷达图）
  functionStrengths?: { [key in CognitiveFunction]: number };
  // 新增：标准类型的理论强度
  idealStrengths?: { [key in CognitiveFunction]: number };
  // 新增：异化检测结果
  insights?: InsightAlert[];
  // 新增：拟合度分数
  fitScore?: number;
}

// MBTI 详细数据类型
interface MBTIFunction {
  pos: string;
  title: string;
  logic: string;
  lesson: string;
}

interface MBTIData {
  id: string;
  name: string;
  slogan: string;
  origin: string;
  guide: string;
  deep_profile: string;
  strengths: string;
  weaknesses: string;
  shadow: string;
  advice: string;
  functions: MBTIFunction[];
}

// 类型转换
const mbtiData = mbtiDataRaw as MBTIData[];

// 根据 ID 获取详细数据
const getMBTIData = (type: MBTIType): MBTIData | null => {
  return mbtiData.find(data => data.id === type) || null;
}

// 测试状态
type TestStatus = 'intro' | 'testing' | 'result';

// 随机打乱数组
const shuffleArray = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

// 计算阴影人格（反转所有字母）- 导出供报告页使用
export const calculateShadowType = (type: MBTIType): MBTIType => {
  const opposites: { [key: string]: string } = {
    'E': 'I', 'I': 'E',
    'S': 'N', 'N': 'S',
    'T': 'F', 'F': 'T',
    'J': 'P', 'P': 'J'
  };
  
  const shadow = type.split('').map(char => opposites[char]).join('');
  return shadow as MBTIType;
};

// ═══════════════════════════════════════════════════════════
// 核心算法：从用户答案解析原始数据
// 每道题的分数按百分比归一化，确保每道题权重相同
// ═══════════════════════════════════════════════════════════
const parseUserRawData = (
  userAnswers: UserAnswer[], 
  questions: Question[]
): UserRawData => {
  const slotScores: UserRawData['slotScores'] = {} as UserRawData['slotScores'];
  
  // 初始化所有功能在所有位置的得分为0
  COGNITIVE_FUNCTIONS.forEach(func => {
    slotScores[func] = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };
  });
  
  // 每道题的标准权重（归一化后每道题贡献相同的总分）
  const QUESTION_WEIGHT = 10;
  
  // 遍历所有答案，解析选项ID来确定功能和位置
  userAnswers.forEach(answer => {
    const question = questions.find(q => q.id === answer.questionId);
    if (!question) return;
    
    const category = question.category as CognitiveFunction;
    if (!COGNITIVE_FUNCTIONS.includes(category)) return;
    
    // 计算该题目的总分配分数
    const totalWeight = Object.values(answer.weights).reduce((sum, w) => sum + w, 0);
    if (totalWeight === 0) return;
    
    // 归一化系数：让每道题贡献相同的总分
    const normalizationFactor = QUESTION_WEIGHT / totalWeight;
    
    Object.entries(answer.weights).forEach(([optionId, weight]) => {
      if (weight === 0) return;
      
      // 归一化后的分数
      const normalizedWeight = weight * normalizationFactor;
      
      // 解析选项ID，格式如 "Se_1st", "Ni_3rd" 等
      const match = optionId.match(/^(\w+)_(\d+)(st|nd|rd|th)$/);
      if (match) {
        const slotIndex = parseInt(match[2]) - 1; // 转换为0-7
        if (slotIndex >= 0 && slotIndex < 8) {
          slotScores[category][slotIndex] += normalizedWeight;
        }
      }
    });
  });
  
  return { slotScores };
};

// ═══════════════════════════════════════════════════════════
// 步骤1：轴线联动修正 (The Gearing System)
// ═══════════════════════════════════════════════════════════
const applyGearingSystem = (rawData: UserRawData): UserRawData => {
  const correctedScores = JSON.parse(JSON.stringify(rawData.slotScores)) as UserRawData['slotScores'];
  
  // 检查每个功能在Hero位置(索引0)的得分
  COGNITIVE_FUNCTIONS.forEach(func => {
    const heroScore = correctedScores[func][0];
    if (heroScore > 0) {
      // 获取对轴功能 (Inferior)
      const inferiorFunc = INFERIOR_AXIS[func];
      // 获取阴影功能 (Nemesis)
      const nemesisFunc = NEMESIS_SHADOW[func];
      
      // 对轴功能增加权重：原分数 + heroScore * 0.4
      const inferiorBonus = heroScore * 0.4;
      // 在Inferior位置(索引3)增加权重
      correctedScores[inferiorFunc][3] += inferiorBonus;
      
      // 阴影功能增加权重：原分数 + heroScore * 0.4
      const nemesisBonus = heroScore * 0.4;
      // 在Nemesis位置(索引4)增加权重
      correctedScores[nemesisFunc][4] += nemesisBonus;
    }
  });
  
  return { slotScores: correctedScores };
};

// ═══════════════════════════════════════════════════════════
// 步骤2：最佳拟合度计算 (Template Matching)
// 使用欧几里得距离比对用户数据与16个标准类型
// ═══════════════════════════════════════════════════════════
const calculateBestFitType = (rawData: UserRawData): { type: MBTIType; fitScore: number } => {
  let bestType: MBTIType = 'INFJ';
  let minDistance = Infinity;
  
  MBTI_TYPES.forEach(mbtiType => {
    const standardStack = MBTI_FUNCTION_STACKS[mbtiType];
    let totalDistance = 0;
    
    // 计算欧几里得距离
    // 比较每个位置上，用户得分最高的功能与标准类型的差异
    for (let slotIndex = 0; slotIndex < 8; slotIndex++) {
      const standardFunc = standardStack[slotIndex];
      
      // 获取用户在该位置的所有功能得分
      const userScoresAtSlot: { func: CognitiveFunction; score: number }[] = [];
      COGNITIVE_FUNCTIONS.forEach(func => {
        userScoresAtSlot.push({ func, score: rawData.slotScores[func][slotIndex] });
      });
      
      // 按得分排序
      userScoresAtSlot.sort((a, b) => b.score - a.score);
      
      // 计算与标准功能的距离
      // 如果用户在该位置的最高分功能与标准功能相同，距离为0
      // 否则，计算标准功能在用户排名中的位置差距
      // 获取用户在该位置的最高分功能与标准功能的排名
      const standardFuncRank = userScoresAtSlot.findIndex(s => s.func === standardFunc);
      
      // 位置差距 + 分数差距
      const positionPenalty = standardFuncRank * 2;
      const scoreDiff = (userScoresAtSlot[0]?.score || 0) - (rawData.slotScores[standardFunc][slotIndex] || 0);
      
      totalDistance += positionPenalty + Math.abs(scoreDiff) * 0.1;
    }
    
    if (totalDistance < minDistance) {
      minDistance = totalDistance;
      bestType = mbtiType;
    }
  });
  
  // 计算拟合度分数 (0-100)
  const maxPossibleDistance = 8 * 14 + 8 * 5; // 理论最大距离
  const fitScore = Math.max(0, Math.min(100, 100 - (minDistance / maxPossibleDistance) * 100));
  
  return { type: bestType, fitScore };
};

// ═══════════════════════════════════════════════════════════
// 步骤3：能量强度计算 (For Radar Chart)
// ═══════════════════════════════════════════════════════════
const calculateFunctionStrengths = (rawData: UserRawData): { [key in CognitiveFunction]: number } => {
  const strengths: { [key in CognitiveFunction]: number } = {} as { [key in CognitiveFunction]: number };
  
  COGNITIVE_FUNCTIONS.forEach(func => {
    let totalStrength = 0;
    SLOT_NAMES.forEach((slotName, slotIndex) => {
      const score = rawData.slotScores[func][slotIndex] || 0;
      const weight = SLOT_WEIGHTS[slotName];
      totalStrength += score * weight;
    });
    strengths[func] = Math.round(totalStrength * 10) / 10;
  });
  
  return strengths;
};

// 计算标准类型的理论强度
const calculateIdealStrengths = (mbtiType: MBTIType, userStrengths?: { [key in CognitiveFunction]: number }): { [key in CognitiveFunction]: number } => {
  const strengths: { [key in CognitiveFunction]: number } = {} as { [key in CognitiveFunction]: number };
  const standardStack = MBTI_FUNCTION_STACKS[mbtiType];
  
  // 计算用户强度的平均值，用于动态调整标准线
  let userAverage = 20; // 默认值
  if (userStrengths) {
    const userValues = Object.values(userStrengths);
    userAverage = userValues.reduce((sum, v) => sum + v, 0) / userValues.length;
  }
  
  // 基准分数 = 用户平均强度，这样标准线会与用户实测在同一量级
  const baseScore = userAverage;
  
  // 为每个功能计算在标准位置的理论权重
  COGNITIVE_FUNCTIONS.forEach(func => {
    const slotIndex = standardStack.indexOf(func);
    if (slotIndex >= 0) {
      const slotName = SLOT_NAMES[slotIndex];
      // 理论强度 = 基准分数 × 位置权重归一化
      // 归一化让主导位接近用户最高值，劣势位接近最低值
      strengths[func] = baseScore * (SLOT_WEIGHTS[slotName] / 1.2);
    } else {
      strengths[func] = 0;
    }
  });
  
  return strengths;
};

// ═══════════════════════════════════════════════════════════
// 分配用户的功能到各个位置 (用于心灵星盘)
// ═══════════════════════════════════════════════════════════
const assignUserSlots = (rawData: UserRawData): UserSlots => {
  const slots: UserSlots = {};
  
  for (let slotIndex = 0; slotIndex < 8; slotIndex++) {
    // 获取该位置所有功能的得分
    const scoresAtSlot: { func: CognitiveFunction; score: number }[] = [];
    COGNITIVE_FUNCTIONS.forEach(func => {
      scoresAtSlot.push({ func, score: rawData.slotScores[func][slotIndex] });
    });
    
    // 按得分排序
    scoresAtSlot.sort((a, b) => b.score - a.score);
    
    const topScore = scoresAtSlot[0]?.score || 0;
    const secondScore = scoresAtSlot[1]?.score || 0;
    
    // 检测冲突：两个功能得分极高且相近（差值 < 1）
    const hasConflict = topScore > 0 && secondScore > 0 && (topScore - secondScore) < 1;
    
    slots[slotIndex] = {
      function: scoresAtSlot[0]?.func || 'Ni',
      score: topScore,
      hasConflict,
      conflictWith: hasConflict ? scoresAtSlot[1]?.func : undefined
    };
  }
  
  return slots;
};

// ═══════════════════════════════════════════════════════════
// 异化检测与提醒系统 (The Mutation Alerts)
// ═══════════════════════════════════════════════════════════
interface TypeInsightTexts {
  maskMutations: { [func in CognitiveFunction]?: string };
  loopDescription: string;
  blindspotAwakening: { [func in CognitiveFunction]?: string };
  // 高阶异化文案（压力态 - 阴面得分高）
  gripDescription: string; // 抓取状态
  criticDescription: string; // 判官重压
  demonDescription: string; // 恶魔附体
  // 整合文案（健康态 - 阳面得分高）
  inferiorIntegration: string; // 劣势整合
  blindspotIntegration: string; // 盲点觉醒（正面）
  criticIntegration: string; // 判官觉醒
  demonIntegration: string; // 恶魔驯化
}

const INSIGHT_TEXTS: { [key in MBTIType]: TypeInsightTexts } = {
  INFJ: {
    maskMutations: {
      Te: '逻辑面具 (Te-Mask)\n虽然你的核心底色是【燃灯者】，但你的辅助功能发生了"逻辑化异变"。你比传统的 INFJ 更强硬、更注重效率。这通常意味着你在高压环境下，被迫进化出了 Te 防御机制来保护自己脆弱的情感。',
      Fi: '真我面具 (Fi-Mask)\n你的辅助功能发生了"内化情感异变"。你比传统的 INFJ 更关注个人价值观和内心感受，可能在群体和谐与个人信念之间产生撕裂。',
      Ti: '逻辑深化 (Ti-Enhancement)\n你的第三功能Ti异常活跃，这让你比普通 INFJ 更善于独立分析和批判性思考，但也可能导致过度分析。',
      Se: '现实锚定 (Se-Grounding)\n你的劣势功能Se异常活跃，说明你正在积极发展与物理世界的连接，这是非常健康的成长信号。'
    },
    loopDescription: '你的能量在"直觉"与"逻辑"之间封闭循环，切断了与外界的情感连接（Fe 断联）。这让你陷入了过度的自我分析和虚无主义，变得比普通 INFJ 更加冷漠和避世。',
    blindspotAwakening: {
      Te: '你的"盲点"位置（Te）不仅没有处于黑暗中，反而异常活跃。这极其罕见，说明你经历过不得不逼迫自己去处理枯燥事务的特殊时期，你修补了灵魂最大的短板。'
    },
    gripDescription: '你的灵魂正处于"颠倒"状态。平日里被你忽视的劣势功能（Se）正在掌权，而你的君主（Ni）已然失势。你可能正经历着极端的压力，表现出暴饮暴食、沉溺声色或极度冲动等与本性截然相反的行为。这并非堕落，而是灵魂在尖叫，要求你从精神的高阁走下来，去触摸粗糙的现实。',
    criticDescription: '你的第六功能（Fi）异常活跃，化身为一个冷酷的审判者。你正对自己进行着近乎残忍的道德审视，不断质疑自己的动机是否纯粹、是否是个伪善者。这种过度的自我攻击正在消耗你的生命力。请记住：水至清则无鱼，对自己慈悲，也是一种修行。',
    demonDescription: '你心灵最深处的恶魔（Si）已经苏醒。这通常发生在你对这个世界彻底失望之时。你可能正处于一种"毁灭模式"，想要切断过去、翻旧账、推翻一切重来，甚至对周围的人表现出极大的冷漠或报复心。这股力量虽然危险，但若能善用，它将是你涅槃重生的燃料。',
    inferiorIntegration: '恭喜！你的劣势功能（Se）已经成功整合进入核心能量圈。这意味着你在保持主导直觉（Ni）的同时，成功发展了对当下感官体验的敏锐度。你既有远见卓识，又能脚踏实地。这是非常罕见的人格成长成就。',
    blindspotIntegration: '你的盲点功能（Te）已经被成功点亮。这意味着你不仅有深刻的洞察力和共情能力，还发展出了罕见的执行力和组织能力。你能够将愿景转化为现实，这是极为珍贵的能力组合。',
    criticIntegration: '你成功觉醒了内在的价值判官（Fi）。这让你在关怀他人的同时，也建立了清晰的个人边界和价值标准。你学会了在服务他人与忠于自我之间找到平衡。',
    demonIntegration: '你成功驯化了内心深处的恶魔（Si）。这意味着你能够健康地与过去和解，从经验中学习而不被其束缚。你获得了一种罕见的能力：既能展望未来，又能从历史中汲取智慧。'
  },
  INTJ: {
    maskMutations: {
      Fe: '共情面具 (Fe-Mask)\n虽然你的核心底色是【独觉者】，但你的辅助功能发生了"情感化异变"。你比传统的 INTJ 更在意群体和谐与他人感受。这可能意味着你在社交环境中发展出了情感防御机制。',
      Ti: '内省面具 (Ti-Mask)\n你的辅助功能发生了"内化逻辑异变"。你比传统的 INTJ 更注重理论的内在自洽，而非外部效率。',
      Fi: '价值深化 (Fi-Enhancement)\n你的第三功能Fi异常活跃，这让你比普通 INTJ 更有道德洞察力和审美追求。',
      Se: '感官觉醒 (Se-Awakening)\n你的劣势功能Se异常活跃，说明你正在积极发展对当下的感知能力。'
    },
    loopDescription: '你的能量在"直觉"与"价值观"之间封闭循环，切断了与外界的效率连接（Te 断联）。这让你陷入了空想和完美主义，难以将愿景付诸实践。',
    blindspotAwakening: {
      Fe: '你的"盲点"位置（Fe）不仅没有处于黑暗中，反而异常活跃。这说明你发展出了罕见的群体情感感知能力。'
    },
    gripDescription: '你的灵魂正处于"颠倒"状态。平日里被你忽视的劣势功能（Se）正在掌权，而你的君主（Ni）已然失势。你可能正经历着极端的压力，表现出冲动消费、暴饮暴食或沉迷感官刺激等与本性截然相反的行为。这是你内心在渴望从思维的高塔中走出来，去体验真实的物质世界。',
    criticDescription: '你的第六功能（Ti）异常活跃，化身为一个冷酷的逻辑审判者。你正在无情地解剖自己的每一个想法，质疑其逻辑是否严密、推理是否有漏洞。这种过度的自我分析正在让你陷入分析瘫痪。请记住：完美是行动的敌人。',
    demonDescription: '你心灵最深处的恶魔（Si）已经苏醒。你可能正陷入对过去失败的反刍，或者被那些本应被遗忘的记忆所困扰。你开始变得异常记仇、翻旧账，甚至想要摧毁与过去有关的一切。这股黑暗的力量正在要求你正视那些被压抑的经历。',
    inferiorIntegration: '恭喜！你的劣势功能（Se）已经成功整合。你在保持战略眼光（Ni）和执行效率（Te）的同时，发展出了对当下的感知力。你既是战略家，也懂得享受当下。',
    blindspotIntegration: '你的盲点功能（Fe）已经被点亮。这意味着你不仅有独立的思考和判断，还发展出了罕见的群体情感感知能力。你能够在保持独立性的同时，与他人建立深层连接。',
    criticIntegration: '你成功觉醒了内在的逻辑审判官（Ti）。这让你的决策既有外部效率，也有内在的逻辑自洽。你学会了在行动与思考之间找到平衡。',
    demonIntegration: '你成功驯化了内心深处的恶魔（Si）。你能够健康地从过去的经验中学习，而不被细节和传统所束缚。你获得了一种稳定的内在根基。'
  },
  INFP: {
    maskMutations: {
      Fe: '和谐面具 (Fe-Mask)\n虽然你的核心底色是【怀玉者】，但你的辅助功能发生了"外化情感异变"。你比传统的 INFP 更在意群体和谐，可能压抑了个人真实感受。',
      Ti: '逻辑面具 (Ti-Mask)\n你的辅助功能发生了"内化逻辑异变"。你比传统的 INFP 更注重逻辑分析，这可能是应对压力的防御机制。',
      Ni: '洞见面具 (Ni-Mask)\n你的辅助功能发生了"收敛直觉异变"。你比传统的 INFP 更专注于单一愿景。'
    },
    loopDescription: '你的能量在"价值观"与"记忆"之间封闭循环，切断了与外界可能性的连接（Ne 断联）。这让你沉溺于过去，难以看到新的希望。',
    blindspotAwakening: {
      Te: '你的"盲点"位置（Te）不仅没有处于黑暗中，反而异常活跃。这说明你发展出了罕见的执行力和组织能力。'
    },
    gripDescription: '你的灵魂正处于"颠倒"状态。平日里被你忽视的劣势功能（Te）正在掌权。你可能正经历着极端的压力，表现出强迫性地整理、列清单、批评他人效率低下等与本性截然相反的行为。这是你内心在渴望掌控那些失控的外部世界。',
    criticDescription: '你的第六功能（Ni）异常活跃，化身为一个黑暗的预言者。你开始看到一切事物消极的未来，陷入末日思维，坚信一切都会走向最坏的结果。这种悲观的预见正在吞噬你的希望。请记住：未来不是注定的，每一刻都有转变的可能。',
    demonDescription: '你心灵最深处的恶魔（Ti）已经苏醒。你可能正陷入冷酷无情的逻辑分析中，用理性来解构和摧毁那些曾经珍视的价值观和信念。你变得愤世嫉俗，用逻辑作为武器攻击一切。这股力量正在要求你面对那些被理想主义所掩盖的残酷真相。',
    inferiorIntegration: '恭喜！你的劣势功能（Te）已经成功整合。你在保持内在价值观（Fi）的同时，发展出了将理想转化为现实的执行力。你既是梦想家，也是实干家。',
    blindspotIntegration: '你的盲点功能（Te）已经被点亮。这意味着你不仅有丰富的内心世界，还发展出了组织和执行的能力。你能够将创意变为现实。',
    criticIntegration: '你成功觉醒了内在的预言家（Ni）。这让你在探索无限可能的同时，也能聚焦于最重要的愿景。你学会了在发散与收敛之间找到平衡。',
    demonIntegration: '你成功驯化了内心深处的恶魔（Ti）。你能够运用逻辑来支持而非攻击自己的价值观。你获得了一种将情感与理性和谐统一的智慧。'
  },
  INTP: {
    maskMutations: {
      Fe: '共情面具 (Fe-Mask)\n虽然你的核心底色是【格物者】，但你发展出了强大的情感感知能力。你比传统的 INTP 更在意社交和谐。',
      Te: '效率面具 (Te-Mask)\n你的辅助功能发生了"外化逻辑异变"。你比传统的 INTP 更注重效率和结果。',
      Fi: '价值面具 (Fi-Mask)\n你发展出了强烈的个人价值判断系统，这让你在逻辑之外有了情感锚点。'
    },
    loopDescription: '你的能量在"逻辑"与"记忆"之间封闭循环，切断了与外界可能性的连接（Ne 断联）。这让你变得固执保守，失去了创新的灵活性。',
    blindspotAwakening: {
      Fe: '你的"盲点"位置（Fe）不仅没有处于黑暗中，反而异常活跃。这说明你发展出了罕见的社交敏感度。'
    },
    gripDescription: '你的灵魂正处于"颠倒"状态。平日里被你忽视的劣势功能（Fe）正在掌权。你可能正经历着极端的压力，表现出情绪大爆发、过度在意他人看法、甚至变得歇斯底里等与本性截然相反的行为。这是你内心在渴望与他人建立真实的情感连接。',
    criticDescription: '你的第六功能（Ni）异常活跃，化身为一个黑暗的预言者。你开始看到一切理论的漏洞和失败的必然性，陷入虚无主义的深渊。这种悲观的洞见正在消耗你探索真理的热情。请记住：不完美的理论依然有价值。',
    demonDescription: '你心灵最深处的恶魔（Fi）已经苏醒。你可能正陷入一种极端的价值判断中，对他人和自己进行残酷的道德审判。你变得异常敏感、容易被冒犯，用个人好恶来衡量一切。这股力量正在要求你面对那些被逻辑所压抑的深层情感需求。',
    inferiorIntegration: '恭喜！你的劣势功能（Fe）已经成功整合。你在保持逻辑严谨（Ti）的同时，发展出了真实的社交能力。你既能独立思考，也能与他人建立深层连接。',
    blindspotIntegration: '你的盲点功能（Fe）已经被点亮。这意味着你不仅有强大的分析能力，还发展出了感知群体情感的天赋。你能够在保持独立的同时，与社会产生共鸣。',
    criticIntegration: '你成功觉醒了内在的预言家（Ni）。这让你的理论探索不再漫无目的，而是有了清晰的方向。你学会了将分散的知识整合成深刻的洞见。',
    demonIntegration: '你成功驯化了内心深处的恶魔（Fi）。你能够在逻辑分析中保持对个人价值的尊重。你获得了一种将客观真理与主观意义和谐统一的智慧。'
  },
  ENFJ: {
    maskMutations: {
      Te: '效率面具 (Te-Mask)\n虽然你的核心底色是【渡人者】，但你发展出了强大的组织管理能力。你比传统的 ENFJ 更注重效率。',
      Fi: '真我面具 (Fi-Mask)\n你的辅助功能发生了"内化情感异变"。你可能在服务他人和忠于自我之间产生撕裂。',
      Ti: '分析增强 (Ti-Enhancement)\n你的劣势功能Ti异常活跃，这让你比普通 ENFJ 更善于独立分析。'
    },
    loopDescription: '你的能量在"情感"与"感官"之间封闭循环，切断了与内在直觉的连接（Ni 断联）。这让你变得肤浅和短视，失去了战略眼光。',
    blindspotAwakening: {
      Ti: '你的"盲点"位置（Ti）不仅没有处于黑暗中，反而异常活跃。这说明你发展出了罕见的逻辑分析能力。'
    },
    gripDescription: '你的灵魂正处于"颠倒"状态。平日里被你忽视的劣势功能（Ti）正在掌权。你可能正经历着极端的压力，表现出过度批判、冷酷无情地分析他人动机、甚至变得尖酸刻薄等与本性截然相反的行为。这是你内心在渴望从服务他人的角色中抽身，去建立自己的逻辑边界。',
    criticDescription: '你的第六功能（Se）异常活跃，化身为一个苛刻的审视者。你开始过度关注外表、物质和感官享受，批判自己不够时尚、不够有品味、不够有存在感。这种表面化的自我攻击正在消耗你的精力。请记住：真正的魅力来自内在的光芒。',
    demonDescription: '你心灵最深处的恶魔（Te）已经苏醒。你可能正在用冷酷的效率逻辑来衡量一切关系的价值，将人视为工具或资源。你变得急功近利，不惜一切代价追求结果。这股力量正在要求你面对那些被共情所掩盖的权力欲望。',
    inferiorIntegration: '恭喜！你的劣势功能（Ti）已经成功整合。你在保持强大共情能力（Fe）的同时，发展出了独立分析和批判性思考的能力。你既能感受他人，也能保持理性边界。',
    blindspotIntegration: '你的盲点功能（Ti）已经被点亮。这意味着你不仅能引领和激励他人，还发展出了深度分析的能力。你的影响力有了更坚实的逻辑基础。',
    criticIntegration: '你成功觉醒了内在的感官觉察者（Se）。这让你在关注长远愿景的同时，也能敏锐地感知当下。你学会了活在此刻。',
    demonIntegration: '你成功驯化了内心深处的恶魔（Te）。你能够在关怀他人的同时，保持对效率的健康追求。你获得了一种将爱与力量和谐统一的智慧。'
  },
  ENFP: {
    maskMutations: {
      Fe: '和谐面具 (Fe-Mask)\n虽然你的核心底色是【逍遥客】，但你发展出了强大的群体情感感知能力。你可能在真实表达和维护和谐之间挣扎。',
      Ti: '逻辑面具 (Ti-Mask)\n你的辅助功能发生了"内化逻辑异变"。你比传统的 ENFP 更注重理论自洽。',
      Ni: '聚焦面具 (Ni-Mask)\n你发展出了强烈的单一愿景追求，这与你天生的发散思维形成张力。'
    },
    loopDescription: '你的能量在"可能性"与"效率"之间封闭循环，切断了与内在价值的连接（Fi 断联）。这让你变得焦虑和失真，失去了真诚的力量。',
    blindspotAwakening: {
      Ti: '你的"盲点"位置（Ti）不仅没有处于黑暗中，反而异常活跃。这说明你发展出了罕见的逻辑分析能力。'
    },
    gripDescription: '你的灵魂正处于"颠倒"状态。平日里被你忽视的劣势功能（Si）正在掌权。你可能正经历着极端的压力，表现出强迫性地纠结于过去的细节、过度担忧健康、变得保守固执等与本性截然相反的行为。这是你内心在渴望稳定和可预测的安全感。',
    criticDescription: '你的第六功能（Fe）异常活跃，化身为一个社交审判者。你开始过度在意他人的看法和社交评价，担心自己是否受欢迎、是否讨人喜欢。这种外部化的自我攻击正在消耗你的创造力。请记住：真实比讨喜更有价值。',
    demonDescription: '你心灵最深处的恶魔（Ti）已经苏醒。你可能正在用冷酷无情的逻辑来解构和摧毁那些曾经让你兴奋的可能性。你变得愤世嫉俗，用批判性思维攻击一切包括自己。这股力量正在要求你面对那些被乐观所掩盖的逻辑漏洞。',
    inferiorIntegration: '恭喜！你的劣势功能（Si）已经成功整合。你在保持探索精神（Ne）的同时，发展出了稳定性和对细节的关注。你既有无限创意，也能脚踏实地。',
    blindspotIntegration: '你的盲点功能（Ti）已经被点亮。这意味着你不仅有丰富的想象力，还发展出了深度分析的能力。你的创意有了更坚实的逻辑基础。',
    criticIntegration: '你成功觉醒了内在的社交觉察者（Fe）。这让你在追求自由的同时，也能敏感地感知群体氛围。你学会了在独立与归属之间找到平衡。',
    demonIntegration: '你成功驯化了内心深处的恶魔（Ti）。你能够运用逻辑来支持而非攻击自己的热情。你获得了一种将创意与理性和谐统一的智慧。'
  },
  ENTJ: {
    maskMutations: {
      Fe: '共情面具 (Fe-Mask)\n虽然你的核心底色是【经纶者】，但你发展出了强大的情感感知能力。你比传统的 ENTJ 更在意团队情感。',
      Ti: '分析面具 (Ti-Mask)\n你的辅助功能发生了"内化逻辑异变"。你比传统的 ENTJ 更注重理论深度。',
      Fi: '价值觉醒 (Fi-Awakening)\n你的劣势功能Fi异常活跃，说明你正在发展内在价值判断系统。'
    },
    loopDescription: '你的能量在"效率"与"感官"之间封闭循环，切断了与内在直觉的连接（Ni 断联）。这让你变得急功近利，失去了战略眼光。',
    blindspotAwakening: {
      Fi: '你的"盲点"位置（Fi）不仅没有处于黑暗中，反而异常活跃。这说明你发展出了罕见的价值敏感度。'
    },
    gripDescription: '你的灵魂正处于"颠倒"状态。平日里被你忽视的劣势功能（Fi）正在掌权。你可能正经历着极端的压力，表现出过度敏感、自我怀疑、陷入"我是谁"的身份危机等与本性截然相反的行为。这是你内心在渴望探索那些被效率追求所压抑的深层价值观。',
    criticDescription: '你的第六功能（Si）异常活跃，化身为一个传统的守卫者。你开始过度纠结于过去的失败和教训，质疑自己是否足够有经验、是否遵循了正确的流程。这种向后看的自我攻击正在阻碍你的创新。请记住：过去不等于未来。',
    demonDescription: '你心灵最深处的恶魔（Fe）已经苏醒。你可能正在以一种扭曲的方式操控他人的情感，用共情作为控制的工具。你变得虚伪、善于表演，用情感来达成目的。这股力量正在要求你面对那些被权力追求所掩盖的情感需求。',
    inferiorIntegration: '恭喜！你的劣势功能（Fi）已经成功整合。你在保持强大执行力（Te）的同时，发展出了深刻的个人价值观。你既是领袖，也有柔软的内心。',
    blindspotIntegration: '你的盲点功能（Fi）已经被点亮。这意味着你不仅能高效地达成目标，还发展出了对个人价值的敏感度。你的领导力有了更人性化的温度。',
    criticIntegration: '你成功觉醒了内在的经验守护者（Si）。这让你在追求创新的同时，也能尊重传统和经验。你学会了从历史中汲取智慧。',
    demonIntegration: '你成功驯化了内心深处的恶魔（Fe）。你能够真诚地与他人建立情感连接，而非仅仅将其视为工具。你获得了一种将权力与关怀和谐统一的智慧。'
  },
  ENTP: {
    maskMutations: {
      Fe: '和谐增强 (Fe-Enhancement)\n你的第三功能Fe异常活跃，这让你比普通 ENTP 更善于社交协调。',
      Te: '效率面具 (Te-Mask)\n你的辅助功能发生了"外化逻辑异变"。你比传统的 ENTP 更注重效率和结果。',
      Fi: '价值面具 (Fi-Mask)\n你发展出了强烈的个人价值判断系统，这与你天生的客观分析形成有趣的张力。'
    },
    loopDescription: '你的能量在"可能性"与"情感"之间封闭循环，切断了与内在逻辑的连接（Ti 断联）。这让你变得表演化和虚浮，失去了分析的深度。',
    blindspotAwakening: {
      Fi: '你的"盲点"位置（Fi）不仅没有处于黑暗中，反而异常活跃。这说明你发展出了罕见的价值判断能力。'
    },
    gripDescription: '你的灵魂正处于"颠倒"状态。平日里被你忽视的劣势功能（Si）正在掌权。你可能正经历着极端的压力，表现出强迫性地反复检查、过度担忧健康问题、陷入对过去失败的反刍等与本性截然相反的行为。这是你内心在渴望一种稳定和确定性。',
    criticDescription: '你的第六功能（Fe）异常活跃，化身为一个社交审判者。你开始过度在意群体的认可和社会地位，担心自己是否被接纳、是否有社会价值。这种外部评价的自我攻击正在消耗你的创造力。请记住：独立思考比随波逐流更有价值。',
    demonDescription: '你心灵最深处的恶魔（Fi）已经苏醒。你可能正在以一种极端的方式表达个人好恶，将所有事物分为"我喜欢"和"我讨厌"两类。你变得异常敏感、容易被冒犯、用情感来否定逻辑。这股力量正在要求你面对那些被理性辩论所掩盖的深层价值需求。',
    inferiorIntegration: '恭喜！你的劣势功能（Si）已经成功整合。你在保持创新思维（Ne）的同时，发展出了对细节和传统的尊重。你既能突破框架，也能稳扎稳打。',
    blindspotIntegration: '你的盲点功能（Fi）已经被点亮。这意味着你不仅能客观分析，还发展出了清晰的个人价值观。你的智慧有了更深的人文根基。',
    criticIntegration: '你成功觉醒了内在的社交觉察者（Fe）。这让你在挑战传统的同时，也能维护群体和谐。你学会了在批判与建设之间找到平衡。',
    demonIntegration: '你成功驯化了内心深处的恶魔（Fi）。你能够在理性辩论中保持对个人价值的尊重。你获得了一种将真理与意义和谐统一的智慧。'
  },
  ISFJ: {
    maskMutations: {
      Te: '效率面具 (Te-Mask)\n虽然你的核心底色是【素心者】，但你发展出了强大的组织能力。你比传统的 ISFJ 更注重效率。',
      Fi: '真我面具 (Fi-Mask)\n你的辅助功能发生了"内化情感异变"。你可能在服务他人和忠于自我之间产生撕裂。',
      Ti: '分析增强 (Ti-Enhancement)\n你的第三功能Ti异常活跃，这让你比普通 ISFJ 更善于独立分析。'
    },
    loopDescription: '你的能量在"记忆"与"逻辑"之间封闭循环，切断了与外界情感的连接（Fe 断联）。这让你变得冷漠和批判，失去了温暖的特质。',
    blindspotAwakening: {
      Te: '你的"盲点"位置（Te）不仅没有处于黑暗中，反而异常活跃。这说明你发展出了罕见的管理能力。'
    },
    gripDescription: '你的灵魂正处于"颠倒"状态。平日里被你忽视的劣势功能（Ne）正在掌权。你可能正经历着极端的压力，表现出灾难性思维、想象各种可怕的可能性、变得偏执多疑等与本性截然相反的行为。这是你内心在渴望跳出熟悉的框架，去探索未知的领域。',
    criticDescription: '你的第六功能（Fi）异常活跃，化身为一个冷酷的道德审判者。你开始严厉地审视自己的动机是否纯粹、付出是否真心，质疑自己是不是在以牺牲自我来换取认可。这种自我攻击正在消耗你的善意。请记住：不完美的爱也是爱。',
    demonDescription: '你心灵最深处的恶魔（Ni）已经苏醒。你可能正被一种黑暗的预感所笼罩，坚信一切都在走向不可逆转的毁灭。你变得宿命论、悲观绝望，看到的都是注定失败的未来。这股力量正在要求你面对那些被日常责任所掩盖的深层恐惧。',
    inferiorIntegration: '恭喜！你的劣势功能（Ne）已经成功整合。你在保持稳定可靠（Si）的同时，发展出了对新可能性的开放态度。你既能守护传统，也能拥抱变化。',
    blindspotIntegration: '你的盲点功能（Te）已经被点亮。这意味着你不仅有强大的服务精神，还发展出了组织和管理的能力。你的关怀有了更强大的执行力。',
    criticIntegration: '你成功觉醒了内在的价值判官（Fi）。这让你在服务他人的同时，也建立了清晰的个人边界。你学会了在付出与自我保护之间找到平衡。',
    demonIntegration: '你成功驯化了内心深处的恶魔（Ni）。你能够看到事物的长远发展趋势，而不被悲观预感所淹没。你获得了一种将现实关怀与远见卓识和谐统一的智慧。'
  },
  ISFP: {
    maskMutations: {
      Fe: '和谐面具 (Fe-Mask)\n虽然你的核心底色是【游艺者】，但你发展出了强大的群体情感感知能力。你可能在真实表达和维护和谐之间挣扎。',
      Ti: '逻辑面具 (Ti-Mask)\n你的辅助功能发生了"内化逻辑异变"。你比传统的 ISFP 更注重理论分析。',
      Ne: '发散面具 (Ne-Mask)\n你发展出了强烈的可能性探索欲望，这与你天生的专注形成张力。'
    },
    loopDescription: '你的能量在"价值观"与"直觉"之间封闭循环，切断了与外界感官的连接（Se 断联）。这让你变得脱离现实，陷入空想。',
    blindspotAwakening: {
      Ne: '你的"盲点"位置（Ne）不仅没有处于黑暗中，反而异常活跃。这说明你发展出了罕见的创意联想能力。'
    },
    gripDescription: '你的灵魂正处于"颠倒"状态。平日里被你忽视的劣势功能（Te）正在掌权。你可能正经历着极端的压力，表现出强迫性地追求效率、严厉批评他人无能、变得专制独断等与本性截然相反的行为。这是你内心在渴望掌控那些让你感到无力的外部世界。',
    criticDescription: '你的第六功能（Fe）异常活跃，化身为一个社交审判者。你开始过度在意他人的评价和社会认可，担心自己是否被理解、是否讨人喜欢。这种外部化的自我攻击正在消耗你的艺术创造力。请记住：真实的表达比被认可更重要。',
    demonDescription: '你心灵最深处的恶魔（Ti）已经苏醒。你可能正在用冷酷无情的逻辑来解构自己珍视的价值观和信念。你变得愤世嫉俗，用理性分析来否定情感和美学体验的意义。这股力量正在要求你面对那些被感性追求所掩盖的逻辑需求。',
    inferiorIntegration: '恭喜！你的劣势功能（Te）已经成功整合。你在保持艺术敏感度（Fi）的同时，发展出了将创意变为现实的执行力。你既是艺术家，也是实干家。',
    blindspotIntegration: '你的盲点功能（Ne）已经被点亮。这意味着你不仅能专注于当下的美，还发展出了对无限可能性的想象力。你的艺术有了更广阔的视野。',
    criticIntegration: '你成功觉醒了内在的社交觉察者（Fe）。这让你在追求真实表达的同时，也能感知群体的情感氛围。你学会了在独特与融入之间找到平衡。',
    demonIntegration: '你成功驯化了内心深处的恶魔（Ti）。你能够运用逻辑来支持而非攻击自己的价值观。你获得了一种将感性与理性和谐统一的智慧。'
  },
  ISTJ: {
    maskMutations: {
      Fe: '共情面具 (Fe-Mask)\n虽然你的核心底色是【守常者】，但你发展出了强大的情感感知能力。你比传统的 ISTJ 更在意社交和谐。',
      Ti: '分析面具 (Ti-Mask)\n你的辅助功能发生了"内化逻辑异变"。你比传统的 ISTJ 更注重理论深度。',
      Fi: '价值深化 (Fi-Enhancement)\n你的第三功能Fi异常活跃，这让你比普通 ISTJ 更有道德洞察力。'
    },
    loopDescription: '你的能量在"记忆"与"价值观"之间封闭循环，切断了与外界效率的连接（Te 断联）。这让你变得过度内省和情绪化。',
    blindspotAwakening: {
      Fe: '你的"盲点"位置（Fe）不仅没有处于黑暗中，反而异常活跃。这说明你发展出了罕见的社交敏感度。'
    },
    gripDescription: '你的灵魂正处于"颠倒"状态。平日里被你忽视的劣势功能（Ne）正在掌权。你可能正经历着极端的压力，表现出灾难性思维、怀疑一切、看到各种可怕的可能性等与本性截然相反的行为。这是你内心在渴望打破现有的秩序，去探索那些从未考虑过的选项。',
    criticDescription: '你的第六功能（Ti）异常活跃，化身为一个逻辑审判者。你开始过度分析自己的决策过程，质疑每一步的逻辑是否严密、是否有更好的解决方案。这种分析瘫痪正在阻碍你的执行力。请记住：有时候"足够好"就是"最好"。',
    demonDescription: '你心灵最深处的恶魔（Ni）已经苏醒。你可能正被一种黑暗的直觉所笼罩，坚信隐藏的力量在暗中操控一切。你变得偏执多疑，在正常事件中看到阴谋。这股力量正在要求你面对那些被具体事实所掩盖的深层不确定性。',
    inferiorIntegration: '恭喜！你的劣势功能（Ne）已经成功整合。你在保持务实可靠（Si）的同时，发展出了对新可能性的开放态度。你既是守护者，也是创新者。',
    blindspotIntegration: '你的盲点功能（Fe）已经被点亮。这意味着你不仅有强大的执行力，还发展出了感知群体情感的能力。你的效率有了更人性化的温度。',
    criticIntegration: '你成功觉醒了内在的逻辑审判官（Ti）。这让你在实际执行的同时，也能进行深度分析。你学会了在行动与思考之间找到平衡。',
    demonIntegration: '你成功驯化了内心深处的恶魔（Ni）。你能够看到事物的深层意义，而不被偏执所困扰。你获得了一种将现实与洞见和谐统一的智慧。'
  },
  ISTP: {
    maskMutations: {
      Fe: '共情增强 (Fe-Enhancement)\n你的劣势功能Fe异常活跃，这让你比普通 ISTP 更善于情感交流。',
      Te: '效率面具 (Te-Mask)\n你的辅助功能发生了"外化逻辑异变"。你比传统的 ISTP 更注重效率和管理。',
      Fi: '价值面具 (Fi-Mask)\n你发展出了强烈的个人价值判断系统，这与你天生的客观分析形成有趣的张力。'
    },
    loopDescription: '你的能量在"逻辑"与"直觉"之间封闭循环，切断了与外界感官的连接（Se 断联）。这让你变得空想和偏执，失去了实践的能力。',
    blindspotAwakening: {
      Ne: '你的"盲点"位置（Ne）不仅没有处于黑暗中，反而异常活跃。这说明你发展出了罕见的可能性思维。'
    },
    gripDescription: '你的灵魂正处于"颠倒"状态。平日里被你忽视的劣势功能（Fe）正在掌权。你可能正经历着极端的压力，表现出情绪大爆发、过度在意他人看法、变得情感依赖等与本性截然相反的行为。这是你内心在渴望真实的情感连接和社会归属。',
    criticDescription: '你的第六功能（Te）异常活跃，化身为一个效率审判者。你开始过度关注结果和成就，质疑自己是否足够有效率、是否在浪费时间。这种生产力焦虑正在消耗你探索的乐趣。请记住：过程本身就有价值。',
    demonDescription: '你心灵最深处的恶魔（Fi）已经苏醒。你可能正陷入一种极端的个人好恶中，用主观价值来否定一切。你变得异常敏感、容易被冒犯、在他人无心的话语中读出恶意。这股力量正在要求你面对那些被逻辑分析所压抑的深层情感伤痛。',
    inferiorIntegration: '恭喜！你的劣势功能（Fe）已经成功整合。你在保持独立思考（Ti）的同时，发展出了真实的社交能力。你既能独善其身，也能与人建立深层连接。',
    blindspotIntegration: '你的盲点功能（Ne）已经被点亮。这意味着你不仅有强大的实践能力，还发展出了对无限可能性的想象力。你的技艺有了更广阔的应用空间。',
    criticIntegration: '你成功觉醒了内在的效率审判官（Te）。这让你在自由探索的同时，也能关注结果和效率。你学会了在过程与目标之间找到平衡。',
    demonIntegration: '你成功驯化了内心深处的恶魔（Fi）。你能够在客观分析中保持对个人价值的尊重。你获得了一种将理性与情感和谐统一的智慧。'
  },
  ESFJ: {
    maskMutations: {
      Te: '效率面具 (Te-Mask)\n虽然你的核心底色是【司礼者】，但你发展出了强大的组织管理能力。你比传统的 ESFJ 更注重效率。',
      Fi: '真我面具 (Fi-Mask)\n你的辅助功能发生了"内化情感异变"。你可能在服务群体和忠于自我之间产生撕裂。',
      Ti: '分析觉醒 (Ti-Awakening)\n你的劣势功能Ti异常活跃，说明你正在发展独立分析能力。'
    },
    loopDescription: '你的能量在"情感"与"可能性"之间封闭循环，切断了与内在记忆的连接（Si 断联）。这让你变得不稳定和焦虑。',
    blindspotAwakening: {
      Ti: '你的"盲点"位置（Ti）不仅没有处于黑暗中，反而异常活跃。这说明你发展出了罕见的逻辑分析能力。'
    },
    gripDescription: '你的灵魂正处于"颠倒"状态。平日里被你忽视的劣势功能（Ti）正在掌权。你可能正经历着极端的压力，表现出过度批判、冷酷地分析人际关系、用逻辑攻击他人等与本性截然相反的行为。这是你内心在渴望从服务他人的角色中抽身，去建立自己的独立判断。',
    criticDescription: '你的第六功能（Se）异常活跃，化身为一个感官审判者。你开始过度关注外表、形象和物质成就，担心自己是否足够体面、是否有社会地位。这种表面化的自我攻击正在消耗你的善意。请记住：真正的价值不在于外表。',
    demonDescription: '你心灵最深处的恶魔（Te）已经苏醒。你可能正在用冷酷的效率逻辑来衡量所有关系的价值，将人视为达成目标的工具。你变得功利、善于操控，不惜牺牲他人来达成目的。这股力量正在要求你面对那些被和谐需求所掩盖的权力欲望。',
    inferiorIntegration: '恭喜！你的劣势功能（Ti）已经成功整合。你在保持强大共情能力（Fe）的同时，发展出了独立分析和批判性思考的能力。你既能关怀他人，也能保持理性边界。',
    blindspotIntegration: '你的盲点功能（Ti）已经被点亮。这意味着你不仅能协调群体，还发展出了深度分析的能力。你的服务精神有了更坚实的逻辑基础。',
    criticIntegration: '你成功觉醒了内在的感官觉察者（Se）。这让你在关注他人的同时，也能享受当下的感官体验。你学会了在服务与自我享受之间找到平衡。',
    demonIntegration: '你成功驯化了内心深处的恶魔（Te）。你能够在关怀他人的同时，保持对效率的健康追求。你获得了一种将爱与执行力和谐统一的智慧。'
  },
  ESFP: {
    maskMutations: {
      Fe: '和谐面具 (Fe-Mask)\n虽然你的核心底色是【采真者】，但你发展出了强大的群体情感协调能力。你可能在真实表达和维护和谐之间挣扎。',
      Ti: '逻辑面具 (Ti-Mask)\n你的辅助功能发生了"内化逻辑异变"。你比传统的 ESFP 更注重理论分析。',
      Ni: '洞见觉醒 (Ni-Awakening)\n你的劣势功能Ni异常活跃，说明你正在发展长远眼光。'
    },
    loopDescription: '你的能量在"感官"与"效率"之间封闭循环，切断了与内在价值的连接（Fi 断联）。这让你变得功利和肤浅。',
    blindspotAwakening: {
      Ti: '你的"盲点"位置（Ti）不仅没有处于黑暗中，反而异常活跃。这说明你发展出了罕见的逻辑分析能力。'
    },
    gripDescription: '你的灵魂正处于"颠倒"状态。平日里被你忽视的劣势功能（Ni）正在掌权。你可能正经历着极端的压力，表现出悲观的预感、看到灾难性的未来、陷入存在主义危机等与本性截然相反的行为。这是你内心在渴望超越当下，去寻找更深层的意义。',
    criticDescription: '你的第六功能（Fe）异常活跃，化身为一个社交审判者。你开始过度在意群体的评价和社会认可，担心自己是否够受欢迎、是否够有趣。这种外部评价的自我攻击正在消耗你的自发性。请记住：活在当下比取悦他人更重要。',
    demonDescription: '你心灵最深处的恶魔（Ti）已经苏醒。你可能正在用冷酷的逻辑来分析和解构生活中的乐趣，质疑一切体验的意义。你变得愤世嫉俗，用批判性思维攻击那些曾经让你快乐的事物。这股力量正在要求你面对那些被感官享受所掩盖的存在焦虑。',
    inferiorIntegration: '恭喜！你的劣势功能（Ni）已经成功整合。你在保持活在当下（Se）的同时，发展出了对长远未来的洞察力。你既能享受当下，也有远见卓识。',
    blindspotIntegration: '你的盲点功能（Ti）已经被点亮。这意味着你不仅有丰富的感官体验，还发展出了深度分析的能力。你的快乐有了更深刻的意义。',
    criticIntegration: '你成功觉醒了内在的社交觉察者（Fe）。这让你在自由表达的同时，也能感知群体的情感氛围。你学会了在真实与适应之间找到平衡。',
    demonIntegration: '你成功驯化了内心深处的恶魔（Ti）。你能够运用逻辑来增强而非攻击你的体验。你获得了一种将感性与理性和谐统一的智慧。'
  },
  ESTJ: {
    maskMutations: {
      Fe: '共情面具 (Fe-Mask)\n虽然你的核心底色是【司纲者】，但你发展出了强大的情感感知能力。你比传统的 ESTJ 更在意团队情感。',
      Ti: '分析面具 (Ti-Mask)\n你的辅助功能发生了"内化逻辑异变"。你比传统的 ESTJ 更注重理论深度。',
      Fi: '价值觉醒 (Fi-Awakening)\n你的劣势功能Fi异常活跃，说明你正在发展内在价值判断系统。'
    },
    loopDescription: '你的能量在"效率"与"可能性"之间封闭循环，切断了与内在记忆的连接（Si 断联）。这让你变得冒进和不稳定。',
    blindspotAwakening: {
      Fi: '你的"盲点"位置（Fi）不仅没有处于黑暗中，反而异常活跃。这说明你发展出了罕见的价值敏感度。'
    },
    gripDescription: '你的灵魂正处于"颠倒"状态。平日里被你忽视的劣势功能（Fi）正在掌权。你可能正经历着极端的压力，表现出过度敏感、自我怀疑、陷入"我的价值是什么"的危机等与本性截然相反的行为。这是你内心在渴望探索那些被效率追求所压抑的深层情感。',
    criticDescription: '你的第六功能（Ti）异常活跃，化身为一个逻辑审判者。你开始过度质疑自己决策背后的理论依据，怀疑自己是否真正理解问题的本质。这种分析瘫痪正在阻碍你的执行力。请记住：实践出真知，行动比思考更重要。',
    demonDescription: '你心灵最深处的恶魔（Fe）已经苏醒。你可能正在以一种扭曲的方式操控群体情感，用社会压力来强迫他人服从。你变得专制、霸道，用"为大家好"来掩盖控制欲。这股力量正在要求你面对那些被权威形象所掩盖的情感不安全感。',
    inferiorIntegration: '恭喜！你的劣势功能（Fi）已经成功整合。你在保持强大执行力（Te）的同时，发展出了深刻的个人价值观。你既是管理者，也有柔软的内心。',
    blindspotIntegration: '你的盲点功能（Fi）已经被点亮。这意味着你不仅能高效地达成目标，还发展出了对个人价值的敏感度。你的管理力有了更人性化的温度。',
    criticIntegration: '你成功觉醒了内在的逻辑审判官（Ti）。这让你在追求效率的同时，也能进行深度分析。你学会了在行动与思考之间找到平衡。',
    demonIntegration: '你成功驯化了内心深处的恶魔（Fe）。你能够真诚地关怀他人的情感，而非仅仅将其视为管理工具。你获得了一种将权威与关怀和谐统一的智慧。'
  },
  ESTP: {
    maskMutations: {
      Fe: '共情增强 (Fe-Enhancement)\n你的第三功能Fe异常活跃，这让你比普通 ESTP 更善于社交协调。',
      Te: '效率面具 (Te-Mask)\n你的辅助功能发生了"外化逻辑异变"。你比传统的 ESTP 更注重效率和管理。',
      Fi: '价值面具 (Fi-Mask)\n你发展出了强烈的个人价值判断系统，这让你在行动之外有了内在锚点。',
      Ni: '洞见觉醒 (Ni-Awakening)\n你的劣势功能Ni异常活跃，说明你正在发展战略眼光。'
    },
    loopDescription: '你的能量在"感官"与"情感"之间封闭循环，切断了与内在逻辑的连接（Ti 断联）。这让你变得冲动和情绪化。',
    blindspotAwakening: {
      Fi: '你的"盲点"位置（Fi）不仅没有处于黑暗中，反而异常活跃。这说明你发展出了罕见的价值判断能力。'
    },
    gripDescription: '你的灵魂正处于"颠倒"状态。平日里被你忽视的劣势功能（Ni）正在掌权。你可能正经历着极端的压力，表现出悲观的预感、偏执多疑、看到各种隐藏的阴谋等与本性截然相反的行为。这是你内心在渴望超越表面现象，去理解事物背后的深层意义。',
    criticDescription: '你的第六功能（Te）异常活跃，化身为一个效率审判者。你开始过度关注成就和社会地位，质疑自己是否够成功、是否有足够的影响力。这种外在成就的焦虑正在消耗你享受当下的能力。请记住：人生不只是竞赛。',
    demonDescription: '你心灵最深处的恶魔（Fi）已经苏醒。你可能正陷入一种极端的个人好恶中，用主观感受来否定一切。你变得任性、自我中心，拒绝倾听任何不符合自己情感的意见。这股力量正在要求你面对那些被行动力所掩盖的深层价值困惑。',
    inferiorIntegration: '恭喜！你的劣势功能（Ni）已经成功整合。你在保持行动力（Se）的同时，发展出了对长远未来的洞察力。你既能活在当下，也有战略眼光。',
    blindspotIntegration: '你的盲点功能（Fi）已经被点亮。这意味着你不仅有强大的行动力，还发展出了清晰的个人价值观。你的冒险精神有了内在的道德指南针。',
    criticIntegration: '你成功觉醒了内在的效率审判官（Te）。这让你在自由行动的同时，也能关注结果和成就。你学会了在冒险与目标之间找到平衡。',
    demonIntegration: '你成功驯化了内心深处的恶魔（Fi）。你能够在行动中保持对个人价值的尊重。你获得了一种将力量与意义和谐统一的智慧。'
  }
};

const generateInsights = (
  userType: MBTIType, 
  userSlots: UserSlots, 
  rawData: UserRawData
): InsightAlert[] => {
  const insights: InsightAlert[] = [];
  const standardStack = MBTI_FUNCTION_STACKS[userType];
  const typeTexts = INSIGHT_TEXTS[userType];
  
  // 1. 辅助位异化检测 (The Mask Mutation)
  const standardAuxiliary = standardStack[1]; // 标准辅助功能
  const userAuxiliarySlot = userSlots[1];
  
  if (userAuxiliarySlot && userAuxiliarySlot.function !== standardAuxiliary && userAuxiliarySlot.score > 3) {
    const mutationText = typeTexts?.maskMutations?.[userAuxiliarySlot.function];
    if (mutationText) {
      const [title, ...descParts] = mutationText.split('\n');
      insights.push({
        type: 'mask',
        title: `异化警报：${title}`,
        description: descParts.join('\n'),
        severity: 'warning'
      });
    }
  }
  
  // 2. 内倾/外倾循环检测 (The Loop Alert)
  const heroFunc = standardStack[0];
  const auxFunc = standardStack[1];
  const childFunc = standardStack[2];
  
  const heroScore = rawData.slotScores[heroFunc][0] || 0;
  const auxScore = rawData.slotScores[auxFunc][1] || 0;
  const childScore = rawData.slotScores[childFunc][2] || 0;
  
  const heroIsIntroverted = heroFunc.endsWith('i');
  const childIsIntroverted = childFunc.endsWith('i');
  
  // 检测：第一和第三功能同向，且分数显著高于第二功能
  if (heroIsIntroverted === childIsIntroverted && 
      heroScore > 5 && childScore > 5 && 
      auxScore < heroScore * 0.5) {
    const loopType = heroIsIntroverted ? '内倾死循环' : '外倾死循环';
    insights.push({
      type: 'loop',
      title: `状态警报：${loopType} (${heroFunc}-${childFunc} Loop)`,
      description: typeTexts?.loopDescription || `你的能量在"${FUNCTION_NAMES[heroFunc]}"与"${FUNCTION_NAMES[childFunc]}"之间封闭循环，切断了与外界的${auxFunc}连接。`,
      severity: 'critical'
    });
  }
  
  // 3. 核心冲突检测 (The Core Conflict)
  const heroSlot = userSlots[0];
  if (heroSlot?.hasConflict && heroSlot.conflictWith) {
    insights.push({
      type: 'conflict',
      title: `结构警报：双王夺嫡`,
      description: `你的灵魂中似乎住着两个君王（${heroSlot.function} 与 ${heroSlot.conflictWith}）。你时而像${heroSlot.function}主导的类型，时而像${heroSlot.conflictWith}主导的类型。这种核心身份的拉扯，是你精神内耗的根源，但也赋予了你双倍的深度。`,
      severity: 'critical'
    });
  }
  
  // ═══════════════════════════════════════════════════════════
  // 5. 劣势功能检测 - 基于阳面/阴面得分
  // 阳面得分高 = 健康整合，阴面得分高 = 压力态
  // ═══════════════════════════════════════════════════════════
  const inferiorFunc = standardStack[3]; // 第4功能是劣势
  const inferiorLightScore = getLightSideScore(rawData, inferiorFunc);
  const inferiorShadowScore = getShadowSideScore(rawData, inferiorFunc);
  
  // 阈值：需要有足够的得分才触发
  const INTEGRATION_THRESHOLD = 8;
  const STRESS_THRESHOLD = 6;
  
  if (inferiorLightScore > INTEGRATION_THRESHOLD) {
    // 阳面得分高 = 健康整合
    insights.push({
      type: 'inferior_integration',
      title: `成长亮点：劣势整合 (${inferiorFunc} Integration)`,
      description: typeTexts?.inferiorIntegration || `恭喜！你的劣势功能（${inferiorFunc}）已经成功整合。这是非常罕见的人格成长成就。`,
      severity: 'positive'
    });
  } else if (inferiorShadowScore > STRESS_THRESHOLD) {
    // 阴面得分高 = 压力态
    insights.push({
      type: 'grip',
      title: `危局警报：暗夜逆流 (The Grip)`,
      description: typeTexts?.gripDescription || `你的灵魂正处于"颠倒"状态。平日里被你忽视的劣势功能（${inferiorFunc}）正在掌权。这并非堕落，而是灵魂在尖叫，要求你正视那些被忽视的需求。`,
      severity: 'critical'
    });
  }
  
  // ═══════════════════════════════════════════════════════════
  // 6. 盲点功能检测 - 基于阳面/阴面得分
  // ═══════════════════════════════════════════════════════════
  const blindspotFunc = standardStack[6]; // 第7功能是盲点
  const blindspotLightScore = getLightSideScore(rawData, blindspotFunc);
  const blindspotShadowScore = getShadowSideScore(rawData, blindspotFunc);
  
  if (blindspotLightScore > INTEGRATION_THRESHOLD) {
    // 阳面得分高 = 盲点觉醒（正面）
    insights.push({
      type: 'blindspot_integration',
      title: `成长亮点：盲点觉醒 (${blindspotFunc} Awakening)`,
      description: typeTexts?.blindspotIntegration || `你的盲点功能（${blindspotFunc}）已经被成功点亮。这极其罕见，说明你经历过特殊的成长历程。`,
      severity: 'positive'
    });
  } else if (blindspotShadowScore > STRESS_THRESHOLD) {
    // 阴面得分高 = 盲点过载（负面）
    const awakeningText = typeTexts?.blindspotAwakening?.[blindspotFunc];
    insights.push({
      type: 'blindspot',
      title: `失衡警报：盲点过载 (${blindspotFunc} Overload)`,
      description: awakeningText || `你的盲点功能（${blindspotFunc}）在阴面异常活跃，这可能导致认知失调和决策困难。`,
      severity: 'warning'
    });
  }
  
  // ═══════════════════════════════════════════════════════════
  // 7. 批评家功能检测 - 基于阳面/阴面得分
  // ═══════════════════════════════════════════════════════════
  const criticFunc = standardStack[5]; // 第6功能是批评家
  const criticLightScore = getLightSideScore(rawData, criticFunc);
  const criticShadowScore = getShadowSideScore(rawData, criticFunc);
  
  if (criticLightScore > INTEGRATION_THRESHOLD) {
    // 阳面得分高 = 判官觉醒（正面）
    insights.push({
      type: 'critic_integration',
      title: `成长亮点：判官觉醒 (${criticFunc} Mastery)`,
      description: typeTexts?.criticIntegration || `你成功觉醒了内在的判官功能（${criticFunc}）。这让你拥有了强大的自我觉察能力。`,
      severity: 'positive'
    });
  } else if (criticShadowScore > STRESS_THRESHOLD) {
    // 阴面得分高 = 判官重压（负面）
    insights.push({
      type: 'critic',
      title: `内耗警报：内在判官 (The Harsh Judge)`,
      description: typeTexts?.criticDescription || `你的第六功能（${criticFunc}）异常活跃，化身为一个冷酷的审判者。这种过度的自我攻击正在消耗你的生命力。请记住：对自己慈悲，也是一种修行。`,
      severity: 'warning'
    });
  }
  
  // ═══════════════════════════════════════════════════════════
  // 8. 恶魔功能检测 - 基于阳面/阴面得分
  // ═══════════════════════════════════════════════════════════
  const demonFunc = standardStack[7]; // 第8功能是恶魔
  const demonLightScore = getLightSideScore(rawData, demonFunc);
  const demonShadowScore = getShadowSideScore(rawData, demonFunc);
  
  if (demonLightScore > INTEGRATION_THRESHOLD) {
    // 阳面得分高 = 恶魔驯化（正面）
    insights.push({
      type: 'demon_integration',
      title: `成长亮点：恶魔驯化 (${demonFunc} Tamed)`,
      description: typeTexts?.demonIntegration || `你成功驯化了内心深处的恶魔（${demonFunc}）。这股力量已经成为你涅槃重生的燃料。`,
      severity: 'positive'
    });
  } else if (demonShadowScore > STRESS_THRESHOLD) {
    // 阴面得分高 = 恶魔附体（负面）
    insights.push({
      type: 'demon',
      title: `业力警报：虚无之火 (The Demonic Fire)`,
      description: typeTexts?.demonDescription || `你心灵最深处的恶魔（${demonFunc}）已经苏醒。这股力量虽然危险，但若能善用，它将是你涅槃重生的燃料。`,
      severity: 'critical'
    });
  }
  
  // ═══════════════════════════════════════════════════════════
  // 8. 独行者/躁动者检测 (The Energy Imbalance)
  // 前三位高分功能全是内倾或全是外倾
  // ═══════════════════════════════════════════════════════════
  const topThreeFuncs: CognitiveFunction[] = [];
  for (let i = 0; i < 3; i++) {
    const slot = userSlots[i];
    if (slot?.function) {
      topThreeFuncs.push(slot.function);
    }
  }
  
  if (topThreeFuncs.length === 3) {
    const allIntroverted = topThreeFuncs.every(f => isIntrovertedFunc(f));
    const allExtroverted = topThreeFuncs.every(f => !isIntrovertedFunc(f));
    
    if (allIntroverted) {
      insights.push({
        type: 'hermit',
        title: `状态警报：深海孤岛 (The Hermit)`,
        description: `检测到你的核心能量完全向内坍缩。你构建了一个庞大而精密的内心世界，却切断了通往外部现实的桥梁。虽然这带来了极致的深度，但也让你面临"孤芳自赏"甚至"现实解离"的风险。你需要一个锚点，将你拉回人间。`,
        severity: 'warning'
      });
    } else if (allExtroverted) {
      insights.push({
        type: 'manic',
        title: `状态警报：狂奔不止 (The Manic)`,
        description: `检测到你的核心能量完全向外发散。你活在一个永不停歇的外部世界中，但却切断了通往内心深处的道路。虽然这带来了极致的活力，但也让你面临"内在空虚"甚至"身份迷失"的风险。你需要一个静室，让灵魂喘息。`,
        severity: 'warning'
      });
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // 9. 判准失衡检测 (The Judgment/Perception Tilt)
  // 前三位全是判断功能或全是感知功能
  // ═══════════════════════════════════════════════════════════
  if (topThreeFuncs.length === 3) {
    const allJudging = topThreeFuncs.every(f => isJudgingFunc(f));
    const allPerceiving = topThreeFuncs.every(f => isPerceivingFunc(f));
    
    if (allJudging) {
      insights.push({
        type: 'gavel',
        title: `认知警报：理性的囚笼 (The Gavel)`,
        description: `你的大脑充满了"应该如何"的判断，却关闭了"究竟如何"的感知通道。你忙于下结论、定规则、分对错，却忘了先睁开眼睛看世界。这让你变得果断，但也可能让你陷入傲慢与偏见。`,
        severity: 'warning'
      });
    } else if (allPerceiving) {
      insights.push({
        type: 'wanderer',
        title: `认知警报：漂泊的灵魂 (The Wanderer)`,
        description: `你的大脑不断在搜集信息和探索可能性，却迟迟无法做出决定。你沉迷于"还有什么选项"的无限游戏中，却忘了有时候需要停下来做个选择。这让你保持开放，但也可能让你陷入优柔寡断和错失良机。`,
        severity: 'warning'
      });
    }
  }
  
  return insights;
};

// 人格描述文案（预留，用于未来扩展）
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const PERSONALITY_DESCRIPTIONS: { [key in MBTIType]: string } = {
  'INFJ': '预言家·洞察未来的理想主义者',
  'INFP': '治愈者·寻找意义的理想主义者',
  'INTJ': '建筑师·独立思考的战略家',
  'INTP': '逻辑学家·创新思辨的理论家',
  'ENFJ': '教导者·富有魅力的领袖',
  'ENFP': '倡导者·充满热情的激励者',
  'ENTJ': '指挥官·果断高效的领导者',
  'ENTP': '辩论家·机智创新的挑战者',
  'ISFJ': '守护者·温暖体贴的支持者',
  'ISFP': '探险家·灵活自由的艺术家',
  'ISTJ': '检查员·务实可靠的管理者',
  'ISTP': '工匠·冷静理性的实践者',
  'ESFJ': '执政官·热心友善的组织者',
  'ESFP': '表演者·活力四射的娱乐家',
  'ESTJ': '总经理·高效务实的执行者',
  'ESTP': '企业家·大胆冒险的实干家',
};

// 结果页底部操作区：保存结果、分享结果、重新测试
function MbtiResultActions({
  result,
  onRestart,
  isStandaloneReport,
  onStandaloneReturn,
}: {
  result: TestResult;
  onRestart: () => void;
  isStandaloneReport?: boolean;
  onStandaloneReturn?: () => void;
}) {
  const handleRestart = isStandaloneReport ? (onStandaloneReturn ?? (() => { window.location.href = '/'; })) : onRestart;
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [shareCopied, setShareCopied] = useState(false);

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      const res = await fetch('/api/records/mbti', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          type: result.type,
          function_scores: result.functionScores,
          // 新增数据
          user_slots: result.userSlots,
          function_strengths: result.functionStrengths,
          ideal_strengths: result.idealStrengths,
          insights: result.insights,
          fit_score: result.score,
          shadow_type: result.shadowType,
        }),
      });
      if (res.ok) setSaveStatus('saved');
      else setSaveStatus('error');
    } catch {
      setSaveStatus('error');
    }
  };

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
    } catch {
      setShareCopied(false);
    }
  };

  return (
    <div className="space-y-3">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.85 }}
        className="flex gap-3"
      >
        <button
          type="button"
          onClick={handleSave}
          disabled={saveStatus === 'saving'}
          className="flex-1 py-3.5 rounded-xl border border-stone-200 bg-white/60 hover:bg-white text-stone-700 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60 font-sans text-sm"
        >
          <Save className="w-4 h-4" />
          {saveStatus === 'saving' ? '保存中…' : saveStatus === 'saved' ? '已保存' : saveStatus === 'error' ? '保存失败' : '保存结果'}
        </button>
        <button
          type="button"
          onClick={handleShare}
          className="flex-1 py-3.5 rounded-xl border border-stone-200 bg-white/60 hover:bg-white text-stone-700 transition-all duration-200 flex items-center justify-center gap-2 font-sans text-sm"
        >
          <Share2 className="w-4 h-4" />
          {shareCopied ? '已复制链接' : '分享结果'}
        </button>
      </motion.div>
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
        onClick={handleRestart}
        className="w-full py-4 bg-white/60 hover:bg-white border border-stone-200 text-stone-700 rounded-xl transition-all duration-300 hover:shadow-md"
      >
        <span className="text-sm tracking-wider">{isStandaloneReport ? '返回首页' : '重新测试'}</span>
      </motion.button>
    </div>
  );
}

export const MbtiTestView: React.FC<{ initialResult?: TestResult; onStandaloneReturn?: () => void }> = ({ initialResult, onStandaloneReturn }) => {
  const [testStatus, setTestStatus] = useState<TestStatus>(initialResult ? 'result' : 'intro');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<UserAnswer[]>([]);
  const [result, setResult] = useState<TestResult | null>(initialResult ?? null);

  // 随机化题目和选项（只在开始测试时初始化一次）
  const [shuffledQuestions, setShuffledQuestions] = useState<Question[]>([]);

  const startTest = () => {
    // 随机打乱题目
    const questions = questionsData as Question[];
    const shuffled = shuffleArray(questions).map(q => ({
      ...q,
      options: shuffleArray(q.options) // 同时打乱选项
    }));
    setShuffledQuestions(shuffled);
    setCurrentQuestionIndex(0);
    setUserAnswers([]);
    setTestStatus('testing');
  };

  // 当前题目
  const currentQuestion = shuffledQuestions[currentQuestionIndex];

  // 当前题目的权重分配
  const currentWeights = useMemo(() => {
    const answer = userAnswers.find(a => a.questionId === currentQuestion?.id);
    return answer?.weights || {};
  }, [userAnswers, currentQuestion]);

  // 计算总共分配的分数
  const totalAllocated = useMemo(() => {
    return Object.values(currentWeights).reduce((sum, w) => sum + w, 0);
  }, [currentWeights]);

  // 是否可以进入下一题：至少分配了1分即可继续
  // 注意：现在是任意点数分配模式
  const canProceed = totalAllocated >= 1;

  // 更新当前题目的某个选项的权重（支持直接设置，无上限）
  const updateWeight = (optionId: string, newWeight: number) => {
    // 确保权重不为负数，上限设为10（单个选项）
    newWeight = Math.max(0, Math.min(10, newWeight));

    const newWeights = { ...currentWeights, [optionId]: newWeight };
    
    // 更新答案
    setUserAnswers(prev => {
      const existing = prev.find(a => a.questionId === currentQuestion.id);
      if (existing) {
        return prev.map(a => 
          a.questionId === currentQuestion.id 
            ? { ...a, weights: newWeights }
            : a
        );
      } else {
        return [...prev, { questionId: currentQuestion.id, weights: newWeights }];
      }
    });
  };

  // 下一题
  const nextQuestion = () => {
    if (!canProceed) return;
    
    if (currentQuestionIndex < shuffledQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      // 计算结果
      calculateResult();
    }
  };

  // 上一题
  const prevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  // 计算最终结果 - 使用新的三步算法
  const calculateResult = () => {
    // ═══════════════════════════════════════════════════════════
    // Step 0: 解析用户原始数据
    // ═══════════════════════════════════════════════════════════
    const rawData = parseUserRawData(userAnswers, shuffledQuestions);
    
    // ═══════════════════════════════════════════════════════════
    // Step 1: 轴线联动修正 (The Gearing System)
    // ═══════════════════════════════════════════════════════════
    const correctedData = applyGearingSystem(rawData);
    
    // ═══════════════════════════════════════════════════════════
    // Step 2: 最佳拟合度计算 (Template Matching)
    // ═══════════════════════════════════════════════════════════
    const { type: bestFitType, fitScore } = calculateBestFitType(correctedData);
    
    // ═══════════════════════════════════════════════════════════
    // Step 3: 能量强度计算 (For Radar Chart)
    // ═══════════════════════════════════════════════════════════
    const functionStrengths = calculateFunctionStrengths(correctedData);
    // 传入用户强度，让标准线与用户实测在同一量级
    const idealStrengths = calculateIdealStrengths(bestFitType, functionStrengths);
    
    // 分配用户的功能到各个位置 (用于心灵星盘)
    const userSlots = assignUserSlots(correctedData);
    
    // 异化检测
    const insights = generateInsights(bestFitType, userSlots, correctedData);
    
    // 计算传统的八维功能得分（兼容旧版）
    const functionScores: { [key in CognitiveFunction]: number } = {} as { [key in CognitiveFunction]: number };
    COGNITIVE_FUNCTIONS.forEach(func => {
      let total = 0;
      for (let i = 0; i < 8; i++) {
        total += correctedData.slotScores[func][i] || 0;
      }
      functionScores[func] = total;
    });
    
    // 计算阴影人格
    const shadowType = calculateShadowType(bestFitType);

    setResult({ 
      type: bestFitType, 
      score: fitScore,
      shadowType,
      functionScores,
      userSlots,
      functionStrengths,
      idealStrengths,
      insights,
      fitScore
    });
    setTestStatus('result');
  };

  // 重新开始
  const restart = () => {
    setTestStatus('intro');
    setResult(null);
    setUserAnswers([]);
    setShuffledQuestions([]);
  };

  // 介绍页面
  if (testStatus === 'intro') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="space-y-5"
      >
        {/* 核心问题标题 */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-center py-6"
        >
          <h2 className="text-xl font-serif text-stone-800 mb-2">
            我们为什么仍然需要新的八维测试？
          </h2>
          <div className="flex items-center justify-center gap-2 text-xs text-stone-400">
            <div className="w-8 h-px bg-stone-300" />
            <span>三个维度的突破</span>
            <div className="w-8 h-px bg-stone-300" />
          </div>
        </motion.div>

        {/* 三个维度卡片 - 简洁版 */}
        <div className="grid md:grid-cols-3 gap-4">
          {/* 测量的维度 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-white/70 backdrop-blur-sm rounded-xl p-5 border border-stone-200/50 hover:shadow-md transition-shadow"
          >
            <div className="w-10 h-10 rounded-full bg-stone-800 flex items-center justify-center mb-4">
              <span className="text-white text-lg">↕</span>
            </div>
            <h3 className="text-base font-serif text-stone-800 mb-2">
              测量的维度
            </h3>
            <p className="text-xs text-stone-500 mb-4">The Dimension</p>
            
            <div className="bg-stone-50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-center gap-3 py-2">
                <span className="text-sm text-stone-500 tracking-wide">强弱之分</span>
                <span className="text-stone-300 text-lg">→</span>
                <span className="text-sm text-stone-800 font-semibold tracking-wide">宫位之序</span>
              </div>
              <p className="text-xs text-stone-600 leading-relaxed text-justify">
                不止于测量功能强弱，更描绘心灵宫殿中的『坐席』——何者为主导，何者为阴影。
              </p>
            </div>
          </motion.div>

          {/* 觉察的深度 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white/70 backdrop-blur-sm rounded-xl p-5 border border-stone-200/50 hover:shadow-md transition-shadow"
          >
            <div className="w-10 h-10 rounded-full bg-stone-800 flex items-center justify-center mb-4">
              <span className="text-white text-lg">◉</span>
            </div>
            <h3 className="text-base font-serif text-stone-800 mb-2">
              觉察的深度
            </h3>
            <p className="text-xs text-stone-500 mb-4">The Depth</p>
            
            <div className="bg-stone-50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-center gap-3 py-2">
                <span className="text-sm text-stone-500 tracking-wide">半像扫描</span>
                <span className="text-stone-300 text-lg">→</span>
                <span className="text-sm text-stone-800 font-semibold tracking-wide">全像透视</span>
              </div>
              <p className="text-xs text-stone-600 leading-relaxed text-justify">
                不止观阳面功能，更照亮第5至8维的幽暗角落，完成真正的心理整合。
              </p>
            </div>
          </motion.div>

          {/* 成长的路径 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-white/70 backdrop-blur-sm rounded-xl p-5 border border-stone-200/50 hover:shadow-md transition-shadow"
          >
            <div className="w-10 h-10 rounded-full bg-stone-800 flex items-center justify-center mb-4">
              <span className="text-white text-lg">✦</span>
            </div>
            <h3 className="text-base font-serif text-stone-800 mb-2">
              成长的路径
            </h3>
            <p className="text-xs text-stone-500 mb-4">The Path</p>
            
            <div className="bg-stone-50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-center gap-3 py-2">
                <span className="text-sm text-stone-500 tracking-wide">静态标签</span>
                <span className="text-stone-300 text-lg">→</span>
                <span className="text-sm text-stone-800 font-semibold tracking-wide">动态修行</span>
              </div>
              <p className="text-xs text-stone-600 leading-relaxed text-justify">
                拒绝标签化人格，性格非牢笼，而是独特的『法门』。真正的成长往往来源于我们对自己阴影人格的整合。
              </p>
            </div>
          </motion.div>
        </div>

        {/* 对比视角 - 精简展示 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-stone-50 to-stone-100/50 rounded-xl p-6 border border-stone-200/50"
        >
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-stone-500">
                <div className="w-2 h-2 rounded-full bg-stone-400" />
                <span className="text-xs tracking-wider">传统视角</span>
              </div>
              <div className="space-y-2 text-sm text-stone-600 pl-4">
                <p>• 强弱刻度的线性测量</p>
                <p>• 显意识的四大功能</p>
                <p>• 静态不变的人格标签</p>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-stone-800">
                <div className="w-2 h-2 rounded-full bg-stone-800" />
                <span className="text-xs tracking-wider font-medium">全新视角</span>
              </div>
              <div className="space-y-2 text-sm text-stone-700 pl-4 font-medium">
                <p>• 功能坐席的宫位秩序</p>
                <p>• 八维全谱的完整图景</p>
                <p>• 人生道场的修行指引</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* 八维功能 - 更紧凑的网格 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-white/60 backdrop-blur-sm rounded-xl p-5 border border-stone-200/50"
        >
          <div className="text-center mb-4">
            <span className="text-xs text-stone-500 tracking-wider">八维认知功能</span>
          </div>
          
          <div className="grid grid-cols-4 gap-2">
            {[
              { code: 'Se', name: '外向感觉' },
              { code: 'Si', name: '内向感觉' },
              { code: 'Ne', name: '外向直觉' },
              { code: 'Ni', name: '内向直觉' },
              { code: 'Te', name: '外向思考' },
              { code: 'Ti', name: '内向思考' },
              { code: 'Fe', name: '外向情感' },
              { code: 'Fi', name: '内向情感' },
            ].map((func, i) => (
              <div key={i} className="text-center p-2.5 bg-stone-50 rounded-lg hover:bg-stone-100 transition-colors">
                <div className="font-mono text-sm text-stone-800 font-medium">{func.code}</div>
                <div className="text-[10px] text-stone-500 mt-0.5">{func.name}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* 开始按钮 */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          onClick={startTest}
          className="w-full py-4 bg-stone-800 hover:bg-stone-900 text-white rounded-xl transition-all duration-300 flex items-center justify-center gap-2 group shadow-md hover:shadow-lg"
        >
          <span className="font-sans text-sm tracking-wider">开始测试</span>
          <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </motion.button>

        {/* 测试说明 */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-center space-y-2"
        >
          <p className="text-xs text-stone-600 leading-relaxed">
            测试约需 <span className="font-medium text-stone-800">15 分钟</span>。本测试包含 <span className="font-medium text-stone-800">26 道题目</span>，你需要将 <span className="font-medium text-stone-800">5 分</span>分配给最符合的选项。
          </p>
          <div className="pt-2">
            <span className="inline-block px-4 py-1.5 bg-amber-50/80 text-amber-900/90 text-xs rounded-full border border-amber-200/70 shadow-sm">
              ✓ 本测试完全免费
            </span>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  // 测试进行中
  if (testStatus === 'testing' && currentQuestion) {
    return (
      <motion.div
        key={currentQuestionIndex}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.3 }}
        className="space-y-6"
      >
        {/* 进度条 */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs text-stone-500">
            <span>问题 {currentQuestionIndex + 1} / {shuffledQuestions.length}</span>
            <div className="flex items-center gap-2">
              <span className={totalAllocated > 0 ? 'text-stone-700 font-medium' : 'text-amber-600'}>
                已分配 {totalAllocated} 分
              </span>
            </div>
          </div>
          <div className="h-1 bg-stone-200 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-stone-700"
              initial={{ width: 0 }}
              animate={{ width: `${((currentQuestionIndex + 1) / shuffledQuestions.length) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {/* 题目 */}
        <div className="bg-white/60 backdrop-blur-sm rounded-lg p-6 shadow-sm border border-stone-200/50">
          <h3 className="text-base font-serif text-stone-800 mb-6">
            {currentQuestion.question}
          </h3>

          {/* 选项列表 */}
          <div className="space-y-3">
            {currentQuestion.options.map((option) => {
              const weight = currentWeights[option.id] || 0;

              return (
                <div
                  key={option.id}
                  className={`p-4 rounded-lg border transition-all duration-200 ${
                    weight > 0 
                      ? 'border-stone-400 bg-stone-50' 
                      : 'border-stone-200 bg-white/50'
                  }`}
                >
                  {/* 选项文本 */}
                  <div className="text-sm text-stone-700 mb-3 leading-relaxed">
                    {option.text.split('**').map((part, i) => 
                      i % 2 === 1 ? <strong key={i} className="text-stone-900">{part}</strong> : part
                    )}
                  </div>

                  {/* 权重滑块 */}
                  <div className="space-y-2">
                    {/* 分数显示 */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-stone-500">分配分数</span>
                      <span className="text-base font-medium text-stone-800 tabular-nums">
                        {weight} 分
                      </span>
                    </div>
                    
                    {/* 滑块容器 */}
                    <div className="relative">
                      {/* 滑块轨道 */}
                      <div 
                        className="relative h-10 cursor-pointer group"
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const x = e.clientX - rect.left;
                          const percentage = x / rect.width;
                          const newValue = Math.round(percentage * 5);
                          
                          // 直接更新权重，无需检查总分限制
                          updateWeight(option.id, newValue);
                        }}
                      >
                        {/* 背景轨道 */}
                        <div className="absolute top-1/2 -translate-y-1/2 w-full h-2 bg-stone-200 rounded-full overflow-hidden">
                          {/* 已填充部分 */}
                          <motion.div
                            className="h-full bg-gradient-to-r from-stone-600 to-stone-700 rounded-full"
                            initial={false}
                            animate={{ width: `${(weight / 5) * 100}%` }}
                            transition={{ duration: 0.2 }}
                          />
                        </div>
                        
                        {/* 刻度点 */}
                        <div className="absolute top-1/2 -translate-y-1/2 w-full flex justify-between px-0">
                          {[0, 1, 2, 3, 4, 5].map(n => (
                            <button
                              key={n}
                              onClick={(e) => {
                                e.stopPropagation();
                                updateWeight(option.id, n);
                              }}
                              className="relative z-10 w-3 h-3 rounded-full transition-all duration-200 hover:scale-125"
                              style={{
                                backgroundColor: n <= weight ? '#57534e' : '#e7e5e4',
                                boxShadow: n === weight ? '0 0 0 3px rgba(87, 83, 78, 0.1)' : 'none',
                              }}
                            >
                              {/* 刻度数字 - 悬停时显示 */}
                              <span 
                                className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-stone-400 opacity-0 group-hover:opacity-100 transition-opacity tabular-nums"
                              >
                                {n}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    {/* 辅助说明 */}
                    <div className="flex justify-between text-[10px] text-stone-400 px-1">
                      <span>0分</span>
                      <span>5分</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 导航按钮 */}
        <div className="flex gap-3">
          <button
            onClick={prevQuestion}
            disabled={currentQuestionIndex === 0}
            className={`flex-1 py-3 rounded-lg border transition-colors ${
              currentQuestionIndex === 0
                ? 'border-stone-200 text-stone-300 cursor-not-allowed'
                : 'border-stone-300 text-stone-700 hover:bg-stone-50'
            }`}
          >
            <span className="text-sm">上一题</span>
          </button>

          <button
            onClick={nextQuestion}
            disabled={!canProceed}
            className={`flex-1 py-3 rounded-lg transition-colors flex items-center justify-center gap-2 ${
              canProceed
                ? 'bg-stone-700 hover:bg-stone-800 text-white'
                : 'bg-stone-200 text-stone-400 cursor-not-allowed'
            }`}
          >
            <span className="text-sm">
              {currentQuestionIndex < shuffledQuestions.length - 1 ? '下一题' : '查看结果'}
            </span>
            {canProceed && <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </motion.div>
    );
  }

  // 结果页面
  if (testStatus === 'result' && result) {
    // 获取详细数据
    const detailData = getMBTIData(result.type);

    // 如果没有详细数据，展示备用界面
    if (!detailData) {
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-8"
        >
          <div className="bg-white/60 backdrop-blur-sm rounded-lg p-10 shadow-sm border border-stone-200/50 text-center">
            <div className="text-6xl font-bold text-stone-900 tracking-wider mb-3">
              {result.type}
            </div>
            <p className="text-stone-600">暂无详细数据</p>
          </div>
          <button
            onClick={restart}
            className="w-full py-4 border border-stone-300 hover:bg-stone-50 text-stone-700 rounded-lg transition-colors"
          >
            <span className="font-sans text-sm tracking-wider">重新测试</span>
          </button>
        </motion.div>
      );
    }

    // 展开的功能卡片状态
    const FunctionCard = ({ func, index }: { func: MBTIFunction; index: number }) => {
      const [isExpanded, setIsExpanded] = useState(false);
      const logicParagraphs = formatTextToParagraphs(func.logic, 120);
      const lessonParagraphs = formatTextToParagraphs(func.lesson, 100);
      
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
        >
          <div 
            className={`
              relative overflow-hidden rounded-xl transition-all duration-300 cursor-pointer
              ${isExpanded 
                ? 'bg-stone-800 text-white shadow-xl' 
                : 'bg-white/80 hover:bg-white hover:shadow-md border border-stone-200/60'
              }
            `}
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {/* 卡片头部 */}
            <div className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`
                    text-xs font-mono px-2.5 py-1 rounded-full
                    ${isExpanded ? 'bg-white/20 text-white/90' : 'bg-stone-100 text-stone-600'}
                  `}>
                    {func.pos}
                  </span>
                  <h4 className={`text-lg font-serif ${isExpanded ? 'text-white' : 'text-stone-800'}`}>
                    {func.title}
                  </h4>
                </div>
                <motion.div
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className={`w-5 h-5 ${isExpanded ? 'text-white/60' : 'text-stone-400'}`} />
                </motion.div>
              </div>
            </div>
            
            {/* 展开内容 */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-6 space-y-5">
                    {/* 底层逻辑 */}
                    <div className="space-y-3">
                      <div className="text-xs text-stone-400 tracking-wider uppercase">底层逻辑</div>
                      <div className="space-y-2.5">
                        {logicParagraphs.map((p, i) => (
                          <p key={i} className="text-sm text-white/85 leading-relaxed">
                            {p}
                          </p>
                        ))}
                      </div>
                    </div>
                    
                    {/* 分隔线 */}
                    <div className="h-px bg-white/10" />
                    
                    {/* 炼心课题 */}
                    <div className="space-y-3">
                      <div className="text-xs text-amber-400/80 tracking-wider uppercase">炼心课题</div>
                      <div className="space-y-2.5 pl-4 border-l-2 border-amber-500/30">
                        {lessonParagraphs.map((p, i) => (
                          <p key={i} className="text-sm text-white/80 leading-relaxed italic">
                            {p}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      );
    };

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="space-y-6"
      >
        {/* ═══════════════════════════════════════════════════════════
            1. 顶部 Hero 区域 - 大气的名片式设计
        ═══════════════════════════════════════════════════════════ */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative rounded-2xl overflow-hidden"
        >
          {/* 渐变背景 */}
          <div className="absolute inset-0 bg-gradient-to-br from-stone-800 via-stone-900 to-stone-950" />
          
          {/* 装饰性图案 */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-radial from-white/20 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-radial from-white/10 to-transparent rounded-full translate-y-1/2 -translate-x-1/2" />
          </div>
          
          {/* 背景水印 ID */}
          <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
            <div className="text-[16rem] font-black text-white/[0.03] tracking-widest select-none">
              {detailData.id}
            </div>
          </div>

          <div className="relative z-10 px-8 py-14 text-center">
            {/* 来源注解 */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mb-8"
            >
              <span className="inline-block px-4 py-1.5 bg-white/10 backdrop-blur-sm rounded-full text-xs text-stone-300 tracking-wide">
                {detailData.origin}
              </span>
            </motion.div>
            
            {/* 主标题 */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4, type: "spring", stiffness: 200 }}
            >
              <h1 className="text-5xl md:text-7xl font-bold text-white tracking-wider mb-4">
                {detailData.name}
              </h1>
              <div className="text-2xl md:text-3xl font-mono text-stone-400 tracking-[0.3em] mb-6">
                {detailData.id}
              </div>
            </motion.div>
            
            {/* Slogan */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-base md:text-lg text-stone-300 font-serif leading-relaxed max-w-xl mx-auto"
            >
              {detailData.slogan}
            </motion.p>
          </div>
        </motion.div>

        {/* ═══════════════════════════════════════════════════════════
            2. 灵魂侧写卡片
        ═══════════════════════════════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/70 backdrop-blur-sm rounded-xl p-6 md:p-8 shadow-sm border border-stone-200/50"
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-stone-600 to-stone-800 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-serif text-stone-800">修行指引</h3>
              <p className="text-xs text-stone-500">灵魂侧写与成长方向</p>
            </div>
          </div>
          
          <div className="space-y-4">
            {formatTextToParagraphs(detailData.guide, 140).map((p, i) => (
              <p key={i} className="text-sm text-stone-700 leading-[1.8]">
                {p}
              </p>
            ))}
          </div>
        </motion.div>

        {/* ═══════════════════════════════════════════════════════════
            3. 深度侧写 - 特殊样式
        ═══════════════════════════════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="relative bg-gradient-to-br from-stone-50 to-stone-100/80 rounded-xl p-6 md:p-8 border border-stone-200/50"
        >
          <div className="absolute top-6 left-6 text-6xl text-stone-200 font-serif leading-none select-none">&ldquo;</div>
          
          <div className="relative z-10 pl-8 md:pl-12">
            <h3 className="text-sm text-stone-500 tracking-wider uppercase mb-5">深度侧写</h3>
            
            <div className="space-y-4">
              {formatTextToParagraphs(detailData.deep_profile, 130).map((p, i) => (
                <p key={i} className="text-sm text-stone-700 leading-[1.85] first:text-base first:text-stone-800">
                  {p}
                </p>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ═══════════════════════════════════════════════════════════
            4. 光影双面 - 天赋与阴影
        ═══════════════════════════════════════════════════════════ */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* 天赋优势 */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-gradient-to-br from-emerald-50/90 to-teal-50/80 rounded-xl p-6 border border-emerald-200/50"
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
                <Sun className="w-4 h-4 text-white" />
              </div>
              <h4 className="text-base font-serif text-emerald-900">天赋优势</h4>
            </div>
            
            <div className="space-y-3">
              {formatTextToParagraphs(detailData.strengths, 100).map((p, i) => (
                <p key={i} className="text-sm text-emerald-800 leading-relaxed">
                  {p}
                </p>
              ))}
            </div>
          </motion.div>

          {/* 阴影盲区 */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-gradient-to-br from-amber-50/90 to-orange-50/80 rounded-xl p-6 border border-amber-200/50"
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-lg bg-amber-600 flex items-center justify-center">
                <Moon className="w-4 h-4 text-white" />
              </div>
              <h4 className="text-base font-serif text-amber-900">阴影盲区</h4>
            </div>
            
            <div className="space-y-3">
              {formatTextToParagraphs(detailData.weaknesses, 100).map((p, i) => (
                <p key={i} className="text-sm text-amber-800 leading-relaxed">
                  {p}
                </p>
              ))}
            </div>
          </motion.div>
        </div>

        {/* 阴影机制 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="bg-stone-900/95 rounded-xl p-6 text-white"
        >
          <div className="flex items-center gap-3 mb-4">
            <Zap className="w-5 h-5 text-amber-400" />
            <h4 className="text-sm text-stone-300 tracking-wider">阴影触发机制</h4>
          </div>
          <div className="space-y-3 pl-8">
            {formatTextToParagraphs(detailData.shadow, 120).map((p, i) => (
              <p key={i} className="text-sm text-stone-300 leading-relaxed">
                {p}
              </p>
            ))}
          </div>
        </motion.div>

        {/* ═══════════════════════════════════════════════════════════
            5. 能量雷达图 (Comparison Radar) - 双层对比
        ═══════════════════════════════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white/70 backdrop-blur-sm rounded-xl p-6 md:p-8 shadow-sm border border-stone-200/50"
        >
          <h3 className="text-center text-lg font-serif text-stone-800 mb-2">
            能量图谱
          </h3>
          <p className="text-center text-xs text-stone-500 mb-2">
            你的实测强度 vs 标准{result.type}的理论强度
          </p>
          <div className="flex items-center justify-center gap-6 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-stone-600" />
              <span className="text-xs text-stone-600">你的实测</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full border-2 border-amber-500 bg-transparent" />
              <span className="text-xs text-stone-500">标准{result.type}</span>
            </div>
          </div>
          
          <div className="w-full h-72 md:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={COGNITIVE_FUNCTIONS.map(func => ({
                function: func,
                name: FUNCTION_NAMES[func],
                userStrength: result.functionStrengths?.[func] || 0,
                idealStrength: result.idealStrengths?.[func] || 0,
              }))}>
                <PolarGrid stroke="#d6d3d1" strokeWidth={1} />
                <PolarAngleAxis 
                  dataKey="function" 
                  tick={{ fill: '#57534e', fontSize: 13, fontWeight: 500 }}
                />
                <PolarRadiusAxis 
                  angle={90} 
                  domain={[0, 'auto']}
                  tick={{ fill: '#a8a29e', fontSize: 10 }}
                />
                {/* 用户实测强度 - 实线区域 */}
                <Radar 
                  name="你的实测" 
                  dataKey="userStrength" 
                  stroke="#57534e" 
                  fill="#78716c" 
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
                {/* 标准类型理论强度 - 虚线轮廓 */}
                <Radar 
                  name={`标准${result.type}`}
                  dataKey="idealStrength" 
                  stroke="#d97706" 
                  fill="transparent" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          
          <p className="text-center text-xs text-stone-400 mt-4">
            拟合度：{Math.round(result.fitScore || 0)}%
          </p>
        </motion.div>

        {/* ═══════════════════════════════════════════════════════════
            5.5 心灵星盘 / 曼陀罗 (Soul Mandala)
        ═══════════════════════════════════════════════════════════ */}
        {result.userSlots && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65 }}
            className="bg-white/70 backdrop-blur-sm rounded-xl p-6 md:p-8 shadow-sm border border-stone-200/50"
          >
            <h3 className="text-center text-lg font-serif text-stone-800 mb-2">
              心灵星盘
            </h3>
            <p className="text-center text-xs text-stone-500 mb-6">
              你在每个心理位置上的主导功能
            </p>
            
            {/* 八宫格布局 */}
            <div className="grid grid-cols-4 gap-3 max-w-lg mx-auto">
              {SLOT_NAMES.map((slotName, index) => {
                const slot = result.userSlots?.[index];
                const isLight = index < 4; // 前四个是光明面
                const standardFunc = MBTI_FUNCTION_STACKS[result.type][index];
                const isDeviation = slot?.function !== standardFunc;
                
                return (
                  <motion.div
                    key={slotName}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.65 + index * 0.05 }}
                    className={`
                      relative p-3 rounded-xl text-center transition-all
                      ${isLight 
                        ? 'bg-stone-50 border border-stone-200' 
                        : 'bg-stone-100/50 border border-stone-200/50'
                      }
                      ${slot?.hasConflict ? 'ring-2 ring-amber-400/50' : ''}
                      ${isDeviation && !slot?.hasConflict ? 'ring-1 ring-stone-300' : ''}
                    `}
                  >
                    {/* 位置名称 */}
                    <div className={`text-[10px] tracking-wider mb-1 ${isLight ? 'text-stone-500' : 'text-stone-400'}`}>
                      {index + 1}. {slotName === 'Hero' ? '主导' : 
                        slotName === 'Parent' ? '辅助' :
                        slotName === 'Child' ? '儿童' :
                        slotName === 'Inferior' ? '劣势' :
                        slotName === 'Nemesis' ? '对立' :
                        slotName === 'Critic' ? '批评' :
                        slotName === 'Trickster' ? '盲点' : '恶魔'}
                    </div>
                    
                    {/* 功能显示 */}
                    <div className="flex items-center justify-center gap-1">
                      <span className={`text-lg font-mono font-bold ${isLight ? 'text-stone-800' : 'text-stone-600'}`}>
                        {slot?.function || '-'}
                      </span>
                      
                      {/* 冲突标记 */}
                      {slot?.hasConflict && slot.conflictWith && (
                        <>
                          <span className="text-amber-500 text-xs">⚡</span>
                          <span className={`text-lg font-mono font-bold ${isLight ? 'text-stone-800' : 'text-stone-600'}`}>
                            {slot.conflictWith}
                          </span>
                        </>
                      )}
                    </div>
                    
                    {/* 得分 */}
                    <div className="text-[10px] text-stone-400 mt-1">
                      {slot?.score?.toFixed(1) || '0'}分
                    </div>
                    
                    {/* 偏离标准标记 */}
                    {isDeviation && !slot?.hasConflict && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-stone-400 rounded-full flex items-center justify-center">
                        <span className="text-white text-[8px]">!</span>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
            
            {/* 图例说明 */}
            <div className="flex items-center justify-center gap-4 mt-6 text-xs text-stone-500">
              <div className="flex items-center gap-1">
                <span className="text-amber-500">⚡</span>
                <span>核心冲突</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-stone-400 rounded-full flex items-center justify-center">
                  <span className="text-white text-[6px]">!</span>
                </div>
                <span>偏离标准</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            5.6 异化检测与提醒 (Mutation Alerts)
        ═══════════════════════════════════════════════════════════ */}
        {result.insights && result.insights.length > 0 && (() => {
          // 分离正面和负面警报
          const positiveInsights = result.insights.filter(i => i.severity === 'positive');
          const negativeInsights = result.insights.filter(i => i.severity !== 'positive');
          
          return (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="space-y-6"
            >
              {/* 成长亮点区域 */}
              {positiveInsights.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-3 mb-4">
                    <div className="h-px flex-1 bg-emerald-200" />
                    <h3 className="text-sm text-emerald-600 tracking-wider px-4 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-500" />
                      成长亮点
                    </h3>
                    <div className="h-px flex-1 bg-emerald-200" />
                  </div>
                  
                  {positiveInsights.map((insight, index) => (
                    <motion.div
                      key={`positive-${index}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.7 + index * 0.1 }}
                      className="rounded-xl p-5 border transition-all bg-emerald-50/80 border-emerald-200/60"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 bg-emerald-500">
                          <Sparkles className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium mb-2 text-emerald-900">
                            🌟 {insight.title}
                          </h4>
                          <p className="text-sm leading-relaxed text-emerald-800/80">
                            {insight.description}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
              
              {/* 潜在风险区域 */}
              {negativeInsights.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-3 mb-4">
                    <div className="h-px flex-1 bg-stone-200" />
                    <h3 className="text-sm text-stone-500 tracking-wider px-4 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      潜在风险
                    </h3>
                    <div className="h-px flex-1 bg-stone-200" />
                  </div>
                  
                  {negativeInsights.map((insight, index) => (
                    <motion.div
                      key={`negative-${index}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.7 + positiveInsights.length * 0.1 + index * 0.1 }}
                      className={`
                        rounded-xl p-5 border transition-all
                        ${insight.severity === 'critical' 
                          ? 'bg-red-50/80 border-red-200/60' 
                          : insight.severity === 'warning'
                          ? 'bg-amber-50/80 border-amber-200/60'
                          : 'bg-stone-50/80 border-stone-200/60'
                        }
                      `}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`
                          mt-0.5 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0
                          ${insight.severity === 'critical' 
                            ? 'bg-red-500' 
                            : insight.severity === 'warning'
                            ? 'bg-amber-500'
                            : 'bg-stone-500'
                          }
                        `}>
                          <AlertTriangle className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className={`
                            text-sm font-medium mb-2
                            ${insight.severity === 'critical' 
                              ? 'text-red-900' 
                              : insight.severity === 'warning'
                              ? 'text-amber-900'
                              : 'text-stone-800'
                            }
                          `}>
                            ⚠️ {insight.title}
                          </h4>
                          <p className={`
                            text-sm leading-relaxed
                            ${insight.severity === 'critical' 
                              ? 'text-red-800/80' 
                              : insight.severity === 'warning'
                              ? 'text-amber-800/80'
                              : 'text-stone-600'
                            }
                          `}>
                            {insight.description}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          );
        })()}

        {/* ═══════════════════════════════════════════════════════════
            6. 八维功能卡片 - 可展开设计
        ═══════════════════════════════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <div className="flex items-center justify-center gap-3 mb-5">
            <div className="h-px flex-1 bg-stone-200" />
            <h3 className="text-sm text-stone-500 tracking-wider px-4">八维认知功能详解</h3>
            <div className="h-px flex-1 bg-stone-200" />
          </div>
          
          <p className="text-center text-xs text-stone-400 mb-6">点击卡片展开详细解析</p>
          
          <div className="grid gap-3">
            {detailData.functions.map((func, index) => (
              <FunctionCard key={index} func={func} index={index} />
            ))}
          </div>
        </motion.div>

        {/* ═══════════════════════════════════════════════════════════
            7. 证道箴言 - Footer
        ═══════════════════════════════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="relative rounded-xl overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-stone-700 via-stone-800 to-stone-900" />
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOCAxOC04LjA1OSAxOC0xOC04LjA1OS0xOC0xOC0xOHptMCAzMmMtNy43MzIgMC0xNC02LjI2OC0xNC0xNHM2LjI2OC0xNCAxNCAxNCAxNCA2LjI2OCAxNCAxNC02LjI2OCAxNC0xNCAxNHoiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjAyIi8+PC9nPjwvc3ZnPg==')] opacity-30" />
          
          <div className="relative z-10 px-8 py-10 text-center">
            <div className="inline-block px-4 py-1 bg-white/10 rounded-full text-xs text-stone-400 tracking-wider mb-5">
              证道箴言
            </div>
            
            <div className="max-w-2xl mx-auto space-y-4">
              {formatTextToParagraphs(detailData.advice, 80).map((p, i) => (
                <p key={i} className="text-base md:text-lg text-white/90 leading-relaxed font-serif">
                  {p}
                </p>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ═══════════════════════════════════════════════════════════
            保存结果 / 分享结果 / 重新测试
        ═══════════════════════════════════════════════════════════ */}
        <MbtiResultActions
          result={result}
          onRestart={restart}
          isStandaloneReport={!!initialResult}
          onStandaloneReturn={onStandaloneReturn}
        />
      </motion.div>
    );
  }

  return null;
};
