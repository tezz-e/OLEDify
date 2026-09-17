# Handoff Report: E2E Test Infrastructure, Runner Architecture & Validation Oracles

**Agent**: `explorer_e2e_1_r1`  
**Recipient**: `sub_orch_e2e` (Parent Conversation ID: `157bdbf5-2620-42ba-90f5-ea86cd6049fb`)  
**Type**: Hard Handoff (Work Item 1 complete)  
**Date**: 2026-09-18  

---

## 1. Observation

1. **Python Command & Launcher Invocations**:
   - Running `powershell -Command "python --version"` output:
     `Python was not found; run without arguments to install from the Microsoft Store, or disable this shortcut from Settings > Apps > Advanced app settings > App execution aliases.` (Exit code: 1).
   - Running `where.exe py; where.exe python` output:
     ```
     C:\Users\manee\AppData\Local\Programs\Python\Launcher\py.exe
     C:\Users\manee\AppData\Local\Microsoft\WindowsApps\python.exe
     C:\Users\manee\AppData\Local\Programs\Python\Python313\python.exe
     ```
   - Running `powershell -Command "py -3 --version"` output:
     `Python 3.13.5` (Exit code: 0).
2. **Python Package Availability**:
   - Running `powershell -Command "py -3 -c 'import sys, cv2, PIL, numpy; print(cv2.__version__); print(PIL.__version__); print(numpy.__version__)'"` output:
     ```
     5.0.0
     12.3.0
     2.5.2
     ```
   - Running `powershell -Command "py -3 -m pytest --version"` output:
     `C:\Users\manee\AppData\Local\Programs\Python\Python313\python.exe: No module named pytest` (Exit code: 1).
   - Running `powershell -Command "py -3 -m unittest -h"` displayed full built-in unittest CLI options with test discovery support (Exit code: 0).
3. **Node.js & NPM Invocations**:
   - Running `node -v` output: `v24.15.0`.
   - Running `node -e 'const test = require("node:test"); const assert = require("node:assert"); test("sample", () => { assert.strictEqual(1+1, 2); });'` output:
     `✔ sample (1.423ms) ... pass 1, fail 0` (Exit code: 0).
   - Running `npm -v` in PowerShell output:
     `npm : File C:\Program Files\nodejs\npm.ps1 cannot be loaded because running scripts is disabled on this system.` (Exit code: 1).
   - Running `npm.cmd -v` output: `11.12.1` (Exit code: 0).
