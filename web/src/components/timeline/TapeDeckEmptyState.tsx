import React, { useRef, useLayoutEffect, useEffect } from 'react';
import { HL } from './hairlineKernel.js';
import { mountOledBench } from './oledBenchFigure.js';

interface TapeDeckEmptyStateProps {
  isDark?: boolean;
  isDropTargetOver?: boolean;
  serialConnected?: boolean;
  isStreaming?: boolean;
  baudRate?: number;
  targetFps?: number;
  thinStrip?: boolean;
  onToggleSerial?: () => void;
  onOpenSamples?: () => void;
}

export const TapeDeckEmptyState: React.FC<TapeDeckEmptyStateProps> = ({
  isDark = true,
  isDropTargetOver = false,
  serialConnected = false,
  isStreaming = false,
  baudRate = 921600,
  targetFps = 30,
  thinStrip = false,
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
    svg.setAttribute('viewBox', '0 0 760 160');
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
      { serialConnected, isStreaming, baudRate, targetFps }
    );
    figureRef.current = figure;

    return () => {
      figure.destroy();
      figureRef.current = null;
      svg.remove();
    };
  }, []);

  useEffect(() => {
    figureRef.current?.update?.({ serialConnected, isStreaming, baudRate, targetFps });
  }, [serialConnected, isStreaming, baudRate, targetFps]);

  if (thinStrip) {
    return (
      <div
        className={`w-full h-8 shrink-0 relative flex items-center justify-between px-3 border-b select-none overflow-hidden transition-opacity opacity-70 hover:opacity-100 ${
          isDark ? 'bg-[#181A1B] border-white/10' : 'bg-[#EAE7E1] border-black/10'
        }`}
        style={{
          ['--hairline-plate' as any]: isDark ? '#141415' : '#EAE7E1',
          ['--hairline-hi' as any]: '#FF5500',
          ['--hairline-edge' as any]: isDark ? '#FFFFFF' : '#27272A',
          ['--hairline-mid' as any]: isDark ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.55)',
          ['--hairline-lo' as any]: isDark ? 'rgba(255, 255, 255, 0.35)' : 'rgba(0, 0, 0, 0.25)',
          ['--hairline-stroke' as any]: 1.1,
        }}
      >
        <div
          onClick={onToggleSerial}
          className={`flex items-center gap-2 select-none z-10 ${onToggleSerial ? 'cursor-pointer' : 'pointer-events-none'}`}
          title={serialConnected ? 'Serial Connected' : 'Serial Standby'}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full transition-colors ${
              isStreaming ? 'bg-[#FF5500]' : (serialConnected ? 'bg-white' : 'bg-zinc-500')
            }`}
          />
          <span
            ref={readRef}
            className="text-[11px] font-sans text-zinc-300 select-none whitespace-nowrap"
          />
        </div>

        <div className="absolute right-0 top-0 bottom-0 w-80 opacity-40 pointer-events-none">
          <div
            ref={containerRef}
            data-hairline="oled-bench"
            data-hairline-theme={isDark ? 'dark' : 'light'}
            className="w-full h-full relative"
          />
        </div>
      </div>
    );
  }

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      className={`absolute inset-0 top-[28px] flex flex-col items-center justify-between select-none overflow-hidden transition-colors pb-[76px] ${
        isDropTargetOver
          ? 'bg-[#FF5500]/10'
          : isDark ? 'bg-[var(--hw-bg-surface)]' : 'bg-[#EAE7E1]'
      }`}
      style={{
        ['--hairline-plate' as any]: isDark ? '#18181C' : '#EAE7E1',
        ['--hairline-hi' as any]: '#FF5500',
        ['--hairline-edge' as any]: isDark ? '#FFFFFF' : '#27272A',
        ['--hairline-mid' as any]: isDark ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.55)',
        ['--hairline-lo' as any]: isDark ? 'rgba(255, 255, 255, 0.35)' : 'rgba(0, 0, 0, 0.25)',
        ['--hairline-stroke' as any]: 1.1,
      }}
    >
      {/* Corner Readout - Reattached ref as single source of truth for pipeline & hover strings */}
      <div
        onClick={onToggleSerial}
        className={`absolute top-2 left-4 z-20 flex items-center gap-2 select-none transition-opacity ${
          onToggleSerial ? 'cursor-pointer hover:opacity-80' : 'pointer-events-none'
        }`}
        title={serialConnected ? 'Serial Connected (Click to toggle)' : 'Serial Standby (Click to simulate connection)'}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full transition-colors ${
            isStreaming ? 'bg-[#FF5500]' : (serialConnected ? 'bg-white' : 'bg-zinc-500')
          }`}
        />
        <span
          ref={readRef}
          className="text-[11px] font-sans text-zinc-300 select-none"
        />
      </div>

      {/* SVG Container: gets remaining height (flex-1 min-h-0 max-h-full) */}
      <div className="w-full flex-1 min-h-0 relative flex items-center justify-center px-4">
        <div
          ref={containerRef}
          data-hairline="oled-bench"
          data-hairline-theme={isDark ? 'dark' : 'light'}
          className="w-full h-full max-h-full relative cursor-default"
          style={{ touchAction: 'pan-y' }}
        />
      </div>
    </div>
  );
};
