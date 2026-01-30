'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { BaZiView } from '@/components/BaZiView';
import { LiuYaoView } from '@/components/LiuYaoView';
import { JueXingCangView } from '@/components/JueXingCangView';
import { MbtiTestView } from '@/components/MbtiTestView';
type TabType = 'bazi' | 'mbti' | 'liuyao' | 'liuji';

const Sidebar = dynamic(
  () => import('@/components/Sidebar').then((mod) => mod.Sidebar),
  { ssr: false }
);

const Home: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('mbti');
  const [isCollapsed, setIsCollapsed] = useState(true);

  return (
    <div className="min-h-screen bg-[#fbf9f4] relative">
      {/* 左侧侧边栏 */}
      <Sidebar 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
        isCollapsed={isCollapsed}
        onMouseEnter={() => setIsCollapsed(false)}
        onMouseLeave={() => setIsCollapsed(true)}
      />

      {/* 主内容区 - 占据全屏，内容居中 */}
      <main className="min-h-screen flex items-start justify-center overflow-y-auto">
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
                {(activeTab === 'liuyao' || activeTab === 'liuji') ? (
                  // 少阳 - 上实下虚
                  <svg 
                    viewBox="0 0 100 100" 
                    xmlns="http://www.w3.org/2000/svg" 
                    fill="currentColor" 
                    preserveAspectRatio="xMidYMid meet" 
                    className="w-8 h-8 mx-auto text-[#2c2c2c] mb-4"
                  >
                    <rect x="0" y="20" width="100" height="20" />
                    <rect x="0" y="60" width="44" height="20" />
                    <rect x="56" y="60" width="44" height="20" />
                  </svg>
                ) : (
                  // 少阴 - 上虚下实
                  <svg 
                    viewBox="0 0 100 100" 
                    xmlns="http://www.w3.org/2000/svg" 
                    fill="currentColor" 
                    preserveAspectRatio="xMidYMid meet" 
                    className="w-8 h-8 mx-auto text-[#2c2c2c] mb-4"
                  >
                    <rect x="0" y="20" width="44" height="20" />
                    <rect x="56" y="20" width="44" height="20" />
                    <rect x="0" y="60" width="100" height="20" />
                  </svg>
                )}
              </motion.div>
              <h1 className="text-3xl font-serif text-[#333333] leading-tight">
                {activeTab === 'bazi' ? '八字命理' : activeTab === 'mbti' ? '荣格八维' : activeTab === 'liuyao' ? '六爻占卜' : '六济问津'}
              </h1>
              <p className="text-sm text-stone-600 font-sans text-center">
                {activeTab === 'bazi' 
                  ? '知己即知天，请成为自己的答案'
                  : activeTab === 'mbti'
                  ? '知己即知天，请成为自己的答案'
                  : activeTab === 'liuyao'
                  ? '所信即所见，请相信相信的力量'
                  : '观济 同济 涉济 化济 既济 未济'}
              </p>
            </div>
          </motion.header>

          {/* 内容区域 */}
          <div className="px-6 pb-20">
            <div className="max-w-md mx-auto">
              <AnimatePresence mode="wait">
                {activeTab === 'bazi' ? (
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
                  <div className="h-[calc(100vh-12rem)] min-h-[420px] w-full flex flex-col">
                    <motion.div
                      key="liuji-content"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.3 }}
                      className="w-full h-full min-h-0 flex flex-col"
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
    </div>
  );
};

export default Home;
