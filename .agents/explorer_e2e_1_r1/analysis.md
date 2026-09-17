# E2E Test Infrastructure, Runner Architecture & Validation Oracles Investigation

**Agent**: `explorer_e2e_1_r1`  
**Working Directory**: `D:\espprojects\oled\.agents\explorer_e2e_1_r1`  
**Milestone**: E2E Testing Track — Test Infrastructure Design & TEST_INFRA.md  
**Date**: 2026-09-18  

---

## Executive Summary

The E2E test infrastructure for the OLED Visual Animation Engine & Converter is designed as a standalone, zero-external-dependency test harness centered on a custom Python 3 CLI runner (`py -3 test/e2e/runner.py`) utilizing standard library `unittest` along with pre-installed `numpy` 2.5.2, `Pillow` 12.3.0, and `OpenCV` 5.0.0, supplemented by a native Node 24 test runner (`node:test`). The architecture establishes programmatic synthetic media generators (MP4, animated GIF, natural-sorted PNG sequences, and corrupt/boundary fixtures), a full-duplex WebSerial OLED-Stream v1 protocol simulator with ACK/NAK flow control, and mathematically verified validation oracles for Atkinson (75% diffusion), Floyd-Steinberg (100%), Bayer matrices (2x2, 4x4, 8x8), thresholding, 1024-byte row-major LSB-first XBMP packing, and PackBits RLE compression.

---

## 1. Local Environment Investigation & Findings

A comprehensive audit of the local Windows development environment was conducted via live CLI execution:

### 1.1 Python Environment & Capabilities

- **Command Resolution**:
  - Executing `python` directly in PowerShell invokes the Windows Microsoft Store application stub (`C:\Users\manee\AppData\Local\Microsoft\WindowsApps\python.exe`) which returns exit code 1 with: `Python was not found; run without arguments to install from the Microsoft Store...`.
  - Executing `py -3` invokes the official Python Launcher (`C:\Users\manee\AppData\Local\Programs\Python\Launcher\py.exe`), which correctly routes to Python 3.13.5:
    `C:\Users\manee\AppData\Local\Programs\Python\Python313\python.exe` (tags/v3.13.5:6cb20a2, Jun 11 2025, 16:15:46) [MSC v.1943 64 bit (AMD64)].
- **Installed Packages**:
  - `opencv-python` (`cv2`): Version **5.0.0** (verified functional for video decoding, resizing, and frame writing).
  - `Pillow` (`PIL`): Version **12.3.0** (verified functional for GIF parsing, multi-frame generation, and palette quantization).
  - `numpy`: Version **2.5.2** (verified functional for high-performance array manipulation and bitwise packing).
- **Missing Packages**:
  - `pytest`: **Not installed** (`No module named pytest`).
- **Built-in Standard Library**:
  - `unittest`: Built-in, fully operational, supports test discovery (`py -3 -m unittest discover -s test/e2e`), custom runners, assertion suites, and returns exit code `0` on pass, non-zero on failure.

### 1.2 Node.js & NPM Environment

- **Node.js**:
  - Version: **v24.15.0** (located at `C:\Program Files\nodejs\node.exe`).
  - Native Test Runner: Node 24 includes the built-in `node:test` and `node:assert` modules. Zero third-party npm packages (such as Jest, Mocha, or Vitest) are required for headless CLI test execution.
- **NPM & PowerShell Execution Policy**:
  - Invoking `npm` in PowerShell directly triggers `npm.ps1`, which is blocked by the Windows PowerShell execution policy:
    `npm : File C:\Program Files\nodejs\npm.ps1 cannot be loaded because running scripts is disabled on this system.`
  - Invoking `npm.cmd` or `cmd /c npm` runs npm 11.12.1 without restriction.
  - Direct Node execution (`node script.mjs`) is completely unaffected by PowerShell execution policies.

### 1.3 Project Root Assets

- Real sample reel: `D:\espprojects\oled\igexport-DckvRqKPsI_.mp4` (720x1280 vertical video, 466 frames @ 30 FPS, 452 KB).
- Python conversion baseline: `D:\espprojects\oled\convert_reel.py` (demonstrates Floyd-Steinberg dithering and row-major LSB-first XBMP packing).
- Firmware: `D:\espprojects\oled\src\main.cpp` and `D:\espprojects\oled\src\frames.h`.
- Web Studio directory: `web/` is planned under Milestone M1 and not yet implemented.

