import type { Metadata } from 'next';
import Link from 'next/link';
import { getAdminUser } from '@/lib/admin/access';
import AdminShell from './AdminShell';
import styles from './admin.module.css';

export const metadata: Metadata = { title: '二 · 运营后台', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let authorized = false;
  let unavailable = false;
  try { authorized = Boolean(await getAdminUser()); } catch { unavailable = true; }
  if (!authorized) return <main className={styles.gate}>
    <span className={styles.eyebrow}>二 · 运营后台</span>
    <h1>{unavailable ? '暂时无法验证身份' : '请使用管理员账户进入'}</h1>
    <p>{unavailable ? '登录服务暂时不可用，请稍后重新打开后台。' : '后台仅向网站管理员开放。登录后可查看数据与处理运营事务。'}</p>
    <Link className={styles.primary} href="/login?next=%2Fadmin">登录管理员账户</Link>
    <Link href="/">返回网站</Link>
  </main>;
  return <AdminShell>{children}</AdminShell>;
}
