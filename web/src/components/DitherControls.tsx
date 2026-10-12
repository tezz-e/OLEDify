import React, { useState } from 'react';
import { motion, LayoutGroup, AnimatePresence } from 'framer-motion';
import { DitherConfig, DitherAlgorithm, PhosphorTheme } from '../types/dither';
import { TactileRotaryKnob } from './hardware/TactileRotaryKnob';
import { HW_SPRINGS } from '../theme/springPresets';
import { triggerTactileFeedback } from './hardware/hapticAudio';
import { GooeySegmentedControl } from './ui/GooeySegmentedControl';

interface DitherControlsProps {
  config: DitherConfig;
  onChange: (config: DitherConfig) => void;
  disabled?: boolean;
  themeMode?: 'light' | 'dark';
}

interface AlgorithmMeta {
  id: DitherAlgorithm;
  label: string;
  type: string;
  divisor?: string;
  description: string;
  matrix: (number | string)[][];
}

const ALGORITHM_DETAILS: Record<DitherAlgorithm, AlgorithmMeta> = {
  'atkinson': {
    id: 'atkinson',
    label: 'Atkinson',
    type: 'Error Diffusion',
    divisor: '1/8',
    description: 'Apple Macintosh classic. Retains sharp edge contours with zero muddy shadow clumping.',
    matrix: [
      ['•', '1', '1'],
      ['1', '1', '1'],
      [' ', '1', ' ']
    ]
  },
  'floyd-steinberg': {
    id: 'floyd-steinberg',
    label: 'Floyd–Steinberg',
    type: 'Error Diffusion',
    divisor: '1/16',
    description: 'Serpentine spatial diffusion distributing quantization error across 4 adjacent neighbors.',
    matrix: [
      ['•', '7'],
      ['3', '5', '1']
    ]
  },
  'bayer-2': {
    id: 'bayer-2',
    label: 'Bayer 2×2',
    type: 'Ordered Matrix',
    divisor: '1/4',
    description: 'Minimal 4-level spatial thresholding pattern. Compact high-contrast halftone.',
    matrix: [
      [0, 2],
      [3, 1]
    ]
  },
  'bayer-4': {
    id: 'bayer-4',
    label: 'Bayer 4×4',
    type: 'Ordered Matrix',
    divisor: '1/16',
    description: '16-level periodic spatial grid. Zero temporal drift or frame jitter on streaming video.',
    matrix: [
      [0, 8, 2, 10],
      [12, 4, 14, 6],
      [3, 11, 1, 9],
      [15, 7, 13, 5]
    ]
  },
  'bayer-8': {
    id: 'bayer-8',
    label: 'Bayer 8×8',
    type: 'Ordered Matrix',
    divisor: '1/64',
    description: 'Fine 64-level spatial thresholding pattern. Ultra-smooth continuous tone gradients.',
    matrix: [
      [0, 32, 8, 40],
      [48, 16, 56, 24],
      [12, 44, 4, 36],
      [60, 28, 52, 20]
    ]
  },
  'threshold': {
    id: 'threshold',
    label: 'Threshold',
    type: '1-Bit Cutoff',
    description: 'Direct binary luminance comparator. Pure vector contrast without halftoning noise.',
    matrix: [
      ['f(L) = L ≥ T ? 1 : 0']
    ]
  }
};

