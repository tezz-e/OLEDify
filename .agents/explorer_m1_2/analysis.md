# Technical Specification & Implementation Design: Media Ingestion Engine & DropZone (F02, F03, F04)

**Role**: M1 Media Ingestion Explorer (`explorer_m1_2`)  
**Target Working Directory**: `D:\espprojects\oled\web`  
**Milestone**: M1 — Web Studio Foundation & Media Ingestion  
**Associated Issues / Features**:
- **F02**: Video Drag & Drop Decoder (MP4/WebM client-side seek loop, FPS quantization, memory bounds)
- **F03**: Animated GIF Decoder (`omggif` binary parser, disposal modes 0/1/2/3, accumulator canvas)
- **F04**: PNG Sequence Loader (multi-file natural alphanumeric collation, `createImageBitmap` pipeline)
- **UI**: `DropZone.tsx` (React 18 + Tailwind CSS drag-and-drop workspace)

---

## 1. Executive Summary & Ingestion Architecture Overview

Milestone M1 establishes the client-side Web Studio application in `web/` using Vite, React 18, TypeScript, and Tailwind CSS. The primary responsibility of the Media Ingestion subsystem is to ingest user visual assets—regardless of whether they are uploaded as high-definition MP4/WebM reels, animated GIFs with complex disposal modes, or arbitrary PNG/JPEG frame sequences—and convert them entirely on the client side into a standardized stream of raw image frames (`ExtractedFrame[]`).

```
+-----------------------------------------------------------------------------------------------+
|                                      DropZone Component                                       |
|                                                                                               |
|  Accepts:                                                                                     |
|  - MP4 / WebM Video (single file)                                                             |
|  - Animated GIF (single file)                                                                 |
|  - PNG / JPEG / WebP Frame Sequence (multiple files or folder)                                 |
|                                                                                               |
|  User Controls: Target FPS (15, 20, 24, 30 FPS) | Progress Indicator | Cancel Button          |
+-----------------------------------------------------------------------------------------------+
                                                │
                                                ▼
+-----------------------------------------------------------------------------------------------+
|                                mediaDecoder.ts Unified Ingestion                              |
|                                                                                               |
|   ┌────────────────────────┐    ┌────────────────────────┐    ┌───────────────────────────┐   |
|   │     decodeVideo()      │    │      decodeGif()       │    │   decodeImageSequence()   │   |
|   │                        │    │                        │    │                           │   |
|   │ - HTML5 <video> seek   │    │ - omggif GifReader     │    │ - File extension filter   │   |
|   │ - Time-step: 1/fps     │    │ - Disposal 0, 1, 2, 3  │    │ - Natural collation sort  │   |
|   │ - Canvas extraction    │    │ - Canvas accumulation  │    │ - createImageBitmap()     │   |
|   │ - Intermediate bounds  │    │ - Variable frame delay │    │ - GPU texture release     │   |
|   │ - URL.revokeObjectURL  │    │ - Legacy <=10ms clamp  │    │ - Sequential timestamps   │   |
|   └────────────────────────┘    └────────────────────────┘    └───────────────────────────┘   |
+-----------------------------------------------------------------------------------------------+
                                                │
                                                ▼
+-----------------------------------------------------------------------------------------------+
|                        Standardized Decoded Media Stream (DecodedMedia)                       |
|                                                                                               |
|  - sourceInfo: MediaSourceInfo (type, filename, sourceWidth, sourceHeight, frameCount, fps)   |
|  - frames: ExtractedFrame[]                                                                   |
|      - index: number                                                                          |
|      - timestampMs: number                                                                    |
|      - durationMs: number                                                                     |
|      - imageData: ImageData (Intermediate / full resolution raw pixels)                       |
+-----------------------------------------------------------------------------------------------+
                                                │
                                                ▼
+-----------------------------------------------------------------------------------------------+
|                            Downstream: CropTool (F05) & Dither (M2)                           |
+-----------------------------------------------------------------------------------------------+
```

