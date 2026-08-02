import Link from 'next/link';
import { CheckCircle2, MoreVertical, Monitor, Plus, Share, Smartphone } from 'lucide-react';

const Step = ({ number, title, children }: { number: number; title: string; children: React.ReactNode }) => (
  <li className="flex gap-4">
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-800 text-sm text-white">{number}</span>
    <div className="pt-1">
      <h3 className="text-sm font-medium text-stone-800">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-stone-600">{children}</p>
    </div>
  </li>
);

export default function DownloadPage() {
  return (
    <main className="min-h-screen bg-[#FBF9F4] px-4 py-12">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="mb-8 inline-block text-sm text-stone-500 hover:text-stone-800">← 返回首页</Link>

        <header className="mb-10 text-center">
          <p className="mb-3 text-xs tracking-[0.28em] text-stone-500">轻巧地留在桌面</p>
          <h1 className="text-3xl font-serif text-stone-900">将“二”添加到主屏幕</h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-stone-600">
            无需另行下载文件。使用浏览器的“添加到主屏幕”或“安装应用”功能，即可像普通应用一样从桌面打开。
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-2xl border border-stone-200 bg-white p-7 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-stone-100"><Smartphone className="h-5 w-5 text-stone-600" /></span>
              <div>
                <h2 className="text-xl font-serif text-stone-900">iPhone 与 iPad</h2>
                <p className="text-xs text-stone-500">请使用 Safari 浏览器</p>
              </div>
            </div>
            <ol className="space-y-6">
              <Step number={1} title="在 Safari 中打开网站">确认当前页面使用 Safari 浏览器打开。</Step>
              <Step number={2} title="点击分享按钮"><Share className="mr-1 inline h-4 w-4" />点击浏览器工具栏中的分享图标。</Step>
              <Step number={3} title="选择添加到主屏幕"><Plus className="mr-1 inline h-4 w-4" />向下找到“添加到主屏幕”，确认名称后点击“添加”。</Step>
            </ol>
          </section>

          <section className="rounded-2xl border border-stone-200 bg-white p-7 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-stone-100"><Smartphone className="h-5 w-5 text-stone-600" /></span>
              <div>
                <h2 className="text-xl font-serif text-stone-900">Android 手机</h2>
                <p className="text-xs text-stone-500">推荐使用 Chrome 浏览器</p>
              </div>
            </div>
            <ol className="space-y-6">
              <Step number={1} title="在 Chrome 中打开网站">使用 Chrome 访问本站并保持网络连接。</Step>
              <Step number={2} title="打开浏览器菜单"><MoreVertical className="mr-1 inline h-4 w-4" />点击右上角菜单按钮。</Step>
              <Step number={3} title="选择安装或添加">点击“安装应用”或“添加到主屏幕”，再按提示确认。</Step>
            </ol>
          </section>
        </div>

        <section className="mt-6 rounded-2xl border border-stone-200 bg-white/80 p-6">
          <div className="flex items-start gap-3">
            <Monitor className="mt-0.5 h-5 w-5 shrink-0 text-stone-600" />
            <div>
              <h2 className="text-sm font-medium text-stone-800">电脑端无需安装</h2>
              <p className="mt-1 text-sm leading-6 text-stone-600">在 Chrome、Edge 或 Safari 中直接访问本站即可；也可以从浏览器地址栏右侧选择“安装”，创建独立窗口。</p>
            </div>
          </div>
        </section>

        <div className="mt-8 flex items-center justify-center gap-2 text-sm text-stone-500">
          <CheckCircle2 className="h-4 w-4" /> 当前仅提供浏览器主屏幕入口，不提供 APK 文件下载。
        </div>
      </div>
    </main>
  );
}
