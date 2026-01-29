'use client';

import React, { Suspense, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { BaZiView } from '@/components/BaZiView';
import { LiuYaoView } from '@/components/LiuYaoView';
import { JueXingCangView } from '@/components/JueXingCangView';
import { MbtiTestView } from '@/components/MbtiTestView';
import { WorldNewsView } from '@/components/WorldNewsView';
import { MobileNav } from '@/components/MobileNav';
import { useSearchParams } from 'next/navigation';
type TabType = 'guanshi' | 'bazi' | 'mbti' | 'liuyao' | 'liuji' | 'wendao';

const Sidebar = dynamic(
  () => import('@/components/Sidebar').then((mod) => mod.Sidebar),
  { ssr: false }
);

const HomeContent: React.FC = () => {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabType>('mbti');
  const [isCollapsed, setIsCollapsed] = useState(true);

  useEffect(() => {
    const tabParam = searchParams.get('tab') as TabType | null;
    const validTabs: TabType[] = ['guanshi', 'bazi', 'mbti', 'liuyao', 'liuji', 'wendao'];
    if (tabParam && validTabs.includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-[#fbf9f4] relative">
      {/* 左侧侧边栏 */}
      <div className="hidden md:block">
        <Sidebar 
          activeTab={activeTab} 
          onTabChange={setActiveTab}
          isCollapsed={isCollapsed}
          onMouseEnter={() => setIsCollapsed(false)}
          onMouseLeave={() => setIsCollapsed(true)}
        />
      </div>

      {/* 主内容区 - 占据全屏，内容居中 */}
      <main className="min-h-screen flex items-start justify-center">
        <div className="w-full max-w-4xl">
          {/* Header */}
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
                  // 老阳 - 两条实心横杠（仅两实线，无虚）
                  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" className="w-8 h-8 mx-auto mb-4" style={{ color: '#2c2c2c' }}>
                    <rect x="0" y="22" width="100" height="20" fill="currentColor" />
                    <rect x="0" y="58" width="100" height="20" fill="currentColor" />
                  </svg>
                ) : activeTab === 'wendao' ? (
                  // 少阳 - 上实下虚
                  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="currentColor" preserveAspectRatio="xMidYMid meet" className="w-8 h-8 mx-auto text-[#2c2c2c] mb-4">
                    <rect x="0" y="20" width="100" height="20" />
                    <rect x="0" y="60" width="44" height="20" />
                    <rect x="56" y="60" width="44" height="20" />
                  </svg>
                ) : activeTab === 'liuji' ? (
                  // 老阴 - 两条虚杠（两段式，中间断开）
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
                {activeTab === 'guanshi' ? '见天地' : activeTab === 'wendao' ? '见众生' : activeTab === 'bazi' ? '八字命理' : activeTab === 'mbti' ? '荣格八维' : activeTab === 'liuyao' ? '六爻占卜' : '决行藏'}
              </h1>
              <p className="text-sm text-stone-600 font-sans text-center">
                {activeTab === 'guanshi' 
                  ? '观天下事，知进退时'
                  : activeTab === 'wendao'
                  ? '观点广场，待续'
                  : activeTab === 'bazi' 
                  ? '知己即知天，请成为自己的答案'
                  : activeTab === 'mbti'
                  ? '知己即知天，请成为自己的答案'
                  : activeTab === 'liuyao'
                  ? '所信即所见，请相信相信的力量'
                  : '用之则行，舍之则藏'}
              </p>
            </div>
          </motion.header>

          {/* 内容区域 */}
          <div className="px-6 pb-20">
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
                ) : activeTab === 'liuyao' ? (
                  <motion.div
                    key="liuyao-content"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <LiuYaoView />
                  </motion.div>
                ) : (
                  <div className="w-full flex flex-col">
                    <motion.div
                      key="juexingcang-content"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.3 }}
                      className="w-full flex flex-col"
                    >
                      <JueXingCangView />
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </main>

      <MobileNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

const Home: React.FC = () => (
  <Suspense fallback={<div className="min-h-screen bg-[#fbf9f4]" />}>
    <HomeContent />
  </Suspense>
);

export default Home;
