# Technical Specification: Interactive 128×64 Crop & Scale Bounding Box Tool (F05)

**Role**: M1 Crop & Scale Spec Miner (`spec_miner_m1_3`)  
**Target Component**: `web/src/components/CropTool.tsx` & `web/src/engine/cropEngine.ts`  
**Reference Sources**:
- `D:\espprojects\oled\.agents\ORIGINAL_REQUEST.md` (Authoritative Requirements)
- `D:\espprojects\oled\.agents\sub_orch_m1\SCOPE.md` (M1 Architecture & Interface Contracts)
- `D:\espprojects\oled\PROJECT.md` (Project Architecture & Frame Contracts)
- `D:\espprojects\oled\convert_reel.py` (Authoritative Python Reference Implementation)
- `D:\espprojects\oled\igexport-DckvRqKPsI_.mp4` (Empirical Reference Media: 720×1280 @ 30 FPS)

---

## 1. Executive Summary

Feature **F05 (Interactive 128×64 Crop & Scale Tool)** bridges raw ingested media (variable resolution videos, animated GIFs, and image sequences) and the downstream dithering/quantization engine (Milestone M2). It provides:
1. A **fixed 2:1 aspect ratio** ($W_{crop} = 2 \times H_{crop}$) bounding box matching the physical 128×64 OLED display proportions.
2. **Preset fit algorithms**: Cover (maximize 2:1 area without black bars), Contain (scale to fit with letterbox/pillarbox padding), and Stretch (distort full frame to 128×64).
3. **Interactive controls**: Pointer-driven pan dragging, 8-handle aspect-locked resizing via orthogonal least-squares projection, mouse wheel zoom, and strict boundary clamping.
4. **Dual downsampling filters**: High-quality Lanczos/bicubic multi-tap smoothing (`imageSmoothingQuality = 'high'`) for photographic video reels versus nearest-neighbor point sampling (`imageSmoothingEnabled = false`) for razor-sharp pixel art.
5. **Output contract**: Renders directly to a $128 \times 64$ target canvas, returning clean $128 \times 64$ `ImageData` for M2 luminance and dithering processing.

---

## 2. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Geometry | 2:1 Aspect Ratio Lock | Enforces $W_{crop} = 2 \cdot H_{crop}$ at all times across arbitrary source dimensions | Resize handle delta or preset selection | Crop box $(X, Y, W, H)$ | Clamped to source boundaries $[0, W_{src}] \times [0, H_{src}]$ | `ORIGINAL_REQUEST.md` §R1, `convert_reel.py` |
| 2 | Preset | Cover Fit Preset | Centers and maximizes 2:1 crop rectangle to fill target frame without any black borders | Source dimensions $(W_{src}, H_{src})$ | Optimal $(X_c, Y_c, W_c, H_c)$ | Odd dimension parity adjusted to even integers | `convert_reel.py` lines 54–69 |
| 3 | Preset | Contain Fit Preset | Scales entire source into $128 \times 64$, padding unused margins with black letterbox or pillarbox | Source dimensions $(W_{src}, H_{src})$ | Canvas destination rect $(dx, dy, dw, dh)$ | Clamped to $0 \le dw \le 128$, $0 \le dh \le 64$ | `SCOPE.md` §Interface Contracts |
| 4 | Preset | Stretch Fit Preset | Maps full source frame directly to $128 \times 64$, ignoring original aspect ratio | Source dimensions $(W_{src}, H_{src})$ | Source $(0,0,W,H) \to$ Dest $(0,0,128,64)$ | Distorts aspect ratio if $W_{src}/H_{src} \ne 2$ | `SCOPE.md` §Interface Contracts |
| 5 | Interaction | Interactive Pan Drag | Freeform translation of crop rectangle within source image bounds | Cursor pointer drag vector $(\Delta x, \Delta y)$ | Updated $(X_{crop}, Y_{crop})$ | Clamped to $[0, W_{src} - W_{crop}]$ and $[0, H_{src} - H_{crop}]$ | `SCOPE.md` Feature Inventory F05 |
| 6 | Interaction | 8-Handle 2:1 Resize | 4 corner handles and 4 edge handles resizing box while strictly locking $W = 2H$ | Handle pointer drag delta | Updated $(X, Y, W, H)$ | Clamped by boundary distance while preserving 2:1 ratio | `ORIGINAL_REQUEST.md` §R1 |
| 7 | Interaction | Cursor-Centered Zoom | Mouse wheel scrolling expands or contracts crop box centered around cursor location | Wheel event delta, cursor source coord $(C_x, C_y)$ | Scaled $(X', Y', W', H')$ | Clamped to $W_{min} \le W' \le W_{max}$ and frame bounds | UX best practice / Survey 2 |
| 8 | Filter | Downsampling Smoothing Toggle | Switches between high-quality bicubic smoothing and nearest-neighbor point sampling | Boolean `smoothing` flag | Canvas 2D smoothing configuration | Defaults to `true` (high quality) | `SCOPE.md` §Types, `convert_reel.py` |
| 9 | UI | Rule-of-Thirds Grid | Composition guide displaying dashed 3×3 grid lines inside crop box | Crop box dimensions | Visual SVG/HTML overlay lines | Hidden during Contain/Stretch modes | Studio UX standard |
| 10 | Pipeline | 128×64 Render Contract | Blits source image through crop transform into 128×64 canvas and extracts `ImageData` | Source image, `CropSettings` | 128×64 `ImageData` (32,768 bytes RGBA) | Throws error if canvas context unavailable | `SCOPE.md` §Types, `PROJECT.md` §1 |

