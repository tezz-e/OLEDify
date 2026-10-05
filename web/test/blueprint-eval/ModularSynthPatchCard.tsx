import React, { useState, useRef, useCallback, useEffect } from 'react';
import { playHapticClick } from './hapticAudio';

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
    playHapticClick(3200, 0.002);

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
    }, 30);
  };

  const handleMouseLeave = () => {
    clearTimer();
    setOpacity(0);
    setScrambleName(name);
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={() => {
        playHapticClick(2600, 0.005);
        onSelect(id);
      }}
      className={`relative rounded-[8px] p-3 font-mono cursor-pointer transition-all duration-150 select-none ${
        isDark ? 'bg-[#0E0E10] text-[#FAFAFA]' : 'bg-[#FFFFFF] text-[#1A1A1A]'
      } ${isSelected ? 'ring-1' : 'hover:shadow-lg'} ${className}`}
      style={{
        boxShadow: isSelected ? colors.activeGlow : undefined,
        borderColor: isSelected ? colors.accentHex : undefined,
      }}
    >
      {/* 1. Specular 1px Border via CSS Mask Composite */}
      <div
        className="pointer-events-none absolute -inset-[1px] rounded-[9px] transition-opacity duration-300"
        style={{
          opacity,
          padding: '1px',
          background: `radial-gradient(160px circle at ${mousePos.x}px ${mousePos.y}px, ${colors.specular}, transparent 70%)`,
          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
        }}
      />

      {/* 2. Inner Diffuse Glow Field */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[8px] transition-opacity duration-300"
        style={{
          opacity,
          background: `radial-gradient(280px circle at ${mousePos.x}px ${mousePos.y}px, ${colors.spotlight}, transparent 80%)`,
        }}
      />

      {/* 3. Base Hairline Border */}
      <div
        className={`pointer-events-none absolute inset-0 rounded-[8px] border ${
          isDark ? 'border-white/10' : 'border-black/10'
        }`}
      />

      {/* 4. Eurorack 3U Faceplate Layout */}
      <div className="relative z-10 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div
              className={`w-2 h-2 rounded-full border flex items-center justify-center ${
                isDark ? 'bg-[#27272A] border-[#3F3F46]' : 'bg-[#D1CFCA] border-[#1A1A1A]'
              }`}
            >
              <div className="w-1 h-[1px] bg-current opacity-40" />
            </div>
            <span className="text-base select-none">{icon}</span>
            <span className="text-xs font-bold tracking-wider uppercase">{scrambleName}</span>
          </div>

          <span
            className="text-[8px] px-1.5 py-0.5 rounded-[2px] uppercase font-bold tracking-widest"
            style={{
              backgroundColor: isSelected ? colors.accentHex : undefined,
              color: isSelected ? '#000000' : undefined,
            }}
          >
            {tag}
          </span>
        </div>

        <p className="text-[10px] opacity-70 line-clamp-2 leading-relaxed">
          {description}
        </p>

        <div className="flex items-center justify-between pt-1 border-t border-current/10 text-[8px] uppercase tracking-wider opacity-60">
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-full border-2 border-current bg-black/40" />
            <span>TRIG IN</span>
          </div>
          <div className="flex items-center gap-1">
            <span>OUT CV</span>
            <div className="w-2.5 h-2.5 rounded-full border-2 border-current bg-black/40" />
          </div>
        </div>
      </div>
    </div>
  );
};
