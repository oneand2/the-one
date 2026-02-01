'use client';

import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { TabType } from '@/types/tabs';

const SUBMENU_LEAVE_DELAY_MS = 180;

interface SidebarProps {
  activeTab: TabType;
  onTabChange: React.Dispatch<React.SetStateAction<TabType>>;
  onJuexingcangNavigate?: () => void;
  isJuexingcangActive?: boolean;
  isCollapsed: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

type TabItem = 
  | { id: 'guanshi' | 'wendao'; label: string; subTabs?: never }
  | { id: 'liuji'; label: string; subTabs?: never }
  | { id: 'guanxin'; label: string; subTabs: Array<{ id: TabType; label: string }> };

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, onJuexingcangNavigate, isJuexingcangActive, isCollapsed, onMouseEnter, onMouseLeave }) => {
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLeaveTimer = useCallback(() => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  }, []);

  const scheduleLeave = useCallback(() => {
    clearLeaveTimer();
    leaveTimerRef.current = setTimeout(() => setHoveredTab(null), SUBMENU_LEAVE_DELAY_MS);
  }, [clearLeaveTimer]);

  const handleSubMenuEnter = useCallback((tabId: string) => {
    clearLeaveTimer();
    setHoveredTab(tabId);
  }, [clearLeaveTimer]);

  const tabs: TabItem[] = [
    { id: 'guanshi' as const, label: '见天地' },
    { id: 'wendao' as const, label: '见众生' },
    { 
      id: 'guanxin' as const, 
      label: '见自己',
      subTabs: [
        { id: 'bazi' as TabType, label: '八字' },
        { id: 'mbti' as TabType, label: '八维' },
        { id: 'liuyao' as TabType, label: '六爻' },
      ]
    },
    { id: 'liuji' as const, label: '决行藏' },
  ];

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="fixed left-0 top-0 z-50 h-screen"
      style={{ width: '160px' }}
    >
      {/* 收起时的墨痕提示 */}
      <motion.div
        className="absolute left-0 top-0 h-full pointer-events-none"
        style={{ width: '12px' }}
        animate={{
          opacity: isCollapsed ? [0.2, 0.35, 0.2] : 0,
        }}
        transition={{
          duration: isCollapsed ? 3 : 1,
          repeat: isCollapsed ? Infinity : 0,
          ease: 'easeInOut',
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to right, rgba(120, 113, 108, 0.15), transparent)',
          }}
        />
      </motion.div>

      {/* 背景层 */}
      <motion.div
        className="absolute left-0 top-0 h-screen bg-[#fbf9f4]"
        style={{ width: '160px' }}
        animate={{
          opacity: isCollapsed ? 0 : 1,
        }}
        transition={{
          duration: 1.2,
          ease: [0.25, 0.1, 0.25, 1],
        }}
      />

      {/* 老阳 Logo - 始终显示，不受收起影响，平时半透明 */}
      <motion.div 
        className="absolute left-0 top-0 w-full flex justify-center pointer-events-none"
        style={{ paddingTop: '48px' }}
        animate={{
          opacity: isCollapsed ? 0.35 : 1,
        }}
        transition={{
          duration: 0.8,
          ease: [0.25, 0.1, 0.25, 1],
        }}
      >
        <svg 
          viewBox="0 0 60 40" 
          xmlns="http://www.w3.org/2000/svg" 
          className="text-stone-700"
          style={{ 
            width: '48px', 
            height: '32px',
            fill: 'currentColor',
          }}
        >
          <rect x="0" y="4" width="60" height="6" rx="1" />
          <rect x="0" y="30" width="60" height="6" rx="1" />
        </svg>
      </motion.div>

      {/* 侧边栏内容（淡入淡出部分） - 使用 Flexbox 流式布局确保跨浏览器兼容 */}
      <motion.div
          initial={{ opacity: isCollapsed ? 0 : 1 }}
          animate={{
            opacity: isCollapsed ? 0 : 1,
          }}
          transition={{
            duration: 1.2,
            ease: [0.25, 0.1, 0.25, 1],
          }}
          className="absolute left-0 top-0 w-full h-full"
          style={{
            pointerEvents: isCollapsed ? 'none' : 'auto',
          }}
        >
        {/* Flexbox 主容器 - 三段式流式布局 */}
        <div 
          className="w-full h-full flex flex-col items-center px-6"
          style={{
            minHeight: '100vh',
            paddingTop: '130px',
            paddingBottom: '48px',
          }}
        >
          {/* Top Section: 上联 - 世界即道场 人生是修行 */}
          <div className="hidden md:flex w-full justify-center flex-shrink-0" style={{ marginBottom: '40px' }}>
            <div className="flex items-center justify-center gap-3">
              {/* 第一行：世界即道场 */}
              <div className="flex flex-col items-center" style={{ gap: '8px' }}>
                {['世', '界', '即', '道', '场'].map((char, i) => (
                  <span
                    key={i}
                    className="text-stone-400"
                    style={{ 
                      fontSize: '13px', 
                      letterSpacing: '0.1em', 
                      opacity: 0.65,
                      fontFamily: '"Kaiti SC", KaiTi, STKaiti, "华文楷体", "楷体", Georgia, serif',
                      fontWeight: 400,
                    }}
                  >
                    {char}
                  </span>
                ))}
              </div>
              {/* 间隔 */}
              <div style={{ width: '6px' }} />
              {/* 第二行：人生是修行 */}
              <div className="flex flex-col items-center" style={{ gap: '8px' }}>
                {['人', '生', '是', '修', '行'].map((char, i) => (
                  <span
                    key={i}
                    className="text-stone-400"
                    style={{ 
                      fontSize: '13px', 
                      letterSpacing: '0.1em', 
                      opacity: 0.65,
                      fontFamily: '"Kaiti SC", KaiTi, STKaiti, "华文楷体", "楷体", Georgia, serif',
                      fontWeight: 400,
                    }}
                  >
                    {char}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Middle Section: 导航按钮 */}
          <div className="w-full flex flex-col items-center" style={{ marginBottom: '40px' }}>
            {/* 上装饰线 */}
            <div 
              style={{ 
                width: '18px', 
                height: '1px', 
                backgroundColor: 'rgba(168, 162, 158, 0.2)',
                marginBottom: '24px',
                flexShrink: 0,
              }}
            />

            {/* 导航菜单 */}
            <nav 
              className="w-full flex flex-col items-center justify-center" 
              style={{ gap: '28px' }}
            >
              {tabs.map((tab) => (
                <div 
                  key={tab.id}
                  className="relative flex items-center justify-center"
                  onMouseEnter={() => {
                    clearLeaveTimer();
                    if ('subTabs' in tab) setHoveredTab(tab.id);
                  }}
                  onMouseLeave={() => ('subTabs' in tab ? scheduleLeave() : setHoveredTab(null))}
                >
                  <button
                    onClick={() => {
                      if ('subTabs' in tab && tab.subTabs) {
                        // 如果有子菜单，点击时切换到第一个子选项
                        onTabChange(tab.subTabs[0].id);
                      } else if (tab.id === 'liuji' && onJuexingcangNavigate) {
                        onJuexingcangNavigate();
                      } else {
                        const tabId = tab.id;
                        if (tabId === 'guanshi' || tabId === 'wendao') {
                          onTabChange(tabId);
                        }
                      }
                    }}
                    className="relative flex items-center justify-center"
                  >
                    <span 
                      className="transition-all duration-500"
                      style={{
                        fontSize: '15px',
                        letterSpacing: '0.35em',
                        color: ('subTabs' in tab && tab.subTabs && tab.subTabs.some(sub => sub.id === activeTab)) || (tab.id !== 'liuji' && activeTab === tab.id) || (tab.id === 'liuji' && isJuexingcangActive)
                          ? '#57534e' 
                          : '#a8a29e',
                        fontFamily: '"Kaiti SC", KaiTi, STKaiti, "华文楷体", "楷体", Georgia, serif',
                        fontWeight: 400,
                        display: 'block',
                        textAlign: 'center',
                      }}
                    >
                      {tab.label}
                    </span>
                    
                    {/* 选中指示器 */}
                    {(('subTabs' in tab && tab.subTabs && tab.subTabs.some(sub => sub.id === activeTab)) || (tab.id !== 'liuji' && activeTab === tab.id) || (tab.id === 'liuji' && isJuexingcangActive)) && (
                      <motion.div
                        layoutId="activeIndicator"
                        style={{
                          position: 'absolute',
                          bottom: '-10px',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          width: '18px',
                          height: '1px',
                          backgroundColor: '#78716c',
                        }}
                        initial={false}
                        transition={{
                          type: 'spring',
                          stiffness: 300,
                          damping: 30,
                        }}
                      />
                    )}
                  </button>

                  {/* 子菜单 - 优雅的垂直布局 */}
                  {'subTabs' in tab && tab.subTabs && (
                    <AnimatePresence>
                      {hoveredTab === tab.id && (
                        <motion.div
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -8 }}
                          transition={{ 
                            duration: 0.35,
                            ease: [0.25, 0.1, 0.25, 1]
                          }}
                          className="absolute left-full top-1/2 -translate-y-1/2"
                          style={{ marginLeft: '32px' }}
                          onMouseEnter={() => handleSubMenuEnter(tab.id)}
                          onMouseLeave={scheduleLeave}
                        >
                          {/* 装饰性连接线 */}
                          <div 
                            className="absolute right-full top-1/2 -translate-y-1/2"
                            style={{ width: '20px', height: '1px', backgroundColor: 'rgba(168, 162, 158, 0.15)' }}
                          />
                          
                          {/* 子菜单容器 */}
                          <div className="relative">
                            {/* 上装饰线 */}
                            <div 
                              style={{ 
                                width: '12px', 
                                height: '1px', 
                                backgroundColor: 'rgba(168, 162, 158, 0.2)',
                                marginBottom: '18px',
                                marginLeft: 'auto',
                                marginRight: 'auto',
                              }}
                            />
                            
                            {/* 选项列表 */}
                            <div className="flex flex-col" style={{ gap: '20px' }}>
                              {tab.subTabs?.map((subTab, index) => (
                                <button
                                  key={subTab.id}
                                  onClick={() => onTabChange(subTab.id)}
                                  className="relative group"
                                >
                                  <span
                                    className="transition-all duration-400"
                                    style={{
                                      fontSize: '14px',
                                      letterSpacing: '0.25em',
                                      color: activeTab === subTab.id ? '#57534e' : '#c7c3be',
                                      fontFamily: '"Kaiti SC", KaiTi, STKaiti, "华文楷体", "楷体", Georgia, serif',
                                      fontWeight: 400,
                                      display: 'block',
                                      textAlign: 'center',
                                    }}
                                  >
                                    {subTab.label}
                                  </span>
                                  
                                  {/* 选中时的装饰点 */}
                                  {activeTab === subTab.id && (
                                    <motion.div
                                      initial={{ scale: 0 }}
                                      animate={{ scale: 1 }}
                                      style={{
                                        position: 'absolute',
                                        right: '-8px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        width: '3px',
                                        height: '3px',
                                        borderRadius: '50%',
                                        backgroundColor: '#78716c',
                                      }}
                                    />
                                  )}
                                </button>
                              ))}
                            </div>
                            
                            {/* 下装饰线 */}
                            <div 
                              style={{ 
                                width: '12px', 
                                height: '1px', 
                                backgroundColor: 'rgba(168, 162, 158, 0.2)',
                                marginTop: '18px',
                                marginLeft: 'auto',
                                marginRight: 'auto',
                              }}
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  )}
                </div>
              ))}
            </nav>

            {/* 下装饰线 */}
            <div 
              style={{ 
                width: '18px', 
                height: '1px', 
                backgroundColor: 'rgba(168, 162, 158, 0.2)',
                marginTop: '24px',
                flexShrink: 0,
              }}
            />
          </div>

          {/* 填充剩余空间 */}
          <div style={{ flex: '1 1 auto', minHeight: '40px' }} />

          {/* Bottom Section: 下联 + 装饰线条 */}
          <div className="hidden md:flex w-full flex-col items-center flex-shrink-0" style={{ gap: '24px' }}>
            {/* 下联：一一如孤镜 忘二空恋影 */}
            <div className="flex items-center justify-center gap-3">
              {/* 第一行：一一如孤镜 */}
              <div className="flex flex-col items-center" style={{ gap: '8px' }}>
                {['一', '一', '如', '孤', '镜'].map((char, i) => (
                  <span
                    key={i}
                    className="text-stone-400"
                    style={{ 
                      fontSize: '13px', 
                      letterSpacing: '0.1em', 
                      opacity: 0.65,
                      fontFamily: '"Kaiti SC", KaiTi, STKaiti, "华文楷体", "楷体", Georgia, serif',
                      fontWeight: 400,
                    }}
                  >
                    {char}
                  </span>
                ))}
              </div>
              {/* 间隔 */}
              <div style={{ width: '6px' }} />
              {/* 第二行：忘二空恋影 */}
              <div className="flex flex-col items-center" style={{ gap: '8px' }}>
                {['忘', '二', '空', '恋', '影'].map((char, i) => (
                  <span
                    key={i}
                    className="text-stone-400"
                    style={{ 
                      fontSize: '13px', 
                      letterSpacing: '0.1em', 
                      opacity: 0.65,
                      fontFamily: '"Kaiti SC", KaiTi, STKaiti, "华文楷体", "楷体", Georgia, serif',
                      fontWeight: 400,
                    }}
                  >
                    {char}
                  </span>
                ))}
              </div>
            </div>

            {/* 装饰线条组 */}
            <div className="flex flex-col items-center" style={{ gap: '24px' }}>
              {/* 第一组：短线 */}
              <div className="flex items-center" style={{ gap: '8px' }}>
                <div style={{ width: '6px', height: '1px', backgroundColor: 'rgba(168, 162, 158, 0.15)' }} />
                <div style={{ width: '12px', height: '1px', backgroundColor: 'rgba(168, 162, 158, 0.15)' }} />
                <div style={{ width: '6px', height: '1px', backgroundColor: 'rgba(168, 162, 158, 0.15)' }} />
              </div>
              
              {/* 第二组：更短的线 */}
              <div style={{ width: '8px', height: '1px', backgroundColor: 'rgba(168, 162, 158, 0.12)' }} />
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
