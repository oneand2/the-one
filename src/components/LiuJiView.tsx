'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { InsufficientCoinsModal } from './InsufficientCoinsModal';
import { CopperCoinIcon } from './CopperCoinIcon';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isReasoning?: boolean;
  timestamp: Date;
}

export const LiuJiView: React.FC = () => {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mindMode, setMindMode] = useState<'none' | 'deep' | 'meditation'>('none');
  const [useSearch, setUseSearch] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const idRef = useRef(0);
  /** 用户是否在“跟读底部”（在底部附近未主动上滑），仅在为 true 时自动滚到底 */
  const userFollowsBottomRef = useRef(true);
  const [insuffOpen, setInsuffOpen] = useState(false);
  const [insuffNeed, setInsuffNeed] = useState(5);

  const nextId = () => `msg-${Date.now()}-${++idRef.current}`;

  const SCROLL_BOTTOM_THRESHOLD = 80;

  // 仅当用户处于“跟读底部”时，把滚动容器滚到底（不碰外层页面）
  const scrollToBottomIfFollowing = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    if (!userFollowsBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  };

  useEffect(() => {
    scrollToBottomIfFollowing();
  }, [messages]);

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
    if (!input.trim() || isLoading) return;

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push('/login?next=/');
      return;
    }

    const userMessage: Message = {
      id: nextId(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    userFollowsBottomRef.current = true;

    try {
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
        throw new Error('对话失败');
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
      window.dispatchEvent(new CustomEvent('coins-should-refresh'));
    } catch (error) {
      console.error('发送消息失败:', error);
      const errorMessage: Message = {
        id: nextId(),
        role: 'assistant',
        content: '抱歉，对话出现了问题，请稍后再试。',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const isDeep = mindMode === 'deep';
  const isMeditation = mindMode === 'meditation';

  return (
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
        
        {/* 顶部标题区 - 书法风格 */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="pt-8 sm:pt-10 pb-4 sm:pb-5"
        >
          {/* 按钮组 */}
          <div className="flex items-center justify-center gap-4 sm:gap-5 mb-4 sm:mb-5">
            {/* 深思按钮 */}
            <button
              onClick={() => setMindMode(isDeep ? 'none' : 'deep')}
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
                  <span className="text-[9px] tracking-wider font-light">3</span>
                </span>
              </div>
            </button>
          </div>

          {/* 分隔线 */}
          <div className="w-full h-px bg-gradient-to-r from-transparent via-stone-200 to-transparent" />

          {/* 底部提示区域 */}
          <div className="mt-4 sm:mt-5 flex flex-col items-center gap-2">
            <span className="text-[10px] sm:text-[10.5px] text-stone-500 tracking-[0.18em] font-light">
              每问基础消耗 <span className="text-amber-700/80 font-normal">5</span> 铜币
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
                  <span>50</span>
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
                          <span>50</span>
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
                        {message.content}
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
          className="pt-6 border-t border-stone-200 liuji-input-bottom md:!pb-8"
        >
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
    </div>
  );
};
