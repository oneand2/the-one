'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { getYaoInfo, type DayanResult } from '@/utils/liuyaoLogic';

/**
 * 大衍筮法（蓍草法）矢量动画
 *
 * 以 SVG 蓍草（细墨线）逐步重演一爻的三变：
 *   引子：大衍之数五十，其用四十有九（首爻会演出去一不用）
 *   每变：分二挂一（草束分为两堆，右堆取一策悬于归奇位）
 *         揲四归奇（余策以四为单位成组暗去归拢，余数染朱砂归入奇位）
 *   三变既毕：余策 36/32/28/24，四营得 9/8/7/6
 *
 * 动画只负责「重演」——三变的分堆与余数全部由逻辑层 dayanOnce 事先算定。
 */

interface DayanAnimationProps {
  result: DayanResult;
  yaoIndex: number; // 0 = 初爻 … 5 = 上爻
  onComplete: () => void;
}

const INK = '#3D3935';
const CINNABAR = '#8A4A4A'; // 朱砂：揲四余数
const GOLD = '#B09F73'; // 泥金：挂一与不用之策
const STONE_400 = '#A8A29E';
const STONE_500 = '#78716C';
const HAIRLINE = 'rgba(0,0,0,0.07)';
const EASE: [number, number, number, number] = [0.32, 0.72, 0, 1];
const KAITI = '"Kaiti SC", KaiTi, STKaiti, serif';

const CX_BUNDLE = 180;
const CX_LEFT = 116;
const CX_RIGHT = 244;
const Y_STAGE = 130;
const Y_SLOT = 36;
const SLOT_X = [124, 192, 260];

const YAO_NAMES = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'];
const CN_DIGITS = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

const toCn = (n: number): string => {
  if (n < 10) return CN_DIGITS[n];
  if (n === 10) return '十';
  if (n < 20) return `十${CN_DIGITS[n % 10]}`;
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return `${CN_DIGITS[tens]}十${ones ? CN_DIGITS[ones] : ''}`;
};

// 每根蓍草的确定性抖动，让草束带一点手工错落感
const jx = (id: number) => ((id * 37) % 7) - 3;
const jy = (id: number) => ((id * 53) % 9) - 4;
const jr = (id: number) => (((id * 29) % 13) - 6) * 0.6;

interface StalkTarget {
  x: number;
  y: number;
  rotate: number;
  scaleY: number;
  opacity: number | number[];
  times?: number[];
  fill: string;
  delay: number; // 秒
  duration: number; // 秒
}

const bundlePos = (i: number, n: number, id: number) => ({
  x: CX_BUNDLE + (i - (n - 1) / 2) * 4.3 + jx(id),
  y: Y_STAGE + jy(id),
});

const heapPos = (i: number, n: number, cx: number, id: number) => ({
  x: cx + (i - (n - 1) / 2) * 4.4 + jx(id),
  y: Y_STAGE + jy(id),
});

const slotPos = (k: number, n: number, c: number) => ({
  x: SLOT_X[c] + (k - (n - 1) / 2) * 4.2,
  y: Y_SLOT,
});

/**
 * 为一爻预先编排 50 根蓍草在 8 个节拍上的位置：
 *   0 引子 → 1/2 一变（分二挂一 / 揲四归奇）→ 3/4 二变 → 5/6 三变 → 7 成爻
 */