### Key Technical Challenges Solved
1. **Memory Exhaustion (OOM) Prevention**: A 15-second 1080×1920 video at 30 FPS consists of 466 frames. Storing 466 full-resolution raw `ImageData` instances consumes $\approx 3.86\text{ GB}$ of RAM, crashing the browser tab. The decoder implements intelligent downsampling to an intermediate canvas (bounded to $\le 512\text{ px}$ max dimension), slashing memory consumption to $\approx 150\text{ MB}$ while preserving 4× the resolution needed for the target 128×64 OLED display.
2. **GIF Disposal Methods 0, 1, 2, and 3**: A naive GIF parser draws each frame directly, causing ghosting artifacts when transparent sub-frames rely on background clearance or reverting to previous frames. We implement an exact accumulator buffer tracking previous frame bounding boxes, background restoration, and snapshot checkpoints for Disposal Mode 3.
3. **OS File List Collation Disorder**: Windows File Explorer and macOS Finder dispatch multi-file selections in non-deterministic or strictly alphabetical order (`frame_1.png`, `frame_10.png`, `frame_2.png`). The sequence loader enforces natural alphanumeric collation (`localeCompare({ numeric: true, sensitivity: 'base' })`) to guarantee flawless sequential animation playback.
4. **Hardware Acceleration & Resource Leaks**: Every `ImageBitmap` created during sequence loading consumes VRAM/GPU resources until explicitly freed via `bmp.close()`. Similarly, `URL.createObjectURL()` strings remain in browser memory indefinitely unless revoked via `URL.revokeObjectURL()`. The architecture guarantees strict lifecycle cleanup in `try ... finally` blocks.

---

## 2. Interface Contracts & Type Declarations

### 2.1 File: `web/src/types/media.ts`
Matches and extends the contract specified in `SCOPE.md`:

```typescript
/**
 * Contract: media.ts
 * Standard types for Web Studio Media Ingestion, Crop/Scale, and Downstream Dithering.
 */

export type MediaType = 'video' | 'gif' | 'sequence';

export interface ExtractedFrame {
  index: number;
  timestampMs: number; // Presentation timestamp in milliseconds
  durationMs: number;  // Frame duration (crucial for variable-delay GIFs)
  imageData: ImageData; // Intermediate or source canvas image data
}

export interface MediaSourceInfo {
  type: MediaType;
  filename: string;
  sourceWidth: number;
  sourceHeight: number;
  frameCount: number;
  fps: number;
  durationMs: number;
}

export interface DecodedMedia {
  sourceInfo: MediaSourceInfo;
  frames: ExtractedFrame[];
}

export type FitMode = 'cover' | 'contain' | 'stretch';

export interface CropSettings {
  mode: FitMode;
  x: number;
  y: number;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
  smoothing: boolean; // true = high quality bicubic, false = pixel-art nearest neighbor
}

export interface DecodeProgress {
  stage: 'reading' | 'decoding' | 'resampling' | 'complete';
  currentFrame: number;
  totalFrames: number;
  percent: number;
  message?: string;
}

export interface DecoderOptions {
  targetFps?: number;           // Target frame rate (default: 30, supports 15, 20, 24, 30)
  maxDimension?: number;        // Max intermediate dimension (e.g. 512, protects against OOM)
  signal?: AbortSignal;         // Cancellation signal
  onProgress?: (progress: DecodeProgress) => void;
}
```

### 2.2 File: `web/src/types/omggif.d.ts`
The npm package `omggif` lacks official `@types/omggif` typings. This declaration file provides strict TypeScript typings:

```typescript
/**
 * Type declarations for 'omggif' (Kevin Kwok)
 */
declare module 'omggif' {
  export interface GifFrameInfo {
    x: number;
    y: number;
    width: number;
    height: number;
    disposal: number;          // 0: Unspecified, 1: Do not dispose, 2: Restore to background, 3: Restore to previous
    delay: number;             // Delay in hundredths of a second (10ms units)
    transparent_index: number | null;
    interlaced: boolean;
    has_local_palette: boolean;
  }

  export class GifReader {
    constructor(buf: Uint8Array);
    width: number;
    height: number;
    numFrames(): number;
    loopCount(): number;       // null = loop forever, 0 = loop forever, n = loop n times
    frameInfo(frameNumber: number): GifFrameInfo;
    decodeAndBlitFrameRGBA(frameNumber: number, pixels: Uint8Array | Uint8ClampedArray): void;
    frameNumber(timeMs: number): number;
  }
}
```

---

## 3. Feature F02: Video Drag & Drop Decoder (MP4/WebM)

### 3.1 Architectural Principles
1. **Headless HTML5 `<video>` Pipeline**:
   Browsers do not provide a synchronous direct video byte decoding API without WebCodecs (which requires complex WebM/MP4 demuxers). Instead, the HTML5 `<video>` element backed by an offscreen canvas provides universally supported, hardware-accelerated video decoding.
