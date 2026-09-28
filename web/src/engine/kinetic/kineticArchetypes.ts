import { MotionArchetype, TextLayoutResult } from './types';

// Bayer 4x4 Dither Matrix for 1-bit surface shading
const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

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
 * 1. MANGA IMPACT: Elastic zoom snap, radial speedlines, 1-frame inversion flash
 */
function renderMangaImpact(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  text: string,
  tau: number,
  layout: TextLayoutResult,
  frameIndex: number,
  fontFamily: string
) {
  // Elastic scale snap from 220% down to 100%
  const scale = tau < 0.25 
    ? 1.0 + 1.2 * Math.pow(1 - tau / 0.25, 3) * Math.cos(tau * 4 * Math.PI)
    : 1.0 + Math.sin((tau - 0.25) * Math.PI * 2) * 0.03;

  ctx.save();
  ctx.translate(64, 32);
  ctx.scale(scale, scale);
  ctx.translate(-64, -32);

  // Radial speedlines bursting during initial impact
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

  // Draw hard drop shadow first (+3px offset)
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

  // Draw main white text
  ctx.fillStyle = '#FFFFFF';
  for (let i = 0; i < layout.lines.length; i++) {
    const line = layout.lines[i];
    const y = layout.yOffsets[i];
    ctx.fillText(line, 64, y);
  }

  ctx.restore();

  // Full-screen inversion flash on exact impact point
  if (tau >= 0.12 && tau <= 0.15) {
    ctx.fillStyle = '#FFFFFF';
    ctx.globalCompositeOperation = 'difference';
    ctx.fillRect(0, 0, 128, 64);
    ctx.globalCompositeOperation = 'source-over';
  }
}

/**
 * 2. CYBER GLITCH: Bitwise XOR row tearing, ASCII scramble before lock
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

  // Scramble text with random hex/cyber symbols for first 20% of duration
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

  // Jitter horizontal offsets
  const jitterX = (tau < 0.3 || (frameIndex % 8 === 0)) ? ((frameIndex * 17) % 7) - 3 : 0;

  // Draw text
  ctx.fillStyle = '#FFFFFF';
  for (let i = 0; i < displayLines.length; i++) {
    ctx.fillText(displayLines[i], 64 + jitterX, layout.yOffsets[i]);
  }

  // Row slice tearing
  if (tau < 0.35 || frameIndex % 6 === 0) {
    const sliceY = (frameIndex * 13) % 48 + 8;
    const sliceH = 4 + (frameIndex % 5);
    const sliceShift = ((frameIndex * 7) % 11) - 5;

    const slice = ctx.getImageData(0, sliceY, 128, sliceH);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, sliceY, 128, sliceH);
    ctx.putImageData(slice, sliceShift, sliceY);
  }

  // Subtle cyber brackets
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;
  ctx.strokeRect(4, 4, 6, 6);
  ctx.strokeRect(118, 54, 6, 6);
}

/**
 * 3. SMOOTH FLUID: Cubic glide, 1-bit Bayer motion trail, harmonic idle bob
 */
