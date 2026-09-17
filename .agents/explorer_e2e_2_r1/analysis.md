# Comprehensive E2E Test Specifications & Inventory: Tier 1 (Feature Coverage) & Tier 2 (Boundary & Corner Cases)

**Project Root**: `D:\espprojects\oled`  
**Author**: Explorer Agent `explorer_e2e_2_r1`  
**Date**: 2026-09-18  
**Scope**: Tier 1 (All 27 Features F01–F27, $\ge 5$ tests each = 135 tests) & Tier 2 (Boundary & Corner Cases for All 27 Features, $\ge 5$ tests each = 135 tests). Total: **270 Test Cases**.  
**Authority**: `D:\espprojects\oled\.agents\ORIGINAL_REQUEST.md`, `D:\espprojects\oled\PROJECT.md`, `D:\espprojects\oled\.agents\sub_orch_e2e\BRIEFING.md`, Survey Reports 1, 2, 3.

---

## Executive Summary

This document establishes the definitive test specification and test case inventory for **Tier 1 (Feature Coverage)** and **Tier 2 (Boundary & Corner Cases)** of the OLED Visual Animation Engine & Converter project. 

The test suite enforces strict **opaque-box requirement verification**: every test evaluates externally observable outputs (file contents, binary packet streams, pixel array buffers, HTTP/CLI return codes, and UI state signals) against formal requirement oracles without depending on internal implementation private variables.

### Coverage Summary
- **Features Covered**: 100% of Features **F01 through F27** in `PROJECT.md`.
- **Tier 1 Test Cases**: Exactly **135 test cases** (5 test cases per feature across 27 features).
- **Tier 2 Test Cases**: Exactly **135 test cases** (5 test cases per feature across 27 features).
- **Total Test Cases Specified**: **270 Test Cases**.

---

## 1. Test Specification Architecture & Methodology

### 1.1 Opaque-Box Assertion Philosophy
All tests in this inventory are designed to execute against public interfaces and observable side-effects:
1. **Engine Layer**: Direct invocation of public converter, dithering, and packing functions using pure byte/pixel buffer fixtures.
2. **Protocol Layer**: Feeding serialized byte streams into parser state machines or WebSerial mock interfaces and asserting exact response tokens (`0x06 ACK`, `0x15 NAK`) and frame buffer layouts.
3. **Exporter Layer**: Compiling generated C++ headers (`src/frames.h`, `frames_rle.h`) using PlatformIO / GCC and asserting zero syntax errors and exact memory footprints.
4. **UI / Application Layer**: Simulating drag-drop events, slider value changes, button triggers, and evaluating DOM render trees and canvas context pixel data.

### 1.2 Test Case Schema
Each test case is specified with the following six mandatory attributes:
- **Test ID**: Unique deterministic identifier format:
  - `T1-Fxx-yy`: Tier 1, Feature `xx`, Case `yy`
  - `T2-Fxx-yy`: Tier 2, Feature `xx`, Case `yy`
- **Feature #**: Feature identifier matching `PROJECT.md` (`F01` to `F27`).
- **Test Name**: Concise descriptive summary of the scenario.
- **Input**: Exact input parameters, synthetic data fixtures, file blobs, or interface signals.
- **Verification Mechanism**: The concrete assertion logic, verification oracle formula, or automated check.
- **Expected Output**: Deterministic expected output, byte pattern, buffer length, exit code, or error signal.

---

## 2. Tier 1: Feature Coverage Test Inventory (F01 – F27)

### F01: Web Studio Project Setup (M1)
*Vite + React + TypeScript + Tailwind CSS structure in `web/`.*

| Test ID | Feature # | Test Name | Input | Verification Mechanism | Expected Output |
|---|---|---|---|---|---|
| `T1-F01-01` | F01 | Web Scaffold Configuration Integrity | Inspect `web/package.json`, `web/vite.config.ts`, `web/tsconfig.json`, `web/index.html` | Automated file existence assertion and JSON parse validation of dependency keys (`react`, `react-dom`, `tailwindcss`, `vite`, `typescript`) | All 4 configuration files exist; JSON valid; scripts include `"dev"`, `"build"`, and `"preview"`. |
| `T1-F01-02` | F01 | Production Bundle Compilation | Run `npm run build` inside `web/` directory | Execute build CLI process; capture exit code and check contents of `web/dist/` | Exit code 0; `web/dist/index.html` generated; CSS bundle and JS chunk generated without compile errors. |
| `T1-F01-03` | F01 | Tailwind CSS Compilation & Styling | Build output CSS inspection for custom OLED color variables | Scan compiled CSS for phosphor color hex values (`#00f0ff`, `#ffcc00`, `#00ff66`, `#ffb000`) and grid gap utility classes | Compiled CSS contains OLED custom theme palette and utility classes; zero unparsed `@tailwind` directives. |
| `T1-F01-04` | F01 | TypeScript Strict Type Checking | Run `npx tsc --noEmit` inside `web/` directory | Execute TypeScript compiler CLI process; verify exit code and stdout/stderr | Exit code 0; zero type diagnostic errors reported across all `.ts` and `.tsx` source files. |
| `T1-F01-05` | F01 | Root DOM Mount & App Initialization | Headless browser navigation to Vite preview server `http://localhost:4173` | DOM selector assertion for `#root` element and primary studio panels (DropZone, DitherControls, OledCanvas) | Root container mounted; `DropZone`, `CropTool`, `DitherControls`, `OledCanvas`, `TimelineControls` rendered without runtime console errors. |

---

### F02: Video Drag & Drop Decoder (M1)
*Decode MP4 & WebM files client-side using HTML5 Video + Offscreen Canvas.*

| Test ID | Feature # | Test Name | Input | Verification Mechanism | Expected Output |
|---|---|---|---|---|---|
| `T1-F02-01` | F02 | Standard MP4 Container Ingestion | File blob: `igexport-DckvRqKPsI_.mp4` (720×1280, 466 frames, 30 FPS) | Ingest file into `mediaDecoder.loadVideo()`; assert metadata extraction properties | Returns metadata object: `duration` $\approx 15.53\text{s}$, `width: 720`, `height: 1280`, `fps: 30`, `estimatedFrames: 466`. |
| `T1-F02-02` | F02 | WebM Container Ingestion | Synthetic VP8/VP9 WebM file blob (640×360, 60 frames, 30 FPS) | Load into `mediaDecoder.loadVideo()`; verify video element readiness and playback duration | Video element reaches `HAVE_ENOUGH_DATA` (readyState 4); returns `duration: 2.0s`, `width: 640`, `height: 360`. |
| `T1-F02-03` | F02 | Discrete Time-Slice Frame Extraction | Video file loaded; extract 5 frames at $t = [0.0, 0.5, 1.0, 1.5, 2.0]\text{s}$ | Sequential seek (`video.currentTime = t`); capture offscreen canvas `getImageData()` | 5 distinct `ImageData` instances returned; each buffer has non-zero byte variance; dimensions match source resolution. |
| `T1-F02-04` | F02 | Downsampling Frame Buffer Allocation | 1080×1920 video extraction to target canvas coordinates | Extract frame via `ctx.drawImage(video, 0, 0, 128, 64)`; inspect returned `ImageData` size | Frame data length is exactly $128 \times 64 \times 4 = 32,768$ bytes (intermediate raw memory $\le 33\text{ KB}$ per frame). |
| `T1-F02-05` | F02 | Non-Video MIME Type Rejection | Synthetic file: `document.pdf` (MIME `application/pdf`) passed to video decoder | Call `mediaDecoder.loadVideo(file)`; catch rejection | Rejection promise caught with `Error: Unsupported media format. Please upload MP4, WebM, GIF, or PNG sequence.` |

---

### F03: Animated GIF Decoder (M1)
*Extract frames, delays, and disposal modes from GIFs using `omggif`.*

| Test ID | Feature # | Test Name | Input | Verification Mechanism | Expected Output |
|---|---|---|---|---|---|
| `T1-F03-01` | F03 | GIF89a Header Parsing & Frame Counting | Synthetic GIF89a binary buffer with 10 animated frames | Instantiate `GifReader(buffer)`; query `reader.numFrames()` and `reader.width, reader.height` | `numFrames` returns 10; width and height match GIF logical screen descriptor headers. |
| `T1-F03-02` | F03 | GIF Disposal Mode 1 (Leave in Place) | GIF frames with `disposal: 1`; overlaying partial sub-rectangles | Call `decodeAndBlitFrameRGBA()` sequentially across frames onto accumulator canvas; sample background pixels | Unmodified background pixels outside sub-rect retain pixel values from previous frames (cumulative overlay). |
| `T1-F03-03` | F03 | GIF Disposal Mode 2 (Restore to Background) | GIF frames with `disposal: 2`; sub-rectangle graphic on black background | Decode frame with disposal 2 followed by next frame; sample sub-rectangle area prior to second draw | Canvas clears sub-rectangle to background (transparent/black) before subsequent frame blit. |
| `T1-F03-04` | F03 | GIF Disposal Mode 3 (Restore to Previous) | 3-frame GIF: Frame 1 base, Frame 2 with `disposal: 3`, Frame 3 overlay | Compare canvas state after Frame 3 with Frame 1 snapshot outside Frame 3 bounds | Canvas state reverts to exact snapshot of Frame 1 before rendering Frame 3. |
| `T1-F03-05` | F03 | Frame Delay Extraction & FPS Mapping | GIF with alternating 50ms (delay 5) and 100ms (delay 10) headers | Extract `frameInfo(i).delay`; map to playback timestamps | Returns delays `[50, 100, 50, 100]`; cumulative animation duration equals sum of delays (300ms). |

---

### F04: PNG Sequence Loader (M1)
*Multi-file loader with alphanumeric natural sorting (`localeCompare`).*

| Test ID | Feature # | Test Name | Input | Verification Mechanism | Expected Output |
|---|---|---|---|---|---|
| `T1-F04-01` | F04 | Batch Multi-File Ingestion | Array of 20 synthetic PNG file objects | Pass file array to `mediaDecoder.loadPngSequence()`; count extracted frames | Exactly 20 distinct frame objects created with sequential indices `0` through `19`. |
| `T1-F04-02` | F04 | Natural Alphanumeric Sorting | Unordered file names: `['frame_10.png', 'frame_1.png', 'frame_2.png', 'frame_20.png', 'frame_3.png']` | Apply sorting function: `files.sort((a,b) => a.name.localeCompare(b.name, undefined, { numeric: true }))` | Sorted order strictly: `['frame_1.png', 'frame_2.png', 'frame_3.png', 'frame_10.png', 'frame_20.png']`. |
| `T1-F04-03` | F04 | Mixed Image Format Batch Ingestion | Array containing 3 `.png`, 3 `.jpg`, 2 `.webp` images | Process through `loadPngSequence()`; verify rasterization | All 8 files successfully decoded and normalized to RGBA `ImageData` array. |
| `T1-F04-04` | F04 | Asynchronous ImageBitmap Decoding | Batch of 10 PNG files passed to `createImageBitmap()` pipeline | Measure async completion and inspect returned bitmap widths/heights | All 10 bitmaps resolved; each `ImageBitmap` instance has valid positive `width` and `height`. |
| `T1-F04-05` | F04 | Mixed Media Non-Image Filtering | File list containing 5 PNGs and 2 non-image files (`data.json`, `notes.txt`) | Ingest file array; observe filtered output list and toast warning | 5 PNG frames loaded into sequence; non-image files filtered out; warning emitted: `"2 non-image files skipped"`. |

---

### F05: Interactive 2:1 Crop & Scale (M1)
*Fixed 2:1 aspect ratio bounding box with Cover, Contain, Stretch presets.*

