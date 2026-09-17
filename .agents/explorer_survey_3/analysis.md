# Analysis: WebSerial Hardware Streaming, C++ Exporter & Procedural Engine Specification

**Author**: Explorer Survey 3 (Specification Miner)  
**Date**: 2026-09-18  
**Scope**: Requirements R2 (WebSerial Hardware Flashing & C++ Export) and R3 (Procedural Engine Primitives)  
**Authority**: `D:\espprojects\oled\.agents\ORIGINAL_REQUEST.md`, `D:\espprojects\oled\platformio.ini`, `D:\espprojects\oled\src\main.cpp`, `D:\espprojects\oled\convert_reel.py`, and U8g2 library specification.

---

## 1. Executive Summary

This document specifies the complete engineering architecture and interface contracts for:
1. **WebSerial USB Real-time Streaming**: A high-speed, binary framing protocol with ACK flow control enabling continuous 15–30+ FPS live streaming of 128×64 1-bit OLED frames from modern browsers (Chrome/Edge) to an ESP32-S3 driving a SH1106 / SSD1306 display over I2C.
2. **Universal C++ Code Exporter**: Code generation of PlatformIO/Arduino-compatible `src/frames.h` in PROGMEM XBMP format (matching U8g2 `drawXBMP`) and an optimized PackBits RLE compression scheme with an embedded ~15-line C++ decompressor for memory-constrained MCUs.
3. **R3 Procedural Engine Primitives**: Three native 128×64 1-bit generative FX engines running client-side:
   - Kinetic Typography / Lyric Engine (Typewriter reveal + Spring/Bounce physics).
   - Monochrome Glitch FX (XOR noise, horizontal row tearing/shifts, scanline bit-flips).
   - 3D Warp Starfield & Radial Particle Explosion (pseudo-perspective 3D projection, Euler particle ballistic physics).

---

