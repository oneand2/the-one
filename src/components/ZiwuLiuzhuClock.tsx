'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

// ─── 字体常量 ─────────────────────────────────────────────────────────────────
const KAITI = '"Kaiti SC", KaiTi, STKaiti, "华文楷体", "楷体", Georgia, serif';

// ─── 五行色（单色调，同干支色系）────────────────────────────────────────────
const ZHI_COLOR: Record<string, string> = {
  子: '#6b7c97', 亥: '#6b7c97',
  丑: '#8B5F45', 辰: '#8B5F45', 未: '#8B5F45', 戌: '#8B5F45',
  寅: '#7a9b85', 卯: '#7a9b85',
  巳: '#ba6e65', 午: '#ba6e65',
  申: '#B09F73', 酉: '#B09F73',
};

// ─── 十二时辰数据 ─────────────────────────────────────────────────────────────
const ZHI_LIST = [
  { name: '子', meridian: '胆经当令', summary: '宜静卧养阳', detail: '此时一阳初生，必须入睡以保护微弱的阳气种子。', phase: '夜间 · 潜阳育阴' },
  { name: '丑', meridian: '肝经当令', summary: '宜深眠藏血', detail: '肝藏血，人卧则血归于肝。此时只有深度睡眠，全身血液才能回流肝系统进行休养。', phase: '夜间 · 潜阳育阴' },
  { name: '寅', meridian: '肺经当令', summary: '宜安睡定气', detail: '肺朝百脉，正在重新分配气血，保持均匀的呼吸对身体至关重要。', phase: '夜间 · 潜阳育阴' },
  { name: '卯', meridian: '大肠经当令', summary: '宜起而排便', detail: '天地阳气升起，大肠蠕动最旺盛，是清理体内糟粕的最佳时机。', phase: '早晨 · 阳气生发' },
  { name: '辰', meridian: '胃经当令', summary: '宜温食饱腹', detail: '胃系统消化能力最强，进食温热且营养丰富的早餐最能化生气血。', phase: '早晨 · 阳气生发' },
  { name: '巳', meridian: '脾经当令', summary: '宜高效工作', detail: '脾将营养运化至全身，此时大脑供血最充足，是逻辑思维和创作的黄金时间。', phase: '早晨 · 阳气生发' },
  { name: '午', meridian: '心经当令', summary: '宜小憩养神', detail: '阴阳交替之时，心气最易波动，短暂的午休可以安抚神明。', phase: '中午 · 阴阳交替' },
  { name: '未', meridian: '小肠经当令', summary: '宜多饮清茶', detail: '小肠泌别清浊，此时摄入水分有助于精华的吸收和浊液的排泄。', phase: '中午 · 阴阳交替' },
  { name: '申', meridian: '膀胱经当令', summary: '宜适度运动', detail: '膀胱经气最足，也是人体记忆力最好的时段，无论是体力活动还是深度思考都很合适。', phase: '中午 · 阴阳交替' },
  { name: '酉', meridian: '肾经当令', summary: '宜静坐收心', detail: '肾主藏精，此时应停止剧烈消耗，让气血能量开始向体内储藏。', phase: '傍晚 · 收敛藏精' },
  { name: '戌', meridian: '心包经当令', summary: '宜闲谈悦心', detail: '心包保护心君，此时保持愉悦的情绪和放松的沟通，有助于理顺气机。', phase: '傍晚 · 收敛藏精' },
  { name: '亥', meridian: '三焦经当令', summary: '宜沐足宽心', detail: '三焦通百脉，通过温水泡脚或彻底放松，让全身气血归位，准备进入睡眠。', phase: '傍晚 · 收敛藏精' },
];

// ─── 工具函数 ─────────────────────────────────────────────────────────────────
function hourToZhiIdx(h: number): number {
  return Math.floor((h + 1) / 2) % 12;
}

