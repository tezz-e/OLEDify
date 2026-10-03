import { WordBadgeIcon, WORD_BADGE_METADATA } from './types';
import { AudioFrameData } from './audioAnalysisEngine';

export interface WordBadgeRenderBounds {
  centerX: number;
  centerY: number;
  top: number;
  bottom: number;
  left: number;
  right: number;
  fontSize: number;
}

/**
 * Renders a 1-bit monochrome micro-sprite badge attached directly to a lyric word.
 * Positioned above or adjacent to the word with elastic spring pop entry dynamics
 * and a 2.5px solid black knockout halo to guarantee zero visual collisions.
 */
export function renderWordBadge(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  badge: WordBadgeIcon,
  bounds: WordBadgeRenderBounds,
  tau: number = 1.0,
  frameIndex: number = 0,
  audioFrame?: AudioFrameData | null
): void {
  if (!badge || badge === 'none') return;

  // Elastic Spring Pop Entry Curve
  let springScale = 1.0;
  if (tau < 0.25) {
    const t = tau / 0.25;
    // Overshoot pop: starts at 0, overshoots to 1.25, settles to 1.0
    springScale = Math.sin(t * Math.PI * 0.5) * 1.2;
  } else if (tau < 0.5) {
    const t = (tau - 0.25) / 0.25;
    springScale = 1.2 - Math.sin(t * Math.PI) * 0.2;
  }

  // Subtle floating hover bob
  const floatBob = Math.sin(tau * Math.PI * 2) * 1.5;

  // Beat pulse reaction
  const isBeat = audioFrame?.isBeat ?? false;
  const beatScale = isBeat ? 1.15 : 1.0;

  const totalScale = Math.max(0.01, springScale * beatScale);

  // Position badge safely within 128x64 canvas
  let badgeX = bounds.centerX;
  let badgeY = bounds.top - 6 + floatBob;

  // If text is near the top edge, tuck badge right above top line or clamp to top margin
  if (badgeY < 6) {
    badgeY = Math.max(6, bounds.top - 3);
  }

  ctx.save();
  ctx.translate(Math.round(badgeX), Math.round(badgeY));
  ctx.scale(totalScale, totalScale);

  switch (badge) {
    case 'moustache':
      drawMicroMoustache(ctx);
      break;

    case 'sunglasses':
      drawMicroSunglasses(ctx, tau, frameIndex);
      break;

    case 'crown':
      drawMicroCrown(ctx);
      break;

    case 'cash':
      drawMicroCash(ctx);
      break;

    case 'car':
      drawMicroCar(ctx, frameIndex);
      break;

    case 'heart':
      drawMicroHeart(ctx, isBeat);
      break;

    case 'broken_heart':
      drawMicroBrokenHeart(ctx, tau);
      break;

    case 'flame':
      drawMicroFlame(ctx, frameIndex);
      break;

    case 'skull':
      drawMicroSkull(ctx);
      break;

    case 'sword':
      drawMicroSword(ctx);
      break;

    case 'trophy':
      drawMicroTrophy(ctx);
      break;

    case 'dice':
      drawMicroDice(ctx);
      break;

    case 'watch':
      drawMicroWatch(ctx, frameIndex);
      break;

    case 'diamond':
      drawMicroDiamond(ctx);
      break;

    case 'star':
      drawMicroStar(ctx, frameIndex);
      break;

    default:
      break;
  }

  ctx.restore();
}

/**
 * 🥸 18x7 Micro Handlebar Moustache (Twirled royal tips)
 */
