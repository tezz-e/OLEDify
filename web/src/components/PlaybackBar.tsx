import React from 'react';
import { Play, Pause, SkipBack, SkipForward, RotateCcw } from 'lucide-react';
import { GlassButton } from './reactbits/GlassButton';

interface PlaybackBarProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  currentFrame: number;
  totalFrames: number;
  targetFps: number;
  onFpsChange: (fps: number) => void;
  onFrameSeek: (frame: number) => void;
  onReset: () => void;
  themeMode?: 'light' | 'dark';
}

export const PlaybackBar: React.FC<PlaybackBarProps> = ({
  isPlaying,
  onTogglePlay,
  currentFrame,
  totalFrames,
  targetFps,
  onFpsChange,
  onFrameSeek,
  onReset,
  themeMode = 'light',
}) => {
  const isDark = themeMode === 'dark';
  const pad = (n: number) => String(n).padStart(3, '0');
  const max = Math.max(0, totalFrames - 1);
  const safeFrame = Math.min(currentFrame, max);

  return (
    <div className="flex flex-col w-full gap-2 select-none">
      {/* Seek slider */}
      <input
        type="range"
        min={0}
        max={max}
        value={safeFrame}
        onChange={e => onFrameSeek(parseInt(e.target.value))}
        className="w-full cursor-pointer h-1 transition-colors"
        disabled={totalFrames === 0}
        style={{ accentColor: isDark ? '#00FF66' : '#E85D2A' }}
      />

      {/* Controls row */}
      <div className="flex items-center w-full relative">
        {/* Center: transport buttons */}
        <div className="flex items-center gap-1.5 mx-auto">
          <GlassButton
            onClick={onReset}
            className={`p-2 w-8 h-8 rounded-md transition-colors ${
              isDark 
                ? 'bg-[#121216] border-white/10 text-[#F1EEF8] hover:border-[#00FF66] hover:text-[#00FF66]' 
                : ''
            }`}
            title="Go to start"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </GlassButton>

          <GlassButton
            onClick={() => onFrameSeek(Math.max(0, safeFrame - 1))}
            className={`p-2 w-8 h-8 rounded-md transition-colors ${
              isDark 
                ? 'bg-[#121216] border-white/10 text-[#F1EEF8] hover:border-[#00FF66] hover:text-[#00FF66]' 
                : ''
            }`}
            title="Previous frame (←)"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </GlassButton>

          <GlassButton
            onClick={onTogglePlay}
            className={`w-11 h-9 rounded-md font-bold transition-all ${
              isDark
                ? isPlaying
                  ? 'bg-[#00FF66]/15 border-2 border-[#00FF66] text-[#00FF66] shadow-[0_0_12px_rgba(0,255,102,0.4)]'
                  : 'bg-[#00FF66] border border-transparent text-[#000000] shadow-[0_4px_16px_rgba(0,255,102,0.3)] hover:brightness-110 active:translate-x-[1px] active:translate-y-[1px]'
                : isPlaying
                  ? 'bg-[#E85D2A]/10 border-[#E85D2A]/50 text-[#E85D2A]'
                  : 'bg-[#E85D2A] border-[#1A1A1A] text-white hover:bg-[#C94E22]'
            }`}
            title="Play/Pause (Space)"
          >
            {isPlaying
              ? <Pause className="w-4 h-4 fill-current" />
              : <Play className="w-4 h-4 ml-0.5 fill-current" />
            }
          </GlassButton>

          <GlassButton
            onClick={() => onFrameSeek(Math.min(max, safeFrame + 1))}
            className={`p-2 w-8 h-8 rounded-md transition-colors ${
              isDark 
                ? 'bg-[#121216] border-white/10 text-[#F1EEF8] hover:border-[#00FF66] hover:text-[#00FF66]' 
                : ''
            }`}
            title="Next frame (→)"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </GlassButton>
        </div>

        {/* Right: frame counter + FPS */}
        <div className="absolute right-0 flex items-center gap-2">
          <span className={`text-[10px] font-mono font-bold tabular-nums tracking-widest ${
            isDark ? 'text-[#00FF66]' : 'text-[#1A1A1A]'
          }`}>
            {pad(safeFrame + 1)}/{pad(totalFrames)}
          </span>
          <select
            value={targetFps}
            onChange={e => onFpsChange(parseInt(e.target.value))}
            className={`font-mono text-[10px] px-1.5 py-1 outline-none cursor-pointer transition-colors ${
              isDark 
                ? 'bg-[#121216] border border-white/10 text-[#F1EEF8] focus:border-[#00FF66]' 
                : 'bg-white border border-[#1A1A1A] text-[#1A1A1A] focus:border-[#E85D2A]'
            }`}
          >
            <option value="15">15 FPS</option>
            <option value="24">24 FPS</option>
            <option value="30">30 FPS</option>
          </select>
        </div>
      </div>
    </div>
  );
};