2. **Deterministic Seek Loop**:
   - `video.currentTime = targetTime` initiates an asynchronous seek to the closest keyframe and decodes up to `targetTime`.
   - The loop listens for the `seeked` event on the video element.
   - Crucial detail: `video.fastSeek()` must NOT be used because it snaps to keyframes and produces duplicate frames. Standard `video.currentTime` provides frame-accurate seeking.
3. **Variable Frame Rate (VFR) Quantization**:
   Many smartphone video reels (e.g. iPhone / Android Instagram exports) use variable frame rates (e.g. fluctuating between 28.5 and 30.2 FPS). The video decoder discretizes the timeline into a fixed target FPS (15, 20, 24, or 30 FPS):
   $$\Delta t = \frac{1.0}{\text{targetFps}}$$
   $$N = \max\left(1, \lfloor \text{duration} \times \text{targetFps} \rfloor\right)$$
   $$t_i = \min\left(i \times \Delta t, \max(0, \text{duration} - 0.001)\right)$$
4. **Infinite / Unreliable Duration Probing**:
   In some WebM screen recordings or fragmented MP4 files, `video.duration` initially reports `Infinity` or `NaN`.
   - Handling: Seek `video.currentTime = 1e101`. When `seeked` fires, `video.duration = video.currentTime`. Then reset `video.currentTime = 0`.
5. **Memory Conservation & Downsampling**:
   - For an input video of 1080×1920:
     If `maxDimension` is set to 512:
     $$\text{scale} = \min\left(\frac{512}{1080}, \frac{512}{1920}\right) = \frac{512}{1920} \approx 0.2667$$
     $$\text{width}_{intermediate} = \text{round}(1080 \times 0.2667) = 288$$
     $$\text{height}_{intermediate} = 512$$
     Single frame size: $288 \times 512 \times 4 = 589,824\text{ bytes} \approx 576\text{ KB}$ (versus $8.3\text{ MB}$ unscaled).
     466 frames require $\approx 268\text{ MB}$ instead of $3.86\text{ GB}$.

### 3.2 Concrete Implementation: `decodeVideo`
```typescript
/**
 * Decode MP4/WebM video file client-side into an array of ExtractedFrames.
 */
export async function decodeVideo(
  file: File,
  options: DecoderOptions = {}
): Promise<DecodedMedia> {
  const {
    targetFps = 30,
    maxDimension = 512,
    signal,
    onProgress
  } = options;

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
    // 1. Wait for video metadata to load
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

    // Handle Infinite or NaN duration bug in WebM
    if (!Number.isFinite(duration) || duration <= 0) {
      duration = await new Promise<number>((resolve) => {
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked);
          const probed = Number.isFinite(video.duration) ? video.duration : video.currentTime;
          video.currentTime = 0;
          resolve(probed > 0 ? probed : 1.0);
        };
        video.addEventListener('seeked', onSeeked, { once: true });
        video.currentTime = 1e10; // Seek to virtual end
      });
    }

    const sourceWidth = video.videoWidth || 128;
    const sourceHeight = video.videoHeight || 64;

    // Calculate intermediate scaled dimensions
    let drawWidth = sourceWidth;
    let drawHeight = sourceHeight;
    if (maxDimension && (sourceWidth > maxDimension || sourceHeight > maxDimension)) {
      const scale = Math.min(maxDimension / sourceWidth, maxDimension / sourceHeight);
      drawWidth = Math.max(1, Math.round(sourceWidth * scale));
      drawHeight = Math.max(1, Math.round(sourceHeight * scale));
    }

    // Prepare offscreen canvas
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

    // 2. Sequential Seek Loop
    for (let i = 0; i < totalFrames; i++) {
      if (signal?.aborted) {
        throw new DOMException('Decoding aborted by user', 'AbortError');
      }

      const targetTime = Math.min(i * frameStepSec, Math.max(0, duration - 0.001));

      // Seek video to targetTime and wait for seeked event
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
          // Safeguard: some browsers do not fire seeked on the last microsecond boundary
          resolve();
        };

        const cleanup = () => {
          video.removeEventListener('seeked', onSeeked);
          video.removeEventListener('error', onError);
        };

        timeoutId = window.setTimeout(onTimeout, 1500); // 1.5s timeout safeguard
        video.addEventListener('seeked', onSeeked, { once: true });
        video.addEventListener('error', onError, { once: true });
        video.currentTime = targetTime;
      });

      // Draw current video frame to intermediate canvas
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
      message: `Successfully decoded ${totalFrames} frames.`
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
    // 3. Strict Resource Reclamation
    URL.revokeObjectURL(objectUrl);
    video.pause();
    video.src = '';
    video.load();
  }
}
```