function drawMicroMoustache(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) {
  // Black knockout halo
  ctx.fillStyle = '#000000';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 1);
  ctx.bezierCurveTo(-3, -1, -6, -3, -9, -4);
  ctx.bezierCurveTo(-11, -5, -10, 0, -8, 2);
  ctx.bezierCurveTo(-5, 4, -2, 3, 0, 2);
  ctx.bezierCurveTo(2, 3, 5, 4, 8, 2);
  ctx.bezierCurveTo(10, 0, 11, -5, 9, -4);
  ctx.bezierCurveTo(6, -3, 3, -1, 0, 1);
  ctx.closePath();
  ctx.stroke();

  // White moustache fill
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(0, 1);
  ctx.bezierCurveTo(-3, -1, -6, -3, -9, -4);
  ctx.bezierCurveTo(-11, -5, -10, 0, -8, 2);
  ctx.bezierCurveTo(-5, 4, -2, 3, 0, 2);
  ctx.bezierCurveTo(2, 3, 5, 4, 8, 2);
  ctx.bezierCurveTo(10, 0, 11, -5, 9, -4);
  ctx.bezierCurveTo(6, -3, 3, -1, 0, 1);
  ctx.closePath();
  ctx.fill();

  // Fine 1-bit center divider
  ctx.fillStyle = '#000000';
  ctx.fillRect(-0.5, 0, 1, 2);
}

/**
 * 🕶️ 18x8 Micro Dark Sunglasses with Glare
 */
function drawMicroSunglasses(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  tau: number,
  frameIndex: number
) {
  const w = 18;
  const h = 7;
  // Black knockout
  ctx.fillStyle = '#000000';
  ctx.fillRect(-w / 2 - 2, -h / 2 - 2, w + 4, h + 4);

  // White frames
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(-w / 2, -h / 2, w, 2); // Brow line
  ctx.fillRect(-w / 2, -h / 2, 8, h);
  ctx.fillRect(w / 2 - 8, -h / 2, 8, h);

  // Black lenses inside
  ctx.fillStyle = '#000000';
  ctx.fillRect(-w / 2 + 1, -h / 2 + 2, 6, h - 3);
  ctx.fillRect(w / 2 - 7, -h / 2 + 2, 6, h - 3);

  // White glare glint
  ctx.fillStyle = '#FFFFFF';
  const glare = ((frameIndex * 2) % 10) < 5;
  if (glare) {
    ctx.fillRect(-w / 2 + 3, -h / 2 + 2, 1, 3);
    ctx.fillRect(w / 2 - 5, -h / 2 + 2, 1, 3);
  }
}

/**
 * 👑 16x10 Micro 3-Point Crown
 */
function drawMicroCrown(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) {
  // Black knockout
  ctx.fillStyle = '#000000';
  ctx.fillRect(-9, -6, 18, 12);

  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;

  ctx.beginPath();
  ctx.moveTo(-7, 3);
  ctx.lineTo(-7, -3); // Left peak
  ctx.lineTo(-3, 0);  // Left valley
  ctx.lineTo(0, -5);  // Center peak
  ctx.lineTo(3, 0);   // Right valley
  ctx.lineTo(7, -3);  // Right peak
  ctx.lineTo(7, 3);
  ctx.closePath();
  ctx.fill();

  // Bottom headband
  ctx.fillRect(-7, 3, 14, 2);

  // Jewels
  ctx.fillStyle = '#000000';
  ctx.fillRect(-5, 3, 1, 1);
  ctx.fillRect(-1, 3, 2, 1);
  ctx.fillRect(4, 3, 1, 1);
}

/**
 * 💸 16x9 Micro Cash Banknote
 */
