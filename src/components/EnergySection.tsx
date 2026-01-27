'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ClassicalBaziData, calculateEnergyProfile } from '@/utils/baziLogic';

interface EnergySectionProps {
  baziData: ClassicalBaziData;
}

// 五行颜色（新中式莫兰迪配色）
const wuxingColors: { [key: string]: string } = {
  '木': '#5E7F63',
  '火': '#BA5D4F',
  '土': '#8B5F45',
  '金': '#B09F73',
  '水': '#4F7EA8'
};

// 天干颜色（基于五行）
const ganColors: { [key: string]: string } = {
  '甲': '#5E7F63', '乙': '#5E7F63',
  '丙': '#BA5D4F', '丁': '#BA5D4F',
  '戊': '#8B5F45', '己': '#8B5F45',
  '庚': '#B09F73', '辛': '#B09F73',
  '壬': '#4F7EA8', '癸': '#4F7EA8'
};

// 十神颜色（统一淡雅色调）
const shishenColors: { [key: string]: string } = {
  '比肩': '#8B5F45',
  '劫财': '#7A5540',
  '食神': '#B09F73',
  '伤官': '#9E8C62',
  '正财': '#9B8E78',
  '偏财': '#8A7D68',
  '正官': '#78716C',
  '七杀': '#68615C',
  '正印': '#5E7F63',
  '枭神': '#4D6852'
};

