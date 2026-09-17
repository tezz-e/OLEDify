# Test Infrastructure & Runner Architecture Specification

**Project**: OLED Visual Animation Engine & Converter  
**Document**: `TEST_INFRA.md`  
**Authority**: `ORIGINAL_REQUEST.md`, `PROJECT.md` (§F01–F27, §Milestones, §Interface Contracts)  
**Status**: DRAFT (Proposed for approval and promotion to project root)  
**Target Directory**: `D:\espprojects\oled\test\e2e`  

---

## 1. Overview & Testing Philosophy

The OLED Visual Animation Engine & Converter relies on strict mathematical, temporal, and binary interface contracts across heterogeneous environments:
- Client-side Web Studio UI (Vite + React + TypeScript + Canvas)
- Mathematical dithering and image processing pipelines (Atkinson, Floyd-Steinberg, Bayer, Threshold)
- 1-Bit Monochrome frame serialization (1024-byte row-major LSB-first XBMP layout)
- High-speed WebSerial binary framing protocol (OLED-Stream v1 @ 921600 baud with Stop-and-Wait ACK flow control)
- Dual-mode ESP32-S3 firmware and PlatformIO C++ code generation (`src/frames.h`, PackBits RLE)

To guarantee 100% production readiness, the testing track adheres to **Opaque-Box Requirement-Driven Verification**:
1. **Zero Internal Module Coupling**: Tests evaluate inputs, outputs, binary representations, protocols, and file generation without depending on internal private class states or fragile DOM bindings.
2. **Deterministic Ground-Truth Validation Oracles**: All transformations (error diffusion, matrix thresholds, bit packing, checksums, RLE compression) are verified against mathematically verified ground-truth reference oracles.
3. **Multi-Tiered Coverage**: From per-feature units (Tier 1) through boundary conditions (Tier 2), pairwise combinations (Tier 3), and end-to-end creator workflows (Tier 4) to stress/adversarial resilience (Tier 5).
4. **Standalone Headless Execution**: The test harness runs directly from the Windows CLI without requiring manual browser interaction, physical hardware connected to USB, or external npm package downloads.

---

## 2. Test Environment & Platform Investigation

### 2.1 System Environment Matrix

| Runtime / Tool | Detected Path / Command | Version | Status & Capability |
|---|---|---|---|
| **Python (Standard Launcher)** | `py -3` / `C:\Windows\py.exe` | 3.13.5 (64-bit) | **Primary Test Engine**. Standard library `unittest` + native modules. |
| **Python Packages** | Via `py -3` | `cv2` (5.0.0), `PIL` (12.3.0), `numpy` (2.5.2) | **Installed & Verified**. High-performance image/video processing. |
| **pytest** | `py -3 -m pytest` | N/A | **Not Installed**. Test harness avoids third-party runner dependencies. |
| **Node.js** | `node` / `C:\Program Files\nodejs\node.exe` | v24.15.0 | **Installed & Verified**. Built-in `node:test` and `node:assert` available. |
| **npm** | `npm.cmd` (cmd) / `npm` (pwsh restricted) | 11.12.1 | **Operational via .cmd**. Note: PowerShell policy restricts `npm.ps1`. |
| **Operating System** | Windows 10/11 x64 | PowerShell / CMD | Primary development and test execution host. |

### 2.2 Test Runner Decision

To ensure frictionless local CLI execution on Windows and continuous integration compatibility:
- **Primary Test Runner**: Python 3 standard library `unittest` enhanced with a custom CLI runner (`test/e2e/runner.py`) using `numpy`, `PIL`, and `cv2`.
  - **Rationale**: Python already possesses the exact image/video decoding capabilities (`cv2` for MP4 reels, `PIL` for animated GIFs, `numpy` for bitwise matrices) and requires **zero additional package installations**.
  - **Execution Command**: `py -3 test/e2e/runner.py` or `test\e2e\run.bat`.
  - **Exit Code Contract**: Exits with code `0` on all tests passing, and code `1` (or non-zero) on any failure or error.
