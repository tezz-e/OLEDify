import React, { useState, useEffect } from 'react';
import { ClickSpark } from './reactbits/ClickSpark';

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
    <div className={`space-y-6 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-bold tracking-widest text-[#6B6B6B] uppercase font-mono">Start Frame</span>
          <span className="text-[#1A1A1A] font-mono text-xs">{startFrame}</span>
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
          className="w-full accent-[#E85D2A] cursor-pointer"
        />
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-bold tracking-widest text-[#6B6B6B] uppercase font-mono">End Frame</span>
          <span className="text-[#1A1A1A] font-mono text-xs">{endFrame}</span>
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
          className="w-full accent-[#E85D2A] cursor-pointer"
        />
      </div>

      <div className="flex gap-2">
        <ClickSpark
          sparkColor="#E85D2A"
          sparkCount={10}
          sparkSize={7}
          sparkRadius={20}
          duration={350}
          className="flex-1"
        >
          <button
            onClick={handleApply}
            className={`w-full ${
              justApplied 
                ? 'bg-[#1A1A1A] text-white border-2 border-[#1A1A1A] py-2 text-[10px] font-mono font-bold tracking-widest uppercase' 
                : 'accent-btn'
            }`}
          >
            {justApplied ? '✓ Applied' : 'Apply Trim'}
          </button>
        </ClickSpark>

        {isTrimmed && onResetTrim && (
          <button
            onClick={onResetTrim}
            className="tech-btn hover:text-[#E85D2A] hover:border-[#E85D2A]"
            title="Reset to original un-trimmed media"
          >
            Reset
          </button>
        )}
      </div>

      <div className="text-[10px] font-mono text-[#6B6B6B] text-center">
        {isTrimmed 
          ? `Active Trim: ${totalFrames} frames (Original: ${originalTotalFrames})` 
          : `Selected Range: ${endFrame - startFrame + 1} / ${totalFrames} frames`
        }
      </div>
    </div>
  );
};
