import React from 'react';
import { motion } from 'framer-motion';
import { Film, Sparkles } from 'lucide-react';
import { HW_SPRINGS } from '../../theme/springPresets';
import { triggerNativeHaptic } from '../../theme/haptics';

export interface LiquidStudioNavProps {
  activeView: 'editor' | 'lyrics-studio';
  onViewChange: (view: 'editor' | 'lyrics-studio') => void;
  themeMode?: 'light' | 'dark';
  className?: string;
}

interface NavTab {
  id: 'editor' | 'lyrics-studio';
  label: string;
  icon: React.ReactNode;
  badge?: string;
}

const TABS: NavTab[] = [
  { id: 'editor', label: 'NLE TIMELINE', icon: <Film className="w-3.5 h-3.5" />, badge: 'TRACKS' },
  { id: 'lyrics-studio', label: 'KINETIC LYRICS', icon: <Sparkles className="w-3.5 h-3.5" />, badge: 'AI DIRECTOR' },
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
      triggerNativeHaptic(12);
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
                  isDark ? 'bg-[#00FF66]/35' : 'bg-[#E85D2A]/30'
                }`}
              />

              {/* Active Morphing Mercury Pill */}
              {isActive && (
                <motion.div
                  layoutId="hw-liquid-nav-pill"
                  transition={HW_SPRINGS.mercuryMorph}
                  className={`absolute inset-0 rounded-full shadow-lg ${
                    isDark
                      ? 'bg-[#00FF66] shadow-[0_0_16px_rgba(0,255,102,0.45)]'
                      : 'bg-[#1A1A1A] shadow-[0_2px_8px_rgba(0,0,0,0.25)]'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* 2. Crisp Interactive Button Cluster (Preserves 100% font sharpness above gooey filter) */}
      <div
        className={`relative z-10 flex items-center p-1 rounded-full border backdrop-blur-xl transition-colors duration-200 ${
          isDark
            ? 'bg-[#08080A]/85 border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_4px_16px_rgba(0,0,0,0.8)]'
            : 'bg-[#F6F6F4]/90 border-[#1A1A1A] shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_4px_12px_rgba(0,0,0,0.06)]'
        }`}
      >
        {TABS.map((tab) => {
          const isActive = tab.id === activeView;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleSelect(tab.id)}
              className={`relative h-7 px-3.5 flex items-center gap-1.5 rounded-full text-[10px] font-bold tracking-wider uppercase transition-colors duration-200 cursor-pointer ${
                isActive
                  ? isDark
                    ? 'text-[#000000]'
                    : 'text-[#FFFFFF]'
                  : isDark
                  ? 'text-zinc-400 hover:text-white'
                  : 'text-[#5E5D59] hover:text-[#1A1A1A]'
              }`}
            >
              <span className="select-none flex items-center">{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.badge && (
                <span
                  className={`text-[7px] px-1.5 py-0.5 rounded-full uppercase tracking-widest font-mono font-bold transition-colors ${
                    isActive
                      ? isDark
                        ? 'bg-black/20 text-black'
                        : 'bg-white/20 text-white'
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