---

## 3. Mathematical Formulations for 2:1 Aspect Ratio

### 3.1 Display Coordinate & Geometric Definitions
Let:
- Display target width: $W_{target} = 128\text{ px}$
- Display target height: $H_{target} = 64\text{ px}$
- Target display aspect ratio:
  $$R_{target} = \frac{W_{target}}{H_{target}} = \frac{128}{64} = 2.0$$
- Source media width and height: $W_{src}, H_{src} \in \mathbb{N}^+$
- Source aspect ratio:
  $$R_{src} = \frac{W_{src}}{H_{src}}$$

### 3.2 Fundamental Crop Box Constraints
A crop box in source space is defined as a 4-tuple:
$$\mathcal{B} = (X_{crop}, Y_{crop}, W_{crop}, H_{crop}) \in \mathbb{R}^4$$
Subject to the following invariant conditions:
1. **Aspect Ratio Invariant**:
   $$W_{crop} = 2 \cdot H_{crop} \iff \frac{W_{crop}}{H_{crop}} = 2.0$$
2. **Source Boundary Invariants**:
   $$0 \le X_{crop} \le W_{src} - W_{crop}$$
   $$0 \le Y_{crop} \le H_{src} - H_{crop}$$
3. **Maximum Allowable Dimensions**:
   Since $W_{crop} \le W_{src}$ and $H_{crop} \le H_{src}$:
   $$2 \cdot H_{crop} \le W_{src} \implies H_{crop} \le \frac{W_{src}}{2}$$
   $$H_{crop} \le H_{src}$$
   Therefore:
   $$H_{max} = \min\left(H_{src}, \left\lfloor \frac{W_{src}}{2} \right\rfloor\right)$$
   $$W_{max} = 2 \cdot H_{max} = \min\left(2 \cdot H_{src}, W_{src} - (W_{src} \bmod 2)\right)$$
4. **Minimum Allowable Dimensions**:
   To prevent degenerate sub-pixel sampling or divide-by-zero errors:
   $$H_{min} = \max\left(4, \min\left(8, H_{max}\right)\right)$$
   $$W_{min} = 2 \cdot H_{min}$$
5. **Integer Parity Requirement**:
   To prevent sub-pixel canvas antialiasing blur during source image sampling, $W_{crop}$ must always be an even integer:
   $$W_{crop} \in 2\mathbb{Z}^+, \quad H_{crop} \in \mathbb{Z}^+$$

---

## 4. Preset Fit Algorithms

### 4.1 Preset 1: Cover (Center 2:1 Crop)
**Objective**: Maximize the 2:1 area extracted from the source image without introducing any black letterbox or pillarbox bars, centered within the frame.

