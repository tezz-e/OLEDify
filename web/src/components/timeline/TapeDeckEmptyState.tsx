import React, { useRef, useLayoutEffect } from 'react';
import { HL } from './hairlineKernel.js';
import { mountOledBench } from './oledBenchFigure.js';

interface TapeDeckEmptyStateProps {
  isDark?: boolean;
  isDropTargetOver?: boolean;
}

export const TapeDeckEmptyState: React.FC<TapeDeckEmptyStateProps> = ({
  isDark = true,
  isDropTargetOver = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const readRef = useRef<HTMLSpanElement>(null);

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

    const figure = mountOledBench({
      stage: el,
      svg,
      read: readRef.current || { textContent: '' }
    }, 24);

    return () => {
      figure.destroy();
      svg.remove();
    };
  }, []);

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      className={`absolute inset-0 top-[28px] bottom-[72px] flex items-center justify-center select-none overflow-hidden transition-colors ${
        isDropTargetOver
          ? isDark ? 'bg-[#FF5500]/10' : 'bg-[#FF5500]/10'
          : isDark ? 'bg-[#181A1B]' : 'bg-[#EAE7E1]'
      }`}
      style={{
        // Match matte hardware canvas #181A1B and amber accent #FF5500
        ['--hairline-plate' as any]: isDark ? '#181A1B' : '#EAE7E1',
        ['--hairline-hi' as any]: isDropTargetOver ? '#00FF66' : '#FF5500',
        ['--hairline-edge' as any]: isDark ? '#A1A1AA' : '#52525B',
        ['--hairline-mid' as any]: isDark ? 'rgba(255, 255, 255, 0.20)' : 'rgba(0, 0, 0, 0.20)',
        ['--hairline-lo' as any]: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
        ['--hairline-stroke' as any]: 0.95,
      }}
    >
      {/* Corner Readout - Hairline Rule 10: Geometry carries identity, text in corner */}
      <div className="absolute top-2 left-4 z-10 flex items-center gap-2 font-mono text-[9px] tracking-wider uppercase text-zinc-500 pointer-events-none select-none">
        <span className="w-1.5 h-1.5 rounded-full bg-[#FF5500] animate-pulse" />
        <span className="text-zinc-600">BENCH //</span>
        <span ref={readRef} className="text-zinc-400 font-mono">
          esp32-s3 ──[ 921.6k i2c ]──&gt; ssd1306 oled
        </span>
      </div>

      {/* Full-width hardware bench: ESP32-S3 Host -> 4-Wire I2C Bus -> 0.96" OLED Module */}
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
