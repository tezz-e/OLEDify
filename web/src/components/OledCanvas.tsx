import React, { useEffect, useRef, useMemo } from 'react';
import { PhosphorTheme } from '../types/dither';
import '../styles/oled.css';

interface OledCanvasProps {
  frameData: ImageData | null;
  theme: PhosphorTheme;
  scale?: number;
}

export const OledCanvas: React.FC<OledCanvasProps> = ({ frameData, theme, scale = 4 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasWidth = 128 * scale;
  const canvasHeight = 64 * scale;

  const phosphorColor = useMemo(() => {
    switch (theme) {
      case 'cyan': return [0, 240, 255];
      case 'white': return [255, 255, 255];
      case 'amber': return [255, 176, 0];
      case 'green': return [0, 255, 102];
      default: return [0, 240, 255];
    }
  }, [theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!frameData) {
      ctx.fillStyle = '#020304';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      ctx.fillStyle = `rgb(${phosphorColor[0]}, ${phosphorColor[1]}, ${phosphorColor[2]})`;
      ctx.font = "14px 'IBM Plex Mono', monospace";
      ctx.textAlign = 'center';
      ctx.fillText('DROP_MEDIA_TO_BEGIN', canvasWidth / 2, canvasHeight / 2);
      return;
    }

    const buffer = new ImageData(canvasWidth, canvasHeight);
    const bufData = buffer.data;
    const bgR = 8, bgG = 12, bgB = 18;

    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 128; x++) {
        const srcIdx = (y * 128 + x) * 4;
        const isLit = frameData.data[srcIdx] > 128;
        
        let r, g, b;
        if (isLit) {
          if (theme === 'yellow-blue') {
            [r, g, b] = y < 16 ? [255, 204, 0] : [0, 229, 255];
          } else {
            [r, g, b] = phosphorColor;
          }
        } else {
          [r, g, b] = [bgR, bgG, bgB];
        }

        // Draw pixel block of (scale-1) x (scale-1), leaving 1px gap for sub-pixel grid
        for (let sy = 0; sy < scale - 1; sy++) {
          for (let sx = 0; sx < scale - 1; sx++) {
            const destIdx = ((y * scale + sy) * canvasWidth + (x * scale + sx)) * 4;
            bufData[destIdx] = r;
            bufData[destIdx + 1] = g;
            bufData[destIdx + 2] = b;
            bufData[destIdx + 3] = 255;
          }
        }
      }
    }
    
    ctx.putImageData(buffer, 0, 0);
  }, [frameData, theme, scale, canvasWidth, canvasHeight, phosphorColor]);

  return (
    <div className="flex flex-col items-center justify-center select-none max-w-full max-h-full">
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        className={`oled-screen block glow-${theme} max-w-full max-h-full object-contain`}
        style={{ aspectRatio: '128/64' }}
      />
    </div>
  );
};
