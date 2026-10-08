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