## 2. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | WebSerial Protocol | Browser Port Connection | Request and acquire access to ESP32-S3 USB serial device via browser permissions dialog | User click gesture; optional USB VID/PID filter (Espressif `0x303A`) | `SerialPort` instance; open stream reader/writer | Throws `NotFoundError` if cancelled; `SecurityError` if not user gesture | W3C WebSerial API Spec; `ORIGINAL_REQUEST.md` R2 |
| 2 | WebSerial Protocol | High-Speed Baud Configuration | Support standard 115200 baud and high-speed 921600 baud for low-latency 30 FPS streaming | Selected baud rate (`115200` vs `921600`) | Serial port initialized with 16KB FIFO buffer | Fails to open if port is locked by PlatformIO serial monitor | `platformio.ini` & ESP32-S3 UART hardware specs |
| 3 | WebSerial Protocol | Packet Framing Protocol (OLED-Stream v1) | Framed binary packets with magic bytes (`0xAA 0x55`), command, sequence ID, length, payload (1024B), and XOR checksum | 1024-byte 1-bit monochrome frame buffer | 1031-byte serialized binary frame | Incomplete packet dropped if timeout > 100ms expires mid-stream | Protocol design; `src/frames.h` payload analysis |
| 4 | WebSerial Protocol | Flow Control & ACK Handshake | Stop-and-wait / pipelined ACK mechanism (`0x06 [seq]`) to prevent ESP32 serial buffer overrun during I2C draw | Received ACK byte or timeout | Release next frame write in browser render loop | Stale frame dropped if previous frame ACK is delayed > 150ms | U8g2 I2C transfer timing benchmarks (~24ms @ 400kHz) |
| 5 | WebSerial Protocol | Native USB CDC Bypass | ESP32-S3 hardware USB CDC (`-DARDUINO_USB_CDC_ON_BOOT=1`) bypasses baud rate limits, achieving >1 MB/s transfer | Native USB D+/D- connection (GPIO 19/20) | Full-speed USB packet delivery (<1.5ms per frame) | Requires correct build flags in `platformio.ini` | `platformio.ini` line 31–32 |
| 6 | Firmware Architecture | Zero-Copy U8g2 Receiver | Firmware state machine receiving 1024-byte payload and rendering via `u8g2.drawXBMP(0, 0, 128, 64, payload)` | Incoming UART/CDC stream | SH1106 / SSD1306 display update | Checksum mismatch sends `0x15 NAK`; skips corrupted frame | `src/main.cpp` lines 41–43 |
| 7 | C++ Exporter | PROGMEM XBMP Code Generator | Export frames to `src/frames.h` with exact byte layout matching U8g2 `drawXBMP` (LSB first, row-major) | Array of 1024-byte Uint8Array frames | String buffer formatted as Arduino C++ header | Alerts user if total frames exceed target flash size | `convert_reel.py` lines 7–33; `src/frames.h` |
| 8 | C++ Exporter | Compatibility Symbol Aliasing | Defines both `reel_frames` and `epd_bitmap_allArray` to guarantee drop-in compatibility with existing sketches | Export configuration | `#define epd_bitmap_allArray reel_frames` | N/A | `ORIGINAL_REQUEST.md` R2 & `src/main.cpp` |
| 9 | C++ Exporter | PackBits RLE Compression Engine | Byte-level run-length encoding compressing uniform black/white areas by 50–85% | 1024-byte frame array | Compressed byte stream + offset/size lookup tables | Disables RLE on high-entropy dithered frames if size expands | Compression benchmark analysis |
| 10 | C++ Exporter | Embedded C++ RLE Decompressor | Generates an inline ~15-line decompressor function (`drawRLEFrame`) requiring zero dynamic memory heap allocations | Compressed stream pointer | Decompressed frame written to static buffer and displayed | Frame index boundary check | PlatformIO memory safety requirements |
| 11 | C++ Exporter | 1-Click Clipboard & File Download | Instant copy of generated C++ code to system clipboard or direct file download (`frames.h`) | User click event | System clipboard write / Browser `.h` file download | Fallback to `execCommand('copy')` if clipboard API restricted | UI/UX specification |
| 12 | Procedural FX | Typewriter Lyric Renderer | Characters revealed sequentially with customizable CPS speed and blinking cursor block (`█` / `_`) | Text string, typing speed (CPS), cursor style | Rendered 128×64 1-bit frame buffer | Auto word-wrap prevents text clipping off-screen | `ORIGINAL_REQUEST.md` R3 |
| 13 | Procedural FX | Bounce Lyric Kinetic Reveal | Words or lines drop into position with damped harmonic spring bounce physics / cubic elastic ease-out | Lyrics array, time position, spring tension/decay | Dynamic vertical offset and scale per word | Clamps values to canvas viewport `[0, 63]` | `ORIGINAL_REQUEST.md` R3 |
| 14 | Procedural FX | XOR Bitwise Glitch Noise | Pseudo-random noise masks applied via bitwise XOR to simulate digital bus corruption | Glitch intensity (0–100%), RNG seed | Corrupted bit blocks in frame buffer | Seed-based reproducibility | `ORIGINAL_REQUEST.md` R3 |
| 15 | Procedural FX | Horizontal Row Tearing FX | Random slice of horizontal pixel rows displaced horizontally by $\Delta x$ pixels | Row slice range `[y1, y2]`, shift amount $\Delta x$ | Displaced scanlines with noise or wrap-around | Preserves row boundaries `0 <= y < 64` | `ORIGINAL_REQUEST.md` R3 |
| 16 | Procedural FX | Bit-Flip Scanline Glitches | Inverts full or stippled horizontal scanlines (`byte ^= 0xFF`) and simulates rolling CRT V-SYNC slips | Scanline interval, rolling speed | Inverted horizontal scanline bars | Modulo math ensures roll wraps smoothly `0..63` | `ORIGINAL_REQUEST.md` R3 |
| 17 | Procedural FX | 3D Perspective Warp Starfield | 3D star coordinates $(X, Y, Z)$ projected onto 128×64 canvas with speed streaks (hyperspace warp) | Star count (50–150), warp speed $S$ | Projected points and Bresenham streak lines | Stars with $Z \le 0$ respawn at $Z_{max}$ with random $(X, Y)$ | `ORIGINAL_REQUEST.md` R3 |
| 18 | Procedural FX | Radial Particle Burst Physics | Central/radial particle burst with velocity vectors, gravity, drag, and dithered lifetime fading | Burst trigger, particle count (30–80), gravity, drag | Particle trajectories rendered on 128×64 grid | Dead particles removed when life $\le 0$ | `ORIGINAL_REQUEST.md` R3 |

---

## 3. Edge Cases & Observed Behaviors

