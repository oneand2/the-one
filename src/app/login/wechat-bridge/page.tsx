import Link from 'next/link';
import { WechatBridge } from './WechatBridge';
import styles from '../login.module.css';

export const dynamic = 'force-dynamic';

export default function WechatBridgePage() {
  return (
    <main className={styles.page}>
      <Link href="/login" className={styles.homeLink} aria-label="返回登录">
        <span className={styles.homeArrow} aria-hidden="true">←</span>
        <span className={styles.homeLinkText}>返回登录</span>
      </Link>
      <WechatBridge />
    </main>
  );
}
