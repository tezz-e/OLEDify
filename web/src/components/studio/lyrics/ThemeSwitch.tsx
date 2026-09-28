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
      className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full border transition-all select-none font-sans ${
        isDark
          ? 'bg-[#1E1E22] border-white/10 text-white shadow-xs'
          : 'bg-[#F5F2EB] border-[#E8E5DE] text-[#141413] shadow-xs'
      } ${className}`}
      role="group"
      aria-label="Theme mode switcher"
    >
      {/* Light Mode Label & Button */}
      <button
        type="button"
        onClick={() => onChange('light')}
        className={`flex items-center gap-1 text-[11px] font-medium transition-colors cursor-pointer ${
          !isDark ? 'text-[#D97757]' : 'text-white/40 hover:text-white/70'
        }`}
        title="Switch to uniform Light Mode"
      >
        <Sun className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Light</span>
      </button>

      {/* Official React Bits Squish Switch with fluid velocity squash & stretch physics */}
      <SquishSwitch
        checked={isDark}
        onChange={(checked) => onChange(checked ? 'dark' : 'light')}
        width={38}
        height={20}
        radius={10}
        trackColor="#E8E5DE"
        trackOnColor="#2C2B29"
        thumbColor="#141413"
        thumbOnColor="#D97757"
        speed={55}
        stretch={40}
        ariaLabel="Toggle between Light and Dark mode"
      />

      {/* Dark Mode Label & Button */}
      <button
        type="button"
        onClick={() => onChange('dark')}
        className={`flex items-center gap-1 text-[11px] font-medium transition-colors cursor-pointer ${
          isDark ? 'text-[#D97757]' : 'text-[#87867F] hover:text-[#141413]'
        }`}
        title="Switch to uniform Dark Mode"
      >
        <Moon className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Dark</span>
      </button>
    </div>
  );
};

export default ThemeSwitch;
