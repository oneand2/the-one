'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronDown, Sparkles, Sun, Moon, Zap, Save, Share2 } from 'lucide-react';
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

// 人格描述文案
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
  const [showOverLimitWarning, setShowOverLimitWarning] = useState(false);

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

  // 剩余可用分数
  const remainingPoints = 10 - totalAllocated;

  // 是否可以进入下一题
  const canProceed = totalAllocated === 10;

  const triggerOverLimitWarning = () => {
    setShowOverLimitWarning(true);
    setTimeout(() => setShowOverLimitWarning(false), 2000);
  };

  // 更新当前题目的某个选项的权重（支持直接设置）
  const updateWeight = (optionId: string, newWeight: number) => {
    // 确保权重在0-5之间（每个选项最多5分）
    newWeight = Math.max(0, Math.min(5, newWeight));
    
    // 检查总分是否超过10
    const otherWeightsSum = Object.entries(currentWeights)
      .filter(([id]) => id !== optionId)
      .reduce((sum, [, w]) => sum + w, 0);
    
    if (otherWeightsSum + newWeight > 10) {
      triggerOverLimitWarning();
      return; // 不允许超过10分
    }

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

  // 计算最终结果
  const calculateResult = () => {
    // 1. 计算 MBTI 类型得分
    const mbtiScores: { [key in MBTIType]: number } = Object.fromEntries(
      MBTI_TYPES.map(type => [type, 0])
    ) as { [key in MBTIType]: number };

    // 2. 计算八维认知功能得分
    const functionScores: { [key in CognitiveFunction]: number } = Object.fromEntries(
      COGNITIVE_FUNCTIONS.map(func => [func, 0])
    ) as { [key in CognitiveFunction]: number };

    // 遍历所有答案
    userAnswers.forEach(answer => {
      const question = shuffledQuestions.find(q => q.id === answer.questionId);
      if (!question) return;

      // 累加认知功能得分（根据题目的 category）
      const category = question.category as CognitiveFunction;
      const categoryScore = Object.values(answer.weights).reduce((sum, w) => sum + w, 0);
      if (COGNITIVE_FUNCTIONS.includes(category)) {
        functionScores[category] += categoryScore;
      }

      // 遍历每个选项的权重，计算 MBTI 得分
      Object.entries(answer.weights).forEach(([optionId, weight]) => {
        if (weight === 0) return;
        
        const option = question.options.find(o => o.id === optionId);
        if (!option) return;

        // 给该选项的所有target_types增加分数
        option.target_types.forEach(type => {
          mbtiScores[type] += weight;
        });
      });
    });

    // 找出得分最高的类型
    let maxScore = 0;
    let maxType: MBTIType = 'INFJ';
    
    MBTI_TYPES.forEach(type => {
      if (mbtiScores[type] > maxScore) {
        maxScore = mbtiScores[type];
        maxType = type;
      }
    });

    // 计算阴影人格
    const shadowType = calculateShadowType(maxType);

    setResult({ 
      type: maxType, 
      score: maxScore,
      shadowType,
      functionScores
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
                不止于测量功能强弱，更描绘心灵宫殿中的"坐席"——何者为主导，何者为阴影。
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
                拒绝标签化人格，性格非牢笼，而是独特的"法门"。真正的成长往往来源于我们对自己阴影人格的整合。
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
        <AnimatePresence>
          {showOverLimitWarning && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4"
              onClick={() => setShowOverLimitWarning(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: 4 }}
                transition={{ duration: 0.2 }}
                className="w-full max-w-xs rounded-2xl border border-stone-200 bg-white/90 p-4 text-center shadow-lg backdrop-blur"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="text-sm text-stone-700">一共只有10分哦，请合理分配</p>
                <button
                  type="button"
                  onClick={() => setShowOverLimitWarning(false)}
                  className="mt-3 inline-flex items-center justify-center rounded-full border border-stone-200 bg-white/70 px-4 py-1.5 text-xs text-stone-600 hover:bg-white"
                >
                  知道了
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* 进度条 */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs text-stone-500">
            <span>问题 {currentQuestionIndex + 1} / {shuffledQuestions.length}</span>
            <div className="flex items-center gap-2">
              <span className={remainingPoints === 0 ? 'text-stone-700 font-medium' : remainingPoints < 0 ? 'text-red-600 font-medium' : 'text-amber-600'}>
                剩余 {remainingPoints} 分
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
                          
                          // 检查是否可以设置这个值
                          const otherWeightsSum = Object.entries(currentWeights)
                            .filter(([id]) => id !== option.id)
                            .reduce((sum, [, w]) => sum + w, 0);
                          
                          if (otherWeightsSum + newValue <= 10) {
                            updateWeight(option.id, newValue);
                          } else {
                            triggerOverLimitWarning();
                          }
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
                                const otherWeightsSum = Object.entries(currentWeights)
                                  .filter(([id]) => id !== option.id)
                                  .reduce((sum, [, w]) => sum + w, 0);
                                
                                if (otherWeightsSum + n <= 10) {
                                  updateWeight(option.id, n);
                                } else {
                                  triggerOverLimitWarning();
                                }
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
    
    // 准备雷达图数据
    const radarData = COGNITIVE_FUNCTIONS.map(func => ({
      function: func,
      score: result.functionScores[func],
      fullMark: Math.max(...Object.values(result.functionScores)) * 1.2
    }));

    // 找出最高的三个认知功能
    const topFunctions = Object.entries(result.functionScores)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);

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
          <div className="absolute top-6 left-6 text-6xl text-stone-200 font-serif leading-none select-none">"</div>
          
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
            5. 认知功能雷达图
        ═══════════════════════════════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white/70 backdrop-blur-sm rounded-xl p-6 md:p-8 shadow-sm border border-stone-200/50"
        >
          <h3 className="text-center text-lg font-serif text-stone-800 mb-2">
            认知功能图谱
          </h3>
          <p className="text-center text-xs text-stone-500 mb-6">
            你的前三优势：{topFunctions.map(([func, score]) => `${func}(${score})`).join(' · ')}
          </p>
          
          <div className="w-full h-72 md:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="#d6d3d1" strokeWidth={1} />
                <PolarAngleAxis 
                  dataKey="function" 
                  tick={{ fill: '#57534e', fontSize: 13, fontWeight: 500 }}
                />
                <PolarRadiusAxis 
                  angle={90} 
                  domain={[0, 'dataMax']}
                  tick={{ fill: '#a8a29e', fontSize: 10 }}
                />
                <Radar 
                  name="认知功能" 
                  dataKey="score" 
                  stroke="#57534e" 
                  fill="#78716c" 
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

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
