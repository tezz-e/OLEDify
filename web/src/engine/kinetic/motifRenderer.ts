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
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;
  let rot = (Math.PI / 2) * 3 + (frameIndex % 3) * 0.1;
  const step = Math.PI / spikes;

  ctx.beginPath();
  const startX = cx + Math.cos(rot) * outerRadius;
  const startY = cy + Math.sin(rot) * outerRadius;
  ctx.moveTo(startX, startY);

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
  ctx.stroke();

  // Draw comic burst action ticks radiating outward from spike tips
  rot = (Math.PI / 2) * 3 + (frameIndex % 3) * 0.1;
  for (let i = 0; i < spikes; i += 2) {
    const rOut = outerRadius + ((i * 7 + frameIndex) % 5) - 2;
    const x1 = cx + Math.cos(rot) * (rOut + 2);
    const y1 = cy + Math.sin(rot) * (rOut + 2);
    const x2 = cx + Math.cos(rot) * (rOut + 6);
    const y2 = cy + Math.sin(rot) * (rOut + 6);
    ctx.beginPath();
    ctx.moveTo(Math.round(x1), Math.round(y1));
    ctx.lineTo(Math.round(x2), Math.round(y2));
    ctx.stroke();
    rot += step * 2;
  }
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

    case 'bullet_chamber_cylinder':
      drawBulletChamberCylinder(ctx, 64, 18, 14, tau, frameIndex);
      break;

    case 'police_siren_sweep':
      drawPoliceSirenSweep(ctx, tau, frameIndex, isBeat);
      break;

    case 'thar_jeep_grille':
      drawTharJeepGrille(ctx, 64, 48, tau, frameIndex);
      break;

    case 'punjabi_khanda':
      drawPunjabiKhanda(ctx, 64, 18, 16, tau, frameIndex);
      break;

    case 'cuban_chain_links':
      drawCubanChainLinks(ctx, tau, frameIndex);
      break;

    case 'drill_ski_mask':
      drawDrillSkiMask(ctx, 64, 18, 15, tau, frameIndex);
      break;

    case 'studio_microphone':
      drawStudioMicrophone(ctx, 64, 18, 16, tau, frameIndex);
      break;

    case 'boombox_blaster':
      drawBoomboxBlaster(ctx, 64, 48, tau, frameIndex, isBeat);
      break;

    case 'speaker_subwoofer_pulse':
      drawSpeakerSubwooferPulse(ctx, tau, frameIndex, isBeat, bass);
      break;

    case 'electric_guitar':
      drawElectricGuitar(ctx, 64, 18, tau, frameIndex);
      break;

    case 'metronome_ticker':
      drawMetronomeTicker(ctx, 64, 18, tau, frameIndex);
      break;

    case 'disco_mirror_ball':
      drawDiscoMirrorBall(ctx, 64, 12, 11, tau, frameIndex);
      break;

    case 'city_skyline_silhouette':
      drawCitySkylineSilhouette(ctx, frameIndex);
      break;

    case 'smoke_ring_drift':
      drawSmokeRingDrift(ctx, tau, frameIndex);
      break;

    case 'graffiti_drips':
      drawGraffitiDrips(ctx, frameIndex);
      break;

    case 'champagne_toast':
      drawChampagneToast(ctx, 64, 18, tau, frameIndex);
      break;

    case 'neon_lips':
      drawNeonLips(ctx, 64, 18, 18, tau, frameIndex);
      break;

    case 'vault_safe_dial':
      drawVaultSafeDial(ctx, 64, 18, 14, tau, frameIndex);
      break;

    case 'blooming_rose':
      drawBloomingRose(ctx, 64, 18, 15, tau, frameIndex);
      break;

    case 'lunar_crescent':
      drawLunarCrescent(ctx, 64, 18, 14, tau, frameIndex);
      break;

    case 'candle_flame_flicker':
      drawCandleFlameFlicker(ctx, 64, 18, tau, frameIndex);
      break;

    case 'fluttering_butterflies':
      drawFlutteringButterflies(ctx, tau, frameIndex);
      break;

    case 'falling_autumn_leaves':
      drawFallingAutumnLeaves(ctx, tau, frameIndex);
      break;

    case 'feather_drift':
      drawFeatherDrift(ctx, tau, frameIndex);
      break;

    case 'laser_grid_horizon':
      drawLaserGridHorizon(ctx, frameIndex);
      break;

    case 'matrix_rain_code':
      drawMatrixRainCode(ctx, frameIndex);
      break;

    case 'neon_heart_tunnel':
      drawNeonHeartTunnel(ctx, 64, 32, tau, frameIndex);
      break;

    case 'radar_sweep_sonar':
      drawRadarSweepSonar(ctx, 64, 32, tau, frameIndex);
      break;

    case 'hazard_stripes_caution':
      drawHazardStripesCaution(ctx, frameIndex);
      break;

    case 'antique_key_lock':
      drawAntiqueKeyLock(ctx, 64, 18, tau, frameIndex);
      break;

    case 'shonen_ki_aura':
      drawShonenKiAura(ctx, frameIndex, isBeat);
      break;

    case 'portal_vortex':
      drawPortalVortex(ctx, 64, 32, tau, frameIndex);
      break;

    case 'all_seeing_eye':
      drawAllSeeingEye(ctx, 64, 18, 16, tau, frameIndex);
      break;

    case 'knight_shield':
      drawKnightShield(ctx, 64, 18, 15, tau, frameIndex);
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

  const drawSword = (angle: number) => {
    ctx.save();
    ctx.rotate(angle);

    // 1. Black silhouette knockout (3px halo buffer)
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-1, 0);
    ctx.lineTo(-1, -size);
    ctx.quadraticCurveTo(3, -size * 0.6, 2, 0);
    ctx.closePath();
    ctx.stroke();
    ctx.strokeRect(-6, -1, 12, 4); // crossguard halo
    ctx.strokeRect(-2, 1, 4, 7);  // grip halo

    // 2. White blade & hilt
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

  // Black contour knockout
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-hw, -cupH);
  ctx.lineTo(hw, -cupH);
  ctx.bezierCurveTo(hw, 0, hw * 0.4, cupH * 0.6, 0, cupH * 0.7);
  ctx.bezierCurveTo(-hw * 0.4, cupH * 0.6, -hw, 0, -hw, -cupH);
  ctx.closePath();
  ctx.stroke();

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

  // Black contour knockout
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.lineTo(s * 0.8, -hs);
  ctx.lineTo(s * 0.8, s * 0.2);
  ctx.lineTo(0, s * 0.7);
  ctx.lineTo(-s * 0.8, s * 0.2);
  ctx.lineTo(-s * 0.8, -hs);
  ctx.closePath();
  ctx.stroke();

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

