# Adversarial Challenge Report: 2:1 Crop & Scale Math Engine (Feature F05)

**Tester / Role**: `challenger_m1_2` (M1 Crop & Scale Boundary Challenger)  
**Target Module**: `web/src/engine/cropEngine.ts` & `web/src/components/CropTool.tsx`  
**Evaluation Script**: `web/test/stress-f05.ts` (executed via Node / `tsx`)  
**Verdict**: **REQUEST_CHANGES**

---

## Challenge Summary

**Overall risk assessment**: **CRITICAL**

Empirical stress testing of the 2:1 Crop & Scale engine uncovered **4 distinct vulnerability classes** across boundary clamping, handle resizing, degenerate sliver dimensions, and uninitialized media handling. Most notably, **all 8 resize handles violate source image boundaries** when dragging boxes near image borders, causing negative coordinates ($x < 0, y < 0$) and coordinate overflows ($x + width > W_{src}, y + height > H_{src}$), which propagate into the UI mask rendering and canvas blitting.

| ID | Severity | Category | Affected Function | Defect | Blast Radius |
|---|---|---|---|---|---|
| **C1** | **CRITICAL** | Boundary Clamping | `resizeCropWithHandle` | Handle resizing overrides local room limit `hLimit` with global `hMin`, producing out-of-bounds coordinates ($x < 0, y < 0, x+w > W_{src}, y+h > H_{src}$) | Broken UI mask styling (`height: -0.75%`), CSS layout shifts, Canvas sampling out-of-bounds transparent padding |
| **C2** | **HIGH** | Boundary Clamping | `clampCropToBounds` | Asymmetric height constraint: checks `w > sourceWidth` but fails to constrain `h > sourceHeight` when $H_{src} < 4$ | $y + height > H_{src}$ violation for low-height media |
| **C3** | **HIGH** | Degenerate Geometry | `computeCoverCrop` | Produces $0 \times 0$ box for $W_{src} < 2$ (e.g. 1:1000 sliver, 1x1, 1x2) | `renderCropTo128x64` crashes with browser Canvas `IndexSizeError` |
| **C4** | **HIGH** | NaN Propagation | `computeContainDestRect` | Uninitialized $0 \times 0$ media evaluates `0 * Infinity = NaN` | All destination coordinates become `NaN`, causing Canvas `drawImage` to throw `TypeError` |

---

## Challenges

### [Critical] Challenge 1: Boundary Clamping Collapse in 8-Handle Resizing (`resizeCropWithHandle`)

- **Assumption Challenged**:
  The implementation assumes that calculating `h = Math.max(hMin, Math.min(hLimit, hProj))` and `w = h * 2` guarantees that the resulting crop rectangle stays strictly within source boundaries $[0, W_{src}] \times [0, H_{src}]$.
- **Attack Scenario**:
  The user moves or resizes the crop box near any boundary of the image, where the distance from the fixed handle anchor to the image border is smaller than the minimum allowable box height $h_{min} = 8$ (or $w_{min} = 16$).
  When any handle is dragged:
  1. For handle `'se'` with anchor $(X, Y) = (794, 597)$ on an $800 \times 600$ canvas:
     `hLimit = Math.min(600 - 597, Math.floor((800 - 794) / 2)) = Math.min(3, 3) = 3`.
     `hMin = Math.max(4, Math.min(8, 300)) = 8`.
     `h = Math.max(8, Math.min(3, hProj)) = 8`!
     `w = 16`.
     Result: `{ x: 794, y: 597, width: 16, height: 8 }`.
     $x + width = 794 + 16 = 810 > 800$ (+10 px out of bounds!).
     $y + height = 597 + 8 = 605 > 600$ (+5 px out of bounds!).
  2. For handle `'nw'` with anchor $(A_x, A_y) = (10, 10)$ on an $800 \times 600$ canvas:
     `hLimit = Math.min(10, Math.floor(10 / 2)) = 5`.
     `h = Math.max(8, Math.min(5, hProj)) = 8`, `w = 16`.
     `x = Ax - w = 10 - 16 = -6 < 0`!
     Result: `{ x: -6, y: 2, width: 16, height: 8 }` (negative coordinate!).
  3. Confirmed identical boundary collapses across **all 8 handles**:
     - `nw`: $x = -6 < 0$
     - `w`: $x = -6 < 0$
     - `ne`: $y = -3 < 0$ and $x + w = 810 > 800$
     - `sw`: $x = -6 < 0$ and $y + h = 605 > 600$
     - `se`: $x + w = 810 > 800$ and $y + h = 605 > 600$
     - `e`: $x + w = 810 > 800$
     - `s`: $y + h = 605 > 600$
     - `n`: $y = -3 < 0$ (when anchor bottom $yBottom < 8$)
