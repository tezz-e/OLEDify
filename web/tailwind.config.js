/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
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
      },
      fontFamily: {
        serif: ['"DM Serif Display"', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        display: ['"DM Serif Display"', 'Georgia', 'serif'],
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
