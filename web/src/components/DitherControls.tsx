import React from 'react';
import { motion } from 'framer-motion';
import { DitherConfig, DitherAlgorithm, PhosphorTheme } from '../types/dither';
import { TactileRotaryKnob } from './hardware/TactileRotaryKnob';
import { HW_SPRINGS } from '../theme/springPresets';

interface DitherControlsProps {
  config: DitherConfig;
  onChange: (config: DitherConfig) => void;
  disabled?: boolean;
  themeMode?: 'light' | 'dark';
}

export const DitherControls: React.FC<DitherControlsProps> = ({ config, onChange, disabled, themeMode = 'light' }) => {
  const isDark = themeMode === 'dark';
  const algorithms: { id: DitherAlgorithm; label: string }[] = [
    { id: 'atkinson', label: 'Atkinson' },
    { id: 'floyd-steinberg', label: 'Floyd–Steinberg' },
    { id: 'bayer-4', label: 'Bayer 4×4' },
    { id: 'bayer-8', label: 'Bayer 8×8' },
    { id: 'threshold', label: 'Threshold' }
  ];

  return (
    <div className={`space-y-4 transition-all duration-300 ${
      disabled 
        ? 'opacity-35 grayscale pointer-events-none select-none cursor-not-allowed' 
        : ''
    }`}>
      <div className="space-y-2">
        <label className="text-xs font-medium text-[var(--hw-text-secondary)] font-sans">
          Algorithm
        </label>
        <div className="border border-white/[0.08] rounded-[8px] p-1 flex flex-wrap gap-1 relative bg-[var(--hw-bg-surface)]">
          {algorithms.map((algo) => {
            const isSelected = config.algorithm === algo.id;
            return (
              <button
                key={algo.id}
                onClick={() => onChange({ ...config, algorithm: algo.id })}
                className={`relative flex-1 min-w-[70px] text-xs font-sans font-medium py-1.5 rounded-[6px] transition-colors duration-150 z-10 cursor-pointer ${
                  isSelected
                    ? 'text-[var(--hw-text-primary)] font-semibold'
                    : 'text-[var(--hw-text-secondary)] hover:text-[var(--hw-text-primary)]'
                }`}
              >
                {isSelected && (
                  <motion.div
                    layoutId="ditherAlgoActivePill"
                    transition={HW_SPRINGS.smooth}
                    className="absolute inset-0 rounded-[6px] bg-white/[0.12] dark:bg-white/[0.12] border border-white/10 shadow-xs z-[-1]"
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
            accent="amber"
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
              accent="amber"
              themeMode={themeMode}
            />
          </div>
        )}
      </div>

      {/* Hardware Toggle Switch */}
      <div className="flex items-center justify-between pt-2">
        <label className="text-xs font-medium text-[var(--hw-text-secondary)] font-sans">
          Invert colors
        </label>
        <button
          type="button"
          onClick={() => onChange({ ...config, invert: !config.invert })}
          className="flex items-center gap-2 px-2.5 py-1 text-xs font-sans font-medium border border-white/[0.08] rounded-[8px] bg-[var(--hw-bg-surface)] hover:bg-[var(--hw-bg-raised)] transition-colors cursor-pointer"
        >
          <span className={config.invert ? 'text-[#FF5500]' : 'text-[var(--hw-text-secondary)]'}>
            {config.invert ? 'Inverted' : 'Normal'}
          </span>
          <div className={`w-7 h-4 rounded-full relative transition-colors p-0.5 ${
            config.invert
              ? 'bg-[#FF5500]'
              : 'bg-[var(--hw-bg-raised)] border border-white/10'
          }`}>
            <motion.div
              layout
              transition={HW_SPRINGS.snappy}
              className={`w-3 h-3 rounded-full ${
                config.invert
                  ? 'bg-black ml-auto'
                  : 'bg-[#71717A] ml-0'
              }`}
            />
          </div>
        </button>
      </div>

      <div className="space-y-2 pt-4 border-t border-white/[0.08]">
        <label className="text-xs font-medium text-[var(--hw-text-secondary)] font-sans">
          Phosphor theme
        </label>
        <select
          value={config.theme}
          onChange={(e) => onChange({ ...config, theme: e.target.value as PhosphorTheme })}
          className="w-full font-sans px-3 py-2 text-xs rounded-[8px] cursor-pointer transition-colors bg-[var(--hw-bg-surface)] border border-white/[0.08] text-[var(--hw-text-primary)] focus:border-[#FF5500] outline-none"
        >
          <option value="cyan">Cyan</option>
          <option value="white">White</option>
          <option value="amber">Amber</option>
          <option value="green">Green</option>
          <option value="yellow-blue">Yellow / Blue</option>
        </select>
      </div>
    </div>
  );
};
