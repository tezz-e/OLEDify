# Integration Impact Analysis: Hardening Patches, Component Contracts & Test Runner Unification

**Agent**: `explorer_m1_6` (M1 Integration & Test Explorer)  
**Parent**: `sub_orch_m1` (Conversation ID: `c335cf6b-2b25-4534-bccd-41c60c2542ba`)  
**Target Milestone**: Milestone M1 — Web Studio Foundation & Media Ingestion  
**Date**: 2026-09-17T19:05:00Z  

---

## 1. Executive Summary

Milestone M1 establishes the client-side ingestion, decoding, and preprocessing pipeline in `web/`. Following Iteration 1, challengers `challenger_m1_1` and `challenger_m1_2` flagged 4 decoding stability defects and 4 boundary clamping defects across `mediaDecoder.ts` and `cropEngine.ts`.

This investigation evaluated the cross-component integration impact of the proposed hardening patches on `web/src/components/CropTool.tsx`, `DropZone.tsx`, and `App.tsx`, analyzed drag mechanics and visual jump prevention, checked the test automation harness, and established concrete verification criteria for the upcoming Worker iteration.

### Key Discoveries:
1. **Visual Jump Dynamics**: When a crop box resizes near canvas boundaries, enforcing an arbitrary global minimum dimension ($hMin = 8$) when available boundary space $hLimit < 8$ forces coordinates outside the canvas ($X < 0, Y < 0, X + W > W_{src}, Y + H > H_{src}$). Attempting to fix this by naively clamping $(X, Y)$ causes the pinned anchor corner to jump abruptly by several pixels. To eliminate visual jumps, `effectiveHMin` must be dynamically scaled to $\min(hMin, hLimit)$, preserving the fixed anchor point.
2. **DOM Alignment Discrepancy in `CropTool.tsx`**: In `CropTool.tsx`, the outer flexbox wrapper receives `ref={containerRef}` while the `<canvas>` uses `max-h-[380px] object-contain`. On vertical reels (e.g. $720 \times 1280$ in `igexport-DckvRqKPsI_.mp4`), the canvas renders centered at width $213.8\text{px}$, but the container is $600\text{px}$ wide. Consequently, CSS percentage overlays (`boxLeftPercent`) and mouse coordinate translations in `getScaleFactor()` diverge significantly from the image bitmap.
3. **Silent Test Failure in `stress-f05.ts`**: While `web/test/stress-f05.ts` identifies 18 failures, it fails to call `process.exit(1)`. The Node process exits with code `0`.
4. **Isolated Test Runner in `package.json`**: `package.json`'s `"test"` script executes only `test/verify-m1.ts`, ignoring both `stress-decoder.ts` and `stress-f05.ts`.

---

## 2. Drag Handling & Visual Jumps Analysis (`CropTool.tsx` + `cropEngine.ts`)

### 2.1 Drag Event Pipeline in `CropTool.tsx`
In `CropTool.tsx:186-266`, interactive manipulation occurs across two distinct modes:
1. **Pan Dragging (`type === 'pan'`)**:
   - Captures `startX`, `startY`, and `startCrop` on `pointerdown`.
   - On `pointermove`, computes source delta: $\Delta X = (\text{clientX} - \text{startX}) / \text{scale}$.
   - Evaluates $newX = startCrop.x + \Delta X$, $newY = startCrop.y + \Delta Y$.
   - Passes candidate rectangle to `clampCropToBounds(..., sourceWidth, sourceHeight)`.
   - Calls `onCropChange`.
2. **Handle Resizing (`type === ResizeHandle`)**:
   - Translates mouse displacement into delta $(\Delta X, \Delta Y)$.
   - Evaluates `resizeCropWithHandle(handle, startCrop, deltaX, deltaY, sourceWidth, sourceHeight)`.
   - Directly calls `onCropChange` with the returned rectangle **without** passing through `clampCropToBounds`.

### 2.2 Mechanism of Visual Jumps & Boundary Clamping
In `cropEngine.ts:111-233`, each handle defines an anchor point:
- `'se'`: Anchor Top-Left $(X, Y)$, moving Bottom-Right $(X+W, Y+H)$.
- `'nw'`: Anchor Bottom-Right $(X+W, Y+H)$, moving Top-Left $(X, Y)$.
- `'ne'`: Anchor Bottom-Left $(X, Y+H)$, moving Top-Right $(X+W, Y)$.
- `'sw'`: Anchor Top-Right $(X+W, Y)$, moving Bottom-Left $(X, Y+H)$.
- `'n'`, `'s'`: Pinned horizontal center $cx = X + W/2$ and opposite vertical baseline.
- `'e'`, `'w'`: Pinned vertical center $cy = Y + H/2$ and opposite horizontal baseline.

