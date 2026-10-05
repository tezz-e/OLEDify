import React, { useEffect, useRef } from 'react';

export interface ZeroBloatWaveFieldProps {
  themeMode?: 'light' | 'dark';
  audioBass?: number;      // 0..1 (from audioAnalysisEngine)
  audioRms?: number;       // 0..1 (from audioAnalysisEngine)
  gridSpacing?: number;    // default 24px
  className?: string;
}

export const ZeroBloatWaveField: React.FC<ZeroBloatWaveFieldProps> = ({
  themeMode = 'dark',
  audioBass = 0,
  audioRms = 0,
  gridSpacing = 24,
  className = 'absolute inset-0 pointer-events-none',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const bassRef = useRef(audioBass);
  const rmsRef = useRef(audioRms);
  const isIdleRef = useRef(false);
  const idleFramesRef = useRef(0);

  bassRef.current = audioBass;
  rmsRef.current = audioRms;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animId: number;
    let t = 0;
    let canvasRect = canvas.getBoundingClientRect();

    const handlePointerMove = (e: PointerEvent) => {
      mouseRef.current = {
        x: e.clientX - canvasRect.left,
        y: e.clientY - canvasRect.top,
      };
      isIdleRef.current = false;
      idleFramesRef.current = 0;
    };
    window.addEventListener('pointermove', handlePointerMove, { passive: true });

    const handleResize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.scale(dpr, dpr);
      canvasRect = canvas.getBoundingClientRect();
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', () => { canvasRect = canvas.getBoundingClientRect(); }, { passive: true });

    const isDark = themeMode === 'dark';
    const baseR = isDark ? 0 : 26;
    const baseG = isDark ? 240 : 26;
    const baseB = isDark ? 255 : 26;

    const render = () => {
      const isMoving = mouseRef.current.x >= 0;
      const hasAudio = bassRef.current > 0.01 || rmsRef.current > 0.01;

      // Idle sleep suspension: pauses calculation when no cursor or audio activity is present
      if (!isMoving && !hasAudio) {
        idleFramesRef.current++;
        if (idleFramesRef.current > 120) {
          isIdleRef.current = true;
          animId = requestAnimationFrame(render);
          return;
        }
      }

      t += 0.024;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const audioMod = 1.0 + bassRef.current * 1.6 + rmsRef.current * 0.8;

      // Group path batching into alpha buckets to eliminate individual per-point fill calls
      const bucketLow = new Path2D();
      const bucketMid = new Path2D();
      const bucketHigh = new Path2D();

      for (let x = gridSpacing / 2; x < w; x += gridSpacing) {
        for (let y = gridSpacing / 2; y < h; y += gridSpacing) {
          // Tri-harmonic wave synthesis
          const w1 = Math.sin(x * 0.009 + t * 1.2);
          const w2 = Math.cos(y * 0.012 - t * 0.9);
          const w3 = Math.sin((x + y) * 0.007 + t * 1.6);
          const elevation = ((w1 + w2 + w3) / 3) * audioMod;

          // Radial Gaussian cursor pull
          const dx = x - mx;
          const dy = y - my;
          const distSq = dx * dx + dy * dy;
          const cursorInfluence = Math.exp(-distSq / (2 * 160 * 160));

          const totalZ = Math.max(0, elevation + cursorInfluence * 1.8);
          const radius = Math.max(0.75, 1.2 * (0.6 + 0.6 * totalZ));

          if (totalZ > 0.8) {
            bucketHigh.moveTo(x + radius, y);
            bucketHigh.arc(x, y, radius, 0, Math.PI * 2);
          } else if (totalZ > 0.3) {
            bucketMid.moveTo(x + radius, y);
            bucketMid.arc(x, y, radius, 0, Math.PI * 2);
          } else {
            bucketLow.moveTo(x + radius, y);
            bucketLow.arc(x, y, radius, 0, Math.PI * 2);
          }
        }
      }

      // 3 batched draw calls instead of 3,600 individual fills
      ctx.fillStyle = `rgba(${baseR}, ${baseG}, ${baseB}, ${isDark ? 0.08 : 0.05})`;
      ctx.fill(bucketLow);

      ctx.fillStyle = `rgba(${baseR}, ${baseG}, ${baseB}, ${isDark ? 0.22 : 0.14})`;
      ctx.fill(bucketMid);

      ctx.fillStyle = `rgba(${baseR}, ${baseG}, ${baseB}, ${isDark ? 0.65 : 0.45})`;
      ctx.fill(bucketHigh);

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pointermove', handlePointerMove);
    };
  }, [themeMode, gridSpacing]);

  return <canvas ref={canvasRef} className={`w-full h-full ${className}`} />;
};
