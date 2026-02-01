'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { InsufficientCoinsModal } from './InsufficientCoinsModal';
import { CopperCoinIcon } from './CopperCoinIcon';
import { ImportData } from '@/types/import-data';
import type { BaziInput } from '@/utils/baziLogic';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isReasoning?: boolean;
  timestamp: Date;
}

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

// 导入数据类型定义
interface ImportedBaziData {
  type: 'bazi';
  name?: string;
  gender?: string;
  pillars: {
    year: { gan: string; zhi: string };
    month: { gan: string; zhi: string };
    day: { gan: string; zhi: string };
    hour: { gan: string; zhi: string };
  };
  strength?: string; // 强弱
  yongshen?: string; // 用神
  shishenRatios?: { [key: string]: number }; // 十神比例
  tianganRatios?: { [key: string]: number }; // 十天干比例
  relations?: any; // 八字合冲关系
  mbti?: string; // 八字推导的MBTI
  additionalInfo?: any; // 其他计算好的信息
}

interface ImportedMbtiData {
  type: 'mbti';
  mbtiType: string;
  functionScores?: { [key: string]: number }; // 八维功能分数
  shadowType?: string;
  additionalInfo?: any;
}

interface ImportedLiuyaoData {
  type: 'liuyao';
  question: string;
  hexagram: {
    main: string;
    transformed?: string;
    description?: string;
  };
  yaos?: any[];
  guaci?: string; // 卦辞
  yaoci?: string[]; // 爻辞
  additionalInfo?: any;
}

type ImportedData = ImportedBaziData | ImportedMbtiData | ImportedLiuyaoData;

interface JueXingCangViewProps {
  /** 嵌入主页 tab 时传 true，不渲染 logo/标题，由 page 统一渲染以实现瞬间切换 */
  hideHeader?: boolean;
}

