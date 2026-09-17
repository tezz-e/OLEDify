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
          surface: '#0d1117',
          panel: '#161b22',
          border: '#30363d',
          accent: '#58a6ff',
          cyan: '#00f0ff',
          white: '#ffffff',
          amber: '#ffb000',
          green: '#00ff66',
          muted: '#8b949e',
        },
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'oled-cyan': '0 0 15px rgba(0, 240, 255, 0.45)',
        'oled-white': '0 0 15px rgba(255, 255, 255, 0.45)',
        'oled-amber': '0 0 15px rgba(255, 176, 0, 0.45)',
      },
    },
  },
  plugins: [],
};
