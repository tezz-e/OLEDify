import { MotionArchetype, TextLayoutResult, TextDressing } from './types';
import { AudioFrameData } from './audioAnalysisEngine';
import { isRTL, getGraphemes } from './scriptDetector';
import { SongMoodProfile } from './moodProfileEngine';

// Active text dressing controller for orthogonal typographic styling
let activeDressingMode: TextDressing | undefined = undefined;

export function setActiveDressing(dressing?: TextDressing) {
  activeDressingMode = dressing;
}

// Pooled scratch canvas to eliminate per-frame GC allocations
let cachedScratchCanvas: OffscreenCanvas | HTMLCanvasElement | null = null;
let cachedScratchCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;

export function getScratchCanvas(): { canvas: OffscreenCanvas | HTMLCanvasElement; ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D } {
  if (!cachedScratchCanvas || !cachedScratchCtx) {
    if (typeof OffscreenCanvas !== 'undefined') {
      cachedScratchCanvas = new OffscreenCanvas(128, 64);
      cachedScratchCtx = cachedScratchCanvas.getContext('2d')!;
    } else if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      cachedScratchCanvas = document.createElement('canvas');
      cachedScratchCanvas.width = 128;
      cachedScratchCanvas.height = 64;
      cachedScratchCtx = cachedScratchCanvas.getContext('2d')!;
    } else {
      const mockCtx: any = {
        fillRect: () => {},
        strokeRect: () => {},
        rect: () => {},
        clip: () => {},
        arc: () => {},
        ellipse: () => {},
        fillText: () => {},
        strokeText: () => {},
        beginPath: () => {},
        closePath: () => {},
        arcTo: () => {},
        quadraticCurveTo: () => {},
        bezierCurveTo: () => {},
        roundRect: () => {},
        moveTo: () => {},
        lineTo: () => {},
        stroke: () => {},
        fill: () => {},
        clearRect: () => {},
        getImageData: () => ({ data: new Uint8ClampedArray(128 * 64 * 4) }),
        putImageData: () => {},
        drawImage: () => {},
        measureText: (text: string) => ({ width: text.length * 8 }),
        save: () => {},
        restore: () => {},
        translate: () => {},
        rotate: () => {},
        scale: () => {},
        font: '',
        fillStyle: '',
        strokeStyle: '',
        textAlign: 'center',
        textBaseline: 'middle',
        lineWidth: 1
      };
      return { canvas: {} as any, ctx: mockCtx };
    }
  }
  return { canvas: cachedScratchCanvas, ctx: cachedScratchCtx };
}

/**
 * Returns safe font specification for Canvas 2D without artificial bold dilation on display fonts.
 */
export function getSafeFontSpec(fontSize: number, fontFamily: string): string {
  const isDisplayHeavy = /molot|wilhelm|lemon milk|bangers|super comic|kraash|plumpfull|wicked mouse|cinzel/i.test(fontFamily);
  return isDisplayHeavy ? `${fontSize}px ${fontFamily}` : `bold ${fontSize}px ${fontFamily}`;
}

/**
 * Draws text with guaranteed inter-character spacing and 1-bit counter preservation.
 * Prevents adjacent glyphs from bridging together during binary thresholding.
 */
export function drawTrackedText(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  text: string,
  centerX: number,
  y: number,
  letterSpacing: number = 0,
  isStroke: boolean = false
) {
  ctx.textBaseline = 'middle';
  const effectiveStroke = isStroke || activeDressingMode === 'hollow_wireframe';
  if (activeDressingMode === 'hollow_wireframe' && !isStroke) {
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
  }

  // 1-Bit Glyph Knockout Halo:
  // When filling white text over background motifs, stroke a 2.5px solid black halo first to cleanly
  // decouple letter strokes from any underlying background motif vectors (barbed wire, shards, speedlines).
  if (!effectiveStroke && ctx.fillStyle === '#FFFFFF') {
    ctx.save();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.5;

    if (letterSpacing <= 0 || !text || text.length <= 1) {
      if (typeof ctx.strokeText === 'function') ctx.strokeText(text, centerX, y);
    } else {
      const graphemes = getGraphemes(text);
      const rtl = ctx.direction === 'rtl';
      const widths = graphemes.map(g => ctx.measureText(g).width);
      const totalW = widths.reduce((sum, w) => sum + w, 0) + (graphemes.length - 1) * letterSpacing;
      let haloX = rtl ? (centerX + totalW / 2) : (centerX - totalW / 2);
      const prevAlign = ctx.textAlign;
      ctx.textAlign = rtl ? 'right' : 'left';
      if (typeof ctx.strokeText === 'function') {
        for (let i = 0; i < graphemes.length; i++) {
          ctx.strokeText(graphemes[i], haloX, y);
          haloX += (rtl ? -1 : 1) * (widths[i] + letterSpacing);
        }
      }
      ctx.textAlign = prevAlign;
    }
    ctx.restore();
  }

  if (letterSpacing <= 0 || !text || text.length <= 1) {
    if (effectiveStroke) ctx.strokeText(text, centerX, y);
    else ctx.fillText(text, centerX, y);
    return;
  }

  const graphemes = getGraphemes(text);
  const rtl = ctx.direction === 'rtl';

  const widths = graphemes.map(g => ctx.measureText(g).width);
  const totalW = widths.reduce((sum, w) => sum + w, 0) + (graphemes.length - 1) * letterSpacing;

  let curX = rtl ? (centerX + totalW / 2) : (centerX - totalW / 2);
  const prevAlign = ctx.textAlign;
  ctx.textAlign = rtl ? 'right' : 'left';

  for (let i = 0; i < graphemes.length; i++) {
    const char = graphemes[i];
    const w = widths[i];
    if (effectiveStroke) {
      ctx.strokeText(char, curX, y);
    } else {
      ctx.fillText(char, curX, y);
    }
    if (rtl) {
      curX -= (w + letterSpacing);
    } else {
      curX += (w + letterSpacing);
    }
  }

  ctx.textAlign = prevAlign;
}

/**
 * Dispatches frame rendering to the selected motion archetype.
 * ctx: OffscreenCanvas 2D context (128x64)
 * tau: Normalized temporal progress of active word/line [0..1]
 * audioFrame: Optional real-time audio telemetry (RMS, bass transients, beats)
 */
