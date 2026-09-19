import React, { useState, useEffect } from 'react';

interface TrimControlsProps {
  totalFrames: number;
  onTrim: (start: number, end: number) => void;
  disabled?: boolean;
}

export const TrimControls: React.FC<TrimControlsProps> = ({ totalFrames, onTrim, disabled }) => {
  const [startFrame, setStartFrame] = useState(0);
  const [endFrame, setEndFrame] = useState(totalFrames > 0 ? totalFrames - 1 : 0);

  useEffect(() => {
    if (totalFrames > 0) {
      setStartFrame(0);
      setEndFrame(totalFrames - 1);
    }
  }, [totalFrames]);

  const handleApply = () => {
    if (startFrame < endFrame) {
      onTrim(startFrame, endFrame);
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
          onChange={(e) => setStartFrame(Math.min(parseInt(e.target.value), endFrame - 1))}
          className="w-full"
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
          onChange={(e) => setEndFrame(Math.max(parseInt(e.target.value), startFrame + 1))}
          className="w-full"
        />
      </div>

      <button
        onClick={handleApply}
        className="w-full py-1.5 rounded bg-oled-panel border border-oled-border text-xs font-medium text-slate-200 hover:bg-oled-border-bright transition-colors"
      >
        Apply Trim
      </button>

      <div className="text-[10px] font-mono text-slate-500 text-center">
        Selected: {endFrame - startFrame + 1} / {totalFrames} frames
      </div>
    </div>
  );
};
