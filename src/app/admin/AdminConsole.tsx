'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, RefreshCw, Search, X, AlertCircle } from 'lucide-react';
import { SIGNUP_SOURCES, MODULES, PAGE_SIZE, type AdminData, type AdminModule, type AdminRow } from '@/lib/admin/shared';
import { isVip, isLifetimeVip } from '@/utils/vip';
import { UserAnalytics } from './UserAnalytics';
import { navigation } from './AdminShell';
import styles from './admin.module.css';

const LABELS: Record<string, string> = { visible: '公开', hidden: '已隐藏', removed: '已移除', open: '待处理', resolved: '已处理', dismissed: '已保留', paid: '已支付', pending: '待支付', closed: '已关闭', refunded: '已退款', Production: '正式交易', Sandbox: '沙盒测试', Xcode: '本地测试', sexual: '色情低俗', hate: '仇恨攻击', harassment: '骚扰威胁', dangerous: '违法危险', spam: '垃圾广告', other: '其他问题' };
const DESCRIPTIONS: Record<AdminModule, string> = {
  overview: '看见网站的日常，照料每一次相遇。', users: '查看注册账户、会员权益与社区发言权限。',
  answers: '管理用户发布的手记，隐藏的内容将不再公开显示。', comments: '查看真实用户评论，处理不适合公开的回应。',
  orders: '按支付渠道查询订单与入账记录。', reports: '核实举报内容，留下清楚的处理结果。',
  insights: '查看与编辑已经存入网站的每日见闻。', settings: '核对数据来源、统计口径与后台权限。',
};
const str = (value: unknown) => value === null || value === undefined || value === '' ? '—' : String(value);
const dateTime = (value: unknown) => value && !Number.isNaN(Date.parse(String(value))) ? new Date(String(value)).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) : '—';
const num = (value: number | null | undefined) => value == null ? '—' : value.toLocaleString('zh-CN');
const vipLabel = (value: unknown) => isLifetimeVip(value as string) ? '终身会员' : isVip(value as string) ? '有效会员' : '普通用户';
const suspended = (row: AdminRow) => new Date(String(row.community_suspended_until)).getTime() > Date.now();

function Badge({ value }: { value: unknown }) {
  const text = String(value || '');
  return <span className={styles.badge} data-tone={['open', 'hidden', 'pending', 'Sandbox', 'Xcode'].includes(text) ? 'attention' : ['visible', 'paid', 'Production'].includes(text) ? 'good' : 'neutral'}>{LABELS[text] || str(value)}</span>;
}

export default function AdminConsole() {
  const params = useSearchParams();
  return <Console key={params.toString()} />;
}

