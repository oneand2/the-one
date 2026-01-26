'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// 五行颜色映射
const wuxingColors: Record<string, string> = {
  '甲': 'text-[#5E7F63]', '乙': 'text-[#5E7F63]',
  '丙': 'text-[#BA5D4F]', '丁': 'text-[#BA5D4F]',
  '戊': 'text-[#8B5F45]', '己': 'text-[#8B5F45]',
  '庚': 'text-[#B09F73]', '辛': 'text-[#B09F73]',
  '壬': 'text-[#4F7EA8]', '癸': 'text-[#4F7EA8]',
  '寅': 'text-[#5E7F63]', '卯': 'text-[#5E7F63]',
  '巳': 'text-[#BA5D4F]', '午': 'text-[#BA5D4F]',
  '辰': 'text-[#8B5F45]', '戌': 'text-[#8B5F45]', '丑': 'text-[#8B5F45]', '未': 'text-[#8B5F45]',
  '申': 'text-[#B09F73]', '酉': 'text-[#B09F73]',
  '亥': 'text-[#4F7EA8]', '子': 'text-[#4F7EA8]',
};

// 地支藏干主气（用于计算十神）
const getZhiMainGan = (zhi: string): string => {
  const zhiGanMap: Record<string, string> = {
    '子': '癸', '丑': '己', '寅': '甲', '卯': '乙',
    '辰': '戊', '巳': '丙', '午': '丁', '未': '己',
    '申': '庚', '酉': '辛', '戌': '戊', '亥': '壬'
  };
  return zhiGanMap[zhi] || '';
};

// 计算十神
const getTenGod = (gan: string, dayGan: string): string => {
  const map: Record<string, Record<string, string>> = {
    '甲': { '甲': '比肩', '乙': '劫财', '丙': '食神', '丁': '伤官', '戊': '偏财', '己': '正财', '庚': '七杀', '辛': '正官', '壬': '偏印', '癸': '正印' },
    '乙': { '甲': '劫财', '乙': '比肩', '丙': '伤官', '丁': '食神', '戊': '正财', '己': '偏财', '庚': '正官', '辛': '七杀', '壬': '正印', '癸': '偏印' },
    '丙': { '甲': '偏印', '乙': '正印', '丙': '比肩', '丁': '劫财', '戊': '食神', '己': '伤官', '庚': '偏财', '辛': '正财', '壬': '七杀', '癸': '正官' },
    '丁': { '甲': '正印', '乙': '偏印', '丙': '劫财', '丁': '比肩', '戊': '伤官', '己': '食神', '庚': '正财', '辛': '偏财', '壬': '正官', '癸': '七杀' },
    '戊': { '甲': '七杀', '乙': '正官', '丙': '偏印', '丁': '正印', '戊': '比肩', '己': '劫财', '庚': '食神', '辛': '伤官', '壬': '偏财', '癸': '正财' },
    '己': { '甲': '正官', '乙': '七杀', '丙': '正印', '丁': '偏印', '戊': '劫财', '己': '比肩', '庚': '伤官', '辛': '食神', '壬': '正财', '癸': '偏财' },
    '庚': { '甲': '偏财', '乙': '正财', '丙': '七杀', '丁': '正官', '戊': '偏印', '己': '正印', '庚': '比肩', '辛': '劫财', '壬': '食神', '癸': '伤官' },
    '辛': { '甲': '正财', '乙': '偏财', '丙': '正官', '丁': '七杀', '戊': '正印', '己': '偏印', '庚': '劫财', '辛': '比肩', '壬': '伤官', '癸': '食神' },
    '壬': { '甲': '食神', '乙': '伤官', '丙': '偏财', '丁': '正财', '戊': '七杀', '己': '正官', '庚': '偏印', '辛': '正印', '壬': '比肩', '癸': '劫财' },
    '癸': { '甲': '伤官', '乙': '食神', '丙': '正财', '丁': '偏财', '戊': '正官', '己': '七杀', '庚': '正印', '辛': '偏印', '壬': '劫财', '癸': '比肩' }
  };
  return map[dayGan]?.[gan] || '';
};

