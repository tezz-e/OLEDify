# OLEDify Studio

A browser-based tool for converting video and GIF content into 1-bit animations that run on ESP32-driven OLED displays. Drop in a reel, adjust dithering, hit flash — the animation is running on hardware in under a minute, no code required.

Built with React + Vite on the frontend, and a custom ESP32 firmware stack using U8g2 and PlatformIO.

---

## Getting Started

**Requirements:** Google Chrome or Microsoft Edge (WebSerial + WebCodecs support required). Firefox won't work.

**Hardware:** ESP32-S3 with a 128×64 SH1106 or SSD1306 OLED wired to I2C.

```bash
cd web
npm install
npm run dev
```

Open `http://localhost:5173`. If this is a fresh ESP32, use the "Install Firmware" button in the export panel to flash the firmware from the browser. After that, you never need to touch a compiler again.

---

## Usage

1. Drop an MP4, WebM, or GIF into the source panel on the left.
2. Use the dither controls on the right to choose an algorithm and adjust brightness/contrast. Atkinson tends to look best for video content; Bayer works well for graphic/geometric stuff.
3. Use the trim sliders to cut the clip to the frames you actually want.
4. Hit the play button to preview what it'll look like on the display.
5. Click **Flash to Device** — the browser will ask you to select the USB serial port, then it writes the animation binary directly to flash memory on the ESP32. No compiling, no file managers, no PlatformIO.

The ESP32 will immediately start looping the animation after reset. If you plug it back into the web app, the live stream takes over instantly. Unplug or close the tab, and it falls back to the stored animation within 2 seconds.

---

## Hardware

| Component | Spec |
|---|---|
| MCU | ESP32-S3 DevKitC-1 (N16R8) |
| Display | 1.3" SH1106 128×64 |
| I2C SDA | GPIO 8 |
| I2C SCL | GPIO 9 |
| I2C Clock | 800kHz (overclocked) |

---

## Technical Notes

This section is less about how to use the tool and more about the decisions made while building it, and why.

### The PROGMEM Problem

The original version of this worked by generating a C++ header file (`frames.h`) containing the animation as a hardcoded `PROGMEM` byte array, which you'd then compile and flash through PlatformIO. That works fine for development but it completely falls apart as a distribution model — anyone who wants to actually use the tool needs a working PlatformIO setup, which is not a small ask.

The fix was to treat the animation data as a separate concern from the firmware entirely. The ESP32's flash is large enough that we can carve out a dedicated `animation` partition (2MB at `0x200000`) using a custom `partitions.csv`. The firmware reads frames directly from raw flash at runtime using `esp_partition_read`, with a small 8-byte header storing the frame count and target FPS. The web app, using `esptool-js`, writes the packed binary blob directly to that partition offset over WebSerial. No compilation step, no toolchain dependency. The firmware is flashed once and never needs to change again for different animations.

### Video Decoding Performance

The first implementation of frame extraction used a hidden `<video>` element and seeked through it frame-by-frame, drawing each frame to a canvas and reading the pixels back. This works, but it's genuinely slow — the browser's media pipeline isn't designed for this, seek latency adds up fast, and the whole thing blocks the main thread.

The replacement uses the WebCodecs API (`VideoDecoder`) running inside a Web Worker, with `mp4box.js` handling the MP4 demuxing. The key bit is `hardwareAcceleration: 'prefer-hardware'` in the decoder config — on machines with a discrete GPU or Apple Silicon's media engine, this offloads decoding entirely to dedicated hardware. On machines without hardware decode support (or for unsupported codecs), the browser falls back to software decoding transparently. Either way it's faster than the seek loop, and the Worker means the UI stays completely responsive while a reel is being processed.

For GIFs and WebM files, or older browsers that don't support WebCodecs, there's an automatic fallback to the original `<video>` seek method.

### The Live Stream / Standalone Tension

There's an interesting edge case with the dual-mode firmware (live stream vs. stored animation). The original approach used a permanent latch: once a WebSerial frame arrived, it would set a `hasReceivedStreamFrame` flag and never go back to playing the stored animation. That's fine until you want to iterate on an animation and compare it to the stored one, or you walk away and the stream stops.

The current approach is a 2-second watchdog — the firmware tracks `lastSerialFrameTime` and if no frame has come in for 2 seconds, it clears the streaming flag and falls back to the partition. It re-enters streaming mode the moment new serial data arrives. This makes the transition seamless in both directions, which is the correct behavior for a tool where you're constantly iterating.

### Dithering

Five algorithms are available: Atkinson, Floyd-Steinberg, Bayer 4×4, Bayer 8×8, and simple threshold. The implementations live in `web/src/engine/ditherEngine.ts`. All of them operate on the raw RGBA `ImageData` coming out of the decoder, apply brightness/contrast adjustments before the dither pass, and pack the result into a 1-bit XBMP buffer that maps directly to U8g2's `drawXBMP` format.

Atkinson is the default because it looks noticeably better on OLED at small sizes. It carries less error forward than Floyd-Steinberg, which tends to produce more structured dithering that reads better on a 128×64 display where individual pixels are quite large.

The brightness control applies a direct offset to the Y (luma) channel before thresholding. This was inverted in an earlier version due to a sign error where positive brightness was subtracting from luma — fixed by flipping the offset direction.

### OLED Canvas Rendering (Web)

The preview canvas was originally drawn using 8,192 individual `fillRect` calls per frame (one per pixel on a 128×64 grid). That's obviously terrible. The replacement writes directly to an `ImageData` buffer — one pass through the pixels, map each bit to a phosphor-colored RGBA value, then a single `putImageData` call. This is roughly 100x faster and removes any perceptible lag from the preview.

---

## Project Structure

```
oled/
├── src/
│   └── main.cpp          — ESP32 firmware (WebSerial stream + partition reader)
├── web/
│   └── src/
│       ├── App.tsx
│       ├── components/
│       │   ├── OledCanvas.tsx
│       │   ├── DropZone.tsx
│       │   ├── FrameStrip.tsx
│       │   ├── DitherControls.tsx
│       │   ├── CropControls.tsx
│       │   ├── TrimControls.tsx
│       │   ├── PlaybackBar.tsx
│       │   ├── ExportModal.tsx
│       │   ├── Header.tsx
│       │   └── SettingsModal.tsx
│       └── engine/
│           ├── mediaDecoder.ts   — WebCodecs + fallback video extraction
│           ├── decodeWorker.ts   — Web Worker for hardware-accelerated decode
│           ├── ditherEngine.ts   — 1-bit dither algorithms
│           ├── flasher.ts        — esptool-js partition flashing
│           └── webSerialStreamer.ts — live frame streaming
├── partitions.csv        — custom ESP32 partition layout
└── platformio.ini
```

---

## License

MIT
