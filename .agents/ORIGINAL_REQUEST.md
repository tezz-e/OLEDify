# Original User Request

## Initial Request — 2026-09-17T18:27:39Z

Build a web-based OLED Visual Animation Engine & Converter (Vite + React) that converts uploaded video reels or hand-drawn animations into live-previewed 1-bit OLED displays and WebSerial hardware output.

Working directory: D:\espprojects\oled
Integrity mode: development

---

## Context & Research Foundation

Based on research into creator workflows (Aseprite, Procreate, image2cpp, oledanimationmaker.com, AnimatedGIF, U8g2):
- Creators use: Aseprite, Procreate, Photoshop frame timelines, and video reels.
- Key Dithering Algorithms: Atkinson (best for sharp line art/lyrics), Floyd-Steinberg (smooth photo gradients), Bayer Matrix (ordered crosshatch).
- Display Target: ESP32-S3 + SH1106 / SSD1306 128×64 OLED via I2C (SDA=GPIO 8, SCL=GPIO 9).

---

## Requirements

### R1. Web-based Drag & Drop Converter & Studio UI
Build a modern Vite + React web application in D:\espprojects\oled\web (or D:\espprojects\oled) with:
- Drag-and-drop support for MP4, GIF, WebM, PNG frame sequences.
- Interactive 128×64 crop & scale bounding box tool.
- Real-time dither selector: Atkinson Dithering, Floyd-Steinberg, Bayer Ordered Matrix, and Thresholding with live Brightness & Contrast sliders.
- Simulated 128×64 Monochrome OLED canvas player with play/pause, scrub bar, and FPS selector (15–30 FPS).

### R2. 1-Click Hardware Flashing & Code Export
- WebSerial Flashing: Stream frames live to connected ESP32-S3 over WebSerial USB.
- Code Exporter: Generate optimized C++ header (src/frames.h) with PROGMEM XBMP byte arrays or compressed RLE format.

### R3. Procedural Engine Primitives (Phase 2 Foundation)
- Text Typewriter & Bounce Lyric reveal renderer.
- Glitch Shader FX (XOR bitwise noise, row tearing shifts).
- Starfield & Particle explosion generator.

---

## Acceptance Criteria

### Conversion & UI Quality
- Drag-and-drop video/GIF file renders onto 128×64 simulated OLED canvas in real-time.
- Dithering algorithm toggle (Atkinson vs Floyd-Steinberg vs Bayer) updates preview canvas instantly without lag.
- One-click button copies or downloads valid frames.h C++ PROGMEM byte arrays compatible with U8g2 drawXBMP().

### Hardware & WebSerial
- WebSerial connection button detects ESP32 USB serial device and streams dithered frame bytes live to the screen.

### Procedural Effects
- Includes at least 2 procedural FX (e.g. Typewriter lyric reveal + Starfield particle effect) that render natively on the 128×64 canvas.
