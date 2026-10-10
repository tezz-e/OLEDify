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
  onToggleSerial,
  onOpenSamples,
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

  const benchState = isStreaming ? 'streaming' : (serialConnected ? 'connected-idle' : 'disconnected');

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      className={`absolute inset-0 top-[28px] flex flex-col items-center justify-between select-none overflow-hidden transition-colors pb-14 ${
        isDropTargetOver
          ? isDark ? 'bg-[#FF5500]/10' : 'bg-[#FF5500]/10'
          : isDark ? 'bg-[#181A1B]' : 'bg-[#EAE7E1]'
      }`}
      style={{
        ['--hairline-plate' as any]: isDark ? '#181A1B' : '#EAE7E1',
        ['--hairline-hi' as any]: '#FF5500',
        ['--hairline-edge' as any]: isDark ? '#E4E4E7' : '#3F3F46',
        ['--hairline-mid' as any]: isDark ? 'rgba(255, 255, 255, 0.40)' : 'rgba(0, 0, 0, 0.35)',
        ['--hairline-lo' as any]: isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.16)',
        ['--hairline-stroke' as any]: 0.95,
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
            benchState === 'disconnected' ? 'bg-zinc-500' : 'bg-[#FF5500]'
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

      {/* Normal-flow Action Guidance Prompt: sits in normal flow below the SVG */}
      <div
        className={`shrink-0 mb-1 z-10 flex items-center gap-2 px-3.5 py-1.5 rounded-[4px] border border-dashed transition-all select-none pointer-events-auto whitespace-nowrap ${
          isDropTargetOver
            ? 'border-[#FF5500] bg-[#FF5500]/20 text-[#FF5500]'
            : isDark
            ? 'border-white/15 bg-black/60 text-zinc-400'
            : 'border-black/20 bg-white/70 text-zinc-600'
        }`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#FF5500]" />
        <span className="text-[11px] font-sans tracking-normal">
          Drop media to begin
        </span>
        {onOpenSamples && (
          <>
            <span className="text-zinc-600 text-[11px]">or</span>
            <button
              type="button"
              onClick={onOpenSamples}
              className="text-[11px] font-sans text-zinc-300 hover:text-white underline underline-offset-2 cursor-pointer"
            >
              browse samples
            </button>
          </>
        )}
      </div>
    </div>
  );
};
