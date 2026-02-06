'use client';

/**
 * 根级全局错误：捕获未被 error boundary 处理的客户端异常，
 * 避免出现默认的 "Application error" 与页面来回跳转（尤其在 Chrome）。
 * 开发环境下 Next 仍会显示 overlay，生产环境会显示本组件。
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-CN">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#fbf9f4' }}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            boxSizing: 'border-box',
          }}
        >
          <div style={{ textAlign: 'center', maxWidth: 360 }}>
            <p style={{ fontSize: 18, color: '#57534e', marginBottom: 8 }}>
              页面加载遇到问题
            </p>
            <p style={{ fontSize: 14, color: '#78716c', marginBottom: 24 }}>
              请检查网络与浏览器设置（如无痕模式或隐私限制），或稍后重试。
            </p>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                padding: '10px 20px',
                fontSize: 14,
                color: '#44403c',
                background: 'rgba(214, 211, 209, 0.8)',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              重试
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
