'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { BaZiView } from '@/components/BaZiView';
import { LiuYaoView } from '@/components/LiuYaoView';
import { MbtiTestView } from '@/components/MbtiTestView';
import { WorldNewsView } from '@/components/WorldNewsView';
import { JueXingCangView } from '@/components/JueXingCangView';
import { MobileNav } from '@/components/MobileNav';
import type { TabType } from '@/types/tabs';

const VALID_TABS: TabType[] = ['guanshi', 'bazi', 'mbti', 'liuyao', 'wendao', 'juexingcang'];

function getTabFromUrl(): TabType {
  if (typeof window === 'undefined') return 'guanshi';
  const tabParam = new URLSearchParams(window.location.search).get('tab');
  return tabParam && VALID_TABS.includes(tabParam as TabType) ? (tabParam as TabType) : 'guanshi';
}

const Sidebar = dynamic(
  () => import('@/components/Sidebar').then((mod) => mod.Sidebar),
  { ssr: false }
);

const HomeContent: React.FC = () => {
  // 首屏从 URL 读 tab（仅客户端），不依赖 useSearchParams，避免弱网下长时间 suspend 卡在「加载中」
  const [activeTab, setActiveTab] = useState<TabType>(() =>
    typeof window !== 'undefined' ? getTabFromUrl() : 'guanshi'
  );
  const [isCollapsed, setIsCollapsed] = useState(true);

  useEffect(() => {
    setActiveTab(getTabFromUrl());
    const onPopState = () => setActiveTab(getTabFromUrl());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // 用户在本页点击 tab 时，仅更新 state 和 URL，不触发 router 导航（避免决行藏切换卡顿）
  const handleTabChange: React.Dispatch<React.SetStateAction<TabType>> = (tabOrUpdater) => {
    const tab = typeof tabOrUpdater === 'function' ? tabOrUpdater(activeTab) : tabOrUpdater;
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    window.history.replaceState(null, '', url.toString());
  };

  return (
    <div className="min-h-screen bg-[#fbf9f4] relative">
      {/* 左侧侧边栏 */}
      <div className="hidden md:block">
        <Sidebar 
          activeTab={activeTab} 
          onTabChange={handleTabChange}
          isJuexingcangActive={activeTab === 'juexingcang'}
          isCollapsed={isCollapsed}
          onMouseEnter={() => setIsCollapsed(false)}
          onMouseLeave={() => setIsCollapsed(true)}
        />
      </div>

      {/* 主内容区 - 占据全屏，内容居中 */}
      <main className="min-h-screen flex items-start justify-center">
        <div className="w-full max-w-4xl">
          {/* Header - 所有 tab 共用，logo 标题瞬间切换，与其它 tab 一致 */}
          <motion.header
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="py-16 px-6"
          >
            <div className="max-w-md mx-auto text-center space-y-4">
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                {activeTab === 'guanshi' ? (
                  // 老阳 - 两条实心横杠（粗细行距与少阴一致）
                  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="currentColor" preserveAspectRatio="xMidYMid meet" className="w-8 h-8 mx-auto text-[#2c2c2c] mb-4">
                    <rect x="0" y="20" width="100" height="20" />
                    <rect x="0" y="60" width="100" height="20" />
                  </svg>
                ) : activeTab === 'wendao' ? (
                  // 少阳 - 上实下虚
                  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="currentColor" preserveAspectRatio="xMidYMid meet" className="w-8 h-8 mx-auto text-[#2c2c2c] mb-4">
                    <rect x="0" y="20" width="100" height="20" />
                    <rect x="0" y="60" width="44" height="20" />
                    <rect x="56" y="60" width="44" height="20" />
                  </svg>
                ) : activeTab === 'juexingcang' ? (
                  // 老阴 - 四象（粗细与少阴一致，rect 44x20）
                  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="currentColor" preserveAspectRatio="xMidYMid meet" className="w-8 h-8 mx-auto text-[#2c2c2c] mb-4">
                    <rect x="0" y="20" width="44" height="20" />
                    <rect x="56" y="20" width="44" height="20" />
                    <rect x="0" y="60" width="44" height="20" />
                    <rect x="56" y="60" width="44" height="20" />
                  </svg>
                ) : (
                  // 少阴 - 上虚下实
                  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="currentColor" preserveAspectRatio="xMidYMid meet" className="w-8 h-8 mx-auto text-[#2c2c2c] mb-4">
                    <rect x="0" y="20" width="44" height="20" />
                    <rect x="56" y="20" width="44" height="20" />
                    <rect x="0" y="60" width="100" height="20" />
                  </svg>
                )}
              </motion.div>
              <h1 className="text-3xl font-serif text-[#333333] leading-tight">
                {activeTab === 'guanshi' ? '见天地' : activeTab === 'wendao' ? '见众生' : activeTab === 'bazi' ? '八字命理' : activeTab === 'mbti' ? '荣格八维' : activeTab === 'juexingcang' ? '决行藏' : '六爻占卜'}
              </h1>
              <p className="text-sm text-stone-600 font-sans text-center">
                {activeTab === 'guanshi' 
                  ? '世界会越来越好，你也是'
                  : activeTab === 'wendao'
                  ? '观点广场，待续'
                  : activeTab === 'bazi' 
                  ? '知己即知天，请成为自己的答案'
                  : activeTab === 'mbti'
                  ? '知己即知天，请成为自己的答案'
                  : activeTab === 'juexingcang'
                  ? '用之则行，舍之则藏'
                  : '所信即所见，请相信相信的力量'}
              </p>
            </div>
          </motion.header>

          {/* 内容区域 */}
          <div className="px-6 mobile-content-bottom">
            <div className="max-w-md mx-auto">
              <AnimatePresence mode="wait">
                {activeTab === 'guanshi' ? (
                  <motion.div
                    key="guanshi-content"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <WorldNewsView />
                  </motion.div>
                ) : activeTab === 'wendao' ? (
                  <motion.div
                    key="wendao-content"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.3 }}
                    className="min-h-[320px] flex flex-col items-center justify-center py-16"
                  >
                    <div className="w-12 h-px bg-stone-200/80 mb-6" />
                    <p className="text-stone-500 text-sm font-serif tracking-wide text-center" style={{ fontFamily: '"Kaiti SC", KaiTi, STKaiti, "华文楷体", "楷体", Georgia, serif' }}>
                      感谢您的支持<br />见众生功能正在开发中
                    </p>
                    <div className="w-8 h-px bg-stone-200/60 mt-6" />
                  </motion.div>
                ) : activeTab === 'bazi' ? (
                  <motion.div
                    key="bazi-content"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <BaZiView />
                  </motion.div>
                ) : activeTab === 'mbti' ? (
                  <motion.div
                    key="mbti-content"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <MbtiTestView />
                  </motion.div>
                ) : activeTab === 'juexingcang' ? (
                  <motion.div
                    key="juexingcang-content"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.3 }}
                  >
                    <JueXingCangView hideHeader />
                  </motion.div>
                ) : (
                  <motion.div
                    key="liuyao-content"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <LiuYaoView />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </main>

      <MobileNav activeTab={activeTab} onTabChange={handleTabChange} />
    </div>
  );
};

export default HomeContent;
