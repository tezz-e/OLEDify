# Handoff Report: Codebase & Hardware Environment Survey

**Agent**: `explorer_survey_1` (Codebase & Hardware Environment Explorer)  
**Recipient**: `parent` (`9cea43f2-151e-4fe1-9c10-7dfec5d36b10`)  
**Working Directory**: `D:\espprojects\oled\.agents\explorer_survey_1`  
**Status**: Hard Handoff (Task Complete)  

---

## 1. Observation

1. **Hardware & PlatformIO Configuration** (`platformio.ini:11-35`):
   - Target Board: `board = esp32-s3-devkitc-1`
   - Platform & Framework: `platform = espressif32`, `framework = arduino`
   - Ports: `upload_port = COM11`, `monitor_port = COM11`, `monitor_speed = 115200`
   - Memory Configuration:
     ```ini
     board_build.arduino.memory_type = qio_opi
     board_build.flash_mode = qio
     board_build.psram_type = opi
     board_upload.flash_size = 16MB
     board_upload.maximum_size = 16777216
     build_flags = 
         -DBOARD_HAS_PSRAM
     ```
   - Dependencies: `lib_deps = olikraus/U8g2 @ ^2.35.19` (resolved to U8g2 2.36.18)
   - Native USB CDC lines 31-32 are commented out:
     ```ini
     ; -DARDUINO_USB_MODE=1
     ; -DARDUINO_USB_CDC_ON_BOOT=1
     ```

2. **Existing Firmware Implementation** (`src/main.cpp:6-50`):
   - I2C GPIO Pin Definitions:
     ```cpp
     #define OLED_SDA 8
     #define OLED_SCL 9
     ```
   - Display Driver:
     ```cpp
     U8G2_SH1106_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, /* reset=*/ U8X8_PIN_NONE);
     ```
   - Bus initialization: `Wire.begin(OLED_SDA, OLED_SCL, 400000);` and `u8g2.setBusClock(400000);` (400 kHz Fast I2C).
   - Playback loop (`lines 30-50`): Timer check `if (now - lastFrameTime >= frameIntervalMs)` draws `u8g2.drawXBMP(0, 0, FRAME_WIDTH, FRAME_HEIGHT, reel_frames[currentFrame]);` and sends buffer `u8g2.sendBuffer()`.
   - Serial usage: Only `Serial.begin(115200);` and debug print statements in `setup()`. **Zero serial input functions (`Serial.available()`, `Serial.readBytes()`, etc.) exist.**

3. **Current PROGMEM Frames Storage** (`src/frames.h:7-15`):
   - Frame Dimensions: `FRAME_WIDTH 128`, `FRAME_HEIGHT 64`, `FRAME_BYTES_PER_ROW 16`, `FRAME_SIZE_BYTES 1024`, `FRAME_FPS 30`, `NUM_FRAMES 466`.
   - Storage definition: `const uint8_t reel_frames[NUM_FRAMES][FRAME_SIZE_BYTES] PROGMEM = { ... };`.
   - Total PROGMEM Flash allocation: $466 \times 1024 = 477,184 \text{ bytes}$ (~466 KB).

4. **Conversion Script Pipeline** (`convert_reel.py:7-148`):
   - Video file: `igexport-DckvRqKPsI_.mp4` (verified: 720×1280 resolution, 30.0 FPS, 466 frames, 15.53s duration).
   - Aspect ratio cropping (`lines 58-69`): Calculates center crop to 2:1 ratio ($720 \times 360$ at $x=0, y=460$).
   - Scaling (`line 88`): Resizes $720 \times 360 \to 128 \times 64$ using `cv2.INTER_AREA`.
   - Dithering (`lines 94-101`): Floyd-Steinberg dithering via PIL (`gray_img.convert('1', dither=Image.Dither.FLOYDSTEINBERG)`) or step thresholding.
   - XBMP packing (`lines 7-33`): 16 bytes per row, 64 rows (1024 bytes per frame). Iterates rows $y$, chunks of 8 pixels $x$. Bit order is **LSB first** (`pixel = 1 if arr[y, x + b] > 0 else 0; byte_val |= (pixel << b)`).
   - Preview output: Writes sample PNG previews (`src/previews/frame_000.png` ... `frame_300.png`).

5. **Build & Tooling Verification**:
   - Compiler command: `& "C:\Users\manee\.platformio\penv\Scripts\pio.exe" run` in `D:\espprojects\oled`.
   - Build result: Exit code 0, SUCCESS. RAM used: 20,636 bytes (6.3%), Flash used: 780,969 bytes (23.4%).
   - Tooling available: Python 3.13 (`C:\Users\manee\AppData\Local\Programs\Python\Python313\python.exe`), Node.js (`C:\Program Files\nodejs\node.exe`), NPM, Git.

---

## 2. Logic Chain

1. **Bandwidth Inadequacy of Current Serial Config**:
   - *Observation 1 & 2*: `platformio.ini` and `src/main.cpp` use `115200` baud.
   - *Observation 3*: Each frame is 1024 bytes.
   - *Calculation*: At 30 FPS, $30 \times 1024 = 30,720 \text{ bytes/s}$. Standard UART 8N1 requires 10 line bits per byte $\to 30,720 \times 10 = 307,200 \text{ baud}$ raw minimum. At 115200 baud, theoretical throughput is $\frac{115,200}{10} = 11,520 \text{ bytes/s} \approx 11.25 \text{ FPS}$ maximum with zero protocol overhead.
   - *Deduction*: Serial baud rate must be upgraded to **921600 baud** (supported natively by WebSerial in Chromium) or native USB CDC (12 Mbps) to achieve 15–30 FPS real-time streaming.

