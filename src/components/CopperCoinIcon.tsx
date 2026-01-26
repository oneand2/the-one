'use client';

import React from 'react';

/**
 * 铜币图标 - 无印良品风格：极简、留白、中性
 * 圆形 + 内圈，线稿感，无多余装饰
 */
export function CopperCoinIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" strokeWidth="1.2" />
    </svg>
  );
}