function Console() {
  const params = useSearchParams();
  const router = useRouter();
  const requestedView = params.get('view') || 'overview';
  const view = MODULES.includes(requestedView as AdminModule) ? requestedView as AdminModule : 'overview';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const q = params.get('q') || '';
  const status = params.get('status') || 'all';
  const channel = params.get('channel') || 'alipay';
  const days = params.get('days') || '7';
  const cohort = params.get('cohort') || 'all';
  const source = params.get('source') || 'all';
  const [search, setSearch] = useState(q);
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<AdminRow | null>(null);
  const [notice, setNotice] = useState('');
  const currentRequest = useRef(0);
  const update = useCallback((changes: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    Object.entries(changes).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
    router.push(`/admin?${next.toString()}`, { scroll: false });
  }, [params, router]);
  useEffect(() => {
    const controller = new AbortController();
    const request = ++currentRequest.current;
    const query = new URLSearchParams({ view, page: String(page), q, status, channel, days, cohort, source });
    fetch(`/api/admin/console?${query}`, { cache: 'no-store', signal: controller.signal }).then(async res => {
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || '数据读取失败');
      if (request === currentRequest.current) setData(body);
    }).catch(err => { if (err.name !== 'AbortError' && request === currentRequest.current) setError(err.message); })
      .finally(() => { if (request === currentRequest.current) setLoading(false); });
    return () => controller.abort();
  }, [view, page, q, status, channel, days, cohort, source, revision]);
  const refresh = () => { setLoading(true); setError(''); setData(null); setRevision(v => v + 1); };
  const title = navigation.find(item => item.id === view)?.label;
  const options = view === 'users' ? [['all', '全部用户'], ['vip', '有效会员'], ['suspended', '暂停发言']]
    : view === 'answers' || view === 'comments' ? [['all', '全部状态'], ['visible', '公开'], ['hidden', '已隐藏'], ['removed', '已移除']]
    : view === 'reports' ? [['all', '全部举报'], ['open', '待处理'], ['resolved', '已处理'], ['dismissed', '已保留']]
    : view === 'orders' ? channel === 'apple' ? [['all', '全部环境'], ['Production', '正式交易'], ['Sandbox', '沙盒测试'], ['Xcode', '本地测试']] : [['all', '全部状态'], ['paid', '已支付'], ['pending', '待支付'], ['closed', '已关闭'], ['refunded', '已退款']] : [];
  const listView = !['overview', 'settings'].includes(view);

  return <>
    <div className={styles.heading}><div><span className={styles.eyebrow}>日 常 有 序</span><h1>{title}</h1><p>{DESCRIPTIONS[view]}</p></div><button className={styles.button} disabled={loading} onClick={refresh}><RefreshCw size={14} className={loading ? styles.spinning : ''} />{loading ? '读取中' : '刷新数据'}</button></div>
    <div className={styles.sync}><span className={styles.dot} data-error={Boolean(error || data?.warnings?.length)} />{loading ? '正在读取网站数据…' : error ? '读取未完成' : `读取于 ${dateTime(data?.updatedAt)} · 北京时间`}</div>
    {notice && <p className={styles.notice} role="status">{notice}</p>}
    {error && <div className={styles.error} role="alert"><AlertCircle size={18} /><span>{error}</span><button onClick={refresh}>重新读取</button><Link href="/login?next=%2Fadmin">重新登录</Link></div>}
    {data?.warnings?.map(w => <p key={w} className={styles.error} role="alert">{w}</p>)}
    {(view === 'overview' || view === 'users') && <div className={styles.periodControl}><span>用户统计范围</span><div role="group" aria-label="统计天数">{['7', '30'].map(value => <button key={value} aria-pressed={days === value} onClick={() => update({ days: value, page: '1' })}>近 {value} 天</button>)}</div></div>}
    {listView && <div className={styles.toolbar}>
      <form onSubmit={(event: FormEvent) => { event.preventDefault(); update({ q: search.trim(), page: '1' }); }} className={styles.search}><Search size={16} /><input aria-label="搜索记录" maxLength={100} placeholder={view === 'users' ? '搜索邮箱、昵称或用户编号' : view === 'orders' ? '搜索订单号 / 交易号' : view === 'insights' ? '搜索见闻标题' : '搜索内容关键词'} value={search} onChange={e => setSearch(e.target.value)} /><button type="submit">搜索</button></form>
      {view === 'users' && <><select aria-label="用户范围" value={cohort} onChange={e => update({ cohort: e.target.value, page: '1' })}><option value="all">全部注册用户</option><option value="new">近 {days} 天新增</option><option value="active">近 {days} 天活跃</option><option value="login">近 {days} 天登录</option></select><select aria-label="注册方式" value={source} onChange={e => update({ source: e.target.value, page: '1' })}><option value="all">全部注册方式</option>{Object.entries(SIGNUP_SOURCES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></>}
      {view === 'orders' && <select aria-label="支付渠道" value={channel} onChange={e => update({ channel: e.target.value, status: 'all', page: '1' })}><option value="alipay">支付宝</option><option value="wechat">微信支付</option><option value="apple">Apple 内购</option></select>}
      {options.length > 0 && <select aria-label="筛选状态" value={status} onChange={e => update({ status: e.target.value, page: '1' })}>{options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>}
      {(q || status !== 'all' || cohort !== 'all' || source !== 'all') && <button className={styles.textButton} onClick={() => update({ q: '', status: 'all', cohort: 'all', source: 'all', page: '1' })}>清除筛选</button>}
    </div>}
    {loading ? <div className={styles.loading} role="status"><div /><div /><div /><span>正在核对真实记录…</span></div> : data && <>
      {view === 'users' && data.usersAnalytics && <><UserAnalytics data={data.usersAnalytics} compact /><p className={styles.explanation}>上方人数为所选期间的全站统计。下方名单按搜索、注册方式和状态进一步筛选，按注册时间或对应的最近活动时间排序。最近活跃仅展示所选期间已采集的记录。</p></>}
      {view === 'overview' && <Overview data={data} />}
      {view === 'settings' && <Settings data={data} />}
      {listView && <>
        {view === 'orders' && <p className={styles.explanation}>{channel === 'apple' ? 'Apple 记录区分正式与测试环境；数据库未保存实付金额，因此不估算收入。记录入账不代表后续未发生退款。' : '支付与入账状态来自网站订单记录。待支付不等于未到账，请结合支付平台核对。此处不执行扣款或退款。'}</p>}
        {(view === 'answers' || view === 'comments') && <p className={styles.explanation}>此处只统计用户提交的内容；随网站发布的示例手记与示例回应不计入用户数据。</p>}
        {view === 'insights' && <p className={styles.explanation}>日期决定见闻所属的日历页。保存会直接更新该日期的线上内容，请核对原文与出处。</p>}
        <RecordTable view={view} rows={data.rows || []} channel={channel} onSelect={setSelected} />
        <div className={styles.pagination}><span>共 {num(data.total)} 条 · 每页 {PAGE_SIZE} 条</span><div><button className={styles.button} aria-label="上一页" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })}><ChevronLeft size={15} /></button><span>{page} / {Math.max(1, Math.ceil((data.total || 0) / PAGE_SIZE))}</span><button className={styles.button} aria-label="下一页" disabled={page * PAGE_SIZE >= (data.total || 0)} onClick={() => update({ page: String(page + 1) })}><ChevronRight size={15} /></button></div></div>
      </>}
    </>}
    {selected && <RecordDialog key={String(selected.id)} row={selected} view={view} channel={channel} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); setNotice('已保存，正在重新读取最新数据。'); refresh(); }} />}
  </>;
}