---

## 2. Test Runner Architecture & Evaluation

### 2.1 Runner Options Comparison

| Dimension | Option A: Python pytest | Option B: Python unittest + Custom Runner | Option C: Node.js (npm / vitest) | Option D: Hybrid Runner (`runner.py` + `runner_node.mjs`) |
|---|---|---|---|---|
| **Prerequisites** | Requires `pip install pytest` (external install) | **Zero dependencies** (uses standard library `unittest` + existing `numpy`/`PIL`/`cv2`) | Requires `npm install` inside `web/` | **Zero dependencies** for both Python and Node runtimes |
| **Media Decoding** | Excellent via OpenCV/PIL | **Excellent via OpenCV/PIL** | Requires pure-JS decoders or WASM | **Best of both worlds**: Python decodes media; Node runs web engine |
| **Windows CLI** | Requires configuring PATH or alias | **Fully functional via `py -3` launcher or `run.bat`** | Requires `npm.cmd` due to execution policy | **100% reliable on Windows CMD and PowerShell** |
| **Exit Code Contract** | 0 on pass, non-zero on fail | **0 on pass, non-zero on fail** | 0 on pass, non-zero on fail | **0 on pass, non-zero on fail** |
| **Recommendation** | Not feasible without pip | **Recommended Primary Test Harness** | Recommended for Web Studio unit tests | **Architectural Standard** |

### 2.2 Selected Test Runner Architecture

The test harness is implemented as a **Unified Python CLI Test Runner** with a complementary native Node engine runner:

1. **Primary Entrypoint**: `D:\espprojects\oled\test\e2e\runner.py`
   - Invoked via: `py -3 test/e2e/runner.py` or `python test/e2e/runner.py`
   - Uses Python's built-in `unittest.TestLoader`, `unittest.TestSuite`, and `unittest.TextTestRunner`.
   - Incorporates custom CLI argument parsing:
     - `--tier <1..5>`: Run specific test tier.
     - `--feature <F01..F27>`: Run tests targeting a specific feature ID.
     - `--verbose` (`-v`): Verbose output with per-test timing and status.
     - `--failfast` (`-x`): Stop immediately on first test failure.
     - `--json <path>`: Emit machine-readable JSON execution summary.
     - `--junit <path>`: Emit standard JUnit XML report.
   - Enforces strict exit code contract:
     - Exit code `0`: All executed test cases passed.
     - Exit code `1`: One or more test cases failed or errored.
     - Exit code `2`: CLI argument or configuration error.
2. **Windows Helper Launcher**: `D:\espprojects\oled\test\e2e\run.bat`
   - Auto-detects whether `py`, `python`, or `node` is available in PATH.
   - Forwards all arguments to `runner.py`.
   - Preserves exit code via `exit /b %ERRORLEVEL%`.
3. **Web Engine Sub-Runner**: `D:\espprojects\oled\test\e2e\runner_node.mjs`
   - Uses Node.js 24's native `node:test` and `node:assert`.
   - Executes unit checks against `web/src/engine/` modules without requiring external test dependencies.

---

## 3. Test Harness Directory Structure

The complete directory structure in `D:\espprojects\oled\test\e2e\` is organized with strict separation between test fixtures, mathematical/protocol oracles, test tiers, and utilities:

```
D:\espprojects\oled\test\e2e\
├── runner.py                        # Master CLI Test Runner (Python 3)
├── runner_node.mjs                  # Complementary Engine Runner (Node 24 native)
├── run.bat                          # Windows CLI one-click batch launcher
├── __init__.py
├── config.py                        # Global constants (128x64, 1024 bytes, 921600 baud, timeouts)
│
├── fixtures/                        # Synthetic Media Generators & Static Fixtures
│   ├── __init__.py
│   ├── media_generator.py           # Programmatic MP4, animated GIF, PNG sequence generator
│   ├── sample_media/
│   │   ├── igexport_sample.mp4      # Copy or symlink of igexport-DckvRqKPsI_.mp4
│   │   ├── synthetic_10frame.mp4    # Generated 720x1280 10-frame test reel
│   │   ├── animated_test.gif        # Multi-frame animated GIF with disposal modes
│   │   ├── png_sequence/            # Natural-sort PNG frame sequence (frame_1..10.png)
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

