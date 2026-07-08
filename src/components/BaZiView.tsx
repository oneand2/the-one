'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Clock, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { BaziInput } from '@/utils/baziLogic';
import { buildBaziImportData } from '@/utils/baziImport';
import {
  getCityLongitude,
  domesticProvinces,
  provinceData,
} from '@/utils/baziLocation';

type LocationInfo = {
  province: string;
  city: string;
  longitude: number;
};

type DateInputState = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  location?: LocationInfo;
};

type LunarDateInputState = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  isLeapMonth: boolean;
  location?: LocationInfo;
};

export const BaZiView: React.FC = () => {
  const router = useRouter();
  const hasLoadedCacheRef = useRef(false);
  const cacheKey = 'bazi-input-cache-v1';
  const [inputMode, setInputMode] = useState<'date' | 'bazi'>('date');
  const [calendarType, setCalendarType] = useState<'solar' | 'lunar'>('solar');

  const [name, setName] = useState('');
  const [gender, setGender] = useState<'乾造' | '坤造'>('乾造');

  const [dateInput, setDateInput] = useState<DateInputState>({
    year: 2000,
    month: 1,
    day: 1,
    hour: 12,
    minute: 0
  });

  const [lunarDateInput, setLunarDateInput] = useState<LunarDateInputState>({
    year: 2000,
    month: 1,
    day: 1,
    hour: 12,
    minute: 0,
    isLeapMonth: false
  });

  const [baziInput, setBaziInput] = useState({
    gans: ['甲', '乙', '丙', '丁'],
    zhis: ['子', '丑', '寅', '卯']
  });

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [activeSelectId, setActiveSelectId] = useState<string | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [locationPickerProvince, setLocationPickerProvince] = useState('');
  const [locationPickerCity, setLocationPickerCity] = useState('');
  const [quickInputText, setQuickInputText] = useState('');
  const [quickDateInputText, setQuickDateInputText] = useState('');
  useEffect(() => {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (!cached) {
        hasLoadedCacheRef.current = true;
        return;
      }
      const parsed = JSON.parse(cached);
      if (parsed?.inputMode) setInputMode(parsed.inputMode);
      if (parsed?.calendarType) setCalendarType(parsed.calendarType);
      if (typeof parsed?.name === 'string') setName(parsed.name);
      if (parsed?.gender) setGender(parsed.gender);
      if (parsed?.dateInput) setDateInput(parsed.dateInput);
      if (parsed?.lunarDateInput) setLunarDateInput(parsed.lunarDateInput);
      if (parsed?.baziInput) setBaziInput(parsed.baziInput);
      if (typeof parsed?.selectedProvince === 'string') setSelectedProvince(parsed.selectedProvince);
      if (typeof parsed?.selectedCity === 'string') setSelectedCity(parsed.selectedCity);
      if (typeof parsed?.quickInputText === 'string') setQuickInputText(parsed.quickInputText);
      if (typeof parsed?.quickDateInputText === 'string') setQuickDateInputText(parsed.quickDateInputText);
    } catch (error) {
      console.warn('读取本地缓存失败:', error);
    } finally {
      hasLoadedCacheRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedCacheRef.current) return;
    try {
      const payload = {
        inputMode,
        calendarType,
        name,
        gender,
        dateInput,
        lunarDateInput,
        baziInput,
        selectedProvince,
        selectedCity,
        quickInputText,
        quickDateInputText
      };
      localStorage.setItem(cacheKey, JSON.stringify(payload));
    } catch (error) {
      console.warn('写入本地缓存失败:', error);
    }
  }, [
    inputMode,
    calendarType,
    name,
    gender,
    dateInput,
    lunarDateInput,
    baziInput,
    selectedProvince,
    selectedCity,
    quickInputText,
    quickDateInputText
  ]);

  const getDaysInMonth = (year: number, month: number): number => {
    return new Date(year, month, 0).getDate();
  };

  const generateDateOptions = (): number[] => {
    const daysInMonth = getDaysInMonth(dateInput.year, dateInput.month);
    return Array.from({ length: daysInMonth }, (_, i) => i + 1);
  };

  const yearOptions = Array.from({ length: 151 }, (_, i) => 1900 + i);
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);
  const hourOptions = Array.from({ length: 24 }, (_, i) => i);

  const getWuxingColor = (char: string): string => {
    const wuxingMap: Record<string, string> = {
      '庚': '#B09F73', '辛': '#B09F73', '申': '#B09F73', '酉': '#B09F73',
      '甲': '#7a9b85', '乙': '#7a9b85', '寅': '#7a9b85', '卯': '#7a9b85',
      '壬': '#6b7c97', '癸': '#6b7c97', '子': '#6b7c97', '亥': '#6b7c97',
      '丙': '#ba6e65', '丁': '#ba6e65', '巳': '#ba6e65', '午': '#ba6e65',
      '戊': '#8B5F45', '己': '#8B5F45', '辰': '#8B5F45', '戌': '#8B5F45', '丑': '#8B5F45', '未': '#8B5F45'
    };
    return wuxingMap[char] || '#333333';
  };

  const yinYangMap = {
    gans: {
      yang: ['甲', '丙', '戊', '庚', '壬'],
      yin: ['乙', '丁', '己', '辛', '癸']
    },
    zhis: {
      yang: ['子', '寅', '辰', '午', '申', '戌'],
      yin: ['丑', '卯', '巳', '未', '酉', '亥']
    }
  };

  const getZhiOptions = (gan: string): string[] => {
    if (!gan) return ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
    const isYangGan = yinYangMap.gans.yang.includes(gan);
    return isYangGan ? yinYangMap.zhis.yang : yinYangMap.zhis.yin;
  };

  const parseQuickInput = (text: string) => {
    if (!text.trim()) return;
    const cleanText = text.replace(/\s+/g, '');
    const ganZhiPairs: string[] = [];
    for (let i = 0; i < cleanText.length - 1; i += 2) {
      if (i + 1 < cleanText.length) {
        const pair = cleanText.slice(i, i + 2);
        if (pair.length === 2) {
          ganZhiPairs.push(pair);
        }
      }
    }
    if (ganZhiPairs.length < 4) return;

    const validGans = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
    const validZhis = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
    const parsedGans: string[] = [];
    const parsedZhis: string[] = [];

    for (const pair of ganZhiPairs.slice(0, 4)) {
      const [gan, zhi] = pair.split('');
      if (validGans.includes(gan) && validZhis.includes(zhi)) {
        parsedGans.push(gan);
        parsedZhis.push(zhi);
      } else {
        return;
      }
    }

    for (let i = 0; i < 4; i++) {
      const gan = parsedGans[i];
      const zhi = parsedZhis[i];
      const isYangGan = yinYangMap.gans.yang.includes(gan);
      const isYangZhi = yinYangMap.zhis.yang.includes(zhi);
      if (isYangGan !== isYangZhi) {
        return;
      }
    }

    setBaziInput({
      ...baziInput,
      gans: parsedGans,
      zhis: parsedZhis
    });
  };

  const parseDateQuickInput = (text: string) => {
    if (!text.trim()) return;
    const cleanText = text.replace(/\s+/g, '');

    let year: number | null = null;
    let month: number | null = null;
    let day: number | null = null;
    let hour: number | null = null;
    let minute: number | null = null;

    const yearMatch = cleanText.match(/(\d{4})年/);
    const monthMatch = cleanText.match(/(\d{1,2})月/);
    const dayMatch = cleanText.match(/(\d{1,2})日/);
    const hourMatch = cleanText.match(/(\d{1,2})(?:时|点)/);
    const minuteMatch = cleanText.match(/(\d{1,2})分/);

    if (yearMatch && monthMatch && dayMatch) {
      year = parseInt(yearMatch[1], 10);
      month = parseInt(monthMatch[1], 10);
      day = parseInt(dayMatch[1], 10);
      if (hourMatch) hour = parseInt(hourMatch[1], 10);
      if (minuteMatch) minute = parseInt(minuteMatch[1], 10);
    } else {
      const dateMatch = cleanText.match(
        /(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})(?:日)?(?:[T\s](\d{1,2})(?::|时)?(\d{1,2})?)?/
      );
      if (dateMatch) {
        year = parseInt(dateMatch[1], 10);
        month = parseInt(dateMatch[2], 10);
        day = parseInt(dateMatch[3], 10);
        if (dateMatch[4]) hour = parseInt(dateMatch[4], 10);
        if (dateMatch[5]) minute = parseInt(dateMatch[5], 10);
      }
    }

    if (!year || !month || !day) return;

    const nextHour = hour ?? (calendarType === 'solar' ? dateInput.hour : lunarDateInput.hour);
    const nextMinute = minute ?? (calendarType === 'solar' ? dateInput.minute : lunarDateInput.minute);

    if (calendarType === 'solar') {
      setDateInput({
        ...dateInput,
        year,
        month,
        day,
        hour: nextHour,
        minute: nextMinute
      });
    } else {
      setLunarDateInput({
        ...lunarDateInput,
        year,
        month,
        day,
        hour: nextHour,
        minute: nextMinute
      });
    }
  };

  React.useEffect(() => {
    const maxDays = getDaysInMonth(dateInput.year, dateInput.month);
    if (dateInput.day > maxDays) {
      setDateInput(prev => ({ ...prev, day: maxDays }));
    }
  }, [dateInput.year, dateInput.month]);

  const openLocationPicker = () => {
    setLocationPickerProvince(selectedProvince);
    setLocationPickerCity(selectedCity);
    setShowLocationPicker(true);
  };

  const handleLocationSelect = (province: string, city: string) => {
    setSelectedProvince(province);
    setSelectedCity(city);
    if (!province || !city) {
      setDateInput({ ...dateInput, location: undefined });
      setLunarDateInput({ ...lunarDateInput, location: undefined });
      setShowLocationPicker(false);
      return;
    }
    const longitude = getCityLongitude(city);
    setDateInput({
      ...dateInput,
      location: {
        province,
        city,
        longitude
      }
    });
    setLunarDateInput({
      ...lunarDateInput,
      location: {
        province,
        city,
        longitude
      }
    });
    setShowLocationPicker(false);
  };

  const handleLocationClear = () => {
    setSelectedProvince('');
    setSelectedCity('');
    setDateInput({ ...dateInput, location: undefined });
    setLunarDateInput({ ...lunarDateInput, location: undefined });
    setShowLocationPicker(false);
  };

  const handleAIAnalysis = async () => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    try {
      let input: BaziInput;

      if (inputMode === 'date') {
        if (calendarType === 'lunar') {
          const { Lunar } = await import('lunar-javascript');
          const lunar = Lunar.fromYmd(
            lunarDateInput.year,
            lunarDateInput.month,
            lunarDateInput.day,
            lunarDateInput.isLeapMonth
          );
          const solar = lunar.getSolar();
          input = {
            year: solar.getYear(),
            month: solar.getMonth(),
            day: solar.getDay(),
            hour: lunarDateInput.hour,
            minute: lunarDateInput.minute,
            location: lunarDateInput.location
          };
        } else {
          input = { ...dateInput };
        }
      } else {
        input = { ...dateInput, directBazi: baziInput };
      }

      const birthDate = inputMode === 'date'
        ? `${input.year}年${input.month}月${input.day}日 ${String(input.hour).padStart(2, '0')}:${String(input.minute).padStart(2, '0')}`
        : undefined;

      const importData = {
        bazi: [buildBaziImportData(input, { name: name || undefined, gender, birthDate })],
      };

      localStorage.removeItem('juexingcang-import-pending');
      localStorage.setItem('juexingcang-import-pending', JSON.stringify(importData));
      localStorage.setItem('juexingcang-input-preset', '请帮我解析该八字');

      router.push('/?tab=juexingcang');
    } catch (error) {
      console.error('AI分析失败:', error);
      setIsAnalyzing(false);
    }
  };

  const handleClassicalReport = async () => {
    const params = new URLSearchParams();
    if (name) params.set('name', name);
    params.set('gender', gender);

    if (inputMode === 'date') {
      params.set('mode', 'date');
      
      if (calendarType === 'lunar') {
        const { Lunar } = await import('lunar-javascript');
        const lunar = Lunar.fromYmd(
          lunarDateInput.year,
          lunarDateInput.month,
          lunarDateInput.day,
          lunarDateInput.isLeapMonth
        );
        const solar = lunar.getSolar();
        
        params.set('year', solar.getYear().toString());
        params.set('month', solar.getMonth().toString());
        params.set('day', solar.getDay().toString());
        params.set('hour', lunarDateInput.hour.toString());
        params.set('minute', lunarDateInput.minute.toString());
        if (lunarDateInput.location?.province && lunarDateInput.location?.city) {
          params.set('province', lunarDateInput.location.province);
          params.set('city', lunarDateInput.location.city);
          params.set('longitude', lunarDateInput.location.longitude.toString());
        }
      } else {
        params.set('year', dateInput.year.toString());
        params.set('month', dateInput.month.toString());
        params.set('day', dateInput.day.toString());
        params.set('hour', dateInput.hour.toString());
        params.set('minute', dateInput.minute.toString());
        if (dateInput.location?.province && dateInput.location?.city) {
          params.set('province', dateInput.location.province);
          params.set('city', dateInput.location.city);
          params.set('longitude', dateInput.location.longitude.toString());
        }
      }
    } else {
      params.set('mode', 'bazi');
      params.set('gans', baziInput.gans.join(','));
      params.set('zhis', baziInput.zhis.join(','));
    }

    router.push(`/report/classical?${params.toString()}`);
  };

  const CustomSelect = ({
    label,
    value,
    onChange,
    options,
    field,
    wuxingColor
  }: {
    label: string;
    value: number | string;
    onChange: (value: number | string) => void;
    options: (number | string)[];
    field: string;
    wuxingColor?: string;
  }) => {
    const isOpen = activeSelectId === field;

    return (
      <div className="space-y-2">
        <label className="text-xs font-medium text-[#666666] font-sans uppercase tracking-wider">
          {label}
        </label>
        <div className="relative">
          <div
            onClick={() => setActiveSelectId(isOpen ? null : field)}
            className="w-full bg-[#f8f6f0] border border-[#e8e3d8] rounded-md px-3 py-2 text-[#333333] font-sans cursor-pointer flex justify-between items-center hover:bg-[#f0ede6] transition-colors duration-200 focus:ring-2 focus:ring-stone-400 focus:border-stone-400"
            onFocus={() => setFocusedField(field)}
            onBlur={() => setFocusedField(null)}
          >
            <span style={{ color: wuxingColor || '#333333' }}>{value}</span>
            <motion.div
              animate={{ rotate: isOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <svg className="w-4 h-4 text-[#666666]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </motion.div>
          </div>

          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full left-0 right-0 mt-1 bg-[#fbf9f4] border border-[#e8e3d8] rounded-md shadow-sm z-50 max-h-60 overflow-y-auto"
                data-select-id={field}
                ref={(el) => {
                  if (el) {
                    setTimeout(() => {
                      const selectedItem = el.querySelector(`[data-value="${value}"]`) as HTMLElement;
                      if (selectedItem) {
                        const containerHeight = el.clientHeight;
                        const itemHeight = selectedItem.clientHeight;
                        const itemTop = selectedItem.offsetTop;
                        const scrollTop = itemTop - (containerHeight / 2) + (itemHeight / 2);
                        el.scrollTop = Math.max(0, scrollTop);
                      }
                    }, 10);
                  }
                }}
              >
                {options.map((option) => (
                  <div
                    key={option}
                    data-value={option}
                    onClick={() => {
                      onChange(option);
                      setActiveSelectId(null);
                    }}
                    className={`px-3 py-2 text-[#333333] font-sans hover:bg-[#f0ede6] cursor-pointer transition-colors duration-150 first:rounded-t-md last:rounded-b-md ${
                      option === value ? 'bg-stone-100' : ''
                    }`}
                  >
                    {option}
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  };

  const LocationPicker = () => {
    const selectClassName =
      'w-full appearance-none bg-[#f8f6f0] border border-[#e8e3d8] rounded-xl px-4 py-3 pr-10 text-[#333333] text-sm font-sans focus:outline-none focus:ring-2 focus:ring-stone-300/60 focus:border-stone-300 transition-all duration-200 disabled:bg-stone-100/80 disabled:text-stone-400 disabled:cursor-not-allowed';

    const cities = locationPickerProvince ? provinceData[locationPickerProvince] || [] : [];

    return (
      <AnimatePresence>
        {showLocationPicker && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/30 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLocationPicker(false)}
            />
            <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4 pointer-events-none">
              <motion.div
                className="pointer-events-auto flex w-full max-w-md max-h-[88dvh] flex-col rounded-t-2xl border border-[#e8e3d8] bg-[#fbf9f4] shadow-2xl sm:max-h-[min(85vh,640px)] sm:rounded-2xl"
                initial={{ opacity: 0, y: '100%' }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                onClick={(e) => e.stopPropagation()}
              >
              {/* 移动端拖拽指示条 */}
              <div className="flex shrink-0 justify-center pt-3 pb-1 sm:hidden">
                <div className="h-1 w-10 rounded-full bg-stone-300/70" />
              </div>

              <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 pt-2 sm:px-6 sm:pt-6">
                <div className="shrink-0 text-center sm:text-left">
                  <h3
                    className="text-base font-serif text-stone-800 tracking-wide"
                    style={{ fontFamily: '"Kaiti SC", KaiTi, STKaiti, "华文楷体", "楷体", Georgia, serif' }}
                  >
                    选择出生地点
                  </h3>
                  <p className="mt-1.5 text-[11px] text-stone-400 font-sans tracking-wide">
                    用于真太阳时校正 · 可不填
                  </p>
                </div>

                <div className="mt-5 min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain">
                  <div>
                    <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-stone-500 font-sans">
                      省份
                    </label>
                    <div className="relative">
                      <select
                        value={locationPickerProvince}
                        onChange={(e) => {
                          setLocationPickerProvince(e.target.value);
                          setLocationPickerCity('');
                        }}
                        className={selectClassName}
                      >
                        <option value="">不填写</option>
                        <optgroup label="国内">
                          {domesticProvinces.map(province => (
                            <option key={province} value={province}>
                              {province}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="国外">
                          <option value="国外">国外时区</option>
                        </optgroup>
                      </select>
                      <div className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M2.5 4.5L6 8L9.5 4.5" stroke="#8a8278" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-stone-500 font-sans">
                      {locationPickerProvince === '国外' ? '时区' : '城市'}
                    </label>
                    <div className="relative">
                      <select
                        value={locationPickerCity}
                        onChange={(e) => setLocationPickerCity(e.target.value)}
                        disabled={!locationPickerProvince}
                        className={selectClassName}
                      >
                        <option value="">
                          {locationPickerProvince === '国外' ? '请选择时区' : '请选择城市'}
                        </option>
                        {cities.map(city => (
                          <option key={city} value={city}>
                            {city}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M2.5 4.5L6 8L9.5 4.5" stroke="#8a8278" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="shrink-0 space-y-2.5 border-t border-[#e8e3d8]/80 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-6">
                  <button
                    type="button"
                    onClick={() => handleLocationSelect(locationPickerProvince, locationPickerCity)}
                    disabled={!locationPickerCity}
                    className="w-full rounded-xl bg-stone-800 py-3.5 text-sm font-sans text-white transition-colors duration-200 hover:bg-stone-700 active:bg-stone-900 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400"
                  >
                    确定
                  </button>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setShowLocationPicker(false)}
                      className="rounded-xl border border-[#e8e3d8] bg-transparent py-3 text-sm font-sans text-stone-600 transition-colors duration-200 hover:bg-[#f0ede6] active:bg-[#ebe6dc]"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      onClick={handleLocationClear}
                      className="rounded-xl border border-[#e8e3d8] bg-transparent py-3 text-sm font-sans text-stone-500 transition-colors duration-200 hover:bg-[#f0ede6] active:bg-[#ebe6dc]"
                    >
                      暂不填写
                    </button>
                  </div>
                </div>
              </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    );
  };

  const ModeTabs = () => (
    <div className="w-full bg-[#f8f6f0] rounded-xl p-1.5 mb-10 shadow-sm border border-[#e8e3d8]">
      <div className="grid grid-cols-2 gap-1.5">
        <motion.button
          onClick={() => setInputMode('date')}
          className={`relative px-6 py-3 text-sm font-medium font-serif rounded-lg transition-all duration-300 ${
            inputMode === 'date'
              ? 'bg-[#fbf9f4] text-stone-800 shadow-sm'
              : 'text-stone-500 hover:text-stone-700 hover:bg-[#f0ede6]/50'
          }`}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          日期排盘
        </motion.button>
        <motion.button
          onClick={() => setInputMode('bazi')}
          className={`relative px-6 py-3 text-sm font-medium font-serif rounded-lg transition-all duration-300 ${
            inputMode === 'bazi'
              ? 'bg-[#fbf9f4] text-stone-800 shadow-sm'
              : 'text-stone-500 hover:text-stone-700 hover:bg-[#f0ede6]/50'
          }`}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          八字排盘
        </motion.button>
      </div>
    </div>
  );

  return (
    <div className="space-y-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.4 }}
        className="space-y-8"
      >
        <ModeTabs />

        <div className="max-w-[460px] mx-auto space-y-6 mb-10">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-medium text-[#666666] font-sans uppercase tracking-wider">
                姓名
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="请输入姓名"
                className="w-full bg-[#f8f6f0] border border-[#e8e3d8] rounded-md px-3 py-2 text-[#333333] font-sans placeholder:text-[#999] focus:outline-none focus:ring-2 focus:ring-stone-400 focus:border-stone-400 transition-all duration-200"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-[#666666] font-sans uppercase tracking-wider">
                性别
              </label>
              <div className="relative">
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as '乾造' | '坤造')}
                  className="w-full bg-[#f8f6f0] border border-[#e8e3d8] rounded-md px-3 py-2 text-[#333333] font-sans cursor-pointer appearance-none focus:outline-none focus:ring-2 focus:ring-stone-400 focus:border-stone-400 transition-all duration-200"
                >
                  <option value="乾造">乾造（男）</option>
                  <option value="坤造">坤造（女）</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2.5 4.5L6 8L9.5 4.5" stroke="#666666" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="min-h-[400px]">
          <div className="max-w-[460px] mx-auto">
            <AnimatePresence mode="wait">
              {inputMode === 'date' ? (
                <motion.div
                  key="date-mode"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-8"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[#666666] font-sans text-sm">
                      <Calendar className="w-4 h-4" />
                      <span>出生时间</span>
                    </div>
                    
                    <div className="flex gap-2 bg-stone-100/50 rounded-lg p-1">
                      <button
                        onClick={() => setCalendarType('solar')}
                        className={`px-3 py-1 text-xs font-sans rounded-md transition-all duration-200 ${
                          calendarType === 'solar'
                            ? 'bg-white text-stone-800 shadow-sm'
                            : 'text-stone-500 hover:text-stone-700'
                        }`}
                      >
                        公历
                      </button>
                      <button
                        onClick={() => setCalendarType('lunar')}
                        className={`px-3 py-1 text-xs font-sans rounded-md transition-all duration-200 ${
                          calendarType === 'lunar'
                            ? 'bg-white text-stone-800 shadow-sm'
                            : 'text-stone-500 hover:text-stone-700'
                        }`}
                      >
                        农历
                      </button>
                    </div>
                  </div>

                  <div className="my-2">
                    <input
                      type="text"
                      value={quickDateInputText}
                      onChange={(e) => {
                        setQuickDateInputText(e.target.value);
                        parseDateQuickInput(e.target.value);
                      }}
                      placeholder="快捷输入：2001年7月28日19时27分 / 2001-07-28 19:27"
                      className="w-full text-center text-base text-stone-600 font-serif border-b border-stone-200 bg-transparent focus:border-stone-400 focus:outline-none placeholder:text-stone-300"
                    />
                    <div className="text-xs text-stone-400 font-serif text-center mt-2">
                      支持自动解析年月日时分并填充
                    </div>
                  </div>

                  {calendarType === 'solar' && (
                    <div className="grid grid-cols-2 gap-6">
                      <CustomSelect
                        label="年"
                        value={dateInput.year}
                        onChange={(year) => setDateInput({ ...dateInput, year: year as number })}
                        options={yearOptions}
                        field="year"
                      />
                      <CustomSelect
                        label="月"
                        value={dateInput.month}
                        onChange={(month) => setDateInput({ ...dateInput, month: month as number })}
                        options={monthOptions}
                        field="month"
                      />
                      <CustomSelect
                        label="日"
                        value={dateInput.day}
                        onChange={(day) => setDateInput({ ...dateInput, day: day as number })}
                        options={generateDateOptions()}
                        field="day"
                      />
                      <CustomSelect
                        label="时"
                        value={dateInput.hour}
                        onChange={(hour) => setDateInput({ ...dateInput, hour: hour as number })}
                        options={hourOptions}
                        field="hour"
                      />
                      <CustomSelect
                        label="分"
                        value={dateInput.minute}
                        onChange={(minute) => setDateInput({ ...dateInput, minute: minute as number })}
                        options={Array.from({ length: 60 }, (_, i) => i)}
                        field="minute"
                      />
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-[#666666] font-sans uppercase tracking-wider">
                          出生地
                        </label>
                        <div
                          onClick={openLocationPicker}
                          className="w-full bg-[#f8f6f0] border border-[#e8e3d8] rounded-md px-3 py-2 text-[#333333] font-sans cursor-pointer flex justify-between items-center hover:bg-[#f0ede6] transition-colors duration-200 focus:ring-2 focus:ring-stone-400 focus:border-stone-400"
                        >
                          <span>
                            {selectedProvince && selectedCity
                              ? `${selectedProvince} ${selectedCity}`
                              : '未填写地点'
                            }
                          </span>
                          <motion.div
                            animate={{ rotate: showLocationPicker ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <svg className="w-4 h-4 text-[#666666]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </motion.div>
                        </div>
                      </div>
                    </div>
                  )}

                  {calendarType === 'lunar' && (
                    <div className="grid grid-cols-2 gap-6">
                      <CustomSelect
                        label="年"
                        value={lunarDateInput.year}
                        onChange={(year) => setLunarDateInput({ ...lunarDateInput, year: year as number })}
                        options={yearOptions}
                        field="lunar-year"
                      />
                      <CustomSelect
                        label="月"
                        value={lunarDateInput.month}
                        onChange={(month) => setLunarDateInput({ ...lunarDateInput, month: month as number })}
                        options={monthOptions}
                        field="lunar-month"
                      />
                      <CustomSelect
                        label="日"
                        value={lunarDateInput.day}
                        onChange={(day) => setLunarDateInput({ ...lunarDateInput, day: day as number })}
                        options={Array.from({ length: 30 }, (_, i) => i + 1)}
                        field="lunar-day"
                      />
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-[#666666] font-sans uppercase tracking-wider">
                          闰月
                        </label>
                        <div className="relative">
                          <select
                            value={lunarDateInput.isLeapMonth ? 'true' : 'false'}
                            onChange={(e) => setLunarDateInput({ ...lunarDateInput, isLeapMonth: e.target.value === 'true' })}
                            className="w-full bg-[#f8f6f0] border border-[#e8e3d8] rounded-md px-3 py-2 text-[#333333] font-sans cursor-pointer appearance-none focus:outline-none focus:ring-2 focus:ring-stone-400 focus:border-stone-400 transition-all duration-200"
                          >
                            <option value="false">平月</option>
                            <option value="true">闰月</option>
                          </select>
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M2.5 4.5L6 8L9.5 4.5" stroke="#666666" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </div>
                        </div>
                      </div>
                      <CustomSelect
                        label="时"
                        value={lunarDateInput.hour}
                        onChange={(hour) => setLunarDateInput({ ...lunarDateInput, hour: hour as number })}
                        options={hourOptions}
                        field="lunar-hour"
                      />
                      <CustomSelect
                        label="分"
                        value={lunarDateInput.minute}
                        onChange={(minute) => setLunarDateInput({ ...lunarDateInput, minute: minute as number })}
                        options={Array.from({ length: 60 }, (_, i) => i)}
                        field="lunar-minute"
                      />
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-[#666666] font-sans uppercase tracking-wider">
                          出生地
                        </label>
                        <div
                          onClick={openLocationPicker}
                          className="w-full bg-[#f8f6f0] border border-[#e8e3d8] rounded-md px-3 py-2 text-[#333333] font-sans cursor-pointer flex justify-between items-center hover:bg-[#f0ede6] transition-colors duration-200 focus:ring-2 focus:ring-stone-400 focus:border-stone-400"
                        >
                          <span>
                            {selectedProvince && selectedCity
                              ? `${selectedProvince} ${selectedCity}`
                              : '未填写地点'
                            }
                          </span>
                          <motion.div
                            animate={{ rotate: showLocationPicker ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <svg className="w-4 h-4 text-[#666666]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </motion.div>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="bazi-mode"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-8"
                >
                  <div className="max-w-[500px] mx-auto space-y-8">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2 text-[#666666] font-sans text-sm mb-2">
                        <Sparkles className="w-4 h-4" />
                        <span>八字信息</span>
                      </div>
                    </div>

                    <div className="my-6">
                      <input
                        type="text"
                        value={quickInputText}
                        onChange={(e) => {
                          setQuickInputText(e.target.value);
                          parseQuickInput(e.target.value);
                        }}
                        placeholder="支持快捷粘贴，例如：辛巳 丁丑 丁巳 癸巳"
                        className="w-full text-center text-lg text-stone-600 font-serif border-b border-stone-200 bg-transparent focus:border-stone-400 focus:outline-none placeholder:text-stone-300"
                      />
                      <div className="text-xs text-stone-400 font-serif text-center mt-2">
                        输入天干地支组合，系统将自动解析并填充下方四柱
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4 mt-8">
                      {['年柱', '月柱', '日柱', '时柱'].map((label, idx) => (
                        <div key={idx} className="flex flex-col items-center space-y-3">
                          <div className="text-xs text-stone-400 font-serif text-center mb-2">{label}</div>
                          <div className="flex flex-col space-y-2">
                            <CustomSelect
                              label=""
                              value={baziInput.gans[idx]}
                              onChange={(gan) => {
                                const newGan = gan as string;
                                const newZhi = baziInput.zhis[idx];
                                const isYangGan = yinYangMap.gans.yang.includes(newGan);
                                const isYangZhi = yinYangMap.zhis.yang.includes(newZhi);
                                const resetZhi = isYangGan !== isYangZhi ? '' : newZhi;

                                const newGans = [...baziInput.gans];
                                const newZhis = [...baziInput.zhis];
                                newGans[idx] = newGan;
                                newZhis[idx] = resetZhi;

                                setBaziInput({
                                  gans: newGans,
                                  zhis: newZhis
                                });
                              }}
                              options={['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']}
                              field={`${label}-gan`}
                              wuxingColor={getWuxingColor(baziInput.gans[idx])}
                            />
                            <CustomSelect
                              label=""
                              value={baziInput.zhis[idx]}
                              onChange={(zhi) => {
                                const newZhis = [...baziInput.zhis];
                                newZhis[idx] = zhi as string;
                                setBaziInput({
                                  ...baziInput,
                                  zhis: newZhis
                                });
                              }}
                              options={getZhiOptions(baziInput.gans[idx])}
                              field={`${label}-zhi`}
                              wuxingColor={getWuxingColor(baziInput.zhis[idx])}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {(() => {
              const activeLocation = calendarType === 'lunar' ? lunarDateInput.location : dateInput.location;
              return inputMode === 'date' && activeLocation && Math.abs(activeLocation.longitude - 120) > 0.0001;
            })() && (
              <div className="text-center mt-8 mb-4">
                <p className="text-xs text-stone-400 font-sans">
                  已自动校正真太阳时
                </p>
              </div>
            )}

            <div className="mt-16 pt-4 space-y-4">
              <motion.button
                onClick={handleClassicalReport}
                className="w-full py-3 px-6 bg-transparent text-stone-600 font-sans text-sm border border-stone-400 rounded-lg hover:bg-stone-50 active:bg-stone-100 transition-colors duration-300 shadow-sm"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                古典排盘
              </motion.button>

              <motion.button
                onClick={handleAIAnalysis}
                disabled={isAnalyzing}
                className="w-full py-4 px-6 bg-stone-800 text-white font-sans text-sm rounded-lg hover:bg-stone-700 active:bg-stone-900 transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {isAnalyzing ? '分析中...' : 'AI 分析'}
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>

      <LocationPicker />

      <p className="text-center text-xs text-stone-400 font-sans py-6">
        注：本网站仅提供排盘服务，请勿将本网站用于封建迷信活动。
      </p>
    </div>
  );
};
