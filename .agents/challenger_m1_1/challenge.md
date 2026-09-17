# Adversarial Challenge Report — Milestone M1 Media Decoding Pipeline

**Agent**: `challenger_m1_1` (M1 Media Decoding Challenger)  
**Parent**: `sub_orch_m1` (Conversation ID: `c335cf6b-2b25-4534-bccd-41c60c2542ba`)  
**Target Code**: `web/src/engine/mediaDecoder.ts`, `web/src/types/media.ts`, `web/src/components/DropZone.tsx`  
**Empirical Harness**: `web/test/stress-decoder.ts` (17 tests executed via `npx tsx`)  
**Date**: 2026-09-18T00:22:30Z  
**Verdict**: **REQUEST_CHANGES**

---

## 1. Challenge Summary

**Overall Risk Assessment**: **HIGH**

While the foundational decoding algorithms for GIF (Disposal 0–3), natural sequence collation sorting, and frame resampling operate correctly under normal test inputs, adversarial stress testing and white-box analysis revealed **two critical failure modes and two edge-case defects**:
1. **[HIGH] Unbounded Video Ingestion Memory Growth**: `decodeVideo` does not enforce a maximum frame limit. A standard 3-to-5 minute video reel results in 5,400–9,000 extracted `ImageData` frames (~3.1–5.2 GB RAM), guaranteeing browser tab crash (OOM) and an unrecoverable UI freeze from thousands of sequential canvas seeks.
2. **[MEDIUM] Indefinite Hang in Video Duration Probe**: Probing video duration for unindexed WebM/MP4 files seeks to `currentTime = 1e10` without a timeout handler. If the browser fails to fire the `seeked` event, the returned Promise hangs permanently with no cancellation or error recovery.
3. **[MEDIUM] Zero / Negative FPS Corruption in Resampler**: `resampleFramesToFps` does not validate `targetFps`. Passing `targetFps <= 0` yields `Infinity` durations and `NaN` timestamps, poisoning downstream OLED players.
4. **[LOW] Zero-Padding Collisions in Natural Sorting**: Filenames with identical numerical values but differing zero-padding (e.g. `frame_1.png` vs `frame_01.png`) evaluate to `0` in `localeCompare`, causing nondeterministic ordering that depends entirely on OS drag-and-drop file array ordering.

---

## 2. Challenges & Failure Modes

### Challenge 1 [HIGH]: Unbounded Memory & Execution Freeze on Ordinary Length Videos

- **Assumption Challenged**: The assumption that capping canvas dimensions to `<= 512px` is sufficient to prevent browser memory exhaustion.
- **Attack Scenario**:
  A creator drops an ordinary 3-minute video (180s) or a 5-minute video (300s) into the studio drop zone.
  - At 30 FPS, 180s produces **5,400 frames**.
  - At downscaled 288×512 resolution, each uncompressed RGBA frame is 589,824 bytes (576 KB).
  - $5,400 \times 576 \text{ KB} = \mathbf{3.11 \text{ GB}}$ of active `ImageData` array buffers in JavaScript heap memory.
  - For a 300s video: $9,000 \text{ frames} = \mathbf{5.18 \text{ GB}}$.
  - Furthermore, seeking 5,400 times sequentially at ~30–50ms per seek takes **160 to 270 seconds (~3 to 4.5 minutes)** of continuous decoder looping.
- **Blast Radius**: The browser tab crashes with `Out of Memory (OOM)`, wiping the user's session.
- **Mitigation**:
  1. Introduce a configurable safety threshold in `DecoderOptions`: `maxFrames?: number` (default `600` frames, representing 20s @ 30 FPS or 40s @ 15 FPS).
  2. In `decodeVideo`, clamp `totalFrames = Math.min(totalFrames, maxFrames)`.
  3. If duration exceeds `maxFrames / targetFps`, warn the user via `onProgress` or trigger an alert that media was truncated to the first $N$ seconds.

---

### Challenge 2 [MEDIUM]: Indefinite Hang in Video Duration Probe

