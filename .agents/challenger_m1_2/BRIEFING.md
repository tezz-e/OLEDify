# BRIEFING — 2026-09-17T18:52:00Z

## Mission
Adversarially challenge and empirically stress-test the 2:1 Crop & Scale mathematical engine (F05) in cropEngine.ts.

## 🔒 My Identity
- Archetype: challenger
- Roles: critic, specialist
- Working directory: D:\espprojects\oled\.agents\challenger_m1_2
- Original parent: c335cf6b-2b25-4534-bccd-41c60c2542ba
- Milestone: M1
- Instance: 2 of 2

## 🔒 Key Constraints
- Review-only — do NOT modify implementation code (report findings; do not fix them yourself)
- Empirical challenge: must write and run verification code yourself
- If you cannot reproduce a bug empirically, it does not count

## Current Parent
- Conversation ID: c335cf6b-2b25-4534-bccd-41c60c2542ba
- Updated: 2026-09-17T18:46:19Z

## Review Scope
- **Files to review**: D:\espprojects\oled\web\src\engine\cropEngine.ts, D:\espprojects\oled\web\src\components\CropTool.tsx
- **Interface contracts**: D:\espprojects\oled\PROJECT.md, D:\espprojects\oled\.agents\sub_orch_m1\SCOPE.md, D:\espprojects\oled\.agents\spec_miner_m1_3\analysis.md
- **Review criteria**: 2:1 aspect ratio invariant (W=2H), boundary clamping, 8-handle resizing under all directions/collisions, canvas rendering contract (128x64 / 32,768 bytes RGBA buffer)

## Attack Surface
- **Hypotheses tested**:
  - H1: Boundary clamping under extreme aspect ratios (1:1000, 1000:1, 0x0, small heights). Confirmed failure modes in computeCoverCrop, computeContainDestRect, and clampCropToBounds.
  - H2: Boundary clamping in 8-handle resizing when box is near image borders. Confirmed critical boundary overflows across all 8 handles.
  - H3: Aspect ratio invariant W = 2H across all operations. Confirmed aspect ratio invariant holds when dimensions > 0.
  - H4: Canvas rendering contract for renderCropTo128x64. Verified 128x64 and 32,768 bytes RGBA output on valid inputs; confirmed IndexSizeError crash when given 0-dimension box.
- **Vulnerabilities found**:
  - V1 (CRITICAL): `resizeCropWithHandle` violates source boundaries ($x < 0, y < 0, x + w > W_{src}, y + h > H_{src}$) for all 8 handles when anchor point has remaining space $< hMin$.
  - V2 (HIGH): `clampCropToBounds` violates $y + height \le H_{src}$ when $H_{src} < 4$ because it lacks an upper bound check for height while enforcing $hMin = 4$.
  - V3 (HIGH): `computeCoverCrop` outputs degenerate $0 \times 0$ box for $W_{src} < 2$ (1:1000 sliver, 1x1, 1x2), which causes `renderCropTo128x64` to crash with `IndexSizeError`.
  - V4 (HIGH): `computeContainDestRect` outputs `NaN` for all coordinates ($dx, dy, dw, dh$) when given $0 \times 0$ uninitialized media, throwing `TypeError` in Canvas `drawImage`.
- **Untested angles**:
  - Touch-specific mobile pointer gestures (UI level).

## Loaded Skills
- None loaded

## Key Decisions Made
- Executed empirical test suite `web/test/stress-f05.ts` using `npx tsx`.
- Decision: Verdict is REQUEST_CHANGES due to 1 critical boundary overflow and 3 high-severity crashes/overflows.

## Artifact Index
- D:\espprojects\oled\.agents\challenger_m1_2\DISPATCH.md
- D:\espprojects\oled\.agents\challenger_m1_2\BRIEFING.md
- D:\espprojects\oled\.agents\challenger_m1_2\progress.md
- D:\espprojects\oled\.agents\challenger_m1_2\challenge.md
- D:\espprojects\oled\.agents\challenger_m1_2\handoff.md
- D:\espprojects\oled\web\test\stress-f05.ts
