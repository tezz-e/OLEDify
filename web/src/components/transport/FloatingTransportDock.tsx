import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import { Play, Pause, SkipBack, SkipForward, RotateCcw, Repeat, Zap } from 'lucide-react';
import { HW_SPRINGS } from '../../theme/springPresets';
import { triggerNativeHaptic } from '../../theme/haptics';
import { ClickSpark } from '../reactbits/ClickSpark';

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
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  title?: string;
  stiffness?: number;
  padding?: number;
  type?: 'button' | 'submit' | 'reset';
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
      style={{ x, y }}
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
function DynamicIslandEqualizer({ isPlaying, isDark }: { isPlaying: boolean; isDark: boolean }) {
  const accent = isDark ? '#00FF66' : '#E85D2A';
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
  onToggle,
}: {
  isPlaying: boolean;
  isDark: boolean;
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

  const accentColor = isDark ? '#00FF66' : '#E85D2A';

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
              background: isDark ? 'rgba(0, 255, 102, 0.3)' : 'rgba(232, 93, 42, 0.3)',
              filter: 'blur(3px)',
            }}
          />
        )}
      </AnimatePresence>

      <ClickSpark sparkColor={accentColor} sparkCount={8} sparkRadius={24} duration={400}>
        <motion.button
          ref={ref}
          type="button"
          onClick={onToggle}
          style={{ x, y }}
          onMouseMove={onMM}
          onMouseLeave={onML}
          whileHover={{ scale: 1.12 }}
          whileTap={{ scale: 0.86 }}
          transition={HW_SPRINGS.tactileTap}
          className={`w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-colors relative z-10 ${
            isPlaying
              ? isDark
                ? 'bg-[#00FF66] text-black shadow-[0_0_20px_rgba(0,255,102,0.6),0_0_40px_rgba(0,255,102,0.25)]'
                : 'bg-[#E85D2A] text-white shadow-[0_0_20px_rgba(232,93,42,0.5)]'
              : isDark
              ? 'bg-white text-black shadow-[0_2px_8px_rgba(0,0,0,0.5)] hover:bg-[#00FF66] hover:shadow-[0_0_20px_rgba(0,255,102,0.5)]'
              : 'bg-black text-white shadow-[0_2px_8px_rgba(0,0,0,0.2)] hover:bg-[#E85D2A]'
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
                <Pause className={`w-4 h-4 ${isDark ? 'fill-black text-black' : 'fill-white text-white'}`} />
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
function GooeyStatusBlob({ active, isDark }: { active: boolean; isDark: boolean }) {
  const color = active ? (isDark ? '#00FF66' : '#E85D2A') : '#71717A';
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
}) => {
  const isDark = themeMode === 'dark';
  const accent = isDark ? '#00FF66' : '#E85D2A';
  const dockRef = useRef<HTMLElement>(null);

  // 3D Inertial tilt springs driven by cursor proximity
  const rawTiltX = useMotionValue(0);
  const rawTiltY = useMotionValue(0);
  const springRotateX = useSpring(rawTiltX, { stiffness: 220, damping: 20, mass: 0.3 });
  const springRotateY = useSpring(rawTiltY, { stiffness: 220, damping: 20, mass: 0.3 });

  // Real-time cursor coordinates inside dock for specular light highlight beam
  const [localCursor, setLocalCursor] = useState<{ x: number; y: number } | null>(null);

  const handleDockMouseMove = (e: React.MouseEvent) => {
    if (!dockRef.current) return;
    const rect = dockRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;

    // Subtle 3D physical tilt (max ±2.2 degrees)
    const rX = -(dy / (rect.height / 2)) * 2.2;
    const rY = (dx / (rect.width / 2)) * 2.2;
    rawTiltX.set(rX);
    rawTiltY.set(rY);

    setLocalCursor({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleDockMouseLeave = () => {
    rawTiltX.set(0);
    rawTiltY.set(0);
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
  const innerClasses = docked
    ? `relative w-full px-4 py-2 rounded-xl border flex items-center justify-between gap-4 select-none font-mono transition-all duration-300 ${
        isDark
          ? 'bg-[#08080A] border-white/10 text-[#FAFAFA]'
          : 'bg-[#F6F6F4] border-[#1A1A1A] text-[#1A1A1A]'
      } ${className}`
    : `pointer-events-auto rounded-full border flex items-center select-none font-mono backdrop-blur-2xl transition-all duration-300 ${
        isPlaying ? 'px-5 py-2.5 gap-3.5' : 'px-4 py-2 gap-3'
      } ${
        isDark
          ? isPlaying
            ? 'bg-[#08080A]/95 border-[#00FF66]/40 text-[#FAFAFA] shadow-[0_24px_65px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.22),0_0_24px_rgba(0,255,102,0.18)]'
            : 'bg-[#08080A]/90 border-white/15 text-[#FAFAFA] shadow-[0_20px_50px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.18)]'
          : isPlaying
          ? 'bg-[#F6F6F4]/98 border-[#E85D2A]/60 text-[#1A1A1A] shadow-[0_16px_38px_rgba(232,93,42,0.18),inset_0_1px_0_rgba(255,255,255,0.95)]'
          : 'bg-[#F6F6F4]/95 border-[#1A1A1A] text-[#1A1A1A] shadow-[0_12px_32px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.95)]'
      }`;

  const dockContent = (
    <motion.aside
      ref={dockRef as React.RefObject<HTMLElement>}
      layout
      transition={HW_SPRINGS.islandExpand}
      onMouseMove={handleDockMouseMove}
      onMouseLeave={handleDockMouseLeave}
      whileHover={{ y: -2 }}
      style={{
        rotateX: springRotateX,
        rotateY: springRotateY,
        transformPerspective: 1000,
      }}
      className={innerClasses}
      aria-label="Floating Transport Dock"
    >
      {/* ── Dynamic Island Liquid Glass Specular Light Beam ── */}
      <div
        className="pointer-events-none absolute inset-0 rounded-full overflow-hidden transition-opacity duration-300"
        style={{ opacity: localCursor ? 1 : 0 }}
      >
        {/* Specular spotlight following cursor across the acrylic substrate */}
        <div
          className="absolute -inset-10"
          style={{
            background: localCursor
              ? `radial-gradient(180px circle at ${localCursor.x + 40}px ${localCursor.y + 40}px, ${
                  isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.05)'
                }, transparent 70%)`
              : 'none',
          }}
        />
        {/* Top rim specular edge highlight */}
        <div
          className="absolute top-0 inset-x-0 h-[1px]"
          style={{
            background: localCursor
              ? `radial-gradient(140px circle at ${localCursor.x}px 0px, ${
                  isDark ? '#00FF66' : '#E85D2A'
                }, transparent 80%)`
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
            className={`p-1.5 rounded-full transition-colors cursor-pointer ${
              isLooping
                ? isDark
                  ? 'bg-[#00FF66]/20 text-[#00FF66] shadow-[0_0_8px_rgba(0,255,102,0.3)]'
                  : 'bg-[#E85D2A]/20 text-[#E85D2A]'
                : 'hover:bg-current/10 opacity-50 hover:opacity-100'
            }`}
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
        <DynamicIslandEqualizer isPlaying={isPlaying} isDark={isDark} />

        <motion.span
          className={`tracking-wider ${isDark ? 'text-[#00FF66]' : 'text-[#E85D2A]'}`}
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
                ? 'bg-[#18181C] border-white/15 text-[#A1A1AA] hover:border-[#00FF66] focus:border-[#00FF66]'
                : 'bg-[#EBEAE5] border-[#D1CFCA] text-[#5E5D59] hover:border-[#E85D2A] focus:border-[#E85D2A]'
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
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-100 ${
            isDark ? 'bg-[#00FF66]' : 'bg-[#E85D2A]'
          }`}
          style={{
            width: `${scrubPct}%`,
            top: '50%',
            height: '2px',
            transform: 'translateY(-50%)',
            boxShadow: isDark ? `0 0 8px #00FF66` : `0 0 8px #E85D2A`,
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
              className={`px-2 py-0.5 rounded-full font-bold uppercase transition-all cursor-pointer ${
                scrubScope === scope
                  ? isDark
                    ? 'bg-[#00FF66] text-black'
                    : 'bg-[#E85D2A] text-white'
                  : 'opacity-60 hover:opacity-100'
              }`}
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
                <Zap className={`w-3 h-3 ${isLiveBeat ? (isDark ? 'text-[#00FF66]' : 'text-[#E85D2A]') : 'opacity-40'}`} />
              </motion.span>
              <span>{bpm} BPM</span>
            </>
          ) : (
            <>
              <GooeyStatusBlob active={serialConnected || isPlaying} isDark={isDark} />
              <span>{serialConnected ? `${portName} • ${baudRate}B` : 'OLED SIMULATOR'}</span>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </motion.aside>
  );

  if (docked) {
    return dockContent;
  }

  return (
    <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-40 pointer-events-none flex justify-center ${className}`}>
      {dockContent}
    </div>
  );
};
