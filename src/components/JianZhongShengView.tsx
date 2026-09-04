'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { jianZhongShengSpace, type JianZhongShengEntry } from '@/content/jianzhongsheng';

const MIN_NOTE_LENGTH = 15;
const MAX_NOTE_LENGTH = 3000;

type CommunityResponse = {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
  mine: boolean;
  reportable?: boolean;
};

type DisplayEntry = JianZhongShengEntry & {
  mine?: boolean;
  reportable?: boolean;
};

type CommunityComment = {
  id: string;
  entryId: string;
  authorId: string;
  body: string;
  createdAt: string;
  mine: boolean;
  reportable?: boolean;
};

type SafetyTarget = {
  contentType: 'answer' | 'comment';
  id: string;
  authorId: string;
};

type SaveState = 'idle' | 'saving' | 'shared' | 'local';

function PaperGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true" className={className}>
      <path d="M6.5 3.5h10.75l4.25 4.25V24.5h-15z" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M17.25 3.5v4.25h4.25M10 12h8M10 16h8M10 20h5" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BackGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path d="m14.5 5.5-6.5 6.5 6.5 6.5M8.5 12h8" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function excerptFromBody(body: string) {
  const compact = body.replace(/\s+/g, ' ').trim();
  if (compact.length <= 92) return compact;
  return `${compact.slice(0, 92).trim()}……`;
}

function bodyParagraphs(body: string) {
  return body.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
}

function commentTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export const JianZhongShengView: React.FC = () => {
  const space = jianZhongShengSpace;
  const reduceMotion = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const feedScrollPosition = useRef(0);
  const storageKey = `jianzhongsheng:${space.id}:note`;
  const [draft, setDraft] = useState('');
  const [myNote, setMyNote] = useState('');
  const [validationMessage, setValidationMessage] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [communityResponses, setCommunityResponses] = useState<CommunityResponse[]>([]);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [selectedEntry, setSelectedEntry] = useState<DisplayEntry | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsUnavailable, setCommentsUnavailable] = useState(false);
  const [canComment, setCanComment] = useState<boolean | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentMessage, setCommentMessage] = useState('');
  const [commentSaving, setCommentSaving] = useState(false);
  const [safetyTarget, setSafetyTarget] = useState<SafetyTarget | null>(null);
  const [reportReason, setReportReason] = useState('harassment');
  const [reportDetails, setReportDetails] = useState('');
  const [safetyBusy, setSafetyBusy] = useState(false);
  const [safetyMessage, setSafetyMessage] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(storageKey)?.trim() ?? '';
        if (stored) {
          setDraft(stored);
          setMyNote(stored);
          setSaveState('local');
        }
      } catch {
        // 隐私模式下 localStorage 可能不可用；不影响本次书写。
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [storageKey]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/jianzhongsheng?questionId=${encodeURIComponent(space.id)}`, {
      credentials: 'include',
      cache: 'no-store',
      signal: controller.signal,
    })
      .then((response) => response.ok ? response.json() : null)
      .then((payload: { answers?: CommunityResponse[] } | null) => {
        const answers = payload?.answers ?? [];
        setCommunityResponses(answers);
        const mine = answers.find((answer) => answer.mine);
        if (mine) {
          setDraft(mine.body);
          setMyNote(mine.body);
          setSaveState('shared');
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [space.id]);

  useEffect(() => {
    if (!selectedEntry) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setComments([]);
      setCommentsLoading(true);
      setCommentsUnavailable(false);
      setCanComment(null);
      setCommentDraft('');
      setCommentMessage('');
      fetch(`/api/jianzhongsheng/comments?entryId=${encodeURIComponent(selectedEntry.id)}`, {
        credentials: 'include',
        cache: 'no-store',
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) throw new Error('comments unavailable');
          return response.json() as Promise<{ comments?: CommunityComment[]; canComment?: boolean }>;
        })
        .then((payload) => {
          setComments(payload.comments ?? []);
          setCanComment(Boolean(payload.canComment));
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === 'AbortError') return;
          setCommentsUnavailable(true);
        })
        .finally(() => {
          if (!controller.signal.aborted) setCommentsLoading(false);
        });
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [selectedEntry]);

  const entries = useMemo<DisplayEntry[]>(() => {
    const hasSharedNote = communityResponses.some((response) => response.mine);
    const localEntry: DisplayEntry[] = myNote && !hasSharedNote
      ? [{
          id: 'my-local-note',
          authorId: '我',
          excerpt: excerptFromBody(myNote),
          body: myNote,
          mine: true,
        }]
      : [];
    const sharedEntries = communityResponses.map((response) => ({
      id: response.id,
      authorId: response.mine ? '我' : response.authorId,
      excerpt: excerptFromBody(response.body),
      body: response.body,
      mine: response.mine,
      reportable: response.reportable,
    }));
    return [...localEntry, ...sharedEntries, ...space.entries];
  }, [communityResponses, myNote, space.entries]);

  const displayedComments = useMemo<CommunityComment[]>(() => {
    const sampleComments = (selectedEntry?.sampleComments ?? []).map((comment) => ({
      ...comment,
      entryId: selectedEntry?.id ?? '',
      mine: false,
      reportable: false,
    }));
    return [...sampleComments, ...comments];
  }, [comments, selectedEntry]);

  const saveLabel = saveState === 'shared'
    ? '已发布'
    : saveState === 'saving'
      ? '正在发布'
      : saveState === 'local'
        ? '暂存于此设备'
        : '';

  const openEntry = (entry: DisplayEntry) => {
    feedScrollPosition.current = window.scrollY;
    setComments([]);
    setCommentsUnavailable(false);
    setCanComment(null);
    setCommentDraft('');
    setCommentMessage('');
    setSelectedEntry(entry);
    window.setTimeout(() => {
      sectionRef.current?.scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'start',
      });
    }, 0);
  };

  const closeEntry = () => {
    setSelectedEntry(null);
    setComments([]);
    setCommentsUnavailable(false);
    setCanComment(null);
    setCommentDraft('');
    setCommentMessage('');
    window.setTimeout(() => {
      window.scrollTo({
        top: feedScrollPosition.current,
        behavior: reduceMotion ? 'auto' : 'smooth',
      });
    }, 0);
  };

  const submitNote = async () => {
    const note = draft.trim();
    if (note.length < MIN_NOTE_LENGTH) {
      setValidationMessage(`再写一点吧，至少留下 ${MIN_NOTE_LENGTH} 个字。`);
      return;
    }
    setValidationMessage('');
    setMyNote(note);
    setComposerOpen(false);
    setSaveState('saving');
    try {
      window.localStorage.setItem(storageKey, note);
    } catch {
      // 本次仍可展示；只是不跨刷新保存。
    }
    try {
      const response = await fetch('/api/jianzhongsheng', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: space.id, body: note }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        setSaveState('local');
        setValidationMessage(payload.error || '手记暂时未能发布，已保存在此设备。');
        setComposerOpen(true);
      } else {
        const payload = await response.json() as { answer?: CommunityResponse };
        if (payload.answer) {
          setCommunityResponses((current) => [
            ...current.filter((item) => item.id !== payload.answer?.id && !item.mine),
            payload.answer as CommunityResponse,
          ]);
        }
        setSaveState('shared');
      }
    } catch {
      setSaveState('local');
      setValidationMessage('网络暂时不可用，手记已保存在此设备。');
      setComposerOpen(true);
    }
  };

  const submitComment = async () => {
    if (!selectedEntry) return;
    const body = commentDraft.trim();
    if (!body) {
      setCommentMessage('写下一点内容再回应。');
      return;
    }
    setCommentSaving(true);
    setCommentMessage('');
    try {
      const response = await fetch('/api/jianzhongsheng/comments', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId: selectedEntry.id, body }),
      });
      const payload = await response.json() as { comment?: CommunityComment; error?: string };
      if (!response.ok || !payload.comment) {
        setCommentMessage(payload.error || '回应暂时未能留下。');
        return;
      }
      setComments((current) => [...current, payload.comment as CommunityComment]);
      setCommentDraft('');
      setCommentMessage('回应已经留下。');
    } catch {
      setCommentMessage('回应暂时未能留下。');
    } finally {
      setCommentSaving(false);
    }
  };

  const deleteContent = async (target: SafetyTarget) => {
    const prompt = target.contentType === 'answer'
      ? '确认删除这则手记？删除后无法恢复。'
      : '确认删除这条回应？';
    if (!window.confirm(prompt)) return;
    setSafetyBusy(true);
    setSafetyMessage('');
    try {
      if (target.contentType === 'answer' && target.id === 'my-local-note') {
        try { window.localStorage.removeItem(storageKey); } catch {}
        setMyNote('');
        setDraft('');
        setSaveState('idle');
        closeEntry();
        return;
      }
      const endpoint = target.contentType === 'answer' ? '/api/jianzhongsheng' : '/api/jianzhongsheng/comments';
      const response = await fetch(`${endpoint}?id=${encodeURIComponent(target.id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || '暂时无法删除');
      if (target.contentType === 'answer') {
        setCommunityResponses((current) => current.filter((item) => item.id !== target.id));
        setMyNote('');
        setDraft('');
        setSaveState('idle');
        try { window.localStorage.removeItem(storageKey); } catch {}
        closeEntry();
      } else {
        setComments((current) => current.filter((item) => item.id !== target.id));
        setSafetyMessage('回应已删除。');
      }
    } catch (error) {
      setSafetyMessage(error instanceof Error ? error.message : '暂时无法删除');
    } finally {
      setSafetyBusy(false);
    }
  };

  const blockAuthor = async (target: SafetyTarget) => {
    if (!window.confirm(`屏蔽“${target.authorId}”后，你将不再看到此人的公开手记和回应。确认屏蔽？`)) return;
    setSafetyBusy(true);
    setSafetyMessage('');
    try {
      const response = await fetch('/api/jianzhongsheng/blocks', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: target.contentType, contentId: target.id }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || '暂时无法屏蔽');
      setCommunityResponses((current) => current.filter((item) => item.authorId !== target.authorId));
      setComments((current) => current.filter((item) => item.authorId !== target.authorId));
      setSafetyMessage(`已屏蔽“${target.authorId}”，可在个人设置中解除。`);
      if (target.contentType === 'answer') closeEntry();
    } catch (error) {
      setSafetyMessage(error instanceof Error ? error.message : '暂时无法屏蔽');
    } finally {
      setSafetyBusy(false);
    }
  };

  const submitReport = async () => {
    if (!safetyTarget) return;
    setSafetyBusy(true);
    setSafetyMessage('');
    try {
      const response = await fetch('/api/jianzhongsheng/reports', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType: safetyTarget.contentType,
          contentId: safetyTarget.id,
          reason: reportReason,
          details: reportDetails.trim(),
        }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || '暂时无法提交举报');
      setSafetyTarget(null);
      setReportDetails('');
      setSafetyMessage('举报已收到，我们会尽快处理。');
    } catch (error) {
      setSafetyMessage(error instanceof Error ? error.message : '暂时无法提交举报');
    } finally {
      setSafetyBusy(false);
    }
  };

  return (
    <section ref={sectionRef} className="w-full scroll-mt-5 pb-10">
      <AnimatePresence initial={false} mode="wait">
        {selectedEntry ? (
          <motion.div
            key={`entry-${selectedEntry.id}`}
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <button
              type="button"
              onClick={closeEntry}
              className="mb-7 flex min-h-11 items-center gap-2 font-sans text-[11px] tracking-[0.14em] text-stone-500 transition-colors hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400/30"
            >
              <BackGlyph />
              返回众生
            </button>

            <div className="mb-5 flex items-center gap-3">
              <span className="font-sans text-[10px] tracking-[0.34em] text-stone-400">一 则 手 记</span>
              <span className="h-px flex-1 bg-stone-200/80" />
              <PaperGlyph className="h-5 w-5 text-stone-300" />
            </div>

            <article className="rounded-[18px] bg-stone-900/[0.025] p-px ring-1 ring-stone-900/[0.055]" aria-labelledby="jianzhongsheng-entry-author">
              <div className="relative overflow-hidden rounded-[17px] bg-[#fdfcf9] px-6 pb-8 pt-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] sm:px-8">
                <span aria-hidden="true" className="absolute right-4 top-4 h-7 w-7 rounded-tr-lg border-r border-t border-stone-300/60" />
                <h2
                  id="jianzhongsheng-entry-author"
                  className="mb-8 text-[13px] tracking-[0.18em] text-stone-500"
                  style={{ fontFamily: 'var(--ui-font-kaiti)', fontWeight: 400 }}
                >
                  {selectedEntry.authorId}
                </h2>
                <div
                  lang="zh-Hans"
                  className="jianzhongsheng-reading-text space-y-5 text-[15px] leading-[2] tracking-normal text-stone-700"
                >
                  {bodyParagraphs(selectedEntry.body).map((paragraph, index) => (
                    <p key={`${selectedEntry.id}-${index}`}>{paragraph}</p>
                  ))}
                </div>
                <div className="mt-9 flex items-center gap-3">
                  <span className="h-px flex-1 bg-stone-200/70" />
                  <span
                    className="text-[12px] tracking-[0.16em] text-stone-500"
                    style={{ fontFamily: 'var(--ui-font-kaiti)', fontWeight: 400 }}
                  >
                    — {selectedEntry.authorId}
                  </span>
                </div>
              </div>
            </article>

            {(selectedEntry.mine || selectedEntry.reportable) && (
              <div className="mt-3 flex min-h-10 items-center justify-end gap-4 px-1 font-sans text-[10px] tracking-[0.08em] text-stone-400">
                {selectedEntry.mine ? (
                  <button
                    type="button"
                    disabled={safetyBusy}
                    onClick={() => void deleteContent({ contentType: 'answer', id: selectedEntry.id, authorId: selectedEntry.authorId })}
                    className="min-h-9 transition-colors hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400/30 disabled:opacity-40"
                  >
                    删除手记
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={safetyBusy}
                      onClick={() => {
                        setReportReason('harassment');
                        setReportDetails('');
                        setSafetyTarget({ contentType: 'answer', id: selectedEntry.id, authorId: selectedEntry.authorId });
                      }}
                      className="min-h-9 transition-colors hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400/30 disabled:opacity-40"
                    >
                      举报
                    </button>
                    <button
                      type="button"
                      disabled={safetyBusy}
                      onClick={() => void blockAuthor({ contentType: 'answer', id: selectedEntry.id, authorId: selectedEntry.authorId })}
                      className="min-h-9 transition-colors hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400/30 disabled:opacity-40"
                    >
                      屏蔽此人
                    </button>
                  </>
                )}
              </div>
            )}

            {safetyMessage && (
              <p className="mt-3 rounded-xl border border-stone-200/80 bg-stone-900/[0.018] px-4 py-3 font-sans text-[10px] leading-5 text-stone-500" role="status">
                {safetyMessage}
              </p>
            )}

            <section className="mt-10" aria-labelledby="jianzhongsheng-comments-title">
              <div className="mb-2 flex items-center gap-3">
                <span id="jianzhongsheng-comments-title" className="font-sans text-[10px] tracking-[0.34em] text-stone-400">众 生 回 应</span>
                <span className="h-px flex-1 bg-stone-200/80" />
                <span className="font-sans text-[10px] tabular-nums text-stone-400">{displayedComments.length}</span>
              </div>
              <p className="mb-5 font-sans text-[10px] leading-5 tracking-[0.05em] text-stone-400">
                回应这则手记，也可以只是说说它让你想起了什么。
              </p>

              {commentsLoading && displayedComments.length === 0 ? (
                <div className="space-y-4 py-2" aria-label="正在读取回应">
                  {[0, 1].map((item) => (
                    <div key={item} className="border-t border-stone-200/70 pt-4">
                      <div className="mb-3 h-3 w-20 animate-pulse rounded bg-stone-100/80" />
                      <div className="h-3.5 w-full animate-pulse rounded bg-stone-100/60" />
                    </div>
                  ))}
                </div>
              ) : commentsUnavailable && displayedComments.length === 0 ? (
                <p className="border-t border-stone-200/70 py-5 font-sans text-[11px] leading-6 text-stone-400">
                  回应暂时无法读取，稍后再来看看。
                </p>
              ) : displayedComments.length > 0 ? (
                <div>
                  {displayedComments.map((comment) => (
                    <article key={comment.id} className="border-t border-stone-200/70 py-4">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span
                          className="min-w-0 truncate text-[11px] tracking-[0.12em] text-stone-500"
                          style={{ fontFamily: 'var(--ui-font-kaiti)', fontWeight: 400 }}
                        >
                          {comment.mine ? '我' : comment.authorId}
                        </span>
                        <time className="shrink-0 font-sans text-[9px] tracking-[0.04em] text-stone-300" dateTime={comment.createdAt}>
                          {commentTime(comment.createdAt)}
                        </time>
                      </div>
                      <p className="whitespace-pre-wrap font-sans text-[13px] leading-6 tracking-[0.01em] text-stone-600">{comment.body}</p>
                      {(comment.mine || comment.reportable) && (
                        <div className="mt-2 flex justify-end gap-4 font-sans text-[9px] tracking-[0.08em] text-stone-400">
                          {comment.mine ? (
                            <button
                              type="button"
                              disabled={safetyBusy}
                              onClick={() => void deleteContent({ contentType: 'comment', id: comment.id, authorId: comment.authorId })}
                              className="min-h-8 transition-colors hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400/30 disabled:opacity-40"
                            >
                              删除
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                disabled={safetyBusy}
                                onClick={() => {
                                  setReportReason('harassment');
                                  setReportDetails('');
                                  setSafetyTarget({ contentType: 'comment', id: comment.id, authorId: comment.authorId });
                                }}
                                className="min-h-8 transition-colors hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400/30 disabled:opacity-40"
                              >
                                举报
                              </button>
                              <button
                                type="button"
                                disabled={safetyBusy}
                                onClick={() => void blockAuthor({ contentType: 'comment', id: comment.id, authorId: comment.authorId })}
                                className="min-h-8 transition-colors hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400/30 disabled:opacity-40"
                              >
                                屏蔽此人
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </article>
                  ))}
                  {commentsUnavailable && (
                    <p className="border-t border-stone-200/70 py-4 font-sans text-[10px] leading-5 text-stone-400">
                      更多回应暂时无法读取。
                    </p>
                  )}
                </div>
              ) : (
                <p className="border-t border-stone-200/70 py-5 font-sans text-[11px] leading-6 tracking-[0.04em] text-stone-400">
                  还没有回应。你可以留下第一句。
                </p>
              )}

              {!commentsUnavailable && canComment === true && (
                <div className="mt-2 rounded-2xl border border-black/[0.07] bg-[#fdfcf9] px-4 pb-3 pt-4 shadow-[0_1px_3px_rgba(0,0,0,0.035)] transition-colors focus-within:border-stone-400/50">
                  <label htmlFor="jianzhongsheng-comment" className="sr-only">回应这则手记</label>
                  <textarea
                    id="jianzhongsheng-comment"
                    value={commentDraft}
                    onChange={(event) => {
                      setCommentDraft(event.target.value);
                      if (commentMessage) setCommentMessage('');
                    }}
                    placeholder="留下你的回应……"
                    rows={3}
                    maxLength={800}
                    className="min-h-20 w-full resize-none bg-transparent font-sans text-[16px] leading-6 text-stone-700 outline-none placeholder:text-stone-300 sm:text-[13px]"
                  />
                  <div className="flex items-center justify-between gap-4 border-t border-stone-200/70 pt-3">
                    <span className="font-sans text-[9px] text-stone-400" aria-live="polite">
                      {commentMessage || `${commentDraft.length} / 800`}
                    </span>
                    <button
                      type="button"
                      onClick={() => void submitComment()}
                      disabled={commentSaving}
                      className="min-h-9 rounded-full bg-stone-800 px-4 font-sans text-[10px] tracking-[0.14em] text-[#fbf9f4] transition-colors duration-200 hover:bg-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fbf9f4] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {commentSaving ? '正在回应' : '留下回应'}
                    </button>
                  </div>
                </div>
              )}

              {!commentsUnavailable && canComment === false && (
                <p className="mt-2 rounded-2xl border border-black/[0.06] bg-stone-900/[0.018] px-4 py-4 text-center font-sans text-[11px] tracking-[0.06em] text-stone-400">
                  登录后，可以回应这则手记
                </p>
              )}
            </section>

            <button
              type="button"
              onClick={closeEntry}
              className="mt-7 flex min-h-11 w-full items-center justify-center rounded-full border border-stone-300/70 font-sans text-[11px] tracking-[0.18em] text-stone-600 transition-colors duration-200 hover:bg-stone-900/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400/30"
            >
              读完，回到众生
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="notes-feed"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="mb-2 flex items-center gap-3">
              <span id="jianzhongsheng-notes-title" className="font-sans text-[10px] tracking-[0.34em] text-stone-400">众 生 手 记</span>
              <span className="h-px flex-1 bg-stone-200/80" />
            </div>
            <p
              className="mb-7 text-[14px] leading-7 tracking-[0.04em] text-stone-600"
              style={{ fontFamily: 'var(--ui-font-serif)', fontWeight: 400 }}
            >
              众生各自在生活，我们偶然看见。
            </p>

            <div className="mb-9">
              <AnimatePresence initial={false} mode="wait">
                {composerOpen ? (
                  <motion.div
                    key="composer"
                    initial={reduceMotion ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <label htmlFor="jianzhongsheng-note" className="mb-3 block font-sans text-[11px] tracking-[0.2em] text-stone-500">
                      此刻，你想留下些什么？
                    </label>
                    <div className="rounded-2xl border border-black/[0.07] bg-[#fdfcf9] px-4 pb-3 pt-4 shadow-[0_1px_3px_rgba(0,0,0,0.035)] transition-colors focus-within:border-stone-400/50">
                      <textarea
                        id="jianzhongsheng-note"
                        value={draft}
                        maxLength={MAX_NOTE_LENGTH}
                        onChange={(event) => {
                          setDraft(event.target.value);
                          if (validationMessage) setValidationMessage('');
                        }}
                        placeholder="写下最近在你心中停留过的事……"
                        rows={7}
                        className="min-h-44 w-full resize-none bg-transparent font-sans text-[16px] leading-7 text-stone-700 outline-none placeholder:text-stone-300 sm:text-[14px]"
                      />
                      <p className="border-t border-stone-200/70 pt-3 font-sans text-[9px] leading-5 tracking-[0.03em] text-stone-400">
                        公开内容会经过安全检查；请勿发布联系方式、骚扰或违法内容。
                      </p>
                      <div className="flex items-center justify-between gap-4 border-t border-stone-200/70 pt-3">
                        <button
                          type="button"
                          onClick={() => {
                            setValidationMessage('');
                            setComposerOpen(false);
                          }}
                          className="min-h-10 px-2 font-sans text-[10px] tracking-[0.14em] text-stone-400 transition-colors hover:text-stone-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400/30"
                        >
                          收起
                        </button>
                        <span className="font-sans text-[10px] text-stone-400" aria-live="polite">
                          {validationMessage || `至少 ${MIN_NOTE_LENGTH} 字 · ${draft.trim().length} / ${MAX_NOTE_LENGTH}`}
                        </span>
                        <button
                          type="button"
                          onClick={() => void submitNote()}
                          className="min-h-10 rounded-full bg-stone-800 px-5 font-sans text-[11px] tracking-[0.16em] text-[#fbf9f4] transition-colors duration-200 hover:bg-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fbf9f4] active:bg-stone-900"
                        >
                          发布手记
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.button
                    key="open-composer"
                    type="button"
                    initial={reduceMotion ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    onClick={() => setComposerOpen(true)}
                    className="group flex min-h-20 w-full items-center gap-4 rounded-2xl border border-black/[0.07] bg-[#fdfcf9] px-5 py-4 text-left shadow-[0_1px_3px_rgba(0,0,0,0.035)] transition-colors hover:bg-stone-900/[0.012] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400/30"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-900/[0.035] text-stone-500 ring-1 ring-inset ring-stone-900/[0.055]">
                      <PaperGlyph className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-sans text-[12px] tracking-[0.13em] text-stone-600">写下此刻</span>
                      <span className="mt-1 block truncate font-sans text-[10px] tracking-[0.04em] text-stone-400">
                        {myNote ? saveLabel : '不必先想清楚，也不必得出结论'}
                      </span>
                    </span>
                    <span className="font-sans text-[10px] tracking-[0.14em] text-stone-400 transition-colors group-hover:text-stone-600">
                      {myNote ? '续写' : '写下'}
                    </span>
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            <div className="mb-5 flex items-center gap-3">
              <span className="font-sans text-[10px] tracking-[0.34em] text-stone-400">近 日 所 见</span>
              <span className="h-px flex-1 bg-stone-200/80" />
            </div>

            <div className="columns-2 gap-3" aria-labelledby="jianzhongsheng-notes-title">
              {entries.map((entry, index) => (
                <motion.button
                  key={entry.id}
                  type="button"
                  aria-label={`阅读${entry.authorId}的手记`}
                  initial={reduceMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: reduceMotion ? 0 : Math.min(index * 0.025, 0.16) }}
                  onClick={() => openEntry(entry)}
                  className="group relative mb-3 inline-block w-full break-inside-avoid rounded-2xl border border-black/[0.07] bg-[#fdfcf9] px-4 pb-4 pt-4 text-left shadow-[0_1px_3px_rgba(0,0,0,0.035)] transition-colors hover:bg-stone-900/[0.012] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400/30"
                >
                  <span aria-hidden="true" className="absolute right-3 top-3 h-4 w-4 rounded-tr-md border-r border-t border-stone-300/50" />
                  <span
                    className="block pr-2 text-[13px] leading-[1.95] tracking-[0.015em] text-stone-700"
                    style={{ fontFamily: 'var(--ui-font-serif)', fontWeight: 400 }}
                  >
                    {entry.excerpt}
                  </span>
                  <span className="mt-4 flex items-end justify-between gap-2 border-t border-stone-900/[0.055] pt-3">
                    <span
                      className="min-w-0 truncate text-[11px] tracking-[0.12em] text-stone-500"
                      style={{ fontFamily: 'var(--ui-font-kaiti)', fontWeight: 400 }}
                    >
                      {entry.authorId}
                    </span>
                    <span className="shrink-0 font-sans text-[8px] tracking-[0.12em] text-stone-300 transition-colors group-hover:text-stone-500">展开</span>
                  </span>
                </motion.button>
              ))}
            </div>

            <p className="mt-5 text-center font-sans text-[9px] leading-5 tracking-[0.08em] text-stone-300">
              其中包含编辑创作的示例手记与回应，用来示意这里可以如何说话
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {safetyTarget && (
          <motion.div
            className="fixed inset-0 z-[80] flex items-end justify-center bg-stone-950/20 px-3 pb-3 pt-16 backdrop-blur-[1px] sm:items-center"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="community-report-title"
            onMouseDown={(event) => {
              if (event.currentTarget === event.target && !safetyBusy) setSafetyTarget(null);
            }}
          >
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-md rounded-[20px] border border-stone-900/[0.08] bg-[#fbf9f4] px-5 pb-5 pt-6 shadow-[0_18px_60px_rgba(38,35,31,0.16)]"
            >
              <div className="mb-5 flex items-center gap-3">
                <h2 id="community-report-title" className="font-sans text-[12px] tracking-[0.2em] text-stone-700">举报不当内容</h2>
                <span className="h-px flex-1 bg-stone-200" />
                <span className="flex h-7 w-7 items-center justify-center rounded-sm border border-[#b45546]/35 text-[12px] text-[#9b4a3d]" aria-hidden="true">察</span>
              </div>
              <p className="mb-4 font-sans text-[10px] leading-5 text-stone-500">
                请选择最符合的原因。提交后，内容可能被暂时隐藏并进入人工复核。
              </p>
              <fieldset className="space-y-1">
                <legend className="sr-only">举报原因</legend>
                {[
                  ['harassment', '骚扰、威胁或泄露隐私'],
                  ['hate', '仇恨或歧视言论'],
                  ['sexual', '色情或招揽性内容'],
                  ['dangerous', '自伤或危险行为指导'],
                  ['spam', '广告、诈骗或垃圾信息'],
                  ['other', '其他不当内容'],
                ].map(([value, label]) => (
                  <label key={value} className="flex min-h-10 cursor-pointer items-center gap-3 border-b border-stone-200/70 px-1 font-sans text-[11px] text-stone-600 last:border-b-0">
                    <input
                      type="radio"
                      name="community-report-reason"
                      value={value}
                      checked={reportReason === value}
                      onChange={(event) => setReportReason(event.target.value)}
                      className="h-3.5 w-3.5 accent-stone-700"
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </fieldset>
              <label htmlFor="community-report-details" className="mt-4 block font-sans text-[10px] tracking-[0.08em] text-stone-500">补充说明（选填）</label>
              <textarea
                id="community-report-details"
                value={reportDetails}
                onChange={(event) => setReportDetails(event.target.value)}
                maxLength={500}
                rows={3}
                className="mt-2 w-full resize-none rounded-xl border border-stone-200 bg-[#fdfcf9] px-3 py-2.5 font-sans text-[16px] leading-6 text-stone-700 outline-none transition-colors focus:border-stone-400 sm:text-[12px]"
                placeholder="如有需要，可写下具体情况"
              />
              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  disabled={safetyBusy}
                  onClick={() => setSafetyTarget(null)}
                  className="min-h-10 px-4 font-sans text-[10px] tracking-[0.12em] text-stone-500 transition-colors hover:text-stone-700 disabled:opacity-40"
                >
                  取消
                </button>
                <button
                  type="button"
                  disabled={safetyBusy}
                  onClick={() => void submitReport()}
                  className="min-h-10 rounded-full bg-stone-800 px-5 font-sans text-[10px] tracking-[0.14em] text-[#fbf9f4] transition-colors hover:bg-stone-700 disabled:opacity-40"
                >
                  {safetyBusy ? '正在提交' : '提交举报'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};
