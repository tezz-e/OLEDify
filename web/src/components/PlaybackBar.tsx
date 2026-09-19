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
  const pad = (num: number) => num.toString().padStart(3, '0');

  return (
    <div className="flex flex-col w-full max-w-sm mt-4 space-y-2 select-none">
      <div className="flex items-center justify-between space-x-2">
        <div className="flex items-center space-x-1">
          <button 
            onClick={onReset}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-oled-panel rounded transition-colors"
            title="Reset"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          
          <button 
            onClick={() => onFrameSeek(Math.max(0, currentFrame - 1))}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-oled-panel rounded transition-colors"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          
          <button 
            onClick={onTogglePlay}
            className="p-2 bg-oled-panel border border-oled-border text-oled-cyan hover:bg-oled-border-bright rounded transition-colors"
            title="Play/Pause (Space)"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>
          
          <button 
            onClick={() => onFrameSeek(Math.min(totalFrames - 1, currentFrame + 1))}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-oled-panel rounded transition-colors"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center space-x-3 text-xs font-mono">
          <span className="text-slate-400 w-[60px] text-right">
            {totalFrames > 0 ? `${pad(currentFrame + 1)}/${pad(totalFrames)}` : '---/---'}
          </span>
          <select 
            value={targetFps}
            onChange={(e) => onFpsChange(parseInt(e.target.value))}
            className="bg-transparent border border-oled-border text-slate-300 rounded px-1 py-0.5 outline-none focus:border-oled-cyan cursor-pointer"
          >
            <option value="15">15fps</option>
            <option value="24">24fps</option>
            <option value="30">30fps</option>
          </select>
        </div>
      </div>
      
      <input
        type="range"
        min={0}
        max={Math.max(0, totalFrames - 1)}
        value={currentFrame}
        onChange={(e) => onFrameSeek(parseInt(e.target.value))}
        className="w-full"
        disabled={totalFrames === 0}
      />
    </div>
  );
};