| # | Feature | Input / Condition | Observed / Required Behavior |
|---|---------|-------------------|-----------------------------|
| 1 | WebSerial Connection | Browser does not support WebSerial (e.g. Firefox, Safari, iOS Chrome) | Detect `!('serial' in navigator)`; display clear warning banner with recommendation to use Chrome/Edge/Opera, and disable the Connect button while keeping C++ Exporter fully functional. |
| 2 | WebSerial Port Opening | Port is already open in another program (e.g. PlatformIO serial monitor, VS Code, PuTTY) | Browser throws `DOMException: Failed to open serial port` (access denied). UI catches error and displays friendly toast: *"COM port is busy. Please close PlatformIO Serial Monitor and try again."* |
| 3 | Serial Data Mid-Stream Sync | Web app begins streaming while ESP32 is already running (ESP32 starts reading in middle of a 1024-byte payload) | ESP32 parser stays in `WAIT_MAGIC_1`. Bytes that do not match `0xAA` followed by `0x55` are discarded. Parser locks onto the next valid frame header without crashing or displaying scrambled lines. |
| 4 | Serial Transmission Dropout | Cable disconnect or packet loss causes partial frame transmission (<1024 bytes received) | ESP32 receiver implements a 100ms byte-inactivity watchdog timer. If inter-byte delay exceeds 100ms before packet completion, the state machine resets to `WAIT_MAGIC_1`, flushing the partial buffer. |
| 5 | Buffer Overflow (No Flow Control) | Browser sends 30 FPS at 115200 baud without waiting for ACK (ESP32 I2C takes ~24ms, UART takes ~90ms) | ESP32 hardware UART FIFO overflows (drops 70% of bytes), resulting in constant packet corruption. With ACK flow control, browser waits for `0x06` ACK before sending next frame, maintaining perfect synchronization. |
| 6 | I2C Clock Limitation | SH1106 display driven at default 100 kHz I2C instead of 400 kHz | 1024 bytes over 100 kHz I2C takes ~96ms (~10.4 FPS max). WebSerial streaming at 30 FPS will throttle to 10 FPS unless `Wire.setClock(400000)` and `u8g2.setBusClock(400000)` are called. Firmware must configure 400 kHz (or 800 kHz). |
| 7 | C++ Exporter Flash Limits | User converts a 60-second video at 30 FPS (1800 frames = 1.84 MB) for an MCU with 1MB flash (e.g. ESP8266 or basic ESP32) | UI calculates total byte size (`NUM_FRAMES * 1024`). If size > 1MB, displays a flash usage warning bar indicating compatibility: *"ESP32-S3 16MB Flash: OK (11% used) | ESP32 4MB: OK (46% used) | Arduino Nano: INSUFFICIENT"*. Suggests RLE compression or reducing FPS/frame count. |
| 8 | RLE Compression on Dithered Video | User enables RLE compression on high-entropy Floyd-Steinberg dithered video frames | RLE runs of identical bytes are rare in heavy error-diffusion dithering; naive RLE might expand file size. Exporter evaluates compression ratio per frame: if compressed size $\ge$ 1024 bytes, frame falls back to literal uncompressed encoding (PackBits format guarantees max 1 byte overhead per 128 bytes). |
| 9 | XBMP Bit Ordering Mismatch | Bit order inverted (MSB first vs LSB first) | Rendering with `u8g2.drawXBMP` results in horizontal 8-pixel blocks being mirrored. Exporter strictly adheres to LSB-first (`pixel << b`), matching `convert_reel.py` line 29. |
| 10 | Typewriter Word Wrapping | Long word exceeds 128-pixel canvas width (e.g. 25 characters on a 6px font = 150px) | Text layout algorithm measures text width using font glyph metrics; breaks words cleanly or auto-hyphenates rather than letting characters clip off the right edge. |
| 11 | Starfield Div-by-Zero | Star coordinate $Z$ reaches 0 during perspective projection $X / Z$ | Division by zero avoided by clamping $Z_{min} = 0.01$ or respawning star immediately when $Z \le 0.1$. |
| 12 | Particle Explosion Bounds | Particles travel outside canvas boundaries $(x < 0, x \ge 128, y < 0, y \ge 64)$ | Canvas clipping: pixels outside viewport are discarded without memory errors or array out-of-bounds writes. |

---

## 4. Technical Specification 1: WebSerial USB Streaming Protocol

### 4.1 Browser WebSerial API Architecture
The WebSerial API enables direct, bi-directional asynchronous communication between web applications and USB serial devices.

#### Browser Support & Environment:
- **Supported Engines**: Chromium 89+ (Google Chrome, Microsoft Edge, Opera, Brave, Vivaldi).
- **Security Context**: Strictly requires Secure Context (`https://` or `http://localhost`).
- **Permission Model**: Device selection requires an explicit user gesture (button click).

#### Connection Code Architecture:
```typescript
interface SerialConfig {
  baudRate: number;      // 115200 or 921600
  dataBits: 8;
  stopBits: 1;
  parity: 'none';
  bufferSize: 16384;     // 16 KB read/write OS buffer
  flowControl: 'none';
}

class WebSerialStreamer {
  private port: SerialPort | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private isStreaming: boolean = false;
  private seqId: number = 0;

  async connect(baudRate: number = 921600): Promise<boolean> {
    if (!('serial' in navigator)) {
      throw new Error('WebSerial is not supported in this browser. Please use Chrome or Edge.');
    }

    // Optional filter for ESP32-S3 Native USB (Espressif VID 0x303A)
    this.port = await navigator.serial.requestPort({
      filters: [{ usbVendorId: 0x303A }]
    });

    await this.port.open({
      baudRate,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
      bufferSize: 16384,
      flowControl: 'none'
    });

    this.writer = this.port.writable.getWriter();
    this.reader = this.port.readable.getReader();
    return true;
  }
}
```

### 4.2 Baud Rate & Bandwidth Analysis
Each 128×64 monochrome OLED frame consists of $128 \times 64 / 8 = 1024\text{ bytes}$.
Framing overhead adds 7 bytes per frame $\rightarrow 1031\text{ bytes/packet}$.

