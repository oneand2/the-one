import type { Metadata } from "next";
import { Geist, Geist_Mono, Crimson_Text, Ma_Shan_Zheng } from "next/font/google";
import { AuthButton } from "@/components/AuthButton";
import { GetCoinsModalLayer } from "@/components/GetCoinsModalLayer";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const crimsonText = Crimson_Text({
  variable: "--font-crimson-text",
  subsets: ["latin"],
  weight: ["400", "600"],
});

const maShanZheng = Ma_Shan_Zheng({
  variable: "--font-ma-shan-zheng",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "八字命理 - 探索内在能量",
  description: "基于八字命理的性格分析与能量分布洞察",
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
        {/* 登录入口：定位在页面右上角，随页面滚动 */}
        <div
          className="absolute top-0 right-0 z-50 md:top-6 md:right-6"
          style={{
            paddingTop: 'max(12px, env(safe-area-inset-top, 0px))',
            paddingRight: 'max(12px, env(safe-area-inset-right, 0px))',
          }}
        >
          <AuthButton />
        </div>
        <GetCoinsModalLayer />
        {children}
      </body>
    </html>
  );
}
