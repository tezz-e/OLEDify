import React, { useRef, useEffect } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
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

/**
 * LiquidStudioNav — Skiper46-style gooey mercury tab switcher.
 *
 * HOW THE GOO WORKS (Blueprint Eq. A):
 * - A feGaussianBlur (σ=8) blurs overlapping shapes.
 * - feColorMatrix amplifies alpha: α' = clamp(19α - 9, 0, 1).
 * - Where two blobs overlap and their combined α > 9/19 ≈ 0.474, the
 *   output becomes fully opaque — creating a liquid "neck" that looks
 *   like mercury droplets merging.
 *
 * CRITICAL: The goo-filtered container must have a SOLID OPAQUE background
 * color (not transparent) so that shapes have alpha to blur into each other.
 * The crisp text/icons layer floats ABOVE the filter on a higher z-index.
 */
export const LiquidStudioNav: React.FC<LiquidStudioNavProps> = ({
  activeView,
  onViewChange,
  themeMode = 'dark',
  className = '',
}) => {
  const isDark = themeMode === 'dark';
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverTab, setHoverTab] = React.useState<string | null>(null);

  // Motion values for the active pill's X position within the goo layer
  const pillX = useMotionValue(0);
  const springX = useSpring(pillX, HW_SPRINGS.mercuryMorph);

  // Move the pill to the correct slot when activeView changes
  useEffect(() => {
    const idx = TABS.findIndex((t) => t.id === activeView);
    // Each slot is ~50% of the total width; we shift by slot index
    pillX.set(idx * 100); // percentage offset — resolved in the pill's style
  }, [activeView, pillX]);

  const handleSelect = (id: 'editor' | 'lyrics-studio') => {
    if (id !== activeView) {
      triggerNativeHaptic(12);
      onViewChange(id);
    }
  };

  const accentColor = isDark ? '#00FF66' : '#1A1A1A';
  const accentGlow = isDark ? 'rgba(0,255,102,0.55)' : 'rgba(26,26,26,0.22)';

  return (
    <nav
      ref={containerRef}
      className={`relative inline-flex items-center select-none font-mono ${className}`}
      aria-label="Studio View Switcher"
    >
      {/*
       * ─── LAYER 1: GOO SUBSTRATE (filter applied here) ───────────────────────
       * This is an ISOLATED layer with a solid background so the SVG filter
       * has alpha to blur and threshold. It is purely visual — pointer-events none.
       *
       * The pill is a solid rounded div that physically moves (via spring X) between
       * the two tab positions. The anchor blobs at each tab center provide the
       * extra alpha "seed" so the liquid neck forms BEFORE the pill fully arrives.
       */}
      <div
        className="absolute inset-0 rounded-full overflow-hidden pointer-events-none"
        style={{
          filter: 'url(#hw-mercury-goo)',
          // The container itself must be the background — children are the goo shapes
          background: isDark ? 'rgba(8,8,10,0.95)' : 'rgba(246,246,244,0.95)',
        }}
      >
        {/* Anchor blobs at tab centers */}
        {TABS.map((tab, i) => (
          <div
            key={`anchor-${tab.id}`}
            className="absolute top-1/2 -translate-y-1/2"
            style={{
              left: `${(i * 100) / TABS.length + 100 / TABS.length / 2}%`,
              transform: 'translateX(-50%) translateY(-50%)',
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: accentColor,
              opacity: 0.35,
            }}
          />
        ))}

        {/* Central Mercury Bridge Droplet — swells dynamically when activeView changes
            creating the physical surface tension neck connecting the tabs */}
        <motion.div
          key={`bridge-${activeView}`}
          className="absolute top-1/2 left-1/2 rounded-full pointer-events-none"
          style={{
            background: accentColor,
          }}
          initial={{ width: 14, height: 14, x: '-50%', y: '-50%', opacity: 0.3 }}
          animate={{ width: 28, height: 20, x: '-50%', y: '-50%', opacity: 0.8 }}
          exit={{ width: 14, height: 14, x: '-50%', y: '-50%', opacity: 0.3 }}
          transition={{ type: 'spring', stiffness: 400, damping: 22 }}
        />

        {/* Active Morphing Mercury Pill */}
        <motion.div
          className="absolute top-1 bottom-1 rounded-full"
          style={{
            width: 'calc(50% - 4px)',
            background: accentColor,
            boxShadow: `0 0 20px ${accentGlow}`,
          }}
          animate={{
            left: activeView === 'editor' ? '3px' : 'calc(50% + 1px)',
          }}
          transition={{
            type: 'spring',
            stiffness: 340,
            damping: 24,
            mass: 0.45,
          }}
        />
      </div>

      {/*
       * ─── LAYER 2: CRISP INTERACTIVE BUTTONS ──────────────────────────────────
       * These sit on top (z-10) and are NOT affected by the SVG filter.
       * They handle all interactions and show sharp text/icons.
       */}
      <div
        className={`relative z-10 flex items-center p-1 rounded-full border backdrop-blur-xl transition-colors duration-200 ${
          isDark
            ? 'border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_4px_16px_rgba(0,0,0,0.8)]'
            : 'border-[#1A1A1A] shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_4px_12px_rgba(0,0,0,0.06)]'
        }`}
        style={{ background: 'transparent' }} // transparent so layer 1 shows through
      >
        {TABS.map((tab) => {
          const isActive = tab.id === activeView;
          const isHovered = hoverTab === tab.id;
          return (
            <motion.button
              key={tab.id}
              type="button"
              onClick={() => handleSelect(tab.id)}
              onMouseEnter={() => setHoverTab(tab.id)}
              onMouseLeave={() => setHoverTab(null)}
              whileTap={{ scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 450, damping: 24, mass: 0.1 }}
              className={`relative h-7 px-3.5 flex items-center gap-1.5 rounded-full text-[10px] font-bold tracking-wider uppercase cursor-pointer transition-colors duration-150 ${
                isActive
                  ? isDark
                    ? 'text-[#000000]'
                    : 'text-[#FFFFFF]'
                  : isDark
                  ? 'text-zinc-400'
                  : 'text-[#5E5D59]'
              }`}
            >
              {/* Hover glow for inactive tabs */}
              {!isActive && isHovered && (
                <motion.span
                  layoutId="hw-tab-hover-bg"
                  className={`absolute inset-0 rounded-full ${
                    isDark ? 'bg-white/8' : 'bg-black/6'
                  }`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                />
              )}

              <span className="select-none flex items-center relative z-10">
                {tab.icon}
              </span>
              <span className="relative z-10">{tab.label}</span>
              {tab.badge && (
                <motion.span
                  className={`text-[7px] px-1.5 py-0.5 rounded-full uppercase tracking-widest font-mono font-bold relative z-10 transition-colors ${
                    isActive
                      ? isDark
                        ? 'bg-black/20 text-black'
                        : 'bg-white/20 text-white'
                      : isDark
                      ? 'bg-white/10 text-white/60'
                      : 'bg-black/10 text-black/60'
                  }`}
                  animate={
                    isActive
                      ? { scale: [1, 1.1, 1] }
                      : { scale: 1 }
                  }
                  transition={{ duration: 0.3 }}
                >
                  {tab.badge}
                </motion.span>
              )}
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
};
