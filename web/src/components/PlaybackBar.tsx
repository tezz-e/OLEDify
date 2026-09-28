import React from 'react';
import { Play, Pause, SkipBack, SkipForward, RotateCcw } from 'lucide-react';

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
    <div className="flex flex-col w-full gap-2.5 select-none">
      {/* Seek slider */}
      <input
        type="range"
        min={0}
        max={max}
        value={safeFrame}
        onChange={e => onFrameSeek(parseInt(e.target.value))}
        className="w-full cursor-pointer accent-[#D97757] h-1.5 bg-[#E8E5DE] rounded-lg"
        disabled={totalFrames === 0}
        style={{ accentColor: '#D97757' }}
      />

      {/* Controls row */}
      <div className="flex items-center w-full relative">
        {/* Center: transport buttons */}
        <div className="flex items-center gap-1.5 mx-auto">
          <button
            onClick={onReset}
            className="w-8 h-8 rounded-lg bg-white border border-[#E8E5DE] text-[#5E5D59] hover:text-[#141413] hover:bg-[#FAF9F5] shadow-xs flex items-center justify-center transition-all cursor-pointer"
            title="Go to start"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => onFrameSeek(Math.max(0, safeFrame - 1))}
            className="w-8 h-8 rounded-lg bg-white border border-[#E8E5DE] text-[#5E5D59] hover:text-[#141413] hover:bg-[#FAF9F5] shadow-xs flex items-center justify-center transition-all cursor-pointer"
            title="Previous frame (←)"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onTogglePlay}
            className={`w-11 h-8 rounded-lg shadow-xs flex items-center justify-center transition-all cursor-pointer font-medium ${
              isPlaying
                ? 'bg-[#FAF0EB] border border-[#D97757] text-[#D97757]'
                : 'bg-[#141413] hover:bg-[#2A2926] text-[#FAF9F5]'
            }`}
            title="Play/Pause (Space)"
          >
            {isPlaying
              ? <Pause className="w-4 h-4 fill-current" />
              : <Play className="w-4 h-4 ml-0.5 fill-current" />
            }
          </button>

          <button
            onClick={() => onFrameSeek(Math.min(max, safeFrame + 1))}
            className="w-8 h-8 rounded-lg bg-white border border-[#E8E5DE] text-[#5E5D59] hover:text-[#141413] hover:bg-[#FAF9F5] shadow-xs flex items-center justify-center transition-all cursor-pointer"
            title="Next frame (→)"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right: frame counter + FPS */}
        <div className="absolute right-0 flex items-center gap-2.5">
          <span className="text-xs font-mono font-medium text-[#141413] tabular-nums tracking-wide">
            {pad(safeFrame + 1)} / {pad(totalFrames)}
          </span>
          <select
            value={targetFps}
            onChange={e => onFpsChange(parseInt(e.target.value))}
            className="bg-white border border-[#E8E5DE] rounded-md text-[#141413] font-mono text-xs px-2 py-1 outline-none focus:border-[#D97757] shadow-xs cursor-pointer"
          >
            <option value="15">15 fps</option>
            <option value="24">24 fps</option>
            <option value="30">30 fps</option>
          </select>
        </div>
      </div>
    </div>
  );
};
