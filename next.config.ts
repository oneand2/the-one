import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // 注意：output: 'export' 已经被删除了，这样你的 API 路由才能正常工作
  images: {
    unoptimized: true,
  },
  // 静态资源与 JS 分片长期缓存，用户第二次进入时从浏览器缓存加载
  async headers() {
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