- **Complementary Web Engine Test Runner**: Native Node.js test runner (`node:test`) for direct execution of pure JavaScript / TypeScript engine modules (`test/e2e/runner_node.mjs`).
  - **Execution Command**: `node test/e2e/runner_node.mjs`.

---

## 3. Test Harness Architecture & Directory Layout

```
D:\espprojects\oled\test\e2e\
├── runner.py                        # Master CLI Test Runner (Python 3)
├── runner_node.mjs                  # Complementary Engine Runner (Node 24 native)
├── run.bat                          # Windows CLI one-click batch launcher
├── __init__.py
├── config.py                        # Test constants (128x64, 1024B, 921600 baud, etc.)
│
├── fixtures/                        # Synthetic Media Generators & Static Fixtures
│   ├── __init__.py
│   ├── media_generator.py           # Programmatic MP4, animated GIF, PNG sequence generator
│   ├── sample_media/
│   │   ├── igexport_sample.mp4      # Reference vertical reel (from project root)
│   │   ├── synthetic_10frame.mp4    # Generated 720x1280 10-frame test reel
│   │   ├── animated_test.gif        # Multi-frame animated GIF with disposal modes
│   │   ├── png_sequence/            # Natural-sort PNG frame sequence
│   │   ├── corrupt_zero_byte.bin    # 0-byte corrupt file fixture
│   │   ├── corrupt_header.mp4       # Truncated MP4 container fixture
│   │   ├── corrupt_bad_magic.gif    # Invalid magic byte GIF fixture
│   │   └── non_standard_dims/       # 1x1, 129x65, 16000x9000 pixel edge-case images
│   └── golden_frames/               # Golden reference XBMP byte arrays for regression
│
├── oracles/                         # Ground-Truth Mathematical & Protocol Oracles
│   ├── __init__.py
│   ├── dither_oracle.py             # Atkinson (75%), Floyd-Steinberg (100%), Bayer (2/4/8), Threshold
│   ├── xbmp_oracle.py               # 128x64 row-major LSB-first packing & unpacking oracle
│   ├── protocol_simulator.py        # WebSerial OLED-Stream v1 state machine & ACK flow simulator
│   ├── rle_oracle.py                # PackBits RLE compression & inline decompressor oracle
│   └── cpp_header_oracle.py         # Arduino C++ frames.h parser and syntax validator
│
├── tiers/                           # Categorized Test Suites (Tiers 1–5)
│   ├── __init__.py
│   ├── tier1_feature/               # Tier 1: Feature Coverage (F01–F27, >=5 tests/feature = 135+ tests)
│   │   ├── __init__.py
│   │   ├── test_f01_f05_ingestion.py   # Web Studio, Video, GIF, PNG, Crop/Scale
│   │   ├── test_f06_f10_dithering.py   # Brightness/Contrast, Atkinson, F-S, Bayer, Threshold
│   │   ├── test_f11_f13_canvas.py      # XBMP Packing, Simulated OLED, Timeline Controls
│   │   ├── test_f14_f17_procedural.py  # Typewriter, Glitch FX, Starfield, Timeline
│   │   ├── test_f18_f20_exporter.py    # PROGMEM C++, PackBits RLE, Copy/Download
│   │   ├── test_f21_f25_hardware.py    # WebSerial, Binary Framing, ACK Flow, Dual-Mode, SH1106
│   │   └── test_f26_f27_e2e_audit.py   # E2E test verification, adversarial robustness
│   │
│   ├── tier2_boundaries/            # Tier 2: Boundary & Corner Cases (135+ tests)
│   │   ├── __init__.py
│   │   ├── test_empty_corrupt_inputs.py# 0-byte files, truncated containers, invalid magic
│   │   ├── test_dimension_boundaries.py# 1x1, 127x63, 129x65, non-2:1 ratios, extreme sizes
│   │   ├── test_slider_extremes.py     # Brightness/Contrast [-100, 100], threshold [0, 255]
│   │   ├── test_buffer_boundaries.py   # 1023B, 1024B, 1025B, UART buffer overflow
│   │   └── test_timing_boundaries.py   # 0 FPS, 1 FPS, 120 FPS, 2000ms watchdog timeout
│   │
│   ├── tier3_combinations/          # Tier 3: Cross-Feature Combinations (>=27 tests)
│   │   ├── __init__.py
│   │   └── test_feature_pairs.py       # Pairwise feature matrix combinations
│   │
│   ├── tier4_scenarios/             # Tier 4: Real-World Application Scenarios (>=14 tests)
│   │   ├── __init__.py
│   │   └── test_creator_workflows.py   # Full creator workflows (MP4/GIF/Procedural -> OLED)
│   │
│   └── tier5_adversarial/           # Tier 5: Adversarial Hardening & Stress Testing
│       ├── __init__.py
│       └── test_stress_hardening.py    # Noise injection, rapid port toggling, buffer starvation
│
└── utils/                           # Shared Test Utilities & Reporting
    ├── __init__.py
    ├── assertions.py                # Specialized assertion helpers
    └── reporter.py                  # CLI color formatting, progress indicators, JSON/JUnit exporter
```

