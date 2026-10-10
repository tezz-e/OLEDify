/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#181A1B',
        surface: '#202225',
        raised: '#282A2E',
        hairline: 'rgba(255, 255, 255, 0.10)',
        specular: 'rgba(255, 255, 255, 0.18)',
        amber: '#FF5500',
        phosphor: '#00FF66',
        danger: '#EF4444',
        text: {
          primary: '#FAFAFA',
          secondary: '#A1A1AA',
          tertiary: '#71717A',
        },
        hw: {
          canvas: 'var(--hw-bg-canvas)',
          surface: 'var(--hw-bg-surface)',
          raised: 'var(--hw-bg-raised)',
          hairline: 'var(--hw-border-hairline)',
          specular: 'var(--hw-border-specular)',
          amber: 'var(--hw-signal-amber)',
          phosphor: 'var(--hw-signal-phosphor)',
          danger: 'var(--hw-signal-danger)',
          text: {
            primary: 'var(--hw-text-primary)',
            secondary: 'var(--hw-text-secondary)',
            tertiary: 'var(--hw-text-tertiary)',
          },
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace'],
        sans: ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '4px',
        sm: '4px',
        md: '4px',
        lg: '4px',
        xl: '4px',
        '2xl': '4px',
        '3xl': '4px',
        'hw-sm': '4px',
        'hw-md': '4px',
        'hw-lg': '4px',
        full: '9999px',
        'hw-pill': '9999px',
      },
      transitionTimingFunction: {
        'hw-detent': 'cubic-bezier(0.25, 1.0, 0.50, 1.0)',
      },
      zIndex: {
        '60': '60',
        '70': '70',
        '80': '80',
        '90': '90',
        '100': '100',
      },
      fontFamily: {
        serif: ['"DM Serif Display"', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        display: ['"DM Serif Display"', 'Georgia', 'serif'],
        dot: ['"Silkscreen"', '"DotGothic16"', '"IBM Plex Mono"', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.15s ease-out',
        'slide-up': 'slideUp 0.15s ease-out',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