// =========================================================================
// 6. NEW 34 PROCEDURAL VISUAL MOTIF IMPLEMENTATIONS
// =========================================================================

// --- CATEGORY A: PUNJABI DRILL & TACTICAL STREET ---

/**
 * 🎯 Revolver 6-Shot Cylinder
 */
export function drawBulletChamberCylinder(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  cx: number = 64,
  cy: number = 18,
  radius: number = 14,
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

  // Outer cylinder ring with scallops
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();

  // Rotation
  const rot = (frameIndex * 0.05) % (Math.PI * 2);

  // 6 Bullet Chamber Holes
  for (let i = 0; i < 6; i++) {
    const angle = rot + (i * Math.PI) / 3;
    const chX = Math.cos(angle) * (radius * 0.58);
    const chY = Math.sin(angle) * (radius * 0.58);

    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(chX, chY, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(chX, chY, 2.5, 0, Math.PI * 2);
    ctx.stroke();

    // Center primer dimple
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(chX - 0.5, chY - 0.5, 1, 1);
  }

  // Center pin
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(0, 0, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * 🚨 Police Siren Sweep (High-speed alternating beam strobe)
 */
export function drawPoliceSirenSweep(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  tau: number = 1.0,
  frameIndex: number = 0,
  isBeat: boolean = false
): void {
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;

  const strobeLeft = (frameIndex % 6) < 3;
  const sweepAngle = Math.sin(frameIndex * 0.3) * 0.6;

  // Top Lightbars
  if (strobeLeft || isBeat) {
    // Left blue/red strobe representation (1-bit stipple bars)
    for (let x = 6; x < 30; x += 2) {
      ctx.fillRect(x, 2, 1, 3);
    }
  }
  if (!strobeLeft || isBeat) {
    // Right strobe representation
    for (let x = 98; x < 122; x += 2) {
      ctx.fillRect(x, 2, 1, 3);
    }
  }

  // Radiating angular searchlight beams across edges (keeping center 64,32 clear)
  const beamOriginLeftX = 18;
  const beamOriginRightX = 110;

  ctx.beginPath();
  if (strobeLeft) {
    ctx.moveTo(beamOriginLeftX, 4);
    ctx.lineTo(beamOriginLeftX + Math.cos(sweepAngle + 0.8) * 55, Math.sin(sweepAngle + 0.8) * 55);
    ctx.moveTo(beamOriginLeftX, 4);
    ctx.lineTo(beamOriginLeftX + Math.cos(sweepAngle + 1.2) * 50, Math.sin(sweepAngle + 1.2) * 50);
  } else {
    ctx.moveTo(beamOriginRightX, 4);
    ctx.lineTo(beamOriginRightX - Math.cos(sweepAngle + 0.8) * 55, Math.sin(sweepAngle + 0.8) * 55);
    ctx.moveTo(beamOriginRightX, 4);
    ctx.lineTo(beamOriginRightX - Math.cos(sweepAngle + 1.2) * 50, Math.sin(sweepAngle + 1.2) * 50);
  }
  ctx.stroke();

  ctx.restore();
}

/**
 * 🚙 Thar 4x4 Off-Road Jeep Grille (Iconic 7 vertical slots & dual headlamps)
 */
export function drawTharJeepGrille(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  cx: number = 64,
  cy: number = 48,
  tau: number = 1.0,
  frameIndex: number = 0
): void {
  ctx.save();
  ctx.translate(cx, cy);

  // Black knockout backing
  ctx.fillStyle = '#000000';
  ctx.fillRect(-44, -12, 88, 22);

  // Main grille outer housing
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;
  ctx.strokeRect(-38, -9, 76, 17);

  // 7 Vertical Slotted Vents
  ctx.fillStyle = '#FFFFFF';
  for (let i = -3; i <= 3; i++) {
    const slotX = i * 7.5 - 1.5;
    ctx.fillRect(slotX, -6, 3, 11);
  }

  // Dual Circular Headlamps
  for (const hX of [-30, 30]) {
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(hX, -0.5, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(hX, -0.5, 5.5, 0, Math.PI * 2);
    ctx.stroke();

    // Bulb filament cross
    ctx.fillRect(hX - 2, -1, 4, 1);
    ctx.fillRect(hX - 0.5, -2.5, 1, 4);
  }

  // Heavy Lower Bumper Bar
  ctx.fillRect(-42, 9, 84, 2);

  ctx.restore();
}

/**
 * ⚔️ Sacred Punjabi Khanda (Double-edged blade, Chakkar & dual Kirpans)
 */
export function drawPunjabiKhanda(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  cx: number = 64,
  cy: number = 18,
  radius: number = 16,
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

  ctx.strokeStyle = '#FFFFFF';
  ctx.fillStyle = '#FFFFFF';
  ctx.lineWidth = 1;

  // 1. Central Chakkar (Sacred Quoit circle)
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.55, 0, Math.PI * 2);
  ctx.stroke();

  // 2. Central Khanda (Double-edged sword)
  // Blade
  ctx.beginPath();
  ctx.moveTo(0, -radius);
  ctx.lineTo(2, -radius * 0.7);
  ctx.lineTo(1.5, radius * 0.7);
  ctx.lineTo(-1.5, radius * 0.7);
  ctx.lineTo(-2, -radius * 0.7);
  ctx.closePath();
  ctx.fill();
  // Khanda Hilt & Pommel
  ctx.fillRect(-4, radius * 0.6, 8, 1.5);
  ctx.fillRect(-1, radius * 0.6, 2, 4);

  // 3. Dual Curved Kirpans (Flanking blades curving outward and upward)
  // Left Kirpan
  ctx.beginPath();
  ctx.moveTo(-1, radius * 0.7);
  ctx.quadraticCurveTo(-radius * 0.9, radius * 0.4, -radius * 0.8, -radius * 0.3);
  ctx.quadraticCurveTo(-radius * 0.5, radius * 0.2, -1, radius * 0.5);
  ctx.closePath();
  ctx.stroke();

  // Right Kirpan
  ctx.beginPath();
  ctx.moveTo(1, radius * 0.7);
  ctx.quadraticCurveTo(radius * 0.9, radius * 0.4, radius * 0.8, -radius * 0.3);
  ctx.quadraticCurveTo(radius * 0.5, radius * 0.2, 1, radius * 0.5);
  ctx.closePath();
  ctx.stroke();

  ctx.restore();
}

/**
 * ⛓️ Cuban Chain Links (Interlocking curb links framing screen)
 */
export function drawCubanChainLinks(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  tau: number = 1.0,
  frameIndex: number = 0
): void {
  ctx.save();
  ctx.strokeStyle = '#FFFFFF';
  ctx.fillStyle = '#FFFFFF';
  ctx.lineWidth = 1;

  const linkW = 9;
  const linkH = 5;
  const shift = (frameIndex * 0.4) % linkW;

  // Top curb chain border
  for (let x = -linkW + shift; x < 128 + linkW; x += linkW) {
    ctx.strokeRect(x, 4, linkW - 1, linkH);
    ctx.fillRect(x + 2, 5, 2, 1);
  }

  // Bottom curb chain border
  for (let x = -linkW - shift; x < 128 + linkW; x += linkW) {
    ctx.strokeRect(x, 55, linkW - 1, linkH);
    ctx.fillRect(x + 2, 57, 2, 1);
  }

  // Diamond sparkles on chain
  const sparkX = Math.round((frameIndex * 1.5) % 120) + 4;
  ctx.fillRect(sparkX, 2, 1, 3);
  ctx.fillRect(sparkX - 1, 3, 3, 1);

  ctx.restore();
}

/**
 * 🥷 Drill Ski Mask (Tactical balaclava with cutouts)
 */
export function drawDrillSkiMask(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  cx: number = 64,
  cy: number = 18,
  radius: number = 15,
  tau: number = 1.0,
  frameIndex: number = 0
): void {
  ctx.save();
  const floatY = cy + Math.sin(tau * Math.PI * 2) * 1.5;
  ctx.translate(cx, floatY);

  // Black knockout
  ctx.fillStyle = '#000000';
  ctx.fillRect(-14, -16, 28, 32);

  // Balaclava mask outline
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(-10, -12);
  ctx.lineTo(10, -12);
  ctx.lineTo(11, 2);
  ctx.lineTo(9, 13);
  ctx.lineTo(-9, 13);
  ctx.lineTo(-11, 2);
  ctx.closePath();
  ctx.fill();

  // Ribbed crown texture lines in black
  ctx.fillStyle = '#000000';
  ctx.fillRect(-8, -10, 16, 1);
  ctx.fillRect(-9, -8, 18, 1);

  // Aggressive Slanted Eye Cutouts
  ctx.fillRect(-8, -3, 6, 4);
  ctx.fillRect(2, -3, 6, 4);

  // Mouth cutout
  ctx.fillRect(-5, 6, 10, 3);

  // Neck ribbing
  ctx.fillRect(-8, 11, 16, 1);

  ctx.restore();
}

// --- CATEGORY B: MUSIC, AUDIO GEAR & HI-FI STAGE ---

/**
 * 🎙️ Studio Condenser Microphone (Shock-mount spider frame & capsule)
 */
export function drawStudioMicrophone(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  cx: number = 64,
  cy: number = 18,
  radius: number = 16,
  tau: number = 1.0,
  frameIndex: number = 0
): void {
  ctx.save();
  const floatY = cy + Math.sin(tau * Math.PI * 2) * 1.5;
  ctx.translate(cx, floatY);

  // Black knockout
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(0, 0, radius + 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#FFFFFF';
  ctx.fillStyle = '#FFFFFF';
  ctx.lineWidth = 1;

  // Outer Shock-mount circular hoop
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();

  // Elastic shock cords
  ctx.beginPath();
  ctx.moveTo(-radius, 0); ctx.lineTo(-6, -4);
  ctx.moveTo(radius, 0);  ctx.lineTo(6, -4);
  ctx.moveTo(-radius, 0); ctx.lineTo(-6, 4);
  ctx.moveTo(radius, 0);  ctx.lineTo(6, 4);
  ctx.stroke();

  // Mic Body
  ctx.fillStyle = '#000000';
  ctx.fillRect(-6, -11, 12, 22);
  ctx.strokeStyle = '#FFFFFF';
  ctx.strokeRect(-6, -11, 12, 22);

  // Upper Capsule Wire-Mesh Grille
  ctx.fillStyle = '#FFFFFF';
  for (let py = -10; py <= -2; py += 2) {
    for (let px = -5; px <= 4; px += 2) {
      ctx.fillRect(px + (py % 4 === 0 ? 1 : 0), py, 1, 1);
    }
  }

  // Center ring band
  ctx.fillRect(-6, -1, 12, 2);

  // Lower Body Brand Plate
  ctx.strokeRect(-4, 3, 8, 5);

  ctx.restore();
}

/**
 * 📻 Boombox Blaster (Dual pulsing woofers, tape deck & antennas)
 */
export function drawBoomboxBlaster(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  cx: number = 64,
  cy: number = 48,
  tau: number = 1.0,
  frameIndex: number = 0,
  isBeat: boolean = false
): void {
  ctx.save();
  ctx.translate(cx, cy);

  // Black knockout
  ctx.fillStyle = '#000000';
  ctx.fillRect(-44, -13, 88, 26);

  ctx.strokeStyle = '#FFFFFF';
  ctx.fillStyle = '#FFFFFF';
  ctx.lineWidth = 1;

  // Main Boombox Cabinet
  ctx.strokeRect(-40, -9, 80, 19);

  // Top Handle
  ctx.strokeRect(-24, -14, 48, 5);

  // Dual Telescoping Antennas
  ctx.beginPath();
  ctx.moveTo(-36, -9); ctx.lineTo(-44, -18);
  ctx.moveTo(36, -9);  ctx.lineTo(44, -18);
  ctx.stroke();

  // Left & Right Woofers
  const wooferR = isBeat ? 7.5 : 6.5;
  for (const wX of [-24, 24]) {
    ctx.beginPath();
    ctx.arc(wX, 0.5, wooferR, 0, Math.PI * 2);
    ctx.stroke();
    // Inner dust cap
    ctx.beginPath();
    ctx.arc(wX, 0.5, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Center Cassette Deck Door
  ctx.strokeRect(-10, -5, 20, 11);
  ctx.fillRect(-6, -1, 3, 3);
  ctx.fillRect(3, -1, 3, 3);

  // Tape transport buttons on top
  for (let b = -8; b <= 6; b += 3) {
    ctx.fillRect(b, -8, 2, 1);
  }

  ctx.restore();
}

/**
 * 🔊 Subwoofer Bass Pulse (Flanking subwoofers with dynamic cone vibration)
 */
export function drawSpeakerSubwooferPulse(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  tau: number = 1.0,
  frameIndex: number = 0,
  isBeat: boolean = false,
  bass: number = 0
): void {
  ctx.save();
  ctx.strokeStyle = '#FFFFFF';
  ctx.fillStyle = '#FFFFFF';
  ctx.lineWidth = 1;

  const pulseR = (isBeat ? 4 : 2) + Math.round(bass * 3);

  // Left Subwoofer at x=14, y=32
  // Right Subwoofer at x=114, y=32
  for (const sX of [14, 114]) {
    // Cabinet
    ctx.strokeRect(sX - 10, 16, 20, 32);

    // Tweeter
    ctx.beginPath();
    ctx.arc(sX, 23, 3, 0, Math.PI * 2);
    ctx.stroke();

    // Bass Woofer
    ctx.beginPath();
    ctx.arc(sX, 38, 7, 0, Math.PI * 2);
    ctx.stroke();

    // Pulsing Dust Cap
    ctx.beginPath();
    ctx.arc(sX, 38, Math.min(5, 2 + pulseR * 0.4), 0, Math.PI * 2);
    ctx.fill();

    // Soundwave arcs emitting inward
    const dir = sX === 14 ? 1 : -1;
    ctx.beginPath();
    ctx.arc(sX, 38, 12 + pulseR, dir === 1 ? -Math.PI / 4 : (3 * Math.PI) / 4, dir === 1 ? Math.PI / 4 : (5 * Math.PI) / 4);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * 🎸 Electric Guitar Silhouette (Angled body, frets & headstock)
 */
export function drawElectricGuitar(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  cx: number = 64,
  cy: number = 18,
  tau: number = 1.0,
  frameIndex: number = 0
): void {
  ctx.save();
  const floatY = cy + Math.sin(tau * Math.PI * 2) * 1.5;
  ctx.translate(cx, floatY);
  ctx.rotate(-Math.PI / 6);

  // Black knockout
  ctx.fillStyle = '#000000';
  ctx.fillRect(-18, -14, 36, 28);

  ctx.strokeStyle = '#FFFFFF';
  ctx.fillStyle = '#FFFFFF';
  ctx.lineWidth = 1;

  // Double cutaway body
  ctx.beginPath();
  ctx.ellipse(8, 0, 9, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Long fretboard neck extending left
  ctx.fillRect(-16, -1.5, 18, 3);

  // Headstock
  ctx.fillRect(-21, -2, 5, 4);

  // Tuning pegs
  for (let p = -20; p <= -17; p += 1.5) {
    ctx.fillRect(p, -4, 1, 2);
  }

  // Pickguard & Pickups in black cutout
  ctx.fillStyle = '#000000';
  ctx.fillRect(4, -3, 2, 6);
  ctx.fillRect(8, -3, 2, 6);
  ctx.fillRect(12, -2, 1, 4); // Bridge

  ctx.restore();
}

/**
 * ⏱️ Metronome Ticker (Pyramid casing & swinging mechanical pendulum)
 */
export function drawMetronomeTicker(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  cx: number = 64,
  cy: number = 18,
  tau: number = 1.0,
  frameIndex: number = 0
): void {
  ctx.save();
  const floatY = cy + Math.sin(tau * Math.PI * 2) * 1.5;
  ctx.translate(cx, floatY);

  // Black knockout
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.moveTo(0, -16);
  ctx.lineTo(14, 14);
  ctx.lineTo(-14, 14);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#FFFFFF';
  ctx.fillStyle = '#FFFFFF';
  ctx.lineWidth = 1;

  // Wooden pyramid body
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.lineTo(11, 12);
  ctx.lineTo(-11, 12);
  ctx.closePath();
  ctx.stroke();

  // Internal face plate
  ctx.strokeRect(-5, -6, 10, 16);

  // Swinging Pendulum Arm
  const swing = Math.sin(tau * Math.PI * 4) * 0.45;
  ctx.save();
  ctx.translate(0, 10);
  ctx.rotate(swing);

  // Pendulum rod
  ctx.fillRect(-0.75, -22, 1.5, 22);

  // Sliding weight
  ctx.fillRect(-3, -15, 6, 4);
  ctx.restore();

  ctx.restore();
}

/**
 * 🪩 Disco Mirror Ball (Suspended faceted globe with rotating reflections)
 */
export function drawDiscoMirrorBall(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  cx: number = 64,
  cy: number = 12,
  radius: number = 11,
  tau: number = 1.0,
  frameIndex: number = 0
): void {
  ctx.save();
  ctx.translate(cx, cy);

  // Suspension chain from ceiling
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -12); ctx.lineTo(0, -radius);
  ctx.stroke();

  // Black knockout
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(0, 0, radius + 2, 0, Math.PI * 2);
  ctx.fill();

  // Outer rim
  ctx.strokeStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();

  // 1-Bit Faceted Mirror Tiles (Shifting with frameIndex)
  ctx.fillStyle = '#FFFFFF';
  const shift = frameIndex % 4;
  for (let y = -radius + 2; y <= radius - 2; y += 3) {
    const rowWidth = Math.sqrt(radius * radius - y * y) * 0.85;
    for (let x = -rowWidth; x <= rowWidth; x += 3) {
      if ((Math.round(x + y + shift) % 2) === 0) {
        ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
      }
    }
  }

  // Rotating light pin-spots radiating across corners
  for (let r = 0; r < 4; r++) {
    const angle = (frameIndex * 0.06) + (r * Math.PI * 0.5);
    const glintDist = radius + 6 + (r % 2) * 5;
    const gX = Math.cos(angle) * glintDist;
    const gY = Math.sin(angle) * glintDist;
    ctx.fillRect(Math.round(gX), Math.round(gY), 2, 2);
  }

  ctx.restore();
}

// --- CATEGORY C: URBAN, NIGHTLIFE & STREET ATMOSPHERE ---

/**
 * 🏙️ City Skyline Silhouette (Skyscraper baseline with lit window matrix)
 */
export function drawCitySkylineSilhouette(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  frameIndex: number = 0
): void {
  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;

  // Buildings definitions along bottom (x, w, h)
  const buildings = [
    { x: 0, w: 14, h: 18 },
    { x: 15, w: 12, h: 26 },
    { x: 28, w: 16, h: 14 },
    { x: 45, w: 10, h: 22 },
    { x: 56, w: 16, h: 12 },
    { x: 73, w: 14, h: 24 },
    { x: 88, w: 15, h: 16 },
    { x: 104, w: 12, h: 28 },
    { x: 117, w: 11, h: 15 }
  ];

  for (const b of buildings) {
    const topY = 64 - b.h;
    // Fill building silhouette
    ctx.fillStyle = '#000000';
    ctx.fillRect(b.x, topY, b.w, b.h);
    ctx.strokeRect(b.x, topY, b.w, b.h);

    // Lit windows in white pixels
    ctx.fillStyle = '#FFFFFF';
    for (let wy = topY + 3; wy < 62; wy += 4) {
      for (let wx = b.x + 2; wx < b.x + b.w - 2; wx += 3) {
        if (((wx * 7 + wy * 13 + frameIndex) % 5) < 3) {
          ctx.fillRect(wx, wy, 1, 2);
        }
      }
    }
  }

  // Radio antenna on tallest building at x=104
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(110, 64 - 28 - 6, 1, 6);
  if ((frameIndex % 8) < 4) {
    ctx.fillRect(109, 64 - 28 - 7, 3, 1);
  }

  ctx.restore();
}

/**
 * 💨 Drifting Smoke Rings (Concentric organic expanding rings)
 */
export function drawSmokeRingDrift(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  tau: number = 1.0,
  frameIndex: number = 0
): void {
  ctx.save();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;

  for (let i = 0; i < 3; i++) {
    const prog = ((frameIndex * 0.02) + i * 0.33) % 1.0;
    const rX = 8 + prog * 16;
    const rY = 4 + prog * 8;
    const y = Math.round(52 - prog * 44);
    const x = Math.round(30 + i * 34 + Math.sin(prog * Math.PI * 2) * 6);

    ctx.beginPath();
    ctx.ellipse(x, y, rX, rY, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * 🎨 Street Graffiti Drips (Hanging spray paint runs from header)
 */
export function drawGraffitiDrips(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  frameIndex: number = 0
): void {
  ctx.save();
  ctx.fillStyle = '#FFFFFF';

  const dripXs = [8, 22, 38, 54, 72, 88, 104, 118];
  const lengths = [14, 22, 10, 18, 12, 24, 15, 20];

  for (let i = 0; i < dripXs.length; i++) {
    const x = dripXs[i];
    const len = lengths[i];
    // Drip column
    ctx.fillRect(x, 0, 2, len);
    // Rounded droplet bead at bottom
    ctx.fillRect(x - 1, len, 4, 3);
    // Detached falling spray dot
    if ((i + frameIndex) % 3 === 0) {
      ctx.fillRect(x, len + 5, 2, 2);
    }
  }

  ctx.restore();
}

/**
 * 🥂 Champagne Toast Flutes (Pair of clinking flutes & bubble effervescence)
 */
export function drawChampagneToast(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  cx: number = 64,
  cy: number = 18,
  tau: number = 1.0,
  frameIndex: number = 0
): void {
  ctx.save();
  const floatY = cy + Math.sin(tau * Math.PI * 2) * 1.5;
  ctx.translate(cx, floatY);

  // Black knockout
  ctx.fillStyle = '#000000';
  ctx.fillRect(-18, -14, 36, 28);

  ctx.strokeStyle = '#FFFFFF';
  ctx.fillStyle = '#FFFFFF';
  ctx.lineWidth = 1;

  // Left Flute (Tilted right +15 deg)
  ctx.save();
  ctx.translate(-5, 0);
  ctx.rotate(0.25);
  ctx.strokeRect(-3, -10, 6, 12);
  ctx.fillRect(-0.5, 2, 1, 7);
  ctx.fillRect(-3, 9, 6, 1);
  ctx.restore();

  // Right Flute (Tilted left -15 deg)
  ctx.save();
  ctx.translate(5, 0);
  ctx.rotate(-0.25);
  ctx.strokeRect(-3, -10, 6, 12);
  ctx.fillRect(-0.5, 2, 1, 7);
  ctx.fillRect(-3, 9, 6, 1);
  ctx.restore();

  // Clinking impact star spark
  ctx.fillRect(0, -6, 1, 5);
  ctx.fillRect(-2, -4, 5, 1);

  // Rising bubbles
  for (let b = 0; b < 4; b++) {
    const bY = -8 - ((frameIndex * 2 + b * 6) % 18);
    const bX = (b % 2 === 0 ? -4 : 4) + Math.sin(bY * 0.3) * 2;
    ctx.fillRect(Math.round(bX), bY, 1, 1);
  }

  ctx.restore();
}

/**
 * 💋 Neon Kiss Lips (High-contrast electric neon outline)
 */
export function drawNeonLips(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  cx: number = 64,
  cy: number = 18,
  radius: number = 18,
  tau: number = 1.0,
  frameIndex: number = 0
): void {
  ctx.save();
  const floatY = cy + Math.sin(tau * Math.PI * 2) * 1.5;
  ctx.translate(cx, floatY);

  // Black knockout
  ctx.fillStyle = '#000000';
  ctx.fillRect(-radius - 2, -12, (radius + 2) * 2, 24);

  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1.5;

  // Outer Neon Lips Contour
  ctx.beginPath();
  ctx.moveTo(-radius, 0);
  ctx.quadraticCurveTo(-radius * 0.5, -9, 0, -4);
  ctx.quadraticCurveTo(radius * 0.5, -9, radius, 0);
  ctx.quadraticCurveTo(radius * 0.5, 9, 0, 9);
  ctx.quadraticCurveTo(-radius * 0.5, 9, -radius, 0);
  ctx.closePath();
  ctx.stroke();

  // Inner mouth parting line
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-radius * 0.7, 0);
  ctx.quadraticCurveTo(-radius * 0.3, 1, 0, 0);
  ctx.quadraticCurveTo(radius * 0.3, 1, radius * 0.7, 0);
  ctx.stroke();

  // Specular shine dots
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(-4, 4, 3, 1);
  ctx.fillRect(2, 4, 2, 1);

  ctx.restore();
}

/**
 * 🔒 Bank Vault Safe Dial (Calibrated ticks & 3-spoke turning wheel)
 */
export function drawVaultSafeDial(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  cx: number = 64,
  cy: number = 18,
  radius: number = 14,
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

  ctx.strokeStyle = '#FFFFFF';
  ctx.fillStyle = '#FFFFFF';
  ctx.lineWidth = 1;

  // Dial Outer Rim
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();

  // Calibration ticks
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
    const x1 = Math.cos(a) * (radius - 2);
    const y1 = Math.sin(a) * (radius - 2);
    const x2 = Math.cos(a) * radius;
    const y2 = Math.sin(a) * radius;
    ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // Top Indicator Arrow
  ctx.beginPath();
  ctx.moveTo(0, -radius - 3);
  ctx.lineTo(-2, -radius);
  ctx.lineTo(2, -radius);
  ctx.closePath();
  ctx.fill();

  // Center Turning Hub
  const dialAngle = tau * Math.PI * 2;
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.fill();

  // 3 Turning Spokes
  for (let s = 0; s < 3; s++) {
    const sAngle = dialAngle + (s * Math.PI * 2) / 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(sAngle) * (radius - 4), Math.sin(sAngle) * (radius - 4));
    ctx.stroke();
  }

  ctx.restore();
}

// --- CATEGORY D: EMOTIONAL, ROMANCE & MELANCHOLY ---

/**
 * 🌹 Detailed Blooming Rose (Botanical blossom with layered petals & leaves)
 */
export function drawBloomingRose(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  cx: number = 64,
  cy: number = 18,
  radius: number = 15,
  tau: number = 1.0,
  frameIndex: number = 0
): void {
  ctx.save();
  const floatY = cy + Math.sin(tau * Math.PI * 2) * 1.5;
  ctx.translate(cx, floatY);

  // Black knockout
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(0, 0, radius + 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#FFFFFF';
  ctx.fillStyle = '#FFFFFF';
  ctx.lineWidth = 1;

  // Rose Blossom Solid Core
  ctx.beginPath();
  ctx.arc(0, -3, 8, 0, Math.PI * 2);
  ctx.fill();

  // Carved Black Petal Swirls
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, -3, 5, 0.2, Math.PI * 1.2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, -3, 2.5, Math.PI * 0.8, Math.PI * 2.2);
  ctx.stroke();

  // Stem curving down
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, 5);
  ctx.quadraticCurveTo(-3, 10, 0, 14);
  ctx.stroke();

  // Botanical Leaves flanking
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.ellipse(-5, 9, 4, 2, -0.4, 0, Math.PI * 2);
  ctx.ellipse(5, 10, 4, 2, 0.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * 🌙 Detailed Lunar Crescent (Craters & surrounding twinkling stars)
 */
export function drawLunarCrescent(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  cx: number = 64,
  cy: number = 18,
  radius: number = 14,
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

  ctx.fillStyle = '#FFFFFF';

  // Crescent body
  ctx.beginPath();
  ctx.arc(0, 0, radius, -Math.PI * 0.5, Math.PI * 0.5, false);
  ctx.arc(radius * 0.45, 0, radius * 0.85, Math.PI * 0.5, -Math.PI * 0.5, true);
  ctx.closePath();
  ctx.fill();

  // Lunar crater cutouts in black
  ctx.fillStyle = '#000000';
  ctx.beginPath(); ctx.arc(-radius * 0.5, -3, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(-radius * 0.4, 3, 2, 0, Math.PI * 2); ctx.fill();

  // Attendant stars
  ctx.fillStyle = '#FFFFFF';
  const twinkle = (frameIndex % 6) < 3;
  if (twinkle) {
    ctx.fillRect(8, -8, 2, 2);
    ctx.fillRect(11, 4, 1, 1);
  } else {
    ctx.fillRect(8, -8, 1, 1);
    ctx.fillRect(11, 4, 2, 2);
  }

  ctx.restore();
}

/**
 * 🕯️ Candle Flame Flicker (Melting pillar & organic flickering teardrop)
 */
export function drawCandleFlameFlicker(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  cx: number = 64,
  cy: number = 18,
  tau: number = 1.0,
  frameIndex: number = 0
): void {
  ctx.save();
  ctx.translate(cx, cy);

  // Black knockout
  ctx.fillStyle = '#000000';
  ctx.fillRect(-10, -16, 20, 32);

  ctx.strokeStyle = '#FFFFFF';
  ctx.fillStyle = '#FFFFFF';
  ctx.lineWidth = 1;

  // Candle wax pillar
  ctx.strokeRect(-5, 0, 10, 14);

  // Wax drip bead
  ctx.fillRect(-6, 2, 2, 4);

  // Wick
  ctx.fillRect(-0.5, -3, 1, 3);

  // Flickering organic teardrop flame
  const sway = Math.sin(frameIndex * 0.35) * 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -3);
  ctx.quadraticCurveTo(4 + sway, -8, sway, -14);
  ctx.quadraticCurveTo(-4 + sway, -8, 0, -3);
  ctx.closePath();
  ctx.fill();

  // Flame inner hollow core
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(sway * 0.5, -7, 1.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * 🦋 Fluttering Butterflies (Sine-wave flight trajectories in margins)
 */
export function drawFlutteringButterflies(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  tau: number = 1.0,
  frameIndex: number = 0
): void {
  ctx.save();
  ctx.fillStyle = '#FFFFFF';

  const bPositions = [
    { x0: 20, y0: 16, freq: 0.05, speed: 0.5 },
    { x0: 108, y0: 14, freq: 0.06, speed: -0.4 },
    { x0: 16, y0: 48, freq: 0.04, speed: 0.6 }
  ];

  for (let i = 0; i < bPositions.length; i++) {
    const bp = bPositions[i];
    const x = Math.round(bp.x0 + Math.sin(frameIndex * bp.freq + i) * 8);
    const y = Math.round(bp.y0 + Math.cos(frameIndex * bp.freq + i) * 4);
    const flap = Math.abs(Math.sin((frameIndex + i * 2) * 0.4)) * 2;

    // Wing pairs
    ctx.beginPath();
    ctx.ellipse(x - 3, y - 2, 4 - flap * 0.5, 3, -0.3, 0, Math.PI * 2);
    ctx.ellipse(x + 3, y - 2, 4 - flap * 0.5, 3, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = '#000000';
    ctx.fillRect(x - 0.5, y - 4, 1, 6);
    ctx.fillStyle = '#FFFFFF';
  }

  ctx.restore();
}

/**
 * 🍂 Falling Autumn Leaves (Foliage gently tumbling down)
 */
export function drawFallingAutumnLeaves(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  tau: number = 1.0,
  frameIndex: number = 0
): void {
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;

  for (let i = 0; i < 5; i++) {
    const y = (frameIndex * (0.4 + i * 0.1) + i * 16) % 68 - 4;
    const x = 12 + i * 26 + Math.sin(y * 0.15 + i) * 6;
    const rot = Math.sin(frameIndex * 0.08 + i) * 0.8;

    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(rot);

    // Serrated leaf shape
    ctx.beginPath();
    ctx.ellipse(0, 0, 5, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Leaf stem
    ctx.fillRect(-6, -0.5, 3, 1);
    ctx.restore();
  }

  ctx.restore();
}

/**
 * 🪶 Weightless Feather Drift (Swaying quill feather)
 */
export function drawFeatherDrift(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  tau: number = 1.0,
  frameIndex: number = 0
): void {
  ctx.save();
  ctx.strokeStyle = '#FFFFFF';
  ctx.fillStyle = '#FFFFFF';
  ctx.lineWidth = 1;

  const y = (frameIndex * 0.3) % 64;
  const x = 64 + Math.sin(frameIndex * 0.05) * 44;
  const tilt = Math.cos(frameIndex * 0.06) * 0.5;

  ctx.translate(Math.round(x), Math.round(y));
  ctx.rotate(tilt);

  // Central quill stem
  ctx.beginPath();
  ctx.moveTo(0, -12);
  ctx.quadraticCurveTo(2, 0, 0, 12);
  ctx.stroke();

  // Feathery barbs
  for (let fy = -8; fy <= 8; fy += 2) {
    const barbW = 6 - Math.abs(fy) * 0.4;
    ctx.beginPath();
    ctx.moveTo(0, fy); ctx.lineTo(-barbW, fy + 2);
    ctx.moveTo(0, fy); ctx.lineTo(barbW, fy + 2);
    ctx.stroke();
  }

  ctx.restore();
}

// --- CATEGORY E: CYBERPUNK, RETRO 80S & GAMING ---

/**
 * 📐 Synthwave Laser Grid (Retro 80s 3D perspective floor grid)
 */
export function drawLaserGridHorizon(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  frameIndex: number = 0
): void {
  ctx.save();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;

  const horizonY = 44;
  // Horizon Line
  ctx.beginPath();
  ctx.moveTo(0, horizonY);
  ctx.lineTo(128, horizonY);
  ctx.stroke();

  // Perspective Vanishing Point at (64, 44)
  // Perspective lines radiating outward
  const vpX = 64;
  for (let x = -32; x <= 160; x += 18) {
    ctx.beginPath();
    ctx.moveTo(vpX, horizonY);
    ctx.lineTo(x, 64);
    ctx.stroke();
  }

  // Horizontal receding grid lines scrolling forward
  const scroll = (frameIndex * 0.5) % 1.0;
  for (let i = 1; i <= 5; i++) {
    const t = (i + scroll) / 6;
    const y = Math.round(horizonY + (t * t) * (64 - horizonY));
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(128, y);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * 👾 Matrix Digital Rain (Falling code columns in margins)
 */
export function drawMatrixRainCode(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  frameIndex: number = 0
): void {
  ctx.save();
  ctx.fillStyle = '#FFFFFF';

  // Digital streams kept in screen flanks (x < 24 and x > 104)
  const columns = [4, 12, 20, 108, 116, 124];

  for (let i = 0; i < columns.length; i++) {
    const colX = columns[i];
    const speed = 1.0 + (i % 3) * 0.5;
    const headY = Math.round((frameIndex * speed + i * 22) % 80) - 10;

    // Bright leading head character
    if (headY >= 0 && headY < 64) {
      ctx.fillRect(colX, headY, 3, 3);
    }

    // Trailing glyph dots
    for (let t = 1; t <= 5; t++) {
      const trailY = headY - t * 4;
      if (trailY >= 0 && trailY < 64) {
        if ((t + frameIndex) % 2 === 0) {
          ctx.fillRect(colX + (t % 2), trailY, 2, 2);
        }
      }
    }
  }

  ctx.restore();
}

/**
 * 💖 Neon Heart Tunnel (Concentric perspective heart frames)
 */
export function drawNeonHeartTunnel(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  cx: number = 64,
  cy: number = 32,
  tau: number = 1.0,
  frameIndex: number = 0
): void {
  ctx.save();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;

  for (let h = 0; h < 3; h++) {
    const scale = (((frameIndex * 0.02) + h * 0.33) % 1.0) * 32 + 10;

    ctx.save();
    ctx.translate(cx, cy);

    ctx.beginPath();
    ctx.moveTo(0, scale * 0.5);
    ctx.bezierCurveTo(-scale, -scale * 0.1, -scale * 0.6, -scale * 0.8, 0, -scale * 0.4);
    ctx.bezierCurveTo(scale * 0.6, -scale * 0.8, scale, -scale * 0.1, 0, scale * 0.5);
    ctx.stroke();

    ctx.restore();
  }

  ctx.restore();
}

/**
 * 📡 Tactical Radar Sonar (360-degree rotating sweep ray & target pings)
 */
export function drawRadarSweepSonar(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  cx: number = 64,
  cy: number = 32,
  tau: number = 1.0,
  frameIndex: number = 0
): void {
  ctx.save();
  ctx.translate(cx, cy);

  ctx.strokeStyle = '#FFFFFF';
  ctx.fillStyle = '#FFFFFF';
  ctx.lineWidth = 1;

  // Concentric range circles
  ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI * 2); ctx.stroke();

  // Crosshairs
  ctx.beginPath();
  ctx.moveTo(-30, 0); ctx.lineTo(30, 0);
  ctx.moveTo(0, -30); ctx.lineTo(0, 30);
  ctx.stroke();

  // Sweep ray
  const sweepAngle = (frameIndex * 0.08) % (Math.PI * 2);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(sweepAngle) * 30, Math.sin(sweepAngle) * 30);
  ctx.stroke();

  // Target Blips
  const blipAngle1 = 0.8;
  const isNearSweep1 = Math.abs(sweepAngle - blipAngle1) < 0.4;
  if (isNearSweep1) {
    ctx.fillRect(Math.cos(blipAngle1) * 20 - 1, Math.sin(blipAngle1) * 20 - 1, 3, 3);
  }

  ctx.restore();
}

/**
 * ⚠️ Hazard Caution Stripes (45-degree angled safety barriers)
 */
export function drawHazardStripesCaution(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  frameIndex: number = 0
): void {
  ctx.save();
  ctx.fillStyle = '#FFFFFF';

  const shift = frameIndex % 8;

  // Top Hazard Bar (y: 0-6)
  for (let x = -8; x < 128 + 8; x += 8) {
    ctx.beginPath();
    ctx.moveTo(x + shift, 0);
    ctx.lineTo(x + shift + 4, 0);
    ctx.lineTo(x + shift - 2, 6);
    ctx.lineTo(x + shift - 6, 6);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillRect(0, 6, 128, 1);

  // Bottom Hazard Bar (y: 57-63)
  for (let x = -8; x < 128 + 8; x += 8) {
    ctx.beginPath();
    ctx.moveTo(x - shift, 57);
    ctx.lineTo(x - shift + 4, 57);
    ctx.lineTo(x - shift - 2, 63);
    ctx.lineTo(x - shift - 6, 63);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillRect(0, 57, 128, 1);

  ctx.restore();
}

/**
 * 🗝️ Antique Key & Keyhole (Victorian escutcheon plate & skeleton key)
 */
export function drawAntiqueKeyLock(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  cx: number = 64,
  cy: number = 18,
  tau: number = 1.0,
  frameIndex: number = 0
): void {
  ctx.save();
  const floatY = cy + Math.sin(tau * Math.PI * 2) * 1.5;
  ctx.translate(cx, floatY);

  // Black knockout
  ctx.fillStyle = '#000000';
  ctx.fillRect(-22, -14, 44, 28);

  ctx.strokeStyle = '#FFFFFF';
  ctx.fillStyle = '#FFFFFF';
  ctx.lineWidth = 1;

  // Keyhole Escutcheon Plate at left
  ctx.strokeRect(-16, -9, 12, 18);
  // Keyhole slot in black/white
  ctx.beginPath();
  ctx.arc(-10, -3, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-11, -3, 2, 6);

  // Antique Skeleton Key hovering at right
  const keyX = 6;
  // Key bow ring
  ctx.beginPath();
  ctx.arc(keyX - 6, 0, 4, 0, Math.PI * 2);
  ctx.stroke();
  // Key shaft
  ctx.fillRect(keyX - 2, -1, 14, 2);
  // Key bit teeth
  ctx.fillRect(keyX + 8, 1, 2, 4);
  ctx.fillRect(keyX + 4, 1, 2, 3);

  ctx.restore();
}

// --- CATEGORY F: MYSTICAL, ANIME & COSMIC POWER ---

/**
 * 🔥 Shonen Ki Energy Aura (Jagged surging upward flames & lightning)
 */
export function drawShonenKiAura(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  frameIndex: number = 0,
  isBeat: boolean = false
): void {
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;

  // Jagged ki flame spikes surging from bottom
  const numSpikes = 16;
  const step = 128 / numSpikes;

  ctx.beginPath();
  ctx.moveTo(0, 64);
  for (let i = 0; i <= numSpikes; i++) {
    const x = i * step;
    const spikeSeed = Math.sin(i * 99 + frameIndex * 0.5);
    const spikeH = (isBeat ? 26 : 16) + Math.abs(spikeSeed) * 12;
    const peakX = x - step * 0.5 + Math.sin(frameIndex * 0.3 + i) * 3;
    ctx.lineTo(peakX, 64 - spikeH);
    ctx.lineTo(x, 64);
  }
  ctx.closePath();
  ctx.fill();

  // Black internal core separation so baseline text stays clear
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.moveTo(0, 64);
  for (let i = 0; i <= numSpikes; i++) {
    const x = i * step;
    const spikeSeed = Math.sin(i * 99 + frameIndex * 0.5);
    const spikeH = (isBeat ? 20 : 10) + Math.abs(spikeSeed) * 8;
    ctx.lineTo(x - step * 0.5, 64 - spikeH);
    ctx.lineTo(x, 64);
  }
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

/**
 * 🌀 Dimensional Portal Vortex (Logarithmic spiraling cosmic arms)
 */
export function drawPortalVortex(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  cx: number = 64,
  cy: number = 32,
  tau: number = 1.0,
  frameIndex: number = 0
): void {
  ctx.save();
  ctx.translate(cx, cy);

  ctx.strokeStyle = '#FFFFFF';
  ctx.fillStyle = '#FFFFFF';
  ctx.lineWidth = 1;

  // 4 Spiral arms
  const rot = frameIndex * 0.06;
  for (let arm = 0; arm < 4; arm++) {
    const armOffset = arm * (Math.PI / 2);
    ctx.beginPath();
    for (let theta = 0.5; theta < 3.8; theta += 0.25) {
      const r = theta * 9;
      const angle = theta + armOffset + rot;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * (r * 0.65); // Elliptical 128x64 compression
      if (theta === 0.5) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }

  // Star dust specks orbiting
  for (let p = 0; p < 6; p++) {
    const pAngle = rot * 1.5 + p;
    const pDist = 18 + (p * 5);
    ctx.fillRect(
      Math.round(Math.cos(pAngle) * pDist),
      Math.round(Math.sin(pAngle) * (pDist * 0.6)),
      1,
      1
    );
  }

  ctx.restore();
}

/**
 * 👁️ All-Seeing Mystic Eye (Sacred pyramid triangle & centered pupil)
 */
export function drawAllSeeingEye(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  cx: number = 64,
  cy: number = 18,
  radius: number = 16,
  tau: number = 1.0,
  frameIndex: number = 0
): void {
  ctx.save();
  const floatY = cy + Math.sin(tau * Math.PI * 2) * 1.5;
  ctx.translate(cx, floatY);

  // Black knockout
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.moveTo(0, -radius - 3);
  ctx.lineTo(radius + 5, radius + 3);
  ctx.lineTo(-radius - 5, radius + 3);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#FFFFFF';
  ctx.fillStyle = '#FFFFFF';
  ctx.lineWidth = 1;

  // Radiant burst rays from apex
  for (let a = -0.8; a <= 0.8; a += 0.4) {
    ctx.beginPath();
    ctx.moveTo(0, -radius);
    ctx.lineTo(Math.sin(a) * (radius + 8), -radius - Math.cos(a) * 6);
    ctx.stroke();
  }

  // Sacred Equilateral Pyramid
  ctx.beginPath();
  ctx.moveTo(0, -radius);
  ctx.lineTo(radius + 2, radius);
  ctx.lineTo(-radius - 2, radius);
  ctx.closePath();
  ctx.stroke();

  // Centered Almond Eye
  ctx.beginPath();
  ctx.moveTo(-8, 2);
  ctx.quadraticCurveTo(0, -4, 8, 2);
  ctx.quadraticCurveTo(0, 8, -8, 2);
  ctx.closePath();
  ctx.fill();

  // Eye Iris & Pupil cutout
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(0, 2, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Light glint
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(-0.5, 1, 1, 1);

  ctx.restore();
}

/**
 * 🛡️ Knight Heraldic Shield (Medieval heater shield with cross charge)
 */
export function drawKnightShield(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  cx: number = 64,
  cy: number = 18,
  radius: number = 15,
  tau: number = 1.0,
  frameIndex: number = 0
): void {
  ctx.save();
  const floatY = cy + Math.sin(tau * Math.PI * 2) * 1.5;
  ctx.translate(cx, floatY);

  // Black knockout
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.moveTo(-radius - 2, -radius - 2);
  ctx.lineTo(radius + 2, -radius - 2);
  ctx.lineTo(radius + 2, 2);
  ctx.quadraticCurveTo(radius * 0.8, radius + 2, 0, radius + 4);
  ctx.quadraticCurveTo(-radius * 0.8, radius + 2, -radius - 2, 2);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#FFFFFF';
  ctx.fillStyle = '#FFFFFF';
  ctx.lineWidth = 1;

  // Heater Shield Outer Edge
  ctx.beginPath();
  ctx.moveTo(-radius, -radius);
  ctx.lineTo(radius, -radius);
  ctx.lineTo(radius, 0);
  ctx.quadraticCurveTo(radius * 0.8, radius, 0, radius + 2);
  ctx.quadraticCurveTo(-radius * 0.8, radius, -radius, 0);
  ctx.closePath();
  ctx.stroke();

  // Inner inset border
  const innerR = radius - 3;
  ctx.beginPath();
  ctx.moveTo(-innerR, -innerR);
  ctx.lineTo(innerR, -innerR);
  ctx.lineTo(innerR, 0);
  ctx.quadraticCurveTo(innerR * 0.8, innerR, 0, innerR + 1);
  ctx.quadraticCurveTo(-innerR * 0.8, innerR, -innerR, 0);
  ctx.closePath();
  ctx.stroke();

  // Embossed Heraldic Cross Charge
  ctx.fillRect(-1.5, -innerR + 1, 3, innerR * 1.6);
  ctx.fillRect(-innerR + 2, -3, (innerR - 2) * 2, 3);

  ctx.restore();
}

