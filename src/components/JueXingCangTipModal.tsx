'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  onDontShowAgain: () => void;
};

export function JueXingCangTipModal({ open, onClose, onDontShowAgain }: Props) {
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  // 打开弹窗时，需要等待 10 秒后才能点击“我已知晓”，期间显示倒计时
  useEffect(() => {
    if (!open) {
      setRemainingSeconds(0);
      return;
    }

    const WAIT_SECONDS = 10;
    setRemainingSeconds(WAIT_SECONDS);

    const timer = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [open]);

  const handleConfirm = () => {
    // 还在等待期间，不允许关闭
    if (remainingSeconds > 0) return;

    if (dontShowAgain) {
      onDontShowAgain();
    }
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="bg-[#FBF9F4] border border-stone-200 rounded-2xl shadow-xl max-w-md w-full p-8 font-sans"
            onClick={(e) => e.stopPropagation()}
          >
          {/* 标题 */}
          <div className="text-center mb-6">
            <h3 className="text-xl font-serif text-stone-800 mb-2 tracking-wide">
              使用提示
            </h3>
            <div className="w-12 h-px bg-stone-300 mx-auto" />
          </div>

          {/* 内容 */}
          <div className="space-y-4 mb-6 text-stone-700 leading-relaxed">
            <p className="text-sm">
              为了获得更优质的回答，建议您：
            </p>
            
            <div className="space-y-3 pl-4 border-l-2 border-stone-200">
              <div className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-stone-400 mt-2 shrink-0" />
                <p className="text-sm flex-1">
                  开启<strong className="text-stone-800">六爻</strong>（已默认开启）之后再提问，可获得更精准的解卦分析。
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-stone-400 mt-2 shrink-0" />
                <p className="text-sm flex-1">
                  点击<strong className="text-stone-800">宗师模式</strong>可获得更深入、更准确的回答（消耗 20 铜币）。宗师模式已默认开启，关闭宗师模式可以帮你节省大量铜币。
                </p>
              </div>
            </div>
          </div>

          {/* 不再显示选项 */}
          <label className="flex items-center gap-2 mb-6 cursor-pointer group">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="w-4 h-4 rounded border-stone-300 text-stone-800 focus:ring-stone-400 focus:ring-offset-0 cursor-pointer"
            />
            <span className="text-xs text-stone-600 group-hover:text-stone-700 transition-colors">
              不再显示此提示
            </span>
          </label>

          {/* 按钮 */}
          <button
            type="button"
            onClick={handleConfirm}
            disabled={remainingSeconds > 0}
            className={`w-full py-3 rounded-lg text-sm font-medium transition-colors tracking-wide
              ${remainingSeconds > 0
                ? 'bg-stone-400 text-white cursor-not-allowed'
                : 'bg-stone-800 text-white hover:bg-stone-700 active:bg-stone-900'
              }`}
          >
            {remainingSeconds > 0 ? `我已知晓（${remainingSeconds} 秒后可点击）` : '我已知晓'}
          </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
