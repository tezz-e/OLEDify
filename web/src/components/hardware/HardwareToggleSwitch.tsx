import React from 'react';
import { playRelaySnap } from './hapticAudio';

export type TogglePosition = 'up' | 'center' | 'down';

export interface HardwareToggleSwitchProps {
  position: TogglePosition;
  onChange: (pos: TogglePosition) => void;
  labels?: [string, string, string]; // e.g. ["MANUAL", "AUTO", "LATCH"]
  themeMode?: 'light' | 'dark';
  className?: string;
}

export const HardwareToggleSwitch: React.FC<HardwareToggleSwitchProps> = ({
  position,
  onChange,
  labels = ['UP', 'OFF', 'DN'],
  themeMode = 'dark',
  className = '',
}) => {
  const isDark = themeMode === 'dark';

  const handleClick = (pos: TogglePosition) => {
    if (pos !== position) {
      playRelaySnap(); // Dual-click mechanical thud + snap on hardware clock
      onChange(pos);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, pos: TogglePosition) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick(pos);
    }
  };

  const leverAngle =
    position === 'up'
      ? '-rotate-[24deg]'
      : position === 'down'
      ? 'rotate-[24deg]'
      : 'rotate-0';

  return (
    <div className={`inline-flex flex-col items-center font-mono select-none ${className}`}>
      {/* Heavy Bezel Housing */}
      <div
        className={`w-9 h-14 rounded-[3px] border p-1 flex flex-col justify-between items-center relative ${
          isDark
            ? 'bg-[#101012] border-[#27272A] shadow-[inset_0_2px_4px_rgba(0,0,0,0.8),0_2px_4px_rgba(0,0,0,0.4)]'
            : 'bg-[#E2E0DB] border-[#1A1A1A] shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)]'
        }`}
        role="radiogroup"
        aria-label="3-Position Hardware Toggle Switch"
      >
        {/* Semantic Accessible Click Zones */}
        <button
          type="button"
          role="radio"
          tabIndex={0}
          aria-checked={position === 'up'}
          aria-label={labels[0]}
          onClick={() => handleClick('up')}
          onKeyDown={(e) => handleKeyDown(e, 'up')}
          className="w-full h-4 z-10 cursor-pointer focus:outline-none focus:ring-1 focus:ring-current/40 rounded-[1px]"
        />
        <button
          type="button"
          role="radio"
          tabIndex={0}
          aria-checked={position === 'center'}
          aria-label={labels[1]}
          onClick={() => handleClick('center')}
          onKeyDown={(e) => handleKeyDown(e, 'center')}
          className="w-full h-4 z-10 cursor-pointer focus:outline-none focus:ring-1 focus:ring-current/40 rounded-[1px]"
        />
        <button
          type="button"
          role="radio"
          tabIndex={0}
          aria-checked={position === 'down'}
          aria-label={labels[2]}
          onClick={() => handleClick('down')}
          onKeyDown={(e) => handleKeyDown(e, 'down')}
          className="w-full h-4 z-10 cursor-pointer focus:outline-none focus:ring-1 focus:ring-current/40 rounded-[1px]"
        />

        {/* Machined Metal Bat Lever (Pivoting at Base Collar) */}
        <div
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-8 transition-transform duration-150 ease-out pointer-events-none flex flex-col items-center ${leverAngle}`}
          style={{ transformOrigin: '50% 75%' }}
        >
          <div
            className={`w-3.5 h-5 rounded-t-[2px] border ${
              isDark
                ? 'bg-gradient-to-b from-[#8E8E93] to-[#3A3A3C] border-[#1C1C1E] shadow-[0_1px_2px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.4)]'
                : 'bg-gradient-to-b from-[#FFFFFF] to-[#C7C7CC] border-[#1A1A1A] shadow-[0_1px_2px_rgba(0,0,0,0.2)]'
            }`}
          />
          <div className="w-2.5 h-3 bg-[#1C1C1E] rounded-b-[1px]" />
        </div>

        {/* LED Indicator Diode */}
        <div
          className={`absolute bottom-1 w-1.5 h-1.5 rounded-full transition-colors ${
            position === 'up'
              ? 'bg-[#00FF66] shadow-[0_0_6px_#00FF66]'
              : position === 'down'
              ? 'bg-[#FF5500] shadow-[0_0_6px_#FF5500]'
              : 'bg-transparent opacity-20 border border-current'
          }`}
        />
      </div>

      {/* Label */}
      <span
        className={`text-[8px] font-bold uppercase tracking-wider mt-1.5 ${
          isDark ? 'text-[#A1A1AA]' : 'text-[#5E5D59]'
        }`}
      >
        {position === 'up' ? labels[0] : position === 'center' ? labels[1] : labels[2]}
      </span>
    </div>
  );
};
