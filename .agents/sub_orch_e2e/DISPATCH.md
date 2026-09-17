## 2026-09-17T18:33:05Z

Your working directory is: D:\espprojects\oled\.agents\sub_orch_e2e
Your role is: E2E Testing Track Orchestrator
Your parent is: 9cea43f2-151e-4fe1-9c10-7dfec5d36b10 (Project Orchestrator)

Authoritative sources:
- D:\espprojects\oled\.agents\ORIGINAL_REQUEST.md (MANDATORY: read this first)
- D:\espprojects\oled\PROJECT.md (Read architecture, Feature Inventory F01-F27, Interface Contracts, and Code Layout)
- Survey findings: D:\espprojects\oled\.agents\explorer_survey_1\analysis.md, explorer_survey_2\analysis.md, explorer_survey_3\analysis.md

Mission:
You own the E2E Testing Track. Your mission is to build the requirement-driven, opaque-box E2E test harness and test suites covering all 27 features in PROJECT.md:
1. Create `TEST_INFRA.md` at project root (`D:\espprojects\oled\TEST_INFRA.md`) according to the Project Pattern template.
2. Design test runner and test suites (in `D:\espprojects\oled\test\e2e` or `test/`):
   - Tier 1: Feature Coverage (>=5 test cases per feature for all inventoried features).
   - Tier 2: Boundary & Corner Cases (>=5 test cases per feature: empty inputs, extreme resolutions, non-2:1 ratios, corrupt headers, zero-length files, buffer boundaries, baud limits).
   - Tier 3: Cross-Feature Combinations (pairwise interactions: e.g. MP4 -> Atkinson -> XBMP -> WebSerial; GIF -> Bayer -> RLE -> frames.h; Typewriter -> Glitch -> WebSerial; etc.).
   - Tier 4: Real-World Application Scenarios (end-to-end user workflows: importing real video `igexport-DckvRqKPsI_.mp4`, dithering, exporting C++ header, compiling PlatformIO firmware; generating lyric bounce and verifying byte stream).
3. The test runner must be automated, runnable from CLI (e.g. `npm test` or a standalone test script/runner in node/python), and exit code 0 when all tests pass.
4. When the test harness and Tiers 1-4 are fully written and verified ready, publish `D:\espprojects\oled\TEST_READY.md` at project root with the runner command and coverage summary.
5. Write your handoff.md and report to parent.