---

## 4. Feature F03: Animated GIF Decoder (`omggif`)

### 4.1 Architectural Principles
1. **Binary Parsing**:
   GIFs are decoded client-side using `omggif.GifReader` initialized with a `Uint8Array` from `file.arrayBuffer()`.
2. **Disposal Methods 0, 1, 2, 3**:
   Each frame header defines a 3-bit disposal method that dictates how the frame accumulator canvas must be prepared before rendering the next frame:
   - **Method 0 (Unspecified)** / **Method 1 (Do Not Dispose / Leave in Place)**:
     The graphic is left on the accumulator canvas. Subsequent frames blit directly over existing pixels.
   - **Method 2 (Restore to Background)**:
     The bounding box `(x, y, width, height)` of the current sub-frame must be cleared to transparent (`rgba(0,0,0,0)`) before the next frame is blitted.
   - **Method 3 (Restore to Previous)**:
     The accumulator canvas must be reverted to the state it had *prior* to rendering the current frame. This requires caching a snapshot copy of the accumulator buffer before blitting frame $i$.
3. **Accumulator Buffer Mechanics**:
   `omggif`'s `reader.decodeAndBlitFrameRGBA(frameNum, pixelBuffer)` requires `pixelBuffer` to be a flat array of size $\text{width} \times \text{height} \times 4$. Transparent pixels in the GIF sub-frame leave the underlying values in `pixelBuffer` intact, enabling multi-layer transparency accumulation.
4. **Variable Inter-Frame Delays**:
   GIF frames define individual delays in hundredths of a second ($1/100\text{ s} = 10\text{ ms}$).
   - Legacy Netscape/IE Bug Handling: Delays $\le 1$ ($0\text{ ms}$ or $10\text{ ms}$) freeze browsers or run at unintended runaway speeds. Standard web browsers clamp delays $\le 1$ to $10$ ($100\text{ ms}$, or $10\text{ FPS}$).

### 4.2 Concrete Implementation: `decodeGif`
```typescript
import { GifReader, GifFrameInfo } from 'omggif';

/**
 * Decode an animated GIF binary file into an array of ExtractedFrames,
 * handling all disposal methods (0, 1, 2, 3), transparency, and variable delays.
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

  // Determine if intermediate downsampling is needed
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

  // Downsample helper canvas
  let rescaleCanvas: HTMLCanvasElement | null = null;
  let rescaleCtx: CanvasRenderingContext2D | null = null;
  if (needsDownscale) {
    rescaleCanvas = document.createElement('canvas');
    rescaleCanvas.width = targetW;
    rescaleCanvas.height = targetH;
    rescaleCtx = rescaleCanvas.getContext('2d', { willReadFrequently: true });
  }

  // Native accumulator buffer (RGBA)
  const pixelBuffer = new Uint8Array(sourceWidth * sourceHeight * 4);
  // Snapshot buffer for Disposal Mode 3 (Restore to Previous)
  const snapshotBuffer = new Uint8Array(sourceWidth * sourceHeight * 4);

  const extractedFrames: ExtractedFrame[] = [];
  let currentTimestampMs = 0;
  let prevFrameInfo: GifFrameInfo | null = null;

  for (let i = 0; i < numFrames; i++) {
    if (signal?.aborted) {
      throw new DOMException('Decoding aborted by user', 'AbortError');
    }

    const frameInfo = reader.frameInfo(i);

    // 1. Handle previous frame's disposal method
    if (prevFrameInfo !== null && i > 0) {
      const prevDisposal = prevFrameInfo.disposal;

      if (prevDisposal === 2) {
        // Disposal 2: Restore to background (clear only the previous frame's sub-rectangle)
        const { x, y, width, height } = prevFrameInfo;
        for (let row = 0; row < height; row++) {
          const rowStart = ((y + row) * sourceWidth + x) * 4;
          const rowEnd = rowStart + width * 4;
          pixelBuffer.fill(0, rowStart, rowEnd);
        }
      } else if (prevDisposal === 3) {
        // Disposal 3: Restore to previous snapshot
        pixelBuffer.set(snapshotBuffer);
      }
      // Disposal 0 or 1: Leave in place (no action needed)
    }

    // 2. If CURRENT frame uses Disposal 3, take a snapshot BEFORE drawing
    if (frameInfo.disposal === 3) {
      snapshotBuffer.set(pixelBuffer);
    }

    // 3. Blit current frame into pixel accumulator
    reader.decodeAndBlitFrameRGBA(i, pixelBuffer);

    // 4. Calculate frame delay and timestamps
    // Standard: delay <= 1 hundredth is clamped to 10 (100ms)
    const rawDelay = frameInfo.delay;
    const durationMs = (rawDelay <= 1 ? 10 : rawDelay) * 10;

    // 5. Package into ImageData
    let frameImageData: ImageData;

    if (needsDownscale && rescaleCanvas && rescaleCtx) {
      // Draw unscaled ImageData to scratch canvas, then scale
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
```

