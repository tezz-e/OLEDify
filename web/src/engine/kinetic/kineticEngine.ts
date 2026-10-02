import { ExtractedFrame, DecodedMedia } from '../../types/media';
import { KineticRenderOptions, MotionArchetype, STYLE_PACKS } from './types';
import { computeSafeTextLayout } from './kineticLayout';
import { renderArchetypeFrame } from './kineticArchetypes';
import { renderMotifBackground } from './motifRenderer';
import { getWordEffectiveArchetype, getWordEffectiveFont, cleanLyricToken } from './semanticClassifier';
import { LyricWord } from '../lyrics/types';
import { isRTL } from './scriptDetector';
import { ensureFontForText } from './fontLoader';

function findLastEndedWord(wordsList: LyricWord[], timeMs: number): { word?: LyricWord; index: number } {
  for (let i = wordsList.length - 1; i >= 0; i--) {
    if (wordsList[i].endMs <= timeMs) {
      return { word: wordsList[i], index: i };
    }
  }
  return { word: undefined, index: -1 };
}

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

  // Flatten words within the selected time window
  const wordsInRange = lyrics
    .flatMap(l => l.words)
    .filter(w => w.endMs >= startMs && w.startMs <= endMs)
    .sort((a, b) => a.startMs - b.startMs);

  const fallbackWord = { word: 'KINETIC', startMs, endMs };
  const words = wordsInRange.length > 0 ? wordsInRange : [fallbackWord];

  // Preload foreign script display fonts for words in sequence
  try {
    const allWordsText = words.map(w => w.word).join(' ');
    await ensureFontForText(allWordsText);
  } catch {
    // Continue
  }

  // Ensure custom @font-face assets are loaded into memory before measuring text
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Continue if font loading promise fails or in test env
    }
  }

  // Use standard canvas or OffscreenCanvas
  const canvas = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(128, 64)
    : document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;

  const ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
  if (!ctx) throw new Error('Could not acquire 2D rendering context for kinetic engine');

  const extractedFrames: ExtractedFrame[] = [];

  for (let f = 0; f < frameCount; f++) {
    const currentMs = startMs + f * frameIntervalMs;
    const audioFrame = audioAnalysis ? audioAnalysis.getFrameAtTime(currentMs) : undefined;

    // Locate active word
    let activeWordIndex = words.findIndex(w => currentMs >= w.startMs && currentMs < w.endMs);
    let activeWord = activeWordIndex !== -1 ? words[activeWordIndex] : undefined;
    let isPauseState = false;

    if (!activeWord) {
      // Check if preceding word just ended within 140ms tail hold
      const { word: prevWord, index: prevIndex } = findLastEndedWord(words, currentMs);
      if (prevWord && (currentMs - prevWord.endMs) <= 140) {
        activeWord = prevWord;
        activeWordIndex = prevIndex;
      } else {
        isPauseState = true;
      }
    }

    // Clear frame to solid black (OLED off)
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 128, 64);

    if (isPauseState || !activeWord) {
      // REST STATE (Instrumental Pause / Vocal Gap)
      // Render subtle beat-reactive minimal OLED phosphor pulse instead of frozen future text
      ctx.save();
      if (audioFrame) {
        const pulseWidth = Math.floor(Math.max(6, Math.min(44, audioFrame.rms * 50 + (audioFrame.isBeat ? 16 : 0))));
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(Math.floor(64 - pulseWidth / 2), 31, pulseWidth, 2);
        if (audioFrame.isBeat) {
          ctx.fillRect(63, 27, 2, 10);
        }
      } else {
        // Minimal idle breathing dot
        const dotAlpha = 0.4 + 0.3 * Math.sin((f / 30) * Math.PI * 2);
        if (dotAlpha > 0.45) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(63, 31, 2, 2);
        }
      }
      ctx.restore();
    } else {
      const isWordRTL = isRTL(activeWord.word);
      ctx.direction = isWordRTL ? 'rtl' : 'ltr';

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

      // Resolve active style pack
      const activePackConfig = options.customPalette
        ? { id: 'custom' as const, name: 'Custom', icon: '⚙️', tag: 'CUSTOM', description: '', fonts: options.customPalette }
        : (options.stylePack && STYLE_PACKS[options.stylePack]) ? STYLE_PACKS[options.stylePack] : STYLE_PACKS.trap_drill;

      // Resolve dynamic font per word matching semantic role & pack
      const effectiveFont = getWordEffectiveFont(
        activeWord,
        effectiveArchetype,
        activePackConfig,
        options.wordFontOverrides,
        fontFamily
      );

      // Resolve active motif for word
      const specificKey = `${activeWord.word}_${activeWord.startMs}`;
      const cleanWord = cleanLyricToken(activeWord.word);
      const lowerRaw = activeWord.word.trim().toLowerCase();
      const wordMotif = options.wordMotifOverrides?.[specificKey] 
        || (cleanWord ? options.wordMotifOverrides?.[cleanWord] : undefined) 
        || options.wordMotifOverrides?.[lowerRaw] 
        || options.wordMotifOverrides?.[activeWord.word] 
        || 'none';

      const effectiveMotifMode = options.motifMode || 'dynamic';

      // Render background motif layer before text
      if (effectiveMotifMode !== 'off' && wordMotif !== 'none') {
        renderMotifBackground(ctx, {
          motif: wordMotif,
          motifMode: effectiveMotifMode,
          tau,
          frameIndex: f,
          textCenterY: 32,
          audioFrame,
          isRTL: isWordRTL,
        });
      }

      // Compute Zero-Clip Layout with the effective font
      const layout = computeSafeTextLayout(activeWord.word, ctx, effectiveFont);

      // Apply micro camera shake on heavy bass kicks / transients
      ctx.save();
      if (audioFrame?.isBeat || (audioFrame && audioFrame.bass > 0.8)) {
        const punchAmp = audioFrame.isBeat ? (audioFrame.onsetStrength > 0.6 ? 2 : 1) : 1;
        const shakeX = (f % 2 === 0 ? 1 : -1) * punchAmp;
        const shakeY = (f % 3 === 0 ? -1 : 1) * punchAmp;
        ctx.translate(shakeX, shakeY);
      }

      // Render Archetype Frame with effective font
      renderArchetypeFrame(ctx, effectiveArchetype, activeWord.word, tau, layout, f, effectiveFont, audioFrame);
      ctx.restore();
    }

    // Extract 128x64 RGBA
    const rawImageData = ctx.getImageData(0, 0, 128, 64);
    const ditheredData = ctx.createImageData(128, 64);
    const src = rawImageData.data;
    const dest = ditheredData.data;

    for (let i = 0; i < src.length; i += 4) {
      const lum = 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2];
      const val = (lum > 125 && src[i + 3] > 120) ? 255 : 0;
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
