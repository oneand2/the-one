import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Debug 版 iOS 模拟器通过 loopback 加载同一套页面；允许其连接开发热更新资源。
  allowedDevOrigins: ["127.0.0.1"],
  // App 内调试时不显示 Next.js 浮动标记，避免遮挡真实移动端布局。
  devIndicators: false,
  // 注意：output: 'export' 已经被删除了，这样你的 API 路由才能正常工作
  images: {
    unoptimized: true,
  },
  // 静态资源与 JS 分片长期缓存，用户第二次进入时从浏览器缓存加载
  // 注意：仅生产环境启用 immutable 长缓存；开发环境长缓存会导致改动后浏览器仍加载旧分片
  async headers() {
    if (process.env.NODE_ENV !== "production") return [];
    return [
      {
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