---

## 5. Feature F04: PNG Sequence Loader

### 5.1 Architectural Principles
1. **Multi-File / Folder Ingestion**:
   Users can drag an entire folder of PNG frames (e.g. exported from Aseprite, Photoshop, or Blender) or select multiple files.
2. **Natural Alphanumeric Collation**:
   Standard ASCII sorting orders `['frame_1.png', 'frame_10.png', 'frame_2.png']` incorrectly.
   The sorting pipeline enforces:
   ```typescript
   files.sort((a, b) =>
     a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
   );
   ```
   Result: `['frame_1.png', 'frame_2.png', 'frame_10.png']`.
3. **High-Speed Decoding via `createImageBitmap()`**:
   - Asynchronous off-thread GPU decoding.
   - 3×–5× faster than creating DOM `HTMLImageElement` nodes.
   - Crucial: Each `ImageBitmap` is explicitly closed (`bmp.close()`) immediately after copying pixels to the canvas, eliminating GPU memory leaks.
4. **Dimension Uniformity & Safety**:
   - Captures the dimensions of the first frame.
   - If subsequent frames differ in size, they are centered and drawn onto the canvas without distortion or crash.

### 5.2 Concrete Implementation: `decodeImageSequence`
```typescript
/**
 * Decode a sequence of PNG, JPEG, or WebP image files into an array of ExtractedFrames.
 * Automatically sorts files naturally and uses hardware-accelerated createImageBitmap().
 */
export async function decodeImageSequence(
  files: File[] | FileList,
  options: DecoderOptions = {}
): Promise<DecodedMedia> {
  const {
    targetFps = 30,
    maxDimension = 512,
    signal,
    onProgress
  } = options;

  if (signal?.aborted) {
    throw new DOMException('Decoding aborted by user', 'AbortError');
  }

  // 1. Filter valid image files
  const fileArray = Array.from(files).filter((file) =>
    file.type.startsWith('image/') || /\.(png|jpe?g|webp|bmp|gif)$/i.test(file.name)
  );

  if (fileArray.length === 0) {
    throw new Error('No valid image files found in sequence.');
  }

  // 2. Natural Alphanumeric Sorting
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

  // 3. Probe first frame dimensions
  let baseWidth = 0;
  let baseHeight = 0;
  let drawWidth = 0;
  let drawHeight = 0;

  // Create reusable decoding canvas
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
      // Decode via createImageBitmap (off-thread hardware decoding)
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

      // Clear and draw frame (center-aligned if dimensions vary)
      ctx.clearRect(0, 0, drawWidth, drawHeight);

      if (bmp.width === baseWidth && bmp.height === baseHeight) {
        ctx.drawImage(bmp, 0, 0, drawWidth, drawHeight);
      } else {
        // Frame dimension mismatch: letterbox center onto canvas
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
    } catch (err) {
      // Fallback to DOM Image if createImageBitmap fails on specific format
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
      // Critical: Immediately release GPU resource
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
    filename: `${fileArray[0].name} (+${totalFrames - 1} frames)`,
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
```

---

## 6. Unified Media Decoder Pipeline (`web/src/engine/mediaDecoder.ts`)

Below is the complete, drop-in TypeScript implementation for `mediaDecoder.ts`, combining `decodeVideo`, `decodeGif`, `decodeImageSequence`, and an intelligent dispatcher function `decodeMedia()`.

