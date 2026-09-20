# Orchestrator Master Plan

## Objective
Deliver a production-ready, fully verified web-based OLED Visual Animation Engine & Converter (Vite + React) + ESP32-S3 firmware/streaming support matching all specifications in ORIGINAL_REQUEST.md.

## Phases
1. **Survey (Phase 0)**:
   - Explorer 1: Inspect existing project root files (`convert_reel.py`, `igexport-DckvRqKPsI_.mp4`, `platformio.ini`, `src/`, `include/`, `lib/`, `test/`) to understand existing firmware, pinouts, dependencies, and conversion scripts.
   - Explorer 2: Technical analysis of Web Engine requirements (Vite + React, drag-drop parser for MP4/GIF/WebM/PNG sequences, 128x64 crop/scale canvas, Atkinson/Floyd-Steinberg/Bayer/Threshold dithering algorithms, simulated monochrome OLED canvas player 15-30 FPS).
   - Explorer 3: Technical analysis of WebSerial USB communication protocol, C++ PROGMEM frames.h XBMP/RLE code generation, and Phase 2 procedural primitives (Text Typewriter/Bounce lyrics, Glitch Shader FX XOR noise/row tear, Starfield/Particle explosion).
2. **Decomposition & Architecture (Phase 1)**:
   - Deduplicate and merge survey findings into `PROJECT.md` Feature Inventory.
   - Partition into modular milestones (e.g., M1: Core Web Engine & UI, M2: Dithering & Procedural Primitives, M3: WebSerial & C++ Exporter / ESP32-S3 Firmware).
   - Define interface contracts between web app and ESP32-S3 firmware.
3. **Dual-Track Execution (Phase 2)**:
   - Implementation Track: Dispatch sub-orchestrators for milestones.
   - E2E Testing Track: Dispatch E2E Testing Orchestrator to build comprehensive opaque-box test runner and test suites (Tiers 1-4).
4. **Integration & Final Verification (Phase 3 & 4)**:
   - 100% pass on E2E test suite.
   - Adversarial coverage hardening (Tier 5).
   - Forensic integrity audit.
   - Sentinel handoff.

## Milestone 6: React Bits Dynamic & Tactile UI Enhancement (Follow-up)
1. **Survey & Spec Mining**:
   - `explorer_m6_1`: Inspect & clean React Bits source files; fix brain truncation via upstream fetch; adapted TypeScript components.
   - `explorer_m6_2`: UI component mapping for OptionWheel, ClickSpark, DecryptedText, CountUp, LiquidEther, GlassSurface.
   - `spec_miner_m6_3`: Dependencies (`three`, `motion`, `framer-motion`, `@types/three`), Vite/TS config, build validation.
2. **Implementation**:
   - `worker_m6_1`: Install dependencies, deploy components to `web/src/components/reactbits/`, integrate into UI controls & canvas, verify build via `cmd.exe /c npm run build`.
3. **Verification**:
   - Reviewers (2) independently inspect code quality, blueprint aesthetic preservation, and build.
   - Challengers (2) stress-test performance, edge cases, responsive layout, and interaction safety.
   - Forensic Auditor (`teamwork_preview_auditor`) performs binary integrity audit.
   - Evaluate Gate in `GATE_STATUS.md`.
4. **Sentinel Victory Claim**:
   - When Gate passes with all criteria satisfied, report completion to Sentinel.