- **Blast Radius**:
  In `CropTool.tsx` line 245, the return value of `resizeCropWithHandle` is immediately committed to application state without clamping:
  ```typescript
  const resized = resizeCropWithHandle(activeDrag.type, activeDrag.startCrop, deltaX, deltaY, sourceWidth, sourceHeight);
  onCropChange({ ...cropSettings, x: resized.x, y: resized.y, width: resized.width, height: resized.height });
  ```
  This causes:
  1. CSS percentage calculations in `CropTool.tsx` lines 390–415 (`boxLeftPercent = (cropSettings.x / sourceWidth) * 100`) evaluate to negative values (e.g. `-0.75%`) and bottom mask heights `100 - (boxTopPercent + boxHeightPercent)` exceed $100\%$, distorting the dark shading overlay.
  2. Canvas `drawImage` in `renderCropTo128x64` samples outside the source image bounds, introducing black or transparent padding artifacts into the frame sent to Milestone M2 dithering.
- **Mitigation**:
  1. Ensure local minimum cannot exceed local limit:
     ```typescript
     const localHMin = Math.min(hMin, hLimit);
     const h = Math.max(localHMin, Math.min(hLimit, hProj));
     ```
  2. Before returning from `resizeCropWithHandle`, always pass the resulting box through `clampCropToBounds(box, sourceWidth, sourceHeight)` or enforce:
     ```typescript
     return clampCropToBounds({ x, y, width: w, height: h }, sourceWidth, sourceHeight);
     ```

---

### [High] Challenge 2: Boundary Clamping Failure in `clampCropToBounds` on Low-Height Media ($H_{src} < 4$)

- **Assumption Challenged**:
  `clampCropToBounds` assumes that adjusting `w` when `w > sourceWidth` is sufficient to keep both dimensions within bounds.
- **Attack Scenario**:
  Media with a very small height (e.g., $1000 \times 2$, $1000 \times 3$, or $1000 \times 1$ horizontal strips/banners):
  ```typescript
  const hMax = Math.min(sourceHeight, Math.floor(sourceWidth / 2)); // hMax = 2
  const hMin = Math.max(4, Math.min(8, hMax));                       // hMin = 4
  let h = Math.max(hMin, Math.min(hMax, Math.round(crop.height)));    // h = 4
  let w = h * 2;                                                    // w = 8
  if (w > sourceWidth) { ... } // 8 > 1000 is FALSE!
  const maxY = Math.max(0, sourceHeight - h);                       // maxY = 0
  const y = Math.max(0, Math.min(maxY, Math.round(crop.y)));        // y = 0
  return { x, y, width: w, height: h };                              // { x: 0, y: 0, width: 8, height: 4 }
  ```
  Result: $y + height = 0 + 4 = 4 > H_{src} = 2$.
  The returned box is 4 pixels tall on an image that is only 2 pixels tall.
- **Blast Radius**:
  The box overflows the bottom edge of the image by 2 pixels.
- **Mitigation**:
  Enforce that `hMin` never exceeds `hMax`:
  ```typescript
  const hMax = Math.min(sourceHeight, Math.floor(sourceWidth / 2));
  const hMin = Math.min(hMax, Math.max(1, Math.min(8, hMax)));
  ```
  And add a symmetrical height constraint:
  ```typescript
  if (h > sourceHeight) {
    h = sourceHeight;
    w = h * 2;
  }
  ```

---

### [High] Challenge 3: Degenerate $0 \times 0$ Box in `computeCoverCrop` on 1-Pixel Slivers

- **Assumption Challenged**:
  `computeCoverCrop` assumes subtracting parity `sourceWidth - (sourceWidth % 2)` always leaves a positive even integer.
- **Attack Scenario**:
  Input: $W_{src} = 1, H_{src} = 1000$ (1:1000 sliver) or $1 \times 1$ pixel art asset.
  `cropWidth = sourceWidth - (sourceWidth % 2) = 1 - 1 = 0`.
  `cropHeight = Math.floor(0 / 2) = 0`.
  Output: `{ x: 0, y: 500, width: 0, height: 0 }`.
  When this crop is rendered:
  ```typescript
  renderCropTo128x64(source, cropSettings, targetCanvas);
  // Calls ctx.drawImage(source, 0, 500, 0, 0, 0, 0, 128, 64)
  ```
  W3C HTML Canvas specification dictates that calling `drawImage` with zero source width or height throws an `IndexSizeError`.
- **Blast Radius**:
  Unhandled exception crashes the rendering pipeline on 1-pixel wide inputs.