export const DitherControls: React.FC<DitherControlsProps> = ({ config, onChange, disabled, themeMode = 'light' }) => {
  const isDark = themeMode === 'dark';
  const [hoveredAlgo, setHoveredAlgo] = useState<DitherAlgorithm | null>(null);
  const [showMatrix, setShowMatrix] = useState<boolean>(false);

  const algorithms: { id: DitherAlgorithm; label: string }[] = [
    { id: 'atkinson', label: 'Atkinson' },
    { id: 'floyd-steinberg', label: 'Floyd–Steinberg' },
    { id: 'bayer-4', label: 'Bayer 4×4' },
    { id: 'bayer-8', label: 'Bayer 8×8' },
    { id: 'threshold', label: 'Threshold' }
  ];

  const activeMeta = ALGORITHM_DETAILS[hoveredAlgo || config.algorithm];

  return (
    <div className={`space-y-4 transition-all duration-300 ${
      disabled 
        ? 'opacity-35 grayscale pointer-events-none select-none cursor-not-allowed' 
        : ''
    }`}>
      {/* Algorithm Header with Matrix Inspect Toggle */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-[var(--hw-text-secondary)] font-sans">
            Algorithm
          </label>
          <button
            type="button"
            onClick={() => {
              triggerTactileFeedback('click');
              setShowMatrix(p => !p);
            }}
            className={`text-[10px] font-mono px-2 py-0.5 rounded-[4px] border transition-colors cursor-pointer ${
              showMatrix 
                ? 'bg-[#FF5500]/15 text-[#FF5500] border-[#FF5500]/30 font-medium' 
                : isDark
                ? 'bg-black/30 text-zinc-400 border-white/[0.08] hover:text-white'
                : 'bg-black/5 text-[#57575E] border-black/[0.08] hover:text-[#18181A]'
            }`}
          >
            {showMatrix ? 'Close Kernel' : 'Inspect Kernel'}
          </button>
        </div>

        {/* Gooey Slidable + Clickable Segmented Control */}
        <GooeySegmentedControl<DitherAlgorithm>
          options={algorithms}
          value={config.algorithm}
          onChange={(algo) => onChange({ ...config, algorithm: algo })}
          onHoverOption={setHoveredAlgo}
          themeMode={themeMode}
        />

        {/* Real Mathematical Kernel Matrix Inspection Deck */}
        <AnimatePresence>
          {(showMatrix || hoveredAlgo) && activeMeta && (
            <motion.div
              initial={{ opacity: 0, y: -4, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -4, height: 0 }}
              transition={{ duration: 0.16 }}
              className="overflow-hidden"
            >
              <div className="p-2.5 rounded-[8px] bg-black/50 border border-white/[0.08] text-xs font-sans space-y-2 mt-1">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-1.5">
                  <span className="font-semibold text-white text-[11px] font-sans">
                    {activeMeta.label}
                  </span>
                  <span className="font-mono text-[10px] text-zinc-400">
                    {activeMeta.type} {activeMeta.divisor && `(${activeMeta.divisor})`}
                  </span>
                </div>

                {/* Matrix Visualization */}
                <div className="flex items-center justify-center p-2 rounded-[6px] bg-black/60 border border-white/[0.04]">
                  {activeMeta.matrix.length === 1 && typeof activeMeta.matrix[0][0] === 'string' && activeMeta.matrix[0][0].startsWith('f(') ? (
                    <div className="font-mono text-[11px] text-[#FF5500] tracking-wider py-1">
                      {activeMeta.matrix[0][0]}
                    </div>
                  ) : (
                    <div className="inline-grid gap-1 font-mono text-[10px]">
                      {activeMeta.matrix.map((row, rIdx) => (
                        <div key={rIdx} className="flex gap-1 justify-center">
                          {row.map((cell, cIdx) => (
                            <span
                              key={cIdx}
                              className={`w-6 h-5 flex items-center justify-center rounded-[3px] border ${
                                cell === '•'
                                  ? 'bg-[#FF5500]/25 text-[#FF5500] border-[#FF5500]/40 font-bold'
                                  : cell === ' '
                                  ? 'opacity-0 border-transparent'
                                  : 'bg-white/[0.04] text-zinc-300 border-white/[0.06]'
                              }`}
                            >
                              {cell}
                            </span>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <p className="text-[10px] text-zinc-400 leading-relaxed font-sans">
                  {activeMeta.description}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Precision Tactile Rotary Encoders */}
      <div className="pt-2 pb-1 border-y border-[var(--hw-border-hairline)] my-2">
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
          <div className="flex justify-center pt-3 border-t border-[var(--hw-border-hairline)] mt-3">
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

      {/* Authentic Physical Industrial Mechanical Toggle Switch */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <label className="text-xs font-medium text-[var(--hw-text-primary)] font-sans block">
            Invert colors
          </label>
          <span className="text-[10px] text-[var(--hw-text-secondary)] font-mono">
            {config.invert ? 'INVERTED · POLARITY REVERSED' : 'NORMAL · DIRECT PHOSPHOR'}
          </span>
        </div>

        {/* Machined Metal Bat Lever Toggle */}
        <button
          type="button"
          onClick={() => {
            triggerTactileFeedback('toggle');
            onChange({ ...config, invert: !config.invert });
          }}
          className={`flex items-center gap-2 p-1.5 pl-2.5 rounded-[8px] border border-[var(--hw-border-hairline)] ${
            isDark ? 'bg-black/40 hover:bg-black/60' : 'bg-black/5 hover:bg-black/10'
          } transition-all cursor-pointer group`}
          title="Toggle 1-bit monochrome polarity"
        >
          {/* Signal Indicator LED */}
          <div className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${
            config.invert 
              ? 'bg-[#FF5500] shadow-[0_0_6px_#FF5500]' 
              : 'bg-zinc-600'
          }`} />

          {/* Physical Toggle Base Well */}
          <div className="w-10 h-5 rounded-full bg-[#141517] border border-[#2A2B2E] p-0.5 relative shadow-[inset_0_1.5px_3px_rgba(0,0,0,0.8)] flex items-center">
            {/* Sliding Metal Toggle Bat Lever with Chamfer Ring */}
            <motion.div
              animate={{
                x: config.invert ? 20 : 0,
              }}
              transition={HW_SPRINGS.snappy}
              className="w-4 h-4 rounded-full bg-gradient-to-b from-[#E4E4E7] via-[#A1A1AA] to-[#52525B] shadow-[0_1px_3px_rgba(0,0,0,0.7),inset_0_1px_1px_rgba(255,255,255,0.8)] border border-black/60 flex items-center justify-center relative"
            >
              {/* Center knurled metal slot */}
              <div className="w-[1px] h-2 bg-black/50" />
            </motion.div>
          </div>
        </button>
      </div>

      <div className="space-y-2 pt-4 border-t border-[var(--hw-border-hairline)]">
        <label className="text-xs font-medium text-[var(--hw-text-secondary)] font-sans">
          Phosphor theme
        </label>
        <select
          value={config.theme}
          onChange={(e) => onChange({ ...config, theme: e.target.value as PhosphorTheme })}
          className="w-full font-sans px-3 py-2 text-xs rounded-[8px] cursor-pointer transition-colors bg-[var(--hw-bg-surface)] border border-[var(--hw-border-hairline)] text-[var(--hw-text-primary)] focus:border-[#FF5500] outline-none"
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