#### The Root Cause of Visual Jumps:
Currently, `cropEngine.ts` sets $hMin = \max(4, \min(8, hMax))$ globally based only on total source dimensions.
When resizing near a boundary (e.g. anchor $(ax, ay) = (10, 10)$ for handle `'nw'` on an $800 \times 600$ image):
- Available space to the left boundary is $ax = 10\text{px}$, so $hLimit = \lfloor 10 / 2 \rfloor = 5\text{px}$.
- Because $h = \max(hMin, \min(hLimit, hProj))$, $h$ is evaluated as $\max(8, \min(5, hProj)) = 8$.
- Width is $w = 2h = 16\text{px}$.
- Result: $x = ax - w = 10 - 16 = -6 < 0$.

If a naive clamp is applied to the output coordinates:
- $x = \max(0, -6) = 0$.
- Because $w = 16$, the bottom-right corner becomes $x + w = 0 + 16 = 16$.
- The anchor, which the user expects to stay stationary at $ax = 10$, **jumps from 10 to 16** (a 6-pixel sudden jerk).

#### The Jump-Free Solution:
The anchor point MUST NOT move during a handle drag. The minimum height must be locally bounded by the distance from the anchor to the boundary:
```typescript
const effectiveHMin = Math.min(hMin, Math.max(1, hLimit));
const h = Math.max(effectiveHMin, Math.min(hLimit, hProj));
const w = h * 2;
```
When this formulation is applied:
- For $ax = 10$: $hLimit = 5$, $effectiveHMin = \min(8, 5) = 5$.
- $h$ clamps smoothly to $5$, $w = 10$.
- $x = 10 - 10 = 0$, $y = 10 - 5 = 5$.
- Coordinates stay $\ge 0$.
- The anchor $(ax, ay) = (10, 10)$ remains **100% stationary**.
- Zero visual jumps occur.

### 2.3 Impact on Mask Overlays in `CropTool.tsx`
In `CropTool.tsx:389-415`, the shading mask dimensions are computed as:
- Top Mask: `height: ${boxTopPercent}%`
- Bottom Mask: `height: ${100 - (boxTopPercent + boxHeightPercent)}%`
- Left Mask: `width: ${boxLeftPercent}%`
- Right Mask: `width: ${100 - (boxLeftPercent + boxWidthPercent)}%`

When $X < 0$ or $X + W > W_{src}$, `boxLeftPercent < 0` or `boxLeftPercent + boxWidthPercent > 100`. This produces **negative CSS percentages** (e.g. `width: -1.25%`), causing styling dropouts and visual tearing. Hardening `cropEngine.ts` guarantees $0 \le \text{boxLeftPercent} + \text{boxWidthPercent} \le 100$, ensuring masks render smoothly without glitches.

### 2.4 Viewport Scaling and Aspect Ratio Alignment Defect
In `CropTool.tsx:373-383`:
```tsx
<div
  ref={containerRef}
  onWheel={handleWheel}
  className="relative flex-1 w-full bg-oled-bg border border-oled-border rounded-lg overflow-hidden select-none touch-none aspect-auto min-h-[220px] max-h-[380px] flex items-center justify-center"
>
  <canvas
    ref={sourceCanvasRef}
    width={sourceWidth}
    height={sourceHeight}
    className="w-full h-auto max-h-[380px] object-contain block pointer-events-none"
  />
  {/* Overlays positioned relative to containerRef */}
</div>
```
- For a vertical reel ($720 \times 1280$), `containerRef` width is ~600px, but the rendered canvas width is only $380 \times (720 / 1280) = 213.8\text{px}$.
- The canvas sits centered with ~193px of empty space on each side.
- Overlays positioned with `left: ${boxLeftPercent}%` are measured against the 600px container width rather than the 213.8px canvas width.
- `getScaleFactor()` calculates `rect.width / sourceWidth = 600 / 720 = 0.833`, whereas the canvas scale is $213.8 / 720 = 0.297$.

