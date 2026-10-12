import React, { useRef, useLayoutEffect, useEffect } from 'react';
import { HL } from './timeline/hairlineKernel.js';
import { mountMediaCassette } from './timeline/mediaCassetteFigure.js';

interface DropStageCassetteProps {
  isDark?: boolean;
  isDragOver?: boolean;
  isDecoding?: boolean;
}

export const DropStageCassette: React.FC<DropStageCassetteProps> = ({
  isDark = true,
  isDragOver = false,
  isDecoding = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const readRef = useRef<HTMLSpanElement>(null);
  const figureRef = useRef<ReturnType<typeof mountMediaCassette> | null>(null);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    HL.inject(document);

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 400 320');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.position = 'absolute';
    svg.style.inset = '0';
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.display = 'block';
    el.appendChild(svg);

    const figure = mountMediaCassette(
      {
        stage: el,
        svg,
        read: readRef.current || { textContent: '' }
      },
      { isDragOver, isDecoding }
    );
    figureRef.current = figure;

    return () => {
      figure.destroy();
      figureRef.current = null;
      svg.remove();
    };
  }, []);

  useEffect(() => {
    figureRef.current?.update?.({ isDragOver, isDecoding });
  }, [isDragOver, isDecoding]);

  return (
    <div
      className="w-full flex-1 min-h-0 relative flex flex-col items-center justify-center select-none"
      style={{
        ['--hairline-plate' as any]: isDark ? '#141416' : '#EAE7E1',
        ['--hairline-hi' as any]: '#FF5500',
        ['--hairline-edge' as any]: isDark ? '#FFFFFF' : '#27272A',
        ['--hairline-mid' as any]: isDark ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.55)',
        ['--hairline-lo' as any]: isDark ? 'rgba(255, 255, 255, 0.35)' : 'rgba(0, 0, 0, 0.25)',
        ['--hairline-stroke' as any]: 1.1,
      }}
    >
      {/* Isometric SVG Container */}
      <div
        ref={containerRef}
        data-hairline="media-cassette"
        data-hairline-theme={isDark ? 'dark' : 'light'}
        className="w-full h-full relative cursor-default max-h-[220px]"
      />
    </div>
  );
};