#### Mathematical Algorithm:
```typescript
export function computeCoverCrop(sourceWidth: number, sourceHeight: number): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const targetAspect = 2.0;
  const sourceAspect = sourceWidth / sourceHeight;

  let cropWidth: number;
  let cropHeight: number;

  if (sourceAspect <= targetAspect) {
    // Source is narrower than or equal to 2:1 (e.g. 9:16 reels, 1:1, 4:3, 16:9)
    // Width is the constraining dimension
    cropWidth = sourceWidth - (sourceWidth % 2); // Enforce even width
    cropHeight = Math.floor(cropWidth / targetAspect);
  } else {
    // Source is wider than 2:1 (e.g. 21:9 ultrawide, 2.39:1 cinema)
    // Height is the constraining dimension
    cropHeight = sourceHeight;
    cropWidth = cropHeight * 2;
  }

  // Center the crop rectangle inside source bounds
  const x = Math.floor((sourceWidth - cropWidth) / 2);
  const y = Math.floor((sourceHeight - cropHeight) / 2);

  return { x, y, width: cropWidth, height: cropHeight };
}
```

#### Canonical Concrete Evaluations:
1. **Vertical 9:16 Instagram Reel (720 × 1280)** (matches empirical reference `igexport-DckvRqKPsI_.mp4`):
   - $R_{src} = 720 / 1280 = 0.5625 < 2.0$
   - $W_{crop} = 720$
   - $H_{crop} = 720 / 2 = 360$
   - $X_{crop} = (720 - 720) / 2 = 0$
   - $Y_{crop} = (1280 - 360) / 2 = 460$
   - **Result**: Exactly extracts the horizontal 720×360 slice centered vertically between $y=460$ and $y=820$. Exactly matches `convert_reel.py` lines 60–68!
2. **Widescreen 16:9 Video (1920 × 1080)**:
   - $R_{src} = 1920 / 1080 \approx 1.7778 < 2.0$ (Note: 16:9 is narrower than 18:9!)
   - $W_{crop} = 1920$
   - $H_{crop} = 1920 / 2 = 960$
   - $X_{crop} = 0$
   - $Y_{crop} = (1080 - 960) / 2 = 60$
   - **Result**: Crops 60px from top and 60px from bottom, centered.
3. **Ultrawide 21:9 Video (2560 × 1080)**:
   - $R_{src} = 2560 / 1080 \approx 2.3704 > 2.0$
   - $H_{crop} = 1080$
   - $W_{crop} = 1080 \times 2 = 2160$
   - $X_{crop} = (2560 - 2160) / 2 = 200$
   - $Y_{crop} = 0$
   - **Result**: Crops 200px from left and 200px from right, centered.
4. **Square 1:1 Pixel Art / Sprite (512 × 512)**:
   - $R_{src} = 1.0 < 2.0$
   - $W_{crop} = 512$, $H_{crop} = 256$
   - $X_{crop} = 0$, $Y_{crop} = (512 - 256) / 2 = 128$
   - **Result**: Extracts center 512×256 slice.

---

### 4.2 Preset 2: Contain (Letterbox / Pillarbox)
**Objective**: Fit the entire source image inside the $128 \times 64$ destination canvas without cropping any source content. Empty regions are filled with black (`#000000`).

#### Mathematical Algorithm:
The destination rectangle $(dx, dy, dw, dh)$ on the $128 \times 64$ canvas is:
$$s = \min\left(\frac{128}{W_{src}}, \frac{64}{H_{src}}\right)$$
$$dw = \text{round}(W_{src} \cdot s)$$
$$dh = \text{round}(H_{src} \cdot s)$$
$$dx = \left\lfloor \frac{128 - dw}{2} \right\rfloor$$
$$dy = \left\lfloor \frac{64 - dh}{2} \right\rfloor$$

#### Canonical Concrete Evaluations:
1. **Vertical 9:16 Reel (720 × 1280)**:
   - $s = \min(128/720, 64/1280) = \min(0.1778, 0.05) = 0.05$
   - $dw = \text{round}(720 \times 0.05) = 36\text{ px}$
   - $dh = \text{round}(1280 \times 0.05) = 64\text{ px}$
   - $dx = \lfloor (128 - 36)/2 \rfloor = 46\text{ px}$
   - $dy = 0\text{ px}$
   - **Result**: Centered 36×64 pillarbox with 46px solid black margins on left and right.
