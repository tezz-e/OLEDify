# Project: OLED Visual Animation Engine & Converter

## Architecture
The system consists of a modern client-side Web Studio (Vite + React + TypeScript + Tailwind CSS) communicating with an ESP32-S3 microcontroller driving a 128×64 monochrome OLED display (SH1106 / SSD1306 via I2C).

```
+----------------------------------------------------------------------------------------------------+
|                                    Web Studio UI (Vite + React)                                     |
|                                                                                                    |
|  +-----------------------+     +-------------------------------+     +--------------------------+  |
|  |     Media Ingestion   |     |    Image Processing & Dither  |     |   Procedural FX Engine   |  |
|  | - MP4 / WebM (Video)  | --> | - Brightness / Contrast       | <-- | - Typewriter & Bounce    |  |
|  | - GIF (omggif)        |     | - Atkinson (75% error)        |     | - Glitch FX (XOR / Tear) |  |
|  | - PNG Sequences       |     | - Floyd-Steinberg (100%)      |     | - Starfield & Particle   |  |
|  | - 2:1 Crop & Scale    |     | - Bayer Matrix (2x2, 4x4, 8x8)|     +--------------------------+  |
|  +-----------------------+     | - Thresholding                |                   |               |
|                                +-------------------------------+                   |               |
|                                                |                                   |               |
|                                                v                                   v               |
|                                +---------------------------------------------------------------+   |
|                                |         128x64 1-bit Monochrome Frame Buffer (1024 B)         |   |
|                                |         (Row-Major LSB-First XBMP Layout)                     |   |
|                                +---------------------------------------------------------------+   |
|                                                |                                   |               |
|                       +------------------------+---------+                         |               |
|                       |                                  |                         |               |
|                       v                                  v                         v               |
|  +-------------------------------------+   +--------------------------+  +----------------------+  |
|  |      Simulated OLED Player          |   |       C++ Exporter       |  |  WebSerial Streamer  |  |
|  | - 128x64 Canvas with sub-pixel grid |   | - PROGMEM XBMP frames.h  |  | - 921600 Baud USB    |  |
|  | - Phosphor themes (Cyan/White/etc.) |   | - PackBits RLE Header    |  | - 0xAA 0x55 Protocol |  |
|  | - 15-30 FPS, Scrub, Step, Loop      |   | - 1-Click Copy/Download  |  | - ACK Flow Control   |  |
|  +-------------------------------------+   +--------------------------+  +----------------------+  |
+------------------------------------------------------------------------------------|---------------+
                                                                                     | USB Serial
                                                                                     v (COM Port)
+----------------------------------------------------------------------------------------------------+
|                             ESP32-S3 Hardware & Firmware (PlatformIO)                              |
|                                                                                                    |
|  +-------------------------------+      +-------------------------------+                          |
|  |       USB Serial Receiver     |      |       Offline PROGMEM Loop    |                          |
|  | - 921600 Baud, 2KB RX Buffer  |      | - Plays embedded frames       |                          |
|  | - 0xAA 0x55 Protocol Parser   |      | - Fallback on stream timeout  |                          |
|  +-------------------------------+      +-------------------------------+                          |
|                  \                              /                                                  |
|                   \                            /                                                   |
|                    v                          v                                                    |
|           +--------------------------------------------+                                           |
|           |       U8g2 Display Driver (SH1106/SSD1306) |                                           |
|           |       I2C Fast Mode (SDA=8, SCL=9, 400kHz) |                                           |
|           +--------------------------------------------+                                           |
|                                  |                                                                 |
|                                  v                                                                 |
|                     [ Physical 128x64 OLED Panel ]                                                 |
+----------------------------------------------------------------------------------------------------+
```

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F01 | Web Studio Project Setup | Vite + React + TypeScript + Tailwind CSS structure in `web/` | M1 | ORIGINAL_REQUEST §R1 |
| F02 | Video Drag & Drop Decoder | Decode MP4 & WebM files client-side using HTML5 Video + Offscreen Canvas | M1 | ORIGINAL_REQUEST §R1 |
| F03 | Animated GIF Decoder | Extract frames, delays, and disposal modes from GIFs using `omggif` | M1 | ORIGINAL_REQUEST §R1, Survey 2 |
| F04 | PNG Sequence Loader | Multi-file loader with alphanumeric natural sorting (`localeCompare`) | M1 | ORIGINAL_REQUEST §R1, Survey 2 |
| F05 | Interactive 2:1 Crop & Scale | Fixed 2:1 aspect ratio bounding box with Cover, Contain, Stretch presets | M1 | ORIGINAL_REQUEST §R1, Survey 2 |
| F06 | Brightness & Contrast Control | Real-time luminance adjustments prior to quantization | M2 | ORIGINAL_REQUEST §R1 |
| F07 | Atkinson Dithering | 6-neighbor error diffusion (divisor 8, 75% error diffused, 25% discarded) | M2 | ORIGINAL_REQUEST §R1, Survey 2 |
| F08 | Floyd-Steinberg Dithering | 4-neighbor error diffusion (divisor 16, 100% error diffused) | M2 | ORIGINAL_REQUEST §R1, Survey 2 |
| F09 | Bayer Ordered Dithering | 2×2, 4×4, and 8×8 threshold matrix dithering for flicker-free playback | M2 | ORIGINAL_REQUEST §R1, Survey 2 |
| F10 | Dynamic Thresholding | Simple luminance thresholding with adjustable cutoff slider | M2 | ORIGINAL_REQUEST §R1 |
| F11 | XBMP Binary Frame Packing | Pack 128×64 pixels into 1024-byte row-major LSB-first format (U8g2 compatible) | M2 | ORIGINAL_REQUEST §R1, Survey 1 & 2 |
| F12 | Simulated OLED Canvas Player | 128×64 canvas rendering with sub-pixel grid, glow, and phosphor color themes | M2 | ORIGINAL_REQUEST §R1, Survey 2 |
| F13 | Playback Controls & Timeline | Play/pause, step forward/back, loop toggle, scrub bar, and 15–30 FPS selector | M2 | ORIGINAL_REQUEST §R1 |
| F14 | Text Typewriter & Bounce Lyric | Procedural text animation with typewriter reveal and elastic bounce physics | M3 | ORIGINAL_REQUEST §R3, Survey 3 |
| F15 | Glitch Shader FX | Procedural 1-bit glitch FX: XOR bitwise noise, horizontal row tearing shifts | M3 | ORIGINAL_REQUEST §R3, Survey 3 |
| F16 | Starfield & Particle Explosion | 3D perspective warp starfield and radial ballistic particle burst simulation | M3 | ORIGINAL_REQUEST §R3, Survey 3 |
| F17 | Procedural Timeline Integration | Generate procedural sequences directly into the studio timeline & preview | M3 | ORIGINAL_REQUEST §R3, Survey 3 |
| F18 | C++ PROGMEM Header Exporter | Generate `src/frames.h` with `epd_bitmap_allArray[][1024]` PROGMEM XBMP format | M4 | ORIGINAL_REQUEST §R2, Survey 1 & 3 |
| F19 | PackBits RLE Header Exporter | Compressed byte-level RLE format option with inline C++ decompressor routine | M4 | ORIGINAL_REQUEST §R2, Survey 3 |
| F20 | 1-Click Code Copy & Download | Instant clipboard copy and `.h` file download in Web UI | M4 | ORIGINAL_REQUEST §R2 |
| F21 | WebSerial USB Streamer | WebSerial connection management, 921600 baud, port auto-request, status UI | M4 | ORIGINAL_REQUEST §R2, Survey 1 & 3 |
| F22 | Binary Framing Protocol | OLED-Stream v1: `0xAA 0x55` header, CMD, length, 1024-byte payload, XOR checksum | M4 | ORIGINAL_REQUEST §R2, Survey 1 & 3 |
| F23 | Stop-and-Wait ACK Flow Control | Synchronous frame ACK handshake preventing ESP32-S3 RX buffer overrun | M4 | Survey 1 & 3 |
| F24 | ESP32-S3 Dual-Mode Firmware | Serial streaming receiver (2KB buffer, 921600 baud) + PROGMEM fallback player | M4 | ORIGINAL_REQUEST §R2, Survey 1 & 3 |
| F25 | SH1106 / SSD1306 Hardware Support | I2C Fast Mode (SDA=8, SCL=9) with compile-time or protocol display selection | M4 | ORIGINAL_REQUEST Context, Survey 1 |
| F26 | E2E Testing Suite (Tiers 1–4) | Complete automated test suite covering all features, boundaries, and scenarios | M5 | Project Pattern, Testing Track |
| F27 | Adversarial Coverage Hardening | Tier 5 white-box stress testing and edge-case validation | M5 | Project Pattern |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Web Studio Foundation & Media Ingestion | F01, F02, F03, F04, F05 | none | IN_PROGRESS |
| M2 | Image Processing, Dithering & OLED Player | F06, F07, F08, F09, F10, F11, F12, F13 | M1 | PLANNED |
| M3 | Procedural Engine Primitives | F14, F15, F16, F17 | M2 | PLANNED |
| M4 | C++ Exporter & WebSerial Hardware Streaming | F18, F19, F20, F21, F22, F23, F24, F25 | M2 | PLANNED |
| M5 | Integration & Final E2E Test Pass | F26, F27 | M1, M2, M3, M4 | PLANNED |

