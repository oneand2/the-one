'use client';

import { useEffect } from 'react';

/**
 * 尽早建立与 Supabase 的连接，减少首屏数据请求延迟（缓解首次进入卡顿）
 */
export function PreconnectSupabase() {
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) return;
    try {
      const origin = new URL(url).origin;
      const existing = document.querySelector(`link[rel="preconnect"][href="${origin}"]`);
      if (existing) return;
      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = origin;
      document.head.appendChild(link);
    } catch {
      // ignore
    }
  }, []);
  return null;
}