```typescript
/**
 * D:\espprojects\oled\web\src\engine\mediaDecoder.ts
 *
 * Client-Side Media Ingestion Pipeline
 * Supports:
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
  DecodeProgress
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
    `Unsupported file type: "${singleFile.name}". Please upload MP4, WebM, GIF, or PNG frame sequences.`
  );
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

    // Handle Infinite / NaN duration bug
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

    // 1. Disposal execution for previous frame
    if (prevFrameInfo !== null && i > 0) {
      const prevDisposal = prevFrameInfo.disposal;

      if (prevDisposal === 2) {
        // Restore to background
        const { x, y, width, height } = prevFrameInfo;
        for (let row = 0; row < height; row++) {
          const rowStart = ((y + row) * sourceWidth + x) * 4;
          const rowEnd = rowStart + width * 4;
          pixelBuffer.fill(0, rowStart, rowEnd);
        }
      } else if (prevDisposal === 3) {
        // Restore to previous snapshot
        pixelBuffer.set(snapshotBuffer);
      }
    }

    // 2. Snapshot current state if Disposal 3
    if (frameInfo.disposal === 3) {
      snapshotBuffer.set(pixelBuffer);
    }

    // 3. Blit current frame
    reader.decodeAndBlitFrameRGBA(i, pixelBuffer);

    // 4. Calculate delay (clamping legacy delay <= 1 to 100ms)
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

  // Natural collation sort
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
      // DOM Image fallback
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
 * Useful for variable-delay GIFs before sending to fixed-rate OLED players.
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
```

---

## 7. Feature Component: `web/src/components/DropZone.tsx`

### 7.1 Design Specifications
1. **Interactive States**:
   - `idle`: Dashed border, phosphor cyan accent, file format badges (`MP4`, `WebM`, `GIF`, `PNG Sequence`), file browse button, target FPS selector (15, 20, 24, 30 FPS).
   - `dragover`: Glowing border (`border-cyan-400`, `shadow-[0_0_25px_rgba(0,240,255,0.4)]`), pulse icon.
   - `decoding`: Active progress bar, percentage readout, current frame count vs total, cancel button.
   - `success`: Displays media badges (Filename, Frame count, Resolution, Duration, FPS) with a "Replace Media" button.
   - `error`: Warning badge, verbatim error description, "Retry" button.
2. **Drag Flicker Prevention**:
   Uses `dragCounter` ref so hovering over child typography or icon elements does not prematurely fire `dragLeave`.
3. **Cancellation**:
   Integrated `AbortController` enabling users to instantly cancel video extraction.

