'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  label: string;
  value: number;
  options: number[];
  onChange: (val: number) => void;
}

/** 年 / 月 / 日 三段式选择器，见天地顶部用 */
export const DateSegmentSelect: React.FC<Props> = ({ label, value, options, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <label className="text-xs font-medium text-stone-500 font-sans uppercase tracking-wider block mb-2">
        {label}
      </label>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-stone-50/50 border border-stone-200/60 rounded-md px-3 py-2.5 text-stone-700 font-sans cursor-pointer flex justify-between items-center hover:bg-stone-50 transition-all duration-200"
      >
        <span className="text-sm">{value}</span>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <svg className="w-4 h-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </motion.div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 mt-1 bg-white border border-stone-200 rounded-md shadow-lg z-50 max-h-48 overflow-y-auto"
            ref={(el) => {
              if (el) {
                setTimeout(() => {
                  const selectedItem = el.querySelector(`[data-value="${value}"]`) as HTMLElement;
                  if (selectedItem) {
                    const containerHeight = el.clientHeight;
                    const itemHeight = selectedItem.clientHeight;
                    const itemTop = selectedItem.offsetTop;
                    el.scrollTop = Math.max(0, itemTop - containerHeight / 2 + itemHeight / 2);
                  }
                }, 10);
              }
            }}
          >
            {options.map((option) => (
              <div
                key={option}
                data-value={option}
                onClick={() => {
                  onChange(option);
                  setIsOpen(false);
                }}
                className={`px-3 py-2 text-sm text-stone-700 font-sans hover:bg-stone-50 cursor-pointer transition-colors duration-150 ${
                  option === value ? 'bg-stone-100' : ''
                }`}
              >
                {option}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
