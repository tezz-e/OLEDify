import React from 'react';
import { motion } from 'framer-motion';
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
    <nav
      className={`relative inline-flex items-center p-1 rounded-[10px] bg-[var(--hw-bg-surface)] border border-white/[0.08] select-none font-sans ${className}`}
      aria-label="Studio View Switcher"
    >
      {TABS.map((tab) => {
        const isActive = tab.id === activeView;
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onViewChange(tab.id)}
            className={`relative h-8 px-3.5 flex items-center gap-2 rounded-[8px] text-xs font-sans font-medium transition-colors duration-150 z-10 cursor-pointer ${
              isActive ? 'text-[var(--hw-text-primary)] font-semibold' : 'text-[var(--hw-text-secondary)] hover:text-[var(--hw-text-primary)]'
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="heroTabSwitcherPill"
                transition={HW_SPRINGS.smooth}
                className="absolute inset-0 bg-white/[0.08] rounded-[8px] border-b-2 border-[#FF5500] z-[-1]"
              />
            )}

            <Icon className="w-3.5 h-3.5 shrink-0 stroke-[1.5]" />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
