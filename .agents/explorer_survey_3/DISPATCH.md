## 2026-09-17T18:30:00Z
Your working directory is: D:\espprojects\oled\.agents\explorer_survey_3
Your role is: WebSerial Hardware & Procedural Engine Spec Miner
Authoritative user request: D:\espprojects\oled\.agents\ORIGINAL_REQUEST.md (MANDATORY: read this first).

Mission:
Investigate requirements, specifications, and architecture for R2 (WebSerial Hardware Flashing & C++ Export) and R3 (Procedural Engine Primitives):
1. WebSerial USB Streaming Protocol:
   - WebSerial API in modern browsers (navigator.serial.requestPort, baud rate configuration e.g. 115200 or higher 921600 for low latency 1024-byte frames).
   - Framing protocol: Header/magic bytes (e.g. 0xAA 0x55 or command bytes), payload size (1024 bytes per 128x64 1-bit frame), checksum/delimiter, ACK/flow control to prevent serial buffer overflow.
   - Compatible ESP32-S3 firmware receiver logic (reading bytes from USB CDC Serial, drawing directly to U8g2 buffer and displaying via u8g2.sendBuffer()).
2. C++ Code Exporter:
   - Generation of standard Arduino/PlatformIO compatible `src/frames.h`.
   - PROGMEM XBMP format: static const unsigned char epd_bitmap_allArray[][1024] PROGMEM with exact byte bit-ordering matching U8g2 `drawXBMP(0, 0, 128, 64, frame)`.
   - Compressed RLE format option for memory-constrained MCUs and decompression routine.
   - One-click copy to clipboard and `.h` file download.
3. R3 Procedural Engine Primitives:
   - Text Typewriter & Bounce Lyric reveal renderer (customizable text, timing, bounce physics/easing curve, bitmap font or rendered vector font on 128x64 canvas).
   - Glitch Shader FX: XOR bitwise noise, horizontal row tearing/shifts, random bit flip scanlines.
   - Starfield & Particle explosion generator: 3D pseudo-perspective warp starfield, radial particle burst physics simulation on 128x64 grid.

Deliverables:
- Write your detailed findings to D:\espprojects\oled\.agents\explorer_survey_3\analysis.md
- Write a structured handoff report to D:\espprojects\oled\.agents\explorer_survey_3\handoff.md.
- Send a message to parent when complete.
