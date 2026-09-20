import React, { useState } from 'react';
import { motion, AnimatePresence, HTMLMotionProps } from 'framer-motion';
import { twMerge } from 'tailwind-merge';

interface GlassButtonProps extends HTMLMotionProps<"button"> {
  children: React.ReactNode;
  active?: boolean;
}

export const GlassButton: React.FC<GlassButtonProps> = ({ children, active, className = "", onClick, ...props }) => {
  const [ripples, setRipples] = useState<{ x: number; y: number; id: number }[]>([]);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setRipples((prev) => [...prev, { x, y, id: Date.now() }]);
    
    if (onClick) onClick(e);
  };

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={handleClick}
      className={twMerge(
        `relative overflow-hidden border border-[#1A1A1A]/30 bg-white/30 backdrop-blur-md text-[#1A1A1A] hover:bg-white/60 hover:border-[#1A1A1A] transition-colors shadow-sm flex items-center justify-center`,
        active ? 'border-[#E85D2A] bg-white/80 text-[#E85D2A]' : '',
        className
      )}
      {...props}
    >
      <div className="relative z-10 flex items-center justify-center w-full h-full">
        {children}
      </div>
      <AnimatePresence>
        {ripples.map((ripple) => (
          <motion.span
            key={ripple.id}
            initial={{ scale: 0, opacity: 0.5 }}
            animate={{ scale: 4, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            onAnimationComplete={() => {
              setRipples((prev) => prev.filter((r) => r.id !== ripple.id));
            }}
            className="absolute rounded-full bg-[#1A1A1A]/20 pointer-events-none"
            style={{
              left: ripple.x,
              top: ripple.y,
              width: 30,
              height: 30,
              transformOrigin: "center center",
              marginTop: -15,
              marginLeft: -15
            }}
          />
        ))}
      </AnimatePresence>
    </motion.button>
  );
};
