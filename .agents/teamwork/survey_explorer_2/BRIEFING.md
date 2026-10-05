# BRIEFING — 2026-10-04T07:10:00Z

## Mission
Deeply research and extract interaction mechanics, formulas, and code patterns from target libraries (GSAP, Vanta, Shadcn UI, HeroUI) tailored for OLED Studio's Teenage Engineering / Nothing Tech precision hardware aesthetic and audio-visual synchronization engine.

## 🔒 My Identity
- Archetype: explorer
- Roles: Library Researcher B (GSAP, Vanta, Shadcn UI, HeroUI)
- Working directory: D:\espprojects\oled\.agents\teamwork\survey_explorer_2
- Original parent: 403d56ba-7e49-4da7-a462-57b185dbdda3
- Milestone: Research & Architecture Survey

## 🔒 Key Constraints
- Read-only investigation — do NOT modify application source code directly.
- All proposals, patterns, mathematical formulas, and code snippets must be written to working directory files.
- Strictly ignore C:\Users\manee\Desktop\oled. Active workspace is D:\espprojects\oled and D:\espprojects\oled\web.
- Zero-bloat rule for Vanta ambient background: pure HTML5 Canvas 2D or micro-WebGL shader (<3KB), NO Three.js bundling (~600KB).
- Radix primitives must be styled with Teenage Engineering / Nothing Tech hardware aesthetic.
- HeroUI acrylic backdrop blur formulations, specular reflections, and compound variants (CVA) must be rigorously detailed.

## Current Parent
- Conversation ID: 403d56ba-7e49-4da7-a462-57b185dbdda3
- Updated: 2026-10-04T07:15:00Z

## Investigation State
- **Explored paths**:
  - D:\espprojects\oled\web\package.json (dependencies: gsap, framer-motion, three, ogl, tailwindcss)
  - D:\espprojects\oled\web\tailwind.config.js (palette, fonts, animation tokens)
  - D:\espprojects\oled\web\src\components\TimelineTrack.tsx (scrub physics, ruler ticks)
  - D:\espprojects\oled\web\src\components\PlaybackBar.tsx (transport controls)
  - D:\espprojects\oled\web\src\engine\kinetic\audioAnalysisEngine.ts (AudioFrameData, 30 FPS telemetry)
  - D:\espprojects\oled\web\src\engine\kinetic\webmExporter.ts (30 FPS WebM recording)
  - D:\espprojects\oled\web\src\components\studio\lyrics\LyricsStudioView.tsx
- **Key findings**:
  - GSAP: Deterministic multi-track master timeline with `lagSmoothing(0)` and PLL Proportional Controller (`AudioTimelineSyncMaster`) linking Web Audio hardware clock to visual playhead, sub-frame timecode math (`00:02.150`).
  - Vanta: 100% eliminated Three.js bundle bloat (648KB $\to$ 1.4KB Canvas 2D or 2.0KB micro-WebGL shader), multi-harmonic sinusoidal wave algorithm reacting to cursor and audio amplitude.
  - Shadcn/Radix: Complete Teenage Engineering / Nothing hardware transformations (`HardwareSlider`, `HardwarePopover`, `HardwareTooltip`) with recessed milled tracks, 3 friction ridges, tabular monospaced numbers.
  - HeroUI: 4-layer optical acrylic formulation (`blur(24px) saturate(190%) contrast(108%)`, 1px top specular hairlines, bottom shadow), CVA compound variant matrix, complete dual-mode design token system ("Optic Hardware / Nothing Dark" & "Matte Ceramic / OP-1 Field").
  - Extended Creative Gems: Tactile 270° rotary encoder knobs, 3-position industrial toggle switches, Eurorack modular synth accordions with knurled thumbscrews, Nothing telemetry HUD with micro-oscilloscope, zero-asset Web Audio procedural haptic clicks.
- **Unexplored areas**: None for Library Researcher B scope. All 4 target libraries rigorously explored and synthesized.

## Key Decisions Made
- Replace Three.js background fields with zero-bloat HTML5 Canvas 2D / micro-WebGL shader to ensure 120 FPS performance and <1% CPU load on ESP32 WebSerial streaming.
- Use Master-Slave PLL clock synchronization with Web Audio API as master and GSAP as slave to prevent drift between kinetic word flashes and audio beats.
- Provide full production-grade TypeScript/React drop-in implementations for immediate integration.

## Artifact Index
- D:\espprojects\oled\.agents\teamwork\survey_explorer_2\DISPATCH.md — Incoming messages log
- D:\espprojects\oled\.agents\teamwork\survey_explorer_2\BRIEFING.md — Working memory index
- D:\espprojects\oled\.agents\teamwork\survey_explorer_2\progress.md — Liveness and execution progress
- D:\espprojects\oled\.agents\teamwork\survey_explorer_2\handoff.md — Comprehensive extraction and handoff report (1579 lines)