- **Mitigation**:
  Enforce a minimum positive dimension for cover crop:
  ```typescript
  const cropWidth = Math.max(2, sourceWidth - (sourceWidth % 2));
  const cropHeight = Math.max(1, Math.floor(cropWidth / targetAspect));
  ```
  Or if the source itself is smaller than $2 \times 1$, clamp to valid bounds $[1, 1]$ and in `renderCropTo128x64` handle zero or sub-pixel dimensions gracefully by early-returning a clear canvas.

---

### [High] Challenge 4: NaN Coordinate Generation in `computeContainDestRect` on Uninitialized Media ($0 \times 0$)

- **Assumption Challenged**:
  `computeContainDestRect` assumes `sourceWidth` and `sourceHeight` are strictly positive non-zero numbers.
- **Attack Scenario**:
  Before media finishes decoding or when dimensions are 0 (e.g. `<video>` before `loadedmetadata` event):
  `sourceWidth = 0, sourceHeight = 0`.
  `scale = Math.min(128 / 0, 64 / 0) = Infinity`.
  `dw = Math.max(1, Math.round(0 * Infinity)) = Math.max(1, NaN) = NaN`.
  `dh = NaN, dx = NaN, dy = NaN`.
  Output: `{ dx: NaN, dy: NaN, dw: NaN, dh: NaN }`.
  When `renderCropTo128x64` executes in contain mode with these dimensions:
  `ctx.drawImage(source, 0, 0, 0, 0, NaN, NaN, NaN, NaN)`.
  Browser Canvas throws `TypeError: Failed to execute 'drawImage' on 'CanvasRenderingContext2D': The provided float value is non-finite.`.
- **Blast Radius**:
  Immediate runtime crash if `Contain` preset is clicked or initialized before media is fully loaded.
- **Mitigation**:
  Add defensive guard at the top of `computeContainDestRect`:
  ```typescript
  if (!sourceWidth || !sourceHeight || sourceWidth <= 0 || sourceHeight <= 0) {
    return { dx: 0, dy: 0, dw: OLED_TARGET_WIDTH, dh: OLED_TARGET_HEIGHT };
  }
  ```

---

## Stress Test Results

Executed via automated test runner: `web/test/stress-f05.ts` (1,080+ test permutations).

| Scenario | Expected Behavior | Actual Behavior | Result |
|---|---|---|---|
| **9:16 Vertical Reel (720x1280)** | Centered 2:1 crop at (0, 460), 720x360 | { x: 0, y: 460, width: 720, height: 360 } | **PASS** |
| **16:9 Widescreen (1920x1080)** | Centered 2:1 crop at (0, 60), 1920x960 | { x: 0, y: 60, width: 1920, height: 960 } | **PASS** |
| **21:9 Ultrawide (2560x1080)** | Centered 2:1 crop at (200, 0), 2160x1080 | { x: 200, y: 0, width: 2160, height: 1080 } | **PASS** |
| **32:9 Super Ultrawide (5120x1440)** | Centered 2:1 crop at (1120, 0), 2880x1440 | { x: 1120, y: 0, width: 2880, height: 1440 } | **PASS** |
| **Odd Dimensions (13x17)** | Parity adjusted, 12x6 centered at (0, 5) | { x: 0, y: 5, width: 12, height: 6 } | **PASS** |
| **Odd Dimensions (721x1281)** | Parity adjusted, 720x360 centered at (0, 460) | { x: 0, y: 460, width: 720, height: 360 } | **PASS** |
| **1000:1 Horizontal Sliver** | Crop within bounds, W = 2H | { x: 499, y: 0, width: 2, height: 1 } | **PASS** |
| **Aspect Ratio Invariant ($W = 2H$)** | $W = 2H$ across all operations | Strictly maintained across all non-zero tests | **PASS** |
| **Canvas Contract: Presets (Cover, Contain, Stretch)** | Output is 128x64, 32,768 bytes RGBA | Produced exact 128x64 Canvas / 32,768-byte buffer | **PASS** |
| **Canvas Contract: Smoothing Toggle** | Toggles smoothing enabled & quality = 'high' | Verified context state matches flags | **PASS** |
| **1:1000 Vertical Sliver (1x1000)** | Non-degenerate positive crop box | { x: 0, y: 500, width: 0, height: 0 } | **FAIL** (C3) |
| **Single Pixel (1x1)** | Non-degenerate positive crop box | { x: 0, y: 0, width: 0, height: 0 } | **FAIL** (C3) |
| **Zero-Dimension Media (0x0)** | Defensive fallback, no NaN | { dx: NaN, dy: NaN, dw: NaN, dh: NaN } | **FAIL** (C4) |
| **Clamp on Low Height ($1000 \times 2$)** | $y + height \le 2$ | { x: 0, y: 0, width: 8, height: 4 } ($y+h=4 > 2$) | **FAIL** (C2) |
| **Clamp on Low Height ($1000 \times 3$)** | $y + height \le 3$ | { x: 0, y: 0, width: 8, height: 4 } ($y+h=4 > 3$) | **FAIL** (C2) |
| **Handle SE Boundary Collision** | $x + w \le W_{src}, y + h \le H_{src}$ | { x: 794, y: 597, width: 16, height: 8 } ($x+w=810, y+h=605$) | **FAIL** (C1) |
| **Handle E Boundary Collision** | $x + w \le W_{src}$ | { x: 794, y: 592, width: 16, height: 8 } ($x+w=810$) | **FAIL** (C1) |
| **Handle S Boundary Collision** | $y + h \le H_{src}$ | { x: 784, y: 597, width: 16, height: 8 } ($y+h=605$) | **FAIL** (C1) |
| **Handle NW Boundary Collision** | $x \ge 0, y \ge 0$ | { x: -6, y: 0, width: 16, height: 8 } ($x = -6 < 0$) | **FAIL** (C1) |
| **Handle W Boundary Collision** | $x \ge 0$ | { x: -6, y: 3, width: 16, height: 8 } ($x = -6 < 0$) | **FAIL** (C1) |
| **Handle NE Boundary Collision** | $y \ge 0, x + w \le W_{src}$ | { x: 794, y: -3, width: 16, height: 8 } ($y = -3 < 0, x+w=810$) | **FAIL** (C1) |
| **Handle SW Boundary Collision** | $x \ge 0, y + h \le H_{src}$ | { x: -6, y: 597, width: 16, height: 8 } ($x = -6 < 0, y+h=605$) | **FAIL** (C1) |
| **Zero-Dimension Canvas Draw** | Graceful handle or early return | Throws `IndexSizeError` in `ctx.drawImage` | **FAIL** (C3) |

