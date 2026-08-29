'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import styles from '../login.module.css';

const OPENED_KEY = 'the-one-wechat-mp-opened';

type OpenResponse = {
  urlLink?: string;
  error?: string;
};

type StatusResponse = {
  status?: 'pending' | 'done' | 'expired';
  next?: string;
  error?: string;
};

export function WechatBridge() {
  const [message, setMessage] = useState('正在打开小程序「决行藏」');
  const [urlLink, setUrlLink] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const pollTimer = useRef(0);

  useEffect(() => {
    let cancelled = false;

    async function readStatus() {
      const response = await fetch('/api/auth/wechat/miniprogram/status', {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      const data = (await response.json()) as StatusResponse;
      if (cancelled) return 'stop';
      if (data.status === 'done' && data.next) {
        window.sessionStorage.removeItem(OPENED_KEY);
        window.location.replace(data.next);
        return 'stop';
      }
      if (data.status === 'expired') {
        window.sessionStorage.removeItem(OPENED_KEY);
        setFailed(true);
        setMessage(data.error || '登录已失效，请返回重试');
        return 'stop';
      }
      return 'continue';
    }

    function schedulePoll() {
      window.clearTimeout(pollTimer.current);
      pollTimer.current = window.setTimeout(async () => {
        const result = await readStatus();
        if (!cancelled && result === 'continue') schedulePoll();
      }, 1600);
    }

    async function start() {
      const alreadyOpened = window.sessionStorage.getItem(OPENED_KEY) === '1';
      if (alreadyOpened) {
        setMessage('已确认的话，请稍候；尚未打开则点下方按钮');
      }

      const response = await fetch('/api/auth/wechat/miniprogram/open', {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      const data = (await response.json()) as OpenResponse;
      if (cancelled) return;
      if (!response.ok || !data.urlLink) {
        setFailed(true);
        setMessage(data.error || '暂时无法打开小程序');
        return;
      }

      setUrlLink(data.urlLink);
      if (!alreadyOpened) {
        window.sessionStorage.setItem(OPENED_KEY, '1');
        window.location.href = data.urlLink;
      }

      const result = await readStatus();
      if (!cancelled && result === 'continue') schedulePoll();
    }

    function onVisible() {
      if (document.visibilityState === 'visible') {
        readStatus().then((result) => {
          if (!cancelled && result === 'continue') schedulePoll();
        });
      }
    }

    start();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      window.clearTimeout(pollTimer.current);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return (
    <section className={styles.experience}>
      <div className={styles.brand}>
        <div className={styles.emblem} aria-hidden="true">
          <svg viewBox="0 0 100 100" fill="currentColor">
            <rect x="0" y="20" width="100" height="20" />
            <rect x="0" y="60" width="100" height="20" />
          </svg>
        </div>
        <p className={styles.eyebrow}>确 认 身 份</p>
        <h1 className={styles.title}>经由决行藏</h1>
        <p className={styles.subtitle}>在小程序中点一下即可回到这里</p>
      </div>

      <div className={styles.shell}>
        <div className={styles.panel}>
          <div className={styles.form}>
            <p className={failed ? styles.error : styles.choiceIntro}>{message}</p>
            {urlLink && (
              <a href={urlLink} className={styles.primaryButton}>
                <span>打开小程序</span>
              </a>
            )}
            <Link href="/login" className={styles.secondaryAction}>
              返回登录
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
