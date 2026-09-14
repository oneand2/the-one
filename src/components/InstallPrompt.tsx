"use client";
import { useState, useEffect } from "react";
import { isIOSEmbed } from "@/utils/iosEmbed";

function isMobileBrowser() {
  const ua = navigator.userAgent;
  if (/iPhone|iPod|iPad|Android|Mobile/i.test(ua)) return true;
  // iPadOS 13+ 默认使用桌面版 Safari UA，需靠触控点数识别
  if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return true;
  return false;
}

export default function InstallPrompt() {
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // 已经运行在 SwiftUI App 内，不再展示浏览器的 PWA 安装引导。
    if (isIOSEmbed()) return;

    // 电脑网页端不弹自定义安装卡；桌面 Chrome/Edge 也会发 beforeinstallprompt。
    if (!isMobileBrowser()) return;

    // 1. 检查是否已经是 APP 模式 (Standalone)
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    setIsStandalone(standalone);
    if (standalone) return;

    // 2. 检查用户以前是否关闭过 (避免每次都弹，烦人)
    const lastDismissed = localStorage.getItem("installPromptDismissed");
    if (lastDismissed && Date.now() - parseInt(lastDismissed) < 7 * 24 * 60 * 60 * 1000) {
      return;
    }

    // 3. 判断设备类型
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent)
      || (/macintosh/.test(userAgent) && navigator.maxTouchPoints > 1);
    setIsIOS(isIosDevice);

    const timeouts: number[] = [];
    const showLater = () => {
      timeouts.push(window.setTimeout(() => setIsVisible(true), 3000));
    };

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      showLater();
    };

    // 4. 安卓：监听浏览器的安装事件
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);

    // 5. iOS：直接延迟显示教程
    if (isIosDevice) {
      showLater();
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      timeouts.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  // 点击"安装"按钮 (仅安卓有效)
  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setIsVisible(false);
      }
      setDeferredPrompt(null);
    }
  };

  // 点击关闭
  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem("installPromptDismissed", Date.now().toString());
  };

  if (!isVisible || isStandalone) return null;

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
              {isIOS 
                ? "添加到主屏幕，获得更流畅的体验。" 
                : "安装应用，像原生 App 一样使用。"}
            </p>
          </div>
        </div>
        <button onClick={handleDismiss} className="text-gray-400 hover:text-gray-500">
          ✕
        </button>
      </div>

      <div className="mt-4">
        {isIOS ? (
          <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
            <p className="flex items-center gap-2">
              1. 点击浏览器底部的 <span className="text-xl">Share</span> 分享按钮
            </p>
            <p className="mt-2 flex items-center gap-2">
              2. 往下滑，选择 <span className="font-semibold text-black">添加到主屏幕</span>
            </p>
          </div>
        ) : (
          <button
            onClick={handleInstallClick}
            className="w-full rounded-lg bg-black py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 active:scale-95 transition-all"
          >
            立即安装
          </button>
        )}
      </div>
    </div>
  );
}
