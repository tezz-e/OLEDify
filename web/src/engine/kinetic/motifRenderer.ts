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
  if (typeof (ctx as any).quadraticCurveTo === 'function') {
    ctx.quadraticCurveTo(cx, cy, cx + radius, cy);
    ctx.quadraticCurveTo(cx, cy, cx, cy + radius);
    ctx.quadraticCurveTo(cx, cy, cx - radius, cy);
    ctx.quadraticCurveTo(cx, cy, cx, cy - radius);
  } else {
    ctx.lineTo(cx + radius, cy);
    ctx.lineTo(cx, cy + radius);
    ctx.lineTo(cx - radius, cy);
    ctx.lineTo(cx, cy - radius);
  }
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

    case 'floating_notes':
      drawFloatingNotes(ctx, frameIndex);
      break;

    case 'starlight_glimmer':
      drawStarlightGlimmer(ctx, frameIndex);
      break;

    case 'heartbeat_pulse':
      drawHeartbeatPulse(ctx, frameIndex, tau);
      break;

    case 'water_ripples':
      drawWaterRipples(ctx, frameIndex);
      break;

    case 'minimal_frame':
      drawMinimalFrame(ctx, tau);
      break;

    case 'lofi_dust_motes':
      drawLofiDustMotes(ctx, frameIndex);
      break;

    case 'barbed_wire':
      drawBarbedWire(ctx, frameIndex);
      break;

    case 'sound_blast_rings':
      drawSoundBlastRings(ctx, tau, isBeat);
      break;

    case 'shattered_glass':
      drawShatteredGlass(ctx, tau);
      break;

    case 'sound_bars_vintage':
      drawSoundBarsVintage(ctx, frameIndex, audioFrame);
      break;

    case 'rain_window':
      drawRainWindow(ctx, frameIndex);
      break;

    case 'cassette_spool':
      drawCassetteSpool(ctx, frameIndex);
      break;

    case 'equalizer_radial':
      drawEqualizerRadial(ctx, frameIndex, audioFrame);
      break;

    case 'vinyl_grooves':
      drawVinylGrooves(ctx, frameIndex);
      break;

    case 'handlebar_moustache':
      drawHandlebarMoustache(ctx, 64, 16, 44, tau, frameIndex);
      break;

    case 'dark_sunglasses':
      drawDarkSunglasses(ctx, 64, 16, 42, tau, frameIndex);
      break;

    case 'money_stack':
      drawMoneyStack(ctx, tau, frameIndex, audioFrame);
      break;

    case 'street_racer':
      drawStreetRacer(ctx, tau, frameIndex, audioFrame);
      break;

    case 'cracked_heart':
      drawCrackedHeart(ctx, 64, 18, 16, tau, frameIndex);
      break;

    case 'crossed_swords':
      drawCrossedSwords(ctx, 64, 18, 22, tau, frameIndex);
      break;

    case 'champion_trophy':
      drawChampionTrophy(ctx, 64, 18, 18, tau, frameIndex);
      break;

    case 'lucky_dice':
      drawLuckyDice(ctx, 64, 18, 14, tau, frameIndex);
      break;

    case 'rolex_watch':
      drawRolexWatch(ctx, 64, 18, 13, tau, frameIndex);
      break;
  }
}

