# Handoff Report: WebSerial Hardware Streaming, C++ Exporter & Procedural Engine Specification

**Agent**: Explorer Survey 3 (Specification Miner)  
**Role**: WebSerial Hardware & Procedural Engine Spec Miner  
**Target Milestone**: Discovery / Specification Mining for Requirements R2 & R3  
**Handoff Type**: Hard (Task Complete)  

---

## 1. Observation

1. **Existing Codebase & Hardware Target**:
   - `D:\espprojects\oled\platformio.ini` (lines 11–35):
     ```ini
     [env:esp32-s3-devkitc-1]
     platform = espressif32
     board = esp32-s3-devkitc-1
     framework = arduino
     monitor_speed = 115200
     upload_port = COM11
     lib_deps = olikraus/U8g2 @ ^2.35.19
     ```
     Comments on lines 31–32 show optional native USB CDC flags:
     `; -DARDUINO_USB_MODE=1`
     `; -DARDUINO_USB_CDC_ON_BOOT=1`
   - `D:\espprojects\oled\src\main.cpp` (lines 6–11, 21–25, 41–43):
     Hardware I2C pins are SDA=GPIO 8, SCL=GPIO 9.
     Driver is `U8G2_SH1106_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, U8X8_PIN_NONE);`.
     Bus clock is initialized to `400000` (400 kHz).
     Frame rendering executes:
     ```cpp
     u8g2.clearBuffer();
     u8g2.drawXBMP(0, 0, FRAME_WIDTH, FRAME_HEIGHT, reel_frames[currentFrame]);
     u8g2.sendBuffer();
     ```
2. **Current Frame Conversion & Bit-Ordering**:
   - `D:\espprojects\oled\convert_reel.py` (lines 21–31):
     ```python
     byte_idx = 0
     for y in range(height):
         for x in range(0, width, 8):
             byte_val = 0
             for b in range(8):
                 if x + b < width:
                     pixel = 1 if arr[y, x + b] > 0 else 0
                     byte_val |= (pixel << b)  # LSB first for XBMP
             img_bytes[byte_idx] = byte_val
             byte_idx += 1
     ```
     Bit ordering is LSB-first (`pixel << b`). Rows are ordered top-to-bottom ($y=0\dots63$). Bytes per row = 16. Total bytes per frame = 1024 bytes.
3. **Current C++ Header Format**:
   - `D:\espprojects\oled\src\frames.h` (lines 7–15):
     ```cpp
     #define NUM_FRAMES 466
     #define FRAME_WIDTH 128
     #define FRAME_HEIGHT 64
     #define FRAME_BYTES_PER_ROW 16
     #define FRAME_SIZE_BYTES 1024
     #define FRAME_FPS 30

     const uint8_t reel_frames[NUM_FRAMES][FRAME_SIZE_BYTES] PROGMEM = { ... };
     ```
4. **User Requirements in `ORIGINAL_REQUEST.md`**:
   - R2: 1-Click Hardware Flashing & Code Export (WebSerial USB streaming, `src/frames.h` PROGMEM XBMP or compressed RLE).
   - R3: Procedural Engine Primitives (Text Typewriter & Bounce Lyric reveal, Glitch Shader FX with XOR noise & row tearing, Starfield & Particle explosion generator).

---

## 2. Logic Chain

1. **Serial Bandwidth vs Refresh Rate**:
   - From Observation 1 & 2, each 128×64 frame requires 1024 bytes. Adding 7 framing bytes yields a 1031-byte packet.
   - At standard 115200 baud (Observation 1 `monitor_speed`), transmitting 1031 bytes takes $1031 \times 10 / 115200 = 89.5\text{ ms}$, limiting maximum throughput to 11.1 FPS.
   - At 921600 baud, 1031 bytes takes $1031 \times 10 / 921600 = 11.2\text{ ms}$, allowing up to 89 FPS serial throughput.
   - Therefore, WebSerial streaming at 30 FPS requires 921600 baud or native USB CDC.

2. **I2C Display Latency & Flow Control Requirement**:
   - In `src/main.cpp` (Observation 1), `u8g2.sendBuffer()` sends ~1070 bytes over I2C at 400 kHz, taking ~24.1 ms of CPU time.
   - During this 24.1 ms window, the ESP32 CPU is actively clocking I2C data. Without flow control, incoming serial data arriving at 921600 baud will overflow the ESP32 hardware UART buffer (128 bytes FIFO).
   - Step-by-step inference: A stop-and-wait ACK handshake protocol (where ESP32 replies with `0x06 [seq]` after `sendBuffer()`) guarantees zero buffer overrun and allows the browser to dynamically regulate frame dispatch rate.

