import React, { useState, useEffect } from 'react';

interface TrimControlsProps {
  totalFrames: number;
  originalTotalFrames?: number;
  onApplyTrim: (start: number, end: number) => void;
  onResetTrim?: () => void;
  onFrameSeek: (frameIndex: number) => void;
  disabled?: boolean;
}

export const TrimControls: React.FC<TrimControlsProps> = ({
  totalFrames,
  originalTotalFrames,
  onApplyTrim,
  onResetTrim,
  onFrameSeek,
  disabled
}) => {
  const [startFrame, setStartFrame] = useState(0);
  const [endFrame, setEndFrame] = useState(totalFrames > 0 ? totalFrames - 1 : 0);
  const [justApplied, setJustApplied] = useState(false);

  useEffect(() => {
    if (totalFrames > 0) {
      setStartFrame(0);
      setEndFrame(totalFrames - 1);
    }
  }, [totalFrames]);

  const handleApply = () => {
    if (startFrame <= endFrame) {
      onApplyTrim(startFrame, endFrame);
      setJustApplied(true);
      setTimeout(() => setJustApplied(false), 1200);
    }
  };

  if (totalFrames === 0) return null;

  const isTrimmed = originalTotalFrames !== undefined && totalFrames < originalTotalFrames;

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

      <div className="flex gap-2">
        <button
          onClick={handleApply}
          className={`flex-1 py-1.5 rounded text-xs font-medium transition-all ${
            justApplied 
              ? 'bg-emerald-600 text-white border border-emerald-500 shadow-sm shadow-emerald-900/50' 
              : 'bg-oled-panel border border-oled-border text-slate-200 hover:bg-oled-border-bright hover:text-white'
          }`}
        >
          {justApplied ? '✓ Trimmed!' : 'Apply Trim'}
        </button>

        {isTrimmed && onResetTrim && (
          <button
            onClick={onResetTrim}
            className="px-3 py-1.5 rounded text-xs font-medium bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
            title="Reset to original un-trimmed media"
          >
            Reset
          </button>
        )}
      </div>

      <div className="text-[10px] font-mono text-slate-500 text-center">
        {isTrimmed 
          ? `Active Trim: ${totalFrames} frames (Original: ${originalTotalFrames})` 
          : `Selected Range: ${endFrame - startFrame + 1} / ${totalFrames} frames`
        }
      </div>
    </div>
  );
};