function buildPlan(result: DayanResult, yaoIndex: number): StalkTarget[][] {
  const plan: StalkTarget[][] = Array.from({ length: 50 }, () => []);
  const hasFifty = yaoIndex === 0;

  // 引子：首爻陈列五十策（其一为「不用」之策），其后各爻直接以四十九策开局
  for (let id = 0; id < 50; id += 1) {
    if (id === 49) {
      plan[id][0] = hasFifty
        ? { ...bundlePos(49, 50, 49), rotate: jr(49), scaleY: 1, opacity: 1, fill: GOLD, delay: 0, duration: 0.4 }
        : { x: CX_BUNDLE, y: -60, rotate: 0, scaleY: 0.34, opacity: 0, fill: GOLD, delay: 0, duration: 0.3 };
      continue;
    }
    const n = hasFifty ? 50 : 49;
    plan[id][0] = {
      ...bundlePos(id, n, id),
      rotate: jr(id),
      scaleY: 1,
      opacity: 1,
      fill: INK,
      delay: id * 0.004,
      duration: 0.4,
    };
  }

  // 去一不用：第五十策升起隐去（仅首爻演出）
  if (hasFifty) {
    for (let b = 1; b < 8; b += 1) {
      plan[49][b] = { x: bundlePos(49, 50, 49).x, y: 12, rotate: 0, scaleY: 0.34, opacity: 0, fill: GOLD, delay: 0.05, duration: 0.7 };
    }
  }

  let active = Array.from({ length: 49 }, (_, i) => i);
  for (let c = 0; c < 3; c += 1) {
    const ch = result.changes[c];
    const beatA = 1 + c * 2; // 分二挂一
    const beatB = beatA + 1; // 揲四归奇

    const leftIds = active.slice(0, ch.leftCount);
    const rightIds = active.slice(ch.leftCount);
    const hangId = rightIds[rightIds.length - 1]; // 挂一：自右堆取一策
    const rightKeep = rightIds.slice(0, -1);
    const remL = leftIds.slice(leftIds.length - ch.remLeft); // 左堆揲四余数
    const cntL = leftIds.slice(0, leftIds.length - ch.remLeft);
    const remR = rightKeep.slice(rightKeep.length - ch.remRight); // 右堆揲四余数
    const cntR = rightKeep.slice(0, rightKeep.length - ch.remRight);
    const counted = [...cntL, ...cntR];

    // 分二：草束分为左右两堆；挂一之策径赴归奇位（泥金）
    leftIds.forEach((id, i) => {
      plan[id][beatA] = { ...heapPos(i, ch.leftCount, CX_LEFT, id), rotate: jr(id), scaleY: 1, opacity: 1, fill: INK, delay: i * 0.004, duration: 0.26 };
    });
    rightKeep.forEach((id, i) => {
      plan[id][beatA] = { ...heapPos(i, rightKeep.length, CX_RIGHT, id), rotate: jr(id), scaleY: 1, opacity: 1, fill: INK, delay: i * 0.004, duration: 0.26 };
    });
    plan[hangId][beatA] = { ...slotPos(0, ch.setAside, c), rotate: 0, scaleY: 0.34, opacity: 1, fill: GOLD, delay: 0.12, duration: 0.28 };

    // 揲四：余策以四为一组依次暗去、归拢中央；两堆余数染朱砂，飞入归奇位
    counted.forEach((id, i) => {
      plan[id][beatB] = {
        ...bundlePos(i, ch.after, id),
        rotate: jr(id),
        scaleY: 1,
        opacity: [1, 0.16, 1],
        times: [0, 0.45, 1],
        fill: INK,
        delay: Math.floor(i / 4) * 0.01,
        duration: 0.36,
      };
    });
    [...remL, ...remR].forEach((id, k) => {
      plan[id][beatB] = { ...slotPos(1 + k, ch.setAside, c), rotate: 0, scaleY: 0.34, opacity: 1, fill: CINNABAR, delay: 0.14 + k * 0.03, duration: 0.3 };
    });

    active = counted;
  }

  // 三变既毕：余策轻轻一颤，定格成爻
  active.forEach((id, i) => {
    plan[id][7] = {
      ...bundlePos(i, result.finalStalks, id),
      rotate: jr(id),
      scaleY: 1,
      opacity: [1, 0.45, 1],
      times: [0, 0.5, 1],
      fill: INK,
      delay: i * 0.004,
      duration: 0.46,
    };
  });

  // 未赋值的节拍延续上一节拍（已归奇的蓍草静立于槽位中）
  for (let id = 0; id < 50; id += 1) {
    for (let b = 1; b < 8; b += 1) {
      if (!plan[id][b]) plan[id][b] = plan[id][b - 1];
    }
  }
  return plan;
}

function statusLines(beat: number, result: DayanResult, yaoIndex: number): [string, string] {
  const yaoName = YAO_NAMES[yaoIndex];
  if (beat === 0) {
    return yaoIndex === 0
      ? ['大衍之数五十 · 其用四十有九', `${yaoName} · 三变成爻`]
      : [`${yaoName} · 三变成爻`, '四十九策 · 分二挂一'];
  }
  if (beat >= 7) {
    const info = getYaoInfo(result.value);
    return [`三变既毕 · 余${toCn(result.finalStalks)}策`, `四营得${toCn(result.value)} · 是为${info.name}`];
  }
  const c = Math.floor((beat - 1) / 2);
  const ch = result.changes[c];
  if (beat % 2 === 1) {
    return [`第${toCn(c + 1)}变 · 分二挂一`, `存策 ${toCn(ch.before)}`];
  }
  return [`第${toCn(c + 1)}变 · 揲四归奇`, `归奇 ${toCn(ch.setAside)} · 余${toCn(ch.after)}策`];
}

