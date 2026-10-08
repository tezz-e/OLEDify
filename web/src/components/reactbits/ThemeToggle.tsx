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
 * - Precision hardware shadows (deep ambient occlusion with specular rim in dark, `#1A1A1A` in light)
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
      sparkColor={isDark ? '#00FF66' : '#E85D2A'}
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
        aria-label={isDark ? 'Switch to Blueprint Light Mode' : 'Switch to Precision Hardware Dark Mode'}
        title={isDark ? 'Switch to Blueprint Light Mode' : 'Switch to Precision Hardware Dark Mode'}
        onClick={onToggle}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.94 }}
        style={{
          width: trackWidth,
          height: trackHeight,
        }}
        className={`relative inline-flex items-center p-0.5 rounded-full border cursor-pointer select-none transition-colors duration-250 focus:outline-none focus-visible:ring-2 ${
          isDark
            ? 'bg-[#08080A] border-white/20 focus-visible:ring-[#00FF66] hover:border-white/40 shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)]'
            : 'bg-[#ECE6DE] border-[#1A1A1A] focus-visible:ring-[#E85D2A] hover:border-[#E85D2A] shadow-[inset_0_1px_2px_rgba(0,0,0,0.08)]'
        } ${className}`}
      >
        {/* Background Decorative Diode Dot in Dark Mode */}
        <AnimatePresence>
          {isDark && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 pointer-events-none overflow-hidden rounded-full"
            >
              <span className="absolute top-[8px] left-[10px] w-[2.5px] h-[2.5px] rounded-full bg-[#00FF66]/60 shadow-[0_0_4px_#00FF66]" />
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
              ? 'bg-[#18181C] border-white/20 shadow-[0_2px_8px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.2)]'
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
                className="w-3.5 h-3.5 text-[#00FF66] fill-[#00FF66]/20 filter drop-shadow-[0_0_4px_rgba(0,255,102,0.6)]" 
                strokeWidth={2}
              />
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
                isDark ? 'opacity-35 text-[#71717A]' : 'opacity-0 text-[#E85D2A]'
              }`} 
              strokeWidth={1.8}
            />
          </div>

          {/* Right: Moon Slot */}
          <div className="flex items-center justify-center w-5 h-5">
            <Moon 
              className={`w-3 h-3 transition-opacity duration-200 ${
                isDark ? 'opacity-0 text-[#00FF66]' : 'opacity-35 text-[#8A847C]'
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
