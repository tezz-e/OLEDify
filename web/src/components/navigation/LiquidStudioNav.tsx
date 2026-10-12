import React from 'react';
import { motion, LayoutGroup } from 'framer-motion';
import { Film, Sparkles } from 'lucide-react';
import { HW_SPRINGS } from '../../theme/springPresets';

export interface LiquidStudioNavProps {
  activeView: 'editor' | 'lyrics-studio';
  onViewChange: (view: 'editor' | 'lyrics-studio') => void;
  themeMode?: 'light' | 'dark';
  className?: string;
}

interface NavTab {
  id: 'editor' | 'lyrics-studio';
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const TABS: NavTab[] = [
  { id: 'editor', label: 'Timeline', icon: Film },
  { id: 'lyrics-studio', label: 'Kinetic lyrics', icon: Sparkles },
];

/**
 * Tab Switcher
 * Flat solid amber pill for active state with black text that slides via layoutId spring.
 * Inactive tabs render secondary text (#A1A1AA).
 */
export const LiquidStudioNav: React.FC<LiquidStudioNavProps> = ({
  activeView,
  onViewChange,
  themeMode,
  className = '',
}) => {
  const isDark = themeMode
    ? themeMode === 'dark'
    : (typeof document !== 'undefined'
        ? !document.documentElement.classList.contains('light') &&
          (document.documentElement.classList.contains('dark') || document.documentElement.getAttribute('data-theme') !== 'light')
        : true);

  return (
    <LayoutGroup id="studioNavGroup">
      <nav
        className={`relative inline-flex items-center p-1 rounded-full backdrop-blur-xl border select-none font-sans transition-colors duration-200 ${
          isDark
            ? 'bg-[rgba(26,26,30,0.65)] border-white/10 border-t-white/20 border-b-black/40 shadow-[0_8px_24px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.15)]'
            : 'bg-[#E3E1DA]/80 border-black/10 border-t-white/80 border-b-black/15 shadow-[0_4px_16px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.9)]'
        } ${className}`}
        aria-label="Studio View Switcher"
      >
        {TABS.map((tab) => {
          const isActive = tab.id === activeView;
          const Icon = tab.icon;

          return (
            <motion.button
              key={tab.id}
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={() => onViewChange(tab.id)}
              className={`relative h-7 px-3.5 flex items-center gap-2 rounded-full text-xs font-sans transition-colors duration-200 z-10 cursor-pointer ${
                isActive
                  ? isDark
                    ? 'text-[#FAFAFA] font-medium'
                    : 'text-[#18181A] font-semibold'
                  : isDark
                    ? 'text-[#A1A1AA] hover:text-[#FAFAFA]'
                    : 'text-[#3F3F46] hover:text-[#09090B]'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="heroTabSwitcherPill"
                  transition={HW_SPRINGS.smooth}
                  className={`absolute inset-0 rounded-full border z-[-1] ${
                    isDark
                      ? 'bg-white/[0.12] backdrop-blur-md border-white/20 border-t-white/40 border-b-black/30 shadow-[0_4px_16px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.25)]'
                      : 'bg-white border-black/10 border-t-white shadow-[0_2px_8px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,1)]'
                  }`}
                />
              )}

              <Icon className="w-3.5 h-3.5 shrink-0 stroke-[1.5]" />
              <span className={isActive ? 'font-ndot tracking-wide uppercase text-[11px]' : 'text-xs font-medium'}>{tab.label}</span>
            </motion.button>
          );
        })}
      </nav>
    </LayoutGroup>
  );
};