## 4. Synthetic Media Generation & Mock Fixtures

The fixture generation module (`test/e2e/fixtures/media_generator.py`) generates deterministic media files on demand:

```python
# test/e2e/fixtures/media_generator.py (Architecture)
import os, cv2, numpy as np
from PIL import Image, ImageDraw, ImageFont

class MediaGenerator:
    def __init__(self, output_dir):
        self.out_dir = output_dir
        os.makedirs(self.out_dir, exist_ok=True)

    def generate_synthetic_mp4(self, filename="synthetic_10frame.mp4", width=720, height=1280, num_frames=10, fps=30.0):
        filepath = os.path.join(self.out_dir, filename)
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(filepath, fourcc, fps, (width, height))
        for i in range(num_frames):
            frame = np.zeros((height, width, 3), dtype=np.uint8)
            # Add dynamic test patterns: luminance ramp, moving square, frame index text
            cv2.rectangle(frame, (50, 50 + i * 80), (670, 110 + i * 80), (255, 255, 255), -1)
            cv2.putText(frame, f"FRAME {i:02d}", (100, 640), cv2.FONT_HERSHEY_SIMPLEX, 3.0, (255, 255, 255), 5)
            out.write(frame)
        out.release()
        return filepath

    def generate_synthetic_gif(self, filename="animated_test.gif", width=128, height=64, num_frames=5, duration_ms=100):
        filepath = os.path.join(self.out_dir, filename)
        frames = []
        for i in range(num_frames):
            img = Image.new('RGB', (width, height), color=(0, 0, 0))
            draw = ImageDraw.Draw(img)
            # Translate circle across canvas
            cx = 20 + i * 20
            draw.ellipse([cx - 10, 22, cx + 10, 42], fill=(255, 255, 255))
            frames.append(img)
        frames[0].save(filepath, save_all=True, append_images=frames[1:], duration=duration_ms, loop=0, disposal=2)
        return filepath

    def generate_png_sequence(self, subfolder="png_sequence", count=10):
        seq_dir = os.path.join(self.out_dir, subfolder)
        os.makedirs(seq_dir, exist_ok=True)
        paths = []
        # Deliberately generate filenames to test natural collation sorting (1, 2, ..., 10)
        for i in range(1, count + 1):
            img = Image.new('L', (128, 64), color=0)
            draw = ImageDraw.Draw(img)
            draw.line([(i * 12, 0), (i * 12, 63)], fill=255, width=2)
            fname = f"frame_{i}.png"
            p = os.path.join(seq_dir, fname)
            img.save(p)
            paths.append(p)
        return paths

    def generate_corrupt_files(self):
        # 0-byte file
        with open(os.path.join(self.out_dir, "corrupt_zero_byte.bin"), "wb") as f:
            pass
        # Truncated MP4 (first 32 bytes only)
        with open(os.path.join(self.out_dir, "corrupt_header.mp4"), "wb") as f:
            f.write(b"\x00\x00\x00\x20ftypisom\x00\x00\x02\x00isomiso2mp41")
        # Corrupt magic GIF
        with open(os.path.join(self.out_dir, "corrupt_bad_magic.gif"), "wb") as f:
            f.write(b"BADGIF89a\x80\x00\x40\x00\x00\x00")
        # Non-standard dimensions: 1x1, 129x65
        Image.new('RGB', (1, 1), (255, 0, 0)).save(os.path.join(self.out_dir, "dim_1x1.png"))
        Image.new('RGB', (129, 65), (0, 255, 0)).save(os.path.join(self.out_dir, "dim_129x65.png"))
```

---

## 5. WebSerial OLED-Stream v1 Protocol Simulator & Oracle

The WebSerial protocol simulator (`test/e2e/oracles/protocol_simulator.py`) acts as a software mock of the ESP32-S3 firmware serial receiver:

