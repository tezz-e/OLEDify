import { ExtractedFrame, DecodedMedia } from '../../types/media';
import { KineticRenderOptions, MotionArchetype, STYLE_PACKS, KineticTransitionType, TextDressing, WordBadgeIcon, VisualMotif, BADGE_TO_MOTIF_DUPLICATES } from './types';
import { computeSafeTextLayout } from './kineticLayout';
import { renderArchetypeFrame, getScratchCanvas, BAYER_4X4 } from './kineticArchetypes';
import { renderMotifBackground } from './motifRenderer';
import { renderWordBadge } from './wordBadgeRenderer';
import { getWordEffectiveArchetype, getWordEffectiveFont, getWordEffectiveDressing, cleanLyricToken, isFillerWord, classifyWordBadge, classifyWordMotif } from './semanticClassifier';
import { LyricWord } from '../lyrics/types';
import { isRTL } from './scriptDetector';
import { ensureFontForText } from './fontLoader';
import { computeSongMoodProfile, SongMoodProfile } from './moodProfileEngine';
import { AudioFrameData } from './audioAnalysisEngine';

let cachedTransitionBuffer: Uint8ClampedArray | null = null;

function findLastEndedWord(wordsList: LyricWord[], timeMs: number): { word?: LyricWord; index: number } {
  for (let i = wordsList.length - 1; i >= 0; i--) {
    if (wordsList[i].endMs <= timeMs) {
      return { word: wordsList[i], index: i };
    }
  }
  return { word: undefined, index: -1 };
}

/**
 * Calculates adaptive hold/dwell duration tailored to the word's physical duration and genre vibe.
 * Fast words (e.g. 150-250ms at 128 BPM) get proportionally shorter holds (e.g. 40-75ms)
 * to ensure at least 60% of the word's duration is available for entry motion physics.
 * Slow words (e.g. 600-800ms) get a dignified, solid hold (up to 240ms).
 */
export function computeAdaptiveWordHold(wordDurationMs: number, moodProfile: SongMoodProfile): number {
  const baseRatio = (moodProfile.vibe === 'ballad_acoustic') ? 0.45 : (moodProfile.vibe === 'chill_pop' ? 0.38 : 0.28);
  const minHold = Math.min(50, Math.round(wordDurationMs * 0.25));
  const maxHold = Math.round(180 * moodProfile.dwellDecayFactor);
  return Math.max(minHold, Math.min(maxHold, Math.round(wordDurationMs * baseRatio * moodProfile.dwellDecayFactor)));
}

/**
 * Intelligently resolves the dynamic transition choreography between consecutive words.
 * Adapts between Banger suites (razor slices, glitch tears, impact flashes) and Smooth suites
 * (reading glides, starry dither sweeps, elevator drifts) based on song vibe, audio transients & rhythm.
 */
