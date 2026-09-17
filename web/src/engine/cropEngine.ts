/**
 * 2:1 Crop & Scale Math Engine (Feature F05)
 *
 * Provides:
 * - 2:1 Aspect Ratio Lock (W = 2 * H)
 * - Cover, Contain, and Stretch presets
 * - Orthogonal least-squares 8-handle resizing
 * - Cursor-centered zoom
 * - Target 128x64 canvas blitting with bicubic vs nearest-neighbor filtering
 */

import { CropSettings, FitMode } from '../types/media';

export const OLED_TARGET_WIDTH = 128;
export const OLED_TARGET_HEIGHT = 64;
export const OLED_TARGET_ASPECT = 2.0;

/**
 * Computes Cover preset: Centers and maximizes 2:1 crop rectangle to fill target frame
 * without any black borders.
 */
export function computeCoverCrop(sourceWidth: number, sourceHeight: number): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const targetAspect = OLED_TARGET_ASPECT;
  const sourceAspect = sourceWidth / sourceHeight;

  let cropWidth: number;
  let cropHeight: number;

  if (sourceAspect <= targetAspect) {
    // Source is narrower than or equal to 2:1 (e.g. 9:16 reels, 1:1, 4:3, 16:9)
    cropWidth = sourceWidth - (sourceWidth % 2); // Enforce even width
    cropHeight = Math.floor(cropWidth / targetAspect);
  } else {
    // Source is wider than 2:1 (e.g. 21:9 ultrawide)
    cropHeight = sourceHeight;
    cropWidth = cropHeight * 2;
  }

  // Center crop rectangle inside source bounds
  const x = Math.max(0, Math.floor((sourceWidth - cropWidth) / 2));
  const y = Math.max(0, Math.floor((sourceHeight - cropHeight) / 2));

  return { x, y, width: cropWidth, height: cropHeight };
}

/**
 * Computes Contain destination rectangle on 128x64 canvas (letterbox/pillarbox).
 */
export function computeContainDestRect(sourceWidth: number, sourceHeight: number): {
  dx: number;
  dy: number;
  dw: number;
  dh: number;
} {
  const scale = Math.min(OLED_TARGET_WIDTH / sourceWidth, OLED_TARGET_HEIGHT / sourceHeight);
  const dw = Math.max(1, Math.round(sourceWidth * scale));
  const dh = Math.max(1, Math.round(sourceHeight * scale));
  const dx = Math.floor((OLED_TARGET_WIDTH - dw) / 2);
  const dy = Math.floor((OLED_TARGET_HEIGHT - dh) / 2);

  return { dx, dy, dw, dh };
}

/**
 * Clamps crop settings to valid source boundaries while preserving W = 2H.
 */
export function clampCropToBounds(
  crop: { x: number; y: number; width: number; height: number },
  sourceWidth: number,
  sourceHeight: number
): { x: number; y: number; width: number; height: number } {
  const hMax = Math.min(sourceHeight, Math.floor(sourceWidth / 2));
  const hMin = Math.max(4, Math.min(8, hMax));

  let h = Math.max(hMin, Math.min(hMax, Math.round(crop.height)));
  let w = h * 2;

  // If width exceeds sourceWidth, constrain height
  if (w > sourceWidth) {
    w = sourceWidth - (sourceWidth % 2);
    h = Math.floor(w / 2);
  }

  const maxX = Math.max(0, sourceWidth - w);
  const maxY = Math.max(0, sourceHeight - h);

  const x = Math.max(0, Math.min(maxX, Math.round(crop.x)));
  const y = Math.max(0, Math.min(maxY, Math.round(crop.y)));

  return { x, y, width: w, height: h };
}

export type ResizeHandle = 'nw' | 'ne' | 'se' | 'sw' | 'n' | 's' | 'e' | 'w';

/**
 * Resizes 2:1 crop box using orthogonal least-squares projection onto aspect ray (2, 1).
 */
