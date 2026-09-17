import React, { useRef, useEffect } from 'react';
import { PhosphorTheme } from '../types/dither';
import '../styles/oled.css';

interface OledCanvasProps {
  frameData?: ImageData | null;
  theme?: PhosphorTheme;
  scale?: number; // Canvas pixel magnification (default 4x = 512x256)
}

export const OledCanvas: React.FC<OledCanvasProps> = ({
  frameData = null,
  theme = 'cyan',
  scale = 4,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const width = 128;
  const height = 64;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#05070a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Phosphor color mappings
    const colorMap: Record<PhosphorTheme, string> = {
      cyan: '#00f0ff',
      white: '#ffffff',
      amber: '#ffb000',
      green: '#00ff66',
      'yellow-blue': '#00e5ff',
    };

    const litColor = colorMap[theme] || '#00f0ff';

    if (frameData) {
      const data = frameData.data;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          // Standard ITU-R BT.601 luminance
          const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
          const isLit = luminance > 128;

          if (isLit) {
            if (theme === 'yellow-blue' && y < 16) {
              ctx.fillStyle = '#ffcc00';
            } else {
              ctx.fillStyle = litColor;
            }
            ctx.fillRect(x * scale, y * scale, scale - 1, scale - 1);
          } else {
            // Faint pad for unlit OLED sub-pixel
            ctx.fillStyle = '#0d131a';
            ctx.fillRect(x * scale, y * scale, scale - 1, scale - 1);
          }
        }
      }
    } else {
      // Default idle grid & placeholder text
      ctx.fillStyle = '#0d131a';
      for (let y = 0; y < height; y += 4) {
        for (let x = 0; x < width; x += 4) {
          ctx.fillRect(x * scale, y * scale, scale - 1, scale - 1);
        }
      }

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('128 × 64 OLED DISPLAY READY', canvas.width / 2, canvas.height / 2 - 2);

      ctx.fillStyle = '#64748b';
      ctx.font = '10px monospace';
      ctx.fillText('Drop media to preview live frames', canvas.width / 2, canvas.height / 2 + 16);
    }
  }, [frameData, theme, scale]);

  const glowClass = `glow-${theme === 'yellow-blue' ? 'cyan' : theme}`;

  return (
    <div className="oled-bezel p-3 rounded-xl inline-block shadow-2xl">
      {/* Silkscreen Pin Headers */}
      <div className="flex justify-between items-center px-4 pb-2 text-[10px] font-mono tracking-widest text-slate-500 select-none">
        <span>[ GND ]</span>
        <span>[ VCC ]</span>
        <span>[ SCL ]</span>
        <span>[ SDA ]</span>
      </div>

      {/* Screen Glass Surface */}
      <div className="oled-screen-glass rounded border border-slate-800 p-2 overflow-hidden flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={width * scale}
          height={height * scale}
          className={`block ${glowClass}`}
          style={{ width: width * scale, height: height * scale }}
        />
      </div>

      {/* Silkscreen Bottom Badges */}
      <div className="flex justify-between items-center px-2 pt-2 text-[10px] font-mono text-slate-600">
        <span>SH1106 / SSD1306</span>
        <span>I2C 0x3C</span>
      </div>
    </div>
  );
};