function drawFloatingNotes(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  frameIndex: number
) {
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;

  const noteSeeds = [
    { x0: 16, y0: 50, speed: 0.5, isDouble: false },
    { x0: 38, y0: 58, speed: 0.7, isDouble: true },
    { x0: 90, y0: 48, speed: 0.6, isDouble: false },
    { x0: 112, y0: 56, speed: 0.75, isDouble: true },
  ];

  for (let i = 0; i < noteSeeds.length; i++) {
    const seed = noteSeeds[i];
    const y = Math.round(64 - ((frameIndex * seed.speed + seed.y0) % 70));
    if (y < 4 || y > 60) continue;

    const sway = Math.round(Math.sin((frameIndex * 0.08) + i * 2) * 3);
    const x = seed.x0 + sway;

    if (!seed.isDouble) {
      // Single eighth note (♪)
      ctx.beginPath();
      ctx.ellipse(x, y, 2, 1.5, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(x + 1, y - 6, 1, 6);
      ctx.fillRect(x + 2, y - 6, 2, 1);
    } else {
      // Beamed sixteenth pair (♫)
      ctx.beginPath();
      ctx.ellipse(x, y, 2, 1.5, -0.2, 0, Math.PI * 2);
      ctx.ellipse(x + 6, y - 1, 2, 1.5, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(x + 1, y - 6, 1, 6);
      ctx.fillRect(x + 7, y - 7, 1, 6);
      ctx.fillRect(x + 1, y - 6, 7, 2);
    }
  }
  ctx.restore();
}

function drawStarlightGlimmer(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  frameIndex: number
) {
  ctx.save();
  ctx.fillStyle = '#FFFFFF';

  const stars = [
    { x: 12, y: 10, offset: 0 },
    { x: 34, y: 14, offset: 12 },
    { x: 58, y: 8, offset: 24 },
    { x: 80, y: 12, offset: 36 },
    { x: 104, y: 10, offset: 48 },
    { x: 120, y: 18, offset: 16 },
    { x: 8, y: 52, offset: 30 },
    { x: 26, y: 56, offset: 42 },
    { x: 64, y: 54, offset: 18 },
    { x: 96, y: 56, offset: 6 },
    { x: 118, y: 50, offset: 28 },
  ];

  for (const s of stars) {
    const phase = Math.sin(((frameIndex + s.offset) % 40) / 40 * Math.PI * 2);
    if (phase < -0.2) continue;

    if (phase < 0.4) {
      ctx.fillRect(s.x, s.y, 1, 1);
    } else if (phase < 0.8) {
      ctx.fillRect(s.x, s.y, 1, 1);
      ctx.fillRect(s.x - 1, s.y, 3, 1);
      ctx.fillRect(s.x, s.y - 1, 1, 3);
    } else {
      ctx.fillRect(s.x - 1, s.y, 3, 1);
      ctx.fillRect(s.x, s.y - 1, 1, 3);
      ctx.fillRect(s.x - 2, s.y, 5, 1);
      ctx.fillRect(s.x, s.y - 2, 1, 5);
    }
  }
  ctx.restore();
}

function drawHeartbeatPulse(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  frameIndex: number,
  _tau: number
) {
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#FFFFFF';

  const cx = 64;
  const cy = 12;

  const beatCycle = (frameIndex % 32) / 32;
  const pump1 = Math.exp(-25 * Math.pow(beatCycle - 0.15, 2)) * 0.3;
  const pump2 = Math.exp(-35 * Math.pow(beatCycle - 0.38, 2)) * 0.15;
  const scale = 1.0 + pump1 + pump2;

  const HEART_ROWS = [
    [0, 1, 1, 0, 1, 1, 0],
    [1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1],
    [0, 1, 1, 1, 1, 1, 0],
    [0, 0, 1, 1, 1, 0, 0],
    [0, 0, 0, 1, 0, 0, 0]
  ];

  const ox = Math.round(cx - 3.5 * scale);
  const oy = Math.round(cy - 3 * scale);

  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 7; c++) {
      if (HEART_ROWS[r][c] === 1) {
        ctx.fillRect(Math.round(ox + c * scale), Math.round(oy + r * scale), Math.max(1, Math.round(scale)), Math.max(1, Math.round(scale)));
      }
    }
  }

  const rippleR = Math.round((beatCycle * 32)) % 28;
  if (rippleR > 4) {
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 2, rippleR * 1.4, rippleR * 0.7, 0, 0, Math.PI * 2);
    if (rippleR % 2 === 0) {
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawWaterRipples(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  frameIndex: number
) {
  ctx.save();
  ctx.fillStyle = '#FFFFFF';

  for (let x = 0; x < 128; x++) {
    const y1 = Math.round(55 + 2.0 * Math.sin(0.09 * x + frameIndex * 0.08));
    const y2 = Math.round(59 + 1.5 * Math.sin(0.14 * x - frameIndex * 0.06));

    if (y1 >= 0 && y1 < 64) ctx.fillRect(x, y1, 1, 1);
    if (y2 >= 0 && y2 < 64) ctx.fillRect(x, y2, 1, 1);

    if ((x + frameIndex) % 4 === 0 && (y2 + 2) < 64) {
      ctx.fillRect(x, y2 + 2, 1, 1);
    }
  }
  ctx.restore();
}

function drawMinimalFrame(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  _tau: number
) {
  ctx.save();
  ctx.strokeStyle = '#FFFFFF';
  ctx.fillStyle = '#FFFFFF';
  ctx.lineWidth = 1;

  const pad = 2;
  const notch = 6;
  const x1 = pad, x2 = 127 - pad;
  const y1 = pad, y2 = 63 - pad;

  ctx.beginPath();
  ctx.moveTo(x1 + notch, y1);
  ctx.lineTo(x2 - notch, y1);
  ctx.moveTo(x1 + notch, y2);
  ctx.lineTo(x2 - notch, y2);
  ctx.moveTo(x1, y1 + notch);
  ctx.lineTo(x1, y2 - notch);
  ctx.moveTo(x2, y1 + notch);
  ctx.lineTo(x2, y2 - notch);
  ctx.stroke();

  ctx.fillRect(x1 + 1, y1 + 1, 2, 2);
  ctx.fillRect(x2 - 2, y1 + 1, 2, 2);
  ctx.fillRect(x1 + 1, y2 - 2, 2, 2);
  ctx.fillRect(x2 - 2, y2 - 2, 2, 2);

  ctx.restore();
}

function drawLofiDustMotes(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  frameIndex: number
) {
  ctx.save();
  ctx.fillStyle = '#FFFFFF';

  const MOTES = [
    { x0: 14, y0: 20, vx: 0.2, vy: 0.15 },
    { x0: 32, y0: 45, vx: -0.15, vy: 0.2 },
    { x0: 55, y0: 12, vx: 0.25, vy: -0.1 },
    { x0: 74, y0: 50, vx: -0.2, vy: 0.18 },
    { x0: 98, y0: 24, vx: 0.18, vy: 0.22 },
    { x0: 114, y0: 42, vx: -0.12, vy: -0.15 },
    { x0: 45, y0: 30, vx: 0.1, vy: -0.2 },
    { x0: 85, y0: 15, vx: -0.16, vy: 0.12 }
  ];

  for (const m of MOTES) {
    const x = Math.round((m.x0 + m.vx * frameIndex + Math.sin(frameIndex * 0.05 + m.y0) * 4 + 128) % 128);
    const y = Math.round((m.y0 + m.vy * frameIndex + Math.cos(frameIndex * 0.05 + m.x0) * 3 + 64) % 64);
    if ((x + y + frameIndex) % 2 === 0) {
      ctx.fillRect(x, y, 1, 1);
    }
  }

  ctx.restore();
}

function drawBarbedWire(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  _frameIndex: number
) {
  ctx.save();
  ctx.strokeStyle = '#FFFFFF';
  ctx.fillStyle = '#FFFFFF';
  ctx.lineWidth = 1;

  // Diagonal strand across top-left corner
  ctx.beginPath();
  ctx.moveTo(0, 18);
  ctx.lineTo(36, 0);
  ctx.stroke();

  // Diagonal strand across bottom-right corner
  ctx.beginPath();
  ctx.moveTo(92, 63);
  ctx.lineTo(127, 45);
  ctx.stroke();

  // Draw coiled barbs along the strands
  const barbOffsets = [8, 20, 32];
  for (const t of barbOffsets) {
    const x1 = Math.round(t);
    const y1 = Math.round(18 - (t * 18) / 36);
    ctx.fillRect(x1 - 1, y1 - 2, 3, 5);
    ctx.beginPath();
    ctx.moveTo(x1 - 3, y1 - 3);
    ctx.lineTo(x1 + 3, y1 + 3);
    ctx.moveTo(x1 - 3, y1 + 3);
    ctx.lineTo(x1 + 3, y1 - 3);
    ctx.stroke();

    const x2 = Math.round(92 + t);
    const y2 = Math.round(63 - (t * 18) / 35);
    ctx.fillRect(x2 - 1, y2 - 2, 3, 5);
    ctx.beginPath();
    ctx.moveTo(x2 - 3, y2 - 3);
    ctx.lineTo(x2 + 3, y2 + 3);
    ctx.moveTo(x2 - 3, y2 + 3);
    ctx.lineTo(x2 + 3, y2 - 3);
    ctx.stroke();
  }

  ctx.restore();
}

function drawSoundBlastRings(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  tau: number,
  _isBeat: boolean
) {
  ctx.save();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;

  const numRings = 3;
  for (let r = 0; r < numRings; r++) {
    const ringPhase = (tau * 1.5 + r / numRings) % 1.0;
    const radX = Math.round(20 + ringPhase * 44);
    const radY = Math.round(10 + ringPhase * 22);

    if (ringPhase < 0.85) {
      ctx.beginPath();
      if (typeof (ctx as any).ellipse === 'function') {
        (ctx as any).ellipse(64, 32, radX, radY, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.arc(64, 32, radX, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  ctx.restore();
}

function drawShatteredGlass(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  tau: number
) {
  ctx.save();
  ctx.strokeStyle = '#FFFFFF';
  ctx.fillStyle = '#FFFFFF';
  ctx.lineWidth = 1;

  const SHARDS = [
    { angle: -0.8, dist: 38, w: 7, h: 5 },
    { angle: 0.6, dist: 42, w: 6, h: 8 },
    { angle: 2.2, dist: 36, w: 8, h: 6 },
    { angle: -2.3, dist: 40, w: 7, h: 7 },
    { angle: 1.4, dist: 34, w: 5, h: 7 },
    { angle: -1.7, dist: 35, w: 6, h: 5 }
  ];

  const flyProgress = Math.min(1, tau * 1.2);
  for (const s of SHARDS) {
    const curDist = s.dist * flyProgress;
    const cx = Math.round(64 + Math.cos(s.angle) * curDist);
    const cy = Math.round(32 + Math.sin(s.angle) * curDist);

    if (cx >= 2 && cx <= 125 && cy >= 2 && cy <= 61) {
      ctx.beginPath();
      ctx.moveTo(cx, cy - s.h / 2);
      ctx.lineTo(cx + s.w / 2, cy + s.h / 2);
      ctx.lineTo(cx - s.w / 2, cy + s.h / 4);
      ctx.closePath();
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawSoundBarsVintage(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  frameIndex: number,
  audioFrame?: AudioFrameData
) {
  ctx.save();
  ctx.fillStyle = '#FFFFFF';

  const numBars = 16;
  const barWidth = 5;
  const gap = 3;
  const startX = Math.round((128 - (numBars * (barWidth + gap) - gap)) / 2);
  const baseY = 62;

  for (let b = 0; b < numBars; b++) {
    const harmonic = Math.sin(frameIndex * 0.2 + b * 0.45) * 0.5 + 0.5;
    const beatBump = audioFrame?.isBeat ? 4 : 0;
    const barHeight = Math.max(2, Math.min(14, Math.round(harmonic * 9 + beatBump)));

    const bx = startX + b * (barWidth + gap);
    for (let h = 0; h < barHeight; h += 3) {
      ctx.fillRect(bx, baseY - h - 2, barWidth, 2);
    }
  }

  ctx.restore();
}

function drawRainWindow(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  frameIndex: number
) {
  ctx.save();
  ctx.strokeStyle = '#FFFFFF';
  ctx.fillStyle = '#FFFFFF';
  ctx.lineWidth = 1;

  const RAIN_DROPS = [
    { x0: 10, y0: 0, len: 7, speed: 3.2 },
    { x0: 24, y0: 20, len: 6, speed: 2.8 },
    { x0: 38, y0: 8, len: 8, speed: 3.5 },
    { x0: 52, y0: 30, len: 5, speed: 3.0 },
    { x0: 68, y0: 15, len: 7, speed: 3.4 },
    { x0: 82, y0: 5, len: 6, speed: 2.9 },
    { x0: 96, y0: 25, len: 8, speed: 3.6 },
    { x0: 112, y0: 12, len: 6, speed: 3.1 },
    { x0: 18, y0: 42, len: 5, speed: 3.3 },
    { x0: 75, y0: 38, len: 7, speed: 3.0 }
  ];

  for (const drop of RAIN_DROPS) {
    const curY = (drop.y0 + frameIndex * drop.speed) % 72;
    const curX = drop.x0 + Math.round(curY * 0.25);

    if (curY >= 0 && curY < 64 && curX < 128) {
      ctx.beginPath();
      ctx.moveTo(curX, curY);
      ctx.lineTo(curX + 2, curY + drop.len);
      ctx.stroke();

      if (curY > 56) {
        ctx.fillRect(curX - 1, 62, 3, 1);
      }
    }
  }

  ctx.restore();
}

function drawCassetteSpool(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  frameIndex: number
) {
  ctx.save();
  ctx.strokeStyle = '#FFFFFF';
  ctx.fillStyle = '#FFFFFF';
  ctx.lineWidth = 1;

  const spools = [
    { cx: 20, cy: 32 },
    { cx: 108, cy: 32 }
  ];

  const angle = (frameIndex * 0.12) % (Math.PI * 2);

  for (const s of spools) {
    ctx.beginPath();
    ctx.arc(s.cx, s.cy, 9, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(s.cx, s.cy, 3, 0, Math.PI * 2);
    ctx.fill();

    for (let a = 0; a < 3; a++) {
      const spokeAngle = angle + (a * Math.PI * 2) / 3;
      const sx = s.cx + Math.cos(spokeAngle) * 8;
      const sy = s.cy + Math.sin(spokeAngle) * 8;
      ctx.beginPath();
      ctx.moveTo(s.cx, s.cy);
      ctx.lineTo(sx, sy);
      ctx.stroke();
    }
  }

  ctx.beginPath();
  ctx.moveTo(20, 41);
  ctx.lineTo(108, 41);
  ctx.stroke();

  ctx.restore();
}

function drawEqualizerRadial(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  frameIndex: number,
  audioFrame?: AudioFrameData
) {
  ctx.save();
  ctx.strokeStyle = '#FFFFFF';
  ctx.fillStyle = '#FFFFFF';
  ctx.lineWidth = 1;

  const numRays = 20;
  const cx = 64;
  const cy = 32;
  const baseR = 24;

  for (let i = 0; i < numRays; i++) {
    const angle = (i * Math.PI * 2) / numRays + frameIndex * 0.02;
    const harmonic = Math.sin(i * 1.5 + frameIndex * 0.25) * 0.5 + 0.5;
    const length = 3 + harmonic * 8 + (audioFrame?.isBeat ? 3 : 0);

    const x1 = Math.round(cx + Math.cos(angle) * (baseR + 2));
    const y1 = Math.round(cy + Math.sin(angle) * (baseR + 2));
    const x2 = Math.round(cx + Math.cos(angle) * (baseR + 2 + length));
    const y2 = Math.round(cy + Math.sin(angle) * (baseR + 2 + length));

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawVinylGrooves(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  frameIndex: number
) {
  ctx.save();
  ctx.strokeStyle = '#FFFFFF';
  ctx.fillStyle = '#FFFFFF';
  ctx.lineWidth = 1;

  const radii = [14, 20, 26, 32];
  for (const r of radii) {
    ctx.beginPath();
    if (typeof (ctx as any).ellipse === 'function') {
      (ctx as any).ellipse(64, 32, r * 1.4, r * 0.75, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.arc(64, 32, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  ctx.beginPath();
  ctx.arc(64, 32, 2, 0, Math.PI * 2);
  ctx.fill();

  const angle = (frameIndex * 0.08) % Math.PI;
  const glintLen = 22;
  ctx.beginPath();
  ctx.moveTo(64 + Math.cos(angle) * 12, 32 + Math.sin(angle) * 6);
  ctx.lineTo(64 + Math.cos(angle) * (12 + glintLen), 32 + Math.sin(angle) * (6 + glintLen * 0.5));
  ctx.moveTo(64 - Math.cos(angle) * 12, 32 - Math.sin(angle) * 6);
  ctx.lineTo(64 - Math.cos(angle) * (12 + glintLen), 32 - Math.sin(angle) * (6 + glintLen * 0.5));
  ctx.stroke();

  ctx.restore();
}

/**
 * 🥸 Royal Handlebar Moustache (Twirled tips & swagger tilt)
 */
export function drawHandlebarMoustache(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  cx: number = 64,
  cy: number = 16,
  width: number = 44,
  tau: number = 1.0,
  frameIndex: number = 0
): void {
  ctx.save();
  const tilt = Math.sin(tau * Math.PI * 2) * 0.08;
  const floatY = cy + Math.sin(tau * Math.PI * 2) * 1.5;
  ctx.translate(cx, floatY);
  ctx.rotate(tilt);

  // Black knockout barrier
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.fillStyle = '#FFFFFF';

  // Draw symmetric twirled moustache
  const hw = width / 2;
  ctx.beginPath();
  // Center philtrum
  ctx.moveTo(0, 1);
  // Left half upper curve
  ctx.bezierCurveTo(-hw * 0.3, -2, -hw * 0.7, -4, -hw, -6);
  // Left curl outward and back in
  ctx.bezierCurveTo(-hw * 1.08, -8, -hw * 1.05, -1, -hw * 0.85, 2);
  // Left lower belly curve to center
  ctx.bezierCurveTo(-hw * 0.5, 6, -hw * 0.2, 5, 0, 3);
  // Right lower belly curve
  ctx.bezierCurveTo(hw * 0.2, 5, hw * 0.5, 6, hw * 0.85, 2);
  // Right curl outward and back in
  ctx.bezierCurveTo(hw * 1.05, -1, hw * 1.08, -8, hw, -6);
  // Right half upper curve to center philtrum
  ctx.bezierCurveTo(hw * 0.7, -4, hw * 0.3, -2, 0, 1);
  ctx.closePath();

  ctx.stroke();
  ctx.fill();

  // Fine 1-bit center divider cleft
  ctx.fillStyle = '#000000';
  ctx.fillRect(-0.5, 0, 1, 3);

  ctx.restore();
}

/**
 * 🕶️ Dark Sunglasses with Sweeping Specular Glare
 */
export function drawDarkSunglasses(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  cx: number = 64,
  cy: number = 16,
  width: number = 42,
  tau: number = 1.0,
  frameIndex: number = 0
): void {
  ctx.save();
  const floatY = cy + Math.sin(tau * Math.PI * 2) * 1.5;
  ctx.translate(cx, floatY);

  const lensW = Math.round(width * 0.42);
  const lensH = 11;
  const gap = 4;
  const halfGap = gap / 2;

  // Solid black knockout barrier behind sunglasses
  ctx.fillStyle = '#000000';
  ctx.fillRect(-width / 2 - 2, -lensH / 2 - 2, width + 4, lensH + 4);

  // White frames
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(-halfGap - lensW - 1, -lensH / 2 - 1, lensW + 2, lensH + 2);
  ctx.fillRect(halfGap - 1, -lensH / 2 - 1, lensW + 2, lensH + 2);
  // Top brow line & bridge
  ctx.fillRect(-halfGap - lensW - 1, -lensH / 2 - 2, width + 2, 2);
  ctx.fillRect(-halfGap, -1, gap, 2);

  // Black lenses inside
  ctx.fillStyle = '#000000';
  ctx.fillRect(-halfGap - lensW, -lensH / 2, lensW, lensH);
  ctx.fillRect(halfGap, -lensH / 2, lensW, lensH);

  // Sweeping diagonal specular glare slash
  ctx.fillStyle = '#FFFFFF';
  const glarePos = Math.round(((tau * 2.5 + frameIndex * 0.05) % 1.5) * (lensW + 10) - 5);
  // Left lens glare
  if (glarePos >= 0 && glarePos < lensW) {
    ctx.fillRect(-halfGap - lensW + glarePos, -lensH / 2 + 1, 2, lensH - 2);
  }
  // Right lens glare
  if (glarePos >= 0 && glarePos < lensW) {
    ctx.fillRect(halfGap + glarePos, -lensH / 2 + 1, 2, lensH - 2);
  }

  ctx.restore();
}

/**
 * 💸 Floating Banknotes & Coin Sparks
 */
export function drawMoneyStack(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  tau: number = 1.0,
  frameIndex: number = 0,
  audioFrame?: AudioFrameData | null
): void {
  ctx.save();
  const bills = [
    { x0: 20, y0: 10, w: 26, h: 13, speed: 0.6, rot: -0.15 },
    { x0: 95, y0: 8, w: 24, h: 12, speed: 0.8, rot: 0.18 },
    { x0: 60, y0: 48, w: 22, h: 11, speed: 0.7, rot: -0.08 },
    { x0: 12, y0: 46, w: 20, h: 10, speed: 0.5, rot: 0.12 }
  ];

  for (let i = 0; i < bills.length; i++) {
    const b = bills[i];
    const y = Math.round((b.y0 + frameIndex * b.speed) % 70) - 6;
    if (y < -10 || y > 64) continue;
    const swayX = Math.round(Math.sin(frameIndex * 0.08 + i) * 3);
    const x = b.x0 + swayX;

    ctx.save();
    ctx.translate(x + b.w / 2, y + b.h / 2);
    ctx.rotate(b.rot + Math.sin(frameIndex * 0.05 + i) * 0.06);

    // Black knockout
    ctx.fillStyle = '#000000';
    ctx.fillRect(-b.w / 2 - 1, -b.h / 2 - 1, b.w + 2, b.h + 2);

    // Banknote body
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    ctx.strokeRect(-b.w / 2, -b.h / 2, b.w, b.h);

    // Inner frame
    ctx.strokeRect(-b.w / 2 + 2, -b.h / 2 + 2, b.w - 4, b.h - 4);

    // Center currency circle
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // Floating coin spark glints on heavy beats
  if (audioFrame?.isBeat) {
    drawChromeStar(ctx, 32, 18, 4);
    drawChromeStar(ctx, 102, 22, 4);
  }
  ctx.restore();
}

/**
 * 🏎️ Low-slung Sports Car Coupe with Spinning Spoke Wheels
 */
export function drawStreetRacer(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  tau: number = 1.0,
  frameIndex: number = 0,
  audioFrame?: AudioFrameData | null
): void {
  ctx.save();
  const carW = 54;
  const carH = 14;
  // Car drives along baseline
  const carX = Math.round(((frameIndex * 1.5) % 180) - 40);
  const carY = 48;

  ctx.translate(carX, carY);

  // Black knockout
  ctx.fillStyle = '#000000';
  ctx.fillRect(-2, -carH - 2, carW + 4, carH + 6);

  // White car body outline & fill
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;

  ctx.beginPath();
  ctx.moveTo(0, 0); // Front bumper bottom
  ctx.lineTo(6, -4); // Front hood nose
  ctx.lineTo(18, -5); // Hood
  ctx.lineTo(26, -carH); // Windshield slope
  ctx.lineTo(38, -carH); // Roof
  ctx.lineTo(46, -4); // Rear fastback slope
  ctx.lineTo(52, -4); // Rear spoiler
  ctx.lineTo(54, -7); // Spoiler wing
  ctx.lineTo(52, 0); // Rear bumper bottom
  ctx.closePath();
  ctx.fill();

  // Cabin window cutout in black
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.moveTo(25, -carH + 2);
  ctx.lineTo(37, -carH + 2);
  ctx.lineTo(43, -4);
  ctx.lineTo(21, -4);
  ctx.closePath();
  ctx.fill();

  // Spinning spoke wheels (front at 12, rear at 42)
  const wheelR = 4;
  const wheelY = 0;
  const wheelXs = [12, 42];
  const rotAngle = (frameIndex * 0.4) % (Math.PI * 2);

  for (const wx of wheelXs) {
    // Wheel cutout in body
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(wx, wheelY, wheelR + 1, 0, Math.PI * 2);
    ctx.fill();

    // Wheel rim
    ctx.strokeStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(wx, wheelY, wheelR, 0, Math.PI * 2);
    ctx.stroke();

    // Spinning spokes
    ctx.beginPath();
    ctx.moveTo(wx + Math.cos(rotAngle) * wheelR, wheelY + Math.sin(rotAngle) * wheelR);
    ctx.lineTo(wx - Math.cos(rotAngle) * wheelR, wheelY - Math.sin(rotAngle) * wheelR);
    ctx.moveTo(wx + Math.cos(rotAngle + Math.PI / 2) * wheelR, wheelY + Math.sin(rotAngle + Math.PI / 2) * wheelR);
    ctx.lineTo(wx - Math.cos(rotAngle + Math.PI / 2) * wheelR, wheelY - Math.sin(rotAngle + Math.PI / 2) * wheelR);
    ctx.stroke();
  }

  // Exhaust speed dust puffs behind car
  if (frameIndex % 2 === 0) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(-6 - (frameIndex % 6), -2, 2, 2);
    ctx.fillRect(-10 - (frameIndex % 8), -4, 1, 1);
  }

  ctx.restore();
}

/**
 * 💔 Cracked Heart (Jagged fissure splitting apart)
 */
export function drawCrackedHeart(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  cx: number = 64,
  cy: number = 18,
  size: number = 16,
  tau: number = 1.0,
  frameIndex: number = 0
): void {
  ctx.save();
  const splitOffset = tau > 0.25 ? Math.min(4, Math.round((tau - 0.25) * 6)) : 0;
  const floatY = cy + Math.sin(tau * Math.PI * 2) * 1.5;
  ctx.translate(cx, floatY);

  // Black knockout
  ctx.fillStyle = '#000000';
  ctx.fillRect(-size - splitOffset - 2, -size - 2, (size + splitOffset) * 2 + 4, size * 2 + 4);

  // Left Half Heart
  ctx.save();
  ctx.translate(-splitOffset, 0);
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(0, size); // Bottom tip
  ctx.bezierCurveTo(-size * 0.8, size * 0.4, -size * 1.1, -size * 0.2, -size * 0.6, -size * 0.7);
  ctx.bezierCurveTo(-size * 0.3, -size * 0.9, 0, -size * 0.4, 0, -size * 0.2); // Top cleft
  // Jagged crack back to bottom
  ctx.lineTo(-2, -size * 0.05);
  ctx.lineTo(1, size * 0.2);
  ctx.lineTo(-2, size * 0.5);
  ctx.lineTo(0, size);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Right Half Heart
  ctx.save();
  ctx.translate(splitOffset, 0);
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(0, size); // Bottom tip
  ctx.bezierCurveTo(size * 0.8, size * 0.4, size * 1.1, -size * 0.2, size * 0.6, -size * 0.7);
  ctx.bezierCurveTo(size * 0.3, -size * 0.9, 0, -size * 0.4, 0, -size * 0.2); // Top cleft
  // Matching jagged edge
  ctx.lineTo(-2, -size * 0.05);
  ctx.lineTo(1, size * 0.2);
  ctx.lineTo(-2, size * 0.5);
  ctx.lineTo(0, size);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Falling dust flakes from fissure
  if (splitOffset > 0) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(Math.round(Math.sin(frameIndex) * 2), size + 2 + ((frameIndex * 2) % 8), 1, 1);
  }

  ctx.restore();
}

/**
 * ⚔️ Crossed Curved Scimitars / Daggers with Razor Impact
 */
export function drawCrossedSwords(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  cx: number = 64,
  cy: number = 18,
  size: number = 22,
  tau: number = 1.0,
  frameIndex: number = 0
): void {
  ctx.save();
  const floatY = cy + Math.sin(tau * Math.PI * 2) * 1.5;
  ctx.translate(cx, floatY);

  // Black knockout
  ctx.fillStyle = '#000000';
  ctx.fillRect(-size - 2, -size - 2, size * 2 + 4, size * 2 + 4);

  const drawSword = (angle: number) => {
    ctx.save();
    ctx.rotate(angle);
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;

    // Curved Blade
    ctx.beginPath();
    ctx.moveTo(-1, 0);
    ctx.lineTo(-1, -size);
    ctx.quadraticCurveTo(3, -size * 0.6, 2, 0);
    ctx.closePath();
    ctx.fill();

    // Crossguard
    ctx.fillRect(-5, 0, 10, 2);

    // Grip
    ctx.fillRect(-1, 2, 2, 5);

    // Pommel knob
    ctx.beginPath();
    ctx.arc(0, 8, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  drawSword(Math.PI / 4);
  drawSword(-Math.PI / 4);

  // Impact star at intersection on beat
  if (tau < 0.4 || (frameIndex % 6 === 0)) {
    drawChromeStar(ctx, 0, 0, 4);
  }

  ctx.restore();
}

/**
 * 🏆 Champion Trophy with Floating Star Glints
 */
export function drawChampionTrophy(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  cx: number = 64,
  cy: number = 18,
  size: number = 18,
  tau: number = 1.0,
  frameIndex: number = 0
): void {
  ctx.save();
  const floatY = cy + Math.sin(tau * Math.PI * 2) * 1.5;
  ctx.translate(cx, floatY);

  const hw = size * 0.55;
  const cupH = size * 0.65;

  // Black knockout
  ctx.fillStyle = '#000000';
  ctx.fillRect(-hw - 6, -cupH - 2, (hw + 6) * 2, size + 6);

  // Trophy Cup Body
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;

  ctx.beginPath();
  ctx.moveTo(-hw, -cupH);
  ctx.lineTo(hw, -cupH);
  ctx.bezierCurveTo(hw, 0, hw * 0.4, cupH * 0.6, 0, cupH * 0.7);
  ctx.bezierCurveTo(-hw * 0.4, cupH * 0.6, -hw, 0, -hw, -cupH);
  ctx.closePath();
  ctx.fill();

  // Cup Rim
  ctx.fillRect(-hw - 1, -cupH - 1, (hw + 1) * 2, 2);

  // Stem & Base Pedestal
  ctx.fillRect(-1, cupH * 0.7, 2, 4);
  ctx.fillRect(-hw * 0.6, cupH * 0.7 + 4, hw * 1.2, 3);

  // Side Handles
  ctx.beginPath();
  ctx.arc(-hw - 1, -cupH * 0.4, 4, Math.PI * 0.5, Math.PI * 1.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(hw + 1, -cupH * 0.4, 4, -Math.PI * 0.5, Math.PI * 0.5);
  ctx.stroke();

  // Star glints
  drawChromeStar(ctx, -hw - 4, -cupH + 2, 3);
  drawChromeStar(ctx, hw + 4, -cupH + 2, 3);

  ctx.restore();
}

/**
 * 🎲 3D Isometric Lucky Dice with Pips
 */
export function drawLuckyDice(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  cx: number = 64,
  cy: number = 18,
  size: number = 14,
  tau: number = 1.0,
  frameIndex: number = 0
): void {
  ctx.save();
  const floatY = cy + Math.sin(tau * Math.PI * 2) * 1.5;
  ctx.translate(cx, floatY);

  const s = size;
  const hs = s * 0.5;

  // Black knockout
  ctx.fillStyle = '#000000';
  ctx.fillRect(-s - 2, -s - 2, s * 2 + 4, s * 2 + 4);

  // Top Face (Rhombus)
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.lineTo(s * 0.8, -hs);
  ctx.lineTo(0, 0);
  ctx.lineTo(-s * 0.8, -hs);
  ctx.closePath();
  ctx.fill();

  // Top Face Pips (5 dots) in black
  ctx.fillStyle = '#000000';
  ctx.fillRect(-1, -hs - 1, 2, 2); // Center
  ctx.fillRect(-s * 0.35, -s * 0.75, 2, 2);
  ctx.fillRect(s * 0.35 - 2, -s * 0.75, 2, 2);
  ctx.fillRect(-s * 0.35, -hs + 1, 2, 2);
  ctx.fillRect(s * 0.35 - 2, -hs + 1, 2, 2);

  // Left Face (Parallelogram)
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-s * 0.8, -hs);
  ctx.lineTo(0, 0);
  ctx.lineTo(0, s * 0.7);
  ctx.lineTo(-s * 0.8, s * 0.2);
  ctx.closePath();
  ctx.stroke();

  // Left Face Pips (3 dots diagonal)
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(-s * 0.5, -hs * 0.4, 2, 2);
  ctx.fillRect(-s * 0.4, 0, 2, 2);
  ctx.fillRect(-s * 0.3, hs * 0.4, 2, 2);

  // Right Face (Parallelogram)
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(s * 0.8, -hs);
  ctx.lineTo(s * 0.8, s * 0.2);
  ctx.lineTo(0, s * 0.7);
  ctx.closePath();
  ctx.stroke();

  // Right Face Pip (1 big center dot)
  ctx.fillRect(s * 0.4 - 1, -hs * 0.1, 3, 3);

  ctx.restore();
}

/**
 * ⌚ Rolex Luxury Watch Bezel with Ticking Hands
 */
export function drawRolexWatch(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  cx: number = 64,
  cy: number = 18,
  radius: number = 13,
  tau: number = 1.0,
  frameIndex: number = 0
): void {
  ctx.save();
  const floatY = cy + Math.sin(tau * Math.PI * 2) * 1.5;
  ctx.translate(cx, floatY);

  // Black knockout
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(0, 0, radius + 3, 0, Math.PI * 2);
  ctx.fill();

  // Outer fluted bezel ticks
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
    const r1 = radius + 1;
    const r2 = radius + 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
    ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
    ctx.stroke();
  }

  // Dial Case
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();

  // 12, 3, 6, 9 hour pips
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(-1, -radius + 2, 2, 2); // 12
  ctx.fillRect(radius - 4, -1, 2, 2);  // 3
  ctx.fillRect(-1, radius - 4, 2, 2);  // 6
  ctx.fillRect(-radius + 2, -1, 2, 2); // 9

  // Center pivot
  ctx.beginPath();
  ctx.arc(0, 0, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // Hour Hand (10 o'clock)
  const hourAngle = -Math.PI / 3;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(hourAngle) * (radius * 0.5), Math.sin(hourAngle) * (radius * 0.5));
  ctx.stroke();

  // Minute Hand (2 o'clock)
  ctx.lineWidth = 1;
  const minAngle = Math.PI / 6;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(minAngle) * (radius * 0.75), Math.sin(minAngle) * (radius * 0.75));
  ctx.stroke();

  // Ticking Second Hand
  const secAngle = (frameIndex * 0.1) % (Math.PI * 2);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(secAngle) * (radius * 0.85), Math.sin(secAngle) * (radius * 0.85));
  ctx.stroke();

  // Crown Knob on Right side
  ctx.fillRect(radius + 1, -2, 2, 4);

  ctx.restore();
}
