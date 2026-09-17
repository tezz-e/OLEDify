# Milestone M1 Code Quality & Type Review Report

**Reviewer**: `reviewer_m1_1` (M1 Code Quality & Type Reviewer / Adversarial Critic)  
**Parent**: `sub_orch_m1` (Conversation ID: `c335cf6b-2b25-4534-bccd-41c60c2542ba`)  
**Target Application**: `D:\espprojects\oled\web`  
**Date**: 2026-09-17T18:56:00Z  

---

## 1. Executive Summary

- **Verdict**: **APPROVE**
- **Integrity Audit**: **PASS** (Zero hardcoded test shortcuts, zero dummy/facade implementations, zero fabricated verification logs).
- **TypeScript Strictness**: **EXCELLENT** (`strict: true`, zero `any` leaks in public APIs, clean compilation under `npx tsc --noEmit`).
- **Test Results**: All 5 test suites pass cleanly via `npm test`. Production bundle builds successfully in 5.72s (`dist/` generated).

---

## 2. Review Findings & Assessment

### 2.1 TypeScript Strictness & Interface Completeness (`web/src/types/`)
- `media.ts`: Accurately establishes interface contracts specified in `SCOPE.md` (`ExtractedFrame`, `MediaSourceInfo`, `CropSettings`, `FitMode`) and extends them cleanly with `DecodedMedia`, `DecodeProgress`, and `DecoderOptions`.
- `dither.ts`: Fully models M2 contract types (`DitherAlgorithm`, `PhosphorTheme`, `DitherConfig`).
- `oled.ts`: Encapsulates OLED hardware geometry (`OLED_WIDTH = 128`, `OLED_HEIGHT = 64`, `OLED_FRAME_BYTES = 1024`, `XbmpFrame`, `PlaybackState`).
- `omggif.d.ts`: Robust type declarations covering `GifReader` and `GifWriter` methods, parameters, and return types.
- **Finding Severity**: **Clean / No Issues**.

---

### 2.2 Ingestion Engine & Memory Lifecycle (`web/src/engine/mediaDecoder.ts`)
- **Video Decoding (`decodeVideo`)**:
  - Headless `<video>` element seeking loop with downscaling to max 512px prevents memory bloat on large 4K reels.
  - Lifecycle cleanup is enforced via `finally` block: `URL.revokeObjectURL(objectUrl)`, `video.pause()`, `video.src = ''`, `video.load()`.
  - Frame seek operation incorporates a 1500ms safety timeout to prevent hanging on corrupted frames.
  - AbortController cancellation is checked both before and inside the frame extraction loop.
- **GIF Decoding (`decodeGif`)**:
  - Employs binary parser `omggif.GifReader` rather than relying on browser rendering.
  - Accurate frame disposal handling: Disposal 0/1 (retain buffer), Disposal 2 (clear bounding box to zero/transparent), Disposal 3 (restore previous snapshot).
  - Allocation efficiency: Reuses `pixelBuffer` and `snapshotBuffer` across all frames.
- **PNG Sequence Loader (`decodeImageSequence`)**:
  - Alphanumeric natural collation sorting via `localeCompare(..., { numeric: true, sensitivity: 'base' })`.
  - Employs `createImageBitmap` off-thread decoding with explicit GPU resource disposal `bmp.close()` in `finally` block.
  - Fallback to DOM `Image` element with safe object URL creation and revocation.
- **Resampling (`resampleFramesToFps`)**:
  - Correct timestamp progression mapping variable-rate GIF frames onto target FPS grid.

#### Minor Finding 1 (Reliability / Edge Case):
- **What**: Duration probing in `decodeVideo` lacks a timeout.
- **Where**: `web/src/engine/mediaDecoder.ts:103-113`
- **Details**: When `video.duration` is `Infinity` or `NaN`, the code seeks to `1e10` and awaits a `seeked` event without a timeout:
  ```typescript
  duration = await new Promise<number>((resolve) => {
    const onSeeked = () => { ... };
    video.addEventListener('seeked', onSeeked, { once: true });
    video.currentTime = 1e10;
  });
  ```
  If a corrupt or truncated stream never emits `seeked`, this promise will hang indefinitely.
- **Suggestion**: Add a timeout (e.g. 2000ms falling back to 1.0s) and check `signal?.aborted`.

#### Minor Finding 2 (Performance / Optimization):
- **What**: Canvas allocation inside downscaling loop for GIFs.
- **Where**: `web/src/engine/mediaDecoder.ts:334-338`
- **Details**: Inside `decodeGif`, when `needsDownscale` is active, `const scratchCanvas = document.createElement('canvas')` is called on every frame. For a 300-frame GIF, this creates 300 canvas DOM elements.
- **Suggestion**: Allocate `scratchCanvas` once outside the loop alongside `rescaleCanvas`.

