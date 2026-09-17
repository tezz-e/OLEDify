# Comprehensive E2E Specification Report: Tier 3 Combinations & Tier 4 Real-World Scenarios

**Project**: Web-based OLED Visual Animation Engine & Converter  
**Document**: E2E Testing Track — Tier 3 & Tier 4 Specification  
**Agent Identity**: `spec_miner_e2e_3_r1`  
**Working Directory**: `D:\espprojects\oled\.agents\spec_miner_e2e_3_r1`  
**Date**: 2026-09-18  
**Authoritative Sources**:
- `D:\espprojects\oled\.agents\ORIGINAL_REQUEST.md`
- `D:\espprojects\oled\PROJECT.md`
- `D:\espprojects\oled\convert_reel.py`
- `D:\espprojects\oled\src\main.cpp`
- `D:\espprojects\oled\platformio.ini`
- Explorer Surveys 1, 2, and 3 (`.agents/explorer_survey_*/analysis.md`)

---

## 1. Executive Summary

This specification establishes the authoritative testing matrix for **Tier 3 (Cross-Feature Combinations)** and **Tier 4 (Real-World Application Scenarios)** of the OLED Visual Animation Engine & Converter. While Tier 1 validates isolated feature functionality and Tier 2 stresses single-feature boundary conditions, Tier 3 and Tier 4 validate system integrity under multi-component interactions and end-to-end creator workflows.

### Coverage Targets Achieved
- **Tier 3 (Cross-Feature Combinations)**: 30 fully specified test cases (exceeding $\ge 27$ requirement) covering pairwise and N-way combinatorial interactions across ingestion codecs, crop transforms, dithering kernels, bit packing, procedural synthesizers, binary serial protocols, hardware flow control, and firmware state machines.
- **Tier 4 (Real-World Application Scenarios)**: 14 end-to-end creator workflows (satisfying $\ge 14$ requirement) detailing exact user actions, intermediate data transformations, hardware communications, firmware compilation checks, and measurable acceptance criteria.
- **Traceability**: 100% coverage of features F01 through F27 defined in `PROJECT.md`.

---

## 2. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Ingestion | MP4 / WebM Ingestion | HTML5 video element extraction using sequential seek and offscreen canvas | `.mp4`, `.webm` file blobs | Sequence of raw RGBA image buffers | Unsupported codec triggers format error banner | `ORIGINAL_REQUEST.md` R1; `PROJECT.md` F02 |
| 2 | Ingestion | Animated GIF Decoding | Multi-frame GIF extraction parsing delays, disposal modes (0, 1, 2, 3) via `omggif` | `.gif` binary buffer | Array of RGBA frames with per-frame timestamps | Corrupt header displays warning alert | `PROJECT.md` F03; Survey 2 |
| 3 | Ingestion | PNG Sequence Loader | Batch multi-file ingestion with natural alphanumeric collation | Array of `File` objects | Sequentially ordered frame array | Non-image files filtered out with toast | `PROJECT.md` F04; Survey 2 |
| 4 | Geometry | 2:1 Crop & Scale | Fixed 2:1 aspect ratio bounding box with Cover, Contain, Stretch presets | Source dimensions $(W, H)$, crop sub-rect | Rescaled $128 \times 64$ RGBA buffer | Clamped to source bounds without aspect distortion | `PROJECT.md` F05; `convert_reel.py` |
| 5 | Processing | Luminance Adjustment | Grayscale luminance conversion (ITU-R BT.601) with Brightness & Contrast sliders | Grayscale buffer, $B \in [-100, 100]$, $C \in [-100, 100]$ | Normalized luminance array $[0, 255]$ | Values strictly clamped to $[0, 255]$ | `PROJECT.md` F06; Survey 2 |
| 6 | Dithering | Atkinson Diffusion | 6-neighbor error diffusion kernel (divisor 8) with 25% error discard | Grayscale luminance array | 1-bit quantized pixel array | Boundary checks prevent buffer overflow | `PROJECT.md` F07; Survey 2 |
| 7 | Dithering | Floyd-Steinberg | 4-neighbor classic error diffusion kernel (divisor 16) with 100% error diffusion | Grayscale luminance array | 1-bit quantized pixel array | Clamping prevents runaway error bleeding | `PROJECT.md` F08; `convert_reel.py` |
| 8 | Dithering | Bayer Ordered Matrix | Deterministic spatial threshold matrices ($2\times 2, 4\times 4, 8\times 8$) for flicker-free playback | Grayscale buffer, matrix size $N$ | 1-bit quantized pixel array | Modulo indexing wraps coordinates safely | `PROJECT.md` F09; Survey 2 |
| 9 | Dithering | Dynamic Thresholding | Binary cutoff thresholding with adjustable cutoff value ($0\dots 255$) | Grayscale buffer, cutoff $T$ | 1-bit quantized pixel array | Default cutoff 128 if undefined | `PROJECT.md` F10; `convert_reel.py` |
| 10 | Formatting | XBMP 1024B Packing | Row-major, 16 bytes/row, LSB-first bit packing matching U8g2 `drawXBMP` | 1-bit $128\times 64$ pixel array | Exact 1024-byte `Uint8Array` | Non-$128\times 64$ inputs throw RangeError | `PROJECT.md` F11; `main.cpp` |
| 11 | Display | Simulated OLED Canvas | $128\times 64$ canvas rendering with authentic sub-pixel gaps and phosphor themes | 1024-byte frame buffer, theme | 2D canvas output with glow effect | Null buffer clears display to dark background | `PROJECT.md` F12; Survey 2 |
| 12 | Playback | Timeline & FPS Pacing | Transport controls (play/pause, step, loop, scrub) and 15–30 FPS selector | User gestures, target FPS | Frame index updates via rAF loop | Out-of-bounds frames clamped to $[0, N-1]$ | `PROJECT.md` F13; Survey 2 |
| 13 | Procedural | Typewriter & Lyric Bounce | Generative text reveal with typing speed (CPS) and elastic spring bounce physics | String, CPS, spring tension | 1-bit $128\times 64$ frame sequence | Word wrapping prevents text clipping | `PROJECT.md` F14; Survey 3 |
| 14 | Procedural | Monochrome Glitch FX | 1-bit procedural glitch: XOR bitwise noise, horizontal row tearing, scanline flips | Frame buffer, intensity, seed | Corrupted 1-bit frame buffer | Preserves row boundaries $[0, 63]$ | `PROJECT.md` F15; Survey 3 |
| 15 | Procedural | 3D Starfield & Particles | 3D warp perspective starfield and radial ballistic particle burst simulation | Star count, warp speed, burst trigger | 1-bit generative particle buffer | Division by zero avoided by $Z \ge 0.1$ clamp | `PROJECT.md` F16; Survey 3 |
| 16 | Procedural | Timeline Ingestion | Direct integration of procedural generative sequences into studio timeline | Procedural config & duration | Seamless timeline frame array | Memory leak guard for unbounded generation | `PROJECT.md` F17; Survey 3 |
| 17 | Exporter | PROGMEM C++ Exporter | Generate `src/frames.h` with `reel_frames[NUM_FRAMES][1024]` PROGMEM array | Array of 1024B frames, FPS | C++ header string / file | Warns if size exceeds target MCU flash | `PROJECT.md` F18; `frames.h` |
| 18 | Exporter | PackBits RLE Exporter | Compressed byte-level RLE format with inline ~15-line C++ decompressor | Array of 1024B frames | C++ header with offset table + RLE stream | Fallback to literal if RLE expands frame | `PROJECT.md` F19; Survey 3 |
| 19 | Exporter | 1-Click Copy & Download | Instant clipboard copy and direct `.h` file download | Header string buffer | Clipboard write / `.h` file download | Fallback to execCommand if API restricted | `PROJECT.md` F20; Survey 3 |
| 20 | WebSerial | USB Connection Manager | WebSerial port acquisition, 921600 baud configuration, port status UI | User click gesture, baud rate | Open `SerialPort` instance | Throws friendly error if COM port locked | `PROJECT.md` F21; Survey 3 |
| 21 | WebSerial | Binary Framing Protocol | OLED-Stream v1: `0xAA 0x55`, CMD, SeqID, Length, 1024B Payload, XOR Checksum | Frame buffer, sequence counter | 1031-byte serialized binary packet | Checksum mismatch triggers NAK `0x15` | `PROJECT.md` F22; Survey 3 |
| 22 | WebSerial | Stop-and-Wait ACK Flow | Backpressure handshake: ESP32 sends `0x06 [Seq]` upon completing I2C draw | Serial input stream | Frame dispatch release / pacing | 150ms timeout drops stale frame, resyncs | `PROJECT.md` F23; Survey 1 & 3 |
| 23 | Firmware | Dual-Mode State Machine | Serial streaming receiver (2KB buffer) + standalone PROGMEM looping fallback | Incoming UART bytes / millis() | SH1106 / SSD1306 display refresh | Watchdog (2000ms) reverts to standalone | `PROJECT.md` F24; Survey 1 |
| 24 | Hardware | SH1106 / SSD1306 Support | Fast 400kHz I2C bus driver with 2-pixel column shift correction for SH1106 | 1024B frame buffer, panel type | Physical I2C signals on SDA=8, SCL=9 | Wrong driver produces 2px horizontal offset | `PROJECT.md` F25; `main.cpp` |
| 25 | Testing | E2E Automated Suite | Multi-tier automated testing covering isolated, boundary, and scenario cases | Test CLI commands, fixtures | Machine-readable test reports | Exit code non-zero on assertion failure | `PROJECT.md` F26; sub_orch_e2e |
| 26 | Testing | Adversarial Hardening | White-box stress testing, corrupt payload fuzzing, memory leak bounds | Corrupt packets, rapid disconnects | System stability verification | Unhandled exceptions captured & logged | `PROJECT.md` F27; sub_orch_e2e |

---

## 3. Edge Cases & Cross-Boundary Behaviors

