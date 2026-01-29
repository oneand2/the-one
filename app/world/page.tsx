'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';

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

export default function WorldPage() {
  const [newsList, setNewsList] = useState<WorldNews[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const supabase = createClient();
        const { data, error: fetchError } = await supabase
          .from('world_news')
          .select('*')
          .order('news_date', { ascending: false });

        if (fetchError) throw fetchError;
        
        setNewsList(data || []);
        // 默认选择最新的日期
        if (data && data.length > 0) {
          setSelectedDate(data[0].news_date);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : '加载失败');
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, []);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
  };

  const parseContentByCategory = (content: string) => {
    const lines = content.split('\n');
    const categories: Array<{ title: string; content: string[] }> = [];
    const links: Array<{ source: string; title: string; url: string }> = [];
    let currentCategory: { title: string; content: string[] } | null = null;
    let inLinksSection = false;
    let lastWasEmpty = false;

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
      
      // 一级标题判断（短文本，前面有空行或是开头，无括号引号，且不是消息来源、利好、利空）
      const isNotSource = !trimmed.startsWith('消息来源：') && !trimmed.startsWith('消息来源:');
      const isNotBullish = !trimmed.startsWith('利好：') && !trimmed.startsWith('利好:');
      const isNotBearish = !trimmed.startsWith('利空：') && !trimmed.startsWith('利空:');
      const isH1 = (lastWasEmpty || categories.length === 0) && 
                   trimmed.length <= 12 && 
                   !/[（()）""'']/.test(trimmed) &&
                   isNotSource &&
                   isNotBullish &&
                   isNotBearish;

      if (isH1 || line.startsWith('## ')) {
        if (currentCategory) {
          categories.push(currentCategory);
        }
        currentCategory = {
          title: line.startsWith('## ') ? line.replace('## ', '').trim() : trimmed,
          content: []
        };
        lastWasEmpty = false;
      } else if (currentCategory) {
        currentCategory.content.push(line);
        lastWasEmpty = false;
      }
    }

    if (currentCategory) {
      categories.push(currentCategory);
    }

    return { categories, links };
  };

  const renderCategoryContent = (contentLines: string[]) => {
    const elements: React.ReactNode[] = [];
    let lastWasEmpty = false;
    let consecutiveParagraphs = 0;
    let lastNonEmptyType: 'h2' | 'text' | 'source' | null = null;

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
        lastNonEmptyType = 'text';
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
        lastNonEmptyType = 'text';
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
      const lengthOk = trimmed.length > 12 && trimmed.length < 80;
      
      const shouldBeH2 = lengthOk && 
                        (idx === 0 || 
                         lastNonEmptyType === 'source' || 
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
          <p key={`p-${idx}`} className="font-sans text-[13.5px] text-stone-600 leading-[1.85] mb-3.5" style={{ letterSpacing: '0.02em', textAlign: 'justify' }}>
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

  // 从新闻列表中提取所有独特的年月日
  const availableDates = React.useMemo(() => {
    const years = new Set<number>();
    const months = new Map<number, Set<number>>(); // year -> months
    const days = new Map<string, Set<number>>(); // "year-month" -> days
    
    newsList.forEach(news => {
      const [year, month, day] = news.news_date.split('-').map(Number);
      years.add(year);
      
      if (!months.has(year)) {
        months.set(year, new Set());
      }
      months.get(year)!.add(month);
      
      const yearMonth = `${year}-${month}`;
      if (!days.has(yearMonth)) {
        days.set(yearMonth, new Set());
      }
      days.get(yearMonth)!.add(day);
    });
    
    return {
      years: Array.from(years).sort((a, b) => b - a),
      months,
      days
    };
  }, [newsList]);

  // 解析选中的日期
  const selectedDateParts = React.useMemo(() => {
    if (!selectedDate) return null;
    const [year, month, day] = selectedDate.split('-').map(Number);
    return { year, month, day };
  }, [selectedDate]);

  // 当前选择的年月可用的月份和日期
  const availableMonths = selectedDateParts 
    ? Array.from(availableDates.months.get(selectedDateParts.year) || []).sort((a, b) => b - a)
    : [];
  
  const availableDays = selectedDateParts
    ? Array.from(availableDates.days.get(`${selectedDateParts.year}-${selectedDateParts.month}`) || []).sort((a, b) => b - a)
    : [];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FBF9F4] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
          <p className="text-stone-500 font-sans text-sm">加载中…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FBF9F4]">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="py-12 px-6"
      >
        <div className="max-w-2xl mx-auto">
          <Link href="/" className="text-sm text-stone-500 hover:text-stone-800 font-sans inline-block mb-6">
            ← 返回首页
          </Link>
          <div className="text-center space-y-4">
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              {/* 老阳图标 - 两条实线 */}
              <svg 
                viewBox="0 0 100 100" 
                xmlns="http://www.w3.org/2000/svg" 
                preserveAspectRatio="xMidYMid meet" 
                className="w-8 h-8 mx-auto mb-4" 
                style={{ color: '#2c2c2c' }}
              >
                <rect x="0" y="22" width="100" height="20" fill="currentColor" />
                <rect x="0" y="58" width="100" height="20" fill="currentColor" />
              </svg>
            </motion.div>
            <h1 className="text-3xl font-serif text-[#333333] leading-tight">
              见天地
            </h1>
            <p className="text-sm text-stone-600 font-sans">
              观天下事，知进退时
            </p>
          </div>
        </div>
      </motion.header>

      {/* 内容区域 */}
      <div className="px-6 pb-20">
        <div className="max-w-2xl mx-auto">
          {error ? (
            <div className="max-w-sm mx-auto px-6 py-8 bg-red-50/50 border border-red-200/60 rounded-2xl">
              <p className="text-red-700 text-sm font-sans text-center leading-relaxed">
                {error}
              </p>
            </div>
          ) : newsList.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-px bg-gradient-to-r from-transparent via-stone-300 to-transparent mb-8 mx-auto" />
              <p className="text-stone-500 text-sm font-serif tracking-wide" style={{ fontFamily: '"Kaiti SC", KaiTi, STKaiti, "华文楷体", "楷体", Georgia, serif' }}>
                暂无新闻
              </p>
              <div className="w-12 h-px bg-gradient-to-r from-transparent via-stone-300 to-transparent mt-8 mx-auto" />
            </div>
          ) : (
            <>
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
                        options={availableDates.years}
                        onChange={(year) => {
                          // 选择年份后，自动选择该年最新的月份
                          const months = Array.from(availableDates.months.get(year) || []).sort((a, b) => b - a);
                          if (months.length > 0) {
                            const month = months[0];
                            const days = Array.from(availableDates.days.get(`${year}-${month}`) || []).sort((a, b) => b - a);
                            if (days.length > 0) {
                              const day = days[0];
                              setSelectedDate(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
                            }
                          }
                        }}
                        field="year"
                      />
                      <DateSegmentSelect
                        label="月"
                        value={selectedDateParts.month}
                        options={availableMonths}
                        onChange={(month) => {
                          // 选择月份后，自动选择该月最新的日期
                          const days = Array.from(availableDates.days.get(`${selectedDateParts.year}-${month}`) || []).sort((a, b) => b - a);
                          if (days.length > 0) {
                            const day = days[0];
                            setSelectedDate(`${selectedDateParts.year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
                          }
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

              {/* 免责声明 */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="mb-8 max-w-3xl mx-auto"
              >
                <div className="flex items-start gap-2 text-[11px] leading-relaxed">
                  <span className="text-stone-400/50 flex-shrink-0">|</span>
                  <p className="text-stone-500/70 font-sans tracking-wide">
                    <span className="text-stone-600/60">声明</span>
                    <span className="text-stone-400/50 mx-1.5">·</span>
                    本站仅提供信息收集与整理服务，不保证信息的准确性与完整性，所有内容仅供参考，不构成任何投资建议
                  </p>
                </div>
              </motion.div>

              <div className="space-y-0">
                {selectedDate && (() => {
                  const selectedNews = newsList.find(news => news.news_date === selectedDate);
                  if (!selectedNews) return null;
                  
                  const { categories, links } = parseContentByCategory(selectedNews.content);
                  
                  return (
                    <div key={selectedNews.id}>
                      {/* 日期标签 - 简约设计（恢复原版） */}
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5 }}
                        className="mb-6 flex items-center gap-3"
                      >
                        <div className="flex items-baseline gap-2">
                          <time className="font-serif text-2xl text-stone-800 tracking-tight tabular-nums">
                            {formatDate(selectedNews.news_date).split('.')[1]}.{formatDate(selectedNews.news_date).split('.')[2]}
                          </time>
                          <span className="text-xs text-stone-500 font-sans">
                            {formatDate(selectedNews.news_date).split('.')[0]}
                          </span>
                        </div>
                        <div className="flex-1 h-px bg-stone-200" />
                      </motion.div>

                      {/* 按分类渲染卡片 */}
                      <div className="space-y-0">
                        {categories.map((category, catIdx) => (
                          <React.Fragment key={`${selectedNews.id}-cat-${catIdx}`}>
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
                })()}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