export function Overview({ data }: { data: AdminData }) {
  const stats = data.stats || {};
  const cards = [['注册账户', stats.users, '含尚未创建档案的账户', 'users'], ['有效会员', stats.vip, '当前未到期，包含终身会员', 'users&status=vip'], ['用户手记', stats.answers, '所有状态的用户提交', 'answers'], ['待处理举报', stats.openReports, '需要管理员核实的记录', 'reports&status=open']] as const;
  const trend = data.trend || [];
  const max = Math.max(1, ...trend.flatMap(t => [t.answers || 0, t.comments || 0]));
  const complete = trend.every(d => d.answers !== null && d.comments !== null);
  const total = complete ? trend.reduce((sum, d) => sum + (d.answers || 0) + (d.comments || 0), 0) : null;
  return <>
    {data.usersAnalytics && <UserAnalytics data={data.usersAnalytics} />}
    <section className={styles.metrics} aria-label="运营指标">{cards.map(([label, value, hint, destination]) => <Link href={`/admin?view=${destination}`} className={styles.metric} key={label}><span>{label}<ArrowRight size={14} /></span><strong>{num(value)}</strong><small>{hint}</small></Link>)}</section>
    <div className={styles.overviewGrid}>
      <section className={styles.panel}><div className={styles.panelHeading}><div><span className={styles.eyebrow}>众 声</span><h2>近七日内容</h2></div><span className={styles.quiet}>新增 {num(total)} 条</span></div><p className={styles.explanation}>按北京时间统计用户提交，包含之后隐藏或移除的内容。</p>
        <div className={styles.legend}><span><i />手记</span><span><i />评论</span></div>
        <div className={styles.chart} role="img" aria-label={trend.map(d => `${d.date}：手记 ${num(d.answers)}，评论 ${num(d.comments)}`).join('；')}>{trend.map(d => <div className={styles.chartDay} key={d.date}><div className={styles.chartValues}><span>{num(d.answers)}</span><span>{num(d.comments)}</span></div><div className={styles.bars}><span style={{ height: `${d.answers === null ? 0 : d.answers / max * 100}%` }} /><span style={{ height: `${d.comments === null ? 0 : d.comments / max * 100}%` }} /></div><span>{d.date.slice(5).replace('-', '/')}</span></div>)}</div>
        <p className={styles.footnote}>{total === 0 ? '这七天暂无用户新增内容。' : '数据从数据库实时读取，刷新后更新。'}</p>
      </section>
      <section className={styles.panel}><div className={styles.panelHeading}><div><span className={styles.eyebrow}>待 办</span><h2>今日照料</h2></div></div><Link className={styles.queue} href="/admin?view=reports&status=open"><span><b>查看待处理举报</b><small>核实内容与用户反馈</small></span><strong>{num(stats.openReports)}</strong><ArrowRight size={16} /></Link><Link className={styles.queue} href="/admin?view=insights"><span><b>整理今日见闻</b><small>校对故事、原文和出处</small></span><ArrowRight size={16} /></Link><Link className={styles.queue} href="/admin/news"><span><b>管理每日新闻</b><small>发布与修订见天地内容</small></span><ArrowRight size={16} /></Link><div className={styles.sideNote}>每一次操作，都对应网站里的真实内容。<br />愿众声有所安放。</div></section>
      <section className={styles.panel}><div className={styles.panelHeading}><h2>交易档案</h2><Link href="/admin?view=orders">查看记录 <ArrowRight size={14} /></Link></div><div className={styles.channelCounts}>{[['支付宝', stats.alipay], ['微信支付', stats.wechat], ['Apple 内购', stats.apple]].map(([label, value]) => <div key={String(label)}><span>{label}</span><strong>{num(value as number | null)}</strong><small>条记录</small></div>)}</div><p className={styles.footnote}>支付宝与微信含全部订单状态；Apple 含测试记录。记录数量不等于成交数量。</p></section>
      <section className={styles.panel}><div className={styles.panelHeading}><h2>内容档案</h2><Link href="/admin?view=settings">数据口径 <ArrowRight size={14} /></Link></div><dl className={styles.inventory}><div><dt>今日见闻</dt><dd>{num(stats.insights)} 则</dd></div><div><dt>每日新闻</dt><dd>{num(stats.news)} 期</dd></div><div><dt>用户评论</dt><dd>{num(stats.comments)} 条</dd></div><div><dt>已建立用户档案</dt><dd>{num(stats.profiles)} 份</dd></div></dl></section>
    </div>
  </>;
}

