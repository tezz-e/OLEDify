# Technical Specification & Architecture Analysis: Web-based OLED Visual Animation Engine & Converter (R1)

**Role**: Web Engine & Dithering Spec Miner  
**Target Working Directory**: `D:\espprojects\oled\web`  
**Reference Sources**:
- `D:\espprojects\oled\.agents\ORIGINAL_REQUEST.md` (Authoritative Requirements)
- `D:\espprojects\oled\convert_reel.py` (Reference Python conversion pipeline)
- `D:\espprojects\oled\src\main.cpp` (U8g2 SH1106 ESP32-S3 firmware)
- `D:\espprojects\oled\platformio.ini` (ESP32-S3 hardware constraints)

---

## 1. Executive Summary

This report delivers the comprehensive architectural, mathematical, and implementation specification for **Requirement R1: Web-based Drag & Drop Converter & Studio UI (Vite + React)**. The engine transforms incoming media (MP4, WebM, animated GIF, and PNG frame sequences) client-side into 1-bit monochrome 128×64 XBMP frame buffers running at 15–30 FPS, provides an interactive 2:1 aspect-ratio crop/scale bounding box, executes real-time dithering (Atkinson, Floyd-Steinberg, Bayer 2×2/4×4/8×8, and Thresholding), and renders a simulated physical OLED display with authentic phosphor glow, sub-pixel grid gap, and playback controls.

---

## 2. Input Format Handling & Client-Side Extraction

Modern browser standards allow 100% client-side decoding without backend servers or native binaries.

### 2.1 Video Media (MP4, WebM)
- **Decoding Mechanism**:
  - Ingestion via HTML5 `<input type="file" accept="video/mp4,video/webm">` or Drag-and-Drop `DragEvent.dataTransfer.files`.
  - Creation of Object URL: `const url = URL.createObjectURL(file);`.
  - Instantiation of headless HTML5 `<video>` element with `muted = true`, `playsInline = true`, and `preload = "auto"`.
  - Extraction loop via sequential seek (`video.currentTime = t`) listening to `seeked` events, drawn to an offscreen canvas `ctx.drawImage(video, 0, 0)`.
- **Latency & Memory Optimization**:
  - Raw 1080×1920 RGBA `ImageData` is ~8.29 MB per frame. Loading 300 frames of full-resolution raw ImageData into memory would consume **~2.5 GB RAM**, crashing browser tabs.
  - **Architectural Solution**: Extract frames directly into a downsampled intermediate resolution (e.g. 256×128 or directly into target 128×64 scaled coordinates), or retain the `<video>` element for interactive scrub/crop preview and only bake frames upon user bake/export.
- **Variable Frame Rate (VFR) & Timestamp Alignment**:
  - Target FPS is quantized to discrete steps: $\Delta t = 1.0 / \text{targetFps}$ (e.g. 15, 20, 24, 30 FPS).
  - Total frames $N = \lfloor \text{duration} \times \text{targetFps} \rfloor$.
  - Seek timestamps $t_i = i \times \Delta t$ for $i \in [0, N-1]$.

### 2.2 Animated GIF
- **Browser Limitation**: The browser's native `<video>` element does not decode animated GIFs, and drawing an animated `<img>` to a canvas only draws the first or current uncontrollable animation frame.
- **Client-Side Parser Specification**:
  - Library recommendation: `omggif` (Kevin Kwok) or `gifuct-js`.
  - Bundle footprint: `omggif` is ~10 KB pure JavaScript, zero external dependencies.
  - Parsing sequence:
    1. Read GIF binary into `Uint8Array` via `FileReader.readAsArrayBuffer(file)`.
    2. Instantiate `reader = new GifReader(buffer)`.
    3. Extract frame count: `reader.numFrames()`.
    4. Per-frame loop: Extract frame disposal mode, frame delay (hundredths of a second), transparency index, and composite onto an accumulator canvas using `reader.decodeAndBlitFrameRGBA(frameIndex, pixelBuffer)`.
  - **Disposal Methods Handling**:
    - Mode 0 / 1 (Leave in place): Overlay next frame directly over accumulated canvas.
    - Mode 2 (Restore to background): Clear the frame sub-rectangle to transparent/black before next frame.
    - Mode 3 (Restore to previous): Revert canvas state to snapshot before current frame was drawn.

