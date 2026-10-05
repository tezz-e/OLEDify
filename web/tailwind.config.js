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
        hw: {
          canvas: 'var(--hw-bg-canvas)',
          surface: 'var(--hw-bg-surface)',
          chassis: 'var(--hw-bg-chassis)',
          recessed: 'var(--hw-bg-recessed)',
          acrylic: 'var(--hw-bg-acrylic)',
          perimeter: 'var(--hw-border-perimeter)',
          hairline: 'var(--hw-border-hairline)',
          specular: 'var(--hw-border-specular)',
          amber: 'var(--hw-signal-amber)',
          phosphor: 'var(--hw-signal-phosphor)',
          flux: 'var(--hw-signal-flux)',
          danger: 'var(--hw-signal-danger)',
          text: {
            primary: 'var(--hw-text-primary)',
            secondary: 'var(--hw-text-secondary)',
            tertiary: 'var(--hw-text-tertiary)',
          },
        },
        parchment: '#F5F0EB',
        cream: '#FAF9F5',
        oatmeal: '#F0ECE1',
        ink: '#1A1A1A',
        'ink-light': '#6B6B6B',
        obsidian: '#141413',
        charcoal: '#1F1E1D',
        stone: '#5E5D59',
        bone: '#E8E5DE',
        accent: '#D97757', // Anthropic / Claude warm terracotta
        'accent-dark': '#C96442',
        terracotta: '#D97757',
        'terracotta-dark': '#C96442',
        studio: {
          dark: '#141413',
          card: '#18181C',
          panel: '#1E1E20',
          elevated: '#232228',
          subtle: '#2C2B29',
        }
      },
      rotate: {
        '24': '24deg',
        '-24': '-24deg',
      },
      boxShadow: {
        'hw-chassis': 'var(--hw-shadow-chassis)',
        'hw-inset': 'var(--hw-shadow-inset)',
        'hw-specular': 'var(--hw-shadow-specular)',
        'hw-glow-amber': '0 0 16px rgba(255, 85, 0, 0.45)',
        'hw-glow-phosphor': '0 0 16px rgba(0, 255, 102, 0.45)',
        'hw-glow-flux': '0 0 16px rgba(0, 240, 255, 0.45)',
      },
      borderRadius: {
        'hw-sm': '2px',
        'hw-md': '4px',
        'hw-lg': '8px',
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
