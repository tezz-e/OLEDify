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
  glowColor = "rgba(255, 85, 0, 0.12)",
  themeMode = 'light'
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const isDark = themeMode === 'dark';
  
  const springConfig = { damping: 25, stiffness: 400, mass: 0.5 };
  const rotateX = useSpring(useMotionValue(0), springConfig);
  const rotateY = useSpring(useMotionValue(0), springConfig);
  const scale = useSpring(1, springConfig);

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    setMousePos({ x: mouseX, y: mouseY });

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const relX = mouseX - centerX;
    const relY = mouseY - centerY;
    
    // Subtle tilt: max 2 degrees for refined high-end feel
    rotateX.set((relY / centerY) * -2);
    rotateY.set((relX / centerX) * 2);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    scale.set(1.008);
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
      className={`relative border will-change-transform overflow-hidden transition-all duration-300 ${
        isDark
          ? isHovered
            ? 'shadow-[0_16px_40px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.2)] border-white/25 bg-[#0C0C10]/80 backdrop-blur-2xl'
            : 'shadow-[0_8px_24px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)] border-white/12 bg-[#0A0A0E]/70 backdrop-blur-xl'
          : isHovered
          ? 'shadow-[0_20px_40px_-15px_rgba(26,26,26,0.35)] border-[#1A1A1A] bg-[#EAE7E1]'
          : 'shadow-none border-[#1A1A1A]/30 bg-[#F5F0EB]'
      } ${className}`}
      style={{
        rotateX,
        rotateY,
        scale,
        transformPerspective: 1200,
      }}
    >
      {/* Dynamic Cursor Spotlight Layer (React Bits / 21st.dev) */}
      {isHovered && (
        <div
          className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-300"
          style={{
            background: isDark
              ? `radial-gradient(350px circle at ${mousePos.x}px ${mousePos.y}px, rgba(255, 85, 0, 0.14), transparent 80%)`
              : `radial-gradient(350px circle at ${mousePos.x}px ${mousePos.y}px, rgba(232, 93, 42, 0.1), transparent 80%)`,
          }}
        />
      )}

      {/* Top Specular Edge Highlight (Apple Liquid Glass) */}
      <div className={`pointer-events-none absolute top-0 left-0 right-0 h-[1px] z-10 ${
        isDark ? 'bg-gradient-to-r from-transparent via-white/30 to-transparent' : 'bg-gradient-to-r from-transparent via-white/80 to-transparent'
      }`} />

      {/* Corner Technical Precision Marks (Teenage Engineering) */}
      <div className={`absolute top-1 left-1.5 text-[8px] font-mono select-none pointer-events-none z-10 transition-colors ${isDark ? 'text-white/20' : 'text-[#1A1A1A]/30'}`}>+</div>
      <div className={`absolute top-1 right-1.5 text-[8px] font-mono select-none pointer-events-none z-10 transition-colors ${isDark ? 'text-white/20' : 'text-[#1A1A1A]/30'}`}>+</div>
      <div className={`absolute bottom-1 left-1.5 text-[8px] font-mono select-none pointer-events-none z-10 transition-colors ${isDark ? 'text-white/20' : 'text-[#1A1A1A]/30'}`}>+</div>
      <div className={`absolute bottom-1 right-1.5 text-[8px] font-mono select-none pointer-events-none z-10 transition-colors ${isDark ? 'text-white/20' : 'text-[#1A1A1A]/30'}`}>+</div>

      <div className="relative z-10 w-full h-full bg-transparent flex flex-col">
        {children}
      </div>
    </motion.div>
  );
};
