/**
 * Client-Side Media Ingestion Pipeline
 * Supports:
 * - C++ PROGMEM Header (`frames.h`, `.hpp`, `.cpp`) instant parsing
 * - MP4 & WebM Video (seek loop via headless <video>)
 * - Animated GIF (omggif binary parsing with disposal 0, 1, 2, 3)
 * - PNG / JPEG / WebP Sequences (natural sorting & createImageBitmap)
 */

import { GifReader, GifFrameInfo } from 'omggif';
import {
  ExtractedFrame,
  MediaSourceInfo,
  DecodedMedia,
  DecoderOptions,
} from '../types/media';

/**
 * Main dispatcher: automatically identifies dropped files and routes to the correct decoder.
 */
export async function decodeMedia(
  files: File[] | FileList,
  options: DecoderOptions = {}
): Promise<DecodedMedia> {
  const fileArray = Array.from(files);
  if (fileArray.length === 0) {
    throw new Error('No files provided to media decoder.');
  }

  // Multi-file drag: Route to sequence loader
  if (fileArray.length > 1) {
    return decodeImageSequence(fileArray, options);
  }

  // Single file drag
  const singleFile = fileArray[0];
  const mime = singleFile.type.toLowerCase();
  const name = singleFile.name.toLowerCase();

  // 1. C++ Header Instant Import (.h, .hpp, .cpp)
  if (name.endsWith('.h') || name.endsWith('.hpp') || name.endsWith('.cpp')) {
    return decodeCppHeader(singleFile, options);
  }

  if (mime === 'image/gif' || name.endsWith('.gif')) {
    return decodeGif(singleFile, options);
  }

  if (
    mime === 'video/mp4' ||
    mime === 'video/webm' ||
    name.endsWith('.mp4') ||
    name.endsWith('.webm')
  ) {
    return decodeVideo(singleFile, options);
  }

  if (mime.startsWith('image/') || /\.(png|jpe?g|webp|bmp)$/i.test(name)) {
    return decodeImageSequence([singleFile], options);
  }

  throw new Error(
    `Unsupported file type: "${singleFile.name}". Please upload MP4, WebM, GIF, PNG sequence, or C++ header (frames.h).`
  );
}

/**
 * Instant C++ Header Importer (`frames.h`)
 * Parses hex byte arrays directly back into 128x64 1-bit frames in < 50ms!
 */
export async function decodeCppHeader(
  file: File,
  options: DecoderOptions = {}
): Promise<DecodedMedia> {
  const { onProgress } = options;

  onProgress?.({
    stage: 'reading',
    currentFrame: 0,
    totalFrames: 0,
    percent: 0,
    message: `Parsing C++ header file ${file.name}...`
  });

  const text = await file.text();

  // Find all hex blocks { 0x00, 0xFF, ... }
  const hexBlockRegex = /\{([^}]+)\}/g;
  const matches = [...text.matchAll(hexBlockRegex)];

  if (matches.length === 0) {
    throw new Error(`No valid frame byte arrays found in header file: ${file.name}`);
  }

  // Parse FPS from header if present (#define FRAME_FPS 30)
  const fpsMatch = text.match(/#define\s+FRAME_FPS\s+(\d+)/);
  const targetFps = fpsMatch ? parseInt(fpsMatch[1], 10) : 30;

  const extractedFrames: ExtractedFrame[] = [];
  const frameDurationMs = 1000 / targetFps;

  let frameIdx = 0;
  for (const match of matches) {
    const hexString = match[1];
    const hexValues = hexString.match(/0x[0-9a-fA-F]{1,2}/g);

    if (!hexValues || hexValues.length < 1024) continue;

    const xbmpBytes = new Uint8Array(1024);
    for (let i = 0; i < 1024; i++) {
      xbmpBytes[i] = parseInt(hexValues[i], 16);
    }

    // Reconstruct 128x64 RGBA ImageData from 1024 XBMP bytes
    const imgData = new ImageData(128, 64);
    const data = imgData.data;

    for (let y = 0; y < 64; y++) {
      for (let xByte = 0; xByte < 16; xByte++) {
        const byteVal = xbmpBytes[y * 16 + xByte];
        for (let bit = 0; bit < 8; bit++) {
          const pixelX = xByte * 8 + bit;
          const isLit = (byteVal & (1 << bit)) !== 0;
          const val = isLit ? 255 : 0;
          const idx = (y * 128 + pixelX) * 4;

          data[idx] = val; // R
          data[idx + 1] = val; // G
          data[idx + 2] = val; // B
          data[idx + 3] = 255; // Alpha
        }
      }
    }

    extractedFrames.push({
      index: frameIdx,
      timestampMs: Math.round(frameIdx * frameDurationMs),
      durationMs: Math.round(frameDurationMs),
      imageData: imgData
    });
    frameIdx++;
  }

  if (extractedFrames.length === 0) {
    throw new Error(`Could not parse any 1024-byte XBMP frames from ${file.name}`);
  }

  const sourceInfo: MediaSourceInfo = {
    type: 'sequence',
    filename: file.name,
    sourceWidth: 128,
    sourceHeight: 64,
    frameCount: extractedFrames.length,
    fps: targetFps,
    durationMs: Math.round(extractedFrames.length * frameDurationMs)
  };

  onProgress?.({
    stage: 'complete',
    currentFrame: extractedFrames.length,
    totalFrames: extractedFrames.length,
    percent: 100,
    message: `Instantly imported ${extractedFrames.length} pre-compiled frames!`
  });

  return { sourceInfo, frames: extractedFrames };
}

