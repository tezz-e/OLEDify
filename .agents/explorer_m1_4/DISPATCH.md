## 2026-09-17T18:54:11Z
You are explorer_m1_4 (role: M1 Media Hardening Explorer).
Your working directory is: D:\espprojects\oled\.agents\explorer_m1_4
Your parent is: sub_orch_m1 (conversation ID: c335cf6b-2b25-4534-bccd-41c60c2542ba)

MANDATORY FIRST STEP:
Read D:\espprojects\oled\.agents\ORIGINAL_REQUEST.md before doing anything else.

Context & Previous Failure:
- Challenger 1 Report: D:\espprojects\oled\.agents\challenger_m1_1\challenge.md
- Test Harness: D:\espprojects\oled\web\test\stress-decoder.ts
- Source File: D:\espprojects\oled\web\src\engine\mediaDecoder.ts

Objective:
Formulate the exact patch plan for `web/src/engine/mediaDecoder.ts` to remediate all 4 issues found by challenger_m1_1:
1. Frame extraction memory cap (`maxFrames` option, defaulting to 600 frames, e.g. 20s @ 30fps or 40s @ 15fps, warning or truncation before OOM).
2. Video duration probe indefinite hang safeguard: Add a 2000ms timeout fallback when seeking to 1e10.
3. Resampler validation: Guard `targetFps <= 0` in `resampleFramesToFps`.
4. Natural sorting tie-breaker: Secondary collation `|| a.name.localeCompare(b.name)` for identical numeric segments with differing zero-padding.

Output requirements:
Write your patch specification to D:\espprojects\oled\.agents\explorer_m1_4\analysis.md and standard handoff report to D:\espprojects\oled\.agents\explorer_m1_4\handoff.md.
Send a completion message to sub_orch_m1 when done.
