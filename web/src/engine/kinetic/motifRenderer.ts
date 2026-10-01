import { VisualMotif, MotifMode } from './types';
import { AudioFrameData } from './audioAnalysisEngine';

// =========================================================================
// 1. SCREEN-SPACE HALFTONE & BAYER TEXTURES
// =========================================================================

const BAYER_4X4_NORM = [
  [0 / 16, 8 / 16, 2 / 16, 10 / 16],
  [12 / 16, 4 / 16, 14 / 16, 6 / 16],
  [3 / 16, 11 / 16, 1 / 16, 9 / 16],
  [15 / 16, 7 / 16, 13 / 16, 5 / 16],
];

export type HalftonePatternType = 'stipple_12' | 'stipple_25' | 'diagonal_hatch' | 'radial_vignette';

export function renderHalftoneAccent(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  pattern: HalftonePatternType,
  bounds: { x: number; y: number; w: number; h: number } = { x: 0, y: 0, w: 128, h: 64 },
  focalCenter?: { cx: number; cy: number; radius: number }
): void {
  const { x, y, w, h } = bounds;
  ctx.save();
  ctx.fillStyle = '#FFFFFF';

  for (let py = y; py < y + h; py++) {
    for (let px = x; px < x + w; px++) {
      let isPixelOn = false;

      switch (pattern) {
        case 'stipple_12': // 12.5% whisper density (1 in 8 pixels)
          isPixelOn = (px % 4 === 0 && py % 4 === 0) || (px % 4 === 2 && py % 4 === 2);
          break;

        case 'stipple_25': // 25% classic comic screentone (1 in 4 pixels)
          isPixelOn = (px % 2 === 0 && py % 2 === 0);
          break;

        case 'diagonal_hatch': // 25% diagonal comic lines
          isPixelOn = (px + py) % 4 === 0;
          break;

        case 'radial_vignette': // Bayer vignette glow falling off from focal center
          if (focalCenter) {
            const dx = px - focalCenter.cx;
            const dy = py - focalCenter.cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const normBrightness = Math.max(0, Math.min(1, 1.0 - (dist / focalCenter.radius)));
            const bayerVal = BAYER_4X4_NORM[py % 4][px % 4];
            isPixelOn = normBrightness >= bayerVal;
          }
          break;
      }

      if (isPixelOn) {
        ctx.fillRect(px, py, 1, 1);
      }
    }
  }
  ctx.restore();
}

// =========================================================================
// 2. PROCEDURAL 1-BIT MANGA SPEEDLINES
// =========================================================================

/**
 * Procedural Manga Radial Speedlines (Tapered Wedge Algorithm)
 * Renders authentic ink wedges focused around text with organic grouping.
 */
export function renderMangaRadialSpeedlines(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  cx: number = 64,
  cy: number = 32,
  innerRadiusX: number = 38,
  innerRadiusY: number = 18,
  numRays: number = 24,
  frameIndex: number = 0,
  intensity: number = 1.0
): void {
  ctx.save();
  ctx.fillStyle = '#FFFFFF';

  const phase = frameIndex % 3;
  const angularStep = (Math.PI * 2) / numRays;

  ctx.beginPath();
  for (let i = 0; i < numRays; i++) {
    const baseAngle = i * angularStep + (phase * 0.08);
    const rayHash = Math.sin(i * 127.1 + phase * 311.7);
    if (Math.abs(rayHash) < 0.22) continue; // Natural gaps between lines

    const jitterR = ((i * 13 + phase * 7) % 7) - 3;
    const cosA = Math.cos(baseAngle);
    const sinA = Math.sin(baseAngle);

    const rIn = Math.max(8, Math.sqrt((innerRadiusX * cosA) ** 2 + (innerRadiusY * sinA) ** 2) + jitterR);
    const rOut = 95; // Past 128x64 display corners

    const nx = -sinA;
    const ny = cosA;
    const baseWidth = (1.6 + (Math.abs(rayHash) * 2.2)) * (1.0 + intensity * 0.5);

    const tipX = Math.round(cx + cosA * rIn);
    const tipY = Math.round(cy + sinA * rIn);

    const b1X = Math.round(cx + cosA * rOut + nx * (baseWidth / 2));
    const b1Y = Math.round(cy + sinA * rOut + ny * (baseWidth / 2));

    const b2X = Math.round(cx + cosA * rOut - nx * (baseWidth / 2));
    const b2Y = Math.round(cy + sinA * rOut - ny * (baseWidth / 2));

    ctx.moveTo(tipX, tipY);
    ctx.lineTo(b1X, b1Y);
    ctx.lineTo(b2X, b2Y);
    ctx.closePath();
  }
  ctx.fill();
  ctx.restore();
}

