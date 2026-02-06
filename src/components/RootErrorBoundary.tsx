'use client';

import React from 'react';

interface State {
  hasError: boolean;
}

/**
 * 根级错误边界：捕获 layout 及子树的客户端异常，避免整页白屏或 Next 默认报错
 */
export class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('RootErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#fbf9f4] px-6">
          <div className="text-center space-y-4 max-w-sm">
            <p className="text-lg text-stone-600 font-serif">页面加载遇到问题</p>
            <p className="text-sm text-stone-500 font-sans">
              请检查 .env.local 是否配置了 NEXT_PUBLIC_SUPABASE_URL 和
              NEXT_PUBLIC_SUPABASE_ANON_KEY，或稍后重试。
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 px-5 py-2.5 text-sm font-sans text-stone-700 bg-stone-200/80 hover:bg-stone-300/80 rounded-lg transition-colors"
            >
              重新加载
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