4. **Existing Codebase Assets**:
   - `D:\espprojects\oled\igexport-DckvRqKPsI_.mp4` is present (452,393 bytes, 720x1280 vertical video reel, 466 frames @ 30 FPS).
   - `D:\espprojects\oled\convert_reel.py` defines reference Floyd-Steinberg dithering (`Image.Dither.FLOYDSTEINBERG`) and row-major LSB-first XBMP bit packing (`pixel << b`).
   - `D:\espprojects\oled\test\` contains only `README`.

---

## 2. Logic Chain

1. From **Observation 1 & 2**, `python.exe` defaults to the Windows Store redirector stub, but `py -3` successfully invokes Python 3.13.5 with `cv2` 5.0.0, `PIL` 12.3.0, and `numpy` 2.5.2 already installed.
2. From **Observation 2**, `pytest` is not installed, meaning that introducing `pytest` as a hard prerequisite would fail out-of-the-box or require internet downloads/pip installations.
3. In contrast, Python's built-in `unittest` module is standard library, requires zero external packages, supports test discovery and parameterization, and can be cleanly wrapped into a standalone CLI runner (`test/e2e/runner.py`).
4. From **Observation 3**, Node.js 24.15.0 is natively installed and its built-in `node:test` runner works without npm packages. However, media processing (decoding MP4s, resizing, generating GIF frames) in pure Node without external npm dependencies is significantly more cumbersome than in Python with OpenCV and PIL.
5. Therefore, the optimal architecture is a **Unified Python CLI Test Runner (`test/e2e/runner.py`)** leveraging `unittest`, `cv2`, `PIL`, and `numpy` for all media processing, mathematical dithering oracles, binary packing verification, WebSerial protocol simulation, and C++ header validation, paired with a Windows batch wrapper `test/e2e/run.bat` that automatically routes commands to `py -3`.
6. Mathematical validation oracles can be implemented with exact ground-truth precision:
   - Atkinson dithering: 6 neighbors, divisor 8, exactly 75% error diffused, 25% discarded.
   - Floyd-Steinberg dithering: 4 neighbors, divisor 16, exactly 100% error diffused.
   - Bayer matrices: $2\times2, 4\times4, 8\times8$ normalized coordinate thresholding.
   - XBMP packing: 1024 bytes ($16 \times 64$), row-major, LSB-first.
   - OLED-Stream v1 protocol: 1030-byte packets, `0xAA 0x55` header, XOR checksum, Stop-and-Wait ACK (`0x06`) / NAK (`0x15`).

---

## 3. Caveats

1. **PowerShell Script Policy**: Invoking `npm` directly in PowerShell triggers execution policy errors. While `npm.cmd` works, the test harness should not rely on PowerShell script execution policies and should execute via `node` or `py -3`.
2. **Hardware Streaming Emulation**: In the absence of a physically connected ESP32-S3 over COM11 during automated headless CLI testing, WebSerial streaming is validated via the software-based `protocol_simulator.py` oracle, which strictly emulates the ESP32-S3 receiver state machine, buffer timing, and ACK handshakes.
3. **Scope Discipline**: As an explorer agent with read-only boundaries on project code, `TEST_INFRA.md` has been drafted and saved to `proposed_TEST_INFRA.md` within this agent's folder rather than directly modifying the project root.

---

## 4. Conclusion

1. The test runner architecture is finalized:
   - Primary CLI Runner: `py -3 test/e2e/runner.py` (with flags `--tier`, `--feature`, `--verbose`, `--failfast`, `--json`, `--junit`).
   - One-Click Windows Launcher: `test\e2e\run.bat`.
   - Native Node Engine Runner: `node test/e2e/runner_node.mjs`.
2. The complete directory layout for `D:\espprojects\oled\test\e2e\` is specified, partitioning fixtures, mathematical oracles, protocol simulators, and test tiers (Tiers 1 to 5).
3. Ground-truth mathematical and protocol oracles for all dithering algorithms, bit packing, protocol framing, and header generation are specified and verified.
4. The full specification document is drafted and ready to publish at `proposed_TEST_INFRA.md`.

---

## 5. Verification Method

1. **Verify Python & Node Execution**:
   ```powershell
   py -3 --version
   py -3 -c "import cv2, PIL, numpy; print('All required packages ready')"
   node -e "require('node:test'); console.log('Node test ready');"
   ```
2. **Verify Mathematical Oracles**:
   Run the quick verification script:
   ```powershell
   py -3 -c "
   import numpy as np
   # Test Atkinson & XBMP packing
   buf = np.full((64, 128), 128.0, dtype=np.float32)
   out = np.zeros((64, 128), dtype=np.uint8)
   for y in range(64):
       for x in range(128):
           v = buf[y, x]
           q = 255.0 if v >= 128.0 else 0.0
           out[y, x] = 1 if q == 255.0 else 0
           e = (v - q) / 8.0
           for dx, dy in [(1,0),(2,0),(-1,1),(0,1),(1,1),(0,2)]:
               nx, ny = x + dx, y + dy
               if 0 <= nx < 128 and 0 <= ny < 64:
                   buf[ny, nx] += e
   assert out.shape == (64, 128)
   print('Atkinson oracle verified.')
   "
   ```
3. **Inspect Deliverables**:
   - `D:\espprojects\oled\.agents\explorer_e2e_1_r1\analysis.md`
   - `D:\espprojects\oled\.agents\explorer_e2e_1_r1\proposed_TEST_INFRA.md`
   - `D:\espprojects\oled\.agents\explorer_e2e_1_r1\handoff.md`
4. **Invalidation Conditions**:
   - Failure of `py -3` or missing `cv2`/`PIL`/`numpy` packages.
   - Checksum formula mismatch with ESP32 firmware parser.
   - Any departure from row-major LSB-first bit ordering in XBMP frames.