---

## Unchallenged Areas

- **Touch Multi-Gesture Pinch-to-Zoom**: Multi-touch pinch-to-zoom was out of scope for the headless unit tests and is governed by standard pointer event listeners.
- **Downstream Quantization Thresholds**: Luminance conversion and Floyd-Steinberg / Atkinson error diffusion algorithms belong to Milestone M2.

---

## Recommended Action & Remediation Plan

To clear these challenges for Milestone M1 approval, the implementer should apply the following targeted fixes to `web/src/engine/cropEngine.ts`:

1. **Fix `resizeCropWithHandle`**:
   At the end of `resizeCropWithHandle`, pipe the computed bounding box through `clampCropToBounds`:
   ```typescript
   return clampCropToBounds({ x, y, width: w, height: h }, sourceWidth, sourceHeight);
   ```
   Or clamp each handle's minimum size against its local boundary distance:
   ```typescript
   const effectiveHMin = Math.min(hMin, hLimit);
   const h = Math.max(effectiveHMin, Math.min(hLimit, hProj));
   ```

2. **Fix `clampCropToBounds`**:
   Ensure `hMin` never exceeds `hMax`, and constrain height as well as width:
   ```typescript
   const hMax = Math.min(sourceHeight, Math.floor(sourceWidth / 2));
   const hMin = Math.min(hMax, Math.max(1, Math.min(8, hMax)));
   let h = Math.max(hMin, Math.min(hMax, Math.round(crop.height)));
   let w = h * 2;
   if (w > sourceWidth) {
     w = sourceWidth - (sourceWidth % 2);
     h = Math.floor(w / 2);
   }
   if (h > sourceHeight) {
     h = sourceHeight;
     w = h * 2;
   }
   ```

3. **Fix `computeCoverCrop`**:
   Prevent zero-width and zero-height outputs:
   ```typescript
   if (sourceWidth <= 0 || sourceHeight <= 0) {
     return { x: 0, y: 0, width: OLED_TARGET_WIDTH, height: OLED_TARGET_HEIGHT };
   }
   let cropWidth = Math.max(2, sourceWidth - (sourceWidth % 2));
   let cropHeight = Math.max(1, Math.floor(cropWidth / targetAspect));
   ```

4. **Fix `computeContainDestRect`**:
   Defend against zero dimensions:
   ```typescript
   if (!sourceWidth || !sourceHeight || sourceWidth <= 0 || sourceHeight <= 0) {
     return { dx: 0, dy: 0, dw: OLED_TARGET_WIDTH, dh: OLED_TARGET_HEIGHT };
   }
   ```

5. **Fix `renderCropTo128x64`**:
   Early exit if crop box is empty:
   ```typescript
   if (crop.width <= 0 || crop.height <= 0) {
     return ctx.getImageData(0, 0, OLED_TARGET_WIDTH, OLED_TARGET_HEIGHT);
   }
   ```
