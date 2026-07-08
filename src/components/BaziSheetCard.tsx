'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { buildBaziImportData } from '@/utils/baziImport';
import type { BaziInput } from '@/utils/baziLogic';
import {
  getCityLongitude,
  domesticProvinces,
  provinceData,
} from '@/utils/baziLocation';
import { AnchorDropdownSelect, type DropdownOption } from '@/components/AnchorDropdownSelect';

const KAITI = '"Kaiti SC", KaiTi, STKaiti, "华文楷体", "楷体", Georgia, serif';
const CACHE_KEY = 'bazi-input-cache-v1';

type LocationInfo = { province: string; city: string; longitude: number };
type DateInputState = { year: number; month: number; day: number; hour: number; minute: number; location?: LocationInfo };
type LunarDateInputState = DateInputState & { isLeapMonth: boolean };

const GANS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const ZHIS = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

const YIN_YANG = {
  ganYang: ['甲', '丙', '戊', '庚', '壬'],
  zhiYang: ['子', '寅', '辰', '午', '申', '戌'],
};

const WUXING_COLOR: Record<string, string> = {
  '甲': '#7a9b85', '乙': '#7a9b85', '寅': '#7a9b85', '卯': '#7a9b85',
  '丙': '#ba6e65', '丁': '#ba6e65', '巳': '#ba6e65', '午': '#ba6e65',
  '戊': '#8B5F45', '己': '#8B5F45', '辰': '#8B5F45', '戌': '#8B5F45', '丑': '#8B5F45', '未': '#8B5F45',
  '庚': '#B09F73', '辛': '#B09F73', '申': '#B09F73', '酉': '#B09F73',
  '壬': '#6b7c97', '癸': '#6b7c97', '子': '#6b7c97', '亥': '#6b7c97',
};

const daysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();
const yearOptions = Array.from({ length: 151 }, (_, i) => 1900 + i);
const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);
const hourOptions = Array.from({ length: 24 }, (_, i) => i);
const minuteOptions = Array.from({ length: 60 }, (_, i) => i);
const getZhiOptions = (gan: string) =>
  !gan ? ZHIS : YIN_YANG.ganYang.includes(gan)
    ? ZHIS.filter((z) => YIN_YANG.zhiYang.includes(z))
    : ZHIS.filter((z) => !YIN_YANG.zhiYang.includes(z));

const toDropdownOptions = (items: (number | string)[]): DropdownOption[] =>
  items.map((item) => ({ value: String(item), label: String(item) }));

const toWuxingOptions = (items: string[]): DropdownOption[] =>
  items.map((item) => ({ value: item, label: item, color: WUXING_COLOR[item] }));

const provinceOptions: DropdownOption[] = [
  { value: '', label: '不填写' },
  ...domesticProvinces.map((p) => ({ value: p, label: p, group: '国内' })),
  { value: '国外', label: '国外时区', group: '国外' },
];

const segBtn = (active: boolean, compact?: boolean) =>
  `flex-1 rounded-lg ${compact ? 'py-1.5 text-[12px]' : 'py-2.5 text-[12px]'} tracking-wide transition-all duration-200 ${active ? 'bg-[#fbf9f4] text-stone-800 shadow-[0_1px_3px_rgba(30,28,24,0.08)] ring-1 ring-[#e8e3d8]/80' : 'text-stone-500 hover:text-stone-700'}`;

const GENDER_OPTIONS: { value: '乾造' | '坤造'; sub: string }[] = [
  { value: '乾造', sub: '男' },
  { value: '坤造', sub: '女' },
];

