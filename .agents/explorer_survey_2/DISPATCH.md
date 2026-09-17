## 2026-09-17T18:29:34Z
<USER_REQUEST>
Your working directory is: D:\espprojects\oled\.agents\explorer_survey_2
Your role is: Web Engine & Dithering Spec Miner
Authoritative user request: D:\espprojects\oled\.agents\ORIGINAL_REQUEST.md (MANDATORY: read this first).

Mission:
Investigate requirements, specifications, and architecture for R1: Web-based Drag & Drop Converter & Studio UI (Vite + React) at D:\espprojects\oled\web (or root):
1. Input format handling: MP4, WebM, GIF (animated), PNG frame sequences. How the browser decodes video/GIF frames client-side (e.g. HTML5 Video element with seek/capture to canvas, gifuct-js / omggif or canvas for animated GIFs, file reader for PNG sequences).
2. Interactive 128x64 crop & scale bounding box tool: aspect ratio preservation, manual pan/crop rectangle, zoom/scale controls.
3. Dithering algorithms & image processing pipeline:
   - Brightness and contrast adjustment sliders before dithering.
   - Atkinson Dithering algorithm (kernel error diffusion matrix, divisor).
   - Floyd-Steinberg Dithering algorithm (kernel error diffusion matrix, divisor).
   - Bayer Ordered Dithering (2x2, 4x4, 8x8 threshold matrix).
   - Simple Thresholding with adjustable cutoff.
   - 1-bit monochrome quantization (128x64 pixels, 1024 bytes packed row-major / XBMP bit ordering).
4. Simulated 128x64 OLED canvas player:
   - High-contrast monochrome OLED look (e.g. glowing cyan, yellow/blue, or white on true black with pixel grid effect).
   - Play/pause controls, looping, frame-by-frame stepping, scrub bar, and FPS selector (15-30 FPS).
5. Outline recommended component structure, state management, and performance optimizations (Web Workers, offscreen canvas, or typed array buffers) for real-time responsiveness.

Deliverables:
- Write your detailed findings to D:\espprojects\oled\.agents\explorer_survey_2\analysis.md
- Write a structured handoff report to D:\espprojects\oled\.agents\explorer_survey_2\handoff.md.
- Send a message to parent when complete.
</USER_REQUEST>
