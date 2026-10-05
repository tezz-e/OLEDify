import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import { Play, Pause, SkipBack, SkipForward, RotateCcw, Repeat, Zap } from 'lucide-react';
import { HW_SPRINGS } from '../../theme/springPresets';
import { triggerNativeHaptic } from '../../theme/haptics';
import { ClickSpark } from '../reactbits/ClickSpark';
import { DockGlowColor, DOCK_GLOW_PRESETS } from '../../theme/aestheticConfig';

export interface FloatingTransportDockProps {
  // Common & NLE Props
  isPlaying: boolean;
  onTogglePlay: () => void;
  currentFrame?: number;
  totalFrames?: number;
  targetFps?: number;
  onFpsChange?: (fps: number) => void;
  fpsOptions?: number[];
  onFrameSeek?: (frame: number) => void;
  onReset: () => void;
  docked?: boolean;

  // Dual-Mode Audio/Lyrics Props
  mode?: 'nle' | 'audio-lyrics';
  playheadMs?: number;
  durationMs?: number;
  onSeekMs?: (ms: number) => void;
  isLooping?: boolean;
  onToggleLoop?: () => void;
  scrubScope?: 'selection' | 'full';
  onScrubScopeChange?: (scope: 'selection' | 'full') => void;
  bpm?: number;
  isLiveBeat?: boolean;

  // Hardware Status
  serialConnected?: boolean;
  portName?: string;
  baudRate?: number;
  themeMode?: 'light' | 'dark';
  className?: string;

  // Custom Glow Colorway
  initialGlowColor?: DockGlowColor;
  onGlowColorChange?: (color: DockGlowColor) => void;
}

/**
 * MagneticButton — wraps any child in Blueprint Eq. C magnetic pull + spring snap-back.
 * T(d) = (D/S) * (1 - d^2/R_act^2) when d <= R_act
 */
function MagneticButton({
  children,
  className,
  onClick,
  title,
  stiffness = 3.5,
  padding = 20,
  type = 'button',
  style,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  title?: string;
  stiffness?: number;
  padding?: number;
  type?: 'button' | 'submit' | 'reset';
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const springConfig = { stiffness: 280, damping: 18, mass: 0.4 };
  const x = useSpring(rawX, springConfig);
  const y = useSpring(rawY, springConfig);

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      const rAct = Math.max(rect.width, rect.height) / 2 + padding;
      if (d <= rAct) {
        const force = 1 - (d * d) / (rAct * rAct);
        rawX.set((dx / stiffness) * force);
        rawY.set((dy / stiffness) * force);
      } else {
        rawX.set(0);
        rawY.set(0);
      }
    },
    [stiffness, padding, rawX, rawY]
  );

  const onMouseLeave = useCallback(() => {
    rawX.set(0);
    rawY.set(0);
  }, [rawX, rawY]);

  return (
    <motion.button
      ref={ref}
      type={type}
      onClick={onClick}
      title={title}
      style={{ x, y, ...style }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      whileTap={{ scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 500, damping: 28, mass: 0.1 }}
      className={className}
    >
      {children}
    </motion.button>
  );
}

/**
 * DynamicIslandEqualizer — Apple-style animated audio bars inside the island
 * that dance during playback, settling to calm dots when paused.
 */
function DynamicIslandEqualizer({ isPlaying, accent }: { isPlaying: boolean; accent: string }) {
  return (
    <div className="flex items-center gap-[2.5px] h-3 px-1 select-none pointer-events-none">
      {[0, 1, 2, 3].map((i) => (
        <motion.span
          key={i}
          className="w-[2px] rounded-full origin-bottom"
          style={{ background: accent }}
          animate={
            isPlaying
              ? {
                  height: [
                    `${3 + (i % 2) * 3}px`,
                    `${11 - (i % 3) * 3}px`,
                    `${5 + ((i + 1) % 3) * 3}px`,
                    `${13 - (i % 2) * 5}px`,
                    `${3 + (i % 2) * 3}px`,
                  ],
                  opacity: [0.75, 1, 0.85, 1, 0.75],
                }
              : { height: '3px', opacity: 0.3 }
          }
          transition={
            isPlaying
              ? {
                  duration: 0.55 + i * 0.12,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: i * 0.08,
                }
              : { duration: 0.2 }
          }
        />
      ))}
    </div>
  );
}