function renderSmoothFluid(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  text: string,
  tau: number,
  layout: TextLayoutResult,
  frameIndex: number,
  fontFamily: string
) {
  // Cubic ease-out vertical slide from +18px
  const easeProgress = Math.min(1, tau / 0.3);
  const slideProgress = 1 - Math.pow(1 - easeProgress, 3);
  const startYOffset = 18 * (1 - slideProgress);

  // Harmonic subtle idle bob once settled
  const idleBob = tau > 0.3 ? Math.sin((tau - 0.3) * Math.PI * 4) * 1.5 : 0;
  const currentY = startYOffset + idleBob;

  ctx.font = `bold ${layout.fontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';

  // 1-Bit Motion trail during entry
  if (tau < 0.25) {
    ctx.fillStyle = '#FFFFFF';
    for (let i = 0; i < layout.lines.length; i++) {
      const y = layout.yOffsets[i] + currentY + 4;
      ctx.fillText(layout.lines[i], 64, y);
    }
  }

  // Main crisp glyph
  ctx.fillStyle = '#FFFFFF';
  for (let i = 0; i < layout.lines.length; i++) {
    const line = layout.lines[i];
    const y = layout.yOffsets[i] + currentY;
    ctx.fillText(line, 64, y);

    // Expanding underline pill on active line
    if (i === layout.lines.length - 1) {
      const metrics = ctx.measureText(line);
      const pillWidth = Math.min(metrics.width + 8, (metrics.width + 8) * Math.min(1, tau / 0.4));
      ctx.fillRect(Math.floor(64 - pillWidth / 2), Math.min(61, Math.floor(y + 3)), Math.floor(pillWidth), 2);
    }
  }
}

/**
 * 4. 3D BLOCK STACK: Isometric extrusion with checkerboard dither shadow
 */
function render3DBlockStack(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  text: string,
  tau: number,
  layout: TextLayoutResult,
  frameIndex: number,
  fontFamily: string
) {
  // Inelastic gravity drop with squash
  let dropY = 0;
  let scaleY = 1.0;
  let scaleX = 1.0;

  if (tau < 0.25) {
    const p = tau / 0.25;
    dropY = (1 - p * p) * -24;
  } else if (tau < 0.35) {
    // Landing squash
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

  // Isometric extrusion depth (4 layers along diagonal (+1, +1))
  const depth = 4;
  for (let d = depth; d >= 1; d--) {
    ctx.fillStyle = (d % 2 === 0) ? '#FFFFFF' : '#000000';
    for (let i = 0; i < layout.lines.length; i++) {
      ctx.fillText(layout.lines[i], 64 + d, layout.yOffsets[i] + dropY + d);
    }
  }

  // Front face in crisp white with black outline
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
 * 5. WIGGLY BOIL: 3-phase line boil running at 12 FPS decoupled from 30 FPS clock
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

  // 3-Phase deterministic displacement offsets (cycled at 12 FPS)
  const boilPhase = Math.floor(frameIndex / 2.5) % 3;
  const offsetsX = [-1, 1, 0];
  const offsetsY = [0, -1, 1];

  const dx = offsetsX[boilPhase];
  const dy = offsetsY[boilPhase];

  ctx.fillStyle = '#FFFFFF';
  for (let i = 0; i < layout.lines.length; i++) {
    const line = layout.lines[i];
    const y = layout.yOffsets[i];
    
    // Draw slightly displaced line
    ctx.fillText(line, 64 + dx, y + dy);

    // Stippled hand-drawn frame border
    if (frameIndex % 3 === 0) {
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.strokeRect(2 + dx, 2 + dy, 124, 60);
    }
  }
}

/**
 * 6. INVERTED BADGE: Solid white pill badge with black text cutout
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

  // Calculate bounding box across all lines
  let maxLineWidth = 0;
  for (const l of layout.lines) {
    maxLineWidth = Math.max(maxLineWidth, ctx.measureText(l).width);
  }

  const badgeW = Math.min(124, Math.floor(maxLineWidth + 14));
  const badgeH = Math.min(58, Math.floor(layout.totalHeight + 10));
  const badgeX = Math.floor((128 - badgeW) / 2);
  const badgeY = Math.floor((64 - badgeH) / 2);

  // Badge entry animation: pop scale
  const scale = tau < 0.2 ? Math.min(1, tau / 0.2) : 1.0;

  ctx.save();
  ctx.translate(64, 32);
  ctx.scale(scale, scale);
  ctx.translate(-64, -32);

  // Draw solid white rounded badge
  ctx.fillStyle = '#FFFFFF';
  roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 4);
  ctx.fill();

  // Cutout black text using destination-out
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < layout.lines.length; i++) {
    ctx.fillText(layout.lines[i], 64, layout.yOffsets[i]);
  }

  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

/**
 * Helper to draw rounded rectangle
 */
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