/**
 * Procedural Horizontal Anime Rush Lines (Nagare-sen)
 */
export function renderAnimeRushLines(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  tau: number,
  frameIndex: number,
  direction: 'left-to-right' | 'right-to-left' = 'left-to-right',
  speedMultiplier: number = 1.0
): void {
  ctx.save();
  ctx.fillStyle = '#FFFFFF';

  const numStreaks = 20;
  const dirSign = direction === 'left-to-right' ? 1 : -1;
  const globalVelocity = (frameIndex * 10 * speedMultiplier) % 192;

  for (let i = 0; i < numStreaks; i++) {
    const laneY = (i * 19 + 4) % 64;
    const length = 18 + ((i * 31) % 36);
    const streakSpeed = 1.0 + ((i % 5) * 0.3);

    let rawX = (i * 37 + globalVelocity * streakSpeed * dirSign) % 192;
    if (rawX < -40) rawX += 192;
    const startX = Math.floor(rawX - 32);
    const thickness = (i % 4 === 0) ? 2 : 1;

    ctx.fillRect(startX, laneY, length, thickness);

    // Speed dot trail
    const dashOffset = direction === 'left-to-right' ? -5 : length + 3;
    ctx.fillRect(startX + dashOffset, laneY, 2, thickness);
  }
  ctx.restore();
}

// =========================================================================
// 3. THEMATIC PROCEDURAL VISUAL MOTIFS
// =========================================================================

/**
 * 👑 Basquiat / Gothic 3-Point Royal Crown
 */
export function drawBasquiatCrown(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  cx: number = 64,
  cy: number = 15,
  width: number = 22,
  height: number = 12
): void {
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;

  const hw = width / 2;
  const left = cx - hw;
  const right = cx + hw;
  const bottom = cy + height / 2;
  const top = cy - height / 2;
  const midPeakY = top - 3;

  ctx.beginPath();
  ctx.moveTo(left, bottom);
  ctx.lineTo(left, top);           // Left peak
  ctx.lineTo(left + hw * 0.45, cy); // Left valley
  ctx.lineTo(cx, midPeakY);        // Center peak
  ctx.lineTo(right - hw * 0.45, cy);// Right valley
  ctx.lineTo(right, top);          // Right peak
  ctx.lineTo(right, bottom);
  ctx.closePath();
  ctx.stroke();

  // Solid base bar
  ctx.fillRect(left, bottom - 2, width, 2);
  // Crown jewels
  ctx.fillRect(left - 1, top - 2, 2, 2);
  ctx.fillRect(cx - 1, midPeakY - 2, 2, 2);
  ctx.fillRect(right - 1, top - 2, 2, 2);
  ctx.restore();
}

/**
 * 🗡️ Razor Cut Slice Line with Glint
 */
export function drawRazorCut(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  x0: number = 0,
  y0: number = 40,
  x1: number = 128,
  y1: number = 24,
  progress: number = 1.0
): void {
  ctx.save();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2;

  const curX = x0 + (x1 - x0) * Math.min(1, progress / 0.35);
  const curY = y0 + (y1 - y0) * Math.min(1, progress / 0.35);

  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(curX, curY);
  ctx.stroke();

  if (progress < 0.4) {
    drawChromeStar(ctx, curX, curY, 4);
  }
  ctx.restore();
}

/**
 * 🎯 Tactical Scope / HUD Framing Reticle
 */
export function drawTacticalCrosshairs(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  cx: number = 64,
  cy: number = 32,
  size: number = 26,
  snapProgress: number = 1.0
): void {
  ctx.save();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;

  const currentSize = size + (1.0 - Math.min(1, snapProgress)) * 16;
  const x0 = Math.round(cx - currentSize);
  const x1 = Math.round(cx + currentSize);
  const y0 = Math.round(cy - currentSize * 0.55);
  const y1 = Math.round(cy + currentSize * 0.55);
  const bracketLen = 6;

  ctx.beginPath();
  // Top-Left
  ctx.moveTo(x0, y0 + bracketLen); ctx.lineTo(x0, y0); ctx.lineTo(x0 + bracketLen, y0);
  // Top-Right
  ctx.moveTo(x1 - bracketLen, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1, y0 + bracketLen);
  // Bottom-Left
  ctx.moveTo(x0, y1 - bracketLen); ctx.lineTo(x0, y1); ctx.lineTo(x0 + bracketLen, y1);
  // Bottom-Right
  ctx.moveTo(x1 - bracketLen, y1); ctx.lineTo(x1, y1); ctx.lineTo(x1, y1 - bracketLen);
  ctx.stroke();

  // Crosshair center marks
  ctx.beginPath();
  ctx.moveTo(cx - 5, cy); ctx.lineTo(cx - 2, cy);
  ctx.moveTo(cx + 2, cy); ctx.lineTo(cx + 5, cy);
  ctx.moveTo(cx, cy - 4); ctx.lineTo(cx, cy - 2);
  ctx.moveTo(cx, cy + 2); ctx.lineTo(cx, cy + 4);
  ctx.stroke();
  ctx.restore();
}

