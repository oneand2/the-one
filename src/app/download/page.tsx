'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Smartphone, Monitor, Share, Plus, Download, ArrowRight } from 'lucide-react';

export default function DownloadPage() {
  const [deviceType, setDeviceType] = useState<'ios' | 'android' | 'desktop'>('desktop');

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setDeviceType('ios');
    } else if (/android/.test(ua)) {
      setDeviceType('android');
    } else {
      setDeviceType('desktop');
    }
  }, []);


  return (
    <div className="min-h-screen bg-[#FBF9F4] px-4 py-12">
      <div className="max-w-2xl mx-auto">
        {/* 返回链接 */}
        <Link href="/" className="text-sm text-stone-500 hover:text-stone-800 font-sans inline-block mb-8">
          ← 返回首页
        </Link>

        {/* 标题 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h1 className="text-3xl font-serif text-stone-800 mb-4">客户端下载</h1>
          <p className="text-sm text-stone-600 font-sans">
            获取更好的使用体验
          </p>
        </motion.div>

        {/* iOS 用户 - 添加到主屏幕教程 */}
        {(deviceType === 'ios' || deviceType === 'desktop') && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mb-8"
          >
            <div className="bg-white rounded-2xl border border-stone-200 p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center">
                  <Smartphone className="w-6 h-6 text-stone-600" />
                </div>
                <div>
                  <h2 className="text-xl font-serif text-stone-800">iOS 用户</h2>
                  <p className="text-sm text-stone-500 font-sans">添加到主屏幕</p>
                </div>
              </div>

              <div className="space-y-6">
                {/* 步骤 1 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-stone-800 text-white flex items-center justify-center text-sm font-sans">
                      1
                    </div>
                  </div>
                  <div className="flex-1 pt-1">
                    <h3 className="text-base font-sans text-stone-800 mb-2">
                      点击分享按钮
                    </h3>
                    <p className="text-sm text-stone-600 font-sans mb-3">
                      在 Safari 浏览器底部找到分享按钮
                    </p>
                    <div className="flex items-center gap-2 px-4 py-3 bg-stone-50 rounded-lg border border-stone-200">
                      <Share className="w-5 h-5 text-blue-600" />
                      <span className="text-sm font-sans text-stone-700">Safari 底部分享图标</span>
                    </div>
                  </div>
                </div>

                {/* 装饰线 */}
                <div className="ml-4 w-px h-6 bg-stone-200" />

                {/* 步骤 2 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-stone-800 text-white flex items-center justify-center text-sm font-sans">
                      2
                    </div>
                  </div>
                  <div className="flex-1 pt-1">
                    <h3 className="text-base font-sans text-stone-800 mb-2">
                      选择"添加到主屏幕"
                    </h3>
                    <p className="text-sm text-stone-600 font-sans mb-3">
                      在弹出的菜单中找到此选项
                    </p>
                    <div className="flex items-center gap-2 px-4 py-3 bg-stone-50 rounded-lg border border-stone-200">
                      <Plus className="w-5 h-5 text-stone-600" />
                      <span className="text-sm font-sans text-stone-700">添加到主屏幕</span>
                    </div>
                  </div>
                </div>

                {/* 装饰线 */}
                <div className="ml-4 w-px h-6 bg-stone-200" />

                {/* 步骤 3 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-stone-800 text-white flex items-center justify-center text-sm font-sans">
                      3
                    </div>
                  </div>
                  <div className="flex-1 pt-1">
                    <h3 className="text-base font-sans text-stone-800 mb-2">
                      完成添加
                    </h3>
                    <p className="text-sm text-stone-600 font-sans">
                      点击"添加"按钮，应用图标将出现在主屏幕上
                    </p>
                  </div>
                </div>
              </div>

              {/* 提示信息 */}
              <div className="mt-6 pt-6 border-t border-stone-100">
                <p className="text-xs text-stone-500 font-sans text-center">
                  💡 添加后可像原生 App 一样使用，无需每次打开浏览器
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Android 用户 - APK 下载 */}
        {(deviceType === 'android' || deviceType === 'desktop') && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: deviceType === 'desktop' ? 0.2 : 0.1 }}
            className="mb-8"
          >
            <div className="bg-white rounded-2xl border border-stone-200 p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center">
                  <Smartphone className="w-6 h-6 text-stone-600" />
                </div>
                <div>
                  <h2 className="text-xl font-serif text-stone-800">Android 用户</h2>
                  <p className="text-sm text-stone-500 font-sans">下载安装包</p>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-sm text-stone-600 font-sans">
                  点击下方按钮下载安装包，下载完成后打开文件进行安装
                </p>

                <a
                  href="/app-release.apk"
                  download="the-one.apk"
                  className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-stone-800 text-white rounded-xl hover:bg-stone-700 transition-all duration-300 group"
                >
                  <Download className="w-5 h-5" />
                  <span className="text-base font-sans">下载安卓客户端</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </a>

                {/* 安装提示 */}
                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs text-amber-900 font-sans leading-relaxed">
                    ⚠️ 安装时如提示"未知来源"，请在设置中允许安装此应用。
                    <br />
                    这是因为应用未在应用商店上架，但完全安全可用。
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* 桌面用户提示 */}
        {deviceType === 'desktop' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mb-8"
          >
            <div className="bg-white rounded-2xl border border-stone-200 p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center">
                  <Monitor className="w-6 h-6 text-stone-600" />
                </div>
                <div>
                  <h2 className="text-xl font-serif text-stone-800">桌面端</h2>
                  <p className="text-sm text-stone-500 font-sans">推荐使用浏览器访问</p>
                </div>
              </div>

              <p className="text-sm text-stone-600 font-sans leading-relaxed mb-6">
                桌面端暂无独立客户端，建议使用现代浏览器（Chrome、Safari、Edge 等）访问本网站，
                体验已针对桌面端进行优化。
              </p>

              {/* 二维码部分 */}
              <div className="pt-6 border-t border-stone-100">
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  {/* 二维码 */}
                  <div className="flex-shrink-0">
                    <div className="relative">
                      <div className="w-32 h-32 bg-white rounded-xl border-2 border-stone-200 p-2 shadow-sm">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent('https://www.the-one-and-the-two.com/download')}`}
                          alt="下载页面二维码"
                          className="w-full h-full"
                        />
                      </div>
                      {/* 装饰角标 */}
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-stone-800 rounded-full flex items-center justify-center">
                        <Smartphone className="w-3.5 h-3.5 text-white" />
                      </div>
                    </div>
                  </div>

                  {/* 说明文字 */}
                  <div className="flex-1 text-center sm:text-left">
                    <h3 className="text-base font-sans text-stone-800 mb-2">
                      扫码手机访问
                    </h3>
                    <p className="text-sm text-stone-600 font-sans leading-relaxed">
                      使用手机扫描二维码，即可在移动设备上访问下载页面。
                      iOS 用户将看到"添加到主屏幕"教程，Android 用户可直接下载安装包。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* 底部装饰 */}
        <div className="mt-12 flex justify-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-px bg-stone-200" />
            <div className="w-2 h-2 rounded-full bg-stone-200" />
            <div className="w-8 h-px bg-stone-200" />
          </div>
        </div>
      </div>
    </div>
  );
}
