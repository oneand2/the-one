"use client";
import { useState, useEffect } from "react";
import { isIOSEmbed } from "@/utils/iosEmbed";

function isMobileSafariBrowser() {
  const ua = navigator.userAgent;
  // iPadOS 13+ 默认使用桌面版 Safari UA，需靠触控点数识别
  const isIOSDevice = /iPhone|iPod|iPad/i.test(ua)
    || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  // 其它 iOS 浏览器也可能包含 Safari，必须同时匹配 Safari 的版本和结尾格式。
  const isSafari = /Version\/[\d.]+(?: Mobile\/\S+)? Safari\/[\d.]+$/i.test(ua)
    && !/CriOS|FxiOS|EdgiOS|OPiOS|Chrome|Chromium|DuckDuckGo|GSA\/|YaBrowser|UCBrowser|Quark|MQQBrowser|MicroMessenger|QQ\/|Weibo|AlipayClient|DingTalk|baiduboxapp/i.test(ua);
  return isIOSDevice && isSafari;
}

export default function InstallPrompt() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // 已经运行在 SwiftUI App 内，不再展示浏览器的 PWA 安装引导。
    if (isIOSEmbed()) return;

    // 只在移动端 Safari 展示，其它浏览器和电脑网页端不弹安装提醒。
    if (!isMobileSafariBrowser()) return;

    // 1. 检查是否已经是 APP 模式 (Standalone)
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return;

    // 2. 检查用户以前是否关闭过 (避免每次都弹，烦人)
    const lastDismissed = localStorage.getItem("installPromptDismissed");
    if (lastDismissed && Date.now() - parseInt(lastDismissed) < 7 * 24 * 60 * 60 * 1000) {
      return;
    }

    // 3. Safari 中延迟显示教程
    const timeout = window.setTimeout(() => setIsVisible(true), 3000);
    return () => window.clearTimeout(timeout);
  }, []);

  // 点击关闭
  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem("installPromptDismissed", Date.now().toString());
  };

  if (!isVisible) return null;

  return (
    <div className="theone-install-prompt fixed bottom-4 left-4 right-4 z-50 rounded-xl bg-white p-4 shadow-2xl ring-1 ring-black/5 animate-in slide-in-from-bottom-10 fade-in duration-500">
      <div className="flex items-start justify-between">
        <div className="flex gap-4">
          <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
             <img src="/icon-192.png" alt="App Icon" className="h-full w-full object-cover" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">安装"二"</h3>
            <p className="mt-1 text-sm text-gray-500">
              添加到主屏幕，获得更流畅的体验。
            </p>
          </div>
        </div>
        <button onClick={handleDismiss} className="text-gray-400 hover:text-gray-500">
          ✕
        </button>
      </div>

      <div className="mt-4">
        <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
          <p className="flex items-center gap-2">
            1. 点击浏览器底部的 <span className="text-xl">Share</span> 分享按钮
          </p>
          <p className="mt-2 flex items-center gap-2">
            2. 往下滑，选择 <span className="font-semibold text-black">添加到主屏幕</span>
          </p>
        </div>
      </div>
    </div>
  );
}