// 竖排神煞列表组件 - 朱砂印与水墨批风格
const VerticalShenshaList = ({ tags, maxItems = 3 }: { tags: string[], maxItems?: number }) => {
  if (!tags || tags.length === 0) {
    return <div className="min-h-[20px] flex items-center justify-center">
      <span className="text-[9px] text-stone-300" style={{ fontFamily: '"Songti SC", "Noto Serif SC", serif' }}>无</span>
    </div>;
  }

  const auspicious = ['天乙贵人', '太极贵人', '文昌贵人', '国印贵人', '天德贵人', '月德贵人', '月德合', '天德合', '将星', '金匮', '金舆禄', '禄神', '三奇', '福星贵人'];

  // 排序：吉神（带红框）在前，其他神煞在后
  const sortedTags = [...tags].sort((a, b) => {
    const aIsGood = auspicious.some(k => a.includes(k));
    const bIsGood = auspicious.some(k => b.includes(k));
    if (aIsGood && !bIsGood) return -1;
    if (!aIsGood && bIsGood) return 1;
    return 0;
  });

  const displayTags = sortedTags.slice(0, maxItems);

  return (
    <div className="flex flex-col items-center gap-1 min-h-[20px]">
      {displayTags.map((tag: string, idx: number) => {
        const isGood = auspicious.some(k => tag.includes(k));
        const isEmpty = tag === '空亡';

        if (isGood) {
          // Variant A: 吉神 (朱砂印风格)
          return (
            <div
              key={idx}
              className="text-sm tracking-widest px-2 py-1 border-[0.5px] border-[#A84848] bg-transparent text-[#A84848] rounded-[2px] hover:bg-red-50 transition-colors duration-200 text-center w-full"
              style={{ fontFamily: '"Songti SC", "Noto Serif SC", serif' }}
            >
              {tag}
            </div>
          );
        } else if (isEmpty) {
          // Variant C: 空亡 (虚印风格)
          return (
            <div
              key={idx}
              className="text-sm tracking-widest px-2 py-1 border-[0.5px] border-dashed border-stone-300 text-stone-400 bg-transparent text-center w-full"
              style={{ fontFamily: '"Songti SC", "Noto Serif SC", serif' }}
            >
              {tag}
            </div>
          );
        } else {
          // Variant B: 凶/平 (水墨批风格)
          return (
            <div
              key={idx}
              className="text-sm tracking-widest px-2 py-1 text-[#57534E] bg-transparent text-center w-full"
              style={{ fontFamily: '"Songti SC", "Noto Serif SC", serif' }}
            >
              {tag}
            </div>
          );
        }
      })}
    </div>
  );
};

