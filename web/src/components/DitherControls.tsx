import React from 'react';
import { DitherConfig, DitherAlgorithm, PhosphorTheme } from '../types/dither';

interface DitherControlsProps {
  config: DitherConfig;
  onChange: (config: DitherConfig) => void;
  disabled?: boolean;
}

export const DitherControls: React.FC<DitherControlsProps> = ({ config, onChange, disabled }) => {
  const algorithms: { id: DitherAlgorithm; label: string }[] = [
    { id: 'atkinson', label: 'Atkinson' },
    { id: 'floyd-steinberg', label: 'Floyd-S' },
    { id: 'bayer-4', label: 'Bayer 4×4' },
    { id: 'bayer-8', label: 'Bayer 8×8' },
    { id: 'threshold', label: 'Threshold' }
  ];

  return (
    <div className={`space-y-4 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="space-y-1">
        <label className="text-xs font-semibold text-slate-300">Algorithm</label>
        <div className="seg-control w-full flex-wrap">
          {algorithms.map((algo) => (
            <button
              key={algo.id}
              onClick={() => onChange({ ...config, algorithm: algo.id })}
              className={`flex-1 ${config.algorithm === algo.id ? 'active' : ''}`}
            >
              {algo.label}
            </button>
          ))}
        </div>
      </div>

      {config.algorithm === 'threshold' && (
        <div className="space-y-1 pt-1">
          <div className="flex justify-between text-xs font-mono text-slate-400">
            <span>Threshold</span>
            <span>{config.threshold}</span>
          </div>
          <input
            type="range"
            min="0"
            max="255"
            value={config.threshold}
            onChange={(e) => onChange({ ...config, threshold: parseInt(e.target.value) })}
            className="w-full"
          />
        </div>
      )}

      <div className="space-y-1 pt-1">
        <div className="flex justify-between text-xs font-mono text-slate-400">
          <span>Brightness</span>
          <span className={config.brightness > 0 ? 'text-emerald-400' : config.brightness < 0 ? 'text-amber-400' : ''}>
            {config.brightness > 0 ? `+${config.brightness}` : config.brightness}
          </span>
        </div>
        <input
          type="range"
          min="-100"
          max="100"
          value={config.brightness}
          onChange={(e) => onChange({ ...config, brightness: parseInt(e.target.value) })}
          className="w-full"
        />
      </div>

      <div className="space-y-1 pt-1">
        <div className="flex justify-between text-xs font-mono text-slate-400">
          <span>Contrast</span>
          <span className={config.contrast > 0 ? 'text-emerald-400' : config.contrast < 0 ? 'text-amber-400' : ''}>
            {config.contrast > 0 ? `+${config.contrast}` : config.contrast}
          </span>
        </div>
        <input
          type="range"
          min="-100"
          max="100"
          value={config.contrast}
          onChange={(e) => onChange({ ...config, contrast: parseInt(e.target.value) })}
          className="w-full"
        />
      </div>

      <div className="flex items-center justify-between pt-2">
        <label className="text-xs font-semibold text-slate-300">Invert Colors</label>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={config.invert}
            onChange={(e) => onChange({ ...config, invert: e.target.checked })}
          />
          <div className="w-8 h-4 bg-oled-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-oled-cyan"></div>
        </label>
      </div>

      <div className="space-y-1 pt-2 border-t border-oled-border">
        <label className="text-xs font-semibold text-slate-300">Phosphor Theme</label>
        <select
          value={config.theme}
          onChange={(e) => onChange({ ...config, theme: e.target.value as PhosphorTheme })}
          className="w-full bg-oled-panel border border-oled-border rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-oled-cyan"
        >
          <option value="cyan">Cyan</option>
          <option value="white">White</option>
          <option value="amber">Amber</option>
          <option value="green">Green</option>
          <option value="yellow-blue">Yellow/Blue</option>
        </select>
      </div>
    </div>
  );
};
