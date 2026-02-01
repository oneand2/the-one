'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** 重定向到主页决行藏 tab，保持与其它 tab 一致的丝滑切换体验 */
export default function JueXingCangPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/?tab=juexingcang');
  }, [router]);
  return (
    <div className="min-h-screen bg-[#fbf9f4] flex items-center justify-center">
      <div className="animate-pulse text-stone-400 text-sm">加载中...</div>
    </div>
  );
}
