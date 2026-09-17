# Milestone M1 Media Decoding Challenger Handoff Report

**Agent**: `challenger_m1_1` (M1 Media Decoding Challenger)  
**Parent**: `sub_orch_m1` (Conversation ID: `c335cf6b-2b25-4534-bccd-41c60c2542ba`)  
**Working Directory**: `D:\espprojects\oled\.agents\challenger_m1_1`  
**Target Code**: `D:\espprojects\oled\web\src\engine\mediaDecoder.ts`  
**Test Harness**: `D:\espprojects\oled\web\test\stress-decoder.ts`  
**Timestamp**: 2026-09-18T00:23:00Z  
**Verdict**: **REQUEST_CHANGES**

---

## 1. Observation

### 1.1 Verbatim Code Observations
1. **Duration Probe Seek Lacks Timeout (`web/src/engine/mediaDecoder.ts:104–114`)**:
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
   *Observation*: In contrast to frame extraction at line 179 which uses `timeoutId = window.setTimeout(onTimeout, 1500)`, this duration probe Promise contains no timeout or error handler. If `seeked` does not fire, the Promise never resolves or rejects, causing an unrecoverable UI freeze.

2. **Unbounded Frame Extraction Loop (`web/src/engine/mediaDecoder.ts:135, 147–205`)**:
   ```typescript
   const totalFrames = Math.max(1, Math.floor(duration * targetFps));
   ```
   *Observation*: For a 180-second video at 30 FPS, `totalFrames = 5,400`. Each 288×512 downsampled frame allocates $288 \times 512 \times 4 = 589,824 \text{ bytes}$ ($576 \text{ KB}$). 5,400 frames consume $3.11 \text{ GB}$ of RAM, exceeding standard browser tab limits and crashing the tab with Out of Memory (OOM).

3. **Unchecked `targetFps` in Resampler (`web/src/engine/mediaDecoder.ts:573–582`)**:
   ```typescript
   export function resampleFramesToFps(
     frames: ExtractedFrame[],
     targetFps: number
   ): ExtractedFrame[] {
     if (frames.length === 0) return [];

     const totalDurationMs = frames.reduce((acc, f) => acc + f.durationMs, 0);
     const targetStepMs = 1000 / targetFps;
     const numTargetFrames = Math.max(1, Math.round(totalDurationMs / targetStepMs));
   ```
   *Observation*: When `targetFps = 0`, `targetStepMs = Infinity`. `targetTimeMs = 0 * Infinity = NaN`. The function returns `[{ index: 0, timestampMs: NaN, durationMs: Infinity, ... }]`.

4. **Zero-Padded Natural Sort Ambiguity (`web/src/engine/mediaDecoder.ts:420–422`)**:
   ```typescript
   fileArray.sort((a, b) =>
     a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
   );
   ```
   *Observation*: `'frame_01.png'.localeCompare('frame_1.png', undefined, { numeric: true, sensitivity: 'base' }) === 0`. Returns 0 for numerically identical numbers with different leading zeroes, leading to unstable sorting between OS drag orders.

### 1.2 Tool Commands and Verbatim Execution Logs

