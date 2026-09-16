'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { LayoutDashboard, Users, BookOpen, MessageSquare, CreditCard, Flag, ScrollText, Settings, ArrowUpRight, Newspaper } from 'lucide-react';
import styles from './admin.module.css';

export const navigation = [
  { id: 'overview', label: '运营总览', icon: LayoutDashboard }, { id: 'users', label: '用户管理', icon: Users },
  { id: 'answers', label: '手记管理', icon: BookOpen }, { id: 'comments', label: '评论管理', icon: MessageSquare },
  { id: 'orders', label: '交易记录', icon: CreditCard }, { id: 'reports', label: '举报处理', icon: Flag },
  { id: 'insights', label: '今日见闻', icon: ScrollText }, { id: 'news', label: '每日新闻', icon: Newspaper },
  { id: 'settings', label: '数据与权限', icon: Settings },
];
function Navigation() {
  const pathname = usePathname();
  const params = useSearchParams();
  const selected = pathname.endsWith('/news') ? 'news' : pathname.endsWith('/community') ? 'reports' : params.get('view') || 'overview';
  return <nav className={styles.navigation} aria-label="后台导航">{navigation.map(({ id, label, icon: Icon }) => <Link
    key={id} href={id === 'news' ? '/admin/news' : `/admin?view=${id}`} aria-current={selected === id ? 'page' : undefined}>
    <Icon size={17} strokeWidth={1.4} /><span>{label}</span>
  </Link>)}</nav>;
}
export default function AdminShell({ children }: { children: React.ReactNode }) {
  return <div className={styles.shell}>
    <aside className={styles.sidebar}>
      <Link href="/admin" className={styles.brand}><svg viewBox="0 0 40 40" aria-hidden="true"><path d="M5 10h30M5 20h12m6 0h12M5 30h30" stroke="currentColor" strokeWidth="3" /></svg><span>二<small>运 营 后 台</small></span></Link>
      <span className={styles.navCaption}>日常运营</span>
      <Suspense><Navigation /></Suspense>
      <div className={styles.sidebarFoot}><span>见天地 · 见众生 · 见自己</span><Link href="/">打开网站 <ArrowUpRight size={14} /></Link></div>
    </aside>
    <div className={styles.workspace}><header className={styles.topbar}><span>二 / 运营工作台</span><div><span className={styles.dot} />管理员专属<Link href="/profile">个人中心</Link></div></header><div className={styles.content}>{children}</div></div>
  </div>;
}