function polar(deg: number, r: number, cx: number, cy: number) {
  const rad = (deg - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** 顺时针弧路径，startDeg + spanDeg < 360 均可 */
function arc(cx: number, cy: number, r: number, startDeg: number, spanDeg: number) {
  const p1 = polar(startDeg, r, cx, cy);
  const p2 = polar(startDeg + spanDeg, r, cx, cy);
  const large = spanDeg > 180 ? 1 : 0;
  return `M ${p1.x.toFixed(2)},${p1.y.toFixed(2)} A ${r},${r} 0 ${large},1 ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
}

// ─── 主组件 ───────────────────────────────────────────────────────────────────
export const ZiwuLiuzhuClock: React.FC = () => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const h = now.getHours();
  const m = now.getMinutes();
  const idx = hourToZhiIdx(h);
  const zhi = ZHI_LIST[idx];
  const accent = ZHI_COLOR[zhi.name];

  // 指针角度（00:00 = 0°顶部，顺时针，每小时 15°）
  const needleDeg = ((h + m / 60) * 15) % 360;
  // 当前时辰起始角
  const shiStart = idx * 30 - 15;
  // 当前时辰内已过进度（0–30°）
  const progress = Math.min(((needleDeg - shiStart) + 360) % 360, 30);

  // SVG 布局常量
  const CX = 130, CY = 124;
  const R  = 112;  // 主环半径（比初版 96 大 ~17%）
  const RL = 90;   // 地支标签半径（环内）
  const CARDINALS = new Set([0, 3, 6, 9]); // 子卯午酉

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.25, 0.1, 0.25, 1] }}
      className="mb-6"
    >
      <div
        className="relative rounded-2xl overflow-hidden"
        style={{
          background: '#fdfcf9',
          border: '1px solid rgba(0,0,0,0.07)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)',
        }}
      >

        {/* ════ 标题区 ════ */}
        <div className="px-5 pt-4 pb-2 flex items-start justify-between">
          <div>
            <h2
              className="leading-none mb-1"
              style={{ fontFamily: KAITI, fontSize: 20, color: '#1e1c18', fontWeight: 400 }}
            >
              子午流注
            </h2>
            <p className="text-[11px] font-sans" style={{ color: '#a39888', letterSpacing: '0.04em' }}>
              经络当令 · 顺时养生
            </p>
          </div>
          <span
            className="text-[12px] font-sans tabular-nums mt-0.5"
            style={{ color: '#c4bdb0', letterSpacing: '0.04em' }}
          >
            {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}
          </span>
        </div>

        {/* ════ 表盘 SVG ════ */}
        <svg
          viewBox="0 0 260 252"
          className="w-full max-w-[280px] mx-auto block"
          aria-label={`当前时辰：${zhi.name}时，${zhi.meridian}`}
        >
          {/* 背景轨道 */}
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="1" />

          {/* 当前时辰窗口弧（宽透明） */}
          <path
            d={arc(CX, CY, R, shiStart, 30)}
            fill="none"
            stroke={accent}
            strokeWidth="8"
            strokeLinecap="butt"
            opacity="0.10"
          />

          {/* 时辰内进度弧（细实） */}
          {progress > 0.5 && (
            <path
              d={arc(CX, CY, R, shiStart, progress)}
              fill="none"
              stroke={accent}
              strokeWidth="2.2"
              strokeLinecap="round"
              opacity="0.70"
            />
          )}

          {/* 12 个刻度 */}
          {ZHI_LIST.map((_, i) => {
            const isCardinal = CARDINALS.has(i);
            const outer = polar(i * 30, R, CX, CY);
            const inner = polar(i * 30, R - (isCardinal ? 8 : 5), CX, CY);
            return (
              <line
                key={i}
                x1={outer.x} y1={outer.y}
                x2={inner.x} y2={inner.y}
                stroke={isCardinal ? 'rgba(0,0,0,0.22)' : 'rgba(0,0,0,0.10)'}
                strokeWidth={isCardinal ? 1.1 : 0.75}
              />
            );
          })}

          {/* 当前分钟精确位置（环上圆点） */}
          {(() => {
            const p = polar(needleDeg, R, CX, CY);
            return (
              <>
                <circle cx={p.x} cy={p.y} r={6.5} fill={accent} opacity="0.12" />
                <circle cx={p.x} cy={p.y} r={3.5} fill={accent} opacity="0.82" />
              </>
            );
          })()}

          {/* 地支文字（环内，三级灰度） */}
          {ZHI_LIST.map((z, i) => {
            const isActive   = i === idx;
            const isCardinal = CARDINALS.has(i);
            const p = polar(i * 30, RL, CX, CY);
            return (
              <text
                key={z.name}
                x={p.x} y={p.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={isActive ? 14 : isCardinal ? 11 : 9.5}
                fontWeight={isActive ? 500 : 400}
                fill={
                  isActive   ? '#1e1c18'
                  : isCardinal ? 'rgba(0,0,0,0.38)'
                  : 'rgba(0,0,0,0.18)'
                }
                style={{ fontFamily: KAITI, transition: 'all 0.5s ease' }}
              >
                {z.name}
              </text>
            );
          })}

          {/* 中心遮罩 */}
          <circle cx={CX} cy={CY} r={60} fill="#fdfcf9" />

          {/* 中心：当前时辰名 */}
          <text
            x={CX} y={CY - 15}
            textAnchor="middle" dominantBaseline="middle"
            fontSize="21" fill="#1e1c18"
            style={{ fontFamily: KAITI, fontWeight: 400 }}
          >
            {zhi.name}时
          </text>

          {/* 中心：经络当令 */}
          <text
            x={CX} y={CY + 8}
            textAnchor="middle" dominantBaseline="middle"
            fontSize="11" fill={accent}
            style={{ fontFamily: 'system-ui, sans-serif', letterSpacing: '0.04em' }}
          >
            {zhi.meridian}
          </text>

          {/* 中心：极细分隔线 */}
          <line
            x1={CX - 20} y1={CY + 22}
            x2={CX + 20} y2={CY + 22}
            stroke="rgba(0,0,0,0.10)" strokeWidth="0.5"
          />

          {/* 中心：宜… 一句话 */}
          <text
            x={CX} y={CY + 34}
            textAnchor="middle" dominantBaseline="middle"
            fontSize="9.5" fill="rgba(0,0,0,0.30)"
            style={{ fontFamily: KAITI }}
          >
            {zhi.summary}
          </text>
        </svg>

        {/* ════ 分隔线 ════ */}
        <div className="mx-5 h-px" style={{ background: 'rgba(0,0,0,0.06)' }} />

        {/* ════ 建议区 ════ */}
        <div className="px-5 pt-3 pb-4">
          <p
            className="font-sans mb-2"
            style={{ fontSize: 10, color: '#c4bdb0', letterSpacing: '0.20em' }}
          >
            {zhi.phase}
          </p>
          <p
            className="mb-1.5 leading-snug"
            style={{ fontFamily: KAITI, fontSize: 15, color: '#1e1c18' }}
          >
            {zhi.summary}
          </p>
          <p
            className="leading-relaxed"
            style={{ fontFamily: KAITI, fontSize: 12.5, color: '#6a635a' }}
          >
            {zhi.detail}
          </p>
        </div>

      </div>
    </motion.div>
  );
};