/**
 * Video Decoder Implementation (MP4/WebM)
 */
export async function decodeVideo(
  file: File,
  options: DecoderOptions = {}
): Promise<DecodedMedia> {
  const { targetFps = 30, maxDimension = 512, signal, onProgress } = options;

  if (signal?.aborted) {
    throw new DOMException('Decoding aborted by user', 'AbortError');
  }

  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.crossOrigin = 'anonymous';
  video.src = objectUrl;

  try {
    await new Promise<void>((resolve, reject) => {
      const onLoaded = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error(`Failed to load video: ${file.name} (Codecs unsupported or file corrupt)`));
      };
      const cleanup = () => {
        video.removeEventListener('loadedmetadata', onLoaded);
        video.removeEventListener('error', onError);
      };
      video.addEventListener('loadedmetadata', onLoaded, { once: true });
      video.addEventListener('error', onError, { once: true });
    });

    let duration = video.duration;

    if (!Number.isFinite(duration) || duration <= 0) {
      duration = await new Promise<number>((resolve) => {
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked);
          const probed = Number.isFinite(video.duration) ? video.duration : video.currentTime;
          video.currentTime = 0;
          resolve(probed > 0 ? probed : 1.0);
        };
        video.addEventListener('seeked', onSeeked, { once: true });
        video.currentTime = 1e10;
      });
    }

    const sourceWidth = video.videoWidth || 128;
    const sourceHeight = video.videoHeight || 64;

    let drawWidth = sourceWidth;
    let drawHeight = sourceHeight;
    if (maxDimension && (sourceWidth > maxDimension || sourceHeight > maxDimension)) {
      const scale = Math.min(maxDimension / sourceWidth, maxDimension / sourceHeight);
      drawWidth = Math.max(1, Math.round(sourceWidth * scale));
      drawHeight = Math.max(1, Math.round(sourceHeight * scale));
    }

    const canvas = document.createElement('canvas');
    canvas.width = drawWidth;
    canvas.height = drawHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Failed to acquire 2D canvas context');
    ctx.imageSmoothingQuality = 'high';

    const frameStepSec = 1.0 / targetFps;
    const totalFrames = Math.max(1, Math.floor(duration * targetFps));
    const frameDurationMs = 1000 / targetFps;
    const extractedFrames: ExtractedFrame[] = [];

    onProgress?.({
      stage: 'decoding',
      currentFrame: 0,
      totalFrames,
      percent: 0,
      message: `Decoding video (0/${totalFrames})...`
    });

    for (let i = 0; i < totalFrames; i++) {
      if (signal?.aborted) {
        throw new DOMException('Decoding aborted by user', 'AbortError');
      }

      const targetTime = Math.min(i * frameStepSec, Math.max(0, duration - 0.001));

      await new Promise<void>((resolve, reject) => {
        let timeoutId: number | undefined;

        const onSeeked = () => {
          clearTimeout(timeoutId);
          cleanup();
          resolve();
        };

        const onError = (e: Event) => {
          clearTimeout(timeoutId);
          cleanup();
          reject(new Error(`Seek error at ${targetTime.toFixed(2)}s: ${(e as ErrorEvent).message}`));
        };

        const onTimeout = () => {
          cleanup();
          resolve();
        };

        const cleanup = () => {
          video.removeEventListener('seeked', onSeeked);
          video.removeEventListener('error', onError);
        };

        timeoutId = window.setTimeout(onTimeout, 1500);
        video.addEventListener('seeked', onSeeked, { once: true });
        video.addEventListener('error', onError, { once: true });
        video.currentTime = targetTime;
      });

      ctx.drawImage(video, 0, 0, drawWidth, drawHeight);
      const imageData = ctx.getImageData(0, 0, drawWidth, drawHeight);

      extractedFrames.push({
        index: i,
        timestampMs: Math.round(i * frameDurationMs),
        durationMs: Math.round(frameDurationMs),
        imageData
      });

      if (i % 5 === 0 || i === totalFrames - 1) {
        const percent = Math.round(((i + 1) / totalFrames) * 100);
        onProgress?.({
          stage: 'decoding',
          currentFrame: i + 1,
          totalFrames,
          percent,
          message: `Extracted frame ${i + 1} of ${totalFrames} (${percent}%)`
        });
      }
    }

    onProgress?.({
      stage: 'complete',
      currentFrame: totalFrames,
      totalFrames,
      percent: 100,
      message: `Decoded ${totalFrames} frames.`
    });

    const sourceInfo: MediaSourceInfo = {
      type: 'video',
      filename: file.name,
      sourceWidth,
      sourceHeight,
      frameCount: extractedFrames.length,
      fps: targetFps,
      durationMs: Math.round(duration * 1000)
    };

    return { sourceInfo, frames: extractedFrames };
  } finally {
    URL.revokeObjectURL(objectUrl);
    video.pause();
    video.src = '';
    video.load();
  }
}

