import { NextRequest, NextResponse } from 'next/server';
import questionsRaw from '../../../../../questions.json';
import mbtiDetailsRaw from '../../../../../mbti_final_cleaned.json';

export const runtime = 'nodejs';

const MBTI_TYPES = [
  'ESTP', 'ESFP', 'ISTP', 'ISFP', 'ENTJ', 'ENFJ', 'INTJ', 'INFJ',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'INTP', 'INFP', 'ENTP', 'ENFP',
] as const;
const FUNCTIONS = ['Se', 'Si', 'Ne', 'Ni', 'Te', 'Ti', 'Fe', 'Fi'] as const;
const SLOT_NAMES = ['Hero', 'Parent', 'Child', 'Inferior', 'Nemesis', 'Critic', 'Trickster', 'Demon'] as const;
type MBTIType = (typeof MBTI_TYPES)[number];
type CognitiveFunction = (typeof FUNCTIONS)[number];

const SLOT_WEIGHTS: Record<(typeof SLOT_NAMES)[number], number> = {
  Hero: 2.0, Parent: 1.6, Child: 1.2, Inferior: 0.5,
  Nemesis: 1.0, Critic: 0.8, Trickster: 0.1, Demon: 0.3,
};

const STACKS: Record<MBTIType, CognitiveFunction[]> = {
  INFJ: ['Ni', 'Fe', 'Ti', 'Se', 'Ne', 'Fi', 'Te', 'Si'],
  INFP: ['Fi', 'Ne', 'Si', 'Te', 'Fe', 'Ni', 'Se', 'Ti'],
  INTJ: ['Ni', 'Te', 'Fi', 'Se', 'Ne', 'Ti', 'Fe', 'Si'],
  INTP: ['Ti', 'Ne', 'Si', 'Fe', 'Te', 'Ni', 'Se', 'Fi'],
  ISFJ: ['Si', 'Fe', 'Ti', 'Ne', 'Se', 'Fi', 'Te', 'Ni'],
  ISFP: ['Fi', 'Se', 'Ni', 'Te', 'Fe', 'Si', 'Ne', 'Ti'],
  ISTJ: ['Si', 'Te', 'Fi', 'Ne', 'Se', 'Ti', 'Fe', 'Ni'],
  ISTP: ['Ti', 'Se', 'Ni', 'Fe', 'Te', 'Si', 'Ne', 'Fi'],
  ENFJ: ['Fe', 'Ni', 'Se', 'Ti', 'Fi', 'Ne', 'Si', 'Te'],
  ENFP: ['Ne', 'Fi', 'Te', 'Si', 'Ni', 'Fe', 'Ti', 'Se'],
  ENTJ: ['Te', 'Ni', 'Se', 'Fi', 'Ti', 'Ne', 'Si', 'Fe'],
  ENTP: ['Ne', 'Ti', 'Fe', 'Si', 'Ni', 'Te', 'Fi', 'Se'],
  ESFJ: ['Fe', 'Si', 'Ne', 'Ti', 'Fi', 'Se', 'Ni', 'Te'],
  ESFP: ['Se', 'Fi', 'Te', 'Ni', 'Si', 'Fe', 'Ti', 'Ne'],
  ESTJ: ['Te', 'Si', 'Ne', 'Fi', 'Ti', 'Se', 'Ni', 'Fe'],
  ESTP: ['Se', 'Ti', 'Fe', 'Ni', 'Si', 'Te', 'Fi', 'Ne'],
};

const INFERIOR_AXIS: Record<CognitiveFunction, CognitiveFunction> = {
  Ni: 'Se', Se: 'Ni', Ne: 'Si', Si: 'Ne', Ti: 'Fe', Fe: 'Ti', Te: 'Fi', Fi: 'Te',
};
const NEMESIS_SHADOW: Record<CognitiveFunction, CognitiveFunction> = {
  Ni: 'Ne', Ne: 'Ni', Si: 'Se', Se: 'Si', Ti: 'Te', Te: 'Ti', Fi: 'Fe', Fe: 'Fi',
};

interface Question {
  id: number;
  category: string;
  question: string;
  options: Array<{ id: string; text: string; target_types: MBTIType[]; weight: number }>;
}
interface UserAnswer { questionId: number; weights: Record<string, number> }
type SlotScores = Record<CognitiveFunction, Record<number, number>>;

const questions = questionsRaw as Question[];

function emptyScores(): SlotScores {
  return Object.fromEntries(FUNCTIONS.map((func) => [func, Object.fromEntries(Array.from({ length: 8 }, (_, index) => [index, 0]))])) as SlotScores;
}

// 与 MbtiTestView 的 parseUserRawData 完全相同：每题归一化为 10 分。
function parseAnswers(answers: UserAnswer[]): SlotScores {
  const scores = emptyScores();
  answers.forEach((answer) => {
    const question = questions.find((item) => item.id === answer.questionId);
    const category = question?.category as CognitiveFunction | undefined;
    if (!category || !FUNCTIONS.includes(category)) return;
    const total = Object.values(answer.weights).reduce((sum, value) => sum + value, 0);
    if (!total) return;
    Object.entries(answer.weights).forEach(([optionId, value]) => {
      if (!value) return;
      const match = optionId.match(/^(\w+)_(\d+)(st|nd|rd|th)$/);
      const slot = match ? Number(match[2]) - 1 : -1;
      if (slot >= 0 && slot < 8) scores[category][slot] += value * (10 / total);
    });
  });
  return scores;
}

