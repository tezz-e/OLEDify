import React from 'react';
import { cn } from '../../lib/utils';

export interface BorderBeamProps {
  className?: string;
  size?: number;
  duration?: number;
  borderWidth?: number;
  anchor?: number;
  colorFrom?: string;
  colorTo?: string;
  delay?: number;
}

/**
 * Magic UI BorderBeam Component
 * Official source: https://api.catalogs.dev/shadcn/magicuidesign/border-beam.json
 * Restricted by effect budget:
 * Rendered ONLY on the OLED hardware frame, ONLY while connected/streaming.
 */
export const BorderBeam: React.FC<BorderBeamProps> = ({
  className,
  size = 140,
  duration = 6,
  anchor = 90,
  borderWidth = 1.5,
  colorFrom = '#FF5500',
  colorTo = '#FF5500',
  delay = 0,
}) => {
  return (
    <div
      style={
        {
          '--size': size,
          '--duration': duration,
          '--anchor': anchor,
          '--border-width': borderWidth,
          '--color-from': colorFrom,
          '--color-to': colorTo,
          '--delay': `-${delay}s`,
        } as React.CSSProperties
      }
      className={cn(
        'pointer-events-none absolute inset-0 rounded-[inherit] [border:calc(var(--border-width)*1px)_solid_transparent]',
        '![mask-clip:padding-box,border-box] ![mask-composite:intersect] [mask:linear-gradient(transparent,transparent),linear-gradient(white,white)]',
        'after:absolute after:aspect-square after:w-[calc(var(--size)*1px)] after:animate-border-beam after:[animation-delay:var(--delay)] after:[background:linear-gradient(to_left,var(--color-from),var(--color-to),transparent)] after:[offset-anchor:calc(var(--anchor)*1%)_50%] after:[offset-path:rect(0_auto_auto_0_round_calc(var(--size)*1px))]',
        'motion-reduce:hidden',
        className,
      )}
    />
  );
};
