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
  { id: 'editor', label: 'NLE TIMELINE', icon: Film, badge: 'TRACKS' },
  { id: 'lyrics-studio', label: 'KINETIC LYRICS', icon: Sparkles, badge: 'AI DIRECTOR' },
];

/**
 * Hero Moment 1: Tab Switcher
 * Flat, hard-edged solid amber pill with black text that slides via layoutId smooth spring.
 * Inactive tabs render secondary text (#A1A1AA). Hard bans: No blur, no glow, no gooey SVG filter.
 */
export const LiquidStudioNav: React.FC<LiquidStudioNavProps> = ({
  activeView,
  onViewChange,
  className = '',
}) => {
  return (
    <nav
      className={`relative inline-flex items-center p-0.5 rounded-[4px] bg-[#202225] border border-white/10 select-none font-mono ${className}`}
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
            className={`relative h-7 px-3 flex items-center gap-1.5 rounded-[4px] text-[10px] font-mono font-medium tracking-wide uppercase transition-colors duration-150 z-10 cursor-pointer ${
              isActive ? 'text-[#000000] font-bold' : 'text-[#A1A1AA] hover:text-[#FAFAFA]'
            }`}
          >
            {/* Hero Moment 1: Flat solid amber sliding pill */}
            {isActive && (
              <motion.div
                layoutId="heroTabSwitcherPill"
                transition={HW_SPRINGS.smooth}
                className="absolute inset-0 bg-[#FF5500] rounded-[4px] z-[-1]"
              />
            )}

            <Icon className="w-3.5 h-3.5 shrink-0 stroke-[1.5]" />
            <span>{tab.label}</span>

            {tab.badge && (
              <span
                className={`text-[9px] px-1 py-0.2 rounded-[2px] font-mono font-medium transition-colors ${
                  isActive ? 'bg-black/20 text-[#000000]' : 'bg-white/5 text-[#71717A]'
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
};
