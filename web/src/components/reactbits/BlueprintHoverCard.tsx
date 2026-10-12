import React from 'react';

interface BlueprintHoverCardProps {
  children: React.ReactNode;
  className?: string;
  themeMode?: 'light' | 'dark';
}

/**
 * Hard-edged Flat Opaque Surface Panel (Teenage Engineering / Nothing)
 * Quiet chrome: flat Surface #0A0A0A, 4px radius, 1px border-white/10.
 * Hard bans: No gradients, no spotlights, no glassmorphism on UI chrome.
 */
export const BlueprintHoverCard: React.FC<BlueprintHoverCardProps> = ({ 
  children, 
  className = "",
  themeMode = 'dark',
}) => {
  const isDark = themeMode === 'dark';
  return (
    <div
      className={`relative rounded-[8px] border transition-colors ${
        isDark
          ? 'border-white/[0.06] border-t-white/[0.10] bg-[var(--hw-bg-surface)] shadow-[0_8px_20px_-6px_rgba(0,0,0,0.45)]'
          : 'border-black/[0.08] border-t-black/[0.12] bg-[var(--hw-bg-surface)] shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06)]'
      } overflow-hidden ${className}`}
    >
      <div className="relative z-10 w-full h-full bg-transparent flex flex-col">
        {children}
      </div>
    </div>
  );
};
