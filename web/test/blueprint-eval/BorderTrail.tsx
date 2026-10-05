import React from 'react';

export interface BorderTrailProps {
  children: React.ReactNode;
  trailColor?: string;
  duration?: number; // seconds (default 3.5s)
  size?: number;     // beam arc degrees (default 60)
  themeMode?: 'light' | 'dark';
  className?: string;
}

export const BorderTrail: React.FC<BorderTrailProps> = ({
  children,
  trailColor = '#FF5500',
  duration = 3.5,
  size = 60,
  themeMode = 'dark',
  className = '',
}) => {
  const isDark = themeMode === 'dark';

  // Dynamic conic stops protect against collisions on small beam angles (< 20deg)
  const safeSize = Math.min(359, Math.max(1, size));
  const startAngle = 360 - safeSize;
  const midAngle = Math.max(startAngle, 360 - safeSize * 0.25);

  return (
    <div className={`relative rounded-[12px] p-[1px] overflow-hidden ${className}`}>
      {/* Animated Rotating Conic Beam */}
      <div
        className="pointer-events-none absolute inset-[-100%] animate-[spin_linear_infinite]"
        style={{
          animationDuration: `${duration}s`,
          background: `conic-gradient(from 0deg, transparent 0deg, transparent ${startAngle}deg, ${trailColor} ${midAngle}deg, #FFFFFF 360deg)`,
        }}
      />

      {/* Content Container */}
      <div
        className={`relative z-10 w-full h-full rounded-[11px] backdrop-blur-xl ${
          isDark ? 'bg-[#0E0E10]' : 'bg-[#FFFFFF]'
        }`}
      >
        {children}
      </div>
    </div>
  );
};
