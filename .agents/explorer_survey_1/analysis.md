# Codebase & Hardware Environment Analysis Report

**Project Root**: `D:\espprojects\oled`  
**Explorer Agent**: `explorer_survey_1`  
**Date**: 2026-09-17 / 2026-09-18  

---

## Executive Summary

The existing project is a PlatformIO-based ESP32-S3 visual engine driving a 128×64 monochrome OLED display via I2C. The current firmware (`src/main.cpp`) exclusively plays back a static, pre-compiled 466-frame video reel stored in flash memory (`src/frames.h`, ~466 KB in PROGMEM) at 30 FPS. The accompanying Python script (`convert_reel.py`) extracts frames from a sample 720×1280 Instagram Reel (`igexport-DckvRqKPsI_.mp4`), center-crops to a 2:1 aspect ratio (720×360), resizes to 128×64, applies Floyd-Steinberg dithering, packs the bits into row-major LSB-first XBMP bytes, and outputs the C++ PROGMEM array.

**Current limitation**: The firmware contains zero serial reception logic, cannot receive frames dynamically, and uses standard 115200 baud UART which is mathematically incapable of streaming 1024-byte frames at 30 FPS (~307 kbps needed).

To support real-time WebSerial streaming at 15–30 FPS with seamless fallback to PROGMEM playback, the firmware requires:
1. Baud rate increase to **921600 baud** (or enabling ESP32-S3 Native USB CDC).
2. Expansion of the serial RX ring buffer (`Serial.setRxBufferSize(2048)`).
3. A robust binary packet framing protocol (magic header, packet type, length, payload, checksum, and ACK token flow control).
4. A dual-mode state machine switching between `STREAMING` (live WebSerial) and `STANDALONE` (PROGMEM reel loop) with an automatic timeout watchdog.
5. Dual-controller support for both SH1106 and SSD1306 displays.

---

## 1. Codebase & Directory Structure Analysis

### Directory Tree

```
D:\espprojects\oled\
├── .agents/                    # Agent orchestration metadata and analysis
│   ├── ORIGINAL_REQUEST.md     # Authoritative user requirements
│   ├── orchestrator/           # Master plan, progress, context
│   └── explorer_survey_1/      # Working directory for this exploration
├── .pio/                       # PlatformIO build artifacts & cache
│   └── build/esp32-s3-devkitc-1/firmware.elf (built successfully: 780KB Flash, 20KB RAM)
├── .vscode/                    # VSCode IDE configuration
├── convert_reel.py             # Video conversion script (OpenCV + PIL + NumPy)
├── igexport-DckvRqKPsI_.mp4    # Sample 720x1280 vertical video reel (466 frames, 30 FPS)
├── platformio.ini              # PlatformIO configuration for ESP32-S3 DevKitC-1 N16R8
├── src/
│   ├── main.cpp                # ESP32-S3 Arduino firmware entrypoint (50 lines)
│   ├── frames.h                # 466-frame XBMP PROGMEM array (2.86 MB header file)
│   └── previews/               # Frame screenshots (frame_000.png, frame_030.png, etc.)
├── include/                    # Empty PlatformIO include directory (README only)
├── lib/                        # Empty PlatformIO private library directory (README only)
└── test/                       # Empty PlatformIO unit testing directory (README only)
```

### File Details & Role

| File Path | Size | Description & Role |
|---|---|---|
| `platformio.ini` | 1,062 B | Configures target board `esp32-s3-devkitc-1`, Arduino framework, N16R8 memory flags, COM11 port, U8g2 dependency. |
| `src/main.cpp` | 1,473 B | Implements display initialization and timer loop playing `reel_frames[currentFrame]` using `u8g2.drawXBMP()`. |
| `src/frames.h` | 2,866,797 B | Auto-generated C++ header containing `reel_frames[466][1024]` in PROGMEM, total 477,184 bytes. |
| `convert_reel.py` | 5,784 B | Python pipeline: loads MP4, center-crops 2:1, scales to 128x64, dithers with Floyd-Steinberg, generates `frames.h`. |
| `igexport-DckvRqKPsI_.mp4` | 452,393 B | Source video: 720x1280 vertical MP4, 466 frames, 30.0 FPS, duration 15.53 seconds. |
| `src/previews/*.png` | ~600-850 B ea | 6 sample 128x64 1-bit PNG preview files generated at frames 0, 30, 60, 120, 200, 300. |