function drawMicroCash(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) {
  const w = 16;
  const h = 8;
  ctx.fillStyle = '#000000';
  ctx.fillRect(-w / 2 - 2, -h / 2 - 2, w + 4, h + 4);

  ctx.strokeStyle = '#FFFFFF';
  ctx.fillStyle = '#FFFFFF';
  ctx.lineWidth = 1;

  ctx.strokeRect(-w / 2, -h / 2, w, h);
  // Center currency circle
  ctx.beginPath();
  ctx.arc(0, 0, 2, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * 🏎️ 18x7 Micro Sports Car
 */
function drawMicroCar(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  frameIndex: number
) {
  const w = 18;
  const h = 7;
  ctx.fillStyle = '#000000';
  ctx.fillRect(-w / 2 - 2, -h / 2 - 2, w + 4, h + 4);

  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(-w / 2, 2);
  ctx.lineTo(-w / 2 + 2, 0);
  ctx.lineTo(-w / 2 + 6, 0);
  ctx.lineTo(-w / 2 + 9, -h / 2);
  ctx.lineTo(w / 2 - 4, -h / 2);
  ctx.lineTo(w / 2 - 1, 0);
  ctx.lineTo(w / 2, -2); // Spoiler
  ctx.lineTo(w / 2, 2);
  ctx.closePath();
  ctx.fill();

  // Black wheels
  ctx.fillStyle = '#000000';
  ctx.fillRect(-w / 2 + 3, 1, 3, 3);
  ctx.fillRect(w / 2 - 6, 1, 3, 3);
}

/**
 * ❤️ 12x10 Solid Micro Heart
 */
function drawMicroHeart(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  isBeat: boolean
) {
  const s = isBeat ? 6 : 5;
  ctx.fillStyle = '#000000';
  ctx.fillRect(-s - 2, -s - 2, (s + 2) * 2, (s + 2) * 2);

  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(0, s);
  ctx.bezierCurveTo(-s * 0.8, s * 0.3, -s * 1.1, -s * 0.3, -s * 0.6, -s * 0.8);
  ctx.bezierCurveTo(-s * 0.3, -s, 0, -s * 0.5, 0, -s * 0.2);
  ctx.bezierCurveTo(0, -s * 0.5, s * 0.3, -s, s * 0.6, -s * 0.8);
  ctx.bezierCurveTo(s * 1.1, -s * 0.3, s * 0.8, s * 0.3, 0, s);
  ctx.closePath();
  ctx.fill();
}

/**
 * 💔 14x10 Micro Broken Heart
 */
function drawMicroBrokenHeart(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  tau: number
) {
  const s = 5;
  const split = tau > 0.2 ? 1.5 : 0;
  ctx.fillStyle = '#000000';
  ctx.fillRect(-s - split - 2, -s - 2, (s + split + 2) * 2, (s + 2) * 2);

  // Left half
  ctx.save();
  ctx.translate(-split, 0);
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(0, s);
  ctx.bezierCurveTo(-s * 0.8, s * 0.3, -s * 1.1, -s * 0.3, -s * 0.6, -s * 0.8);
  ctx.bezierCurveTo(-s * 0.3, -s, 0, -s * 0.5, 0, -s * 0.2);
  ctx.lineTo(-1, 0);
  ctx.lineTo(1, 2);
  ctx.lineTo(0, s);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Right half
  ctx.save();
  ctx.translate(split, 0);
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(0, s);
  ctx.bezierCurveTo(s * 0.8, s * 0.3, s * 1.1, -s * 0.3, s * 0.6, -s * 0.8);
  ctx.bezierCurveTo(s * 0.3, -s, 0, -s * 0.5, 0, -s * 0.2);
  ctx.lineTo(-1, 0);
  ctx.lineTo(1, 2);
  ctx.lineTo(0, s);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * 🔥 10x12 Micro Flame
 */
function drawMicroFlame(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  frameIndex: number
) {
  ctx.fillStyle = '#000000';
  ctx.fillRect(-6, -8, 12, 16);

  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.quadraticCurveTo(4, -2, 3, 4);
  ctx.quadraticCurveTo(0, 6, -3, 4);
  ctx.quadraticCurveTo(-4, -2, 0, -6);
  ctx.closePath();
  ctx.fill();

  // Inner cutout
  ctx.fillStyle = '#000000';
  ctx.fillRect(-1, 1, 2, 3);
}

/**
 * 💀 10x10 Micro Skull
 */
function drawMicroSkull(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) {
  ctx.fillStyle = '#000000';
  ctx.fillRect(-6, -6, 12, 12);

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(-4, -4, 8, 6); // Cranium
  ctx.fillRect(-3, 2, 6, 2);  // Jaw

  // Eyes
  ctx.fillStyle = '#000000';
  ctx.fillRect(-3, -2, 2, 2);
  ctx.fillRect(1, -2, 2, 2);
  // Nose
  ctx.fillRect(-0.5, 0, 1, 1);
}

/**
 * 🗡️ 12x12 Micro Crossed Daggers
 */
function drawMicroSword(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) {
  ctx.fillStyle = '#000000';
  ctx.fillRect(-7, -7, 14, 14);

  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;
  // Blade 1
  ctx.beginPath();
  ctx.moveTo(-5, -5); ctx.lineTo(5, 5);
  ctx.moveTo(-5, 5); ctx.lineTo(5, -5);
  ctx.stroke();

  // Center glint
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(-1, -1, 2, 2);
}

/**
 * 🏆 12x12 Micro Trophy Cup
 */
function drawMicroTrophy(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) {
  ctx.fillStyle = '#000000';
  ctx.fillRect(-7, -7, 14, 14);

  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;

  // Cup body
  ctx.beginPath();
  ctx.moveTo(-4, -5);
  ctx.lineTo(4, -5);
  ctx.bezierCurveTo(4, 0, 2, 2, 0, 2);
  ctx.bezierCurveTo(-2, 2, -4, 0, -4, -5);
  ctx.closePath();
  ctx.fill();

  // Stem & Base
  ctx.fillRect(-1, 2, 2, 2);
  ctx.fillRect(-3, 4, 6, 1);

  // Handles
  ctx.strokeRect(-5, -4, 1, 3);
  ctx.strokeRect(4, -4, 1, 3);
}

/**
 * 🎲 12x12 Micro Lucky Die
 */
function drawMicroDice(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) {
  ctx.fillStyle = '#000000';
  ctx.fillRect(-6, -6, 12, 12);

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(-4, -4, 8, 8);

  // Black pips (face with 5 dots)
  ctx.fillStyle = '#000000';
  ctx.fillRect(-0.5, -0.5, 1, 1); // Center
  ctx.fillRect(-3, -3, 1, 1);
  ctx.fillRect(2, -3, 1, 1);
  ctx.fillRect(-3, 2, 1, 1);
  ctx.fillRect(2, 2, 1, 1);
}

/**
 * ⌚ 12x12 Micro Rolex Watch
 */
function drawMicroWatch(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  frameIndex: number
) {
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.stroke();

  // Watch hands
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(-2, -2); // Hour
  ctx.moveTo(0, 0); ctx.lineTo(3, 0);   // Minute
  ctx.stroke();

  // Strap tabs
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(-2, -6, 4, 1);
  ctx.fillRect(-2, 5, 4, 1);
}

/**
 * 💎 12x10 Micro Diamond
 */
function drawMicroDiamond(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) {
  ctx.fillStyle = '#000000';
  ctx.fillRect(-7, -6, 14, 12);

  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(-5, -2);
  ctx.lineTo(-2, -5);
  ctx.lineTo(2, -5);
  ctx.lineTo(5, -2);
  ctx.lineTo(0, 4); // Bottom tip
  ctx.closePath();
  ctx.fill();

  // Internal facets in black
  ctx.fillStyle = '#000000';
  ctx.fillRect(-1, -4, 2, 2);
  ctx.fillRect(-0.5, -1, 1, 3);
}

/**
 * ⭐ 12x12 Micro Star
 */
function drawMicroStar(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  frameIndex: number
) {
  ctx.fillStyle = '#000000';
  ctx.fillRect(-6, -6, 12, 12);

  const s = 5 + Math.sin(frameIndex * 0.2) * 1;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.lineTo(1.5, -1.5);
  ctx.lineTo(s, 0);
  ctx.lineTo(1.5, 1.5);
  ctx.lineTo(0, s);
  ctx.lineTo(-1.5, 1.5);
  ctx.lineTo(-s, 0);
  ctx.lineTo(-1.5, -1.5);
  ctx.closePath();
  ctx.fill();
}