| # | Cross-Feature Interaction | Stress Input / Condition | Observed Behavior & Authoritative Requirement |
|---|---------------------------|--------------------------|------------------------------------------------|
| 1 | MP4 $\times$ Crop $\times$ Memory | 4K 60 FPS MP4 ($3840\times 2160$) loaded with 2:1 Cover Crop | Directly decoding 4K frames into uncompressed RGBA consumes >2.5 GB RAM. Web decoder MUST downsample during canvas draw to an intermediate buffer ($\le 256\times 128$) before cropping and dithering. |
| 2 | GIF $\times$ Dither $\times$ Disposal | Animated GIF with Disposal Mode 3 (Restore to Previous) | Standard canvas blit corrupts subsequent frames. Decoder must maintain a historical canvas snapshot and revert canvas state prior to compositing the next frame before dithering. |
| 3 | PNG Sequence $\times$ Collation | Unordered files: `frame_1.png`, `frame_10.png`, `frame_2.png` | Standard lexical sort produces wrong animation order (`1, 10, 2`). Must enforce natural alphanumeric sorting (`localeCompare({ numeric: true })`) yielding `1, 2, 10`. |
| 4 | Atkinson $\times$ Boundary Clamping | Bright white pixels along rightmost ($x=126, 127$) and bottom ($y=62, 63$) borders | Atkinson distributes error 2 pixels ahead $(x+2)$ and 2 rows down $(y+2)$. Kernel must strictly clamp neighbor coordinates or check bounds to prevent out-of-bounds array writes. |
| 5 | RLE $\times$ Floyd-Steinberg | High-entropy error-diffused video frames subjected to PackBits RLE | High-frequency 1-bit stippling contains virtually zero byte-identical runs. Naive RLE would expand file size. Exporter must enforce PackBits fallback: if compressed size $\ge 1024$ bytes, store literal frame. |
| 6 | WebSerial $\times$ Baud Rate | 30 FPS streaming attempted at 115200 baud | 1024-byte payload at 115200 baud takes 89.5 ms to transmit over UART. Max theoretical FPS is 11.1. At 30 FPS, hardware FIFO overflows immediately. System must require 921600 baud or warn user of frame dropping. |
| 7 | WebSerial $\times$ I2C Blocking | Browser transmits next frame before ESP32 completes `u8g2.sendBuffer()` | `u8g2.sendBuffer()` blocks ESP32 CPU for ~24.3 ms at 400 kHz I2C. Without Stop-and-Wait ACK flow control, incoming serial data overflows the 256B/2048B UART RX ring buffer. Host MUST wait for `0x06` ACK before dispatching frame $N+1$. |
| 8 | Protocol $\times$ Mid-Stream Sync | WebSerial connection opens while ESP32 is receiving data mid-payload | ESP32 parser must stay in `STATE_MAGIC_0` until sync preamble `0xAA 0x55` is detected. Stray bytes are safely discarded without desynchronizing frame alignment. |
| 9 | Checksum $\times$ Retransmit | Injected single-bit corruption in payload byte 512 | ESP32 detects XOR checksum mismatch, discards buffer, and transmits NAK `0x15 [SeqID]`. Host catches NAK and retransmits frame without freezing the pipeline. |
| 10 | Watchdog $\times$ Fallback | USB cable detached while in live 30 FPS streaming mode | ESP32 receiver detects absence of valid packets for $> 2000\text{ ms}$. Firmware state machine autonomously transitions from `MODE_STREAMING` to `MODE_STANDALONE`, resuming loop of embedded PROGMEM `reel_frames`. |
| 11 | Display Controller Mismatch | SH1106 display driven with SSD1306 initialization commands | SH1106 internal RAM is $132\times 64$ with display offset at column 2. Driving it with SSD1306 causes image to shift left by 2 pixels, and column 0–1 contains random power-on RAM noise. Firmware must correctly set 2-pixel column offset. |
| 12 | Starfield $\times$ Projection | Star coordinate $Z$ reaches zero ($Z \le 0$) | Perspective projection calculation $X/Z$ causes IEEE 754 division by zero / NaN. Projection math must enforce $Z_{min} = 0.1$ or immediately respawn star at $Z_{max}$. |

---

## 4. Tier 3: Cross-Feature Combinations Specification

Below is the exhaustive specification of **30 combinatorial test cases** spanning all major feature pairs and pipelines.

```
+-------------------------------------------------------------------------------------------------------------------------------+
|                                            TIER 3 COMBINATORIAL TEST SUITE INDEX                                              |
+---------+-----------------------------------+-----------------------------------+---------------------------------------------+
| Test ID | Primary Feature Pair / Triad      | Pipeline Path                     | Focus Objective                             |
+---------+-----------------------------------+-----------------------------------+---------------------------------------------+
| T3-01   | F02 × F07 × F11 × F21             | MP4 -> Atkinson -> XBMP -> Serial | Video stream over 921600 baud WebSerial     |
| T3-02   | F02 × F08 × F11 × F18             | WebM -> Floyd-Steinberg -> Header | Video compilation into C++ PROGMEM          |
| T3-03   | F03 × F09 × F19 × F20             | GIF -> Bayer 4x4 -> RLE -> DL     | Compressed RLE export from animated GIF     |
| T3-04   | F04 × F06 × F10 × F21             | PNGs -> Brightness/Cutoff -> Ser  | Contrast-boosted PNG sequence to serial     |
| T3-05   | F14 × F15 × F12 × F18             | Typewriter -> Glitch -> Header    | Kinetic text with XOR noise to frames.h     |
| T3-06   | F16 × F15 × F13 × F21             | Starfield -> Tearing -> 15 FPS    | Generative sci-fi FX streamed at 15 FPS     |
| T3-07   | F05 × F07 × F22 × F23             | Contain Crop -> Atkinson -> ACK   | Letterbox video streaming with Stop-and-Wait|
| T3-08   | F22 × F23 × F24                   | Checksum Corrupt -> NAK -> Retran | Binary packet error recovery & retransmit   |
| T3-09   | F21 × F24 × F18                   | Serial Drop -> Watchdog -> Flash  | 2000ms timeout fallback to standalone loop  |
| T3-10   | F03 × F05 × F08 × F12             | GIF Dispose 2 -> Cover -> FS      | Disposal mode composite & Cyan OLED preview |
| T3-11   | F04 × F05 × F09 × F19             | Natural Sort PNG -> Bayer 8x8     | Alphanumeric sort to PackBits RLE header    |
| T3-12   | F14 × F17 × F13 × F20             | Lyric Bounce -> Timeline -> Copy  | Procedural lyric timeline scrub & copy      |
| T3-13   | F16 × F17 × F11 × F25             | Particle Burst -> XBMP -> SH1106  | Ballistic physics to 400kHz I2C display     |
| T3-14   | F06 × F08 × F12 × F13             | Invert Polarity -> Yellow/Blue    | Negative polarity on dual-phosphor display  |
| T3-15   | F02 × F06 × F09 × F22             | 4K MP4 -> Boost -> Bayer 2x2      | Downsampling 4K reel into OLED-Stream v1    |
| T3-16   | F03 × F07 × F18 × F24             | Var-Delay GIF -> Atkinson -> Pio  | Timing-normalized GIF to PlatformIO build   |
| T3-17   | F14 × F16 × F12                   | Lyric Reveal + 3D Warp Starfield  | Multi-layer procedural composite on canvas  |
| T3-18   | F15 × F22 × F25                   | Scanline Slip -> Packet -> SSD1306| Rolling glitch to SSD1306 0-pixel offset    |
| T3-19   | F05 × F10 × F19 × F24             | Interactive Crop -> Threshold     | Manual crop pan/zoom to inline decompressor|
| T3-20   | F04 × F07 × F13 × F21             | 200 PNGs -> Atkinson -> 24 FPS    | Long sequence streaming pacing verification |
| T3-21   | F02 × F05 × F11 × F20             | Vertical WebM -> Cover -> Copy    | 9:16 video center-crop to clipboard copy   |
| T3-22   | F14 × F15 × F17 × F21             | Karaoke Highlight -> XOR -> Serial| Beat-synced lyric invert + glitch streaming |
| T3-23   | F09 × F11 × F22 × F25             | Bayer 4x4 -> 1024B -> SH1106 2px  | I2C timing & 2px column shift verification  |
| T3-24   | F08 × F19 × F20                   | High-Entropy FS -> RLE Guard      | PackBits anti-expansion fallback verification|
| T3-25   | F16 × F15 × F18 × F24             | Ballistic Burst -> Row Tear -> Pio| Generative explosion to firmware compilation |
| T3-26   | F03 × F04 × F05 × F12             | Mixed Drag-Drop -> Contain -> Green| Mixed ingestion handling & Matrix Green theme|
| T3-27   | F21 × F22 × F23 × F24             | Connect/Disconnect/Reconnect Cycle| Port cycling stress & buffer leak prevention |
| T3-28   | F06 × F10 × F11 × F22             | Extreme Contrast -> Threshold      | High-contrast binary serialization check    |
| T3-29   | F14 × F13 × F21 × F23             | Typewriter CPS -> Scrub -> Serial  | Interactive scrub while streaming live      |
| T3-30   | F07 × F12 × F25                   | Atkinson -> OLED Grid -> Dual Panel| Pixel grid emulation vs physical bitmapping |
+---------+-----------------------------------+-----------------------------------+---------------------------------------------+
```

---

### Detailed Test Specifications (T3-01 to T3-30)

#### Test T3-01: MP4 Video -> Atkinson Dither -> XBMP Packing -> WebSerial 921600 Baud Stream
- **Features Tested**: F02 (Video Decoder) $\times$ F07 (Atkinson) $\times$ F11 (XBMP Packing) $\times$ F21 (WebSerial) $\times$ F22 (Framing Protocol).
- **Inputs**: File `igexport-DckvRqKPsI_.mp4` (720x1280, 30 FPS, 466 frames), Crop Mode = `Cover` (2:1 center crop), Dither = `Atkinson`, Baud = `921600`.
- **Execution Steps**:
  1. Load MP4 file blob; extract frame 0 at timestamp $t=0.0\text{s}$.
  2. Crop center 720x360 region and downscale to 128x64 using bilinear interpolation.
  3. Apply Atkinson dithering: 6-neighbor diffusion (divisor 8), discarding 25% quantization error.
  4. Pack resulting $128\times 64$ boolean array into 1024-byte row-major LSB-first `Uint8Array`.
  5. Construct OLED-Stream v1 packet: `[0xAA, 0x55, 0x01, 0x00, 0x00, 0x04, <1024 bytes>, CS]`.
  6. Dispatch packet over mock WebSerial stream at 921600 baud.
- **Expected Outputs**:
  - Packet byte length is exactly 1031 bytes.
  - Byte 0..1 = `0xAA 0x55`; Byte 2 = `0x01`; Byte 3 = `0x00`; Byte 4..5 = `0x00 0x04` (1024 LE).
  - Checksum equals XOR sum of command, sequence, length bytes, and all 1024 payload bytes.
- **Pass/Fail Criteria**:
  - Exact 1031 bytes emitted. Checksum byte valid. Mock receiver reports zero parity/framing errors. Packet transmit duration $\le 12.0\text{ ms}$.
- **Error Handling**: If video seek stalls $>500\text{ms}$, dispatch retry event; abort stream gracefully if decode fails.

#### Test T3-02: WebM Video -> Floyd-Steinberg Dither -> XBMP Packing -> C++ PROGMEM Header
- **Features Tested**: F02 (Video Decoder) $\times$ F08 (Floyd-Steinberg) $\times$ F11 (XBMP Packing) $\times$ F18 (PROGMEM Exporter).
- **Inputs**: Synthetic 3-second WebM file (1280x720, 24 FPS, 72 frames), Crop Mode = `Contain` (pillarbox), Dither = `Floyd-Steinberg`, Target = `src/frames.h`.
- **Execution Steps**:
  1. Decode WebM container; extract 72 frames at $\Delta t = 1/24\text{s}$.
  2. Scale to $128\times 64$ preserving aspect ratio with black pillarbox borders on left/right.
  3. Run Floyd-Steinberg error diffusion kernel (divisor 16, 100% error distributed).
  4. Pack each frame into 1024 bytes.
  5. Generate C++ header text containing `#define NUM_FRAMES 72` and `reel_frames[72][1024] PROGMEM`.
- **Expected Outputs**:
  - Header file contains valid C++ syntax with `#pragma once` or `#ifndef FRAMES_H`.
  - Array dimension `[72][1024]`.
  - Every byte formatted as `0xXX` hexadecimal string.
