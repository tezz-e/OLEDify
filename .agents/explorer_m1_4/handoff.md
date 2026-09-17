# Handoff Report: Milestone M1 Media Decoding Hardening Patch Plan

**Agent**: `explorer_m1_4` (M1 Media Hardening Explorer)  
**Parent**: `sub_orch_m1` (Conversation ID: `c335cf6b-2b25-4534-bccd-41c60c2542ba`)  
**Type**: Hard Handoff (Investigation Complete)  
**Artifacts Generated**:
- Patch Specification: `D:\espprojects\oled\.agents\explorer_m1_4\analysis.md`
- Working Log & Index: `D:\espprojects\oled\.agents\explorer_m1_4\BRIEFING.md`  
**Date**: 2026-09-18T00:26:30Z  

---

## 1. Observation

Direct observations from codebase inspection and empirical stress test execution:

1. **Test Execution Baseline**:
   - Running `npx.cmd tsx test/stress-decoder.ts` runs 17 test cases across natural sorting, GIF decoding, frame resampling, and video parsing.
   - 4 findings were raised by the adversarial harness:
     - `[LOW] FINDING-M1-01`: Identical numeric values with differing zero-padding evaluate to `0` in `localeCompare`.
     - `[MEDIUM] FINDING-M1-02`: `resampleFramesToFps` produces `NaN`/`Infinity` when `targetFps <= 0`.
     - `[MEDIUM] FINDING-M1-03`: Duration probe in `decodeVideo` lacks timeout safeguard on `seeked` event.
     - `[HIGH] FINDING-M1-04`: `decodeVideo` lacks `maxFrames` safety limit against unbounded memory growth.

2. **Source Code Line Locations**:
   - `web/src/types/media.ts:51-56`: `DecoderOptions` currently contains `targetFps`, `maxDimension`, `signal`, `onProgress`. Missing `maxFrames?: number`.
   - `web/src/engine/mediaDecoder.ts:68`: `const { targetFps = 30, maxDimension = 512, signal, onProgress } = options;` does not unpack or default `maxFrames`.
   - `web/src/engine/mediaDecoder.ts:103-114`:
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
     Lacks timeout or error handling; hangs indefinitely if `seeked` does not fire.
   - `web/src/engine/mediaDecoder.ts:135`: `const totalFrames = Math.max(1, Math.floor(duration * targetFps));` is uncapped. A 3-minute video at 30 FPS extracts 5,400 frames (~3.11 GB RAM).
   - `web/src/engine/mediaDecoder.ts:420-422`:
     ```typescript
     fileArray.sort((a, b) =>
       a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
     );
     ```
     `'frame_01.png'.localeCompare('frame_1.png', undefined, { numeric: true, sensitivity: 'base' }) === 0`.
   - `web/src/engine/mediaDecoder.ts:573-581`:
     ```typescript
     export function resampleFramesToFps(frames: ExtractedFrame[], targetFps: number): ExtractedFrame[] {
       if (frames.length === 0) return [];
       const totalDurationMs = frames.reduce((acc, f) => acc + f.durationMs, 0);
       const targetStepMs = 1000 / targetFps;
     ```
     If `targetFps = 0`, `targetStepMs` is `Infinity`, yielding `timestampMs = NaN` and `durationMs = Infinity`.

---

## 2. Logic Chain

1. **Defect 1 (Memory Cap)**:
   - Observation: 180s video at 30 FPS yields 5,400 uncompressed 288×512 frames = 3.11 GB heap.
   - Reasoning: Modern desktop browsers allocate ~1.5–4 GB per tab before triggering out-of-memory termination.
   - Inference: Adding `maxFrames: number = 600` ensures any video ingestion is capped to at most 600 frames (~345 MB intermediate RAM for downscaled 288×512, or ~18.8 MB for 128×64), guaranteeing stability while providing 20 seconds of continuous playback at 30 FPS (or 40 seconds at 15 FPS).
   - Downstream Timeline Integrity: When truncated, `sourceInfo.durationMs` must be set to `Math.round(totalFrames * frameDurationMs)` rather than the raw container duration, ensuring scrub bars and loop players do not seek past the extracted frames.

