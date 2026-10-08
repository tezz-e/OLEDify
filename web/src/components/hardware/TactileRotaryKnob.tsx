import React, { useRef } from 'react';
import { playHapticClick } from './hapticAudio';

export interface TactileRotaryKnobProps {
  value: number;            // 0..100
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label: string;
  unit?: string;
  accent?: 'amber' | 'phosphor' | 'cyan' | 'bone';
  themeMode?: 'light' | 'dark';
  className?: string;
}

export const TactileRotaryKnob: React.FC<TactileRotaryKnobProps> = ({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  unit = '',
  accent = 'amber',
  themeMode = 'dark',
  className = '',
}) => {
  const isDark = themeMode === 'dark';
  const knobRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startVal = useRef(value);
  const lastDetentAngle = useRef(0);

  const range = max - min;
  const norm = range > 0 ? Math.min(1, Math.max(0, (value - min) / range)) : 0;
  const angle = -135 + norm * 270; // -135 deg to +135 deg

  const accentColor = {
    amber: isDark ? '#FF5500' : '#E85D2A',
    phosphor: isDark ? '#00FF66' : '#02963B',
    cyan: isDark ? '#00F0FF' : '#0077CC',
    bone: isDark ? '#E8E5DE' : '#1A1A1A',
  }[accent];

  const handlePointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    startY.current = e.clientY;
    startVal.current = value;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const dy = startY.current - e.clientY;
    const sensitivity = e.shiftKey ? 0.001 : 0.005; // 10x vernier fine-tune
    const delta = dy * sensitivity * range;
    let next = Math.min(max, Math.max(min, startVal.current + delta));
    if (step > 0) next = Math.round(next / step) * step;

    // Trigger mechanical detent click every 15 degrees
    const currentAngle = -135 + (range > 0 ? ((next - min) / range) * 270 : 0);
    if (Math.abs(currentAngle - lastDetentAngle.current) >= 15) {
      playHapticClick(3800, 0.003);
      lastDetentAngle.current = currentAngle;
    }

    onChange(next);
  };

  const handlePointerUp = () => {
    isDragging.current = false;
  };

  // SVG Arc geometry
  const r = 18;
  const c = 22;
  const strokeLen = 2 * Math.PI * r * (270 / 360);
  const strokeOffset = strokeLen * (1 - norm);

  return (
    <div className={`flex flex-col items-center select-none font-mono ${className}`}>
      {/* Knob Assembly */}
      <div
        ref={knobRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="relative w-11 h-11 cursor-ns-resize flex items-center justify-center group"
      >
        {/* Radial SVG Gauge Background */}
        <svg className="absolute inset-0 w-full h-full -rotate-45" viewBox="0 0 44 44">
          <circle
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke={isDark ? '#27272A' : '#D1CFCA'}
            strokeWidth="2.5"
            strokeDasharray={`${strokeLen} 100`}
            strokeLinecap="round"
          />
          {/* Active Accent Stroke */}
          <circle
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke={accentColor}
            strokeWidth="2.5"
            strokeDasharray={`${strokeLen} 100`}
            strokeDashoffset={strokeOffset}
            strokeLinecap="round"
            className="transition-all duration-75"
          />
        </svg>

        {/* Machined Metal Rotor */}
        <div
          className={`w-7 h-7 rounded-full border relative flex items-center justify-center transition-transform ${
            isDark
              ? 'bg-[#18181C] border-[#3F3F46] shadow-[0_2px_6px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.15)]'
              : 'bg-[#EBEAE5] border-[#1A1A1A] shadow-[0_2px_4px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.9)]'
          }`}
          style={{ transform: `rotate(${angle}deg)` }}
        >
          {/* Laser-etched Pip */}
          <div
            className="absolute top-0.5 w-[2px] h-2 rounded-[1px]"
            style={{ backgroundColor: accentColor }}
          />
        </div>
      </div>

      {/* Numerical Tabular Readout & Label */}
      <div className="flex flex-col items-center mt-1">
        <span
          className={`text-[9px] font-bold tabular-nums ${
            isDark ? 'text-[#FAFAFA]' : 'text-[#1A1A1A]'
          }`}
        >
          {value.toFixed(step < 1 ? 1 : 0)}
          {unit}
        </span>
        <span
          className={`text-[8px] uppercase tracking-wider font-semibold ${
            isDark ? 'text-[#71717A]' : 'text-[#8C8A84]'
          }`}
        >
          {label}
        </span>
      </div>
    </div>
  );
};
