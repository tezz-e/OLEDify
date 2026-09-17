# Patch Specification: Milestone M1 Media Decoding Hardening

**Author**: `explorer_m1_4` (M1 Media Hardening Explorer)  
**Parent**: `sub_orch_m1` (Conversation ID: `c335cf6b-2b25-4534-bccd-41c60c2542ba`)  
**Target Files**:
- `web/src/types/media.ts` (Interface extension for `DecoderOptions`)
- `web/src/engine/mediaDecoder.ts` (Core hardening remediation)
- `web/test/stress-decoder.ts` (Test harness update & validation)  
**Reference Findings**: Challenger 1 Report (`.agents/challenger_m1_1/challenge.md`), findings FINDING-M1-01 to FINDING-M1-04  
**Date**: 2026-09-18T00:26:00Z  

---

## 1. Executive Summary

Adversarial stress testing and white-box analysis by `challenger_m1_1` identified four concrete vulnerabilities in the M1 media decoding pipeline:
1. **Unbounded video frame ingestion (FINDING-M1-04, HIGH)**: Decoding long videos (3–5 minutes) attempts to extract 5,400–9,000 uncompressed frames (~3.1–5.2 GB heap), causing browser tab OOM crashes.
2. **Indefinite duration probe hang (FINDING-M1-03, MEDIUM)**: Seeking to `1e10` on streaming or malformed MP4/WebM files lacks a timeout, permanently locking the UI in `Initializing decoder...` if `seeked` does not fire.
3. **Resampler invalid FPS corruption (FINDING-M1-02, MEDIUM)**: Passing `targetFps <= 0` to `resampleFramesToFps` computes `Infinity` step intervals and `NaN` timestamps, poisoning downstream components.
4. **Natural sorting zero-padding collision (FINDING-M1-01, LOW)**: `localeCompare` with `{ numeric: true }` returns `0` for identical numeric segments with differing zero-padding (e.g. `frame_1.png` vs `frame_01.png`), leading to nondeterministic ordering that depends on OS drag-and-drop order.

This specification provides the exact, production-grade patch plan to remediate all four issues cleanly, maintaining 100% TypeScript type safety and zero regressions against the existing test suite.

---

## 2. Vulnerability & Defect Analysis

### Defect 1: Unbounded Video Ingestion Memory Growth
- **Root Cause**: `decodeVideo` calculates `totalFrames = Math.max(1, Math.floor(duration * targetFps))` without an upper bound cap. A creator dropping a 3-minute 1080p video at 30 FPS triggers 5,400 sequential seek-and-draw operations, allocating over 3 GB of `ImageData` buffers in memory.
- **Remediation**:
  1. Add `maxFrames?: number` to `DecoderOptions` (defaulting to `600` frames, which corresponds to 20 seconds at 30 FPS or 40 seconds at 15 FPS).
  2. Clamp `totalFrames = maxFrames > 0 ? Math.min(rawTotalFrames, maxFrames) : rawTotalFrames`.
  3. Inform the creator via `onProgress` when truncation occurs, reporting both the original duration and truncated frame count.
  4. Adjust `sourceInfo.durationMs` to reflect the truncated duration (`Math.round(totalFrames * frameDurationMs)`), ensuring downstream playback timelines remain accurate.

### Defect 2: Indefinite Hang in Video Duration Probe
- **Root Cause**: In `mediaDecoder.ts` (lines 104–114), videos with `NaN`, `Infinity`, or `<= 0` duration are probed by seeking `video.currentTime = 1e10` and awaiting `seeked`. If the media decoder fails to seek to 1e10 (e.g. streaming WebM or corrupt atom), `seeked` never fires and the promise never settles.
- **Remediation**:
  1. Wrap the duration probe promise with a 2000ms `setTimeout` fallback.
  2. Attach an `error` event listener in addition to `seeked`.
  3. Ensure all listeners and timeouts are cleaned up in a unified `cleanup()` handler.
  4. Fallback to `video.duration > 0 ? video.duration : (video.currentTime > 0 ? video.currentTime : 1.0)`.
  5. Reset `video.currentTime = 0` safely before resolving.

### Defect 3: Invalid Target FPS in Resampler
- **Root Cause**: In `resampleFramesToFps`, `targetStepMs = 1000 / targetFps`. When `targetFps <= 0`, `targetStepMs` evaluates to `Infinity`, causing `targetTimeMs = i * Infinity = NaN`. Downstream player and export loops receive poisoned timestamps.
- **Remediation**:
  Validate at function start:
  ```typescript
  if (!targetFps || targetFps <= 0 || !Number.isFinite(targetFps)) {
    throw new RangeError(`targetFps must be a positive finite number, received: ${targetFps}`);
  }
  ```

