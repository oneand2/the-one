'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type TabType = 'guanshi' | 'bazi' | 'mbti' | 'liuyao' | 'liuji' | 'wendao';

interface MobileNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const iconClass = 'w-[30px] h-[30px] flex-shrink-0';

export const MobileNav: React.FC<MobileNavProps> = ({ activeTab, onTabChange }) => {
  const [subNavGroup, setSubNavGroup] = useState<'mbti' | 'liuyao' | null>(null);
  const navItems: Array<{
    id: TabType;
    label: string;
    icon: React.ReactNode;
    subTabs?: Array< { id: TabType; label: string }>;
  }> = [
    {
      id: 'guanshi',
      label: '观世',
      icon: (
        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className={iconClass}>
          <rect x="10" y="30" width="80" height="12" fill="currentColor" rx="1" />
          <rect x="10" y="58" width="80" height="12" fill="currentColor" rx="1" />
        </svg>
      ),
    },
    {
      id: 'mbti',
      label: '观心',
      icon: (
        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className={iconClass}>
          <rect x="10" y="30" width="32" height="12" fill="currentColor" />
          <rect x="58" y="30" width="32" height="12" fill="currentColor" />
          <rect x="10" y="58" width="80" height="12" fill="currentColor" />
        </svg>
      ),
      subTabs: [{ id: 'bazi', label: '八字' }, { id: 'mbti', label: '八维' }],
    },
    {
      id: 'liuyao',
      label: '问途',
      icon: (
        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className={iconClass}>
          <rect x="10" y="30" width="80" height="12" fill="currentColor" />
          <rect x="10" y="58" width="32" height="12" fill="currentColor" />
          <rect x="58" y="58" width="32" height="12" fill="currentColor" />
        </svg>
      ),
      subTabs: [{ id: 'liuyao', label: '六爻' }, { id: 'liuji', label: '六济' }],
    },
    {
      id: 'wendao',
      label: '问道',
      icon: (
        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" strokeWidth="12" className={iconClass}>
          <line x1="10" y1="36" x2="38" y2="36" />
          <line x1="62" y1="36" x2="90" y2="36" />
          <line x1="10" y1="64" x2="38" y2="64" />
          <line x1="62" y1="64" x2="90" y2="64" />
        </svg>
      ),
    },
  ];

  const getActiveId = (itemId: TabType) => {
    if (itemId === 'mbti' && (activeTab === 'bazi' || activeTab === 'mbti')) return true;
    if (itemId === 'liuyao' && (activeTab === 'liuyao' || activeTab === 'liuji')) return true;
    return activeTab === itemId;
  };

  const showSubNav = subNavGroup !== null;
  const subTabs = subNavGroup === 'mbti'
    ? [{ id: 'bazi' as TabType, label: '八字' }, { id: 'mbti' as TabType, label: '八维' }]
    : subNavGroup === 'liuyao'
      ? [{ id: 'liuyao' as TabType, label: '六爻' }, { id: 'liuji' as TabType, label: '六济' }]
      : [];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40"
      style={{
        background: '#fbf9f4',
        boxShadow: 'none',
        paddingBottom: 'max(8px, env(safe-area-inset-bottom, 0px))',
      }}
    >

      {/* 子导航：观心时显示八字/八维，问途时显示六爻/六济 */}
      <AnimatePresence initial={false}>
        {showSubNav && subTabs.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden"
          >
            <div className="flex items-center justify-center gap-4 py-1.5 px-3 border-b border-stone-200/40">
              {subTabs.map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => {
                    onTabChange(sub.id);
                    setSubNavGroup(null);
                  }}
                  className="relative px-3 py-1 rounded-md transition-colors active:bg-stone-200/30"
                  aria-label={sub.label}
                >
                  <span
                    className="text-[13px] tracking-[0.2em] transition-colors"
                    style={{
                      color: activeTab === sub.id ? '#57534e' : '#a8a29e',
                      fontFamily: '"Kaiti SC", KaiTi, STKaiti, "华文楷体", "楷体", Georgia, serif',
                    }}
                  >
                    {sub.label}
                  </span>
                  {activeTab === sub.id && (
                    <motion.div
                      layoutId="mobileSubIndicator"
                      className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3 h-0.5 rounded-full bg-stone-500"
                      initial={false}
                      transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                    />
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 主导航：四宫 */}
      <div className="flex items-center justify-around py-2 px-4 max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = getActiveId(item.id) || subNavGroup === item.id;
          const hasSubTabs = Boolean(item.subTabs && item.subTabs.length > 0);
          return (
            <button
              key={item.id}
              onClick={() => {
                if (hasSubTabs) {
                  setSubNavGroup((prev) => (prev === item.id ? null : (item.id as 'mbti' | 'liuyao')));
                  return;
                }
                setSubNavGroup(null);
                onTabChange(item.id);
              }}
              className="relative flex flex-col items-center justify-center gap-1.5 py-2 px-3 min-w-[68px] rounded-md transition-colors duration-300 active:bg-stone-200/20"
              aria-label={item.label}
            >
              <div className="transition-colors duration-300" style={{ color: isActive ? '#57534e' : '#a8a29e' }}>
                {item.icon}
              </div>
              <span
                className="text-[13px] transition-colors duration-300 tracking-[0.15em]"
                style={{
                  color: isActive ? '#57534e' : '#a8a29e',
                  fontFamily: '"Kaiti SC", KaiTi, STKaiti, "华文楷体", "楷体", Georgia, serif',
                }}
              >
                {item.label}
              </span>
              {isActive && (
                <motion.div
                  layoutId="mobileActiveIndicator"
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-[3px] rounded-full"
                  style={{ backgroundColor: '#78716c' }}
                  initial={false}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
