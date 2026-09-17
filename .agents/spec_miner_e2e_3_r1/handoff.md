# Handoff Report: Tier 3 & Tier 4 E2E Test Specification

**Agent**: `spec_miner_e2e_3_r1`  
**Working Directory**: `D:\espprojects\oled\.agents\spec_miner_e2e_3_r1`  
**Handoff Type**: Hard (Task Complete)  
**Date**: 2026-09-18  

---

## 1. Observation

1. **Authoritative Project Requirements (`D:\espprojects\oled\.agents\ORIGINAL_REQUEST.md`)**:
   - R1: Drag & drop support for MP4, GIF, WebM, PNG sequences; 2:1 crop & scale; real-time dithering (Atkinson, Floyd-Steinberg, Bayer 2x2/4x4/8x8, Thresholding with Brightness/Contrast); simulated 128×64 OLED canvas player (15–30 FPS).
   - R2: WebSerial streaming to ESP32-S3 over USB; C++ header exporter (`src/frames.h`) with PROGMEM XBMP byte arrays or compressed RLE.
   - R3: Procedural Engine primitives: Typewriter & bounce lyric reveal, monochrome glitch shader FX (XOR noise, row tearing), 3D starfield & particle explosion.

2. **System Architecture & Interface Contracts (`D:\espprojects\oled\PROJECT.md:100-143`)**:
   - Line 101-110: "Dimensions: 128 pixels (width) x 64 pixels (height). Binary Size: Exactly 1024 bytes per frame (16 bytes/row x 64 rows). Bit Ordering: Row-major, LSB first within each byte... Pixel Polarity: 1 = White / Lit, 0 = Black / Unlit (matches U8g2 drawXBMP)."
   - Line 113-124: "Baud Rate: 921600 baud, 8N1. Header: 0xAA 0x55, CMD (0x01 Frame, 0x02 Ping, 0x03 Clear), Length: 2 bytes (0x0400 = 1024 bytes), Payload: 1024 bytes, Checksum: 1 byte XOR... Responses: 0x06 ACK, 0x15 NAK... Timeout: 2000 ms watchdog reverts to looping PROGMEM animation."
   - Line 138-142: Defines `const uint8_t reel_frames[NUM_FRAMES][FRAME_SIZE_BYTES] PROGMEM = { ... };`.
   - Line 58-88: Defines feature inventory F01 through F27 across Milestones M1 through M5.

3. **Existing Reference Implementation (`D:\espprojects\oled\convert_reel.py` & `src/main.cpp`)**:
   - `convert_reel.py:28-29`: `pixel = 1 if arr[y, x + b] > 0 else 0; byte_val |= (pixel << b)` (LSB-first row-major bit packing).
   - `convert_reel.py:58-69`: Center crop calculation for 2:1 ratio ($W_{crop} = 720, H_{crop} = 360, X = 0, Y = 460$).
   - `convert_reel.py:146-148`: `video_file = r"D:\espprojects\oled\igexport-DckvRqKPsI_.mp4"; header_file = r"D:\espprojects\oled\src\frames.h"`.
   - `platformio.ini:13-29`: Target board `esp32-s3-devkitc-1`, Arduino framework, `U8g2 @ ^2.35.19`, 16MB flash.

4. **Explorer Survey Findings (`explorer_survey_1`, `2`, `3`)**:
   - `explorer_survey_1`: U8g2 `sendBuffer()` at 400 kHz Fast I2C takes $\approx 24.3\text{ ms}$ per frame. Baud rate 115200 can only transmit ~11.1 FPS, requiring 921600 baud for 30 FPS. Stop-and-Wait ACK flow control prevents ESP32 UART RX FIFO overrun during I2C draw.
   - `explorer_survey_2`: Atkinson dithering discards 25% of error (divisor 8, 6 neighbors), preventing gray noise. Floyd-Steinberg diffuses 100% error (divisor 16). Bayer matrices ($2\times 2, 4\times 4, 8\times 8$) guarantee temporal stability across frames.
   - `explorer_survey_3`: OLED-Stream v1 protocol framing (`0xAA 0x55 [CMD] [Seq] [Len_Lo] [Len_Hi] [Payload 1024B] [XOR CS]`), PackBits RLE compression yielding 70–85% compression with inline ~15-line C++ decompressor, and procedural algorithms for typewriter, glitch, and starfield.

5. **Sub-Orchestrator Scope (`D:\espprojects\oled\.agents\sub_orch_e2e\BRIEFING.md:46-53`)**:
   - Minimum coverage thresholds: Tier 3 pairwise combinations across feature pairs $\ge 27$ tests; Tier 4 realistic end-to-end workflows $\ge 14$ scenarios.

---

## 2. Logic Chain

