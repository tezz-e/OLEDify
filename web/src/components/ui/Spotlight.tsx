import React, { useRef, useState, useCallback, useEffect } from 'react';
import { motion, useSpring, useTransform, SpringOptions, useReducedMotion } from 'framer-motion';
import { cn } from '../../lib/utils';

export interface SpotlightProps {
  className?: string;
  size?: number;
  springOptions?: SpringOptions;
}

/**
 * 21st.dev / ibelick Spotlight Component
 * Official source: https://21st.dev/r/ibelick/spotlight
 * Restricted by effect budget:
 * Rendered ONLY on import drop zone on hover/drag-over.
 */
export function Spotlight({
  className,
  size = 200,
  springOptions = { bounce: 0, damping: 26, stiffness: 350 },
}: SpotlightProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [parentElement, setParentElement] = useState<HTMLElement | null>(null);
  const shouldReduceMotion = useReducedMotion();

  const mouseX = useSpring(0, springOptions);
  const mouseY = useSpring(0, springOptions);

  const spotlightLeft = useTransform(mouseX, (x) => `${x - size / 2}px`);
  const spotlightTop = useTransform(mouseY, (y) => `${y - size / 2}px`);

  useEffect(() => {
    if (containerRef.current) {
      const parent = containerRef.current.parentElement;
      if (parent) {
        parent.style.position = 'relative';
        parent.style.overflow = 'hidden';
        setParentElement(parent);
      }
    }
  }, []);

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!parentElement || shouldReduceMotion) return;
      const { left, top } = parentElement.getBoundingClientRect();
      mouseX.set(event.clientX - left);
      mouseY.set(event.clientY - top);
    },
    [mouseX, mouseY, parentElement, shouldReduceMotion]
  );

  useEffect(() => {
    if (!parentElement) return;

    parentElement.addEventListener('mousemove', handleMouseMove);
    parentElement.addEventListener('mouseenter', () => setIsHovered(true));
    parentElement.addEventListener('mouseleave', () => setIsHovered(false));

    return () => {
      parentElement.removeEventListener('mousemove', handleMouseMove);
      parentElement.removeEventListener('mouseenter', () => setIsHovered(true));
      parentElement.removeEventListener('mouseleave', () =>
        setIsHovered(false)
      );
    };
  }, [parentElement, handleMouseMove]);

  if (shouldReduceMotion) return null;

  return (
    <motion.div
      ref={containerRef}
      className={cn(
        'pointer-events-none absolute rounded-full blur-2xl transition-opacity duration-300',
        'bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_70%)]',
        isHovered ? 'opacity-100' : 'opacity-0',
        className
      )}
      style={{
        width: size,
        height: size,
        left: spotlightLeft,
        top: spotlightTop,
      }}
    />
  );
}
