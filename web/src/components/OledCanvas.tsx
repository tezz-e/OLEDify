import React, { useEffect, useRef, useMemo } from 'react';
import { PhosphorTheme } from '../types/dither';
import '../styles/oled.css';

interface OledCanvasProps {
  frameData: ImageData | null;
  theme?: PhosphorTheme;
  scale?: number;
}

export const OledCanvas: React.FC<OledCanvasProps> = ({ frameData, theme = 'cyan', scale = 4 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intScale = Math.max(1, Math.round(scale));
  const cssWidth = 128 * intScale;
  const cssHeight = 64 * intScale;

  const phosphorColor = useMemo(() => {
    switch (theme) {
      case 'white': return '#FFFFFF';
      case 'amber': return '#FFB000';
      case 'green': return '#00FF66';
      case 'cyan':
      default: return '#00F0FF';
    }
  }, [theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);

    ctx.save();
    ctx.scale(dpr, dpr);

    // Unlit background: deep OLED black
    ctx.fillStyle = '#020305';
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    if (!frameData) {
      // Standby status text in phosphor blue
      ctx.fillStyle = 'rgba(0, 240, 255, 0.75)';
      const fontSize = Math.max(9, Math.round(10 * (intScale / 2)));
      ctx.font = `500 ${fontSize}px Inter, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('SSD1306 128×64 · Standby', cssWidth / 2, cssHeight / 2);
      ctx.restore();
      return;
    }

    const hasGap = intScale >= 3;
    const pixelSize = hasGap ? intScale - 1 : intScale;

    // Lit pixels: authentic SSD1306 phosphor blue (#00F0FF)
    ctx.fillStyle = phosphorColor;
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 128; x++) {
        const srcIdx = (y * 128 + x) * 4;
        if (frameData.data[srcIdx] > 128) {
          ctx.fillRect(x * intScale, y * intScale, pixelSize, pixelSize);
        }
      }
    }
    ctx.restore();
  }, [frameData, theme, intScale, cssWidth, cssHeight, phosphorColor]);

  return (
    <div className="flex items-center justify-center select-none shrink-0">
      <canvas
        ref={canvasRef}
        width={cssWidth}
        height={cssHeight}
        className={`oled-screen block shrink-0 glow-${theme || 'cyan'}`}
        style={{
          width: `${cssWidth}px`,
          height: `${cssHeight}px`,
          imageRendering: 'pixelated',
          aspectRatio: '128 / 64',
        }}
      />
    </div>
  );
};