/**
 * PlayButtonMagnetic — Skiper 3 Apple Play Button with gooey pulse aura,
 * magnetic cursor tracking, and ClickSpark neon micro-particles.
 */
function PlayButtonMagnetic({
  isPlaying,
  isDark,
  accent,
  glowRgba,
  onToggle,
}: {
  isPlaying: boolean;
  isDark: boolean;
  accent: string;
  glowRgba: string;
  onToggle: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, { stiffness: 300, damping: 20, mass: 0.3 });
  const y = useSpring(rawY, { stiffness: 300, damping: 20, mass: 0.3 });

  const onMM = useCallback((e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    const d = Math.sqrt(dx * dx + dy * dy);
    const rAct = 36;
    if (d <= rAct) {
      const force = 1 - (d * d) / (rAct * rAct);
      rawX.set((dx / 2.8) * force);
      rawY.set((dy / 2.8) * force);
    }
  }, [rawX, rawY]);

  const onML = useCallback(() => { rawX.set(0); rawY.set(0); }, [rawX, rawY]);

  return (
    <div className="relative flex items-center justify-center shrink-0">
      {/* Dynamic Island Gooey expanding pulse halo when playing */}
      <AnimatePresence>
        {isPlaying && (
          <motion.span
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: [1, 1.4, 1], opacity: [0.55, 0, 0.55] }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
            className="absolute -inset-1.5 rounded-full pointer-events-none"
            style={{
              background: glowRgba,
              filter: 'blur(3px)',
            }}
          />
        )}
      </AnimatePresence>

      <ClickSpark sparkColor={accent} sparkCount={8} sparkRadius={24} duration={400}>
        <motion.button
          ref={ref}
          type="button"
          onClick={onToggle}
          style={{
            x,
            y,
            backgroundColor: isPlaying ? accent : undefined,
            color: isPlaying ? (accent === '#FFFFFF' || !isDark ? '#000000' : '#000000') : undefined,
            boxShadow: isPlaying ? `0 0 20px ${glowRgba}, 0 0 40px ${glowRgba}` : undefined,
          }}
          onMouseMove={onMM}
          onMouseLeave={onML}
          whileHover={{ scale: 1.12 }}
          whileTap={{ scale: 0.86 }}
          transition={HW_SPRINGS.tactileTap}
          className={`w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-colors relative z-10 ${
            isPlaying
              ? ''
              : isDark
              ? 'bg-white text-black shadow-[0_2px_8px_rgba(0,0,0,0.5)]'
              : 'bg-black text-white shadow-[0_2px_8px_rgba(0,0,0,0.2)]'
          }`}
          title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={isPlaying ? 'pause' : 'play'}
              initial={{ scale: 0.5, opacity: 0, rotate: isPlaying ? -20 : 20 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.5, opacity: 0, rotate: isPlaying ? 20 : -20 }}
              transition={{ type: 'spring', stiffness: 450, damping: 22 }}
              className="flex items-center justify-center"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-black text-black" />
              ) : (
                <Play className={`w-4 h-4 ${isDark ? 'fill-black text-black' : 'fill-white text-white'} ml-0.5`} />
              )}
            </motion.span>
          </AnimatePresence>
        </motion.button>
      </ClickSpark>
    </div>
  );
}

/**
 * GooeyStatusBlob — Skiper Gooey Blobs style dynamic indicator
 * Two microscopic cells that coalesce and pulse organically.
 */
function GooeyStatusBlob({ active, accent }: { active: boolean; accent: string }) {
  const color = active ? accent : '#71717A';
  return (
    <div className="relative flex items-center justify-center w-3 h-3">
      {active ? (
        <div className="relative flex items-center justify-center">
          <motion.span
            className="w-2 h-2 rounded-full absolute"
            style={{ backgroundColor: color }}
            animate={{
              scale: [1, 1.3, 0.9, 1.2, 1],
              boxShadow: [
                `0 0 6px ${color}`,
                `0 0 12px ${color}`,
                `0 0 6px ${color}`,
              ],
            }}
            transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
          />
          <motion.span
            className="w-1.5 h-1.5 rounded-full absolute"
            style={{ backgroundColor: color }}
            animate={{
              x: [-2, 3, -1, 2, -2],
              opacity: [0.8, 0.4, 0.9, 0.5, 0.8],
            }}
            transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
          />
        </div>
      ) : (
        <span className="w-1.5 h-1.5 rounded-full bg-[#71717A]" />
      )}
    </div>
  );
}

