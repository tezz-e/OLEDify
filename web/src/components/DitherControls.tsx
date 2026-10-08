import React from 'react';
import { motion } from 'framer-motion';
import { DitherConfig, DitherAlgorithm, PhosphorTheme } from '../types/dither';
import { TactileRotaryKnob } from './hardware/TactileRotaryKnob';

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
        <div className={`border p-1 flex flex-wrap gap-1 relative ${
          isDark ? 'bg-[#0A0A0C]/80 backdrop-blur-md border-white/10' : 'bg-[#F6F6F4] border-[#1A1A1A]'
        }`}>
          {algorithms.map((algo) => {
            const isSelected = config.algorithm === algo.id;
            return (
              <button
                key={algo.id}
                onClick={() => onChange({ ...config, algorithm: algo.id })}
                className={`relative flex-1 min-w-[70px] text-[10px] font-mono font-bold tracking-wide py-1.5 transition-colors duration-200 z-10 cursor-pointer ${
                  isSelected
                    ? 'text-white font-extrabold'
                    : isDark ? 'text-[#A1A1AA] hover:text-white' : 'text-[#6B6B6B] hover:text-[#1A1A1A]'
                }`}
              >
                {isSelected && (
                  <motion.div
                    layoutId="ditherAlgoActivePill"
                    transition={{ type: 'spring', stiffness: 450, damping: 30 }}
                    className={`absolute inset-0 rounded-sm z-[-1] border shadow-sm ${
                      isDark
                        ? 'bg-[#FF5500] border-[#FF7700] shadow-[0_2px_10px_rgba(255,85,0,0.4)]'
                        : 'bg-[#1A1A1A] border-[#1A1A1A]'
                    }`}
                  />
                )}
                <span className="relative z-10">{algo.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Precision Tactile Rotary Encoders */}
      <div className="pt-2 pb-1 border-y border-white/10 my-2">
        <div className="grid grid-cols-2 gap-2 justify-items-center">
          <TactileRotaryKnob
            label="Brightness"
            value={config.brightness}
            onChange={(val) => onChange({ ...config, brightness: val })}
            min={-100}
            max={100}
            step={1}
            unit=""
            accent="phosphor"
            themeMode={themeMode}
          />
          <TactileRotaryKnob
            label="Contrast"
            value={config.contrast}
            onChange={(val) => onChange({ ...config, contrast: val })}
            min={-100}
            max={100}
            step={1}
            unit=""
            accent="amber"
            themeMode={themeMode}
          />
        </div>

        {config.algorithm === 'threshold' && (
          <div className="flex justify-center pt-3 border-t border-white/5 mt-3">
            <TactileRotaryKnob
              label="Threshold"
              value={config.threshold}
              onChange={(val) => onChange({ ...config, threshold: val })}
              min={0}
              max={255}
              step={1}
              unit=""
              accent="phosphor"
              themeMode={themeMode}
            />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-2">
        <label className={`text-[10px] font-bold tracking-widest uppercase font-mono ${
          isDark ? 'text-[#A1A1AA]' : 'text-[#6B6B6B]'
        }`}>Invert Colors</label>
        <button
          type="button"
          onClick={() => onChange({ ...config, invert: !config.invert })}
          className={`px-3 py-1 text-[9px] font-mono font-bold tracking-wider uppercase border transition-all cursor-pointer ${
            config.invert
              ? isDark
                ? 'bg-[#FF5500] text-white border-[#FF5500] font-extrabold shadow-[0_0_12px_rgba(255,85,0,0.4)]'
                : 'bg-[#1A1A1A] text-white border-[#1A1A1A]'
              : isDark
                ? 'bg-[#121216] text-[#A1A1AA] border-white/10 hover:border-white/30 hover:text-white'
                : 'bg-white text-[#6B6B6B] border-[#1A1A1A]'
          }`}
        >
          {config.invert ? 'INVERTED' : 'NORMAL'}
        </button>
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
              ? 'bg-[#0A0A0E] border border-white/15 text-[#FAFAFA] focus:border-[#FF5500] outline-none' 
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
