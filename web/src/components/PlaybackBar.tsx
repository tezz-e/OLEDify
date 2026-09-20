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
}) => {
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
        className="w-full cursor-pointer accent-[#E85D2A] h-1"
        disabled={totalFrames === 0}
        style={{ accentColor: '#E85D2A' }}
      />

      {/* Controls row */}
      <div className="flex items-center w-full relative">
        {/* Center: transport buttons */}
        <div className="flex items-center gap-1.5 mx-auto">
          <GlassButton
            onClick={onReset}
            className="p-2 w-8 h-8 rounded-md"
            title="Go to start"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </GlassButton>

          <GlassButton
            onClick={() => onFrameSeek(Math.max(0, safeFrame - 1))}
            className="p-2 w-8 h-8 rounded-md"
            title="Previous frame (←)"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </GlassButton>

          <GlassButton
            onClick={onTogglePlay}
            className={`w-11 h-9 rounded-md font-bold ${
              isPlaying
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
            className="p-2 w-8 h-8 rounded-md"
            title="Next frame (→)"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </GlassButton>
        </div>

        {/* Right: frame counter + FPS */}
        <div className="absolute right-0 flex items-center gap-2">
          <span className="text-[10px] font-mono font-bold text-[#1A1A1A] tabular-nums tracking-widest">
            {pad(safeFrame + 1)}/{pad(totalFrames)}
          </span>
          <select
            value={targetFps}
            onChange={e => onFpsChange(parseInt(e.target.value))}
            className="bg-white border border-[#1A1A1A] text-[#1A1A1A] font-mono text-[10px] px-1.5 py-1 outline-none focus:border-[#E85D2A] cursor-pointer"
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
