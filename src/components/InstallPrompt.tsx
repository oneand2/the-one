"use client";
import { useState, useEffect } from "react";

export default function InstallPrompt() {
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // 1. 检查是否已经是 APP 模式 (Standalone)
    setIsStandalone(window.matchMedia("(display-mode: standalone)").matches);
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    // 2. 检查用户以前是否关闭过 (避免每次都弹，烦人)
    // 如果你想测试，可以先把这行注释掉
    const lastDismissed = localStorage.getItem("installPromptDismissed");
    if (lastDismissed && Date.now() - parseInt(lastDismissed) < 7 * 24 * 60 * 60 * 1000) {
      // 如果 7 天内关闭过，就不弹
      return;
    }

    // 3. 判断设备类型
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    // 4. 安卓：监听浏览器的安装事件
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // 延迟 3 秒显示，不要一进来就挡住视线
      setTimeout(() => setIsVisible(true), 3000);
    });

    // 5. iOS：直接延迟显示教程
    if (isIosDevice) {
      setTimeout(() => setIsVisible(true), 3000);
    }
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
    // 记录关闭时间，7天内不再打扰
    localStorage.setItem("installPromptDismissed", Date.now().toString());
  };

  if (!isVisible || isStandalone) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 rounded-xl bg-white p-4 shadow-2xl ring-1 ring-black/5 md:left-auto md:right-4 md:w-96 animate-in slide-in-from-bottom-10 fade-in duration-500">
      <div className="flex items-start justify-between">
        <div className="flex gap-4">
          {/* 这里显示的 App 图标，自动用你 public 里的图 */}
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
          // iOS 显示教程
          <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
            <p className="flex items-center gap-2">
              1. 点击浏览器底部的 <span className="text-xl">Share</span> 分享按钮
            </p>
            <p className="mt-2 flex items-center gap-2">
              2. 往下滑，选择 <span className="font-semibold text-black">添加到主屏幕</span>
            </p>
          </div>
        ) : (
          // 安卓显示按钮
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