import React from 'react';
import { ThemeToggle } from '../../reactbits/ThemeToggle';

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
  return (
    <ThemeToggle
      themeMode={theme}
      onToggle={() => onChange(theme === 'light' ? 'dark' : 'light')}
      className={className}
    />
  );
};

export default ThemeSwitch;