export function resolveTransitionStyle(
  prevWord: LyricWord,
  activeWord: LyricWord,
  wordIndex: number,
  prevArchetype: MotionArchetype,
  activeArchetype: MotionArchetype,
  moodProfile?: SongMoodProfile | null,
  userChoice: KineticTransitionType = 'auto',
  audioFrame?: AudioFrameData
): KineticTransitionType {
  if (userChoice && userChoice !== 'auto') {
    return userChoice;
  }

  const isBanger = moodProfile?.vibe === 'hype_aggressive' 
    || (moodProfile?.vibe === 'groove_dance' && (moodProfile.energyScore > 0.55 || (audioFrame && audioFrame.bass > 0.8)));

  // 1. Punctuation pauses or sentence endings -> dither_dissolve (dignified calm pause)
  const prevClean = prevWord.word.trim();
  if (prevClean.endsWith('.') || prevClean.endsWith('...') || prevClean.endsWith('?') || prevClean.endsWith('!') || prevClean.endsWith(',')) {
    return 'dither_dissolve';
  }

  // 2. Significant vocal gap (>250ms silence between words) -> curtain_drop or dither_dissolve
  const gap = activeWord.startMs - prevWord.endMs;
  if (gap > 250) {
    return (wordIndex % 2 === 0) ? 'curtain_drop' : 'dither_dissolve';
  }

  // =========================================================================
  // A. BANGER SONG TRANSITIONS (Trap / Drill / Hype / Heavy Bass Beats)
  // =========================================================================
  if (isBanger) {
    // Heavy transient kick / beat onset right at transition seam -> impact_flash or razor_slice
    if (audioFrame?.isBeat || (audioFrame && audioFrame.onsetStrength > 0.65)) {
      return (wordIndex % 2 === 0) ? 'impact_flash' : 'razor_slice';
    }

    // Direct combat/glitch archetype matching
    if (activeArchetype === 'blade_slash' || prevArchetype === 'blade_slash') {
      return 'razor_slice';
    }
    if (activeArchetype === 'cyber_glitch' || prevArchetype === 'cyber_glitch') {
      return 'glitch_tear';
    }
    if (activeArchetype === 'manga_impact' || prevArchetype === 'manga_impact') {
      return 'impact_flash';
    }

    // Dynamic rotation among punchy banger styles
    const bangerCycle: KineticTransitionType[] = [
      'razor_slice',
      'glitch_tear',
      'lateral_glide',
      'impact_flash',
      'bayer_sweep'
    ];
    return bangerCycle[wordIndex % bangerCycle.length];
  }

  // =========================================================================
  // B. SMOOTH / CHILL / ACOUSTIC TRANSITIONS (Ballads, Pop, Lo-Fi, R&B)
  // =========================================================================
  // Ethereal / Float archetypes -> vertical_drift
  if (activeArchetype === 'gentle_float' || prevArchetype === 'gentle_float') {
    return 'vertical_drift';
  }

  // Dither dissolve or typewriter reveals -> bayer_sweep
  if (activeArchetype === 'dither_dissolve' || activeArchetype === 'typewriter_ribbon') {
    return 'bayer_sweep';
  }

  // Sequential lyric reading flow: cycle through dynamic smooth choreographies
  const smoothCycle: KineticTransitionType[] = [
    'lateral_glide',
    'bayer_sweep',
    'vertical_drift',
    'lateral_glide',
    'curtain_drop',
    'bayer_sweep'
  ];

  return smoothCycle[wordIndex % smoothCycle.length];
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

  // Use standard canvas, OffscreenCanvas, or headless mock
  let canvas: any;
  let ctx: CanvasRenderingContext2D | null = null;

  if (typeof OffscreenCanvas !== 'undefined') {
    canvas = new OffscreenCanvas(128, 64);
    ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
  } else if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
  } else {
    // Headless Node.js test fallback
    const mockPixels = new Uint8ClampedArray(128 * 64 * 4);
    ctx = {
      save: () => {},
      restore: () => {},
      translate: () => {},
      rotate: () => {},
      scale: () => {},
      fillRect: () => {},
      strokeRect: () => {},
      rect: () => {},
      clip: () => {},
      closePath: () => {},
      arc: () => {},
      ellipse: () => {},
      arcTo: () => {},
      quadraticCurveTo: () => {},
      bezierCurveTo: () => {},
      roundRect: () => {},
      fillText: () => {},
      strokeText: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      fill: () => {},
      clearRect: () => {},
      measureText: (text: string) => ({ width: text.length * 8 }),
      getImageData: () => ({ data: mockPixels, width: 128, height: 64 }),
      putImageData: () => {},
      drawImage: () => {},
      createImageData: () => ({ data: new Uint8ClampedArray(128 * 64 * 4), width: 128, height: 64 }),
      font: '',
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      textAlign: 'center',
      textBaseline: 'middle',
      direction: 'ltr',
      globalCompositeOperation: 'source-over'
    } as any;
  }
  if (!ctx) throw new Error('Could not acquire 2D rendering context for kinetic engine');

  const extractedFrames: ExtractedFrame[] = [];

  const moodProfile = computeSongMoodProfile(audioAnalysis, lyrics, '', '', options.vibe);
  const holdDurationMs = Math.round(140 * moodProfile.dwellDecayFactor);

  for (let f = 0; f < frameCount; f++) {
    const currentMs = startMs + f * frameIntervalMs;
    const audioFrame = audioAnalysis ? audioAnalysis.getFrameAtTime(currentMs) : undefined;

    // Locate active word
    let activeWordIndex = words.findIndex(w => currentMs >= w.startMs && currentMs < w.endMs);
    let activeWord = activeWordIndex !== -1 ? words[activeWordIndex] : undefined;
    let isPauseState = false;
    let isTailFade = false;
    let tailFadeProgress = 0;

    if (!activeWord) {
      // Check if preceding word just ended within adaptive tail hold + soft dissolve
      const { word: prevWord, index: prevIndex } = findLastEndedWord(words, currentMs);
      const exitFadeMs = moodProfile.crossfadeOverlapMs > 0 ? 80 : 0;
      const prevWordDuration = prevWord ? Math.max(80, prevWord.endMs - prevWord.startMs) : 400;
      const prevWordHoldMs = prevWord ? computeAdaptiveWordHold(prevWordDuration, moodProfile) : holdDurationMs;

      if (prevWord && (currentMs - prevWord.endMs) <= (prevWordHoldMs + exitFadeMs)) {
        activeWord = prevWord;
        activeWordIndex = prevIndex;
        if (exitFadeMs > 0 && (currentMs - prevWord.endMs) > prevWordHoldMs) {
          isTailFade = true;
          tailFadeProgress = Math.min(1, (currentMs - prevWord.endMs - prevWordHoldMs) / exitFadeMs);
        }
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

      // Resolve dynamic semantic motion archetype per word with moodProfile
      const precedingWord = activeWordIndex > 0 ? words[activeWordIndex - 1] : undefined;
      let effectiveArchetype = getWordEffectiveArchetype(
        activeWord,
        activeWordIndex,
        archetype,
        wordOverrides,
        precedingWord,
        moodProfile
      );

      if (effectiveArchetype === 'auto_semantic') {
        effectiveArchetype = moodProfile.defaultArchetype;
      }

      // Resolve active style pack
      const activePackConfig = options.customPalette
        ? { id: 'custom' as const, name: 'Custom', icon: '⚙️', tag: 'CUSTOM', description: '', fonts: options.customPalette }
        : (options.stylePack && STYLE_PACKS[options.stylePack]) 
          ? STYLE_PACKS[options.stylePack] 
          : STYLE_PACKS[moodProfile.recommendedStylePack] || STYLE_PACKS.trap_drill;

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
      let wordMotif = options.wordMotifOverrides?.[specificKey] 
        || (cleanWord ? options.wordMotifOverrides?.[cleanWord] : undefined) 
        || options.wordMotifOverrides?.[lowerRaw] 
        || options.wordMotifOverrides?.[activeWord.word] 
        || 'none';

      // 1. Resolve Word Micro-Badge Icon FIRST (inline word adornment takes visual priority)
      let effectiveBadge: WordBadgeIcon = 'none';
      if (options.badgeMode !== 'off') {
        const cleanKey = cleanLyricToken(activeWord.word);
        const rawKey = activeWord.word.trim().toLowerCase();
        const specificKey = `${activeWord.word}_${activeWord.startMs}`;

        if (options.wordBadgeOverrides?.[specificKey]) {
          effectiveBadge = options.wordBadgeOverrides[specificKey];
        } else if (cleanKey && options.wordBadgeOverrides?.[cleanKey]) {
          effectiveBadge = options.wordBadgeOverrides[cleanKey];
        } else if (options.wordBadgeOverrides?.[rawKey]) {
          effectiveBadge = options.wordBadgeOverrides[rawKey];
        } else {
          effectiveBadge = classifyWordBadge(activeWord.word, moodProfile);
        }
      }

      const effectiveMotifMode = options.motifMode || 'dynamic';

      // Auto-synthesize complementary motif for hero/accent words when motif is unassigned (never on filler words)
      const isFiller = isFillerWord(cleanLyricToken(activeWord.word));
      if (!isFiller && effectiveMotifMode !== 'off' && wordMotif === 'none') {
        const isImportantWord = wordDuration >= 350 || (audioFrame?.isBeat && wordDuration >= 200);
        if (isImportantWord && activeWordIndex % 2 === 1) {
          switch (effectiveArchetype) {
            case 'manga_impact': wordMotif = (activeWordIndex % 4 === 1) ? 'manga_speedlines' : 'sound_blast_rings'; break;
            case 'blade_slash': wordMotif = (activeWordIndex % 4 === 1) ? 'razor_blade' : 'barbed_wire'; break;
            case 'cyber_glitch': wordMotif = (activeWordIndex % 4 === 1) ? 'lightning_arc' : 'shattered_glass'; break;
            case 'anvil_stomp': wordMotif = 'sound_blast_rings'; break;
            case 'fracture_shatter': wordMotif = 'shattered_glass'; break;
            case 'target_focus': wordMotif = 'tactical_scope'; break;
            case 'gentle_float': wordMotif = (activeWordIndex % 4 === 1) ? 'floating_notes' : 'starlight_glimmer'; break;
            case 'waveform_karaoke': wordMotif = (activeWordIndex % 4 === 1) ? 'water_ripples' : 'sound_bars_vintage'; break;
            case 'pendulum_sway': wordMotif = 'sound_bars_vintage'; break;
            case 'prism_shimmer': wordMotif = 'starlight_glimmer'; break;
            case 'squash_bounce': wordMotif = (activeWordIndex % 4 === 1) ? 'equalizer_radial' : 'vinyl_grooves'; break;
            case '3d_block_stack': wordMotif = 'chrome_star'; break;
            case 'rolling_odometer': wordMotif = (activeWordIndex % 4 === 1) ? 'comic_burst' : 'vinyl_grooves'; break;
            case 'snake_slither': wordMotif = 'flame_tongue'; break;
            case 'dither_dissolve': wordMotif = (activeWordIndex % 4 === 1) ? 'rain_window' : 'starlight_glimmer'; break;
            case 'typewriter_ribbon': wordMotif = (activeWordIndex % 4 === 1) ? 'cassette_spool' : 'minimal_frame'; break;
            case 'inverted_badge': wordMotif = 'minimal_frame'; break;
            default: break;
          }
        }

        // If no background motif is active yet, check if word has a concrete semantic motif (e.g. moustache, sunglasses, car, cash, etc.)
        if (wordMotif === 'none') {
          const semanticMotif = classifyWordMotif(activeWord.word, moodProfile);
          if (semanticMotif && moodProfile.allowedMotifs.includes(semanticMotif)) {
            // Guard: do NOT assign semantic motif if it duplicates the active word micro-badge
            const duplicateMotifs = BADGE_TO_MOTIF_DUPLICATES[effectiveBadge];
            if (!duplicateMotifs || !duplicateMotifs.includes(semanticMotif)) {
              wordMotif = semanticMotif;
            }
          }
        }
      }

      // Hard suppression: If active badge matches active motif, suppress the duplicate background motif
      if (effectiveBadge !== 'none' && wordMotif !== 'none') {
        const duplicateMotifs = BADGE_TO_MOTIF_DUPLICATES[effectiveBadge];
        if (duplicateMotifs && duplicateMotifs.includes(wordMotif)) {
          wordMotif = 'none';
        }
      }

      // Resolve orthogonal text dressing
      const wordDressing = getWordEffectiveDressing(
        activeWord,
        activeWordIndex,
        effectiveArchetype,
        moodProfile,
        options.wordDressingOverrides
      );

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
      // When a micro-badge is active, reserve 14px headroom (maxH = 46) so the badge sits cleanly above the word without clipping
      const hasActiveBadge = effectiveBadge && effectiveBadge !== 'none';
      const layoutMaxH = hasActiveBadge ? 46 : 58;
      const layout = computeSafeTextLayout(activeWord.word, ctx, effectiveFont, 124, layoutMaxH);

      // Apply micro camera shake on heavy bass kicks / transients ONLY when enabled in mood profile
      ctx.save();
      if (moodProfile.cameraShakeEnabled && (audioFrame?.isBeat || (audioFrame && audioFrame.bass > 0.85))) {
        const punchAmp = audioFrame.isBeat ? (audioFrame.onsetStrength > 0.6 ? 2 : 1) : 1;
        const shakeX = (f % 2 === 0 ? 1 : -1) * punchAmp;
        const shakeY = (f % 3 === 0 ? -1 : 1) * punchAmp;
        ctx.translate(shakeX, shakeY);
      }

      // Render Archetype Frame with effective font, moodProfile, and text dressing
      renderArchetypeFrame(ctx, effectiveArchetype, activeWord.word, tau, layout, f, effectiveFont, audioFrame, moodProfile, wordDressing);

      // Render Word Micro-Sprite Badge (if active)
      if (hasActiveBadge) {
        const fontAscent = Math.round(layout.fontSize * 0.82);
        const textTop = Math.max(0, (layout.yOffsets[0] ?? 32) - fontAscent);
        const textBottom = (layout.yOffsets[layout.yOffsets.length - 1] ?? 32) + Math.round(layout.fontSize * 0.18);
        const badgeBounds = {
          centerX: 64,
          centerY: layout.yOffsets[0] ?? 32,
          top: textTop,
          bottom: textBottom,
          left: 0,
          right: 128,
          fontSize: layout.fontSize
        };
        renderWordBadge(ctx, effectiveBadge, badgeBounds, tau, f, audioFrame);
      }

      ctx.restore();

      // Dynamic 1-Bit Transition Choreography between consecutive words (legato phrasing)
      if (moodProfile.crossfadeOverlapMs > 0 && activeWordIndex > 0) {
        const prevWord = words[activeWordIndex - 1];
        const dtFromStart = currentMs - activeWord.startMs;
        const isCrossfadeActive = prevWord 
          && dtFromStart >= 0 
          && dtFromStart < moodProfile.crossfadeOverlapMs 
          && (activeWord.startMs - prevWord.endMs) <= 350;

        if (isCrossfadeActive) {
          const { ctx: tCtx } = getScratchCanvas();
          tCtx.clearRect(0, 0, 128, 64);
          tCtx.fillStyle = '#000000';
          tCtx.fillRect(0, 0, 128, 64);

          const prevArchetype = getWordEffectiveArchetype(
            prevWord,
            activeWordIndex - 1,
            archetype,
            wordOverrides,
            activeWordIndex > 1 ? words[activeWordIndex - 2] : undefined,
            moodProfile
          );
          const prevEffectiveArch = prevArchetype === 'auto_semantic' ? moodProfile.defaultArchetype : prevArchetype;
          const prevFont = getWordEffectiveFont(
            prevWord,
            prevEffectiveArch,
            activePackConfig,
            options.wordFontOverrides,
            fontFamily
          );
          const prevLayout = computeSafeTextLayout(prevWord.word, tCtx, prevFont);

          renderArchetypeFrame(
            tCtx,
            prevEffectiveArch,
            prevWord.word,
            1.0,
            prevLayout,
            f,
            prevFont,
            audioFrame,
            moodProfile
          );

          // Resolve dynamic transition choreography for this pair of words
          const transStyle = resolveTransitionStyle(
            prevWord,
            activeWord,
            activeWordIndex,
            prevEffectiveArch,
            effectiveArchetype,
            moodProfile,
            options.transitionStyle || 'auto',
            audioFrame
          );

          const crossfadeProgress = Math.max(0, Math.min(1, dtFromStart / moodProfile.crossfadeOverlapMs));
          // Smootherstep interpolation (zero initial velocity & zero landing shock)
          const u = crossfadeProgress < 0.5 
            ? 2 * crossfadeProgress * crossfadeProgress 
            : 1 - Math.pow(-2 * crossfadeProgress + 2, 2) / 2;

          const isRTLText = isWordRTL || isRTL(prevWord.word);

          // Compute directional offsets per transition style
          let dxPrev = 0;
          let dyPrev = 0;
          let dxActive = 0;
          let dyActive = 0;

          if (transStyle === 'lateral_glide') {
            const slideDist = 16;
            const exitDist = Math.round(u * slideDist);
            const enterDist = Math.round((1 - u) * slideDist);
            dxPrev = isRTLText ? exitDist : -exitDist;
            dxActive = isRTLText ? -enterDist : enterDist;
          } else if (transStyle === 'vertical_drift') {
            const driftDist = 8;
            dyPrev = -Math.round(u * driftDist);
            dyActive = Math.round((1 - u) * driftDist);
          } else if (transStyle === 'bayer_sweep') {
            // Subtle horizontal breathing during sweep
            dxPrev = isRTLText ? Math.round(u * 4) : -Math.round(u * 4);
            dxActive = isRTLText ? -Math.round((1 - u) * 4) : Math.round((1 - u) * 4);
          } else if (transStyle === 'curtain_drop') {
            // Subtle vertical shift during drop
            dyPrev = -Math.round(u * 3);
            dyActive = Math.round((1 - u) * 3);
          }

          const activeImg = ctx.getImageData(0, 0, 128, 64);
          const prevImg = tCtx.getImageData(0, 0, 128, 64);
          const aData = activeImg.data;
          const pData = prevImg.data;

          // Reusable scratch buffer to prevent in-place sampling overwrite
          if (!cachedTransitionBuffer || cachedTransitionBuffer.length !== 128 * 64 * 4) {
            cachedTransitionBuffer = new Uint8ClampedArray(128 * 64 * 4);
          }
          cachedTransitionBuffer.set(aData);

          const sweepBandX = 24;
          const sweepTravelX = 128 + sweepBandX;
          const sweepCenterX = isRTLText 
            ? Math.round((1 - crossfadeProgress) * sweepTravelX - sweepBandX / 2)
            : Math.round(crossfadeProgress * sweepTravelX - sweepBandX / 2);

          const sweepBandY = 16;
          const sweepTravelY = 64 + sweepBandY;
          const sweepCenterY = Math.round(crossfadeProgress * sweepTravelY - sweepBandY / 2);

          for (let y = 0; y < 64; y++) {
            const rowOffset = y * 128;
            const bayerRow = BAYER_4X4[y % 4];

            for (let x = 0; x < 128; x++) {
              const idx = (rowOffset + x) * 4;

              // Sample previous word pixel with (dxPrev, dyPrev)
              const srcPx = x - dxPrev;
              const srcPy = y - dyPrev;
              let pVal = 0;
              if (srcPx >= 0 && srcPx < 128 && srcPy >= 0 && srcPy < 64) {
                pVal = pData[(srcPy * 128 + srcPx) * 4];
              }

              // Sample active word pixel with (dxActive, dyActive)
              const srcAx = x - dxActive;
              const srcAy = y - dyActive;
              let aVal = 0;
              if (srcAx >= 0 && srcAx < 128 && srcAy >= 0 && srcAy < 64) {
                aVal = cachedTransitionBuffer[(srcAy * 128 + srcAx) * 4];
              }

              let showPrev = false;
              const threshold = bayerRow[x % 4] / 16;
              let finalVal = 0;

              if (transStyle === 'razor_slice') {
                // Diagonal split razor cut: y = 32 + (x - 64) * 0.35
                const seamY = 32 + (x - 64) * 0.35;
                const isTopHalf = y < seamY;
                const isSlashLine = Math.abs(y - seamY) <= 1.5 && crossfadeProgress >= 0.15 && crossfadeProgress <= 0.85;

                if (isSlashLine) {
                  finalVal = 255; // Razor slash flash cut line
                } else {
                  const splitShift = Math.round((1 - u) * 20);
                  const shiftX = isTopHalf ? -splitShift : splitShift;
                  if (u < 0.5) {
                    const srcPxShift = x - shiftX;
                    finalVal = (srcPxShift >= 0 && srcPxShift < 128) ? pData[(y * 128 + srcPxShift) * 4] : 0;
                  } else {
                    const inShift = Math.round(u * 4);
                    const srcAxShift = isTopHalf ? x + (4 - inShift) : x - (4 - inShift);
                    finalVal = (srcAxShift >= 0 && srcAxShift < 128) ? cachedTransitionBuffer[(y * 128 + srcAxShift) * 4] : 0;
                  }
                }
              } else if (transStyle === 'glitch_tear') {
                // Cyberpunk horizontal scanline row tearing
                const sliceIdx = Math.floor(y / 8);
                const pseudoRand = ((sliceIdx * 17 + f * 23) % 19) - 9;
                const shiftX = Math.round(pseudoRand * (1 - u) * 1.5);

                if (u < 0.5) {
                  const srcPxShift = x - shiftX;
                  finalVal = (srcPxShift >= 0 && srcPxShift < 128) ? pData[(y * 128 + srcPxShift) * 4] : 0;
                } else {
                  const srcAxShift = x + Math.round(shiftX * 0.4);
                  finalVal = (srcAxShift >= 0 && srcAxShift < 128) ? cachedTransitionBuffer[(y * 128 + srcAxShift) * 4] : 0;
                }
                if (threshold < (1 - u) * 0.35 && (x + y) % 3 === 0) {
                  finalVal = finalVal > 120 ? 0 : 255;
                }
              } else if (transStyle === 'impact_flash') {
                // High-velocity snap with 1-frame negative inversion punch
                if (crossfadeProgress >= 0.42 && crossfadeProgress <= 0.58) {
                  const rawVal = pVal > 120 ? pVal : aVal;
                  finalVal = rawVal > 120 ? 0 : 255;
                } else if (u < 0.45) {
                  finalVal = pVal;
                } else {
                  finalVal = aVal;
                }
              } else if (transStyle === 'bayer_sweep') {
                const distFromFront = isRTLText ? (sweepCenterX - x) : (x - sweepCenterX);
                if (distFromFront > sweepBandX / 2) {
                  showPrev = true;
                } else if (distFromFront < -sweepBandX / 2) {
                  showPrev = false;
                } else {
                  const localProg = (distFromFront + sweepBandX / 2) / sweepBandX;
                  showPrev = threshold < localProg;
                }
                finalVal = showPrev ? pVal : aVal;
              } else if (transStyle === 'curtain_drop') {
                const distFromFrontY = y - sweepCenterY;
                if (distFromFrontY > sweepBandY / 2) {
                  showPrev = true;
                } else if (distFromFrontY < -sweepBandY / 2) {
                  showPrev = false;
                } else {
                  const localProgY = (distFromFrontY + sweepBandY / 2) / sweepBandY;
                  showPrev = threshold < localProgY;
                }
                finalVal = showPrev ? pVal : aVal;
              } else {
                // lateral_glide, vertical_drift, dither_dissolve
                showPrev = threshold >= crossfadeProgress;
                finalVal = showPrev ? pVal : aVal;
              }
              aData[idx] = finalVal;
              aData[idx + 1] = finalVal;
              aData[idx + 2] = finalVal;
              aData[idx + 3] = 255;
            }
          }

          ctx.putImageData(activeImg, 0, 0);
        }
      }

      // Soft tail exit dissolve into rest state
      if (isTailFade) {
        const img = ctx.getImageData(0, 0, 128, 64);
        const data = img.data;
        for (let y = 0; y < 64; y++) {
          const rowOffset = y * 128;
          const bayerRow = BAYER_4X4[y % 4];
          for (let x = 0; x < 128; x++) {
            const idx = (rowOffset + x) * 4;
            const threshold = bayerRow[x % 4] / 16;
            if (threshold < tailFadeProgress) {
              data[idx] = 0;
              data[idx + 1] = 0;
              data[idx + 2] = 0;
              data[idx + 3] = 255;
            }
          }
        }
        ctx.putImageData(img, 0, 0);
      }
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
