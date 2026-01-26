'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface CoinAnimationProps {
  finalResult: number[]; // [2, 3, 2] 表示最终的3枚硬币结果
  onAnimationComplete: () => void;
}

export const CoinAnimation: React.FC<CoinAnimationProps> = ({ 
  finalResult, 
  onAnimationComplete 
}) => {
  const [currentCoins, setCurrentCoins] = useState<number[]>([2, 2, 2]);
  const [isAnimating, setIsAnimating] = useState(true);

  useEffect(() => {
    // 切换动画（模拟旋转），放慢速度
    const switchInterval = setInterval(() => {
      setCurrentCoins([
        Math.random() < 0.5 ? 2 : 3,
        Math.random() < 0.5 ? 2 : 3,
        Math.random() < 0.5 ? 2 : 3,
      ]);
    }, 180); // 从100ms增加到180ms

    // 2秒后停止切换，显示最终结果
    const stopTimeout = setTimeout(() => {
      clearInterval(switchInterval);
      setCurrentCoins(finalResult);
      setIsAnimating(false);
      
      // 再等0.8秒后通知父组件
      setTimeout(() => {
        onAnimationComplete();
      }, 800);
    }, 2000); // 从1500ms增加到2000ms

    return () => {
      clearInterval(switchInterval);
      clearTimeout(stopTimeout);
    };
  }, [finalResult, onAnimationComplete]);

  return (
    <div className="flex items-center justify-center gap-8 py-12">
      {currentCoins.map((coinValue, index) => (
        <motion.div
          key={index}
          style={{ width: '48px', height: '48px' }}
          animate={isAnimating ? {
            y: [0, -24, 0], // 从-30减少到-24，降低跳动高度
            scale: [1, 1.05, 1], // 从1.1减少到1.05，降低缩放幅度
          } : {
            y: 0,
            scale: 1,
          }}
          transition={{
            duration: 0.8, // 从0.6增加到0.8，动画更慢
            repeat: isAnimating ? Infinity : 0,
            delay: index * 0.15, // 从0.1增加到0.15，错开更多
            ease: "easeInOut",
          }}
        >
          {/* 使用 SVG 确保跨浏览器兼容 */}
          <svg 
            viewBox="0 0 48 48" 
            width="48" 
            height="48"
            style={{ width: '48px', height: '48px' }}
          >
            {coinValue === 2 ? (
              // 空心圆 - 正面/字
              <circle 
                cx="24" 
                cy="24" 
                r="20" 
                fill="none" 
                stroke="#44403c" 
                strokeWidth="4"
              />
            ) : (
              // 实心圆 - 反面/背
              <circle 
                cx="24" 
                cy="24" 
                r="22" 
                fill="#44403c"
              />
            )}
          </svg>
        </motion.div>
      ))}
    </div>
  );
};
