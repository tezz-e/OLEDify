/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        oled: {
          bg: '#05070a',
          surface: '#0c1015',
          panel: '#141a22',
          border: '#1e293b',
          'border-bright': '#30363d',
          accent: '#00f0ff',
          cyan: '#00f0ff',
          white: '#ffffff',
          amber: '#ffb000',
          green: '#00ff66',
          muted: '#64748b',
          'text-primary': '#e2e8f0',
          'text-secondary': '#94a3b8',
          'text-dim': '#64748b',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        'glow-cyan': '0 0 15px rgba(0, 240, 255, 0.3)',
        'glow-amber': '0 0 15px rgba(255, 176, 0, 0.3)',
        'glow-sm': '0 0 8px rgba(0, 240, 255, 0.2)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