export function renderArchetypeFrame(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  archetype: MotionArchetype,
  text: string,
  tau: number,
  layout: TextLayoutResult,
  frameIndex: number,
  fontFamily: string = '"IBM Plex Mono", monospace',
  audioFrame?: AudioFrameData,
  moodProfile?: SongMoodProfile | null,
  dressing?: TextDressing
) {
  const rtl = isRTL(text);
  ctx.direction = rtl ? 'rtl' : 'ltr';

  setActiveDressing(dressing);

  switch (archetype) {
    case 'blade_slash':
      renderBladeSlash(ctx, text, tau, layout, frameIndex, fontFamily, audioFrame);
      break;
    case 'manga_impact':
      renderMangaImpact(ctx, text, tau, layout, frameIndex, fontFamily, audioFrame);
      break;
    case 'cyber_glitch':
      renderCyberGlitch(ctx, text, tau, layout, frameIndex, fontFamily, audioFrame);
      break;
    case 'smooth_fluid':
      renderSmoothFluid(ctx, text, tau, layout, frameIndex, fontFamily, audioFrame, moodProfile);
      break;
    case '3d_block_stack':
      render3DBlockStack(ctx, text, tau, layout, frameIndex, fontFamily, audioFrame);
      break;
    case 'echo_stack':
      renderEchoStack(ctx, text, tau, layout, frameIndex, fontFamily, audioFrame);
      break;
    case 'target_focus':
      renderTargetFocus(ctx, text, tau, layout, frameIndex, fontFamily, audioFrame);
      break;
    case 'snake_slither':
      renderSnakeSlither(ctx, text, tau, layout, frameIndex, fontFamily, audioFrame);
      break;
    case 'wiggly_boil':
      renderWigglyBoil(ctx, text, tau, layout, frameIndex, fontFamily, audioFrame);
      break;
    case 'inverted_badge':
      renderInvertedBadge(ctx, text, tau, layout, frameIndex, fontFamily, audioFrame);
      break;
    case 'rolling_odometer':
      renderRollingOdometer(ctx, text, tau, layout, frameIndex, fontFamily, audioFrame);
      break;
    case 'gentle_float':
      renderGentleFloat(ctx, text, tau, layout, frameIndex, fontFamily, audioFrame, moodProfile);
      break;
    case 'dither_dissolve':
      renderDitherDissolve(ctx, text, tau, layout, frameIndex, fontFamily, audioFrame);
      break;
    case 'typewriter_ribbon':
      renderTypewriterRibbon(ctx, text, tau, layout, frameIndex, fontFamily, audioFrame);
      break;
    case 'waveform_karaoke':
      renderWaveformKaraoke(ctx, text, tau, layout, frameIndex, fontFamily, audioFrame);
      break;
    case 'anvil_stomp':
      renderAnvilStomp(ctx, text, tau, layout, frameIndex, fontFamily, audioFrame);
      break;
    case 'fracture_shatter':
      renderFractureShatter(ctx, text, tau, layout, frameIndex, fontFamily, audioFrame);
      break;
    case 'pendulum_sway':
      renderPendulumSway(ctx, text, tau, layout, frameIndex, fontFamily, audioFrame);
      break;
    case 'prism_shimmer':
      renderPrismShimmer(ctx, text, tau, layout, frameIndex, fontFamily, audioFrame);
      break;
    case 'squash_bounce':
      renderSquashBounce(ctx, text, tau, layout, frameIndex, fontFamily, audioFrame);
      break;
    default:
      renderSmoothFluid(ctx, text, tau, layout, frameIndex, fontFamily, audioFrame, moodProfile);
      break;
  }

  if (dressing && dressing !== 'solid' && dressing !== 'hollow_wireframe') {
    applyTextDressing(ctx, dressing, layout, text, frameIndex);
  }

  setActiveDressing(undefined);
}

/**
 * 1. BLADE SLASH: Horizontal split halves sliding apart with diagonal razor line
 */
function renderBladeSlash(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  text: string,
  tau: number,
  layout: TextLayoutResult,
  frameIndex: number,
  fontFamily: string,
  audioFrame?: AudioFrameData
) {
  const rtl = isRTL(text);
  const { canvas: tempCanvas, ctx: tCtx } = getScratchCanvas();

  tCtx.clearRect(0, 0, 128, 64);
  tCtx.direction = rtl ? 'rtl' : 'ltr';
  tCtx.font = getSafeFontSpec(layout.fontSize, fontFamily);
  tCtx.textAlign = 'center';
  tCtx.strokeStyle = '#000000';
  tCtx.lineWidth = 2;
  tCtx.lineJoin = 'miter';
  tCtx.miterLimit = 2;

  for (let i = 0; i < layout.lines.length; i++) {
    drawTrackedText(tCtx, layout.lines[i], 64, layout.yOffsets[i], layout.letterSpacing, true);
  }

  tCtx.fillStyle = '#FFFFFF';
  for (let i = 0; i < layout.lines.length; i++) {
    drawTrackedText(tCtx, layout.lines[i], 64, layout.yOffsets[i], layout.letterSpacing, false);
  }

  const midY = 32;
  const ease = Math.min(1, tau / 0.25);
  // Audio flux or beat adds extra kick to the split
  const audioKick = audioFrame ? (audioFrame.isBeat ? 6 : audioFrame.flux * 4) : 0;
  const shift = Math.round((1 - ease) * 18 + audioKick);

  // Invert horizontal split sliding when RTL is active
  const topShift = rtl ? shift : -shift;
  const bottomShift = rtl ? -shift : shift;

  // Upper half shifted
  ctx.drawImage(tempCanvas, 0, 0, 128, midY, topShift, 0, 128, midY);

  // Lower half shifted
  ctx.drawImage(tempCanvas, 0, midY, 128, 64 - midY, bottomShift, midY, 128, 64 - midY);

  // Diagonal razor slash line during initial 30% of duration or on beat onset
  if (tau < 0.3 || audioFrame?.isBeat) {
    const p = tau < 0.3 ? tau / 0.3 : 1.0;
    const xDist = Math.floor(p * 128);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = audioFrame?.isBeat ? 3 : 2;
    ctx.beginPath();
    if (rtl) {
      // In RTL, slash sweeps from right to left
      ctx.moveTo(128, midY + 4);
      ctx.lineTo(128 - xDist, midY - 4);
    } else {
      // In LTR, slash sweeps from left to right
      ctx.moveTo(0, midY + 4);
      ctx.lineTo(xDist, midY - 4);
    }
    ctx.stroke();
  }
}

/**
 * 2. MANGA IMPACT: Elastic zoom snap, radial speedlines, 1-frame inversion flash
 */
function renderMangaImpact(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  text: string,
  tau: number,
  layout: TextLayoutResult,
  frameIndex: number,
  fontFamily: string,
  audioFrame?: AudioFrameData
) {
  const baseScale = tau < 0.25 
    ? 1.0 + 1.2 * Math.pow(1 - tau / 0.25, 3) * Math.cos(tau * 4 * Math.PI)
    : 1.0 + Math.sin((tau - 0.25) * Math.PI * 2) * 0.03;

  // Audio bass punch boosts zoom scale
  const bassPunch = audioFrame ? (audioFrame.isBeat ? 0.35 : audioFrame.bass * 0.2) : 0;
  const scale = baseScale + bassPunch;

  ctx.save();
  ctx.translate(64, 32);
  ctx.scale(scale, scale);
  ctx.translate(-64, -32);

  // Speedlines trigger during entry or on any drum hit
  if (tau < 0.35 || audioFrame?.isBeat || (audioFrame && audioFrame.bass > 0.7)) {
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    const numRays = audioFrame?.isBeat ? 24 : 16;
    for (let r = 0; r < numRays; r++) {
      const angle = (r / numRays) * Math.PI * 2 + (frameIndex % 3) * 0.1;
      const innerR = 38 + (frameIndex % 4) * 4;
      const outerR = 95;
      ctx.beginPath();
      ctx.moveTo(64 + Math.cos(angle) * innerR, 32 + Math.sin(angle) * innerR);
      ctx.lineTo(64 + Math.cos(angle) * outerR, 32 + Math.sin(angle) * outerR);
      ctx.stroke();
    }
  }

  ctx.font = getSafeFontSpec(layout.fontSize, fontFamily);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#000000';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;

  for (let i = 0; i < layout.lines.length; i++) {
    const line = layout.lines[i];
    const y = layout.yOffsets[i];
    drawTrackedText(ctx, line, 64 + 1, y + 1, layout.letterSpacing, true);
  }

  ctx.fillStyle = '#FFFFFF';
  for (let i = 0; i < layout.lines.length; i++) {
    const line = layout.lines[i];
    const y = layout.yOffsets[i];
    drawTrackedText(ctx, line, 64, y, layout.letterSpacing, false);
  }

  ctx.restore();

  // Inversion flash on impact or massive drum drop
  const shouldInvert = (tau >= 0.12 && tau <= 0.15) || (audioFrame?.isBeat && audioFrame.onsetStrength > 0.75);
  if (shouldInvert) {
    ctx.fillStyle = '#FFFFFF';
    ctx.globalCompositeOperation = 'difference';
    ctx.fillRect(0, 0, 128, 64);
    ctx.globalCompositeOperation = 'source-over';
  }
}

