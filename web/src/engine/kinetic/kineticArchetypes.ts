import { MotionArchetype, TextLayoutResult } from './types';

/**
 * Dispatches frame rendering to the selected motion archetype.
 * ctx: OffscreenCanvas 2D context (128x64)
 * tau: Normalized temporal progress of active word/line [0..1]
 */
export function renderArchetypeFrame(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  archetype: MotionArchetype,
  text: string,
  tau: number,
  layout: TextLayoutResult,
  frameIndex: number,
  fontFamily: string = '"IBM Plex Mono", monospace'
) {
  switch (archetype) {
    case 'blade_slash':
      renderBladeSlash(ctx, text, tau, layout, frameIndex, fontFamily);
      break;
    case 'manga_impact':
      renderMangaImpact(ctx, text, tau, layout, frameIndex, fontFamily);
      break;
    case 'cyber_glitch':
      renderCyberGlitch(ctx, text, tau, layout, frameIndex, fontFamily);
      break;
    case 'smooth_fluid':
      renderSmoothFluid(ctx, text, tau, layout, frameIndex, fontFamily);
      break;
    case '3d_block_stack':
      render3DBlockStack(ctx, text, tau, layout, frameIndex, fontFamily);
      break;
    case 'echo_stack':
      renderEchoStack(ctx, text, tau, layout, frameIndex, fontFamily);
      break;
    case 'target_focus':
      renderTargetFocus(ctx, text, tau, layout, frameIndex, fontFamily);
      break;
    case 'snake_slither':
      renderSnakeSlither(ctx, text, tau, layout, frameIndex, fontFamily);
      break;
    case 'wiggly_boil':
      renderWigglyBoil(ctx, text, tau, layout, frameIndex, fontFamily);
      break;
    case 'inverted_badge':
      renderInvertedBadge(ctx, text, tau, layout, frameIndex, fontFamily);
      break;
    default:
      renderSmoothFluid(ctx, text, tau, layout, frameIndex, fontFamily);
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
  fontFamily: string
) {
  const tempCanvas = new OffscreenCanvas(128, 64);
  const tCtx = tempCanvas.getContext('2d')!;

  tCtx.fillStyle = '#000000';
  tCtx.fillRect(0, 0, 128, 64);
  tCtx.font = `bold ${layout.fontSize}px ${fontFamily}`;
  tCtx.textAlign = 'center';
  tCtx.fillStyle = '#FFFFFF';

  for (let i = 0; i < layout.lines.length; i++) {
    tCtx.fillText(layout.lines[i], 64, layout.yOffsets[i]);
  }

  const midY = 32;
  const ease = Math.min(1, tau / 0.25);
  const shift = Math.round((1 - ease) * 18);

  // Upper half shifted left
  ctx.drawImage(tempCanvas, 0, 0, 128, midY, -shift, 0, 128, midY);

  // Lower half shifted right
  ctx.drawImage(tempCanvas, 0, midY, 128, 64 - midY, shift, midY, 128, 64 - midY);

  // Diagonal razor slash line during initial 30% of duration
  if (tau < 0.3) {
    const p = tau / 0.3;
    const xEnd = Math.floor(p * 128);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
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
  fontFamily: string
) {
  const scale = tau < 0.25 
    ? 1.0 + 1.2 * Math.pow(1 - tau / 0.25, 3) * Math.cos(tau * 4 * Math.PI)
    : 1.0 + Math.sin((tau - 0.25) * Math.PI * 2) * 0.03;

  ctx.save();
  ctx.translate(64, 32);
  ctx.scale(scale, scale);
  ctx.translate(-64, -32);

  if (tau < 0.35) {
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    const numRays = 16;
    for (let r = 0; r < numRays; r++) {
      const angle = (r / numRays) * Math.PI * 2 + (frameIndex % 3) * 0.1;
      const innerR = 40 + (frameIndex % 4) * 4;
      const outerR = 90;
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

  if (tau >= 0.12 && tau <= 0.15) {
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
  fontFamily: string
) {
  ctx.font = `bold ${layout.fontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';

  const glitchChars = '01X$#%_~<>';
  const displayLines = layout.lines.map(line => {
    if (tau < 0.2) {
      return line.split('').map(ch => {
        if (ch === ' ' || ch === '-') return ch;
        return Math.random() > 0.4 ? glitchChars[Math.floor(Math.random() * glitchChars.length)] : ch;
      }).join('');
    }
    return line;
  });

  const jitterX = (tau < 0.3 || (frameIndex % 8 === 0)) ? ((frameIndex * 17) % 7) - 3 : 0;

  ctx.fillStyle = '#FFFFFF';
  for (let i = 0; i < displayLines.length; i++) {
    ctx.fillText(displayLines[i], 64 + jitterX, layout.yOffsets[i]);
  }

  if (tau < 0.35 || frameIndex % 6 === 0) {
    const sliceY = (frameIndex * 13) % 48 + 8;
    const sliceH = 4 + (frameIndex % 5);
    const sliceShift = ((frameIndex * 7) % 11) - 5;

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
  fontFamily: string
) {
  const easeProgress = Math.min(1, tau / 0.3);
  const slideProgress = 1 - Math.pow(1 - easeProgress, 3);
  const startYOffset = 18 * (1 - slideProgress);

  const idleBob = tau > 0.3 ? Math.sin((tau - 0.3) * Math.PI * 4) * 1.5 : 0;
  const currentY = startYOffset + idleBob;

  ctx.font = `bold ${layout.fontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';

  if (tau < 0.25) {
    ctx.fillStyle = '#FFFFFF';
    for (let i = 0; i < layout.lines.length; i++) {
      const y = layout.yOffsets[i] + currentY + 4;
      ctx.fillText(layout.lines[i], 64, y);
    }
  }

  ctx.fillStyle = '#FFFFFF';
  for (let i = 0; i < layout.lines.length; i++) {
    const line = layout.lines[i];
    const y = layout.yOffsets[i] + currentY;
    ctx.fillText(line, 64, y);

    if (i === layout.lines.length - 1) {
      const metrics = ctx.measureText(line);
      const pillWidth = Math.min(metrics.width + 8, (metrics.width + 8) * Math.min(1, tau / 0.4));
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
  fontFamily: string
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

  ctx.save();
  ctx.translate(64, 32);
  ctx.scale(scaleX, scaleY);
  ctx.translate(-64, -32);

  ctx.font = `bold ${layout.fontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';

  const depth = 4;
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
  fontFamily: string
) {
  ctx.font = `bold ${layout.fontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';

  const pulseR = Math.floor((frameIndex * 2) % 24);

  // Concentric expanding outline frames
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;
  for (let i = 0; i < layout.lines.length; i++) {
    const line = layout.lines[i];
    const y = layout.yOffsets[i];

    if (tau > 0.2) {
      // Offset echo echoes
      ctx.strokeText(line, 64 - pulseR / 3, y - pulseR / 4);
      ctx.strokeText(line, 64 + pulseR / 3, y + pulseR / 4);
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
  fontFamily: string
) {
  const ease = Math.min(1, tau / 0.25);
  const scale = 1.8 - 0.8 * ease + Math.sin(tau * Math.PI) * 0.05;

  ctx.save();
  ctx.translate(64, 32);
  ctx.scale(scale, scale);
  ctx.translate(-64, -32);

  ctx.font = `bold ${layout.fontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';

  for (let i = 0; i < layout.lines.length; i++) {
    ctx.fillText(layout.lines[i], 64, layout.yOffsets[i]);
  }

  ctx.restore();

  // Target crosshair brackets framing the display
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;
  const chLen = 8;
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
  fontFamily: string
) {
  const tempCanvas = new OffscreenCanvas(128, 64);
  const tCtx = tempCanvas.getContext('2d')!;

  tCtx.fillStyle = '#000000';
  tCtx.fillRect(0, 0, 128, 64);
  tCtx.font = `bold ${layout.fontSize}px ${fontFamily}`;
  tCtx.textAlign = 'center';
  tCtx.fillStyle = '#FFFFFF';

  for (let i = 0; i < layout.lines.length; i++) {
    tCtx.fillText(layout.lines[i], 64, layout.yOffsets[i]);
  }

  // Slice vertical strips and sine displace
  const stripWidth = 4;
  const numStrips = Math.ceil(128 / stripWidth);

  for (let s = 0; s < numStrips; s++) {
    const sx = s * stripWidth;
    const waveY = Math.round(Math.sin(s * 0.4 + tau * 6 * Math.PI) * 3);
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
  fontFamily: string
) {
  ctx.font = `bold ${layout.fontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';

  const boilPhase = Math.floor(frameIndex / 2.5) % 3;
  const offsetsX = [-1, 1, 0];
  const offsetsY = [0, -1, 1];

  const dx = offsetsX[boilPhase];
  const dy = offsetsY[boilPhase];

  ctx.fillStyle = '#FFFFFF';
  for (let i = 0; i < layout.lines.length; i++) {
    const line = layout.lines[i];
    const y = layout.yOffsets[i];
    ctx.fillText(line, 64 + dx, y + dy);

    if (frameIndex % 3 === 0) {
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
  fontFamily: string
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

  ctx.save();
  ctx.translate(64, 32);
  ctx.scale(scale, scale);
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