---

## 2. Hardware Environment & Configuration

### Target Board & MCU Specifications

- **Board**: Espressif ESP32-S3-DevKitC-1-N8 / N16R8 (`board = esp32-s3-devkitc-1` in `platformio.ini:13`).
- **MCU**: ESP32-S3 (Xtensa® dual-core 32-bit LX7 microprocessor up to 240 MHz, vector instructions, RISC-V ULP co-processor).
- **Platform**: Espressif 32 (`platform = espressif32`, version 7.1.1).
- **Core Framework**: `framework = arduino` (`framework-arduinoespressif32 @ 3.20017.241212`).
- **Memory Configuration**:
  - `board_build.arduino.memory_type = qio_opi` (`platformio.ini:21`)
  - `board_build.flash_mode = qio` (`platformio.ini:22`)
  - `board_build.psram_type = opi` (`platformio.ini:23`)
  - `board_upload.flash_size = 16MB` (`platformio.ini:24`)
  - `build_flags = -DBOARD_HAS_PSRAM` (`platformio.ini:29`)
  - *Note*: Lines 31-32 have native USB CDC flags commented out:
    ```ini
    ; -DARDUINO_USB_MODE=1
    ; -DARDUINO_USB_CDC_ON_BOOT=1
    ```
- **Port**: `COM11` (upload and monitor at 115200 baud).

### I2C Pin Configuration

Defined in `src/main.cpp:7-8`:
```cpp
#define OLED_SDA 8
#define OLED_SCL 9
```
- **SDA Pin**: GPIO 8
- **SCL Pin**: GPIO 9
- **Bus Initialization**: `Wire.begin(OLED_SDA, OLED_SCL, 400000);` (`main.cpp:21`)
- **Bus Speed**: 400 kHz Fast-mode I2C (`u8g2.setBusClock(400000);` at `main.cpp:25`).

### OLED Display Controller: SH1106 vs. SSD1306

- **Active Driver in Firmware**:
  ```cpp
  U8G2_SH1106_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, /* reset=*/ U8X8_PIN_NONE);
  ```
  (`src/main.cpp:11`)
- **Display Resolution**: 128 columns × 64 rows, monochrome (1-bit per pixel).
- **Key Differences between SH1106 and SSD1306**:
  | Feature | SH1106 | SSD1306 |
  |---|---|---|
  | **Internal RAM Matrix** | 132 columns × 64 rows | 128 columns × 64 rows |
  | **Column Addressing Offset** | Active display spans columns 2 through 129 (2-pixel offset) | Active display spans columns 0 through 127 (no offset) |
  | **U8g2 Constructor** | `U8G2_SH1106_128X64_NONAME_F_HW_I2C` | `U8G2_SSD1306_128X64_NONAME_F_HW_I2C` |
  | **Impact of Wrong Driver** | If SSD1306 driver is run on SH1106, image is shifted right by 2 pixels, and column 0-1 contains uninitialized noise. | If SH1106 driver is run on SSD1306, image is shifted left by 2 pixels, truncating columns 0-1. |
  | **I2C Page Addressing** | Page addressing only (B0h-B7h) | Horizontal, Vertical, and Page addressing modes |
- **Display Library**: `olikraus/U8g2 @ ^2.35.19` (installed: 2.36.18).
  - Mode `_F_` indicates **Full Frame Buffer** mode (allocates 1024 bytes in ESP32 SRAM).
  - Memory consumption: Very low (RAM usage is only ~20 KB out of 320 KB internal SRAM, 6.3%).

---

## 3. Video Pipeline & Dithering Analysis (`convert_reel.py`)

The script `convert_reel.py` defines the current conversion pipeline from video file to C++ header.

### 1. Video Loading & Geometry Inspection
- Opens video via `cv2.VideoCapture(video_path)` (`lines 40-48`).
- Reads properties: `orig_w = 720`, `orig_h = 1280`, `fps = 30.0`, `total_frames = 466`.

### 2. Aspect Ratio Crop & Scale
- Displays have a 2:1 aspect ratio (`128 / 64 = 2.0`), whereas mobile reels are 9:16 (`720 / 1280 = 0.5625`).
- Center crop calculation (`convert_reel.py:58-69`):
  ```python
  crop_w = orig_w          # 720
  crop_h = int(orig_w / target_aspect) # 720 / 2.0 = 360
  crop_x = (orig_w - crop_w) // 2      # 0
  crop_y = (orig_h - crop_h) // 2      # (1280 - 360) // 2 = 460
  ```
