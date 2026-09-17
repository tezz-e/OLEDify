# OLEDify Studio 🚀

> **Music-Driven OLED Visual Engine & Hardware Converter**
> Transform video reels, GIFs, and hand-drawn animations into live 1-bit monochrome displays on ESP32 / Arduino OLED hardware with hardware-aware compilation and WebSerial live streaming.

---

## ✨ Features

- **🌐 Web Studio App (`web/`):** Drag-and-drop ingestion of MP4 reels, animated GIFs, PNG sequences, or exported `frames.h` headers.
- **🎨 1-Bit Dithering Suite:** Atkinson (crisp line art & lyrics), Floyd-Steinberg, Bayer 4×4 / 8×8 Matrix, and Adaptive Thresholding with live Brightness, Contrast & Invert controls.
- **⚡ WebSerial Live Hardware Streaming:** Stream dithered frame buffers directly to connected ESP32 over USB Serial without reflashing code.
- **🛠️ Hardware Configurator:** Custom board selector (ESP32-S3, ESP32, ESP32-C3, Arduino, Pico), display drivers (SH1106, SSD1306, SSD1315), and custom I2C SDA/SCL pin mapping.
- **⏱️ Frame Trimmer & Speed Accelerator:** Trim intro/outro frames and accelerate rendering up to 60 FPS over 800kHz overclocked I2C.
- **📦 C++ Header Exporter (`frames.h`):** One-click export of optimized `PROGMEM` XBMP byte arrays for PlatformIO.

---

## 🛠️ Hardware Setup

- **Board:** ESP32-S3 DevKit (N16R8 / DevKitC-1)
- **Display:** 1.3" SH1106 or 0.96" SSD1306 OLED (128×64)
- **I2C Pins:** `SDA = GPIO 8`, `SCL = GPIO 9` (Configurable in Web UI)

---

## 🚀 Quick Start

### 1. Web Studio App
```bash
cd web
npm install
npm run dev
```
Open `http://localhost:5173/` in Google Chrome or Microsoft Edge.

### 2. ESP32 PlatformIO Firmware
```bash
pio run --target upload
```

---

## 📜 License

MIT License © 2026 OLEDify Team