### 2.3 PNG / JPEG / WebP Frame Sequences
- **Multi-file Ingestion**: Dragging multiple files or a folder of frames.
- **Natural Alphanumeric Sorting**:
  - File lists from operating systems often arrive unordered or alphabetically sorted (`frame_1.png`, `frame_10.png`, `frame_2.png`).
  - Strict natural collation rule:
    `files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))`.
- **Decoding via `createImageBitmap()`**:
  - High-performance asynchronous GPU/Worker decoding:
    `const bmp = await createImageBitmap(file);`
  - Avoids DOM image element overhead and decodes off-main-thread.

---

## 3. Interactive 128×64 Crop & Scale Bounding Box Tool

### 3.1 Geometric Constraints
- **Target Display Geometry**: $W_{target} = 128\text{ px}, H_{target} = 64\text{ px}$.
- **Aspect Ratio Constraint**: Exactly $2:1$ ($R = 2.0$).
- For any crop box of width $W_{crop}$ and height $H_{crop}$:
  $$W_{crop} = 2 \cdot H_{crop}$$
- Source coordinates bounds:
  $$0 \le X_{crop} \le W_{source} - W_{crop}$$
  $$0 \le Y_{crop} \le H_{source} - H_{crop}$$
  $$H_{crop} \le \min\left(H_{source}, \frac{W_{source}}{2}\right)$$

### 3.2 Preset Fit Modes
1. **Cover / Fill (2:1 Center Crop)**:
   - Maximizes crop rectangle to fill 2:1 area without any empty black borders.
   - For vertical reels (e.g. 9:16, 1080×1920):
     $$W_{crop} = W_{source} = 1080, \quad H_{crop} = \frac{1080}{2} = 540$$
     $$X_{crop} = 0, \quad Y_{crop} = \frac{1920 - 540}{2} = 690$$
2. **Contain / Letterbox**:
   - Scales entire source to fit within 128×64, adding letterbox (top/bottom) or pillarbox (left/right) black bars.
3. **Stretch**:
   - Bypasses aspect ratio preservation, mapping entire $W_{source} \times H_{source}$ to $128 \times 64$.
4. **Interactive Manual Pan & Scale**:
   - Center drag handles pan $(X_{crop}, Y_{crop})$.
   - 4 corner handles and 4 edge handles resize $W_{crop}, H_{crop}$ while maintaining $W_{crop} = 2 \cdot H_{crop}$.
   - Mouse wheel zoom adjusts scale centered at the cursor.

### 3.3 Downsampling & Resampling Filter
- High-quality bicubic/bilinear smoothing (`ctx.imageSmoothingQuality = 'high'`) for photographic video/reels.
- Pixel Art Toggle (`ctx.imageSmoothingEnabled = false`): nearest-neighbor downscaling for pixel art sources (Aseprite, Pico-8) to prevent blurry interpolated edges.

---

## 4. Dithering Algorithms & Image Processing Pipeline

The pipeline transforms an arbitrary RGBA image into an exact 1024-byte 1-bit monochrome XBMP buffer.

```
[RGBA Pixel (128x64)]
         │
         ▼
[Grayscale Luminance (BT.601)]
         │
         ▼
[Brightness & Contrast Adjustment]
         │
         ▼
[Optional Invert (B/W Flip)]
         │
         ▼
[Dithering Quantization (1-bit: 0 or 255)]
  ├── Atkinson Error Diffusion
  ├── Floyd-Steinberg Error Diffusion
  ├── Bayer Ordered (2x2, 4x4, 8x8)
  └── Simple Threshold Cutoff
         │
         ▼
[XBMP Packing: 1024 Bytes Row-Major, LSB-First]
```

### 4.1 Step 1: Grayscale Conversion (ITU-R BT.601)
For each pixel with color components $R, G, B \in [0, 255]$ and alpha $A \in [0, 255]$:
$$Y = 0.299 \cdot R + 0.587 \cdot G + 0.114 \cdot B$$
If alpha blending against black background:
$$Y = Y \cdot \left(\frac{A}{255}\right)$$

