'use client';

import React, { useEffect, useState } from 'react';

type IconStatus = 'pending' | 'ok' | 'error';

const iconList = [
  { label: 'favicon.ico', url: '/favicon.ico' },
  { label: 'icon-192.png', url: '/icon-192.png' },
  { label: 'icon-512.png', url: '/icon-512.png' },
  { label: 'apple-icon.png', url: '/apple-icon.png' },
];

export default function IconCheckPage() {
  const [cacheBust, setCacheBust] = useState(() => Date.now());
  const [statusMap, setStatusMap] = useState<Record<string, IconStatus>>(
    () => Object.fromEntries(iconList.map((item) => [item.url, 'pending']))
  );

  useEffect(() => {
    let isActive = true;
    const runChecks = async () => {
      for (const item of iconList) {
        try {
          const res = await fetch(item.url, { cache: 'no-store' });
          if (!isActive) return;
          if (!res.ok) {
            setStatusMap((prev) => ({ ...prev, [item.url]: 'error' }));
            continue;
          }
          const contentType = res.headers.get('content-type') || '';
          const isImage = contentType.startsWith('image/') || contentType === 'application/octet-stream';
          setStatusMap((prev) => ({ ...prev, [item.url]: isImage ? 'ok' : 'error' }));
        } catch {
          if (!isActive) return;
          setStatusMap((prev) => ({ ...prev, [item.url]: 'error' }));
        }
      }
    };

    runChecks();
    return () => {
      isActive = false;
    };
  }, [cacheBust]);

  const setStatus = (url: string, status: IconStatus) => {
    setStatusMap((prev) => ({ ...prev, [url]: status }));
  };

  return (
    <div className="min-h-screen bg-[#fbf9f4] px-6 py-12">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-serif text-stone-800">图标检查</h1>
          <button
            type="button"
            onClick={() => setCacheBust(Date.now())}
            className="text-xs px-3 py-1.5 rounded-md border border-stone-300 text-stone-700 hover:border-stone-400"
          >
            重新检测
          </button>
        </div>
        <p className="text-sm text-stone-600 mb-8">
          该页面会尝试加载所有图标文件，成功/失败一目了然。
        </p>
        <div className="space-y-4">
          {iconList.map((item) => (
            <div key={item.url} className="flex items-center gap-4">
              <div className="w-10 h-10 rounded bg-white border border-stone-200 flex items-center justify-center">
                <img
                  src={`${item.url}?v=${cacheBust}`}
                  alt={item.label}
                  className="max-w-8 max-h-8"
                  onLoad={() => setStatus(item.url, 'ok')}
                  onError={() => setStatus(item.url, 'error')}
                />
              </div>
              <div className="flex-1">
                <div className="text-sm text-stone-800">{item.label}</div>
                <div className="text-xs text-stone-500">{item.url}</div>
              </div>
              <div className="text-xs">
                {statusMap[item.url] === 'ok' && (
                  <span className="text-green-600">OK</span>
                )}
                {statusMap[item.url] === 'error' && (
                  <span className="text-red-600">失败</span>
                )}
                {statusMap[item.url] === 'pending' && (
                  <span className="text-stone-500">检测中…</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