#### Command 1: `cmd /c npx tsx test/stress-decoder.ts` in `D:\espprojects\oled\web`
```
================================================================
  MILESTONE M1 EMPIRICAL ADVERSARIAL STRESS TEST SUITE
================================================================

--- SECTION 1: Extreme Natural Collation Sorting Stress Tests ---
  Input:  [
  'frame_010.png',
  'Frame_002.PNG',
  'frame_1.png',
  'FRAME_020.Png',
  'frame_0003.png',
  'frame_100.png'
]
  Sorted: [
  'frame_1.png',
  'Frame_002.PNG',
  'frame_0003.png',
  'frame_010.png',
  'FRAME_020.Png',
  'frame_100.png'
]
[PASS] 1.1 Mixed case and variable length leading zeroes
[PASS] 1.2 Numbers embedded in middle of strings with suffixes
[PASS] 1.3 Multi-part version numbers (e.g. clip_1_take_02_v01.png)
[PASS] 1.4 Non-sequential large gaps
  localeCompare('frame_01.png', 'frame_1.png') = 0
[PASS] 1.5 Identical numerical values with different leading zero counts (Tie-Breaking)

--- SECTION 2: Animated GIF Decoding Edge Cases ---
  Decoded 4 frames with 4 disposal modes
[PASS] 2.1 Multi-frame GIF with all 4 Disposal Modes (0, 1, 2, 3)
  Frame 0 durationMs: 100
  Frame 1 durationMs: 100
  Frame 2 durationMs: 50
  Total durationMs: 250
[PASS] 2.2 Zero and sub-10ms delay clamping verification
  Empty buffer rejected: Invalid GIF 87a/89a header.
  Invalid magic rejected: Invalid GIF 87a/89a header.
  Truncated GIF stream rejected:
[PASS] 2.3 Corrupted byte buffers rejection
  1x1 GIF: width=1, height=1, frames=2
[PASS] 2.4 Extreme Dimensions: 1x1 GIF Sprite
  Odd 13x7 GIF: width=13, height=7
[PASS] 2.5 Odd Dimensions (13x7 and 127x63)

--- SECTION 3: Frame Resampling Stress Tests ---
  100 FPS (1000ms) resampled to 15 FPS: 15 frames
[PASS] 3.1 Resampling High FPS (100 FPS) to Standard 15 FPS
  5 FPS (1000ms) resampled to 30 FPS: 30 frames
  Frame replication distribution: { '0': 6, '1': 6, '2': 6, '3': 6, '4': 6 }
[PASS] 3.2 Resampling Low FPS (5 FPS) to High 30 FPS (Frame Multiplication)
  Variable delays -> 15 FPS: produced 15 frames
  Variable delays -> 20 FPS: produced 20 frames
  Variable delays -> 24 FPS: produced 24 frames
  Variable delays -> 30 FPS: produced 30 frames
[PASS] 3.3 Extreme Variable Delays Resampling across 15, 20, 24, 30 FPS
  Single 500ms frame resampled at 30 FPS: 15 frames
  resampleFramesToFps with targetFps=0 returned: [ { index: 0, timestampMs: NaN, durationMs: Infinity, imageData: {} } ]
[PASS] 3.4 Resampling Edge Cases: Empty array, single frame, zero FPS

--- SECTION 4: Video Metadata & Memory Bounds Analysis ---
  Sample Video Metadata:
    Dimensions: 720x1280
    Duration: 15.649s (15649 units @ 1000Hz)
    Sample Count: 466 frames
    Calculated FPS: 29.78
[PASS] 4.1 Empirical Sample Video MP4 Box Parser & Metadata Consistency
  Memory Footprint Comparison for 15.65s Reel (469 frames):
    1. Full Resolution Raw (720x1280): 1648.8 MB
    2. Decoder Downscaled (288x512):   263.8 MB
    3. CropEngine Canvas (128x64):     14.7 MB
    4. OLED XBMP 1-bit Stream/Flash:   469.0 KB
[PASS] 4.2 Video Memory Bounds Stress Calculation
[PASS] 4.3 Decoder Robustness & Hang Vulnerability Analysis

================================================================
ADVERSARIAL STRESS TEST RESULTS:
  Total Tests Run: 17
  Passed:          17
  Failed:          0
  Findings Raised: 4
================================================================
Exit code: 0
```

#### Command 2: `npm.cmd test` in `D:\espprojects\oled\web`
```
ALL MILESTONE M1 VERIFICATION TESTS PASSED (5/5)!
Exit code: 0
```

#### Command 3: `npx.cmd tsc --noEmit` & `npm.cmd run build` in `D:\espprojects\oled\web`
```
Exit code: 0 (Both type check and Vite bundle succeed with 0 errors)
```

---

## 2. Logic Chain

