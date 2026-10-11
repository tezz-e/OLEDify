import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipBack, SkipForward, RotateCcw, Repeat, Zap } from 'lucide-react';
import { HW_SPRINGS } from '../../theme/springPresets';
import { triggerNativeHaptic } from '../../theme/haptics';
import { SlidingNumber } from '../motion/SlidingNumber';
import { TextScramble } from '../motion/TextScramble';

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
  className = '',
}) => {
  const dockRef = useRef<HTMLElement>(null);
  const [localCursor, setLocalCursor] = useState<{ x: number; y: number } | null>(null);

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!dockRef.current) return;
    const rect = dockRef.current.getBoundingClientRect();
    setLocalCursor({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const [isHovered, setIsHovered] = useState(false);

  const handlePointerEnter = () => {
    setIsHovered(true);
  };

  const handlePointerLeave = () => {
    setIsHovered(false);
    setLocalCursor(null);
  };

  // Frame and duration math
  const maxFrames = Math.max(0, totalFrames - 1);
  const safeFrame = Math.min(Math.max(0, currentFrame), maxFrames);
  const hasNoMedia = mode === 'audio-lyrics' ? (!durationMs || durationMs <= 0) : totalFrames <= 0;

  // Exact millisecond timecode
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

  const scrubMax = mode === 'audio-lyrics' ? (durationMs || 1000) : maxFrames;
  const scrubVal = mode === 'audio-lyrics' ? (playheadMs || 0) : safeFrame;
  const scrubPct = scrubMax > 0 ? (scrubVal / scrubMax) * 100 : 0;

  const dockContent = (
    <motion.aside
      ref={dockRef}
      layout
      onPointerMove={handlePointerMove}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      transition={HW_SPRINGS.islandExpand}
      className={`select-none font-sans text-[11px] flex items-center relative transition-all ${
        docked
          ? 'w-full px-4 py-2 rounded-full border border-white/10 bg-[#202225] text-[#FAFAFA]'
          : 'pointer-events-auto rounded-full border border-white/10 border-t-white/25 bg-[#202225]/85 backdrop-blur-[24px] shadow-[0_16px_40px_rgba(0,0,0,0.55)] px-4 py-2 gap-3 text-[#FAFAFA]'
      } ${className}`}
      aria-label="Floating Transport Dock"
    >
      {/* ── Liquid Glass Specular Spotlight & Top Rim Highlight ── */}
      <div 
        className="absolute inset-0 rounded-full pointer-events-none overflow-hidden transition-opacity duration-200 z-0"
        style={{ opacity: localCursor ? 1 : 0 }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: localCursor
              ? `radial-gradient(circle 100px at ${localCursor.x}px ${localCursor.y}px, rgba(255, 255, 255, 0.16) 0%, rgba(255, 85, 0, 0.08) 40%, transparent 80%)`
              : 'none',
          }}
        />
        {/* Top rim specular edge highlight */}
        <div
          className="absolute top-0 inset-x-0 h-[1.5px]"
          style={{
            background: localCursor
              ? `radial-gradient(130px circle at ${localCursor.x}px 0px, #FFFFFF 0%, rgba(255, 85, 0, 0.5) 40%, transparent 80%)`
              : 'none',
          }}
        />
      </div>

      {/* ── 1. Transport Controls ── */}
      <div className="flex items-center gap-1 shrink-0 z-10">
        <motion.button
          type="button"
          disabled={hasNoMedia}
          onClick={() => { triggerNativeHaptic(10); onReset(); }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.88 }}
          transition={HW_SPRINGS.snappy}
          className="p-1.5 rounded-full text-[#A1A1AA] hover:text-[#FAFAFA] hover:bg-white/5 transition-colors disabled:opacity-25 disabled:pointer-events-none cursor-pointer"
          title="Return to origin (Frame 0 / 00:00.000)"
        >
          <RotateCcw className="w-3.5 h-3.5 stroke-[1.5]" />
        </motion.button>

        {mode === 'nle' && (
          <motion.button
            type="button"
            disabled={hasNoMedia}
            onClick={() => stepFrame(-1)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.88 }}
            transition={HW_SPRINGS.snappy}
            className="p-1.5 rounded-full text-[#A1A1AA] hover:text-[#FAFAFA] hover:bg-white/5 transition-colors disabled:opacity-25 disabled:pointer-events-none cursor-pointer"
            title="Step back 1 frame (Left Arrow)"
          >
            <SkipBack className="w-3.5 h-3.5 stroke-[1.5]" />
          </motion.button>
        )}

        {/* Primary Play/Pause Button with Pulsing Expanding Aura */}
        <div className="relative flex items-center justify-center shrink-0">
          <AnimatePresence>
            {isPlaying && (
              <motion.span
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: [1, 1.45, 1], opacity: [0.5, 0, 0.5] }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                className="absolute -inset-1.5 rounded-full pointer-events-none bg-[#FF5500]/30 blur-[4px]"
              />
            )}
          </AnimatePresence>

          <motion.button
            type="button"
            disabled={hasNoMedia}
            onClick={handlePlayToggle}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.88 }}
            transition={HW_SPRINGS.snappy}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer relative z-10 ${
              hasNoMedia
                ? 'bg-[#111111] text-[#71717A] cursor-not-allowed opacity-30 pointer-events-none'
                : isPlaying
                ? 'bg-[#FF5500] text-black shadow-[0_0_16px_rgba(255,85,0,0.5)]'
                : 'bg-[#FAFAFA] text-black hover:bg-white'
            }`}
            title={hasNoMedia ? 'No media' : isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={isPlaying ? 'pause' : 'play'}
                initial={{ scale: 0.6, opacity: 0, rotate: isPlaying ? -20 : 20 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 0.6, opacity: 0, rotate: isPlaying ? 20 : -20 }}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                className="flex items-center justify-center"
              >
                {isPlaying ? (
                  <Pause className="w-3.5 h-3.5 fill-black stroke-black" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-black stroke-black ml-0.5" />
                )}
              </motion.span>
            </AnimatePresence>
          </motion.button>
        </div>

        {mode === 'nle' && (
          <motion.button
            type="button"
            disabled={hasNoMedia}
            onClick={() => stepFrame(1)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.88 }}
            transition={HW_SPRINGS.snappy}
            className="p-1.5 rounded-full text-[#A1A1AA] hover:text-[#FAFAFA] hover:bg-white/5 transition-colors disabled:opacity-25 disabled:pointer-events-none cursor-pointer"
            title="Step forward 1 frame (Right Arrow)"
          >
            <SkipForward className="w-3.5 h-3.5 stroke-[1.5]" />
          </motion.button>
        )}

        {onToggleLoop && (
          <motion.button
            type="button"
            disabled={hasNoMedia}
            onClick={() => { triggerNativeHaptic(8); onToggleLoop(); }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.88 }}
            transition={HW_SPRINGS.snappy}
            className={`p-1.5 rounded-full transition-colors cursor-pointer ${
              isLooping
                ? 'bg-[#FF5500] text-black shadow-[0_0_10px_rgba(255,85,0,0.4)]'
                : 'text-[#A1A1AA] hover:text-[#FAFAFA] hover:bg-white/5'
            } disabled:opacity-25 disabled:pointer-events-none`}
            title={isLooping ? 'Looping enabled' : 'Loop playback'}
          >
            <Repeat className="w-3.5 h-3.5 stroke-[1.5]" />
          </motion.button>
        )}
      </div>

      {/* ── 2. Precision Dynamic Island Equalizer + Timecode (MM:SS.mmm) ── */}
      <div className="flex items-center gap-2 px-3 border-x border-white/10 text-[11px] font-mono tabular-nums shrink-0 z-10">
        {/* Dynamic Island Animated Equalizer */}
        <div className="flex items-center gap-[2.5px] h-3 px-0.5 select-none pointer-events-none">
          {[0, 1, 2, 3].map((i) => (
            <motion.span
              key={i}
              className="w-[2px] rounded-full origin-bottom"
              style={{ background: '#FF5500' }}
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

        <span className="text-[#FAFAFA] tracking-wide font-medium">
          {pad2(mins)}:{pad2(secs)}.{pad3(ms)}
        </span>
        <span className="text-[#71717A]">/</span>
        <span className="text-[#71717A] text-[10px]">{formattedTotal}</span>

        {onFpsChange ? (
          <div className="relative flex items-center px-1.5 py-0.5 rounded-[4px] border border-white/10 bg-[#282A2E] hover:border-white/20 transition-colors ml-1 cursor-pointer">
            <span className="font-mono tabular-nums text-[#FAFAFA] text-[11px]">{targetFps}</span>
            <span className="font-sans text-[11px] text-[#A1A1AA] ml-1">FPS</span>
            <select
              value={targetFps}
              onChange={(e) => onFpsChange(parseInt(e.target.value, 10))}
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
              title="Select target frame rate"
              aria-label="Target framerate"
            >
              {fpsOptions.map((fpsVal) => (
                <option key={fpsVal} value={fpsVal}>
                  {fpsVal} FPS
                </option>
              ))}
            </select>
          </div>
        ) : (
          <span className="text-[11px] px-1.5 py-0.5 rounded-[4px] border border-white/10 bg-[#282A2E] text-[#71717A] ml-1 font-sans">
            <span className="font-mono tabular-nums text-[#FAFAFA]">{targetFps}</span>
            <span className="ml-1">FPS</span>
          </span>
        )}
      </div>

      {/* ── 3. Tactile Hardware Scrub Track ── */}
      <div className={`flex-1 flex items-center min-w-[100px] max-w-[200px] h-6 relative group z-10 transition-opacity ${hasNoMedia ? 'opacity-25 pointer-events-none' : ''}`}>
        {/* Track groove */}
        <div className="w-full h-1 bg-black/40 rounded-full overflow-hidden relative border border-white/5">
          <div
            className={`h-full bg-[#FF5500] rounded-full ${isPlaying ? 'transition-none' : 'transition-all duration-75'}`}
            style={{ width: `${scrubPct}%` }}
          />
        </div>
        {/* Invisible zero-thumb input for precise scrubbing */}
        <input
          type="range"
          min={0}
          max={scrubMax}
          value={scrubVal}
          disabled={hasNoMedia}
          onChange={handleSeek}
          className="transport-scrub-input disabled:cursor-not-allowed"
          aria-label="Timeline seek scrubber"
        />
        {/* Crisp position indicator */}
        <div
          className={`absolute pointer-events-none w-2.5 h-2.5 rounded-full bg-[#FAFAFA] border border-black/40 -translate-x-1/2 -translate-y-1/2 top-1/2 shadow-sm ${isPlaying ? 'transition-none' : 'transition-transform duration-100'} group-hover:scale-125 group-active:scale-110`}
          style={{ left: `${scrubPct}%` }}
        />
      </div>

      {/* ── 4. Scope Toggle (Lyrics / Audio) ── */}
      {scrubScope && onScrubScopeChange && (
        <div className="flex items-center p-0.5 rounded-full border border-white/10 bg-[#282A2E] text-[9px] font-mono shrink-0 z-10">
          {(['selection', 'full'] as const).map((scope) => (
            <button
              key={scope}
              type="button"
              onClick={() => onScrubScopeChange(scope)}
              className={`px-2 py-0.5 rounded-full font-mono uppercase tracking-wider transition-colors cursor-pointer ${
                scrubScope === scope
                  ? 'bg-[#FF5500] text-black font-semibold'
                  : 'text-[#A1A1AA] hover:text-[#FAFAFA]'
              }`}
            >
              {scope}
            </button>
          ))}
        </div>
      )}

      {/* ── 5. Status Pill with Gooey Breathing Beacon ── */}
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/10 bg-[#282A2E] text-[11px] font-sans shrink-0 text-[var(--hw-text-secondary)] z-10">
        {bpm ? (
          <>
            <motion.span
              animate={isLiveBeat ? { scale: [1, 1.35, 1] } : { scale: 1 }}
              transition={{ duration: 60 / (bpm || 120), repeat: Infinity, ease: 'easeInOut' }}
            >
              <Zap
                className={`w-3 h-3 stroke-[1.5] ${
                  isLiveBeat ? 'text-[#FF5500]' : 'text-[#71717A]'
                }`}
              />
            </motion.span>
            <span><span className="font-mono">{bpm}</span> BPM</span>
          </>
        ) : (
          <>
            {/* Gooey Breathing Status Beacon */}
            <div className="relative flex items-center justify-center w-2.5 h-2.5 shrink-0">
              {isPlaying || serialConnected ? (
                <>
                  <motion.span
                    className="w-2 h-2 rounded-full absolute"
                    style={{ backgroundColor: isPlaying ? '#FF5500' : '#D4D4D8' }}
                    animate={{
                      scale: [1, 1.35, 0.95, 1.25, 1],
                      boxShadow: isPlaying
                        ? ['0 0 4px #FF5500', '0 0 10px #FF5500', '0 0 4px #FF5500']
                        : ['0 0 2px rgba(255,255,255,0.4)', '0 0 6px rgba(255,255,255,0.4)', '0 0 2px rgba(255,255,255,0.4)'],
                    }}
                    transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
                  />
                  <motion.span
                    className="w-1.5 h-1.5 rounded-full absolute"
                    style={{ backgroundColor: isPlaying ? '#FF5500' : '#D4D4D8' }}
                    animate={{
                      x: [-1.5, 2, -1, 1.5, -1.5],
                      opacity: [0.85, 0.45, 0.9, 0.5, 0.85],
                    }}
                    transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
                  />
                </>
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-[#71717A]" />
              )}
            </div>

            {serialConnected ? (
              <span className="font-sans">
                {portName} · <span className="font-mono tabular-nums">{baudRate >= 1000 ? `${(baudRate / 1000).toFixed(1).replace('.0', '')}k` : baudRate}</span> baud
              </span>
            ) : (
              <span className="font-sans">OLED simulator</span>
            )}
          </>
        )}
      </div>
    </motion.aside>
  );

  if (docked) {
    return dockContent;
  }

  return (
    <motion.div
      animate={!isHovered ? { y: [0, -3.5, 0] } : { y: 0 }}
      transition={{
        duration: 3.6,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-40 pointer-events-none flex justify-center ${className}`}
    >
      {dockContent}
    </motion.div>
  );
};
