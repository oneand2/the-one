'use client';

import React from 'react';
import { motion } from 'framer-motion';
import type { TabType } from '@/types/tabs';

interface MobileNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const iconClass = 'w-[30px] h-[30px] flex-shrink-0';

type NavItemId = TabType;

export const MobileNav: React.FC<MobileNavProps> = ({ activeTab, onTabChange }) => {
  const navItems: Array<{
    id: NavItemId;
    label: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'guanshi',
      label: '见天地',
      icon: (
        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className={iconClass}>
          <rect x="10" y="30" width="32" height="12" fill="currentColor" />
          <rect x="58" y="30" width="32" height="12" fill="currentColor" />
          <rect x="10" y="58" width="32" height="12" fill="currentColor" />
          <rect x="58" y="58" width="32" height="12" fill="currentColor" />
        </svg>
      ),
    },
    {
      id: 'wendao',
      label: '见众生',
      icon: (
        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className={iconClass}>
          <rect x="10" y="30" width="32" height="12" fill="currentColor" />
          <rect x="58" y="30" width="32" height="12" fill="currentColor" />
          <rect x="10" y="58" width="80" height="12" fill="currentColor" />
        </svg>
      ),
    },
    {
      id: 'guanxin',
      label: '见自己',
      icon: (
        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className={iconClass}>
          <rect x="10" y="30" width="80" height="12" fill="currentColor" />
          <rect x="10" y="58" width="32" height="12" fill="currentColor" />
          <rect x="58" y="58" width="32" height="12" fill="currentColor" />
        </svg>
      ),
    },
    {
      id: 'juexingcang',
      label: '决行藏',
      icon: (
        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className={iconClass}>
          <rect x="10" y="30" width="80" height="12" fill="currentColor" rx="1" />
          <rect x="10" y="58" width="80" height="12" fill="currentColor" rx="1" />
        </svg>
      ),
    },
  ];

  const getActiveId = (itemId: NavItemId) => {
    if (itemId === 'guanxin' && (activeTab === 'guanxin' || activeTab === 'bazi' || activeTab === 'mbti')) return true;
    return activeTab === itemId;
  };

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40"
      style={{
        background: '#fbf9f4',
        boxShadow: 'none',
        paddingBottom: 'max(8px, env(safe-area-inset-bottom, 0px))',
      }}
    >

      {/* 主导航：四宫 */}
      <div className="flex items-center justify-around py-2 px-4 max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = getActiveId(item.id);
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
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
