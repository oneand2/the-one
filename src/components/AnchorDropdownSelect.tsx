'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';

const KAITI = '"Kaiti SC", KaiTi, STKaiti, "华文楷体", "楷体", Georgia, serif';

export type DropdownOption = {
  value: string;
  label: string;
  group?: string;
  /** 列表项与选中态文字色，如五行主题色 */
  color?: string;
};

type AnchorDropdownSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  disabled?: boolean;
  'aria-label'?: string;
  suffix?: string;
  valueColor?: string;
  useKaitiValue?: boolean;
  variant?: 'date' | 'modal' | 'compact';
  /** date 变体顶栏标签，如「年」 */
  fieldLabel?: string;
  wide?: boolean;
  className?: string;
  placeholder?: string;
};

const Chevron = () => (
  <svg aria-hidden className="h-2.5 w-2.5 opacity-50" viewBox="0 0 12 12" fill="none">
    <path d="M2.5 4.5L6 8L9.5 4.5" stroke="#8a8278" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const AnchorDropdownSelect: React.FC<AnchorDropdownSelectProps> = ({
  value,
  onChange,
  options,
  disabled = false,
  'aria-label': ariaLabel,
  suffix = '',
  valueColor,
  useKaitiValue = false,
  variant = 'modal',
  fieldLabel,
  wide = false,
  className = '',
  placeholder = '请选择',
}) => {
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuStyle, setMenuStyle] = useState({ top: 0, left: 0, width: 0, maxHeight: 220 });

  const selected = options.find((o) => o.value === value);
  const displayText = selected ? `${selected.label}${suffix}` : placeholder;

  const updateMenuPosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 10;
    setMenuStyle({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      maxHeight: Math.max(100, Math.min(240, spaceBelow)),
    });
  }, []);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    updateMenuPosition();
    const onScrollOrResize = () => updateMenuPosition();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    // 延后注册，避免与打开菜单的同一次点击冲突导致立刻关闭
    const timer = window.setTimeout(() => {
      document.addEventListener('pointerdown', onPointerDown);
      document.addEventListener('keydown', onKey);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !menuRef.current) return;
    const active = menuRef.current.querySelector('[data-selected="true"]');
    active?.scrollIntoView({ block: 'nearest' });
  }, [open, value]);

  const toggle = () => {
    if (disabled) return;
    if (!open) updateMenuPosition();
    setOpen((v) => !v);
  };

  const triggerClass =
    variant === 'date'
      ? 'flex w-full flex-col items-center justify-center gap-0.5 bg-transparent py-1.5 pl-1 pr-1 text-center transition-colors hover:bg-[#f0ede6]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-stone-300/80'
      : variant === 'compact'
        ? 'flex w-full items-center justify-center gap-0.5 rounded-md border border-[#e8e3d8] bg-[#fdfcf9] py-1.5 pl-1 pr-1 text-center text-[14px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-stone-400'
        : 'flex w-full items-center justify-between gap-2 rounded-xl bg-[#f8f6f0] px-4 py-3.5 text-left text-[14px] text-[#3d3935] shadow-[inset_0_1px_2px_rgba(30,28,24,0.04)] ring-1 ring-[#e8e3d8]/90 transition-colors hover:bg-[#f0ede6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400/60';

  const trigger = (
    <button
      ref={triggerRef}
      type="button"
      aria-label={ariaLabel ?? fieldLabel}
      aria-expanded={open}
      aria-haspopup="listbox"
      aria-controls={open ? listId : undefined}
      disabled={disabled}
      onClick={toggle}
      className={`${triggerClass} ${disabled ? 'cursor-not-allowed opacity-55' : ''} ${open ? 'ring-2 ring-stone-400/50' : ''}`}
      style={{
        touchAction: 'manipulation',
        color: valueColor ?? (selected ? '#3d3935' : '#b5ad9e'),
        fontFamily: useKaitiValue || variant === 'date' ? KAITI : undefined,
      }}
    >
      {variant === 'date' && fieldLabel ? (
        <>
          <span className="font-sans text-[10px] leading-none tracking-[0.16em] text-stone-400">{fieldLabel}</span>
          <span className="flex items-center gap-0.5 text-[15px] tabular-nums leading-none text-[#3d3935]">
            {displayText}
            {!disabled && <Chevron />}
          </span>
        </>
      ) : (
        <>
          <span className={variant === 'modal' ? 'min-w-0 flex-1 truncate' : ''}>{displayText}</span>
          {!disabled && <Chevron />}
        </>
      )}
    </button>
  );

  const menu =
    mounted && open
      ? createPortal(
          <AnimatePresence>
            <motion.div
              ref={menuRef}
              id={listId}
              role="listbox"
              aria-label={ariaLabel ?? fieldLabel}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: [0.22, 0.72, 0, 1] }}
              className="custom-scrollbar overflow-y-auto overscroll-contain rounded-xl border border-[#e8e3d8]/90 bg-[#fbf9f4] py-1 shadow-[0_10px_28px_rgba(28,24,18,0.14)]"
              style={{
                position: 'fixed',
                top: menuStyle.top,
                left: menuStyle.left,
                width: menuStyle.width,
                maxHeight: menuStyle.maxHeight,
                zIndex: 120,
              }}
            >
              {options.map((opt, i) => {
                const showGroup = opt.group && (i === 0 || options[i - 1].group !== opt.group);
                const isSelected = opt.value === value;
                return (
                  <React.Fragment key={`${opt.group ?? ''}-${opt.value}-${i}`}>
                    {showGroup && (
                      <div className="px-3 pb-1 pt-2 font-sans text-[9px] font-medium tracking-[0.2em] text-stone-400">
                        {opt.group}
                      </div>
                    )}
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      data-selected={isSelected ? 'true' : undefined}
                      onClick={() => {
                        onChange(opt.value);
                        setOpen(false);
                      }}
                      className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors ${
                        isSelected ? 'bg-[#ebe6dc]/90' : 'hover:bg-[#f5f2ec]'
                      }`}
                      style={{
                        fontFamily: useKaitiValue || variant === 'date' ? KAITI : undefined,
                        fontSize: variant === 'compact' ? '14px' : '15px',
                      }}
                    >
                      <span style={{ color: opt.color ?? (isSelected ? '#3d3935' : '#57534e') }}>
                        {opt.label}
                        {suffix}
                      </span>
                      {isSelected && (
                        <svg className="h-3.5 w-3.5 flex-shrink-0 text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  </React.Fragment>
                );
              })}
            </motion.div>
          </AnimatePresence>,
          document.body,
        )
      : null;

  if (variant === 'date') {
    return (
      <div className={`relative flex min-w-0 flex-col overflow-visible rounded-lg bg-[#fbf9f4] ring-1 ring-[#e8e3d8]/80 ${wide ? 'flex-[1.35]' : 'flex-1'} ${className}`}>
        <div className="relative">{trigger}</div>
        {menu}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`relative ${className}`}>
        {trigger}
        {menu}
      </div>
    );
  }

  return (
    <div className={`relative block ${className}`}>
      {trigger}
      {menu}
    </div>
  );
};