/**
 * 3. CYBER GLITCH: Bitwise XOR row tearing, ASCII scramble before lock
 */
function renderCyberGlitch(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  text: string,
  tau: number,
  layout: TextLayoutResult,
  frameIndex: number,
  fontFamily: string,
  audioFrame?: AudioFrameData
) {
  const rtl = isRTL(text);
  ctx.direction = rtl ? 'rtl' : 'ltr';
  ctx.font = getSafeFontSpec(layout.fontSize, fontFamily);
  ctx.textAlign = 'center';

  const isGlitchBurst = (tau < 0.2) || (audioFrame && audioFrame.flux > 0.5) || audioFrame?.isBeat;
  const glitchChars = '01X$#%_~<>';

  // Arabic cursive ligatures rule: do NOT replace characters with ASCII in Arabic (which breaks cursive ligatures).
  // Non-Arabic: use grapheme cluster segmentation so combining vowel marks in Devanagari, Gurmukhi, Tamil, and Thai
  // are never severed from base consonants.
  const displayLines = layout.lines.map(line => {
    if (rtl) {
      return line; // Preserve cursive ligatures
    }
    if (isGlitchBurst) {
      const clusters = getGraphemes(line);
      return clusters.map(cluster => {
        if (cluster === ' ' || cluster === '-') return cluster;
        return Math.random() > 0.35 ? glitchChars[Math.floor(Math.random() * glitchChars.length)] : cluster;
      }).join('');
    }
    return line;
  });

  const jitterAmp = audioFrame?.isBeat ? 6 : (audioFrame ? Math.round(audioFrame.flux * 4) : 0);
  const jitterX = (tau < 0.3 || frameIndex % 8 === 0 || audioFrame?.isBeat) 
    ? ((frameIndex * 17) % 7) - 3 + (Math.random() > 0.5 ? jitterAmp : -jitterAmp) 
    : 0;

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'miter';
  ctx.miterLimit = 2;
  for (let i = 0; i < displayLines.length; i++) {
    drawTrackedText(ctx, displayLines[i], 64 + jitterX, layout.yOffsets[i], layout.letterSpacing, true);
  }

  ctx.fillStyle = '#FFFFFF';
  for (let i = 0; i < displayLines.length; i++) {
    drawTrackedText(ctx, displayLines[i], 64 + jitterX, layout.yOffsets[i], layout.letterSpacing, false);
  }

  // Row tearing: for Arabic during burst or normal glitch frames, horizontal slice row tearing provides the glitch aesthetic
  if (tau < 0.35 || frameIndex % 6 === 0 || audioFrame?.isBeat || (rtl && isGlitchBurst)) {
    const numSlices = (rtl && isGlitchBurst) ? 3 : 1;
    for (let s = 0; s < numSlices; s++) {
      const sliceY = ((frameIndex * 13 + s * 17) % 48) + 8;
      const sliceH = 4 + ((frameIndex + s) % 5) + (audioFrame?.isBeat ? 4 : 0);
      const baseShift = ((frameIndex * 7 + s * 11) % 11) - 5 + (audioFrame?.isBeat ? (frameIndex % 2 === 0 ? 8 : -8) : 0);
      const sliceShift = rtl ? -baseShift : baseShift;

      const slice = ctx.getImageData(0, sliceY, 128, sliceH);
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, sliceY, 128, sliceH);
      ctx.putImageData(slice, sliceShift, sliceY);
    }
  }

  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;
  ctx.strokeRect(4, 4, 6, 6);
  ctx.strokeRect(118, 54, 6, 6);
}

/**
 * 4. SMOOTH FLUID: Cubic glide, 1-bit Bayer motion trail, harmonic idle bob
 */
function renderSmoothFluid(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  text: string,
  tau: number,
  layout: TextLayoutResult,
  frameIndex: number,
  fontFamily: string,
  audioFrame?: AudioFrameData,
  moodProfile?: SongMoodProfile | null
) {
  const isGentleMode = moodProfile?.vibe === 'ballad_acoustic' || moodProfile?.vibe === 'chill_pop';
  const maxDisplacement = moodProfile ? moodProfile.maxEntryDisplacementPx : 18;
  const easeProgress = Math.min(1, tau / 0.35);

  // In gentle mode: smooth C1/C2 cubic ease with zero initial velocity (no starting whiplash/kick)
  // In hype mode: punchy ease-out
  const slideProgress = isGentleMode
    ? (easeProgress < 0.5 ? 4 * easeProgress * easeProgress * easeProgress : 1 - Math.pow(-2 * easeProgress + 2, 3) / 2)
    : (1 - Math.pow(1 - easeProgress, 3));
  const startYOffset = Math.round(maxDisplacement * (1 - slideProgress));

  // Audio energy modulates the idle floating bob gently
  const audioBob = audioFrame ? (isGentleMode ? audioFrame.bass * 0.8 : audioFrame.bass * 2.5) : 0;
  const idleBob = tau > 0.35 
    ? (Math.sin((tau - 0.35) * Math.PI * (isGentleMode ? 2 : 4)) * (isGentleMode ? 0.8 : 1.5) - audioBob) 
    : 0;
  const currentY = startYOffset + idleBob;

  ctx.font = getSafeFontSpec(layout.fontSize, fontFamily);
  ctx.textAlign = 'center';

  // Only draw motion trail duplicate in hype mode (omitted in gentle mode to prevent double-image jitter)
  if (!isGentleMode && tau < 0.25) {
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    for (let i = 0; i < layout.lines.length; i++) {
      const y = layout.yOffsets[i] + currentY + 3;
      drawTrackedText(ctx, layout.lines[i], 64, y, layout.letterSpacing, true);
    }
    ctx.fillStyle = '#FFFFFF';
    for (let i = 0; i < layout.lines.length; i++) {
      const y = layout.yOffsets[i] + currentY + 3;
      drawTrackedText(ctx, layout.lines[i], 64, y, layout.letterSpacing, false);
    }
  }

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'miter';
  ctx.miterLimit = 2;
  for (let i = 0; i < layout.lines.length; i++) {
    const line = layout.lines[i];
    const y = layout.yOffsets[i] + currentY;
    drawTrackedText(ctx, line, 64, y, layout.letterSpacing, true);
  }

  ctx.fillStyle = '#FFFFFF';
  for (let i = 0; i < layout.lines.length; i++) {
    const line = layout.lines[i];
    const y = layout.yOffsets[i] + currentY;
    drawTrackedText(ctx, line, 64, y, layout.letterSpacing, false);

    if (i === layout.lines.length - 1) {
      const metrics = ctx.measureText(line);
      const baseWidth = metrics.width + 6;
      const energyPulse = audioFrame ? (isGentleMode ? audioFrame.rms * 4 : audioFrame.rms * 12) : 0;
      const pillWidth = Math.min(120, Math.min(baseWidth + energyPulse, (baseWidth + energyPulse) * Math.min(1, tau / 0.4)));
      const pillHeight = isGentleMode ? 1 : 2;
      ctx.fillRect(Math.floor(64 - pillWidth / 2), Math.min(61, Math.floor(y + 3)), Math.floor(pillWidth), pillHeight);
    }
  }
}

/**
 * 5. 3D BLOCK STACK: Isometric extrusion with clean 1-bit shadow (no blurred smearing)
 */