### Defect 4: Zero-Padding Ambiguity in Natural Sorting
- **Root Cause**: `a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })` evaluates `'frame_01.png'` and `'frame_1.png'` as numerically equal, returning `0`. In JavaScript's stable array sort, relative order is determined by the input array order (OS drag order), which is nondeterministic.
- **Remediation**:
  Add secondary lexicographical tie-breaker:
  ```typescript
  fileArray.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }) ||
    a.name.localeCompare(b.name)
  );
  ```
  Standard lexicographical collation places `'frame_001.png'` < `'frame_01.png'` < `'frame_1.png'` deterministically.

---

## 3. Patch Plan: Exact Code Changes

### Patch 1: `web/src/types/media.ts`

**Location**: Lines 51–57  
**Change**: Add `maxFrames?: number` to `DecoderOptions`.

```diff
--- a/web/src/types/media.ts
+++ b/web/src/types/media.ts
@@ -51,6 +51,7 @@ export interface DecodeProgress {
 export interface DecoderOptions {
   targetFps?: number;           // Target frame rate (default: 30, supports 15, 20, 24, 30)
   maxDimension?: number;        // Max intermediate dimension (e.g. 512, protects against OOM)
+  maxFrames?: number;           // Max frames to extract (default: 600, protects against OOM on long media)
   signal?: AbortSignal;         // Cancellation signal
   onProgress?: (progress: DecodeProgress) => void;
 }
```

---

### Patch 2: `web/src/engine/mediaDecoder.ts`

#### Edit 2.1: `decodeVideo` Signature and Options Destructuring
**Location**: Lines 64–72  
**Change**: Extract `maxFrames = 600` from `options`.

**Before**:
```typescript
export async function decodeVideo(
  file: File,
  options: DecoderOptions = {}
): Promise<DecodedMedia> {
  const { targetFps = 30, maxDimension = 512, signal, onProgress } = options;
```

**After**:
```typescript
export async function decodeVideo(
  file: File,
  options: DecoderOptions = {}
): Promise<DecodedMedia> {
  const {
    targetFps = 30,
    maxDimension = 512,
    maxFrames = 600,
    signal,
    onProgress,
  } = options;
```

---

#### Edit 2.2: Video Duration Probe Hang Safeguard
**Location**: Lines 102–115  
**Change**: Add 2000ms timeout fallback and error event listener.

**Before**:
```typescript
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
```

**After**:
```typescript
    // Handle Infinite / NaN duration bug with 2000ms timeout safeguard
    if (!Number.isFinite(duration) || duration <= 0) {
      duration = await new Promise<number>((resolve) => {
        let timeoutId: ReturnType<typeof setTimeout> | undefined;

        const cleanup = () => {
          if (timeoutId !== undefined) {
            clearTimeout(timeoutId);
          }
          video.removeEventListener('seeked', onSeeked);
          video.removeEventListener('error', onError);
        };

        const onSeeked = () => {
          cleanup();
          const probed = Number.isFinite(video.duration) ? video.duration : video.currentTime;
          video.currentTime = 0;
          resolve(probed > 0 ? probed : 1.0);
        };

        const onError = () => {
          cleanup();
          video.currentTime = 0;
          resolve(1.0);
        };

        timeoutId = setTimeout(() => {
          cleanup();
          const fallback =
            Number.isFinite(video.duration) && video.duration > 0
              ? video.duration
              : video.currentTime > 0
              ? video.currentTime
              : 1.0;
          video.currentTime = 0;
          resolve(fallback);
        }, 2000);

        video.addEventListener('seeked', onSeeked, { once: true });
        video.addEventListener('error', onError, { once: true });

        try {
          video.currentTime = 1e10;
        } catch {
          cleanup();
          resolve(1.0);
        }
      });
    }
```

---

#### Edit 2.3: `maxFrames` Clamping and Progress Notification in `decodeVideo`
**Location**: Lines 134–146, 195–224  
**Change**: Clamp `totalFrames`, report truncation, and calculate truncated `durationMs`.

**Before**:
```typescript
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
...
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
```