- **Pass/Fail Criteria**:
  - Header string compiles with `gcc -c` or `clang -fsyntax-only`. Macro definitions match constants: `FRAME_WIDTH == 128`, `FRAME_HEIGHT == 64`, `FRAME_SIZE_BYTES == 1024`.
- **Error Handling**: If total frames $>1000$, emit flash memory warning badge before generation.

#### Test T3-03: Animated GIF -> Bayer 4x4 Ordered Dither -> PackBits RLE Exporter -> 1-Click Download
- **Features Tested**: F03 (GIF Decoder) $\times$ F09 (Bayer Dither) $\times$ F19 (PackBits Exporter) $\times$ F20 (Download Interface).
- **Inputs**: Sample animated GIF (64 frames, 100ms frame delay), Dither = `Bayer 4x4`, Exporter = `PackBits RLE`.
- **Execution Steps**:
  1. Parse GIF using `omggif`; extract frame delays and decode RGBA pixels.
  2. Map grayscale luminance against static $4\times 4$ Bayer matrix thresholds.
  3. Pack frames into 1024-byte XBMP buffers.
  4. Pass buffers to PackBits RLE compressor; generate compressed stream and offset lookup table.
  5. Trigger browser file download with blob `frames_rle.h`.
- **Expected Outputs**:
  - Download blob MIME type is `text/x-c++hdr;charset=utf-8`.
  - File contains `decompressRLE()` function and `rle_data[]` array.
- **Pass/Fail Criteria**:
  - Total compressed size $< 65,536\text{ bytes}$ ($<1024\text{ bytes/frame}$). Roundtrip decompress matches raw XBMP bit-for-bit.
- **Error Handling**: If RLE compression results in expansion for any frame, frame is stored with literal tag ($n \ge 0$).

