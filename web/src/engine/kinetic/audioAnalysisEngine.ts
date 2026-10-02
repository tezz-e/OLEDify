/**
 * Audio Analysis Engine for OLED Kinetic Typography
 * 
 * Extracts real-time audio telemetry (RMS energy, sub-bass transients, spectral flux,
 * onsets, and tempo) from any local audio file using the Web Audio API.
 * Provides beat-synchronized triggers and waveform summaries for 30 FPS OLED reels.
 */

export interface AudioFrameData {
  /** Timestamp in milliseconds from the start of the audio */
  timeMs: number;
  /** Normalized RMS loudness [0..1] */
  rms: number;
  /** Normalized low-frequency sub-bass energy [0..1] (Kick drums / 808s) */
  bass: number;
  /** Spectral / energy change rate [0..1] (Sharp consonant & transient attacks) */
  flux: number;
  /** True if a distinct drum hit or onset peaks at this frame */
  isBeat: boolean;
  /** Magnitude of the onset peak [0..1] */
  onsetStrength: number;
}

export interface WaveformPoint {
  min: number;
  max: number;
}

export interface AudioAnalysisResult {
  durationMs: number;
  sampleRate: number;
  bpm: number;
  /** Average RMS loudness across the entire audio track [0..1] */
  averageRms?: number;
  /** Array of timestamps (in ms) where beats or drum hits peak */
  beatsMs: number[];
  /** 30 FPS telemetry frames aligned to display clock */
  frames: AudioFrameData[];
  /** Downsampled waveform summary (1000 points) for instant UI rendering */
  waveform: WaveformPoint[];
  /** Retrieves frame data for a given timestamp in ms */
  getFrameAtTime: (timeMs: number) => AudioFrameData;
  /** Snaps a timestamp to the closest detected beat within a tolerance window */
  snapToNearestBeat: (timeMs: number, maxToleranceMs?: number) => number;
}

/**
 * Decodes and analyzes an audio file or ArrayBuffer.
 */
