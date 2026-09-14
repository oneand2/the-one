import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Crimson_Text, Ma_Shan_Zheng } from "next/font/google";
import { AuthButton } from "@/components/AuthButton";
import { DeferredLayoutExtras } from "@/components/DeferredLayoutExtras";
import { PreconnectSupabase } from "@/components/PreconnectSupabase";
import { RootErrorBoundary } from "@/components/RootErrorBoundary";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const crimsonText = Crimson_Text({
  variable: "--font-crimson-text",
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
});

const maShanZheng = Ma_Shan_Zheng({
  variable: "--font-ma-shan-zheng",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

export const metadata: Metadata = {
  // 👇 网页标签页显示的标题
  title: "二 - 让自己 让世界变得更好",
  applicationName: "二",
  description: "自我探索、心理类型与传统文化工具，以及清楚透明的数字内容服务。",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    // 👇 关键：这是 iPhone 桌面上显示的 App 名字，必须改成 "二"
    title: "二",
    capable: true,
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#fbf9f4",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${crimsonText.variable} ${maShanZheng.variable} antialiased relative`}
      >
        <RootErrorBoundary>
          <PreconnectSupabase />
          {/* 登录入口：定位在页面右上角，随页面滚动 */}
          <div
            className="web-auth-entry fixed top-0 right-0 z-50 md:top-6 md:right-6"
            style={{
              paddingTop: 'max(12px, env(safe-area-inset-top, 0px))',
              paddingRight: 'max(12px, env(safe-area-inset-right, 0px))',
            }}
          >
            <AuthButton />
          </div>
          {children}
          <DeferredLayoutExtras />
        </RootErrorBoundary>
      </body>
    </html>
  );
}
