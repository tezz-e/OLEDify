import React, { useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { triggerTactileFeedback } from '../hardware/hapticAudio';

export interface GooeyOption<T extends string = string> {
  id: T;
  label: string;
}

export interface GooeySegmentedControlProps<T extends string = string> {
  options: GooeyOption<T>[];
  value: T;
  onChange: (val: T) => void;
  onHoverOption?: (val: T | null) => void;
  className?: string;
  size?: 'sm' | 'md';
  themeMode?: 'light' | 'dark';
}

export function GooeySegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  onHoverOption,
  className = '',
  size = 'md',
  themeMode,
}: GooeySegmentedControlProps<T>) {
  const isDark = themeMode ? themeMode === 'dark' : (typeof document !== 'undefined' ? !document.documentElement.classList.contains('light') && (document.documentElement.classList.contains('dark') || document.documentElement.getAttribute('data-theme') !== 'light') : true);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const [isSliding, setIsSliding] = useState(false);
  const activeIdx = Math.max(0, options.findIndex((o) => o.id === value));

  // Find index from clientX coordinate
  const getIndexFromX = useCallback((clientX: number): number => {
    const el = containerRef.current;
    if (!el) return activeIdx;
    const rect = el.getBoundingClientRect();
    const relX = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const segmentWidth = rect.width / options.length;
    const index = Math.min(options.length - 1, Math.floor(relX / segmentWidth));
    return index;
  }, [options.length, activeIdx]);

  const handlePointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    setIsSliding(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    const idx = getIndexFromX(e.clientX);
    if (idx !== activeIdx && options[idx]) {
      triggerTactileFeedback('click');
      onChange(options[idx].id);
      onHoverOption?.(options[idx].id);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const idx = getIndexFromX(e.clientX);
    if (idx !== activeIdx && options[idx]) {
      triggerTactileFeedback('detent');
      onChange(options[idx].id);
      onHoverOption?.(options[idx].id);
    }
  };

  const handlePointerUp = () => {
    if (isDragging.current) {
      isDragging.current = false;
      setIsSliding(false);
      triggerTactileFeedback('click');
    }
  };

  const pad = size === 'sm' ? 'py-1 text-[11px]' : 'py-1.5 text-xs';
  const widthPercent = 100 / options.length;

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      data-gooey="true"
      className={`border border-[var(--hw-border-hairline)] rounded-[8px] p-1 flex relative ${
        isDark ? 'bg-black/40' : 'bg-black/5'
      } select-none touch-none cursor-grab active:cursor-grabbing overflow-hidden ${className}`}
    >
      {/* Embedded SVG Gooey Filter */}
      <svg className="absolute w-0 h-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <defs>
          <filter id="gooey-effect">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"
              result="goo"
            />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>
        </defs>
      </svg>

      {/* Fluid Gooey Sliding Pill Layer (Filter applied ONLY here, NOT on text buttons) */}
      <div 
        className="absolute inset-0 pointer-events-none rounded-[8px] overflow-hidden"
        style={{ filter: 'url(#gooey-effect)' }}
      >
        <motion.div
          className={`absolute top-1 bottom-1 rounded-[6px] ${
            isDark
              ? 'bg-white/[0.14] backdrop-blur-md border border-white/20 border-t-white/35 border-b-black/30 shadow-[0_2px_10px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.35)]'
              : 'bg-white border border-black/10 border-t-white shadow-[0_2px_8px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.9)]'
          }`}
          animate={{
            left: `calc(${activeIdx * widthPercent}% + 4px)`,
            width: `calc(${widthPercent}% - 8px)`,
            scaleX: isSliding ? 1.08 : 1,
            scaleY: isSliding ? 0.94 : 1,
          }}
          transition={{
            type: 'spring',
            stiffness: isSliding ? 420 : 380,
            damping: isSliding ? 28 : 25,
            mass: 0.8,
          }}
        />
      </div>

      {/* Segment Option Buttons (100% Crisp Razor-Sharp Typography) */}
      {options.map((opt, i) => {
        const isSelected = i === activeIdx;
        return (
          <button
            key={opt.id}
            type="button"
            onMouseEnter={() => onHoverOption?.(opt.id)}
            onMouseLeave={() => onHoverOption?.(null)}
            className={`relative flex-1 text-center font-sans font-medium ${pad} rounded-[6px] transition-colors duration-150 z-10 select-none pointer-events-auto cursor-pointer ${
              isSelected
                ? (isDark ? 'text-white' : 'text-[#18181A]') + ' font-semibold'
                : (isDark ? 'text-[var(--hw-text-secondary)] hover:text-white' : 'text-[#57575E] hover:text-[#18181A]')
            }`}
          >
            <span className="relative z-10 truncate block px-1">
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
