/**
 * Zero-latency procedural sound synthesizer for physical hardware feedback.
 * Uses the Web Audio API with zero external audio assets.
 */

let hapticAudioCtx: AudioContext | null = null;

function getHapticContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!hapticAudioCtx) {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    hapticAudioCtx = new AudioCtx();
  }
  if (hapticAudioCtx.state === 'suspended') {
    hapticAudioCtx.resume().catch(() => {});
  }
  return hapticAudioCtx;
}

/**
 * Triggers a bandpass audio click for rotary detents and timeline notches.
 * Includes a 0.3ms anti-pop linear attack ramp to eliminate DC offset transients.
 */
export function playHapticClick(
  frequency = 3800,
  duration = 0.003,
  volume = 0.04,
  when?: number
): void {
  if (volume <= 0) return;
  try {
    const ctx = getHapticContext();
    if (!ctx) return;

    const startTime = when ?? ctx.currentTime;
    const safeVolume = Math.max(0.0001, volume);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(frequency, startTime);

    // 0.3ms anti-pop linear attack ramp prevents DC offset click pop
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(safeVolume, startTime + 0.0003);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration);
  } catch (_) {
    // Graceful silent fallback
  }
}

/**
 * Heavy relay snap for power toggles and WebSerial connections.
 * Uses sample-accurate Web Audio hardware timeline scheduling (+4ms) with zero main-thread timer jitter.
 */
export function playRelaySnap(): void {
  try {
    const ctx = getHapticContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    playHapticClick(180, 0.015, 0.08, now);            // Mechanical thud at t=0
    playHapticClick(4500, 0.005, 0.06, now + 0.004);    // Metallic snap at t=4ms on hardware clock
  } catch (_) {}
}

export type TactileFeedbackType = 'detent' | 'click' | 'toggle' | 'snap' | 'step';

/**
 * Unified Tactile Feedback engine.
 * Dispatches physical device haptic vibration (Mac trackpads / mobile)
 * alongside zero-latency procedural Web Audio synthesized mechanical clicks.
 */
export function triggerTactileFeedback(type: TactileFeedbackType = 'click'): void {
  // 1. Native device haptic pulse (Trackpad / mobile / PWA)
  if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      if (type === 'detent') navigator.vibrate(4);
      else if (type === 'step') navigator.vibrate(6);
      else if (type === 'click') navigator.vibrate(8);
      else if (type === 'toggle') navigator.vibrate([6, 4, 8]);
      else if (type === 'snap') navigator.vibrate([14, 10, 18]);
    } catch (_) {}
  }

  // 2. Procedural mechanical acoustic synthesis
  try {
    const ctx = getHapticContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (type === 'detent') {
      // High-pitched micro-tick for rotary dial notches and frame-by-frame timeline scrubbing
      playHapticClick(4400, 0.002, 0.03, now);
    } else if (type === 'step') {
      // Step click for single frame transport forward/back
      playHapticClick(3600, 0.0035, 0.04, now);
    } else if (type === 'click') {
      // Tactile button switch press
      playHapticClick(2800, 0.004, 0.045, now);
    } else if (type === 'toggle') {
      // Mechanical toggle switch lever flip
      playHapticClick(1200, 0.008, 0.04, now);
      playHapticClick(3400, 0.004, 0.05, now + 0.003);
    } else if (type === 'snap') {
      // Heavy relay / cable detent snap
      playRelaySnap();
    }
  } catch (_) {}
}
