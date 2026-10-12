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
  className = '',
}) => {
  return (
    <LayoutGroup id="studioNavGroup">
      <nav
        className={`relative inline-flex items-center p-1 rounded-full bg-[rgba(26,26,30,0.65)] backdrop-blur-xl border border-white/10 border-t-white/20 border-b-black/40 shadow-[0_8px_24px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.15)] select-none font-sans ${className}`}
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
                isActive ? 'text-[#FAFAFA] font-medium' : 'text-[var(--hw-text-secondary)] hover:text-[var(--hw-text-primary)]'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="heroTabSwitcherPill"
                  transition={HW_SPRINGS.smooth}
                  className="absolute inset-0 rounded-full bg-white/[0.12] backdrop-blur-md border border-white/20 border-t-white/40 border-b-black/30 shadow-[0_4px_16px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.25)] z-[-1]"
                />
              )}

              <Icon className="w-3.5 h-3.5 shrink-0 stroke-[1.5]" />
              <span className={isActive ? 'font-ndot tracking-wide uppercase text-[11px]' : 'text-xs'}>{tab.label}</span>
            </motion.button>
          );
        })}
      </nav>
    </LayoutGroup>
  );
};