### 5.1 Protocol State Machine Specification

```
                +---------------------+
                |     WAIT_MAGIC_1    | <---------+
                +---------------------+           | (Timeout > 100ms or
                   | byte == 0xAA                 |  Checksum Error)
                   v                              |
                +---------------------+           |
                |     WAIT_MAGIC_2    | ----------+
                +---------------------+
                   | byte == 0x55
                   v
                +---------------------+
                |     READ_COMMAND    | (0x01 = Render, 0x02 = Ping, 0x03 = Reset)
                +---------------------+
                   |
                   v
                +---------------------+
                |     READ_LENGTH     | (2 bytes Big-Endian: 0x0400 = 1024)
                +---------------------+
                   |
                   v
                +---------------------+
                |     READ_PAYLOAD    | (Accumulate 1024 bytes into buffer)
                +---------------------+
                   | 1024 bytes read
                   v
                +---------------------+
                |    VERIFY_CHECKSUM  |
                +---------------------+
                   |                |
           Valid   |                | Checksum mismatch
                   v                v
            [ Send ACK 0x06 ]   [ Send NAK 0x15 ]
                   |                |
                   +--------+-------+
                            |
                            v
                     [ WAIT_MAGIC_1 ]
```

### 5.2 Checksum Algorithm

The 1-byte XOR checksum is calculated across the command byte, length bytes, and all payload bytes:

$$\text{Checksum} = \text{Command} \oplus \text{Len\_H} \oplus \text{Len\_L} \oplus \bigoplus_{i=0}^{1023} \text{Payload}[i]$$

### 5.3 Flow Control & Timing Verification

- **Baud Rate**: 921600 baud, 8N1 (10 bits per byte).
- **Packet Transmission Time**:
  $$t_{\text{transfer}} = \frac{1030 \text{ bytes} \times 10 \text{ bits/byte}}{921600 \text{ bits/s}} \approx 11.18 \text{ ms}$$
- **I2C Display Flush Time** (Fast Mode 400 kHz):
  $$t_{\text{i2c}} \approx 24.0 \text{ ms}$$
- **Total Frame Budget**: $11.18 \text{ ms} + 24.0 \text{ ms} = 35.18 \text{ ms}$ (enables up to 28.4 FPS; with DMA/pipelining up to 40 FPS).
- **Flow Control Handshake**:
  - The simulator responds with `0x06` (ACK) only after payload ingestion and checksum validation succeed.
  - The test harness verifies that the host does not transmit frame $N+1$ before frame $N$ receives `0x06`.
  - Stale frames or delayed ACKs ($> 150 \text{ ms}$) trigger retransmit or drop assertions.
- **Watchdog Timeout**: Inactivity $> 2000 \text{ ms}$ triggers transition from `STREAMING` to `STANDALONE` (PROGMEM reel playback).

---

## 6. Mathematical Ground-Truth Validation Oracles

Implemented in `test/e2e/oracles/`:

### 6.1 Grayscale, Brightness & Contrast Oracle (`dither_oracle.py`)

```python
def calculate_luminance(rgb_array, alpha_array=None):
    # ITU-R BT.601 coefficients
    Y = 0.299 * rgb_array[:, :, 0] + 0.587 * rgb_array[:, :, 1] + 0.114 * rgb_array[:, :, 2]
    if alpha_array is not None:
        Y = Y * (alpha_array / 255.0)
    return Y

def adjust_brightness_contrast(Y, brightness=0, contrast=0, invert=False):
    # brightness in [-100, 100], contrast in [-100, 100]
    B_prime = brightness * 2.55
    C_prime = contrast * 2.55
    F = (259.0 * (C_prime + 255.0)) / (255.0 * (259.0 - C_prime))
    Y_adj = np.clip(np.round(F * (Y - 128.0) + 128.0 + B_prime), 0, 255)
    if invert:
        Y_adj = 255.0 - Y_adj
    return Y_adj
```

### 6.2 Dithering Oracles (`dither_oracle.py`)

