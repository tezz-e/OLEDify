import React, { useState, useRef, useCallback, useEffect } from 'react';
import { triggerNativeHaptic } from '../../theme/haptics';

export interface ModularSynthPatchCardProps {
  id: string;
  name: string;
  tag: string;
  icon: string;
  description: string;
  isSelected?: boolean;
  onSelect: (id: string) => void;
  accentColor?: 'amber' | 'phosphor' | 'cyan';
  themeMode?: 'light' | 'dark';
  className?: string;
}

const HARDWARE_CIPHER_POOL = '0123456789ABCDEF$#@%&*+-/<>~^';

export const ModularSynthPatchCard: React.FC<ModularSynthPatchCardProps> = ({
  id,
  name,
  tag,
  icon,
  description,
  isSelected,
  onSelect,
  accentColor = 'amber',
  themeMode = 'dark',
  className = '',
}) => {
  const isDark = themeMode === 'dark';
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 });
  const [opacity, setOpacity] = useState(0);
  const [scrambleName, setScrambleName] = useState(name);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  const colors = {
    amber: {
      spotlight: 'rgba(255, 85, 0, 0.08)',
      specular: 'rgba(255, 85, 0, 0.75)',
      activeGlow: '0 0 16px rgba(255, 85, 0, 0.4)',
      accentHex: '#FF5500',
    },
    phosphor: {
      spotlight: 'rgba(0, 255, 102, 0.08)',
      specular: 'rgba(0, 255, 102, 0.75)',
      activeGlow: '0 0 16px rgba(0, 255, 102, 0.4)',
      accentHex: '#00FF66',
    },
    cyan: {
      spotlight: 'rgba(0, 240, 255, 0.08)',
      specular: 'rgba(0, 240, 255, 0.75)',
      activeGlow: '0 0 16px rgba(0, 240, 255, 0.4)',
      accentHex: '#00F0FF',
    },
  }[accentColor];

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  // DecryptedText cipher scramble on hover with deterministic timer cancellation
  const handleMouseEnter = () => {
    clearTimer();
    setOpacity(1);
    triggerNativeHaptic(8);

    let iter = 0;
    intervalRef.current = setInterval(() => {
      iter++;
      setScrambleName(() =>
        name
          .split('')
          .map((ch, idx) => {
            if (ch === ' ') return ' ';
            if (iter > idx * 2 + 6) return name[idx];
            return HARDWARE_CIPHER_POOL[
              Math.floor(Math.random() * HARDWARE_CIPHER_POOL.length)
            ];
          })
          .join('')
      );
      if (iter > 18) {
        clearTimer();
        setScrambleName(name);
      }
    }, 28);
  };

  const handleMouseLeave = () => {
    clearTimer();
    setOpacity(0);
    setScrambleName(name);
  };

  const handleClick = () => {
    triggerNativeHaptic(12);
    onSelect(id);
  };

  return (
    <div
      ref={cardRef}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative p-4 rounded-[8px] border cursor-pointer select-none font-mono overflow-hidden transition-all duration-200 ${
        isDark
          ? isSelected
            ? 'bg-[#121216] border-[#FAFAFA] shadow-[0_8px_32px_rgba(0,0,0,0.85)]'
            : 'bg-[#080808] border-[#27272A] hover:border-[#52525B]'
          : isSelected
          ? 'bg-[#FFFFFF] border-[#1A1A1A] shadow-[0_6px_20px_rgba(0,0,0,0.12)]'
          : 'bg-[#F6F6F4] border-[#EBEAE5] hover:border-[#1A1A1A]'
      } ${className}`}
      style={{
        boxShadow: isSelected ? colors.activeGlow : undefined,
      }}
      aria-label={`Patch: ${name}`}
      tabIndex={0}
      role="button"
    >
      {/* 1. Cursor-Tracking Radial Spotlight Inner Fill (React Bits) */}
      <div
        className="pointer-events-none absolute -inset-px transition-opacity duration-300"
        style={{
          opacity,
          background: `radial-gradient(400px circle at ${mousePos.x}px ${mousePos.y}px, ${colors.spotlight}, transparent 80%)`,
        }}
      />

      {/* 2. Cursor-Tracking 1px Specular Border Trail */}
      <div
        className="pointer-events-none absolute -inset-px rounded-[8px] transition-opacity duration-300"
        style={{
          opacity,
          border: `1px solid ${colors.specular}`,
          maskImage: `radial-gradient(180px circle at ${mousePos.x}px ${mousePos.y}px, black 30%, transparent 80%)`,
          WebkitMaskImage: `radial-gradient(180px circle at ${mousePos.x}px ${mousePos.y}px, black 30%, transparent 80%)`,
        }}
      />

      {/* 3. Patch Content & Silkscreen Typography */}
      <div className="relative z-10 flex flex-col gap-2">
        {/* Header Strip with Icon and Micro-Tag */}
        <div className="flex items-center justify-between">
          <span className="text-lg select-none">{icon}</span>
          <span
            className={`text-[8px] px-1.5 py-0.5 rounded-[2px] uppercase font-bold tracking-widest border ${
              isSelected
                ? isDark
                  ? 'bg-white text-black border-white'
                  : 'bg-black text-white border-black'
                : isDark
                ? 'bg-[#18181C] text-[#A1A1AA] border-[#3F3F46]'
                : 'bg-[#EBEAE5] text-[#5E5D59] border-[#D1CFCA]'
            }`}
          >
            {tag}
          </span>
        </div>

        {/* Patch Name with Decrypted Scramble */}
        <div className="mt-1">
          <h3
            className={`text-xs font-bold tracking-wider uppercase ${
              isDark ? 'text-[#FAFAFA]' : 'text-[#1A1A1A]'
            }`}
          >
            {scrambleName}
          </h3>
          <p
            className={`text-[9px] mt-1 line-clamp-2 leading-relaxed ${
              isDark ? 'text-[#A1A1AA]' : 'text-[#5E5D59]'
            }`}
          >
            {description}
          </p>
        </div>

        {/* Hardware Status Indicator Dot */}
        <div className="mt-2 pt-2 border-t border-current/10 flex items-center justify-between text-[8px]">
          <span className="opacity-50 uppercase tracking-widest">PATCH_ID</span>
          <div className="flex items-center gap-1.5 font-bold">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                backgroundColor: isSelected ? colors.accentHex : undefined,
                boxShadow: isSelected ? `0 0 6px ${colors.accentHex}` : undefined,
              }}
            />
            <span className="opacity-80">#{id.toUpperCase()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