---

## 4. Test Tier Hierarchy & Coverage Matrix

The test inventory is organized into five ascending verification tiers ensuring total requirement coverage across all 27 features (F01–F27):

```
+-----------------------------------------------------------------------------+
|                     Tier 5: Adversarial & Stress (Hardening)                |
|           Memory leak soak, serial noise injection, rapid reconnect         |
+-----------------------------------------------------------------------------+
|              Tier 4: Real-World Scenarios (>=14 Workflows)                  |
|        Instagram Reel -> OLED, Aseprite GIF -> RLE, Procedural Studio       |
+-----------------------------------------------------------------------------+
|             Tier 3: Cross-Feature Combinations (>=27 Pairwise)              |
|        Media x Dithering x Binary Packing x Flow Control x Code Export      |
+-----------------------------------------------------------------------------+
|            Tier 2: Boundary & Corner Cases (>=135 Edge Cases)               |
|      0-byte, 16000x9000, 1023B/1025B, baud overrun, slider -100/+100        |
+-----------------------------------------------------------------------------+
|             Tier 1: Feature Coverage (>=135 Tests, >=5 per F01-F27)         |
|      Nominal behavior, parameter ranges, return contracts, outputs          |
+-----------------------------------------------------------------------------+
```

### 4.1 Coverage Target Summary

| Test Tier | Scope & Focus | Target Test Count | Minimum Requirement |
|---|---|---|---|
| **Tier 1** | Feature Coverage (F01 through F27) | $\ge 135$ | $\ge 5$ tests per feature |
| **Tier 2** | Boundary & Corner Cases (F01 through F27) | $\ge 135$ | $\ge 5$ boundary tests per feature |
| **Tier 3** | Cross-Feature Combinatorial Pairs | $\ge 27$ | Pairwise interactions |
| **Tier 4** | Real-World Creator Application Scenarios | $\ge 14$ | Realistic end-to-end journeys |
| **Tier 5** | Adversarial Hardening & Stress Testing | $\ge 10$ | Fault injection, stability |
| **Total** | **Comprehensive E2E Suite** | **$\ge 321$** | **Pass Threshold: 100%** |

---

## 5. Mock Fixtures & Synthetic Media Generation

The test harness provides programmatic generation of all required media types via `test/e2e/fixtures/media_generator.py`:

### 5.1 Programmatic Media Generation Specification

1. **Synthetic MP4 Reel (`generate_synthetic_mp4`)**:
   - **Resolution**: $720 \times 1280$ (9:16 vertical Instagram reel format).
   - **Codec / Container**: `mp4v` / `.mp4` generated via OpenCV `cv2.VideoWriter`.
   - **Duration / FPS**: 10 frames @ 30.0 FPS.
   - **Visual Content**:
     - Frame 0–2: High-contrast geometric shapes (circle, square, line).
     - Frame 3–5: Continuous horizontal luminance gradient ramp (0 to 255).
     - Frame 6–7: High-frequency checkerboard pattern (tests dithering error diffusion).
     - Frame 8–9: Centered high-contrast typography ("OLED E2E").
