import { ExtractedFrame, DecodedMedia } from '../../types/media';
import { KineticRenderOptions, MotionArchetype } from './types';
import { computeSafeTextLayout } from './kineticLayout';
import { renderArchetypeFrame } from './kineticArchetypes';
import { getWordEffectiveArchetype } from './semanticClassifier';

/**
 * Renders synchronized kinetic typography frames at 30 FPS for a 128x64 OLED display.
 */
export async function renderKineticSequence(
  options: KineticRenderOptions,
  onProgress?: (progress: number) => void
): Promise<DecodedMedia> {
  const {
    lyrics,
    startMs,
    endMs,
    targetFps = 30,
    archetype,
    fontFamily = '"IBM Plex Mono", monospace',
    wordOverrides,
    audioAnalysis
  } = options;

  const durationMs = Math.max(500, endMs - startMs);
  const frameCount = Math.max(1, Math.round((durationMs / 1000) * targetFps));
  const frameIntervalMs = 1000 / targetFps;

  // Use standard canvas or OffscreenCanvas
  const canvas = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(128, 64)
    : document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;

  const ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
  if (!ctx) throw new Error('Could not acquire 2D rendering context for kinetic engine');

  // Flatten words within the selected time window
  const wordsInRange = lyrics
    .flatMap(l => l.words)
    .filter(w => w.endMs >= startMs && w.startMs <= endMs)
    .sort((a, b) => a.startMs - b.startMs);

  const fallbackWord = { word: 'KINETIC', startMs, endMs };
  const words = wordsInRange.length > 0 ? wordsInRange : [fallbackWord];

  const extractedFrames: ExtractedFrame[] = [];

  for (let f = 0; f < frameCount; f++) {
    const currentMs = startMs + f * frameIntervalMs;
    const audioFrame = audioAnalysis ? audioAnalysis.getFrameAtTime(currentMs) : undefined;

    // Locate active word
    let activeWordIndex = words.findIndex(w => currentMs >= w.startMs && currentMs < w.endMs);
    let activeWord = activeWordIndex !== -1 ? words[activeWordIndex] : undefined;

    if (!activeWord) {
      // If between words or in gap, take preceding or next word
      activeWord = words.find(w => currentMs < w.startMs) || words[words.length - 1];
      activeWordIndex = words.indexOf(activeWord);
    }

    const wordDuration = Math.max(80, activeWord.endMs - activeWord.startMs);
    const tau = Math.max(0, Math.min(1, (currentMs - activeWord.startMs) / wordDuration));

    // Resolve dynamic semantic motion archetype per word
    const precedingWord = activeWordIndex > 0 ? words[activeWordIndex - 1] : undefined;
    let effectiveArchetype = getWordEffectiveArchetype(
      activeWord,
      activeWordIndex,
      archetype,
      wordOverrides,
      precedingWord
    );

    if (effectiveArchetype === 'auto_semantic') {
      effectiveArchetype = 'smooth_fluid';
    }

    // Clear frame to solid black (OLED off)
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 128, 64);

    // Compute Zero-Clip Layout
    const layout = computeSafeTextLayout(activeWord.word, ctx, fontFamily);

    // Apply micro camera shake on heavy bass kicks / transients
    ctx.save();
    if (audioFrame?.isBeat || (audioFrame && audioFrame.bass > 0.8)) {
      const punchAmp = audioFrame.isBeat ? (audioFrame.onsetStrength > 0.6 ? 2 : 1) : 1;
      const shakeX = (f % 2 === 0 ? 1 : -1) * punchAmp;
      const shakeY = (f % 3 === 0 ? -1 : 1) * punchAmp;
      ctx.translate(shakeX, shakeY);
    }

    // Render Archetype Frame
    renderArchetypeFrame(ctx, effectiveArchetype, activeWord.word, tau, layout, f, fontFamily, audioFrame);
    ctx.restore();

    // Extract 128x64 RGBA
    const rawImageData = ctx.getImageData(0, 0, 128, 64);
    const ditheredData = ctx.createImageData(128, 64);
    const src = rawImageData.data;
    const dest = ditheredData.data;

    for (let i = 0; i < src.length; i += 4) {
      const lum = 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2];
      const val = (lum > 110 && src[i + 3] > 120) ? 255 : 0;
      dest[i] = val;
      dest[i + 1] = val;
      dest[i + 2] = val;
      dest[i + 3] = 255;
    }

    extractedFrames.push({
      index: f,
      timestampMs: f * frameIntervalMs,
      durationMs: frameIntervalMs,
      imageData: ditheredData
    });

    if (f % 15 === 0 || f === frameCount - 1) {
      onProgress?.(Math.round(((f + 1) / frameCount) * 100));
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    }
  }

  const resultMedia: DecodedMedia = {
    sourceInfo: {
      type: 'video',
      filename: `kinetic_${archetype}_${Math.round(durationMs / 1000)}s`,
      sourceWidth: 128,
      sourceHeight: 64,
      frameCount: extractedFrames.length,
      fps: targetFps,
      durationMs
    },
    frames: extractedFrames
  };

  return resultMedia;
}