### 4.2 Step 2: Brightness & Contrast Adjustment
- Brightness slider $B \in [-100, 100]$ (normalized $B' = B \times 2.55$).
- Contrast slider $C \in [-100, 100]$ (normalized $C' = C \times 2.55$).
- Contrast adjustment factor:
  $$F = \frac{259 \cdot (C' + 255)}{255 \cdot (259 - C')}$$
- Adjusted luminance:
  $$Y' = \max\left(0, \min\left(255, F \cdot (Y - 128) + 128 + B'\right)\right)$$
- Inversion (if enabled):
  $$Y_{final} = 255 - Y'$$

### 4.3 Step 3: Dithering Algorithms Detailed

#### A. Simple Thresholding
- Parameter: Cutoff Threshold $T \in [0, 255]$ (default 128).
- Quantization rule:
  $$Q(x, y) = \begin{cases} 255 & \text{if } Y_{final}(x, y) \ge T \\ 0 & \text{if } Y_{final}(x, y) < T \end{cases}$$
- Use case: Clean vector logos, silhouette art, high-contrast text.

#### B. Floyd-Steinberg Dithering
- Error diffusion over a 16-divisor kernel.
- Diffusion matrix:
  ```
               (x, y)       (x+1, y)   [7/16]
   (x-1, y+1) [3/16]   (x, y+1)   [5/16]   (x+1, y+1) [1/16]
  ```
- Divisor: 16 ($7 + 3 + 5 + 1 = 16$). 100% of error is diffused.
- Algorithm:
  1. $V = pixels[y \cdot 128 + x]$.
  2. $Q = (V \ge 128) \ ? \ 255 : 0$.
  3. $e = V - Q$.
  4. Diffuse $e$:
     - $(x+1, y) \leftarrow + e \cdot \frac{7}{16}$
     - $(x-1, y+1) \leftarrow + e \cdot \frac{3}{16}$
     - $(x, y+1) \leftarrow + e \cdot \frac{5}{16}$
     - $(x+1, y+1) \leftarrow + e \cdot \frac{1}{16}$
- Use case: Photographic images, smooth gradients, video footage.

#### C. Atkinson Dithering
- Developed by Bill Atkinson for the original Apple Macintosh (MacPaint, 1984).
- Diffusion matrix:
  ```
               (x, y)       (x+1, y)   [1/8]   (x+2, y)   [1/8]
   (x-1, y+1) [1/8]    (x, y+1)   [1/8]   (x+1, y+1) [1/8]
                       (x, y+2)   [1/8]
  ```
- Divisor: 8. Total distributed error: $6 \times \frac{1}{8} = \frac{6}{8} = 75\%$.
- **Crucial Characteristic**: **25% of quantization error is discarded**. This intentional loss prevents error accumulation from creating gray worm noise in near-white and near-black regions, creating punchy, high-contrast stippling ideal for 1-bit OLED displays and pixel art.
- Algorithm:
  1. $V = pixels[y \cdot 128 + x]$.
  2. $Q = (V \ge 128) \ ? \ 255 : 0$.
  3. $e = \frac{V - Q}{8}$.
  4. Diffuse $e$ equally to 6 neighboring coordinates:
     $(x+1, y), (x+2, y), (x-1, y+1), (x, y+1), (x+1, y+1), (x, y+2)$.

#### D. Bayer Ordered Dithering (2×2, 4×4, 8×8)
- Threshold matrix dithering without error propagation.
- **Bayer 2×2**:
  $$M_2 = \begin{bmatrix} 0 & 2 \\ 3 & 1 \end{bmatrix}$$
  Threshold: $T_2(x, y) = \frac{M_2[y \bmod 2][x \bmod 2] + 0.5}{4} \times 255$
- **Bayer 4×4**:
  $$M_4 = \begin{bmatrix}
  0 & 8 & 2 & 10 \\
  12 & 4 & 14 & 6 \\
  3 & 11 & 1 & 9 \\
  15 & 7 & 13 & 5
  \end{bmatrix}$$
  Threshold: $T_4(x, y) = \frac{M_4[y \bmod 4][x \bmod 4] + 0.5}{16} \times 255$
