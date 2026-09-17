## 2026-09-17T18:34:06Z

<USER_REQUEST>
You are a Specification Miner agent for the E2E Testing Track of the OLED Visual Animation Engine & Converter project.
Your identity: spec_miner_e2e_3_r1
Your working directory: D:\espprojects\oled\.agents\spec_miner_e2e_3_r1

MANDATORY FIRST STEP: Read the authoritative original request:
D:\espprojects\oled\.agents\ORIGINAL_REQUEST.md

Additional context:
- D:\espprojects\oled\PROJECT.md (architecture, F01-F27 inventory, interface contracts, code layout)
- D:\espprojects\oled\.agents\sub_orch_e2e\BRIEFING.md
- Survey reports: D:\espprojects\oled\.agents\explorer_survey_1\analysis.md, explorer_survey_2\analysis.md, explorer_survey_3\analysis.md

Your Mission:
Mine and specify in detail:
1. Tier 3: Cross-Feature Combinations (Pairwise combinatorial interactions across major feature pairs, >=27 test cases minimum).
   - For example:
     - MP4 -> Atkinson -> XBMP -> WebSerial
     - WebM -> Floyd-Steinberg -> XBMP -> PROGMEM frames.h
     - GIF -> Bayer 4x4 -> PackBits RLE -> C++ Header
     - PNG Sequence -> Brightness/Contrast -> Thresholding -> XBMP -> Serial
     - Typewriter Lyric -> Glitch XOR -> Simulated OLED Canvas -> frames.h
     - Starfield 3D Warp -> Row Tearing Glitch -> 15 FPS -> WebSerial
     - 2:1 Crop (Contain) -> Atkinson -> Stop-and-Wait ACK Stream
     - Corrupted Packet -> NAK Response -> Retransmit -> Draw
     - Serial Timeout (2000ms) -> Standalone Fallback PROGMEM Loop
     - etc.
2. Tier 4: Real-World Application Scenarios (Realistic complete end-to-end user workflows, >=14 application scenarios).
   - Scenario 1: User uploads `igexport-DckvRqKPsI_.mp4` (466 frames, 30 FPS), crops 2:1 center, applies Floyd-Steinberg, generates `src/frames.h`, verifies syntax and compilation with PlatformIO (`pio run`).
   - Scenario 2: User imports animated GIF, selects Atkinson dithering, previews at 20 FPS, exports PackBits RLE header, verifies byte decompression matches raw bitmap.
   - Scenario 3: User opens Procedural Studio, configures Typewriter & Lyric Bounce, streams over WebSerial to simulated ESP32-S3 receiver, verifies frame pacing, 0x06 ACKs, and zero dropped frames.
   - Scenario 4: User combines 3D Starfield with Glitch FX row-tear, tests brightness/contrast adjustments, exports C++ header, compiles firmware.
   - Detail scenarios 5 through 14 covering all creator workflows mentioned in ORIGINAL_REQUEST.md and Survey reports.
3. Define exact acceptance criteria, pass/fail metrics, and execution steps for every Tier 3 and Tier 4 scenario.

Deliverables:
Write your full specification report to `D:\espprojects\oled\.agents\spec_miner_e2e_3_r1\analysis.md` and write a self-contained handoff to `D:\espprojects\oled\.agents\spec_miner_e2e_3_r1\handoff.md`.
Notify me via send_message when done.
Scope boundaries: Read-only specification mining. Do NOT create or modify implementation source code files directly.
</USER_REQUEST>