- **Assumption Challenged**: The assumption that `video.currentTime = 1e10` will always reliably fire the `seeked` event on all browsers and video formats.
- **Attack Scenario**:
  In `web/src/engine/mediaDecoder.ts` (lines 104–114):
  ```typescript
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
  If a corrupted or streaming MP4/WebM file lacks duration metadata and fails to complete seek to `1e10`, the event listener never fires. Because this `new Promise` lacks a timeout or error listener, the ingestion pipeline hangs indefinitely in the `Initializing decoder...` state, ignoring user actions.
- **Blast Radius**: Complete UI lockup for that ingestion attempt; user must reload page.
- **Mitigation**:
  Wrap the probe with a 2000ms `setTimeout` fallback:
  ```typescript
  duration = await new Promise<number>((resolve) => {
    let timeoutId: number;
    const cleanup = () => {
      clearTimeout(timeoutId);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
    };
    const onSeeked = () => {
      cleanup();
      const probed = Number.isFinite(video.duration) ? video.duration : video.currentTime;
      video.currentTime = 0;
      resolve(probed > 0 ? probed : 1.0);
    };
    const onError = () => { cleanup(); resolve(1.0); };
    timeoutId = window.setTimeout(() => { cleanup(); resolve(video.currentTime > 0 ? video.currentTime : 1.0); }, 2000);
    video.addEventListener('seeked', onSeeked, { once: true });
    video.addEventListener('error', onError, { once: true });
    video.currentTime = 1e10;
  });
  ```

---

### Challenge 3 [MEDIUM]: Zero or Negative Target FPS Generates NaN Timestamps

- **Assumption Challenged**: The assumption that callers will always supply a strictly positive integer for `targetFps`.
- **Attack Scenario**:
  If `resampleFramesToFps(frames, 0)` or negative FPS is invoked:
  - `targetStepMs = 1000 / 0 = Infinity`.
  - `targetTimeMs = i * Infinity = NaN`.
  - `timestampMs: Math.round(NaN) = NaN`.
  - `durationMs: Math.round(Infinity) = Infinity`.
- **Blast Radius**: Downstream M2 components (`OledCanvas`, `TimelineControls`, `cppGenerator`) receive frames with `NaN` timestamps, breaking timeline scrubbing, playback timers, and C++ header export loops.
- **Mitigation**:
  Validate at function start:
  ```typescript
  if (!targetFps || targetFps <= 0 || !Number.isFinite(targetFps)) {
    throw new RangeError(`targetFps must be a positive number, received: ${targetFps}`);
  }
  ```

---

### Challenge 4 [LOW]: Nondeterministic Tie-Breaking with Mixed Zero-Padding

- **Assumption Challenged**: The assumption that `a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })` uniquely and deterministically sorts all alphanumeric sequences.
- **Attack Scenario**:
  Filenames such as `['frame_01.png', 'frame_1.png']` evaluate to numeric value `1`.
  `'frame_01.png'.localeCompare('frame_1.png', undefined, { numeric: true, sensitivity: 'base' }) === 0`.
  When comparison returns `0`, the JavaScript array sort preserves whatever order the browser's DataTransfer items were iterated in, which can vary between OS and drag selection method.
- **Blast Radius**: Minor sequence order jitter if creators mix padded and unpadded filenames in the same folder.
- **Mitigation**:
  Add standard lexicographical fallback tie-breaker:
  ```typescript
  fileArray.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }) ||
    a.name.localeCompare(b.name)
  );
  ```

---

## 3. Empirical Stress Test Results

Executed via `npx tsx web/test/stress-decoder.ts`:

| # | Test Scenario | Expected Outcome | Actual Outcome | Status |
|---|---------------|------------------|----------------|--------|
| 1.1 | Mixed-case & leading zeroes (`Frame_002.PNG`, `FRAME_020.Png`, `frame_1.png`) | Sorted: 1, 2, 3, 10, 20, 100 | Exact numeric order achieved | **PASS** |
| 1.2 | Numbers embedded in middle with suffixes (`seq_001_v2.png`, `seq_010_v1.png`) | Sorted: seq_001_v1, v2, seq_002_v2, v10, seq_010_v1 | Strict hierarchical alphanumeric order | **PASS** |
| 1.3 | Multi-part version numbers (`clip_1_take_02_v01.png` vs `take_10`) | Natural hierarchical sorting preserved | Matches take 2 before take 10 | **PASS** |
| 1.4 | Non-sequential large gaps (`img_0`, `img_5`, `img_42`, `img_1000`, `img_999999`) | Monotonic ascending numerical sort | Accurately sorted | **PASS** |
| 1.5 | Differing zero padding tie-break (`frame_01.png` vs `frame_1.png`) | Deterministic ordering | Evaluates to 0 (stable sort keeps drag order) | **WARN (Finding 1)** |
| 2.1 | Multi-frame GIF with all 4 Disposal Modes (0, 1, 2, 3) | Pixel buffers match disposal specs: F1 clears to transparent, F2 restores snapshot | Pixel buffers accurately match RGBA assertions | **PASS** |
| 2.2 | Zero and sub-10ms delay clamping (delays 0, 1, 5) | Delays 0 & 1 clamped to 100ms; delay 5 = 50ms | Frames: [100ms, 100ms, 50ms], total: 250ms | **PASS** |
| 2.3 | Corrupted byte buffers (0-byte, corrupt magic, truncated GIF stream) | Rejection with descriptive errors | All 3 throw expected errors | **PASS** |
| 2.4 | Extreme dimensions: 1×1 GIF sprite | 2 frames extracted, dimensions 1×1, 4 bytes RGBA | Exact 1×1 decoded with 4 bytes data | **PASS** |
| 2.5 | Odd dimensions (13×7 and 127×63) | Valid frame buffer sizes, no index overflows | Decoded 13×7 (364 bytes) without error | **PASS** |
| 3.1 | High FPS downsampling: 100 FPS (1000ms) to 15 FPS | Exactly 15 frames generated spanning [0ms .. 933ms] | 15 frames with valid step timestamps | **PASS** |
| 3.2 | Low FPS upsampling: 5 FPS (1000ms) to 30 FPS | Exactly 30 frames; each source duplicated 6 times | All 5 sources replicated exactly 6 times | **PASS** |
| 3.3 | Variable delays ([50, 150, 25, 175, 600]ms) to 15/20/24/30 FPS | Monotonic timestamps, frame counts match target FPS | 15, 20, 24, 30 frames produced monotonically | **PASS** |
| 3.4 | Resampler edge cases: empty array, single frame, zero FPS | Empty -> [], single -> 15 frames, targetFps=0 -> handled | targetFps=0 produced NaN / Infinity | **WARN (Finding 2)** |
| 4.1 | Sample video ISO-14496 MP4 box parsing & consistency | 720×1280, 15.65s, 466 samples @ ~29.78 FPS | Verified 100% consistent with spec | **PASS** |
| 4.2 | Video memory bounds analysis (469 frames) | Full res: 1.65 GB; Downscaled 512px: 264 MB; 128×64: 14.7 MB; XBMP: 469 KB | Verified memory scale math | **PASS** |
| 4.3 | Robustness analysis: infinite duration probe & frame limits | Safe limits in place | Identified missing timeout & missing maxFrames | **WARN (Findings 3 & 4)** |

---

## 4. Unchallenged Areas

- **Hardware WebSerial Streaming (F21–F25)**: Belongs to Milestone M4; not yet implemented in M1.
- **Client GPU WebGL / Shader Accelerated Resampling**: M1 relies on Canvas 2D / `createImageBitmap`; GPU compute shaders are out of scope for M1.

---

## 5. Recommendation & Verdict

**Verdict: REQUEST_CHANGES**

Before advancing to Milestone M2 (Image Processing & Dithering Engine), the following 4 defensive hardening fixes should be implemented in `web/src/engine/mediaDecoder.ts`:
1. Add `maxFrames: number = 600` cap to `decodeVideo` in `mediaDecoder.ts`.
2. Add a 2000ms timeout safeguard to the duration probe seek at line 104 in `mediaDecoder.ts`.
3. Add input validation `if (targetFps <= 0) throw new RangeError(...)` in `resampleFramesToFps`.
4. Add secondary tie-breaker `|| a.name.localeCompare(b.name)` in `decodeImageSequence`.
