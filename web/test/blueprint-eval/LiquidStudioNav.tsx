import React from 'react';
import { motion } from 'framer-motion';
import { HW_SPRINGS } from './springPresets';
import { playHapticClick } from './hapticAudio';

export interface LiquidStudioNavProps {
  activeView: 'editor' | 'lyrics-studio';
  onViewChange: (view: 'editor' | 'lyrics-studio') => void;
  themeMode?: 'light' | 'dark';
  className?: string;
}

interface NavTab {
  id: 'editor' | 'lyrics-studio';
  label: string;
  icon: string;
  badge?: string;
}

const TABS: NavTab[] = [
  { id: 'editor', label: 'NLE TIMELINE', icon: '🎞️', badge: 'TRACKS' },
  { id: 'lyrics-studio', label: 'KINETIC LYRICS', icon: '✨', badge: 'AI DIRECTOR' },
];

export const LiquidStudioNav: React.FC<LiquidStudioNavProps> = ({
  activeView,
  onViewChange,
  themeMode = 'dark',
  className = '',
}) => {
  const isDark = themeMode === 'dark';

  const handleSelect = (id: 'editor' | 'lyrics-studio') => {
    if (id !== activeView) {
      playHapticClick(3400, 0.003); // Instant tactile micro-tick
      onViewChange(id);
    }
  };

  return (
    <nav
      className={`relative inline-flex items-center select-none font-mono ${className}`}
      aria-label="Studio View Switcher"
    >
      {/* 1. Underlying Liquid Mercury Gooey Surface with Dual Meniscus Geometry */}
      <div
        className="absolute inset-0 flex items-center p-1 pointer-events-none"
        style={{ filter: 'url(#hw-mercury-goo)' }}
      >
        {TABS.map((tab) => {
          const isActive = tab.id === activeView;
          return (
            <div key={`goo-${tab.id}`} className="flex-1 h-8 flex items-center justify-center relative">
              {/* Stationary meniscus anchor pad creates the coalescing droplet bridge */}
              <div
                className={`w-6 h-6 rounded-full transition-opacity duration-300 ${
                  isDark ? 'bg-[#00FF66]/40' : 'bg-[#FF5500]/40'
                }`}
              />

              {/* Active Morphing Mercury Pill */}
              {isActive && (
                <motion.div
                  layoutId="hw-liquid-nav-pill"
                  transition={HW_SPRINGS.mercuryMorph}
                  className={`absolute inset-0 rounded-full shadow-lg ${
                    isDark
                      ? 'bg-[#00FF66] shadow-[0_0_14px_rgba(0,255,102,0.5)]'
                      : 'bg-[#FF5500] shadow-[0_0_14px_rgba(255,85,0,0.4)]'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* 2. Crisp Interactive Button Cluster (Mounted above gooey filter to preserve 100% font sharpness) */}
      <div
        className={`relative z-10 flex items-center p-1 rounded-full border backdrop-blur-xl transition-colors duration-200 ${
          isDark
            ? 'bg-[#0A0A0C]/85 border-[#27272A] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_4px_16px_rgba(0,0,0,0.8)]'
            : 'bg-[#F6F6F4]/90 border-[#1A1A1A] shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_4px_12px_rgba(0,0,0,0.08)]'
        }`}
      >
        {TABS.map((tab) => {
          const isActive = tab.id === activeView;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleSelect(tab.id)}
              className={`relative h-8 px-4 flex items-center gap-2 rounded-full text-xs font-bold tracking-wider uppercase transition-colors duration-200 cursor-pointer ${
                isActive
                  ? isDark
                    ? 'text-[#000000]'
                    : 'text-[#FFFFFF]'
                  : isDark
                  ? 'text-[#A1A1AA] hover:text-[#FAFAFA]'
                  : 'text-[#5E5D59] hover:text-[#1A1A1A]'
              }`}
            >
              <span className="text-sm select-none">{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.badge && (
                <span
                  className={`text-[8px] px-1.5 py-0.2 rounded-full uppercase tracking-widest font-semibold transition-colors ${
                    isActive
                      ? isDark
                        ? 'bg-black/20 text-black'
                        : 'bg-white/25 text-white'
                      : isDark
                      ? 'bg-white/10 text-white/60'
                      : 'bg-black/10 text-black/60'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
