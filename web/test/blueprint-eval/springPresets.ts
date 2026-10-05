/**
 * Calibrated spring presets for physical hardware & liquid glass transitions.
 */
export const HW_SPRINGS = {
  // Ultra-responsive for magnetic cursor pull and button taps
  tactileTap: { mass: 0.1, stiffness: 450, damping: 24 },
  
  // High-inertia dock icon magnification
  dockMagnify: { mass: 0.1, stiffness: 220, damping: 14 },
  
  // Liquid pill navigation morphing
  mercuryMorph: { mass: 0.6, stiffness: 380, damping: 28 },
  
  // Heavy mechanical toggle switch snap-back
  switchSnap: { mass: 0.3, stiffness: 500, damping: 20 },
  
  // Floating transport bar expansion/contraction
  islandExpand: { mass: 0.8, stiffness: 320, damping: 30 },
  
  // Jog wheel scrub detent catch-up
  jogCatchUp: { mass: 0.2, stiffness: 300, damping: 26 },
} as const;
