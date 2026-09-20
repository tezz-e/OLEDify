import React from 'react';
import { DitherConfig, DitherAlgorithm, PhosphorTheme } from '../types/dither';

interface DitherControlsProps {
  config: DitherConfig;
  onChange: (config: DitherConfig) => void;
  disabled?: boolean;
}

export const DitherControls: React.FC<DitherControlsProps> = ({ config, onChange, disabled }) => {
  const algorithms: { id: DitherAlgorithm; label: string }[] = [
    { id: 'atkinson', label: 'ATKINSON' },
    { id: 'floyd-steinberg', label: 'FLOYD-STEINBERG' },
    { id: 'bayer-4', label: 'BAYER 4X4' },
    { id: 'bayer-8', label: 'BAYER 8X8' },
    { id: 'threshold', label: 'THRESHOLD' }
  ];


  return (
    <div className={`space-y-4 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="space-y-2">
        <label className="text-[10px] font-bold tracking-widest text-[#6B6B6B] uppercase font-mono">Algorithm</label>
        <div className="bg-[#F5F0EB] border border-[#1A1A1A] p-1 flex flex-wrap gap-1">
          {algorithms.map((algo) => (
            <button
              key={algo.id}
              onClick={() => onChange({ ...config, algorithm: algo.id })}
              className={`flex-1 min-w-[70px] text-[10px] font-mono font-bold tracking-wide py-1.5 transition-colors duration-150 border border-[#1A1A1A] ${
                config.algorithm === algo.id 
                  ? 'bg-[#1A1A1A] text-white' 
                  : 'bg-white text-[#6B6B6B] hover:bg-[#1A1A1A] hover:text-white'
              }`}
            >
              {algo.label}
            </button>
          ))}
        </div>
      </div>

      {config.algorithm === 'threshold' && (
        <div className="space-y-1 pt-1">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold tracking-widest text-[#6B6B6B] uppercase font-mono">Threshold</span>
            <span className="text-[#1A1A1A] font-mono text-xs">{config.threshold}</span>
          </div>
          <input
            type="range"
            min="0"
            max="255"
            value={config.threshold}
            onChange={(e) => onChange({ ...config, threshold: parseInt(e.target.value) })}
            className="w-full accent-[#E85D2A] cursor-pointer"
          />
        </div>
      )}

      <div className="space-y-1 pt-1">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-bold tracking-widest text-[#6B6B6B] uppercase font-mono">Brightness</span>
          <span className={`text-xs font-mono ${config.brightness > 0 ? 'text-[#E85D2A]' : 'text-[#1A1A1A]'}`}>
            {config.brightness > 0 ? `+${config.brightness}` : config.brightness}
          </span>
        </div>
        <input
          type="range"
          min="-100"
          max="100"
          value={config.brightness}
          onChange={(e) => onChange({ ...config, brightness: parseInt(e.target.value) })}
          className="w-full accent-[#E85D2A] cursor-pointer"
        />
      </div>

      <div className="space-y-1 pt-1">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-bold tracking-widest text-[#6B6B6B] uppercase font-mono">Contrast</span>
          <span className={`text-xs font-mono ${config.contrast > 0 ? 'text-[#E85D2A]' : 'text-[#1A1A1A]'}`}>
            {config.contrast > 0 ? `+${config.contrast}` : config.contrast}
          </span>
        </div>
        <input
          type="range"
          min="-100"
          max="100"
          value={config.contrast}
          onChange={(e) => onChange({ ...config, contrast: parseInt(e.target.value) })}
          className="w-full accent-[#E85D2A] cursor-pointer"
        />
      </div>

      <div className="flex items-center justify-between pt-4">
        <label className="text-[10px] font-bold tracking-widest text-[#6B6B6B] uppercase font-mono">Invert Colors</label>
        <input
          type="checkbox"
          checked={config.invert}
          onChange={(e) => onChange({ ...config, invert: e.target.checked })}
          className="w-4 h-4 accent-[#E85D2A] cursor-pointer"
        />
      </div>

      <div className="space-y-2 pt-4 border-t border-[#1A1A1A]">
        <label className="text-[10px] font-bold tracking-widest text-[#6B6B6B] uppercase font-mono">Phosphor Theme</label>
        <select
          value={config.theme}
          onChange={(e) => onChange({ ...config, theme: e.target.value as PhosphorTheme })}
          className="w-full bg-white border border-[#1A1A1A] text-[#1A1A1A] font-mono px-3 py-2 text-xs focus:border-[#E85D2A] cursor-pointer"
        >
          <option value="cyan">CYAN</option>
          <option value="white">WHITE</option>
          <option value="amber">AMBER</option>
          <option value="green">GREEN</option>
          <option value="yellow-blue">YELLOW / BLUE</option>
        </select>
      </div>
    </div>
  );
};