- Crops rectangle `(x=0, y=460, w=720, h=360)` from center.
- Resizes cropped ROI to `(128, 64)` using `cv2.resize(..., interpolation=cv2.INTER_AREA)` (`line 88`).

### 3. Grayscale & Dithering
- Converts BGR to Grayscale:
  ```python
  gray_img = Image.fromarray(cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)).convert('L')
  ```
- Two dithering modes (`convert_reel.py:94-101`):
  1. **Thresholding** (if `threshold_val` provided):
     `gray_img.point(lambda x: 255 if x > threshold_val else 0, mode='1')`
  2. **Floyd-Steinberg Dithering** (default):
     `gray_img.convert('1', dither=Image.Dither.FLOYDSTEINBERG)`
- *Missing in Python script vs ORIGINAL_REQUEST*: Atkinson dithering and Bayer ordered matrix dithering are not implemented in `convert_reel.py`. (These must be implemented in the Vite+React web converter application).

### 4. Bit Packing into XBMP Byte Format (`convert_frame_to_xbmp`)
Implemented in `convert_reel.py:7-33`:
- Target: 128 width, 64 height.
- `bytes_per_row = 128 // 8 = 16` bytes.
- Total bytes per frame: `16 * 64 = 1024` bytes.
- Traversal order: **Row-major** (`for y in range(height): for x in range(0, width, 8)`).
- Bit significance within byte: **LSB First (Least Significant Bit on left)**:
  ```python
  for b in range(8):
      pixel = 1 if arr[y, x + b] > 0 else 0
      byte_val |= (pixel << b)  # bit 0 = x+0, bit 7 = x+7
  ```
  - `pixel = 1` represents White (lit OLED pixel).
  - `pixel = 0` represents Black (unlit OLED pixel).
- Compatibility: This bit mapping exactly matches U8g2's `u8g2.drawXBMP(x, y, width, height, bitmap)`.

### 5. C++ Header Generation
- Writes `src/frames.h`:
  ```cpp
  #define NUM_FRAMES 466
  #define FRAME_WIDTH 128
  #define FRAME_HEIGHT 64
  #define FRAME_BYTES_PER_ROW 16
  #define FRAME_SIZE_BYTES 1024
  #define FRAME_FPS 30

  const uint8_t reel_frames[NUM_FRAMES][FRAME_SIZE_BYTES] PROGMEM = {
    { 0xFF, 0xFF, ... },
    ...
  };
  ```
- Total array footprint in Flash: 466 × 1024 = 477,184 bytes (~466 KB).

---

## 4. Current Firmware Capability Assessment

Inspecting `src/main.cpp`:

```cpp
14:   Serial.begin(115200);
...
30: void loop() {
31:   static unsigned long lastFrameTime = 0;
32:   static int currentFrame = 0;
33:   
34:   const unsigned long frameIntervalMs = 1000 / FRAME_FPS; // ~33ms for 30 FPS
35: 
36:   unsigned long now = millis();
37:   if (now - lastFrameTime >= frameIntervalMs) {
38:     lastFrameTime = now;
39: 
40:     // Draw current frame bitmap directly onto display buffer
41:     u8g2.clearBuffer();
42:     u8g2.drawXBMP(0, 0, FRAME_WIDTH, FRAME_HEIGHT, reel_frames[currentFrame]);
43:     u8g2.sendBuffer();
44: 
45:     currentFrame++;
46:     if (currentFrame >= NUM_FRAMES) {
47:       currentFrame = 0; // Loop playback continuously
48:     }
49:   }
50: }
```

### Capabilities Identified
- Hardware I2C initialized on SDA=8, SCL=9 at 400 kHz fast mode.
- U8g2 SH1106 driver configured with full frame buffer.
- Autonomous frame timer based on non-blocking `millis()`.
- Clean compilation under PlatformIO (`firmware.elf`: 780 KB Flash, 20 KB RAM).