#### A. Atkinson Dithering (75% Error Diffusion)
- **Key Invariant**: Bill Atkinson's kernel distributes error to 6 neighbors with divisor 8. Exactly $\frac{6}{8} = 75\%$ of the error is diffused; **25% is discarded**.
- **Implementation**:
```python
def atkinson_dither(gray_2d):
    buf = np.copy(gray_2d).astype(np.float32)
    h, w = buf.shape
    out = np.zeros((h, w), dtype=np.uint8)
    for y in range(h):
        for x in range(w):
            old_val = buf[y, x]
            new_val = 255.0 if old_val >= 128.0 else 0.0
            out[y, x] = 1 if new_val == 255.0 else 0
            err = (old_val - new_val) / 8.0
            # 6 neighbor offsets:
            for dx, dy in [(1, 0), (2, 0), (-1, 1), (0, 1), (1, 1), (0, 2)]:
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h:
                    buf[ny, nx] += err
    return out
```

#### B. Floyd-Steinberg Dithering (100% Error Diffusion)
- **Key Invariant**: Divisor 16. Weights: $(x+1, y) \to 7/16$, $(x-1, y+1) \to 3/16$, $(x, y+1) \to 5/16$, $(x+1, y+1) \to 1/16$. Total $16/16 = 100\%$.
```python
def floyd_steinberg_dither(gray_2d):
    buf = np.copy(gray_2d).astype(np.float32)
    h, w = buf.shape
    out = np.zeros((h, w), dtype=np.uint8)
    for y in range(h):
        for x in range(w):
            old_val = buf[y, x]
            new_val = 255.0 if old_val >= 128.0 else 0.0
            out[y, x] = 1 if new_val == 255.0 else 0
            err = old_val - new_val
            for dx, dy, weight in [(1, 0, 7/16), (-1, 1, 3/16), (0, 1, 5/16), (1, 1, 1/16)]:
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h:
                    buf[ny, nx] += err * weight
    return out
```

#### C. Bayer Ordered Dithering (2x2, 4x4, 8x8)
- Threshold matrix lookup without error diffusion.
- Spatially static, produces zero temporal flicker across video frames.
```python
def bayer_dither(gray_2d, matrix_size=4):
    if matrix_size == 2:
        M = np.array([[0, 2], [3, 1]], dtype=np.float32)
    elif matrix_size == 4:
        M = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], dtype=np.float32)
    elif matrix_size == 8:
        # Recursive construction
        M4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], dtype=np.float32)
        M = np.block([[4 * M4, 4 * M4 + 2], [4 * M4 + 3, 4 * M4 + 1]])
    
    n = matrix_size
    T = ((M + 0.5) / (n * n)) * 255.0
    h, w = gray_2d.shape
    out = np.zeros((h, w), dtype=np.uint8)
    for y in range(h):
        for x in range(w):
            threshold = T[y % n, x % n]
            out[y, x] = 1 if gray_2d[y, x] > threshold else 0
    return out
```

### 6.3 XBMP 1-Bit Row-Major LSB-First Packing Oracle (`xbmp_oracle.py`)

```python
def pack_xbmp(binary_2d):
    """Packs 128x64 binary pixels (1=white, 0=black) into 1024 XBMP bytes."""
    h, w = binary_2d.shape
    assert w == 128 and h == 64, f"Invalid dimensions: {w}x{h}"
    bytes_per_row = w // 8 # 16
    xbmp = bytearray(bytes_per_row * h)
    for y in range(h):
        for bx in range(bytes_per_row):
            byte_val = 0
            for b in range(8):
                pixel = binary_2d[y, bx * 8 + b]
                if pixel > 0:
                    byte_val |= (1 << b) # LSB-first
            xbmp[y * bytes_per_row + bx] = byte_val
    return bytes(xbmp)

def unpack_xbmp(xbmp_bytes, width=128, height=64):
    """Unpacks 1024 XBMP bytes into 128x64 binary numpy array."""
    assert len(xbmp_bytes) == (width // 8) * height
    bytes_per_row = width // 8
    pixels = np.zeros((height, width), dtype=np.uint8)
    for y in range(height):
        for bx in range(bytes_per_row):
            byte_val = xbmp_bytes[y * bytes_per_row + bx]
            for b in range(8):
                pixels[y, bx * 8 + b] = (byte_val >> b) & 1
    return pixels
```

