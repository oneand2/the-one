import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Download } from 'lucide-react';
import { findPrivateDownload, formatSize } from '@/lib/privateDownloads';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '见天地 安卓版 1.0',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: 'no-referrer',
};

export default async function PrivateDownloadPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const item = findPrivateDownload(token);
  if (!item) notFound();

  return (
    <main className="min-h-screen bg-[#FBF9F4] px-4 py-16">
      <div className="mx-auto max-w-xl">
        <header className="mb-10 text-center">
          <p className="mb-3 text-xs tracking-[0.28em] text-stone-500">安卓安装包</p>
          <h1 className="text-3xl font-normal font-serif text-stone-900">{item.title}</h1>
        </header>

        <section className="rounded-2xl border border-stone-200 bg-white p-7 shadow-sm">
          <a
            href={`/d/${token}/${item.fileName}`}
            download={item.fileName}
            rel="nofollow noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-full bg-stone-800 px-6 py-3.5 text-base font-normal text-white transition hover:bg-stone-900"
          >
            <Download className="h-5 w-5" />
            下载安装包
          </a>

          <dl className="mt-7 space-y-3 text-sm font-normal">
            <div className="flex justify-between gap-4">
              <dt className="text-stone-500">大小</dt>
              <dd className="text-stone-800">{formatSize(item.size)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-stone-500">系统要求</dt>
              <dd className="text-stone-800">{item.minAndroid} 及以上</dd>
            </div>
            <div>
              <dt className="text-stone-500">SHA-256</dt>
              <dd className="mt-1 break-all font-mono text-xs leading-5 text-stone-700">{item.sha256}</dd>
            </div>
          </dl>
        </section>

        <section className="mt-6 rounded-2xl border border-stone-200 bg-white/80 p-6 text-sm font-normal leading-7 text-stone-600">
          <h2 className="mb-2 text-sm font-normal text-stone-800">安装说明</h2>
          <p>1. 下载后打开安装包；如提示，请允许浏览器或文件管理器“安装未知应用”。</p>
          <p>2. 华为 / 荣耀（鸿蒙）手机若拦截安装，请在设置中暂时关闭“纯净模式”后再装。</p>
          <p>3. 打开 App，轻点“轻点准备线路”，再轻点连接并允许建立 VPN。</p>
        </section>
      </div>
    </main>
  );
}
