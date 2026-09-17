# Handoff Report: M1 Crop & Scale Boundary Challenger (`challenger_m1_2`)

**Author**: `challenger_m1_2`  
**Parent Agent**: `sub_orch_m1` (Conversation ID: `c335cf6b-2b25-4534-bccd-41c60c2542ba`)  
**Verdict**: **REQUEST_CHANGES**  
**Associated Report**: `D:\espprojects\oled\.agents\challenger_m1_2\challenge.md`  
**Automated Test Suite**: `D:\espprojects\oled\web\test\stress-f05.ts`

---

## 1. Observation

Direct empirical observations from executing test harness `web/test/stress-f05.ts` on `cropEngine.ts`:

1. **8-Handle Boundary Overflow in `resizeCropWithHandle`**:
   - Exact source lines: `web/src/engine/cropEngine.ts:111-125` (Handle `'se'`), `128-139` (`'nw'`), `142-153` (`'ne'`), `156-165` (`'sw'`), `167-181` (`'n'`), `183-196` (`'s'`), `198-212` (`'e'`), `214-229` (`'w'`).
   - Line 112 defines:
     ```typescript
     const hMax = Math.min(sourceHeight, Math.floor(sourceWidth / 2));
     const hMin = Math.max(4, Math.min(8, hMax));
     ```
   - For all handles, `h` is computed as:
     ```typescript
     const h = Math.max(hMin, Math.min(hLimit, hProj));
     ```
   - When the crop box starts near an image border (e.g. anchor $(794, 597)$ on an $800 \times 600$ image, where `hLimit = 3`):
     - `h` evaluates to `Math.max(8, Math.min(3, hProj)) = 8`
     - `w` evaluates to `16`
     - For `'se'`: Box is `{ x: 794, y: 597, width: 16, height: 8 }`. $794 + 16 = 810 > 800$, $597 + 8 = 605 > 600$.
     - For `'nw'`: Box is `{ x: -6, y: 0, width: 16, height: 8 }`. $x = -6 < 0$.
     - For `'w'`: Box is `{ x: -6, y: 3, width: 16, height: 8 }`. $x = -6 < 0$.
     - For `'ne'`: Box is `{ x: 794, y: -3, width: 16, height: 8 }`. $y = -3 < 0, x + w = 810 > 800$.
     - For `'sw'`: Box is `{ x: -6, y: 597, width: 16, height: 8 }`. $x = -6 < 0, y + h = 605 > 600$.
     - For `'e'`: Box is `{ x: 794, y: 592, width: 16, height: 8 }`. $x + w = 810 > 800$.
     - For `'s'`: Box is `{ x: 784, y: 597, width: 16, height: 8 }`. $y + h = 605 > 600$.
     - Verbatim test error:
       `[FAIL] T3-EDGE-BOUND: Box [794, 597, 16, 8] exceeds [0, 0, 800, 600] (violatesX=true, violatesY=true)`

2. **Low-Height Boundary Clamping Failure in `clampCropToBounds`**:
   - Exact source lines: `web/src/engine/cropEngine.ts:77-94`.
   - On an image of size $1000 \times 2$:
     - `hMax = Math.min(2, 500) = 2`
     - `hMin = Math.max(4, Math.min(8, 2)) = 4`
     - `h = Math.max(4, Math.min(2, crop.height)) = 4`
     - `w = h * 2 = 8`
     - Lines 84–87 check `if (w > sourceWidth)` ($8 > 1000$ is `false`).
     - Line 90 computes `maxY = Math.max(0, sourceHeight - h) = Math.max(0, 2 - 4) = 0`, so `y = 0`.
     - Result: `{ x: 0, y: 0, width: 8, height: 4 }`.
     - $y + height = 0 + 4 = 4 > sourceHeight (2)$.
   - Verbatim test error:
     `[FAIL] T2-CLP-BOUND: Result [0, 0, 8, 4] exceeds source [0, 0, 1000, 2] (violatesX=false, violatesY=true)`

3. **Degenerate $0 \times 0$ Box in `computeCoverCrop` on 1-Pixel Slivers**:
   - Exact source lines: `web/src/engine/cropEngine.ts:36-37`.
   - For $W_{src} = 1, H_{src} = 1000$:
     - `cropWidth = 1 - (1 % 2) = 0`
     - `cropHeight = Math.floor(0 / 2) = 0`
     - Result: `{ x: 0, y: 500, width: 0, height: 0 }`.
   - When passed to `renderCropTo128x64`:
     - Verbatim test error:
       `[FAIL] T4-ZERO-DRAW: IndexSizeError: The source or destination size is zero (sw=0, sh=0, dw=128, dh=64)`

4. **NaN Coordinates in `computeContainDestRect` on Uninitialized Media ($0 \times 0$)**:
   - Exact source lines: `web/src/engine/cropEngine.ts:60-64`.
   - For `sourceWidth = 0, sourceHeight = 0`:
     - `scale = Math.min(128/0, 64/0) = Infinity`
     - `dw = Math.max(1, Math.round(0 * Infinity)) = NaN`
     - Result: `{ dx: NaN, dy: NaN, dw: NaN, dh: NaN }`.
   - Verbatim test error:
     `[FAIL] T1-CNT-NAN: NaN coordinate or dimension in contain destination rect`