- **Bayer 8×8**:
  $$M_8 = \begin{bmatrix}
   0 & 32 &  8 & 40 &  2 & 34 & 10 & 42 \\
  48 & 16 & 56 & 24 & 50 & 18 & 58 & 26 \\
  12 & 44 &  4 & 36 & 14 & 46 &  6 & 38 \\
  60 & 28 & 52 & 20 & 62 & 30 & 54 & 22 \\
   3 & 35 & 11 & 43 &  1 & 33 &  9 & 41 \\
  51 & 19 & 59 & 27 & 49 & 17 & 57 & 25 \\
  15 & 47 &  7 & 39 & 13 & 45 &  5 & 37 \\
  63 & 31 & 55 & 23 & 61 & 29 & 53 & 21
  \end{bmatrix}$$
  Threshold: $T_8(x, y) = \frac{M_8[y \bmod 8][x \bmod 8] + 0.5}{64} \times 255$
- Rule: $Q(x, y) = (Y_{final}(x, y) > T_N(x, y)) \ ? \ 255 : 0$.
- **Temporal Stability Advantage**: Ordered dithering produces zero temporal flicker or crawling noise across animation frames because each pixel is evaluated independently against a static coordinate grid.

---

### 4.4 Step 4: 1-Bit XBMP Row-Major Bit Packing

- **Target Format**: X11 Bitmap (XBMP), strictly verified against U8g2 `u8g2.drawXBMP(0, 0, 128, 64, data)` and `convert_reel.py`.
- **Dimensions**: 128 columns $\times$ 64 rows.
- **Bytes Per Row**: $128 / 8 = 16\text{ bytes}$.
- **Total Frame Bytes**: $16 \times 64 = 1,024\text{ bytes}$ ($1\text{ KB}$).
- **Row-Major Memory Layout**:
  - Row 0: Bytes 0 through 15
  - Row 1: Bytes 16 through 31
  - Row $y$: Bytes $(y \cdot 16)$ through $(y \cdot 16 + 15)$
  - Row 63: Bytes 1008 through 1023
- **Bit-Ordering (LSB-First)**:
  - Inside each byte:
    - Bit 0 (`0x01`): Pixel at $x = \text{byteX} \cdot 8 + 0$ (Leftmost)
    - Bit 1 (`0x02`): Pixel at $x = \text{byteX} \cdot 8 + 1$
    - Bit 2 (`0x04`): Pixel at $x = \text{byteX} \cdot 8 + 2$
    - Bit 3 (`0x08`): Pixel at $x = \text{byteX} \cdot 8 + 3$
    - Bit 4 (`0x10`): Pixel at $x = \text{byteX} \cdot 8 + 4$
    - Bit 5 (`0x20`): Pixel at $x = \text{byteX} \cdot 8 + 5$
    - Bit 6 (`0x40`): Pixel at $x = \text{byteX} \cdot 8 + 6$
    - Bit 7 (`0x80`): Pixel at $x = \text{byteX} \cdot 8 + 7$ (Rightmost)
  - Bit value: `1` = White / Lit Pixel; `0` = Black / Unlit Pixel.
- **Reference Implementation in TypeScript**:
  ```typescript
  export function packXBMP(quantizedPixels: Uint8Array, width = 128, height = 64): Uint8Array {
    const bytesPerRow = width >> 3; // 16 bytes
    const xbmp = new Uint8Array(bytesPerRow * height); // 1024 bytes
    
    for (let y = 0; y < height; y++) {
      const rowOffset = y * bytesPerRow;
      const pixelRowOffset = y * width;
      for (let bx = 0; bx < bytesPerRow; bx++) {
        let byteVal = 0;
        const xStart = bx << 3;
        for (let b = 0; b < 8; b++) {
          if (quantizedPixels[pixelRowOffset + xStart + b] > 0) {
            byteVal |= (1 << b); // LSB first
          }
        }
        xbmp[rowOffset + bx] = byteVal;
      }
    }
    return xbmp;
  }
  ```

---

## 5. Simulated 128×64 OLED Canvas Player

### 5.1 Physical OLED Visual Emulation
To give users an authentic preview matching physical SSD1306/SH1106 displays:
1. **Pixel Pitch & Sub-pixel Grid**:
   - Physical OLEDs have distinct emitter pads with dark interstitial spacing.
   - Canvas resolution: $512 \times 256$ (4× scale factor) or $768 \times 384$ (6× scale factor).
   - Render lit pixel as a filled rect of size $(\text{scale} - 1, \text{scale} - 1)$ at $(x \cdot \text{scale}, y \cdot \text{scale})$, leaving a 1px true-black grid line.
   - Render unlit pixels with faint `#0a0e14` phosphor pads to emulate ambient light reflection on unlit pixels.