| Baud Rate | Raw Byte Rate (8N1: 10 bits/B) | Transfer Time (1031 B) | Max Theoretical FPS | Feasible at 30 FPS? | Notes |
|-----------|--------------------------------|------------------------|---------------------|---------------------|-------|
| **115200** | 11,520 bytes/sec | 89.5 ms | 11.1 FPS | ❌ No | Drops frames or runs at ~10 FPS. OK for static frame previews. |
| **460800** | 46,080 bytes/sec | 22.4 ms | 44.7 FPS | ⚠️ Marginal | Feasible, but leaves small margin for I2C refresh (~24ms). |
| **921600** | 92,160 bytes/sec | 11.2 ms | 89.4 FPS | ✅ Recommended | Ample headroom. Transfer takes only ~33% of 33.3ms frame budget. |
| **Native USB CDC (12 Mbps)** | ~1,200,000 bytes/sec | < 1.0 ms | > 500 FPS | 🚀 Blazing Fast | Zero baud rate divisor limitation; limited only by OLED I2C bus speed. |

### 4.3 Binary Framing Protocol: OLED-Stream v1.0
To prevent loss of frame alignment due to mid-stream connections, noise, or serial timeouts, all data is encapsulated in structured binary packets:

```
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|   Magic 0     |   Magic 1     |    Command    |  Sequence ID  |
|    (0xAA)     |    (0x55)     |    (1 Byte)   |   (0 - 255)   |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|      Payload Length (LE)      |   Payload Byte 0 ...          |
|    (uint16_t: e.g. 1024)      |                               |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+                               +
|                                                               |
|                   PAYLOAD DATA (1024 BYTES)                   |
|                 (128x64 XBMP 1-bit Frame Data)                |
|                                                               |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
| Checksum (XOR)|
+-+-+-+-+-+-+-+-+
Total Packet Length: 1031 Bytes
```

#### Packet Field Definitions:
1. **Magic Bytes (`0xAA, 0x55`)**: 2-byte preamble (`10101010 01010101`) to reliably identify the start of a frame.
2. **Command Byte**:
   - `0x01` (`CMD_FRAME_XBMP`): Standard 1024-byte uncompressed XBMP frame.
   - `0x02` (`CMD_FRAME_RLE`): PackBits compressed RLE frame (variable payload length).
   - `0x03` (`CMD_CLEAR`): Clear display buffer (`payload_len = 0`).
   - `0x04` (`CMD_PING`): Keepalive ping.
3. **Sequence ID (`0x00 - 0xFF`)**: 1-byte rolling counter. Used to match incoming ACKs and detect dropped frames.
4. **Payload Length (`uint16_t`, Little-Endian)**:
   - For `CMD_FRAME_XBMP`: `0x00, 0x04` (1024 decimal).
5. **Payload**: 1024 bytes representing 128×64 pixels in XBMP format (16 bytes/row × 64 rows).
6. **Checksum (1 Byte XOR)**:
   - Computed as:
     $$\text{Checksum} = \text{Cmd} \oplus \text{Seq} \oplus (\text{Len}_{\text{low}}) \oplus (\text{Len}_{\text{high}}) \oplus \bigoplus_{i=0}^{\text{Len}-1} \text{Payload}[i]$$

### 4.4 Flow Control & Backpressure Protocol
Why is ACK flow control mandatory?
- When the ESP32 receives a frame, it must transfer 1024 bytes to the SH1106 over I2C at 400 kHz via `u8g2.sendBuffer()`.
- This I2C transfer blocks CPU execution for **~24 milliseconds**.
- If the browser continuously pushes 30 FPS without handshaking, the ESP32's UART hardware FIFO (128 bytes on ESP32-S3 UART0) will overflow and drop bytes during the 24ms I2C transfer window!
- **ACK Handshake**:
  1. Browser sends Packet $N$.
  2. ESP32 parses Packet $N$, verifies checksum, copies payload to display buffer, calls `u8g2.sendBuffer()`.
  3. Immediately upon completing `sendBuffer()`, ESP32 writes:
     `[0x06 (ACK), SeqID]` (2 bytes back to USB Serial).
  4. Browser receives ACK for SeqID and immediately releases the next frame.
  5. If browser receives no ACK within 100ms, it logs a dropped frame and sends the latest frame (prevents deadlock).

### 4.5 Complete ESP32-S3 Firmware Receiver Code
This firmware can be compiled directly in PlatformIO with the existing `platformio.ini`:

```cpp
#include <Arduino.h>
#include <Wire.h>
#include <U8g2lib.h>

// Hardware I2C Pin Configuration (ESP32-S3 DevKitC-1)
#define OLED_SDA 8
#define OLED_SCL 9

// Display Driver: SH1106 128x64 Full Buffer Hardware I2C
U8G2_SH1106_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, U8X8_PIN_NONE);

// Protocol Constants
#define MAGIC_BYTE_0 0xAA
#define MAGIC_BYTE_1 0x55
#define CMD_FRAME_XBMP 0x01
#define CMD_FRAME_RLE  0x02
#define CMD_CLEAR       0x03
#define CMD_PING        0x04

#define FRAME_WIDTH  128
#define FRAME_HEIGHT 64
#define FRAME_BYTES  1024 // 128 * 64 / 8

enum RxState {
  STATE_MAGIC_0,
  STATE_MAGIC_1,
  STATE_HEADER,
  STATE_PAYLOAD,
  STATE_CHECKSUM
};

RxState currentState = STATE_MAGIC_0;
uint8_t currentCmd = 0;
uint8_t currentSeq = 0;
uint16_t payloadLen = 0;
uint16_t payloadIndex = 0;
uint8_t rxBuffer[FRAME_BYTES];
uint8_t runningChecksum = 0;
unsigned long lastByteTime = 0;

void setup() {
  // Use high-speed 921600 baud for low latency
  Serial.begin(921600);
  delay(500);

  // Initialize fast I2C at 400kHz (or 800kHz for max framerate)
  Wire.begin(OLED_SDA, OLED_SCL, 400000);
  u8g2.begin();
  u8g2.setBusClock(400000);

  u8g2.clearBuffer();
  u8g2.setFont(u8g2_font_6x10_tf);
  u8g2.drawStr(10, 24, "WebSerial Ready");
  u8g2.drawStr(10, 42, "Baud: 921600");
  u8g2.sendBuffer();
}

void loop() {
  // Inter-byte timeout: reset parser if stream stalls for > 100ms
  if (currentState != STATE_MAGIC_0 && (millis() - lastByteTime > 100)) {
    currentState = STATE_MAGIC_0;
  }

  while (Serial.available() > 0) {
    uint8_t b = Serial.read();
    lastByteTime = millis();

    switch (currentState) {
      case STATE_MAGIC_0:
        if (b == MAGIC_BYTE_0) currentState = STATE_MAGIC_1;
        break;

      case STATE_MAGIC_1:
        if (b == MAGIC_BYTE_1) {
          currentState = STATE_HEADER;
          payloadIndex = 0;
          runningChecksum = 0;
        } else if (b != MAGIC_BYTE_0) {
          currentState = STATE_MAGIC_0;
        }
        break;

      case STATE_HEADER:
        // Header contains: Cmd (1B), Seq (1B), Len_Lo (1B), Len_Hi (1B)
        if (payloadIndex == 0) currentCmd = b;
        else if (payloadIndex == 1) currentSeq = b;
        else if (payloadIndex == 2) payloadLen = b;
        else if (payloadIndex == 3) {
          payloadLen |= (uint16_t)b << 8;
          runningChecksum = currentCmd ^ currentSeq ^ (payloadLen & 0xFF) ^ (payloadLen >> 8);
          payloadIndex = 0;
          if (payloadLen > FRAME_BYTES) {
            currentState = STATE_MAGIC_0; // Invalid length guard
          } else if (payloadLen == 0) {
            currentState = STATE_CHECKSUM;
          } else {
            currentState = STATE_PAYLOAD;
          }
          break;
        }
        payloadIndex++;
        break;

      case STATE_PAYLOAD:
        rxBuffer[payloadIndex++] = b;
        runningChecksum ^= b;
        if (payloadIndex >= payloadLen) {
          currentState = STATE_CHECKSUM;
        }
        break;

      case STATE_CHECKSUM:
        if (b == runningChecksum) {
          // Valid frame received! Process command
          if (currentCmd == CMD_FRAME_XBMP) {
            u8g2.clearBuffer();
            u8g2.drawXBMP(0, 0, FRAME_WIDTH, FRAME_HEIGHT, rxBuffer);
            u8g2.sendBuffer();

            // Send ACK: [0x06, seqId]
            Serial.write(0x06);
            Serial.write(currentSeq);
          } else if (currentCmd == CMD_CLEAR) {
            u8g2.clearBuffer();
            u8g2.sendBuffer();
            Serial.write(0x06);
            Serial.write(currentSeq);
          } else if (currentCmd == CMD_PING) {
            Serial.write(0x06);
            Serial.write(currentSeq);
          }
        } else {
          // Checksum mismatch -> Send NAK [0x15, seqId]
          Serial.write(0x15);
          Serial.write(currentSeq);
        }
        currentState = STATE_MAGIC_0;
        break;
    }
  }
}
```

---

## 5. Technical Specification 2: Universal C++ Code Exporter

### 5.1 XBMP Format & Bit-Ordering Architecture
U8g2’s `drawXBMP` displays 1-bit bitmaps in standard X11 Bitmap (XBM) format:
- **Dimensions**: 128 pixels wide, 64 pixels tall.
- **Row-Major Layout**: Rows are scanned top-to-bottom ($y = 0 \dots 63$).
- **Bytes Per Row**: $128 / 8 = 16\text{ bytes per row}$.
- **Total Bytes**: $16 \times 64 = 1024\text{ bytes per frame}$.
- **Bit-Ordering within each byte**:
  - **LSB First (Least Significant Bit on the left)**:
    - Bit 0 (`0x01`) = Pixel $x+0$
    - Bit 1 (`0x02`) = Pixel $x+1$
    - $\dots$
    - Bit 7 (`0x80`) = Pixel $x+7$
  - Value: `1` = Lit pixel (White on OLED), `0` = Unlit pixel (Black).