---

### 2.3 2:1 Crop & Scale Math Engine (`web/src/engine/cropEngine.ts`)
- **Cover Math**: Accurately computes centered $W = 2H$ rectangle, correctly enforcing even width. Matches `convert_reel.py` behavior (720x1280 reel yields 720x360 at (0, 460)).
- **Contain Math**: Accurately letterboxes/pillarboxes source onto 128x64 ($720\times 1280 \rightarrow 36\times 64$ centered at $(46, 0)$).
- **Handle Resizing**: Orthogonal least-squares projection onto aspect ray $(2, 1)$ via formula $\text{round}((2dx + dy) / 5)$. All 8 handles (`se`, `nw`, `ne`, `sw`, `n`, `s`, `e`, `w`) strictly lock aspect ratio to $2.0$ while clamping to source boundaries.
- **Wheel Zooming**: Computes cursor-relative focal zoom preserving 2:1 aspect ratio.
- **Finding Severity**: **Clean / Robust**.

---

### 2.4 React Components Architecture
- `DropZone.tsx`: Clean drag states (`dragCounter` tracking prevents flickering), file input trigger, abort controller cancellation button, target FPS selector, and error handling.
- `CropTool.tsx`: Interactive viewport with shaded mask overlays, rule-of-thirds composition grid, 8 resize handles with appropriate resize cursors, pointer listeners with proper cleanup on unmount, and live 128x64 preview.
- `MediaPreview.tsx`: Responsive scrubber, frame counter, metadata badges, and thumbnail strip.
- `OledCanvas.tsx`: Physical bezel styling with silkscreen markings (`[GND] [VCC] [SCL] [SDA]`, `SH1106 / SSD1306`), ITU-R BT.601 luminance thresholding, dual-color yellow/blue display emulation for first 16 rows, sub-pixel grid, and phosphor glow styling.
- `App.tsx`: Workbench layout cleanly connecting `DropZone`, `MediaPreview`, `CropTool`, and `OledCanvas` with play/pause/step controls and FPS toggles.

#### Minor Finding 3 (Performance in Playback Loop):
- **What**: Repeated canvas allocation in `App.tsx` during live playback.
- **Where**: `web/src/App.tsx:88-96`
- **Details**: During 30 FPS playback, `imageDataToCanvas` creates a new canvas 30 times per second.
- **Suggestion**: For Milestone M2, keep a persistent source canvas ref to eliminate GC pressure during playback.

---

## 3. Verified Claims

| Claim | Verification Method | Status |
|---|---|---|
| Clean TypeScript compilation | `npx.cmd tsc --noEmit` in `web/` | PASS (Exit code 0) |
| All F01–F05 tests passing | `npm.cmd test` in `web/` | PASS (5/5 tests passed) |
| Clean production build | `npm.cmd run build` in `web/` | PASS (Built in 5.72s, `dist/` created) |
| Natural alphanumeric sorting | Evaluated in `test/verify-m1.ts` | PASS (Strict natural ordering) |
| 2:1 Aspect Ratio Lock | Verified across 8 handles and zoom | PASS (Strict $W = 2H$) |
| omggif binary parsing & disposal | Synthetic GIF written and parsed | PASS (Disposal 1 and 2 verified) |
| Memory cleanup hooks | Code inspection of `finally` blocks | PASS (`revokeObjectURL`, `bmp.close`) |

---

## 4. Adversarial Attack Surface & Failure Mode Analysis

1. **Massive Video / Out-of-Memory Attack**:
   - *Attack*: Dropping a 4K 60 FPS 10-minute video into the browser.
   - *Defense*: Downscaling to bounded 512px reduces RAM footprint by ~98%. `targetFps` downsamples temporal frames.
   - *Status*: Robust.
2. **Infinite Duration / Malformed Video WebM Attack**:
   - *Attack*: Video with infinite duration or missing index.
   - *Defense*: Duration fallback probe implemented; recommendation provided to add timeout to probe promise.
   - *Status*: Mitigated with minor recommendation.
3. **Extreme Aspect Ratios (10000x1, 1x10000)**:
   - *Attack*: Extreme panoramic or tall strip images.
   - *Defense*: `clampCropToBounds` and `computeCoverCrop` enforce minimum and maximum bounds.
   - *Status*: Robust.

---

## 5. Conclusion

The code meets all requirements of Milestone M1 (F01–F05) as specified in `PROJECT.md` and `SCOPE.md`. Code quality, typing, component styling, and error handling are solid. No integrity violations were detected.

**Final Verdict**: **APPROVE**