3. **Bit-Ordering & Universal Exporter Format**:
   - In `convert_reel.py` (Observation 2), bits are packed LSB-first (`pixel << b`). In `main.cpp` (Observation 1), frames are drawn using `u8g2.drawXBMP()`.
   - In `ORIGINAL_REQUEST.md` (Observation 4), the user specifies `static const unsigned char epd_bitmap_allArray[][1024] PROGMEM`.
   - Step-by-step inference: By defining `reel_frames` matching `src/frames.h` and adding `#define epd_bitmap_allArray reel_frames`, both existing and third-party Arduino/PlatformIO sketches work without modification.

4. **RLE Compression Selection**:
   - High-entropy dithered frames do not compress well with simple run-length encoding. However, lyric/text animations, logos, and procedural silhouettes contain large uniform spans of `0x00` and `0xFF`.
   - PackBits byte-level RLE provides guaranteed bounds (never expands by more than 1 byte per 128 bytes) and decompresses with a ~15-line C++ routine requiring zero heap allocations on MCU.

5. **Procedural Primitives Formulation**:
   - For Typewriter & Bounce Lyrics: Damped harmonic spring bounce physics and character-by-character reveals render cleanly to 128×64 1-bit memory via standard line-wrapped canvas drawing.
   - For Glitch FX: Because 1-bit displays lack color, glitch effects must rely on structural distortions: byte-level XOR masks, horizontal row slicing ($\Delta x$), and inverted scanlines (`byte ^= 0xFF`).
   - For Starfield & Particles: 3D perspective projection ($x/z, y/z$) with streak lines simulates warp speed, and ballistic gravity/drag Euler integration simulates radial particle fireworks.

---

## 3. Caveats

1. **Browser Compatibility**: WebSerial is currently supported in Chromium-based browsers (Chrome, Edge, Opera). It is not supported on Firefox or Safari. The UI must detect support and display a friendly notice, while keeping the C++ Exporter accessible in all browsers.
2. **COM Port Access Contention**: If PlatformIO's Serial Monitor is open on `COM11` (or whichever port the ESP32 is attached to), the browser cannot open the port. The UI must catch `DOMException` and advise the user to close the serial monitor.
3. **Display Driver Variance**: The current project uses `U8G2_SH1106_128X64_NONAME_F_HW_I2C`. If a user connects an SSD1306 display, the firmware receiver logic remains identical because both use 128×64 geometry and U8g2's `drawXBMP` interface.

---

## 4. Conclusion

1. **WebSerial Architecture**: Fully specified OLED-Stream v1 protocol: `0xAA 0x55 [Cmd] [Seq] [Len_Lo] [Len_Hi] [Payload (1024B)] [Checksum]`. Backpressure managed via 2-byte ACK (`0x06 [seq]`). Full receiver firmware written for ESP32-S3.
2. **C++ Exporter**: Verified exact LSB-first row-major bit ordering matching `u8g2.drawXBMP`. Defined export formats for uncompressed PROGMEM XBMP and PackBits RLE with embedded C++ decompressor. Provided 1-click clipboard copy and `.h` download routines.
3. **Procedural Engine**: Formulated exact mathematical equations, physics models, and 1-bit rasterization algorithms for Typewriter/Bounce lyrics, Glitch FX, and 3D Starfield/Particles.
4. **All deliverables documented**: Complete analysis written to `D:\espprojects\oled\.agents\explorer_survey_3\analysis.md`.

---

## 5. Verification Method

1. **Verify Analysis Document**:
   Inspect `D:\espprojects\oled\.agents\explorer_survey_3\analysis.md` to confirm all sections, tables (Features Discovered, Edge Cases), and code snippets are present.
2. **Verify Bit Ordering Consistency**:
   Compare `convertCanvasToXBMP` in `analysis.md` (Section 5.1) with `convert_reel.py` (lines 28–29): both perform `byte_val |= (pixel << b)` where `b = 0..7` corresponds to `x+0..x+7`.
3. **Verify Firmware Compilation Compatibility**:
   Compare the firmware code in `analysis.md` (Section 4.5) with `src/main.cpp` and `platformio.ini`: pins (`SDA 8, SCL 9`), library (`U8g2lib.h`), and display constructor (`U8G2_SH1106_128X64_NONAME_F_HW_I2C`) match identically.
4. **Invalidation Conditions**:
   - Discovery of an incompatible USB VID/PID filter blocking device selection.
   - U8g2 library deprecation of `drawXBMP` (unlikely as it is a core feature).