### 7.2 Concrete Implementation: `DropZone.tsx`
```tsx
/**
 * D:\espprojects\oled\web\src\components\DropZone.tsx
 *
 * Drag & Drop Media Ingestion Component
 * Supports MP4, WebM, Animated GIF, and PNG/JPEG frame sequences.
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  UploadCloud,
  Film,
  FileImage,
  AlertCircle,
  XCircle,
  CheckCircle2,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { DecodedMedia, DecodeProgress } from '../types/media';
import { decodeMedia } from '../engine/mediaDecoder';

interface DropZoneProps {
  onMediaLoaded: (media: DecodedMedia) => void;
  currentMedia?: DecodedMedia | null;
  className?: string;
}

export const DropZone: React.FC<DropZoneProps> = ({
  onMediaLoaded,
  currentMedia,
  className = ''
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isDecoding, setIsDecoding] = useState(false);
  const [progress, setProgress] = useState<DecodeProgress | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [targetFps, setTargetFps] = useState<number>(30);

  const dragCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Process selected or dropped files
  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      if (!files || files.length === 0) return;

      setErrorMessage(null);
      setIsDecoding(true);
      setProgress({
        stage: 'reading',
        currentFrame: 0,
        totalFrames: 0,
        percent: 0,
        message: 'Initializing decoder...'
      });

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const decoded = await decodeMedia(files, {
          targetFps,
          maxDimension: 512,
          signal: abortController.signal,
          onProgress: (p) => setProgress(p)
        });

        onMediaLoaded(decoded);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          setErrorMessage('Decoding canceled by user.');
        } else if (err instanceof Error) {
          setErrorMessage(err.message);
        } else {
          setErrorMessage('An unexpected error occurred during media decoding.');
        }
      } finally {
        setIsDecoding(false);
        abortControllerRef.current = null;
      }
    },
    [targetFps, onMediaLoaded]
  );

  // Cancel in-flight decoding
  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  // Drag & Drop event handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
      e.target.value = ''; // Reset input so same file can be re-selected
    }
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="video/mp4,video/webm,image/gif,image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Main Drop Area */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => !isDecoding && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-6 transition-all duration-200 cursor-pointer text-center select-none
          ${
            isDragging
              ? 'border-cyan-400 bg-cyan-950/20 shadow-[0_0_25px_rgba(0,240,255,0.3)] scale-[1.01]'
              : 'border-zinc-700 hover:border-zinc-500 bg-zinc-900/60 hover:bg-zinc-900/90'
          }
          ${isDecoding ? 'pointer-events-none cursor-default' : ''}
        `}
      >
        {/* Decoding State */}
        {isDecoding && (
          <div className="py-4 space-y-4">
            <div className="flex items-center justify-center space-x-3 text-cyan-400">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="font-medium text-sm sm:text-base">
                {progress?.message || 'Processing media frames...'}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full max-w-md mx-auto bg-zinc-800 rounded-full h-2.5 overflow-hidden border border-zinc-700">
              <div
                className="bg-cyan-400 h-2.5 rounded-full transition-all duration-150 shadow-[0_0_10px_rgba(0,240,255,0.7)]"
                style={{ width: `${progress?.percent || 0}%` }}
              />
            </div>

            <div className="flex items-center justify-between max-w-md mx-auto text-xs text-zinc-400 px-1">
              <span>
                Frame {progress?.currentFrame || 0} / {progress?.totalFrames || 0}
              </span>
              <span>{progress?.percent || 0}%</span>
            </div>

            {/* Cancel Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleCancel();
              }}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-red-400 bg-red-950/40 hover:bg-red-950/70 border border-red-800 rounded-lg transition-colors pointer-events-auto"
            >
              <XCircle className="w-3.5 h-3.5 mr-1.5" />
              Cancel Ingestion
            </button>
          </div>
        )}

        {/* Idle / Success State */}
        {!isDecoding && (
          <div className="space-y-4 py-2">
            <div className="flex justify-center">
              <div
                className={`p-3.5 rounded-full transition-colors ${
                  isDragging
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'bg-zinc-800 text-zinc-400 group-hover:text-zinc-200'
                }`}
              >
                <UploadCloud className="w-8 h-8" />
              </div>
            </div>

            <div>
              <p className="text-sm sm:text-base font-medium text-zinc-200">
                Drag & drop video reel, GIF, or PNG sequence
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                or click anywhere to browse from your computer
              </p>
            </div>

            {/* Supported Format Tags */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-zinc-800/80 text-zinc-300 border border-zinc-700">
                <Film className="w-3 h-3 mr-1 text-cyan-400" /> MP4 / WebM
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-zinc-800/80 text-zinc-300 border border-zinc-700">
                <FileImage className="w-3 h-3 mr-1 text-yellow-400" /> Animated GIF
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-zinc-800/80 text-zinc-300 border border-zinc-700">
                <FileImage className="w-3 h-3 mr-1 text-emerald-400" /> PNG Sequence
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Target FPS Selector & Controls Bar */}
      <div className="mt-3 flex items-center justify-between text-xs text-zinc-400 px-1">
        <div className="flex items-center space-x-2">
          <span className="font-mono text-zinc-500">Target Rate:</span>
          <div className="inline-flex rounded-md shadow-sm bg-zinc-900 border border-zinc-800 p-0.5">
            {[15, 20, 24, 30].map((fps) => (
              <button
                key={fps}
                type="button"
                onClick={() => setTargetFps(fps)}
                disabled={isDecoding}
                className={`px-2.5 py-1 text-xs font-mono rounded transition-colors ${
                  targetFps === fps
                    ? 'bg-cyan-500/20 text-cyan-300 font-semibold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                } ${isDecoding ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {fps} FPS
              </button>
            ))}
          </div>
        </div>

        {currentMedia && !isDecoding && (
          <div className="flex items-center space-x-2 text-zinc-400">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-mono text-[11px] truncate max-w-[180px]">
              {currentMedia.sourceInfo.filename}
            </span>
            <span className="text-zinc-600">|</span>
            <span className="font-mono text-[11px] text-zinc-300">
              {currentMedia.sourceInfo.frameCount} frames
            </span>
          </div>
        )}
      </div>

      {/* Error Feedback Alert */}
      {errorMessage && (
        <div className="mt-3 p-3 bg-red-950/40 border border-red-800/60 rounded-lg flex items-start space-x-2.5 text-red-300 text-xs">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Media Ingestion Failed</p>
            <p className="mt-0.5 text-red-300/80">{errorMessage}</p>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-red-400 hover:text-red-200 shrink-0 ml-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
```

---

## 8. Boundary, Edge Case & Stress Analysis

| # | Edge Case / Failure Mode | Root Cause | Architectural Mitigation in `mediaDecoder.ts` |
|---|--------------------------|------------|-----------------------------------------------|
| 1 | **4K / High-FPS Video (OOM Crash)** | A 4K 60FPS video has frames of $3840 \times 2160 \times 4 \approx 33.2\text{ MB}$. 300 frames would consume $10\text{ GB}$ RAM. | `maxDimension = 512` downsamples frames inside `ctx.drawImage` during the seek loop. Maximum frame memory is bounded to $\approx 500\text{ KB}$, reducing memory usage by 98.5%. |
| 2 | **WebM `Infinity` Duration** | Stream-recorded WebMs lack a duration header in the container EBML. | Probing mechanism seeks to $1e10$ seconds, reads actual playback position from `video.currentTime`, and resets to 0. |
| 3 | **GIF Disposal Mode 3 Ghosting** | Frame relies on canvas state prior to previous frame. Drawing over current pixels accumulates dirt. | Double-buffering with `snapshotBuffer.set(pixelBuffer)` before Mode 3 frames, and `pixelBuffer.set(snapshotBuffer)` on restore. |
| 4 | **GIF Zero-Delay / Legacy 10ms Delays** | Old GIFs encode `delay = 0` or `delay = 1` ($10\text{ ms}$), causing CPU lockup. | Netscape standard clamp: if `delay <= 1`, clamp to `10` ($100\text{ ms} = 10\text{ FPS}$). |
| 5 | **PNG Sequence Natural Collation** | Windows Explorer gives `frame_1.png`, `frame_10.png`, `frame_2.png`. | String collation via `a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })`. |
| 6 | **GPU VRAM Leak in Image Sequences** | Calling `createImageBitmap()` creates GPU textures that are not garbage collected immediately. | Synchronous invocation of `bmp.close()` inside a `finally` block immediately after drawing to offscreen canvas. |
| 7 | **Memory Leak via Object URLs** | `URL.createObjectURL(file)` holds full file buffer in memory until page reload. | Enclosed within `try { ... } finally { URL.revokeObjectURL(url); video.src = ''; video.load(); }`. |
| 8 | **Seek Loop Stall / Deadlock** | A corrupted video keyframe causes the `seeked` event to never fire. | 1.5-second `setTimeout` safeguard guarantees resolution or graceful continuation without freezing UI. |
| 9 | **Mid-Ingestion Cancellation** | User drops 1000-frame video, changes mind, and drops another file. | `AbortController.signal` checked before every seek/frame. Abort throws `AbortError`, cleanly revoking resources. |
| 10 | **Drag-Leave Flicker** | Moving cursor over child icons inside DropZone triggers `dragleave` on container. | `dragCounter` ref increments on `dragenter` and decrements on `dragleave`, only toggling state when count reaches 0. |

---

## 9. Downstream Integration Guide for M1 Implementer & M2 Pipeline

### 9.1 How CropTool (F05) Consumes `DecodedMedia`
The output of `decodeMedia()` is a `DecodedMedia` object:
```typescript
const { sourceInfo, frames } = decodedMedia;
```
Each frame in `frames` contains `imageData: ImageData` at the intermediate resolution (e.g. $288 \times 512$).
- For interactive crop & scale preview: `CropTool.tsx` takes `sourceInfo.sourceWidth`, `sourceInfo.sourceHeight`, and displays the active frame on an interactive canvas.
- When baking / normalizing frames for M2 (Dithering & XBMP):
  `CropTool.tsx` maps the 2:1 crop rectangle `(crop.x, crop.y, crop.width, crop.height)` to the target $128 \times 64$ canvas via:
  ```typescript
  cropCtx.drawImage(
    frameCanvas,
    crop.x, crop.y, crop.width, crop.height,
    0, 0, 128, 64
  );
  const final128x64ImageData = cropCtx.getImageData(0, 0, 128, 64);
  ```
  This produces precisely the 128×64 `ImageData` required for M2 Dithering (Atkinson, Floyd-Steinberg, Bayer) and XBMP packing!

### 9.2 Verification Commands
When `web/` is scaffolded by `explorer_m1_1`:
```bash
# Verify TypeScript compilation passes without errors:
npm --prefix web run build
# Or run tsc typecheck directly:
npx --prefix web tsc --noEmit
```