/**
 * 🔥 Procedural Inferno Flame Contours & Embers
 */
export function drawProceduralFlames(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  bottomY: number = 63,
  frameIndex: number = 0
): void {
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  const numTongues = 16;
  const tongueWidth = 8;

  for (let i = 0; i < numTongues; i++) {
    const baseX = i * tongueWidth;
    const hNoise = Math.sin(i * 1.7 + frameIndex * 0.4) * 4 + Math.cos(i * 3.1 - frameIndex * 0.3) * 3;
    const flameH = Math.max(4, 10 + hNoise);
    const tipX = baseX + tongueWidth / 2 + Math.sin(frameIndex * 0.25 + i) * 2;

    ctx.beginPath();
    ctx.moveTo(baseX, bottomY);
    ctx.quadraticCurveTo(baseX + 1, bottomY - flameH * 0.6, tipX, bottomY - flameH);
    ctx.quadraticCurveTo(baseX + tongueWidth - 1, bottomY - flameH * 0.6, baseX + tongueWidth, bottomY);
    ctx.closePath();
    ctx.fill();

    // Detached rising ember
    if ((i + frameIndex) % 3 === 0) {
      const emberY = Math.round(bottomY - flameH - 3 - ((frameIndex * 2 + i * 5) % 12));
      ctx.fillRect(Math.round(tipX), emberY, 1, 1);
    }
  }
  ctx.restore();
}

/**
 * 💀 12x12 Skull Micro-Sprite Stamp
 */
const SKULL_12X12_MAP = [
  0b000011110000,
  0b001111111100,
  0b011111111110,
  0b011111111110,
  0b010010010010, // Eyes
  0b010010010010,
  0b011111111110,
  0b001111111100,
  0b000101010000, // Teeth
  0b001111111100  // Jaw
];

export function drawSkullMicroSprite(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  x: number = 58,
  y: number = 8,
  invert: boolean = false
): void {
  ctx.save();
  ctx.fillStyle = invert ? '#000000' : '#FFFFFF';
  for (let r = 0; r < SKULL_12X12_MAP.length; r++) {
    const row = SKULL_12X12_MAP[r];
    for (let c = 0; c < 12; c++) {
      if ((row & (1 << (11 - c))) !== 0) {
        ctx.fillRect(x + c, y + r, 1, 1);
      }
    }
  }
  ctx.restore();
}

/**
 * ✨ 4-Point Concave Chrome Star / Anime Diamond Glint
 */
export function drawChromeStar(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number = 6
): void {
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(cx, cy - radius);
  ctx.quadraticCurveTo(cx, cy, cx + radius, cy);
  ctx.quadraticCurveTo(cx, cy, cx, cy + radius);
  ctx.quadraticCurveTo(cx, cy, cx - radius, cy);
  ctx.quadraticCurveTo(cx, cy, cx, cy - radius);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(cx - 1, cy - 1, 2, 2);
  ctx.restore();
}

/**
 * ⚡ High-Voltage Lightning Bolt
 */
export function drawLightningBolt(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  startX: number = 64,
  startY: number = 2,
  length: number = 30,
  frameIndex: number = 0
): void {
  ctx.save();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;

  const seed = (frameIndex % 3) * 2;
  const p1X = startX + 5 + seed;
  const p1Y = startY + length * 0.35;
  const p2X = p1X - 7;
  const p2Y = p1Y;
  const p3X = p2X + 6 - seed;
  const p3Y = startY + length * 0.7;
  const p4X = p3X - 5;
  const p4Y = startY + length;

  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(p1X, p1Y);
  ctx.lineTo(p2X, p2Y);
  ctx.lineTo(p3X, p3Y);
  ctx.lineTo(p4X, p4Y);
  ctx.stroke();
  ctx.restore();
}

/**
 * 🗯️ 14-Point Pop-Art Comic Starburst Impact Bubble
 */
