import React from 'react';
import { Phone } from '@lucasmarkes/hairline/react';

interface TapeDeckEmptyStateProps {
  isDark?: boolean;
  isDropTargetOver?: boolean;
}

export const TapeDeckEmptyState: React.FC<TapeDeckEmptyStateProps> = ({
  isDark = true,
  isDropTargetOver = false,
}) => {
  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      className={`absolute inset-0 top-7 flex items-center justify-center select-none overflow-hidden transition-colors ${
        isDropTargetOver
          ? isDark ? 'bg-[#FF5500]/10' : 'bg-[#FF5500]/10'
          : isDark ? 'bg-[#181A1B]' : 'bg-[#EAE7E1]'
      }`}
      style={{
        // Hairline palette overrides: match matte hardware canvas #181A1B and amber accent #FF5500
        ['--hairline-plate' as any]: isDark ? '#181A1B' : '#EAE7E1',
        ['--hairline-hi' as any]: isDropTargetOver ? '#00FF66' : '#FF5500',
        ['--hairline-edge' as any]: isDark ? '#A1A1AA' : '#52525B',
        ['--hairline-mid' as any]: isDark ? 'rgba(255, 255, 255, 0.20)' : 'rgba(0, 0, 0, 0.20)',
        ['--hairline-lo' as any]: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
        ['--hairline-stroke' as any]: 0.95,
      }}
    >
      {/* Pure aesthetic multi-layer showcase (Zero text, zero buttons) */}
      <div className="w-full h-full max-h-[260px] flex items-center justify-center p-2">
        <div className="h-full aspect-[5/4] max-w-full flex items-center justify-center">
          <Phone
            theme={isDark ? 'dark' : 'light'}
            intensity={0.65}
            className="w-full h-full"
          />
        </div>
      </div>
    </div>
  );
};
