import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { LoginForm } from './LoginForm';
import styles from './login.module.css';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // 如果已登录，重定向到首页
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  const params = await searchParams;
  const next = (params.next as string) || '/';
  const message = params.message as string;
  const wechatEnabled = Boolean(
    process.env.WECHAT_LOGIN_APP_ID?.trim()
    && process.env.WECHAT_LOGIN_APP_SECRET?.trim()
    && process.env.NEXT_PUBLIC_SITE_URL?.trim()
  );
  
  if (user) {
    redirect(next);
  }

  return (
    <main className={styles.page}>
      <Link href="/" className={styles.homeLink} aria-label="返回首页">
        <span className={styles.homeArrow} aria-hidden="true">←</span>
        <span className={styles.homeLinkText}>返回首页</span>
      </Link>
      <LoginForm
        next={next}
        wechatEnabled={wechatEnabled}
        message={message}
      />
    </main>
  );
}