export function drawComicBurstBubble(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  cx: number = 64,
  cy: number = 32,
  innerRadius: number = 22,
  outerRadius: number = 32,
  spikes: number = 14,
  frameIndex: number = 0
): void {
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  let rot = (Math.PI / 2) * 3 + (frameIndex % 3) * 0.1;
  const step = Math.PI / spikes;

  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);

  for (let i = 0; i < spikes; i++) {
    const rOut = outerRadius + ((i * 7 + frameIndex) % 5) - 2;
    const x = cx + Math.cos(rot) * rOut;
    const y = cy + Math.sin(rot) * rOut;
    ctx.lineTo(x, y);
    rot += step;

    const inX = cx + Math.cos(rot) * innerRadius;
    const inY = cy + Math.sin(rot) * innerRadius;
    ctx.lineTo(inX, inY);
    rot += step;
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// =========================================================================
// 4. 1-BIT SILHOUETTE KNOCKOUT HALO (LEGAL GUARANTEE OVER MOTIFS)
// =========================================================================

/**
 * Double-Pass Text Silhouetting:
 * 1. Draws solid 3px black stroke (#000000) creating an exact 1.5px moat.
 * 2. Draws crisp white fill (#FFFFFF) on top.
 * Guaranteed 100% readable text over any speedlines, dither, or motifs!
 */
export function renderSilhouetteText(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  lines: string[],
  x: number = 64,
  yOffsets: number[],
  font: string,
  haloSize: number = 3
): void {
  ctx.save();
  ctx.font = font;
  ctx.textAlign = 'center';

  // PASS 1: Black knockout halo stroke (erases background underneath glyph contours)
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = haloSize;
  ctx.lineJoin = 'miter';
  ctx.miterLimit = 2;
  for (let i = 0; i < lines.length; i++) {
    ctx.strokeText(lines[i], x, yOffsets[i]);
  }

  // PASS 2: Crisp white glyph core fill
  ctx.fillStyle = '#FFFFFF';
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x, yOffsets[i]);
  }
  ctx.restore();
}

// =========================================================================
// 5. MASTER MOTIF LAYER COMPOSITOR
// =========================================================================

export interface MotifRenderContext {
  motif: VisualMotif;
  motifMode: MotifMode;
  tau: number;
  frameIndex: number;
  textCenterY?: number;
  audioFrame?: AudioFrameData;
  isRTL?: boolean;
}

/**
 * Renders the background motif stage before primary text is drawn.
 */
export function renderMotifBackground(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  rc: MotifRenderContext
): void {
  const { motif, motifMode, tau, frameIndex, audioFrame, isRTL } = rc;

  // If motifs are disabled globally, exit immediately
  if (motifMode === 'off' || motif === 'none') {
    return;
  }

  const isBeat = audioFrame?.isBeat ?? false;
  const bass = audioFrame?.bass ?? 0;

  // Subtle Mode: Only draw subtle speedlines on heavy beats or drops
  if (motifMode === 'subtle') {
    if (isBeat || bass > 0.75) {
      renderMangaRadialSpeedlines(ctx, 64, 32, 42, 22, 16, frameIndex, 0.8);
    }
    return;
  }

  // Heavy Mode: Add screen-space halftone background texture
  if (motifMode === 'heavy') {
    renderHalftoneAccent(ctx, 'stipple_12', { x: 0, y: 0, w: 128, h: 64 });
  }

  // Dynamic & Heavy Modes: Render active motif
  switch (motif) {
    case 'manga_speedlines':
      renderMangaRadialSpeedlines(ctx, 64, 32, 40, 20, 26, frameIndex, isBeat ? 1.6 : bass);
      break;

    case 'anime_rush':
      renderAnimeRushLines(ctx, tau, frameIndex, isRTL ? 'right-to-left' : 'left-to-right', isBeat ? 1.8 : 1.0);
      break;

    case 'crown_royal':
      // Floating royal crown above text
      drawBasquiatCrown(ctx, 64, 12 + (Math.sin(tau * Math.PI * 2) * 2), 24, 12);
      break;

    case 'razor_blade':
      drawRazorCut(ctx, 0, 42, 128, 22, tau);
      break;

    case 'tactical_scope':
      drawTacticalCrosshairs(ctx, 64, 32, 28, Math.min(1, tau / 0.25));
      break;

    case 'flame_tongue':
      drawProceduralFlames(ctx, 63, frameIndex);
      break;

    case 'skull_cross':
      drawSkullMicroSprite(ctx, 58, 8);
      break;

    case 'chrome_star':
      // Diamond glint stars flanking the corners
      drawChromeStar(ctx, 16, 16, 5 + Math.sin(tau * Math.PI * 4) * 2);
      drawChromeStar(ctx, 112, 16, 6 + Math.cos(tau * Math.PI * 4) * 2);
      break;

    case 'lightning_arc':
      drawLightningBolt(ctx, 24, 4, 32, frameIndex);
      drawLightningBolt(ctx, 104, 4, 32, frameIndex + 1);
      break;

    case 'comic_burst':
      if (tau < 0.45) {
        drawComicBurstBubble(ctx, 64, 32, 26, 38, 14, frameIndex);
      }
      break;
  }
}
