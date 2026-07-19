'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Solar as SolarLib, LunarUtil } from 'lunar-javascript';

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────
const WEEK_DAYS = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];

// 天干 / 地支顺序（与 lunar-javascript index 对齐）
const GAN_NAMES = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'] as const;
const ZHI_NAMES  = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'] as const;
const ZHI_RANGES = [
  '00:00–00:59','01:00–02:59','03:00–04:59','05:00–06:59',
  '07:00–08:59','09:00–10:59','11:00–12:59','13:00–14:59',
  '15:00–16:59','17:00–18:59','19:00–20:59','21:00–22:59',
];

// 干支五行颜色（与八字板块一致）
const WUXING_COLOR: Record<string, string> = {
  '庚': '#B09F73', '辛': '#B09F73', '申': '#B09F73', '酉': '#B09F73',
  '甲': '#7a9b85', '乙': '#7a9b85', '寅': '#7a9b85', '卯': '#7a9b85',
  '壬': '#6b7c97', '癸': '#6b7c97', '子': '#6b7c97', '亥': '#6b7c97',
  '丙': '#ba6e65', '丁': '#ba6e65', '巳': '#ba6e65', '午': '#ba6e65',
  '戊': '#8B5F45', '己': '#8B5F45', '辰': '#8B5F45', '戌': '#8B5F45', '丑': '#8B5F45', '未': '#8B5F45',
};

/** 将干支字符串按字着色（年/月/日等非干支字用 defaultColor） */
function ColoredGanZhi({ str, defaultColor = '#6b6254' }: { str: string; defaultColor?: string }) {
  return (
    <>
      {str.split('').map((ch, i) => (
        <span key={i} style={{ color: WUXING_COLOR[ch] ?? defaultColor }}>
          {ch}
        </span>
      ))}
    </>
  );
}

function hourToZhiIdx(h: number): number {
  return Math.floor((h + 1) / 2) % 12;
}

function zhiIdxToHour(i: number): number {
  return i === 0 ? 0 : i * 2 - 1;
}

// ─────────────────────────────────────────────
// 深度神煞映射表
// ─────────────────────────────────────────────

// 羊刃：甲卯，丙戊午，庚酉，壬子（按题目给出的简化规则）
const YANG_REN_BY_DAY_GAN: Record<number, number[]> = {
  0: [3],       // 甲 → 卯
  2: [6],       // 丙 → 午
  4: [6],       // 戊 → 午
  6: [9],       // 庚 → 酉
  8: [0],       // 壬 → 子
};

// 日禄（禄神）：甲寅，乙卯，丙戊巳，丁己午，庚申，辛酉，壬亥，癸子
const LU_SHEN_BY_DAY_GAN: Record<number, number[]> = {
  0: [2],       // 甲 → 寅
  1: [3],       // 乙 → 卯
  2: [5],       // 丙 → 巳
  3: [6],       // 丁 → 午
  4: [5],       // 戊 → 巳
  5: [6],       // 己 → 午
  6: [8],       // 庚 → 申
  7: [9],       // 辛 → 酉
  8: [11],      // 壬 → 亥
  9: [0],       // 癸 → 子
};

// 天干合（五合）
const GAN_HE_MAP: Record<number, number> = {
  0: 5, // 甲合己
  5: 0,
  1: 6, // 乙合庚
  6: 1,
  2: 7, // 丙合辛
  7: 2,
  3: 8, // 丁合壬
  8: 3,
  4: 9, // 戊合癸
  9: 4,
};

// 地支六合
const ZHI_LIU_HE_MAP: Record<number, number> = {
  0: 1,  // 子丑
  1: 0,
  2: 11, // 寅亥
  11: 2,
  3: 10, // 卯戌
  10: 3,
  4: 9,  // 辰酉
  9: 4,
  5: 8,  // 巳申
  8: 5,
  6: 7,  // 午未
  7: 6,
};

// 天乙贵人：甲戊庚牛羊(丑未)，乙己鼠猴乡(子申)，丙丁猪鸡位(亥酉)，壬癸兔蛇藏(卯巳)，六辛逢马虎(午寅)
const TIAN_YI_BY_DAY_GAN: Record<number, number[]> = {
  0: [1, 7], // 甲 → 丑、未
  4: [1, 7], // 戊 → 丑、未
  6: [1, 7], // 庚 → 丑、未
  1: [0, 8], // 乙 → 子、申
  5: [0, 8], // 己 → 子、申
  2: [11, 9], // 丙 → 亥、酉
  3: [11, 9], // 丁 → 亥、酉
  8: [3, 5], // 壬 → 卯、巳
  9: [3, 5], // 癸 → 卯、巳
  7: [6, 2], // 辛 → 午、寅
};

// 截路空亡：甲己申酉，乙庚午未，丙辛辰巳，丁壬寅卯，戊癸子丑
const JIE_LU_BY_DAY_GAN: Record<number, number[]> = {
  0: [8, 9], // 甲 → 申酉
  5: [8, 9], // 己 → 申酉
  1: [6, 7], // 乙 → 午未
  6: [6, 7], // 庚 → 午未
  2: [4, 5], // 丙 → 辰巳
  7: [4, 5], // 辛 → 辰巳
  3: [2, 3], // 丁 → 寅卯
  8: [2, 3], // 壬 → 寅卯
  4: [0, 1], // 戊 → 子丑
  9: [0, 1], // 癸 → 子丑
};

// 五行：甲乙木；丙丁火；戊己土；庚辛金；壬癸水
const GAN_WU_XING: ('木'|'火'|'土'|'金'|'水')[] = [
  '木','木', // 甲乙
  '火','火', // 丙丁
  '土','土', // 戊己
  '金','金', // 庚辛
  '水','水', // 壬癸
];

