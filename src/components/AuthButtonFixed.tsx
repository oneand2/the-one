'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AuthButton } from '@/components/AuthButton';

/**
 * 将登录按钮通过 Portal 挂到 document.body，避免被页面内任意 scroll/transform 影响，
 * 保证在移动端始终固定于视口右上角。
 */
export function AuthButtonFixed() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || typeof document === 'undefined') {
    return null;
  }

  const wrapper = (
    <div
      className="fixed top-0 right-0 z-[9999] md:top-6 md:right-6"
      style={{
        paddingTop: 'max(12px, env(safe-area-inset-top, 0px))',
        paddingRight: 'max(12px, env(safe-area-inset-right, 0px))',
      }}
    >
      <AuthButton />
    </div>
  );

  return createPortal(wrapper, document.body);
}
