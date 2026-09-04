'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { ADMIN_EMAIL } from '@/utils/vip';

type ReportStatus = 'open' | 'resolved' | 'dismissed';
type ModerationAction = 'hide' | 'remove' | 'restore' | 'dismiss' | 'suspend7d';

type CommunityReport = {
  id: string;
  content_type: 'answer' | 'comment';
  content_id: string;
  reason: string;
  details: string | null;
  snapshot_display_id: string;
  snapshot_body: string;
  status: ReportStatus;
  resolution: string | null;
  created_at: string;
  resolved_at: string | null;
};

const STATUS_LABELS: Record<ReportStatus, string> = {
  open: '待处理',
  resolved: '已处理',
  dismissed: '已保留',
};

const REASON_LABELS: Record<string, string> = {
  sexual: '色情低俗',
  hate: '仇恨攻击',
  harassment: '骚扰威胁',
  dangerous: '违法危险',
  spam: '垃圾广告',
  other: '其他问题',
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

export default function CommunityAdminPage() {
  const router = useRouter();
  const [status, setStatus] = useState<ReportStatus>('open');
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [openCount, setOpenCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadReports = useCallback(async (nextStatus: ReportStatus) => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/community?status=${nextStatus}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || '无法读取举报列表');
      setReports(payload.reports ?? []);
      setOpenCount(payload.openCount ?? 0);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '无法读取举报列表');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace('/login?next=/admin/community');
        return;
      }
      if (user.email !== ADMIN_EMAIL) {
        router.replace('/');
        return;
      }
      void loadReports(status);
    });
  }, [loadReports, router, status]);

  const act = async (report: CommunityReport, action: ModerationAction) => {
    if ((action === 'remove' || action === 'suspend7d')
      && !window.confirm(action === 'remove' ? '确认移除此内容？' : '确认隐藏内容并暂停该用户发言 7 天？')) {
      return;
    }
    setWorkingId(report.id);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/community', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: report.id, action }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || '处理失败');
      setMessage('处理结果已保存');
      await loadReports(status);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '处理失败');
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <main className="min-h-screen bg-[#FBF9F4] px-6 py-10 text-stone-700 sm:py-16">
      <div className="mx-auto max-w-4xl">
        <div className="mb-12 flex items-start justify-between gap-6">
          <div>
            <p className="mb-3 font-sans text-[10px] tracking-[0.34em] text-stone-400">众 声 守 护</p>
            <h1 className="font-serif text-[30px] font-normal tracking-[0.08em] text-stone-800">内容管理</h1>
            <p className="mt-4 max-w-xl font-sans text-[12px] leading-6 text-stone-500">
              查看用户举报，隐藏不当内容，并在必要时暂停发布者的发言权限。
            </p>
          </div>
          <Link
            href="/profile"
            className="flex min-h-11 items-center rounded-full border border-black/[0.07] px-4 font-sans text-[11px] tracking-[0.12em] text-stone-500 transition-colors duration-200 hover:bg-stone-900/[0.025]"
          >
            返回设置
          </Link>
        </div>

        <div className="mb-8 flex items-center gap-2 border-b border-stone-200/80" role="tablist" aria-label="举报状态">
          {(Object.keys(STATUS_LABELS) as ReportStatus[]).map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={status === item}
              onClick={() => setStatus(item)}
              className={`relative min-h-11 px-4 font-sans text-[11px] tracking-[0.14em] transition-colors ${status === item ? 'text-stone-800' : 'text-stone-400 hover:text-stone-600'}`}
            >
              {STATUS_LABELS[item]}{item === 'open' && openCount > 0 ? ` ${openCount}` : ''}
              {status === item && <span className="absolute inset-x-3 bottom-0 h-[2px] rounded-full bg-stone-500" />}
            </button>
          ))}
        </div>

        {message && (
          <p className="mb-5 border-l border-[#8A4A4A]/35 pl-3 font-sans text-[11px] leading-5 text-stone-600" role="status">
            {message}
          </p>
        )}

        {loading ? (
          <div className="space-y-4" aria-label="正在读取举报">
            {[0, 1].map((item) => <div key={item} className="h-44 animate-pulse rounded-2xl bg-stone-100/80" />)}
          </div>
        ) : reports.length === 0 ? (
          <div className="rounded-2xl border border-black/[0.06] px-6 py-16 text-center">
            <p className="font-serif text-lg text-stone-600">此处清净</p>
            <p className="mt-2 font-sans text-[11px] text-stone-400">当前没有{STATUS_LABELS[status]}的举报</p>
          </div>
        ) : (
          <div className="space-y-5">
            {reports.map((report) => (
              <article
                key={report.id}
                className="rounded-2xl border border-black/[0.07] bg-[#FDFCF9] px-5 py-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] sm:px-6"
              >
                <div className="mb-5 flex items-start justify-between gap-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border border-[#8A4A4A]/20 bg-[#8A4A4A]/[0.055] font-serif text-[12px] text-[#8A4A4A]">
                      察
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-sans text-[11px] tracking-[0.12em] text-stone-600">
                        {report.snapshot_display_id} · {report.content_type === 'answer' ? '手记' : '回应'}
                      </p>
                      <p className="mt-1 font-sans text-[9px] tracking-[0.05em] text-stone-400">
                        {formatTime(report.created_at)}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-stone-900/[0.045] px-2.5 py-1 font-sans text-[9px] tracking-[0.08em] text-stone-500">
                    {REASON_LABELS[report.reason] ?? report.reason}
                  </span>
                </div>

                <p className="whitespace-pre-wrap font-sans text-[13px] leading-7 text-stone-700">
                  {report.snapshot_body}
                </p>
                {report.details && (
                  <p className="mt-4 border-l border-stone-300/80 pl-3 font-sans text-[11px] leading-5 text-stone-500">
                    举报补充：{report.details}
                  </p>
                )}
                {report.resolution && (
                  <p className="mt-4 font-sans text-[10px] leading-5 text-stone-400">处理结果：{report.resolution}</p>
                )}

                {status === 'open' && (
                  <div className="mt-6 flex flex-wrap gap-2 border-t border-stone-200/70 pt-4">
                    <ActionButton disabled={workingId === report.id} onClick={() => void act(report, 'hide')}>隐藏内容</ActionButton>
                    <ActionButton disabled={workingId === report.id} onClick={() => void act(report, 'suspend7d')}>隐藏并暂停 7 天</ActionButton>
                    <ActionButton disabled={workingId === report.id} onClick={() => void act(report, 'remove')}>移除内容</ActionButton>
                    <ActionButton quiet disabled={workingId === report.id} onClick={() => void act(report, 'dismiss')}>保留内容</ActionButton>
                  </div>
                )}
                {status === 'resolved' && (
                  <div className="mt-6 border-t border-stone-200/70 pt-4">
                    <ActionButton quiet disabled={workingId === report.id} onClick={() => void act(report, 'restore')}>恢复显示</ActionButton>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function ActionButton({
  children,
  disabled,
  quiet = false,
  onClick,
}: {
  children: ReactNode;
  disabled: boolean;
  quiet?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`min-h-10 rounded-full px-4 font-sans text-[10px] tracking-[0.1em] transition-colors duration-200 disabled:opacity-40 ${quiet ? 'border border-stone-300/80 text-stone-500 hover:bg-stone-900/[0.025]' : 'bg-stone-800 text-[#FBF9F4] hover:bg-stone-700'}`}
    >
      {children}
    </button>
  );
}
