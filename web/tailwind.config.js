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
        canvas: 'var(--hw-bg-canvas)',
        surface: 'var(--hw-bg-surface)',
        raised: 'var(--hw-bg-raised)',
        hairline: 'var(--hw-border-hairline)',
        specular: 'var(--hw-border-specular)',
        accent: 'var(--hw-signal-amber)',
        danger: 'var(--hw-signal-danger)',
        text: {
          primary: 'var(--hw-text-primary)',
          secondary: 'var(--hw-text-secondary)',
          tertiary: 'var(--hw-text-tertiary)',
        },
        hw: {
          canvas: 'var(--hw-bg-canvas)',
          surface: 'var(--hw-bg-surface)',
          raised: 'var(--hw-bg-raised)',
          hairline: 'var(--hw-border-hairline)',
          specular: 'var(--hw-border-specular)',
          amber: 'var(--hw-signal-amber)',
          danger: 'var(--hw-signal-danger)',
          text: {
            primary: 'var(--hw-text-primary)',
            secondary: 'var(--hw-text-secondary)',
            tertiary: 'var(--hw-text-tertiary)',
          },
        },
      },
      fontFamily: {
        sans: ['"Inter"', '"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"IBM Plex Mono"', 'ui-monospace', 'monospace'],
        display: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '8px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        '2xl': '24px',
        '3xl': '32px',
        'hw-sm': '8px',
        'hw-md': '12px',
        'hw-lg': '20px',
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
      animation: {
        'fade-in': 'fadeIn 0.15s ease-out',
        'slide-up': 'slideUp 0.15s ease-out',
        'border-beam': 'border-beam calc(var(--duration)*1s) infinite linear',
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
        'border-beam': {
          '100%': {
            'offset-distance': '100%',
          },
        },
      },
    },
  },
  plugins: [],
};
