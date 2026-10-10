import React, { useRef } from 'react';
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

  // Single glass surface as permitted:
  // Translucent dark fill, backdrop blur ~20px, 1px hairline border with slightly brighter top edge.
  // NO pseudo caustics, NO specular glints, NO gooey filters, NO text shadows.
  const dockContent = (
    <motion.aside
      ref={dockRef}
      layout
      transition={HW_SPRINGS.islandExpand}
      className={`select-none font-mono text-[11px] flex items-center transition-all ${
        docked
          ? 'relative w-full px-4 py-2 rounded-full border border-white/10 bg-[#202225] text-[#FAFAFA]'
          : 'pointer-events-auto rounded-full border border-white/10 border-t-white/20 bg-[#202225]/90 backdrop-blur-[20px] shadow-[0_12px_32px_rgba(0,0,0,0.5)] px-4 py-2 gap-3 text-[#FAFAFA]'
      } ${className}`}
      aria-label="Floating Transport Dock"
    >
      {/* ── 1. Transport Controls ── */}
      <div className="flex items-center gap-1 shrink-0">
        <motion.button
          type="button"
          disabled={hasNoMedia}
          onClick={() => { triggerNativeHaptic(10); onReset(); }}
          whileTap={{ scale: 0.9 }}
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
            whileTap={{ scale: 0.9 }}
            transition={HW_SPRINGS.snappy}
            className="p-1.5 rounded-full text-[#A1A1AA] hover:text-[#FAFAFA] hover:bg-white/5 transition-colors disabled:opacity-25 disabled:pointer-events-none cursor-pointer"
            title="Step back 1 frame (Left Arrow)"
          >
            <SkipBack className="w-3.5 h-3.5 stroke-[1.5]" />
          </motion.button>
        )}

        {/* Primary Play/Pause Button — Teenage Engineering style solid circle */}
        <motion.button
          type="button"
          disabled={hasNoMedia}
          onClick={handlePlayToggle}
          whileTap={{ scale: 0.92 }}
          transition={HW_SPRINGS.snappy}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
            hasNoMedia
              ? 'bg-[#111111] text-[#71717A] cursor-not-allowed opacity-30 pointer-events-none'
              : isPlaying
              ? 'bg-[#FF5500] text-black'
              : 'bg-[#FAFAFA] text-black hover:bg-white'
          }`}
          title={hasNoMedia ? 'No media' : isPlaying ? 'Pause (Space)' : 'Play (Space)'}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={isPlaying ? 'pause' : 'play'}
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.7, opacity: 0 }}
              transition={HW_SPRINGS.snappy}
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

        {mode === 'nle' && (
          <motion.button
            type="button"
            disabled={hasNoMedia}
            onClick={() => stepFrame(1)}
            whileTap={{ scale: 0.9 }}
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
            whileTap={{ scale: 0.9 }}
            transition={HW_SPRINGS.snappy}
            className={`p-1.5 rounded-full transition-colors cursor-pointer ${
              isLooping
                ? 'bg-[#FF5500] text-black'
                : 'text-[#A1A1AA] hover:text-[#FAFAFA] hover:bg-white/5'
            } disabled:opacity-25 disabled:pointer-events-none`}
            title={isLooping ? 'Looping enabled' : 'Loop playback'}
          >
            <Repeat className="w-3.5 h-3.5 stroke-[1.5]" />
          </motion.button>
        )}
      </div>

      {/* ── 2. Timecode (MM:SS.mmm) with Precision Rolling Milliseconds ── */}
      <div className="flex items-center gap-1.5 px-3 border-x border-white/10 text-[11px] font-mono tabular-nums shrink-0">
        <span className="text-[#FAFAFA] tracking-wide font-medium flex items-center">
          <span>{pad2(mins)}:{pad2(secs)}.</span>
          <SlidingNumber value={ms} padDigits={3} className="text-[#FAFAFA]" />
        </span>
        <span className="text-[#71717A]">/</span>
        <span className="text-[#71717A] text-[10px]">{formattedTotal}</span>

        {onFpsChange ? (
          <select
            value={targetFps}
            onChange={(e) => onFpsChange(parseInt(e.target.value, 10))}
            className="text-[9px] px-1.5 py-0.5 rounded-[4px] border border-white/10 bg-[#282A2E] text-[#A1A1AA] hover:text-[#FAFAFA] hover:border-white/20 uppercase font-mono cursor-pointer outline-none ml-1 transition-colors"
            title="Select target frame rate"
          >
            {fpsOptions.map((fpsVal) => (
              <option key={fpsVal} value={fpsVal}>
                {fpsVal} FPS
              </option>
            ))}
          </select>
        ) : (
          <span className="text-[9px] px-1.5 py-0.5 rounded-[4px] border border-white/10 bg-[#282A2E] text-[#71717A] ml-1 uppercase font-mono">
            {targetFps} FPS
          </span>
        )}
      </div>

      {/* ── 3. Tactile Hardware Scrub Track (Single Dot, Zero Ghost Thumb) ── */}
      <div className={`flex-1 flex items-center min-w-[100px] max-w-[200px] h-6 relative group transition-opacity ${hasNoMedia ? 'opacity-25 pointer-events-none' : ''}`}>
        {/* Track groove */}
        <div className="w-full h-1 bg-black/40 rounded-full overflow-hidden relative border border-white/5">
          <div
            className="h-full bg-[#FF5500] rounded-full transition-all duration-75"
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
        {/* Exactly ONE crisp hardware position indicator */}
        <div
          className="absolute pointer-events-none w-2.5 h-2.5 rounded-full bg-[#FAFAFA] border border-black/40 -translate-x-1/2 -translate-y-1/2 top-1/2 shadow-sm transition-transform duration-100 group-hover:scale-125 group-active:scale-110"
          style={{ left: `${scrubPct}%` }}
        />
      </div>

      {/* ── 4. Scope Toggle (Lyrics / Audio) ── */}
      {scrubScope && onScrubScopeChange && (
        <div className="flex items-center p-0.5 rounded-full border border-white/10 bg-[#282A2E] text-[9px] font-mono shrink-0">
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

      {/* ── 5. Status Pill (Crisp Phosphor Green #00FF66 / Tertiary #71717A Dot) ── */}
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/10 bg-[#282A2E] text-[9px] uppercase font-mono tracking-wider shrink-0 text-[#A1A1AA]">
        {bpm ? (
          <>
            <Zap
              className={`w-3 h-3 stroke-[1.5] ${
                isLiveBeat ? 'text-[#FF5500]' : 'text-[#71717A]'
              }`}
            />
            <span>{bpm} BPM</span>
          </>
        ) : (
          <>
            {/* Single green rule: ONLY top bar connect pill is green. Orange for live, steady dot for connected, grey for disconnected */}
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                isPlaying ? 'bg-[#FF5500]' : serialConnected ? 'bg-zinc-300' : 'bg-[#71717A]'
              }`}
            />
            <TextScramble
              text={serialConnected ? `${portName} • ${baudRate >= 1000 ? `${(baudRate / 1000).toFixed(1).replace('.0', '')}K` : baudRate}` : 'OLED SIMULATOR'}
              triggerOnHover={true}
              durationMs={200}
            />
          </>
        )}
      </div>
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