**After**:
```typescript
    const frameStepSec = 1.0 / targetFps;
    const rawTotalFrames = Math.max(1, Math.floor(duration * targetFps));
    const totalFrames = maxFrames > 0 ? Math.min(rawTotalFrames, maxFrames) : rawTotalFrames;
    const isTruncated = totalFrames < rawTotalFrames;
    const frameDurationMs = 1000 / targetFps;
    const extractedFrames: ExtractedFrame[] = [];

    const startMessage = isTruncated
      ? `Video duration (${duration.toFixed(1)}s) exceeds max limit (${maxFrames} frames). Truncating to first ${(totalFrames / targetFps).toFixed(1)}s (${totalFrames} frames)...`
      : `Decoding video (0/${totalFrames})...`;

    onProgress?.({
      stage: 'decoding',
      currentFrame: 0,
      totalFrames,
      percent: 0,
      message: startMessage
    });
...
      if (i % 5 === 0 || i === totalFrames - 1) {
        const percent = Math.round(((i + 1) / totalFrames) * 100);
        onProgress?.({
          stage: 'decoding',
          currentFrame: i + 1,
          totalFrames,
          percent,
          message: isTruncated
            ? `Extracted frame ${i + 1} of ${totalFrames} (${percent}%) [Capped at ${maxFrames}]`
            : `Extracted frame ${i + 1} of ${totalFrames} (${percent}%)`
        });
      }
    }

    onProgress?.({
      stage: 'complete',
      currentFrame: totalFrames,
      totalFrames,
      percent: 100,
      message: isTruncated
        ? `Decoded ${totalFrames} frames (truncated from ${rawTotalFrames} frames to preserve browser memory).`
        : `Decoded ${totalFrames} frames.`
    });

    const sourceInfo: MediaSourceInfo = {
      type: 'video',
      filename: file.name,
      sourceWidth,
      sourceHeight,
      frameCount: extractedFrames.length,
      fps: targetFps,
      durationMs: isTruncated
        ? Math.round(extractedFrames.length * frameDurationMs)
        : Math.round(duration * 1000)
    };
```

---

#### Edit 2.4: Natural Collation Tie-Breaker in `decodeImageSequence`
**Location**: Lines 420–423  
**Change**: Add secondary collation `|| a.name.localeCompare(b.name)`.

**Before**:
```typescript
  // Natural collation sort
  fileArray.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  );
```

**After**:
```typescript
  // Natural collation sort with zero-padding tie-breaker
  fileArray.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }) ||
    a.name.localeCompare(b.name)
  );
```

*(Optional defense-in-depth)*: In `decodeImageSequence`, `maxFrames` can also be extracted from `options` and applied as `const totalFrames = (maxFrames && maxFrames > 0) ? Math.min(fileArray.length, maxFrames) : fileArray.length;`.

---

#### Edit 2.5: Guard `targetFps <= 0` in `resampleFramesToFps`
**Location**: Lines 573–578  
**Change**: Validate that `targetFps` is a strictly positive, finite number.

**Before**:
```typescript
export function resampleFramesToFps(
  frames: ExtractedFrame[],
  targetFps: number
): ExtractedFrame[] {
  if (frames.length === 0) return [];
```

**After**:
```typescript
export function resampleFramesToFps(
  frames: ExtractedFrame[],
  targetFps: number
): ExtractedFrame[] {
  if (!targetFps || targetFps <= 0 || !Number.isFinite(targetFps)) {
    throw new RangeError(
      `targetFps must be a positive finite number, received: ${targetFps}`
    );
  }

  if (frames.length === 0) return [];
```

---

### Patch 3: `web/test/stress-decoder.ts` Update Plan

To verify that all 4 findings are resolved and tests pass cleanly without raising adversarial warnings:
1. **Update `naturalSortFn` (Line 110)**:
   ```typescript
   const naturalSortFn = (a: { name: string }, b: { name: string }) =>
     a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }) ||
     a.name.localeCompare(b.name);
   ```
2. **Update Test 1.5**: Assert that `['frame_1.png', 'frame_01.png', 'frame_001.png']` sorts deterministically to `['frame_001.png', 'frame_01.png', 'frame_1.png']`.
3. **Update Test 3.4**: Assert that calling `resampleFramesToFps(single, 0)` and `resampleFramesToFps(single, -1)` throws `RangeError`.
4. **Update Test 4.3**: Assert that `decodeVideo` enforces `maxFrames = 600` and duration probe timeout is active.

---

## 4. Verification Method & Acceptance Criteria

| Check | Verification Command | Expected Outcome |
|---|---|---|
| Build & Typecheck | `npm.cmd run build` | Exits code 0. TypeScript validates `DecoderOptions.maxFrames` with zero errors. |
| Adversarial Stress Suite | `npx.cmd tsx test/stress-decoder.ts` | 17/17 tests pass, 0 findings raised, exits code 0. |
| Natural Sort Collation | Node CLI check | `frame_001.png` precedes `frame_01.png` precedes `frame_1.png`. |
| Zero/Negative FPS Guard | Unit execution | `resampleFramesToFps(frames, 0)` throws `RangeError`. |
| Video Duration Probe | Code inspection | 2000ms timeout prevents permanent promise pending. |
| Frame Cap | Math verification | 180s video @ 30 FPS capped to 600 frames (20s) in memory. |