2. **Buffer Overflow Risk on Serial Input**:
   - *Observation 2*: Default Arduino ESP32 UART RX ring buffer is 256 bytes.
   - *Observation 3*: A single frame payload is 1024 bytes.
   - *Deduction*: Streaming frames will instantly cause buffer overrun and frame tearing unless `Serial.setRxBufferSize(2048)` (or `4096`) is called prior to `Serial.begin()`.

3. **I2C Bus Timing Headroom**:
   - *Observation 2*: `Wire.begin(8, 9, 400000)` and `u8g2.setBusClock(400000)` set 400 kHz bus clock.
   - *Calculation*: Transferring 1024 bytes + page addressing commands $\approx 1080$ bytes $\times 9$ bits $= 9720$ clock cycles $\implies \frac{9720}{400,000} \approx 24.3 \text{ ms}$ per display refresh.
   - *Deduction*: At 30 FPS ($33.3 \text{ ms}$ interval), 24.3 ms bus transfer leaves ~9 ms CPU headroom. Setting I2C clock to 800 kHz drops transfer time to ~12.2 ms, offering >21 ms CPU headroom.

4. **Hardware Driver Compatibility (SH1106 vs SSD1306)**:
   - *Observation 2*: Firmware currently instantiates `U8G2_SH1106_128X64_NONAME_F_HW_I2C`.
   - *Technical Difference*: SH1106 has a 132-column internal matrix with a 2-pixel column shift (display spans columns 2–129). SSD1306 has a 128-column matrix with zero offset. Running SSD1306 on an SH1106 display shifts the frame right by 2 pixels and leaves columns 0–1 with noise.
   - *Deduction*: To satisfy user requirement for both SH1106 and SSD1306, the firmware must support selectable drivers (compile-time defines or runtime protocol command).

5. **Data Format Synchronization between Web App & Firmware**:
   - *Observation 4*: `convert_reel.py` encodes frames as row-major LSB-first (`pixel << b`) bytes.
   - *Observation 2*: `src/main.cpp` renders this via `u8g2.drawXBMP(0, 0, 128, 64, data)`.
   - *Deduction*: The web application (Vite + React) must output both WebSerial stream packets and exported `src/frames.h` files matching this exact row-major LSB-first XBMP byte layout.

---

## 3. Caveats

1. **Hardware Verification on Physical OLED**:
   - Although the PlatformIO project compiles cleanly with 0 warnings/errors, a physical ESP32-S3 and OLED panel were not flashed directly during this survey turn (verification was performed via headless compiler build and code analysis).
2. **USB-to-UART Bridge Chip**:
   - `upload_port = COM11` is configured. On ESP32-S3 DevKitC-1 boards, COM11 may be either an on-board CP2102/CH340 USB-UART bridge or the native ESP32-S3 USB port. 921600 baud works universally on CP2102/CH340 and ignores baud rate on Native CDC.
3. **Atkinson & Bayer Dithering**:
   - `convert_reel.py` only implements Floyd-Steinberg and step thresholding. Atkinson and Bayer matrix algorithms must be implemented from scratch in the web engine.

---

## 4. Conclusion

1. The existing hardware setup is an **ESP32-S3-DevKitC-1 (N16R8)** driving a **128×64 monochrome OLED** over I2C on **SDA = GPIO 8, SCL = GPIO 9** using **U8g2 (SH1106 full-buffer driver)** at **400 kHz**.
2. `convert_reel.py` establishes the golden reference format: 128×64 1-bit monochrome bitmaps packed into 1024 bytes per frame using **row-major LSB-first XBMP encoding**.
3. The current firmware in `src/main.cpp` is strictly an offline loop player; it contains **no serial reception, no streaming buffer, and no protocol parser**.
4. To enable real-time WebSerial streaming (15–30 FPS) with PROGMEM fallback, the firmware must be updated with:
   - Baud rate increased to `921600` (or native USB CDC).
   - `Serial.setRxBufferSize(2048)`.
   - Binary packet protocol: `[0xAA, 0x55, CMD, LEN_H, LEN_L, PAYLOAD(1024), CHECKSUM]` with `0x06` ACK flow control.
   - State machine toggling between `MODE_STREAMING` and `MODE_PROGMEM` with a 2000 ms inactivity timeout watchdog.
   - Dual-controller configuration for SH1106 and SSD1306.

---

## 5. Verification Method

To independently verify all survey findings:

1. **Verify PlatformIO Build**:
   Run the following PowerShell command in `D:\espprojects\oled`:
   ```powershell
   & "C:\Users\manee\.platformio\penv\Scripts\pio.exe" run
   ```
   *Expected Output*: Exit code 0, RAM usage ~6.3% (20,636 B), Flash usage ~23.4% (780,969 B).

2. **Verify Sample Video Properties**:
   Run:
   ```powershell
   & "C:\Users\manee\AppData\Local\Programs\Python\Python313\python.exe" -c "import cv2; cap = cv2.VideoCapture(r'D:\espprojects\oled\igexport-DckvRqKPsI_.mp4'); print('Opened:', cap.isOpened(), 'Frames:', cap.get(cv2.CAP_PROP_FRAME_COUNT), 'FPS:', cap.get(cv2.CAP_PROP_FPS), 'Res:', cap.get(cv2.CAP_PROP_FRAME_WIDTH), 'x', cap.get(cv2.CAP_PROP_FRAME_HEIGHT))"
   ```
   *Expected Output*: `Opened: True Frames: 466.0 FPS: 30.0 Res: 720.0 x 1280.0`.

3. **Verify File Layout & Detailed Analysis**:
   Inspect the survey report artifact:
   - `D:\espprojects\oled\.agents\explorer_survey_1\analysis.md`
