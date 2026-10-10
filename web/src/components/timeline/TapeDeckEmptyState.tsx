import React, { useRef, useLayoutEffect } from 'react';
import { HL } from './hairlineKernel.js';
import { mountOled } from './oledFigure.js';

interface TapeDeckEmptyStateProps {
  isDark?: boolean;
  isDropTargetOver?: boolean;
}

export const TapeDeckEmptyState: React.FC<TapeDeckEmptyStateProps> = ({
  isDark = true,
  isDropTargetOver = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    HL.inject(document);

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 400 320');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.position = 'absolute';
    svg.style.inset = '0';
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.display = 'block';
    el.appendChild(svg);

    const figure = mountOled({ stage: el, svg, read: { textContent: '' } }, 28);

    return () => {
      figure.destroy();
      svg.remove();
    };
  }, []);

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      className={`absolute inset-0 top-7 flex items-center justify-center select-none overflow-hidden transition-colors ${
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
      {/* Pure aesthetic multi-layer 0.96" SSD1306 OLED showcase (Zero text, zero buttons) */}
      <div className="w-full h-full max-h-[260px] flex items-center justify-center p-2">
        <div
          ref={containerRef}
          data-hairline="oled"
          data-hairline-theme={isDark ? 'dark' : 'light'}
          className="h-full aspect-[5/4] max-w-full flex items-center justify-center relative cursor-crosshair"
          style={{ touchAction: 'pan-y' }}
        />
      </div>
    </div>
  );
};
