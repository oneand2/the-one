import { SITE_INFO } from '@/config/siteInfo';
import styles from './SiteRegistration.module.css';

export function SiteRegistration({ inContent = false }: { inContent?: boolean }) {
  return (
    <footer
      aria-label="网站备案信息"
      className={`${styles.footer} ${inContent ? styles.inContent : styles.standalone}`}
    >
      <a
        href="https://beian.miit.gov.cn/"
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${SITE_INFO.icpNumber}，前往工信部备案查询（新窗口）`}
        className={styles.link}
      >
        {SITE_INFO.icpNumber}
      </a>
    </footer>
  );
}
