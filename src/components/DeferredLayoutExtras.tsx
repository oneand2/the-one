'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const GetCoinsModalLayer = dynamic(
  () => import('@/components/GetCoinsModalLayer').then((m) => ({ default: m.GetCoinsModalLayer })),
  { ssr: false }
);

const InstallPrompt = dynamic(() => import('@/components/InstallPrompt'), { ssr: false });

/**
 * 首屏不阻塞：弹层与安装提示延后挂载，减少首包与主线程占用，缓解部分用户首次进入卡顿
 */
export function DeferredLayoutExtras() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const useIdle = typeof window.requestIdleCallback === 'function';
    const id = useIdle
      ? window.requestIdleCallback(() => setMounted(true), { timeout: 800 })
      : window.setTimeout(() => setMounted(true), 400);
    return () => {
      if (useIdle) window.cancelIdleCallback(id as number);
      else window.clearTimeout(id as number);
    };
  }, []);

  if (!mounted) return null;
  return (
    <>
      <GetCoinsModalLayer />
      <InstallPrompt />
    </>
  );
}