export default function LuckTimeline({ data, baziData }: { data: any[], baziData: any }) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<any>(null);
  const [selectedDaYun, setSelectedDaYun] = useState<any>(null);

  // 调试日志
  useEffect(() => {
    console.log('LuckTimeline data:', data);
    console.log('LuckTimeline baziData:', baziData);
    console.log('selectedYear:', selectedYear);
    console.log('selectedDaYun:', selectedDaYun);
    if (selectedYear) {
      console.log('selectedYear.shensha:', selectedYear.shensha);
    }
    if (selectedDaYun) {
      console.log('selectedDaYun.shensha:', selectedDaYun.shensha);
    }
    if (data && data.length > 0) {
      console.log('First cycle:', data[0]);
      console.log('First cycle shensha:', data[0].shensha);
      console.log('First cycle years:', data[0].years);
      if (data[0].years && data[0].years.length > 0) {
        console.log('First year shensha:', data[0].years[0].shensha);
      }
    }
  }, [data, baziData, selectedYear, selectedDaYun]);

  useEffect(() => {
    if (data && data.length > 0) {
      for (const cycle of data) {
        const found = cycle.years.find((y: any) => y.year === currentYear);
        if (found) {
          setSelectedDaYun(cycle);
          setSelectedYear(found);
          return;
        }
      }
      setSelectedDaYun(data[0]);
      setSelectedYear(data[0].years[0]);
    }
  }, [data]);

  if (!data || data.length === 0) return null;

  const dayGan = baziData?.pillars?.day?.gan || baziData?.dayGan || '';

  return (
    <div className="w-full">
      {/* 1. 七柱完整显示 */}
      <AnimatePresence mode="wait">
        {selectedYear && (
          <motion.div
            key={selectedYear.year}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-8 mx-4 md:mx-0"
          >
            <div className="bg-[#FDFBF7]/80 backdrop-blur-sm rounded-xl p-8 shadow-sm border border-stone-200/30">
              {/* 年份和年龄信息 */}
              <div className="text-center mb-6">
                <div className="flex items-center justify-center gap-4">
                  <span className="text-2xl font-serif text-stone-700 font-bold">
                    {selectedYear.year}
                  </span>
                  <span className="text-stone-400">·</span>
                  <span className="text-base text-stone-500">
                    {selectedYear.age}岁
                  </span>
                </div>
              </div>

              {/* 六柱水平排列 - 舒适间距 */}
              <div className="grid grid-cols-7 gap-6 items-start py-4">
                {/* 流年 */}
                <div className="text-center space-y-3">
                  <div className="text-base text-stone-500 font-serif tracking-wider font-medium">流年</div>
                  <div className="space-y-1">
                    <span className={`text-5xl font-calligraphy font-bold leading-none block ${wuxingColors[selectedYear.ganZhi[0]]}`}>
                      {selectedYear.ganZhi[0]}
                    </span>
                    <span className={`text-5xl font-calligraphy font-bold leading-none block ${wuxingColors[selectedYear.ganZhi[1]]}`}>
                      {selectedYear.ganZhi[1]}
                    </span>
                  </div>
                  <div className="pt-2">
                    <VerticalShenshaList tags={selectedYear?.shensha || []} maxItems={3} />
                  </div>
                </div>

                {/* 大运 */}
                <div className="text-center space-y-3">
                  <div className="text-base text-stone-500 font-serif tracking-wider font-medium">大运</div>
                  <div className="space-y-1">
                    <span className={`text-5xl font-calligraphy font-bold leading-none block ${wuxingColors[selectedDaYun?.gan]}`}>
                      {selectedDaYun?.gan}
                    </span>
                    <span className={`text-5xl font-calligraphy font-bold leading-none block ${wuxingColors[selectedDaYun?.zhi]}`}>
                      {selectedDaYun?.zhi}
                    </span>
                  </div>
                  <div className="pt-2">
                    <VerticalShenshaList tags={selectedDaYun?.shensha || []} maxItems={3} />
                  </div>
                </div>

                {/* 分割线 */}
                <div className="flex items-start justify-center pt-6">
                  <div className="w-px h-32 bg-stone-300"></div>
                </div>

                {/* 年柱 */}
                <div className="text-center space-y-3">
                  <div className="text-base text-stone-500 font-serif tracking-wider font-medium">年柱</div>
                  <div className="space-y-1">
                    <span className={`text-5xl font-calligraphy font-bold leading-none block ${wuxingColors[baziData?.pillars?.year?.gan]}`}>
                      {baziData?.pillars?.year?.gan}
                    </span>
                    <span className={`text-5xl font-calligraphy font-bold leading-none block ${wuxingColors[baziData?.pillars?.year?.zhi]}`}>
                      {baziData?.pillars?.year?.zhi}
                    </span>
                  </div>
                  <div className="pt-2">
                    <VerticalShenshaList tags={baziData?.shenSha?.year || []} maxItems={3} />
                  </div>
                </div>

                {/* 月柱 */}
                <div className="text-center space-y-3">
                  <div className="text-base text-stone-500 font-serif tracking-wider font-medium">月柱</div>
                  <div className="space-y-1">
                    <span className={`text-5xl font-calligraphy font-bold leading-none block ${wuxingColors[baziData?.pillars?.month?.gan]}`}>
                      {baziData?.pillars?.month?.gan}
                    </span>
                    <span className={`text-5xl font-calligraphy font-bold leading-none block ${wuxingColors[baziData?.pillars?.month?.zhi]}`}>
                      {baziData?.pillars?.month?.zhi}
                    </span>
                  </div>
                  <div className="pt-2">
                    <VerticalShenshaList tags={baziData?.shenSha?.month || []} maxItems={3} />
                  </div>
                </div>

                {/* 日柱 */}
                <div className="text-center space-y-3">
                  <div className="text-base text-stone-500 font-serif tracking-wider font-medium">日柱</div>
                  <div className="space-y-1">
                    <span className={`text-5xl font-calligraphy font-bold leading-none block ${wuxingColors[baziData?.pillars?.day?.gan]}`}>
                      {baziData?.pillars?.day?.gan}
                    </span>
                    <span className={`text-5xl font-calligraphy font-bold leading-none block ${wuxingColors[baziData?.pillars?.day?.zhi]}`}>
                      {baziData?.pillars?.day?.zhi}
                    </span>
                  </div>
                  <div className="pt-2">
                    <VerticalShenshaList tags={baziData?.shenSha?.day || []} maxItems={3} />
                  </div>
                </div>

                {/* 时柱 */}
                <div className="text-center space-y-3">
                  <div className="text-base text-stone-500 font-serif tracking-wider font-medium">时柱</div>
                  <div className="space-y-1">
                    <span className={`text-5xl font-calligraphy font-bold leading-none block ${wuxingColors[baziData?.pillars?.hour?.gan]}`}>
                      {baziData?.pillars?.hour?.gan}
                    </span>
                    <span className={`text-5xl font-calligraphy font-bold leading-none block ${wuxingColors[baziData?.pillars?.hour?.zhi]}`}>
                      {baziData?.pillars?.hour?.zhi}
                    </span>
                  </div>
                  <div className="pt-2">
                    <VerticalShenshaList tags={baziData?.shenSha?.hour || []} maxItems={3} />
                  </div>
                </div>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. 书签式卷轴 - 无滚动条 + 墨韵渐隐 */}
      <div className="relative w-full">
        {/* 横向滚动容器 - 完全隐藏滚动条 + 边缘墨韵渐隐 */}
        <div
          className="overflow-x-scroll pb-8"
          style={{
            maskImage: 'linear-gradient(to right, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 1) 15%, rgba(255, 255, 255, 1) 85%, rgba(255, 255, 255, 0) 100%)',
            WebkitMaskImage: 'linear-gradient(to right, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 1) 15%, rgba(255, 255, 255, 1) 85%, rgba(255, 255, 255, 0) 100%)',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
        >
          {/* 内容区 */}
          <div className="flex gap-5 px-8 py-4">
            {data.map((cycle, cIdx) => (
              <div 
                key={cIdx} 
                className={`flex-shrink-0 ${cycle.isPreLuck ? 'w-[120px]' : 'w-[160px]'}`}
              >
                {/* 书签式卡片 - 淡雅渐变：无印良品风格 */}
                <div 
                  className={`h-full rounded-lg shadow-sm hover:shadow transition-all duration-300 ${
                    cycle.isPreLuck 
                      ? 'border border-dashed border-stone-300/60' 
                      : 'border border-stone-200/50'
                  }`}
                  style={{
                    background: 'linear-gradient(to bottom, #F5F3F0, #FAFAF9, #FDFBF7)'
                  }}
                >
                  {/* 大运头部 */}
                  <div className="px-5 py-6 text-center border-b border-stone-200/30">
                    {cycle.isPreLuck ? (
                      <>
                        <div className="text-[11px] text-stone-400 mb-2">
                          {cycle.startAge}岁起运
                        </div>
                        <div className="text-xs text-stone-300 mb-4">
                          {cycle.years[0]?.year || cycle.startYear}-{cycle.years[cycle.years.length - 1]?.year || cycle.endYear}
                        </div>
                        <div className="text-base font-serif text-stone-400/70 tracking-widest">
                          小运期
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-[11px] text-stone-400 mb-1">
                          {cycle.startAge}岁起运
                        </div>
                        <div className="text-xs text-stone-300 mb-6">
                          {cycle.years[0]?.year || cycle.startYear}-{cycle.years[cycle.years.length - 1]?.year || cycle.endYear}
                        </div>
                        
                        {/* 大运干支 - 横排，适中字体 */}
                        <div className="flex justify-center items-start gap-6 mb-3">
                          {/* 天干 */}
                          <div className="flex flex-col items-center gap-1">
                            <span className={`text-4xl font-calligraphy font-bold leading-none ${wuxingColors[cycle.gan]}`}>
                              {cycle.gan}
                            </span>
                            <span className="text-[10px] text-stone-400">
                              {getTenGod(cycle.gan, dayGan)}
                            </span>
                          </div>

                          {/* 地支 */}
                          <div className="flex flex-col items-center gap-1">
                            <span className={`text-4xl font-calligraphy font-bold leading-none ${wuxingColors[cycle.zhi]}`}>
                              {cycle.zhi}
                            </span>
                            <span className="text-[10px] text-stone-400">
                              {getTenGod(getZhiMainGan(cycle.zhi), dayGan)}
                            </span>
                          </div>
                        </div>

                      </>
                    )}
                  </div>

                  {/* 流年列表 */}
                  <div className="px-3 py-4 space-y-2.5">
                    {cycle.years.map((year: any, yIdx: number) => {
                      const isSelected = selectedYear?.year === year.year;
                      const isCurrent = year.year === currentYear;
                      const gan = year.ganZhi?.[0] || '';
                      const zhi = year.ganZhi?.[1] || '';
                      
                      return (
                        <div 
                          key={yIdx}
                          onClick={() => { setSelectedDaYun(cycle); setSelectedYear(year); }}
                          className={`
                            px-3 py-2 rounded cursor-pointer transition-all
                            ${isSelected ? 'bg-[#F5F0E8] ring-1 ring-[#D4C5B0]' : ''}
                            ${isCurrent && !isSelected ? 'bg-stone-100/40 border border-stone-200/50' : ''}
                            ${!isSelected && !isCurrent ? 'hover:bg-white/60' : ''}
                          `}
                        >
                          {/* 年份 + 岁数 */}
                          <div className="flex justify-between items-center mb-1.5">
                            <span className={`text-xs ${isCurrent ? 'text-stone-600 font-medium' : 'text-stone-500'}`}>
                              {year.year}
                            </span>
                            <span className={`text-xs ${isCurrent ? 'text-stone-500' : 'text-stone-400'}`}>{year.age}岁</span>
                          </div>

                          {/* 干支 + 十神 */}
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-4">
                              {/* 天干 + 十神 */}
                              <div className="flex flex-col items-center gap-0.5">
                                <span className={`text-xl font-calligraphy font-bold ${wuxingColors[gan]}`}>
                                  {gan}
                                </span>
                                <span className={`text-[9px] ${isCurrent ? 'text-stone-500' : 'text-stone-400'}`}>
                                  {getTenGod(gan, dayGan)}
                                </span>
                              </div>

                              {/* 地支 + 十神 */}
                              <div className="flex flex-col items-center gap-0.5">
                                <span className={`text-xl font-calligraphy font-bold ${wuxingColors[zhi]}`}>
                                  {zhi}
                                </span>
                                <span className={`text-[9px] ${isCurrent ? 'text-stone-500' : 'text-stone-400'}`}>
                                  {getTenGod(getZhiMainGan(zhi), dayGan)}
                                </span>
                              </div>
                            </div>
                          </div>

                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 滑动提示 - 放在下方 */}
        <div className="text-center mt-6">
          <span className="text-base text-stone-300 font-semibold tracking-wider">◀ 左右滑动查看更多 ▶</span>
        </div>

        {/* 隐藏滚动条的CSS */}
        <style jsx>{`
          .overflow-x-scroll::-webkit-scrollbar {
            display: none;
          }
        `}</style>
      </div>
    </div>
  );
}