2. **Animated Multi-Frame GIF (`generate_synthetic_gif`)**:
   - **Resolution**: $128 \times 64$ pixels.
   - **Frames / Delays**: 5 frames, 100 ms duration per frame (10 FPS).
   - **Disposal Modes**: Includes disposal mode 1 (none) and mode 2 (restore to background).
   - **Implementation**: Generated using `PIL.Image` with `save_all=True`.
3. **Natural-Sorted PNG Sequence (`generate_png_sequence`)**:
   - **Frame Set**: 10 frames with non-padded and padded numbers to test natural sorting (`frame_1.png`, `frame_2.png`, ..., `frame_10.png`).
   - **Content**: Horizontal sweep bar translating 12 pixels per frame across 128-pixel canvas.
4. **Corrupted & Malformed Fixture Generators**:
   - `generate_zero_byte_file(path)`: Creates 0-byte file (`len == 0`).
   - `generate_truncated_mp4(path)`: Writes initial 48 bytes of valid MP4 `ftyp` box then terminates abruptly.
   - `generate_bad_magic_gif(path)`: Writes header `BADGIF89a` followed by corrupted block markers.
   - `generate_corrupt_png(path)`: Writes standard 8-byte PNG header followed by pseudo-random noise bytes.
   - `generate_extreme_dimension_image(path, w, h)`: Generates $1 \times 1$, $129 \times 65$, and $16000 \times 9000$ images.

---

## 6. Validation Oracles (Mathematical Ground Truth)

The test harness includes standalone, deterministic validation oracles implemented in `test/e2e/oracles/`. Every web engine or firmware calculation must strictly match these oracles.

### 6.1 Grayscale & Luminance Oracle (ITU-R BT.601)

For pixel with $R, G, B \in [0, 255]$ and alpha $A \in [0, 255]$:
$$Y_{base} = 0.299 \cdot R + 0.587 \cdot G + 0.114 \cdot B$$
$$Y_{blended} = Y_{base} \cdot \left(\frac{A}{255}\right)$$

