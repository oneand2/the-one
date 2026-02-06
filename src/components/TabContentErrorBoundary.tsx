'use client';

import React from 'react';

interface State {
  hasError: boolean;
}

/**
 * 首页 Tab 内容错误边界：捕获见天地/八字/六爻等动态组件的抛错，
 * 避免整页崩溃和「加载中… ↔ Application error」的来回切换循环
 */
export class TabContentErrorBoundary extends React.Component<
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
    console.error('TabContentErrorBoundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[280px] flex flex-col items-center justify-center text-stone-500 text-sm font-sans px-4">
          <p>内容暂时无法加载</p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="mt-3 px-4 py-2 text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors"
          >
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
