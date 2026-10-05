import { useRef, useCallback } from 'react';
import { useMotionValue, useSpring, MotionValue } from 'framer-motion';

interface MagneticResult {
  ref: React.RefObject<HTMLElement | null>;
  x: MotionValue<number>;
  y: MotionValue<number>;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseLeave: () => void;
}

interface MagneticOptions {
  /** Stiffness coefficient S — higher = stiffer pull (less displacement). Default: 3.2 */
  stiffness?: number;
  /** Extra padding radius beyond element bounds. Default: 24px */
  padding?: number;
  /** Spring config for smooth return */
  spring?: { stiffness: number; damping: number; mass: number };
}

/**
 * Magnetic cursor pull hook implementing Blueprint Eq. C:
 * T(d) = (D/S) * (1 - d^2/R_act^2)  when d <= R_act, else 0
 * Spring snap-back with damping ratio ζ=0.72.
 */
export function useMagnetic(options: MagneticOptions = {}): MagneticResult {
  const { stiffness = 3.2, padding = 24, spring = { stiffness: 280, damping: 20, mass: 0.4 } } = options;

  const ref = useRef<HTMLElement>(null);
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);

  const x = useSpring(rawX, spring);
  const y = useSpring(rawY, spring);

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      const rAct = Math.max(rect.width, rect.height) / 2 + padding;

      if (d <= rAct) {
        const force = 1 - (d * d) / (rAct * rAct);
        rawX.set((dx / stiffness) * force);
        rawY.set((dy / stiffness) * force);
      } else {
        rawX.set(0);
        rawY.set(0);
      }
    },
    [stiffness, padding, rawX, rawY]
  );

  const onMouseLeave = useCallback(() => {
    rawX.set(0);
    rawY.set(0);
  }, [rawX, rawY]);

  return { ref, x, y, onMouseMove, onMouseLeave };
}
