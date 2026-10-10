import React, { useRef, useLayoutEffect, useEffect } from 'react';
import { HL } from './hairlineKernel.js';
import { mountOledBench } from './oledBenchFigure.js';

interface TapeDeckEmptyStateProps {
  isDark?: boolean;
  isDropTargetOver?: boolean;
  serialConnected?: boolean;
  baudRate?: number;
  targetFps?: number;
  onToggleSerial?: () => void;
}

export const TapeDeckEmptyState: React.FC<TapeDeckEmptyStateProps> = ({
  isDark = true,
  isDropTargetOver = false,
  serialConnected = false,
  baudRate = 921600,
  targetFps = 30,
  onToggleSerial,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const readRef = useRef<HTMLSpanElement>(null);
  const figureRef = useRef<ReturnType<typeof mountOledBench> | null>(null);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    HL.inject(document);

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 800 160');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.position = 'absolute';
    svg.style.inset = '0';
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.display = 'block';
    el.appendChild(svg);

    const figure = mountOledBench(
      {
        stage: el,
        svg,
        read: readRef.current || { textContent: '' }
      },
      { serialConnected, baudRate, targetFps }
    );
    figureRef.current = figure;

    return () => {
      figure.destroy();
      figureRef.current = null;
      svg.remove();
    };
  }, []);

  useEffect(() => {
    figureRef.current?.update?.({ serialConnected, baudRate, targetFps });
  }, [serialConnected, baudRate, targetFps]);

  const baudFormatted = baudRate >= 1000000 ? `${(baudRate / 1000000).toFixed(1)}m` : `${Math.round(baudRate / 1000)}k`;

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      className={`absolute inset-0 top-[28px] bottom-[72px] flex items-center justify-center select-none overflow-hidden transition-colors ${
        isDropTargetOver
          ? isDark ? 'bg-[#FF5500]/10' : 'bg-[#FF5500]/10'
          : isDark ? 'bg-[#181A1B]' : 'bg-[#EAE7E1]'
      }`}
      style={{
        // High contrast line art matching Teenage Engineering hardware aesthetic
        ['--hairline-plate' as any]: isDark ? '#181A1B' : '#EAE7E1',
        ['--hairline-hi' as any]: isDropTargetOver ? '#00FF66' : '#FF5500',
        ['--hairline-edge' as any]: isDark ? '#E4E4E7' : '#3F3F46',
        ['--hairline-mid' as any]: isDark ? 'rgba(255, 255, 255, 0.40)' : 'rgba(0, 0, 0, 0.35)',
        ['--hairline-lo' as any]: isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.16)',
        ['--hairline-stroke' as any]: 0.95,
      }}
    >
      {/* Corner Readout - Technically accurate pipeline label with interactive toggle */}
      <div
        onClick={onToggleSerial}
        className={`absolute top-2 left-4 z-10 flex items-center gap-2 font-mono text-[9px] tracking-wider uppercase select-none transition-opacity ${
          onToggleSerial ? 'cursor-pointer hover:opacity-80' : 'pointer-events-none'
        }`}
        title={serialConnected ? 'Serial Connected (Click to disconnect)' : 'Serial Standby (Click to simulate connection)'}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full transition-colors ${
            serialConnected ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'
          }`}
        />
        <span className={`font-semibold transition-colors ${serialConnected ? 'text-emerald-400' : 'text-zinc-500'}`}>
          {serialConnected ? 'LIVE //' : 'STANDBY //'}
        </span>
        <span ref={readRef} className="text-zinc-300 font-mono">
          {serialConnected
            ? `pc ──[usb ${baudFormatted} baud @ ${targetFps}fps]──> esp32-s3 ──[i²c 400 khz]──> ssd1306`
            : 'pc ──[usb disconnected]── esp32-s3 ──[i²c standby]── ssd1306'}
        </span>
      </div>

      {/* Ghost Track / Action Guidance Prompt */}
      <div
        className={`absolute bottom-2.5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-3.5 py-1 rounded-[4px] border border-dashed transition-all select-none pointer-events-none ${
          isDropTargetOver
            ? 'border-[#FF5500] bg-[#FF5500]/20 text-[#FF5500]'
            : isDark
            ? 'border-white/15 bg-black/50 text-zinc-400'
            : 'border-black/20 bg-white/70 text-zinc-600'
        }`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#FF5500]" />
        <span className="font-mono text-[9px] tracking-widest uppercase">
          DROP MEDIA TO BEGIN TIMELINE
        </span>
      </div>

      {/* Full-width hardware bench: Host PC -> USB Serial -> ESP32-S3 -> I2C -> 0.96" SSD1306 */}
      <div className="w-full h-full relative flex items-center justify-center">
        <div
          ref={containerRef}
          data-hairline="oled-bench"
          data-hairline-theme={isDark ? 'dark' : 'light'}
          className="w-full h-full relative cursor-default"
          style={{ touchAction: 'pan-y' }}
        />
      </div>
    </div>
  );
};
