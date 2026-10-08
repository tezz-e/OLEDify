import React from 'react';
import { DitherConfig, DitherAlgorithm, PhosphorTheme } from '../types/dither';

interface DitherControlsProps {
  config: DitherConfig;
  onChange: (config: DitherConfig) => void;
  disabled?: boolean;
  themeMode?: 'light' | 'dark';
}

export const DitherControls: React.FC<DitherControlsProps> = ({ config, onChange, disabled, themeMode = 'light' }) => {
  const isDark = themeMode === 'dark';
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
        <label className={`text-[10px] font-bold tracking-widest uppercase font-mono ${
          isDark ? 'text-[#FAFAFA]' : 'text-[#1A1A1A]'
        }`}>Algorithm</label>
        <div className={`border p-1 flex flex-wrap gap-1 ${
          isDark ? 'bg-[#0A0A0C] border-white/10' : 'bg-[#F6F6F4] border-[#1A1A1A]'
        }`}>
          {algorithms.map((algo) => (
            <button
              key={algo.id}
              onClick={() => onChange({ ...config, algorithm: algo.id })}
              className={`flex-1 min-w-[70px] text-[10px] font-mono font-bold tracking-wide py-1.5 transition-all duration-150 border ${
                config.algorithm === algo.id 
                  ? isDark 
                    ? 'bg-[#00FF66] text-black border-[#00FF66] font-extrabold shadow-[0_0_12px_rgba(0,255,102,0.35)]' 
                    : 'bg-[#1A1A1A] text-white border-[#1A1A1A]' 
                  : isDark 
                    ? 'bg-[#121214] text-[#A1A1AA] border-white/10 hover:border-white/30 hover:text-white' 
                    : 'bg-white text-[#6B6B6B] border-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white'
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
            <span className={`text-[10px] font-bold tracking-widest uppercase font-mono ${
              isDark ? 'text-[#A1A1AA]' : 'text-[#6B6B6B]'
            }`}>Threshold</span>
            <span className={`font-mono text-xs font-bold ${isDark ? 'text-[#00FF66]' : 'text-[#1A1A1A]'}`}>{config.threshold}</span>
          </div>
          <input
            type="range"
            min="0"
            max="255"
            value={config.threshold}
            onChange={(e) => onChange({ ...config, threshold: parseInt(e.target.value) })}
            className="w-full cursor-pointer h-1"
            style={{ accentColor: isDark ? '#00FF66' : '#E85D2A' }}
          />
        </div>
      )}

      <div className="space-y-1 pt-1">
        <div className="flex justify-between items-center">
          <span className={`text-[10px] font-bold tracking-widest uppercase font-mono ${
            isDark ? 'text-[#A1A1AA]' : 'text-[#6B6B6B]'
          }`}>Brightness</span>
          <span className={`text-xs font-mono font-bold ${
            config.brightness > 0 
              ? isDark ? 'text-[#00FF66]' : 'text-[#E85D2A]' 
              : isDark ? 'text-[#FAFAFA]' : 'text-[#1A1A1A]'
          }`}>
            {config.brightness > 0 ? `+${config.brightness}` : config.brightness}
          </span>
        </div>
        <input
          type="range"
          min="-100"
          max="100"
          value={config.brightness}
          onChange={(e) => onChange({ ...config, brightness: parseInt(e.target.value) })}
          className="w-full cursor-pointer h-1"
          style={{ accentColor: isDark ? '#00FF66' : '#E85D2A' }}
        />
      </div>

      <div className="space-y-1 pt-1">
        <div className="flex justify-between items-center">
          <span className={`text-[10px] font-bold tracking-widest uppercase font-mono ${
            isDark ? 'text-[#A1A1AA]' : 'text-[#6B6B6B]'
          }`}>Contrast</span>
          <span className={`text-xs font-mono font-bold ${
            config.contrast > 0 
              ? isDark ? 'text-[#00FF66]' : 'text-[#E85D2A]' 
              : isDark ? 'text-[#FAFAFA]' : 'text-[#1A1A1A]'
          }`}>
            {config.contrast > 0 ? `+${config.contrast}` : config.contrast}
          </span>
        </div>
        <input
          type="range"
          min="-100"
          max="100"
          value={config.contrast}
          onChange={(e) => onChange({ ...config, contrast: parseInt(e.target.value) })}
          className="w-full cursor-pointer h-1"
          style={{ accentColor: isDark ? '#00FF66' : '#E85D2A' }}
        />
      </div>

      <div className="flex items-center justify-between pt-4">
        <label className={`text-[10px] font-bold tracking-widest uppercase font-mono ${
          isDark ? 'text-[#A1A1AA]' : 'text-[#6B6B6B]'
        }`}>Invert Colors</label>
        <input
          type="checkbox"
          checked={config.invert}
          onChange={(e) => onChange({ ...config, invert: e.target.checked })}
          className="w-4 h-4 cursor-pointer"
          style={{ accentColor: isDark ? '#00FF66' : '#E85D2A' }}
        />
      </div>

      <div className={`space-y-2 pt-4 border-t ${isDark ? 'border-white/10' : 'border-[#1A1A1A]'}`}>
        <label className={`text-[10px] font-bold tracking-widest uppercase font-mono ${
          isDark ? 'text-[#FAFAFA]' : 'text-[#1A1A1A]'
        }`}>Phosphor Theme</label>
        <select
          value={config.theme}
          onChange={(e) => onChange({ ...config, theme: e.target.value as PhosphorTheme })}
          className={`w-full font-mono px-3 py-2 text-xs cursor-pointer transition-colors ${
            isDark 
              ? 'bg-[#0A0A0C] border border-white/10 text-[#FAFAFA] focus:border-[#00FF66]' 
              : 'bg-white border border-[#1A1A1A] text-[#1A1A1A] focus:border-[#E85D2A]'
          }`}
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