5. **Passes Observed**:
   - Widescreen 16:9 (1920x1080), vertical reels 9:16 (720x1280, 1080x1920), ultrawide 21:9 (2560x1080), 32:9 (5120x1440), and odd sizes (13x17, 721x1281) maintain $W = 2H$.
   - Normal canvas blitting in `renderCropTo128x64` strictly produces a 128x64 canvas / 32,768-byte RGBA buffer under Cover, Contain, and Stretch presets, correctly configuring `imageSmoothingEnabled` and `imageSmoothingQuality = 'high'`.

---

## 2. Logic Chain

1. **From Observation 1**: Because `hMin` is calculated from the global image dimensions rather than the local distance from the handle anchor to the image boundary, when the anchor is located within 8 pixels of an image border, `hLimit < hMin`.
2. Evaluating `h = Math.max(hMin, Math.min(hLimit, hProj))` forces `h` to become `hMin` (8), even though `hLimit` is strictly smaller than 8.
3. Because `w = 2 * h = 16`, the returned rectangle exceeds the available space from the anchor, resulting in coordinates that overflow the canvas boundary ($X + W > W_{src}, Y + H > H_{src}$) or negative starting offsets ($X < 0, Y < 0$).
4. Because `CropTool.tsx` line 245 passes the return value of `resizeCropWithHandle` directly to `onCropChange` without boundary clamping, these out-of-bounds coordinates enter application state, producing invalid CSS percentages in UI mask overlays and causing Canvas `drawImage` to sample out-of-bounds pixels.
5. **From Observation 2**: `clampCropToBounds` calculates `hMin = Math.max(4, Math.min(8, hMax))`. When $H_{src} < 4$, `hMax < 4`, which forces `hMin = 4 > hMax`. Because `clampCropToBounds` only checks `if (w > sourceWidth)` and omits `if (h > sourceHeight)`, `h` remains 4, producing $y + h > H_{src}$.
6. **From Observation 3**: For $W_{src} = 1$, subtracting parity leaves 0, creating a $0 \times 0$ box that crashes Canvas `drawImage` with `IndexSizeError`.
7. **From Observation 4**: Calling `computeContainDestRect(0, 0)` causes division by zero and multiplication by infinity, producing `NaN`, which causes Canvas `drawImage` to throw `TypeError`.
8. **Conclusion Derivation**: Therefore, the F05 Crop & Scale engine violates the boundary clamping contract across all 8 resize handles and small source heights, and fails to handle degenerate/uninitialized dimensions gracefully.

---

## 3. Caveats

- **Device Pointer Events**: Automated stress testing evaluated the underlying mathematical engine in Node.js via mock canvas and mathematical harnesses. Multi-touch gesture handling in browser DOM was not executed headless.
- **Normal Usage Shielding**: On standard 1080p and 4K video reels with boxes placed near the center of the image, the engine operates reliably. The failures occur strictly under boundary conditions, small assets, edge collisions, and uninitialized component states.

---

## 4. Conclusion

**Verdict**: **REQUEST_CHANGES**

The core 2:1 ratio math ($W = 2H$) and standard presets (Cover, Contain, Stretch) are conceptually sound and pass happy-path tests. However, the engine cannot be approved in its current state due to 1 critical boundary overflow defect in all 8 resize handles and 3 high-severity defects involving low-height media, degenerate slivers, and uninitialized states.

### Required Actions for Implementer:
1. In `cropEngine.ts` `resizeCropWithHandle`: Pipe all handle outputs through `clampCropToBounds` before returning, or clamp against local anchor limits so that `h` never exceeds `hLimit`.
2. In `clampCropToBounds`: Ensure `hMin <= hMax` always (e.g. `const hMin = Math.min(hMax, Math.max(1, Math.min(8, hMax)))`), and add an explicit `if (h > sourceHeight)` constraint.
3. In `computeCoverCrop`: Ensure minimum positive dimensions (`Math.max(2, ...)` and `Math.max(1, ...)`).
4. In `computeContainDestRect`: Add early return for `!sourceWidth || !sourceHeight || sourceWidth <= 0 || sourceHeight <= 0`.
5. In `renderCropTo128x64`: Guard against `crop.width <= 0 || crop.height <= 0`.

---

## 5. Verification Method

To verify the defects and any subsequent fix, run:

```bash
cd D:\espprojects\oled\web
cmd.exe /c npx tsx test/stress-f05.ts
```

### Invalidation Conditions:
- The challenge verdict will be invalidated (and changed to **APPROVE**) once `cmd.exe /c npx tsx test/stress-f05.ts` runs with **0 total failures**, confirming:
  - All 8 handles stay strictly inside $[0, W_{src}] \times [0, H_{src}]$ under all edge collisions.
  - $1000 \times 2$ and $1000 \times 1$ inputs satisfy $y + height \le H_{src}$.
  - $1:1000$ slivers and $0 \times 0$ media do not throw exceptions or generate `NaN`.