2. **Widescreen 16:9 Video (1920 × 1080)**:
   - $s = \min(128/1920, 64/1080) = \min(0.0667, 0.0593) = 64/1080 \approx 0.059259$
   - $dw = \text{round}(1920 \times 0.059259) = 114\text{ px}$
   - $dh = 64\text{ px}$
   - $dx = \lfloor (128 - 114)/2 \rfloor = 7\text{ px}$
   - $dy = 0\text{ px}$
   - **Result**: Centered 114×64 pillarbox with 7px black bars on left and right.
3. **Ultrawide 21:9 Video (2560 × 1080)**:
   - $s = \min(128/2560, 64/1080) = \min(0.05, 0.0593) = 0.05$
   - $dw = 128\text{ px}$
   - $dh = \text{round}(1080 \times 0.05) = 54\text{ px}$
   - $dx = 0\text{ px}$
   - $dy = \lfloor (64 - 54)/2 \rfloor = 5\text{ px}$
   - **Result**: Centered 128×54 letterbox with 5px black bars top and bottom.
4. **Square 1:1 Sprite (512 × 512)**:
   - $s = \min(128/512, 64/512) = 64/512 = 0.125$
   - $dw = 64\text{ px}$, $dh = 64\text{ px}$
   - $dx = (128 - 64)/2 = 32\text{ px}$, $dy = 0\text{ px}$
   - **Result**: Centered 64×64 square with 32px pillarbox margins on left and right.

---

### 4.3 Preset 3: Stretch (Direct Non-Uniform Scale)
**Objective**: Scale the entire source rectangle directly to $128 \times 64$, filling the entire OLED screen without black bars or cropping, accepting aspect distortion.
- Source rectangle: $sx = 0, sy = 0, sw = W_{src}, sh = H_{src}$
- Destination rectangle on target canvas: $dx = 0, dy = 0, dw = 128, dh = 64$
- Useful for anamorphic art, backgrounds, and full-bleed abstract patterns.

---

## 5. Interactive Controls & Coordinate Space Transformations

### 5.1 Coordinate Spaces
The interactive UI operates across two coordinate spaces:
1. **Source Coordinate Space**: $(X, Y) \in [0, W_{src}] \times [0, H_{src}]$. True pixel values of the underlying video/image.
2. **Display/Viewport Coordinate Space**: $(x_{ui}, y_{ui}) \in [0, W_{disp}] \times [0, H_{disp}]$. Rendered dimensions on the client screen in CSS pixels.

The uniform scale factor $S_{ui}$ between UI display space and Source space is:
$$S_{ui} = \frac{W_{disp}}{W_{src}} = \frac{H_{disp}}{H_{src}}$$
$$\Delta X_{src} = \frac{\Delta x_{ui}}{S_{ui}}, \quad \Delta Y_{src} = \frac{\Delta y_{ui}}{S_{ui}}$$

---

### 5.2 Pan Dragging & Clamping Formulation
When the user clicks inside the crop box (outside handles) and drags by pointer delta $(\Delta x_{ui}, \Delta y_{ui})$:
$$\Delta X = \frac{\Delta x_{ui}}{S_{ui}}, \quad \Delta Y = \frac{\Delta y_{ui}}{S_{ui}}$$
$$X'_{new} = X_{start} + \Delta X$$
$$Y'_{new} = Y_{start} + \Delta Y$$

