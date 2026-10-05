/**
 * Silent Native Device Haptics Utility
 * Triggers physical micro-vibration on devices with native vibration motors (mobile, touch devices, PWA, wrapped desktop)
 * Completely silent on desktop browsers with zero speaker audio clicks.
 */
export const triggerNativeHaptic = (pattern: number | number[] = 10): void => {
  try {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch (_) {
    // Graceful fallback for environments with blocked permissions
  }
};