export const DayanAnimation: React.FC<DayanAnimationProps> = ({ result, yaoIndex, onComplete }) => {
  const [beat, setBeat] = useState(0);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const plan = useMemo(() => buildPlan(result, yaoIndex), [result, yaoIndex]);
  // 各节拍停留时长：引子（首爻略长）→ 一变A/B → 二变A/B → 三变A/B → 成爻
  const durations = useMemo(
    () => [yaoIndex === 0 ? 620 : 280, 240, 400, 240, 400, 240, 400, 560],
    [yaoIndex],
  );

  useEffect(() => {
    let beatIdx = 0;
    let timer = 0;
    const advance = () => {
      timer = window.setTimeout(() => {
        beatIdx += 1;
        if (beatIdx > 7) {
          onCompleteRef.current();
          return;
        }
        setBeat(beatIdx);
        advance();
      }, durations[beatIdx]);
    };
    advance();
    return () => window.clearTimeout(timer);
  }, [durations]);

  const [line1, line2] = statusLines(beat, result, yaoIndex);

  return (
    <div className="flex w-full flex-col items-center">
      <svg
        viewBox="0 0 360 236"
        className="w-full max-w-[380px]"
        role="img"
        aria-label={`大衍筮法起卦过程，${YAO_NAMES[yaoIndex]}`}
      >
        {/* 眉标与三变槽位（右上留给「略过仪式」按钮） */}
        <text x={28} y={20} fontSize={8.5} fill={STONE_400} letterSpacing={1} style={{ fontFamily: KAITI }}>
          {YAO_NAMES[yaoIndex]} · 蓍策三变
        </text>
        <text x={28} y={42} fontSize={8.5} fill={STONE_400} letterSpacing={2} style={{ fontFamily: KAITI }}>
          归奇
        </text>
        {['一变', '二变', '三变'].map((label, c) => (
          <text key={label} x={SLOT_X[c]} y={60} fontSize={8.5} fill={STONE_400} letterSpacing={1} textAnchor="middle" style={{ fontFamily: KAITI }}>
            {label}
          </text>
        ))}
        <line x1={28} y1={70} x2={332} y2={70} stroke={HAIRLINE} strokeWidth={1} />
        <line x1={28} y1={172} x2={332} y2={172} stroke="rgba(0,0,0,0.05)" strokeWidth={1} />

        {/* 五十策蓍草 */}
        {plan.map((targets, id) => {
          const t = targets[beat];
          const t0 = targets[0];
          return (
            <motion.rect
              key={id}
              x={-1.3}
              y={-31}
              width={2.6}
              height={62}
              rx={1.3}
              style={{ originX: 0.5, originY: 0.5, transformBox: 'fill-box' }}
              initial={{
                x: t0.x,
                y: t0.y,
                rotate: t0.rotate,
                scaleY: t0.scaleY,
                opacity: Array.isArray(t0.opacity) ? t0.opacity[0] : t0.opacity,
                fill: t0.fill,
              }}
              animate={{
                x: t.x,
                y: t.y,
                rotate: t.rotate,
                scaleY: t.scaleY,
                opacity: t.opacity,
                fill: t.fill,
              }}
              transition={{
                duration: t.duration,
                delay: t.delay,
                ease: EASE,
                opacity: Array.isArray(t.opacity)
                  ? { duration: t.duration, delay: t.delay, times: t.times, ease: 'easeInOut' }
                  : { duration: Math.min(t.duration, 0.3), delay: t.delay, ease: 'easeInOut' },
              }}
            />
          );
        })}

        {/* 仪式状态文字 */}
        <motion.text
          key={`l1-${beat}`}
          x={180}
          y={202}
          fontSize={11}
          fill={STONE_500}
          letterSpacing={2.5}
          textAnchor="middle"
          style={{ fontFamily: KAITI }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
        >
          {line1}
        </motion.text>
        <motion.text
          key={`l2-${beat}`}
          x={180}
          y={221}
          fontSize={9}
          fill={STONE_400}
          letterSpacing={2}
          textAnchor="middle"
          style={{ fontFamily: KAITI }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
        >
          {line2}
        </motion.text>
      </svg>
    </div>
  );
};