| Test ID | Feature # | Test Name | Input | Verification Mechanism | Expected Output |
|---|---|---|---|---|---|
| `T1-F05-01` | F05 | Strict 2:1 Aspect Ratio Enforcement | User resizes crop box width to arbitrary $W = 500\text{px}$ | Calculate height: $H = W / 2.0$; assert equality | $H$ strictly equals $250\text{px}$ ($W / H = 2.0$ exactly). |
| `T1-F05-02` | F05 | Cover / Fill Preset Geometry (9:16 Source) | Source dimension: $720 \times 1280$; trigger "Cover" preset | Compute center crop rectangle $(X, Y, W, H)$ | $W = 720$, $H = 360$, $X = (720 - 720)/2 = 0$, $Y = (1280 - 360)/2 = 460$. |
| `T1-F05-03` | F05 | Contain / Letterbox Preset Geometry | Source dimension: $800 \times 800$ (1:1 square); trigger "Contain" preset | Render to $128 \times 64$ canvas; inspect letterbox padding | Scaled image occupies $64 \times 64$ centered at $(32, 0)$; pillarbox black bars at $x \in [0, 31]$ and $x \in [96, 127]$. |
| `T1-F05-04` | F05 | Stretch Preset Geometry | Source dimension: $1920 \times 1080$ (16:9); trigger "Stretch" preset | Map source bounds $(0, 0, 1920, 1080)$ directly to target $(0, 0, 128, 64)$ | Scaled width is 128, height is 64; zero letterbox padding. |
| `T1-F05-05` | F05 | Resampling Filter Quality Toggle | Scale down high-res checkerboard; toggle `imageSmoothingEnabled` (true vs false) | Sample edge pixel gradients on output canvas | `true` produces multi-level gray interpolated anti-aliased edge; `false` produces binary nearest-neighbor pixel step. |

---

### F06: Brightness & Contrast Control (M2)
*Real-time luminance adjustments prior to quantization.*