// 与网页 The Gearing System 完全相同。
function applyGearing(source: SlotScores): SlotScores {
  const scores = structuredClone(source);
  FUNCTIONS.forEach((func) => {
    const hero = scores[func][0];
    if (hero > 0) {
      scores[INFERIOR_AXIS[func]][3] += hero * 0.4;
      scores[NEMESIS_SHADOW[func]][4] += hero * 0.4;
    }
  });
  return scores;
}

function strengths(scores: SlotScores): Record<CognitiveFunction, number> {
  return Object.fromEntries(FUNCTIONS.map((func) => {
    const total = SLOT_NAMES.reduce((sum, slot, index) => sum + (scores[func][index] || 0) * SLOT_WEIGHTS[slot], 0);
    return [func, Math.round(total * 10) / 10];
  })) as Record<CognitiveFunction, number>;
}

function ideal(type: MBTIType, user?: Record<CognitiveFunction, number>): Record<CognitiveFunction, number> {
  const average = user ? Object.values(user).reduce((sum, value) => sum + value, 0) / FUNCTIONS.length : 20;
  return Object.fromEntries(FUNCTIONS.map((func) => {
    const slot = STACKS[type].indexOf(func);
    return [func, slot >= 0 ? average * (SLOT_WEIGHTS[SLOT_NAMES[slot]] / 1.2) : 0];
  })) as Record<CognitiveFunction, number>;
}

function bestFit(user: Record<CognitiveFunction, number>) {
  let type: MBTIType = 'INFJ';
  let minimum = Number.POSITIVE_INFINITY;
  MBTI_TYPES.forEach((candidate) => {
    const target = ideal(candidate, user);
    const distance = FUNCTIONS.reduce((sum, func) => sum + Math.abs(user[func] - target[func]), 0);
    if (distance < minimum) { minimum = distance; type = candidate; }
  });
  const target = ideal(type, user);
  const distance = FUNCTIONS.reduce((sum, func) => sum + Math.abs(user[func] - target[func]), 0);
  const maximum = FUNCTIONS.reduce((sum, func) => sum + Math.max(user[func], target[func]), 0);
  return { type, fitScore: Math.max(0, Math.min(100, 100 - distance / Math.max(1, maximum) * 100)) };
}

function userSlots(scores: SlotScores) {
  return Object.fromEntries(Array.from({ length: 8 }, (_, slot) => {
    const ranked = FUNCTIONS.map((func) => ({ function: func, score: scores[func][slot] })).sort((a, b) => b.score - a.score);
    const conflict = ranked[0].score > 0 && ranked[1].score > 0 && ranked[0].score - ranked[1].score < 1;
    return [slot, { ...ranked[0], hasConflict: conflict, conflictWith: conflict ? ranked[1].function : undefined }];
  }));
}

function shadowType(type: MBTIType): MBTIType {
  const opposite: Record<string, string> = { E: 'I', I: 'E', S: 'N', N: 'S', T: 'F', F: 'T', J: 'P', P: 'J' };
  return type.split('').map((letter) => opposite[letter]).join('') as MBTIType;
}

export async function GET(request: NextRequest) {
  // ?type=INTJ：返回该类型的完整文案详情（供原生端渲染历史记录报告）。
  const type = request.nextUrl.searchParams.get('type')?.toUpperCase();
  if (type) {
    if (!MBTI_TYPES.includes(type as MBTIType)) {
      return NextResponse.json({ error: '未知的类型' }, { status: 400 });
    }
    const detail = (mbtiDetailsRaw as Array<{ id: string }>).find((item) => item.id === type) ?? null;
    return NextResponse.json({ detail, shadowType: shadowType(type as MBTIType) });
  }
  return NextResponse.json({ questions });
}

export async function POST(request: NextRequest) {
  let answers: UserAnswer[];
  try {
    const body = await request.json() as { answers?: UserAnswer[] };
    answers = body.answers ?? [];
  } catch {
    return NextResponse.json({ error: '答案格式无效' }, { status: 400 });
  }
  if (answers.length !== questions.length || answers.some((answer) => Object.values(answer.weights).reduce((sum, value) => sum + value, 0) < 1)) {
    return NextResponse.json({ error: '请完成全部题目后再查看结果' }, { status: 400 });
  }

  const corrected = applyGearing(parseAnswers(answers));
  const functionStrengths = strengths(corrected);
  const { type, fitScore } = bestFit(functionStrengths);
  const functionScores = Object.fromEntries(FUNCTIONS.map((func) => [func, Object.values(corrected[func]).reduce((sum, value) => sum + value, 0)]));
  const detail = (mbtiDetailsRaw as Array<{ id: string }>).find((item) => item.id === type) ?? null;

  return NextResponse.json({
    type,
    score: fitScore,
    fitScore,
    shadowType: shadowType(type),
    functionScores,
    functionStrengths,
    idealStrengths: ideal(type, functionStrengths),
    userSlots: userSlots(corrected),
    detail,
  });
}
