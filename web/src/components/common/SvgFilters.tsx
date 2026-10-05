import React from 'react';

/**
 * Global SVG filter library defining the Skiper UI mercury gooey filter
 * and the 1-bit OLED phosphor bloom filter. Rendered once at the root of App.tsx.
 */
export const SvgFilterLibrary: React.FC = () => {
  return (
    <svg
      className="absolute w-0 h-0 pointer-events-none opacity-0 overflow-hidden"
      aria-hidden="true"
    >
      <defs>
        {/* Skiper UI Liquid Mercury Gooey Filter
            σ=8 → blur radius. feColorMatrix amplifies α by 19 and offsets by -9,
            creating a hard threshold at α=9/19≈0.474. Overlapping blobs whose
            combined α exceeds this boundary merge into one opaque liquid shape.
            NO feComposite atop — that would composite the original sharp source
            OVER the goo, making the liquid bridge invisible. */}
        <filter
          id="hw-mercury-goo"
          x="-30%"
          y="-30%"
          width="160%"
          height="160%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9"
          />
        </filter>

        {/* OLED 1-Bit Phosphor Bloom Filter */}
        <filter id="hw-phosphor-bloom" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3.5" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    </svg>
  );
};
