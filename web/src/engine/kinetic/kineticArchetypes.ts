import { MotionArchetype, TextLayoutResult } from './types';
import { AudioFrameData } from './audioAnalysisEngine';

// Pooled scratch canvas to eliminate per-frame GC allocations
let cachedScratchCanvas: OffscreenCanvas | HTMLCanvasElement | null = null;
let cachedScratchCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;

function getScratchCanvas(): { canvas: OffscreenCanvas | HTMLCanvasElement; ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D } {
  if (!cachedScratchCanvas || !cachedScratchCtx) {
    if (typeof OffscreenCanvas !== 'undefined') {
      cachedScratchCanvas = new OffscreenCanvas(128, 64);
      cachedScratchCtx = cachedScratchCanvas.getContext('2d')!;
    } else {
      cachedScratchCanvas = document.createElement('canvas');
      cachedScratchCanvas.width = 128;
      cachedScratchCanvas.height = 64;
      cachedScratchCtx = cachedScratchCanvas.getContext('2d')!;
    }
  }
  return { canvas: cachedScratchCanvas, ctx: cachedScratchCtx };
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
  audioFrame?: AudioFrameData
) {
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
      renderSmoothFluid(ctx, text, tau, layout, frameIndex, fontFamily, audioFrame);
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
    default:
      renderSmoothFluid(ctx, text, tau, layout, frameIndex, fontFamily, audioFrame);
      break;
  }
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
  const { canvas: tempCanvas, ctx: tCtx } = getScratchCanvas();

  tCtx.clearRect(0, 0, 128, 64);
  tCtx.font = `bold ${layout.fontSize}px ${fontFamily}`;
  tCtx.textAlign = 'center';
  tCtx.strokeStyle = '#000000';
  tCtx.lineWidth = 3;
  tCtx.lineJoin = 'miter';
  tCtx.miterLimit = 2;

  for (let i = 0; i < layout.lines.length; i++) {
    tCtx.strokeText(layout.lines[i], 64, layout.yOffsets[i]);
  }

  tCtx.fillStyle = '#FFFFFF';
  for (let i = 0; i < layout.lines.length; i++) {
    tCtx.fillText(layout.lines[i], 64, layout.yOffsets[i]);
  }

  const midY = 32;
  const ease = Math.min(1, tau / 0.25);
  // Audio flux or beat adds extra kick to the split
  const audioKick = audioFrame ? (audioFrame.isBeat ? 6 : audioFrame.flux * 4) : 0;
  const shift = Math.round((1 - ease) * 18 + audioKick);

  // Upper half shifted left
  ctx.drawImage(tempCanvas, 0, 0, 128, midY, -shift, 0, 128, midY);

  // Lower half shifted right
  ctx.drawImage(tempCanvas, 0, midY, 128, 64 - midY, shift, midY, 128, 64 - midY);

  // Diagonal razor slash line during initial 30% of duration or on beat onset
  if (tau < 0.3 || audioFrame?.isBeat) {
    const p = tau < 0.3 ? tau / 0.3 : 1.0;
    const xEnd = Math.floor(p * 128);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = audioFrame?.isBeat ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(0, midY + 4);
    ctx.lineTo(xEnd, midY - 4);
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

  ctx.font = `bold ${layout.fontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#000000';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;

  for (let i = 0; i < layout.lines.length; i++) {
    const line = layout.lines[i];
    const y = layout.yOffsets[i];
    ctx.strokeText(line, 64 + 2, y + 2);
  }

  ctx.fillStyle = '#FFFFFF';
  for (let i = 0; i < layout.lines.length; i++) {
    const line = layout.lines[i];
    const y = layout.yOffsets[i];
    ctx.fillText(line, 64, y);
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
  ctx.font = `bold ${layout.fontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';

  const isGlitchBurst = (tau < 0.2) || (audioFrame && audioFrame.flux > 0.5) || audioFrame?.isBeat;
  const glitchChars = '01X$#%_~<>';
  const displayLines = layout.lines.map(line => {
    if (isGlitchBurst) {
      return line.split('').map(ch => {
        if (ch === ' ' || ch === '-') return ch;
        return Math.random() > 0.35 ? glitchChars[Math.floor(Math.random() * glitchChars.length)] : ch;
      }).join('');
    }
    return line;
  });

  const jitterAmp = audioFrame?.isBeat ? 6 : (audioFrame ? Math.round(audioFrame.flux * 4) : 0);
  const jitterX = (tau < 0.3 || frameIndex % 8 === 0 || audioFrame?.isBeat) 
    ? ((frameIndex * 17) % 7) - 3 + (Math.random() > 0.5 ? jitterAmp : -jitterAmp) 
    : 0;

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'miter';
  ctx.miterLimit = 2;
  for (let i = 0; i < displayLines.length; i++) {
    ctx.strokeText(displayLines[i], 64 + jitterX, layout.yOffsets[i]);
  }

  ctx.fillStyle = '#FFFFFF';
  for (let i = 0; i < displayLines.length; i++) {
    ctx.fillText(displayLines[i], 64 + jitterX, layout.yOffsets[i]);
  }

  if (tau < 0.35 || frameIndex % 6 === 0 || audioFrame?.isBeat) {
    const sliceY = (frameIndex * 13) % 48 + 8;
    const sliceH = 4 + (frameIndex % 5) + (audioFrame?.isBeat ? 4 : 0);
    const sliceShift = ((frameIndex * 7) % 11) - 5 + (audioFrame?.isBeat ? (frameIndex % 2 === 0 ? 8 : -8) : 0);

    const slice = ctx.getImageData(0, sliceY, 128, sliceH);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, sliceY, 128, sliceH);
    ctx.putImageData(slice, sliceShift, sliceY);
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
  audioFrame?: AudioFrameData
) {
  const easeProgress = Math.min(1, tau / 0.3);
  const slideProgress = 1 - Math.pow(1 - easeProgress, 3);
  const startYOffset = 18 * (1 - slideProgress);

  // Audio energy modulates the idle floating bob
  const audioBob = audioFrame ? audioFrame.bass * 2.5 : 0;
  const idleBob = tau > 0.3 ? (Math.sin((tau - 0.3) * Math.PI * 4) * 1.5 - audioBob) : 0;
  const currentY = startYOffset + idleBob;

  ctx.font = `bold ${layout.fontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';

  if (tau < 0.25) {
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    for (let i = 0; i < layout.lines.length; i++) {
      const y = layout.yOffsets[i] + currentY + 4;
      ctx.strokeText(layout.lines[i], 64, y);
    }
    ctx.fillStyle = '#FFFFFF';
    for (let i = 0; i < layout.lines.length; i++) {
      const y = layout.yOffsets[i] + currentY + 4;
      ctx.fillText(layout.lines[i], 64, y);
    }
  }

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'miter';
  ctx.miterLimit = 2;
  for (let i = 0; i < layout.lines.length; i++) {
    const line = layout.lines[i];
    const y = layout.yOffsets[i] + currentY;
    ctx.strokeText(line, 64, y);
  }

  ctx.fillStyle = '#FFFFFF';
  for (let i = 0; i < layout.lines.length; i++) {
    const line = layout.lines[i];
    const y = layout.yOffsets[i] + currentY;
    ctx.fillText(line, 64, y);

    if (i === layout.lines.length - 1) {
      const metrics = ctx.measureText(line);
      const baseWidth = metrics.width + 8;
      const energyPulse = audioFrame ? audioFrame.rms * 12 : 0;
      const pillWidth = Math.min(120, Math.min(baseWidth + energyPulse, (baseWidth + energyPulse) * Math.min(1, tau / 0.4)));
      ctx.fillRect(Math.floor(64 - pillWidth / 2), Math.min(61, Math.floor(y + 3)), Math.floor(pillWidth), 2);
    }
  }
}

/**
 * 5. 3D BLOCK STACK: Isometric extrusion with checkerboard dither shadow
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

  ctx.font = `bold ${layout.fontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';

  // Depth expands with bass energy
  const extraDepth = audioFrame ? Math.round(audioFrame.bass * 3) : 0;
  const depth = 4 + extraDepth;
  for (let d = depth; d >= 1; d--) {
    ctx.fillStyle = (d % 2 === 0) ? '#FFFFFF' : '#000000';
    for (let i = 0; i < layout.lines.length; i++) {
      ctx.fillText(layout.lines[i], 64 + d, layout.yOffsets[i] + dropY + d);
    }
  }

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.fillStyle = '#FFFFFF';
  for (let i = 0; i < layout.lines.length; i++) {
    const line = layout.lines[i];
    const y = layout.yOffsets[i] + dropY;
    ctx.strokeText(line, 64, y);
    ctx.fillText(line, 64, y);
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
  ctx.font = `bold ${layout.fontSize}px ${fontFamily}`;
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
      ctx.strokeText(line, 64 - pulseR / 3, y - pulseR / 4);
      ctx.strokeText(line, 64 + pulseR / 3, y + pulseR / 4);
      if (audioFrame?.isBeat) {
        ctx.strokeText(line, 64, y - pulseR / 2);
      }
    }

    // Main text
    ctx.fillStyle = '#000000';
    ctx.strokeText(line, 64, y);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(line, 64, y);
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

  ctx.font = `bold ${layout.fontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'miter';
  ctx.miterLimit = 2;
  for (let i = 0; i < layout.lines.length; i++) {
    ctx.strokeText(layout.lines[i], 64, layout.yOffsets[i]);
  }

  ctx.fillStyle = '#FFFFFF';
  for (let i = 0; i < layout.lines.length; i++) {
    ctx.fillText(layout.lines[i], 64, layout.yOffsets[i]);
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
  tCtx.font = `bold ${layout.fontSize}px ${fontFamily}`;
  tCtx.textAlign = 'center';
  tCtx.strokeStyle = '#000000';
  tCtx.lineWidth = 3;
  tCtx.lineJoin = 'miter';
  tCtx.miterLimit = 2;

  for (let i = 0; i < layout.lines.length; i++) {
    tCtx.strokeText(layout.lines[i], 64, layout.yOffsets[i]);
  }

  tCtx.fillStyle = '#FFFFFF';
  for (let i = 0; i < layout.lines.length; i++) {
    tCtx.fillText(layout.lines[i], 64, layout.yOffsets[i]);
  }

  // Slice vertical strips and sine displace
  const stripWidth = 4;
  const numStrips = Math.ceil(128 / stripWidth);
  const waveAmp = 3 + (audioFrame ? audioFrame.bass * 3 : 0);

  for (let s = 0; s < numStrips; s++) {
    const sx = s * stripWidth;
    const waveY = Math.round(Math.sin(s * 0.4 + tau * 6 * Math.PI) * waveAmp);
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
  ctx.font = `bold ${layout.fontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';

  const boilSpeed = audioFrame && audioFrame.rms > 0.5 ? 1.8 : 2.5;
  const boilPhase = Math.floor(frameIndex / boilSpeed) % 3;
  const offsetsX = [-1, 1, 0];
  const offsetsY = [0, -1, 1];

  const dx = offsetsX[boilPhase] * (audioFrame?.isBeat ? 2 : 1);
  const dy = offsetsY[boilPhase] * (audioFrame?.isBeat ? 2 : 1);

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'miter';
  ctx.miterLimit = 2;
  for (let i = 0; i < layout.lines.length; i++) {
    ctx.strokeText(layout.lines[i], 64 + dx, layout.yOffsets[i] + dy);
  }

  ctx.fillStyle = '#FFFFFF';
  for (let i = 0; i < layout.lines.length; i++) {
    const line = layout.lines[i];
    const y = layout.yOffsets[i];
    ctx.fillText(line, 64 + dx, y + dy);

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
  ctx.font = `bold ${layout.fontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';

  let maxLineWidth = 0;
  for (const l of layout.lines) {
    maxLineWidth = Math.max(maxLineWidth, ctx.measureText(l).width);
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
    ctx.fillText(layout.lines[i], 64, layout.yOffsets[i]);
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
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