### Gaps & Limitations
1. **No Serial Reception**: `Serial.available()` or `Serial.read()` is never called. It cannot receive data over USB or WebSerial.
2. **Hardcoded Baud Rate**: `115200` baud is used only for logging a startup banner.
3. **Default Small RX Buffer**: Arduino ESP32 defaults to a 256-byte UART RX ring buffer. An incoming 1024-byte frame will immediately overflow and drop bytes without `Serial.setRxBufferSize()`.
4. **No Protocol / Framing**: No packet headers, sync words, or flow control exist.
5. **No State Machine**: There is no distinction between streaming mode and offline PROGMEM playback.
6. **Hardcoded Display Driver**: Only `SH1106` is compiled in; no runtime or compile-time switch for `SSD1306`.

---

## 5. Firmware Requirements for Real-Time WebSerial Streaming (15–30 FPS) & PROGMEM Playback

### A. Baud Rate & Bandwidth Analysis

- **Frame Payload Size**: 128 × 64 ÷ 8 = **1024 bytes per frame**.
- **Bandwidth at 15 FPS**:
  $$15 \text{ fps} \times 1024 \text{ bytes} = 15,360 \text{ bytes/s}$$
  With standard UART 8N1 framing (1 start bit, 8 data bits, 1 stop bit = 10 line bits per byte):
  $$\text{Required Baud} = 15,360 \times 10 = 153,600 \text{ baud}$$
- **Bandwidth at 30 FPS**:
  $$30 \text{ fps} \times 1024 \text{ bytes} = 30,720 \text{ bytes/s}$$
  $$\text{Required Baud} = 30,720 \times 10 = 307,200 \text{ baud}$$
- **115200 Baud Limit**:
  $$\text{Max Throughput} = \frac{115,200}{10} = 11,520 \text{ bytes/s} \implies \approx 11.25 \text{ FPS max (theoretical zero-overhead)}$$
  Therefore, **115200 baud is mathematically incapable of streaming 15–30 FPS**.
- **Recommended Serial Solutions**:
  1. **High-Speed UART (921600 baud)**:
     $$\text{Max Throughput} = \frac{921,600}{10} = 92,160 \text{ bytes/s} \implies \text{Up to } 90 \text{ FPS bandwidth}$$
     WebSerial in Chrome/Edge supports 921600 baud natively across all major USB-to-UART bridges (CP2102, CH340, FTDI).
  2. **ESP32-S3 Native USB CDC (USB-OTG Full Speed 12 Mbps)**:
     Enabling `-DARDUINO_USB_MODE=1` and `-DARDUINO_USB_CDC_ON_BOOT=1` in `platformio.ini` allows direct USB packet transmission at up to 12 Mbps (>1 MB/s), where baud rate settings are virtual.
  3. **Compression Option (RLE)**:
     Simple 1-bit RLE (Run-Length Encoding) compresses graphics frames with large black or white areas by 2× to 5×, lowering bandwidth requirement. However, at 921600 baud, raw 1024-byte streaming requires only ~11.1 ms per frame over the wire, which is well within the 33.3 ms budget of 30 FPS.

### B. Serial RX Buffer Sizing
The ESP32 HardwareSerial default RX buffer is 256 bytes.
- Must configure:
  ```cpp
  Serial.setRxBufferSize(2048); // or 4096 bytes
  Serial.begin(921600);
  ```
  before any incoming streaming begins.

### C. I2C Bus Timing & Frame Budget

- In U8g2 Full Buffer mode (`_F_`), calling `u8g2.sendBuffer()` transmits:
  - 8 pages (each 128 data bytes + page address command bytes) $\approx 1080$ bytes total per display refresh.
- At 400 kHz Fast I2C:
  $$1080 \text{ bytes} \times 9 \text{ clock cycles (8 bits + ACK)} = 9,720 \text{ clock cycles}$$
  $$\text{Transfer Time} = \frac{9,720}{400,000 \text{ Hz}} \approx 24.3 \text{ ms}$$
- **Frame Budget at 30 FPS**:
  - Total frame period = $\frac{1000}{30} = 33.33 \text{ ms}$.
  - I2C transfer = $24.3 \text{ ms}$.
  - Remaining CPU headroom = $33.33 - 24.3 = 9.03 \text{ ms}$ (plenty for 240 MHz ESP32-S3).
- **Optimization to 800 kHz I2C**:
  - Setting `u8g2.setBusClock(800000);` reduces transfer time to $\approx 12.2 \text{ ms}$, freeing up $>21 \text{ ms}$ per frame and allowing up to 60+ FPS if needed.

### D. Streaming Packet Protocol Design

To ensure reliable frame synchronization without drifting or corruption:

| Offset | Field | Length | Description |
|---|---|---|---|
| 0..1 | `MAGIC` | 2 bytes | Sync word: `0xAA 0x55` (identifies packet start) |
| 2 | `CMD` | 1 byte | Command: `0x01` (Frame Data), `0x02` (Mode Switch: Standalone), `0x03` (Mode Switch: Stream), `0x04` (Display Driver Select: SH1106=0, SSD1306=1) |
| 3..4 | `LENGTH` | 2 bytes | Payload size in bytes (1024 for uncompressed XBMP) |
| 5..1028 | `PAYLOAD` | 1024 bytes | Raw 1-bit XBMP frame data |
| 1029 | `CHECKSUM` | 1 byte | XOR or simple sum checksum of payload bytes |

#### Flow Control (ACK Token)
To prevent WebSerial write queues from overfilling the ESP32 serial RX buffer:
- Upon successfully validating and buffering/displaying a frame, ESP32 responds with a 1-byte ACK:
  ```cpp
  Serial.write(0x06); // ASCII ACK
  ```
- The WebSerial client dispatches the next frame upon receiving the ACK token (or paced via requestAnimationFrame / interval).

### E. Dual-Mode State Machine

```
              ┌────────────────────────────────────────┐
              │                                        │
              ▼                                        │ Timeout (>2000 ms)
      ┌───────────────┐   Valid Frame or 'STREAM' cmd  │ or 'PROGMEM' cmd
      │  STANDALONE   │ ─────────────────────────────> │ ┌───────────────┐
      │ PROGMEM LOOP  │                                │ │   STREAMING   │
      │   (30 FPS)    │ <───────────────────────────── │ │  (WebSerial)  │
      └───────────────┘                                │ └───────────────┘
              ▲                                        │
              │             Power On / Boot            │
              └────────────────────────────────────────┘
```

1. **Standalone Mode (`MODE_PROGMEM`)**:
   - Loops through `reel_frames[0..NUM_FRAMES-1]` at `FRAME_FPS` (30 FPS).
   - Monitors `Serial` in non-blocking fashion for the `0xAA 0x55` magic packet header.
2. **Streaming Mode (`MODE_STREAMING`)**:
   - When a valid streaming frame is received, state switches to `MODE_STREAMING`.
   - Incoming 1024-byte payload is rendered directly via `u8g2.drawXBMP(0, 0, 128, 64, frame_buf)`.
   - Sends ACK `0x06` back to host.
   - If no valid frame is received within 2000 ms (WebSerial disconnect or pause), firmware automatically falls back to `MODE_PROGMEM` and resumes looping flash frames.

### F. Dual Display Controller Support (SH1106 & SSD1306)

Because users may connect either an SH1106 or SSD1306 module, the firmware should accommodate both:
- Option 1 (Build Configuration): Provide `#define OLED_CONTROLLER_SH1106` and `#define OLED_CONTROLLER_SSD1306` selectable via `platformio.ini` build flags.
- Option 2 (Runtime Dynamic or Config Command): Support a serial configuration command (`CMD 0x04`) or initialize a base `U8G2` pointer that points to either `U8G2_SH1106_128X64_NONAME_F_HW_I2C` or `U8G2_SSD1306_128X64_NONAME_F_HW_I2C`.

---

## 6. Synthesis & Key Recommendations

1. **Web Engine Exporter Alignment**:
   The web application's C++ exporter must output header files identical in format to `convert_reel.py` (`src/frames.h`):
   - XBMP format: 16 bytes per row, 64 rows = 1024 bytes per frame.
   - Bit orientation: LSB first (`pixel << b`).
   - Constant definition: `const uint8_t reel_frames[NUM_FRAMES][FRAME_SIZE_BYTES] PROGMEM = { ... };`.
2. **WebSerial Protocol Alignment**:
   The web app's WebSerial streamer and the ESP32 firmware must share the exact packet structure:
   `[0xAA, 0x55, CMD_FRAME, 0x04, 0x00, <1024 bytes>, CHECKSUM]`.
3. **Firmware Upgrade Strategy**:
   - Upgrade `platformio.ini` to set monitor speed to `921600` (and document COM11 / native USB).
   - Refactor `src/main.cpp` into a clean state machine with `Serial.setRxBufferSize(2048)`, packet parser, timeout watchdog, and PROGMEM fallback.

---
*Report compiled by explorer_survey_1.*