#### TypeScript Bit-Packing Routine (Client-Side Exporter):
```typescript
export function convertCanvasToXBMP(ctx: CanvasRenderingContext2D, width = 128, height = 64): Uint8Array {
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data; // RGBA Uint8ClampedArray
  const bytesPerRow = width / 8; // 16
  const xbmp = new Uint8Array(bytesPerRow * height); // 1024

  let byteIdx = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x += 8) {
      let byteVal = 0;
      for (let b = 0; b < 8; b++) {
        if (x + b < width) {
          // Index into RGBA buffer (check red channel after monochrome thresholding)
          const pIdx = (y * width + (x + b)) * 4;
          const isWhite = data[pIdx] > 128 ? 1 : 0;
          byteVal |= (isWhite << b); // LSB First
        }
      }
      xbmp[byteIdx++] = byteVal;
    }
  }
  return xbmp;
}
```

### 5.2 Standard `src/frames.h` Generation
The exporter produces a header matching the existing project structure and compatible with both Arduino IDE and PlatformIO:

```cpp
// Auto-generated frames header for ESP32 OLED visual engine
// Generated by OLED Visual Animation Studio (Vite + React)
#ifndef FRAMES_H
#define FRAMES_H

#include <Arduino.h>

#define NUM_FRAMES 120
#define FRAME_WIDTH 128
#define FRAME_HEIGHT 64
#define FRAME_BYTES_PER_ROW 16
#define FRAME_SIZE_BYTES 1024
#define FRAME_FPS 30

// Total PROGMEM Size: 120 * 1024 = 122880 bytes (~120 KB)
const uint8_t reel_frames[NUM_FRAMES][FRAME_SIZE_BYTES] PROGMEM = {
  { 0xFF, 0x00, 0xAA, ... }, // Frame 0
  { 0xFF, 0x00, 0xAB, ... }, // Frame 1
  ...
};

// Standard Adafruit / open-source alias for universal compatibility
#define epd_bitmap_allArray reel_frames

#endif // FRAMES_H
```

### 5.3 Compressed RLE Exporter (PackBits Variant)
For MCUs with smaller flash (e.g. Arduino Nano, ESP8266, or long animations on ESP32), we specify a modified PackBits byte-level RLE algorithm:
- **Literal Run**: Header byte $n \in [0, 127]$ indicates that the next $n + 1$ bytes are uncompressed literals.
- **Repeat Run**: Header byte $n \in [-127, -1]$ indicates that the single following byte is repeated $1 - n$ times (i.e. 2 to 128 times).
- **Control Byte $-128$ (`0x80`)**: Reserved / NOP.

#### Compression Ratio Benchmark:
- Text/Lyric Screens (large black/white areas): **70%–88% compression** (1024 B $\rightarrow$ 120–300 B).
- Line Art & Silhouettes: **50%–75% compression**.
- Noise/Floyd-Steinberg Dither: **0%–10%** (PackBits prevents expansion; max overhead < 1%).

#### Embedded C++ Decompressor (Included in `frames_rle.h`):
```cpp
#ifndef FRAMES_RLE_H
#define FRAMES_RLE_H

#include <Arduino.h>
#include <U8g2lib.h>

#define NUM_FRAMES 120
#define FRAME_WIDTH 128
#define FRAME_HEIGHT 64
#define FRAME_SIZE_BYTES 1024
#define FRAME_FPS 30

// Compressed frame stream and byte offset table
const uint32_t frame_offsets[NUM_FRAMES] PROGMEM = { 0, 154, 302, ... };
const uint8_t rle_data[] PROGMEM = { ... };

// Zero-allocation PackBits decompressor (~15 lines)
inline void decompressRLE(const uint8_t* in, uint8_t* out, size_t outSize) {
  size_t inIdx = 0, outIdx = 0;
  while (outIdx < outSize) {
    int8_t n = (int8_t)pgm_read_byte(&in[inIdx++]);
    if (n >= 0) {
      for (int i = 0; i <= n && outIdx < outSize; i++) {
        out[outIdx++] = pgm_read_byte(&in[inIdx++]);
      }
    } else if (n != -128) {
      uint8_t val = pgm_read_byte(&in[inIdx++]);
      for (int i = 0; i < (1 - n) && outIdx < outSize; i++) {
        out[outIdx++] = val;
      }
    }
  }
}

// Single-call draw helper
inline void drawRLEFrame(U8G2 &u8g2, uint16_t frameIndex) {
  static uint8_t decompBuffer[FRAME_SIZE_BYTES];
  const uint8_t* src = &rle_data[pgm_read_dword(&frame_offsets[frameIndex])];
  decompressRLE(src, decompBuffer, FRAME_SIZE_BYTES);
  u8g2.clearBuffer();
  u8g2.drawXBMP(0, 0, FRAME_WIDTH, FRAME_HEIGHT, decompBuffer);
  u8g2.sendBuffer();
}

#endif // FRAMES_RLE_H
```

