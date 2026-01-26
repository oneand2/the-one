import React from 'react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#fbf9f4] flex items-center justify-center px-6">
      <div className="max-w-md text-center space-y-4">
        <div className="text-sm text-stone-500">404</div>
        <h1 className="text-2xl font-serif text-stone-800">页面未找到</h1>
        <p className="text-sm text-stone-600">请检查访问地址或返回首页。</p>
      </div>
    </div>
  );
}
