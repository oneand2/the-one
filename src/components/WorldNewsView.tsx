'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { getCached, setCached, CACHE_KEYS } from '@/utils/cache';
import { LunarCalendarCard } from '@/components/LunarCalendarCard';
import { ZiwuLiuzhuClock } from '@/components/ZiwuLiuzhuClock';
import { DailyFortuneCard } from '@/components/DailyFortuneCard';

interface WorldNews {
  id: string;
  news_date: string;
  content: string;
  created_at: string;
}

// 日期选择器组件（移到外部避免hooks问题）
const DateSegmentSelect: React.FC<{
  label: string;
  value: number;
  options: number[];
  onChange: (val: number) => void;
  field: string;
}> = ({ label, value, options, onChange, field }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="relative">
      <label className="text-xs font-medium text-stone-500 font-sans uppercase tracking-wider block mb-2">
        {label}
      </label>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-stone-50/50 border border-stone-200/60 rounded-md px-3 py-2.5 text-stone-700 font-sans cursor-pointer flex justify-between items-center hover:bg-stone-50 transition-all duration-200"
      >
        <span className="text-sm">{value}</span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <svg className="w-4 h-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            className="absolute top-full left-0 right-0 mt-1 bg-white border border-stone-200 rounded-md shadow-lg z-50 max-h-48 overflow-y-auto"
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
                  setIsOpen(false);
                }}
                className={`px-3 py-2 text-sm text-stone-700 font-sans hover:bg-stone-50 cursor-pointer transition-colors duration-150 ${
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
  );
};

export const WorldNewsView: React.FC = () => {
  const [newsList, setNewsList] = useState<WorldNews[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const t = new Date();
    const y = t.getFullYear();
    const m = String(t.getMonth() + 1).padStart(2, '0');
    const d = String(t.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });

  useEffect(() => {
    // 先读缓存，第二次进入或刷新时立即展示，不卡顿
    const cached = getCached<WorldNews[]>(CACHE_KEYS.WORLD_NEWS);
    if (cached && cached.length > 0) {
      setNewsList(cached);
      setLoading(false);
    }

    const fetchNews = async () => {
      let supabase;
      try {
        supabase = createClient();
      } catch (e) {
        setError(e instanceof Error ? e.message : '配置异常');
        setLoading(false);
        return;
      }
      try {
        const { data, error: fetchError } = await supabase
          .from('world_news')
          .select('*')
          .order('news_date', { ascending: false });

        if (fetchError) throw fetchError;

        const list = data || [];
        setNewsList(list);
        // 写入缓存，下次进入直接读
        setCached(CACHE_KEYS.WORLD_NEWS, list);
      } catch (e) {
        setError(e instanceof Error ? e.message : '加载失败');
        // 有缓存时即使请求失败也不清空已展示内容
        if (!cached) setNewsList([]);
      } finally {
        setLoading(false);
      }
    };

    try {
      fetchNews();
    } catch (e) {
      // 捕获 createClient 等同步抛错，避免 effect 抛错导致整页崩溃与重试循环
      setError(e instanceof Error ? e.message : '加载失败');
      setLoading(false);
    }
  }, []);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
  };

  // 按一级标题分组内容，并提取链接查证部分
  const parseContentByCategory = (content: string) => {
    const lines = content.split('\n');
    const categories: Array<{ title: string; content: string[] }> = [];
    const links: Array<{ source: string; title: string; url: string }> = [];
    let currentCategory: { title: string; content: string[] } | null = null;
    let inLinksSection = false;
    let lastWasEmpty = false;
    let lastNonEmptyType: 'h1' | 'content' | 'source' | 'bullish' | 'bearish' | null = null;

    for (const line of lines) {
      const trimmed = line.trim();
      
      // 空行处理
      if (trimmed === '') {
        lastWasEmpty = true;
        continue;
      }
      
      // 检测是否进入链接查证部分
      if (trimmed.includes('新闻链接查证') || trimmed.includes('链接查证')) {
        // 保存之前的分类
        if (currentCategory) {
          categories.push(currentCategory);
          currentCategory = null;
        }
        inLinksSection = true;
        lastWasEmpty = false;
        continue;
      }
      
      // 如果在链接部分，解析链接
      if (inLinksSection) {
        const linkMatch = trimmed.match(/^\[([^\]]+)\]\s*(.+?)[:：]\s*(https?:\/\/.+)$/);
        if (linkMatch) {
          links.push({
            source: linkMatch[1],
            title: linkMatch[2],
            url: linkMatch[3]
          });
        }
        lastWasEmpty = false;
        continue;
      }

      // 标记消息来源，以便下一行判断
      const isSourceLine = trimmed.startsWith('消息来源：') || trimmed.startsWith('消息来源:');
      const isBullishLine = trimmed.startsWith('利好：') || trimmed.startsWith('利好:');
      const isBearishLine = trimmed.startsWith('利空：') || trimmed.startsWith('利空:');
      
      // 一级标题判断：短文本，前面有空行或开头或上一条新闻收尾，且不紧跟H1
      const isNotSource = !isSourceLine;
      const isNotBullish = !isBullishLine;
      const isNotBearish = !isBearishLine;
      const followsCompletedItem =
        lastNonEmptyType === 'source' ||
        lastNonEmptyType === 'bullish' ||
        lastNonEmptyType === 'bearish';
      const isH1 = (lastWasEmpty || categories.length === 0 || followsCompletedItem) &&
                   lastNonEmptyType !== 'h1' &&
                   trimmed.length <= 12 && 
                   !/[（()）""'']/.test(trimmed) &&
                   isNotSource &&
                   isNotBullish &&
                   isNotBearish;
      
      if (isH1 || line.startsWith('## ')) {
        // 遇到新的一级标题，保存之前的分类
        if (currentCategory) {
          categories.push(currentCategory);
        }
        // 开始新的分类
        currentCategory = {
          title: line.startsWith('## ') ? line.replace('## ', '').trim() : trimmed,
          content: []
        };
        lastWasEmpty = false;
        lastNonEmptyType = 'h1';
      } else if (currentCategory) {
        // 添加内容到当前分类
        currentCategory.content.push(line);
        lastWasEmpty = false;
        lastNonEmptyType = isSourceLine
          ? 'source'
          : isBullishLine
            ? 'bullish'
            : isBearishLine
              ? 'bearish'
              : 'content';
      }
    }

    // 添加最后一个分类
    if (currentCategory) {
      categories.push(currentCategory);
    }

    return { categories, links };
  };

  const renderCategoryContent = (contentLines: string[]) => {
    const elements: React.ReactNode[] = [];
    let lastWasEmpty = false;
    let consecutiveParagraphs = 0;
    let lastNonEmptyType: 'h2' | 'text' | 'source' | 'bullish' | 'bearish' | null = null;

    for (let idx = 0; idx < contentLines.length; idx++) {
      const line = contentLines[idx];
      const trimmed = line.trim();

      // 空行
      if (trimmed === '') {
        lastWasEmpty = true;
        continue;
      }

      // 利好判断：以"利好："开头（极简自然风格）
      if (trimmed.startsWith('利好：') || trimmed.startsWith('利好:')) {
        const content = trimmed.replace(/^利好[：:]\s*/, '');
        elements.push(
          <div key={`bullish-${idx}`} className="mt-3 mb-1.5 flex items-baseline gap-2 text-[11px] leading-relaxed">
            <span className="text-stone-400/60">•</span>
            <div className="flex-1">
              <span className="text-amber-800/40 tracking-wide">利好</span>
              <span className="text-stone-400/50 mx-1.5">|</span>
              <span className="text-stone-600/90">{content}</span>
            </div>
          </div>
        );
        lastWasEmpty = false;
        lastNonEmptyType = 'bullish';
        consecutiveParagraphs = 0;
        continue;
      }

      // 利空判断：以"利空："开头（极简自然风格）
      if (trimmed.startsWith('利空：') || trimmed.startsWith('利空:')) {
        const content = trimmed.replace(/^利空[：:]\s*/, '');
        elements.push(
          <div key={`bearish-${idx}`} className="mt-1.5 mb-2 flex items-baseline gap-2 text-[11px] leading-relaxed">
            <span className="text-stone-400/60">•</span>
            <div className="flex-1">
              <span className="text-slate-600/40 tracking-wide">利空</span>
              <span className="text-stone-400/50 mx-1.5">|</span>
              <span className="text-stone-600/90">{content}</span>
            </div>
          </div>
        );
        lastWasEmpty = false;
        lastNonEmptyType = 'bearish';
        consecutiveParagraphs = 0;
        continue;
      }

      // 消息来源判断：以"消息来源："开头
      if (trimmed.startsWith('消息来源：') || trimmed.startsWith('消息来源:')) {
        const source = trimmed.replace(/^消息来源[：:]\s*/, '');
        elements.push(
          <div key={`source-${idx}`} className="flex justify-end mt-4 mb-2">
            <div className="text-[11.5px] text-stone-500 font-sans italic">
              消息来源：{source}
            </div>
          </div>
        );
        lastWasEmpty = false;
        lastNonEmptyType = 'source';
        consecutiveParagraphs = 0;
        continue;
      }

      // 二级标题判断（和管理页面逻辑一致）：
      // 1. 长度适中（12-80字符）
      // 2. 关键规则：以下情况应该是H2
      //    - 第一个内容（idx === 0）
      //    - 紧跟在消息来源后面（lastNonEmptyType === 'source'，无需空行）
      //    - 前面有空行 + 已经连续出现2段正文
      //    - 上一条新闻以消息来源/利好/利空收尾（兼容无空行粘贴）
      const lengthOk = trimmed.length > 12 && trimmed.length < 80;
      const followsCompletedItem =
        lastNonEmptyType === 'source' ||
        lastNonEmptyType === 'bullish' ||
        lastNonEmptyType === 'bearish';
      
      const shouldBeH2 = lengthOk && 
                        (idx === 0 || 
                         lastNonEmptyType === 'source' || 
                         followsCompletedItem ||
                         (lastWasEmpty && consecutiveParagraphs >= 2));

      if (shouldBeH2) {
        elements.push(
          <h3 key={`h2-${idx}`} className="font-sans text-[14.5px] font-semibold text-stone-800 leading-relaxed mb-3 mt-5 first:mt-0">
            {trimmed}
          </h3>
        );
        lastWasEmpty = false;
        lastNonEmptyType = 'h2';
        consecutiveParagraphs = 0;
        continue;
      }

      // 正文段落
      if (trimmed.length > 0) {
        elements.push(
          <p key={`p-${idx}`} className="font-sans text-[13.5px] text-stone-700 leading-[1.85] mb-3.5" style={{ letterSpacing: '0.02em', textAlign: 'justify' }}>
            {trimmed}
          </p>
        );
        lastWasEmpty = false;
        lastNonEmptyType = 'text';
        consecutiveParagraphs++;
      }
    }

    return elements;
  };

  // 获取某年某月的天数
  const getDaysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

  // 今天的日期（用于限制不选未来日期）
  const todayRef = React.useMemo(() => {
    const t = new Date();
    return { year: t.getFullYear(), month: t.getMonth() + 1, day: t.getDate() };
  }, []);

  // 新闻中最早的年份（作为日历下限）
  const minNewsYear = React.useMemo(() => {
    if (newsList.length === 0) return todayRef.year;
    return Math.min(...newsList.map(n => parseInt(n.news_date.split('-')[0])));
  }, [newsList, todayRef]);

  // 所有可选年份：从最早新闻年到今年
  const allYears = React.useMemo(() => {
    return Array.from({ length: todayRef.year - minNewsYear + 1 }, (_, i) => minNewsYear + i).reverse();
  }, [minNewsYear, todayRef]);

  // 解析选中的日期（必须在所有提前返回之前调用）
  const selectedDateParts = React.useMemo(() => {
    if (!selectedDate) return null;
    const [year, month, day] = selectedDate.split('-').map(Number);
    return { year, month, day };
  }, [selectedDate]);

  // 当前选择年份的可用月份（1-12，若为今年则限制到当前月）
  const availableMonths = React.useMemo(() => {
    if (!selectedDateParts) return [];
    const maxMonth = selectedDateParts.year === todayRef.year ? todayRef.month : 12;
    return Array.from({ length: maxMonth }, (_, i) => i + 1).reverse();
  }, [selectedDateParts, todayRef]);

  // 当前选择年月的可用日期（1-max，若为今年今月则限制到今天）
  const availableDays = React.useMemo(() => {
    if (!selectedDateParts) return [];
    const maxDay = (selectedDateParts.year === todayRef.year && selectedDateParts.month === todayRef.month)
      ? todayRef.day
      : getDaysInMonth(selectedDateParts.year, selectedDateParts.month);
    return Array.from({ length: maxDay }, (_, i) => i + 1).reverse();
  }, [selectedDateParts, todayRef]);

  // 过滤出选中日期的新闻（必须在所有提前返回之前调用）
  const selectedNews = selectedDate 
    ? newsList.find(news => news.news_date === selectedDate)
    : null;

  // 今日日期字符串
  const todayStr = React.useMemo(() => {
    const { year, month, day } = todayRef;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }, [todayRef]);

  // 昨日日期字符串
  const yesterdayStr = React.useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  // 当选中的是今天且今日无新闻时，自动降级展示昨日新闻
  const isShowingYesterdayFallback = selectedDate === todayStr && !selectedNews;
  const fallbackNews = isShowingYesterdayFallback
    ? (newsList.find(n => n.news_date === yesterdayStr) ?? null)
    : null;

  // 最终展示的新闻：优先今日，降级昨日
  const displayNews = selectedNews ?? fallbackNews;

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.3 }}
        className="min-h-[320px] flex flex-col items-center justify-center py-16"
      >
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
          <p className="text-stone-500 font-sans text-sm">加载中…</p>
        </div>
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.3 }}
        className="min-h-[320px] flex flex-col items-center justify-center py-16"
      >
        <div className="max-w-sm mx-auto px-6 py-8 bg-red-50/50 border border-red-200/60 rounded-2xl">
          <p className="text-red-700 text-sm font-sans text-center leading-relaxed">
            {error}
          </p>
        </div>
      </motion.div>
    );
  }

  if (newsList.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.3 }}
        className="min-h-[320px] flex flex-col items-center justify-center py-16"
      >
        <div className="text-center">
          <div className="w-16 h-px bg-gradient-to-r from-transparent via-stone-300 to-transparent mb-8 mx-auto" />
          <p className="text-stone-500 text-sm font-serif tracking-wide" style={{ fontFamily: '"Kaiti SC", KaiTi, STKaiti, "华文楷体", "楷体", Georgia, serif' }}>
            暂无新闻
          </p>
          <div className="w-12 h-px bg-gradient-to-r from-transparent via-stone-300 to-transparent mt-8 mx-auto" />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3 }}
      className="w-full"
    >
      {/* 三段式日期选择器 */}
      {newsList.length > 0 && selectedDateParts && (
        <div className="mb-10">
          <div className="max-w-md mx-auto">
            <div className="text-center mb-4">
              <span className="text-xs font-sans text-stone-400 uppercase tracking-wider">选择日期</span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <DateSegmentSelect
                label="年"
                value={selectedDateParts.year}
                options={allYears}
                onChange={(year) => {
                  const maxMonth = year === todayRef.year ? todayRef.month : 12;
                  const month = Math.min(selectedDateParts.month, maxMonth);
                  const maxDay = (year === todayRef.year && month === todayRef.month)
                    ? todayRef.day
                    : getDaysInMonth(year, month);
                  const day = Math.min(selectedDateParts.day, maxDay);
                  setSelectedDate(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
                }}
                field="year"
              />
              <DateSegmentSelect
                label="月"
                value={selectedDateParts.month}
                options={availableMonths}
                onChange={(month) => {
                  const maxDay = (selectedDateParts.year === todayRef.year && month === todayRef.month)
                    ? todayRef.day
                    : getDaysInMonth(selectedDateParts.year, month);
                  const day = Math.min(selectedDateParts.day, maxDay);
                  setSelectedDate(`${selectedDateParts.year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
                }}
                field="month"
              />
              <DateSegmentSelect
                label="日"
                value={selectedDateParts.day}
                options={availableDays}
                onChange={(day) => {
                  setSelectedDate(`${selectedDateParts.year}-${String(selectedDateParts.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
                }}
                field="day"
              />
            </div>
          </div>
        </div>
      )}

      {/* 万年历黄历卡片 */}
      {selectedDateParts && (
        <LunarCalendarCard
          year={selectedDateParts.year}
          month={selectedDateParts.month}
          day={selectedDateParts.day}
        />
      )}

      {/* 子午流注钟 */}
      <ZiwuLiuzhuClock />

      {/* 今日运势分数卡片 */}
      {selectedDateParts && (
        <DailyFortuneCard
          year={selectedDateParts.year}
          month={selectedDateParts.month}
          day={selectedDateParts.day}
        />
      )}

      <div className="space-y-0 pb-8">
        {/* 顶部分隔横线 */}
        {selectedDateParts && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="mb-8 mt-1"
          >
            <div className="w-full h-px bg-stone-200/80" />
          </motion.div>
        )}

        {displayNews ? (() => {
          const { categories, links } = parseContentByCategory(displayNews.content);
          
          return (
            <div key={displayNews.id}>

              {/* 今日无新闻时的昨日降级提示 */}
              {isShowingYesterdayFallback && fallbackNews && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                  className="mb-8 flex flex-col items-center gap-2"
                >
                  <div className="flex items-center gap-4 w-full max-w-xs mx-auto">
                    <div className="flex-1 h-px bg-stone-200/80" />
                    <span
                      className="text-stone-400 text-[11px] tracking-[0.18em] whitespace-nowrap"
                      style={{ fontFamily: '"Kaiti SC", KaiTi, STKaiti, "华文楷体", "楷体", Georgia, serif' }}
                    >
                      昨日
                    </span>
                    <div className="flex-1 h-px bg-stone-200/80" />
                  </div>
                  <p
                    className="text-stone-400/80 text-[11.5px] tracking-widest text-center leading-relaxed"
                    style={{ fontFamily: '"Kaiti SC", KaiTi, STKaiti, "华文楷体", "楷体", Georgia, serif' }}
                  >
                    今日新闻暂未更新，为您展示昨日新闻
                  </p>
                </motion.div>
              )}

              {/* 按分类渲染卡片 */}
              <div className="space-y-0">
                {categories.map((category, catIdx) => (
                  <React.Fragment key={`${displayNews.id}-cat-${catIdx}`}>
                    <motion.article
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: catIdx * 0.08 }}
                      className="group mb-6"
                    >
                      <div className="relative rounded-2xl p-6 border border-stone-200/40 shadow-sm hover:shadow-md hover:border-stone-300/50 transition-all duration-400 overflow-hidden">
                        {/* 极淡的渐变背景 - 少即是多 */}
                        <div className="absolute inset-0 bg-gradient-to-br from-[#fdfdfb] via-[#fcfcfa] to-[#fafaf8] -z-10" />
                        
                        {/* 微妙的光晕效果 */}
                        <div className="absolute -top-20 -right-20 w-40 h-40 bg-amber-50/15 rounded-full blur-3xl -z-10" />

                        {/* 分类标题 */}
                        <div className="mb-5 pb-3 border-b border-stone-200/50">
                          <div className="flex items-center gap-2.5">
                            <div className="w-1 h-5 bg-stone-800 rounded-full" />
                            <h2 className="text-[15px] font-serif text-stone-900 tracking-wide">
                              {category.title}
                            </h2>
                          </div>
                        </div>

                        {/* 分类内容 */}
                        <div className="space-y-0">
                          {renderCategoryContent(category.content)}
                        </div>
                      </div>
                    </motion.article>

                    {/* 卡片之间的过渡 - 两道极淡长横线 */}
                    {catIdx < categories.length - 1 && (
                      <div className="flex flex-col items-center gap-1.5 my-7">
                        <div className="w-full h-px bg-stone-200/40" />
                        <div className="w-full h-px bg-stone-200/40" />
                      </div>
                    )}
                  </React.Fragment>
                ))}
                
                {/* 当天新闻的链接查证卡片 */}
                {links.length > 0 && (
                  <>
                    {/* 过渡元素 */}
                    <div className="flex flex-col items-center gap-1.5 my-7">
                      <div className="w-full h-px bg-stone-200/40" />
                      <div className="w-full h-px bg-stone-200/40" />
                    </div>
                    
                    <motion.article
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: categories.length * 0.08 }}
                      className="group mb-6"
                    >
                      <div className="relative rounded-2xl p-6 border border-amber-200/40 shadow-sm hover:shadow-md hover:border-amber-300/50 transition-all duration-400 overflow-hidden">
                        {/* 极淡的琥珀色渐变背景 */}
                        <div className="absolute inset-0 bg-gradient-to-br from-[#fefdfb] via-[#fdfcfa] to-[#fcfaf7] -z-10" />
                        
                        {/* 微妙的琥珀色光晕效果 */}
                        <div className="absolute -top-20 -right-20 w-40 h-40 bg-amber-100/20 rounded-full blur-3xl -z-10" />

                        {/* 链接查证标题 */}
                        <div className="mb-5 pb-3 border-b border-amber-200/50">
                          <div className="flex items-center gap-2.5">
                            <div className="w-1 h-5 bg-amber-600 rounded-full" />
                            <h2 className="text-[15px] font-serif text-stone-900 tracking-wide">
                              新闻链接查证
                            </h2>
                          </div>
                        </div>

                        {/* 链接列表 */}
                        <div className="space-y-3">
                          {links.map((link, linkIdx) => (
                            <div key={linkIdx} className="group/link">
                              <div className="flex items-start gap-2">
                                <span className="flex-shrink-0 mt-1 text-amber-600 text-xs">•</span>
                                <div className="flex-1 min-w-0">
                                  <div className="text-[13px] text-stone-700 mb-1">
                                    <span className="font-semibold text-stone-800">[{link.source}]</span>{' '}
                                    {link.title}
                                  </div>
                                  <a 
                                    href={link.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-[12px] text-stone-500 hover:text-amber-700 hover:underline break-all transition-colors"
                                  >
                                    {link.url}
                                  </a>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.article>
                  </>
                )}
              </div>
            </div>
          );
        })() : selectedDateParts ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="py-14 text-center"
          >
            <p className="text-stone-400 font-serif text-sm tracking-wide" style={{ fontFamily: '"Kaiti SC", KaiTi, STKaiti, "华文楷体", "楷体", Georgia, serif' }}>
              该日新闻暂未更新
            </p>
          </motion.div>
        ) : null}

        {/* 免责声明 */}
        {selectedDateParts && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-8 mb-2 max-w-3xl mx-auto"
          >
            <div className="flex items-start gap-2 text-[11px] leading-relaxed">
              <span className="text-stone-400/50 flex-shrink-0">|</span>
              <p className="text-stone-500/70 font-sans tracking-wide">
                <span className="text-stone-600/60">声明</span>
                <span className="text-stone-400/50 mx-1.5">·</span>
                本站仅提供信息收集与整理服务，不保证信息的准确性与完整性，所有新闻版权归原媒体所有。所有内容仅供参考，不构成任何投资建议。
              </p>
            </div>
          </motion.div>
        )}
      </div>

      {/* 底部间距 */}
      <div className="pb-20 md:pb-10" />
    </motion.div>
  );
};
