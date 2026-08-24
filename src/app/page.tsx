'use client';

import React, { Suspense, useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { MobileNav } from '@/components/MobileNav';
import { TabContentErrorBoundary } from '@/components/TabContentErrorBoundary';
import { GuanShiView } from '@/components/GuanShiView';
import { GuanXinView } from '@/components/GuanXinView';
import { JueXingCangView } from '@/components/JueXingCangView';
import { mobileUI } from '@/generated/mobile-ui';
import type { TabType } from '@/types/tabs';

const VALID_TABS: TabType[] = ['guanshi', 'guanxin', 'bazi', 'mbti', 'wendao', 'juexingcang'];
const LEGACY_TAB_ALIASES: Partial<Record<string, TabType>> = { bazi: 'guanxin' };

function tabTitle(tab: TabType): string {
  if (tab === 'guanshi') return '见天地';
  if (tab === 'wendao') return '见众生';
  if (tab === 'guanxin') return '见自己';
  if (tab === 'bazi') return '八字命理';
  if (tab === 'mbti') return '荣格八维';
  return '决行藏';
}

function tabSubtitle(tab: TabType): string {
  if (tab === 'guanshi') return '世间即道场，人生是修行';
  if (tab === 'wendao') return '观点广场，待续';
  if (tab === 'juexingcang') return '用之则行，舍之则藏';
  return '知己即知天，请成为自己的答案';
}

function TabGlyph({ tab }: { tab: TabType }) {
  const common = 'w-8 h-8 mx-auto text-[#2c2c2c] mb-4';
  if (tab === 'guanshi') {
    return (
      <svg viewBox="0 0 100 100" fill="currentColor" className={common}>
        <rect x="0" y="20" width="44" height="20" /><rect x="56" y="20" width="44" height="20" />
        <rect x="0" y="60" width="44" height="20" /><rect x="56" y="60" width="44" height="20" />
      </svg>
    );
  }
  if (tab === 'wendao') {
    return (
      <svg viewBox="0 0 100 100" fill="currentColor" className={common}>
        <rect x="0" y="20" width="44" height="20" /><rect x="56" y="20" width="44" height="20" />
        <rect x="0" y="60" width="100" height="20" />
      </svg>
    );
  }
  if (tab === 'juexingcang') {
    return (
      <svg viewBox="0 0 100 100" fill="currentColor" className={common}>
        <rect x="0" y="20" width="100" height="20" /><rect x="0" y="60" width="100" height="20" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 100 100" fill="currentColor" className={common}>
      <rect x="0" y="20" width="100" height="20" />
      <rect x="0" y="60" width="44" height="20" /><rect x="56" y="60" width="44" height="20" />
    </svg>
  );
}

function TabHeaderContent({ tab }: { tab: TabType }) {
  return (
    <>
      <div><TabGlyph tab={tab} /></div>
      <h1 className="text-3xl font-serif text-[#333333] leading-tight">{tabTitle(tab)}</h1>
      <p className="text-sm text-stone-600 font-sans text-center">{tabSubtitle(tab)}</p>
    </>
  );
}

function resolveTab(raw?: string | null): TabType {
  const aliased = raw ? LEGACY_TAB_ALIASES[raw] : undefined;
  if (aliased) return aliased;
  return raw && VALID_TABS.includes(raw as TabType) ? (raw as TabType) : 'guanshi';
}

function getTabFromUrl(): TabType {
  if (typeof window === 'undefined') return 'guanshi';
  return resolveTab(new URLSearchParams(window.location.search).get('tab'));
}

const Sidebar = dynamic(
  () => import('@/components/Sidebar').then((mod) => mod.Sidebar),
  { ssr: false }
);

// 见天地 / 见自己是主 tab，同步导入避免 iOS WebView 里动态分包一直停在「加载中」。
const BaZiView = dynamic(
  () => import('@/components/BaZiView').then((mod) => mod.BaZiView),
  { ssr: false, loading: () => <TabLoading /> }
);
const MbtiTestView = dynamic(
  () => import('@/components/MbtiTestView').then((mod) => mod.MbtiTestView),
  { ssr: false, loading: () => <TabLoading /> }
);
function TabLoading() {
  return (
    <div className="min-h-[280px] flex items-center justify-center text-stone-400 text-sm font-sans">
      加载中…
    </div>
  );
}

const HomeContent: React.FC = () => {
  const searchParams = useSearchParams();
  const [embedFromNative, setEmbedFromNative] = useState(false);
  const isIOSEmbed = searchParams.get('embed') === 'ios' || embedFromNative;
  const urlTab = resolveTab(searchParams.get('tab'));
  const [activeTab, setActiveTab] = useState<TabType>(urlTab);
  const [isCollapsed, setIsCollapsed] = useState(true);
  // 已访问过的 tab 保持挂载，切换回来时不再重新加载、不卡顿
  const [visitedTabs, setVisitedTabs] = useState<Set<TabType>>(() => new Set([urlTab]));

  useEffect(() => {
    if (window.__THEONE_IOS_EMBED__) setEmbedFromNative(true);
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-active-tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    const tab = resolveTab(window.__THEONE_TAB__ || getTabFromUrl());
    setActiveTab(tab);
    setVisitedTabs((prev) => new Set([...prev, tab]));
    const onPopState = () => {
      const t = resolveTab(window.__THEONE_TAB__ || getTabFromUrl());
      setActiveTab(t);
      setVisitedTabs((prev) => new Set([...prev, t]));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // 顶部渗墨只在内容开始上滑后出现，静止时 logo 保持清晰。
  useEffect(() => {
    if (!isIOSEmbed) return;
    const root = document.querySelector<HTMLElement>('[data-ios-embed="true"]');
    if (!root) return;
    const syncInkFade = () => {
      const y = window.scrollY || document.documentElement.scrollTop || 0;
      root.style.setProperty('--ios-ink-top', String(Math.min(1, y / 48)));
    };
    syncInkFade();
    window.addEventListener('scroll', syncInkFade, { passive: true });
    return () => window.removeEventListener('scroll', syncInkFade);
  }, [isIOSEmbed]);

  // 当 URL 被 router.push 更新时（如见天地「占问今日休咎」跳转决行藏），立即同步 tab。
  // 原生底栏写入的 __THEONE_TAB__ 优先，避免 Next 水合把 tab 打回见天地。
  useEffect(() => {
    const native = window.__THEONE_TAB__;
    if (native && VALID_TABS.includes(native as TabType)) {
      setActiveTab(native as TabType);
      setVisitedTabs((prev) => new Set([...prev, native as TabType]));
      document.documentElement.setAttribute('data-active-tab', native);
      return;
    }
    const tab = resolveTab(searchParams.get('tab'));
    setActiveTab(tab);
    setVisitedTabs((prev) => new Set([...prev, tab]));
    document.documentElement.setAttribute('data-active-tab', tab);
    const rawTab = searchParams.get('tab');
    if (rawTab && LEGACY_TAB_ALIASES[rawTab] && rawTab !== tab) {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.replaceState(null, '', url.toString());
    }
  }, [searchParams]);

  const handleTabChange = useCallback(
    (tabOrUpdater: TabType | React.SetStateAction<TabType>) => {
      const tab = typeof tabOrUpdater === 'function' ? tabOrUpdater(activeTab) : tabOrUpdater;
      setActiveTab(tab);
      setVisitedTabs((prev) => new Set([...prev, tab]));
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.replaceState(null, '', url.toString());
      if (isIOSEmbed) {
        window.webkit?.messageHandlers?.theone?.postMessage({ type: 'tabChanged', tab });
      }
    },
    [activeTab, isIOSEmbed]
  );

  // 原生底栏直接调用闭包，比向 WKWebView 注入合成点击/事件更可靠。
  // 首次进入时才挂载目标页，之后保留实例，因此不会冻结隐藏页的初始化任务。
  useEffect(() => {
    if (!isIOSEmbed) return;
    const navigate = (rawTab: string) => {
      const tab = resolveTab(rawTab);
      window.__THEONE_TAB__ = tab;
      setActiveTab(tab);
      setVisitedTabs((prev) => new Set([...prev, tab]));
      document.documentElement.setAttribute('data-active-tab', tab);
      const root = document.querySelector<HTMLElement>('[data-ios-embed="true"]');
      root?.setAttribute('data-active-tab', tab);
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.replaceState(null, '', url.toString());
      window.scrollTo(0, 0);
    };
    window.__THEONE_NAVIGATE__ = navigate;
    return () => {
      if (window.__THEONE_NAVIGATE__ === navigate) delete window.__THEONE_NAVIGATE__;
    };
  }, [isIOSEmbed]);

  return (
    <div
      className="min-h-screen relative"
      data-ios-embed={isIOSEmbed ? 'true' : undefined}
      data-active-tab={activeTab}
      style={{ background: mobileUI.colors.background }}
    >
      {/* 左侧侧边栏 */}
      {!isIOSEmbed && <div className="hidden md:block">
        <Sidebar 
          activeTab={activeTab} 
          onTabChange={handleTabChange}
          isJuexingcangActive={activeTab === 'juexingcang'}
          isCollapsed={isCollapsed}
          onMouseEnter={() => setIsCollapsed(false)}
          onMouseLeave={() => setIsCollapsed(true)}
        />
      </div>}

      {/* 主内容区 - 占据全屏，内容居中 */}
      <main className="min-h-screen flex items-start justify-center">
        <div className="w-full max-w-4xl">
          {/* Header - 所有 tab 共用，logo 标题瞬间切换，与其它 tab 一致 */}
          <motion.header
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="px-6"
            style={{
              paddingTop: isIOSEmbed ? 16 : mobileUI.header.webTop,
              paddingBottom: isIOSEmbed ? mobileUI.header.bottom : mobileUI.header.webBottom,
            }}
          >
            {isIOSEmbed ? (
              <div className="max-w-md mx-auto text-center">
                {VALID_TABS.map((tab) => (
                  <div key={tab} data-ios-tab-header={tab} className="space-y-4">
                    <TabHeaderContent tab={tab} />
                  </div>
                ))}
              </div>
            ) : (
              <motion.div
                initial={{ scale: 0.98 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.2 }}
                className="max-w-md mx-auto text-center space-y-4"
              >
                <TabHeaderContent tab={activeTab} />
              </motion.div>
            )}
          </motion.header>

          {/* 内容区域：已访问的 tab 保持挂载仅隐藏，切换回来秒开不卡顿 */}
          <div className={isIOSEmbed ? 'px-6 pb-8' : 'px-6 mobile-content-bottom'}>
            <TabContentErrorBoundary>
              <div className="max-w-md mx-auto relative">
                {visitedTabs.has('guanshi') && (
                <div data-ios-tab-pane="guanshi" className={activeTab === 'guanshi' ? 'block' : 'hidden'} aria-hidden={activeTab !== 'guanshi'}>
                  <GuanShiView />
                </div>
              )}
              {visitedTabs.has('wendao') && (
                <div
                  data-ios-tab-pane="wendao"
                  className={
                    activeTab === 'wendao'
                      ? 'min-h-[320px] flex flex-col items-center justify-center py-16'
                      : 'hidden'
                  }
                  aria-hidden={activeTab !== 'wendao'}
                >
                  <div className="w-12 h-px bg-stone-200/80 mb-6" />
                  <p
                    className="text-stone-500 text-sm font-serif tracking-wide text-center"
                    style={{ fontFamily: '"Kaiti SC", KaiTi, STKaiti, "华文楷体", "楷体", Georgia, serif' }}
                  >
                    感谢您的支持<br />见众生功能正在开发中
                  </p>
                  <div className="w-8 h-px bg-stone-200/60 mt-6" />
                </div>
              )}
              {visitedTabs.has('guanxin') && (
                <div data-ios-tab-pane="guanxin" className={activeTab === 'guanxin' ? 'block' : 'hidden'} aria-hidden={activeTab !== 'guanxin'}>
                  <GuanXinView onNavigate={handleTabChange} />
                </div>
              )}
              {visitedTabs.has('bazi') && (
                <div data-ios-tab-pane="bazi" className={activeTab === 'bazi' ? 'block' : 'hidden'} aria-hidden={activeTab !== 'bazi'}>
                  <BaZiView />
                </div>
              )}
              {visitedTabs.has('mbti') && (
                <div data-ios-tab-pane="mbti" className={activeTab === 'mbti' ? 'block' : 'hidden'} aria-hidden={activeTab !== 'mbti'}>
                  <MbtiTestView autoStart />
                </div>
              )}
              {visitedTabs.has('juexingcang') && (
                <div data-ios-tab-pane="juexingcang" className={activeTab === 'juexingcang' ? 'block' : 'hidden'} aria-hidden={activeTab !== 'juexingcang'}>
                  <JueXingCangView hideHeader isActive={activeTab === 'juexingcang'} />
                </div>
              )}
              </div>
            </TabContentErrorBoundary>
          </div>
        </div>
      </main>

      {!isIOSEmbed && <MobileNav activeTab={activeTab} onTabChange={handleTabChange} />}
    </div>
  );
};

function PageFallback() {
  return (
    <div className="min-h-screen bg-[#fbf9f4] flex items-center justify-center">
      <div className="text-stone-400 text-sm font-sans">加载中…</div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageFallback />}>
      <HomeContent />
    </Suspense>
  );
}
