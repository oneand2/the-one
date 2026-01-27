'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Hand } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { tossOnce, getYaoInfo, type YaoInfo, type YaoValue } from '@/utils/liuyaoLogic';
import { CoinAnimation } from './CoinAnimation';
import { analyzeHexagram, getYaoPositionName, type HexagramAnalysis } from '@/utils/iching-logic';
import { createClient } from '@/utils/supabase/client';
import { InsufficientCoinsModal } from './InsufficientCoinsModal';

export const LiuYaoView: React.FC = () => {
  const router = useRouter();
  const [question, setQuestion] = useState<string>('');
  const [isQuestionSet, setIsQuestionSet] = useState<boolean>(false);
  const [yaos, setYaos] = useState<YaoInfo[]>([]);
  const [isTossing, setIsTossing] = useState(false);
  const [currentTossResult, setCurrentTossResult] = useState<YaoValue | null>(null);
  const [showCoinAnimation, setShowCoinAnimation] = useState(false);
  const [hexagramAnalysis, setHexagramAnalysis] = useState<HexagramAnalysis | null>(null);
  
  // AI 解卦相关状态
  const [isLoading, setIsLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const modalContentRef = useRef<HTMLDivElement>(null);
  const [insuffOpen, setInsuffOpen] = useState(false);
  const [insuffNeed, setInsuffNeed] = useState(6);

  // 从数值反推硬币组合
  const getCoinsFromValue = (value: YaoValue): number[] => {
    switch (value) {
      case 6: // 老阴 = 2+2+2
        return [2, 2, 2];
      case 7: // 少阳 = 2+2+3
        return [2, 2, 3];
      case 8: // 少阴 = 2+3+3
        return [2, 3, 3];
      case 9: // 老阳 = 3+3+3
        return [3, 3, 3];
      default:
        return [2, 2, 2];
    }
  };

  // 单次摇卦
  const handleTossOnce = async () => {
    if (isTossing || yaos.length >= 6) return;

    setIsTossing(true);
    
    // 计算本次结果
    const result = tossOnce();
    setCurrentTossResult(result);
    setShowCoinAnimation(true);
  };

  // 硬币动画完成后的回调
  const handleCoinAnimationComplete = () => {
    if (currentTossResult === null) return;

    // 添加新的爻到列表
    const yaoInfo = getYaoInfo(currentTossResult);
    setYaos(prev => [...prev, yaoInfo]);
    
    // 清理状态
    setShowCoinAnimation(false);
    setCurrentTossResult(null);
    setIsTossing(false);
  };

  // 确认问题
  const handleConfirmQuestion = () => {
    if (question.trim()) {
      setIsQuestionSet(true);
    }
  };

  // 重新起卦
  const handleReset = () => {
    setQuestion('');
    setIsQuestionSet(false);
    setYaos([]);
    setCurrentTossResult(null);
    setShowCoinAnimation(false);
    setIsTossing(false);
    setHexagramAnalysis(null);
    setAiResult(null);
    setShowModal(false);
  };

  // AI 解卦处理（流式：边生成边展示）
  const handleDivine = async () => {
    if (!hexagramAnalysis) return;

    // 🔐 延迟登录检查：只有在尝试使用 AI 功能时才要求登录
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      // 未登录，跳转到登录页，并带上当前页面地址以便登录后跳回
      router.push('/login?next=/');
      return;
    }

    setIsLoading(true);
    setAiResult('');
    setShowModal(true);

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    try {
      const hexagramInfo = {
        question,
        mainHexagram: hexagramAnalysis.mainHexagram?.title || '',
        mainDescription: hexagramAnalysis.mainHexagram?.description || '',
        transformedHexagram: hexagramAnalysis.transformedHexagram?.title || '',
        hasMovingLines: hexagramAnalysis.hasMovingLines,
        movingPositions: hexagramAnalysis.movingPositions,
        movingLineTexts: hexagramAnalysis.movingLineTexts,
        yaos: yaos.map((yao, index) => ({
          position: index,
          name: yao.name,
          value: yao.value,
          isChanging: yao.isChanging
        }))
      };

      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 120_000);

      const response = await fetch('/api/divine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          hexagramInfo,
          date: new Date().toLocaleString('zh-CN', {
            timeZone: 'Asia/Shanghai',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
        const data = await response.json().catch(() => ({}));
        setShowModal(false);
        if (response.status === 402) {
          const need = (data?.need_coins ?? 6) as number;
          setInsuffNeed(need);
          setInsuffOpen(true);
          window.dispatchEvent(new CustomEvent('coins-should-refresh'));
          return;
        }
        alert((data?.error as string) || '解卦失败，请重试');
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        if (timeoutId) clearTimeout(timeoutId);
        setShowModal(false);
        alert('无法读取响应，请重试');
        return;
      }

      const decoder = new TextDecoder();
      let acc = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (chunk) {
          acc += chunk;
          setAiResult(acc);
        }
      }

      if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }

      // 只有 AI 解卦完成、有内容时才保存到「我的六爻解卦」
      if (acc.trim()) {
        window.dispatchEvent(new CustomEvent('coins-should-refresh'));
        const saveDate = new Date().toLocaleString('zh-CN', {
          timeZone: 'Asia/Shanghai',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        fetch('/api/records/liuyao', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            question,
            hexagram_info: hexagramInfo,
            date: saveDate,
            ai_result: acc,
          }),
        }).catch((err) => console.error('保存六爻记录失败:', err));
      }
    } catch (error: unknown) {
      if (timeoutId) clearTimeout(timeoutId);
      setShowModal(false);
      console.error('解卦请求失败:', error);
      if (error instanceof Error && error.name === 'AbortError') {
        alert('请求超时，解卦耗时较长，请稍后重试');
      } else {
        alert('网络错误，请检查连接后重试');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 当6个爻都摇完后，自动解卦
  useEffect(() => {
    if (yaos.length === 6) {
      const yaoValues = yaos.map(y => y.value);
      const analysis = analyzeHexagram(yaoValues);
      setHexagramAnalysis(analysis);
    }
  }, [yaos]);

  // 流式输出时自动滚动到底部
  useEffect(() => {
    if (isLoading && aiResult && modalContentRef.current) {
      modalContentRef.current.scrollTop = modalContentRef.current.scrollHeight;
    }
  }, [isLoading, aiResult]);

  // 获取爻的符号样式 - 使用 SVG 确保跨浏览器兼容
  const getYaoSymbol = (yao: YaoInfo) => {
    if (yao.value === 7 || yao.value === 9) {
      // 阳爻 —— 使用 SVG 渲染一条完整的线
      return (
        <svg 
          viewBox="0 0 112 12" 
          className="w-28 h-3"
          style={{ width: '112px', height: '12px' }}
          preserveAspectRatio="none"
        >
          <rect 
            x="0" 
            y="0" 
            width="112" 
            height="12" 
            fill="#44403c"
            rx="6"
          />
        </svg>
      );
    } else {
      // 阴爻 - - 使用 SVG 渲染两条断开的线
      return (
        <svg 
          viewBox="0 0 112 12" 
          className="w-28 h-3"
          style={{ width: '112px', height: '12px' }}
          preserveAspectRatio="none"
        >
          <rect 
            x="0" 
            y="0" 
            width="52" 
            height="12" 
            fill="#44403c"
            rx="6"
          />
          <rect 
            x="60" 
            y="0" 
            width="52" 
            height="12" 
            fill="#44403c"
            rx="6"
          />
        </svg>
      );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center pt-28 pb-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="space-y-12 w-full"
      >
        {/* Phase 1: 输入问题阶段 */}
        {!isQuestionSet ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex flex-col items-center space-y-8"
          >
            {/* 输入框 */}
            <div className="w-full max-w-md">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && question.trim()) {
                    handleConfirmQuestion();
                  }
                }}
                placeholder="一念既起"
                className="w-full text-center text-stone-700 font-sans text-base bg-transparent border-0 border-b-2 border-stone-300 focus:border-stone-700 focus:outline-none transition-colors duration-300 py-3"
              />
            </div>

            {/* 卦象自生按钮 */}
            <motion.button
              onClick={handleConfirmQuestion}
              disabled={!question.trim()}
              className="px-8 py-4 bg-stone-800 text-white font-sans text-sm rounded-lg hover:bg-stone-700 active:bg-stone-900 transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              卦象自生
            </motion.button>
          </motion.div>
        ) : (
          <>
            {/* Phase 2: 摇卦阶段 - 显示问题 */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center"
            >
              <p className="text-sm text-stone-600 font-serif italic">
                {question}
              </p>
            </motion.div>

            {/* 起卦按钮 */}
            <div className="text-center space-y-6">
              {yaos.length < 6 ? (
                <motion.button
                  onClick={handleTossOnce}
                  disabled={isTossing}
                  className="mx-auto px-8 py-4 bg-stone-800 text-white font-sans text-sm rounded-lg hover:bg-stone-700 active:bg-stone-900 transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center gap-3"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Hand className="w-5 h-5" />
                  {isTossing ? '摇卦中...' : yaos.length === 0 ? '摇卦起卦' : `摇第 ${yaos.length + 1} 爻`}
                </motion.button>
              ) : (
                <motion.button
                  onClick={handleReset}
                  className="mx-auto px-8 py-4 bg-stone-600 text-white font-sans text-sm rounded-lg hover:bg-stone-500 transition-colors duration-300 shadow-sm flex items-center gap-3"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Sparkles className="w-5 h-5" />
                  重新起卦
                </motion.button>
              )}
              
              <p className="text-xs text-[#999999] font-sans">
                {yaos.length === 0 
                  ? '心中默念所问之事，点击摇卦' 
                  : yaos.length < 6 
                    ? `已摇 ${yaos.length} 爻，还需摇 ${6 - yaos.length} 次`
                    : '起卦完成，可查看卦象'}
              </p>
            </div>
          </>
        )}

        {/* 硬币动画 - 只在问题确认后显示 */}
        <AnimatePresence>
          {isQuestionSet && showCoinAnimation && currentTossResult && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.3 }}
            >
              <CoinAnimation
                finalResult={getCoinsFromValue(currentTossResult)}
                onAnimationComplete={handleCoinAnimationComplete}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* 卦象显示 - 只在问题确认后显示 */}
        <AnimatePresence>
          {isQuestionSet && yaos.length > 0 && !showCoinAnimation && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.6 }}
              className="space-y-8"
            >
              {/* 卦象图 */}
              <div className="w-full flex flex-col items-center space-y-4 py-8">
                <div className="text-center text-xs text-[#999999] font-sans mb-6">
                  从下往上读
                </div>
                
                <div className="space-y-4 flex flex-col items-center">
                  {[...yaos].reverse().map((yao, index) => {
                    // 计算原始索引（反转前的位置）
                    const originalIndex = yaos.length - 1 - index;
                    
                    return (
                      <motion.div
                        key={originalIndex}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="flex items-center justify-center gap-3"
                        style={{ width: '100%', maxWidth: '296px' }}
                      >
                        {/* 左侧容器 - 爻位标签，固定宽度，右对齐 */}
                        <div className="text-right shrink-0" style={{ width: '80px', minWidth: '80px' }}>
                          <span className="text-xs text-[#999999] font-serif">
                            {originalIndex === 0 ? '初' : originalIndex === 5 ? '上' : ['', '二', '三', '四', '五'][originalIndex]}爻
                          </span>
                        </div>
                        
                        {/* 中间容器 - SVG 线条，固定宽度，始终居中 */}
                        <div className="shrink-0 flex items-center justify-center" style={{ width: '112px', minWidth: '112px' }}>
                          {getYaoSymbol(yao)}
                        </div>
                        
                        {/* 右侧容器 - 名称和标记，固定宽度，左对齐 */}
                        <div className="shrink-0 flex items-center gap-2" style={{ width: '80px', minWidth: '80px' }}>
                          <span className="text-sm text-[#666666] font-serif">
                            {yao.name}
                          </span>
                          
                          {/* 变爻标记 */}
                          <div className="flex items-center justify-center" style={{ width: '16px', height: '16px' }}>
                            {yao.isChanging ? (
                              <>
                                {yao.value === 9 ? (
                                  // 老阳标记 ○
                                  <svg 
                                    viewBox="0 0 12 12" 
                                    className="w-3 h-3"
                                    style={{ width: '12px', height: '12px' }}
                                  >
                                    <circle 
                                      cx="6" 
                                      cy="6" 
                                      r="5" 
                                      fill="none" 
                                      stroke="#44403c" 
                                      strokeWidth="2"
                                    />
                                  </svg>
                                ) : (
                                  // 老阴标记 ×
                                  <svg 
                                    viewBox="0 0 10 10" 
                                    className="w-2.5 h-2.5"
                                    style={{ width: '10px', height: '10px' }}
                                  >
                                    <line 
                                      x1="1" 
                                      y1="1" 
                                      x2="9" 
                                      y2="9" 
                                      stroke="#44403c" 
                                      strokeWidth="2" 
                                      strokeLinecap="round"
                                    />
                                    <line 
                                      x1="9" 
                                      y1="1" 
                                      x2="1" 
                                      y2="9" 
                                      stroke="#44403c" 
                                      strokeWidth="2" 
                                      strokeLinecap="round"
                                    />
                                  </svg>
                                )}
                              </>
                            ) : null}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* 变爻提示 */}
              {yaos.length === 6 && yaos.some(y => y.isChanging) && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-center space-y-2"
                >
                  <div className="text-xs text-[#666666] font-sans">
                    此卦有变爻
                  </div>
                  <div className="text-xs text-[#999999] font-sans">
                    ○ 表示老阳（阳极生阴）· × 表示老阴（阴极生阳）
                  </div>
                </motion.div>
              )}

              {/* 解卦结果 */}
              {yaos.length === 6 && hexagramAnalysis && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }}
                  className="pt-8 border-t border-stone-200 space-y-8"
                >
                  {/* 本卦与变卦 */}
                  {hexagramAnalysis.mainHexagram && (
                    <div className="flex items-center justify-center gap-6">
                      {/* 本卦 */}
                      <div className="text-center">
                        <p className="text-xs text-[#999999] font-sans mb-2">本卦</p>
                        <p className="text-lg text-[#333333] font-serif">
                          {hexagramAnalysis.mainHexagram.title}
                        </p>
                      </div>

                      {/* 箭头 */}
                      {hexagramAnalysis.hasMovingLines && hexagramAnalysis.transformedHexagram && (
                        <>
                          <div className="text-[#999999]">→</div>
                          
                          {/* 变卦 */}
                          <div className="text-center">
                            <p className="text-xs text-[#999999] font-sans mb-2">变卦</p>
                            <p className="text-lg text-[#333333] font-serif">
                              {hexagramAnalysis.transformedHexagram.title}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* 卦辞 */}
                  {hexagramAnalysis.mainHexagram && (
                    <div className="text-center max-w-md mx-auto">
                      <p className="text-xs text-[#999999] font-sans mb-2">卦辞</p>
                      <p className="text-sm text-[#666666] font-serif leading-relaxed">
                        {hexagramAnalysis.mainHexagram.description}
                      </p>
                    </div>
                  )}

                  {/* 动爻详解（核心重点） */}
                  {hexagramAnalysis.hasMovingLines ? (
                    <div className="max-w-md mx-auto space-y-4">
                      <p className="text-xs text-[#999999] font-sans text-center mb-4">
                        变爻详解
                      </p>
                      
                      {hexagramAnalysis.movingLineTexts.map((text, index) => {
                        const position = hexagramAnalysis.movingPositions[index];
                        const positionName = getYaoPositionName(position);
                        
                        return (
                          <motion.div
                            key={position}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 1 + index * 0.2 }}
                            className="p-4 border-l-2 border-stone-700"
                          >
                            <p className="text-sm text-[#333333] font-serif font-medium">
                              {text}
                            </p>
                          </motion.div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center max-w-md mx-auto">
                      <p className="text-sm text-[#999999] font-sans italic">
                        此卦静爻，无变卦。请参阅本卦卦辞。
                      </p>
                    </div>
                  )}

                  {/* AI 深度解卦 CTA 按钮 */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.2 }}
                    className="mt-16 flex flex-col items-center gap-2"
                  >
                    <motion.button
                      onClick={handleDivine}
                      disabled={isLoading}
                      className="w-full max-w-md px-8 py-5 text-white font-serif text-base tracking-[0.2em] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ 
                        backgroundColor: isLoading ? '#a8a29e' : '#78716c' // stone-400 loading, stone-500 normal
                      }}
                      whileHover={!isLoading ? { 
                        y: -2,
                        backgroundColor: '#292524' // stone-800 - 高饱和度
                      } : {}}
                      whileTap={!isLoading ? { y: 0 } : {}}
                      transition={{ duration: 0.3 }}
                    >
                      {isLoading ? '静心 问念...' : '凡事有因，于此寻果'}
                    </motion.button>
                    <p className="text-xs text-stone-500 font-sans">消耗 6 铜币</p>
                  </motion.div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* 初始状态提示 - 只在问题确认后显示 */}
        {isQuestionSet && yaos.length === 0 && !showCoinAnimation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center space-y-4 py-12"
          >
            <Sparkles className="w-10 h-10 mx-auto text-stone-400 mb-4" />
            <p className="text-sm text-[#666666] font-sans max-w-md mx-auto leading-relaxed">
              六爻起卦，源自《易经》的古老占卜方法。<br />
              通过摇动三枚铜钱，共六次，得出卦象。
            </p>
          </motion.div>
        )}

        <p className="text-center text-xs text-stone-400 font-sans py-6">
          注：一切卦象归根究底都是心象，勿将本网站用于封建迷信活动。
        </p>
      </motion.div>

      {/* AI 解卦结果模态框（流式：边生成边显示） */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
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
                    解卦详析
                  </h3>
                  <button
                    onClick={() => setShowModal(false)}
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
                <p className="text-sm text-stone-500 font-serif italic mt-3">
                  "{question}"
                </p>
              </div>

              {/* 模态框内容：流式逐字显示 */}
              <div ref={modalContentRef} className="px-8 py-6 overflow-y-auto max-h-[60vh]">
                <div className="prose prose-stone max-w-none">
                  <div className="text-base text-stone-700 font-serif leading-loose whitespace-pre-wrap min-h-[1.5em]">
                    {isLoading && !aiResult ? (
                      <span className="inline-flex items-center gap-2 text-stone-400">
                        <span className="animate-pulse">静心</span>
                        <span className="animate-pulse" style={{ animationDelay: '0.2s' }}>问念</span>
                        <span className="animate-pulse" style={{ animationDelay: '0.4s' }}>…</span>
                      </span>
                    ) : (
                      <>
                        {aiResult}
                        {isLoading && (
                          <span className="inline-block w-2 h-4 ml-0.5 bg-stone-400 animate-pulse align-middle" />
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* 模态框底部 */}
              <div className="bg-gradient-to-t from-stone-100/50 to-transparent px-8 py-6 border-t border-stone-200 flex justify-end gap-4">
                {isLoading ? (
                  <span className="text-sm text-stone-400 font-sans">生成中…</span>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        if (aiResult) {
                          navigator.clipboard.writeText(aiResult);
                          alert('已复制到剪贴板');
                        }
                      }}
                      disabled={!aiResult}
                      className="px-6 py-2.5 bg-stone-200 text-stone-700 font-sans text-sm rounded-lg hover:bg-stone-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      复制内容
                    </button>
                    <button
                      onClick={() => setShowModal(false)}
                      className="px-6 py-2.5 bg-stone-700 text-white font-sans text-sm rounded-lg hover:bg-stone-800 transition-colors"
                    >
                      知晓了
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <InsufficientCoinsModal
        open={insuffOpen}
        needCoins={insuffNeed}
        onClose={() => setInsuffOpen(false)}
      />
    </div>
  );
};
