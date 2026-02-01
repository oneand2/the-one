'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { JueXingCangView } from '@/components/JueXingCangView';
import { MobileNav } from '@/components/MobileNav';
import type { TabType } from '@/types/tabs';

const Sidebar = dynamic(
  () => import('@/components/Sidebar').then((mod) => mod.Sidebar),
  { ssr: false }
);

export function JueXingCangLayout() {
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const activeTab: TabType = 'juexingcang';

  return (
    <div className="min-h-screen bg-[#fbf9f4] relative">
      {/* 左侧侧边栏 */}
      <div className="hidden md:block">
        <Sidebar
          activeTab={activeTab}
          onTabChange={(tab) => router.push(`/?tab=${tab}`)}
          isJuexingcangActive
          isCollapsed={isCollapsed}
          onMouseEnter={() => setIsCollapsed(false)}
          onMouseLeave={() => setIsCollapsed(true)}
        />
      </div>

      {/* 主内容区 */}
      <main className="min-h-screen flex items-start justify-center">
        <div className="w-full max-w-4xl">
          <JueXingCangView />
        </div>
      </main>

      <MobileNav
        activeTab={activeTab}
        onTabChange={(tab) => router.push(`/?tab=${tab}`)}
      />
    </div>
  );
}