/** 姓名与乾造/坤造：左右两个独立区域，姓名为主、性别紧凑 */
const ProfileGenderRow: React.FC<{
  name: string;
  onNameChange: (v: string) => void;
  gender: '乾造' | '坤造';
  onGenderChange: (g: '乾造' | '坤造') => void;
}> = ({ name, onNameChange, gender, onGenderChange }) => (
  <div className="grid grid-cols-[minmax(0,1fr)_7.75rem] items-stretch gap-3 max-[380px]:grid-cols-1">
    <label className="flex min-w-0 rounded-xl border border-[#e8e3d8]/90 bg-transparent px-4 py-2.5 transition-colors focus-within:border-stone-300">
      <input
        type="text"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder="姓名 / 备注"
        autoComplete="off"
        spellCheck={false}
        className="min-w-0 w-full bg-transparent text-[14px] leading-none text-[#3d3935] placeholder:text-[#c4bdb0] focus-visible:outline-none"
        style={{ fontFamily: KAITI }}
      />
    </label>

    <div className="relative rounded-xl bg-[#f3f0e9]/65 p-1 ring-1 ring-inset ring-[#e8e3d8]/60" role="group" aria-label="乾造或坤造">
      <motion.div
        className="pointer-events-none absolute top-1 bottom-1 rounded-lg bg-[#fbf9f4] shadow-[0_1px_3px_rgba(30,28,24,0.06)] ring-1 ring-[#e8e3d8]/80"
        style={{ width: 'calc(50% - 4px)' }}
        initial={false}
        animate={{ left: gender === '乾造' ? 4 : 'calc(50% + 2px)' }}
        transition={{ type: 'spring', damping: 28, stiffness: 380 }}
      />
      <div className="relative z-[1] grid h-full grid-cols-2 gap-1">
        {GENDER_OPTIONS.map((opt) => {
          const active = gender === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onGenderChange(opt.value)}
              aria-pressed={active}
              className={`flex flex-col items-center justify-center rounded-lg py-2 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400/70 active:scale-[0.98] ${
                active ? 'text-stone-800' : 'text-stone-400 hover:text-stone-600'
              }`}
            >
              <span className="text-[14px] leading-none tracking-[0.08em]" style={{ fontFamily: KAITI }}>
                {opt.value}
              </span>
              <span className={`mt-0.5 font-sans text-[9px] tracking-[0.18em] ${active ? 'text-stone-500' : 'text-stone-400/85'}`}>
                {opt.sub}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  </div>
);

// ── 居中弹窗 ───────────────────────────────────────────────────
const CenterModal: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  dense?: boolean;
  children: React.ReactNode;
  footer: React.ReactNode;
}> = ({ open, onClose, title, subtitle, dense, children, footer }) => (
  <AnimatePresence>
    {open && (
      <>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          className="fixed inset-0 z-40 backdrop-blur-[3px]"
          style={{ background: 'rgba(22,20,17,0.40)' }}
          onClick={onClose}
        />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none sm:p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 6 }}
            transition={{ type: 'spring', damping: 26, stiffness: 340 }}
            className={`pointer-events-auto flex w-full max-w-[368px] flex-col overflow-hidden rounded-[20px] bg-[#faf8f4] p-1 shadow-[0_20px_60px_rgba(28,24,18,0.16),0_0_0_1px_rgba(232,227,216,0.9)] ${dense ? 'max-h-[92dvh]' : 'max-h-[min(90dvh,580px)]'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`flex flex-col overflow-hidden rounded-[calc(20px-4px)] bg-[#fbf9f4] ring-1 ring-inset ring-white/60 ${dense ? '' : 'min-h-0 flex-1'}`}>
              <div className={`relative flex-shrink-0 ${dense ? 'px-4 pb-2 pt-3.5' : 'px-5 pb-4 pt-5'}`}>
                <div className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-stone-300/90 to-transparent" />
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 pr-2">
                    <h3 className={`tracking-[0.06em] text-stone-800 ${dense ? 'text-[16px] leading-tight' : 'text-[17px] leading-snug'}`} style={{ fontFamily: KAITI }}>{title}</h3>
                    {subtitle && (
                      <p className={`font-sans text-stone-400 ${dense ? 'mt-0.5 text-[10px] leading-snug' : 'mt-1.5 text-[11px] leading-relaxed'}`}>{subtitle}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    aria-label="关闭"
                    onClick={onClose}
                    className={`flex flex-shrink-0 items-center justify-center rounded-full bg-stone-100/80 text-stone-400 transition-colors hover:bg-stone-200/80 hover:text-stone-600 ${dense ? 'h-7 w-7' : 'h-8 w-8'}`}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <div
                className={`flex-shrink-0 ${dense ? 'overflow-hidden px-4 pb-2' : 'flex-1 overflow-y-auto px-5 pb-1 custom-scrollbar'}`}
                style={dense ? undefined : { overscrollBehavior: 'contain' }}
              >
                {children}
              </div>
              <div className={`flex-shrink-0 border-t border-[#ebe6dc] ${dense ? 'px-4 py-2.5' : 'px-5 py-4'}`}>
                {footer}
              </div>
            </div>
          </motion.div>
        </div>
      </>
    )}
  </AnimatePresence>
);

const ModalSection: React.FC<{ title: string; children: React.ReactNode; className?: string; dense?: boolean }> = ({
  title,
  children,
  className,
  dense,
}) => (
  <div className={`rounded-lg bg-[#f5f2ec]/80 ring-1 ring-inset ring-[#e8e3d8]/70 ${dense ? 'p-2' : 'p-3.5'} ${className ?? ''}`}>
    <div className={`flex items-center gap-1.5 ${dense ? 'mb-1.5' : 'mb-3'}`}>
      <span className={`w-[2px] rounded-full bg-stone-400/70 ${dense ? 'h-2.5' : 'h-3.5'}`} aria-hidden />
      <span className="font-sans text-[10px] font-medium tracking-[0.2em] text-stone-500">{title}</span>
    </div>
    {children}
  </div>
);

const PickerRow: React.FC<{
  label: string;
  value: string;
  placeholder: string;
  onClick: () => void;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}> = ({ label, value, placeholder, onClick, icon, badge }) => {
  const filled = value.trim().length > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center justify-between gap-3 rounded-xl border border-[#e8e3d8]/90 bg-transparent px-4 py-3.5 text-left transition-all duration-200 hover:border-[#ddd6c8] hover:bg-[#f5f2ec]/55 active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400/80"
      style={{ touchAction: 'manipulation' }}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2.5">
        {icon}
        <span className="flex min-w-0 flex-col gap-1">
          <span className="font-sans text-[10px] font-medium tracking-[0.12em] text-stone-400">{label}</span>
          <span
            className={`truncate text-[13.5px] leading-snug ${filled ? 'text-[#3d3935]' : 'text-[#b5ad9e]'}`}
            style={{ fontFamily: filled ? KAITI : undefined }}
          >
            {filled ? value : placeholder}
          </span>
        </span>
      </span>
      <span className="flex flex-shrink-0 items-center gap-2">
        {badge}
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-100/80 text-stone-400 transition-colors group-hover:bg-stone-200/80 group-hover:text-stone-500">
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </span>
    </button>
  );
};

function formatDateSummary(
  calendarType: 'solar' | 'lunar',
  dateInput: DateInputState,
  lunarDateInput: LunarDateInputState,
): string {
  const d = calendarType === 'lunar' ? lunarDateInput : dateInput;
  const cal = calendarType === 'lunar' ? '农历' : '公历';
  const leap = calendarType === 'lunar' && lunarDateInput.isLeapMonth ? ' · 闰月' : '';
  return `${d.year}年${d.month}月${d.day}日 ${String(d.hour).padStart(2, '0')}:${String(d.minute).padStart(2, '0')} · ${cal}${leap}`;
}

export const BaziSheetCard: React.FC = () => {
  const router = useRouter();
  const loadedRef = useRef(false);

  const [inputMode, setInputMode] = useState<'date' | 'bazi'>('date');
  const [calendarType, setCalendarType] = useState<'solar' | 'lunar'>('solar');
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'乾造' | '坤造'>('乾造');

  const [dateInput, setDateInput] = useState<DateInputState>({ year: 2000, month: 1, day: 1, hour: 12, minute: 0 });
  const [lunarDateInput, setLunarDateInput] = useState<LunarDateInputState>({ year: 2000, month: 1, day: 1, hour: 12, minute: 0, isLeapMonth: false });
  const [baziInput, setBaziInput] = useState({ gans: ['甲', '乙', '丙', '丁'], zhis: ['子', '丑', '寅', '卯'] });

  const [quickDateText, setQuickDateText] = useState('');
  const [quickBaziText, setQuickBaziText] = useState('');

  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedCity, setSelectedCity] = useState('');

  const [showBirthModal, setShowBirthModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);

  const [draftCalendarType, setDraftCalendarType] = useState<'solar' | 'lunar'>('solar');
  const [draftDateInput, setDraftDateInput] = useState<DateInputState>(dateInput);
  const [draftLunarDateInput, setDraftLunarDateInput] = useState<LunarDateInputState>(lunarDateInput);
  const [draftQuickDateText, setDraftQuickDateText] = useState('');

  const [pickerProvince, setPickerProvince] = useState('');
  const [pickerCity, setPickerCity] = useState('');

  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p?.inputMode) setInputMode(p.inputMode);
        if (p?.calendarType) setCalendarType(p.calendarType);
        if (typeof p?.name === 'string') setName(p.name);
        if (p?.gender) setGender(p.gender);
        if (p?.dateInput) setDateInput(p.dateInput);
        if (p?.lunarDateInput) setLunarDateInput(p.lunarDateInput);
        if (p?.baziInput) setBaziInput(p.baziInput);
        if (typeof p?.selectedProvince === 'string') setSelectedProvince(p.selectedProvince);
        if (typeof p?.selectedCity === 'string') setSelectedCity(p.selectedCity);
        if (typeof p?.quickDateInputText === 'string') setQuickDateText(p.quickDateInputText);
        if (typeof p?.quickInputText === 'string') setQuickBaziText(p.quickInputText);
      }
    } catch { /* ignore */ } finally { loadedRef.current = true; }
  }, []);

  useEffect(() => {
    if (!loadedRef.current) return;
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        inputMode, calendarType, name, gender, dateInput, lunarDateInput, baziInput,
        selectedProvince, selectedCity,
        quickDateInputText: quickDateText, quickInputText: quickBaziText,
      }));
    } catch { /* ignore */ }
  }, [inputMode, calendarType, name, gender, dateInput, lunarDateInput, baziInput, selectedProvince, selectedCity, quickDateText, quickBaziText]);

  useEffect(() => {
    const max = daysInMonth(dateInput.year, dateInput.month);
    if (dateInput.day > max) setDateInput((p) => ({ ...p, day: max }));
  }, [dateInput.year, dateInput.month, dateInput.day]);

  const activeDate = calendarType === 'lunar' ? lunarDateInput : dateInput;

  const parseDateQuick = (text: string, target: 'committed' | 'draft' = 'committed') => {
    if (!text.trim()) return;
    const t = text.replace(/\s+/g, '');
    let y: number | null = null, m: number | null = null, d: number | null = null, h: number | null = null, mi: number | null = null;
    const ym = t.match(/(\d{4})年/), mm = t.match(/(\d{1,2})月/), dm = t.match(/(\d{1,2})日/), hm = t.match(/(\d{1,2})(?:时|点)/), mim = t.match(/(\d{1,2})分/);
    if (ym && mm && dm) {
      y = +ym[1]; m = +mm[1]; d = +dm[1];
      if (hm) h = +hm[1];
      if (mim) mi = +mim[1];
    } else {
      const dt = t.match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})(?:日)?(?:[T\s](\d{1,2})(?::|时)?(\d{1,2})?)?/);
      if (dt) { y = +dt[1]; m = +dt[2]; d = +dt[3]; if (dt[4]) h = +dt[4]; if (dt[5]) mi = +dt[5]; }
    }
    if (!y || !m || !d) return;
    const patch = (prev: DateInputState) => ({ ...prev, year: y!, month: m!, day: d!, hour: h ?? prev.hour, minute: mi ?? prev.minute });
    const cal = target === 'draft' ? draftCalendarType : calendarType;
    if (target === 'draft') {
      if (cal === 'solar') setDraftDateInput(patch);
      else setDraftLunarDateInput((prev) => ({ ...prev, ...patch(prev) }));
    } else {
      if (cal === 'solar') setDateInput(patch);
      else setLunarDateInput((prev) => ({ ...prev, ...patch(prev) }));
    }
  };

  const parseBaziQuick = (text: string) => {
    if (!text.trim()) return;
    const clean = text.replace(/\s+/g, '');
    const pairs: string[] = [];
    for (let i = 0; i + 1 < clean.length; i += 2) pairs.push(clean.slice(i, i + 2));
    if (pairs.length < 4) return;
    const gans: string[] = [], zhis: string[] = [];
    for (const pair of pairs.slice(0, 4)) {
      const [g, z] = pair.split('');
      if (!GANS.includes(g) || !ZHIS.includes(z)) return;
      if (YIN_YANG.ganYang.includes(g) !== YIN_YANG.zhiYang.includes(z)) return;
      gans.push(g); zhis.push(z);
    }
    setBaziInput({ gans, zhis });
  };

  const openBirthModal = () => {
    setDraftCalendarType(calendarType);
    setDraftDateInput({ ...dateInput });
    setDraftLunarDateInput({ ...lunarDateInput });
    setDraftQuickDateText(quickDateText);
    setShowBirthModal(true);
  };
  const applyBirthModal = () => {
    setCalendarType(draftCalendarType);
    setDateInput(draftDateInput);
    setLunarDateInput(draftLunarDateInput);
    setQuickDateText(draftQuickDateText);
    setShowBirthModal(false);
  };

  const openLocationModal = () => {
    setPickerProvince(selectedProvince);
    setPickerCity(selectedCity);
    setShowLocationModal(true);
  };
  const applyLocation = (province: string, city: string) => {
    setSelectedProvince(province);
    setSelectedCity(city);
    const loc = province && city ? { province, city, longitude: getCityLongitude(city) } : undefined;
    setDateInput((p) => ({ ...p, location: loc }));
    setLunarDateInput((p) => ({ ...p, location: loc }));
    setShowLocationModal(false);
  };
  const clearLocation = () => applyLocation('', '');

  const hasTrueSolar = inputMode === 'date' && !!activeDate.location && Math.abs(activeDate.location.longitude - 120) > 0.0001;

  const buildInput = async (): Promise<BaziInput> => {
    if (inputMode === 'bazi') return { ...dateInput, directBazi: baziInput };
    if (calendarType === 'lunar') {
      const { Lunar } = await import('lunar-javascript');
      const solar = Lunar.fromYmd(lunarDateInput.year, lunarDateInput.month, lunarDateInput.day, lunarDateInput.isLeapMonth).getSolar();
      return { year: solar.getYear(), month: solar.getMonth(), day: solar.getDay(), hour: lunarDateInput.hour, minute: lunarDateInput.minute, location: lunarDateInput.location };
    }
    return { ...dateInput };
  };

  const handleClassical = async () => {
    const params = new URLSearchParams();
    if (name) params.set('name', name);
    params.set('gender', gender);
    if (inputMode === 'bazi') {
      params.set('mode', 'bazi');
      params.set('gans', baziInput.gans.join(','));
      params.set('zhis', baziInput.zhis.join(','));
    } else {
      params.set('mode', 'date');
      const input = await buildInput();
      params.set('year', String(input.year));
      params.set('month', String(input.month));
      params.set('day', String(input.day));
      params.set('hour', String(input.hour));
      params.set('minute', String(input.minute ?? 0));
      const loc = input.location;
      if (loc?.province && loc?.city) {
        params.set('province', loc.province);
        params.set('city', loc.city);
        params.set('longitude', String(loc.longitude));
      }
    }
    router.push(`/report/classical?${params.toString()}`);
  };

  const handleAI = async () => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    try {
      const input = await buildInput();
      const birthDate = inputMode === 'date'
        ? `${input.year}年${input.month}月${input.day}日 ${String(input.hour).padStart(2, '0')}:${String(input.minute ?? 0).padStart(2, '0')}`
        : undefined;
      const importData = { bazi: [buildBaziImportData(input, { name: name || undefined, gender, birthDate })] };
      localStorage.removeItem('juexingcang-import-pending');
      localStorage.setItem('juexingcang-import-pending', JSON.stringify(importData));
      localStorage.setItem('juexingcang-input-preset', '请帮我解析该八字');
      router.push('/?tab=juexingcang');
    } catch (e) {
      console.error('AI分析失败:', e);
      setIsAnalyzing(false);
    }
  };

  const updateDraftDate = (patch: Partial<DateInputState>) => {
    if (draftCalendarType === 'solar') setDraftDateInput((p) => ({ ...p, ...patch }));
    else setDraftLunarDateInput((p) => ({ ...p, ...patch }));
  };

  const draftActiveDate = draftCalendarType === 'lunar' ? draftLunarDateInput : draftDateInput;
  const draftDayOptions = Array.from(
    { length: draftCalendarType === 'lunar' ? 30 : daysInMonth(draftDateInput.year, draftDateInput.month) },
    (_, i) => i + 1,
  );

  const modalFooter = (onApply: () => void, onCancel: () => void, applyLabel = '确定', compact = false) => (
    <div className={`flex ${compact ? 'gap-2' : 'gap-2.5'}`}>
      <button
        type="button"
        onClick={onCancel}
        className={`flex-1 rounded-xl bg-stone-100/60 text-[13px] text-stone-600 ring-1 ring-[#e8e3d8]/80 transition-colors hover:bg-stone-100 ${compact ? 'py-2.5' : 'py-3'}`}
      >
        取消
      </button>
      <button
        type="button"
        onClick={onApply}
        className={`flex-1 rounded-xl bg-[#3d3935] text-[13px] tracking-wide text-[#f5f2ed] shadow-[0_2px_8px_rgba(30,28,24,0.15)] transition-colors hover:bg-stone-700 active:scale-[0.98] ${compact ? 'py-2.5' : 'py-3'}`}
        style={{ fontFamily: KAITI }}
      >
        {applyLabel}
      </button>
    </div>
  );

  const draftPreviewText = `${draftActiveDate.year}年${draftActiveDate.month}月${draftActiveDate.day}日 ${String(draftActiveDate.hour).padStart(2, '0')}:${String(draftActiveDate.minute).padStart(2, '0')}${
    draftCalendarType === 'lunar' ? (draftLunarDateInput.isLeapMonth ? ' · 农历闰月' : ' · 农历') : ' · 公历'
  }`;

  const locationIcon = (
    <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" stroke="#a39888" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <circle cx="12" cy="11" r="2.5" strokeWidth={1.6} />
    </svg>
  );

  return (
    <>
      <div className="relative overflow-hidden rounded-[22px] border border-stone-200/80 bg-[#fbf9f4]">
        <div className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-stone-300/80 to-transparent" />

        <div className="px-5 pb-5 pt-6">
          <div className="mb-5">
            <header className="space-y-1.5">
              <h2
                className="text-[20px] font-normal leading-tight tracking-[0.2em] text-stone-800"
                style={{ fontFamily: KAITI }}
              >
                八字命理
              </h2>
              <p className="font-sans text-[11px] tracking-[0.06em] text-stone-400/90">
                填入即可排盘 · 已校准真太阳时
              </p>
            </header>
            <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl border border-[#e8e3d8]/90 bg-[#f3f0e9]/65 p-1">
              <button type="button" onClick={() => setInputMode('date')} className={segBtn(inputMode === 'date')}>
                日期排盘
              </button>
              <button type="button" onClick={() => setInputMode('bazi')} className={segBtn(inputMode === 'bazi')}>
                八字排盘
              </button>
            </div>
          </div>

          <div className="mb-4 h-px bg-stone-200/70" />

          <div className="space-y-3">
            <ProfileGenderRow
              name={name}
              onNameChange={setName}
              gender={gender}
              onGenderChange={setGender}
            />

            {inputMode === 'date' ? (
              <>
                <PickerRow
                  label="出生时间"
                  value={formatDateSummary(calendarType, dateInput, lunarDateInput)}
                  placeholder="点击选择年月日时分"
                  onClick={openBirthModal}
                />
                <PickerRow
                  label="出生地"
                  value={selectedProvince && selectedCity ? `${selectedProvince} ${selectedCity}` : ''}
                  placeholder="出生地（可不填）"
                  onClick={openLocationModal}
                  icon={locationIcon}
                  badge={hasTrueSolar ? (
                    <span className="rounded-full px-1.5 py-0.5 font-sans text-[9px]" style={{ background: 'rgba(122,155,133,0.14)', color: '#5d7a5a' }}>真太阳时</span>
                  ) : undefined}
                />
              </>
            ) : (
              <div className="space-y-3 rounded-xl border border-[#e8e3d8]/90 bg-transparent px-4 py-3.5">
                <span className="block font-sans text-[10px] font-medium tracking-[0.12em] text-stone-400">四柱八字</span>
                <input
                  type="text"
                  value={quickBaziText}
                  onChange={(e) => { setQuickBaziText(e.target.value); parseBaziQuick(e.target.value); }}
                  placeholder="快捷粘贴：辛巳 丁丑 丁巳 癸巳…"
                  spellCheck={false}
                  className="w-full rounded-xl border-0 bg-[#f8f6f0] px-3 py-2.5 text-center text-[13px] text-stone-600 shadow-[inset_0_1px_2px_rgba(30,28,24,0.04)] ring-1 ring-[#e8e3d8]/90 placeholder:text-stone-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400/60"
                  style={{ fontFamily: KAITI }}
                />
                <div className="grid grid-cols-4 gap-2">
                  {['年', '月', '日', '时'].map((pillar, idx) => (
                    <div key={pillar} className="space-y-1">
                      <div className="text-center font-sans text-[9px] text-stone-400">{pillar}柱</div>
                      <AnchorDropdownSelect
                        variant="compact"
                        aria-label={`${pillar}柱天干`}
                        value={baziInput.gans[idx]}
                        options={toWuxingOptions(GANS)}
                        valueColor={WUXING_COLOR[baziInput.gans[idx]]}
                        useKaitiValue
                        onChange={(g) => {
                          const z = baziInput.zhis[idx];
                          const keep = YIN_YANG.ganYang.includes(g) === YIN_YANG.zhiYang.includes(z) ? z : '';
                          const gans = [...baziInput.gans];
                          const zhis = [...baziInput.zhis];
                          gans[idx] = g;
                          zhis[idx] = keep;
                          setBaziInput({ gans, zhis });
                        }}
                      />
                      <AnchorDropdownSelect
                        variant="compact"
                        aria-label={`${pillar}柱地支`}
                        value={baziInput.zhis[idx]}
                        options={toWuxingOptions(getZhiOptions(baziInput.gans[idx]))}
                        valueColor={WUXING_COLOR[baziInput.zhis[idx]]}
                        useKaitiValue
                        onChange={(z) => {
                          const zhis = [...baziInput.zhis];
                          zhis[idx] = z;
                          setBaziInput({ ...baziInput, zhis });
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-5 flex gap-2.5">
            <button
              type="button"
              onClick={handleClassical}
              className="flex-1 rounded-lg border border-stone-300/90 bg-transparent py-2.5 text-[13px] tracking-wide text-stone-600 transition-colors hover:bg-stone-50 active:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400"
              style={{ fontFamily: KAITI }}
            >
              古典排盘
            </button>
            <button
              type="button"
              onClick={handleAI}
              disabled={isAnalyzing}
              className="flex-1 rounded-lg bg-[#3d3935] py-2.5 text-[13px] tracking-wide text-[#f5f2ed] shadow-sm transition-colors hover:bg-stone-700 active:bg-stone-900 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400"
              style={{ fontFamily: KAITI }}
            >
              {isAnalyzing ? '分析中…' : 'AI 解析'}
            </button>
          </div>
        </div>
      </div>

      {/* 出生时间 · 居中弹窗 */}
      <CenterModal
        open={showBirthModal}
        onClose={() => setShowBirthModal(false)}
        dense
        title="出生时间"
        subtitle="公历 / 农历 · 可快捷粘贴"
        footer={modalFooter(applyBirthModal, () => setShowBirthModal(false), '确定', true)}
      >
        <div className="mb-2 flex gap-1 rounded-lg border border-[#e8e3d8]/90 bg-[#f3f0e9] p-0.5">
          <button type="button" onClick={() => setDraftCalendarType('solar')} className={segBtn(draftCalendarType === 'solar', true)}>公历</button>
          <button type="button" onClick={() => setDraftCalendarType('lunar')} className={segBtn(draftCalendarType === 'lunar', true)}>农历</button>
        </div>

        <label className="mb-2 block">
          <span className="mb-1 block font-sans text-[10px] tracking-[0.12em] text-stone-400">快捷粘贴</span>
          <input
            type="text"
            value={draftQuickDateText}
            onChange={(e) => { setDraftQuickDateText(e.target.value); parseDateQuick(e.target.value, 'draft'); }}
            placeholder="2001年7月28日19时27分"
            spellCheck={false}
            className="w-full rounded-lg border-0 bg-[#f8f6f0] px-3 py-2 text-[12.5px] text-stone-700 shadow-[inset_0_1px_2px_rgba(30,28,24,0.04)] ring-1 ring-[#e8e3d8]/90 placeholder:text-stone-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400/60"
          />
        </label>

        <ModalSection title="日期" dense className="mb-2">
          <div className="flex gap-1.5">
            <AnchorDropdownSelect variant="date" fieldLabel="年" wide useKaitiValue value={String(draftActiveDate.year)} options={toDropdownOptions(yearOptions)} onChange={(v) => updateDraftDate({ year: +v })} />
            <AnchorDropdownSelect variant="date" fieldLabel="月" useKaitiValue value={String(draftActiveDate.month)} options={toDropdownOptions(monthOptions)} onChange={(v) => updateDraftDate({ month: +v })} />
            <AnchorDropdownSelect variant="date" fieldLabel="日" useKaitiValue value={String(draftActiveDate.day)} options={toDropdownOptions(draftDayOptions)} onChange={(v) => updateDraftDate({ day: +v })} />
            {draftCalendarType === 'lunar' && (
              <AnchorDropdownSelect
                variant="date"
                fieldLabel="闰"
                useKaitiValue
                value={draftLunarDateInput.isLeapMonth ? '闰' : '平'}
                options={toDropdownOptions(['平', '闰'])}
                onChange={(v) => setDraftLunarDateInput((p) => ({ ...p, isLeapMonth: v === '闰' }))}
                className="flex-[0.85]"
              />
            )}
          </div>
        </ModalSection>

        <ModalSection title="时刻" dense className="mb-2">
          <div className="flex gap-1.5">
            <AnchorDropdownSelect variant="date" fieldLabel="时" useKaitiValue value={String(draftActiveDate.hour)} options={toDropdownOptions(hourOptions)} onChange={(v) => updateDraftDate({ hour: +v })} />
            <AnchorDropdownSelect variant="date" fieldLabel="分" useKaitiValue value={String(draftActiveDate.minute)} options={toDropdownOptions(minuteOptions)} onChange={(v) => updateDraftDate({ minute: +v })} />
          </div>
        </ModalSection>

        <p className="rounded-lg bg-[#3d3935]/[0.05] px-3 py-2 text-center text-[12.5px] leading-snug text-stone-700 ring-1 ring-inset ring-[#e8e3d8]/45" style={{ fontFamily: KAITI }}>
          {draftPreviewText}
        </p>
      </CenterModal>

      {/* 出生地 · 居中弹窗 */}
      <CenterModal
        open={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        title="出生地点"
        subtitle="用于真太阳时校正 · 可不填"
        footer={
          <div className="space-y-3">
            {modalFooter(() => applyLocation(pickerProvince, pickerCity), () => setShowLocationModal(false))}
            <button
              type="button"
              onClick={clearLocation}
              className="w-full font-sans text-[11px] text-stone-400 underline-offset-2 transition-colors hover:text-stone-600 hover:underline"
            >
              暂不填写出生地
            </button>
          </div>
        }
      >
        <ModalSection title="所在地区">
          <div className="space-y-4">
          <label className="block">
            <span className="mb-2 block font-sans text-[11px] font-medium tracking-[0.14em] text-stone-500">省份</span>
            <AnchorDropdownSelect
              variant="modal"
              value={pickerProvince}
              options={provinceOptions}
              placeholder="不填写"
              onChange={(v) => { setPickerProvince(v); setPickerCity(''); }}
            />
          </label>
          <label className="block">
            <span className="mb-2 block font-sans text-[11px] font-medium tracking-[0.14em] text-stone-500">
              {pickerProvince === '国外' ? '时区' : '城市'}
            </span>
            <AnchorDropdownSelect
              variant="modal"
              value={pickerCity}
              disabled={!pickerProvince}
              placeholder={pickerProvince === '国外' ? '请选择时区' : '请选择城市'}
              options={[
                { value: '', label: pickerProvince === '国外' ? '请选择时区' : '请选择城市' },
                ...(pickerProvince ? (provinceData[pickerProvince] || []).map((c) => ({ value: c, label: c })) : []),
              ]}
              onChange={setPickerCity}
            />
          </label>
          </div>
        </ModalSection>
        {(pickerProvince && pickerCity) && (
          <p className="mt-3 text-center text-[13px] text-stone-600" style={{ fontFamily: KAITI }}>
            {pickerProvince} {pickerCity}
          </p>
        )}
      </CenterModal>
    </>
  );
};
