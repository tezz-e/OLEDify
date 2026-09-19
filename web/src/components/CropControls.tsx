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

  return (
    <div className={`space-y-3 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="space-y-1">
        <label className="text-xs font-semibold text-slate-300">Crop Mode</label>
        <div className="seg-control w-full">
          <button
            onClick={() => handleModeChange('cover')}
            className={`flex-1 ${settings.mode === 'cover' ? 'active' : ''}`}
          >
            Cover
          </button>
          <button
            onClick={() => handleModeChange('contain')}
            className={`flex-1 ${settings.mode === 'contain' ? 'active' : ''}`}
          >
            Contain
          </button>
          <button
            onClick={() => handleModeChange('stretch')}
            className={`flex-1 ${settings.mode === 'stretch' ? 'active' : ''}`}
          >
            Stretch
          </button>
        </div>
      </div>

      <div className="flex items-center space-x-2 pt-1">
        <input
          type="checkbox"
          id="smoothing"
          checked={settings.smoothing}
          onChange={(e) => onChange({ ...settings, smoothing: e.target.checked })}
          className="rounded border-oled-border bg-oled-panel text-cyan-500 focus:ring-0 cursor-pointer"
        />
        <label htmlFor="smoothing" className="text-xs text-slate-400 cursor-pointer select-none">
          Bicubic Smoothing
        </label>
      </div>

      <div className="text-[10px] font-mono text-slate-500">
        Source: {settings.sourceWidth}×{settings.sourceHeight} <br />
        Crop: {Math.round(settings.width)}×{Math.round(settings.height)}
      </div>
    </div>
  );
};
