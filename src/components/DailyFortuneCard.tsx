'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Solar as SolarLib } from 'lunar-javascript';
import { analyzeBazi } from '@/utils/baziLogic';
import { getCached, setCached, CACHE_KEYS, RECORDS_TTL_MS } from '@/utils/cache';

// ─── 天干五行映射 ─────────────────────────────────────────────────────────────
const GAN_NAMES = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'] as const;
type GanName = typeof GAN_NAMES[number];

const STEM_WUXING: Record<string, string> = {
  '甲':'木','乙':'木','丙':'火','丁':'火','戊':'土',
  '己':'土','庚':'金','辛':'金','壬':'水','癸':'水',
};
const WUXING_COLORS: Record<string, { text: string; bg: string }> = {
  '木': { text: '#4e7c4a', bg: 'rgba(78,124,74,0.10)' },
  '火': { text: '#9a4a3a', bg: 'rgba(154,74,58,0.10)' },
  '土': { text: '#8a6e3a', bg: 'rgba(138,110,58,0.10)' },
  '金': { text: '#6a6a82', bg: 'rgba(106,106,130,0.10)' },
  '水': { text: '#3a6a8a', bg: 'rgba(58,106,138,0.10)' },
};

// ─── 地支藏干 ─────────────────────────────────────────────────────────────────
const ZHI_CANG_GAN: Record<string, Record<string, number>> = {
  '子':{'癸':1},'丑':{'己':.7,'癸':.2,'辛':.1},'寅':{'甲':.7,'丙':.2,'戊':.1},
  '卯':{'乙':1},'辰':{'戊':.7,'乙':.2,'癸':.1},'巳':{'丙':.7,'戊':.2,'庚':.1},
  '午':{'丁':.7,'己':.3},'未':{'己':.7,'丁':.2,'乙':.1},'申':{'庚':.7,'壬':.2,'戊':.1},
  '酉':{'辛':1},'戌':{'戊':.7,'辛':.2,'丁':.1},'亥':{'壬':.8,'甲':.2},
};
const WUXING_SHENG: Record<string,string> = {'木':'火','火':'土','土':'金','金':'水','水':'木'};
const WUXING_KE:   Record<string,string> = {'木':'土','土':'水','水':'火','火':'金','金':'木'};

// ─── 五行色（干支）────────────────────────────────────────────────────────────
const WUXING_CHAR_COLOR: Record<string,string> = {
  '甲':'#7a9b85','乙':'#7a9b85','寅':'#7a9b85','卯':'#7a9b85',
  '丙':'#ba6e65','丁':'#ba6e65','巳':'#ba6e65','午':'#ba6e65',
  '戊':'#8B5F45','己':'#8B5F45','辰':'#8B5F45','戌':'#8B5F45','丑':'#8B5F45','未':'#8B5F45',
  '庚':'#B09F73','辛':'#B09F73','申':'#B09F73','酉':'#B09F73',
  '壬':'#6b7c97','癸':'#6b7c97','子':'#6b7c97','亥':'#6b7c97',
};

// ─── 分数计算 ──────────────────────────────────────────────────────────────────
function getRelScore(wx: string, yx: string): number {
  if (wx===yx) return 25;
  if (WUXING_SHENG[wx]===yx) return 10;
  if (WUXING_SHENG[yx]===wx) return -10;
  if (WUXING_KE[wx]===yx) return -15;
  if (WUXING_KE[yx]===wx) return -5;
  return 0;
}
type Relation = '用神'|'生用神'|'泄用神'|'克用神'|'被克'|'无关';
function getRelLabel(wx: string, yx: string): Relation {
  if (wx===yx) return '用神';
  if (WUXING_SHENG[wx]===yx) return '生用神';
  if (WUXING_SHENG[yx]===wx) return '泄用神';
  if (WUXING_KE[wx]===yx) return '克用神';
  if (WUXING_KE[yx]===wx) return '被克';
  return '无关';
}
const REL_STYLE: Record<Relation,{text:string;bg:string}> = {
  用神:   {text:'#4e7c4a',bg:'rgba(78,124,74,0.12)'},
  生用神: {text:'#5a7a9a',bg:'rgba(90,122,154,0.12)'},
  泄用神: {text:'#8a7a5a',bg:'rgba(138,122,90,0.10)'},
  克用神: {text:'#9a4a4a',bg:'rgba(154,74,74,0.12)'},
  被克:   {text:'#8a6a5a',bg:'rgba(138,106,90,0.10)'},
  无关:   {text:'#9e9588',bg:'rgba(158,149,136,0.08)'},
};

interface EItem { label:string;stem:string;wx:string;proportion:number;maxPoints:number;contribution:number;relation:Relation; }
interface ScoreData { items:EItem[];totalAdj:number;finalScore:number; }