/**
 * Animated GIF Decoder Implementation (`omggif`)
 */
export async function decodeGif(
  file: File,
  options: DecoderOptions = {}
): Promise<DecodedMedia> {
  const { signal, onProgress, maxDimension = 512 } = options;

  if (signal?.aborted) {
    throw new DOMException('Decoding aborted by user', 'AbortError');
  }

  onProgress?.({
    stage: 'reading',
    currentFrame: 0,
    totalFrames: 0,
    percent: 0,
    message: 'Reading GIF binary buffer...'
  });

  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);
  const reader = new GifReader(buffer);

  const numFrames = reader.numFrames();
  if (numFrames <= 0) {
    throw new Error(`GIF contains no valid frames: ${file.name}`);
  }

  const sourceWidth = reader.width;
  const sourceHeight = reader.height;

  const needsDownscale = Boolean(
    maxDimension && (sourceWidth > maxDimension || sourceHeight > maxDimension)
  );
  let targetW = sourceWidth;
  let targetH = sourceHeight;
  if (needsDownscale) {
    const scale = Math.min(maxDimension / sourceWidth, maxDimension / sourceHeight);
    targetW = Math.max(1, Math.round(sourceWidth * scale));
    targetH = Math.max(1, Math.round(sourceHeight * scale));
  }

  let rescaleCanvas: HTMLCanvasElement | null = null;
  let rescaleCtx: CanvasRenderingContext2D | null = null;
  if (needsDownscale) {
    rescaleCanvas = document.createElement('canvas');
    rescaleCanvas.width = targetW;
    rescaleCanvas.height = targetH;
    rescaleCtx = rescaleCanvas.getContext('2d', { willReadFrequently: true });
  }

  const pixelBuffer = new Uint8Array(sourceWidth * sourceHeight * 4);
  const snapshotBuffer = new Uint8Array(sourceWidth * sourceHeight * 4);

  const extractedFrames: ExtractedFrame[] = [];
  let currentTimestampMs = 0;
  let prevFrameInfo: GifFrameInfo | null = null;

  for (let i = 0; i < numFrames; i++) {
    if (signal?.aborted) {
      throw new DOMException('Decoding aborted by user', 'AbortError');
    }

    const frameInfo = reader.frameInfo(i);

    if (prevFrameInfo !== null && i > 0) {
      const prevDisposal = prevFrameInfo.disposal;

      if (prevDisposal === 2) {
        const { x, y, width, height } = prevFrameInfo;
        for (let row = 0; row < height; row++) {
          const rowStart = ((y + row) * sourceWidth + x) * 4;
          const rowEnd = rowStart + width * 4;
          pixelBuffer.fill(0, rowStart, rowEnd);
        }
      } else if (prevDisposal === 3) {
        pixelBuffer.set(snapshotBuffer);
      }
    }

    if (frameInfo.disposal === 3) {
      snapshotBuffer.set(pixelBuffer);
    }

    reader.decodeAndBlitFrameRGBA(i, pixelBuffer);

    const rawDelay = frameInfo.delay;
    const durationMs = (rawDelay <= 1 ? 10 : rawDelay) * 10;

    let frameImageData: ImageData;

    if (needsDownscale && rescaleCanvas && rescaleCtx) {
      const scratchCanvas = document.createElement('canvas');
      scratchCanvas.width = sourceWidth;
      scratchCanvas.height = sourceHeight;
      const scratchCtx = scratchCanvas.getContext('2d')!;
      const unscaledData = new ImageData(new Uint8ClampedArray(pixelBuffer), sourceWidth, sourceHeight);
      scratchCtx.putImageData(unscaledData, 0, 0);

      rescaleCtx.clearRect(0, 0, targetW, targetH);
      rescaleCtx.drawImage(scratchCanvas, 0, 0, targetW, targetH);
      frameImageData = rescaleCtx.getImageData(0, 0, targetW, targetH);
    } else {
      frameImageData = new ImageData(
        new Uint8ClampedArray(pixelBuffer),
        sourceWidth,
        sourceHeight
      );
    }

    extractedFrames.push({
      index: i,
      timestampMs: currentTimestampMs,
      durationMs,
      imageData: frameImageData
    });

    currentTimestampMs += durationMs;
    prevFrameInfo = frameInfo;

    if (i % 5 === 0 || i === numFrames - 1) {
      const percent = Math.round(((i + 1) / numFrames) * 100);
      onProgress?.({
        stage: 'decoding',
        currentFrame: i + 1,
        totalFrames: numFrames,
        percent,
        message: `Decoded GIF frame ${i + 1} of ${numFrames} (${percent}%)`
      });
    }
  }

  const totalDurationMs = currentTimestampMs > 0 ? currentTimestampMs : numFrames * 100;
  const computedFps = Math.max(1, Math.round((numFrames * 1000) / totalDurationMs));

  const sourceInfo: MediaSourceInfo = {
    type: 'gif',
    filename: file.name,
    sourceWidth: needsDownscale ? targetW : sourceWidth,
    sourceHeight: needsDownscale ? targetH : sourceHeight,
    frameCount: extractedFrames.length,
    fps: computedFps,
    durationMs: totalDurationMs
  };

  onProgress?.({
    stage: 'complete',
    currentFrame: numFrames,
    totalFrames: numFrames,
    percent: 100,
    message: `GIF decoding complete: ${numFrames} frames.`
  });

  return { sourceInfo, frames: extractedFrames };
}