export function resizeCropWithHandle(
  handle: ResizeHandle,
  startCrop: { x: number; y: number; width: number; height: number },
  deltaX: number,
  deltaY: number,
  sourceWidth: number,
  sourceHeight: number
): { x: number; y: number; width: number; height: number } {
  const hMax = Math.min(sourceHeight, Math.floor(sourceWidth / 2));
  const hMin = Math.max(4, Math.min(8, hMax));

  const { x: X, y: Y, width: W, height: H } = startCrop;

  switch (handle) {
    case 'se': {
      // Anchor: Top-Left (X, Y)
      const dx = W + deltaX;
      const dy = H + deltaY;
      const hProj = Math.round((2 * dx + dy) / 5);
      const hLimit = Math.min(sourceHeight - Y, Math.floor((sourceWidth - X) / 2));
      const h = Math.max(hMin, Math.min(hLimit, hProj));
      const w = h * 2;
      return { x: X, y: Y, width: w, height: h };
    }

    case 'nw': {
      // Anchor: Bottom-Right (X + W, Y + H)
      const ax = X + W;
      const ay = Y + H;
      const dx = W - deltaX;
      const dy = H - deltaY;
      const hProj = Math.round((2 * dx + dy) / 5);
      const hLimit = Math.min(ay, Math.floor(ax / 2));
      const h = Math.max(hMin, Math.min(hLimit, hProj));
      const w = h * 2;
      return { x: ax - w, y: ay - h, width: w, height: h };
    }

    case 'ne': {
      // Anchor: Bottom-Left (X, Y + H)
      const ax = X;
      const ay = Y + H;
      const dx = W + deltaX;
      const dy = H - deltaY;
      const hProj = Math.round((2 * dx + dy) / 5);
      const hLimit = Math.min(ay, Math.floor((sourceWidth - ax) / 2));
      const h = Math.max(hMin, Math.min(hLimit, hProj));
      const w = h * 2;
      return { x: ax, y: ay - h, width: w, height: h };
    }

    case 'sw': {
      // Anchor: Top-Right (X + W, Y)
      const ax = X + W;
      const ay = Y;
      const dx = W - deltaX;
      const dy = H + deltaY;
      const hProj = Math.round((2 * dx + dy) / 5);
      const hLimit = Math.min(sourceHeight - ay, Math.floor(ax / 2));
      const h = Math.max(hMin, Math.min(hLimit, hProj));
      const w = h * 2;
      return { x: ax - w, y: ay, width: w, height: h };
    }

    case 'n': {
      // Anchor: Bottom Baseline Y + H, horizontal center preserved
      const yBottom = Y + H;
      const cx = X + W / 2;
      const rawH = H - deltaY;
      const hLimit = Math.min(yBottom, cx, sourceWidth - cx);
      const h = Math.max(hMin, Math.min(hLimit, Math.round(rawH)));
      const w = h * 2;
      return {
        x: Math.max(0, Math.min(sourceWidth - w, Math.round(cx - h))),
        y: yBottom - h,
        width: w,
        height: h,
      };
    }

    case 's': {
      // Anchor: Top Baseline Y, horizontal center preserved
      const cx = X + W / 2;
      const rawH = H + deltaY;
      const hLimit = Math.min(sourceHeight - Y, cx, sourceWidth - cx);
      const h = Math.max(hMin, Math.min(hLimit, Math.round(rawH)));
      const w = h * 2;
      return {
        x: Math.max(0, Math.min(sourceWidth - w, Math.round(cx - h))),
        y: Y,
        width: w,
        height: h,
      };
    }

    case 'e': {
      // Anchor: Left baseline X, vertical center preserved
      const cy = Y + H / 2;
      const rawW = W + deltaX;
      const wLimit = Math.min(sourceWidth - X, 4 * cy, 4 * (sourceHeight - cy));
      const rawEvenW = rawW - (rawW % 2);
      const w = Math.max(2 * hMin, Math.min(wLimit - (wLimit % 2), Math.round(rawEvenW)));
      const h = Math.round(w / 2);
      return {
        x: X,
        y: Math.max(0, Math.min(sourceHeight - h, Math.round(cy - h / 2))),
        width: w,
        height: h,
      };
    }

    case 'w': {
      // Anchor: Right baseline X + W, vertical center preserved
      const xRight = X + W;
      const cy = Y + H / 2;
      const rawW = W - deltaX;
      const wLimit = Math.min(xRight, 4 * cy, 4 * (sourceHeight - cy));
      const rawEvenW = rawW - (rawW % 2);
      const w = Math.max(2 * hMin, Math.min(wLimit - (wLimit % 2), Math.round(rawEvenW)));
      const h = Math.round(w / 2);
      return {
        x: xRight - w,
        y: Math.max(0, Math.min(sourceHeight - h, Math.round(cy - h / 2))),
        width: w,
        height: h,
      };
    }

    default:
      return startCrop;
  }
}