## Interface Contracts

### 1. Web Studio ↔ OLED Frame Format
- **Dimensions**: $128 \text{ pixels (width)} \times 64 \text{ pixels (height)}$.
- **Binary Size**: Exactly $1024 \text{ bytes}$ per frame ($16 \text{ bytes/row} \times 64 \text{ rows}$).
- **Bit Ordering**: Row-major, **LSB first** within each byte:
  - Byte 0: Row 0, Pixels 0..7 (Bit 0 = Pixel 0, Bit 7 = Pixel 7).
  - Byte 1: Row 0, Pixels 8..15 (Bit 0 = Pixel 8, Bit 7 = Pixel 15).
  - ...
  - Byte 15: Row 0, Pixels 120..127.
  - Byte 16: Row 1, Pixels 0..7.
  - Byte 1023: Row 63, Pixels 120..127.
- **Pixel Polarity**: `1` = White / Lit, `0` = Black / Unlit (matches U8g2 `drawXBMP`).

### 2. WebSerial Streaming Protocol (OLED-Stream v1)
- **Baud Rate**: `921600` baud, 8 data bits, no parity, 1 stop bit (8N1).
- **Frame Packet Structure (Host -> ESP32-S3)**:
  - `Header[0]`: `0xAA` (Sync Byte 1)
  - `Header[1]`: `0x55` (Sync Byte 2)
  - `Command`: `0x01` (Render Frame), `0x02` (Ping/Handshake), `0x03` (Clear/Reset)
  - `Payload Length`: 2 bytes Big-Endian (`0x0400` = 1024 bytes)
  - `Payload`: 1024 bytes of row-major LSB-first XBMP bitmap data
  - `Checksum`: 1 byte XOR of `Command`, `Len_H`, `Len_L`, and all 1024 payload bytes
