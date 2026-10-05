import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipBack, SkipForward, RotateCcw, Repeat, Zap } from 'lucide-react';
import { HW_SPRINGS } from '../../theme/springPresets';
import { triggerNativeHaptic } from '../../theme/haptics';

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
  themeMode = 'dark',
  className = '',
}) => {
  const isDark = themeMode === 'dark';
  const dockRef = useRef<HTMLElement>(null);
  const [mousePos, setMousePos] = useState<{ x: number } | null>(null);

  // Frame math
  const maxFrames = Math.max(0, totalFrames - 1);
  const safeFrame = Math.min(Math.max(0, currentFrame), maxFrames);

  // Sub-frame calculation using integer millisecond arithmetic
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

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dockRef.current) {
      const rect = dockRef.current.getBoundingClientRect();
      setMousePos({ x: e.clientX - rect.left });
    }
  };

  const handleMouseLeave = () => {
    setMousePos(null);
  };

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

  const containerClasses = docked
    ? `relative w-full px-4 py-2 rounded-xl border flex items-center justify-between gap-4 select-none font-mono transition-all ${
        isDark
          ? 'bg-[#08080A] border-white/10 text-[#FAFAFA]'
          : 'bg-[#F6F6F4] border-[#1A1A1A] text-[#1A1A1A]'
      } ${className}`
    : `fixed bottom-5 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-full border flex items-center gap-4 select-none font-mono backdrop-blur-2xl shadow-2xl transition-all ${
        isDark
          ? 'bg-[#08080A]/90 border-white/15 text-[#FAFAFA] shadow-[0_20px_50px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.18)]'
          : 'bg-[#F6F6F4]/95 border-[#1A1A1A] text-[#1A1A1A] shadow-[0_12px_32px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.95)]'
      } ${className}`;

  return (
    <motion.aside
      ref={dockRef}
      layout
      transition={HW_SPRINGS.islandExpand}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={containerClasses}
      aria-label="Floating Transport Dock"
    >
      {/* 1. Reset, Step & Play Controls */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => { triggerNativeHaptic(10); onReset(); }}
          className="p-1.5 rounded-full hover:bg-current/10 active:scale-95 transition-transform cursor-pointer"
          title="Return to origin (Frame 0 / 0.00s)"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        {mode === 'nle' && (
          <button
            type="button"
            onClick={() => stepFrame(-1)}
            className="p-1.5 rounded-full hover:bg-current/10 active:scale-95 transition-transform cursor-pointer"
            title="Step back 1 frame (Left Arrow)"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Circular Tactile Play Button */}
        <motion.button
          type="button"
          onClick={handlePlayToggle}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          transition={HW_SPRINGS.tactileTap}
          className={`w-9 h-9 rounded-full flex items-center justify-center cursor-pointer shadow-lg transition-colors ${
            isPlaying
              ? isDark
                ? 'bg-[#00FF66] text-black shadow-[0_0_16px_rgba(0,255,102,0.5)]'
                : 'bg-[#E85D2A] text-white shadow-[0_0_14px_rgba(232,93,42,0.4)]'
              : isDark
              ? 'bg-white text-black hover:bg-[#00FF66]'
              : 'bg-black text-white hover:bg-[#E85D2A]'
          }`}
          title={isPlaying ? 'Pause Timeline (Space)' : 'Play Timeline (Space)'}
        >
          <AnimatePresence mode="wait" initial={false}>
            {isPlaying ? (
              <motion.span
                key="pause"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ duration: 0.1 }}
              >
                <Pause className="w-4 h-4 fill-current" />
              </motion.span>
            ) : (
              <motion.span
                key="play"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ duration: 0.1 }}
                className="ml-0.5"
              >
                <Play className="w-4 h-4 fill-current" />
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>

        {mode === 'nle' && (
          <button
            type="button"
            onClick={() => stepFrame(1)}
            className="p-1.5 rounded-full hover:bg-current/10 active:scale-95 transition-transform cursor-pointer"
            title="Step forward 1 frame (Right Arrow)"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Loop Toggle Button for Audio Preview */}
        {onToggleLoop && (
          <button
            type="button"
            onClick={() => { triggerNativeHaptic(8); onToggleLoop(); }}
            className={`p-1.5 rounded-full transition-colors cursor-pointer ${
              isLooping
                ? isDark
                  ? 'bg-[#00FF66]/20 text-[#00FF66]'
                  : 'bg-[#E85D2A]/20 text-[#E85D2A]'
                : 'hover:bg-current/10 opacity-60 hover:opacity-100'
            }`}
            title={isLooping ? 'Looping enabled' : 'Loop playback'}
          >
            <Repeat className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* 2. Precision Sub-Frame Rolling Timecode */}
      <div className="flex items-center gap-1.5 px-3 border-x border-current/15 text-[11px] font-bold tabular-nums shrink-0">
        <span className={`tracking-wider ${isDark ? 'text-[#00FF66]' : 'text-[#E85D2A]'}`}>
          {formattedTime}
        </span>
        <span className="opacity-30">/</span>
        <span className="opacity-60 text-[10px]">{formattedTotal}</span>

        {/* Interactive FPS Selector or Static Badge */}
        {onFpsChange ? (
          <select
            value={targetFps}
            onChange={(e) => onFpsChange(parseInt(e.target.value, 10))}
            className={`text-[9px] px-1.5 py-0.5 rounded-full border uppercase font-mono font-semibold cursor-pointer outline-none ml-1 ${
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

      {/* 3. Milled Recessed Scrub Track */}
      <div className="flex-1 flex items-center min-w-[120px] max-w-xs relative">
        <input
          type="range"
          min={0}
          max={mode === 'audio-lyrics' ? (durationMs || 1000) : maxFrames}
          value={mode === 'audio-lyrics' ? (playheadMs || 0) : safeFrame}
          onChange={handleSeek}
          className="w-full cursor-pointer h-1.5 appearance-none rounded-full bg-current/20 transition-all focus:outline-none"
          style={{ accentColor: isDark ? '#00FF66' : '#E85D2A' }}
        />
      </div>

      {/* 4. Audio Phrase Scope Toggle (if audio mode) */}
      {scrubScope && onScrubScopeChange && (
        <div className={`flex items-center p-0.5 rounded-full border text-[9px] shrink-0 ${
          isDark ? 'bg-[#18181C] border-white/15' : 'bg-[#EBEAE5] border-[#D1CFCA]'
        }`}>
          <button
            type="button"
            onClick={() => onScrubScopeChange('selection')}
            className={`px-2 py-0.5 rounded-full font-bold uppercase transition-all cursor-pointer ${
              scrubScope === 'selection'
                ? isDark
                  ? 'bg-[#00FF66] text-black shadow-xs'
                  : 'bg-[#E85D2A] text-white shadow-xs'
                : 'opacity-60 hover:opacity-100'
            }`}
          >
            Selection
          </button>
          <button
            type="button"
            onClick={() => onScrubScopeChange('full')}
            className={`px-2 py-0.5 rounded-full font-bold uppercase transition-all cursor-pointer ${
              scrubScope === 'full'
                ? isDark
                  ? 'bg-[#00FF66] text-black shadow-xs'
                  : 'bg-[#E85D2A] text-white shadow-xs'
                : 'opacity-60 hover:opacity-100'
            }`}
          >
            Full
          </button>
        </div>
      )}

      {/* 5. Live Hardware Status / Beat Pulse Pill */}
      <div
        className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[9px] uppercase font-bold tracking-wider shrink-0 ${
          isDark ? 'bg-[#121214] border-white/10' : 'bg-[#E8E6E1] border-[#1A1A1A]'
        }`}
      >
        {bpm ? (
          <>
            <Zap className={`w-3 h-3 ${isLiveBeat ? (isDark ? 'text-[#00FF66]' : 'text-[#E85D2A]') : 'opacity-40'}`} />
            <span>{bpm} BPM</span>
          </>
        ) : (
          <>
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                serialConnected
                  ? 'bg-[#00FF66] shadow-[0_0_8px_#00FF66] animate-pulse'
                  : 'bg-[#71717A]'
              }`}
            />
            <span>{serialConnected ? `${portName} • ${baudRate}B` : 'OLED SIMULATOR'}</span>
          </>
        )}
      </div>
    </motion.aside>
  );
};