/**
 * GlowPaletteToggle — Interactive colorway picker for the dock.
 * Shows a compact clickable pill with the 6 color dots.
 */
function GlowPaletteToggle({
  activeColor,
  onSelectColor,
  isDark,
}: {
  activeColor: DockGlowColor;
  onSelectColor: (c: DockGlowColor) => void;
  isDark: boolean;
}) {
  const [hoveredColor, setHoveredColor] = useState<DockGlowColor | null>(null);
  const colorKeys = Object.keys(DOCK_GLOW_PRESETS) as DockGlowColor[];

  return (
    <div
      className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-[9px] font-bold tracking-wider shrink-0 z-10 select-none transition-all ${
        isDark ? 'bg-[#121214] border-white/10' : 'bg-[#E8E6E1] border-[#1A1A1A]'
      }`}
      title="Dock Glow Colorway (Click to test)"
    >
      <span className="text-[8px] uppercase opacity-40 mr-1 tracking-widest hidden md:inline">
        GLOW:
      </span>
      <div className="flex items-center gap-1.5">
        {colorKeys.map((key) => {
          const preset = DOCK_GLOW_PRESETS[key];
          const isSelected = activeColor === key;
          const isHov = hoveredColor === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectColor(key)}
              onMouseEnter={() => setHoveredColor(key)}
              onMouseLeave={() => setHoveredColor(null)}
              title={`${preset.label}${isSelected ? ' (Active)' : ''}`}
              className="relative p-0.5 rounded-full cursor-pointer focus:outline-none transition-transform"
              style={{
                transform: isSelected || isHov ? 'scale(1.25)' : 'scale(0.9)',
              }}
            >
              <span
                className="block w-2.5 h-2.5 rounded-full transition-all duration-200"
                style={{
                  backgroundColor: preset.dotColor,
                  boxShadow: isSelected
                    ? `0 0 10px ${preset.dotColor}, 0 0 2px #FFFFFF`
                    : isHov
                    ? `0 0 6px ${preset.dotColor}`
                    : 'none',
                  opacity: isSelected ? 1 : isHov ? 0.9 : 0.45,
                  border: isSelected ? '1px solid #FFFFFF' : 'none',
                }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export const FloatingTransportDock: React.FC<FloatingTransportDockProps> = ({
  isPlaying,
  onTogglePlay,
  currentFrame = 0,
  totalFrames = 0,
  targetFps = 30,
  onFpsChange,
  fpsOptions = [15, 24, 30, 60],
  onFrameSeek,
  onReset,
  docked = false,
  mode = 'nle',
  playheadMs,
  durationMs,
  onSeekMs,
  isLooping = false,
  onToggleLoop,
  scrubScope,
  onScrubScopeChange,
  bpm,
  isLiveBeat = false,
  serialConnected = false,
  portName = 'COM12',
  baudRate = 921600,
  themeMode = 'dark',
  className = '',
  initialGlowColor = 'green',
  onGlowColorChange,
}) => {
  const isDark = themeMode === 'dark';

  // Glow Colorway State (persisted in localStorage for instant testing)
  const [glowColor, setGlowColor] = useState<DockGlowColor>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('oled_dock_glow');
      if (saved && saved in DOCK_GLOW_PRESETS) {
        return saved as DockGlowColor;
      }
    }
    return initialGlowColor || 'green';
  });

  const handleSelectGlowColor = (color: DockGlowColor) => {
    triggerNativeHaptic(12);
    setGlowColor(color);
    if (typeof window !== 'undefined') {
      localStorage.setItem('oled_dock_glow', color);
    }
    if (onGlowColorChange) {
      onGlowColorChange(color);
    }
  };

  const currentPreset = DOCK_GLOW_PRESETS[glowColor] || DOCK_GLOW_PRESETS.green;
  const activeGlowTheme = isDark ? currentPreset.dark : currentPreset.light;
  const accent = activeGlowTheme.accent;

  const dockRef = useRef<HTMLElement>(null);

  // 3D Inertial tilt springs driven by cursor proximity
  const rawTiltX = useMotionValue(0);
  const rawTiltY = useMotionValue(0);
  const springRotateX = useSpring(rawTiltX, { stiffness: 240, damping: 22, mass: 0.28 });
  const springRotateY = useSpring(rawTiltY, { stiffness: 240, damping: 22, mass: 0.28 });

  // Floating magnetic translation (followPointer physics)
  const rawFloatX = useMotionValue(0);
  const rawFloatY = useMotionValue(0);
  const springFloatX = useSpring(rawFloatX, { stiffness: 280, damping: 24, mass: 0.35 });
  const springFloatY = useSpring(rawFloatY, { stiffness: 280, damping: 24, mass: 0.35 });

  // Gelatinous aspect squish & stretch (fluid glass physics)
  const rawScaleX = useMotionValue(1);
  const rawScaleY = useMotionValue(1);
  const springScaleX = useSpring(rawScaleX, { stiffness: 320, damping: 25, mass: 0.22 });
  const springScaleY = useSpring(rawScaleY, { stiffness: 320, damping: 25, mass: 0.22 });

  // Real-time cursor coordinates inside dock for specular light highlight beam
  const [localCursor, setLocalCursor] = useState<{ x: number; y: number } | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  const handleDockMouseMove = (e: React.MouseEvent) => {
    if (!dockRef.current) return;
    setIsHovered(true);
    const rect = dockRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const normX = Math.max(-1, Math.min(1, dx / (rect.width / 2)));
    const normY = Math.max(-1, Math.min(1, dy / (rect.height / 2)));

    // 1. Physical 3D tilt
    rawTiltX.set(-normY * 2.6);
    rawTiltY.set(normX * 2.6);

    // 2. Magnetic followPointer displacement (±14px horizontally, ±5px vertically with -3px buoyant lift)
    rawFloatX.set(normX * 14);
    rawFloatY.set(normY * 5 - 4);

    // 3. Gelatinous liquid stretch along movement axis (fluid glass aspect squish)
    const stretch = Math.abs(normX) * 0.024;
    rawScaleX.set(1 + stretch);
    rawScaleY.set(1 - stretch * 0.75);

    setLocalCursor({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleDockMouseLeave = () => {
    setIsHovered(false);
    rawTiltX.set(0);
    rawTiltY.set(0);
    rawFloatX.set(0);
    rawFloatY.set(0);
    rawScaleX.set(1);
    rawScaleY.set(1);
    setLocalCursor(null);
  };

  // Frame math
  const maxFrames = Math.max(0, totalFrames - 1);
  const safeFrame = Math.min(Math.max(0, currentFrame), maxFrames);

  // Sub-frame calculation using integer millisecond arithmetic (Blueprint Eq. F)
  const totalMs = mode === 'audio-lyrics' && playheadMs !== undefined
    ? Math.round(playheadMs)
    : Math.round((safeFrame / targetFps) * 1000);

  const mins = Math.floor(totalMs / 60000);
  const secs = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;

  const totalDurationMs = mode === 'audio-lyrics' && durationMs !== undefined
    ? Math.round(durationMs)
    : Math.round((maxFrames / targetFps) * 1000);

  const totMins = Math.floor(totalDurationMs / 60000);
  const totSecs = Math.floor((totalDurationMs % 60000) / 1000);
  const totMs = totalDurationMs % 1000;

  const pad2 = (n: number) => String(n).padStart(2, '0');
  const pad3 = (n: number) => String(n).padStart(3, '0');

  const formattedTime = `${pad2(mins)}:${pad2(secs)}.${pad3(ms)}`;
  const formattedTotal = `${pad2(totMins)}:${pad2(totSecs)}.${pad3(totMs)}`;

  const handlePlayToggle = () => {
    triggerNativeHaptic(15);
    onTogglePlay();
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (mode === 'audio-lyrics' && onSeekMs) {
      onSeekMs(val);
    } else if (onFrameSeek) {
      onFrameSeek(Math.round(val));
    }
  };

  const stepFrame = (delta: number) => {
    triggerNativeHaptic(8);
    if (onFrameSeek) {
      onFrameSeek(Math.min(maxFrames, Math.max(0, safeFrame + delta)));
    }
  };

  // Scrub progress percentage for custom track styling
  const scrubMax = mode === 'audio-lyrics' ? (durationMs || 1000) : maxFrames;
  const scrubVal = mode === 'audio-lyrics' ? (playheadMs || 0) : safeFrame;
  const scrubPct = scrubMax > 0 ? (scrubVal / scrubMax) * 100 : 0;

  // Dynamic Island inner dock classes
  const isExpanded = isHovered || isPlaying;
  const innerClasses = docked
    ? `relative w-full px-4 py-2 rounded-xl border flex items-center justify-between gap-4 select-none font-mono transition-all duration-300 ${
        isDark
          ? 'bg-[#08080A] border-white/10 text-[#FAFAFA]'
          : 'bg-[#F6F6F4] border-[#1A1A1A] text-[#1A1A1A]'
      } ${className}`
    : `pointer-events-auto rounded-full border flex items-center select-none font-mono backdrop-blur-2xl transition-all duration-300 ${
        isExpanded ? 'px-6 py-2.5 gap-4' : 'px-4 py-2 gap-3'
      } ${
        isDark
          ? isPlaying
            ? 'bg-[#08080A]/95 text-[#FAFAFA]'
            : isHovered
            ? 'bg-[#08080A]/95 text-[#FAFAFA]'
            : 'bg-[#08080A]/90 text-[#FAFAFA]'
          : isPlaying
          ? 'bg-[#F6F6F4]/98 text-[#1A1A1A]'
          : isHovered
          ? 'bg-[#F6F6F4]/98 text-[#1A1A1A]'
          : 'bg-[#F6F6F4]/95 text-[#1A1A1A]'
      }`;

  const dockContent = (
    <motion.aside
      ref={dockRef as React.RefObject<HTMLElement>}
      layout
      transition={HW_SPRINGS.islandExpand}
      onMouseMove={handleDockMouseMove}
      onMouseLeave={handleDockMouseLeave}
      whileHover={{ scale: 1.015 }}
      style={{
        rotateX: springRotateX,
        rotateY: springRotateY,
        transformPerspective: 1000,
        borderColor: isPlaying
          ? accent
          : isHovered
          ? (isDark ? 'rgba(255,255,255,0.25)' : 'rgba(26,26,26,0.3)')
          : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(26,26,26,0.15)'),
        boxShadow: isDark
          ? isPlaying
            ? `0 28px 70px rgba(0,0,0,0.95), inset 0 1px 0 rgba(255,255,255,0.25), 0 0 28px ${activeGlowTheme.glow}`
            : isHovered
            ? `0 26px 65px rgba(0,0,0,0.92), inset 0 1px 0 rgba(255,255,255,0.28), 0 0 24px ${activeGlowTheme.glow}`
            : `0 18px 45px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.18)`
          : isPlaying
          ? `0 18px 42px ${activeGlowTheme.glow}, inset 0 1px 0 rgba(255,255,255,0.98)`
          : isHovered
          ? `0 16px 38px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,1), 0 0 20px ${activeGlowTheme.glow}`
          : `0 12px 32px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.95)`,
      }}
      className={innerClasses}
      aria-label="Floating Transport Dock"
    >
      {/* ── Dynamic Island Liquid Glass Specular Light Beam & Caustic Refraction ── */}
      <div
        className="pointer-events-none absolute inset-0 rounded-full overflow-hidden transition-opacity duration-300"
        style={{ opacity: localCursor ? 1 : 0 }}
      >
        {/* Specular spotlight following cursor across the acrylic substrate */}
        <div
          className="absolute -inset-10"
          style={{
            background: localCursor
              ? `radial-gradient(190px circle at ${localCursor.x + 40}px ${localCursor.y + 40}px, ${
                  isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.6)'
                }, ${activeGlowTheme.glow} 50%, transparent 80%)`
              : 'none',
          }}
        />
        {/* Top rim specular edge highlight */}
        <div
          className="absolute top-0 inset-x-0 h-[1.5px]"
          style={{
            background: localCursor
              ? `radial-gradient(160px circle at ${localCursor.x}px 0px, #FFFFFF, ${activeGlowTheme.rim} 40%, transparent 80%)`
              : 'none',
          }}
        />
        {/* Bottom rim specular bounce highlight */}
        <div
          className="absolute bottom-0 inset-x-0 h-[1px]"
          style={{
            background: localCursor
              ? `radial-gradient(120px circle at ${localCursor.x}px 100%, ${
                  isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.06)'
                }, transparent 75%)`
              : 'none',
          }}
        />
      </div>

      {/* ── 1. Reset, Step & Play Controls ───────────────────────────────── */}
      <div className="flex items-center gap-1 shrink-0 relative z-10">
        {/* Reset button — magnetic pull */}
        <MagneticButton
          onClick={() => { triggerNativeHaptic(10); onReset(); }}
          className="p-1.5 rounded-full hover:bg-current/10 transition-colors cursor-pointer"
          title="Return to origin (Frame 0 / 0.00s)"
          stiffness={4}
          padding={16}
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </MagneticButton>

        {mode === 'nle' && (
          <MagneticButton
            onClick={() => stepFrame(-1)}
            className="p-1.5 rounded-full hover:bg-current/10 transition-colors cursor-pointer"
            title="Step back 1 frame (Left Arrow)"
            stiffness={4}
            padding={16}
          >
            <SkipBack className="w-3.5 h-3.5" />
          </MagneticButton>
        )}

        {/* ── Skiper 3 Apple Play Button with Gooey Halo & ClickSpark ── */}
        <PlayButtonMagnetic
          isPlaying={isPlaying}
          isDark={isDark}
          accent={accent}
          glowRgba={activeGlowTheme.glow}
          onToggle={handlePlayToggle}
        />

        {mode === 'nle' && (
          <MagneticButton
            onClick={() => stepFrame(1)}
            className="p-1.5 rounded-full hover:bg-current/10 transition-colors cursor-pointer"
            title="Step forward 1 frame (Right Arrow)"
            stiffness={4}
            padding={16}
          >
            <SkipForward className="w-3.5 h-3.5" />
          </MagneticButton>
        )}

        {onToggleLoop && (
          <MagneticButton
            onClick={() => { triggerNativeHaptic(8); onToggleLoop(); }}
            className="p-1.5 rounded-full transition-colors cursor-pointer"
            style={{
              backgroundColor: isLooping ? activeGlowTheme.glow : undefined,
              color: isLooping ? accent : undefined,
              boxShadow: isLooping ? `0 0 8px ${activeGlowTheme.glow}` : undefined,
            }}
            title={isLooping ? 'Looping enabled' : 'Loop playback'}
            stiffness={4}
            padding={16}
          >
            <Repeat className="w-3.5 h-3.5" />
          </MagneticButton>
        )}
      </div>

      {/* ── 2. Precision Sub-Frame Rolling Timecode + Dynamic Island EQ ── */}
      <div className="flex items-center gap-1.5 px-3 border-x border-current/15 text-[11px] font-bold tabular-nums shrink-0 relative z-10">
        <DynamicIslandEqualizer isPlaying={isPlaying} accent={accent} />

        <motion.span
          className="tracking-wider"
          style={{
            color: accent,
            textShadow: isDark ? `0 0 10px ${activeGlowTheme.glow}` : 'none',
          }}
          animate={isPlaying ? { opacity: [1, 0.75, 1] } : { opacity: 1 }}
          transition={isPlaying ? { duration: 1, repeat: Infinity, ease: 'linear' } : {}}
        >
          {formattedTime}
        </motion.span>
        <span className="opacity-30">/</span>
        <span className="opacity-60 text-[10px]">{formattedTotal}</span>

        {onFpsChange ? (
          <select
            value={targetFps}
            onChange={(e) => onFpsChange(parseInt(e.target.value, 10))}
            className={`text-[9px] px-1.5 py-0.5 rounded-full border uppercase font-mono font-semibold cursor-pointer outline-none ml-1 transition-colors ${
              isDark
                ? 'bg-[#18181C] border-white/15 text-[#A1A1AA] hover:border-white/30 focus:border-white/40'
                : 'bg-[#EBEAE5] border-[#D1CFCA] text-[#5E5D59] hover:border-[#1A1A1A] focus:border-[#1A1A1A]'
            }`}
            title="Select target frame rate"
          >
            {fpsOptions.map((fpsVal) => (
              <option key={fpsVal} value={fpsVal}>
                {fpsVal} FPS
              </option>
            ))}
          </select>
        ) : (
          <span
            className={`text-[8px] px-1.5 py-0.5 rounded-full border ml-1 uppercase font-semibold ${
              isDark
                ? 'bg-[#18181C] border-white/15 text-[#A1A1AA]'
                : 'bg-[#EBEAE5] border-[#D1CFCA] text-[#5E5D59]'
            }`}
          >
            {targetFps} FPS
          </span>
        )}
      </div>

      {/* ── 3. Glowing Recessed Scrub Track ───────────────────────────────── */}
      <div className="flex-1 flex items-center min-w-[100px] max-w-[200px] relative group z-10">
        {/* Glow track backing */}
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-100"
          style={{
            width: `${scrubPct}%`,
            top: '50%',
            height: '2px',
            transform: 'translateY(-50%)',
            backgroundColor: accent,
            boxShadow: `0 0 8px ${accent}`,
            opacity: 0.85,
          }}
        />
        <input
          type="range"
          min={0}
          max={scrubMax}
          value={scrubVal}
          onChange={handleSeek}
          className="hw-scrub-track w-full cursor-pointer appearance-none rounded-full focus:outline-none"
          style={
            {
              '--accent': accent,
              '--pct': `${scrubPct}%`,
            } as React.CSSProperties
          }
        />
        {/* Hover reveal thumb glow */}
        <div
          className="absolute pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
          style={{
            left: `${scrubPct}%`,
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: accent,
            boxShadow: `0 0 12px ${accent}`,
          }}
        />
      </div>

      {/* ── 4. Audio Phrase Scope Toggle ──────────────────────────────────── */}
      {scrubScope && onScrubScopeChange && (
        <div className={`flex items-center p-0.5 rounded-full border text-[9px] shrink-0 z-10 ${
          isDark ? 'bg-[#18181C] border-white/15' : 'bg-[#EBEAE5] border-[#D1CFCA]'
        }`}>
          {(['selection', 'full'] as const).map((scope) => (
            <MagneticButton
              key={scope}
              onClick={() => onScrubScopeChange(scope)}
              stiffness={5}
              padding={10}
              className="px-2 py-0.5 rounded-full font-bold uppercase transition-all cursor-pointer"
              style={{
                backgroundColor: scrubScope === scope ? accent : undefined,
                color: scrubScope === scope ? (accent === '#FFFFFF' || !isDark ? '#000000' : '#000000') : undefined,
              }}
            >
              {scope}
            </MagneticButton>
          ))}
        </div>
      )}

      {/* ── 5. Live Hardware Status Pill with Gooey Beacon ────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={serialConnected ? 'connected' : 'disconnected'}
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.85, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[9px] uppercase font-bold tracking-wider shrink-0 z-10 ${
            isDark ? 'bg-[#121214] border-white/10' : 'bg-[#E8E6E1] border-[#1A1A1A]'
          }`}
        >
          {bpm ? (
            <>
              <motion.span
                animate={isLiveBeat ? { scale: [1, 1.3, 1] } : { scale: 1 }}
                transition={{ duration: 60 / (bpm || 120), repeat: Infinity, ease: 'easeInOut' }}
              >
                <Zap
                  className="w-3 h-3"
                  style={{
                    color: isLiveBeat ? accent : undefined,
                    opacity: isLiveBeat ? 1 : 0.4,
                  }}
                />
              </motion.span>
              <span>{bpm} BPM</span>
            </>
          ) : (
            <>
              <GooeyStatusBlob active={serialConnected || isPlaying} accent={accent} />
              <span>{serialConnected ? `${portName} • ${baudRate}B` : 'OLED SIMULATOR'}</span>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {/* ── 6. Glow Colorway Quick Switcher (6 Curated Swatches) ────────── */}
      <GlowPaletteToggle
        activeColor={glowColor}
        onSelectColor={handleSelectGlowColor}
        isDark={isDark}
      />
    </motion.aside>
  );

  if (docked) {
    return dockContent;
  }

  return (
    <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-40 pointer-events-none flex justify-center ${className}`}>
      <motion.div
        style={{
          x: springFloatX,
          y: springFloatY,
          scaleX: springScaleX,
          scaleY: springScaleY,
        }}
        className="pointer-events-auto"
      >
        {dockContent}
      </motion.div>
    </div>
  );
};
