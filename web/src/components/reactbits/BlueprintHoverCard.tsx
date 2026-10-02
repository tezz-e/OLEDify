import React, { useRef, useState } from 'react';
import { motion, useSpring, useMotionValue } from 'framer-motion';

interface BlueprintHoverCardProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: string;
  themeMode?: 'light' | 'dark';
}

export const BlueprintHoverCard: React.FC<BlueprintHoverCardProps> = ({ 
  children, 
  className = "",
  glowColor = "rgba(26, 26, 26, 0.3)",
  themeMode = 'light'
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const isDark = themeMode === 'dark';
  
  const springConfig = { damping: 25, stiffness: 400, mass: 0.5 };
  const rotateX = useSpring(useMotionValue(0), springConfig);
  const rotateY = useSpring(useMotionValue(0), springConfig);
  const scale = useSpring(1, springConfig);

  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const mouseX = e.clientX - centerX;
    const mouseY = e.clientY - centerY;
    
    // Subtle tilt: max 3 degrees
    rotateX.set((mouseY / (rect.height / 2)) * -3);
    rotateY.set((mouseX / (rect.width / 2)) * 3);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    scale.set(1.015);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    scale.set(1);
    rotateX.set(0);
    rotateY.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative border-2 will-change-transform transition-all duration-200 ${
        isDark
          ? isHovered
            ? 'shadow-[4px_4px_0_0_#FF2A85] border-[#00F0FF]/60 bg-[#1A142C]'
            : 'shadow-[2px_2px_0_0_#2D2344] border-[#2D2344] bg-[#161126]'
          : isHovered
          ? 'shadow-[0_20px_40px_-15px_rgba(26,26,26,0.5)] border-[#1A1A1A] bg-[#E0DBD5]'
          : 'shadow-none border-[#1A1A1A] bg-[#F5F0EB]'
      } ${className}`}
      style={{
        rotateX,
        rotateY,
        scale,
        transformPerspective: 1200,
      }}
    >
      {/* Corner Technical Registration Marks */}
      <div className={`absolute -top-1 -left-1 text-[8px] font-mono select-none pointer-events-none transition-colors ${isDark ? 'text-[#00F0FF]/50' : 'text-[#1A1A1A]/30'}`}>+</div>
      <div className={`absolute -top-1 -right-1 text-[8px] font-mono select-none pointer-events-none transition-colors ${isDark ? 'text-[#00F0FF]/50' : 'text-[#1A1A1A]/30'}`}>+</div>
      <div className={`absolute -bottom-1 -left-1 text-[8px] font-mono select-none pointer-events-none transition-colors ${isDark ? 'text-[#00F0FF]/50' : 'text-[#1A1A1A]/30'}`}>+</div>
      <div className={`absolute -bottom-1 -right-1 text-[8px] font-mono select-none pointer-events-none transition-colors ${isDark ? 'text-[#00F0FF]/50' : 'text-[#1A1A1A]/30'}`}>+</div>

      <div className="relative z-10 w-full h-full bg-transparent flex flex-col">
        {children}
      </div>
    </motion.div>
  );
};