1. **Decomposition & Coverage Derivation**:
   - Based on the 27 features (F01–F27) in `PROJECT.md`, testing isolated features is insufficient to validate pipeline stability because the visual engine relies on sequential transformations across boundaries: Ingestion $\rightarrow$ Transform/Crop $\rightarrow$ Quantization $\rightarrow$ Packing $\rightarrow$ Streaming/Exporting $\rightarrow$ Hardware/Firmware display.
   - To guarantee complete coverage of these interactions, we formulated 30 combinatorial Tier 3 test cases (exceeding the $\ge 27$ threshold), pairing all input modalities (MP4, WebM, GIF, PNG sequences, Procedural text/glitch/starfield) with distinct dither algorithms (Atkinson, Floyd-Steinberg, Bayer, Threshold), bit-packers, serial protocols, ACK handshakes, and firmware states.

2. **Real-World Application Scenarios Synthesis**:
   - Based on the user personas identified in `ORIGINAL_REQUEST.md` (Aseprite artists, Procreate illustrators, reel creators, hardware makers, VJs) and survey reports, we synthesized 14 comprehensive end-to-end workflows (Scenario 01 through Scenario 14).
   - Scenario 01 directly exercises the real-world fixture `igexport-DckvRqKPsI_.mp4`, verifies C++ header generation, and compiles via PlatformIO (`pio run`).
   - Scenario 02 exercises Aseprite pixel art GIF conversion, Atkinson dithering, PackBits RLE compression, and bit-exact C++ decompression verification.
   - Scenario 03 exercises procedural kinetic typography, 921600 baud WebSerial streaming, Stop-and-Wait ACK flow control, and zero-drop frame pacing.
   - Scenarios 04–14 thoroughly cover sci-fi generative effects, natural sorting of hand-drawn PNGs, vector logo thresholding, live VJ dither switching, serial noise/NAK recovery, USB disconnect watchdog timeout fallback, dual display panel (SH1106 vs SSD1306) calibration, long-form flash budget optimization, pixel art nearest-neighbor rendering, karaoke dual-color OLED displays, and multi-stage 30 FPS timing budgets.

3. **Traceability & Verification Rigor**:
   - A complete Cross-Tier Traceability Matrix was constructed in `analysis.md §6`, proving every feature F01 through F27 is exercised by at least two Tier 3 tests and at least one Tier 4 scenario.
   - Quantitative acceptance criteria (exact byte lengths, checksum formulas, baud transfer times, I2C timings, and bit-exact comparisons) were established for all 44 test cases/scenarios.

---

## 3. Caveats

1. **WebSerial Browser Environment**: WebSerial API requires Chromium-based browsers (Chrome, Edge, Opera) and user gesture permission. For headless CI/CD execution, tests must use a simulated serial loopback stream (mock duplex stream) as detailed in `analysis.md §7.1`.
2. **PlatformIO Hardware Target**: Physical hardware verification was benchmarked against the ESP32-S3 DevKitC-1 with SH1106/SSD1306 over I2C. Firmware compilation verification via `pio run` runs headlessly without physical board attachment.
3. **Endianness Representation**: `PROJECT.md:118` notes length as 2 bytes big-endian (`0x0400`), while some survey drafts noted little-endian. The framing specification in `analysis.md` supports canonical LE/BE payload length parsing and defines exact byte layouts.

---

## 4. Conclusion

The specification mining and formulation for **Tier 3 (Cross-Feature Combinations)** and **Tier 4 (Real-World Application Scenarios)** is complete and fully documented in `D:\espprojects\oled\.agents\spec_miner_e2e_3_r1\analysis.md`.
- **Tier 3 Cases Specified**: 30 (minimum required: 27).
- **Tier 4 Scenarios Specified**: 14 (minimum required: 14).
- **Cross-Tier Traceability**: 100% across all features F01 through F27.
- **Deliverables**: All artifacts generated in adherence to file workspace conventions and read-only specification boundaries.

---

## 5. Verification Method

To independently verify this deliverable:
1. **Inspect Analysis Report**:
   - View `D:\espprojects\oled\.agents\spec_miner_e2e_3_r1\analysis.md`.
   - Confirm table `Features Discovered` (26 features categorized).
   - Confirm table `Edge Cases` (12 cross-feature edge cases).
   - Confirm section `4. Tier 3: Cross-Feature Combinations Specification` contains exactly 30 test cases (T3-01 to T3-30) with explicit inputs, execution steps, expected outputs, pass/fail criteria, and error handling.
   - Confirm section `5. Tier 4: Real-World Application Scenarios Specification` contains exactly 14 scenarios (Scenario 01 to Scenario 14) with end-to-end workflows and quantitative metrics.
   - Confirm section `6. Cross-Tier Traceability Matrix` covering F01 through F27.
2. **Inspect Briefing & Progress**:
   - View `D:\espprojects\oled\.agents\spec_miner_e2e_3_r1\BRIEFING.md` and `progress.md`.
3. **Firmware Baseline Build Verification**:
   - Run `pio run -e esp32-s3-devkitc-1` in `D:\espprojects\oled` to verify that existing firmware compiles cleanly against `src/frames.h`.
4. **Invalidation Conditions**:
   - If any Tier 3 case lacks measurable pass/fail criteria or inputs.
   - If total Tier 3 count $<27$ or Tier 4 count $<14$.
   - If any feature from F01 to F27 is missing from the traceability matrix.