2. **Defect 2 (Duration Probe Timeout)**:
   - Observation: When probing unindexed MP4/WebM duration by seeking to 1e10, no timer or error listener guards the promise.
   - Reasoning: If the browser's media parser stalls or fails to seek, the promise remains pending forever, leaving the UI frozen in the `Initializing decoder...` state.
   - Inference: Wrapping the probe with a 2000ms `setTimeout` and an `error` listener guarantees the promise resolves within 2.0s with a sensible fallback (`video.currentTime > 0 ? video.currentTime : 1.0`), resetting the playhead to 0.

3. **Defect 3 (FPS Validation)**:
   - Observation: `targetFps <= 0` produces `Infinity` step sizes and `NaN` timestamps.
   - Reasoning: Presentation timestamps in milliseconds must be monotonic positive integers. `NaN` breaks playback interval logic, scrub bar slider math, and C++ array generators.
   - Inference: Throwing `RangeError('targetFps must be a positive finite number, received: ...')` immediately stops invalid configurations at the call site.

4. **Defect 4 (Natural Collation Tie-Breaker)**:
   - Observation: `frame_01.png` and `frame_1.png` compare to 0 with `{ numeric: true }`.
   - Reasoning: Array sorting in V8 is stable; returning 0 keeps whichever order the files were provided by the OS drag-and-drop event.
   - Inference: Chaining `|| a.name.localeCompare(b.name)` ensures that if numeric values match, standard lexicographical comparison tie-breaks them deterministically (`frame_001.png` < `frame_01.png` < `frame_1.png`).

---

## 3. Caveats

- **Codec Compatibility**: Headless `<video>` decoding depends on browser codec support (H.264, VP8, VP9, AV1). Unsupported formats (e.g. ProRes, HEVC on some platforms) will reject cleanly via the existing `onError` listener.
- **GIF Maximum Frames**: In `decodeGif`, all GIF frames are parsed from the byte stream. Because GIFs in creator workflows are typically short (<100 frames), memory growth in GIFs is lower than in long video reels. However, `maxDimension = 512` downscaling already protects intermediate GIF canvases.
- **Read-Only Mode**: As an Explorer agent, no direct modifications have been made to production source files. The patch is fully specified in `analysis.md` and ready for immediate application by an implementer.

---

## 4. Conclusion

All 4 vulnerabilities identified by `challenger_m1_1` have been thoroughly analyzed and concrete remediations developed. The patch is minimally invasive, zero-dependency, and fully backward-compatible.

### Summary of Proposed Edits:
1. `web/src/types/media.ts`: Add `maxFrames?: number;` to `DecoderOptions`.
2. `web/src/engine/mediaDecoder.ts`:
   - Default `maxFrames = 600` in `decodeVideo`.
   - Clamp `totalFrames = maxFrames > 0 ? Math.min(rawTotalFrames, maxFrames) : rawTotalFrames`, inform user via `onProgress`, and set truncated `durationMs`.
   - Add 2000ms timeout and `error` listener to video duration probe seek.
   - Add secondary tie-breaker `|| a.name.localeCompare(b.name)` in `decodeImageSequence`.
   - Add `if (!targetFps || targetFps <= 0 || !Number.isFinite(targetFps)) throw new RangeError(...)` in `resampleFramesToFps`.

---

## 5. Verification Method

To independently verify the implementation:

1. **TypeScript Build Verification**:
   ```powershell
   cd D:\espprojects\oled\web
   npm.cmd run build
   ```
   *Pass Condition*: Exit code 0, `tsc` completes without errors, Vite bundles cleanly into `dist/`.

2. **Adversarial Stress Test Suite**:
   ```powershell
   cd D:\espprojects\oled\web
   npx.cmd tsx test/stress-decoder.ts
   ```
   *Pass Condition*: All 17 tests pass with 0 findings raised (exit code 0).

3. **Tie-Breaker Collation Sanity Check**:
   ```powershell
   node -e "const f=['frame_1.png','frame_01.png','frame_001.png']; f.sort((a,b)=>a.localeCompare(b,undefined,{numeric:true,sensitivity:'base'})||a.localeCompare(b)); console.log(f);"
   ```
   *Pass Condition*: Output is exactly `[ 'frame_001.png', 'frame_01.png', 'frame_1.png' ]`.
