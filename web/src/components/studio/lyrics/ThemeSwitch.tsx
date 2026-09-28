import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { SquishSwitch } from '../../reactbits/SquishSwitch';

export interface ThemeSwitchProps {
  theme: 'light' | 'dark';
  onChange: (theme: 'light' | 'dark') => void;
  className?: string;
}

export const ThemeSwitch: React.FC<ThemeSwitchProps> = ({
  theme,
  onChange,
  className = ''
}) => {
  const isDark = theme === 'dark';

  return (
    <div
      className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full border transition-all select-none font-mono ${
        isDark
          ? 'bg-[#18181C] border-white/20 text-white shadow-inner'
          : 'bg-[#EAE5DF] border-[#1A1A1A] text-[#1A1A1A] shadow-xs'
      } ${className}`}
      role="group"
      aria-label="Theme mode switcher"
    >
      {/* Light Mode Label & Button */}
      <button
        type="button"
        onClick={() => onChange('light')}
        className={`flex items-center gap-1 text-[9px] font-bold tracking-wider uppercase transition-colors cursor-pointer ${
          !isDark ? 'text-[#D97757]' : 'text-white/40 hover:text-white/70'
        }`}
        title="Switch to uniform Light Mode"
      >
        <Sun className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">LIGHT</span>
      </button>

      {/* Official React Bits Squish Switch with fluid velocity squash & stretch physics */}
      <SquishSwitch
        checked={isDark}
        onChange={(checked) => onChange(checked ? 'dark' : 'light')}
        width={42}
        height={22}
        radius={11}
        trackColor="#D4CEC5"
        trackOnColor="#2B2B33"
        thumbColor="#1A1A1A"
        thumbOnColor="#D97757"
        speed={55}
        stretch={40}
        ariaLabel="Toggle between Light and Dark mode"
      />

      {/* Dark Mode Label & Button */}
      <button
        type="button"
        onClick={() => onChange('dark')}
        className={`flex items-center gap-1 text-[9px] font-bold tracking-wider uppercase transition-colors cursor-pointer ${
          isDark ? 'text-[#00F0FF]' : 'text-[#6B6B6B] hover:text-[#1A1A1A]'
        }`}
        title="Switch to uniform Dark Mode"
      >
        <Moon className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">DARK</span>
      </button>
    </div>
  );
};

export default ThemeSwitch;