function calcScore(dg: string, dz: string, yg: string): ScoreData {
  const yx = STEM_WUXING[yg]||'';
  const items: EItem[] = [];
  const gw = STEM_WUXING[dg]||'';
  items.push({ label:'天干', stem:dg, wx:gw, proportion:.5,
    maxPoints:getRelScore(gw,yx), contribution:getRelScore(gw,yx)*.5, relation:getRelLabel(gw,yx) });
  for (const [s,r] of Object.entries(ZHI_CANG_GAN[dz]||{})) {
    const w = STEM_WUXING[s]||'';
    const role = r>=.6?'主气':r>=.2?'中气':'余气';
    items.push({ label:`地支${role}`, stem:s, wx:w, proportion:.5*r,
      maxPoints:getRelScore(w,yx), contribution:getRelScore(w,yx)*.5*r, relation:getRelLabel(w,yx) });
  }
  const totalAdj = items.reduce((a,it)=>a+it.contribution,0);
  // 总分 = 75 + 调整合计（精确值，不四舍五入），与能量明细一致
  const exactScore = 75 + totalAdj;
  const finalScore = Math.max(55, Math.min(100, Math.round(exactScore * 10) / 10));
  return { items, totalAdj, finalScore };
}

function scoreLevel(s: number): { label:string;color:string } {
  // 评分等级文案：用「高 / 低」替代表达中的「吉 / 凶」
  if (s>=95) return {label:'极高',color:'#4e7c4a'};
  if (s>=87) return {label:'偏高',color:'#5a7a5a'};
  if (s>=80) return {label:'中等',color:'#6a7a4a'};
  if (s>=75) return {label:'平稳',color:'#8a7a4a'};
  if (s>=68) return {label:'略低',color:'#8a6a4a'};
  if (s>=60) return {label:'偏低',color:'#9a5a4a'};
  return {label:'较低',color:'#9a4a4a'};
}

// ─── SVG 圆弧 ─────────────────────────────────────────────────────────────────
const ScoreRing: React.FC<{score:number;color:string}> = ({score,color}) => {
  const r=42,cx=52,cy=52,sw=5,gap=60,tot=360-gap;
  const circ=(tot/360)*2*Math.PI*r, sa=90+gap/2;
  const xy=(deg:number)=>{const rad=((deg-90)*Math.PI)/180;return{x:cx+r*Math.cos(rad),y:cy+r*Math.sin(rad)};};
  const S=xy(sa),E=xy(sa+tot), filled=circ*Math.max(0,Math.min(100,score))/100;
  return (
    <svg width="104" height="104" viewBox="0 0 104 104">
      <path d={`M ${S.x} ${S.y} A ${r} ${r} 0 1 1 ${E.x} ${E.y}`}
        fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth={sw} strokeLinecap="round"/>
      {filled>0&&<path d={`M ${S.x} ${S.y} A ${r} ${r} 0 1 1 ${E.x} ${E.y}`}
        fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round"
        strokeDasharray={`${filled} ${circ-filled}`} style={{transition:'stroke-dasharray 0.8s ease'}}/>}
    </svg>
  );
};

// ─── 存储 ─────────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'daily-fortune-data-v2';
interface StoredData {
  yongshen:string;
  name?:string;
}

// ─── 八字排盘记录类型 ─────────────────────────────────────────────────────────
interface ClassicalRecord {
  id: string;
  params: Record<string,string>;
  created_at: string;
}

function normalizeRecord(row: {id:string; params?:Record<string,string>; input_data?:{params?:Record<string,string>}; created_at:string}): ClassicalRecord {
  const params = row.params ?? row.input_data?.params ?? {};
  return { id: row.id, params: params as Record<string,string>, created_at: row.created_at };
}

function recordLabel(r: ClassicalRecord): string {
  const p = r.params;
  const name = p.name?.trim() ?? '';
  if (p.mode==='bazi' && p.gans && p.zhis) {
    const gs = p.gans.replace(/,/g,'');
    const zs = p.zhis.replace(/,/g,'');
    return `${name ? name+' · ' : ''}${gs} ${zs}`;
  }
  if (p.year && p.month && p.day) {
    return `${name ? name+' · ' : ''}${p.year}年${p.month}月${p.day}日 ${String(p.hour??'?').padStart(2,'0')}时`;
  }
  return name || new Date(r.created_at).toLocaleDateString('zh-CN');
}