**Remediation Recommendation for Worker**:
Wrap the canvas and overlays inside an inner container locked to the media's aspect ratio:
```tsx
<div className="relative flex-1 w-full bg-oled-bg border border-oled-border rounded-lg overflow-hidden select-none touch-none min-h-[220px] max-h-[380px] flex items-center justify-center">
  <div
    ref={containerRef}
    className="relative max-h-[380px] max-w-full"
    style={{ aspectRatio: `${sourceWidth} / ${sourceHeight}` }}
  >
    <canvas
      ref={sourceCanvasRef}
      width={sourceWidth}
      height={sourceHeight}
      className="w-full h-full block pointer-events-none"
    />
    {/* Bounding box and shading overlays */}
  </div>
</div>
```
This guarantees exact 1:1 pixel alignment between mouse coordinates, overlays, and canvas pixels.

---

## 3. Integration Impact on `DropZone.tsx` and `App.tsx`

### 3.1 `DropZone.tsx` Integration
`DropZone.tsx` coordinates media ingestion across MP4/WebM (`decodeVideo`), GIF (`decodeGif`), and PNG/JPEG sequences (`decodeImageSequence`).

1. **Duration Probe Timeout**:
   - Corrupted or stalled MP4 files that fail to fire `seeked` currently freeze `DropZone.tsx` in `isDecoding = true` with a spinning `Loader2`.
   - Hardening `mediaDecoder.ts` with a 1500ms timeout resolves the Promise cleanly to fallback duration, allowing decoding to finish or emit a descriptive error toast.
2. **Bounded Memory via `maxFrames`**:
   - `DropZone.tsx` exposes target FPS (15, 20, 24, 30).
   - Ingesting a 2-minute video at 30 FPS currently attempts to allocate 3,600 frames (>2 GB RAM), causing browser tab termination.
   - Enforcing `maxFrames = 600` caps memory consumption under ~350 MB, keeping `DropZone`'s progress bar monotonic and preventing memory exhaustion.
3. **Deterministic Collation**:
   - File drag-and-drop on Windows can deliver files in arbitrary batch slices.
   - Adding secondary collation (`a.name.localeCompare(b.name)`) guarantees sequence order is reproducible.

### 3.2 `App.tsx` Integration
In `App.tsx`:
1. **Initial Cover Calculation (`handleMediaLoaded`)**:
   - `computeCoverCrop` initializes `cropSettings` upon media load.
   - Hardening `computeCoverCrop` against 0-dimension slivers ($1 \times 1000$ or $0 \times 0$) guarantees that `initialCrop` has valid positive dimensions ($W \ge 2, H \ge 1$).
2. **Crash-Proof Blitting Loop**:
   - `useEffect` at line 81 blits the active frame to 128x64 whenever `media`, `activeFrameIndex`, or `cropSettings` changes:
     ```typescript
     const cropped = renderCropTo128x64(srcCanvas, cropSettings, scratchCanvasRef.current);
     setCropped128x64(cropped);
     ```
   - In Iteration 1, invalid crop dimensions threw `IndexSizeError` or `TypeError: Failed to execute 'drawImage' on 'CanvasRenderingContext2D': The provided double value is non-finite`.
   - Hardening `cropEngine.ts` ensures `renderCropTo128x64` never crashes the React rendering cycle.
3. **Playback Loop Stability**:
   - Playback timing depends on `intervalMs = 1000 / targetFps`.
   - Guarding `targetFps >= 1` prevents `intervalMs = NaN` or `Infinity`, ensuring playback timers operate predictably.

---

## 4. Test Runner & `package.json` Evaluation

### 4.1 Current Test Execution Audit
| Suite | Command | Current Status | Issues Found |
|---|---|---|---|
| `verify-m1.ts` | `npm test` | PASS (5/5) | Happy-path only |
| `stress-decoder.ts` | `npx tsx test/stress-decoder.ts` | PASS (17/17) | 4 unaddressed findings |
| `stress-f05.ts` | `npx tsx test/stress-f05.ts` | FAIL (18 failures) | Exits with code 0 instead of 1 |

### 4.2 Defect in `stress-f05.ts` Exit Code
In `web/test/stress-f05.ts:505-513`:
```typescript
console.log('\n================================================================');
console.log(`STRESS TESTING COMPLETE. TOTAL FAILURES DETECTED: ${failures.length}`);
console.log('================================================================\n');

for (const [idx, f] of failures.entries()) {
  console.log(`${idx + 1}. [${f.testId}] (${f.category}): ${f.description}`);
  console.log(`   Violation: ${f.violation}`);
}
// MISSING: process.exit(failures.length > 0 ? 1 : 0);
```
Because `process.exit(1)` is omitted, running `npx tsx test/stress-f05.ts` exits with status `0`. Any CI or shell script treating code `0` as success will falsely mark these 18 failures as passed.

