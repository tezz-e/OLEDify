import React, { useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { playHapticClick } from './hapticAudio';

export interface InertiaTimelineScrubberProps {
  totalFrames: number;
  currentFrame: number;
  fps?: number;
  zoomPxPerFrame?: number;       // default 16px per frame
  beatsFrames?: number[];        // frame indices of detected audio beats
  onSeek: (frame: number) => void;
  damping?: number;              // Lenis lambda damping coefficient (default 24.0)
  themeMode?: 'light' | 'dark';
  className?: string;
}

export const InertiaTimelineScrubber: React.FC<InertiaTimelineScrubberProps> = ({
  totalFrames,
  currentFrame,
  fps = 30,
  zoomPxPerFrame = 16,
  beatsFrames = [],
  onSeek,
  damping = 24.0,
  themeMode = 'dark',
  className = '',
}) => {
  const isDark = themeMode === 'dark';
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const needleRef = useRef<HTMLDivElement>(null);

  // Physics state stored in refs to avoid hook tearing and effect loop churn
  const targetFrameRef = useRef(currentFrame);
  const currentFrameRef = useRef(currentFrame);
  const visualFrameRef = useRef(currentFrame);
  const onSeekRef = useRef(onSeek);
  onSeekRef.current = onSeek;

  const isScrubbingRef = useRef(false);
  const lastDetentFrameRef = useRef(currentFrame);

  // Sync external frame updates when user is not manually dragging
  useEffect(() => {
    if (!isScrubbingRef.current) {
      targetFrameRef.current = currentFrame;
    }
  }, [currentFrame]);

  // High-performance Canvas Ruler rendering: 0 DOM nodes diffed at runtime
  const renderRulerCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const totalWidth = Math.max(800, totalFrames * zoomPxPerFrame);
    const height = 56; // 14 Tailwind rem height

    if (canvas.width !== totalWidth * dpr || canvas.height !== height * dpr) {
      canvas.width = totalWidth * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${totalWidth}px`;
      canvas.style.height = `${height}px`;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, totalWidth, height);

    ctx.font = '8px monospace';
    ctx.textAlign = 'center';

    const beatSet = new Set(beatsFrames);

    for (let i = 0; i < totalFrames; i++) {
      const x = i * zoomPxPerFrame;
      const isMajor = i % 30 === 0;
      const isMid = i % 10 === 0;
      const isBeat = beatSet.has(i);

      if (isMajor) {
        ctx.fillStyle = isDark ? '#A1A1AA' : '#5E5D59';
        ctx.fillText(`${(i / fps).toFixed(1)}s`, x, 18);
      }

      // Draw tick mark
      ctx.beginPath();
      if (isBeat) {
        ctx.strokeStyle = isDark ? '#FF5500' : '#E85D2A';
        ctx.lineWidth = 1.5;
        ctx.moveTo(x, height);
        ctx.lineTo(x, height - 20);
      } else if (isMajor) {
        ctx.strokeStyle = isDark ? '#FAFAFA' : '#1A1A1A';
        ctx.lineWidth = 1.0;
        ctx.moveTo(x, height);
        ctx.lineTo(x, height - 16);
      } else if (isMid) {
        ctx.strokeStyle = isDark ? '#52525B' : '#8C8A84';
        ctx.lineWidth = 1.0;
        ctx.moveTo(x, height);
        ctx.lineTo(x, height - 10);
      } else {
        ctx.strokeStyle = isDark ? '#27272A' : '#BCBAB5';
        ctx.lineWidth = 0.75;
        ctx.moveTo(x, height);
        ctx.lineTo(x, height - 6);
      }
      ctx.stroke();
    }

    ctx.restore();
  }, [totalFrames, zoomPxPerFrame, beatsFrames, fps, isDark]);

  useLayoutEffect(() => {
    renderRulerCanvas();
  }, [renderRulerCanvas]);

  // Lenis frame-independent physics scrub loop (Decoupled from visualFrame state)
  useEffect(() => {
    let lastTime = performance.now();
    let animId: number;

    const tick = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.1); // clamp dt to 100ms
      lastTime = now;

      const current = currentFrameRef.current;
      const target = targetFrameRef.current;

      // Lenis exponential damping: x(t + dt) = target + (current - target) * exp(-lambda * dt)
      const next = target + (current - target) * Math.exp(-damping * dt);
      currentFrameRef.current = next;

      if (Math.abs(next - visualFrameRef.current) > 0.005) {
        visualFrameRef.current = next;

        // Direct DOM update for zero React virtual DOM diffing overhead
        if (needleRef.current) {
          needleRef.current.style.transform = `translateX(${next * zoomPxPerFrame}px)`;
        }

        // Haptic detent notch feedback
        const rounded = Math.round(next);
        if (rounded !== lastDetentFrameRef.current && isScrubbingRef.current) {
          playHapticClick(4200, 0.002);
          lastDetentFrameRef.current = rounded;
        }

        onSeekRef.current(Math.max(0, Math.min(totalFrames - 1, rounded)));
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [damping, totalFrames, zoomPxPerFrame]);

  const scrubAt = useCallback(
    (clientX: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const offsetX = clientX - rect.left;
      const target = offsetX / zoomPxPerFrame;

      // Elastic rubberband tension formula
      const max = totalFrames - 1;
      if (target < 0) {
        targetFrameRef.current = target * 0.35;
      } else if (target > max) {
        targetFrameRef.current = max + (target - max) * 0.35;
      } else {
        targetFrameRef.current = target;
      }
    },
    [zoomPxPerFrame, totalFrames]
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    isScrubbingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    scrubAt(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isScrubbingRef.current) {
      scrubAt(e.clientX);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isScrubbingRef.current) {
      isScrubbingRef.current = false;
      targetFrameRef.current = Math.max(0, Math.min(totalFrames - 1, targetFrameRef.current));
    }
  };

  const totalWidth = Math.max(800, totalFrames * zoomPxPerFrame);

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className={`relative h-14 select-none cursor-ew-resize overflow-hidden font-mono ${
        isDark ? 'bg-[#0A0A0C]' : 'bg-[#EBEAE5]'
      } ${className}`}
      style={{ width: `${totalWidth}px` }}
    >
      {/* 1. Virtualized Canvas Dot-Matrix Ruler */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />

      {/* 2. Specular Precision Playhead Needle (Ref-driven transform) */}
      <div
        ref={needleRef}
        className="absolute top-0 bottom-0 pointer-events-none z-30 flex flex-col items-center will-change-transform"
        style={{ transform: `translateX(${currentFrame * zoomPxPerFrame}px)` }}
      >
        {/* Playhead Grab Pip */}
        <div
          className={`w-3.5 h-3.5 rounded-b-[2px] flex items-center justify-center shadow-md ${
            isDark
              ? 'bg-[#00FF66] text-black shadow-[0_0_10px_#00FF66]'
              : 'bg-[#FF5500] text-white shadow-[0_0_10px_#FF5500]'
          }`}
        >
          <div className="w-[1.5px] h-2 bg-current" />
        </div>

        {/* 1px Vertical Specular Wire */}
        <div
          className={`w-[1px] h-full ${
            isDark ? 'bg-[#00FF66] shadow-[0_0_4px_#00FF66]' : 'bg-[#FF5500]'
          }`}
        />
      </div>
    </div>
  );
};