2. **Phosphor Color Palettes**:
   - **Classic Cyan**: Lit `#00f0ff`, Bloom `#00f0ff33`.
   - **Crisp White**: Lit `#ffffff`, Bloom `#ffffff33`.
   - **Yellow/Blue Dual Display**:
     - Rows 0–15: Lit `#ffcc00` (Amber Yellow).
     - Row 16: Unlit black spacer.
     - Rows 17–63: Lit `#00e5ff` (Sky Blue).
   - **Amber / Orange**: Lit `#ffb000`, Bloom `#ffb00033`.
   - **Matrix Green**: Lit `#00ff66`, Bloom `#00ff6633`.
3. **Hardware Bezel Overlay**:
   - Screen glass gloss gradient overlay.
   - Dark PCB border with printed silkscreen labels: `[ GND ] [ VCC ] [ SCL ] [ SDA ]`.

### 5.2 Animation Playback Engine
- Accurate frame interval tracking using delta-time accumulation via `requestAnimationFrame`:
  ```typescript
  let lastTime = performance.now();
  let accumulator = 0;
  
  function tick(currentTime: number) {
    const delta = currentTime - lastTime;
    lastTime = currentTime;
    accumulator += delta;
    
    const interval = 1000 / targetFps;
    while (accumulator >= interval) {
      currentFrame = (currentFrame + 1) % totalFrames;
      accumulator -= interval;
      renderOLED(currentFrame);
    }
    requestAnimationFrame(tick);
  }
  ```
- **Player Controls**:
  - Play / Pause (toggle button & Space key).
  - Scrub Bar (`<input type="range">`) with instant frame seek.
  - Step Backward / Forward (1 frame step, Left / Right arrow keys).
  - FPS Selector: 15, 20, 24, 30 FPS presets.
  - Loop Mode Toggle: Continuous Loop vs Play Once vs Ping-Pong.
  - Status display: `Frame {currentFrame + 1} / {totalFrames} | {time}s | {totalKB} KB`.

---

## 6. Component Hierarchy, State Management & Performance Architecture

### 6.1 React Component Hierarchy
```
<App>
├── <StudioHeader>
│   ├── <ProjectTitle>
│   ├── <WebSerialIndicator>
│   └── <QuickExportButtons>
│
├── <StudioLayout>
│   ├── <LeftPanel: Media & Crop Workspace>
│   │   ├── <DropZone>
│   │   ├── <SourceViewer>
│   │   │   ├── <VideoOrCanvasSource>
│   │   │   └── <InteractiveCropBox> (2:1 aspect lock, handles)
│   │   ├── <PresetAspectBar> (Fill/Cover, Contain, Stretch)
│   │   └── <VideoScrubberTrim> (In/Out markers)
│   │
│   ├── <CenterPanel: Dither & Image Adjustments>
│   │   ├── <DitherModeSelector> (Atkinson, Floyd-Steinberg, Bayer 2x2/4x4/8x8, Threshold)
│   │   ├── <SliderControls>
│   │   │   ├── <BrightnessSlider> (-100 to +100)
│   │   │   ├── <ContrastSlider> (-100 to +100)
│   │   │   ├── <ThresholdSlider> (0 to 255)
│   │   │   └── <InvertToggle> (Boolean)
│   │   └── <DownsampleModeToggle> (Bicubic vs Nearest-Neighbor)
│   │
│   └── <RightPanel: Simulated OLED & Player>
│       ├── <OLEDBezelFrame>
│       │   ├── <OLEDCanvasPlayer> (128x64 display with phosphor themes)
│       │   └── <SilkscreenPinHeaders>
│       ├── <PlayerControls> (Play, Pause, Step Prev/Next, Loop, FPS 15-30)
│       ├── <TimelineScrubber>
│       └── <FrameMetricsBadge> (Frames, Size, FPS)
│
└── <Modals>
    ├── <CppExportModal> (PROGMEM frames.h preview, copy, download)
    └── <WebSerialStreamModal> (Live baud 115200 hardware streaming)
```