### 6.4 PackBits RLE Oracle (`rle_oracle.py`)

- **Encoder**: Compresses uniform runs into signed length byte + value; emits uncompressed literals when entropy is high.
- **Decompressor**:
```python
def decompress_packbits(rle_bytes, expected_len=1024):
    out = bytearray()
    i = 0
    while i < len(rle_bytes):
        header = rle_bytes[i]
        i += 1
        if header > 127: # Negative signed int8: run of identical bytes
            count = 257 - header
            val = rle_bytes[i]
            i += 1
            out.extend([val] * count)
        else: # Positive signed int8: literal bytes
            count = header + 1
            out.extend(rle_bytes[i:i + count])
            i += count
    assert len(out) == expected_len, f"Decompressed size mismatch: {len(out)} vs {expected_len}"
    return bytes(out)
```

### 6.5 C++ Header Validator Oracle (`cpp_header_oracle.py`)

- Parses `src/frames.h` or exported header strings.
- Uses regex to verify:
  1. `#define FRAME_WIDTH 128`
  2. `#define FRAME_HEIGHT 64`
  3. `#define FRAME_BYTES_PER_ROW 16`
  4. `#define FRAME_SIZE_BYTES 1024`
  5. `#define NUM_FRAMES <N>`
  6. `#define FRAME_FPS <FPS>`
  7. Array identifier `reel_frames` or `epd_bitmap_allArray`.
  8. Hex literals count exactly equals $N \times 1024$.

---

## 7. Synthesis with Peer Explorers & Coverage Mapping

The test infrastructure is designed to seamlessly host the test specifications developed by `explorer_e2e_2_r1` and `spec_miner_e2e_3_r1`:

| Tier | Lead Designer | Target Modules in `test/e2e/tiers/` | Target Test Count |
|---|---|---|---|
| **Tier 1: Feature Coverage** | `explorer_e2e_2_r1` | `tier1_feature/test_f01_f05_ingestion.py`<br>`tier1_feature/test_f06_f10_dithering.py`<br>`tier1_feature/test_f11_f13_canvas.py`<br>`tier1_feature/test_f14_f17_procedural.py`<br>`tier1_feature/test_f18_f20_exporter.py`<br>`tier1_feature/test_f21_f25_hardware.py`<br>`tier1_feature/test_f26_f27_e2e_audit.py` | $\ge 135$ tests ($\ge 5$ per feature across F01–F27) |
| **Tier 2: Boundary & Corner Cases** | `explorer_e2e_2_r1` | `tier2_boundaries/test_empty_corrupt_inputs.py`<br>`tier2_boundaries/test_dimension_boundaries.py`<br>`tier2_boundaries/test_slider_extremes.py`<br>`tier2_boundaries/test_buffer_boundaries.py`<br>`tier2_boundaries/test_timing_boundaries.py` | $\ge 135$ tests ($\ge 5$ boundary tests per feature) |
| **Tier 3: Combinations** | `spec_miner_e2e_3_r1` | `tier3_combinations/test_feature_pairs.py` | $\ge 27$ tests (Pairwise interactions) |
| **Tier 4: Real-World Scenarios** | `spec_miner_e2e_3_r1` | `tier4_scenarios/test_creator_workflows.py` | $\ge 14$ tests (End-to-end workflows) |
| **Tier 5: Adversarial Hardening** | `explorer_e2e_1_r1` | `tier5_adversarial/test_stress_hardening.py` | $\ge 10$ tests (Stress & fault injection) |
| **Total Test Suite** | **All Tracks** | **`test/e2e/` Complete Suite** | **$\ge 321$ Total Automated Tests** |

---

## 8. Draft TEST_INFRA.md Publication

The exact, complete, production-ready specification document has been generated and saved to:
`D:\espprojects\oled\.agents\explorer_e2e_1_r1\proposed_TEST_INFRA.md`

Upon approval by the sub-orchestrator (`sub_orch_e2e`), this document will be published to the project root at `D:\espprojects\oled\TEST_INFRA.md`.