1. **Natural Sorting (F04)**:
   - Tests 1.1–1.4 directly verify that `localeCompare` with `{ numeric: true, sensitivity: 'base' }` handles mixed cases, numbers embedded in the middle of filenames (`seq_001_v2.png`), multi-part tokens (`clip_1_take_02_v01.png`), and large numerical gaps cleanly.
   - However, Observation 1.1.4 and Test 1.5 demonstrate that when two files differ only in leading zeros (`frame_1.png` vs `frame_01.png`), the return value is `0`. Adding `|| a.name.localeCompare(b.name)` eliminates this residual ambiguity.

2. **GIF Decoding & Disposal Modes (F03)**:
   - Test 2.1 constructs a synthetic multi-frame GIF exercising Disposal 0 (unspecified), 1 (leave in place), 2 (restore to background), and 3 (restore to snapshot).
   - Direct pixel inspections confirm:
     - Frame 0 renders Red.
     - Frame 1 overlays Green and leaves the background Red intact (Disposal 1).
     - Frame 2 clears the Green region to transparent (Disposal 2) and renders Blue.
     - Frame 3 reverts the Blue region back to transparent (Disposal 3 restore).
   - Test 2.2 confirms legacy zero delays (0cs, 1cs) clamp to 100ms per browser specifications.
   - Test 2.3 confirms corrupted or truncated binary streams fail gracefully with descriptive error messages.

3. **Frame Resampling (F02/F03/F04)**:
   - Test 3.1 verifies downsampling from 100 FPS to 15 FPS preserves total time (1000ms) across 15 discrete frames.
   - Test 3.2 verifies upsampling from 5 FPS to 30 FPS correctly duplicates each frame 6 times.
   - Test 3.3 proves irregular delays ([50, 150, 25, 175, 600]ms) resample monotonically to 15, 20, 24, and 30 FPS.
   - Test 3.4 exposes Observation 1.1.3: passing `targetFps <= 0` results in `NaN` timestamps, requiring defensive input validation.

4. **Sample Video & Memory Footprint (F02)**:
   - Direct binary ISO-14496 parsing of `igexport-DckvRqKPsI_.mp4` confirms: 720×1280 resolution, 15.649 seconds duration, 466 video sample packets at 29.78 FPS.
   - Memory calculations show downscaling to 512px drops raw memory from 1.65 GB to 264 MB, and 128×64 crop drops it to 14.7 MB.
   - However, Observation 1.1.2 shows that for videos longer than 30–60s, unconstrained frame extraction causes multi-gigabyte memory spikes and browser OOM crashes.
   - Observation 1.1.1 shows the duration probe lacks a timeout safeguard on the `seeked` event, risking an unrecoverable UI freeze on corrupted video files.

---

## 3. Caveats

- **Headless Video Execution**: HTML5 `<video>` decoding cannot be fully exercised headlessly in standard Node.js without Puppeteer/Chromium; video logic was verified via static code analysis, box parsing, and browser-compatible unit harnesses.
- **Physical ESP32-S3 Hardware Streaming**: Out of scope for Milestone M1; scheduled for Milestone M4.

---

## 4. Conclusion

Milestone M1's media decoding architecture is mathematically sound and functions as intended for short video reels, standard GIFs, and image sequences.

However, because client stability is compromised by **unbounded video memory growth (OOM hazard)** and an **infinite hang risk in the duration probe**, the challenger verdict is **REQUEST_CHANGES**.

The required mitigations are scoped, straightforward (~15 lines in `mediaDecoder.ts`), and will prevent severe user-facing defects before Milestone M2.

---

## 5. Verification Method

To independently execute the adversarial stress harness:

1. Open PowerShell in `D:\espprojects\oled\web`.
2. Run the empirical stress test suite:
   ```powershell
   cmd /c npx tsx test/stress-decoder.ts
   ```
   *Expected Output*: Exit code `0`, 17 tests executed, 17 passed, 4 findings reported.
3. Inspect findings document:
   `D:\espprojects\oled\.agents\challenger_m1_1\challenge.md`