export async function analyzeAudioFile(
  source: File | Blob | ArrayBuffer,
  onProgress?: (percent: number, status: string) => void
): Promise<AudioAnalysisResult> {
  onProgress?.(10, 'Reading audio file...');

  let arrayBuffer: ArrayBuffer;
  if (source instanceof ArrayBuffer) {
    arrayBuffer = source;
  } else {
    arrayBuffer = await source.arrayBuffer();
  }

  onProgress?.(25, 'Decoding audio buffer...');
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioContextClass();
  
  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
      const copy = arrayBuffer.slice(0);
      let settled = false;
      const onDecoded = (buf: AudioBuffer) => {
        if (!settled) {
          settled = true;
          resolve(buf);
        }
      };
      const onError = (err: unknown) => {
        if (!settled) {
          settled = true;
          reject(err instanceof Error ? err : new Error('Audio decoding failed'));
        }
      };

      try {
        const promise = audioCtx.decodeAudioData(copy, onDecoded, onError);
        if (promise && typeof promise.then === 'function') {
          promise.then(onDecoded).catch(onError);
        }
      } catch (err) {
        onError(err);
      }
    });
  } finally {
    audioCtx.close().catch(() => {});
  }

  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;
  const durationMs = (length / sampleRate) * 1000;
  const numChannels = audioBuffer.numberOfChannels;

  onProgress?.(45, 'Downmixing mono & filtering sub-bass transients...');

  // 1. Downmix all channels into a mono Float32Array
  const mono = new Float32Array(length);
  for (let c = 0; c < numChannels; c++) {
    const channelData = audioBuffer.getChannelData(c);
    for (let i = 0; i < length; i++) {
      mono[i] += channelData[i] / numChannels;
    }
  }

  // 2. Apply 2-Pole Butterworth Low-Pass Filter (~140Hz) for Kick/808 detection
  const bassSignal = new Float32Array(length);
  const cutoffHz = 140;
  const omega = (2 * Math.PI * cutoffHz) / sampleRate;
  const cosOmega = Math.cos(omega);
  const alpha = Math.sin(omega) / (2 * 0.7071);
  const b0 = (1 - cosOmega) / 2;
  const b1 = 1 - cosOmega;
  const b2 = (1 - cosOmega) / 2;
  const a0 = 1 + alpha;
  const a1 = -2 * cosOmega;
  const a2 = 1 - alpha;

  const invA0 = 1 / a0;
  const nb0 = b0 * invA0;
  const nb1 = b1 * invA0;
  const nb2 = b2 * invA0;
  const na1 = a1 * invA0;
  const na2 = a2 * invA0;

  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < length; i++) {
    const x0 = mono[i];
    const y0 = nb0 * x0 + nb1 * x1 + nb2 * x2 - na1 * y1 - na2 * y2;
    bassSignal[i] = y0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }

  onProgress?.(65, 'Extracting 30 FPS energy envelope & spectral flux...');

  // 3. Compute 30 FPS Telemetry Buckets (~33.33ms per bucket)
  const fps = 30;
  const samplesPerFrame = Math.round(sampleRate / fps);
  const totalFrames = Math.max(1, Math.ceil(length / samplesPerFrame));

  const rawRms: number[] = new Array(totalFrames);
  const rawBass: number[] = new Array(totalFrames);
  const rawFlux: number[] = new Array(totalFrames);

  let maxRms = 0.001;
  let maxBass = 0.001;
  let maxFlux = 0.001;
  let prevRms = 0;
  let prevBass = 0;

  for (let f = 0; f < totalFrames; f++) {
    const start = f * samplesPerFrame;
    const end = Math.min(length, start + samplesPerFrame);
    const count = end - start;

    let sumSquare = 0;
    let sumBassSquare = 0;

    for (let i = start; i < end; i++) {
      const v = mono[i];
      const bv = bassSignal[i];
      sumSquare += v * v;
      sumBassSquare += bv * bv;
    }

    const curRms = count > 0 ? Math.sqrt(sumSquare / count) : 0;
    const curBass = count > 0 ? Math.sqrt(sumBassSquare / count) : 0;

    const dRms = Math.max(0, curRms - prevRms);
    const dBass = Math.max(0, curBass - prevBass);
    const fluxVal = dRms + dBass * 1.5;

    rawRms[f] = curRms;
    rawBass[f] = curBass;
    rawFlux[f] = fluxVal;

    if (curRms > maxRms) maxRms = curRms;
    if (curBass > maxBass) maxBass = curBass;
    if (fluxVal > maxFlux) maxFlux = fluxVal;

    prevRms = curRms;
    prevBass = curBass;
  }

  onProgress?.(80, 'Detecting musical onsets and estimating tempo (BPM)...');

  // 4. Adaptive Onset Peak Detection & Beat Tracking
  const odf: number[] = new Array(totalFrames);
  for (let f = 0; f < totalFrames; f++) {
    const normRms = rawRms[f] / maxRms;
    const normBass = rawBass[f] / maxBass;
    const normFlux = rawFlux[f] / maxFlux;
    odf[f] = normFlux * 0.5 + normBass * 0.5;
  }

  const beatsMs: number[] = [];
  const minBeatSpacingFrames = 6; // At least ~200ms between beats (max 300 BPM)
  let lastBeatFrame = -minBeatSpacingFrames;

  const frames: AudioFrameData[] = new Array(totalFrames);

  for (let f = 0; f < totalFrames; f++) {
    const timeMs = (f / fps) * 1000;
    const normRms = Math.min(1, rawRms[f] / maxRms);
    const normBass = Math.min(1, rawBass[f] / maxBass);
    const normFlux = Math.min(1, rawFlux[f] / maxFlux);

    // Dynamic threshold over local 1-second window
    const windowStart = Math.max(0, f - 15);
    const windowEnd = Math.min(totalFrames - 1, f + 15);
    let sumWindow = 0;
    for (let w = windowStart; w <= windowEnd; w++) {
      sumWindow += odf[w];
    }
    const localMean = sumWindow / (windowEnd - windowStart + 1);
    const threshold = localMean * 1.35 + 0.08;

    const isLocalPeak =
      odf[f] > threshold &&
      (f === 0 || odf[f] >= odf[f - 1]) &&
      (f === totalFrames - 1 || odf[f] >= odf[f + 1]);

    const isBeat = isLocalPeak && f - lastBeatFrame >= minBeatSpacingFrames;

    let onsetStrength = 0;
    if (isBeat) {
      lastBeatFrame = f;
      beatsMs.push(Math.round(timeMs));
      onsetStrength = Math.min(1, (odf[f] - threshold) / (1 - threshold + 0.001));
    }

    frames[f] = {
      timeMs: Math.round(timeMs),
      rms: normRms,
      bass: normBass,
      flux: normFlux,
      isBeat,
      onsetStrength
    };
  }

  // 5. Estimate Overall BPM from Inter-Onset Intervals
  let estimatedBpm = 120;
  if (beatsMs.length >= 4) {
    const intervalsMs: number[] = [];
    for (let i = 1; i < beatsMs.length; i++) {
      const diff = beatsMs[i] - beatsMs[i - 1];
      if (diff >= 250 && diff <= 1200) {
        intervalsMs.push(diff);
      }
    }

    if (intervalsMs.length > 0) {
      // Histogram of BPMs with 3 BPM bucket width
      const bpmBuckets = new Map<number, number>();
      for (const diff of intervalsMs) {
        let rawBpm = Math.round(60000 / diff);
        // Normalize to standard 75 - 165 range
        while (rawBpm < 75) rawBpm *= 2;
        while (rawBpm > 165) rawBpm = Math.round(rawBpm / 2);
        
        const bucket = Math.round(rawBpm / 3) * 3;
        bpmBuckets.set(bucket, (bpmBuckets.get(bucket) || 0) + 1);
      }

      let maxVotes = 0;
      let bestBpm = 120;
      bpmBuckets.forEach((votes, b) => {
        if (votes > maxVotes) {
          maxVotes = votes;
          bestBpm = b;
        }
      });
      estimatedBpm = bestBpm;
    }
  }

  onProgress?.(95, 'Generating downsampled waveform...');

  // 6. Compute 1000-Point Waveform for Fast Canvas/UI Rendering
  const waveformSize = 1000;
  const waveform: WaveformPoint[] = new Array(waveformSize);
  const step = Math.max(1, Math.floor(length / waveformSize));

  for (let i = 0; i < waveformSize; i++) {
    const start = i * step;
    const end = Math.min(length, start + step);
    let min = 0;
    let max = 0;
    for (let j = start; j < end; j++) {
      const s = mono[j];
      if (s < min) min = s;
      if (s > max) max = s;
    }
    waveform[i] = { min, max };
  }

  onProgress?.(100, 'Audio analysis complete');

  // Lookup helper
  const getFrameAtTime = (timeMs: number): AudioFrameData => {
    if (frames.length === 0 || timeMs < 0 || timeMs > durationMs) {
      return { timeMs, rms: 0, bass: 0, flux: 0, isBeat: false, onsetStrength: 0 };
    }
    const idx = Math.max(0, Math.min(frames.length - 1, Math.round((timeMs / 1000) * fps)));
    return frames[idx];
  };

  // Beat snapping helper (O(log N) binary search)
  const snapToNearestBeat = (timeMs: number, maxToleranceMs = 160): number => {
    if (beatsMs.length === 0) return timeMs;

    let low = 0;
    let high = beatsMs.length - 1;

    while (low <= high) {
      const mid = (low + high) >> 1;
      const b = beatsMs[mid];
      if (b === timeMs) return timeMs;
      if (b < timeMs) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    let closest = timeMs;
    let minDiff = Infinity;

    if (high >= 0) {
      const diff = Math.abs(beatsMs[high] - timeMs);
      if (diff < minDiff) {
        minDiff = diff;
        closest = beatsMs[high];
      }
    }
    if (low < beatsMs.length) {
      const diff = Math.abs(beatsMs[low] - timeMs);
      if (diff < minDiff) {
        minDiff = diff;
        closest = beatsMs[low];
      }
    }

    return minDiff <= maxToleranceMs ? closest : timeMs;
  };

  return {
    durationMs,
    sampleRate,
    bpm: estimatedBpm,
    averageRms: frames.length > 0 ? (frames.reduce((sum, f) => sum + f.rms, 0) / frames.length) : 0,
    beatsMs,
    frames,
    waveform,
    getFrameAtTime,
    snapToNearestBeat
  };
}