function render3DBlockStack(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  text: string,
  tau: number,
  layout: TextLayoutResult,
  frameIndex: number,
  fontFamily: string,
  audioFrame?: AudioFrameData
) {
  let dropY = 0;
  let scaleY = 1.0;
  let scaleX = 1.0;

  if (tau < 0.25) {
    const p = tau / 0.25;
    dropY = (1 - p * p) * -24;
  } else if (tau < 0.35) {
    const p = (tau - 0.25) / 0.1;
    scaleY = 1.0 - Math.sin(p * Math.PI) * 0.25;
    scaleX = 1.0 + Math.sin(p * Math.PI) * 0.15;
  }

  // Audio bass bounce on 808s / kick drums
  if (audioFrame?.isBeat) {
    scaleY *= 1.15;
    scaleX *= 0.92;
  }

  ctx.save();
  ctx.translate(64, 32);
  ctx.scale(scaleX, scaleY);
  ctx.translate(-64, -32);

  ctx.font = getSafeFontSpec(layout.fontSize, fontFamily);
  ctx.textAlign = 'center';

  // Crisp 1-bit drop shadow offset (clean single offset, never 4 blurred smearing layers!)
  const shadowOffset = audioFrame?.isBeat ? 3 : 2;
  ctx.fillStyle = '#FFFFFF';
  for (let i = 0; i < layout.lines.length; i++) {
    drawTrackedText(ctx, layout.lines[i], 64 + shadowOffset, layout.yOffsets[i] + dropY + shadowOffset, layout.letterSpacing, false);
  }

  // Black separation outline around front text to preserve inner apertures and counters
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  for (let i = 0; i < layout.lines.length; i++) {
    drawTrackedText(ctx, layout.lines[i], 64, layout.yOffsets[i] + dropY, layout.letterSpacing, true);
  }

  // Crisp front text
  ctx.fillStyle = '#FFFFFF';
  for (let i = 0; i < layout.lines.length; i++) {
    drawTrackedText(ctx, layout.lines[i], 64, layout.yOffsets[i] + dropY, layout.letterSpacing, false);
  }

  ctx.restore();
}

/**
 * 6. ECHO STACK: Multi-layer expanding outline echoes radiating outward
 */
function renderEchoStack(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  text: string,
  tau: number,
  layout: TextLayoutResult,
  frameIndex: number,
  fontFamily: string,
  audioFrame?: AudioFrameData
) {
  ctx.font = getSafeFontSpec(layout.fontSize, fontFamily);
  ctx.textAlign = 'center';

  const pulseMultiplier = audioFrame ? 1.0 + audioFrame.rms * 0.8 : 1.0;
  const pulseR = Math.floor(((frameIndex * 2) % 24) * pulseMultiplier);

  // Concentric expanding outline frames
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;
  for (let i = 0; i < layout.lines.length; i++) {
    const line = layout.lines[i];
    const y = layout.yOffsets[i];

    if (tau > 0.2 || audioFrame?.isBeat) {
      // Offset echo echoes
      drawTrackedText(ctx, line, 64 - pulseR / 3, y - pulseR / 4, layout.letterSpacing, true);
      drawTrackedText(ctx, line, 64 + pulseR / 3, y + pulseR / 4, layout.letterSpacing, true);
      if (audioFrame?.isBeat) {
        drawTrackedText(ctx, line, 64, y - pulseR / 2, layout.letterSpacing, true);
      }
    }

    // Main text
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    drawTrackedText(ctx, line, 64, y, layout.letterSpacing, true);
    ctx.fillStyle = '#FFFFFF';
    drawTrackedText(ctx, line, 64, y, layout.letterSpacing, false);
  }
}

/**
 * 7. TARGET FOCUS: HUD Crosshairs locking and zooming onto the word
 */
function renderTargetFocus(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  text: string,
  tau: number,
  layout: TextLayoutResult,
  frameIndex: number,
  fontFamily: string,
  audioFrame?: AudioFrameData
) {
  const ease = Math.min(1, tau / 0.25);
  const beatSnap = audioFrame?.isBeat ? 0.15 : 0;
  const scale = 1.8 - 0.8 * ease + Math.sin(tau * Math.PI) * 0.05 + beatSnap;

  ctx.save();
  ctx.translate(64, 32);
  ctx.scale(scale, scale);
  ctx.translate(-64, -32);

  ctx.font = getSafeFontSpec(layout.fontSize, fontFamily);
  ctx.textAlign = 'center';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'miter';
  ctx.miterLimit = 2;
  for (let i = 0; i < layout.lines.length; i++) {
    drawTrackedText(ctx, layout.lines[i], 64, layout.yOffsets[i], layout.letterSpacing, true);
  }

  ctx.fillStyle = '#FFFFFF';
  for (let i = 0; i < layout.lines.length; i++) {
    drawTrackedText(ctx, layout.lines[i], 64, layout.yOffsets[i], layout.letterSpacing, false);
  }

  ctx.restore();

  // Target crosshair brackets framing the display
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = audioFrame?.isBeat ? 2 : 1;
  const chLen = 8 + (audioFrame ? Math.round(audioFrame.bass * 4) : 0);
  ctx.beginPath();
  // Left crosshair
  ctx.moveTo(6, 32); ctx.lineTo(6 + chLen, 32);
  // Right crosshair
  ctx.moveTo(122, 32); ctx.lineTo(122 - chLen, 32);
  // Top crosshair
  ctx.moveTo(64, 6); ctx.lineTo(64, 6 + chLen);
  // Bottom crosshair
  ctx.moveTo(64, 58); ctx.lineTo(64, 58 - chLen);
  ctx.stroke();
}

/**
 * 8. SNAKE SLITHER: Undulating sinusoidal wave displacement
 */
function renderSnakeSlither(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  text: string,
  tau: number,
  layout: TextLayoutResult,
  frameIndex: number,
  fontFamily: string,
  audioFrame?: AudioFrameData
) {
  const { canvas: tempCanvas, ctx: tCtx } = getScratchCanvas();

  tCtx.clearRect(0, 0, 128, 64);
  tCtx.direction = isRTL(text) ? 'rtl' : 'ltr';
  tCtx.font = getSafeFontSpec(layout.fontSize, fontFamily);
  tCtx.textAlign = 'center';
  tCtx.strokeStyle = '#000000';
  tCtx.lineWidth = 2;
  tCtx.lineJoin = 'miter';
  tCtx.miterLimit = 2;

  for (let i = 0; i < layout.lines.length; i++) {
    drawTrackedText(tCtx, layout.lines[i], 64, layout.yOffsets[i], layout.letterSpacing, true);
  }

  tCtx.fillStyle = '#FFFFFF';
  for (let i = 0; i < layout.lines.length; i++) {
    drawTrackedText(tCtx, layout.lines[i], 64, layout.yOffsets[i], layout.letterSpacing, false);
  }

  // Slice fine vertical strips and apply a smooth, continuous traveling S-curve wave
  const stripWidth = 2;
  const numStrips = Math.ceil(128 / stripWidth);
  const waveAmp = 1.5 + (audioFrame ? audioFrame.bass * 1.0 : 0);

  for (let s = 0; s < numStrips; s++) {
    const sx = s * stripWidth;
    const waveY = Math.round(Math.sin((sx / 128) * Math.PI * 2.2 + tau * 2.5 * Math.PI) * waveAmp);
    ctx.drawImage(tempCanvas, sx, 0, stripWidth, 64, sx, waveY, stripWidth, 64);
  }
}

/**
 * 9. WIGGLY BOIL: 3-phase line boil running at 12 FPS decoupled from 30 FPS clock
 */