#### Test T3-04: PNG Sequence -> Brightness/Contrast Adjustment -> Dynamic Thresholding -> WebSerial Stream
- **Features Tested**: F04 (PNG Sequence) $\times$ F06 (Brightness/Contrast) $\times$ F10 (Thresholding) $\times$ F21 (WebSerial).
- **Inputs**: 30 PNG files (128x64 each), Brightness = `+20`, Contrast = `+30`, Cutoff Threshold = `140`, Baud = `921600`.
- **Execution Steps**:
  1. Load 30 PNGs; sort naturally using `localeCompare`.
  2. Compute contrast factor $F = \frac{259(C' + 255)}{255(259 - C')}$ where $C' = 30 \times 2.55 = 76.5$.
  3. Apply $Y' = \text{clamp}(F(Y - 128) + 128 + 51, 0, 255)$.
  4. Quantize: $Q = (Y' \ge 140) ? 1 : 0$. Pack into 1024-byte buffer.
  5. Stream 30 packets sequentially to WebSerial port with sequence IDs $0\dots 29$.
- **Expected Outputs**:
  - High-contrast binary image with crisp silhouettes and zero diffuse stippling.
  - 30 distinct packets delivered with incrementing sequence IDs.
- **Pass/Fail Criteria**:
  - Sequence ID counter increments monotonically modulo 256. Zero NaN or infinite values in luminance transform.
- **Error Handling**: If a PNG fails decoding, skip that frame and notify UI without terminating stream.

#### Test T3-05: Typewriter Lyric -> XOR Bitwise Glitch -> Simulated OLED Canvas -> PROGMEM Header
- **Features Tested**: F14 (Typewriter Lyric) $\times$ F15 (Glitch FX) $\times$ F12 (Simulated OLED) $\times$ F18 (PROGMEM Exporter).
- **Inputs**: Text string `"OLED CYBER ENGINE"`, CPS = `12`, Glitch FX = `XOR Noise (intensity 15%)`, Display Theme = `Crisp White`.
- **Execution Steps**:
  1. Render typewriter text reveal over 60 frames.
  2. For each frame, generate LFSR pseudo-random noise mask and apply bitwise XOR: $\text{byte} \leftarrow \text{byte} \oplus (\text{noise} \ \& \ 0x1F)$.
  3. Render to simulated OLED canvas using 4x scale factor and 1px sub-pixel grid gap.
  4. Export all 60 frames to `src/frames.h`.
- **Expected Outputs**:
  - Visual canvas shows typewriter font with digital glitch speckles.
  - Header contains 60 frames of 1024 bytes.
- **Pass/Fail Criteria**:
  - Canvas pixel pitch matches $4\times 4$ block with 1px black border. Generated header compiles cleanly.
- **Error Handling**: Glitch intensity clamped to $[0, 100]\%$.

#### Test T3-06: 3D Warp Starfield -> Horizontal Row Tearing -> 15 FPS Timeline -> WebSerial
- **Features Tested**: F16 (Starfield) $\times$ F15 (Glitch FX) $\times$ F13 (Timeline Controls) $\times$ F21 (WebSerial).
- **Inputs**: Star count = 100, Warp Speed = 60, Row Tearing = Rows 20..30 shifted by +8 pixels, Target FPS = 15.
- **Execution Steps**:
  1. Run 3D perspective projection: $x = 64 + X/Z \cdot f_x, y = 32 + Y/Z \cdot f_y$.
  2. Draw Bresenham streak lines between previous and current star coordinates.
  3. Displace rows 20 through 30 horizontally by +8 pixels modulo 128.
  4. Set playback timeline to 15 FPS ($\Delta t = 66.6\text{ ms}$).
  5. Stream frames to WebSerial port pacing at 15 FPS.
- **Expected Outputs**:
  - Starfield streaks emit radially from $(64, 32)$ with a glitch tear across rows 20..30.
  - Inter-packet interval measured at $66.6 \pm 2.0\text{ ms}$.
- **Pass/Fail Criteria**:
  - Packet transmission interval is $66.6\text{ ms} \pm 5\%$. No star coordinates produce out-of-bounds array writes.
- **Error Handling**: Stars with $Z \le 0.1$ respawn at $Z=100$.

#### Test T3-07: 2:1 Contain (Letterbox) Crop -> Atkinson Dither -> Binary Framing -> Stop-and-Wait ACK Flow Control
- **Features Tested**: F05 (Crop & Scale) $\times$ F07 (Atkinson) $\times$ F22 (Framing Protocol) $\times$ F23 (Flow Control).
- **Inputs**: Square image source ($500\times 500$), Crop Mode = `Contain` (letterbox: black bars on top/bottom rows 0..7 and 56..63), Dither = `Atkinson`.
- **Execution Steps**:
  1. Scale $500\times 500$ down to $128\times 48$, centered in $128\times 64$ canvas (top margin = 8, bottom margin = 8).
  2. Rows 0..7 and 56..63 filled with solid black (`0x00`).
  3. Dither rows 8..55 using Atkinson algorithm. Pack into 1024 bytes.
  4. Host sends Packet $N$ (Seq = $N$). Host halts transmission and awaits ACK.
  5. Simulated ESP32 executes `u8g2.sendBuffer()` (simulated 24ms delay), then returns `0x06 [Seq=N]`.
  6. Host receives `0x06 [Seq=N]` and immediately releases Packet $N+1$.
- **Expected Outputs**:
  - Bytes 0..127 and 896..1023 of payload are all `0x00` (letterbox bars).
  - Perfect lockstep transmission: exactly 1 packet in-flight at any instant.
- **Pass/Fail Criteria**:
  - Zero UART RX overflow. Pacing strictly bound by ESP32 ACK response time ($24\text{ ms} + \text{UART transfer} \approx 35\text{ ms} \implies 28.5\text{ FPS}$).
- **Error Handling**: If ACK times out ($>150\text{ms}$), host re-sends packet or increments dropped-frame metric.

#### Test T3-08: Corrupted Packet -> 0x15 NAK Response -> Retransmit -> Draw
- **Features Tested**: F22 (Framing Protocol) $\times$ F23 (Flow Control) $\times$ F24 (Dual-Mode Firmware).
- **Inputs**: Frame Packet with Sequence ID = `0x42`. Bit 0 of payload byte 100 inverted during transmission.
- **Execution Steps**:
  1. Host serializes 1031-byte frame with calculated checksum $CS_{valid}$.
  2. Inject bit error: `payload[100] ^= 0x01`. Transmit over serial.
  3. ESP32 parser calculates running XOR checksum on incoming packet.
  4. Compare running checksum with received $CS_{valid}$. Checksum mismatch detected!
  5. ESP32 discards frame buffer, does NOT call `u8g2.sendBuffer()`, and replies with `[0x15, 0x42]` (NAK).
  6. Host receives `0x15`, retrieves uncorrupted frame for Seq `0x42` from cache, and retransmits.
  7. ESP32 receives uncorrupted retransmission, validates checksum, renders frame, and replies with `[0x06, 0x42]` (ACK).
- **Expected Outputs**:
  - NAK byte `0x15` emitted by receiver.
  - Retransmitted packet has identical Seq `0x42`.
  - Display buffer updated only after valid checksum received.
- **Pass/Fail Criteria**:
  - Corrupted frame never displayed on screen. Retransmission succeeds within $<30\text{ ms}$. Display integrity 100%.
- **Error Handling**: Maximum 3 retransmission attempts before skipping frame to preserve real-time sync.

#### Test T3-09: Serial Timeout (2000ms) -> Standalone Fallback PROGMEM Loop
- **Features Tested**: F21 (WebSerial) $\times$ F24 (Dual-Mode Firmware) $\times$ F18 (PROGMEM Header).
- **Inputs**: ESP32 running in `MODE_STREAMING`. Host stream terminated abruptly (simulating browser tab close or cable disconnect).
- **Execution Steps**:
  1. ESP32 receives valid stream frames at 30 FPS for 2 seconds (`MODE_STREAMING` active).
  2. Host ceases transmission. Serial line idles.
  3. ESP32 watchdog checks: `millis() - lastValidPacketTime > 2000`.
  4. Watchdog expires. State transitions: `MODE_STREAMING -> MODE_STANDALONE`.
  5. Firmware resumes looping embedded PROGMEM `reel_frames[0..NUM_FRAMES-1]` at 30 FPS.
- **Expected Outputs**:
  - Screen does not remain frozen on last received serial frame.
  - Embedded animation loops continuously starting from frame 0.
- **Pass/Fail Criteria**:
  - Fallback triggers within $2000\text{ ms} \pm 50\text{ ms}$ of last byte. No memory leaks or MCU resets occur.
- **Error Handling**: If a new packet header `0xAA 0x55` arrives while in standalone loop, firmware immediately transitions back to `MODE_STREAMING`.

#### Test T3-10: Animated GIF with Disposal Method 2 -> Cover Center Crop -> Floyd-Steinberg -> OLED Cyan Phosphor
- **Features Tested**: F03 (GIF Decoder) $\times$ F05 (Crop) $\times$ F08 (Floyd-Steinberg) $\times$ F12 (OLED Canvas).
- **Inputs**: Animated GIF with transparent background and Disposal Mode 2 (Restore to Background), Theme = `Classic Cyan`.
- **Execution Steps**:
  1. Parse GIF frame chunks; detect disposal mode 2 on frame $i$.
  2. Clear frame buffer bounding rect to transparent black before compositing frame $i+1$.
  3. Crop 2:1 center window; downscale to $128\times 64$.
  4. Quantize using Floyd-Steinberg dither.
  5. Render to simulated OLED canvas using Cyan palette (`#00f0ff` lit pixels, `#0a0e14` unlit pads).
- **Expected Outputs**:
  - No artifact ghosting or dirty frame trails from previous frames.
  - Cyan phosphor rendering with bloom shadow.
- **Pass/Fail Criteria**:
  - Disposed sub-rectangles match background color in next frame. Zero accumulation artifacts.
- **Error Handling**: Corrupt disposal tags default to Mode 1 (Leave in place).

#### Test T3-11: PNG Sequence Natural Alphanumeric Sorting -> Stretch Crop -> Bayer 8x8 Matrix -> PackBits RLE Header
- **Features Tested**: F04 (PNG Sequence) $\times$ F05 (Crop) $\times$ F09 (Bayer Dither) $\times$ F19 (PackBits Exporter).
- **Inputs**: Files `anim_1.png`, `anim_2.png`, `anim_10.png`, `anim_20.png` (dimensions $200\times 150$), Mode = `Stretch`, Dither = `Bayer 8x8`.
- **Execution Steps**:
  1. Ingest files in random OS order; sort using alphanumeric natural collation.
  2. Rescale $200\times 150$ directly to $128\times 64$ ignoring original aspect ratio.
  3. Quantize via $8\times 8$ normalized Bayer threshold matrix.
  4. Compress byte stream using PackBits RLE.
  5. Generate `frames_rle.h`.
- **Expected Outputs**:
  - Sorted order: `anim_1.png` (index 0), `anim_2.png` (index 1), `anim_10.png` (index 2), `anim_20.png` (index 3).
  - Stretched image fills entire $128\times 64$ resolution.
- **Pass/Fail Criteria**:
  - Natural sort verified (`anim_10` is after `anim_2`). Header file contains correct 4-frame offset table.
- **Error Handling**: Non-conforming filenames sort at end of list.

#### Test T3-12: Bounce Lyric Kinetic Typography -> Procedural Timeline Ingestion -> Scrub & Step Controls -> 1-Click Copy
- **Features Tested**: F14 (Typewriter & Bounce) $\times$ F17 (Procedural Timeline) $\times$ F13 (Playback Controls) $\times$ F20 (Clipboard Copy).
- **Inputs**: Lyric line `"NEON DREAMS"`, spring tension = 0.8, damping = 0.6, duration = 30 frames.
- **Execution Steps**:
  1. Synthesize kinetic drop using $\text{easeOutBounce}(t)$.
  2. Populate studio timeline with 30 generated $128\times 64$ XBMP frames.
  3. Scrub to frame index 15; step forward by 1 frame to index 16.
  4. Click "Copy C++ Code" button.
- **Expected Outputs**:
  - Frame 15 and 16 show progressive vertical bounce positions.
  - Clipboard receives C++ header text containing all 30 frames.
- **Pass/Fail Criteria**:
  - Clipboard string length matches standard header format (~180 KB for 30 frames). Timeline scrub updates display in $<5\text{ ms}$.
- **Error Handling**: Clipboard API denial triggers fallback to hidden textarea selection.

#### Test T3-13: Radial Ballistic Particle Burst -> Procedural Timeline Integration -> XBMP Packing -> SH1106 Fast I2C Bus Transfer
- **Features Tested**: F16 (Particle Burst) $\times$ F17 (Timeline Integration) $\times$ F11 (XBMP Packing) $\times$ F25 (SH1106 Support).
- **Inputs**: 50 particles from center $(64, 32)$, gravity $g = +25\text{ px/s}^2$, drag $\mu = 0.95$, lifespan = 1.2s (36 frames).
- **Execution Steps**:
  1. Integrate particle physics using semi-implicit Euler integration: $v_y \leftarrow (v_y + g \Delta t)\mu, y \leftarrow y + v_y \Delta t$.
  2. Render particles on 1-bit canvas; dither fading particles based on remaining life.
  3. Convert 36 frames into XBMP row-major LSB-first arrays.
  4. Transmit to ESP32-S3 driving SH1106 over 400 kHz Fast I2C.
- **Expected Outputs**:
  - Particles burst radially and arc downward under gravity.
  - SH1106 correctly renders frames with 2-pixel column offset without side-clipping.
- **Pass/Fail Criteria**:
  - Transfer time over 400 kHz I2C is $24.3 \pm 1.0\text{ ms}$ per frame. Display is centered with zero distortion.
- **Error Handling**: Dead particles ($\text{life} \le 0$) removed from simulation pool.

#### Test T3-14: Luminance Inversion + High Contrast -> Floyd-Steinberg -> OLED Yellow/Blue Split Display -> 30 FPS Playback
- **Features Tested**: F06 (Brightness/Contrast) $\times$ F08 (Floyd-Steinberg) $\times$ F12 (OLED Display) $\times$ F13 (Playback Controls).
- **Inputs**: Video frame with grayscale gradient, Invert = `true`, Contrast = `+50`, Theme = `Yellow/Blue Dual Display`, FPS = 30.
- **Execution Steps**:
  1. Apply contrast stretch, then invert: $Y_{final} = 255 - Y'$.
  2. Diffuse error with Floyd-Steinberg kernel.
  3. Render on simulated Yellow/Blue OLED: rows 0..15 in Amber Yellow (`#ffcc00`), row 16 forced black, rows 17..63 in Sky Blue (`#00e5ff`).
  4. Run animation at 30 FPS via requestAnimationFrame loop.
- **Expected Outputs**:
  - Inverted polarity (black becomes white, white becomes black).
  - Distinct yellow header and blue body with unlit row 16 separator.
- **Pass/Fail Criteria**:
  - Row 16 pixels are strictly zero/black in rendered canvas. Frame interval delta is $33.3 \pm 2\text{ ms}$.
- **Error Handling**: Frame delta $>1000\text{ms}$ (tab backgrounding) flushes delta accumulator.

#### Test T3-15: High-Resolution 4K MP4 Ingestion -> Brightness Boost (+40) -> Bayer 2x2 Dither -> 1031-Byte OLED-Stream v1 Framing
- **Features Tested**: F02 (Video Decoder) $\times$ F06 (Brightness/Contrast) $\times$ F09 (Bayer Dither) $\times$ F22 (Framing Protocol).
- **Inputs**: 4K MP4 ($3840\times 2160$), Brightness = `+40`, Dither = `Bayer 2x2`.
- **Execution Steps**:
  1. Ingest 4K video blob; draw video frame directly into intermediate downscaled $256\times 128$ offscreen canvas.
  2. Crop center 2:1 rect ($256\times 128$) and downscale to $128\times 64$.
  3. Add brightness offset $+40$ to luminance array.
  4. Apply $2\times 2$ Bayer threshold matrix: $\begin{bmatrix} 0 & 2 \\ 3 & 1 \end{bmatrix}$.
  5. Pack into 1024 bytes and frame as 1031-byte OLED-Stream v1 packet.
- **Expected Outputs**:
  - Memory consumption stays $<150\text{ MB}$ during downscale.
  - Serialized packet length exactly 1031 bytes.
- **Pass/Fail Criteria**:
  - Heap memory does not exceed browser tab safety limit. Packet checksum valid.
- **Error Handling**: If video canvas context crashes, throw `OutOfMemoryError` and suggest lower resolution source.

#### Test T3-16: Animated GIF with Variable Delays -> Atkinson Dither -> C++ PROGMEM Export -> Dual-Mode Firmware Flash Compilation
- **Features Tested**: F03 (GIF Decoder) $\times$ F07 (Atkinson) $\times$ F18 (PROGMEM Exporter) $\times$ F24 (Firmware).
- **Inputs**: GIF with mixed delays (frame 0: 100ms, frame 1: 50ms, frame 2: 200ms), Dither = `Atkinson`.
- **Execution Steps**:
  1. Normalize variable frame delays to fixed 20 FPS quanta ($\Delta t = 50\text{ ms}$), replicating frames as required.
  2. Dither with Atkinson. Export header `src/frames.h`.
  3. Run PlatformIO build command: `pio run -e esp32-s3-devkitc-1`.
- **Expected Outputs**:
  - Header defines normalized frame array.
  - PlatformIO builds `firmware.elf` cleanly with exit code 0.
- **Pass/Fail Criteria**:
  - `pio run` returns exit code 0. Flash memory usage $\le 75\%$ of 16MB partition.
- **Error Handling**: If flash size exceeded, flag build failure and recommend downsampling.

#### Test T3-17: Typewriter Lyric Reveal Overlaid with 3D Warp Starfield -> Amber Phosphor OLED Canvas
- **Features Tested**: F14 (Typewriter) $\times$ F16 (Starfield) $\times$ F12 (Simulated OLED).
- **Inputs**: Text `"HYPERDRIVE ENGAGED"`, 60 Stars at speed 50, Display Theme = `Amber / Orange`.
- **Execution Steps**:
  1. Render 3D starfield layer to buffer 1.
  2. Render typewriter text layer with black outline or opaque bounding box to buffer 2.
  3. Composite: $\text{buffer} \leftarrow \text{buffer1} \lor \text{buffer2}$.
  4. Draw on simulated OLED with Amber phosphor palette (`#ffb000`).
- **Expected Outputs**:
  - Starfield streams behind crisp typewriter characters.
  - Canvas renders with amber glow.
- **Pass/Fail Criteria**:
  - Text remains legible over star streaks. Canvas color matches `#ffb000` with 1px grid gap.
- **Error Handling**: Text bounds checked against canvas width to prevent character clipping.

#### Test T3-18: Rolling Scanline V-SYNC Glitch -> OLED-Stream v1 Packet Delivery -> SSD1306 Full Frame Refresh
- **Features Tested**: F15 (Glitch FX) $\times$ F22 (Framing Protocol) $\times$ F25 (SSD1306 Support).
- **Inputs**: 8-pixel inverted rolling horizontal bar moving at 2 px/frame, Controller = `SSD1306`.
- **Execution Steps**:
  1. For row $y \in [y_{bar}, y_{bar}+7]$, invert bytes: $\text{byte} \leftarrow \text{byte} \oplus 0xFF$.
  2. Wrap $y_{bar} \leftarrow (y_{bar} + 2) \pmod{64}$.
  3. Serialize into OLED-Stream v1 binary packet.
  4. Receive on ESP32 configured for SSD1306 (column addressing $0\dots 127$).
- **Expected Outputs**:
  - Rolling inverted horizontal band simulates analog CRT V-SYNC slip.
  - SSD1306 displays frame starting at column 0 without 2-pixel rightward shift.
- **Pass/Fail Criteria**:
  - Entire 128 columns illuminated without static noise on columns 0–1 or truncation on columns 126–127.
- **Error Handling**: If controller flag unknown, default to SSD1306.

#### Test T3-19: Custom Interactive Crop Box Pan/Zoom -> Dynamic Thresholding (Cutoff=160) -> PackBits RLE Compression -> Embedded C++ Decompressor Execution
- **Features Tested**: F05 (Crop Tool) $\times$ F10 (Thresholding) $\times$ F19 (PackBits Exporter) $\times$ F24 (Firmware Receiver).
- **Inputs**: High-res logo ($1000\times 1000$), user drags crop box to $(x=200, y=300, w=400, h=200)$, Threshold = 160.
- **Execution Steps**:
  1. Extract sub-rect $(200, 300, 400, 200)$ maintaining $2:1$ aspect ratio.
  2. Resample to $128\times 64$. Apply threshold cutoff 160.
  3. Pack into 1024 bytes and compress via PackBits RLE.
  4. Execute embedded C++ decompressor `decompressRLE()` on compressed buffer.
  5. Compare decompressed output against original 1024-byte uncompressed buffer.
- **Expected Outputs**:
  - Compressed stream size is $<200\text{ bytes}$ for solid vector logo ($>80\%$ compression).
  - Decompressed buffer matches original uncompressed buffer bit-for-bit ($100\%$ match).
- **Pass/Fail Criteria**:
  - `memcmp(decompBuffer, origBuffer, 1024) == 0`. Zero memory leaks in decompressor.
- **Error Handling**: Crop box boundary clamped if user drags beyond $[0, W_{src}], [0, H_{src}]$.

#### Test T3-20: 200-Frame PNG Sequence -> Atkinson Dither -> 24 FPS Timeline Pacing -> Pipelined WebSerial Streaming
- **Features Tested**: F04 (PNG Sequence) $\times$ F07 (Atkinson) $\times$ F13 (Timeline) $\times$ F21 (WebSerial).
- **Inputs**: 200 numbered PNG frames, Dither = `Atkinson`, FPS = `24` ($\Delta t = 41.67\text{ ms}$), Baud = `921600`.
- **Execution Steps**:
  1. Batch convert 200 PNG frames to Atkinson XBMP format.
  2. Initiate WebSerial stream at 24 FPS pacing.
  3. Monitor sequence IDs, ACK arrival times, and frame drops over entire 200-frame run.
- **Expected Outputs**:
  - Total elapsed streaming time: $200 \times 41.67\text{ ms} \approx 8.33\text{ seconds}$.
  - Zero dropped frames, zero timeout exceptions.
- **Pass/Fail Criteria**:
  - Dropped frames count $= 0$. Max jitter on frame dispatch interval $\le 3.5\text{ ms}$.
- **Error Handling**: If an ACK is delayed, browser holds next frame until ACK arrives or 100ms timeout expires.

#### Test T3-21: Vertical 9:16 WebM Reel -> 2:1 Cover Aspect Crop -> 1024-Byte XBMP Packing -> 1-Click Code Copy to Clipboard
- **Features Tested**: F02 (Video Decoder) $\times$ F05 (Crop) $\times$ F11 (XBMP Packing) $\times$ F20 (Code Copy).
- **Inputs**: WebM vertical reel ($1080\times 1920$, 9:16), Mode = `Cover` (center crop: $1080\times 540$ at $y=690$).
- **Execution Steps**:
  1. Automatically calculate Cover crop: $W_{crop} = 1080, H_{crop} = 540, X_{crop} = 0, Y_{crop} = (1920 - 540)/2 = 690$.
  2. Downscale to $128\times 64$, pack into 1024 bytes.
  3. Format into `frames.h` text.
  4. Call `navigator.clipboard.writeText()`.
- **Expected Outputs**:
  - Video centered vertically without horizontal stretching or pillarbox bars.
  - Clipboard contains well-formed C++ header.
- **Pass/Fail Criteria**:
  - Crop rectangle aspect ratio is strictly 2.0. Clipboard text contains valid `#define NUM_FRAMES`.
- **Error Handling**: If clipboard access denied by browser permissions, fallback to modal copy text box.

#### Test T3-22: Karaoke Inverted Beat Highlight -> XOR Glitch Noise -> Procedural Timeline Export -> 921600 Baud WebSerial Stream
- **Features Tested**: F14 (Lyric Engine) $\times$ F15 (Glitch FX) $\times$ F17 (Timeline Export) $\times$ F21 (WebSerial).
- **Inputs**: Lyric line with 4 words, beat triggers on frame 0, 15, 30, 45, active word inverted (white box / black text), periodic XOR glitch on beat change.
- **Execution Steps**:
  1. Generate 60 frames of kinetic lyrics with inverse video bounding box on current active word.
  2. Inject 3 frames of XOR bitwise noise on each beat transition.
  3. Export to timeline; stream live over WebSerial at 921600 baud.
- **Expected Outputs**:
  - Active word highlights cleanly with inverted polarity.
  - Glitch flash coincides with musical beat transition.
- **Pass/Fail Criteria**:
  - Visual beat synchronization maintained. Serial streaming maintains steady 30 FPS.
- **Error Handling**: Text inversion bounds strictly clamped to character glyph dimensions.

#### Test T3-23: Bayer 4x4 Ordered Dither -> 1024-Byte XBMP Stream -> 400 kHz Fast I2C Bus Transfer -> SH1106 2-Pixel Offset Calibration
- **Features Tested**: F09 (Bayer Dither) $\times$ F11 (XBMP Packing) $\times$ F22 (Framing Protocol) $\times$ F25 (SH1106 Support).
- **Inputs**: Static test pattern (alternating vertical stripes), Dither = `Bayer 4x4`, Controller = `SH1106`.
- **Execution Steps**:
  1. Generate test pattern buffer; quantize via Bayer 4x4 matrix.
  2. Transmit packet over serial protocol.
  3. ESP32 receives frame, writes to SH1106 internal RAM at page addresses with column offset $+2$.
  4. Inspect physical display pixels at columns $0\dots 1$ and $126\dots 127$.
- **Expected Outputs**:
  - Test pattern is centered horizontally on the 128-column active view.
  - Columns 0 and 127 match intended bitmap pixels.
- **Pass/Fail Criteria**:
  - 2-pixel horizontal shift verified. No residual uninitialized RAM noise visible.
- **Error Handling**: If SSD1306 is detected instead, offset set to 0.

#### Test T3-24: High-Entropy Floyd-Steinberg Dither -> PackBits RLE Fallback Guard -> Header File Download
- **Features Tested**: F08 (Floyd-Steinberg) $\times$ F19 (PackBits Exporter) $\times$ F20 (Download Interface).
- **Inputs**: Heavy television static noise frame dithered with Floyd-Steinberg (high entropy, zero byte runs).
- **Execution Steps**:
  1. Compute Floyd-Steinberg dither on noise texture.
  2. Attempt PackBits RLE compression.
  3. Verify compressor detects compressed size $> 1024$ bytes and triggers literal fallback encoding.
  4. Generate and download `frames_rle.h`.
- **Expected Outputs**:
  - Compressed frame size is capped at 1025 bytes (1 header byte $+ 1024$ literal bytes).
  - Decompressor handles literal block correctly.
- **Pass/Fail Criteria**:
  - Compressed size does not exceed 1025 bytes per frame. Roundtrip decompress matches original byte-for-byte.
- **Error Handling**: Fallback activates automatically per frame without user intervention.

#### Test T3-25: Ballistic Particle Explosion with Gravity/Drag -> Horizontal Row Tearing Shift -> C++ frames.h Generation -> ESP32-S3 Flash Verification
- **Features Tested**: F16 (Particle Burst) $\times$ F15 (Glitch FX) $\times$ F18 (PROGMEM Exporter) $\times$ F24 (Dual-Mode Firmware).
- **Inputs**: Radial explosion (80 particles) + Row tearing on scanlines 40..48 ($\Delta x = -12\text{ px}$), 90 frames.
- **Execution Steps**:
  1. Simulate 90 frames of particle explosion with row tearing glitch.
  2. Export `src/frames.h`.
  3. Compile firmware using PlatformIO CLI: `pio run`.
  4. Inspect firmware binary memory map in `.pio/build/esp32-s3-devkitc-1/firmware.map`.
- **Expected Outputs**:
  - Header generated with `NUM_FRAMES = 90`.
  - Flash consumption increases by exactly $90 \times 1024 = 92,160\text{ bytes}$ ($90\text{ KB}$).
- **Pass/Fail Criteria**:
  - `pio run` exits with code 0. Binary size verified in map file.
- **Error Handling**: Clean compilation error message if syntax corrupted.

#### Test T3-26: Mixed Drag-and-Drop Ingestion (GIF + PNG Sequence) -> Contain Letterbox -> Simulated OLED Matrix Green Phosphor
- **Features Tested**: F03 (GIF) $\times$ F04 (PNG Sequence) $\times$ F05 (Crop) $\times$ F12 (Simulated OLED).
- **Inputs**: User drops an animated GIF followed by 10 PNG frames into the drop zone. Theme = `Matrix Green`.
- **Execution Steps**:
  1. DropZone component inspects dropped MIME types.
  2. Prompts user or prioritizes primary media format; decodes selected stream cleanly.
  3. Scale with Contain letterbox mode.
  4. Display on OLED canvas with Matrix Green phosphor palette (`#00ff66`).
- **Expected Outputs**:
  - Clean ingestion without unhandled exception.
  - Authentic green phosphor CRT/OLED appearance.
- **Pass/Fail Criteria**:
  - No uncaught JavaScript exceptions. Canvas renders green pixels with phosphor persistence styling.
- **Error Handling**: If mixed formats dropped simultaneously, UI displays format selection dialog.

#### Test T3-27: Rapid WebSerial Connect/Disconnect/Reconnect Cycles -> Zero Buffer Leakage -> Handshake Ping 0x04 -> Clean Resync
- **Features Tested**: F21 (WebSerial) $\times$ F22 (Framing Protocol) $\times$ F23 (Flow Control) $\times$ F24 (Dual-Mode Firmware).
- **Inputs**: WebSerial streamer subjected to 10 rapid open/close cycles in 5 seconds.
- **Execution Steps**:
  1. Open WebSerial port; send Ping packet (`CMD 0x04`).
  2. Verify ESP32 replies with ACK `0x06`.
  3. Close port; immediately reopen port and repeat 10 times.
  4. Send video frame packet.
- **Expected Outputs**:
  - Port acquires and releases locks cleanly.
  - Receiver state machine flushes partial buffers upon port close.
  - Final frame packet renders successfully without reboot.
- **Pass/Fail Criteria**:
  - All 10 pings receive ACK within $<50\text{ ms}$. Zero memory leaks on ESP32 or browser side.
- **Error Handling**: Port lock contention caught with toast: "Port busy, retrying...".

#### Test T3-28: Extreme Contrast (+100) -> Dynamic Threshold Cutoff -> 1024-Byte LSB-First XBMP Packing -> Binary Packet Serialization
- **Features Tested**: F06 (Contrast) $\times$ F10 (Thresholding) $\times$ F11 (XBMP Packing) $\times$ F22 (Framing Protocol).
- **Inputs**: Contrast = `+100` ($C' = 255$, factor $F \approx 32.7$), Cutoff = `128`.
- **Execution Steps**:
  1. Compute contrast curve: denominator $(259 - C') = 4$. Extreme gain applied.
  2. Clamp output strictly to $[0, 255]$.
  3. Apply cutoff at 128; pack into 1024 bytes.
  4. Serialize into OLED-Stream v1 binary packet.
- **Expected Outputs**:
  - Pixels are strictly 0 or 255 with zero intermediate float noise or overflow wrap-around.
  - LSB-first bit packing preserves left-to-right orientation.
- **Pass/Fail Criteria**:
  - Zero integer overflow artifacts (e.g. 256 wrapping to 0). Packet checksum valid.
- **Error Handling**: Math clamp $\min(255, \max(0, Y'))$ prevents numerical instability.

#### Test T3-29: Text Typewriter CPS Adjustment -> Playback Timeline Scrubbing -> Real-Time WebSerial Frame Pacing via Stop-and-Wait ACK
- **Features Tested**: F14 (Typewriter) $\times$ F13 (Timeline Scrubbing) $\times$ F21 (WebSerial) $\times$ F23 (Flow Control).
- **Inputs**: User adjusts typing speed slider from 10 CPS to 30 CPS while scrub bar is dragged interactively during an active WebSerial stream.
- **Execution Steps**:
  1. Begin WebSerial stream of typewriter animation.
  2. User changes CPS slider to 30; dynamically scrub timeline cursor across frames.
  3. WebSerial streamer dispatches scrubbed frames synchronously waiting for ACK.
- **Expected Outputs**:
  - Immediate responsive display of scrubbed frame on physical OLED.
  - No desynchronization or command queue explosion.
- **Pass/Fail Criteria**:
  - Stream updates frame within $<45\text{ ms}$ of scrub event. No dropped ACKs or hung connection.
- **Error Handling**: Previous pending un-sent scrub requests are collapsed (debounced) to latest frame.

#### Test T3-30: Atkinson Dithered Line Art -> Sub-Pixel Grid Canvas Emulation with Bloom Filter -> Dual Driver Hardware SSD1306/SH1106 Bit-Exact Alignment
- **Features Tested**: F07 (Atkinson) $\times$ F12 (Simulated OLED) $\times$ F25 (Hardware Driver Support).
- **Inputs**: High-frequency geometric line art, Atkinson dithered, rendered to simulated canvas and physical displays.
- **Execution Steps**:
  1. Dither geometric art with Atkinson.
  2. Render to simulated OLED canvas with sub-pixel grid gaps (pitch 4, pixel width 3, gap 1).
  3. Transmit to physical SH1106 and SSD1306 test benches.
  4. Extract frame buffer readbacks and compare against canvas bit buffer.
- **Expected Outputs**:
  - Canvas sub-pixel grid matches physical OLED emitter pad geometry.
  - Physical display renders 1:1 bit-identical pattern without distortion.
- **Pass/Fail Criteria**:
  - Canvas bit state and hardware display buffer match $100\%$ across all 8,192 pixels.
- **Error Handling**: Alignment error triggers automatic column offset recalibration.

---

## 5. Tier 4: Real-World Application Scenarios Specification

This section details **14 comprehensive, end-to-end user workflows** covering all creator personas, input media, procedural synthesis modes, streaming pipelines, and firmware compilation workflows.

```
+----------------------------------------------------------------------------------------------------------------------------------+
|                                           TIER 4 REAL-WORLD SCENARIO SUITE INDEX                                                 |
+-------------+-------------------------------------------------------------+------------------------------------------------------+
| Scenario ID | Title / User Workflow                                       | Key Systems / Features Exercised                     |
+-------------+-------------------------------------------------------------+------------------------------------------------------+
| Scenario 01 | Instagram Reel Video to PlatformIO Firmware Compilation     | F02, F05, F08, F11, F18, F24 (`igexport-DckvRqKPsI_`)|
| Scenario 02 | Aseprite Pixel Art GIF to PackBits RLE Header Compression   | F03, F07, F12, F13, F19, F20 (Lossless RLE Roundtrip)|
| Scenario 03 | Procedural Kinetic Typography & WebSerial Streaming         | F14, F17, F21, F22, F23 (Stop-and-Wait 30 FPS Pacing)|
| Scenario 04 | Generative Sci-Fi Starfield & Row-Tearing Glitch Export     | F16, F15, F06, F18, F24 (PlatformIO Flash Loop)      |
| Scenario 05 | Procreate Hand-Drawn Animation PNG Sequence Ingestion       | F04, F05, F09, F12, F13 (Natural Sort & Bayer 8x8)   |
| Scenario 06 | High-Contrast Vector Logo Video Conversion & Code Copy      | F02, F10, F06, F11, F20 (Threshold Cutoff & Copy)    |
| Scenario 07 | Live DJ/VJ Performance with Dynamic Dither Switching        | F07, F08, F09, F21, F23 (Mid-Stream Zero-Lag Toggle) |
| Scenario 08 | Serial Noise Resistance & Corrupted Packet NAK Recovery     | F21, F22, F23, F24 (XOR Checksum & Retransmission)   |
| Scenario 09 | Hardware USB Disconnect & Standalone Watchdog Fallback      | F21, F22, F24, F18 (2000ms Timeout Watchdog)         |
| Scenario 10 | Dual Display Panel Hardware Switching (SH1106 vs SSD1306)   | F24, F25, F22 (2-Pixel Column Shift Calibration)     |
| Scenario 11 | Long-Form Video Ingestion & Flash Budget Optimization       | F02, F13, F19, F20 (15 FPS Decimation & RLE Header)  |
| Scenario 12 | Retro Pixel Art Game Asset with Nearest-Neighbor Downscaling| F02, F05, F10, F12 (Pixel Art Nearest-Neighbor Mode) |
| Scenario 13 | Karaoke Lyric Video with Beat Inversion & Dual-Color OLED   | F14, F15, F12, F17 (Yellow/Blue Phosphor Simulation) |
| Scenario 14 | Ballistic Radial Particle Burst Benchmark & Timing Budget   | F16, F21, F22, F23 (30 FPS Multi-Stage Timing Budget)|
+-------------+-------------------------------------------------------------+------------------------------------------------------+
```

---

### Detailed Scenario Specifications (Scenario 01 to Scenario 14)

#### Scenario 01: Instagram Reel Video Ingestion to PlatformIO Firmware Compilation
- **User Persona**: Hardware Creator / Maker creating an autonomous video reel display for their desk.
- **Preconditions**:
  - Test video fixture `igexport-DckvRqKPsI_.mp4` present in project root ($720\times 1280$, 30 FPS, 466 frames, 15.53s duration).
  - PlatformIO environment configured with `esp32-s3-devkitc-1` board.
- **Step-by-Step Execution**:
  1. User drags `igexport-DckvRqKPsI_.mp4` onto the Web Studio DropZone.
  2. UI decodes video metadata: detects $720\times 1280$ resolution, 30 FPS, 466 total frames.
  3. Interactive CropTool activates: user selects `Cover` preset (2:1 center crop: $x=0, y=460, w=720, h=360$).
  4. User selects `Floyd-Steinberg` dithering and sets Brightness = 0, Contrast = 0.
  5. User previews video playback at 30 FPS on Simulated OLED Player; scrubs through timeline.
  6. User clicks "Export C++ Header" -> downloads `src/frames.h`.
  7. Automated test runner places generated `src/frames.h` into `src/` and invokes `pio run`.
- **Expected Data Artifacts & Output**:
  - `src/frames.h` defines:
    ```cpp
    #define NUM_FRAMES 466
    #define FRAME_WIDTH 128
    #define FRAME_HEIGHT 64
    #define FRAME_BYTES_PER_ROW 16
    #define FRAME_SIZE_BYTES 1024
    #define FRAME_FPS 30
    const uint8_t reel_frames[466][1024] PROGMEM = { ... };
    ```
  - Total array footprint: $466 \times 1024 = 477,184\text{ bytes}$ (~466 KB).
  - PlatformIO CLI execution: `pio run` builds `firmware.elf` with exit code 0.
- **Pass/Fail Acceptance Criteria**:
  - `pio run` returns exit code 0.
  - Flash memory usage $\le 850\text{ KB}$ of 16MB partition ($<6\%$).
  - Header byte layout matches `convert_reel.py` output.

#### Scenario 02: Aseprite Pixel Art Animation to PackBits RLE Header Compression
- **User Persona**: Pixel Artist converting hand-crafted Aseprite animations into ultra-compact microcontroller firmware.
- **Preconditions**:
  - Animated GIF asset (`pixel_boss_idle.gif`: 80 frames, $128\times 64$, 20 FPS, line art with large uniform black regions).
- **Step-by-Step Execution**:
  1. User imports `pixel_boss_idle.gif` via Drag & Drop.
  2. `omggif` extracts all 80 frames and timestamps.
  3. User selects `Atkinson` dithering to preserve sharp pixel line-art edges without gray worm noise.
  4. User previews playback at 20 FPS on simulated OLED canvas with Crisp White theme.
  5. User opens Code Exporter and selects format `PackBits RLE Compressed (*.h)`.
  6. Exporter compresses 80 frames, generating `frame_offsets[80]` table and `rle_data[]` stream.
  7. User clicks "Download Header", saving `src/frames_rle.h`.
  8. Automated test verifies decompressor routine `decompressRLE()` by decompressing all 80 frames in memory and comparing against raw uncompressed XBMP arrays.
- **Expected Data Artifacts & Output**:
  - Uncompressed size: $80 \times 1024 = 81,920\text{ bytes}$ (80 KB).
  - Compressed size: $\le 24,576\text{ bytes}$ ($\le 24\text{ KB}$, $>70\%$ compression ratio).
  - Bit-exact match across all $80 \times 1024 = 81,920$ decompressed bytes.
- **Pass/Fail Acceptance Criteria**:
  - `memcmp(decompressedFrame, originalFrame, 1024) == 0` for all $i \in [0, 79]$.
  - Zero heap allocations (`malloc`/`new`) inside C++ `decompressRLE()` function.

#### Scenario 03: Procedural Kinetic Typography & WebSerial Live Streaming
- **User Persona**: Live Visual Performer / VJ streaming dynamic song lyrics to an ESP32-S3 OLED pendant over USB.
- **Preconditions**:
  - ESP32-S3 connected to host machine on serial COM port (or simulated WebSerial receiver loopback).
  - Firmware running OLED-Stream v1 receiver at 921600 baud.
- **Step-by-Step Execution**:
  1. User opens Procedural Studio tab in Web UI.
  2. Enters lyric text: `"NEVER GONNA GIVE YOU UP / NEVER GONNA LET YOU DOWN"`.
  3. Configures Typewriter speed = 15 CPS and enables "Lyric Bounce" physics.
  4. Previews generated 120-frame animation on Simulated OLED Canvas.
  5. Clicks "Connect Hardware" button; browser WebSerial dialog pairs with ESP32-S3 at 921600 baud.
  6. Clicks "Stream Live"; browser starts dispatching frames at 30 FPS using Stop-and-Wait ACK handshake.
  7. Stream runs continuously for 120 frames (~4 seconds).
- **Expected Data Artifacts & Output**:
  - Host transmits 120 sequential OLED-Stream v1 packets (`CMD 0x01`, Seq $0\dots 119$).
  - Receiver responds with 120 ACKs (`[0x06, Seq]`).
  - WebSerial monitor shows: `FPS: 29.8 - 30.0`, `Dropped Frames: 0`, `Avg Latency: 32 ms`.
- **Pass/Fail Acceptance Criteria**:
  - 120 packets sent; 120 ACKs received. Dropped frames $= 0$.
  - Inter-frame pacing remains $33.3 \pm 2.0\text{ ms}$.
  - Zero desync or hanging states.

#### Scenario 04: Generative Sci-Fi Starfield & Row-Tearing Glitch Export
- **User Persona**: Indie Game Developer creating a retro sci-fi hyperspace jump boot sequence for an IoT device.
- **Preconditions**:
  - Clean PlatformIO workspace with ESP32-S3 target.
- **Step-by-Step Execution**:
  1. User selects "Starfield Generator" in Procedural Studio.
  2. Sets Star Count = 120, Warp Speed = 85 (producing long radial hyperspace streaks).
  3. Enables "Glitch Shader FX": selects "Horizontal Row Tearing", shift amplitude = $\pm 14\text{ px}$, active every 10th frame.
  4. Adjusts Brightness = $+10$ and Contrast = $+25$ to enhance streak intensity.
  5. Sets timeline length = 90 frames (3.0 seconds at 30 FPS).
  6. Previews animation with "Matrix Green" phosphor theme.
  7. Clicks "Export C++ Header" -> saves `src/frames.h`.
  8. PlatformIO builds firmware: `pio run`.
- **Expected Data Artifacts & Output**:
  - `src/frames.h` contains 90 frames of 1024 bytes ($92,160\text{ bytes}$ PROGMEM).
  - PlatformIO builds `firmware.elf` successfully.
- **Pass/Fail Acceptance Criteria**:
  - Exit code 0 from `pio run`.
  - Flash footprint within limits.
  - Periodic horizontal shift visible at frames 10, 20, 30... without memory out-of-bounds.

#### Scenario 05: Procreate Hand-Drawn Animation PNG Sequence Ingestion
- **User Persona**: Traditional Animator importing 60 hand-drawn animation frames exported from Procreate on iPad.
- **Preconditions**:
  - Directory containing 60 PNG files named `frame_1.png` through `frame_60.png` ($1920\times 1080$, 16:9).
- **Step-by-Step Execution**:
  1. User selects all 60 PNG files and drags them into Web Studio.
  2. Multi-file loader sorts files using natural alphanumeric collation (`frame_1.png` $\dots$ `frame_9.png`, `frame_10.png` $\dots$ `frame_60.png`).
  3. CropTool automatically selects `Contain` (Letterbox) mode to preserve entire drawing area with black bars on top and bottom.
  4. User selects `Bayer 8x8` ordered dithering to prevent temporal crawling noise across frames.
  5. User tests playback at 24 FPS (traditional animation standard).
  6. User scrubs timeline to verify frame continuity and drawing motion.
- **Expected Data Artifacts & Output**:
  - Natural sorting produces exact numerical sequence $1\dots 60$ (verifying `frame_10` does NOT follow `frame_1`).
  - Contain letterbox scales $1920\times 1080$ to $128\times 72 \rightarrow$ clamped to $128\times 64$ with 4px black borders.
  - Bayer 8x8 matrix eliminates diffuse error crawling noise between static background regions.
- **Pass/Fail Acceptance Criteria**:
  - File order is strictly $1, 2, \dots, 60$.
  - Top and bottom 4 rows are uniformly zero (`0x00`).
  - Zero inter-frame jitter in static drawing areas.

#### Scenario 06: High-Contrast Vector Logo Video Conversion & Code Copy
- **User Persona**: Brand Designer converting a corporate animated vector logo into an embedded boot screen.
- **Preconditions**:
  - WebM vector logo animation (`logo_reveal.webm`: 5 seconds, 15 FPS, 75 frames, black on white background).
- **Step-by-Step Execution**:
  1. User drags `logo_reveal.webm` into the converter.
  2. Selects `Dynamic Thresholding` with cutoff slider set to 145 (eliminating antialiased gray fuzzy edges).
  3. Enables `Invert Polarity` (converts black-on-white source into white-on-black OLED friendly pixels).
  4. Selects `Cover` 2:1 crop.
  5. Clicks "Copy C++ Code" button (1-click clipboard copy).
  6. Toast notification appears: *"Copied 75 frames to clipboard (76.8 KB)"*.
  7. Automated test pastes clipboard text and compiles a syntax check via `clang`/`gcc`.
- **Expected Data Artifacts & Output**:
  - Output frames contain pure high-contrast binary geometry without stippling noise.
  - Clipboard string begins with `// Auto-generated frames header` and contains `const uint8_t reel_frames[75][1024] PROGMEM`.
- **Pass/Fail Acceptance Criteria**:
  - Header syntax passes compiler check (`gcc -fsyntax-only`).
  - Zero gray/dithered intermediate pixels in thresholded output.
  - Clipboard write succeeds within $<100\text{ ms}$.

#### Scenario 07: Live DJ/VJ Performance with Dynamic Dither Switching
- **User Persona**: Live Performer manipulating visual effects in real time during a live electronic music set.
- **Preconditions**:
  - Live WebSerial stream active at 30 FPS over 921600 baud.
  - Video loop playing continuously.
- **Step-by-Step Execution**:
  1. Performer starts live streaming with `Floyd-Steinberg` dithering.
  2. While stream is running, performer clicks `Atkinson` toggle on beat 1.
  3. On beat 2, performer clicks `Bayer 4x4` toggle.
  4. On beat 3, performer adjusts Contrast slider from 0 to $+50$.
  5. On beat 4, performer toggles Invert Polarity.
- **Expected Data Artifacts & Output**:
  - Serial stream remains uninterrupted throughout all algorithm switches.
  - Single-frame dither recalculation executes in $<0.5\text{ ms}$ on main thread.
  - No dropped frames, zero serial desync.
- **Pass/Fail Acceptance Criteria**:
  - WebSerial connection does not reset or disconnect.
  - Frame delivery rate remains $30.0 \pm 0.5\text{ FPS}$ during parameter adjustments.

#### Scenario 08: Serial Noise Resistance & Corrupted Packet NAK Recovery
- **User Persona**: Hardware Engineer testing system reliability in electrically noisy environments (e.g. adjacent to motor drivers or transformers).
- **Preconditions**:
  - Active WebSerial streaming session.
  - Automated test harness injecting bit corruptions into the serial transport.
- **Step-by-Step Execution**:
  1. Host begins streaming 50 frames at 30 FPS.
  2. At frame 12, test harness corrupts payload byte 250 (`payload[250] ^= 0xFF`).
  3. Firmware receiver computes XOR checksum over received packet; checksum mismatch detected.
  4. Firmware emits NAK: `[0x15, 0x0C]`.
  5. Host receives NAK for Seq `0x0C`; retransmits uncorrupted frame 12 from cache.
  6. Firmware verifies retransmitted packet checksum; renders frame to OLED; returns ACK `[0x06, 0x0C]`.
  7. Stream continues normally for frames 13 through 50.
- **Expected Data Artifacts & Output**:
  - Serial monitor logs: `[RX] Checksum error on frame 12! Sending NAK 0x15`.
  - Display never renders the corrupted 12th frame.
  - Subsequent frames render cleanly.
- **Pass/Fail Criteria**:
  - Frame 12 rendered correctly after single retransmission.
  - Zero dropped sequence IDs.
  - Overall pipeline recovery time $<35\text{ ms}$.

#### Scenario 09: Hardware USB Disconnect & Standalone Watchdog Fallback
- **User Persona**: Product Designer deploying an interactive display kiosk that must run standalone when disconnected from a PC.
- **Preconditions**:
  - ESP32-S3 flashed with firmware containing default standalone `reel_frames` in PROGMEM.
- **Step-by-Step Execution**:
  1. Device boots up in `MODE_STANDALONE`, playing embedded PROGMEM reel at 30 FPS.
  2. Host connects via WebSerial and streams custom animation; firmware switches to `MODE_STREAMING`.
  3. User abruptly unplugs USB cable (or closes browser window).
  4. Firmware serial inactivity watchdog accumulates: `millis() - lastByteTime > 2000`.
  5. At $t = 2000\text{ ms}$, watchdog triggers state transition: `MODE_STREAMING -> MODE_STANDALONE`.
  6. OLED display clears and resumes looping the embedded PROGMEM reel.
- **Expected Data Artifacts & Output**:
  - Firmware serial monitor output: `Stream timeout (>2000ms). Reverting to standalone reel.`
  - Display seamlessly transitions back to standalone reel without rebooting or displaying frozen garbled pixels.
- **Pass/Fail Acceptance Criteria**:
  - Standalone playback resumes within $2000 \pm 50\text{ ms}$ of disconnect.
  - MCU uptime uninterrupted (zero crash dumps / watchdog resets).

#### Scenario 10: Dual Display Panel Hardware Switching (SH1106 vs SSD1306)
- **User Persona**: Embedded Engineer deploying firmware across two different hardware revisions: Revision A with SH1106, Revision B with SSD1306.
- **Preconditions**:
  - Hardware test fixture with switchable SH1106 and SSD1306 OLED displays on I2C (GPIO 8, 9).
- **Step-by-Step Execution**:
  1. System targets SH1106 display. Firmware initializes `U8G2_SH1106_128X64_NONAME_F_HW_I2C`.
  2. Send full-width border test pattern (outermost 1px rectangle around 128x64).
  3. Verify left border is at physical column 0 and right border is at physical column 127 (using SH1106 2-pixel offset [columns 2..129]).
  4. Switch configuration to SSD1306 display. Firmware initializes `U8G2_SSD1306_128X64_NONAME_F_HW_I2C`.
  5. Send identical border test pattern.
  6. Verify SSD1306 displays exact border at columns 0 and 127 without column shift or RAM noise.
- **Expected Data Artifacts & Output**:
  - SH1106 active matrix correctly addresses RAM columns 2 through 129.
  - SSD1306 active matrix correctly addresses RAM columns 0 through 127.
- **Pass/Fail Acceptance Criteria**:
  - Outer border visible on all 4 edges on both displays. Zero pixel clipping on left or right borders.

#### Scenario 11: Long-Form Video Ingestion & Flash Budget Optimization
- **User Persona**: Digital Signage Maker converting a 45-second commercial video into an embedded animation loop.
- **Preconditions**:
  - Source video: 45-second MP4 ($1920\times 1080$, 30 FPS = 1350 frames).
- **Step-by-Step Execution**:
  1. User drops 45-second video into Web Studio.
  2. UI calculates raw PROGMEM requirement: $1350 \times 1024 = 1,382,400\text{ bytes}$ (1.38 MB).
  3. Studio displays Flash Usage Alert: warns user that 1.38 MB approaches typical ESP32 OTA partition limits.
  4. User adjusts Target FPS from 30 FPS to 15 FPS (decimating frame count to 675 frames).
  5. User selects `PackBits RLE` compression.
  6. Studio compresses 675 frames: total size drops from $675\text{ KB}$ to $210\text{ KB}$ (69% reduction).
  7. User exports and compiles firmware cleanly within standard partition boundaries.
- **Expected Data Artifacts & Output**:
  - UI shows interactive Flash Budget Meter with green status bar ($210\text{ KB} / 16\text{ MB} = 1.3\%$).
  - Generated `frames_rle.h` fits comfortably inside any standard ESP32 flash partition table.
- **Pass/Fail Acceptance Criteria**:
  - Decimation logic extracts exactly 675 frames from 45-second video.
  - Firmware builds with $>85\%$ free flash headroom remaining.

#### Scenario 12: Retro Pixel Art Game Asset with Nearest-Neighbor Downscaling
- **User Persona**: Retro Game Developer converting a $320\times 180$ pixel art animation sequence from Pico-8/Aseprite without blurry interpolation.
- **Preconditions**:
  - Pixel art video asset ($320\times 180$, chunky 4x pixel scaling, sharp edges).
- **Step-by-Step Execution**:
  1. User drops pixel art video into Web Studio.
  2. User selects `Stretch` or `Cover` crop mode.
  3. By default, bilinear downscaling produces blurry gray edges around crisp pixels.
  4. User toggles `Pixel Art Mode (Nearest-Neighbor)`.
  5. Offscreen canvas disables smoothing: `ctx.imageSmoothingEnabled = false`.
  6. User selects `Threshold` dithering at cutoff 128.
  7. User previews output on simulated OLED canvas.
- **Expected Data Artifacts & Output**:
  - All single-pixel lines and retro sprite features remain strictly 1-bit sharp with zero interpolated blur or gray dither haze.
  - XBMP packing contains clean solid byte blocks (`0xFF` or `0x00`).
- **Pass/Fail Acceptance Criteria**:
  - Zero intermediate dither stippling on solid sprite regions.
  - Edges retain single-pixel sharpness.

#### Scenario 13: Karaoke Lyric Video with Beat Inversion & Dual-Color OLED
- **User Persona**: Synthwave Musician creating a portable pocket lyric visualizer with dual-color (Yellow header / Blue body) OLED hardware.
- **Preconditions**:
  - Lyrics file with timed word stamps. Dual-color OLED hardware ($128\times 64$: top 16 rows yellow, bottom 48 rows blue).
- **Step-by-Step Execution**:
  1. User enters song lyrics into Procedural Studio.
  2. Places song title in rows 0..15; places scrolling lyrics in rows 17..63. Row 16 left blank (matching physical panel separator).
  3. Selects `Yellow/Blue Dual Display` theme on Simulated OLED Player.
  4. Enables "Karaoke Beat Inversion": active word is highlighted with an inverted solid white box.
  5. Plays animation: rows 0..15 glow yellow, active word inverts sharply, body lyrics glow blue.
  6. Streams to physical dual-color OLED via WebSerial.
- **Expected Data Artifacts & Output**:
  - Canvas preview renders upper 16 rows in `#ffcc00` (yellow) and lower 47 rows in `#00e5ff` (blue) with unlit row 16.
  - Physical display colors match virtual preview exactly.
- **Pass/Fail Acceptance Criteria**:
  - Row 16 contains zero lit pixels across all frames.
  - Beat inversion maintains clean character contrast without clipping.

#### Scenario 14: Ballistic Radial Particle Burst Benchmark & Multi-Stage Timing Budget
- **User Persona**: Systems Performance Engineer verifying that the full real-time streaming pipeline sustains rock-solid 30 FPS without frame drops or timing jitter.
- **Preconditions**:
  - ESP32-S3 connected over 921600 baud serial driving SH1106 over 400 kHz Fast I2C.
- **Step-by-Step Execution**:
  1. Engineer triggers continuous radial particle explosion (70 particles, physics updated at 30 FPS).
  2. Web app benchmarks compute time per frame: particle physics + rasterization + XBMP packing.
  3. WebSerial streamer transmits 1031-byte packet over 921600 baud.
  4. ESP32 receives packet, parses checksum, calls `u8g2.drawXBMP()`, and executes `u8g2.sendBuffer()`.
  5. ESP32 writes ACK `0x06` back to serial.
  6. Web app measures total roundtrip time (RTT) and frame-to-frame delta over 300 continuous frames (10 seconds).
- **Timing Budget Breakdown & Verification**:
  $$\begin{aligned}
  T_{\text{browser\_compute}} &\le 3.5\text{ ms} \quad (\text{Physics + Canvas + Pack}) \\
  T_{\text{uart\_tx}} &= \frac{1031 \times 10\text{ bits}}{921,600\text{ baud}} \approx 11.18\text{ ms} \\
  T_{\text{esp32\_i2c}} &\approx 24.30\text{ ms} \quad (\text{Fast I2C } 400\text{ kHz}) \\
  T_{\text{ack\_return}} &= \frac{2 \times 10\text{ bits}}{921,600\text{ baud}} \approx 0.02\text{ ms}
  \end{aligned}$$
  - Pipelined frame budget at 30 FPS: $\Delta T_{\text{target}} = 33.33\text{ ms}$.
- **Expected Data Artifacts & Output**:
  - Stream metrics report: `Frames: 300`, `Dropped: 0`, `Avg FPS: 29.9`, `Max Jitter: 2.1 ms`.
- **Pass/Fail Acceptance Criteria**:
  - Zero dropped frames over 300 frames. Average FPS $\ge 29.5$. No buffer overruns in ESP32 UART RX FIFO.

---

## 6. Cross-Tier Traceability Matrix

This matrix verifies that every feature F01 through F27 defined in `PROJECT.md` is rigorously exercised by at least two Tier 3 combination tests and at least one Tier 4 real-world application scenario.

| Feature ID | Feature Name | Tier 3 Combinations Coverage | Tier 4 Scenarios Coverage |
|---|---|---|---|
| **F01** | Web Studio Project Setup | T3-01, T3-05, T3-12 | Scenario 01, 02, 03 |
| **F02** | Video Drag & Drop Decoder | T3-01, T3-02, T3-15, T3-21 | Scenario 01, 06, 11, 12 |
| **F03** | Animated GIF Decoder | T3-03, T3-10, T3-16, T3-26 | Scenario 02 |
| **F04** | PNG Sequence Loader | T3-04, T3-11, T3-20, T3-26 | Scenario 05 |
| **F05** | Interactive 2:1 Crop & Scale | T3-07, T3-10, T3-11, T3-19, T3-21 | Scenario 01, 05, 06, 12 |
| **F06** | Brightness & Contrast Control | T3-04, T3-14, T3-15, T3-28 | Scenario 04, 06, 07 |
| **F07** | Atkinson Dithering | T3-01, T3-07, T3-16, T3-20, T3-30 | Scenario 02, 07 |
| **F08** | Floyd-Steinberg Dithering | T3-02, T3-10, T3-14, T3-24 | Scenario 01, 07 |
| **F09** | Bayer Ordered Dithering | T3-03, T3-11, T3-15, T3-23 | Scenario 05, 07 |
| **F10** | Dynamic Thresholding | T3-04, T3-19, T3-28 | Scenario 06, 12 |
| **F11** | XBMP Binary Frame Packing | T3-01, T3-02, T3-13, T3-21, T3-28 | Scenario 01, 06, 14 |
| **F12** | Simulated OLED Canvas Player | T3-05, T3-10, T3-14, T3-17, T3-26, T3-30 | Scenario 01, 02, 05, 12, 13 |
| **F13** | Playback Controls & Timeline | T3-06, T3-12, T3-14, T3-20, T3-29 | Scenario 01, 02, 05, 11 |
| **F14** | Text Typewriter & Bounce Lyric | T3-05, T3-12, T3-17, T3-22, T3-29 | Scenario 03, 13 |
| **F15** | Glitch Shader FX | T3-05, T3-06, T3-18, T3-22, T3-25 | Scenario 04, 13 |
| **F16** | Starfield & Particle Explosion | T3-06, T3-13, T3-17, T3-25 | Scenario 04, 14 |
| **F17** | Procedural Timeline Integration | T3-12, T3-13, T3-22 | Scenario 03, 13 |
| **F18** | C++ PROGMEM Header Exporter | T3-02, T3-05, T3-09, T3-16, T3-25 | Scenario 01, 04, 09 |
| **F19** | PackBits RLE Header Exporter | T3-03, T3-11, T3-19, T3-24 | Scenario 02, 11 |
| **F20** | 1-Click Code Copy & Download | T3-03, T3-12, T3-21, T3-24 | Scenario 02, 06 |
| **F21** | WebSerial USB Streamer | T3-01, T3-04, T3-06, T3-09, T3-20, T3-27, T3-29 | Scenario 03, 07, 08, 09, 14 |
| **F22** | Binary Framing Protocol | T3-07, T3-08, T3-15, T3-18, T3-23, T3-27, T3-28 | Scenario 03, 08, 10, 14 |
| **F23** | Stop-and-Wait ACK Flow Control | T3-07, T3-08, T3-27, T3-29 | Scenario 03, 07, 08, 14 |
| **F24** | ESP32-S3 Dual-Mode Firmware | T3-08, T3-09, T3-16, T3-25, T3-27 | Scenario 01, 04, 08, 09, 10 |
| **F25** | SH1106 / SSD1306 Support | T3-13, T3-18, T3-23, T3-30 | Scenario 10, 14 |
| **F26** | E2E Testing Suite (Tiers 1–4) | All T3 tests (T3-01 to T3-30) | All Scenarios (01 to 14) |
| **F27** | Adversarial Coverage Hardening | T3-08, T3-09, T3-24, T3-27, T3-28 | Scenario 08, 09 |

---

## 7. Test Automation & Execution Methodology

To execute Tier 3 and Tier 4 tests autonomously without requiring manual browser interaction or physical hardware:

### 7.1 Headless CLI Test Harness Architecture
1. **Runner Environment**: Standalone Node.js / TypeScript test runner (`tsx` or `vitest` / `pytest`) executing in `test/e2e/`.
2. **Offscreen Canvas & Video Polyfills**:
   - `node-canvas` or `skia-canvas` for headless $128\times 64$ rasterization and dither pixel math.
   - Pure JS `omggif` decoder for GIF validation.
   - Python OpenCV (`cv2`) wrapper for headless MP4/WebM video frame extraction.
3. **Simulated ESP32 Hardware Endpoint**:
   - Mock Serial Loopback Stream simulating the ESP32 UART RX ring buffer, state machine, checksum verifier, 24ms I2C delay, and ACK `0x06` response.
4. **Firmware Compilation Verification**:
   - Headless PlatformIO CLI command: `pio run -e esp32-s3-devkitc-1`.
   - Verification of exit code 0, binary size, and symbol table.

### 7.2 Quantitative Thresholds & Assertions
- **Binary Bit Exactness**: Bit-for-bit assertion (`Uint8Array.every((byte, i) => byte === expected[i])`).
- **Timing Headroom**:
  - UART 921600 baud transfer $\le 12.0\text{ ms}$ per frame.
  - I2C 400 kHz transfer $\le 25.0\text{ ms}$ per frame.
  - Paced 30 FPS inter-frame interval $33.33 \pm 2.0\text{ ms}$.
- **Lossless Decompression**: PackBits RLE roundtrip decompression error rate $\equiv 0.00\%$.
- **Watchdog Transition Window**: Fallback to standalone PROGMEM loop between $1950\text{ ms}$ and $2050\text{ ms}$.

---

*Report compiled and certified by `spec_miner_e2e_3_r1`.*
