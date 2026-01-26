'use client';

import React, { useEffect } from 'react';

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('App error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#fbf9f4] flex items-center justify-center px-6">
      <div className="max-w-md text-center space-y-4">
        <div className="text-sm text-stone-500">页面发生错误</div>
        <h1 className="text-2xl font-serif text-stone-800">请刷新重试</h1>
        <button
          onClick={reset}
          className="mt-2 inline-flex items-center justify-center rounded-md border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:border-stone-400"
        >
          重新加载
        </button>
      </div>
    </div>
  );
}