type LuckReason =
  | '日破'
  | '月破'
  | '羊刃'
  | '五不遇'
  | '日禄'
  | '天干合'
  | '地支合'
  | '天乙贵人'
  | '截路空亡'
  | '旬空'
  | '黄道'
  | '黑道';

const REASON_COLOR: Record<LuckReason, string> = {
  日破: '#9b4b4b',
  月破: '#9b4b4b',
  羊刃: '#a63b3b',
  五不遇: '#9b6a3a',
  日禄: '#4a7a5a',
  天干合: '#4a7a5a',
  地支合: '#4a7a5a',
  天乙贵人: '#8a7a2a',
  截路空亡: '#7a6e5a',
  旬空: '#7a6e5a',
  黄道: '#5a7a5a',
  黑道: '#8a7a7a',
};

// ─────────────────────────────────────────────
// 辅助方法
// ─────────────────────────────────────────────

function isGanKe(attackerGanIndex: number, victimGanIndex: number): boolean {
  const attacker = GAN_WU_XING[attackerGanIndex];
  const victim = GAN_WU_XING[victimGanIndex];
  // 木克土，土克水，水克火，火克金，金克木
  return (
    (attacker === '木' && victim === '土') ||
    (attacker === '土' && victim === '水') ||
    (attacker === '水' && victim === '火') ||
    (attacker === '火' && victim === '金') ||
    (attacker === '金' && victim === '木')
  );
}

// ─────────────────────────────────────────────
// 深度时辰吉凶：getComprehensiveTimeLuck
// ─────────────────────────────────────────────
function getComprehensiveTimeLuck(
  lunar: {
    getDayZhi(): string;
    getMonthZhi(): string;
    getDayGanIndex(): number;
  },
  dayXunKong: string,
  time: {
    getGanIndex(): number;
    getZhiIndex(): number;
    getChong(): string;
    getZhi(): string;
    getTianShenType(): string;
  }
): { luck: '吉' | '凶'; reason: LuckReason } {
  const dayGanIndex = lunar.getDayGanIndex();
  const dayGan = GAN_NAMES[dayGanIndex];
  const dayZhi = lunar.getDayZhi();
  const monthZhi = lunar.getMonthZhi();

  const timeGanIndex = time.getGanIndex();
  const timeGan = GAN_NAMES[timeGanIndex];
  const timeZhiIndex = time.getZhiIndex();
  const timeZhi = ZHI_NAMES[timeZhiIndex];

  const chong = time.getChong();

  // ── 第一层：绝对极凶（一票否决） ──
  // 1. 日破 / 月破：时支与日支、月支相冲
  if (chong === dayZhi) return { luck: '凶', reason: '日破' };
  if (chong === monthZhi) return { luck: '凶', reason: '月破' };

  // 2. 羊刃：时支为日干的羊刃
  if ((YANG_REN_BY_DAY_GAN[dayGanIndex] ?? []).includes(timeZhiIndex)) {
    return { luck: '凶', reason: '羊刃' };
  }

  // 3. 五不遇时：时干克日干，且天干相隔七位（index 差 6）
  const diff = (timeGanIndex - dayGanIndex + 10) % 10;
  if (diff === 6 && isGanKe(timeGanIndex, dayGanIndex)) {
    return { luck: '凶', reason: '五不遇' };
  }

  // ── 第二层：大吉标签（仅作参考，不改变黄黑道判定） ──
  const hasRiLu = (LU_SHEN_BY_DAY_GAN[dayGanIndex] ?? []).includes(timeZhiIndex);
  const hasTianYi = (TIAN_YI_BY_DAY_GAN[dayGanIndex] ?? []).includes(timeZhiIndex);

  // ── 第三层：中凶拦截 ──
  // 8. 截路空亡
  if ((JIE_LU_BY_DAY_GAN[dayGanIndex] ?? []).includes(timeZhiIndex)) {
    return { luck: '凶', reason: '截路空亡' };
  }

  // 9. 旬空
  if (dayXunKong && dayXunKong.includes(time.getZhi())) {
    return { luck: '凶', reason: '旬空' };
  }

  // ── 第四层：兜底黄黑道（最终吉凶只看黄黑道） ──
  const huang = time.getTianShenType() === '黄道';
  let reason: LuckReason = huang ? '黄道' : '黑道';

  // 若有日禄 / 天乙贵人，则作为标签原因展示，但不改变吉凶结果
  if (hasRiLu) {
    reason = '日禄';
  } else if (hasTianYi) {
    reason = '天乙贵人';
  }

  return { luck: huang ? '吉' : '凶', reason };
}

// ─────────────────────────────────────────────
// 数据类型
// ─────────────────────────────────────────────
interface ShiChenInfo {
  ganZhi: string;
  zhi: string;
  luck: '吉'|'凶';
  reason: LuckReason;
  range: string;
}

interface LunarDetail {
  lunarMonthChinese: string;
  lunarDayChinese: string;
  yearGanZhi: string;
  monthGanZhi: string;
  dayGanZhi: string;
  shengXiao: string;
  weekDay: string;
  yi: string[];
  ji: string[];
  dayNaYin: string;
  zhiXing: string;
  xiu: string; xiuGong: string; xiuZheng: string; xiuAnimal: string;
  chongShengXiao: string;
  sha: string;
  tianShen: string;
  tianShenType: string;
  shiChen: ShiChenInfo[];
  yearPillar: string;
  monthPillar: string;
  dayPillar: string;
}

// ─────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────
interface Props { year: number; month: number; day: number }

