import type { Metadata } from 'next';
import Link from 'next/link';
import { getConsoleAccess } from '@/lib/admin/access';
import AdminShell from './AdminShell';
import styles from './admin.module.css';

export const metadata: Metadata = { title: '二 · 运营后台', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let access = null;
  let unavailable = false;
  try { access = await getConsoleAccess(); } catch { unavailable = true; }
  if (!access) return <main className={styles.gate}>
    <span className={styles.eyebrow}>二 · 运营后台</span>
    <h1>{unavailable ? '暂时无法验证身份' : '请使用后台账户进入'}</h1>
    <p>{unavailable ? '登录服务暂时不可用，请稍后重新打开后台。' : '后台向网站管理员及已开通的推广大使开放。请使用对应账户登录。'}</p>
    <Link className={styles.primary} href="/login?next=%2Fadmin">登录后台账户</Link>
    <Link href="/">返回网站</Link>
  </main>;
  return <AdminShell access={access}>{children}</AdminShell>;
}