### 4.3 Proposed Runner Architecture
To ensure complete test governance, `web/package.json` should be updated with both granular targets and a unified master runner:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "tsc --noEmit",
    "test": "npx tsx test/run-all.ts",
    "test:verify": "npx tsx test/verify-m1.ts",
    "test:decoder": "npx tsx test/stress-decoder.ts",
    "test:crop": "npx tsx test/stress-f05.ts"
  }
}
```

A dedicated runner `web/test/run-all.ts` will:
1. Execute `verify-m1.ts`, `stress-decoder.ts`, and `stress-f05.ts` sequentially.
2. Aggregate test metrics and assert zero failures.
3. Fail immediately with exit code `1` if any suite encounters errors.

---

## 5. Verification Criteria for Worker Iteration 2

The Worker must meet the following concrete verification criteria to pass the Gate in Iteration 2:

### Category A: Media Decoder Hardening (`mediaDecoder.ts`)
- **[VC-DEC-01] Probe Timeout**: In `decodeVideo`, duration probing on seek must use a timeout ($\le 2000\text{ms}$) to fallback gracefully if `seeked` does not fire.
- **[VC-DEC-02] Memory Safeguard**: In `decodeVideo`, frame extraction must cap at `maxFrames` (default 600) to prevent browser OOM on long video files.
- **[VC-DEC-03] FPS Validation**: In `resampleFramesToFps`, `targetFps` must be validated and clamped to $\ge 1$, ensuring non-NaN timestamps.
- **[VC-DEC-04] Deterministic Sort**: In `decodeImageSequence`, `localeCompare` must include secondary file name comparison tie-breaking.
- **[VC-DEC-05] Decoder Stress Pass**: `npx tsx test/stress-decoder.ts` must execute with 0 findings and exit code 0.

### Category B: Crop & Scale Engine Boundary Hardening (`cropEngine.ts`)
- **[VC-CROP-01] 8-Handle Boundary Confinement**: `resizeCropWithHandle` must strictly constrain all 8 handles within $[0, W_{src}] \times [0, H_{src}]$ under all edge collisions, with anchor points remaining strictly stationary.
- **[VC-CROP-02] Low-Height Clamping**: In `clampCropToBounds`, $hMin \le hMax$ must hold for $H_{src} < 4$, and $y + height \le H_{src}$ must be enforced.
- **[VC-CROP-03] Degenerate Slivers**: `computeCoverCrop` must return positive dimensions ($W \ge 1, H \ge 1$) for $1\text{px}$ wide/tall inputs.
- **[VC-CROP-04] Contain Rect NaN Elimination**: `computeContainDestRect` must return finite numbers ($dx, dy \ge 0, dw, dh \ge 1$) when $W_{src} = 0$ or $H_{src} = 0$.
- **[VC-CROP-05] Canvas Blit Safety**: `renderCropTo128x64` must guard against non-positive dimensions, preventing `IndexSizeError`.
- **[VC-CROP-06] Crop Stress Pass**: `npx tsx test/stress-f05.ts` must execute with **0 failures** (down from 18) and exit code 0.

### Category C: Component Integration (`CropTool.tsx`, `DropZone.tsx`, `App.tsx`)
- **[VC-INT-01] Aspect Ratio Alignment**: In `CropTool.tsx`, the canvas and overlays must be contained in an aspect-ratio-locked inner wrapper to guarantee 1:1 overlay alignment for vertical (9:16) reels.
- **[VC-INT-02] Mask Validity**: Shading mask CSS dimensions in `CropTool.tsx` must never evaluate to negative values.
- **[VC-INT-03] Blit Resilience**: Real-time 128x64 preview rendering in `CropTool.tsx` and `App.tsx` must never throw exceptions during interactive drags or preset switches.
- **[VC-INT-04] Smooth Abort**: `DropZone.tsx` decoding abort must release resources cleanly without leaving lingering decoding state.

### Category D: Automation & Build Pipeline
- **[VC-TEST-01] Unified Test Script**: `npm test` must run all verification and stress suites.
- **[VC-TEST-02] Non-Zero Exit Code**: `stress-f05.ts` must call `process.exit(1)` when failures occur.
- **[VC-TEST-03] Clean Typecheck & Build**: `npm run lint` (`tsc --noEmit`) and `npm run build` (`vite build`) must succeed with 0 errors and 0 warnings.