function renderWigglyBoil(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  text: string,
  tau: number,
  layout: TextLayoutResult,
  frameIndex: number,
  fontFamily: string,
  audioFrame?: AudioFrameData
) {
  ctx.font = getSafeFontSpec(layout.fontSize, fontFamily);
  ctx.textAlign = 'center';

  const boilSpeed = audioFrame && audioFrame.rms > 0.5 ? 1.8 : 2.5;
  const boilPhase = Math.floor(frameIndex / boilSpeed) % 3;
  const offsetsX = [-1, 1, 0];
  const offsetsY = [0, -1, 1];

  const dx = offsetsX[boilPhase] * (audioFrame?.isBeat ? 2 : 1);
  const dy = offsetsY[boilPhase] * (audioFrame?.isBeat ? 2 : 1);

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'miter';
  ctx.miterLimit = 2;
  for (let i = 0; i < layout.lines.length; i++) {
    drawTrackedText(ctx, layout.lines[i], 64 + dx, layout.yOffsets[i] + dy, layout.letterSpacing, true);
  }

  ctx.fillStyle = '#FFFFFF';
  for (let i = 0; i < layout.lines.length; i++) {
    const line = layout.lines[i];
    const y = layout.yOffsets[i];
    drawTrackedText(ctx, line, 64 + dx, y + dy, layout.letterSpacing, false);

    if (frameIndex % 3 === 0 || audioFrame?.isBeat) {
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.strokeRect(2 + dx, 2 + dy, 124, 60);
    }
  }
}

/**
 * 10. INVERTED BADGE: Solid white pill badge with black text cutout
 */
function renderInvertedBadge(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  text: string,
  tau: number,
  layout: TextLayoutResult,
  frameIndex: number,
  fontFamily: string,
  audioFrame?: AudioFrameData
) {
  ctx.font = getSafeFontSpec(layout.fontSize, fontFamily);
  ctx.textAlign = 'center';

  let maxLineWidth = 0;
  for (const l of layout.lines) {
    maxLineWidth = Math.max(maxLineWidth, ctx.measureText(l).width + (l.length - 1) * layout.letterSpacing);
  }

  const badgeW = Math.min(124, Math.floor(maxLineWidth + 14));
  const badgeH = Math.min(58, Math.floor(layout.totalHeight + 10));
  const badgeX = Math.floor((128 - badgeW) / 2);
  const badgeY = Math.floor((64 - badgeH) / 2);

  const scale = tau < 0.2 ? Math.min(1, tau / 0.2) : 1.0;
  const beatBump = audioFrame?.isBeat ? 0.08 : 0;

  ctx.save();
  ctx.translate(64, 32);
  ctx.scale(scale + beatBump, scale + beatBump);
  ctx.translate(-64, -32);

  ctx.fillStyle = '#FFFFFF';
  roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 4);
  ctx.fill();

  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < layout.lines.length; i++) {
    drawTrackedText(ctx, layout.lines[i], 64, layout.yOffsets[i], layout.letterSpacing, false);
  }

  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();

  // Brief inversion flash on hard drum hit
  if (audioFrame?.isBeat && audioFrame.onsetStrength > 0.65) {
    ctx.fillStyle = '#FFFFFF';
    ctx.globalCompositeOperation = 'difference';
    ctx.fillRect(0, 0, 128, 64);
    ctx.globalCompositeOperation = 'source-over';
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  if (typeof (ctx as any).roundRect === 'function') {
    (ctx as any).roundRect(x, y, w, h, r);
    return;
  }
  if (typeof (ctx as any).arcTo === 'function') {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    return;
  }
  if (typeof ctx.rect === 'function') {
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.closePath();
  }
}

/**
 * 11. ROLLING ODOMETER: Mechanical slot-machine tumbler reels rolling vertically into locked alignment
 */