**Boundary Clamping**:
$$X_{clamped} = \max\left(0, \min\left(W_{src} - W_{crop}, X'_{new}\right)\right)$$
$$Y_{clamped} = \max\left(0, \min\left(H_{src} - H_{crop}, Y'_{new}\right)\right)$$
Because $W_{crop}$ and $H_{crop}$ are invariant during panning, the 2:1 aspect ratio is unconditionally preserved.

---

### 5.3 8-Handle Resizing with Locked 2:1 Ratio
To provide natural, fluid resizing while strictly locking $W = 2H$, cursor movements are projected onto the 2:1 aspect ray $\vec{v} = (2, 1)$ via **orthogonal least-squares projection**:

$$\vec{v} = (2, 1), \quad \|\vec{v}\|^2 = 2^2 + 1^2 = 5$$
Given any pointer displacement $(d_x, d_y)$ from the fixed anchor point, the height change that minimizes Euclidean distance to the cursor is:
$$H_{proj} = \frac{2 \cdot d_x + d_y}{5}, \quad W_{proj} = 2 \cdot H_{proj}$$

#### Exact Formulations for All 8 Handles:

#### 1. South-East (SE) Corner Handle:
- **Fixed Anchor**: Top-Left corner $(A_x, A_y) = (X, Y)$
- Pointer displacement: $d_x = M_x - A_x$, $d_y = M_y - A_y$
- $H_{proj} = \frac{2 d_x + d_y}{5}$
- Maximum bounds from anchor:
  $$H_{limit} = \min\left(H_{src} - A_y, \left\lfloor \frac{W_{src} - A_x}{2} \right\rfloor\right)$$
- Final dimensions:
  $$H = \max\left(H_{min}, \min\left(H_{limit}, H_{proj}\right)\right)$$
  $$W = 2 \cdot H$$
  $$X = A_x, \quad Y = A_y$$

#### 2. North-West (NW) Corner Handle:
- **Fixed Anchor**: Bottom-Right corner $(A_x, A_y) = (X + W, Y + H)$
- Pointer displacement: $d_x = A_x - M_x$, $d_y = A_y - M_y$
- $H_{proj} = \frac{2 d_x + d_y}{5}$
- Maximum bounds from anchor:
  $$H_{limit} = \min\left(A_y, \left\lfloor \frac{A_x}{2} \right\rfloor\right)$$
- Final dimensions:
  $$H = \max\left(H_{min}, \min\left(H_{limit}, H_{proj}\right)\right)$$
  $$W = 2 \cdot H$$
  $$X = A_x - W, \quad Y = A_y - H$$

#### 3. North-East (NE) Corner Handle:
- **Fixed Anchor**: Bottom-Left corner $(A_x, A_y) = (X, Y + H)$
- Pointer displacement: $d_x = M_x - A_x$, $d_y = A_y - M_y$
- $H_{proj} = \frac{2 d_x + d_y}{5}$
- Maximum bounds from anchor:
  $$H_{limit} = \min\left(A_y, \left\lfloor \frac{W_{src} - A_x}{2} \right\rfloor\right)$$
- Final dimensions:
  $$H = \max\left(H_{min}, \min\left(H_{limit}, H_{proj}\right)\right)$$
  $$W = 2 \cdot H$$
  $$X = A_x, \quad Y = A_y - H$$

#### 4. South-West (SW) Corner Handle:
- **Fixed Anchor**: Top-Right corner $(A_x, A_y) = (X + W, Y)$
- Pointer displacement: $d_x = A_x - M_x$, $d_y = M_y - A_y$
- $H_{proj} = \frac{2 d_x + d_y}{5}$
- Maximum bounds from anchor:
  $$H_{limit} = \min\left(H_{src} - A_y, \left\lfloor \frac{A_x}{2} \right\rfloor\right)$$
- Final dimensions:
  $$H = \max\left(H_{min}, \min\left(H_{limit}, H_{proj}\right)\right)$$
  $$W = 2 \cdot H$$
  $$X = A_x - W, \quad Y = A_y$$

#### 5. North (N) Edge Handle:
- Fixed baseline: $Y_{bottom} = Y + H$, fixed horizontal center $C_x = X + W/2$
- Raw height: $H' = Y_{bottom} - M_y$
- Maximum bounds: $H_{limit} = \min(Y_{bottom}, C_x, W_{src} - C_x)$
- $H = \max(H_{min}, \min(H_{limit}, H'))$
- $W = 2 \cdot H$
- $X = C_x - H, \quad Y = Y_{bottom} - H$ (symmetric horizontal expansion)

#### 6. South (S) Edge Handle:
- Fixed baseline: $Y_{top} = Y$, fixed horizontal center $C_x = X + W/2$
- Raw height: $H' = M_y - Y_{top}$
- Maximum bounds: $H_{limit} = \min(H_{src} - Y_{top}, C_x, W_{src} - C_x)$
- $H = \max(H_{min}, \min(H_{limit}, H'))$
- $W = 2 \cdot H$
- $X = C_x - H, \quad Y = Y_{top}$

#### 7. East (E) Edge Handle:
- Fixed baseline: $X_{left} = X$, fixed vertical center $C_y = Y + H/2$
- Raw width: $W' = M_x - X_{left}$
- Maximum bounds: $W_{limit} = \min(W_{src} - X_{left}, 4 \cdot C_y, 4 \cdot (H_{src} - C_y))$
- $W = \max(2 \cdot H_{min}, \min(W_{limit}, W' - (W' \bmod 2)))$
- $H = W / 2$
- $X = X_{left}, \quad Y = C_y - H / 2$ (symmetric vertical expansion)

#### 8. West (W) Edge Handle:
- Fixed baseline: $X_{right} = X + W$, fixed vertical center $C_y = Y + H/2$
- Raw width: $W' = X_{right} - M_x$
- Maximum bounds: $W_{limit} = \min(X_{right}, 4 \cdot C_y, 4 \cdot (H_{src} - C_y))$
- $W = \max(2 \cdot H_{min}, \min(W_{limit}, W' - (W' \bmod 2)))$
- $H = W / 2$
- $X = X_{right} - W, \quad Y = C_y - H / 2$

---

### 5.4 Mouse Wheel Cursor-Centered Zoom
Scrolling the mouse wheel over the crop area provides quick scaling:
1. Zoom scale factor:
   $$\kappa = 1.0 - \text{sign}(\text{event.deltaY}) \times 0.05$$
2. Given cursor position in source space $(C_x, C_y)$:
   $$H' = \text{round}(H \cdot \kappa)$$
   $$W' = 2 \cdot H'$$
   $$X' = \text{round}(C_x - (C_x - X) \cdot \kappa)$$
   $$Y' = \text{round}(C_y - (C_y - Y) \cdot \kappa)$$
3. Boundary clamping applied:
   If $X' < 0 \implies X' = 0$. If $X' + W' > W_{src} \implies X' = W_{src} - W'$.
   If $Y' < 0 \implies Y' = 0$. If $Y' + H' > H_{src} \implies Y' = H_{src} - H'$.
   If $W' > W_{max} \implies W' = W_{max}, H' = H_{max}$.

---

## 6. Downsampling Filter Specification

Downsampling an arbitrary high-resolution source (e.g. $720 \times 360$ from a video reel or $3840 \times 1920$ from a 4K file) to $128 \times 64$ represents a significant decimation factor (up to $30\times$). The tool provides two discrete modes:

### 6.1 High-Quality Multi-Tap Smoothing (`smoothing = true`)
- **Canvas API Configuration**:
  ```typescript
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ```
- **Filter Characteristics**:
  - Modern browser 2D rendering engines (Skia in Chromium, CoreGraphics in WebKit, Moz2D in Firefox) map `imageSmoothingQuality = 'high'` to a multi-tap bicubic or Lanczos-3 reconstruction filter.
  - Effectively acts as a low-pass filter preventing high-frequency aliasing and moiré fringe patterns.
  - Recommended for: Video reels, natural photographs, 3D renderings, and continuous tone art.

### 6.2 Pixel Art Nearest-Neighbor Sampling (`smoothing = false`)
- **Canvas API Configuration**:
  ```typescript
  ctx.imageSmoothingEnabled = false;
  ```
- **CSS Rendering Context**:
  ```css
  canvas {
    image-rendering: pixelated;
    image-rendering: -moz-crisp-edges;
    image-rendering: crisp-edges;
  }
  ```
- **Filter Characteristics**:
  - Point-sampling without spatial interpolation:
    $$x_{src} = \lfloor (x_{dst} + 0.5) \cdot \frac{W_{crop}}{128} \rfloor + X_{crop}$$
    $$y_{src} = \lfloor (y_{dst} + 0.5) \cdot \frac{H_{crop}}{64} \rfloor + Y_{crop}$$
  - Preserves exact hard-edge pixel boundaries, zero blur, and no intermediate color bleeding.
  - Essential for: Aseprite animations, Pico-8 sprites, 8-bit retro games, and pixel fonts.

---

## 7. Output Pipeline Contract for Milestone M2

### 7.1 Canvas Blitting Specification
The output pipeline transforms the active crop selection into an exact $128 \times 64$ pixel `ImageData` buffer ready for M2 dithering.

```typescript
export function renderCropTo128x64(
  source: CanvasImageSource, // HTMLVideoElement | HTMLCanvasElement | ImageBitmap
  crop: CropSettings,
  targetCanvas?: HTMLCanvasElement
): ImageData {
  const canvas = targetCanvas || document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Failed to acquire 2D canvas rendering context');
  }

  // 1. Fill canvas background with solid black
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, 128, 64);

  // 2. Configure interpolation filter
  ctx.imageSmoothingEnabled = crop.smoothing;
  if (crop.smoothing) {
    ctx.imageSmoothingQuality = 'high';
  }

  // 3. Render according to fit mode
  if (crop.mode === 'stretch') {
    ctx.drawImage(source, 0, 0, crop.sourceWidth, crop.sourceHeight, 0, 0, 128, 64);
  } else if (crop.mode === 'contain') {
    const scale = Math.min(128 / crop.sourceWidth, 64 / crop.sourceHeight);
    const dw = Math.round(crop.sourceWidth * scale);
    const dh = Math.round(crop.sourceHeight * scale);
    const dx = Math.floor((128 - dw) / 2);
    const dy = Math.floor((64 - dh) / 2);
    ctx.drawImage(source, 0, 0, crop.sourceWidth, crop.sourceHeight, dx, dy, dw, dh);
  } else {
    // 'cover' or custom interactive bounding box
    ctx.drawImage(
      source,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      128,
      64
    );
  }

  // 4. Extract standardized 128x64 RGBA ImageData
  return ctx.getImageData(0, 0, 128, 64);
}
```

### 7.2 Interface Contract Verification with M2
The returned `ImageData` satisfies:
- `width`: Exactly $128$
- `height`: Exactly $64$
- `data.length`: Exactly $128 \times 64 \times 4 = 32,768\text{ bytes}$ ($32\text{ KB}$)
- Bit layout: Consecutive RGBA tuples: $[R_0, G_0, B_0, A_0, R_1, G_1, B_1, A_1, \dots]$
- M2 Dithering Engine consumes this buffer directly for ITU-R BT.601 luminance calculation ($Y = 0.299R + 0.587G + 0.114B$), applying Atkinson / Floyd-Steinberg / Bayer dithering, and packing into the final 1024-byte row-major LSB-first XBMP array.

---

## 8. Component Structure for `CropTool.tsx`

### 8.1 TypeScript Types (`web/src/types/media.ts`)
```typescript
export type FitMode = 'cover' | 'contain' | 'stretch';

export interface CropSettings {
  mode: FitMode;
  x: number;
  y: number;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
  smoothing: boolean;
}

export interface CropToolProps {
  source: CanvasImageSource | null;
  sourceWidth: number;
  sourceHeight: number;
  cropSettings: CropSettings;
  onCropChange: (settings: CropSettings) => void;
  className?: string;
}
```

### 8.2 Component Hierarchy & Layout
```
<CropTool> (Root container with Tailwind CSS styling)
├── <CropToolbar>
│   ├── <PresetButtonGroup>
│   │   ├── <Button active={mode==='cover'}> Cover (2:1) </Button>
│   │   ├── <Button active={mode==='contain'}> Contain </Button>
│   │   └── <Button active={mode==='stretch'}> Stretch </Button>
│   ├── <SmoothingToggle>
│   │   └── <Switch checked={smoothing}> Smooth (Video) / Pixel Art (Sharp) </Switch>
│   ├── <MetricsDisplay>
│   │   └── <span> {cropW}×{cropH} → 128×64 ({scale}x) </span>
│   └── <ResetButton onClick={resetToCover}> Reset </ResetButton>
│
├── <CropViewportContainer> (Relative container, sets up pointer & wheel event listeners)
│   ├── <SourcePreviewCanvas> (Draws source frame scaled to container)
│   │
│   {/* Shading Mask: Dims unselected area */}
│   ├── <CropMaskOverlay>
│   │   ├── <div className="absolute bg-black/65" style={{ top: 0, left: 0, right: 0, height: boxY }} />
│   │   ├── <div className="absolute bg-black/65" style={{ bottom: 0, left: 0, right: 0, height: H_disp - (boxY + boxH) }} />
│   │   ├── <div className="absolute bg-black/65" style={{ top: boxY, left: 0, width: boxX, height: boxH }} />
│   │   └── <div className="absolute bg-black/65" style={{ top: boxY, right: 0, width: W_disp - (boxX + boxW), height: boxH }} />
│   │
│   {/* Interactive Bounding Box */}
│   ├── <CropBoundingBox style={{ left: boxX, top: boxY, width: boxW, height: boxH }}>
│   │   ├── <BorderOutline className="border-2 border-cyan-400 shadow-[0_0_8px_rgba(0,240,255,0.6)]" />
│   │   ├── <RuleOfThirdsGrid className="grid grid-cols-3 grid-rows-3 pointer-events-none" />
│   │   ├── <CenterPanHandle className="cursor-grab active:cursor-grabbing inset-0" />
│   │   │
│   │   {/* 8 Resize Handles */}
│   │   ├── <CornerHandle handle="nw" className="cursor-nwse-resize top-0 left-0" />
│   │   ├── <CornerHandle handle="ne" className="cursor-nesw-resize top-0 right-0" />
│   │   ├── <CornerHandle handle="se" className="cursor-nwse-resize bottom-0 right-0" />
│   │   ├── <CornerHandle handle="sw" className="cursor-nesw-resize bottom-0 left-0" />
│   │   ├── <EdgeHandle handle="n" className="cursor-ns-resize top-0 left-1/2" />
│   │   ├── <EdgeHandle handle="s" className="cursor-ns-resize bottom-0 left-1/2" />
│   │   ├── <EdgeHandle handle="e" className="cursor-ew-resize top-1/2 right-0" />
│   │   └── <EdgeHandle handle="w" className="cursor-ew-resize top-1/2 left-0" />
│   └── </CropBoundingBox>
│
└── <MiniOledPreview> (128x64 live preview canvas)
```

---

## 9. Edge Cases

| # | Feature | Input | Observed Behavior / Specification Requirement |
|---|---------|-------|-----------------------------------------------|
| 1 | Cover Crop | Odd source dimensions (e.g. 721 × 1281) | Integer division of odd width yields fractional half-pixel ($721/2 = 360.5$); algorithm must enforce $W_{crop} = W_{src} - (W_{src} \bmod 2) = 720$, ensuring $H_{crop} = 360$ is an exact integer. |
| 2 | Contain Crop | Source width/height smaller than 128×64 (e.g. 64 × 32 icon) | Scaling factor $s = \min(128/64, 64/32) = 2.0$; upscale to $128 \times 64$ or center at 1:1; specification mandates uniform integer/fractional upscale to fit $128 \times 64$ with black borders if aspect $\ne 2.0$. |
| 3 | Contain Crop | Ultra-wide panoramic banner (e.g. 5120 × 200) | $s = 128 / 5120 = 0.025$; $dh = \text{round}(200 \times 0.025) = 5\text{ px}$; $dy = \lfloor(64 - 5)/2\rfloor = 29\text{ px}$. Letterboxed with 29px black bars top and bottom. |
| 4 | Corner Resize | User drags corner handle past source boundary | Boundary clamping must halt handle movement at image boundary while strictly preserving the 2:1 aspect ratio. Box does not warp or exceed borders. |
| 5 | Corner Resize | User shrinks crop box below minimum size ($H < 4\text{ px}$) | Clamping enforces $H \ge 4$, $W \ge 8$ to prevent degenerate zero or negative dimensions and division-by-zero crashes. |
| 6 | Pan Drag | Fast mouse fling outside browser viewport | Pointer event listeners are attached to `window` (not just component container) on `pointerdown`, ensuring dragging continues smoothly and cleanly terminates on `pointerup` even if the cursor leaves the window. |
| 7 | Mouse Wheel | Rapid wheel zooming past minimum/maximum bounds | Wheel zoom delta is clamped to $[H_{min}, H_{max}]$; box repositioning maintains centroid anchor without jumping. |
| 8 | Filter Toggle | Switching from video reel to Aseprite sprite | Smoothing filter must instantly switch canvas context `imageSmoothingEnabled` to `false` without requiring re-ingestion of media. |
| 9 | Preset Switch | User custom-resizes box, then clicks "Cover" | `mode` switches to `'cover'` and coordinates immediately snap to center 2:1 crop rectangle. Subsequent handle drag transitions `mode` to `'custom'`. |
| 10 | Zero / Null Media | Source is null or video is still loading | Component renders subtle placeholder skeleton grid with disabled controls, preventing null pointer crashes. |
