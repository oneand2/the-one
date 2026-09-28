'use client';
import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Copy, Download, Plus, RefreshCw } from 'lucide-react';
import { useConsoleAccess } from './AdminShell';
import type { AmbassadorReport } from '@/lib/ambassadors/shared';
import styles from './admin.module.css';

const money = (cents: number) => `¥${(cents / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export default function Ambassadors() {
  const access = useConsoleAccess();
  const params = useSearchParams();
  const router = useRouter();
  const [rows, setRows] = useState<AmbassadorReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [working, setWorking] = useState(false);
  const [creating, setCreating] = useState(params.has('userId'));
  const [siteOrigin, setSiteOrigin] = useState('');
  const query = params.toString();
  useEffect(() => {
    setSiteOrigin(process.env.NEXT_PUBLIC_SITE_URL || window.location.origin);
    const controller = new AbortController();
    fetch(`/api/admin/ambassadors?${query}`, { cache: 'no-store', signal: controller.signal }).then(async response => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setRows(result.rows);
    }).catch(e => { if (e.name !== 'AbortError') setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query, revision]);
  function refresh() { setLoading(true); setError(''); setRevision(n => n + 1); }
  async function save(body: unknown) {
    setWorking(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/admin/ambassadors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setNotice('设置已保存。'); setCreating(false); refresh();
    } catch (e) { setError(e instanceof Error ? e.message : '保存失败'); }
    finally { setWorking(false); }
  }
  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void save({ action: 'create', userId: form.get('userId'), name: form.get('name'), code: form.get('code') });
  }
  function dates(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = new URLSearchParams(params.toString());
    for (const key of ['start', 'end']) {
      if (form.get(key)) next.set(key, String(form.get(key)));
      else next.delete(key);
    }
    router.push(`/admin?${next}`);
  }
  function detail(row: AmbassadorReport, view: string) {
    const next = new URLSearchParams({ view, ambassador: row.id });
    if (view === 'orders') for (const key of ['start', 'end']) if (params.get(key)) next.set(key, params.get(key)!);
    return `/admin?${next}`;
  }
  function exportSummary() {
    const quote = (v: unknown) => `"${String(v).replace(/^[=+@-]/, "'$&").replaceAll('"', '""')}"`;
    const csv = [['大使', '专属代号', '状态', '开始日期', '结束日期', '累计注册', '期间注册', '充值人数（支付宝/微信）', '成功订单', '成功充值金额（元）', '退款订单', '退款金额（元）', 'Apple正式记录'], ...rows.map(r => [r.name, r.code, r.active ? '启用' : '暂停', params.get('start') || '全部', params.get('end') || '全部', r.registered_users, r.new_users, r.paid_users, r.paid_orders, (r.paid_cents / 100).toFixed(2), r.refunded_orders, (r.refunded_cents / 100).toFixed(2), r.apple_orders])].map(r => r.map(quote).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = '推广大使充值核对.csv'; a.click(); URL.revokeObjectURL(url);
  }
  async function copy(row: AmbassadorReport) {
    try { await navigator.clipboard.writeText(`${siteOrigin.replace(/\/$/, '')}/r/${row.code}`); setNotice('推广链接已复制。'); }
    catch { setNotice('未能自动复制，请选中下方链接手动复制。'); }
  }
  const sum = (key: 'registered_users' | 'paid_users' | 'paid_orders' | 'paid_cents') => rows.reduce((n, r) => n + Number(r[key]), 0);
  return <>
    <div className={styles.heading}><div><span className={styles.eyebrow}>相 遇 有 源</span><h1>{access.role === 'owner' ? '推广大使' : '我的推广'}</h1><p>从一次分享，到每一笔真实充值。</p></div><button className={styles.button} disabled={loading} onClick={refresh}><RefreshCw size={14} />刷新数据</button></div>
    <p className={styles.explanation}>{access.role === 'owner' ? '为已注册用户开通推广身份，按专属链接追踪注册与后续充值。' : `${access.name}，这里只显示通过你的专属链接注册的用户及其后续数据。`} 返利在线下核对与结算。</p>
    {error && <p className={styles.error} role="alert">{error}<button onClick={refresh}>重新读取</button></p>}
    {notice && <p className={styles.notice} role="status">{notice}</p>}
    <form className={styles.toolbar} onSubmit={dates}><label className={styles.dateField}>开始日期<input type="date" name="start" defaultValue={params.get('start') || ''} /></label><label className={styles.dateField}>结束日期<input type="date" name="end" defaultValue={params.get('end') || ''} /></label><button className={styles.button}>按日期查看</button><Link className={styles.textButton} href={`/admin?view=ambassadors${params.get('ambassador') ? `&ambassador=${params.get('ambassador')}` : ''}`}>全部时间</Link></form>
    <p className={styles.coverage}>日期含首尾两天，按北京时间的支付时间统计。成功充值仅含支付宝、微信已支付且已入账、当前未标记退款的订单；同一用户跨渠道只计一人。退款按原支付日期归入对应期间。Apple 正式记录单列，不计入充值人数和金额；测试记录不计入。结算前请与支付平台核对尚未同步的退款。</p>
    {loading ? <p className={styles.empty} role="status">正在核对推广记录…</p> : !error && <>
      <section className={styles.metrics} aria-label="推广成果">{[['累计注册', sum('registered_users')], ['充值人数', sum('paid_users')], ['成功订单', sum('paid_orders')], ['成功充值', money(sum('paid_cents'))]].map(([label, value]) => <div className={styles.metric} key={label}><span>{label}</span><strong className={typeof value === 'string' ? styles.money : undefined}>{value}</strong><small>{label === '累计注册' ? '不受日期筛选影响' : '所选期间 · 支付宝与微信'}</small></div>)}</section>
      <div className={styles.toolbar}>{access.role === 'owner' && <button className={styles.primary} onClick={() => setCreating(!creating)}><Plus size={14} />设置推广大使</button>}<button className={styles.button} disabled={!rows.length} onClick={exportSummary}><Download size={14} />导出核对表</button>{params.get('ambassador') && access.role === 'owner' && <Link href="/admin?view=ambassadors">查看全部大使</Link>}</div>
      {creating && access.role === 'owner' && <form onSubmit={create} className={`${styles.panel} ${styles.ambassadorForm}`}><h2>开通推广身份</h2><p className={styles.explanation}>在用户管理中找到她的账户，打开详情即可一键带入用户编号。专属代号创建后固定，避免已分享链接失效。</p><div className={styles.ambassadorFields}><label>用户编号<input required name="userId" defaultValue={params.get('userId') || ''} placeholder="从用户详情复制编号" /></label><label>大使名称<input required name="name" maxLength={50} placeholder="例如：小林" /></label><label>专属代号<input required name="code" minLength={3} maxLength={32} pattern="[a-z0-9][a-z0-9-]{2,31}" placeholder="例如：xiaolin" /></label></div><p className={styles.coverage}>链接格式：{siteOrigin}/r/专属代号。大使使用自己的账户登录 /admin，只能查看名下数据。</p><div className={styles.actions}><button type="button" className={styles.button} disabled={working} onClick={() => setCreating(false)}>取消</button><button className={styles.primary} disabled={working}>{working ? '正在保存…' : '开通并生成链接'}</button></div></form>}
      <div className={styles.tableWrap}><table className={styles.table}><thead><tr>{['推广大使 / 专属链接', '累计 / 期间注册', '充值人数 / 订单', '成功充值', '已退款', 'Apple 正式记录', '查看与设置'].map(h => <th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.id}><td><span className={styles.cellTitle}>{row.name}</span> <span className={styles.badge}>{row.active ? '启用中' : '已暂停'}</span><small className={styles.referralLink}>{siteOrigin.replace(/\/$/, '')}/r/{row.code}</small><button className={styles.textButton} disabled={!row.active} onClick={() => copy(row)}><Copy size={12} />复制链接</button></td><td>{row.registered_users} 人<small>期间新增 {row.new_users} 人</small></td><td>{row.paid_users} 人<small>{row.paid_orders} 笔</small></td><td>{money(row.paid_cents)}</td><td>{money(row.refunded_cents)}<small>{row.refunded_orders} 笔</small></td><td>{row.apple_orders} 笔<small>实付金额未记录</small></td><td><div className={styles.rowActions}><Link href={detail(row, 'users')}>名下用户</Link><Link href={detail(row, 'orders')}>充值明细</Link><Link href={detail(row, 'overview')}>数据总览</Link>{access.role === 'owner' && <button disabled={working} onClick={() => { if (window.confirm(row.active ? `暂停「${row.name}」的推广链接和后台访问？历史归属及数据仍会保留。` : `重新启用「${row.name}」的推广链接和后台？`)) void save({ action: 'status', id: row.id, active: !row.active }); }}>{row.active ? '暂停大使' : '重新启用'}</button>}</div></td></tr>)}{rows.length === 0 && <tr><td colSpan={7}><div className={styles.empty}><h3>还没有推广大使</h3><p>先让她注册账户，再为她开通推广身份。</p></div></td></tr>}</tbody></table></div>
      <p className={styles.footnote}>首次有效推广链接保留 30 天。新账户注册时固定归属；已注册账户不会重新归属。后续充值持续计入原大使，暂停不会改变历史归属。</p>
    </>}
  </>;
}
