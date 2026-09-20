import React from 'react';
import { Play, Pause, SkipBack, SkipForward, RotateCcw } from 'lucide-react';
import { CountUp } from './reactbits/CountUp';
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
  trimRange?: { start: number; end: number };
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
  trimRange,
}) => {
  const pad = (num: number) => num.toString().padStart(3, '0');

  const min = trimRange ? trimRange.start : 0;
  const max = trimRange ? trimRange.end : Math.max(0, totalFrames - 1);
  const durationFrames = trimRange ? (trimRange.end - trimRange.start + 1) : totalFrames;
  const displayFrame = currentFrame - min + 1;

  return (
    <div className="flex flex-col w-full mt-4 space-y-4 select-none rounded-xl">
      <div className="flex items-center justify-between space-x-2">
        <div className="flex items-center space-x-2">
          <GlassButton 
            onClick={onReset}
            className="p-2 w-9 h-9 rounded-lg"
            title="Reset"
          >
            <RotateCcw className="w-4 h-4" />
          </GlassButton>
          
          <GlassButton 
            onClick={() => onFrameSeek(Math.max(min, currentFrame - 1))}
            className="p-2 w-9 h-9 rounded-lg"
            title="Previous Frame"
          >
            <SkipBack className="w-4 h-4" />
          </GlassButton>
          
          <GlassButton 
            onClick={onTogglePlay}
            className={`w-12 h-10 rounded-lg ${isPlaying ? 'bg-[#E85D2A]/10 border-[#E85D2A]/50 text-[#E85D2A]' : 'bg-[#E85D2A] border-[#1A1A1A] text-white hover:bg-[#E85D2A]/80'}`}
            title="Play/Pause (Space)"
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 ml-0.5 fill-current" />}
          </GlassButton>
          
          <GlassButton 
            onClick={() => onFrameSeek(Math.min(max, currentFrame + 1))}
            className="p-2 w-9 h-9 rounded-lg"
            title="Next Frame"
          >
            <SkipForward className="w-4 h-4" />
          </GlassButton>
        </div>

        <div className="flex items-center space-x-4 text-xs font-mono">
          <span className="text-[#1A1A1A] font-mono font-bold min-w-[70px] text-right tracking-widest tabular-nums flex items-center justify-end">
            {durationFrames > 0 ? (
              <>
                <span>{pad(displayFrame)}/</span>
                <CountUp to={durationFrames} duration={0.6} />
              </>
            ) : '---/---'}
          </span>
          <select 
            value={targetFps}
            onChange={(e) => onFpsChange(parseInt(e.target.value))}
            className="bg-white border border-[#1A1A1A] text-[#1A1A1A] font-mono px-2 py-1 outline-none focus:border-[#E85D2A] cursor-pointer"
          >
            <option value="15">15 FPS</option>
            <option value="24">24 FPS</option>
            <option value="30">30 FPS</option>
          </select>
        </div>
      </div>
      
      <input
        type="range"
        min={min}
        max={max}
        value={currentFrame}
        onChange={(e) => onFrameSeek(parseInt(e.target.value))}
        className="w-full accent-[#E85D2A] cursor-pointer bg-transparent"
        disabled={durationFrames === 0}
      />
    </div>
  );
};