function Settings({ data }: { data: AdminData }) {
  return <div className={styles.overviewGrid}><section className={styles.panel}><h2>数据连接</h2><p className={styles.explanation}>每次打开或刷新时检查可读性。读取失败显示“不可用”，不替换成零。</p><dl className={styles.inventory}>{data.sources?.map(source => <div key={source.name}><dt>{source.name}</dt><dd>{source.ok ? `${num(source.count)} 条 · 已连接` : '不可用'}</dd></div>)}</dl></section><section className={styles.panel}><h2>权限与统计说明</h2><div className={styles.prose}><p>使用现有网站管理员账户登录。每个数据接口独立验证管理员身份，普通用户不能读取后台数据。</p><p>注册账户来自登录系统，用户档案仅包含已建立资料的账户。有效会员按当前到期时间统计。</p><p>后台列表提供搜索、筛选与分页；手记和评论仅包含用户提交的记录。示例内容由项目内容文件维护。</p><p>隐藏与恢复会同步影响公开页面，处理原因、时间和管理员编号保存在内容记录中。</p><p>新增用户以账户创建时间为准；注册方式来自服务端账户记录。活跃用户按已登录访问与已接入的功能请求采集，按北京时间每日去重；历史未采集日期不补零。登录用户按最近登录时间统计，不代表完整的每日登录历史。广告等推广来源、匿名访客及城市尚未采集。</p><p>支付金额以订单保存的人民币分为准。Apple 记录未保存实付金额，不能用于计算收入。</p></div></section></div>;
}