export const LunarCalendarCard: React.FC<Props> = ({ year, month, day }) => {
  const [detail,  setDetail]  = useState<LunarDetail | null>(null);
  const [open,    setOpen]    = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [nowHour, setNowHour] = useState(() => new Date().getHours());
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)');
    const syncViewport = () => setIsDesktop(media.matches);
    syncViewport();
    media.addEventListener('change', syncViewport);
    return () => media.removeEventListener('change', syncViewport);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNowHour(new Date().getHours()), 60_000);
    return () => clearInterval(id);
  }, []);

  const currentZhiIdx = useMemo(() => hourToZhiIdx(nowHour), [nowHour]);

  const [timePillar, setTimePillar] = useState('');
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const l = SolarLib.fromYmdHms(year, month, day, nowHour, 0, 0).getLunar() as {
          getTimeInGanZhi(): string;
        };
        if (!cancelled) setTimePillar(l.getTimeInGanZhi());
      } catch (error) {
        if (!cancelled) {
          setTimePillar('');
          setLoadError('time');
        }
        console.error('[LunarCalendarCard] Failed to load time pillar:', error);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [year, month, day, nowHour]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const noon = SolarLib.fromYmdHms(year, month, day, 12, 0, 0);
        const lunar = noon.getLunar() as {
          getMonthInChinese(): string; getDayInChinese(): string;
          getYearInGanZhi(): string; getMonthInGanZhi(): string; getDayInGanZhi(): string;
          getYearShengXiao(): string;
          getDayYi(): string[]; getDayJi(): string[];
          getDayNaYin(): string; getZhiXing(): string;
          getXiu(): string; getGong(): string; getZheng(): string; getAnimal(): string;
          getDayChongShengXiao(): string; getDaySha(): string;
          getDayTianShen(): string; getDayTianShenType(): string;
          getDayZhi(): string; getMonthZhi(): string;
          getDayGanIndex(): number; getDayInGanZhi(): string;
          getTimes(): Array<{
            getGanZhi(): string; getGan(): string; getZhi(): string;
            getGanIndex(): number; getZhiIndex(): number;
            getChong(): string; getTianShenLuck(): string; getTianShenType(): string;
          }>;
        };

        const dayXunKong = LunarUtil.getXunKong(lunar.getDayInGanZhi()) || '';

        const shiChen: ShiChenInfo[] = lunar.getTimes().slice(0, 12).map((t, i) => {
          const { luck, reason } = getComprehensiveTimeLuck(lunar, dayXunKong, t);
          return { ganZhi: t.getGanZhi(), zhi: ZHI_NAMES[i], luck, reason, range: ZHI_RANGES[i] };
        });

        if (!cancelled) setDetail({
          lunarMonthChinese: lunar.getMonthInChinese() + '月',
          lunarDayChinese:   lunar.getDayInChinese(),
          yearGanZhi:  lunar.getYearInGanZhi()  + '年',
          monthGanZhi: lunar.getMonthInGanZhi() + '月',
          dayGanZhi:   lunar.getDayInGanZhi()   + '日',
          shengXiao:   lunar.getYearShengXiao(),
          weekDay:     WEEK_DAYS[new Date(year, month - 1, day).getDay()],
          yi: lunar.getDayYi() ?? [], ji: lunar.getDayJi() ?? [],
          dayNaYin:  lunar.getDayNaYin(),
          zhiXing:   lunar.getZhiXing(),
          xiu:       lunar.getXiu(), xiuGong: lunar.getGong(),
          xiuZheng:  lunar.getZheng(), xiuAnimal: lunar.getAnimal(),
          chongShengXiao: lunar.getDayChongShengXiao(),
          sha:        lunar.getDaySha(),
          tianShen:   lunar.getDayTianShen(),
          tianShenType: lunar.getDayTianShenType(),
          shiChen,
          yearPillar:  lunar.getYearInGanZhi(),
          monthPillar: lunar.getMonthInGanZhi(),
          dayPillar:   lunar.getDayInGanZhi(),
        });
        if (!cancelled) setLoadError(null);
      } catch (error) {
        if (!cancelled) {
          setDetail(null);
          setLoadError('detail');
        }
        console.error('[LunarCalendarCard] Failed to build lunar detail:', error);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [year, month, day]);

  const handleOpen  = useCallback(() => setOpen(true),  []);
  const handleClose = useCallback((e: React.MouseEvent) => { e.stopPropagation(); setOpen(false); }, []);

  const isLoaded = !!detail;
  const {
    lunarMonthChinese = '',
    lunarDayChinese   = '',
    yearGanZhi        = '',
    monthGanZhi       = '',
    dayGanZhi         = '',
    shengXiao         = '',
    weekDay           = WEEK_DAYS[new Date(year, month - 1, day).getDay()],
    yi                = [] as string[],
    ji                = [] as string[],
    dayNaYin          = '',
    zhiXing           = '',
    xiu               = '',
    xiuGong           = '',
    xiuZheng          = '',
    xiuAnimal         = '',
    chongShengXiao    = '',
    sha               = '',
    tianShen          = '',
    tianShenType      = '',
    shiChen           = [] as ShiChenInfo[],
    yearPillar        = '',
    monthPillar       = '',
    dayPillar         = '',
  } = detail ?? {};

  const isHuangDao = tianShenType === '黄道';
  const todayY = new Date().getFullYear();
  const todayM = new Date().getMonth() + 1;
  const todayD = new Date().getDate();
  const isToday = year === todayY && month === todayM && day === todayD;
  const currentZhiName = ZHI_NAMES[currentZhiIdx];

  return (
    <>
      {/* ────── 摘要卡片 ────── */}
      <button
        type="button"
        onClick={handleOpen}
        className="relative z-10 w-full mb-8 rounded-2xl cursor-pointer select-none text-left
                   focus:outline-none focus-visible:ring-1 focus-visible:ring-stone-300/80
                   focus-visible:ring-offset-2 focus-visible:ring-offset-[#fbf9f4] pointer-events-auto
                   transition-all duration-200 active:scale-[0.99]"
        style={{
          background: '#fdfcf9',
          border: '1px solid rgba(0,0,0,0.07)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)',
        }}
      >
        <div className="pt-5 pb-4">
          {/* ── 标题区 ── */}
          <div className="px-5 mb-3">
            <div className="flex items-baseline justify-between mb-1.5">
              <h2
                className="leading-none tracking-wide"
                style={{
                  fontSize: '28px',
                  color: '#1e1c18',
                  fontWeight: 400,
                  fontFamily: '"Kaiti SC", KaiTi, STKaiti, "华文楷体", "楷体", Georgia, serif',
                }}
              >
                {isLoaded ? `${lunarMonthChinese}${lunarDayChinese}` : '万年历'}
              </h2>
              <p className="text-[11px] font-sans tabular-nums" style={{ color: '#b5ad9e' }}>
                {year}.{String(month).padStart(2,'0')}.{String(day).padStart(2,'0')}&ensp;{weekDay}
              </p>
            </div>
            {/* 干支副标题 — 统一灰色，四柱颜色在下方展示 */}
            <p
              className="text-[11px] leading-relaxed tracking-[0.06em]"
              style={{ fontFamily: '"Kaiti SC", KaiTi, STKaiti, "华文楷体", "楷体", Georgia, serif', color: '#a39888' }}
            >
              {isLoaded ? (
                <>
                  {yearGanZhi}&thinsp;{monthGanZhi}&thinsp;{dayGanZhi}&thinsp;属{shengXiao}
                  {timePillar && (
                    <span className="ml-1.5">
                      · 此时{currentZhiName}时&thinsp;{timePillar}
                    </span>
                  )}
                </>
              ) : (
                <span style={{ color: '#c4bdb0' }}>{loadError ? '今日黄历加载失败' : '加载中…'}</span>
              )}
            </p>
          </div>

          {/* ── 四柱通栏 ── */}
          {isLoaded && (
            <div
              className="flex"
              style={{ borderTop: '1px solid rgba(0,0,0,0.06)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}
            >
              {([
                { label: '年', pillar: yearPillar },
                { label: '月', pillar: monthPillar },
                { label: '日', pillar: dayPillar },
                { label: '时', pillar: timePillar },
              ] as { label: string; pillar: string }[]).map(({ label, pillar }, i) => {
                const gan = pillar?.[0] ?? '';
                const zhi = pillar?.[1] ?? '';
                const isEmpty = !gan && !zhi;
                return (
                  <div
                    key={label}
                    className="flex-1 flex flex-col items-center py-4"
                    style={{ borderRight: i < 3 ? '1px solid rgba(0,0,0,0.06)' : 'none' }}
                  >
                    <span
                      className="text-[8px] font-sans tracking-[0.18em] mb-3"
                      style={{ color: '#c4bdb0' }}
                    >
                      {label}
                    </span>
                    <span
                      className="leading-none"
                      style={{
                        fontSize: '22px',
                        fontFamily: '"Kaiti SC",KaiTi,STKaiti,"华文楷体","楷体",Georgia,serif',
                        color: isEmpty ? '#ddd8d0' : (WUXING_COLOR[gan] ?? '#3d3935'),
                        marginBottom: '10px',
                      }}
                    >
                      {gan || '·'}
                    </span>
                    <div style={{ width: '14px', height: '1px', background: 'rgba(0,0,0,0.08)', marginBottom: '10px' }} />
                    <span
                      className="leading-none"
                      style={{
                        fontSize: '22px',
                        fontFamily: '"Kaiti SC",KaiTi,STKaiti,"华文楷体","楷体",Georgia,serif',
                        color: isEmpty ? '#ddd8d0' : (WUXING_COLOR[zhi] ?? '#3d3935'),
                      }}
                    >
                      {zhi || '·'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── 宜忌行 ── */}
          <div className="px-5 pt-3.5 space-y-1.5">
            {[
              { type:'yi' as const, items: isLoaded ? yi : [] },
              { type:'ji' as const, items: isLoaded ? ji : [] },
            ].map(({ type, items }) => (
              <div key={type} className="flex items-center gap-2 min-w-0">
                <span
                  className="flex-shrink-0 w-[17px] h-[17px] rounded-full flex items-center justify-center text-[9px]"
                  style={{
                    border: `1px solid ${type==='yi' ? '#5b7a5b' : '#8a4a4a'}`,
                    color:   type==='yi' ? '#5b7a5b' : '#8a4a4a',
                  }}
                >
                  {type === 'yi' ? '宜' : '忌'}
                </span>
                {isLoaded ? (
                  <p
                    className="text-[11.5px] truncate flex-1"
                    style={{
                      color: '#4a4642',
                      fontFamily: '"Kaiti SC", KaiTi, STKaiti, "华文楷体", "楷体", Georgia, serif',
                    }}
                    title={items.join('　')}
                  >
                    {items.join('　') || '—'}
                  </p>
                ) : (
                  <p className="text-[11.5px] flex-1" style={{ color: '#a39888' }}>加载中…</p>
                )}
              </div>
            ))}
          </div>

          {/* ── 底栏 ── */}
          <div className="px-5 mt-3 pt-2.5 flex items-center justify-between" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
            {isLoaded ? (
              <span className="text-[10px] font-sans tracking-wider" style={{ color: '#a39888' }}>
                {tianShenType}&nbsp;·&nbsp;{tianShen}&nbsp;·&nbsp;{zhiXing}日
              </span>
            ) : (
              <span className="text-[10px] font-sans tracking-wider" style={{ color: '#a39888' }}>
                黄历详情加载中…
              </span>
            )}
            <span className="text-[10px] font-sans flex items-center gap-0.5" style={{ color: '#a39888' }}>
              查看详情
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </div>
        </div>
      </button>

      {/* ────── 详情弹层 ────── */}
      <AnimatePresence>
        {open && (
          <>
            {/* 遮罩 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="fixed inset-0 z-40"
              style={{ background: 'rgba(15,13,10,0.3)', backdropFilter: 'blur(4px)' }}
              onClick={handleClose}
            />

            {/* 面板：移动端为底部抽屉，桌面端为居中的纸册式对开布局 */}
            <motion.div
              initial={isDesktop ? { opacity: 0, scale: 0.96, y: 18 } : { y: '100%' }}
              animate={isDesktop ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
              exit={isDesktop ? { opacity: 0, scale: 0.97, y: 12 } : { y: '100%' }}
              transition={isDesktop
                ? { duration: 0.48, ease: [0.32, 0.72, 0, 1] }
                : { type: 'spring', damping: 34, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-50 flex flex-col overflow-hidden rounded-t-[24px]
                         md:inset-8 md:m-auto md:h-[calc(100dvh-4rem)]
                         md:rounded-[30px] md:p-[6px]"
              style={{
                width: isDesktop ? 'min(1120px, calc(100vw - 64px))' : undefined,
                maxHeight: isDesktop ? '840px' : '92dvh',
                background: isDesktop ? '#e8e2d8' : '#faf8f4',
                boxShadow: isDesktop
                  ? '0 34px 90px rgba(54,45,34,0.18), 0 8px 28px rgba(54,45,34,0.08)'
                  : 'none',
              }}
            >
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#faf8f4] md:rounded-[24px]">
                {/* 把手 */}
                <div className="flex-shrink-0 flex justify-center pt-3 pb-1 md:hidden">
                  <div className="w-8 h-[3px] rounded-full" style={{ background: '#d4cdc3' }} />
                </div>

                {/* 移动端顶栏 */}
                <div className="flex-shrink-0 flex items-center justify-between px-6 py-2.5 md:hidden">
                  <span
                    className="text-[10px] font-sans tracking-[0.38em]"
                    style={{ color: '#a39888' }}
                  >
                    黄 历 详 情
                  </span>
                  <button
                    onClick={handleClose}
                    aria-label="关闭黄历详情"
                    className="w-7 h-7 flex items-center justify-center rounded-full
                               transition-colors hover:bg-stone-100 active:bg-stone-200"
                    style={{ color: '#a39888' }}
                  >
                    <svg className="w-[15px] h-[15px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* 移动端可滚动内容 */}
                <div className="overflow-y-auto flex-1 px-6 pb-14 md:hidden">

                {/* ① 英雄日期区 */}
                <div className="text-center pt-4 pb-9">
                  <div
                    className="tabular-nums leading-none"
                    style={{
                      fontSize: '92px',
                      fontWeight: 100,
                      color: '#1e1c18',
                      fontFamily: '"Hiragino Mincho ProN", "Songti SC", "STSong", Georgia, serif',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {day}
                  </div>
                  <p
                    className="mt-3 text-[16px] tracking-[0.24em]"
                    style={{
                      color: '#3d3935',
                      fontFamily: '"Kaiti SC", KaiTi, STKaiti, "华文楷体", "楷体", Georgia, serif',
                    }}
                  >
                    {lunarMonthChinese}{lunarDayChinese}&emsp;{weekDay}
                  </p>
                  <p
                    className="mt-2 text-[11px] font-sans tracking-[0.14em]"
                    style={{ color: '#a39888' }}
                  >
                    {year}年{month}月{day}日&ensp;·&ensp;
                    <ColoredGanZhi str={yearGanZhi} defaultColor="#a39888" />&thinsp;
                    <ColoredGanZhi str={monthGanZhi} defaultColor="#a39888" />&thinsp;
                    <ColoredGanZhi str={dayGanZhi} defaultColor="#a39888" />&thinsp;属{shengXiao}
                  </p>
                </div>

                {/* 分割线 */}
                <div className="mb-7" style={{ height: '1px', background: 'rgba(0,0,0,0.07)' }} />

                {/* ② 宜忌 */}
                <div className="grid grid-cols-2 gap-6 mb-8">
                  <YiJiBlock type="yi" items={yi} />
                  <YiJiBlock type="ji" items={ji} />
                </div>

                {/* 分割线 */}
                <div className="mb-6" style={{ height: '1px', background: 'rgba(0,0,0,0.07)' }} />

                {/* ③ 信息行 */}
                <div className="mb-7">
                  {[
                    { label: '纳音五行', value: dayNaYin },
                    { label: '十二建除', value: zhiXing + '日' },
                    { label: tianShenType || '神煞', value: tianShen, accent: isHuangDao ? 'gold' as const : undefined },
                    { label: '廿八宿', value: `${xiuGong}方 · ${xiu}${xiuZheng} · ${xiuAnimal}` },
                    { label: '今日冲煞', value: `冲${chongShengXiao}　煞${sha}` },
                  ].map((item, idx) => (
                    <InfoRow key={idx} label={item.label} value={item.value} valueNode={'valueNode' in item ? (item as {valueNode?: React.ReactNode}).valueNode : undefined} accent={item.accent} />
                  ))}
                </div>

                {/* 分割线 */}
                <div className="mb-6" style={{ height: '1px', background: 'rgba(0,0,0,0.07)' }} />

                {/* 四柱 */}
                <div className="mb-7">
                  <div className="flex items-baseline justify-between mb-5">
                    <span className="text-[10px] font-sans tracking-[0.28em]" style={{ color: '#a39888' }}>
                      四 柱
                    </span>
                    <span className="text-[9px] font-sans" style={{ color: '#c4bdb0' }}>
                      {isToday ? `此时${currentZhiName}时` : `${currentZhiName}时`}
                    </span>
                  </div>
                  <div
                    className="flex -mx-6"
                    style={{ borderTop: '1px solid rgba(0,0,0,0.07)', borderBottom: '1px solid rgba(0,0,0,0.07)' }}
                  >
                    {([
                      { label: '年柱', pillar: yearPillar },
                      { label: '月柱', pillar: monthPillar },
                      { label: '日柱', pillar: dayPillar },
                      { label: '时柱', pillar: timePillar },
                    ] as { label: string; pillar: string }[]).map(({ label, pillar }, i) => {
                      const gan = pillar?.[0] ?? '';
                      const zhi = pillar?.[1] ?? '';
                      const isEmpty = !gan && !zhi;
                      return (
                        <div
                          key={label}
                          className="flex-1 flex flex-col items-center py-6"
                          style={{ borderRight: i < 3 ? '1px solid rgba(0,0,0,0.07)' : 'none' }}
                        >
                          <span
                            className="text-[9px] font-sans mb-4 tracking-[0.18em]"
                            style={{ color: '#c4bdb0' }}
                          >
                            {label}
                          </span>
                          <span
                            className="leading-none mb-5"
                            style={{
                              fontSize: '34px',
                              fontFamily: '"Kaiti SC",KaiTi,STKaiti,"华文楷体","楷体",Georgia,serif',
                              color: isEmpty ? '#ddd8d0' : (WUXING_COLOR[gan] ?? '#3d3935'),
                            }}
                          >
                            {gan || '·'}
                          </span>
                          <div style={{ width: '20px', height: '1px', background: 'rgba(0,0,0,0.09)', marginBottom: '20px' }} />
                          <span
                            className="leading-none"
                            style={{
                              fontSize: '34px',
                              fontFamily: '"Kaiti SC",KaiTi,STKaiti,"华文楷体","楷体",Georgia,serif',
                              color: isEmpty ? '#ddd8d0' : (WUXING_COLOR[zhi] ?? '#3d3935'),
                            }}
                          >
                            {zhi || '·'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 分割线 */}
                <div className="mb-6" style={{ height: '1px', background: 'rgba(0,0,0,0.07)' }} />

                {/* ④ 时辰吉凶 */}
                <div className="pb-2">
                  <div className="flex items-baseline gap-3 mb-5">
                    <span
                      className="text-[10px] font-sans tracking-[0.28em]"
                      style={{ color: '#a39888' }}
                    >
                      时辰吉凶
                    </span>
                    <span
                      className="text-[9px] font-sans"
                      style={{ color: '#c4bdb0' }}
                    >
                      综合黄黑道 · 日破 · 五不遇 · 旬空 · 贵人
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {shiChen.map((sc, i) => (
                      <ShiChenCell key={i} sc={sc} isCurrent={i === currentZhiIdx} />
                    ))}
                  </div>

                  {/* 图例 */}
                  <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2">
                    {[
                      { label: '当前时辰', color: '#4a6282', dot: true  },
                      { label: '日/月破',  color: '#9b4b4b', dot: false },
                      { label: '五不遇',  color: '#9b6a3a', dot: false },
                      { label: '旬/截路', color: '#7a6e5a', dot: false },
                      { label: '天乙贵人',color: '#8a7a2a', dot: false },
                      { label: '天干合',  color: '#4a7a5a', dot: false },
                    ].map(({ label, color, dot }) => (
                      <span key={label} className="flex items-center gap-1.5 text-[9px] font-sans" style={{ color: '#a39888' }}>
                        <span
                          className="inline-block w-1.5 h-1.5 rounded-sm flex-shrink-0"
                          style={{ background: dot ? 'transparent' : color, border: dot ? `1px solid ${color}` : 'none' }}
                        />
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
                </div>

                {/* 桌面端：无印纸册式非对称布局 */}
                <div className="hidden min-h-0 flex-1 md:grid md:grid-cols-[330px_minmax(0,1fr)]">
                  <aside
                    className="relative flex min-h-0 flex-col overflow-hidden px-10 py-9"
                    style={{
                      background: 'linear-gradient(145deg, #f2eee6 0%, #eee8dd 100%)',
                      borderRight: '1px solid rgba(71,62,50,0.08)',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-sans tracking-[0.4em] text-[#948979]">黄 历</span>
                      <span className="text-[9px] font-sans tabular-nums tracking-[0.12em] text-[#b1a797]">
                        {String(month).padStart(2, '0')} / {String(day).padStart(2, '0')}
                      </span>
                    </div>

                    <div className="flex flex-1 flex-col justify-center py-7">
                      <div
                        className="tabular-nums leading-[0.76] text-[#24211c]"
                        style={{
                          fontSize: '138px',
                          fontWeight: 100,
                          fontFamily: '"Hiragino Mincho ProN", "Songti SC", "STSong", Georgia, serif',
                          letterSpacing: '-0.07em',
                        }}
                      >
                        {day}
                      </div>
                      <div className="mt-8 h-px w-10 bg-[#8e806d]/45" />
                      <p
                        className="mt-7 text-[18px] tracking-[0.22em] text-[#39342d]"
                        style={{ fontFamily: '"Kaiti SC", KaiTi, STKaiti, "华文楷体", "楷体", Georgia, serif' }}
                      >
                        {lunarMonthChinese}{lunarDayChinese}
                      </p>
                      <p className="mt-2 text-[10px] font-sans tracking-[0.22em] text-[#948979]">
                        {weekDay}&ensp;·&ensp;{year}年{month}月
                      </p>
                      <p
                        className="mt-5 max-w-[230px] text-[12px] leading-6 tracking-[0.08em] text-[#71685c]"
                        style={{ fontFamily: '"Kaiti SC", KaiTi, STKaiti, "华文楷体", "楷体", Georgia, serif' }}
                      >
                        <ColoredGanZhi str={yearGanZhi} defaultColor="#71685c" />&thinsp;
                        <ColoredGanZhi str={monthGanZhi} defaultColor="#71685c" />&thinsp;
                        <ColoredGanZhi str={dayGanZhi} defaultColor="#71685c" />
                        <br />岁次{yearGanZhi.replace('年', '')} · 属{shengXiao}
                      </p>
                    </div>

                    <div className="space-y-3 border-t border-[#756957]/10 pt-5">
                      {[
                        { label: '建除', value: `${zhiXing}日` },
                        { label: tianShenType || '神煞', value: tianShen },
                        { label: '冲煞', value: `冲${chongShengXiao} · 煞${sha}` },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center justify-between">
                          <span className="text-[9px] font-sans tracking-[0.18em] text-[#a59b8c]">{item.label}</span>
                          <span
                            className="text-[12px] tracking-[0.08em] text-[#50493f]"
                            style={{ fontFamily: '"Kaiti SC", KaiTi, STKaiti, "华文楷体", "楷体", Georgia, serif' }}
                          >
                            {item.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </aside>

                  <section className="relative flex min-h-0 flex-col">
                    <header
                      className="flex h-[72px] flex-shrink-0 items-center justify-between px-10"
                      style={{ borderBottom: '1px solid rgba(71,62,50,0.07)' }}
                    >
                      <div>
                        <p className="text-[10px] font-sans tracking-[0.34em] text-[#8f8577]">黄 历 详 情</p>
                        <p className="mt-1.5 text-[9px] font-sans tracking-[0.12em] text-[#bbb2a5]">
                          宜顺时而为，忌逆势强求
                        </p>
                      </div>
                      <button
                        onClick={handleClose}
                        aria-label="关闭黄历详情"
                        className="group flex h-9 w-9 items-center justify-center rounded-full bg-[#f1eee8]
                                   text-[#93897b] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
                                   hover:rotate-90 hover:bg-[#e9e4dc] hover:text-[#4d463d] active:scale-95"
                      >
                        <svg className="h-[14px] w-[14px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </header>

                    <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-10 py-8">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-[22px] bg-[#f1f4ed] px-6 py-5 ring-1 ring-[#668064]/10">
                          <YiJiBlock type="yi" items={yi} />
                        </div>
                        <div className="rounded-[22px] bg-[#f5efed] px-6 py-5 ring-1 ring-[#8a5f59]/10">
                          <YiJiBlock type="ji" items={ji} />
                        </div>
                      </div>

                      <div className="mt-5 grid grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] gap-4">
                        <div className="rounded-[22px] bg-[#f7f4ee] px-6 py-5 ring-1 ring-black/[0.035]">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-[9px] font-sans tracking-[0.28em] text-[#9e9485]">日 辰</span>
                            <span className="text-[8px] font-sans tracking-[0.12em] text-[#c0b8ac]">DAY NOTE</span>
                          </div>
                          {[
                            { label: '纳音五行', value: dayNaYin },
                            { label: '廿八宿', value: `${xiuGong}方 · ${xiu}${xiuZheng} · ${xiuAnimal}` },
                            { label: tianShenType || '神煞', value: tianShen, accent: isHuangDao ? 'gold' as const : undefined },
                          ].map((item) => (
                            <InfoRow key={item.label} label={item.label} value={item.value} accent={item.accent} />
                          ))}
                        </div>

                        <div className="rounded-[22px] bg-[#f7f4ee] px-6 py-5 ring-1 ring-black/[0.035]">
                          <div className="mb-4 flex items-center justify-between">
                            <span className="text-[9px] font-sans tracking-[0.28em] text-[#9e9485]">四 柱</span>
                            <span className="text-[8px] font-sans text-[#c0b8ac]">
                              {isToday ? `此时${currentZhiName}时` : `${currentZhiName}时`}
                            </span>
                          </div>
                          <div className="grid grid-cols-4">
                            {([
                              { label: '年', pillar: yearPillar },
                              { label: '月', pillar: monthPillar },
                              { label: '日', pillar: dayPillar },
                              { label: '时', pillar: timePillar },
                            ] as { label: string; pillar: string }[]).map(({ label, pillar }, i) => (
                              <DesktopPillar key={label} label={label} pillar={pillar} divided={i > 0} />
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 rounded-[22px] bg-[#f7f4ee] px-6 py-5 ring-1 ring-black/[0.035]">
                        <div className="mb-4 flex items-baseline justify-between">
                          <span className="text-[9px] font-sans tracking-[0.28em] text-[#9e9485]">时 辰 吉 凶</span>
                          <span className="text-[8px] font-sans tracking-[0.08em] text-[#c0b8ac]">
                            黄黑道 · 日破 · 五不遇 · 旬空 · 贵人
                          </span>
                        </div>
                        <div className="grid grid-cols-6 gap-2">
                          {shiChen.map((sc, i) => (
                            <ShiChenCell key={i} sc={sc} isCurrent={i === currentZhiIdx} />
                          ))}
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

// ─────────────────────────────────────────────
// 子组件
// ─────────────────────────────────────────────

const YiJiBlock: React.FC<{ type:'yi'|'ji'; items: string[] }> = ({ type, items }) => {
  const isYi = type === 'yi';
  const accent = isYi ? '#5b7a5b' : '#8a4a4a';
  const tagBg  = isYi ? 'rgba(91,122,91,0.09)' : 'rgba(138,74,74,0.09)';
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span
          className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] flex-shrink-0"
          style={{ border: `1px solid ${accent}`, color: accent }}
        >
          {isYi ? '宜' : '忌'}
        </span>
        <span className="text-[10px] font-sans tracking-[0.18em]" style={{ color: accent }}>
          {isYi ? '今日宜' : '今日忌'}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.length > 0
          ? items.map((item, i) => (
              <span
                key={i}
                className="text-[11.5px] px-2 py-0.5 rounded"
                style={{
                  color: '#4a4642',
                  background: tagBg,
                  fontFamily: '"Kaiti SC", KaiTi, STKaiti, "华文楷体", "楷体", Georgia, serif',
                }}
              >
                {item}
              </span>
            ))
          : <span className="text-[11px]" style={{ color: '#b5ad9e' }}>—</span>
        }
      </div>
    </div>
  );
};

const InfoRow: React.FC<{
  label: string; value: string; valueNode?: React.ReactNode; accent?: 'gold';
}> = ({ label, value, valueNode, accent }) => (
  <div
    className="flex items-baseline justify-between py-3.5"
    style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}
  >
    <span
      className="text-[10.5px] font-sans tracking-[0.14em] flex-shrink-0 mr-6"
      style={{ color: '#a39888' }}
    >
      {label}
    </span>
    <span
      className="text-[13px] text-right leading-snug"
      style={{
        color: accent === 'gold' ? '#8a6e28' : '#3d3935',
        fontFamily: '"Kaiti SC", KaiTi, STKaiti, "华文楷体", "楷体", Georgia, serif',
      }}
    >
      {valueNode ?? value}
    </span>
  </div>
);

const DesktopPillar: React.FC<{
  label: string; pillar: string; divided: boolean;
}> = ({ label, pillar, divided }) => {
  const gan = pillar?.[0] ?? '';
  const zhi = pillar?.[1] ?? '';
  const isEmpty = !gan && !zhi;

  return (
    <div
      className="flex flex-col items-center py-1"
      style={{ borderLeft: divided ? '1px solid rgba(71,62,50,0.07)' : 'none' }}
    >
      <span className="mb-3 text-[8px] font-sans tracking-[0.18em] text-[#b3aa9d]">{label}</span>
      <span
        className="text-[24px] leading-none"
        style={{
          color: isEmpty ? '#d8d2c8' : (WUXING_COLOR[gan] ?? '#3d3935'),
          fontFamily: '"Kaiti SC", KaiTi, STKaiti, "华文楷体", "楷体", Georgia, serif',
        }}
      >
        {gan || '·'}
      </span>
      <span className="my-2 h-px w-3 bg-black/[0.08]" />
      <span
        className="text-[24px] leading-none"
        style={{
          color: isEmpty ? '#d8d2c8' : (WUXING_COLOR[zhi] ?? '#3d3935'),
          fontFamily: '"Kaiti SC", KaiTi, STKaiti, "华文楷体", "楷体", Georgia, serif',
        }}
      >
        {zhi || '·'}
      </span>
    </div>
  );
};

const ShiChenCell: React.FC<{ sc: ShiChenInfo; isCurrent: boolean }> = ({ sc, isCurrent }) => {
  const isJi = sc.luck === '吉';
  const isOverride = !['黄道','黑道'].includes(sc.reason);

  return (
    <div
      className="rounded-xl flex flex-col items-center py-3 px-1 gap-0.5 relative"
      style={{
        background: isCurrent
          ? '#edf2f8'
          : isJi ? '#f4f7f3' : '#f7f3f3',
        border: isCurrent
          ? '1px solid #8aa0c8'
          : `1px solid ${isJi ? 'rgba(91,122,91,0.25)' : 'rgba(138,74,74,0.2)'}`,
      }}
    >
      {isCurrent && (
        <span
          className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
          style={{ background: '#4a6282' }}
        />
      )}
      <span
        className="text-[12.5px] font-medium leading-none"
        style={{
          color: '#3d3935',
          fontFamily: '"Kaiti SC", KaiTi, STKaiti, "华文楷体", "楷体", Georgia, serif',
        }}
      >
        {sc.ganZhi}
      </span>
      <span
        className="text-[9px] leading-none"
        style={{
          color: '#a39888',
          fontFamily: '"Kaiti SC", KaiTi, STKaiti, "华文楷体", "楷体", Georgia, serif',
        }}
      >
        {sc.zhi}时
      </span>
      <span
        className="mt-1 text-[11px] font-medium"
        style={{ color: isJi ? '#5b7a5b' : '#8a4a4a' }}
      >
        {sc.luck}
      </span>
      {isOverride && (
        <span
          className="text-[8px] leading-none font-sans px-1 py-0.5 rounded-sm mt-0.5"
          style={{ color: REASON_COLOR[sc.reason], background: `${REASON_COLOR[sc.reason]}18` }}
        >
          {sc.reason}
        </span>
      )}
    </div>
  );
};
