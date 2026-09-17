import React from 'react';
import { DitherConfig, DitherAlgorithm } from '../types/dither';
import { Sliders, Sun, Contrast, Contrast as InvertIcon, Layers } from 'lucide-react';

interface DitherControlsProps {
  config: DitherConfig;
  onChange: (newConfig: DitherConfig) => void;
  disabled?: boolean;
}

export const DitherControls: React.FC<DitherControlsProps> = ({
  config,
  onChange,
  disabled = false,
}) => {
  return (
    <div
      className={`bg-oled-surface border border-oled-border rounded-xl p-4 space-y-4 transition-opacity ${
        disabled ? 'opacity-50 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="flex items-center justify-between border-b border-oled-border/60 pb-2">
        <div className="flex items-center space-x-2 text-slate-300">
          <Sliders className="w-4 h-4 text-oled-cyan" />
          <h3 className="text-xs font-bold uppercase tracking-wider">
            1-Bit Dithering Engine
          </h3>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-oled-cyan border border-cyan-500/20">
          {config.algorithm.toUpperCase()}
        </span>
      </div>

      {/* Dither Algorithm Selector Buttons */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-mono text-slate-400 flex items-center justify-between">
          <span>Algorithm:</span>
          <span className="text-oled-cyan text-[10px]">
            {config.algorithm === 'atkinson'
              ? '✨ Atkinson (Recommended for Lyrics/Line Art)'
              : config.algorithm === 'floyd-steinberg'
              ? 'Floyd-Steinberg (Smooth Grayscale)'
              : config.algorithm.startsWith('bayer')
              ? 'Bayer Matrix (Ordered Crosshatch)'
              : 'Crisp Threshold'}
          </span>
        </label>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { id: 'atkinson', label: 'Atkinson' },
              { id: 'floyd-steinberg', label: 'Floyd-S.' },
              { id: 'bayer-4', label: 'Bayer 4x4' },
              { id: 'bayer-8', label: 'Bayer 8x8' },
              { id: 'threshold', label: 'Threshold' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange({ ...config, algorithm: item.id as DitherAlgorithm })}
              className={`px-2.5 py-1.5 rounded text-xs font-mono border transition-all cursor-pointer ${
                config.algorithm === item.id
                  ? 'bg-cyan-500/20 text-oled-cyan border-cyan-500/50 font-bold shadow-sm shadow-cyan-500/10'
                  : 'bg-oled-panel text-slate-400 border-oled-border hover:text-slate-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Brightness & Contrast Sliders */}
      <div className="grid grid-cols-2 gap-4">
        {/* Brightness */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span className="flex items-center gap-1">
              <Sun className="w-3 h-3 text-amber-400" /> Brightness:
            </span>
            <span className="text-slate-200">{config.brightness > 0 ? `+${config.brightness}` : config.brightness}</span>
          </div>
          <input
            type="range"
            min="-100"
            max="100"
            value={config.brightness}
            onChange={(e) =>
              onChange({ ...config, brightness: parseInt(e.target.value, 10) })
            }
            className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded cursor-pointer"
          />
        </div>

        {/* Contrast */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span className="flex items-center gap-1">
              <Contrast className="w-3 h-3 text-cyan-400" /> Contrast:
            </span>
            <span className="text-slate-200">{config.contrast > 0 ? `+${config.contrast}` : config.contrast}</span>
          </div>
          <input
            type="range"
            min="-100"
            max="100"
            value={config.contrast}
            onChange={(e) =>
              onChange({ ...config, contrast: parseInt(e.target.value, 10) })
            }
            className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded cursor-pointer"
          />
        </div>
      </div>

      {/* Invert Toggle */}
      <div className="flex items-center justify-between pt-1">
        <label className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5 cursor-pointer">
          <InvertIcon className="w-3.5 h-3.5 text-slate-400" />
          <span>Invert Monochrome Colors (White/Black):</span>
        </label>
        <button
          type="button"
          onClick={() => onChange({ ...config, invert: !config.invert })}
          className={`px-3 py-1 rounded text-xs font-mono border transition-all cursor-pointer ${
            config.invert
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
              : 'bg-oled-panel text-slate-400 border-oled-border'
          }`}
        >
          {config.invert ? 'Inverted (Black text)' : 'Standard (White text)'}
        </button>
      </div>
    </div>
  );
};