### 6.2 State Management Strategy
To avoid lag, state must be bifurcated into:
1. **Low-frequency React State**:
   - `file`: Current loaded file metadata.
   - `crop`: `{ x, y, width, height, fitMode }`.
   - `ditherConfig`: `{ algorithm, brightness, contrast, threshold, invert, theme }`.
   - `fps`: Target frame rate (15–30).
2. **High-frequency Direct-Ref State (Zero React Re-render)**:
   - `currentFrameIndex`: Ref-driven animation loop. Canvas updates directly using `canvasRef.current.getContext('2d')`.
   - Scrub slider uses decoupled local state or `requestAnimationFrame` throttled updates.

### 6.3 Real-Time Performance & Web Worker Pipeline
1. **Single-Frame Instant Preview**:
   - When a user moves the Brightness slider, only the *active displayed frame* is dithered synchronously (<0.4 ms execution time).
   - This provides fluid 60 FPS slider response without any UI hitching.
2. **Asynchronous Web Worker Batch Processing**:
   - Batch conversion of all $N$ frames is offloaded to a Web Worker (`dither.worker.ts`).
   - Transferable Objects (`postMessage({ buffer }, [buffer])`) eliminate memory cloning overhead.
   - Worker streams progress percentage back to main thread (`onProgress(percent)`).

---

## 7. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Input | MP4 / WebM Drag-Drop | Client-side video decoding via HTML5 video element and offscreen canvas | `.mp4`, `.webm` File blob | Array of raw/intermediate frames | `MediaError` shown in dropzone UI if codec unsupported | `ORIGINAL_REQUEST.md` R1 |
| 2 | Input | Animated GIF Ingestion | Multi-frame GIF89a decoding with disposal modes and delay handling | `.gif` File blob | Frame array with individual timestamps | Corrupt header displays warning alert | `ORIGINAL_REQUEST.md` R1 & Creator research |
| 3 | Input | PNG Frame Sequence | Batch upload of individual animation frames with natural collation | Multiple `.png` / `.jpg` files | Sequentially ordered frame array | Non-image files ignored with toast notification | `ORIGINAL_REQUEST.md` R1 |
| 4 | Crop/Scale | 2:1 Aspect Ratio Lock | Interactive bounding box preserving 128×64 (2:1) display proportion | Mouse drag/handle coordinates | Scaled crop sub-rectangle `(x, y, w, h)` | Clamped to bounds `[0, W_src]`, `[0, H_src]` | `ORIGINAL_REQUEST.md` R1 & `convert_reel.py` |
| 5 | Crop/Scale | Fit Presets | One-click bounding box presets: Cover (Center Fill), Contain, Stretch | Preset button click | Automated crop coordinates | Falls back to Cover if aspect undefined | `convert_reel.py` line 54-69 |
| 6 | Dithering | Brightness & Contrast | Pre-dithering luminance scaling and contrast curve adjustment | Brightness `[-100, 100]`, Contrast `[-100, 100]` | Adjusted 8-bit grayscale array | Values clamped to `[0, 255]` | `ORIGINAL_REQUEST.md` R1 |
| 7 | Dithering | Atkinson Algorithm | 6-neighbor error diffusion kernel with 25% error discard (divisor 8) | 8-bit luminance array | 1-bit quantized pixel array | Boundary checks prevent buffer overflow | MacPaint 1984 / Aseprite spec |
| 8 | Dithering | Floyd-Steinberg Algorithm | 4-neighbor classic error diffusion kernel (divisor 16) | 8-bit luminance array | 1-bit quantized pixel array | Boundary checks prevent edge bleeding | `convert_reel.py` line 100 |
| 9 | Dithering | Bayer Matrix (2×2, 4×4, 8×8) | Deterministic ordered spatial threshold matrices | Matrix size toggle (2, 4, 8) | 1-bit quantized pixel array | Coordinate modulo `x % N, y % N` | Bayer 1973 spec |
| 10 | Dithering | Simple Thresholding | Binary cutoff thresholding with adjustable cutoff value | Cutoff `[0, 255]` | 1-bit quantized pixel array | Clamped cutoff `[0, 255]` | `convert_reel.py` line 96 |
| 11 | Quantization | XBMP 1024-Byte Packing | Row-major, 16 bytes/row, LSB-first bit packing for U8g2 `drawXBMP` | 1-bit 128×64 pixel buffer | `Uint8Array(1024)` | Invalid array size throws RangeError | `convert_reel.py` line 7-33 & U8g2 spec |
| 12 | Player | Simulated OLED Canvas | High-contrast 128×64 visual canvas with sub-pixel grid spacing | `Uint8Array(1024)` frame | Rendered 2D canvas | Render skip if buffer null | `ORIGINAL_REQUEST.md` R1 |
| 13 | Player | Phosphor Color Themes | Classic Cyan, Yellow/Blue two-tone, Crisp White, Amber, Matrix Green | Theme selector | Canvas fill styles & bloom filters | Defaults to Classic Cyan | Hardware SSD1306 spec |
| 14 | Player | Playback Engine | Play/pause, frame step, loop modes, FPS selector (15–30 FPS) | User controls, keyboard shortcuts | Active frame updates via rAF loop | Clamped to frame range `[0, total-1]` | `ORIGINAL_REQUEST.md` R1 & `main.cpp` |
| 15 | Performance | Web Worker Pipeline | Off-thread batch frame processing and transferable array buffers | Batch frame data | Processed XBMP byte arrays | Fallback to main-thread processing | Web Workers API spec |