- **Response Packet Structure (ESP32-S3 -> Host)**:
  - `0x06` (`ACK`): Frame verified, drawn, and displayed via `u8g2.sendBuffer()`. Host may transmit next frame.
  - `0x15` (`NAK`): Checksum mismatch or invalid header. Host retransmits.
- **Timeout / Watchdog**: If no packet received for 2000 ms, firmware reverts to looping PROGMEM animation.

### 3. C++ Code Export Contract (`src/frames.h`)
- Must define:
  ```cpp
  #pragma once
  #include <Arduino.h>
  #define FRAME_WIDTH 128
  #define FRAME_HEIGHT 64
  #define FRAME_BYTES_PER_ROW 16
  #define FRAME_SIZE_BYTES 1024
  #define FRAME_FPS <selected_fps>
  #define NUM_FRAMES <total_frames>

  const uint8_t reel_frames[NUM_FRAMES][FRAME_SIZE_BYTES] PROGMEM = {
      { /* 1024 hex bytes */ },
      ...
  };
  ```

## Code Layout
```
D:\espprojects\oled\
├── .agents/                        # Agent metadata (plans, handoffs, logs)
├── include/                        # C++ shared headers
├── lib/                            # PlatformIO libraries
├── platformio.ini                  # ESP32-S3 PlatformIO configuration
├── src/
│   ├── main.cpp                    # Dual-mode firmware (WebSerial streaming + PROGMEM loop)
│   └── frames.h                    # Exported / default PROGMEM animation frames
├── test/
│   └── e2e/                        # E2E test suites (Tiers 1–5)
└── web/                            # Vite + React web application
    ├── index.html
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── src/
    │   ├── main.tsx
    │   ├── App.tsx
    │   ├── types/                  # Frame, Video, Dither, and Procedural types
    │   ├── components/
    │   │   ├── DropZone.tsx        # Drag & drop media ingestion (video, GIF, PNGs)
    │   │   ├── CropTool.tsx        # 2:1 crop bounding box & fit presets
    │   │   ├── DitherControls.tsx  # Dither selector & Brightness/Contrast sliders
    │   │   ├── OledCanvas.tsx      # Simulated 128x64 OLED canvas player
    │   │   ├── TimelineControls.tsx# Play/pause, scrub, FPS selector
    │   │   ├── ProceduralStudio.tsx# Lyric bounce, glitch FX, starfield generator
    │   │   ├── CodeExporter.tsx    # C++ PROGMEM & RLE exporter modal
    │   │   └── WebSerialPanel.tsx  # WebSerial connection & live stream controller
    │   ├── engine/
    │   │   ├── mediaDecoder.ts     # Video, omggif, PNG sequence decoders
    │   │   ├── ditherEngine.ts     # Atkinson, Floyd-Steinberg, Bayer, Threshold
    │   │   ├── xbmpPacker.ts       # 1024-byte row-major LSB-first packer & unpacker
    │   │   ├── procedural/
    │   │   │   ├── lyricBounce.ts  # Typewriter & elastic bounce renderer
    │   │   │   ├── glitchFx.ts     # XOR bitwise noise & row tearing shifts
    │   │   │   └── starfield.ts    # 3D warp starfield & particle burst
    │   │   ├── serialStreamer.ts   # WebSerial protocol, ACK handling, flow control
    │   │   └── cppGenerator.ts     # PROGMEM & PackBits RLE C++ code generator
    │   └── styles/
    │       └── oled.css            # Authentic phosphor glow & pixel grid styles
```
