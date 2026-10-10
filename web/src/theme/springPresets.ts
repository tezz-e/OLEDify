/**
 * Strict 3-Preset Spring Motion Contract (Teenage Engineering / Apple)
 * Springs only, no cubic-bezier, <= 300ms perceived duration.
 */
export const HW_SPRINGS = {
  // Snappy: button taps, switches, toggles (< 150ms perceived)
  snappy: { type: 'spring', mass: 0.1, stiffness: 500, damping: 28 },
  
  // Smooth: layoutId tab slides, morphs, position tracking (~ 220ms perceived)
  smooth: { type: 'spring', mass: 0.2, stiffness: 380, damping: 26 },
  
  // Soft: transport island expand/collapse, popover reveals (~ 280ms perceived)
  soft: { type: 'spring', mass: 0.4, stiffness: 300, damping: 24 },

  // Compatibility aliases
  tactileTap: { type: 'spring', mass: 0.1, stiffness: 500, damping: 28 },
  mercuryMorph: { type: 'spring', mass: 0.2, stiffness: 380, damping: 26 },
  islandExpand: { type: 'spring', mass: 0.4, stiffness: 300, damping: 24 },
  dockMagnify: { type: 'spring', mass: 0.1, stiffness: 500, damping: 28 },
  switchSnap: { type: 'spring', mass: 0.1, stiffness: 500, damping: 28 },
  jogCatchUp: { type: 'spring', mass: 0.2, stiffness: 380, damping: 26 },
} as const;