---

## 8. Edge Cases

| # | Feature | Input | Observed Behavior / Specification Requirement |
|---|---------|-------|-----------------------------------------------|
| 1 | MP4 Decoding | Extremely large 4K video (3840×2160, 60 FPS) | Direct extraction of raw 4K ImageData crashes memory; MUST downsample during `ctx.drawImage` to $\le 256\times 128$ intermediate canvas. |
| 2 | GIF Ingestion | GIF with Disposal Method 3 (Restore to Previous) | Standard blitting corrupts animation; decoder must cache previous frame canvas snapshot and restore before drawing current frame. |
| 3 | GIF Ingestion | GIF with variable inter-frame delays (e.g. 50ms, then 200ms) | Target video player runs at fixed FPS (e.g. 30 FPS); decoder must resample/interpolate GIF frames onto fixed time quanta. |
| 4 | PNG Sequence | Files named `frame_1.png`, `frame_10.png`, `frame_2.png` | Standard JS sort places `frame_10` before `frame_2`; must use natural alphanumeric collation (`localeCompare` with `numeric: true`). |
| 5 | Crop Tool | User resizes crop box past image boundary | Clamping logic must halt expansion at `x + w > W_src` or `y + h > H_src` while strictly preserving the 2:1 aspect ratio. |
| 6 | Crop Tool | Square 1:1 image or ultra-tall 9:16 vertical video | 2:1 crop rectangle default Cover must center vertically: $Y_{crop} = (H_{src} - W_{src}/2) / 2$. |
| 7 | Dithering | Contrast slider at maximum (+100) | $C' = 255$, denominator in contrast equation $(259 - C')$ approaches 4; factor $F$ exceeds 32; pixel values must be rigorously clamped to $[0, 255]$. |
| 8 | Error Diffusion | Bright pixels at bottom and right edges of 128×64 | Error distributed to $(x+1, y)$, $(x-1, y+1)$, $(x, y+1)$, $(x+1, y+1)$ would cause out-of-bounds array access; boundary checks $x < 127$ and $y < 63$ mandatory. |
| 9 | Atkinson Dithering | Diffusion to $(x+2, y)$ and $(x, y+2)$ | Atkinson reaches 2 pixels ahead/down; requires checks for $x < 126$ and $y < 62$. |
| 10 | XBMP Packing | Image dimensions not multiple of 8 | If source resolution is odd, packing corrupts alignment; since OLED is strictly 128×64 ($128 / 8 = 16$), strict assertion on width = 128 is enforced. |
| 11 | OLED Player | Yellow/Blue dual display mode | Pixels on rows 0–15 must be rendered yellow (`#ffcc00`); row 16 must be forced unlit (black spacer); rows 17–63 rendered blue (`#00e5ff`). |
| 12 | Playback Loop | Background tab throttling | Browser throttles `requestAnimationFrame` to 1 Hz when tab is inactive; delta-time accumulator must discard delta if $\Delta t > 1000\text{ ms}$ to prevent animation rapid-catchup storm upon tab focus. |