function recordPillarDisplay(r: ClassicalRecord): { gans: string[]; zhis: string[] } | null {
  const p = r.params;
  if (p.mode==='bazi' && p.gans && p.zhis) {
    return { gans: p.gans.split(','), zhis: p.zhis.split(',') };
  }
  return null;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
interface Props { year:number; month:number; day:number; }

export const DailyFortuneCard: React.FC<Props> = ({year,month,day}) => {
  const [storedData,    setStoredData]    = useState<StoredData|null>(null);
  const [hydrated,      setHydrated]      = useState(false);
  const [showSetup,     setShowSetup]     = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [calcError,     setCalcError]     = useState('');

  const [dayPillar, setDayPillar] = useState('');
  const [dayGan,    setDayGan]    = useState('');
  const [dayZhi,    setDayZhi]    = useState('');

  // 八字排盘记录
  const [records,      setRecords]      = useState<ClassicalRecord[]|null>(null); // null=loading
  const [recordsFailed,setRecordsFailed]= useState(false);
  const recordsRequestRef = useRef(0);

  const [showBreakdown,    setShowBreakdown]    = useState(false);
  const [showRecordPicker, setShowRecordPicker] = useState(false);

  // ── 初始化：读 localStorage ──────────────────────────────────────────────────
  useEffect(()=>{
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p: StoredData = JSON.parse(raw);
        if (p?.yongshen && GAN_NAMES.includes(p.yongshen as GanName)) {
          setStoredData(p); setHydrated(true); return;
        }
      }
    } catch { /* */ }
    setShowSetup(true); setHydrated(true);
  },[]);

  // ── 加载八字排盘记录 ─────────────────────────────────────────────────────────
  const loadRecords = useCallback((preferCache = true) => {
    const requestId = ++recordsRequestRef.current;
    const cached = preferCache
      ? getCached<ClassicalRecord[]>(CACHE_KEYS.RECORDS_CLASSICAL)
      : null;

    setRecordsFailed(false);
    if (cached && Array.isArray(cached) && cached.length > 0) {
      setRecords(cached.map(r=>'params' in r ? r as ClassicalRecord : normalizeRecord(r as Parameters<typeof normalizeRecord>[0])));
    } else {
      setRecords(null);
    }

    fetch('/api/records/classical', {credentials:'include', cache:'no-store'})
      .then(r=>{ if(r.ok) return r.json(); if(r.status===401) return []; throw r.status; })
      .then(data=>{
        if (requestId !== recordsRequestRef.current) return;
        if (!Array.isArray(data)) { setRecords(cached?.length?cached:[]);return; }
        const list = data.map(normalizeRecord);
        setRecords(list);
        if (list.length>0) setCached(CACHE_KEYS.RECORDS_CLASSICAL, list, RECORDS_TTL_MS);
      })
      .catch(()=>{
        if (requestId !== recordsRequestRef.current) return;
        if (!cached) setRecords([]);
        setRecordsFailed(true);
      });
  },[]);

  useEffect(()=>{
    if (!showSetup) return;
    loadRecords(true);
  },[showSetup,loadRecords]);

  // 网页登录与 iOS 原生登录都会通知当前页面。登录完成后强制绕过游客态缓存，
  // 让“创建排盘”立即切换为“挑选命盘”，无需重载整个今日能量页面。
  useEffect(()=>{
    const refreshAfterAuth = () => {
      if (showSetup) loadRecords(false);
    };
    window.addEventListener('theone:auth-changed', refreshAfterAuth);
    return ()=>window.removeEventListener('theone:auth-changed', refreshAfterAuth);
  },[showSetup,loadRecords]);

  // ── 计算日柱 ─────────────────────────────────────────────────────────────────
  useEffect(()=>{
    let cancel=false;
    (async()=>{
      try {
        const lunar=(SolarLib.fromYmdHms(year,month,day,12,0,0).getLunar()) as {getDayInGanZhi():string};
        const p=lunar.getDayInGanZhi();
        if(!cancel&&p?.length>=2){setDayPillar(p);setDayGan(p[0]);setDayZhi(p[1]);}
      } catch{}
    })();
    return ()=>{cancel=true;};
  },[year,month,day]);

  // ── 运势分数 ─────────────────────────────────────────────────────────────────
  const scoreData = useMemo<ScoreData|null>(()=>{
    if(!dayGan||!dayZhi||!storedData?.yongshen) return null;
    try { return calcScore(dayGan,dayZhi,storedData.yongshen); } catch { return null; }
  },[dayGan,dayZhi,storedData]);

  // ── 计算用神并保存 ────────────────────────────────────────────────────────────
  const runCalculate = useCallback((
    by:number, bm:number, bd:number, bh:number,
    nameHint='',
    directBazi?: {gans:string[];zhis:string[]},
  )=>{
    setIsCalculating(true); setCalcError('');
    setTimeout(()=>{
      try {
        const baziInputObj = directBazi
          ? {year:by,month:bm,day:bd,hour:bh,directBazi}
          : {year:by,month:bm,day:bd,hour:bh};
        const result = analyzeBazi(baziInputObj);
        const yg: string = result?.trueGod??'';
        if (!yg||yg==='无'||!GAN_NAMES.includes(yg as GanName)) {
          setCalcError('暂无法推算用神，建议前往八字板块进行详细分析');
          setIsCalculating(false); return;
        }
        const data: StoredData = {
          yongshen:yg,
          name:nameHint||undefined,
        };
        setStoredData(data);
        localStorage.setItem(STORAGE_KEY,JSON.stringify(data));
        setShowSetup(false);
      } catch(e){ setCalcError('计算出错，请稍后再试'); console.error(e); }
      setIsCalculating(false);
    },400);
  },[]);

  // 从排盘记录选择
  const handleSelectRecord = useCallback((rec: ClassicalRecord)=>{
    const p = rec.params;
    const name = p.name?.trim()??'';
    if (p.mode==='bazi'&&p.gans&&p.zhis) {
      const gans = p.gans.split(',');
      const zhis = p.zhis.split(',');
      runCalculate(1990,1,1,0, name, {gans,zhis});
    } else if (p.year&&p.month&&p.day) {
      runCalculate(+p.year,+p.month,+p.day,+(p.hour??'0'), name);
    }
  },[runCalculate]);

  // 「修改」：重新打开排盘选择
  const handleReset = useCallback(()=>{ setCalcError(''); setShowSetup(true); },[]);

  const yongshen   = storedData?.yongshen??'';
  const yongshenWx = STEM_WUXING[yongshen]??'';
  const wxStyle    = yongshenWx ? WUXING_COLORS[yongshenWx] : {text:'#9e9588',bg:'transparent'};
  const level      = scoreData ? scoreLevel(Math.round(scoreData.finalScore)) : null;
  const isToday    = useMemo(()=>{const t=new Date();return year===t.getFullYear()&&month===t.getMonth()+1&&day===t.getDate();},[year,month,day]);

  // ── 骨架屏 ───────────────────────────────────────────────────────────────────
  if (!hydrated) return (
    <div className="w-full mb-8 rounded-2xl" style={{background:'#fbf9f4',border:'1px solid rgba(0,0,0,0.07)',boxShadow:'0 1px 3px rgba(0,0,0,0.04)'}}>
      <div className="px-5 pt-5 pb-5">
        <div className="flex gap-5 items-center">
          <div className="w-[104px] h-[104px] rounded-full bg-stone-100/80 animate-pulse flex-shrink-0"/>
          <div className="flex-1 space-y-2">
            <div className="h-7 bg-stone-100/80 rounded-lg animate-pulse w-24"/>
            <div className="h-3.5 bg-stone-100/60 rounded animate-pulse w-32"/>
          </div>
        </div>
      </div>
    </div>
  );

  // ── Setup ────────────────────────────────────────────────────────────────────
  if (showSetup) {
    const hasRecords = records && records.length > 0;
    const recordsLoading = records === null && !recordsFailed;

    return (
      <>
        {/* ── 主卡片 ── */}
        <motion.div key="setup"
          initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}} transition={{duration:.26}}
          className="mb-8 w-full rounded-[18px] bg-stone-900/[0.025] p-px ring-1 ring-stone-900/[0.055]"
          style={{boxShadow:'0 10px 30px rgba(66,57,45,0.035)'}}
        >
          <div className="relative overflow-hidden rounded-[17px] bg-[#fbf9f4] px-5 pb-5 pt-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
            <span className="absolute inset-x-5 top-0 h-px bg-stone-300/65" aria-hidden />
            {/* 标题栏 */}
            {storedData&&(
              <div className="mb-3 flex items-center justify-end">
                <button onClick={()=>setShowSetup(false)} className="text-[10px] font-sans" style={{color:'#c4bdb0'}}>取消</button>
              </div>
            )}

            {(hasRecords || recordsLoading) ? (
              /* ── 已有排盘：完整选择引导 ── */
              <div>
                <div className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-4 sm:grid-cols-[72px_minmax(0,1fr)] sm:gap-5">
                  <div className="grid grid-cols-4 gap-1.5 border-r border-stone-200/80 pr-4 sm:pr-5" aria-hidden>
                    {['年','月','日','时'].map((pillar,index)=>(
                      <div key={pillar} className="flex flex-col items-center gap-1.5">
                        <span className="font-sans text-[8px] text-stone-300">{pillar}</span>
                        <span
                          className="h-4 w-1 rounded-[1px]"
                          style={{background:['#8fa287','#b69883','#8799af','#a58f67'][index]}}
                        />
                        <span className="h-2.5 w-1 rounded-[1px] bg-stone-400/65" />
                      </div>
                    ))}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[17px] tracking-[0.08em] text-stone-700"
                        style={{fontFamily:'"Kaiti SC",KaiTi,STKaiti,"华文楷体","楷体",Georgia,serif'}}>
                        选择今日命盘
                      </h3>
                      {hasRecords && (
                        <span className="rounded-full bg-stone-900/[0.045] px-2 py-0.5 font-sans text-[9px] tracking-[0.08em] text-stone-400">
                          已存 {records!.length} 份
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-[11.5px] leading-[1.8] text-stone-500"
                      style={{fontFamily:'"Kaiti SC",KaiTi,STKaiti,"华文楷体","楷体",Georgia,serif'}}>
                      {recordsLoading
                        ? '正在整理你保存的命盘，请稍候。'
                        : '挑选一份已保存的命盘，为你推演今天的能量。'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2 font-sans text-[9px] tracking-[0.12em] text-stone-300" aria-hidden>
                  <span>挑选命盘</span>
                  <span className="h-px flex-1 bg-stone-200/80" />
                  <span>推演用神</span>
                  <span className="h-px flex-1 bg-stone-200/80" />
                  <span>查看今日能量</span>
                </div>

                <button
                  type="button"
                  aria-haspopup="dialog"
                  onClick={()=>setShowRecordPicker(true)}
                  disabled={recordsLoading || isCalculating}
                  className="group mt-4 flex min-h-11 w-full items-center gap-4 py-1 font-sans text-[11px] tracking-[0.16em] text-stone-600 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.99] disabled:cursor-wait disabled:opacity-60"
                >
                  <span className="h-px flex-1 bg-stone-200/90 transition-colors duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:bg-stone-300" aria-hidden />
                  <span className="transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:text-stone-800">
                    {recordsLoading ? '正在读取命盘' : '挑选一份命盘'}
                  </span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ebe3d8] text-[#7f6b59] ring-1 ring-inset ring-[#dfd3c5] transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-y-0.5 group-hover:scale-105 group-hover:bg-[#dfd3c5]">
                    {recordsLoading || isCalculating
                      ? <span className="h-3.5 w-3.5 rounded-full border border-stone-300 border-t-stone-600 animate-spin" />
                      : <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 5v14m0 0l-5-5m5 5l5-5"/>
                        </svg>
                    }
                  </span>
                </button>
              </div>
            ) : (
              /* ── 暂无排盘：引导至下方八字卡片 ── */
              <div className="border-t border-stone-200/70 pt-4">
                <div className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-4 sm:grid-cols-[72px_minmax(0,1fr)] sm:gap-5">
                  <div className="grid grid-cols-4 gap-1.5 border-r border-stone-200/80 pr-4 sm:pr-5" aria-hidden>
                    {['年','月','日','时'].map((pillar,index)=>(
                      <div key={pillar} className="flex flex-col items-center gap-1.5">
                        <span className="font-sans text-[8px] text-stone-300">{pillar}</span>
                        <span
                          className="h-4 w-1 rounded-[1px]"
                          style={{background:['#a8b6a1','#c3a895','#9caebe','#b9aa83'][index]}}
                        />
                        <span className="h-2.5 w-1 rounded-[1px] bg-stone-300/70" />
                      </div>
                    ))}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-[16px] tracking-[0.08em] text-stone-700"
                      style={{fontFamily:'"Kaiti SC",KaiTi,STKaiti,"华文楷体","楷体",Georgia,serif'}}>
                      请先创建八字排盘
                    </h3>
                    <p className="mt-1.5 text-[11.5px] leading-[1.8] text-stone-500"
                      style={{fontFamily:'"Kaiti SC",KaiTi,STKaiti,"华文楷体","楷体",Georgia,serif'}}>
                      填写出生日期和时间，完成排盘后即可查看专属于你的今日能量。
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2 font-sans text-[9px] tracking-[0.12em] text-stone-300" aria-hidden>
                  <span>填写出生信息</span>
                  <span className="h-px flex-1 bg-stone-200/80" />
                  <span>生成排盘</span>
                  <span className="h-px flex-1 bg-stone-200/80" />
                  <span>查看今日能量</span>
                </div>

                <button
                  type="button"
                  onClick={()=>document.getElementById('bazi-sheet')?.scrollIntoView({behavior:'smooth',block:'start'})}
                  className="group mt-4 flex min-h-11 w-full items-center gap-4 py-1 font-sans text-[11px] tracking-[0.16em] text-stone-600 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.99]"
                >
                  <span className="h-px flex-1 bg-stone-200/90 transition-colors duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:bg-stone-300" aria-hidden />
                  <span className="transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:text-stone-800">
                    开始创建排盘
                  </span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ebe3d8] text-[#7f6b59] ring-1 ring-inset ring-[#dfd3c5] transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-y-0.5 group-hover:scale-105 group-hover:bg-[#dfd3c5]">
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 5v14m0 0l-5-5m5 5l5-5"/>
                    </svg>
                  </span>
                </button>
              </div>
            )}

            {calcError&&<p className="text-[11px] font-sans mt-3" style={{color:'#9a4a4a'}}>{calcError}</p>}
          </div>
        </motion.div>

        {/* ── 八字排盘选择底部弹层 ── */}
        <AnimatePresence>
          {showRecordPicker && (
            <>
              {/* 遮罩 */}
              <motion.div
                initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:.22}}
                className="fixed inset-0 z-40"
                style={{background:'rgba(15,13,10,0.30)',backdropFilter:'blur(4px)'}}
                onClick={()=>setShowRecordPicker(false)}
              />
              {/* 面板 */}
              <motion.div
                initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}}
                transition={{type:'spring',damping:34,stiffness:300}}
                className="fixed inset-x-0 bottom-0 z-50 flex flex-col"
                style={{maxHeight:'80dvh',background:'#faf8f4',borderRadius:'24px 24px 0 0'}}
              >
                {/* 把手 */}
                <div className="flex-shrink-0 flex justify-center pt-3 pb-1">
                  <div className="w-8 h-[3px] rounded-full" style={{background:'#d4cdc3'}}/>
                </div>
                {/* 顶栏 */}
                <div className="flex-shrink-0 flex items-center justify-between px-6 py-2.5">
                  <span className="text-[10px] font-sans tracking-[0.34em]" style={{color:'#a39888'}}>
                    挑 选 命 盘
                  </span>
                  <button onClick={()=>setShowRecordPicker(false)}
                    className="w-7 h-7 flex items-center justify-center rounded-full transition-colors hover:bg-stone-100"
                    style={{color:'#a39888'}}>
                    <svg className="w-[15px] h-[15px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
                <div className="mx-6 h-px" style={{background:'rgba(0,0,0,0.07)'}}/>

                {/* 滚动列表 */}
                <div className="overflow-y-auto flex-1 px-6 py-4 pb-10">
                  {/* 加载中 */}
                  {recordsLoading && (
                    <div className="flex items-center justify-center gap-2 py-10">
                      <span className="w-4 h-4 border-2 border-stone-200 border-t-stone-500 rounded-full animate-spin"/>
                      <span className="text-[11px] font-sans" style={{color:'#b5ad9e'}}>加载中…</span>
                    </div>
                  )}

                  {/* 无记录 */}
                  {!recordsLoading && !hasRecords && (
                    <div className="text-center py-12">
                      <p className="text-[13px] mb-3" style={{color:'#9e9588',fontFamily:'"Kaiti SC",KaiTi,STKaiti,"华文楷体","楷体",Georgia,serif'}}>
                        暂无保存的八字记录
                      </p>
                      <button onClick={()=>setShowRecordPicker(false)}
                        className="text-[11.5px] font-sans flex items-center gap-1 mx-auto transition-opacity hover:opacity-70"
                        style={{color:'#9e9588'}}>
                        请在下方「八字命理」中排盘
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 14l-7 7m0 0l-7-7m7 7V3"/>
                        </svg>
                      </button>
                    </div>
                  )}

                  {/* 记录列表 */}
                  {hasRecords && (
                    <div className="rounded-2xl overflow-hidden" style={{border:'1px solid rgba(0,0,0,0.07)'}}>
                      {records!.map((rec, i) => {
                        const p = rec.params;
                        const name = p.name?.trim()??'';
                        const pillars = recordPillarDisplay(rec);
                        const dateStr = p.mode!=='bazi'&&p.year&&p.month&&p.day
                          ? `${p.year}年${p.month}月${p.day}日 ${String(p.hour??'?').padStart(2,'0')}时`
                          : '';
                        return (
                          <button key={rec.id}
                            onClick={()=>{ handleSelectRecord(rec); setShowRecordPicker(false); }}
                            disabled={isCalculating}
                            className="w-full text-left px-5 py-4 flex items-center justify-between gap-4 transition-colors"
                            style={{
                              background:'#fbf9f4',
                              borderBottom: i<records!.length-1 ? '1px solid rgba(0,0,0,0.06)' : 'none',
                            }}
                          >
                            <div className="flex-1 min-w-0">
                              {/* 姓名 + 日期 */}
                              <div className="flex items-baseline gap-2 mb-2 flex-wrap">
                                {name&&<span className="text-[14px]"
                                  style={{color:'#3d3935',fontFamily:'"Kaiti SC",KaiTi,STKaiti,"华文楷体","楷体",Georgia,serif'}}>
                                  {name}
                                </span>}
                                {dateStr&&<span className="text-[11px] font-sans" style={{color:'#9e9588'}}>{dateStr}</span>}
                                {!name&&!dateStr&&<span className="text-[11px] font-sans" style={{color:'#9e9588'}}>{recordLabel(rec)}</span>}
                              </div>
                              {/* 四柱干支 */}
                              {pillars && pillars.gans.length===4 && (
                                <div className="flex items-center gap-3">
                                  {['年','月','日','时'].map((lbl,idx)=>(
                                    <div key={idx} className="flex flex-col items-center gap-0.5">
                                      <span className="text-[8.5px] font-sans mb-0.5" style={{color:'#c4bdb0'}}>{lbl}</span>
                                      <span className="text-[16px] leading-none"
                                        style={{fontFamily:'"Kaiti SC",KaiTi,STKaiti,"华文楷体","楷体",Georgia,serif',
                                          color:WUXING_CHAR_COLOR[pillars.gans[idx]]??'#5a5248'}}>
                                        {pillars.gans[idx]}
                                      </span>
                                      <span className="text-[16px] leading-none"
                                        style={{fontFamily:'"Kaiti SC",KaiTi,STKaiti,"华文楷体","楷体",Georgia,serif',
                                          color:WUXING_CHAR_COLOR[pillars.zhis[idx]]??'#5a5248'}}>
                                        {pillars.zhis[idx]}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="#c4bdb0" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 5l7 7-7 7"/>
                            </svg>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </>
    );
  }

  // ── Score card ────────────────────────────────────────────────────────────────
  if (storedData && dayPillar && scoreData && level) {
    const {finalScore,items,totalAdj} = scoreData;
    return (
      <motion.div key="score"
        initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}} transition={{duration:.28}}
        className="w-full mb-8 rounded-2xl overflow-hidden"
        style={{background:'#fbf9f4',border:'1px solid rgba(0,0,0,0.07)',boxShadow:'0 1px 3px rgba(0,0,0,0.04)'}}>
        <div className="px-5 pt-5 pb-5">
          <div className="flex items-center justify-end gap-2.5 mb-4">
            {storedData.name&&<span className="text-[10px] font-sans" style={{color:'#9e9588'}}>{storedData.name}</span>}
            <span className="text-[10px] px-2 py-0.5 rounded-full font-sans" style={{background:wxStyle.bg,color:wxStyle.text}}>
              用神 {yongshen} · {yongshenWx}
            </span>
            <button onClick={handleReset} className="text-[10px] font-sans" style={{color:'#c4bdb0'}}>修改</button>
          </div>

          <div className="flex items-center gap-5 mb-4">
            <div className="relative flex-shrink-0 w-[104px] h-[104px]">
              <ScoreRing score={finalScore} color={level.color}/>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="leading-none tabular-nums" style={{fontSize:'30px',fontWeight:300,color:'#1e1c18',
                  fontFamily:'"Hiragino Mincho ProN","Songti SC","STSong",Georgia,serif',letterSpacing:'-0.02em'}}>
                  {finalScore % 1 === 0 ? finalScore : finalScore.toFixed(1)}
                </span>
                <span className="text-[9px] font-sans mt-0.5" style={{color:'#b5ad9e'}}>/ 100</span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 mb-2.5">
                <span className="text-[22px] leading-none" style={{color:level.color,fontFamily:'"Kaiti SC",KaiTi,STKaiti,"华文楷体","楷体",Georgia,serif'}}>{level.label}</span>
              </div>
              {dayPillar&&<p className="text-[11px] mb-2.5 leading-relaxed"
                style={{color:'#6b6254',fontFamily:'"Kaiti SC",KaiTi,STKaiti,"华文楷体","楷体",Georgia,serif'}}>
                {isToday?'今日':''}日柱&thinsp;<span style={{color:'#3d3935'}}>{dayPillar}</span>
              </p>}
              <div className="flex flex-wrap gap-1.5">
                {items.map((it,i)=>{
                  const rs=REL_STYLE[it.relation];
                  return <span key={i} className="text-[9.5px] font-sans px-1.5 py-0.5 rounded" style={{background:rs.bg,color:rs.text}}>{it.stem}{it.wx}&thinsp;{it.relation}</span>;
                })}
              </div>
            </div>
          </div>

          <button onClick={()=>setShowBreakdown(v=>!v)} className="flex items-center gap-1 mb-4 transition-opacity hover:opacity-70">
            <span className="text-[9.5px] font-sans" style={{color:'#b5ad9e'}}>能量明细</span>
            <motion.svg animate={{rotate:showBreakdown?90:0}} transition={{duration:.18}}
              className="w-2.5 h-2.5" fill="none" stroke="#b5ad9e" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5l7 7-7 7"/>
            </motion.svg>
          </button>

          <AnimatePresence>
            {showBreakdown&&(
              <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}} transition={{duration:.2}} className="overflow-hidden mb-4">
                <div className="rounded-xl overflow-hidden" style={{border:'1px solid rgba(0,0,0,0.06)',background:'#faf8f4'}}>
                  {/* 基础分 */}
                  <div className="flex items-center justify-between px-3.5 py-2.5" style={{borderBottom:'1px solid rgba(0,0,0,0.05)'}}>
                    <span className="text-[10px] font-sans" style={{color:'#b5ad9e',minWidth:'42px'}}>基础分</span>
                    <span className="text-[11px] font-sans tabular-nums" style={{color:'#5a7a5a'}}>+75.0分</span>
                  </div>
                  {items.map((it,i)=>{
                    const rs=REL_STYLE[it.relation]; const sign=it.contribution>=0?'+':'';
                    return (
                      <div key={i} className="flex items-center justify-between px-3.5 py-2.5"
                        style={{borderBottom:'1px solid rgba(0,0,0,0.05)'}}>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-sans" style={{color:'#b5ad9e',minWidth:'42px'}}>{it.label}</span>
                          <span className="text-[12px]" style={{color:'#3d3935',fontFamily:'"Kaiti SC",KaiTi,STKaiti,"华文楷体","楷体",Georgia,serif'}}>{it.stem}</span>
                          <span className="text-[9.5px] font-sans px-1.5 py-0.5 rounded" style={{background:rs.bg,color:rs.text}}>{it.wx}&thinsp;{it.relation}</span>
                        </div>
                        <span className="text-[11px] font-sans tabular-nums" style={{color:it.contribution>=0?'#5a7a5a':'#9a4a4a'}}>{sign}{it.contribution.toFixed(1)}分</span>
                      </div>
                    );
                  })}
                  {/* 调整合计 + 总分公式 */}
                  <div className="flex items-center justify-between px-3.5 py-2.5" style={{borderBottom:'1px solid rgba(0,0,0,0.05)'}}>
                    <span className="text-[10px] font-sans" style={{color:'#b5ad9e',minWidth:'42px'}}>调整合计</span>
                    <span className="text-[11px] font-sans tabular-nums" style={{color:totalAdj>=0?'#5a7a5a':'#9a4a4a'}}>{totalAdj>=0?'+':''}{totalAdj.toFixed(1)}分</span>
                  </div>
                  <div className="flex items-center justify-between px-3.5 py-2.5">
                    <span className="text-[10px] font-sans" style={{color:'#9e9588',minWidth:'42px'}}>总分</span>
                    <span className="text-[11px] font-sans tabular-nums" style={{color:'#3d3935'}}>
                      {totalAdj >= 0 ? `75 + ${totalAdj.toFixed(1)}` : `75 + (${totalAdj.toFixed(1)})`} = {finalScore % 1 === 0 ? finalScore : finalScore.toFixed(1)}分
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </motion.div>
    );
  }

  // ── 等待日柱加载 ──────────────────────────────────────────────────────────────
  return (
    <div className="w-full mb-8 rounded-2xl overflow-hidden"
      style={{background:'#fbf9f4',border:'1px solid rgba(0,0,0,0.07)',boxShadow:'0 1px 3px rgba(0,0,0,0.04)'}}>
      <div className="px-5 pt-5 pb-5">
        {storedData&&<div className="flex items-center justify-end gap-2 mb-4">
          {storedData.name&&<span className="text-[10px] font-sans" style={{color:'#9e9588'}}>{storedData.name}</span>}
          <span className="text-[10px] px-2 py-0.5 rounded-full font-sans" style={{background:wxStyle.bg,color:wxStyle.text}}>用神 {yongshen} · {yongshenWx}</span>
        </div>}
        <div className="flex gap-5 items-center">
          <div className="w-[104px] h-[104px] rounded-full bg-stone-100/80 animate-pulse flex-shrink-0"/>
          <div className="flex-1 space-y-2">
            <div className="h-7 bg-stone-100/80 rounded-lg animate-pulse w-24"/>
            <div className="h-3.5 bg-stone-100/60 rounded animate-pulse w-32"/>
            <div className="h-3.5 bg-stone-100/60 rounded animate-pulse w-20"/>
          </div>
        </div>
      </div>
    </div>
  );
};