function RecordTable({ view, rows, channel, onSelect }: { view: AdminModule; rows: AdminRow[]; channel: string; onSelect: (row: AdminRow) => void }) {
  const headers = view === 'users' ? ['用户', '注册方式', '会员 / 权限', '铜币余额', '注册时间', '最近活跃 / 登录'] : view === 'orders' ? ['订单 / 交易编号', '商品', channel === 'apple' ? '铜币' : '金额', '状态', '创建时间'] : view === 'insights' ? ['见闻', '出处', '原文语种', '所属日期'] : view === 'reports' ? ['被举报内容', '举报原因', '处理状态', '举报时间'] : ['内容', '作者', '状态', '发布时间'];
  return <div className={styles.tableWrap}><table className={styles.table}><thead><tr>{headers.map(h => <th scope="col" key={h}>{h}</th>)}<th scope="col">操作</th></tr></thead><tbody>{rows.map(row => <tr key={String(row.id)}>
    {view === 'users' ? <><td><span className={styles.cellTitle}>{str(row.nickname || row.email || '未命名用户')}</span><small>{str(row.email)}</small></td><td>{SIGNUP_SOURCES[row.signup_source as keyof typeof SIGNUP_SOURCES] || '未记录'}</td><td><Badge value={vipLabel(row.vip_expires_at)} /><small>{suspended(row) ? '暂停发言' : '正常发言'}</small></td><td>{str(row.coins_balance)}</td><td>{dateTime(row.created_at)}</td><td>{row.last_activity_at ? dateTime(row.last_activity_at) : '期间无活跃记录'}<small>登录：{dateTime(row.last_sign_in_at)}</small></td></>
      : view === 'orders' ? <><td className={styles.mono}>{str(row.out_trade_no || row.transaction_id)}</td><td>{str(row.subject || row.product_id)}</td><td>{channel === 'apple' ? str(row.coins) : `¥${(Number(row.amount_cents) / 100).toFixed(2)}`}</td><td><Badge value={row.status || row.environment} /></td><td>{dateTime(row.created_at)}</td></>
      : view === 'insights' ? <><td className={styles.cellTitle}>{str(row.title)}</td><td>{str(row.source_label)}</td><td>{str(row.original_language)}</td><td>{str(row.insight_date)}</td></>
      : view === 'reports' ? <><td><span className={styles.excerpt}>{str(row.snapshot_body)}</span><small>{str(row.snapshot_display_id)} · {row.content_type === 'answer' ? '手记' : '评论'}</small></td><td>{LABELS[String(row.reason)] || str(row.reason)}</td><td><Badge value={row.status} /></td><td>{dateTime(row.created_at)}</td></>
      : <><td><span className={styles.excerpt}>{str(row.body)}</span></td><td>{str(row.display_id)}</td><td><Badge value={row.moderation_status} /></td><td>{dateTime(row.created_at)}</td></>}
    <td><button className={styles.textButton} onClick={() => onSelect(row)}>{view === 'insights' ? '查看 / 编辑' : '查看详情'} <ArrowRight size={13} /></button></td>
  </tr>)}{rows.length === 0 && <tr><td colSpan={headers.length + 1}><div className={styles.empty}><BookMark /><h3>暂无符合条件的记录</h3><p>可以调整搜索或筛选条件；新记录产生后会显示在这里。</p></div></td></tr>}</tbody></table></div>;
}
function BookMark() { return <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true"><path d="M5 9h26M5 18h10m6 0h10M5 27h26" stroke="currentColor" strokeWidth="1.5" /></svg>; }

function RecordDialog({ row, view, channel, onClose, onSaved }: { row: AdminRow; view: AdminModule; channel: string; onClose: () => void; onSaved: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [action, setAction] = useState('');
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState('1m');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState(row);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const names: Record<string, string> = { hide: '隐藏内容', restore: '恢复公开', dismiss: '保留内容并驳回举报', suspend7d: '暂停发言 7 天', resume: '恢复发言', vip: '设置会员', save: '保存见闻' };
  async function save(event: FormEvent) {
    event.preventDefault(); setWorking(true); setError('');
    try {
      const report = view === 'reports';
      const response = await fetch(report ? '/api/admin/community' : '/api/admin/console', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(report ? { reportId: row.id, action } : { ...draft, entity: view, id: row.id, action, reason, duration }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '保存失败');
      onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : '保存失败'); }
    finally { setWorking(false); }
  }
  const title = view === 'users' ? str(row.nickname || row.email || '用户详情') : view === 'orders' ? '交易详情' : view === 'insights' ? str(row.title) : view === 'reports' ? '举报详情' : '内容详情';
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="record-title" onCancel={e => { e.preventDefault(); if (!working) onClose(); }}><form onSubmit={save}>
    <div className={styles.dialogHead}><div><span className={styles.eyebrow}>记录详情</span><h2 id="record-title">{title}</h2></div><button type="button" className={styles.button} aria-label="关闭详情" disabled={working} onClick={onClose}><X size={18} /></button></div>
    <div className={styles.dialogBody}>
      <p className={styles.recordId}>编号 {str(row.id)}</p>
      {view === 'users' ? <dl className={styles.inventory}><div><dt>邮箱</dt><dd>{str(row.email)}</dd></div><div><dt>铜币余额</dt><dd>{str(row.coins_balance)}</dd></div><div><dt>会员状态</dt><dd>{vipLabel(row.vip_expires_at)}</dd></div><div><dt>会员到期</dt><dd>{isLifetimeVip(row.vip_expires_at as string) ? '终身' : dateTime(row.vip_expires_at)}</dd></div><div><dt>暂停发言至</dt><dd>{dateTime(row.community_suspended_until)}</dd></div><div><dt>注册方式</dt><dd>{SIGNUP_SOURCES[row.signup_source as keyof typeof SIGNUP_SOURCES] || '未记录'}</dd></div><div><dt>注册时间</dt><dd>{dateTime(row.created_at)}</dd></div><div><dt>期间最近活跃</dt><dd>{row.last_activity_at ? dateTime(row.last_activity_at) : '无已采集记录'}</dd></div><div><dt>最近登录</dt><dd>{dateTime(row.last_sign_in_at)}</dd></div></dl>
      : view === 'orders' ? <dl className={styles.inventory}>{(channel === 'apple' ? [['交易编号', row.transaction_id], ['商品', row.product_id], ['交易环境', LABELS[String(row.environment)] || row.environment], ['铜币', row.coins], ['用户编号', row.user_id], ['创建时间', dateTime(row.created_at)]] : [['订单编号', row.out_trade_no], ['商品', row.subject], ['用户编号', row.user_id], ['金额', `¥${(Number(row.amount_cents) / 100).toFixed(2)}`], ['状态', LABELS[String(row.status)]], ['支付时间', dateTime(row.paid_at)], ['入账时间', dateTime(row.credited_at)]]).map(([label, value]) => <div key={String(label)}><dt>{label}</dt><dd>{str(value)}</dd></div>)}</dl>
      : view === 'insights' ? <div className={styles.fields}><p className={styles.quiet}>所属日期：{str(row.insight_date)}</p>{[['title', '标题'], ['source_label', '简短出处'], ['original_language', '原文语种'], ['original_text', '原文'], ['body', '译文 / 正文'], ['sources', '完整来源留档']].map(([key, label]) => <label key={key}>{label}{['original_text', 'body', 'sources'].includes(key) ? <textarea rows={key === 'sources' ? 3 : 7} value={String(draft[key] || '')} onChange={e => setDraft({ ...draft, [key]: e.target.value })} disabled={working} /> : <input value={String(draft[key] || '')} onChange={e => setDraft({ ...draft, [key]: e.target.value })} disabled={working} />}</label>)}</div>
      : <><div className={styles.fullText}>{str(row.body || row.snapshot_body)}</div><dl className={styles.inventory}><div><dt>作者</dt><dd>{str(row.display_id || row.snapshot_display_id)}</dd></div><div><dt>状态</dt><dd><Badge value={row.status || row.moderation_status} /></dd></div><div><dt>提交时间</dt><dd>{dateTime(row.created_at)}</dd></div>{view === 'reports' ? <><div><dt>举报原因</dt><dd>{LABELS[String(row.reason)] || str(row.reason)}</dd></div><div><dt>补充说明</dt><dd>{str(row.details)}</dd></div><div><dt>处理结果</dt><dd>{str(row.resolution)}</dd></div></> : <><div><dt>关联条目</dt><dd>{str(row.question_id || row.entry_id)}</dd></div><div><dt>处理原因</dt><dd>{str(row.moderation_reason)}</dd></div><div><dt>处理时间</dt><dd>{dateTime(row.moderated_at)}</dd></div></>}</dl></>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      {action && <div className={styles.confirm}><h3>确认{names[action]}</h3><p>{view === 'insights' ? '保存后，该日期的公开见闻将同步更新。' : action === 'vip' ? '所选期限从现在起重新计算，会覆盖现有到期时间。' : '此操作会立即影响网站上的内容或用户权限。'}</p>{(view === 'answers' || view === 'comments') && <label>处理原因<textarea required minLength={2} maxLength={300} value={reason} onChange={e => setReason(e.target.value)} disabled={working} /></label>}{action === 'vip' && <label>会员期限<select value={duration} onChange={e => setDuration(e.target.value)} disabled={working}>{[['1m', '一个月'], ['3m', '三个月'], ['6m', '六个月'], ['1y', '一年'], ['lifetime', '终身']].map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>}<div className={styles.actions}><button type="button" className={styles.button} disabled={working} onClick={() => setAction('')}>取消操作</button><button type="submit" className={styles.primary} disabled={working}>{working ? '正在保存…' : `确认${names[action]}`}</button></div></div>}
    </div>
    {!action && view !== 'orders' && <div className={styles.dialogFoot}>{(view === 'users' ? ['vip', suspended(row) ? 'resume' : 'suspend7d'] : view === 'insights' ? ['save'] : view === 'reports' ? ['hide', 'dismiss', 'suspend7d'] : [row.moderation_status === 'visible' ? 'hide' : 'restore']).map(value => <button type="button" key={value} className={styles.button} onClick={() => setAction(value)}>{names[value]}</button>)}</div>}
  </form></dialog>;
}
