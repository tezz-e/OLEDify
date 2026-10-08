import React, { useRef, useEffect } from 'react';

export interface PixelCardProps {
  children?: React.ReactNode;
  gridSpacing?: number;    // default 14px
  decayMs?: number;        // tau decay constant (default 350ms)
  accent?: 'phosphor' | 'amber' | 'cyan';
  themeMode?: 'light' | 'dark';
  className?: string;
}

export const PixelCard: React.FC<PixelCardProps> = ({
  children,
  gridSpacing = 14,
  decayMs = 350,
  accent = 'phosphor',
  themeMode = 'dark',
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mousePosRef = useRef({ x: -1000, y: -1000 });
  const isDark = themeMode === 'dark';

  const accentRGB = {
    phosphor: isDark ? [0, 255, 102] : [2, 150, 59],
    amber: isDark ? [255, 85, 0] : [232, 93, 42],
    cyan: isDark ? [0, 240, 255] : [0, 119, 204],
  }[accent];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = canvas.clientWidth);
    let height = (canvas.height = canvas.clientHeight);

    const cols = Math.ceil(width / gridSpacing);
    const rows = Math.ceil(height / gridSpacing);
    const luminances = new Float32Array(cols * rows);

    let lastTime = performance.now();

    const render = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      ctx.clearRect(0, 0, width, height);
      const decayFactor = Math.exp(-dt / (decayMs / 1000));
      const mx = mousePosRef.current.x;
      const my = mousePosRef.current.y;

      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const idx = r * cols + c;
          const px = c * gridSpacing + gridSpacing / 2;
          const py = r * gridSpacing + gridSpacing / 2;

          // Proximity to pointer (scoped to card container)
          const dx = px - mx;
          const dy = py - my;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 64) {
            const excite = Math.max(0, 1 - dist / 64);
            luminances[idx] = Math.max(luminances[idx], excite);
          } else {
            luminances[idx] *= decayFactor;
          }

          const lum = luminances[idx];
          const baseAlpha = isDark ? 0.08 : 0.05;
          const totalAlpha = Math.min(0.9, baseAlpha + lum * 0.85);
          const dotRadius = 1.0 + lum * 1.5;

          ctx.beginPath();
          ctx.arc(px, py, dotRadius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${accentRGB[0]}, ${accentRGB[1]}, ${accentRGB[2]}, ${totalAlpha})`;
          ctx.fill();
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [gridSpacing, decayMs, isDark, accent]);

  // Scoped pointer events on container eliminate layout-thrashing global window listeners
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    mousePosRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handlePointerLeave = () => {
    mousePosRef.current = { x: -1000, y: -1000 };
  };

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={`relative rounded-[10px] overflow-hidden border ${
        isDark ? 'bg-[#0A0A0C] border-[#27272A]' : 'bg-[#F6F6F4] border-[#1A1A1A]'
      } ${className}`}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
      <div className="relative z-10 p-4">{children}</div>
    </div>
  );
};