/**
 * PNG / Image Sequence Loader Implementation
 */
export async function decodeImageSequence(
  files: File[] | FileList,
  options: DecoderOptions = {}
): Promise<DecodedMedia> {
  const { targetFps = 30, maxDimension = 512, signal, onProgress } = options;

  if (signal?.aborted) {
    throw new DOMException('Decoding aborted by user', 'AbortError');
  }

  const fileArray = Array.from(files).filter((file) =>
    file.type.startsWith('image/') || /\.(png|jpe?g|webp|bmp|gif)$/i.test(file.name)
  );

  if (fileArray.length === 0) {
    throw new Error('No valid image files found in sequence.');
  }

  fileArray.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  );

  const totalFrames = fileArray.length;
  const frameDurationMs = 1000 / targetFps;

  onProgress?.({
    stage: 'reading',
    currentFrame: 0,
    totalFrames,
    percent: 0,
    message: `Found ${totalFrames} frames. Initializing decoder...`
  });

  let baseWidth = 0;
  let baseHeight = 0;
  let drawWidth = 0;
  let drawHeight = 0;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Failed to create 2D canvas context');
  ctx.imageSmoothingQuality = 'high';

  const extractedFrames: ExtractedFrame[] = [];

  for (let i = 0; i < totalFrames; i++) {
    if (signal?.aborted) {
      throw new DOMException('Decoding aborted by user', 'AbortError');
    }

    const file = fileArray[i];
    let bmp: ImageBitmap | null = null;

    try {
      bmp = await createImageBitmap(file);

      if (i === 0) {
        baseWidth = bmp.width;
        baseHeight = bmp.height;

        drawWidth = baseWidth;
        drawHeight = baseHeight;
        if (maxDimension && (baseWidth > maxDimension || baseHeight > maxDimension)) {
          const scale = Math.min(maxDimension / baseWidth, maxDimension / baseHeight);
          drawWidth = Math.max(1, Math.round(baseWidth * scale));
          drawHeight = Math.max(1, Math.round(baseHeight * scale));
        }

        canvas.width = drawWidth;
        canvas.height = drawHeight;
      }

      ctx.clearRect(0, 0, drawWidth, drawHeight);

      if (bmp.width === baseWidth && bmp.height === baseHeight) {
        ctx.drawImage(bmp, 0, 0, drawWidth, drawHeight);
      } else {
        const scale = Math.min(drawWidth / bmp.width, drawHeight / bmp.height);
        const w = bmp.width * scale;
        const h = bmp.height * scale;
        const dx = (drawWidth - w) / 2;
        const dy = (drawHeight - h) / 2;
        ctx.drawImage(bmp, dx, dy, w, h);
      }

      const imageData = ctx.getImageData(0, 0, drawWidth, drawHeight);

      extractedFrames.push({
        index: i,
        timestampMs: Math.round(i * frameDurationMs),
        durationMs: Math.round(frameDurationMs),
        imageData
      });
    } catch {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const el = new Image();
        el.onload = () => {
          URL.revokeObjectURL(url);
          resolve(el);
        };
        el.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error(`Failed to decode image: ${file.name}`));
        };
        el.src = url;
      });

      if (i === 0) {
        baseWidth = img.naturalWidth;
        baseHeight = img.naturalHeight;
        drawWidth = baseWidth;
        drawHeight = baseHeight;
        canvas.width = drawWidth;
        canvas.height = drawHeight;
      }

      ctx.clearRect(0, 0, drawWidth, drawHeight);
      ctx.drawImage(img, 0, 0, drawWidth, drawHeight);
      const imageData = ctx.getImageData(0, 0, drawWidth, drawHeight);

      extractedFrames.push({
        index: i,
        timestampMs: Math.round(i * frameDurationMs),
        durationMs: Math.round(frameDurationMs),
        imageData
      });
    } finally {
      bmp?.close();
    }

    if (i % 10 === 0 || i === totalFrames - 1) {
      const percent = Math.round(((i + 1) / totalFrames) * 100);
      onProgress?.({
        stage: 'decoding',
        currentFrame: i + 1,
        totalFrames,
        percent,
        message: `Loaded frame ${i + 1} of ${totalFrames} (${percent}%)`
      });
    }
  }

  const durationMs = Math.round(totalFrames * frameDurationMs);

  const sourceInfo: MediaSourceInfo = {
    type: 'sequence',
    filename: totalFrames === 1 ? fileArray[0].name : `${fileArray[0].name} (+${totalFrames - 1} frames)`,
    sourceWidth: drawWidth,
    sourceHeight: drawHeight,
    frameCount: totalFrames,
    fps: targetFps,
    durationMs
  };

  onProgress?.({
    stage: 'complete',
    currentFrame: totalFrames,
    totalFrames,
    percent: 100,
    message: `Successfully loaded ${totalFrames} frames.`
  });

  return { sourceInfo, frames: extractedFrames };
}

/**
 * Resample an array of variable-duration frames onto a fixed target FPS grid.
 */
export function resampleFramesToFps(
  frames: ExtractedFrame[],
  targetFps: number
): ExtractedFrame[] {
  if (frames.length === 0) return [];

  const totalDurationMs = frames.reduce((acc, f) => acc + f.durationMs, 0);
  const targetStepMs = 1000 / targetFps;
  const numTargetFrames = Math.max(1, Math.round(totalDurationMs / targetStepMs));

  const resampled: ExtractedFrame[] = [];
  let sourceIndex = 0;

  for (let i = 0; i < numTargetFrames; i++) {
    const targetTimeMs = i * targetStepMs;

    while (
      sourceIndex < frames.length - 1 &&
      frames[sourceIndex + 1].timestampMs <= targetTimeMs
    ) {
      sourceIndex++;
    }

    const currentSource = frames[sourceIndex];
    resampled.push({
      index: i,
      timestampMs: Math.round(targetTimeMs),
      durationMs: Math.round(targetStepMs),
      imageData: currentSource.imageData
    });
  }

  return resampled;
}
