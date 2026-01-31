import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  
  // 🔥 Capacitor 静态导出配置（用于 Android/iOS 打包）
  output: 'export',
  
  // 静态导出需要禁用图片优化
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