Brightness $B \in [-100, 100]$ and Contrast $C \in [-100, 100]$:
$$B' = B \times 2.55, \quad C' = C \times 2.55$$
$$F = \frac{259 \cdot (C' + 255)}{255 \cdot (259 - C')}$$
$$Y_{adj} = \max(0, \min(255, \text{round}(F \cdot (Y_{blended} - 128) + 128 + B')))$$
$$Y_{final} = (255 - Y_{adj}) \text{ if inverted else } Y_{adj}$$

### 6.2 Dithering Oracles

#### A. Atkinson Dithering Oracle (F07)
- **Error Diffusion Kernel**:
  ```
               (x, y)       (x+1, y) [1/8]   (x+2, y) [1/8]
  (x-1, y+1) [1/8]   (x, y+1) [1/8]   (x+1, y+1) [1/8]
                     (x, y+2) [1/8]
  ```
- **Invariant**: Exactly 6 neighbor cells receive $\frac{1}{8}$ of the quantization error ($6 \times \frac{1}{8} = 75\%$). **Exactly 25% of error is discarded**.
- **Quantization**: $Q = 255 \text{ if } V \ge 128 \text{ else } 0$. Error $e = \frac{V - Q}{8.0}$.
- **Boundary Handling**: Errors diffusing outside canvas boundaries ($x < 0, x \ge 128, y \ge 64$) are discarded without boundary wrapping.

#### B. Floyd-Steinberg Dithering Oracle (F08)
- **Error Diffusion Kernel**:
  ```
               (x, y)       (x+1, y) [7/16]
  (x-1, y+1) [3/16]  (x, y+1) [5/16]  (x+1, y+1) [1/16]
  ```
- **Invariant**: Divisor 16 ($7+3+5+1 = 16$). **100% of quantization error is diffused**.

#### C. Bayer Ordered Dithering Oracles (F09)
- **Threshold Matrices**:
  $$M_2 = \begin{bmatrix} 0 & 2 \\ 3 & 1 \end{bmatrix}, \quad T_2(x, y) = \frac{M_2[y \bmod 2][x \bmod 2] + 0.5}{4} \times 255$$
  $$M_4 = \begin{bmatrix} 0 & 8 & 2 & 10 \\ 12 & 4 & 14 & 6 \\ 3 & 11 & 1 & 9 \\ 15 & 7 & 13 & 5 \end{bmatrix}, \quad T_4(x, y) = \frac{M_4[y \bmod 4][x \bmod 4] + 0.5}{16} \times 255$$
  $$M_8 = \begin{bmatrix} 4 M_4 & 4 M_4 + 2 \\ 4 M_4 + 3 & 4 M_4 + 1 \end{bmatrix}, \quad T_8(x, y) = \frac{M_8[y \bmod 8][x \bmod 8] + 0.5}{64} \times 255$$
- **Quantization**: $P(x, y) = 1 \text{ if } Y_{final}(x, y) > T_N(x, y) \text{ else } 0$.
- **Invariant**: Coordinate-deterministic; zero temporal cross-frame noise.

#### D. Dynamic Thresholding Oracle (F10)
- Parameter: $T \in [0, 255]$ (default 128).
- Quantization: $P(x, y) = 1 \text{ if } Y_{final}(x, y) \ge T \text{ else } 0$.

### 6.3 XBMP 1-Bit Row-Major LSB-First Packing Oracle (F11)

- **Dimensions**: $W = 128, H = 64$.
- **Bytes Per Row**: $128 / 8 = 16 \text{ bytes}$.
- **Buffer Size**: Exactly 1024 bytes ($16 \times 64$).
- **Packing Rule**:
  $$\text{byteIdx} = y \times 16 + \text{byteX}$$
  $$\text{byteVal} = \sum_{b=0}^{7} \left(P(\text{byteX} \cdot 8 + b, y) \ll b\right)$$
  - Bit 0 (`0x01`): Leftmost pixel $x = \text{byteX} \cdot 8 + 0$.
  - Bit 7 (`0x80`): Rightmost pixel $x = \text{byteX} \cdot 8 + 7$.
  - Value: `1` = White / Lit; `0` = Black / Unlit (matches U8g2 `u8g2.drawXBMP`).
- **Identity Invariant**: $\text{unpack}(\text{pack}(\text{pixels})) \equiv \text{pixels}$.

### 6.4 WebSerial OLED-Stream v1 Protocol Oracle (F22, F23)

- **Packet Framing Structure (1030 bytes)**:
  | Byte Offset | Field | Value / Type | Validation Rule |
  |---|---|---|---|
  | `0` | Header Byte 0 | `0xAA` | Must match sync magic 1 |
  | `1` | Header Byte 1 | `0x55` | Must match sync magic 2 |
  | `2` | Command Byte | `0x01` (Render), `0x02` (Ping), `0x03` (Reset) | Must be recognized command |
  | `3` | Payload Length High | `0x04` (for CMD 0x01) | Big-Endian high byte |
  | `4` | Payload Length Low | `0x00` (for CMD 0x01) | Big-Endian low byte ($0x0400 = 1024$) |
  | `5..1028` | XBMP Payload | 1024 bytes | Exact 1-bit frame buffer |
  | `1029` | XOR Checksum | 1 byte | $\text{CMD} \oplus \text{LEN\_H} \oplus \text{LEN\_L} \oplus \bigoplus_{i=0}^{1023} \text{Payload}[i]$ |

- **Flow Control Handshake**:
  - Valid packet $\implies$ Receiver sends `0x06` (`ACK`). Host releases next frame.
  - Checksum mismatch or invalid length $\implies$ Receiver sends `0x15` (`NAK`). Host retransmits.
  - Inter-byte inactivity timeout $> 100\text{ ms} \implies$ Receiver discards partial packet, resets to `WAIT_MAGIC_1`.
  - Stream inactivity watchdog $> 2000\text{ ms} \implies$ Firmware falls back to autonomous PROGMEM reel loop.

### 6.5 PackBits RLE Compression & Header Exporter Oracle (F18, F19)

- **PackBits RLE Encoding Scheme**:
  - Run of identical bytes ($2 \le n \le 128$): Flag byte $-(n - 1)$ (i.e. $257 - n$ as unsigned uint8), followed by 1 literal byte.
  - Literal sequence of unrepeated bytes ($1 \le n \le 128$): Flag byte $n - 1$ (i.e. $0 \dots 127$), followed by $n$ literal bytes.
  - Worst-case expansion guard: If RLE compressed size $\ge 1024$ bytes, exporter defaults to uncompressed XBMP.
- **C++ PROGMEM Header Validation (`src/frames.h`)**:
  - Header guard: `#pragma once` or `#ifndef FRAMES_H`.
  - Compulsory symbols: `#define FRAME_WIDTH 128`, `#define FRAME_HEIGHT 64`, `#define FRAME_BYTES_PER_ROW 16`, `#define FRAME_SIZE_BYTES 1024`, `#define NUM_FRAMES <N>`, `#define FRAME_FPS <FPS>`.
  - PROGMEM array: `const uint8_t reel_frames[NUM_FRAMES][FRAME_SIZE_BYTES] PROGMEM = { ... };`.
  - Alias: `#define epd_bitmap_allArray reel_frames`.
  - Byte count assertion: Exactly $N \times 1024$ hexadecimal byte literals.

---

## 7. Test Runner Design & CLI Specifications

### 7.1 CLI Invocation Contract

The test harness is invoked via command line on Windows:

```powershell
# Run complete test suite (Tiers 1-5) via Python launcher
py -3 test/e2e/runner.py

# Run one-click Windows batch runner
.\test\e2e\run.bat

# Run specific tier
py -3 test/e2e/runner.py --tier 1
py -3 test/e2e/runner.py --tier 2
py -3 test/e2e/runner.py --tier 3
py -3 test/e2e/runner.py --tier 4

# Run specific feature tests
py -3 test/e2e/runner.py --feature F07
py -3 test/e2e/runner.py --feature F22

# Verbose output with timing and test case names
py -3 test/e2e/runner.py -v

# Export machine-readable test results
py -3 test/e2e/runner.py --json test_report.json --junit test_report.xml
```

### 7.2 CLI Argument Specifications

| Flag / Option | Short | Type | Default | Description |
|---|---|---|---|---|
| `--tier` | `-t` | int (`1..5`) | `all` | Filter test execution by tier number. |
| `--feature` | `-f` | str (`F01..F27`) | `all` | Filter test execution by specific feature ID. |
| `--verbose` | `-v` | flag | `False` | Display full test case names, execution timings, and detailed assertions. |
| `--failfast` | `-x` | flag | `False` | Immediately abort execution on first test failure. |
| `--json` | `-j` | path | `None` | Write structured JSON report containing pass/fail metrics. |
| `--junit` | | path | `None` | Write standard JUnit XML format for CI integration. |
| `--generate-fixtures` | | flag | `False` | Force regeneration of all synthetic media fixtures. |

### 7.3 Exit Code Contract

- **Exit Code `0`**: All executed test cases passed with zero failures and zero errors.
- **Exit Code `1`**: One or more test cases failed assertion or encountered an unhandled exception.
- **Exit Code `2`**: Invalid CLI arguments or missing prerequisite test environment configuration.

---

## 8. Verification & Publication Workflow

When the test writer agents complete test implementations across all tiers:
1. Run `py -3 test/e2e/runner.py` to execute all tests.
2. Confirm test count meets minimum threshold ($\ge 311$ total tests: $\ge 135$ Tier 1, $\ge 135$ Tier 2, $\ge 27$ Tier 3, $\ge 14$ Tier 4).
3. Confirm test suite execution returns exit code `0`.
4. Publish `TEST_READY.md` declaring test harness operational readiness for implementation track gates.
