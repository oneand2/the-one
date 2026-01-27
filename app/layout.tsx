import type { Metadata } from "next";
import { Geist, Geist_Mono, Crimson_Text, Ma_Shan_Zheng } from "next/font/google";
import { AuthButton } from "@/components/AuthButton";
import InstallPrompt from "@/components/InstallPrompt";
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
  title: "二 - 让自己 让世界变得更好",
  description: "相信终有一天，人与人之间会彼此理解。",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-icon.png",
  },
  appleWebApp: {
    title: "二",
    statusBarStyle: "default",
  },
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
        <InstallPrompt />
      </body>
    </html>
  );
}
