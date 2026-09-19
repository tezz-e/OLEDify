import React, { useState, useEffect } from 'react';

interface TrimControlsProps {
  totalFrames: number;
  trimRange?: { start: number; end: number };
  onTrim: (start: number, end: number) => void;
  onFrameSeek: (frameIndex: number) => void;
  disabled?: boolean;
}

export const TrimControls: React.FC<TrimControlsProps> = ({ totalFrames, trimRange, onTrim, onFrameSeek, disabled }) => {
  const [startFrame, setStartFrame] = useState(0);
  const [endFrame, setEndFrame] = useState(totalFrames > 0 ? totalFrames - 1 : 0);
  const [justApplied, setJustApplied] = useState(false);

  useEffect(() => {
    if (trimRange) {
      setStartFrame(trimRange.start);
      setEndFrame(trimRange.end);
    } else if (totalFrames > 0) {
      setStartFrame(0);
      setEndFrame(totalFrames - 1);
    }
  }, [totalFrames, trimRange?.start, trimRange?.end]);

  const handleApply = () => {
    if (startFrame <= endFrame) {
      onTrim(startFrame, endFrame);
      setJustApplied(true);
      setTimeout(() => setJustApplied(false), 1200);
    }
  };

  if (totalFrames === 0) return null;

  return (
    <div className={`space-y-4 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="space-y-1">
        <div className="flex justify-between text-xs font-mono text-slate-400">
          <span>Start Frame</span>
          <span>{startFrame}</span>
        </div>
        <input
          type="range"
          min="0"
          max={totalFrames - 1}
          value={startFrame}
          onChange={(e) => {
            const val = Math.min(parseInt(e.target.value), endFrame);
            setStartFrame(val);
            onFrameSeek(val);
          }}
          className="w-full cursor-pointer accent-cyan-500"
        />
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-xs font-mono text-slate-400">
          <span>End Frame</span>
          <span>{endFrame}</span>
        </div>
        <input
          type="range"
          min="0"
          max={totalFrames - 1}
          value={endFrame}
          onChange={(e) => {
            const val = Math.max(parseInt(e.target.value), startFrame);
            setEndFrame(val);
            onFrameSeek(val);
          }}
          className="w-full cursor-pointer accent-cyan-500"
        />
      </div>

      <button
        onClick={handleApply}
        className={`w-full py-1.5 rounded text-xs font-medium transition-all ${
          justApplied 
            ? 'bg-emerald-600 text-white border border-emerald-500 shadow-sm shadow-emerald-900/50' 
            : 'bg-oled-panel border border-oled-border text-slate-200 hover:bg-oled-border-bright hover:text-white'
        }`}
      >
        {justApplied ? '✓ Trim Applied' : 'Apply Trim'}
      </button>

      <div className="text-[10px] font-mono text-slate-500 text-center">
        Selected: {endFrame - startFrame + 1} / {totalFrames} frames
      </div>
    </div>
  );
};
