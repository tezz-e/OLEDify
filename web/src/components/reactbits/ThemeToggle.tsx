import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';
import { ClickSpark } from './ClickSpark';

export interface ThemeToggleProps {
  themeMode: 'light' | 'dark';
  onToggle: () => void;
  className?: string;
  size?: 'sm' | 'md';
}

/**
 * Skiper UI & React Bits ThemeToggle
 * 
 * Features:
 * - Fluid Framer Motion spring sliding pill with `layoutId` physics
 * - Dynamic Sun ray rotation and warm terracotta amber glow in Light mode
 * - Cyber Cyan crescent moon with glowing twinkle stars in Dark mode
 * - Neobrutal offset drop shadows (`#FF2A85` bubblegum pink in dark, `#1A1A1A` in light)
 * - ClickSpark micro-particle burst upon theme switch
 * - Tactile whileTap and whileHover squash & stretch
 * - Full accessibility with role="switch" and aria-checked
 */
export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  themeMode,
  onToggle,
  className = '',
  size = 'md'
}) => {
  const isDark = themeMode === 'dark';

  const isSmall = size === 'sm';
  const trackWidth = isSmall ? 62 : 68;
  const trackHeight = isSmall ? 28 : 32;
  const thumbWidth = isSmall ? 27 : 30;
  const thumbHeight = isSmall ? 22 : 26;

  return (
    <ClickSpark
      sparkColor={isDark ? '#00F0FF' : '#E85D2A'}
      sparkCount={10}
      sparkSize={6}
      sparkRadius={20}
      duration={320}
      className="inline-block"
    >
      <motion.button
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label={isDark ? 'Switch to Blueprint Light Mode' : 'Switch to Arcade Neo-Pop Dark Mode'}
        title={isDark ? 'Switch to Blueprint Light Mode' : 'Switch to Arcade Neo-Pop Dark Mode'}
        onClick={onToggle}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.94 }}
        style={{
          width: trackWidth,
          height: trackHeight,
        }}
        className={`relative inline-flex items-center p-0.5 rounded-full border cursor-pointer select-none transition-colors duration-250 focus:outline-none focus-visible:ring-2 ${
          isDark
            ? 'bg-[#140F24] border-[#2D2344] focus-visible:ring-[#00F0FF] hover:border-[#00F0FF]/60 shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)]'
            : 'bg-[#ECE6DE] border-[#1A1A1A] focus-visible:ring-[#E85D2A] hover:border-[#E85D2A] shadow-[inset_0_1px_2px_rgba(0,0,0,0.08)]'
        } ${className}`}
      >
        {/* Background Decorative Starlight Dots in Dark Mode */}
        <AnimatePresence>
          {isDark && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 pointer-events-none overflow-hidden rounded-full"
            >
              <span className="absolute top-[6px] left-[10px] w-[2px] h-[2px] rounded-full bg-[#00F0FF]/40" />
              <span className="absolute bottom-[7px] left-[18px] w-[1.5px] h-[1.5px] rounded-full bg-[#E2FF00]/50" />
              <span className="absolute top-[8px] right-[10px] w-[2px] h-[2px] rounded-full bg-[#FF2A85]/40" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sliding Tactile Thumb Pill */}
        <motion.div
          layout
          transition={{
            type: 'spring',
            stiffness: 480,
            damping: 28,
            mass: 0.6
          }}
          style={{
            width: thumbWidth,
            height: thumbHeight,
            left: isDark ? trackWidth - thumbWidth - 3 : 3,
          }}
          className={`absolute rounded-full flex items-center justify-center border transition-shadow duration-200 z-10 ${
            isDark
              ? 'bg-[#1D1633] border-[#00F0FF] shadow-[2px_2px_0_0_#FF2A85]'
              : 'bg-white border-[#1A1A1A] shadow-[1.5px_1.5px_0_0_#1A1A1A]'
          }`}
        >
          {isDark ? (
            /* Dark Mode Active Moon Icon + Twinkling Micro Star */
            <motion.div
              key="dark-thumb"
              initial={{ rotate: -40, scale: 0.6 }}
              animate={{ rotate: 0, scale: 1 }}
              exit={{ rotate: 40, scale: 0.6 }}
              transition={{ type: 'spring', stiffness: 400, damping: 22 }}
              className="relative flex items-center justify-center w-full h-full"
            >
              <Moon 
                className="w-3.5 h-3.5 text-[#00F0FF] fill-[#00F0FF]/15 filter drop-shadow-[0_0_4px_rgba(0,240,255,0.7)]" 
                strokeWidth={2}
              />
              {/* Twinkling micro-star beside the moon */}
              <motion.span
                animate={{
                  scale: [0.8, 1.25, 0.8],
                  opacity: [0.6, 1, 0.6]
                }}
                transition={{
                  repeat: Infinity,
                  duration: 2.2,
                  ease: 'easeInOut'
                }}
                className="absolute top-1 right-1.5 text-[8px] leading-none text-[#E2FF00] font-mono pointer-events-none select-none"
              >
                ✦
              </motion.span>
            </motion.div>
          ) : (
            /* Light Mode Active Sun Icon */
            <motion.div
              key="light-thumb"
              initial={{ rotate: 60, scale: 0.6 }}
              animate={{ rotate: 0, scale: 1 }}
              exit={{ rotate: -60, scale: 0.6 }}
              transition={{ type: 'spring', stiffness: 400, damping: 22 }}
              className="flex items-center justify-center w-full h-full"
            >
              <Sun 
                className="w-3.5 h-3.5 text-[#E85D2A] fill-[#E85D2A]/20" 
                strokeWidth={2.2}
              />
            </motion.div>
          )}
        </motion.div>

        {/* Static Background Icons for Inactive State Contrast */}
        <div className="w-full flex items-center justify-between px-2 pointer-events-none">
          {/* Left: Sun Slot */}
          <div className="flex items-center justify-center w-5 h-5">
            <Sun 
              className={`w-3 h-3 transition-opacity duration-200 ${
                isDark ? 'opacity-35 text-[#7E7694]' : 'opacity-0 text-[#E85D2A]'
              }`} 
              strokeWidth={1.8}
            />
          </div>

          {/* Right: Moon Slot */}
          <div className="flex items-center justify-center w-5 h-5">
            <Moon 
              className={`w-3 h-3 transition-opacity duration-200 ${
                isDark ? 'opacity-0 text-[#00F0FF]' : 'opacity-35 text-[#8A847C]'
              }`} 
              strokeWidth={1.8}
            />
          </div>
        </div>
      </motion.button>
    </ClickSpark>
  );
};

export default ThemeToggle;
