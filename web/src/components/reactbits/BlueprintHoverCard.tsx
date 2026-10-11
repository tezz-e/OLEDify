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
}) => {
  return (
    <div
      className={`relative rounded-[12px] border border-white/[0.08] bg-[var(--hw-bg-surface)] overflow-hidden ${className}`}
    >
      <div className="relative z-10 w-full h-full bg-transparent flex flex-col">
        {children}
      </div>
    </div>
  );
};
