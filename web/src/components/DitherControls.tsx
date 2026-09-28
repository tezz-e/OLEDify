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
    { id: 'floyd-steinberg', label: 'Floyd–Steinberg' },
    { id: 'bayer-4', label: 'Bayer 4×4' },
    { id: 'bayer-8', label: 'Bayer 8×8' },
    { id: 'threshold', label: 'Threshold' }
  ];

  return (
    <div className={`space-y-4 ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
      <div className="space-y-2">
        <label className="text-xs font-sans font-medium text-[#141413] block">Dithering Algorithm</label>
        <div className="bg-[#FAF9F5] border border-[#E8E5DE] p-1 rounded-lg flex flex-wrap gap-1">
          {algorithms.map((algo) => (
            <button
              key={algo.id}
              onClick={() => onChange({ ...config, algorithm: algo.id })}
              className={`flex-1 min-w-[70px] text-[11px] font-sans py-1 px-2 rounded-md transition-all cursor-pointer ${
                config.algorithm === algo.id 
                  ? 'bg-white text-[#141413] font-semibold shadow-xs border border-[#E8E5DE]' 
                  : 'text-[#5E5D59] hover:text-[#141413]'
              }`}
            >
              {algo.label}
            </button>
          ))}
        </div>
      </div>

      {config.algorithm === 'threshold' && (
        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between items-center text-xs">
            <span className="font-sans font-medium text-[#141413]">Threshold</span>
            <span className="text-[#5E5D59] font-mono">{config.threshold}</span>
          </div>
          <input
            type="range"
            min="0"
            max="255"
            value={config.threshold}
            onChange={(e) => onChange({ ...config, threshold: parseInt(e.target.value) })}
            className="w-full accent-[#D97757] cursor-pointer"
          />
        </div>
      )}

      <div className="space-y-1.5 pt-1">
        <div className="flex justify-between items-center text-xs">
          <span className="font-sans font-medium text-[#141413]">Brightness</span>
          <span className={`font-mono ${config.brightness !== 0 ? 'text-[#D97757] font-semibold' : 'text-[#5E5D59]'}`}>
            {config.brightness > 0 ? `+${config.brightness}` : config.brightness}
          </span>
        </div>
        <input
          type="range"
          min="-100"
          max="100"
          value={config.brightness}
          onChange={(e) => onChange({ ...config, brightness: parseInt(e.target.value) })}
          className="w-full accent-[#D97757] cursor-pointer"
        />
      </div>

      <div className="space-y-1.5 pt-1">
        <div className="flex justify-between items-center text-xs">
          <span className="font-sans font-medium text-[#141413]">Contrast</span>
          <span className={`font-mono ${config.contrast !== 0 ? 'text-[#D97757] font-semibold' : 'text-[#5E5D59]'}`}>
            {config.contrast > 0 ? `+${config.contrast}` : config.contrast}
          </span>
        </div>
        <input
          type="range"
          min="-100"
          max="100"
          value={config.contrast}
          onChange={(e) => onChange({ ...config, contrast: parseInt(e.target.value) })}
          className="w-full accent-[#D97757] cursor-pointer"
        />
      </div>

      <div className="flex items-center justify-between pt-2">
        <label className="text-xs font-sans font-medium text-[#141413] cursor-pointer" htmlFor="invert-toggle">Invert Colors (Negative)</label>
        <input
          id="invert-toggle"
          type="checkbox"
          checked={config.invert}
          onChange={(e) => onChange({ ...config, invert: e.target.checked })}
          className="w-4 h-4 accent-[#D97757] cursor-pointer rounded"
        />
      </div>

      <div className="space-y-1.5 pt-3 border-t border-[#E8E5DE]">
        <label className="text-xs font-sans font-medium text-[#141413] block">Phosphor Simulation</label>
        <select
          value={config.theme}
          onChange={(e) => onChange({ ...config, theme: e.target.value as PhosphorTheme })}
          className="w-full bg-white border border-[#E8E5DE] rounded-lg text-[#141413] font-sans px-3 py-2 text-xs focus:border-[#D97757] focus:ring-1 focus:ring-[#D97757] outline-none shadow-xs cursor-pointer"
        >
          <option value="white">Pure White Monochrome</option>
          <option value="cyan">Classic OLED Cyan</option>
          <option value="amber">Warm Amber Glow</option>
          <option value="green">Retro Phosphor Green</option>
          <option value="yellow-blue">Split Yellow / Blue Header</option>
        </select>
      </div>
    </div>
  );
};