export const JueXingCangView: React.FC<JueXingCangViewProps> = ({ hideHeader = false }) => {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mindMode, setMindMode] = useState<'none' | 'deep' | 'meditation'>('none');
  const [useSearch, setUseSearch] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendingRef = useRef(false);
  const lastSendRef = useRef<{ content: string; at: number }>({ content: '', at: 0 });
  const idRef = useRef(0);
  const prefillAppliedRef = useRef(false);
  const importAppliedRef = useRef(false);
  /** 用户是否在"跟读底部"（在底部附近未主动上滑），仅在为 true 时自动滚到底 */
  const userFollowsBottomRef = useRef(true);
  const [insuffOpen, setInsuffOpen] = useState(false);
  const [insuffNeed, setInsuffNeed] = useState(5);
  
  // 导入数据相关状态
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState<ImportData>({});
  const [showBaziImportedNotice, setShowBaziImportedNotice] = useState(false);
  const [showLiuyaoImportedNotice, setShowLiuyaoImportedNotice] = useState(false);
  const [showMeditationWarning, setShowMeditationWarning] = useState(false);
  const pendingImportKey = 'juexingcang-import-pending';
  const inputPresetKey = 'juexingcang-input-preset';

  // 会话管理相关状态
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [showSessionList, setShowSessionList] = useState(false); // 移动端抽屉显示
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [showDesktopSidebar, setShowDesktopSidebar] = useState(false); // 桌面端侧边栏显示状态
  const [searchQuery, setSearchQuery] = useState(''); // 搜索关键词
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null); // 正在编辑的会话ID
  const [editingTitle, setEditingTitle] = useState(''); // 编辑中的标题

  const renderMessageContent = (content: string) => {
    const parts: React.ReactNode[] = [];
    const regex = /\*\*([\s\S]+?)\*\*/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push(content.slice(lastIndex, match.index));
      }
      parts.push(
        <strong key={`bold-${match.index}`} className="font-semibold">
          {match[1]}
        </strong>
      );
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
      parts.push(content.slice(lastIndex));
    }

    return parts;
  };

  const normalizeImportData = (data: Partial<ImportData> | null | undefined): ImportData => ({
    bazi: Array.isArray(data?.bazi) ? data?.bazi : data?.bazi ? [data.bazi] : undefined,
    mbti: Array.isArray(data?.mbti) ? data?.mbti : data?.mbti ? [data.mbti] : undefined,
    liuyao: Array.isArray(data?.liuyao) ? data?.liuyao : data?.liuyao ? [data.liuyao] : undefined,
  });

  const mergeImportData = (base: ImportData, incoming: ImportData): ImportData => ({
    bazi: [...(base.bazi ?? []), ...(incoming.bazi ?? [])],
    mbti: [...(base.mbti ?? []), ...(incoming.mbti ?? [])],
    liuyao: [...(base.liuyao ?? []), ...(incoming.liuyao ?? [])],
  });

  const getImportCount = (data: ImportData) =>
    (data.bazi?.length ?? 0) + (data.mbti?.length ?? 0) + (data.liuyao?.length ?? 0);

  const nextId = () => `msg-${Date.now()}-${++idRef.current}`;

  const SCROLL_BOTTOM_THRESHOLD = 80;

  // 加载会话列表
  const loadSessions = async () => {
    setIsLoadingSessions(true);
    try {
      const response = await fetch('/api/chat-sessions');
      if (response.ok) {
        const data = await response.json();
        setSessions(data);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('加载会话列表失败:', response.status, errorData);
      }
    } catch (error) {
      console.error('加载会话列表失败:', error);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  // 创建新会话
  const createNewSession = async () => {
    try {
      const response = await fetch('/api/chat-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '新对话' }),
      });
      
      if (response.ok) {
        const newSession = await response.json();
        setSessions(prev => [newSession, ...prev]);
        setCurrentSessionId(newSession.id);
        setMessages([]);
        return newSession;
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('创建会话失败:', response.status, errorData);
      }
    } catch (error) {
      console.error('创建会话失败:', error);
    }
    return null;
  };

  // 加载会话消息
  const loadSessionMessages = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/chat-sessions/${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        const loadedMessages: Message[] = data.map((msg: any) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          isReasoning: msg.is_reasoning,
          timestamp: new Date(msg.created_at),
        }));
        setMessages(loadedMessages);
      }
    } catch (error) {
      console.error('加载消息失败:', error);
    }
  };

  // 切换会话
  const switchSession = async (sessionId: string) => {
    setCurrentSessionId(sessionId);
    await loadSessionMessages(sessionId);
    setShowSessionList(false);
  };

  // 删除会话
  const deleteSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/chat-sessions?id=${sessionId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setSessions(prev => prev.filter(s => s.id !== sessionId));
        if (currentSessionId === sessionId) {
          setCurrentSessionId(null);
          setMessages([]);
        }
      }
    } catch (error) {
      console.error('删除会话失败:', error);
    }
  };

  // 保存消息到当前会话
  const saveMessagesToSession = async (sessionId: string, newMessages: Message[]) => {
    try {
      const response = await fetch(`/api/chat-sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(msg => ({
            role: msg.role,
            content: msg.content,
            isReasoning: msg.isReasoning,
          })),
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('保存消息失败:', response.status, errorData);
        throw new Error(`保存消息失败: ${response.status}`);
      }
      
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('保存消息失败:', error);
      throw error;
    }
  };

  // 更新会话标题
  const updateSessionTitle = async (sessionId: string, title: string) => {
    try {
      await fetch(`/api/chat-sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      // 更新本地状态
      setSessions(prev => prev.map(s => 
        s.id === sessionId ? { ...s, title } : s
      ));
    } catch (error) {
      console.error('更新会话标题失败:', error);
    }
  };

  // 开始编辑会话标题
  const startEditingTitle = (sessionId: string, currentTitle: string) => {
    setEditingSessionId(sessionId);
    setEditingTitle(currentTitle);
  };

  // 保存编辑的标题
  const saveEditingTitle = async (sessionId: string) => {
    if (editingTitle.trim() && editingTitle !== sessions.find(s => s.id === sessionId)?.title) {
      await updateSessionTitle(sessionId, editingTitle.trim());
    }
    setEditingSessionId(null);
    setEditingTitle('');
  };

  // 取消编辑
  const cancelEditingTitle = () => {
    setEditingSessionId(null);
    setEditingTitle('');
  };

  // 过滤会话列表
  const filteredSessions = sessions.filter(session =>
    session.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 仅当用户处于"跟读底部"时，把滚动容器滚到底（不碰外层页面）
  const scrollToBottomIfFollowing = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    if (!userFollowsBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  };

  useEffect(() => {
    scrollToBottomIfFollowing();
  }, [messages]);

  useEffect(() => {
    const cleanupTimers: number[] = [];
    const initializeWithImportData = async () => {
      if (importAppliedRef.current) return;
      importAppliedRef.current = true;
      try {
        const cached = localStorage.getItem(pendingImportKey);
        if (!cached) return;
        // Remove immediately to avoid duplicate imports on double-run effects.
        localStorage.removeItem(pendingImportKey);
        const normalized = normalizeImportData(JSON.parse(cached) as ImportData);
        if (getImportCount(normalized) > 0) {
          setImportData((prev) => mergeImportData(prev, normalized));
          const newSession = await createNewSession();
          if (!newSession) {
            console.warn('自动创建会话失败，对话可能不会被保存');
          }
        }
        if ((normalized.bazi?.length ?? 0) > 0) {
          setShowBaziImportedNotice(true);
          const timer = window.setTimeout(() => {
            setShowBaziImportedNotice(false);
          }, 4000);
          cleanupTimers.push(timer);
        }
        if ((normalized.liuyao?.length ?? 0) > 0) {
          setShowLiuyaoImportedNotice(true);
          const timer = window.setTimeout(() => {
            setShowLiuyaoImportedNotice(false);
          }, 4000);
          cleanupTimers.push(timer);
        }
      } catch (error) {
        console.warn('读取导入缓存失败:', error);
      }
    };

    initializeWithImportData();
    return () => {
      cleanupTimers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [pendingImportKey]);

  // 初始化时加载会话列表
  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    if (prefillAppliedRef.current) return;
    try {
      const preset = localStorage.getItem(inputPresetKey);
      if (!preset) return;
      if (!input.trim()) {
        setInput(preset);
      }
    } catch (error) {
      console.warn('读取输入预填失败:', error);
    } finally {
      prefillAppliedRef.current = true;
      localStorage.removeItem(inputPresetKey);
    }
  }, [input, inputPresetKey]);

  const handleScrollContainerScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= SCROLL_BOTTOM_THRESHOLD;
    userFollowsBottomRef.current = atBottom;
  };

  // 自动调整文本框高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  // 发送消息
  const handleSend = async () => {
    const content = input.trim();
    if (!content || isLoading || sendingRef.current) return;
    const now = Date.now();
    if (lastSendRef.current.content === content && now - lastSendRef.current.at < 800) {
      return;
    }
    sendingRef.current = true;
    lastSendRef.current = { content, at: now };

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login?next=/');
        return;
      }

      const userMessage: Message = {
        id: nextId(),
        role: 'user',
        content,
        timestamp: new Date(),
      };

      // 如果没有当前会话，创建新会话
      let sessionId = currentSessionId;
      if (!sessionId) {
        const newSession = await createNewSession();
        if (newSession) {
          sessionId = newSession.id;
        } else {
          console.error('创建新会话失败，对话将不会被保存到历史记录');
          console.error('可能的原因：未登录、网络错误或数据库问题');
          // 继续对话，但不会保存到历史记录
        }
      }

      setMessages(prev => [...prev, userMessage]);
      setInput('');
      setIsLoading(true);
      userFollowsBottomRef.current = true;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content,
          })),
          useReasoning: mindMode === 'deep',
          useMeditation: mindMode === 'meditation',
          useSearch,
          importData: getImportCount(importData) > 0 ? importData : undefined,
        }),
      });

      if (!response.ok) {
        if (response.status === 402) {
          const data = await response.json().catch(() => ({}));
          const need = (data?.need_coins ?? 5) as number;
          setIsLoading(false);
          setInsuffNeed(need);
          setInsuffOpen(true);
          window.dispatchEvent(new CustomEvent('coins-should-refresh'));
          return;
        }
        const data = await response.json().catch(() => ({}));
        const serverMessage =
          (data?.details as string | undefined) ||
          (data?.error as string | undefined) ||
          `请求失败（${response.status}）`;
        throw new Error(serverMessage);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('无法读取响应');

      let assistantMessage: Message = {
        id: nextId(),
        role: 'assistant',
        content: '',
        isReasoning: mindMode !== 'none',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        assistantMessage.content += chunk;

        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1] = { ...assistantMessage };
          return newMessages;
        });
      }

      // 保存消息到数据库
      if (sessionId) {
        try {
          await saveMessagesToSession(sessionId, [userMessage, assistantMessage]);
          
          // 如果是第一条消息,自动生成会话标题
          const currentSession = sessions.find(s => s.id === sessionId);
          if (currentSession?.title === '新对话' && userMessage.content) {
            const titleText = userMessage.content.slice(0, 20) + (userMessage.content.length > 20 ? '...' : '');
            await updateSessionTitle(sessionId, titleText);
          }
          
          // 更新会话列表的 updated_at
          await loadSessions();
        } catch (saveError) {
          console.error('保存对话失败，但对话将继续:', saveError);
          // 不阻断用户体验，但记录错误
        }
      } else {
        console.warn('没有会话ID，对话未保存到历史记录');
      }
      window.dispatchEvent(new CustomEvent('coins-should-refresh'));
    } catch (error) {
      console.error('发送消息失败:', error);
      const errorMessage: Message = {
        id: nextId(),
        role: 'assistant',
        content: `抱歉，对话出现了问题：${error instanceof Error ? error.message : '未知错误'}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      sendingRef.current = false;
    }
  };

  const isDeep = mindMode === 'deep';
  const isMeditation = mindMode === 'meditation';

  return (
    <>
      {/* 桌面端遮罩层 */}
      {showDesktopSidebar && (
        <div 
          className="hidden md:block fixed inset-0 z-20"
          onClick={() => setShowDesktopSidebar(false)}
        />
      )}

      {/* 桌面端侧边栏 - 无边框漂浮设计 */}
      {showDesktopSidebar && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="hidden md:flex fixed left-[max(15.0rem,calc(50vw-46.5rem))] top-32 bottom-6 w-[300px] flex-col bg-[#fbf9f4] z-30"
        >
          {/* 侧边栏内容容器 */}
          <div className="flex flex-col h-full">
            {/* 侧边栏头部 */}
            <div className="flex-shrink-0 px-5 pt-6 pb-4">
              {/* 新建对话按钮 */}
              <button
                onClick={createNewSession}
                className="w-full px-4 py-2.5 bg-stone-900 text-white text-[13px] rounded-lg hover:bg-stone-800 transition-colors flex items-center justify-center gap-2 font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                新建对话
              </button>
            </div>

            {/* 搜索框 */}
            <div className="px-5 pb-3">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索对话..."
                  className="w-full pl-9 pr-3 py-2 text-[13px] bg-stone-100/50 border-0 rounded-lg focus:outline-none focus:bg-stone-100 transition-colors placeholder:text-stone-400"
                />
                <svg 
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400"
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {/* 会话列表 */}
            <div className="flex-1 overflow-y-auto px-3 custom-scrollbar">
              {isLoadingSessions ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-900 rounded-full animate-spin"></div>
                </div>
              ) : filteredSessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 px-6">
                  <div className="text-[13px] text-stone-400 text-center">
                    {searchQuery ? '无匹配结果' : '暂无对话'}
                  </div>
                </div>
              ) : (
                <div className="space-y-1 pb-3">
                  {filteredSessions.map((session) => (
                    <div
                      key={session.id}
                      onClick={() => {
                        switchSession(session.id);
                        setShowDesktopSidebar(false);
                      }}
                      className={`
                        group relative px-3 py-2.5 rounded-lg cursor-pointer transition-colors duration-150
                        ${currentSessionId === session.id
                          ? 'bg-stone-200/60'
                          : 'hover:bg-stone-100/50'
                        }
                      `}
                    >
                      {editingSessionId === session.id ? (
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onBlur={() => saveEditingTitle(session.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              saveEditingTitle(session.id);
                            } else if (e.key === 'Escape') {
                              cancelEditingTitle();
                            }
                          }}
                          autoFocus
                          className="w-full px-2 py-1.5 text-[13px] text-stone-900 bg-white border border-stone-300 rounded focus:outline-none focus:border-stone-900"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <>
                          <div className="text-[13px] text-stone-900 truncate pr-14 leading-snug font-medium">
                            {session.title}
                          </div>
                          <div className="text-[11px] text-stone-400 mt-1">
                            {new Date(session.updated_at).toLocaleDateString('zh-CN', {
                              month: 'numeric',
                              day: 'numeric',
                            })}
                          </div>
                        </>
                      )}
                      
                      {/* 操作按钮 */}
                      {editingSessionId !== session.id && (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditingTitle(session.id, session.title);
                            }}
                            className="p-1.5 rounded hover:bg-stone-200 transition-colors text-stone-500"
                            title="编辑"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm('确定要删除这个对话吗？')) {
                                deleteSession(session.id);
                              }
                            }}
                            className="p-1.5 rounded hover:bg-red-50 transition-colors text-stone-500 hover:text-red-600"
                            title="删除"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 底部统计信息 */}
            {sessions.length > 0 && (
              <div className="flex-shrink-0 px-5 py-3 border-t border-stone-200/50">
                <div className="text-[11px] text-stone-400">
                  {filteredSessions.length} 个对话
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* 移动端历史抽屉 */}
      <AnimatePresence>
        {showSessionList && (
          <>
            {/* 遮罩层 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSessionList(false)}
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 md:hidden"
            />
            
            {/* 移动端侧边栏 */}
            <motion.div
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed left-0 top-0 h-full w-80 bg-[#fbf9f4] border-r border-stone-200 shadow-2xl z-50 flex flex-col md:hidden"
            >
              {/* 移动端头部 */}
              <div className="px-4 pt-6 pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-sans text-stone-500 tracking-[0.2em] uppercase">
                    History
                  </h3>
                  <button
                    onClick={() => setShowSessionList(false)}
                    className="p-1.5 rounded text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <button
                  onClick={async () => {
                    await createNewSession();
                    setShowSessionList(false);
                  }}
                  className="w-full px-3 py-2.5 bg-stone-800 text-white text-xs rounded-lg hover:bg-stone-900 transition-colors flex items-center justify-center gap-2 tracking-wide"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  新建对话
                </button>
              </div>

              {/* 移动端搜索框 */}
              <div className="px-4 pb-3">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="搜索..."
                    className="w-full pl-8 pr-3 py-2 text-xs bg-stone-50 border-0 rounded-lg focus:outline-none focus:bg-white focus:ring-1 focus:ring-stone-300 transition-all placeholder:text-stone-400"
                  />
                  <svg 
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400"
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>

              {/* 移动端会话列表 */}
              <div className="flex-1 overflow-y-auto px-2 custom-scrollbar">
                {isLoadingSessions ? (
                  <div className="text-center py-12 text-stone-400 text-xs">
                    加载中...
                  </div>
                ) : filteredSessions.length === 0 ? (
                  <div className="text-center py-12 text-stone-400 text-xs">
                    {searchQuery ? '未找到匹配的对话' : '暂无对话记录'}
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {filteredSessions.map((session) => (
                      <div
                        key={session.id}
                        onClick={() => {
                          switchSession(session.id);
                          setShowSessionList(false);
                        }}
                        className={`
                          group relative px-3 py-2.5 rounded-lg cursor-pointer transition-all
                          ${currentSessionId === session.id
                            ? 'bg-stone-100'
                            : 'hover:bg-stone-50'
                          }
                        `}
                      >
                        <div className="text-xs text-stone-700 truncate pr-8 leading-relaxed">
                          {session.title}
                        </div>
                        <div className="text-[10px] text-stone-400 mt-1">
                          {new Date(session.updated_at).toLocaleDateString('zh-CN', {
                            month: 'numeric',
                            day: 'numeric',
                          })}
                        </div>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('确定要删除这个对话吗？')) {
                              deleteSession(session.id);
                            }
                          }}
                          className="absolute right-2 top-2 p-1 rounded text-stone-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="w-full flex flex-col relative bg-[#fbf9f4]">
      {/* 背景纹理层 - 宣纸质感 */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.015]" 
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='0.4'/%3E%3C/svg%3E")`,
        }}
      />

      {/* 水墨渐变装饰 */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 2 }}
          className="absolute top-20 right-10 w-[500px] h-[500px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(230,220,205,0.10) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
        />
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 2, delay: 0.3 }}
          className="absolute bottom-20 left-10 w-[400px] h-[400px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(220,210,195,0.08) 0%, transparent 70%)',
            filter: 'blur(50px)',
          }}
        />
      </div>

      {/* 主内容区 */}
      <div className="relative z-10 flex flex-col h-full min-h-0 max-w-4xl mx-auto w-full px-6">
        
        {/* 顶部标题区 - hideHeader 时由 page 统一渲染 logo/标题，此处仅保留工具栏 */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: hideHeader ? 0.3 : 1.2, ease: [0.16, 1, 0.3, 1] }}
          className={hideHeader ? 'pt-2 pb-4 sm:pb-5' : 'pt-16 pb-4 sm:pb-5'}
        >
          {!hideHeader && (
            <div className="max-w-md mx-auto text-center space-y-4 mb-6 sm:mb-8">
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="currentColor" preserveAspectRatio="xMidYMid meet" className="w-8 h-8 mx-auto mb-4 text-[#2c2c2c]">
                  <rect x="0" y="20" width="44" height="20" />
                  <rect x="56" y="20" width="44" height="20" />
                  <rect x="0" y="60" width="44" height="20" />
                  <rect x="56" y="60" width="44" height="20" />
                </svg>
              </motion.div>
              <h1 className="text-3xl font-serif text-[#333333] leading-tight">
                决行藏
              </h1>
              <p className="text-sm text-stone-600 font-sans text-center">
                用之则行，舍之则藏
              </p>
            </div>
          )}

          {/* 移动端顶部工具栏 */}
          <div className="md:hidden flex items-center justify-between mb-4 px-4">
            <button
              onClick={() => setShowSessionList(true)}
              className="flex items-center gap-2 px-2 py-1.5 text-stone-500 hover:text-stone-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16" />
              </svg>
              <span className="text-xs">对话</span>
            </button>

            {currentSessionId && (
              <div className="text-xs text-stone-500 truncate max-w-[200px]">
                {sessions.find(s => s.id === currentSessionId)?.title || '新对话'}
              </div>
            )}
          </div>

          {/* 桌面端顶部工具栏 */}
          <div className="hidden md:flex items-center justify-between mb-4 px-4">
            <button
              onClick={() => setShowDesktopSidebar(!showDesktopSidebar)}
              className="flex items-center gap-2 px-2 py-1.5 text-stone-500 hover:text-stone-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16" />
              </svg>
              <span className="text-xs">对话</span>
            </button>

            {currentSessionId && (
              <div className="text-xs text-stone-500 truncate max-w-[200px]">
                {sessions.find(s => s.id === currentSessionId)?.title || '新对话'}
              </div>
            )}
          </div>

          {/* 按钮组 */}
          <div className="flex items-center justify-center gap-4 sm:gap-5 mb-4 sm:mb-5">
            {/* 入定模式提示 */}
            <AnimatePresence>
              {showMeditationWarning && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute top-20 left-1/2 -translate-x-1/2 z-50"
                >
                  <div className="relative px-6 py-3.5 rounded-xl bg-white/95 backdrop-blur-md border border-stone-200 shadow-lg shadow-stone-900/10">
                    {/* 装饰角 */}
                    <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t border-l border-stone-300 rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t border-r border-stone-300 rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b border-l border-stone-300 rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b border-r border-stone-300 rounded-br-lg" />
                    
                    <div className="flex items-center gap-3">
                      {/* 呼吸动画的圆点 */}
                      <motion.div
                        animate={{ 
                          scale: [1, 1.2, 1],
                          opacity: [0.5, 0.8, 0.5]
                        }}
                        transition={{ 
                          duration: 2, 
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                        className="w-1.5 h-1.5 rounded-full bg-amber-500"
                      />
                      
                      <span className="text-[13px] text-stone-700 tracking-[0.15em] font-light">
                        入定模式不可以使用深思功能哦
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 深思按钮 */}
            <button
              onClick={() => {
                if (isMeditation) {
                  setShowMeditationWarning(true);
                  setTimeout(() => setShowMeditationWarning(false), 3000);
                  return;
                }
                setMindMode(isDeep ? 'none' : 'deep');
              }}
              className="group relative"
            >
              <div className={`
                flex items-center gap-2.5 px-6 py-2 rounded-full
                transition-all duration-700 ease-out
                ${isDeep 
                  ? 'bg-[#2c2c2c] text-white shadow-md shadow-stone-900/10' 
                  : 'bg-[#f5f2ed] text-stone-700 hover:bg-[#ebe7e0] hover:shadow-sm'
                }
              `}>
                <div className={`
                  w-1.5 h-1.5 rounded-full transition-colors duration-700
                  ${isDeep ? 'bg-white' : 'bg-stone-500'}
                `} />
                <span className="text-[11px] tracking-[0.2em] font-light">
                  深思
                </span>
                <span className={`flex items-center gap-0.5 ml-1 ${
                  isDeep ? 'text-white/70' : 'text-amber-700/75'
                }`}>
                  <CopperCoinIcon className={`w-2.5 h-2.5 ${
                    isDeep ? 'text-white/70' : 'text-amber-700/75'
                  }`} />
                  <span className="text-[9px] tracking-wider font-light">2</span>
                </span>
              </div>
            </button>

            {/* 联网按钮 */}
            <button
              onClick={() => setUseSearch((v) => !v)}
              className="group relative"
            >
              <div className={`
                flex items-center gap-2.5 px-6 py-2 rounded-full
                transition-all duration-700 ease-out
                ${useSearch 
                  ? 'bg-[#2c2c2c] text-white shadow-md shadow-stone-900/10' 
                  : 'bg-[#f5f2ed] text-stone-700 hover:bg-[#ebe7e0] hover:shadow-sm'
                }
              `}>
                <div className={`
                  w-1.5 h-1.5 rounded-full transition-colors duration-700
                  ${useSearch ? 'bg-white' : 'bg-stone-500'}
                `} />
                <span className="text-[11px] tracking-[0.2em] font-light">
                  联网
                </span>
                <span className={`flex items-center gap-0.5 ml-1 ${
                  useSearch ? 'text-white/70' : 'text-amber-700/75'
                }`}>
                  <CopperCoinIcon className={`w-2.5 h-2.5 ${
                    useSearch ? 'text-white/70' : 'text-amber-700/75'
                  }`} />
                  <span className="text-[9px] tracking-wider font-light">2</span>
                </span>
              </div>
            </button>
          </div>

          {/* 分隔线 */}
          <div className="w-full h-px bg-gradient-to-r from-transparent via-stone-200 to-transparent" />

          {/* 底部提示区域 */}
          <div className="mt-4 sm:mt-5 flex flex-col items-center gap-2">
            <span className="text-[10px] sm:text-[10.5px] text-stone-500 tracking-[0.18em] font-light">
              每问基础消耗 <span className="text-amber-700/80 font-normal">2</span> 铜币
            </span>
            
            {/* 入定提示 */}
            {!isMeditation && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.8 }}
                className="flex items-center gap-1.5"
              >
                <span className="text-[9px] text-stone-400 tracking-[0.15em] font-light">
                  点击中心圆球可开启
                </span>
                <span className="flex items-center gap-1 text-[9px] text-amber-700/70 tracking-[0.15em] font-light">
                  入定模式
                  <CopperCoinIcon className="w-2.5 h-2.5 text-amber-700/70" />
                  <span>20</span>
                </span>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* 消息区域 */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScrollContainerScroll}
          className="py-10 space-y-10"
        >
          <AnimatePresence mode="popLayout">
            {messages.length === 0 ? (
              // 空状态 - 禅意插画
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col items-center justify-center h-full min-h-[400px]"
              >
                {/* 禅意图形 - 三个同心圆（可点击进入入定模式）*/}
                <button
                  onClick={() => setMindMode(isMeditation ? 'none' : 'meditation')}
                  className="relative w-32 h-32 mb-12 group cursor-pointer"
                >
                  {/* 外圆 */}
                  <motion.div
                    animate={{ 
                      scale: [1, 1.08, 1],
                      opacity: isMeditation ? [0.3, 0.5, 0.3] : [0.15, 0.3, 0.15]
                    }}
                    transition={{ 
                      duration: 5, 
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                    className={`absolute inset-0 rounded-full border transition-colors duration-700 ${
                      isMeditation ? 'border-amber-400/60' : 'border-stone-300 group-hover:border-stone-400'
                    }`}
                  />
                  
                  {/* 中圆 */}
                  <motion.div
                    animate={{ 
                      scale: [1, 1.05, 1],
                      opacity: isMeditation ? [0.35, 0.55, 0.35] : [0.2, 0.35, 0.2]
                    }}
                    transition={{ 
                      duration: 4, 
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: 0.5
                    }}
                    className={`absolute inset-4 rounded-full border transition-colors duration-700 ${
                      isMeditation ? 'border-amber-400/70' : 'border-stone-300 group-hover:border-stone-400'
                    }`}
                  />

                  {/* 内圆 */}
                  <motion.div
                    animate={{ 
                      scale: [1, 1.03, 1],
                      opacity: isMeditation ? [0.4, 0.65, 0.4] : [0.25, 0.45, 0.25]
                    }}
                    transition={{ 
                      duration: 3.5, 
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: 1
                    }}
                    className={`absolute inset-8 rounded-full border transition-colors duration-700 ${
                      isMeditation ? 'border-amber-500/80' : 'border-stone-400 group-hover:border-stone-500'
                    }`}
                  />

                  {/* 中心点 */}
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ 
                      scale: 1,
                      boxShadow: isMeditation 
                        ? ['0 0 0px rgba(251, 191, 36, 0)', '0 0 20px rgba(251, 191, 36, 0.4)', '0 0 0px rgba(251, 191, 36, 0)']
                        : '0 0 0px transparent'
                    }}
                    transition={{ 
                      scale: { delay: 0.5, duration: 1.2, ease: [0.16, 1, 0.3, 1] },
                      boxShadow: { duration: 3, repeat: Infinity, ease: "easeInOut" }
                    }}
                    className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 
                      w-3 h-3 rounded-full transition-all duration-700 ${
                        isMeditation 
                          ? 'bg-amber-500 scale-110' 
                          : 'bg-stone-400 group-hover:bg-stone-500 group-hover:scale-110'
                      }`}
                  />

                  {/* 水墨晕染 */}
                  <motion.div
                    animate={{ 
                      scale: [1, 1.8, 1],
                      opacity: isMeditation ? [0, 0.15, 0] : [0, 0.08, 0]
                    }}
                    transition={{ 
                      duration: 4.5, 
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                    className={`absolute inset-0 rounded-full blur-2xl transition-colors duration-700 ${
                      isMeditation ? 'bg-amber-300' : 'bg-stone-300'
                    }`}
                  />

                  {/* Hover 提示 */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    whileHover={{ opacity: 1 }}
                    className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap"
                  >
                    <span className="text-[10px] text-stone-400 tracking-[0.2em] font-light">
                      {isMeditation ? '退出入定' : '点击入定'}
                    </span>
                  </motion.div>
                </button>

                {/* 标题文字 */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6, duration: 1, ease: [0.16, 1, 0.3, 1] }}
                  className="text-center space-y-5"
                >
                  <h2 className="text-[16px] text-[#333333] tracking-[0.4em] font-light">
                    {isMeditation ? '入定问心' : '怀虚待问'}
                  </h2>
                  
                  <p className="text-[12px] text-stone-500 tracking-[0.15em] 
                    font-light leading-loose max-w-sm">
                    {isMeditation ? (
                      <>
                        深入禅定，觉察本心<br/>
                        <span className="flex items-center justify-center gap-1 text-[10px] text-amber-700/80">
                          入定模式
                          <CopperCoinIcon className="w-3 h-3 text-amber-700/80" />
                          <span>20</span>
                        </span>
                      </>
                    ) : (
                      <>
                        心有所惑，不妨问之<br/>
                        因果澄明，未来自现
                      </>
                    )}
                  </p>
                </motion.div>

                {/* 装饰线 */}
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 1, duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
                  className="mt-12 w-24 h-px bg-gradient-to-r from-transparent via-stone-300 to-transparent"
                />
              </motion.div>
            ) : (
              // 消息列表
              messages.map((message, index) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ 
                    duration: 0.8, 
                    ease: [0.16, 1, 0.3, 1],
                    delay: index * 0.05
                  }}
                  className="flex flex-col"
                >
                  {/* 消息角色标识 */}
                  <div className={`
                    mb-3 flex items-center gap-3
                    ${message.role === 'user' ? 'justify-end' : 'justify-start'}
                  `}>
                    <div className="flex items-center gap-2">
                      {/* 角色标记点 */}
                      <div className={`
                        w-1.5 h-1.5 rounded-full
                        ${message.role === 'user' ? 'bg-stone-500' : 'bg-stone-500'}
                      `} />
                      <span className="text-[10px] tracking-[0.3em] text-stone-500 font-light">
                        {message.role === 'user' ? '问' : '答'}
                      </span>
                    </div>
                    
                    {/* 时间 */}
                    <span className="text-[9px] text-stone-400 tracking-wider font-light">
                      {message.timestamp.toLocaleTimeString('zh-CN', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </span>
                  </div>

                  {/* 消息内容卡片 */}
                  <div className={`
                    ${message.role === 'user' ? 'ml-12' : 'mr-12'}
                  `}>
                    <div
                      className={`
                        relative px-8 py-6 rounded-2xl
                        ${message.role === 'user'
                          ? 'bg-white/70 border border-stone-200'
                          : 'bg-white/90 border border-stone-200'
                        }
                        backdrop-blur-sm shadow-sm shadow-stone-200/30
                      `}
                    >
                      {/* 深思模式标记 */}
                      {message.isReasoning && message.role === 'assistant' && (
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex items-center gap-2 mb-4 pb-4 border-b border-stone-200"
                        >
                          <div className="w-1 h-1 rounded-full bg-stone-400" />
                          <span className="text-[9px] text-stone-500 tracking-[0.25em] font-light">
                            深度推演
                          </span>
                        </motion.div>
                      )}
                      
                      {/* 消息文本 */}
                      <p className="text-[14px] leading-loose text-[#333333] 
                        whitespace-pre-wrap font-light tracking-wide">
                        {renderMessageContent(message.content)}
                      </p>

                      {/* 装饰角 - 无印良品风格 */}
                      <div className={`
                        absolute top-0 w-3 h-3 border-stone-300
                        ${message.role === 'user' 
                          ? 'right-0 border-t border-r rounded-tr-lg' 
                          : 'left-0 border-t border-l rounded-tl-lg'
                        }
                      `} />
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
          
          {/* 加载状态：仅思考模式且助理尚未开始输出时显示；一旦有内容则仅在上方流式展示 */}
          {(() => {
            const last = messages[messages.length - 1];
            const assistantAlreadyStreaming = last?.role === 'assistant' && (last?.content?.length ?? 0) > 0;
            return isLoading && mindMode !== 'none' && !assistantAlreadyStreaming;
          })() && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col"
            >
              <div className="mb-3 flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-stone-500" />
                  <span className="text-[10px] tracking-[0.3em] text-stone-500 font-light">
                    答
                  </span>
                </div>
              </div>

              <div className="mr-12">
                <div className="px-8 py-6 rounded-2xl bg-white/90 border border-stone-200 
                  backdrop-blur-sm shadow-sm shadow-stone-200/30">
                  <div className="flex items-center gap-3">
                    {/* 禅意加载动画 - 三个点 */}
                    <div className="flex gap-1.5">
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          animate={{ 
                            scale: [1, 1.3, 1],
                            opacity: [0.3, 0.7, 0.3]
                          }}
                          transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            delay: i * 0.2,
                            ease: "easeInOut"
                          }}
                          className="w-1.5 h-1.5 rounded-full bg-stone-400"
                        />
                      ))}
                    </div>
                    <span className="text-[13px] text-stone-500 tracking-[0.15em] font-light">
                      思忖中
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* 输入区域 - 极简设计；移动端加大底部留白，避免被底部导航挡住 */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="pt-6 border-t border-stone-200 juexingcang-input-bottom md:!pb-8"
        >
          <AnimatePresence>
            {showBaziImportedNotice && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className="mb-3"
              >
                <div className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-emerald-200/70 bg-emerald-50/60">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[11px] tracking-[0.2em] text-emerald-700 font-light">
                    已导入该八字
                  </span>
                </div>
              </motion.div>
            )}
            {showLiuyaoImportedNotice && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className="mb-3"
              >
                <div className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-emerald-200/70 bg-emerald-50/60">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[11px] tracking-[0.2em] text-emerald-700 font-light">
                    已将六爻数据导入
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {/* 导入数据区域 - 低调简洁 */}
          <AnimatePresence mode="wait">
            {getImportCount(importData) > 0 ? (
              <motion.div
                key="imported"
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="mb-3"
              >
                <div className="flex items-center justify-between py-2 px-1">
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1 h-1 rounded-full bg-stone-400" />
                      <span className="text-[10px] tracking-[0.15em] text-stone-600 font-light">
                        {importData.bazi?.length ? `八字×${importData.bazi.length}` : ''}
                        {importData.bazi?.length && importData.mbti?.length ? '　' : ''}
                        {importData.mbti?.length ? `八维×${importData.mbti.length}` : ''}
                        {(importData.bazi?.length || importData.mbti?.length) && importData.liuyao?.length ? '　' : ''}
                        {importData.liuyao?.length ? `六爻×${importData.liuyao.length}` : ''}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowImportModal(true)}
                      className="text-[10px] text-stone-500 hover:text-stone-700 font-light tracking-wider 
                        transition-colors duration-300"
                    >
                      更改
                    </button>
                    <div className="w-px h-2.5 bg-stone-300" />
                    <button
                      onClick={() => setImportData({})}
                      className="text-[10px] text-stone-500 hover:text-stone-700 font-light tracking-wider 
                        transition-colors duration-300"
                    >
                      清空
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="mb-3"
              >
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="group"
                  >
                    <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg
                      border border-stone-200 bg-white/50
                      hover:border-stone-400 hover:bg-stone-50
                      active:border-stone-500 active:bg-stone-100
                      transition-all duration-300">
                      <div className="flex gap-1">
                        <motion.div
                          animate={{ opacity: [0.4, 0.8, 0.4] }}
                          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                          className="w-1 h-1 rounded-full bg-stone-500"
                        />
                        <motion.div
                          animate={{ opacity: [0.4, 0.8, 0.4] }}
                          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
                          className="w-1 h-1 rounded-full bg-stone-500"
                        />
                        <motion.div
                          animate={{ opacity: [0.4, 0.8, 0.4] }}
                          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
                          className="w-1 h-1 rounded-full bg-stone-500"
                        />
                      </div>
                      <span className="text-[11px] text-stone-600 font-light tracking-[0.15em]
                        group-hover:text-stone-800 group-active:text-stone-900
                        transition-colors duration-300">
                        导入测算数据
                      </span>
                    </div>
                  </button>
                  <span className="text-[10px] text-stone-400 font-light tracking-wider px-1">
                    八字·八维·六爻
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          <div className="relative">
            {/* 输入框容器 */}
            <div className="relative bg-white/80 backdrop-blur-md rounded-2xl 
              border border-stone-200 overflow-hidden
              transition-all duration-500 ease-out
              hover:border-stone-300 hover:shadow-lg hover:shadow-stone-200/20
              focus-within:border-stone-400 focus-within:shadow-xl focus-within:shadow-stone-200/25">
              
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="请输入问题..."
                className="w-full px-7 py-5 pr-16 bg-transparent border-none outline-none 
                  resize-none text-[14px] text-[#333333] placeholder-stone-400 
                  font-light tracking-wide leading-loose max-h-40"
                rows={1}
                disabled={isLoading}
              />
              
              {/* 发送按钮 */}
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className={`
                  absolute right-4 bottom-4 w-9 h-9 rounded-full
                  flex items-center justify-center
                  transition-all duration-500 ease-out
                  ${input.trim() && !isLoading
                    ? 'bg-[#2c2c2c] text-white hover:bg-[#1a1a1a] hover:scale-110 active:scale-95'
                    : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                  }
                `}
              >
                {/* 简化的发送图标 */}
                <svg 
                  width="14" 
                  height="14" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  className="translate-x-[1px]"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </div>

            {/* 提示文字 */}
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-4">
              <span className="text-[10px] text-stone-400 tracking-[0.2em] font-light">
                回车发送
              </span>
              <div className="w-px h-2 bg-stone-300 hidden sm:block" />
              <span className="text-[10px] text-stone-400 tracking-[0.2em] font-light">
                Shift + 回车换行
              </span>
            </div>
          </div>
        </motion.div>
      </div>
      <InsufficientCoinsModal
        open={insuffOpen}
        needCoins={insuffNeed}
        onClose={() => setInsuffOpen(false)}
      />
      
      {/* 导入数据模态框 */}
      <ImportModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={(data) => {
          setImportData(data);
          setShowImportModal(false);
        }}
        currentImportData={importData}
      />
    </div>
    </>
  );
};

const parseNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const parseDateParts = (dateValue: unknown): { year: number; month: number; day: number } | null => {
  if (typeof dateValue !== 'string') return null;
  const match = dateValue.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return { year, month, day };
};

const getDateCandidate = (params: Record<string, unknown>) => {
  const candidates = [
    params.birthDate,
    params.birthdate,
    params.birthday,
    params.birth,
    params.birth_date,
    params.solarDate,
    params.solar_date,
    params.solarDateString,
    params.solar_date_string,
    params.lunarDate,
    params.lunar_date,
    params.lunarDateString,
    params.lunar_date_string,
    params.date,
    params.dateStr,
    params.dateString,
    params.dateText,
    params.datetime,
    params.birth_time,
    params.birthTime,
    params.time,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate;
    }
  }
  return undefined;
};

const getBirthDateString = (params: Record<string, unknown>): string | undefined => {
  const year = parseNumber(params.year) ?? parseNumber(params.birthYear) ?? parseNumber(params.solarYear);
  const month = parseNumber(params.month) ?? parseNumber(params.birthMonth) ?? parseNumber(params.solarMonth);
  const day = parseNumber(params.day) ?? parseNumber(params.birthDay) ?? parseNumber(params.solarDay);
  if (year && month && day) return `${year}/${month}/${day}`;
  const candidate = getDateCandidate(params);
  if (candidate) {
    const parsed = parseDateParts(candidate);
    if (parsed) return `${parsed.year}/${parsed.month}/${parsed.day}`;
    return undefined;
  }
  return undefined;
};

const getBaziText = (params: Record<string, unknown>): string | undefined => {
  const gans = String(params.gans ?? '').split(',').map(s => s.trim()).filter(Boolean);
  const zhis = String(params.zhis ?? '').split(',').map(s => s.trim()).filter(Boolean);
  if (gans.length === 4 && zhis.length === 4) {
    return `${gans.join('')}${zhis.join('')}`;
  }
  return undefined;
};

const buildBaziInputFromParams = (params: Record<string, unknown>): BaziInput | null => {
  const mode = typeof params.mode === 'string' ? params.mode : undefined;
  const hasDirectBazi = mode === 'bazi' || (params.gans && params.zhis);

  if (hasDirectBazi) {
    const gans = String(params.gans ?? '').split(',').map(s => s.trim()).filter(Boolean);
    const zhis = String(params.zhis ?? '').split(',').map(s => s.trim()).filter(Boolean);
    if (gans.length === 4 && zhis.length === 4) {
      return {
        year: 2000,
        month: 1,
        day: 1,
        hour: 0,
        minute: 0,
        directBazi: { gans, zhis },
      };
    }
    return null;
  }

  const parsedDate = parseDateParts(getDateCandidate(params));
  const year = parseNumber(params.year) ?? parseNumber(params.birthYear) ?? parseNumber(params.solarYear) ?? parsedDate?.year;
  const month = parseNumber(params.month) ?? parseNumber(params.birthMonth) ?? parseNumber(params.solarMonth) ?? parsedDate?.month;
  const day = parseNumber(params.day) ?? parseNumber(params.birthDay) ?? parseNumber(params.solarDay) ?? parsedDate?.day;
  const hour = parseNumber(params.hour) ?? 12;
  const minute = parseNumber(params.minute) ?? 0;

  if (!year || !month || !day) return null;

  let location: BaziInput['location'] | undefined;
  if (params.province && params.city) {
    const longitude = parseNumber(params.longitude) ?? 116.4;
    location = {
      province: String(params.province),
      city: String(params.city),
      longitude,
    };
  }

  return {
    year,
    month,
    day,
    hour,
    minute,
    location,
  };
};

// 导入模态框组件
interface ImportModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (data: ImportData) => void;
  currentImportData: ImportData;
}

const ImportModal: React.FC<ImportModalProps> = ({ open, onClose, onImport, currentImportData }) => {
  const [loading, setLoading] = useState(false);
  const [baziRecords, setBaziRecords] = useState<any[]>([]);
  const [mbtiRecords, setMbtiRecords] = useState<any[]>([]);
  const [liuyaoRecords, setLiuyaoRecords] = useState<any[]>([]);
  const [selectedBazi, setSelectedBazi] = useState<string[]>([]);
  const [selectedMbti, setSelectedMbti] = useState<string[]>([]);
  const [selectedLiuyao, setSelectedLiuyao] = useState<string[]>([]);

  // 加载记录
  useEffect(() => {
    if (open) {
      loadRecords();
    }
  }, [open]);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const [baziRes, mbtiRes, liuyaoRes] = await Promise.all([
        fetch('/api/records/classical'),
        fetch('/api/records/mbti'),
        fetch('/api/records/liuyao'),
      ]);

      if (baziRes.ok) {
        const data = await baziRes.json();
        setBaziRecords(data);
      }
      if (mbtiRes.ok) {
        const data = await mbtiRes.json();
        setMbtiRecords(data);
      }
      if (liuyaoRes.ok) {
        const data = await liuyaoRes.json();
        setLiuyaoRecords(data);
      }
    } catch (error) {
      console.error('加载记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    const newImportData: ImportData = {};

    // 导入八字数据
    if (selectedBazi.length > 0) {
      const baziImports: ImportData['bazi'] = [];
      for (const id of selectedBazi) {
        const record = baziRecords.find(r => r.id === id);
        if (!record?.params) continue;
        try {
          const { analyzeBazi, generateClassicalBaziData, calculateEnergyProfile } = await import('@/utils/baziLogic');
          const input = buildBaziInputFromParams(record.params);
          if (!input) {
            throw new Error('八字导入参数不完整');
          }
          const result = analyzeBazi(input);
          const classicalData = generateClassicalBaziData(input);
          const energyProfile = calculateEnergyProfile(classicalData);

          const shishenRatio: Record<string, number> = {};
          if (result.ssDistribution) {
            const total = Object.values(result.ssDistribution).reduce((sum: number, val: any) => sum + (typeof val === 'number' ? val : 0), 0);
            if (total > 0) {
              Object.entries(result.ssDistribution).forEach(([key, val]) => {
                if (typeof val === 'number') {
                  shishenRatio[key] = val / total;
                }
              });
            }
          }

          const ganRatio: Record<string, number> = {};
          const gans = [result.pillars.year.gan, result.pillars.month.gan, result.pillars.day.gan, result.pillars.hour.gan];
          gans.forEach(gan => {
            ganRatio[gan] = (ganRatio[gan] || 0) + 0.25;
          });

          const functionScores: Record<string, number> = {};
          
          baziImports.push({
            type: 'bazi',
            pillars: result.pillars,
            strength: result.strength,
            strengthPercent: result.peerEnergyPercent,
            favorable: [result.climateGod, result.trueGod].filter(Boolean),
            unfavorable: [],
            shishenRatio,
            ganRatio,
            relationships: {},
            predictedMBTI: result.mbti,
            energyProfile: functionScores,
            name: record.params.name,
            gender: record.params.gender,
            birthDate: getBirthDateString(record.params),
          });
        } catch (error) {
          console.error('八字数据解析失败:', error);
        }
      }
      if (baziImports.length > 0) {
        newImportData.bazi = baziImports;
      }
    }

    // 导入八维数据
    if (selectedMbti.length > 0) {
      const mbtiImports = selectedMbti
        .map(id => mbtiRecords.find(r => r.id === id))
        .filter(Boolean)
        .map((record: any) => ({
          type: 'mbti' as const,
          mbtiType: record.type,
          functionScores: record.function_scores,
          testDate: record.created_at,
        }));
      if (mbtiImports.length > 0) {
        newImportData.mbti = mbtiImports;
      }
    }

    // 导入六爻数据
    if (selectedLiuyao.length > 0) {
      const liuyaoImports = selectedLiuyao
        .map(id => liuyaoRecords.find(r => r.id === id))
        .filter(Boolean)
        .map((record: any) => ({
          type: 'liuyao' as const,
          question: record.question,
          yaos: record.hexagram_info?.yaos || [],
          mainHexagram: {
            title: record.hexagram_info?.mainHexagram || '',
            description: record.hexagram_info?.mainDescription || record.hexagram_info?.mainHexagram?.description || '',
          },
          transformedHexagram: record.hexagram_info?.transformedHexagram ? {
            title: record.hexagram_info.transformedHexagram,
            description: record.hexagram_info?.transformedDescription || record.hexagram_info?.transformedHexagram?.description || '',
          } : undefined,
          hasMovingLines: record.hexagram_info?.hasMovingLines || false,
          movingLineTexts: record.hexagram_info?.movingLineTexts || [],
          interpretation: record.hexagram_info?.interpretation || undefined,
          aiResult: record.ai_result,
          divineDate: record.date,
        }));
      if (liuyaoImports.length > 0) {
        newImportData.liuyao = liuyaoImports;
      }
    }

    onImport(newImportData);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '未知日期';
    try {
      return new Date(dateStr).toLocaleDateString('zh-CN');
    } catch {
      return dateStr;
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-[#FBF9F4] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 模态框头部 */}
          <div className="bg-gradient-to-b from-stone-100/50 to-transparent px-8 py-6 border-b border-stone-200">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-serif text-stone-800 tracking-wider">
                导入测算数据
              </h3>
              <button
                onClick={onClose}
                className="text-stone-400 hover:text-stone-700 transition-colors"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-stone-500 font-serif mt-3">
              选择您想要导入的测算记录，以便决行藏更好地理解您的情况
            </p>
          </div>

          {/* 模态框内容 */}
          <div className="px-8 py-6 overflow-y-auto max-h-[50vh] space-y-6">
            {loading ? (
              <div className="text-center py-8 text-stone-500">
                <span className="inline-flex items-center gap-2">
                  <span className="animate-pulse">加载中</span>
                  <span className="animate-pulse" style={{ animationDelay: '0.2s' }}>...</span>
                </span>
              </div>
            ) : (
              <>
                {/* 八字记录 */}
                <div>
                  <h4 className="text-sm font-serif text-stone-700 mb-3 flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-stone-500" />
                    八字古典排盘
                  </h4>
                  {baziRecords.length === 0 ? (
                    <p className="text-xs text-stone-400 pl-4">暂无记录</p>
                  ) : (
                    <div className="space-y-2">
                      {baziRecords.map((record) => {
                        const birthDate = getBirthDateString(record.params);
                        const baziText = getBaziText(record.params);
                        const mainText = birthDate && baziText
                          ? `${birthDate} · ${baziText}`
                          : (birthDate || baziText || '未知日期');
                        return (
                        <label
                          key={record.id}
                          className={`
                            flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all
                            ${selectedBazi.includes(record.id) 
                              ? 'bg-stone-200 border border-stone-300' 
                              : 'bg-stone-50 hover:bg-stone-100 border border-transparent'
                            }
                          `}
                        >
                          <input
                            type="checkbox"
                            checked={selectedBazi.includes(record.id)}
                            onChange={(e) => {
                              setSelectedBazi((prev) => (
                                e.target.checked
                                  ? [...prev, record.id]
                                  : prev.filter((id) => id !== record.id)
                              ));
                            }}
                            className="w-4 h-4"
                          />
                          <div className="flex-1 text-sm">
                            <div className="text-stone-700 font-serif">
                              {record.params?.name ? `${record.params.name} · ` : ''}{record.params?.gender || '未知'} · {mainText}
                            </div>
                            <div className="text-xs text-stone-500 mt-1">
                              {birthDate ? formatDate(birthDate) : '未提供出生日期'}
                            </div>
                          </div>
                        </label>
                      );
                      })}
                    </div>
                  )}
                </div>

                {/* 八维测试记录 */}
                <div>
                  <h4 className="text-sm font-serif text-stone-700 mb-3 flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-stone-500" />
                    荣格八维测试
                  </h4>
                  {mbtiRecords.length === 0 ? (
                    <p className="text-xs text-stone-400 pl-4">暂无记录</p>
                  ) : (
                    <div className="space-y-2">
                      {mbtiRecords.map((record) => (
                        <label
                          key={record.id}
                          className={`
                            flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all
                            ${selectedMbti.includes(record.id) 
                              ? 'bg-stone-200 border border-stone-300' 
                              : 'bg-stone-50 hover:bg-stone-100 border border-transparent'
                            }
                          `}
                        >
                          <input
                            type="checkbox"
                            checked={selectedMbti.includes(record.id)}
                            onChange={(e) => {
                              setSelectedMbti((prev) => (
                                e.target.checked
                                  ? [...prev, record.id]
                                  : prev.filter((id) => id !== record.id)
                              ));
                            }}
                            className="w-4 h-4"
                          />
                          <div className="flex-1 text-sm">
                            <div className="text-stone-700 font-serif font-medium">
                              {record.type}
                            </div>
                            <div className="text-xs text-stone-500 mt-1">
                              {formatDate(record.created_at)}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* 六爻记录 */}
                <div>
                  <h4 className="text-sm font-serif text-stone-700 mb-3 flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-stone-500" />
                    六爻占卜
                  </h4>
                  {liuyaoRecords.length === 0 ? (
                    <p className="text-xs text-stone-400 pl-4">暂无记录</p>
                  ) : (
                    <div className="space-y-2">
                      {liuyaoRecords.map((record) => (
                        <label
                          key={record.id}
                          className={`
                            flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all
                            ${selectedLiuyao.includes(record.id) 
                              ? 'bg-stone-200 border border-stone-300' 
                              : 'bg-stone-50 hover:bg-stone-100 border border-transparent'
                            }
                          `}
                        >
                          <input
                            type="checkbox"
                            checked={selectedLiuyao.includes(record.id)}
                            onChange={(e) => {
                              setSelectedLiuyao((prev) => (
                                e.target.checked
                                  ? [...prev, record.id]
                                  : prev.filter((id) => id !== record.id)
                              ));
                            }}
                            className="w-4 h-4"
                          />
                          <div className="flex-1 text-sm">
                            <div className="text-stone-700 font-serif">
                              {record.question?.slice(0, 30) || '未知问题'}
                              {(record.question?.length || 0) > 30 ? '...' : ''}
                            </div>
                            <div className="text-xs text-stone-500 mt-1">
                              {formatDate(record.created_at)}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* 模态框底部 */}
          <div className="bg-gradient-to-t from-stone-100/50 to-transparent px-8 py-6 border-t border-stone-200 flex justify-between items-center gap-4">
            <div className="text-xs text-stone-500">
              已选择: {selectedBazi.length + selectedMbti.length + selectedLiuyao.length} 项
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setSelectedBazi([]);
                  setSelectedMbti([]);
                  setSelectedLiuyao([]);
                  onImport({});
                  onClose();
                }}
                className="px-6 py-2.5 bg-stone-200 text-stone-700 font-sans text-sm rounded-lg hover:bg-stone-300 transition-colors"
              >
                清空导入
              </button>
              <button
                onClick={handleImport}
                disabled={selectedBazi.length === 0 && selectedMbti.length === 0 && selectedLiuyao.length === 0}
                className="px-6 py-2.5 bg-stone-700 text-white font-sans text-sm rounded-lg hover:bg-stone-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                确认导入
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
