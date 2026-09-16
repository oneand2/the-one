'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { SIGNUP_SOURCES, type UserAnalytics as Analytics } from '@/lib/admin/shared';
import styles from './admin.module.css';

const count = (value: number | null) => value === null ? '—' : value.toLocaleString('zh-CN');
export function UserAnalytics({ data, compact = false }: { data: Analytics; compact?: boolean }) {
  const href = (cohort: string) => `/admin?view=users&days=${data.days}&cohort=${cohort}`;
  const cards = [
    { label: '新增用户', value: data.newUsers, hint: '期间注册的账户', cohort: 'new' },
    { label: '活跃用户', value: data.activeUsers, hint: '已采集期间的去重人数', cohort: 'active' },
    { label: '登录用户', value: data.loggedInUsers, hint: '最近登录时间在期间内', cohort: 'login' },
  ];
  const max = Math.max(1, ...data.daily.flatMap(d => [d.newUsers, d.activeUsers || 0]));
  return <section aria-label="新增与活跃用户" className={styles.userAnalytics}>
    <div className={styles.periodCaption}>近 {data.days} 天 · {data.start.replaceAll('-', '/')} — {data.end.replaceAll('-', '/')}<span>含今天 · 北京时间</span></div>
    <div className={`${styles.metrics} ${styles.userMetrics}`}>{cards.map(card => <Link key={card.cohort} href={href(card.cohort)} className={styles.metric}><span>{card.label}<ArrowRight size={14} /></span><strong>{count(card.value)}</strong><small>{card.hint}</small></Link>)}</div>
    <p className={styles.coverage}>{!data.activityAvailable ? '活跃记录读取失败，人数暂不显示。' : data.trackingSince ? `活跃采集始于 ${new Date(data.trackingSince).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}；首日及今天为截至当前的部分数据，之前日期显示“未采集”。` : '活跃采集已接入，正在等待首次登录访问；此前的活跃人数无法还原。'} 活跃按登录后访问网站、打开 App 会话或调用已接入的功能接口统计，同一账户每天只计一人，整个期间再次去重。登录人数来自账户最近登录时间，与活跃人数分开计算。</p>
    {!compact && <div className={styles.overviewGrid}>
      <section className={styles.panel}>
        <div className={styles.panelHeading}><div><span className={styles.eyebrow}>相 遇</span><h2>每日新增与活跃</h2></div></div>
        <div className={styles.legend}><span><i />新增用户</span><span><i />活跃用户</span></div>
        <div className={styles.chartScroll}><div className={`${styles.chart} ${styles.userChart}`} style={{ gridTemplateColumns: `repeat(${data.days}, minmax(34px, 1fr))` }} role="img" aria-label={data.daily.map(d => `${d.date}：新增 ${d.newUsers} 人，活跃${d.activeUsers === null ? '未采集或不可用' : ` ${d.activeUsers} 人`}`).join('；')}>
          {data.daily.map(d => <div className={styles.chartDay} key={d.date}><div className={styles.chartValues}><span>{d.newUsers}</span><span>{count(d.activeUsers)}</span></div><div className={styles.bars}><span style={{ height: `${d.newUsers / max * 100}%` }} /><span style={{ height: `${(d.activeUsers || 0) / max * 100}%` }} /></div><span>{d.date.slice(5).replace('-', '/')}</span></div>)}
        </div></div>
        <p className={styles.footnote}>“—”表示未采集或不可用，零表示已采集且没有记录。期间活跃人数不等于每日人数相加。</p>
        <details className={styles.dailyDetails}><summary>查看每日明细</summary><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th scope="col">日期</th><th scope="col">新增</th><th scope="col">活跃</th></tr></thead><tbody>{data.daily.map(d => <tr key={d.date}><td>{d.date}</td><td>{d.newUsers} 人</td><td>{d.activeUsers === null ? data.activityAvailable ? '未采集' : '不可用' : `${d.activeUsers} 人`}</td></tr>)}</tbody></table></div></details>
      </section>
      <section className={styles.panel}>
        <div className={styles.panelHeading}><div><span className={styles.eyebrow}>来 处</span><h2>新增用户注册方式</h2></div><span className={styles.quiet}>共 {data.newUsers} 人</span></div>
        <div className={styles.sourceList}>{data.signupSources.map(item => <Link key={item.source} href={`${href('new')}&source=${item.source}`}><span>{SIGNUP_SOURCES[item.source]}</span><span>{item.count} 人 <ArrowRight size={12} /></span><i style={{ width: `${data.newUsers ? item.count / data.newUsers * 100 : 0}%` }} /></Link>)}</div>
        <p className={styles.footnote}>来自账户创建时的注册方式；后来绑定的微信或 Apple 不改变原始方式。未记录的来源单独列出。广告、外部链接等推广来源尚未采集。</p>
      </section>
    </div>}
  </section>;
}