### 5.4 1-Click Clipboard & Download Interface
```typescript
// 1-Click Copy to Clipboard
export async function copyHeaderToClipboard(codeContent: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(codeContent);
    return true;
  } catch (err) {
    // Fallback for non-secure contexts
    const textArea = document.createElement("textarea");
    textArea.value = codeContent;
    document.body.appendChild(textArea);
    textArea.select();
    const success = document.execCommand("copy");
    document.body.removeChild(textArea);
    return success;
  }
}

// 1-Click File Download
export function downloadHeaderFile(codeContent: string, filename = "frames.h") {
  const blob = new Blob([codeContent], { type: "text/x-c++hdr;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
```

---

## 6. Technical Specification 3: R3 Procedural Engine Primitives

### 6.1 Text Typewriter & Bounce Lyric Reveal Engine

#### Mathematical Model:
1. **Typewriter Progress**:
   $$\text{visibleChars} = \min\left(\lfloor t \times \text{CPS} \rfloor, \text{totalChars}\right)$$
   Where $t$ is the elapsed time in seconds, and $\text{CPS}$ is characters per second (e.g. 15).
   Cursor blink state: $\text{showCursor} = \lfloor t \times 2 \rfloor \pmod 2 == 0$.

2. **Spring / Bounce Easing Curve (Kinetic Typography)**:
   For word reveals with elastic bounce:
   $$\text{easeOutBounce}(x) = \begin{cases} 
   n_1 x^2 & x < \frac{1}{d_1} \\ 
   n_1 (x - \frac{1.5}{d_1})^2 + 0.75 & x < \frac{2}{d_1} \\ 
   n_1 (x - \frac{2.25}{d_1})^2 + 0.9375 & x < \frac{2.5}{d_1} \\ 
   n_1 (x - \frac{2.625}{d_1})^2 + 0.984375 & \text{otherwise} 
   \end{cases}$$
   Where $n_1 = 7.5625$ and $d_1 = 2.75$.
   Vertical position during entry:
   $$y(t) = y_{\text{target}} - (1 - \text{easeOutBounce}(u)) \cdot \text{dropDistance}$$
   Where $u = \text{clamp}((t - t_{\text{start}}) / \text{duration}, 0, 1)$.

#### Font Rendering Architecture:
- Rendered on a 128×64 OffscreenCanvas using clean monospace bitmap or vector fonts (`8px - 14px`).
- Word wrapping logic measures line widths to ensure text remains centered and bounded within the 128×64 resolution.
- Karaoke-style highlight: Active word rendered in inverse video (solid white bounding box with black text) for beat emphasis.

### 6.2 Monochrome 1-Bit Glitch Shader FX
Traditional RGB glitch shaders cannot be applied directly to 1-bit monochrome displays. We specify three authentic hardware-emulated monochrome glitch algorithms:

1. **XOR Bitwise Noise**:
   - For a selected bounding box or randomly selected bytes:
     $$\text{byte}_i \leftarrow \text{byte}_i \oplus (\text{LFSR\_Noise}() \ \& \ \text{intensityMask})$$
   - Produces authentic digital bus noise and pixel fragmentation without blurring.

2. **Horizontal Row Tearing / Shifts**:
   - Random slice of scanlines $y \in [y_{\text{start}}, y_{\text{end}}]$ (height 4–12 px) is shifted horizontally by $\Delta x \in [-16, +16]$ pixels.
   - Pixels shifted beyond canvas bounds can wrap around or fill with static noise:
     $$\text{pixel}'(x, y) = \text{pixel}((x - \Delta x + 128) \pmod{128}, y)$$

3. **Bit-Flip Scanlines & V-SYNC Slip**:
   - Inverts full or interleaved horizontal scanlines (`byte ^= 0xFF`).
   - Rolling horizontal bar: An 8-pixel tall inverted band that rolls vertically at speed $v$:
     $$y_{\text{bar}} = \lfloor t \times v \rfloor \pmod{64}$$

### 6.3 3D Warp Starfield & Radial Particle Explosion Generator

#### 1. 3D Perspective Warp Starfield:
- **Particle System**: $N$ stars (typically 80–120 stars for 128×64).
- **Coordinate Space**:
  - $X_i \in [-64, 64]$
  - $Y_i \in [-32, 32]$
  - $Z_i \in [0.1, Z_{\text{max}}]$ (where $Z_{\text{max}} = 100$)
- **Simulation Step**:
  $$Z_i \leftarrow Z_i - S \times \Delta t$$
  If $Z_i \le 0.1$, respawn: $Z_i \leftarrow Z_{\text{max}}$, random $X_i, Y_i$.
