# BRIEFING — 2026-09-17T18:30:00Z

## Mission
Investigate specifications, browser APIs, image processing algorithms, UI/UX architecture, and mathematical models for R1 (Web-based Drag & Drop Converter & Studio UI in Vite + React) for 128x64 monochrome OLEDs.

## 🔒 My Identity
- Archetype: Specification Miner
- Roles: Web Engine & Dithering Spec Miner
- Working directory: D:\espprojects\oled\.agents\explorer_survey_2
- Original parent: 9cea43f2-151e-4fe1-9c10-7dfec5d36b10
- Milestone: Phase 0 Survey - Explorer 2

## 🔒 Key Constraints
- Specification Miner role: probe authoritative sources, document features, no implementation in source code.
- Read-only on codebase source, only write inside working directory `D:\espprojects\oled\.agents\explorer_survey_2`.
- Rigorous mathematical definitions and algorithms for Atkinson, Floyd-Steinberg, Bayer Ordered (2x2, 4x4, 8x8), Thresholding, and XBMP bit-packing.
- Provide clear verification methods and architectural recommendations.

## Current Parent
- Conversation ID: 9cea43f2-151e-4fe1-9c10-7dfec5d36b10
- Updated: 2026-09-17T18:30:00Z

## Task Summary
- **What to build/survey**: Web-based Drag & Drop Converter & Studio UI (Vite + React) at D:\espprojects\oled\web:
  1. Input format handling: MP4, WebM, animated GIF, PNG frame sequences. Browser client-side decoding techniques.
  2. Interactive 128x64 crop & scale bounding box tool: aspect ratio preservation (2:1), pan/crop, zoom/scale.
  3. Dithering & processing pipeline: Brightness/Contrast, Atkinson, Floyd-Steinberg, Bayer (2x2, 4x4, 8x8), Thresholding, XBMP 1024-byte row-major packing.
  4. Simulated 128x64 OLED canvas player: OLED aesthetic (cyan/yellow-blue/white, pixel grid), playback controls (play/pause, scrub, FPS 15-30, step).
  5. Component architecture, state management, and performance optimization (Web Workers, OffscreenCanvas, TypedArrays).
- **Success criteria**: Comprehensive, deeply technical analysis.md and handoff.md containing tables, math formulas, data layouts, and verified architecture.
- **Interface contracts**: D:\espprojects\oled\.agents\ORIGINAL_REQUEST.md
- **Code layout**: D:\espprojects\oled\web

## Key Decisions Made
- Documented exact math, diffusion matrices, normalization factors, and bit-level XBMP layout matching U8g2 drawXBMP and convert_reel.py.
- Evaluated client-side decoding libraries (HTML5 video seeking for MP4/WebM, omggif for GIF89a, natural sorting + createImageBitmap for PNG sequences).
- Defined decoupled React state + Direct-Ref rAF canvas player architecture to ensure zero-lag 60 FPS slider response and smooth 15-30 FPS OLED playback.
- Defined Web Worker background batch pipeline with transferable Uint8Array buffers.

## Artifact Index
- D:\espprojects\oled\.agents\explorer_survey_2\DISPATCH.md — Dispatch log
- D:\espprojects\oled\.agents\explorer_survey_2\BRIEFING.md — Situational awareness
- D:\espprojects\oled\.agents\explorer_survey_2\progress.md — Liveness & progress tracking
- D:\espprojects\oled\.agents\explorer_survey_2\analysis.md — Deep technical specification report (Features Discovered & Edge Cases)
- D:\espprojects\oled\.agents\explorer_survey_2\handoff.md — 5-component handoff report
