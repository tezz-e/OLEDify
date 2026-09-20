import React from 'react';
import { CropSettings, FitMode } from '../types/media';

interface CropControlsProps {
  settings: CropSettings;
  onChange: (settings: CropSettings) => void;
  disabled?: boolean;
}

export const CropControls: React.FC<CropControlsProps> = ({ settings, onChange, disabled }) => {
  const handleModeChange = (mode: FitMode) => {
    // If we switch to cover/contain/stretch, we normally need the source dimensions to recalculate x,y,w,h.
    // The interactive logic for this is better handled in the parent or custom hook, 
    // but we can trigger a mode change here and let the parent recompute.
    onChange({ ...settings, mode });
  };

  const modes: FitMode[] = ['cover', 'contain', 'stretch'];

  return (
    <div className={`space-y-6 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="space-y-2">
        <label className="text-[10px] font-bold tracking-widest text-[#6B6B6B] uppercase font-mono">Crop Mode</label>
        <div className="bg-[#F5F0EB] border border-[#1A1A1A] p-1 flex gap-1">
          {modes.map((mode) => (
            <button
              key={mode}
              onClick={() => handleModeChange(mode)}
              className={`flex-1 text-[10px] font-mono font-bold tracking-wide py-1.5 transition-colors duration-150 border border-[#1A1A1A] uppercase ${
                settings.mode === mode
                  ? 'bg-[#1A1A1A] text-white'
                  : 'bg-white text-[#6B6B6B] hover:bg-[#1A1A1A] hover:text-white'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <label className="text-[10px] font-bold tracking-widest text-[#6B6B6B] uppercase font-mono">Bicubic Smoothing</label>
        <input
          type="checkbox"
          checked={settings.smoothing}
          onChange={(e) => onChange({ ...settings, smoothing: e.target.checked })}
          className="w-4 h-4 accent-[#E85D2A] cursor-pointer"
        />
      </div>

      <div className="text-[10px] font-mono text-[#6B6B6B]">
        Source: {settings.sourceWidth}×{settings.sourceHeight} <br />
        Crop: {Math.round(settings.width)}×{Math.round(settings.height)}
      </div>
    </div>
  );
};