const EnergySection: React.FC<EnergySectionProps> = ({ baziData }) => {
  const energyProfile = calculateEnergyProfile(baziData);

  // 获取非零天干列表（按能量排序）
  const activeGans = Object.entries(energyProfile.ganDetailed)
    .filter(([_, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([gan]) => gan);

  // 获取非零十神列表（按能量排序）
  const activeShishen = Object.entries(energyProfile.shishenDetailed)
    .filter(([_, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([ss]) => ss);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="max-w-5xl mx-auto mb-12"
    >
      <div className="bg-[#FAF8F5] rounded-2xl overflow-hidden shadow-sm">
        {/* 标题区 */}
        <div className="bg-gradient-to-r from-stone-50 to-stone-100/50 px-4 md:px-8 py-4 md:py-6 border-b border-stone-200">
          <h2 className="text-xl md:text-2xl font-serif text-[#4A403A] tracking-wider text-center mb-2 md:mb-3">
            五行流通 · 能量分布
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-x-3 md:gap-x-4 gap-y-2 text-xs md:text-sm">
            <div className="flex items-center space-x-1.5 md:space-x-2">
              <span className="font-sans text-stone-500">日主强弱</span>
              <span className="font-serif text-[#B09F73] font-bold">
                {energyProfile.status.level}
              </span>
            </div>
            <span className="text-stone-400">·</span>
            <div className="flex items-center space-x-1.5 md:space-x-2">
              <span className="font-sans text-stone-500">同党</span>
              <span className="font-sans text-stone-600">
                {energyProfile.status.percent.toFixed(1)}%
              </span>
            </div>
            <span className="text-stone-400">·</span>
            <div className="flex items-center space-x-1.5 md:space-x-2">
              <span className="font-sans text-stone-500">燥湿</span>
              <span className={`font-serif font-bold ${
                energyProfile.climate.isDry ? 'text-[#BA5D4F]' : 
                energyProfile.climate.isWet ? 'text-[#4F7EA8]' : 
                'text-stone-600'
              }`}>
                {energyProfile.climate.level}
              </span>
            </div>
          </div>
        </div>

        {/* 核心图表区 */}
        <div className="px-4 md:px-8 py-6 md:py-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
            {/* 左侧：天干能量（细化） */}
            <div>
              <h3 className="text-sm md:text-base font-serif text-[#8B5F45] mb-4 md:mb-6 text-center tracking-wider">
                天干能量
              </h3>
              <div className="space-y-3 md:space-y-4">
                {activeGans.map((gan) => (
                  <motion.div
                    key={gan}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    className="flex items-center space-x-2 md:space-x-4"
                  >
                    {/* 标签 */}
                    <span
                      className="text-xs md:text-sm font-serif tracking-wider w-6 md:w-8 text-right"
                      style={{ color: ganColors[gan] }}
                    >
                      {gan}
                    </span>

                    {/* 进度条容器 */}
                    <div className="flex-1 h-6 md:h-7 bg-stone-100 rounded-full overflow-hidden relative">
                      {/* 进度条填充 */}
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${energyProfile.percentages.ganDetailed[gan]}%` }}
                        transition={{ duration: 1, delay: 0.3, ease: 'easeOut' }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: ganColors[gan] }}
                      />
                      {/* 数值显示 */}
                      <div className="absolute inset-0 flex items-center justify-end pr-2 md:pr-3">
                        <span className="text-[10px] md:text-xs font-sans text-stone-700">
                          {energyProfile.percentages.ganDetailed[gan].toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {/* 能量值 */}
                    <span className="text-[10px] md:text-xs font-sans text-stone-400 w-10 md:w-12 text-right">
                      {energyProfile.ganDetailed[gan].toFixed(0)}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* 右侧：十神格局（细化） */}
            <div>
              <h3 className="text-sm md:text-base font-serif text-[#8B5F45] mb-4 md:mb-6 text-center tracking-wider">
                十神格局
              </h3>
              <div className="space-y-3 md:space-y-4">
                {activeShishen.map((ss) => {
                  const isMax = energyProfile.shishenDetailed[ss] === Math.max(...Object.values(energyProfile.shishenDetailed).filter(v => v > 0));
                  return (
                    <motion.div
                      key={ss}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 }}
                      className="flex items-center space-x-2 md:space-x-4"
                    >
                      {/* 标签 */}
                      <span
                        className={`text-xs md:text-sm font-serif tracking-wider w-10 md:w-12 text-right ${
                          isMax ? 'font-bold' : ''
                        }`}
                        style={{ color: shishenColors[ss] }}
                      >
                        {ss}
                        {isMax && <span className="ml-0.5 md:ml-1 text-[8px] md:text-[10px]">★</span>}
                      </span>

                      {/* 进度条容器 */}
                      <div className="flex-1 h-5 md:h-6 bg-stone-100 rounded-full overflow-hidden relative">
                        {/* 进度条填充 */}
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${energyProfile.percentages.shishenDetailed[ss]}%` }}
                          transition={{ duration: 1, delay: 0.3, ease: 'easeOut' }}
                          className="h-full rounded-full"
                          style={{
                            backgroundColor: shishenColors[ss],
                            opacity: isMax ? 1 : 0.7
                          }}
                        />
                        {/* 数值显示 */}
                        <div className="absolute inset-0 flex items-center justify-end pr-2 md:pr-3">
                          <span className="text-[10px] md:text-xs font-sans text-stone-700">
                            {energyProfile.percentages.shishenDetailed[ss].toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      {/* 能量值 */}
                      <span className="text-[10px] md:text-xs font-sans text-stone-400 w-8 md:w-12 text-right">
                        {energyProfile.shishenDetailed[ss].toFixed(0)}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* 底部：格局结论 */}
        <div className="px-4 md:px-8 pb-6 md:pb-8 space-y-3 md:space-y-4">
          {/* 格局与用神 */}
          <div className="bg-stone-50/50 rounded-xl px-4 md:px-6 py-4 md:py-5 border border-stone-200/50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              {/* 格局判定 */}
              <div className="text-center">
                <div className="text-xs md:text-sm font-sans text-stone-500 mb-1">格局判定</div>
                <div className="text-base md:text-lg font-serif text-[#8B5F45] font-bold tracking-wide">
                  {energyProfile.status.pattern.replace(/\(.*?\)/g, '').trim()}
                </div>
                <div className="text-[10px] md:text-xs font-sans text-stone-400">
                  (月令本气)
                </div>
              </div>

              {/* 用神判定 */}
              <div className="text-center">
                <div className="text-xs md:text-sm font-sans text-stone-500 mb-1">用神</div>
                <div className="text-sm md:text-base font-serif text-[#B09F73] font-bold tracking-wide">
                  {energyProfile.yongshen.final !== '无'
                    ? energyProfile.yongshen.final
                    : '未定'}
                </div>
              </div>
            </div>
          </div>

          {/* 燥湿与调候 */}
          <div className="bg-stone-50/50 rounded-xl px-4 md:px-6 py-4 md:py-5 border border-stone-200/50">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
              {/* 燥湿程度 */}
              <div className="text-center">
                <div className="text-xs md:text-sm font-sans text-stone-500 mb-1">燥湿程度</div>
                <div className={`text-sm md:text-base font-serif font-bold tracking-wide ${
                  energyProfile.climate.isDry ? 'text-[#BA5D4F]' :
                  energyProfile.climate.isWet ? 'text-[#4F7EA8]' :
                  'text-stone-600'
                }`}>
                  {energyProfile.climate.level}
                </div>
                <div className="text-[10px] md:text-xs font-sans text-stone-400">
                  ({energyProfile.climate.tempScore.toFixed(0)})
                </div>
              </div>

              {/* 调候用神 */}
              <div className="text-center">
                <div className="text-xs md:text-sm font-sans text-stone-500 mb-1">调候用神</div>
                <div
                  className="text-sm md:text-base font-serif tracking-wide font-bold"
                  style={{
                    color: ganColors[energyProfile.yongshen.climate] || '#78716C'
                  }}
                >
                  {energyProfile.yongshen.climate !== '无'
                    ? energyProfile.yongshen.climate
                    : '未定'}
                </div>
              </div>

              {/* 扶抑用神 */}
              <div className="text-center">
                <div className="text-xs md:text-sm font-sans text-stone-500 mb-1">扶抑用神</div>
                <div
                  className="text-sm md:text-base font-serif tracking-wide font-bold"
                  style={{
                    color: ganColors[energyProfile.yongshen.balance] || '#78716C'
                  }}
                >
                  {energyProfile.yongshen.balance !== '无'
                    ? energyProfile.yongshen.balance
                    : '未定'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default EnergySection;
