import { triggerTactileFeedback, TactileFeedbackType } from '../components/hardware/hapticAudio';

export { triggerTactileFeedback, type TactileFeedbackType };

/**
 * Native Device Haptics with acoustic feedback fallback for desktop / non-vibrating devices.
 */
export const triggerNativeHaptic = (pattern: number | number[] = 10): void => {
  if (typeof pattern === 'number' && pattern <= 6) {
    triggerTactileFeedback('detent');
  } else {
    triggerTactileFeedback('click');
  }
};
