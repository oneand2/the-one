import Link from 'next/link';
import { SITE_INFO } from '@/config/siteInfo';

export function SiteFooter() {
  return (
    <footer className="border-t border-stone-200 bg-[#FBF9F4] px-4 pb-28 pt-8 text-xs text-stone-500 md:pb-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="服务与规则">
          <Link href="/service" className="hover:text-stone-800">服务与计费</Link>
          <Link href="/refund" className="hover:text-stone-800">退款与售后</Link>
          <Link href="/terms" className="hover:text-stone-800">用户协议</Link>
          <Link href="/privacy" className="hover:text-stone-800">隐私政策</Link>
          <Link href="/operator" className="hover:text-stone-800">经营者信息</Link>
        </nav>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <span>客服：{SITE_INFO.customerServiceEmail}</span>
          {SITE_INFO.icpNumber && <span>{SITE_INFO.icpNumber}</span>}
        </div>
      </div>
    </footer>
  );
}