/**
 * Zoom crop rectangle around a focal point (e.g. mouse cursor in source coordinates).
 */
export function zoomCropAroundPoint(
  currentCrop: { x: number; y: number; width: number; height: number },
  sourceWidth: number,
  sourceHeight: number,
  zoomScale: number,
  centerX: number,
  centerY: number
): { x: number; y: number; width: number; height: number } {
  const hMax = Math.min(sourceHeight, Math.floor(sourceWidth / 2));
  const hMin = Math.max(4, Math.min(8, hMax));

  const targetH = Math.max(hMin, Math.min(hMax, Math.round(currentCrop.height * zoomScale)));
  const targetW = targetH * 2;

  const newX = Math.round(centerX - (centerX - currentCrop.x) * zoomScale);
  const newY = Math.round(centerY - (centerY - currentCrop.y) * zoomScale);

  return clampCropToBounds(
    { x: newX, y: newY, width: targetW, height: targetH },
    sourceWidth,
    sourceHeight
  );
}

/**
 * Render crop selection directly onto 128x64 canvas, returning 128x64 ImageData.
 */
export function renderCropTo128x64(
  source: CanvasImageSource,
  crop: CropSettings,
  targetCanvas?: HTMLCanvasElement
): ImageData {
  const canvas = targetCanvas || document.createElement('canvas');
  canvas.width = OLED_TARGET_WIDTH;
  canvas.height = OLED_TARGET_HEIGHT;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Failed to acquire 2D canvas rendering context');
  }

  // 1. Fill background with solid black
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, OLED_TARGET_WIDTH, OLED_TARGET_HEIGHT);

  // 2. Configure interpolation filter
  ctx.imageSmoothingEnabled = crop.smoothing;
  if (crop.smoothing) {
    ctx.imageSmoothingQuality = 'high';
  }

  // 3. Render according to fit mode
  if (crop.mode === 'stretch') {
    ctx.drawImage(
      source,
      0,
      0,
      crop.sourceWidth,
      crop.sourceHeight,
      0,
      0,
      OLED_TARGET_WIDTH,
      OLED_TARGET_HEIGHT
    );
  } else if (crop.mode === 'contain') {
    const { dx, dy, dw, dh } = computeContainDestRect(crop.sourceWidth, crop.sourceHeight);
    ctx.drawImage(
      source,
      0,
      0,
      crop.sourceWidth,
      crop.sourceHeight,
      dx,
      dy,
      dw,
      dh
    );
  } else {
    // 'cover' or custom interactive bounding box
    ctx.drawImage(
      source,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      OLED_TARGET_WIDTH,
      OLED_TARGET_HEIGHT
    );
  }

  // 4. Extract standardized 128x64 RGBA ImageData
  return ctx.getImageData(0, 0, OLED_TARGET_WIDTH, OLED_TARGET_HEIGHT);
}

/**
 * Helper to convert ImageData to an HTMLCanvasElement for use as CanvasImageSource.
 */
export function imageDataToCanvas(imageData: ImageData): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.putImageData(imageData, 0, 0);
  }
  return canvas;
}