function renderRollingOdometer(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  text: string,
  tau: number,
  layout: TextLayoutResult,
  frameIndex: number,
  fontFamily: string,
  audioFrame?: AudioFrameData
) {
  const rtl = isRTL(text);
  ctx.save();
  const cleanFont = (fontFamily.includes('Gotisch') || fontFamily.includes('Caveat') || fontFamily.includes('Vendetta') || fontFamily.includes('Wicked') || fontFamily.includes('Bubblegum'))
    ? `'Molot', 'Space Mono', monospace, sans-serif`
    : fontFamily;
  ctx.font = `bold ${layout.fontSize}px ${cleanFont}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const beatJitter = audioFrame?.isBeat
    ? ((frameIndex % 2 === 0 ? 1 : -1) * (audioFrame.onsetStrength > 0.6 ? 2 : 1))
    : 0;

  const TUMBLER_CHARS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'X', '7', '#', '$', '!', '?'];

  for (let lineIdx = 0; lineIdx < layout.lines.length; lineIdx++) {
    const rawLine = layout.lines[lineIdx];
    const lineText = rtl ? rawLine : rawLine.toUpperCase();
    const graphemes = getGraphemes(lineText);
    const n = graphemes.length;
    if (n === 0) continue;

    const centerY = layout.yOffsets[lineIdx] + beatJitter;
    const slotH = Math.min(56, Math.max(16, Math.floor(layout.fontSize * 1.45)));

    // Calculate per-character metrics
    const charWidths = graphemes.map(g => Math.max(6, Math.ceil(ctx.measureText(g).width)));
    const totalLineWidth = charWidths.reduce((sum, w) => sum + w, 0);
    const startX = Math.floor(64 - totalLineWidth / 2);

    const slotTop = Math.max(1, Math.floor(centerY - slotH / 2));
    const slotBottom = Math.min(62, Math.floor(centerY + slotH / 2));
    const actualSlotH = Math.max(8, slotBottom - slotTop);

    // Draw mechanical slot frame rails above and below the line
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = audioFrame?.isBeat ? 2 : 1;

    // Top horizontal bezel rail with end ticks
    ctx.beginPath();
    ctx.moveTo(Math.max(2, startX - 4), slotTop);
    ctx.lineTo(Math.min(125, startX + totalLineWidth + 4), slotTop);
    ctx.stroke();

    // Bottom horizontal bezel rail with end ticks
    ctx.beginPath();
    ctx.moveTo(Math.max(2, startX - 4), slotBottom);
    ctx.lineTo(Math.min(125, startX + totalLineWidth + 4), slotBottom);
    ctx.stroke();

    // Left and right mechanical knockout brackets
    const bracketX1 = Math.max(2, startX - 4);
    const bracketX2 = Math.min(125, startX + totalLineWidth + 4);
    ctx.beginPath();
    ctx.moveTo(bracketX1 + 3, slotTop - 2);
    ctx.lineTo(bracketX1, slotTop);
    ctx.lineTo(bracketX1, slotBottom);
    ctx.lineTo(bracketX1 + 3, slotBottom + 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(bracketX2 - 3, slotTop - 2);
    ctx.lineTo(bracketX2, slotTop);
    ctx.lineTo(bracketX2, slotBottom);
    ctx.lineTo(bracketX2 - 3, slotBottom + 2);
    ctx.stroke();

    let curX = startX;

    for (let i = 0; i < n; i++) {
      // In RTL, visual columns from left to right map to characters from end to beginning
      const charIndex = rtl ? (n - 1 - i) : i;
      const targetChar = graphemes[charIndex];
      const charW = charWidths[charIndex];
      const charCenterX = curX + charW / 2;

      // Skip tumbler rendering for whitespace characters (leave clean space)
      if (targetChar.trim() === '') {
        curX += charW;
        continue;
      }

      // Stagger progression: the first character of the word (charIndex 0) starts rolling first
      const staggerIndex = charIndex;
      const staggerWindow = n > 1 ? Math.min(0.38, 0.42 / n) : 0;
      const charStartTau = staggerIndex * staggerWindow;
      const rollDuration = 0.58;
      const progress = Math.max(0, Math.min(1, (tau - charStartTau) / rollDuration));

      // Clip character column aperture
      ctx.save();
      ctx.beginPath();
      ctx.rect(curX, slotTop + 1, charW, actualSlotH - 2);
      ctx.clip();

      if (progress >= 1) {
        // Locked position with crisp solid character
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(targetChar, charCenterX, centerY);

        // Subtle mechanical alignment notch on settled digit
        if (tau < charStartTau + rollDuration + 0.08) {
          ctx.fillRect(curX, centerY - 1, 1, 2);
          ctx.fillRect(curX + charW - 1, centerY - 1, 1, 2);
        }
      } else {
        // Tumbler spinning vertically with ease-out mechanical ratchet
        const easeOutRatchet = (t: number) => {
          const c = 1.6;
          return 1 + c * Math.pow(t - 1, 3) + (c - 1) * Math.pow(t - 1, 2);
        };

        const spinRounds = 3 + (i % 3);
        const totalDistance = spinRounds * actualSlotH;
        const currentDist = (1 - easeOutRatchet(progress)) * totalDistance;
        const reelOffset = currentDist % actualSlotH;

        // Select pseudo-random tumbler characters cycling with scroll distance
        const tumblerBaseIdx = Math.floor(currentDist / actualSlotH) + i * 4 + frameIndex;
        const charBelow = TUMBLER_CHARS[Math.abs(tumblerBaseIdx) % TUMBLER_CHARS.length];
        const charAbove = TUMBLER_CHARS[Math.abs(tumblerBaseIdx + 1) % TUMBLER_CHARS.length];
        const displayTarget = progress > 0.75 ? targetChar : charBelow;

        ctx.fillStyle = '#FFFFFF';

        // Draw rolling tumbler reel stack (above, center, below)
        ctx.fillText(displayTarget, charCenterX, centerY + reelOffset);
        ctx.fillText(charAbove, charCenterX, centerY + reelOffset - actualSlotH);
        ctx.fillText(charBelow, charCenterX, centerY + reelOffset + actualSlotH);
      }

      ctx.restore();

      // Divider tick mark between tumbler wheels (only if adjacent to non-space)
      const nextCharIndex = rtl ? (n - 2 - i) : (i + 1);
      if (i < n - 1 && graphemes[nextCharIndex]?.trim() !== '') {
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(curX + charW, slotTop);
        ctx.lineTo(curX + charW, slotTop + 2);
        ctx.moveTo(curX + charW, slotBottom - 2);
        ctx.lineTo(curX + charW, slotBottom);
        ctx.stroke();
      }

      curX += charW;
    }
  }

  ctx.restore();
}

/**
 * Bayer 4x4 dither threshold matrix for zero-jitter 1-bit dissolves
 */
export const BAYER_4X4: number[][] = [
  [ 0,  8,  2, 10],
  [12,  4, 14,  6],
  [ 3, 11,  1,  9],
  [15,  7, 13,  5]
];

/**
 * 12. GENTLE FLOAT: Weightless acoustic drift with subtle dual-harmonic Lissajous floating
 */
function renderGentleFloat(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  text: string,
  tau: number,
  layout: TextLayoutResult,
  frameIndex: number,
  fontFamily: string,
  audioFrame?: AudioFrameData,
  moodProfile?: SongMoodProfile | null
) {
  const rtl = isRTL(text);
  const maxDisplacement = moodProfile ? moodProfile.maxEntryDisplacementPx : 3;

  // Zero initial velocity smootherstep entry (C1 continuous, no initial whip or kick)
  const entryProgress = Math.min(1, tau / 0.4);
  const entryEase = entryProgress < 0.5 
    ? 4 * entryProgress * entryProgress * entryProgress 
    : 1 - Math.pow(-2 * entryProgress + 2, 3) / 2;
  const entryY = Math.round((1 - entryEase) * Math.min(3, maxDisplacement));

  // Sustain: peaceful harmonic Lissajous drift without jerky bob
  const audioSwell = audioFrame ? audioFrame.rms * 0.8 : 0;
  const floatY = tau > 0.3 ? Math.round(Math.sin((frameIndex / 30) * Math.PI * 0.6) * (1.0 + audioSwell)) : 0;
  const floatX = tau > 0.3 ? Math.round(Math.cos((frameIndex / 30) * Math.PI * 0.3) * 0.5) : 0;

  const curX = 64 + floatX;
  const curY = entryY + floatY;

  ctx.save();
  ctx.direction = rtl ? 'rtl' : 'ltr';
  ctx.font = getSafeFontSpec(layout.fontSize, fontFamily);
  ctx.textAlign = 'center';

  // 1-Bit Knockout Halo
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  for (let i = 0; i < layout.lines.length; i++) {
    drawTrackedText(ctx, layout.lines[i], curX, layout.yOffsets[i] + curY, layout.letterSpacing, true);
  }

  // Crisp White Core
  ctx.fillStyle = '#FFFFFF';
  for (let i = 0; i < layout.lines.length; i++) {
    drawTrackedText(ctx, layout.lines[i], curX, layout.yOffsets[i] + curY, layout.letterSpacing, false);
  }
  ctx.restore();
}

/**
 * 13. DITHER DISSOLVE: 1-Bit Bayer matrix crossfade with zero temporal crawl
 */
function renderDitherDissolve(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  text: string,
  tau: number,
  layout: TextLayoutResult,
  _frameIndex: number,
  fontFamily: string,
  _audioFrame?: AudioFrameData
) {
  const rtl = isRTL(text);
  const { canvas: tempCanvas, ctx: tCtx } = getScratchCanvas();
  tCtx.clearRect(0, 0, 128, 64);
  tCtx.direction = rtl ? 'rtl' : 'ltr';
  tCtx.font = getSafeFontSpec(layout.fontSize, fontFamily);
  tCtx.textAlign = 'center';

  // Draw black knockout halo + crisp white text on scratch canvas
  tCtx.strokeStyle = '#000000';
  tCtx.lineWidth = 2;
  for (let i = 0; i < layout.lines.length; i++) {
    drawTrackedText(tCtx, layout.lines[i], 64, layout.yOffsets[i], layout.letterSpacing, true);
  }
  tCtx.fillStyle = '#FFFFFF';
  for (let i = 0; i < layout.lines.length; i++) {
    drawTrackedText(tCtx, layout.lines[i], 64, layout.yOffsets[i], layout.letterSpacing, false);
  }

  // Calculate threshold: 0..1 during entry (tau <= 0.35), 1 during hold, 1..0 on exit (tau >= 0.85)
  let dissolveThreshold = 1.0;
  if (tau < 0.35) {
    const t = tau / 0.35;
    dissolveThreshold = 1 - (1 - t) * (1 - t); // easeOutQuad
  } else if (tau > 0.85) {
    const t = (1.0 - tau) / 0.15;
    dissolveThreshold = 1 - (1 - t) * (1 - t);
  }

  // If fully solid, direct draw
  if (dissolveThreshold >= 1.0) {
    if (typeof (ctx as any).drawImage === 'function') {
      ctx.drawImage(tempCanvas, 0, 0);
    }
    return;
  }

  // Apply screen-space Bayer threshold filter
  const imgData = tCtx.getImageData(0, 0, 128, 64);
  const src = imgData.data;
  ctx.save();
  ctx.fillStyle = '#FFFFFF';

  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 128; x++) {
      const idx = (y * 128 + x) * 4;
      if (src[idx + 3] > 64 && src[idx] > 120) { // White pixel
        const bayerVal = BAYER_4X4[y % 4][x % 4] / 16.0;
        if (dissolveThreshold > bayerVal) {
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
  }
  ctx.restore();
}

/**
 * 14. TYPEWRITER RIBBON: Progressive storytelling reveal with blinking cursor and underline ribbon
 */
function renderTypewriterRibbon(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  text: string,
  tau: number,
  layout: TextLayoutResult,
  frameIndex: number,
  fontFamily: string,
  _audioFrame?: AudioFrameData
) {
  const rtl = isRTL(text);
  ctx.save();
  ctx.direction = rtl ? 'rtl' : 'ltr';
  ctx.font = getSafeFontSpec(layout.fontSize, fontFamily);
  ctx.textAlign = 'center';

  for (let lineIdx = 0; lineIdx < layout.lines.length; lineIdx++) {
    const fullLine = layout.lines[lineIdx];
    const graphemes = getGraphemes(fullLine);
    const totalChars = graphemes.length;
    if (totalChars === 0) continue;

    // Typing reveal progress
    const typingProgress = Math.min(1, tau / 0.65);
    const visibleCount = Math.min(totalChars, Math.floor(typingProgress * (totalChars + 1)));
    const visibleText = graphemes.slice(0, visibleCount).join('');
    const lineY = layout.yOffsets[lineIdx];

    // Draw visible typed characters with knockout
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    drawTrackedText(ctx, visibleText, 64, lineY, layout.letterSpacing, true);
    ctx.fillStyle = '#FFFFFF';
    drawTrackedText(ctx, visibleText, 64, lineY, layout.letterSpacing, false);

    // Blinking cursor if still typing or just finished (blinks every 8 frames)
    if (typingProgress < 1.0 || (frameIndex % 8 < 4)) {
      const fullW = ctx.measureText(fullLine).width;
      const curW = ctx.measureText(visibleText).width;
      const cursorX = rtl 
        ? Math.round(64 + fullW / 2 - curW - 2)
        : Math.round(64 - fullW / 2 + curW + 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(
        Math.max(2, Math.min(124, cursorX)), 
        lineY - Math.round(layout.fontSize * 0.75), 
        2, 
        Math.max(6, Math.round(layout.fontSize * 0.85))
      );
    }

    // Expanding ribbon underline once completed
    if (tau > 0.65) {
      const ribbonT = (tau - 0.65) / 0.35;
      const ribbonProgress = 1 - Math.pow(1 - ribbonT, 3); // easeOutCubic
      const targetW = ctx.measureText(fullLine).width + 6;
      const ribbonW = Math.round(targetW * ribbonProgress);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(Math.round(64 - ribbonW / 2), Math.min(62, lineY + 3), ribbonW, 1);
    }
  }
  ctx.restore();
}

/**
 * 15. WAVEFORM KARAOKE: Rock-solid text with fluid vocal wave and tracking runner beacon
 */
function renderWaveformKaraoke(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  text: string,
  tau: number,
  layout: TextLayoutResult,
  frameIndex: number,
  fontFamily: string,
  _audioFrame?: AudioFrameData
) {
  const rtl = isRTL(text);
  ctx.save();
  ctx.direction = rtl ? 'rtl' : 'ltr';
  ctx.font = getSafeFontSpec(layout.fontSize, fontFamily);
  ctx.textAlign = 'center';

  // Draw solid stationary text with knockout halo
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  for (let i = 0; i < layout.lines.length; i++) {
    drawTrackedText(ctx, layout.lines[i], 64, layout.yOffsets[i], layout.letterSpacing, true);
  }
  ctx.fillStyle = '#FFFFFF';
  for (let i = 0; i < layout.lines.length; i++) {
    drawTrackedText(ctx, layout.lines[i], 64, layout.yOffsets[i], layout.letterSpacing, false);
  }

  // Draw continuous sinusoidal wave directly beneath the bottom line
  const bottomLineIdx = layout.lines.length - 1;
  const lineY = layout.yOffsets[bottomLineIdx];
  const fullW = ctx.measureText(layout.lines[bottomLineIdx]).width;
  const startX = Math.max(4, Math.floor(64 - fullW / 2 - 4));
  const endX = Math.min(124, Math.ceil(64 + fullW / 2 + 4));

  ctx.fillStyle = '#FFFFFF';

  // Continuous fluid wave
  const waveBaseY = Math.min(61, lineY + 4);
  for (let x = startX; x <= endX; x++) {
    const waveY = waveBaseY + Math.round(1.5 * Math.sin(0.18 * x + frameIndex * 0.16));
    if (waveY >= 0 && waveY < 64) {
      ctx.fillRect(x, waveY, 1, 1);
    }
  }

  // Vocal Progress Runner (Diamond Bead)
  const runnerX = rtl 
    ? Math.round(endX - tau * (endX - startX))
    : Math.round(startX + tau * (endX - startX));
  const runnerY = waveBaseY + Math.round(1.5 * Math.sin(0.18 * runnerX + frameIndex * 0.16));

  // Draw 3x3 diamond bead
  ctx.fillRect(runnerX - 1, runnerY, 3, 1);
  ctx.fillRect(runnerX, runnerY - 1, 1, 3);

  ctx.restore();
}

/**
 * 12. ANVIL STOMP: Massive vertical slam crashing onto baseline with baseline shock dust and zero rebound
 */
function renderAnvilStomp(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  _text: string,
  tau: number,
  layout: TextLayoutResult,
  frameIndex: number,
  fontFamily: string,
  _audioFrame?: AudioFrameData
) {
  ctx.save();
  ctx.font = getSafeFontSpec(layout.fontSize, fontFamily);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  const slamTime = 0.22;
  let offsetY = 0;
  let shudderX = 0;
  let shudderY = 0;

  if (tau < slamTime) {
    const p = tau / slamTime;
    offsetY = Math.round(-34 * (1 - p * p * p));
  } else {
    const elapsedImpact = tau - slamTime;
    if (elapsedImpact < 0.12) {
      shudderX = (frameIndex % 2 === 0 ? 1 : -1);
      shudderY = (frameIndex % 2 === 0 ? -1 : 1);
    }
  }

  if (tau >= slamTime) {
    const bottomY = Math.max(...layout.yOffsets) + Math.round(layout.fontSize * 0.55);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(16, Math.min(62, bottomY + 2), 96, 2);

    const dustPhase = Math.min(1, (tau - slamTime) / 0.25);
    if (dustPhase > 0 && dustPhase < 1) {
      const spread = Math.round(dustPhase * 36);
      ctx.fillRect(Math.max(2, 64 - 40 - spread), Math.min(62, bottomY + 2), 3, 2);
      ctx.fillRect(Math.min(123, 64 + 40 + spread), Math.min(62, bottomY + 2), 3, 2);
    }
  }

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  for (let i = 0; i < layout.lines.length; i++) {
    drawTrackedText(ctx, layout.lines[i], 64 + shudderX, layout.yOffsets[i] + offsetY + shudderY, layout.letterSpacing, true);
  }

  ctx.fillStyle = '#FFFFFF';
  for (let i = 0; i < layout.lines.length; i++) {
    drawTrackedText(ctx, layout.lines[i], 64 + shudderX, layout.yOffsets[i] + offsetY + shudderY, layout.letterSpacing, false);
  }

  ctx.restore();
}

/**
 * 13. FRACTURE SHATTER: Angular diagonal fissure crack splitting letterforms into upper and lower shearing halves
 */
function renderFractureShatter(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  _text: string,
  tau: number,
  layout: TextLayoutResult,
  _frameIndex: number,
  fontFamily: string,
  _audioFrame?: AudioFrameData
) {
  const { canvas: tempCanvas, ctx: tCtx } = getScratchCanvas();
  tCtx.clearRect(0, 0, 128, 64);
  tCtx.save();
  tCtx.font = getSafeFontSpec(layout.fontSize, fontFamily);
  tCtx.textBaseline = 'middle';
  tCtx.textAlign = 'center';

  tCtx.fillStyle = '#FFFFFF';
  for (let i = 0; i < layout.lines.length; i++) {
    drawTrackedText(tCtx, layout.lines[i], 64, layout.yOffsets[i], layout.letterSpacing, false);
  }
  tCtx.restore();

  ctx.save();
  const splitTime = 0.25;
  const isSplit = tau >= splitTime;
  const splitProgress = isSplit ? Math.min(1, (tau - splitTime) / 0.4) : 0;
  const shearX = Math.round(splitProgress * 3);
  const shearY = Math.round(splitProgress * 2);

  const splitY = 32;

  // Upper shard
  ctx.drawImage(
    tempCanvas as any,
    0, 0, 128, splitY,
    shearX, -shearY, 128, splitY
  );

  // Lower shard
  ctx.drawImage(
    tempCanvas as any,
    0, splitY, 128, 64 - splitY,
    -shearX, splitY + shearY, 128, 64 - splitY
  );

  if (isSplit) {
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(12, splitY - 1);
    ctx.lineTo(44, splitY + 2);
    ctx.lineTo(84, splitY - 2);
    ctx.lineTo(116, splitY + 1);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * 14. PENDULUM SWAY: Harmonic rocking angular tilt rocking smoothly like an acoustic guitar strum or metronome
 */
function renderPendulumSway(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  _text: string,
  tau: number,
  layout: TextLayoutResult,
  _frameIndex: number,
  fontFamily: string,
  _audioFrame?: AudioFrameData
) {
  ctx.save();
  ctx.font = getSafeFontSpec(layout.fontSize, fontFamily);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  const angle = 0.08 * Math.sin(tau * Math.PI * 2.5) * (1 - tau * 0.3);
  const pivotX = 64;
  const pivotY = 4;

  ctx.translate(pivotX, pivotY);
  ctx.rotate(angle);
  ctx.translate(-pivotX, -pivotY);

  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;
  const tickX = Math.round(64 + Math.sin(angle * 5) * 16);
  ctx.fillRect(tickX - 1, 60, 3, 2);

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  for (let i = 0; i < layout.lines.length; i++) {
    drawTrackedText(ctx, layout.lines[i], 64, layout.yOffsets[i], layout.letterSpacing, true);
  }

  ctx.fillStyle = '#FFFFFF';
  for (let i = 0; i < layout.lines.length; i++) {
    drawTrackedText(ctx, layout.lines[i], 64, layout.yOffsets[i], layout.letterSpacing, false);
  }

  ctx.restore();
}

/**
 * 15. PRISM SHIMMER: Diagonal 1-bit Bayer light beam sweeping smoothly across glyphs with starlight glints
 */
function renderPrismShimmer(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  _text: string,
  tau: number,
  layout: TextLayoutResult,
  frameIndex: number,
  fontFamily: string,
  _audioFrame?: AudioFrameData
) {
  ctx.save();
  ctx.font = getSafeFontSpec(layout.fontSize, fontFamily);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  for (let i = 0; i < layout.lines.length; i++) {
    drawTrackedText(ctx, layout.lines[i], 64, layout.yOffsets[i], layout.letterSpacing, true);
  }

  ctx.fillStyle = '#FFFFFF';
  for (let i = 0; i < layout.lines.length; i++) {
    drawTrackedText(ctx, layout.lines[i], 64, layout.yOffsets[i], layout.letterSpacing, false);
  }

  const beamX = Math.round(-35 + tau * 198);

  // Clean 1-bit anamorphic diagonal prism sweep beam
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(beamX, 0);
  ctx.lineTo(beamX + 28, 64);
  ctx.stroke();

  // Secondary fine flare line
  ctx.beginPath();
  ctx.moveTo(beamX + 4, 0);
  ctx.lineTo(beamX + 32, 64);
  ctx.stroke();

  // Traveling diamond glint star at beam head (only while traversing visible canvas)
  const glintX = beamX + 14;
  const glintY = Math.round(18 + Math.sin(tau * Math.PI * 3) * 6);
  if (glintX >= 8 && glintX <= 120) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(glintX - 2, glintY, 5, 1);
    ctx.fillRect(glintX, glintY - 2, 1, 5);
    ctx.fillRect(glintX - 1, glintY - 1, 3, 3);
  }

  ctx.restore();
}

/**
 * 16. SQUASH & BOUNCE: Elastic Disney squash and stretch physics landing on baseline with rhythmic beat rebound
 */
function renderSquashBounce(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  _text: string,
  tau: number,
  layout: TextLayoutResult,
  _frameIndex: number,
  fontFamily: string,
  _audioFrame?: AudioFrameData
) {
  ctx.save();
  ctx.font = getSafeFontSpec(layout.fontSize, fontFamily);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  let scaleX = 1.0;
  let scaleY = 1.0;
  let translateY = 0;

  if (tau < 0.32) {
    const p = tau / 0.32;
    translateY = Math.round(-24 * (1 - p * p));
    scaleX = 0.84;
    scaleY = 1.25;
  } else if (tau < 0.48) {
    const p = (tau - 0.32) / 0.16;
    scaleX = 1.32 - p * 0.32;
    scaleY = 0.68 + p * 0.32;
    translateY = 0;
  } else if (tau < 0.70) {
    const p = (tau - 0.48) / 0.22;
    translateY = Math.round(-6 * Math.sin(p * Math.PI));
    scaleX = 0.92;
    scaleY = 1.12;
  } else {
    scaleX = 1.0;
    scaleY = 1.0;
    translateY = 0;
  }

  const baseY = Math.max(...layout.yOffsets) + Math.round(layout.fontSize * 0.5);

  ctx.translate(64, baseY);
  ctx.scale(scaleX, scaleY);
  ctx.translate(-64, -baseY + translateY);

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  for (let i = 0; i < layout.lines.length; i++) {
    drawTrackedText(ctx, layout.lines[i], 64, layout.yOffsets[i], layout.letterSpacing, true);
  }

  ctx.fillStyle = '#FFFFFF';
  for (let i = 0; i < layout.lines.length; i++) {
    drawTrackedText(ctx, layout.lines[i], 64, layout.yOffsets[i], layout.letterSpacing, false);
  }

  ctx.restore();
}

/**
 * Orthogonal Text Dressing Post-Processor (Scanlines, Dither Shade, Inverted Pill)
 */
function applyTextDressing(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  dressing: TextDressing,
  layout: TextLayoutResult,
  _text: string,
  _frameIndex: number
) {
  if (dressing === 'solid' || dressing === 'hollow_wireframe') return;

  const minY = Math.max(0, Math.min(...layout.yOffsets) - Math.round(layout.fontSize * 0.65));
  const maxY = Math.min(63, Math.max(...layout.yOffsets) + Math.round(layout.fontSize * 0.65));

  if (dressing === 'scanline_slice') {
    ctx.fillStyle = '#000000';
    for (let y = minY; y <= maxY; y += 2) {
      ctx.fillRect(0, y, 128, 1);
    }
  } else if (dressing === 'bayer_dither_shade') {
    ctx.fillStyle = '#000000';
    for (let i = 0; i < layout.lines.length; i++) {
      const midY = layout.yOffsets[i];
      const bottomY = Math.min(63, midY + Math.round(layout.fontSize * 0.6));
      for (let y = midY; y <= bottomY; y++) {
        for (let x = 0; x < 128; x++) {
          if ((x + y) % 2 === 1) {
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    }
  } else if (dressing === 'echo_trail') {
    // Draw offset Bayer 25% shadow behind bounds
    ctx.fillStyle = '#000000';
    for (let y = minY; y <= maxY; y++) {
      for (let x = 0; x < 128; x++) {
        if ((x + y) % 4 === 0) {
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
  } else if (dressing === 'inverted_pill') {
    ctx.save();
    ctx.globalCompositeOperation = 'difference';
    ctx.fillStyle = '#FFFFFF';
    const boxW = Math.min(124, Math.max(40, ctx.measureText(layout.lines[0]).width + 16));
    const boxH = Math.round((maxY - minY) + 8);
    const boxX = Math.round((128 - boxW) / 2);
    const boxY = Math.max(2, minY - 4);
    roundRect(ctx, boxX, boxY, boxW, boxH, 4);
    ctx.fill();
    ctx.restore();
  }
}
