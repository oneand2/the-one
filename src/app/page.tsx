'use client';

import React, { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { MobileNav } from '@/components/MobileNav';
import { TabContentErrorBoundary } from '@/components/TabContentErrorBoundary';
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

// 大组件按需加载，首屏只加载当前 tab，第二次进入或切换回来时从缓存/内存秒开
const WorldNewsView = dynamic(
  () => import('@/components/WorldNewsView').then((mod) => mod.WorldNewsView),
  { ssr: false, loading: () => <TabLoading /> }
);
const BaZiView = dynamic(
  () => import('@/components/BaZiView').then((mod) => mod.BaZiView),
  { ssr: false, loading: () => <TabLoading /> }
);
const MbtiTestView = dynamic(
  () => import('@/components/MbtiTestView').then((mod) => mod.MbtiTestView),
  { ssr: false, loading: () => <TabLoading /> }
);
const JueXingCangView = dynamic(
  () => import('@/components/JueXingCangView').then((mod) => mod.JueXingCangView),
  { ssr: false, loading: () => <TabLoading /> }
);
const LiuYaoView = dynamic(
  () => import('@/components/LiuYaoView').then((mod) => mod.LiuYaoView),
  { ssr: false, loading: () => <TabLoading /> }
);

function TabLoading() {
  return (
    <div className="min-h-[280px] flex items-center justify-center text-stone-400 text-sm font-sans">
      加载中…
    </div>
  );
}

const HomeContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('guanshi');
  const [isCollapsed, setIsCollapsed] = useState(true);
  // 已访问过的 tab 保持挂载，切换回来时不再重新加载、不卡顿
  const [visitedTabs, setVisitedTabs] = useState<Set<TabType>>(() => new Set(['guanshi']));

  useEffect(() => {
    const tab = getTabFromUrl();
    setActiveTab(tab);
    setVisitedTabs((prev) => new Set([...prev, tab]));
    const onPopState = () => {
      const t = getTabFromUrl();
      setActiveTab(t);
      setVisitedTabs((prev) => new Set([...prev, t]));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const handleTabChange = useCallback(
    (tabOrUpdater: TabType | React.SetStateAction<TabType>) => {
      const tab = typeof tabOrUpdater === 'function' ? tabOrUpdater(activeTab) : tabOrUpdater;
      setActiveTab(tab);
      setVisitedTabs((prev) => new Set([...prev, tab]));
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.replaceState(null, '', url.toString());
    },
    [activeTab]
  );

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
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="py-16 px-6"
          >
            <div className="max-w-md mx-auto text-center space-y-4">
              <motion.div
                initial={{ scale: 0.98 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.2 }}
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

          {/* 内容区域：已访问的 tab 保持挂载仅隐藏，切换回来秒开不卡顿 */}
          <div className="px-6 mobile-content-bottom">
            <TabContentErrorBoundary>
              <div className="max-w-md mx-auto relative">
                {visitedTabs.has('guanshi') && (
                <div className={activeTab === 'guanshi' ? 'block' : 'hidden'} aria-hidden={activeTab !== 'guanshi'}>
                  <WorldNewsView />
                </div>
              )}
              {visitedTabs.has('wendao') && (
                <div
                  className={
                    activeTab === 'wendao'
                      ? 'min-h-[320px] flex flex-col items-center justify-center py-16'
                      : 'hidden'
                  }
                  aria-hidden={activeTab !== 'wendao'}
                >
                  <div className="w-12 h-px bg-stone-200/80 mb-6" />
                  <p
                    className="text-stone-500 text-sm font-serif tracking-wide text-center"
                    style={{ fontFamily: '"Kaiti SC", KaiTi, STKaiti, "华文楷体", "楷体", Georgia, serif' }}
                  >
                    感谢您的支持<br />见众生功能正在开发中
                  </p>
                  <div className="w-8 h-px bg-stone-200/60 mt-6" />
                </div>
              )}
              {visitedTabs.has('bazi') && (
                <div className={activeTab === 'bazi' ? 'block' : 'hidden'} aria-hidden={activeTab !== 'bazi'}>
                  <BaZiView />
                </div>
              )}
              {visitedTabs.has('mbti') && (
                <div className={activeTab === 'mbti' ? 'block' : 'hidden'} aria-hidden={activeTab !== 'mbti'}>
                  <MbtiTestView />
                </div>
              )}
              {visitedTabs.has('juexingcang') && (
                <div className={activeTab === 'juexingcang' ? 'block' : 'hidden'} aria-hidden={activeTab !== 'juexingcang'}>
                  <JueXingCangView hideHeader />
                </div>
              )}
              {visitedTabs.has('liuyao') && (
                <div className={activeTab === 'liuyao' ? 'block' : 'hidden'} aria-hidden={activeTab !== 'liuyao'}>
                  <LiuYaoView onNavigateToJuexingcang={() => handleTabChange('juexingcang')} />
                </div>
              )}
              </div>
            </TabContentErrorBoundary>
          </div>
        </div>
      </main>

      <MobileNav activeTab={activeTab} onTabChange={handleTabChange} />
    </div>
  );
};

export default HomeContent;