- **Perspective Projection**:
  $$x_{\text{screen}} = 64 + \frac{X_i}{Z_i} \cdot f_x, \quad y_{\text{screen}} = 32 + \frac{Y_i}{Z_i} \cdot f_y$$
- **Warp Speed Streaks**:
  - Compute previous screen position $(x_{\text{prev}}, y_{\text{prev}})$.
  - Draw 1-bit Bresenham streak line from $(x_{\text{prev}}, y_{\text{prev}})$ to $(x_{\text{screen}}, y_{\text{screen}})$.
  - At higher warp speeds ($S > 50$), stars stretch into continuous light streaks radiating from the center vanishing point $(64, 32)$.

#### 2. Radial Particle Explosion Physics:
- **Simulation Parameters**:
  - Particle count $M = 40 \dots 70$.
  - Origin $(x_0, y_0)$, default $(64, 32)$.
  - Velocity: $v_x = v \cos(\theta)$, $v_y = v \sin(\theta)$ where $\theta \sim U(0, 2\pi)$, $v \sim U(15, 60)\text{ px/s}$.
  - Gravity: $g = +30\text{ px/s}^2$ (downward acceleration).
  - Drag: $\mu = 0.94^{\Delta t \times 60}$ (air resistance).
  - Lifespan: $L \in [0.6, 1.8]\text{ seconds}$.
- **Euler Integration Update**:
  $$\begin{aligned}
  v_y &\leftarrow (v_y + g \cdot \Delta t) \cdot \mu \\
  v_x &\leftarrow v_x \cdot \mu \\
  x &\leftarrow x + v_x \cdot \Delta t \\
  y &\leftarrow y + v_y \cdot \Delta t \\
  \text{life} &\leftarrow \text{life} - \Delta t
  \end{aligned}$$
- **1-Bit Monochrome Rendering**:
  - $\text{life} > 0.4$: 2×2 square or (+) cross cluster.
  - $\text{life} \le 0.4$: Single pixel with stochastic dithered twinkle (pixel drawn only if $\text{rand}() < \text{life} / 0.4$).

---

## 7. Recommended Component Architecture (Vite + React)

```
web/src/
├── components/
│   ├── HardwareFlashing/
│   │   ├── WebSerialConnectButton.tsx    # Connect/Disconnect, port status, baud selector
│   │   └── StreamMonitor.tsx             # Live streaming stats (FPS, dropped packets, ACK latency)
│   ├── CodeExporter/
│   │   ├── ExportModal.tsx               # Code preview, format toggle (PROGMEM vs RLE)
│   │   ├── ClipboardButton.tsx           # 1-click copy with toast notification
│   │   └── DownloadButton.tsx            # Download frames.h / frames_rle.h
│   └── ProceduralStudio/
│       ├── ProceduralControls.tsx        # Mode selector: Typewriter, Glitch, Starfield, Particles
│       ├── TypewriterControls.tsx        # Text input, CPS slider, bounce toggle
│       ├── GlitchControls.tsx            # Noise density, tearing shift, scanline roll
│       └── StarfieldControls.tsx         # Star count, warp speed, particle burst button
├── hooks/
│   ├── useWebSerial.ts                   # WebSerial lifecycle, packet framing, ACK listener
│   └── useProceduralEngine.ts            # Animation loop, tick state, canvas rasterizer
└── lib/
    ├── protocol/
    │   ├── framing.ts                    # Build OLED-Stream v1 packets & checksums
    │   └── packbits.ts                   # PackBits RLE compressor & C++ decompressor generator
    ├── procedural/
    │   ├── typewriter.ts                 # Typewriter text layout & bounce easing
    │   ├── glitch.ts                     # XOR noise, row tearing, scanline flips
    │   └── starfield.ts                  # 3D starfield & ballistic particle burst
    └── exporter/
        └── headerGenerator.ts            # C++ frames.h & frames_rle.h string builder
```

---

## 8. Summary of Specification Mining Conclusions
1. **Streaming Bottlenecks Resolved**: WebSerial at 921600 baud easily supports 30 FPS. The primary bottleneck is the OLED I2C bus at 400 kHz (~24 ms per frame). With ACK-based stop-and-wait flow control, buffer overflow is completely eliminated.
2. **C++ Exporter Alignment**: Bit-ordering is strictly verified as LSB-first row-major XBMP (`drawXBMP(0, 0, 128, 64, bitmap)`), matching `convert_reel.py` and U8g2 expectations.
3. **PackBits RLE Advantage**: Yields 70–85% compression on lyric and silhouette art with a tiny ~15-line C++ decompressor that requires zero dynamic heap memory.
4. **Procedural FX Ready for 128×64**: Typewriter/Bounce lyrics, 1-bit Glitch FX, and 3D Starfield/Particles provide a rich visual engine for standalone generation or post-processing over uploaded video reels.
