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

---

## Follow-up — 2026-09-19T20:10:23Z

Elevate the OLED Studio application from a static dashboard into a highly dynamic, tactile, and original interface by creatively integrating a suite of animated components from React Bits. The final result must strictly maintain the brutalist "WaxyBit Blueprint" aesthetic (sharp black borders, white/parchment backgrounds, monospace typography).

Working directory: `D:\espprojects\oled\web`
Integrity mode: development

## Verification Resources
The required React Bits source code has been fetched by our research agents and saved locally. You must read these files, clean them up if necessary (they may be wrapped in markdown from the fetch), and integrate them into the project:

- **Fluid Glass**: `C:\Users\manee\.gemini\antigravity\brain\47307c5b-7f74-4278-9131-ad391d61efcd\FluidGlass.network-response`
- **Glass Surface JSX**: `C:\Users\manee\.gemini\antigravity\brain\47307c5b-7f74-4278-9131-ad391d61efcd\GlassSurface.network-response`
- **Glass Surface CSS**: `C:\Users\manee\.gemini\antigravity\brain\47307c5b-7f74-4278-9131-ad391d61efcd\GlassSurface.css`
- **Liquid Ether**: `C:\Users\manee\.gemini\antigravity\brain\47307c5b-7f74-4278-9131-ad391d61efcd\LiquidEther.network-response`
- **Option Wheel JSX**: `C:\Users\manee\.gemini\antigravity\brain\3022a3dc-4e9d-46c8-9bb2-e44e9ae3e6c9\.system_generated\steps\1338\content.md`
- **Option Wheel CSS**: `C:\Users\manee\.gemini\antigravity\brain\3022a3dc-4e9d-46c8-9bb2-e44e9ae3e6c9\.system_generated\steps\1339\content.md`
- **Click Spark JSX**: `C:\Users\manee\.gemini\antigravity\brain\3022a3dc-4e9d-46c8-9bb2-e44e9ae3e6c9\.system_generated\steps\1340\content.md`
- **Decrypted Text JSX**: `C:\Users\manee\.gemini\antigravity\brain\3022a3dc-4e9d-46c8-9bb2-e44e9ae3e6c9\.system_generated\steps\1341\content.md`
- **Count Up JSX**: `C:\Users\manee\.gemini\antigravity\brain\3022a3dc-4e9d-46c8-9bb2-e44e9ae3e6c9\.system_generated\steps\1342\content.md`

## Requirements

### R1. Install Dependencies
Identify and install all required dependencies for the React Bits components (e.g., `three`, `@react-three/fiber`, `framer-motion`, `gsap`, etc.) into the working directory.

### R2. Tactile Controls & Readouts
Replace standard HTML inputs with dynamic React Bits components to make the UI feel like physical hardware:
- Use **Option Wheel** for select dropdowns (e.g., Algorithm, Target Board, or Crop Mode).
- Add **Click Spark** to high-impact action buttons (Compile, Flash, Apply Trim).
- Use **Decrypted Text** or **Count Up** for technical readouts (Frame counters, status messages, connection states) so they animate in like a hacker terminal.

### R3. Ambient Depth (Liquid/Glass)
Implement `LiquidEther` as a constrained background animation (e.g., trapped inside the OLED canvas area behind the dithered preview, or subtly replacing the global parchment background while keeping UI panels solid). Use `GlassSurface` or `FluidGlass` sparingly to add depth to specific high-focus elements without ruining the flat aesthetic.

### R4. Preserve the Blueprint Aesthetic
The integration must strictly preserve the 1-2px sharp black borders, the `#F5F0EB` parchment and `#FFFFFF` panel colors, the `#E85D2A` accent, and the `IBM Plex Mono` typography.

## Acceptance Criteria

### Technical
- [ ] Required dependencies are successfully installed in `package.json`.
- [ ] The React app builds without errors (`npm run build` succeeds).

### Visual & Integration
- [ ] At least 4 distinct React Bits components are integrated and actively working in the UI.
- [ ] The core "WaxyBit Blueprint" aesthetic remains completely intact (no accidental rounded corners, drop shadows, or generic glass panels introduced).
- [ ] The components do not obscure critical controls or negatively impact performance/usability.

## Follow-up — 2026-09-24T18:12:06Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Delegate to teamwork_preview

Research and evaluate technical approaches for generating cute, animated 128x64 1-bit character graphics (both clean dithered and wiggly hand-drawn styles) for non-artists. Explore any technical path—AI services, local models, procedural generation, SVG manipulation, or a combination—that successfully bridges the gap for users who cannot draw.

Working directory: `c:\Users\manee\Desktop\oled\ai_research`
Integrity mode: development

## Requirements

### R1. Explore All Generative Approaches
Evaluate any technical approach that allows a non-artist to generate the core assets (e.g., cloud AI, local models, procedural generation, parametric vector libraries). Do not limit the research solely to AI if a better programmatic approach exists.

### R2. Solve the "Motion & Style" Problem
Research how to programmatically apply motion and style to these assets in the browser (e.g., how to reliably apply the 3-frame "line-boil" wiggly effect to generated art, and how to apply procedural motion like bouncing or floating).

### R3. Technical Design Document
Deliver a comprehensive markdown document (`oled_content_strategy.md`) that compares these approaches, focusing on how easily they can be integrated into a React/TypeScript web video editor to create a seamless "Creation Engine".

## Acceptance Criteria

### Comprehensive Comparison
- [ ] The document explores at least 3 distinct technical paths for asset generation (e.g., Cloud AI, Local AI, Procedural/Library).
- [ ] The document includes a comparison matrix evaluating: Quality (cuteness/accuracy to style), Latency (time to generate), and UX/Feasibility.

### Practical Recommendations
- [ ] The document provides a definitive recommendation for Phase 1 implementation (the most practical approach to start with).
- [ ] The document clearly outlines the full data pipeline from the user's idea to the final 1-bit 128x64 rendered frames.

## Follow-up — 2026-09-24T18:13:18Z

URGENT CORRECTION: The target working directory for your research and output document should be `D:\espprojects\oled\ai_research`, NOT the C: drive path. The actual React web application you are designing the solution for is located at `D:\espprojects\oled\web\`. Please ensure your research and the final `oled_content_strategy.md` document are contextualized for and placed in the D: drive project.
