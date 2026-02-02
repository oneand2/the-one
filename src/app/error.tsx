'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#fbf9f4] px-6">
      <div className="text-center space-y-4 max-w-sm">
        <p className="text-lg text-stone-600 font-serif">页面加载遇到问题</p>
        <p className="text-sm text-stone-500 font-sans">
          网络较慢或设备兼容可能导致此情况，请重试或稍后再试。
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 px-5 py-2.5 text-sm font-sans text-stone-700 bg-stone-200/80 hover:bg-stone-300/80 rounded-lg transition-colors"
        >
          重新加载
        </button>
      </div>
    </div>
  );
}