| Test ID | Feature # | Test Name | Input | Verification Mechanism | Expected Output |
|---|---|---|---|---|---|
| `T1-F06-01` | F06 | ITU-R BT.601 Grayscale Conversion | Pure red pixel $(255, 0, 0)$, green $(0, 255, 0)$, blue $(0, 0, 255)$ | Compute $Y = 0.299R + 0.587G + 0.114B$; compare with engine output | Red $Y = 76.245 \approx 76$, Green $Y = 149.685 \approx 150$, Blue $Y = 29.07 \approx 29$. |
| `T1-F06-02` | F06 | Linear Brightness Boost Adjustment | Neutral gray pixel $Y = 100$; Brightness slider $B = +50$ ($B' = 50 \times 2.55 = 127.5$) | Compute $Y' = \text{clamp}(Y + B', 0, 255)$ | $Y' = \text{round}(100 + 127.5) = 228$. |
| `T1-F06-03` | F06 | Dynamic Contrast Factor Adjustment | Contrast slider $C = +50$ ($C' = 127.5$); test pixels $Y_1 = 64, Y_2 = 192$ | Factor $F = \frac{259(127.5 + 255)}{255(259 - 127.5)} \approx 2.975$; compute $Y' = \text{clamp}(F(Y - 128) + 128, 0, 255)$ | $Y'_1 = \text{clamp}(2.975(64 - 128) + 128) = 0$; $Y'_2 = \text{clamp}(2.975(192 - 128) + 128) = 255$. |
| `T1-F06-04` | F06 | Extreme Luminance Range Clamping | Input pixels $Y \in [0, 255]$; Brightness $+100$, Contrast $+100$ | Run full frame adjustment; assert $\min(Y')$ and $\max(Y')$ across all pixels | $\min(Y') \ge 0$ and $\max(Y') \le 255$; zero integer overflow or NaN values. |
| `T1-F06-05` | F06 | Monochrome Invert Toggle | Input luminance array $Y = [0, 50, 128, 200, 255]$; Invert = `true` | Compute $Y_{final} = 255 - Y$; compare with engine output | $Y_{final} = [255, 205, 127, 55, 0]$. |

---

### F07: Atkinson Dithering (M2)
*6-neighbor error diffusion (divisor 8, 75% error diffused, 25% discarded).*

| Test ID | Feature # | Test Name | Input | Verification Mechanism | Expected Output |
|---|---|---|---|---|---|
| `T1-F07-01` | F07 | 6-Neighbor Kernel Diffusion Distribution | Single pixel at $(10, 10)$ with initial value $Y = 136$ ($Q = 255, e = -119, \lfloor e/8 \rfloor = -14$); surrounding pixels 0 | Run Atkinson algorithm; measure pixel values at target neighbor coordinates | Neighbors $(11, 10), (12, 10), (9, 11), (10, 11), (11, 11), (10, 12)$ each receive exactly $-14$. |
| `T1-F07-02` | F07 | 25% Intentional Error Loss Verification | Sum total error injected vs sum total error diffused for a test pixel $e = 80$ | Compute error diffused: $6 \times (80 / 8) = 60$; compute discarded error: $80 - 60 = 20$ | Diffused error is exactly $75\%$ ($60/80$); discarded error is exactly $25\%$ ($20/80$). |
| `T1-F07-03` | F07 | 1-Bit Binary Quantization Invariant | Continuous smooth linear gradient ($0 \dots 255$) across $128 \times 64$ canvas | Apply Atkinson dithering; check output pixel array values | Every single pixel in the output array is strictly either `0` or `255`; zero intermediate values. |
| `T1-F07-04` | F07 | Clean Background Worm Suppression | High-key image with near-white background ($Y = 250$) | Run Atkinson vs Floyd-Steinberg; count isolated black pixels | Atkinson produces zero black worm artifacts in $Y > 248$ regions due to $25\%$ error discard. |
| `T1-F07-05` | F07 | Canvas Edge Diffusion Boundary Guard | White pixel at bottom-right corner $(127, 63)$ | Run Atkinson; verify no buffer overflow or out-of-bounds memory write to $(x+1, y)$ or $(x, y+1)$ | Process completes without runtime exception; array length remains exactly $128 \times 64 = 8192$ bytes. |

---

### F08: Floyd-Steinberg Dithering (M2)
*4-neighbor error diffusion (divisor 16, 100% error diffused).*

| Test ID | Feature # | Test Name | Input | Verification Mechanism | Expected Output |
|---|---|---|---|---|---|
| `T1-F08-01` | F08 | 4-Neighbor Kernel Diffusion Weights | Test pixel at $(10, 10)$ with value $Y = 144$ ($Q = 255, e = -112$); surrounding pixels 0 | Run Floyd-Steinberg; inspect neighbor offsets $(x+1, y)$, $(x-1, y+1)$, $(x, y+1)$, $(x+1, y+1)$ | Offsets receive: $(11, 10) \leftarrow -112 \times 7/16 = -49$; $(9, 11) \leftarrow -112 \times 3/16 = -21$; $(10, 11) \leftarrow -112 \times 5/16 = -35$; $(11, 11) \leftarrow -112 \times 1/16 = -7$. |
| `T1-F08-02` | F08 | 100% Total Error Conservation | Measure sum of diffused error across all 4 neighbors for $e = -112$ | Sum: $(-49) + (-21) + (-35) + (-7)$ | Sum equals exactly $-112$ ($100\%$ error conserved; 0 error discarded). |
| `T1-F08-03` | F08 | Smooth Gradient Monotonic Stipple Density | Linear gradient from $x = 0$ ($Y=0$) to $x = 127$ ($Y=255$) | Partition output into 8 vertical column slices of width 16; count lit pixels per slice | Lit pixel count increases monotonically across slices: $S_0 < S_1 < S_2 < S_3 < S_4 < S_5 < S_6 < S_7$. |
| `T1-F08-04` | F08 | Deterministic Output Consistency | Synthetic $128 \times 64$ test image dithered across 10 independent runs | Compute SHA-256 hash of output quantized pixel array for each run | All 10 hashes are bit-for-bit identical (zero non-deterministic jitter). |
| `T1-F08-05` | F08 | Left/Right Perimeter Damping Guard | High luminance pixels along column $x = 0$ and column $x = 127$ | Run Floyd-Steinberg; assert bounds on memory buffer | Left boundary suppresses $(x-1, y+1)$ without negative indexing; right boundary suppresses $(x+1, y)$ and $(x+1, y+1)$. |

---

### F09: Bayer Ordered Dithering (M2)
*2×2, 4×4, and 8×8 threshold matrix dithering for flicker-free playback.*

| Test ID | Feature # | Test Name | Input | Verification Mechanism | Expected Output |
|---|---|---|---|---|---|
| `T1-F09-01` | F09 | Bayer 2×2 Matrix Threshold Verification | Matrix $M_2 = \begin{bmatrix} 0 & 2 \\ 3 & 1 \end{bmatrix}$; normalized thresholds: $[31.875, 159.375, 223.125, 95.625]$; test pixel $Y = 100$ | Run Bayer 2x2 on $2 \times 2$ patch; compare output bits with $Y > T_2(x, y)$ | Output: $(0,0) \rightarrow 255$; $(1,0) \rightarrow 0$; $(0,1) \rightarrow 0$; $(1,1) \rightarrow 255$. |
| `T1-F09-02` | F09 | Bayer 4×4 Crosshatch Pattern Generation | Uniform gray image $Y = 128$; Bayer 4x4 matrix selected | Count lit pixels in any $4 \times 4$ block; verify spatial crosshatch distribution | Exactly 8 out of 16 pixels lit in every $4 \times 4$ block ($50\%$ fill factor); symmetric crosshatch arrangement. |
| `T1-F09-03` | F09 | Bayer 8×8 64-Level Quantization Spread | 64 uniform patches with luminance $Y_k = k \times 4$ for $k \in [0, 63]$ | Dither each patch with Bayer 8x8; count lit pixels per $8 \times 8$ block | Number of lit pixels per $8 \times 8$ block strictly equals $k$ (exact 64 discrete gray step representation). |
| `T1-F09-04` | F09 | Temporal Stability / Zero Crawling Noise | Video sequence of static graphic with subtle camera sensor noise | Dither with Bayer vs Floyd-Steinberg; compute Hamming distance between consecutive frames | Bayer produces 0 bit flips on static areas; eliminates temporal crawling flicker entirely. |
| `T1-F09-05` | F09 | Independent Pixel Parallel Throughput | Measure execution time of Bayer 8x8 on $128 \times 64$ frame | Benchmark execution across 1,000 iterations in JS/TS | Execution time $< 0.15\text{ ms}$ per frame; $3 \times$ faster than error diffusion due to no loop dependency. |

---

### F10: Dynamic Thresholding (M2)
*Simple luminance thresholding with adjustable cutoff slider.*

| Test ID | Feature # | Test Name | Input | Verification Mechanism | Expected Output |
|---|---|---|---|---|---|
| `T1-F10-01` | F10 | Midpoint Cutoff Thresholding ($T=128$) | Input pixels with values $[0, 127, 128, 200, 255]$ with slider $T = 128$ | Quantize using rule: $Q = (Y \ge T) \ ? \ 255 : 0$; assert output values | Output: $[0, 0, 255, 255, 255]$. |
| `T1-F10-02` | F10 | Dynamic Slider Cutoff Update ($T=64, 192$) | Test image with ramp $Y = 0 \dots 255$; apply $T=64$, then $T=192$ | Count lit pixels on $128 \times 64$ canvas ($8192$ total pixels) | At $T=64$: lit pixels $\approx 6136$ ($\approx 75\%$); at $T=192$: lit pixels $\approx 2048$ ($\approx 25\%$). |
| `T1-F10-03` | F10 | Boundary Cutoff Limits ($T=0, 255$) | All-gray image ($Y=100$); test with $T = 0$ and $T = 255$ | Evaluate output pixel array | At $T=0$: all 8192 pixels are 255 (solid white); at $T=255$: all 8192 pixels are 0 (solid black). |
| `T1-F10-04` | F10 | High-Contrast Silhouette Edge Sharpness | Black text on white background with 1px anti-aliased gray border | Apply thresholding ($T=128$); inspect edge pixels | Zero stipple or diffusion dots; binary sharp edge transition between black glyph and white background. |
| `T1-F10-05` | F10 | Real-Time Execution Latency Benchmark | Process 100 frames through thresholding engine | Measure total elapsed time via `performance.now()` | Average execution time $< 0.05\text{ ms}$ per frame ($> 20,000\text{ FPS}$ computational throughput). |

---

### F11: XBMP Binary Frame Packing (M2)
*Pack 128×64 pixels into 1024-byte row-major LSB-first format (U8g2 compatible).*

| Test ID | Feature # | Test Name | Input | Verification Mechanism | Expected Output |
|---|---|---|---|---|---|
| `T1-F11-01` | F11 | Exact 1024-Byte Array Allocation | 1-bit quantized pixel array of size $128 \times 64 = 8192$ elements | Call `packXBMP(pixels, 128, 64)`; check returned array type and byte length | Returns `Uint8Array` instance; `byteLength` is exactly `1024` bytes ($16 \times 64$). |
| `T1-F11-02` | F11 | Row-Major Byte Traversal Verification | White horizontal line at row $y = 1$ ($x \in [0, 127]$ lit), all other rows black | Call `packXBMP()`; inspect byte array offsets | Bytes $0 \dots 15$ are `0x00`; Bytes $16 \dots 31$ are `0xFF`; Bytes $32 \dots 1023$ are `0x00`. |
| `T1-F11-03` | F11 | LSB-First Bit Significance Verification | Single lit pixel at $(0, 0)$; single lit pixel at $(7, 0)$; single lit pixel at $(1, 0)$ | Call `packXBMP()`; inspect Byte 0 | Single pixel $(0, 0) \rightarrow \text{Byte } 0 = \text{0x01}$; pixel $(7, 0) \rightarrow \text{Byte } 0 = \text{0x80}$; pixel $(1, 0) \rightarrow \text{Byte } 0 = \text{0x02}$. |
| `T1-F11-04` | F11 | Pixel Polarity U8g2 Compatibility | Solid white screen (all pixels 255); solid black screen (all pixels 0) | Call `packXBMP()`; verify byte patterns | Solid white produces 1024 bytes of `0xFF`; solid black produces 1024 bytes of `0x00`. |
| `T1-F11-05` | F11 | Round-Trip Pack and Unpack Identity | Random binary test pattern of 8192 pixels | Run `unpacked = unpackXBMP(packXBMP(original))`; assert equality | `unpacked` is bit-for-bit identical to `original` across all 8192 elements. |

---

### F12: Simulated OLED Canvas Player (M2)
*128×64 canvas rendering with sub-pixel grid, glow, and phosphor color themes.*

| Test ID | Feature # | Test Name | Input | Verification Mechanism | Expected Output |
|---|---|---|---|---|---|
| `T1-F12-01` | F12 | Scaled Display with Sub-Pixel Grid Gap | 1024-byte frame rendered to $512 \times 256$ canvas (scale factor 4) | Inspect pixel drawing dimensions: rect size at $(x \cdot 4, y \cdot 4)$ | Lit pixel drawn as $3 \times 3$ rect with 1px true-black interstitial margin ($4-1=3$). |
| `T1-F12-02` | F12 | Classic Cyan Phosphor Theme Rendering | Single lit pixel at $(10, 10)$ with Theme = "Classic Cyan" | Sample RGB pixel data at center of pad on canvas | Pixel color matches `#00f0ff` ($R=0, G=240, B=255$); ambient unlit pad matches dark phosphor `#0a0e14`. |
| `T1-F12-03` | F12 | Crisp White Phosphor Theme Rendering | Frame with lit pixels; Theme = "Crisp White" | Sample lit pixel color on canvas | Lit pixel color matches `#ffffff` ($R=255, G=255, B=255$). |
| `T1-F12-04` | F12 | Yellow/Blue Dual-Zone Display Simulation | Frame with lit pixels on row 5 and row 30; Theme = "Yellow/Blue" | Sample pixel at row 5 ($y < 16$), row 16, and row 30 ($y > 16$) | Row 5 pixel is Yellow (`#ffcc00`); Row 16 is forced Black spacer; Row 30 pixel is Blue (`#00e5ff`). |
| `T1-F12-05` | F12 | Amber & Matrix Green Themes Rendering | Theme toggled to "Amber" then "Matrix Green" | Sample canvas lit pixel fill styles | Amber matches `#ffb000` ($R=255, G=176, B=0$); Matrix Green matches `#00ff66` ($R=0, G=255, B=102$). |

---

### F13: Playback Controls & Timeline (M2)
*Play/pause, step forward/back, loop toggle, scrub bar, and 15–30 FPS selector.*

| Test ID | Feature # | Test Name | Input | Verification Mechanism | Expected Output |
|---|---|---|---|---|---|
| `T1-F13-01` | F13 | Play/Pause State Transition | User clicks Play button (or presses Space key) | Assert playback state boolean and `requestAnimationFrame` loop active | State changes from `paused: true` to `paused: false`; frame index increments over time. |
| `T1-F13-02` | F13 | Scrub Bar Frame Seek Synchronization | 100-frame animation; user drags scrub bar to position 45 | Query active frame ref and simulated OLED canvas display | Active frame index updates to exactly 45; canvas renders Frame 45 bitmap immediately. |
| `T1-F13-03` | F13 | Single-Frame Step Forward & Backward | Active frame index = 10; trigger Step Forward, then Step Backward | Observe frame index after each trigger | Step Forward sets index to 11; Step Backward sets index back to 10. |
| `T1-F13-04` | F13 | Continuous Loop vs Play-Once Mode | Playback reaches last frame ($N-1$); Loop = `true` vs Loop = `false` | Observe frame index transition after frame interval duration | Loop = `true` wraps index to `0`; Loop = `false` halts playback at $N-1$ and sets `paused: true`. |
| `T1-F13-05` | F13 | Frame Rate Selector Timing (15–30 FPS) | Set FPS to 15 FPS vs 30 FPS; measure elapsed time for 30 frames | Record time using high-resolution performance timers | At 15 FPS: 30 frames takes $\approx 2000\text{ ms}$; at 30 FPS: 30 frames takes $\approx 1000\text{ ms}$. |

---

### F14: Text Typewriter & Bounce Lyric (M3)
*Procedural text animation with typewriter reveal and elastic bounce physics.*

| Test ID | Feature # | Test Name | Input | Verification Mechanism | Expected Output |
|---|---|---|---|---|---|
| `T1-F14-01` | F14 | Typewriter CPS Character Reveal Progression | Text: `"HELLO WORLD"` (11 chars); speed = 10 CPS; sample at $t = 0.5\text{s}$ | Compute $visible = \lfloor 0.5 \times 10 \rfloor = 5$; render canvas; inspect glyphs | First 5 characters (`"HELLO"`) rendered; remaining 6 characters omitted. |
| `T1-F14-02` | F14 | Monospace Bitmap Font Word Wrapping | Text line of 30 characters (exceeds 128px canvas width for 6px font) | Run text layout parser; inspect line count and line character partitions | Text splits into 2 lines cleanly without clipping off right canvas margin ($x \le 128$). |
| `T1-F14-03` | F14 | Blinking Cursor Square Simulation | Typewriter active; sample canvas at $t = 0.25\text{s}$ and $t = 0.75\text{s}$ | Inspect pixel block at cursor position | Cursor block rendered at $t = 0.25\text{s}$ (blink state on); unlit at $t = 0.75\text{s}$ (blink state off). |
| `T1-F14-04` | F14 | Damped Elastic Bounce Curve Calculation | Lyric word drop; $t \in [0, 1.0]$; evaluate `easeOutBounce(t)` formula | Check values at $t = 0.0, 0.5, 0.85, 1.0$ | $t=0.0 \rightarrow 0.0$; $t=0.5 \rightarrow 0.75$; $t=0.85 \rightarrow 0.95$; $t=1.0 \rightarrow 1.0$; vertical overshoot observed. |
| `T1-F14-05` | F14 | Karaoke-Style Inverse Video Highlight | Active word `"BEAT"` in lyric sentence; highlight flag active | Inspect pixel polarity of bounding box containing `"BEAT"` | Solid white filled rectangular background; font glyphs rendered in inverted black pixels. |

---

### F15: Glitch Shader FX (M3)
*Procedural 1-bit glitch FX: XOR bitwise noise, horizontal row tearing shifts.*

| Test ID | Feature # | Test Name | Input | Verification Mechanism | Expected Output |
|---|---|---|---|---|---|
| `T1-F15-01` | F15 | XOR Bitwise Noise Application | 1024-byte frame; Glitch noise active with pseudo-random mask stream | Apply `byte[i] ^= (noise[i] & mask)`; compare before and after | Targeted bytes modified by XOR; pixel structures fragmented without blurring or corrupting buffer size. |
| `T1-F15-02` | F15 | Horizontal Row Tearing Displacement | Scanline slice $y \in [20, 28]$; horizontal shift $\Delta x = +12\text{px}$ | Inspect pixel coordinates on shifted rows: $x' = (x - 12 + 128) \bmod 128$ | Rows $20 \dots 28$ displaced horizontally by 12 pixels; scanlines above and below unaffected. |
| `T1-F15-03` | F15 | Periodic Bit-Flip Scanlines | Inversion interval = 8 rows; apply bitwise NOT (`byte ^= 0xFF`) | Compare inverted rows $y = 0, 8, 16, 24\dots$ with original frame | Selected rows completely inverted in polarity; intermediate rows remain unaltered. |
| `T1-F15-04` | F15 | Rolling CRT V-SYNC Bar Animation | Glitch engine running; evaluate rolling bar offset over time $t$ | Compute $y_{bar} = \lfloor t \times v \rfloor \bmod 64$; inspect canvas | 8-pixel inverted band rolls vertically down the display; wraps smoothly from row 63 back to row 0. |
| `T1-F15-05` | F15 | Deterministic Seeded PRNG Reproducibility | Glitch sequence generated twice with identical RNG seed `0xCAFE` | Compute MD5 hash of 30 generated glitch frames for Run A vs Run B | Hashes match identically across all 30 frames between Run A and Run B. |

---

### F16: Starfield & Particle Explosion (M3)
*3D perspective warp starfield and radial ballistic particle burst simulation.*

| Test ID | Feature # | Test Name | Input | Verification Mechanism | Expected Output |
|---|---|---|---|---|---|
| `T1-F16-01` | F16 | 3D Starfield Perspective Projection | Star at $(X=20, Y=10, Z=50)$; focal lengths $f_x = 64, f_y = 32$ | Compute $x_s = 64 + (X/Z) \cdot f_x, y_s = 32 + (Y/Z) \cdot f_y$ | $x_s = 64 + (20/50) \cdot 64 = 89.6 \approx 90$; $y_s = 32 + (10/50) \cdot 32 = 38.4 \approx 38$. |
| `T1-F16-02` | F16 | Warp Speed Bresenham Streak Rendering | High warp speed ($S = 80$); star moves from $(70, 35)$ to $(85, 42)$ | Verify streak drawing routine between previous and current coordinates | Bresenham line algorithm connects previous to current position; creates outward radial streak. |
| `T1-F16-03` | F16 | Near-Plane Star Respawn Cycling | Star moves forward until $Z \le 0.1$ | Run simulation step; inspect star $Z$ coordinate | Star coordinate $Z$ resets to $Z_{max} = 100$ with fresh randomized $(X, Y)$ coordinates. |
| `T1-F16-04` | F16 | Radial Particle Burst Ballistic Physics | 50 particles exploded from center $(64, 32)$ with gravity $g = +30$ | Run Euler update for 30 frames; inspect particle positions | Particles radiate outward in full $360^\circ$ circle; trajectories curve downward due to gravity. |
| `T1-F16-05` | F16 | Particle Lifetime Decay & Stochastic Fade | Particle initial lifespan $L = 1.0\text{s}$; sample at $L = 0.2\text{s}$ | Inspect particle rendering mode | Particle transitions from multi-pixel cross cluster to single dithered twinkling pixel before vanishing. |

---

### F17: Procedural Timeline Integration (M3)
*Generate procedural sequences directly into the studio timeline & preview.*

| Test ID | Feature # | Test Name | Input | Verification Mechanism | Expected Output |
|---|---|---|---|---|---|
| `T1-F17-01` | F17 | Procedural Generator Timeline Baking | User configures Starfield (90 frames, 30 FPS); clicks "Bake to Timeline" | Query studio timeline state frame store | Timeline populated with exactly 90 pre-rendered 1024-byte XBMP frames. |
| `T1-F17-02` | F17 | Seamless Timeline Scrubbing of Baked FX | 90 baked procedural frames; scrub slider dragged to frame 30 | Canvas render trigger; inspect frame buffer | Frame 30 renders instantly ($< 1\text{ms}$) directly from memory buffer without re-simulation. |
| `T1-F17-03` | F17 | Procedural Layer Compositing over Video | Video reel (100 frames) + Glitch FX applied on top (frames 20..40) | Inspect frame buffers at frame 10 (raw video) vs frame 25 (composited) | Frame 10 contains unglitched video; Frame 25 contains video with overlaid XOR row glitch. |
| `T1-F17-04` | F17 | Configurable Sequence Duration & Frame Count | Set procedural sequence to 4.0 seconds at 24 FPS | Compute total frame count: $4.0 \times 24$ | Timeline generates exactly 96 frames. |
| `T1-F17-05` | F17 | Procedural Frame Export Compatibility | Baked procedural timeline frames passed to C++ Exporter | Trigger C++ Export; validate generated array length | Exporter generates valid `src/frames.h` containing all baked procedural frames. |

---

### F18: C++ PROGMEM Header Exporter (M4)
*Generate `src/frames.h` with `epd_bitmap_allArray[][1024]` PROGMEM XBMP format.*

| Test ID | Feature # | Test Name | Input | Verification Mechanism | Expected Output |
|---|---|---|---|---|---|
| `T1-F18-01` | F18 | Header Macro Definitions Integrity | Export 60 frames at 30 FPS | Parse generated C++ header string; check macro values | `#define FRAME_WIDTH 128`, `#define FRAME_HEIGHT 64`, `#define FRAME_SIZE_BYTES 1024`, `#define FRAME_FPS 30`, `#define NUM_FRAMES 60`. |
| `T1-F18-02` | F18 | PROGMEM 2D Byte Array Formatting | Array of 2 frames with known byte signatures | Inspect generated array syntax: `const uint8_t reel_frames[2][1024] PROGMEM = { ... };` | Valid C++ array format; exactly 1024 comma-separated hex bytes (`0xXX`) per row enclosed in braces. |
| `T1-F18-03` | F18 | Compatibility Symbol Aliasing | Inspect end of generated header file | Regex search for symbol alias | Contains `#define epd_bitmap_allArray reel_frames` ensuring drop-in compatibility. |
| `T1-F18-04` | F18 | Hex Literal Formatting Standard | Single byte value `5` and `255` | Verify formatted output string | Formatted with leading zeros: `0x05`, `0xFF` (strict 4-character hex literal). |
| `T1-F18-05` | F18 | PlatformIO GCC Compilation Validation | Save generated header as `src/frames.h`; compile using PlatformIO | Execute PlatformIO build CLI (`pio run`) | Build passes with exit code 0; firmware binary (`firmware.elf`) generated without compiler warnings. |

---

### F19: PackBits RLE Header Exporter (M4)
*Compressed byte-level RLE format option with inline C++ decompressor routine.*

| Test ID | Feature # | Test Name | Input | Verification Mechanism | Expected Output |
|---|---|---|---|---|---|
| `T1-F19-01` | F19 | PackBits Literal Run Encoding | Sequence of 5 unrepeated bytes: `[0x01, 0x02, 0x03, 0x04, 0x05]` | Run PackBits compressor | Emits header byte `0x04` ($n = 4 \implies n+1 = 5$) followed by the 5 literal bytes. |
| `T1-F19-02` | F19 | PackBits Repeat Run Encoding | Sequence of 10 identical bytes: `[0xFF, 0xFF, ... 0xFF]` | Run PackBits compressor | Emits header byte `-9` (`0xF7` signed: $1 - (-9) = 10$) followed by single byte `0xFF`. |
| `T1-F19-03` | F19 | Frame Offset Lookup Table Generation | 5-frame RLE compressed sequence | Inspect generated `frame_offsets[5]` array in `frames_rle.h` | Contains 5 ascending offsets; `frame_offsets[0] == 0`; offsets match byte indices in `rle_data`. |
| `T1-F19-04` | F19 | Inline C++ Decompressor Routine | Verify inclusion of `decompressRLE()` in `frames_rle.h` | Parse C++ function definition | Contains zero dynamic heap allocation (`malloc`/`new`); uses static buffer and `pgm_read_byte`. |
| `T1-F19-05` | F19 | Lossless Round-Trip Decompression | Compress 1024-byte frame; decompress with C++ equivalent logic | Compare decompressed byte buffer with original frame | Bit-for-bit identical match across all 1024 bytes (0 bit divergence). |

---

### F20: 1-Click Code Copy & Download (M4)
*Instant clipboard copy and `.h` file download in Web UI.*

| Test ID | Feature # | Test Name | Input | Verification Mechanism | Expected Output |
|---|---|---|---|---|---|
| `T1-F20-01` | F20 | Async Clipboard API Invocation | User clicks "Copy C++ Code" button in export modal | Mock `navigator.clipboard.writeText`; assert argument string | `writeText` called with complete C++ header content; UI triggers success toast `"Copied to clipboard!"`. |
| `T1-F20-02` | F20 | Clipboard Insecure Context Fallback | Invalidate `navigator.clipboard`; click "Copy C++ Code" | Verify fallback execution using hidden textarea and `document.execCommand('copy')` | Hidden textarea created with code; `execCommand('copy')` returns true; textarea cleaned up from DOM. |
| `T1-F20-03` | F20 | PROGMEM Header File Download | User clicks "Download frames.h" | Intercept anchor creation, `href` Blob URL, and `download` attribute | Anchor created with `download = "frames.h"`; Blob MIME type is `text/x-c++hdr;charset=utf-8`. |
| `T1-F20-04` | F20 | PackBits RLE Header File Download | User selects RLE mode; clicks "Download frames_rle.h" | Intercept anchor attributes | Anchor created with `download = "frames_rle.h"`; Blob contains RLE code and inline decompressor. |
| `T1-F20-05` | F20 | Memory Metric Footprint Badge | 120 frames loaded in studio | Inspect memory usage indicator in export dialog | Displays exact calculation: `120 * 1024 = 122,880 bytes (120 KB)`; shows ESP32 Flash usage percentage ($\approx 0.75\%$). |

---

### F21: WebSerial USB Streamer (M4)
*WebSerial connection management, 921600 baud, port auto-request, status UI.*

| Test ID | Feature # | Test Name | Input | Verification Mechanism | Expected Output |
|---|---|---|---|---|---|
| `T1-F21-01` | F21 | WebSerial API Feature Detection | Browser environment check: `'serial' in navigator` | Evaluate conditional UI rendering | Connect button enabled on Chromium; if absent, warning banner displayed recommending Chrome/Edge. |
| `T1-F21-02` | F21 | USB Vendor ID Device Filter | User clicks "Connect ESP32" | Intercept `navigator.serial.requestPort(options)` | Filter options specify `usbVendorId: 0x303A` (Espressif Systems USB VID). |
| `T1-F21-03` | F21 | 921600 High-Speed Baud Initialization | Port selected; user selects 921600 baud | Intercept `port.open(options)` | Called with `baudRate: 921600, dataBits: 8, stopBits: 1, parity: 'none', bufferSize: 16384`. |
| `T1-F21-04` | F21 | Connection State Machine Tracking | Execute connect followed by user disconnect | Observe connection status reactive variable | Status transitions from `Disconnected` $\rightarrow$ `Connecting` $\rightarrow$ `Connected` $\rightarrow$ `Disconnected`. |
| `T1-F21-05` | F21 | User Cancelled Port Request Handling | User closes browser device picker dialog without selection | Mock rejection with `DOMException("User cancelled", "NotFoundError")` | Exception caught gracefully; UI displays `"Connection cancelled"` without application error. |

---

### F22: Binary Framing Protocol (M4)
*OLED-Stream v1: `0xAA 0x55` header, CMD, length, 1024-byte payload, XOR checksum.*

| Test ID | Feature # | Test Name | Input | Verification Mechanism | Expected Output |
|---|---|---|---|---|---|
| `T1-F22-01` | F22 | Magic Header Bytes Construction | Call `buildOLEDStreamPacket(frameData, CMD_FRAME, seqId)` | Inspect bytes 0 and 1 of returned serialized buffer | Byte 0 is `0xAA`; Byte 1 is `0x55` (strict 2-byte preamble). |
| `T1-F22-02` | F22 | Command & Sequence ID Serialization | Pass `cmd = 0x01` (`CMD_FRAME_XBMP`) and `seqId = 42` | Inspect bytes 2 and 3 | Byte 2 is `0x01`; Byte 3 is `0x2A` (42 decimal). |
| `T1-F22-03` | F22 | Little-Endian Payload Length Encoding | Payload size = 1024 bytes (`0x0400`) | Inspect bytes 4 and 5 | Byte 4 (Len Low) is `0x00`; Byte 5 (Len High) is `0x04`. |
| `T1-F22-04` | F22 | Exact 1031-Byte Total Packet Length | Standard 1024-byte frame passed to packet builder | Check `packet.byteLength` | Exactly `1031` bytes ($2\text{ magic} + 1\text{ cmd} + 1\text{ seq} + 2\text{ len} + 1024\text{ data} + 1\text{ checksum}$). |
| `T1-F22-05` | F22 | 1-Byte XOR Checksum Calculation | Build packet with known payload; compute expected XOR sum | Read byte 1030 (last byte); compare with: $\text{Cmd} \oplus \text{Seq} \oplus \text{Len}_L \oplus \text{Len}_H \oplus \bigoplus_{i=0}^{1023} \text{Payload}[i]$ | Last byte strictly equals computed XOR sum. |

---

### F23: Stop-and-Wait ACK Flow Control (M4)
*Synchronous frame ACK handshake preventing ESP32-S3 RX buffer overrun.*

| Test ID | Feature # | Test Name | Input | Verification Mechanism | Expected Output |
|---|---|---|---|---|---|
| `T1-F23-01` | F23 | Transmitter Frame Hold on Outstanding ACK | Transmit Packet with `seqId = 1`; hold next frame until ACK | Observe stream writer loop state | Loop pauses; Packet 2 is not transmitted until ACK token is received. |
| `T1-F23-02` | F23 | Valid ACK Token Release (`0x06`) | Serial receiver feeds `[0x06, 0x01]` (`ACK, seqId 1`) back to streamer | Inspect streamer state | Streamer validates Seq 1 ACK, releases backpressure, and dispatches Packet 2. |
| `T1-F23-03` | F23 | NAK Handling & Frame Retransmission | Receiver feeds `[0x15, 0x01]` (`NAK, seqId 1`) due to checksum error | Monitor serial writer output | Streamer immediately retransmits Packet 1 with identical sequence ID. |
| `T1-F23-04` | F23 | Deadlock Prevention Watchdog Timeout | Transmitter sends Packet; receiver drops ACK (no response for 150ms) | Measure time until next frame transmission | 150ms watchdog expires; logs dropped frame event; proceeds to send next frame. |
| `T1-F23-05` | F23 | Streaming Telemetry Metric Tracking | Stream 100 frames with simulated 25ms ACK round-trip | Inspect telemetry state object | Displays `FPS: 30`, `Delivered: 100`, `Dropped: 0`, `Avg Latency: 25ms`. |

---

### F24: ESP32-S3 Dual-Mode Firmware (M4)
*Serial streaming receiver (2KB buffer, 921600 baud) + PROGMEM fallback player.*

| Test ID | Feature # | Test Name | Input | Verification Mechanism | Expected Output |
|---|---|---|---|---|---|
| `T1-F24-01` | F24 | Boot Standalone Playback Mode | Power on ESP32-S3 with no serial connection | Monitor display draw calls in firmware | Firmware enters `MODE_PROGMEM`; continuously loops `reel_frames[currentFrame]` at 30 FPS. |
| `T1-F24-02` | F24 | Dynamic Mode Transition to Streaming | Serial stream injects valid `0xAA 0x55` frame packet | Monitor firmware state variable | State transitions immediately to `MODE_STREAMING`; renders incoming buffer to OLED. |
| `T1-F24-03` | F24 | Expanded 2048-Byte Serial RX Buffer | Firmware initialization code inspection | Check `Serial.setRxBufferSize(2048)` call in `setup()` | Buffer size initialized to 2048 bytes; prevents UART FIFO hardware overrun. |
| `T1-F24-04` | F24 | Inactivity Watchdog Fallback (2000ms) | Active stream abruptly halts (no serial bytes for $> 2000\text{ms}$) | Monitor firmware state timer | State transitions from `MODE_STREAMING` back to `MODE_PROGMEM`; resumes looping flash animation. |
| `T1-F24-05` | F24 | Inter-Byte Timeout Parser Reset (100ms) | Partial packet received (header only), then 120ms silence | Feed next valid packet starting with `0xAA 0x55` | Parser resets to `STATE_MAGIC_0`; locks onto new packet without corrupted frame offset. |

---

### F25: SH1106 / SSD1306 Hardware Support (M4)
*I2C Fast Mode (SDA=8, SCL=9) with compile-time or protocol display selection.*

| Test ID | Feature # | Test Name | Input | Verification Mechanism | Expected Output |
|---|---|---|---|---|---|
| `T1-F25-01` | F25 | Fast Mode 400kHz I2C Pin Assignment | Inspect `Wire.begin(8, 9, 400000)` in `src/main.cpp` | Verify GPIO assignments and bus speed | SDA assigned to GPIO 8; SCL assigned to GPIO 9; bus clock set to 400 kHz. |
| `T1-F25-02` | F25 | SH1106 2-Pixel RAM Addressing Offset | Compile with `U8G2_SH1106_128X64_NONAME_F_HW_I2C` | Verify display buffer transmission logic | Display active columns span RAM addresses 2 through 129; no 2px right-shift or edge noise. |
| `T1-F25-03` | F25 | SSD1306 0-Pixel Offset Driver Constructor | Compile with `U8G2_SSD1306_128X64_NONAME_F_HW_I2C` | Verify display buffer transmission logic | Display active columns span RAM addresses 0 through 127; no column truncation. |
| `T1-F25-04` | F25 | Preprocessor Build Flag Controller Switch | Set `build_flags = -DOLED_SSD1306` in `platformio.ini` | Compile firmware; check active driver branch in `#ifdef` | SSD1306 driver compiled; SH1106 constructor excluded from final binary. |
| `T1-F25-05` | F25 | Full Display Buffer Refresh Timing | Measure execution time of `u8g2.sendBuffer()` at 400 kHz I2C | Benchmark timer on ESP32-S3 | Single frame refresh completes in $\approx 24.3\text{ ms}$ (well within 33.3ms budget for 30 FPS). |

---

### F26: E2E Testing Suite (M5)
*Complete automated test suite covering all features, boundaries, and scenarios.*

| Test ID | Feature # | Test Name | Input | Verification Mechanism | Expected Output |
|---|---|---|---|---|---|
| `T1-F26-01` | F26 | Automated CLI Test Runner Execution | Run `node test/e2e/runner.js` (or `py -m pytest test/e2e`) | Execute CLI test command; inspect process return code | Process exits with code `0`; all executed test suites report passing status. |
| `T1-F26-02` | F26 | Structured TAP / JSON Test Report Output | Run test suite with `--json` or `--tap` flag | Validate stdout format against standard JSON/TAP schemas | Emits valid machine-readable test results schema with test counts, durations, and pass/fail statuses. |
| `T1-F26-03` | F26 | Universal Feature Coverage Completeness | Run suite; check report coverage against F01–F27 inventory | Assert that tests exist and execute for every feature F01 to F27 | All 27 feature keys present in test execution summary; zero uncovered features. |
| `T1-F26-04` | F26 | Windows Portability & Headless Reliability | Execute test suite in native Windows shell (Powershell / cmd) | Assert execution without path separator errors or headless window failures | Suite runs cleanly on Windows; path separators (`/` vs `\`) handled portably. |
| `T1-F26-05` | F26 | Synthetic Mock Fixture Generator | Run test fixture generation utilities in `test/e2e/fixtures/` | Inspect generated mock assets (MP4, GIF, PNG, packets) | Generates synthetic 128×64 test patterns, valid GIF89a, PNG sequences, and binary packets. |

---

### F27: Adversarial Hardening (M5)
*Tier 5 white-box stress testing and edge-case validation.*

| Test ID | Feature # | Test Name | Input | Verification Mechanism | Expected Output |
|---|---|---|---|---|---|
| `T1-F27-01` | F27 | High-Throughput Burst Stress Test | Send 1,000 packets at maximum possible UART rate | Monitor firmware crash logs and watchdog resets | ESP32-S3 runs without panic, memory corruption, or heap fragmentation. |
| `T1-F27-02` | F27 | Continuous Random Garbage Stream | Stream 100 KB of random cryptographic bytes (`/dev/urandom`) | Monitor serial parser state | Parser discards all non-matching bytes; never locks up; state returns to `STATE_MAGIC_0`. |
| `T1-F27-03` | F27 | Rapid Serial Port Connect/Disconnect | Open and close WebSerial port 50 times in rapid succession | Monitor browser console and OS COM port handle | Port opens and closes cleanly without `DOMException` deadlock or hung port handles. |
| `T1-F27-04` | F27 | Corrupted Checksum Packet Rejection | Inject 100 packets with intentionally inverted checksum bytes | Count receiver ACK vs NAK responses | Receiver emits exactly 100 NAK responses (`0x15`); zero corrupted frames drawn to screen. |
| `T1-F27-05` | F27 | Extended Soak Test Memory Stability | Run continuous 30 FPS conversion and streaming loop for 30 minutes (54,000 frames) | Monitor JS heap memory via `performance.memory` | Heap memory remains stable (within 10% of baseline); zero progressive memory leaks. |

---

## 3. Tier 2: Boundary & Corner Cases Test Inventory (F01 – F27)

### F01: Web Studio Project Setup (Boundaries)

| Test ID | Feature # | Test Name | Input | Verification Mechanism | Expected Output |
|---|---|---|---|---|---|
| `T2-F01-01` | F01 | Zero-Byte or Empty `package.json` | Synthetic empty file `web/package.json` (0 bytes) | Execute `npm run build` | Process fails immediately with clear JSON parse syntax error; halts cleanly. |
| `T2-F01-02` | F01 | Corrupted JSON Syntax in `tsconfig.json` | Missing closing brace `}` in `web/tsconfig.json` | Run `npx tsc --noEmit` | Process exits non-zero; outputs descriptive compiler error specifying line and column. |
| `T2-F01-03` | F01 | Missing Tailwind Directives in CSS | Empty `oled.css` without `@tailwind` directives | Run build; inspect compiled styles | Builder warns or produces minimal bundle without crashing; application UI falls back to base styles. |
| `T2-F01-04` | F01 | Spaces & Special Characters in Root Directory Path | Project located in path: `D:\oled test (v1.0) & studio\web` | Run `npm run build` and `npx tsc` | Scripts escape path strings correctly; compilation succeeds with exit code 0. |
| `T2-F01-05` | F01 | Node.js High-Version Compatibility Boundary | Execute build under modern Node.js runtime (`v24.15.0`) | Run `node -v && npm run build` | Build succeeds without deprecated engine warnings or API breakage. |

---

### F02: Video Decoder (Boundaries)

| Test ID | Feature # | Test Name | Input | Verification Mechanism | Expected Output |
|---|---|---|---|---|---|
| `T2-F02-01` | F02 | 0-Byte Video File Ingestion | Empty file blob: `empty.mp4` (0 bytes) | Pass to `mediaDecoder.loadVideo()` | Promise rejects with error: `"Invalid or empty video file"`; UI does not crash. |
| `T2-F02-02` | F02 | Truncated MP4 File (Corrupted Atom Header) | MP4 file truncated after `ftyp` atom (missing `moov` atom) | Feed to video decoder; listen for `video.onerror` | Triggers `MediaError` (MEDIA_ERR_SRC_NOT_SUPPORTED); UI displays helpful corruption alert. |
| `T2-F02-03` | F02 | Extreme Ultra-High Resolution Video ($16000 \times 9000$) | Synthetic 16K video header | Check downsampling allocation guard | Video frame downscaled directly onto intermediate canvas; prevents browser tab OOM crash. |
| `T2-F02-04` | F02 | Single-Frame Video (Duration $< 0.033\text{s}$) | Video with duration = $0.015\text{s}$ (1 frame) | Ingest into decoder at 30 FPS | Computes $N = \max(1, \lfloor \text{duration} \times \text{FPS} \rfloor) = 1$; extracts exactly 1 frame without division by zero. |
| `T2-F02-05` | F02 | Ultra-Long Video Ingestion Guard (1 Hour, 108,000 Frames) | 3600-second video file metadata | Evaluate frame ingestion warning threshold | Studio prompts user: `"Video duration exceeds recommended limit. Extract first 30 seconds or sample at 5 FPS?"`. |

---

### F03: GIF Decoder (Boundaries)

| Test ID | Feature # | Test Name | Input | Verification Mechanism | Expected Output |
|---|---|---|---|---|---|
| `T2-F03-01` | F03 | 0-Byte GIF or Missing Magic Bytes | 10-byte file containing random ascii `"NOTAGIF123"` | Pass to `new GifReader(buffer)` | Throws descriptive error: `"Invalid GIF signature"`; handled cleanly. |
| `T2-F03-02` | F03 | 1-Frame Static GIF Image | GIF file with `numFrames == 1` | Parse GIF; check timeline frame array | Generates single 1024-byte frame; player sets static display; zero division by zero in playback timer. |
| `T2-F03-03` | F03 | Extreme GIF Dimensions ($1 \times 1$ pixel & $4096 \times 4096$ pixels) | 1x1 GIF and 4096x4096 GIF | Pass through decoder and 2:1 crop tool | 1x1 scaled up to fill 128x64; 4096x4096 downsampled cleanly without canvas buffer error. |
| `T2-F03-04` | F03 | Zero Inter-Frame Delay Handling ($delay = 0$) | GIF with frame delay byte set to `0` | Extract frame delays | Zero delay sanitized to default 100ms (10 FPS) safe playback standard (matches browser GIF spec). |
| `T2-F03-05` | F03 | Truncated LZW Compressed Stream | GIF with image descriptor but truncated image data block | Parse with `decodeAndBlitFrameRGBA()` | Catches truncated stream exception; returns partial decoded frames gracefully without infinite loop. |

---

### F04: PNG Sequence Loader (Boundaries)

| Test ID | Feature # | Test Name | Input | Verification Mechanism | Expected Output |
|---|---|---|---|---|---|
| `T2-F04-01` | F04 | Empty File Selection (0 Files) | User submits empty file dialog selection `[]` | Pass to `loadPngSequence([])` | Function returns empty array `[]`; UI retains previous valid state without throwing exception. |
| `T2-F04-02` | F04 | Single $1 \times 1$ Pixel PNG Image | Single $1 \times 1$ white PNG file | Load and render to $128 \times 64$ target canvas | Stretches or centers cleanly to 128x64 without zero-dimension division error. |
| `T2-F04-03` | F04 | Truncated PNG File (Missing IEND Chunk) | Valid PNG with final 12 bytes stripped | Decode via `createImageBitmap(blob)` | Promise rejection caught; logs warning `"Corrupted image skipped: frame_05.png"`; continues batch. |
| `T2-F04-04` | F04 | Massive Deep Alphanumeric Sequence Sorting | 10,000 filenames: `frame_0.png` through `frame_9999.png` unordered | Run natural collation sort | Index 0 is `frame_0.png`, Index 1 is `frame_1.png` ... Index 9999 is `frame_9999.png` (strict numeric order). |
| `T2-F04-05` | F04 | Massive Batch Upload (2,000 PNG Files) | File array of 2,000 synthetic PNGs | Monitor progress callback during loading | Progress callback reports monotonic percentages `0% \dots 100%`; memory remains within safe limit. |

---

### F05: Crop & Scale 2:1 (Boundaries)

| Test ID | Feature # | Test Name | Input | Verification Mechanism | Expected Output |
|---|---|---|---|---|---|
| `T2-F05-01` | F05 | Odd Source Dimensions ($129 \times 65$) | Source image with width 129, height 65 | Apply Cover center crop and scale to $128 \times 64$ | Output resolution strictly $128 \times 64$; sub-pixel rounding never generates $127$ or $129$ width. |
| `T2-F05-02` | F05 | Extreme Aspect Ratios (Ultra-Tall 1:10 & Ultra-Wide 10:1) | Images of size $100 \times 1000$ and $1000 \times 100$ | Apply Cover and Contain presets | Bounding box clamped strictly within source boundaries; coordinates contain zero `NaN` or `Infinity`. |
| `T2-F05-03` | F05 | Crop Box Boundary Drag Clamping | User drags crop box beyond top-left $(X < 0, Y < 0)$ or bottom-right $(X+W > W_{src})$ | Inspect clamped crop coordinates | $X$ clamped to $\max(0, \min(X, W_{src} - W))$; $Y$ clamped to $\max(0, \min(Y, H_{src} - H))$. |
| `T2-F05-04` | F05 | Minimum Crop Box Size Guard | User shrinks crop box toward zero size | Measure minimum allowed width and height | Box size stops shrinking at minimum constraint $W_{min} = 16\text{px}, H_{min} = 8\text{px}$ (prevents inversion/collapse). |
| `T2-F05-05` | F05 | Fractional Sub-Pixel Floating Coordinates | Crop coordinates $(X=10.73, Y=25.49, W=200.8, H=100.4)$ | Draw to canvas via `ctx.drawImage()` | Coordinates floored/rounded to integer pixels; eliminates sub-pixel edge blur artifacts. |

---

### F06: Brightness & Contrast Control (Boundaries)

| Test ID | Feature # | Test Name | Input | Verification Mechanism | Expected Output |
|---|---|---|---|---|---|
| `T2-F06-01` | F06 | Minimum Brightness Extreme ($B = -100$) | All-white image ($Y = 255$); Brightness slider at $-100$ ($B' = -255$) | Apply adjustment; inspect output pixel values | All output pixels clamped strictly to `0` (100% solid black display). |
| `T2-F06-02` | F06 | Maximum Brightness Extreme ($B = +100$) | All-black image ($Y = 0$); Brightness slider at $+100$ ($B' = +255$) | Apply adjustment; inspect output pixel values | All output pixels clamped strictly to `255` (100% solid white display). |
| `T2-F06-03` | F06 | Maximum Contrast Factor Singular Boundary ($C = +100$) | Contrast slider at $+100$ ($C' = 255$, denominator $(259 - C') = 4$, $F \approx 32.7$) | Apply adjustment to pixels $Y \in [0, 255]$ | High-gain expansion clamped strictly within $[0, 255]$; zero integer byte wrapping (e.g. 256 wrapping to 0). |
| `T2-F06-04` | F06 | Minimum Contrast Neutralization ($C = -100$) | Contrast slider at $-100$ ($C' = -255$, factor $F = 0$) | Apply adjustment; inspect output pixel values | All output pixels converge to exact flat neutral gray $Y' = 128$. |
| `T2-F06-05` | F06 | Invalid Input Tolerance (NaN / Non-Numeric Sliders) | Slider inputs: `brightness = NaN`, `contrast = undefined` | Call adjustment routine | Defaults cleanly to $B=0, C=0$; returns unmodified input image without runtime crash. |

---

### F07: Atkinson Dithering (Boundaries)

| Test ID | Feature # | Test Name | Input | Verification Mechanism | Expected Output |
|---|---|---|---|---|---|
| `T2-F07-01` | F07 | Double-Offset Bottom-Right Corner Guard | White pixel at $(126, 62)$ diffusing to $(x+2, y)$ and $(x, y+2)$ | Verify boundary checks: $x+2 < 128$ and $y+2 < 64$ | Diffusion to $(128, 62)$ and $(126, 64)$ cleanly suppressed; zero array out-of-bounds error. |
| `T2-F07-02` | F07 | Solid Black Uniform Input ($Y = 0$) | Uniform 128x64 array of 0s | Run Atkinson dithering | Returns 8192 zeros; packed XBMP buffer contains exactly 1024 bytes of `0x00`. |
| `T2-F07-03` | F07 | Solid White Uniform Input ($Y = 255$) | Uniform 128x64 array of 255s | Run Atkinson dithering | Returns 8192 255s; packed XBMP buffer contains exactly 1024 bytes of `0xFF`. |
| `T2-F07-04` | F07 | Low-Luminance Sub-Threshold Noise Suppression | Input frame containing faint noise $Y \in [1, 5]$ | Run Atkinson dithering | All noise discarded by $25\%$ error drop; output is 100% clean black (0 lit pixels). |
| `T2-F07-05` | F07 | Single Isolated Pixel Impulse Response | Entire canvas black except single pixel $(10, 10) = 255$ | Run Atkinson; count resulting lit pixels | Exactly 1 lit pixel at $(10, 10)$; surrounding diffused error is below threshold, producing no stray noise. |

---

### F08: Floyd-Steinberg Dithering (Boundaries)

| Test ID | Feature # | Test Name | Input | Verification Mechanism | Expected Output |
|---|---|---|---|---|---|
| `T2-F08-01` | F08 | Rightmost Column Boundary ($x = 127$) | White pixels along entire column $x = 127$ | Run Floyd-Steinberg; observe $(x+1, y)$ and $(x+1, y+1)$ offsets | Offsets exceeding width 127 discarded without writing into start of next line. |
| `T2-F08-02` | F08 | Leftmost Column Boundary ($x = 0$) | High luminance at $(0, 10)$; check $(x-1, y+1)$ offset | Assert array index $x-1$ | Negative index condition caught; error discarded without corrupting end of previous line. |
| `T2-F08-03` | F08 | Bottom Row Boundary ($y = 63$) | White pixels along entire row $y = 63$ | Run Floyd-Steinberg; observe all $y+1$ diffusion offsets | All offsets into row 64 discarded cleanly; array bounds strictly respected. |
| `T2-F08-04` | F08 | Alternating 1-Pixel High-Frequency Checkerboard | Input pixels alternating $0, 255, 0, 255$ across all rows | Run Floyd-Steinberg dithering | Output exactly preserves 1-pixel checkerboard without error diffusion oscillation drift. |
| `T2-F08-05` | F08 | Uniform Mid-Gray Equilibrium ($Y = 128$) | Solid $128 \times 64$ field of mid-gray $Y = 128$ | Count total lit pixels in output buffer | Total lit pixels is exactly 4096 ($\pm 1$) out of 8192 (exact $50.0\%$ fill density). |

---

### F09: Bayer Ordered Dithering (Boundaries)

| Test ID | Feature # | Test Name | Input | Verification Mechanism | Expected Output |
|---|---|---|---|---|---|
| `T2-F09-01` | F09 | Right/Bottom Matrix Modulo Wrap Conditions | Coordinates $(x=127, y=63)$ evaluated across $2\times 2, 4\times 4, 8\times 8$ | Check modulo results: $127 \bmod 8 = 7, 63 \bmod 8 = 7$ | Correct matrix elements selected: $M_2[1][1]$, $M_4[3][3]$, $M_8[7][7]$ without index error. |
| `T2-F09-02` | F09 | Exact Threshold Coincidence Boundary ($Y = T_N(x, y)$) | Luminance $Y$ equals exact normalized threshold $T_N(x, y)$ | Check comparison operator strictness: $Q = (Y > T_N) \ ? \ 255 : 0$ | Evaluates strictly to `0`; zero ambiguous or non-deterministic state. |
| `T2-F09-03` | F09 | Extreme Luminance Clamping Pre-Matrix | Input pixels containing out-of-range values $Y = -50$ and $Y = 300$ | Run Bayer dithering | Input clamped to $[0, 255]$ prior to comparison; $-50 \rightarrow 0$ and $300 \rightarrow 255$. |
| `T2-F09-04` | F09 | Bit-for-Bit Identity Across 1,000 Frames | Static synthetic test image passed through Bayer dithering 1,000 times | Compare all 1,000 output XBMP buffers | 100% bit-for-bit identical; zero temporal fluctuation or crawl. |
| `T2-F09-05` | F09 | Non-Power-of-Two Matrix Guard | Request invalid matrix size (e.g. $3\times 3$ or $5\times 5$) | Query Bayer dithering engine | Throws error or falls back to nearest valid Bayer matrix (Bayer $4\times 4$). |

---

### F10: Dynamic Thresholding (Boundaries)

| Test ID | Feature # | Test Name | Input | Verification Mechanism | Expected Output |
|---|---|---|---|---|---|
| `T2-F10-01` | F10 | Minimum Cutoff Boundary ($T = 0$) | Test frame with values $Y \in [0, 255]$ with slider $T = 0$ | Quantize with $Q = (Y \ge 0) \ ? \ 255 : 0$ | Every pixel quantized to 255; 100% white output. |
| `T2-F10-02` | F10 | Maximum Cutoff Boundary ($T = 255$) | Test frame with values $Y \in [0, 255]$ with slider $T = 255$ | Quantize with $Q = (Y \ge 255) \ ? \ 255 : 0$ | Only pixels with exact value 255 are lit; all others (0..254) are black. |
| `T2-F10-03` | F10 | Fractional Floating Cutoff Value ($T = 127.5$) | Threshold slider produces float $T = 127.5$ | Compare with integer boundary pixels $Y = 127$ and $Y = 128$ | $Y=127 < 127.5 \rightarrow 0$; $Y=128 \ge 127.5 \rightarrow 255$; clean split. |
| `T2-F10-04` | F10 | Rapid Slider Jitter Stress Test | Threshold slider animated from 0 to 255 and back 1,000 times in 1 second | Assert frame state consistency | Active frame updates synchronously without memory leaks or race conditions. |
| `T2-F10-05` | F10 | Negative or Out-of-Bounds Threshold Value | Slider value $T = -10$ or $T = 300$ passed via script | Check clamping in engine | $T$ clamped strictly to $[0, 255]$; prevents invalid binary quantization. |

---

### F11: XBMP Packing (Boundaries)

| Test ID | Feature # | Test Name | Input | Verification Mechanism | Expected Output |
|---|---|---|---|---|---|
| `T2-F11-01` | F11 | Underflow Buffer Size Assertion ($< 8192$ Pixels) | Pixel array with 8191 elements (missing 1 pixel) | Call `packXBMP(pixels, 128, 64)` | Throws `RangeError: Invalid pixel buffer size for 128x64 XBMP packing`. |
| `T2-F11-02` | F11 | Overflow Buffer Size Assertion ($> 8192$ Pixels) | Pixel array with 8193 elements (1 extra pixel) | Call `packXBMP(pixels, 128, 64)` | Throws `RangeError` or strictly packs exactly first 8192 pixels with warning. |
| `T2-F11-03` | F11 | Non-Multiple-of-8 Width Guard | Attempt packing with width = 127 (not divisible by 8) | Call `packXBMP(pixels, 127, 64)` | Throws error asserting that width must be a multiple of 8 for byte alignment. |
| `T2-F11-04` | F11 | All-Zero and All-One Boundary Frames | 8192 zeros; 8192 255s | Inspect packed Uint8Array | All-zero produces exactly 1024 bytes of `0x00`; all-one produces exactly 1024 bytes of `0xFF`. |
| `T2-F11-05` | F11 | Extreme Single Pixel Positions | Lit pixel at $(0, 0)$; lit pixel at $(127, 63)$ | Inspect Byte 0 and Byte 1023 | Byte 0 is `0x01` (Bit 0 lit); Byte 1023 is `0x80` (Bit 7 lit). |

---

### F12: Simulated OLED Canvas (Boundaries)

| Test ID | Feature # | Test Name | Input | Verification Mechanism | Expected Output |
|---|---|---|---|---|---|
| `T2-F12-01` | F12 | Corrupted Byte Values in 1024-Byte Frame | Buffer containing negative values or numbers $> 255$ | Pass to `OledCanvas.render(buffer)` | Buffer sanitized via `Uint8Array` casting; renders safely without throwing rendering exception. |
| `T2-F12-02` | F12 | Null or Undefined Frame Buffer | Pass `null` or `undefined` as active frame buffer | Call `OledCanvas.render(null)` | Canvas clears to black or displays placeholder bezel; does not crash. |
| `T2-F12-03` | F12 | High-DPI / Retina Scale Boundary ($devicePixelRatio = 3$) | Browser window on 4K display with DPR = 3 | Inspect canvas internal resolution vs CSS style width | Backing store scaled by DPR; sub-pixel grid remains crisp without blur. |
| `T2-F12-04` | F12 | Zero-Sized Canvas Viewport Container | Canvas placed in collapsed parent div with width 0, height 0 | Monitor canvas resize observer | Handles zero dimension gracefully without division by zero error; resizes when restored. |
| `T2-F12-05` | F12 | Rapid Theme Switching During Animation | Switch between all 5 themes 50 times per second during playback | Monitor rendering performance | Theme fills update cleanly without visual tearing, memory leaks, or dropped frames. |

---

### F13: Playback Controls & Timeline (Boundaries)

| Test ID | Feature # | Test Name | Input | Verification Mechanism | Expected Output |
|---|---|---|---|---|---|
| `T2-F13-01` | F13 | Zero FPS Frame Rate Boundary ($FPS = 0$) | User inputs 0 FPS | Check frame interval calculation: $\Delta t = 1000 / \text{FPS}$ | Clamped to minimum safe frame rate (1 FPS); prevents division by zero (`Infinity` interval). |
| `T2-F13-02` | F13 | High FPS Frame Rate Limit ($FPS = 120$) | User selects or inputs 120 FPS | Measure actual requestAnimationFrame dispatch rate | Frame stepper clamped to display VSYNC refresh rate (typically 60 Hz). |
| `T2-F13-03` | F13 | Out-of-Range Scrub Bar Drag ($Index < 0$ or $\ge N$) | Scrub slider dragged to $-10$ or $+500$ on 100-frame video | Query clamped frame index | Index clamped strictly to $\max(0, \min(index, 99)) = [0, 99]$. |
| `T2-F13-04` | F13 | Inactive Background Tab Delta Throttling | Browser minimizes tab for 30 seconds ($\Delta t = 30,000\text{ ms}$) | Reactivate tab; observe animation loop | Accumulator discards delta if $\Delta t > 1000\text{ ms}$; prevents 900-frame catchup storm. |
| `T2-F13-05` | F13 | Single-Frame Animation Scrubbing ($NUM\_FRAMES = 1$) | Single-frame image loaded; user clicks Play or Step Forward | Observe playback behavior | Index remains locked at 0; Play button disabled or stays at frame 0 without exception. |

---

### F14: Text Typewriter & Bounce Lyric (Boundaries)

| Test ID | Feature # | Test Name | Input | Verification Mechanism | Expected Output |
|---|---|---|---|---|---|
| `T2-F14-01` | F14 | Empty String Input (`""`) | Lyric text set to empty string `""` | Render procedural canvas | Blinking cursor renders at origin $(0, 0)$; zero glyph render calls; zero exceptions. |
| `T2-F14-02` | F14 | Massive Text Overflow (1,000 Characters) | Long text paragraph exceeding 64px canvas height | Run word-wrap layout engine | Text wraps lines; automatically scrolls or truncates cleanly at line 8 ($y = 64$ limit). |
| `T2-F14-03` | F14 | Ultra-Fast Typing Speed ($CPS = 1000$) | Typing speed set to 1000 characters/second | Sample canvas at $t = 0.05\text{s}$ | All characters revealed immediately without NaN calculation. |
| `T2-F14-04` | F14 | Zero Damping / Tension Spring Boundary | Bounce physics parameters set to 0 | Evaluate bounce trajectory | Values clamped to minimum stable physics thresholds; prevents divide-by-zero or infinite oscillation. |
| `T2-F14-05` | F14 | Special Characters & Emoji Glyphs | String containing `🔥`, `\n`, `\t`, `\r`, `\0`, `\u200B` | Render text engine | Control characters handled cleanly; unsupported emoji fallback to square replacement glyph ``. |

---

### F15: Glitch Shader FX (Boundaries)

| Test ID | Feature # | Test Name | Input | Verification Mechanism | Expected Output |
|---|---|---|---|---|---|
| `T2-F15-01` | F15 | Zero Glitch Intensity (0%) | Glitch intensity slider set to 0.0 | Compare output frame with input frame | Bit-for-bit identical (0 bytes altered); zero glitch artifacts introduced. |
| `T2-F15-02` | F15 | Maximum Glitch Intensity (100%) | Glitch intensity slider set to 1.0 | Inspect output byte values | Completely randomized 1-bit noise; output bytes strictly constrained within $[0x00, 0xFF]$. |
| `T2-F15-03` | F15 | Extreme Row Tear Displacement ($\Delta x = \pm 500\text{px}$) | Horizontal shift amount set to $+500$ or $-500$ | Evaluate pixel wrap: $x' = (x - \Delta x) \bmod 128$ | Shift wraps correctly modulo 128 ($500 \bmod 128 = 116$); zero array out-of-bounds error. |
| `T2-F15-04` | F15 | Out-of-Bounds Row Slice Range ($y_1 = -10, y_2 = 100$) | Row tearing range set beyond $[0, 63]$ | Check slice clamping in glitch engine | $y_1$ clamped to $0$, $y_2$ clamped to $63$; glitch contained within canvas scanline bounds. |
| `T2-F15-05` | F15 | Solid Color Frame Glitch Application | Apply XOR glitch to 100% black or 100% white frame | Inspect output buffer integrity | Produces valid stochastic 1-bit stipple noise; zero memory corruptions. |

---

### F16: Starfield & Particle Explosion (Boundaries)

| Test ID | Feature # | Test Name | Input | Verification Mechanism | Expected Output |
|---|---|---|---|---|---|
| `T2-F16-01` | F16 | Star Coordinate $Z$ Div-by-Zero Boundary | Star depth $Z$ reaches exact $0.0$ | Compute perspective projection: $X / Z$ | $Z$ clamped to $Z_{min} = 0.01$ or star respawned immediately; zero `Infinity` or `NaN` coordinate. |
| `T2-F16-02` | F16 | Zero Star Count Boundary ($N = 0$) | Starfield configuration with star count = 0 | Run simulation step | Renders blank black frame; zero loop execution error. |
| `T2-F16-03` | F16 | Maximum Star Density Stress Test ($N = 1000$) | Starfield configured with 1,000 stars | Benchmark simulation frame step | Completes within $< 2\text{ms}$; 128x64 display buffer handles overlapping points without crash. |
| `T2-F16-04` | F16 | Particle Explosion Origin Outside Viewport | Blast origin set to $(X_0 = -100, Y_0 = -50)$ | Run particle ballistic simulation | Particles entering viewport $(0..127, 0..63)$ rendered; out-of-bounds particles clipped cleanly. |
| `T2-F16-05` | F16 | Huge Delta-Time Step Ingestion ($\Delta t = 5.0\text{s}$) | Euler update called with large time delta | Monitor particle position updates | $\Delta t$ clamped to maximum $\Delta t_{max} = 0.1\text{s}$; prevents particles tunneling through space. |

---

### F17: Procedural Timeline Integration (Boundaries)

| Test ID | Feature # | Test Name | Input | Verification Mechanism | Expected Output |
|---|---|---|---|---|---|
| `T2-F17-01` | F17 | 0-Second Duration Sequence Baking | Bake procedural sequence with duration = 0.0s | Click "Bake to Timeline" | Validates duration $> 0$; rejects with warning `"Duration must be at least 0.1 seconds"`. |
| `T2-F17-02` | F17 | 1-Frame Procedural Timeline Generation | Duration = $0.033\text{s}$, FPS = 30 (1 frame) | Inspect baked timeline | Generates exactly 1 valid 1024-byte frame; timeline scrub bar locked to single frame. |
| `T2-F17-03` | F17 | High Frame Count Procedural Baking (1,800 Frames / 1.8 MB) | Duration = 60s at 30 FPS | Monitor async worker baking loop | Worker generates frames in chunks; emits progress updates; completes without browser lockup. |
| `T2-F17-04` | F17 | Overlay Duration Mismatch on Video | Video has 50 frames; procedural effect has 100 frames | Apply overlay effect | Compositing stops at frame 50 or pads video with freeze frame based on user selection. |
| `T2-F17-05` | F17 | Concurrent Bake Request Interruption | User triggers new bake while previous bake is running | Monitor background worker | Aborts previous worker task; starts new bake cleanly without corrupting memory store. |

---

### F18: PROGMEM Header Exporter (Boundaries)

| Test ID | Feature # | Test Name | Input | Verification Mechanism | Expected Output |
|---|---|---|---|---|---|
| `T2-F18-01` | F18 | Single Frame Export Boundary ($NUM\_FRAMES = 1$) | Single 1024-byte frame in studio | Trigger C++ export | Generates valid `reel_frames[1][1024] PROGMEM`; compiles cleanly with PlatformIO GCC. |
| `T2-F18-02` | F18 | Large Animation Export ($NUM\_FRAMES = 1,000$) | 1,000 frames (total 1,024,000 bytes) | Generate header string; measure length | Generates complete string ($\approx 6.5\text{ MB}$ source text) without memory allocation failure. |
| `T2-F18-03` | F18 | Empty Frame Store Export Attempt | Studio in empty state with 0 frames loaded | Click "Export C++ Header" | Export button disabled or modal displays `"No animation frames to export"`. |
| `T2-F18-04` | F18 | Special Characters in Project Name | Project named `"OLED & Animation <Test>"` | Generate header | Macro identifiers sanitized: `#ifndef OLED_ANIMATION_TEST_FRAMES_H` (no invalid C++ identifier chars). |
| `T2-F18-05` | F18 | Flash Memory Threshold Warning Trigger | Total frames = 500 ($512\text{ KB}$ flash); target MCU Arduino Uno (32KB Flash) | Check exporter flash warning logic | UI displays warning: `"Total size (512 KB) exceeds Arduino Uno flash (32 KB). Compatible with ESP32/ESP32-S3."` |

---

### F19: PackBits RLE Header Exporter (Boundaries)

| Test ID | Feature # | Test Name | Input | Verification Mechanism | Expected Output |
|---|---|---|---|---|---|
| `T2-F19-01` | F19 | Worst-Case High-Entropy Expansion Boundary | Alternating byte pattern `[0xAA, 0x55, 0xAA, 0x55...]` | Compress 1024-byte frame with PackBits | Evaluates compression; PackBits limits maximum overhead to $< 1\%$ (max 1033 bytes); falls back to literal. |
| `T2-F19-02` | F19 | Maximum Repeat Run Length Boundary ($> 128$ Bytes) | Sequence of 300 identical bytes `0x00` | Compress with PackBits | Splits into two repeat runs: length 128 (`-127`), length 128 (`-127`), and length 44 (`-43`). |
| `T2-F19-03` | F19 | All-Zero Frame Compression Ratio | 1024 bytes of `0x00` (black frame) | Measure compressed RLE output size | Compresses from 1024 bytes down to exactly 16 bytes ($98.4\%$ compression ratio). |
| `T2-F19-04` | F19 | Decompressor Buffer Truncation Safety | Corrupted RLE stream with repeated run expanding past 1024 bytes | Run `decompressRLE(in, out, 1024)` | Halts immediately when `outIdx == 1024`; prevents buffer overflow write into adjacent memory. |
| `T2-F19-05` | F19 | Offset Table Ascending Monotonicity Guard | Generate RLE header for 100 frames | Check array values: `frame_offsets[i] < frame_offsets[i+1]` | Offsets strictly ascending; all point to valid boundaries in `rle_data` byte array. |

---

### F20: 1-Click Code Copy & Download (Boundaries)

| Test ID | Feature # | Test Name | Input | Verification Mechanism | Expected Output |
|---|---|---|---|---|---|
| `T2-F20-01` | F20 | Insecure Context Clipboard API Absence | Execute in insecure context (`http://example.com`) | Click Copy Code | Falls back to hidden textarea DOM copy; successfully places text on clipboard. |
| `T2-F20-02` | F20 | User Clipboard Permission Denial | Browser blocks clipboard write permission | Catch permission rejection | Displays fallback UI with highlighted selectable code block: `"Press Ctrl+C to copy"`. |
| `T2-F20-03` | F20 | Special Characters in Download Filename | Filename containing `/ \ : * ? " < > \|` | Trigger download | Sanitizes filename to `frames.h` or `frames_clean.h`; download succeeds without OS file error. |
| `T2-F20-04` | F20 | Rapid Multi-Click Download Debounce | User rapidly clicks Download button 10 times in 200ms | Monitor Blob creation and anchor clicks | Debounces action; triggers exactly 1 clean download operation. |
| `T2-F20-05` | F20 | Object URL Revocation & Memory Cleanup | Download triggered via `URL.createObjectURL(blob)` | Verify `URL.revokeObjectURL(url)` call | URL revoked immediately after click event; prevents memory retention of downloaded Blobs. |

---

### F21: WebSerial Streamer (Boundaries)

| Test ID | Feature # | Test Name | Input | Verification Mechanism | Expected Output |
|---|---|---|---|---|---|
| `T2-F21-01` | F21 | Non-Chromium Browser Warning (Firefox/Safari) | User agent without WebSerial support (`navigator.serial === undefined`) | Evaluate UI connect panel | Connect button disabled; persistent banner explains WebSerial requirement and suggests Chrome/Edge. |
| `T2-F21-02` | F21 | Port Locked by Another Program (PlatformIO Monitor) | Port COM11 open in PlatformIO serial monitor | Click Connect in browser | Catches `DOMException` (Failed to open); displays toast: `"Port busy. Please close PlatformIO Serial Monitor."` |
| `T2-F21-03` | F21 | Sudden Physical Cable Disconnection Mid-Stream | Disconnect USB cable during active 30 FPS streaming | Observe serial writer and reader promises | Catches stream error; halts render loop; updates UI status to `Disconnected` without unhandled crash. |
| `T2-F21-04` | F21 | High-Speed 921600 Baud Hardware Bridge Incompatibility | USB-UART bridge that only supports up to 115200 baud | Attempt 921600 open | Open fails; UI prompts option: `"921600 baud failed. Fall back to standard 115200 baud?"`. |
| `T2-F21-05` | F21 | Multiple Serial Devices Connected | User has 2 ESP32 boards plugged into separate COM ports | Open port picker dialog | Dialog lists both devices; allows user to select intended target port. |

---

### F22: Binary Framing Protocol (Boundaries)

| Test ID | Feature # | Test Name | Input | Verification Mechanism | Expected Output |
|---|---|---|---|---|---|
| `T2-F22-01` | F22 | Truncated Packet Payload ($< 1024$ Bytes) | Packet with length header 1024, but only 500 bytes delivered | Feed to ESP32 parser | Parser pauses in `STATE_PAYLOAD`; 100ms watchdog expires and resets state to `STATE_MAGIC_0`. |
| `T2-F22-02` | F22 | Oversized Packet Length Header ($> 1024$ Bytes) | Packet with length header set to 2048 (`0x0800`) | Feed to ESP32 parser | Length exceeds `FRAME_BYTES` (1024); parser immediately resets to `STATE_MAGIC_0` without buffer overflow. |
| `T2-F22-03` | F22 | Single-Bit Corrupted Payload XOR Checksum | 1024-byte payload with single bit flipped (Bit 0 of Byte 500) | Receiver verifies checksum | Computed XOR does not match packet checksum byte; receiver emits `0x15 NAK` and discards frame. |
| `T2-F22-04` | F22 | Corrupted Checksum Byte in Transit | Valid packet payload, but checksum byte corrupted over serial wire | Receiver checks checksum | Checksum mismatch; receiver emits `0x15 NAK`; frame not drawn to OLED. |
| `T2-F22-05` | F22 | Invalid / Unknown Command Byte (`0xFF`) | Packet with command byte set to `0xFF` | Feed to ESP32 receiver | Packet parsed; command unrecognized; drops packet safely without state machine freeze. |

---

### F23: Stop-and-Wait ACK Flow Control (Boundaries)

| Test ID | Feature # | Test Name | Input | Verification Mechanism | Expected Output |
|---|---|---|---|---|---|
| `T2-F23-01` | F23 | Out-of-Order Sequence ID in Received ACK | Transmitted Packet Seq = 5; receiver sends ACK for Seq = 4 | Streamer inspects ACK sequence ID | Out-of-order ACK ignored; transmitter continues waiting for Seq 5 ACK until timeout. |
| `T2-F23-02` | F23 | Consecutive Dropped ACKs (3 In a Row) | 3 consecutive frame ACKs lost in transit | Observe streamer recovery | 150ms timeout fires for each; increments dropped frame count; recovers stream on next successful ACK. |
| `T2-F23-03` | F23 | Duplicate ACK Token Reception | Receiver sends duplicate `[0x06, 0x01]` twice | Streamer processes incoming serial bytes | First ACK releases frame; duplicate ACK handled idempotently without skipping subsequent frames. |
| `T2-F23-04` | F23 | Persistent Serial Noise / Continuous NAKs | Injected noise triggers 5 consecutive NAKs | Streamer error counter | Stream pauses automatically; alerts user: `"High serial noise detected. Check USB connection and baud rate."` |
| `T2-F23-05` | F23 | Extreme Round-Trip Latency Spike ($500\text{ms}$) | Simulated temporary I2C bus stall causes 500ms ACK delay | Streamer telemetry tracker | Paces frame transmission accordingly; lowers effective FPS without dropping frame synchronization. |

---

### F24: ESP32-S3 Dual-Mode Firmware (Boundaries)

| Test ID | Feature # | Test Name | Input | Verification Mechanism | Expected Output |
|---|---|---|---|---|---|
| `T2-F24-01` | F24 | Maximum Baud Rate RX Ring Buffer Saturation | Push continuous frames at 921600 baud with no ACK flow control | Monitor hardware UART buffer | 2048-byte expanded RX buffer absorbs temporary spikes; packet parser handles byte boundaries cleanly. |
| `T2-F24-02` | F24 | Mid-Packet 100ms Inactivity Timeout Reset | Inject `0xAA 0x55` header, followed by 105ms silence, then new frame | Inspect parser state | Watchdog resets parser to `STATE_MAGIC_0`; second packet parsed and rendered successfully. |
| `T2-F24-03` | F24 | Stream Disconnect Fallback Timer Precision (2000ms) | Active stream stopped; measure time until PROGMEM animation resumes | Monitor serial timestamps and display output | PROGMEM playback resumes at $t \in [2000, 2050]\text{ ms}$; loops seamlessly. |
| `T2-F24-04` | F24 | Long-Duration Standalone Loop (10,000 Cycles) | Let PROGMEM loop run continuously for 10,000 loop cycles | Monitor heap free memory via `ESP.getFreeHeap()` | Free heap memory remains completely constant ($< 1\text{ byte}$ variance); zero memory leak. |
| `T2-F24-05` | F24 | Brownout / Power Glitch Auto-Recovery | Induce temporary hardware reset / brownout | Monitor MCU reboot behavior | MCU boots cleanly into setup; initializes I2C and U8g2; resumes Standalone PROGMEM playback. |

---

### F25: SH1106 / SSD1306 Support (Boundaries)

| Test ID | Feature # | Test Name | Input | Verification Mechanism | Expected Output |
|---|---|---|---|---|---|
| `T2-F25-01` | F25 | SH1106 Leftmost Column Edge Artifact Guard | Render vertical line at column $x = 0$ on SH1106 | Verify RAM column mapping | Line maps to RAM column 2; columns 0 and 1 receive 0; zero visual edge glitch. |
| `T2-F25-02` | F25 | SSD1306 Full 128-Column Utilization | Render vertical lines at $x = 0$ and $x = 127$ on SSD1306 | Verify physical panel display | Both boundary lines visible at outer physical edges of display; zero truncation. |
| `T2-F25-03` | F25 | Disconnected Display I2C Bus NACK Handling | Power on MCU without OLED connected to I2C pins 8 & 9 | Monitor firmware execution | `u8g2.sendBuffer()` returns I2C error; firmware continues non-blocking loop without freezing. |
| `T2-F25-04` | F25 | High-Speed 800kHz Fast-Mode Plus I2C | Configure `u8g2.setBusClock(800000)` on capable display | Measure frame transfer duration | Transfer time drops from $\approx 24.3\text{ ms}$ to $\approx 12.2\text{ ms}$; display renders without bus errors. |
| `T2-F25-05` | F25 | Display Hot-Plug Recovery | Unplug and replug OLED display I2C header while firmware is running | Observe display initialization | Display re-initializes on next `u8g2.begin()` or periodic refresh cycle; resumes showing active frame. |

---

### F26: E2E Suite Infrastructure (Boundaries)

| Test ID | Feature # | Test Name | Input | Verification Mechanism | Expected Output |
|---|---|---|---|---|---|
| `T2-F26-01` | F26 | Injected Test Assertion Failure Reporting | Intentionally modify test assertion to fail (`expect(1).toBe(2)`) | Run test runner CLI | Runner reports failure clearly with file and line number; exits with non-zero exit code (`1`). |
| `T2-F26-02` | F26 | Test Execution Timeout Watchdog | Test scenario contains infinite `while(true)` loop | Test runner per-test timeout guard | Test runner terminates hung test after 5000ms; marks test as TIMED_OUT; proceeds to next test. |
| `T2-F26-03` | F26 | Runner Memory Boundedness Under 270 Tests | Execute all 270 test cases in single CLI run | Measure Node.js / Python memory consumption | Peak process RSS memory remains $< 250\text{ MB}$; zero runaway garbage accumulation. |
| `T2-F26-04` | F26 | Missing Test Fixture Directory Graceful Failure | Temporarily rename `test/fixtures/` to `test/fixtures_bak/` | Run test runner CLI | Runner emits clear diagnostic: `"Test fixtures missing. Run fixture generator first."`; exits cleanly. |
| `T2-F26-05` | F26 | Mixed Windows / POSIX Path Separators | Pass test paths with mixed separators: `test\e2e/tier1\test_f01.js` | Test runner path resolver | Path normalized via `path.normalize()` or `pathlib.Path`; executes target test correctly. |

---

### F27: Adversarial Hardening (Boundaries)

| Test ID | Feature # | Test Name | Input | Verification Mechanism | Expected Output |
|---|---|---|---|---|---|
| `T2-F27-01` | F27 | Continuous High-Speed 0xFF Sync Byte Flooding | Stream continuous `0xFF 0xFF 0xFF...` for 60 seconds | Monitor serial parser state | Parser ignores non-`0xAA` bytes; zero buffer overrun; memory and CPU load remain nominal. |
| `T2-F27-02` | F27 | Repeated Magic 1 Without Magic 2 Flooding | Stream continuous `0xAA 0xAA 0xAA 0xAA...` | Monitor state transitions | Parser loops between `STATE_MAGIC_0` and `STATE_MAGIC_1` safely; never advances to header without `0x55`. |
| `T2-F27-03` | F27 | Sudden Baud Rate Mismatch Injection | Host sends 115200 baud stream while ESP32 is set to 921600 baud | Inspect received byte stream | Framing errors detected by UART; random garbage discarded by parser checksum; zero false draws. |
| `T2-F27-04` | F27 | Fuzzing Packet Length Header Extremes | Packets with length header `0x0000`, `0x0001`, `0xFFFF` | Feed to packet validator | All non-1024 lengths rejected by length boundary check; no invalid memory read or allocation. |
| `T2-F27-05` | F27 | Extreme 1-Hour Continuous Stress Soak Test | Continuous 30 FPS stream (108,000 frames) over high-speed serial | Monitor Web Studio & MCU health over 1 hour | Zero dropped serial frames with ACK flow control; zero heap leak; display remains perfectly responsive. |

---

## 4. Test Harness Implementation Mapping & CLI Execution

### 4.1 CLI Test Runner Command Mapping
The test specifications defined in Sections 2 and 3 can be executed directly via the project CLI runner without browser dependencies:

```powershell
# 1. Execute all Tier 1 Feature Coverage Tests (135 tests)
node test/e2e/runner.js --tier 1
# or via Python:
py -m pytest test/e2e/test_tier1_features.py -v

# 2. Execute all Tier 2 Boundary & Corner Cases Tests (135 tests)
node test/e2e/runner.js --tier 2
# or via Python:
py -m pytest test/e2e/test_tier2_boundaries.py -v

# 3. Execute Complete E2E Suite (Tiers 1 & 2 -> 270 tests)
node test/e2e/runner.js --all
```

### 4.2 Automated Verification Oracles
- **Dithering & Packing Oracle**: Pure algorithmic implementation comparing output 1024-byte arrays against known reference bit vectors.
- **Protocol Oracle**: In-memory duplex stream simulating ESP32 UART parser (`0xAA 0x55`, XOR checksum, ACK token).
- **C++ Compiler Oracle**: PlatformIO CLI invocation (`~/.platformio/penv/Scripts/platformio.exe run`) testing exported `src/frames.h` headers.
- **Image Geometry Oracle**: Canvas pixel coordinate validation asserting $2:1$ aspect ratio, Cover, Contain, and Stretch layouts.

---
*Report compiled by explorer_e2e_2_r1. All 270 test specifications ready for test suite implementation.*
