## 2026-09-19T20:20:22Z
You are worker_m6_1 (Role: React Bits Implementer & Integrator).
Your working directory is: D:\espprojects\oled\.agents\worker_m6_1
Create your BRIEFING.md and progress.md in your working directory.

MANDATORY FIRST STEP: Read the authoritative user request at:
D:\espprojects\oled\.agents\ORIGINAL_REQUEST.md

Read the three explorer analysis reports before doing any implementation:
1. D:\espprojects\oled\.agents\explorer_m6_1\analysis.md (contains clean, tested TypeScript/React code for OptionWheel, ClickSpark, DecryptedText, CountUp, GlassSurface, LiquidEther)
2. D:\espprojects\oled\.agents\explorer_m6_2\analysis.md (contains the exact UI component replacement and integration blueprint preserving the WaxyBit Blueprint aesthetic)
3. D:\espprojects\oled\.agents\spec_miner_m6_3\analysis.md (contains exact dependency install commands, Vite config, and TypeScript settings)

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

CRITICAL HOST & EXECUTION CONSTRAINTS:
- PowerShell blocks npm.ps1 scripts on this Windows system. Always run npm commands via cmd.exe /c "npm ..." or npm.cmd.
- Drive C: has 0.00 GB free disk space. All npm cache and work is on D:\. Run all commands inside D:\espprojects\oled\web.

YOUR EXCLUSIVE WRITE OWNERSHIP:
- D:\espprojects\oled\web\package.json
- D:\espprojects\oled\web\vite.config.ts
- D:\espprojects\oled\web\tsconfig.json
- D:\espprojects\oled\web\src\vite-env.d.ts
- D:\espprojects\oled\web\src\components\reactbits\* (create OptionWheel.tsx, OptionWheel.css, ClickSpark.tsx, DecryptedText.tsx, CountUp.tsx, GlassSurface.tsx, GlassSurface.css, LiquidEther.tsx, LiquidEther.css)
- D:\espprojects\oled\web\src\components\DitherControls.tsx
- D:\espprojects\oled\web\src\components\Header.tsx
- D:\espprojects\oled\web\src\components\PlaybackBar.tsx
- D:\espprojects\oled\web\src\components\ExportModal.tsx
- D:\espprojects\oled\web\src\components\SettingsModal.tsx
- D:\espprojects\oled\web\src\components\TrimControls.tsx
- D:\espprojects\oled\web\src\components\FrameStrip.tsx
- D:\espprojects\oled\web\src\App.tsx

YOUR MISSION & IMPLEMENTATION STEPS:
1. Install dependencies:
   Run: cmd.exe /c "npm install --save three motion framer-motion && npm install --save-dev @types/three" in D:\espprojects\oled\web.
2. Update configuration:
   - In tsconfig.json, add "allowJs": true.
   - In src/vite-env.d.ts, ensure Vite client types and CSS module types are available.
   - In vite.config.ts, configure manualChunks for three and motion, and set chunkSizeWarningLimit: 1200 as specified by spec_miner_m6_3.
3. Deploy React Bits components into web/src/components/reactbits/:
   - OptionWheel (tsx + css) with blueprint styling (0px border radius, sharp 2px black borders, mono font, blur: 0, reticle guide lines)
   - ClickSpark (tsx) with pointer-events-none, customized spark colors (#E85D2A accent, #FFFFFF, #1A1A1A)
   - DecryptedText (tsx) with fast 35ms decryption interval
   - CountUp (tsx) with tabular-nums font-mono
   - GlassSurface (tsx + css) with borderRadius: 0 and sharp brutalist frame
   - LiquidEther (tsx + css) with Three.js fluid simulation and phosphor color palette matching
4. Wire components into the OLED Studio UI per explorer_m6_2's blueprint:
   - DitherControls: Replace standard button list with OptionWheel for algorithm selection, preserving selectedAlgorithm callback.
   - SettingsModal: Integrate OptionWheel for Target Board & Display Driver selectors.
   - Header: Add DecryptedText for title/status and ClickSpark for COMPILE and Connect USB buttons.
   - PlaybackBar: Add CountUp for frame counters and ClickSpark for Play/Pause.
   - ExportModal: Add CountUp for frame/KB counters, ClickSpark for FLASH_DEVICE / Copy / Download, wrap with GlassSurface.
   - App.tsx: Mount LiquidEther in the canvas stage behind OledCanvas with pointer-events-none and subtle opacity, responsive to canvas dimensions and phosphor color.
   - TrimControls / FrameStrip: Add ClickSpark to Apply Trim, CountUp to frame tally badge.
5. Verify build:
   Run: cmd.exe /c npm run build in D:\espprojects\oled\web.
   Ensure tsc and vite build pass cleanly with exit code 0.
   Verify that package.json has dependencies recorded and that at least 5 distinct React Bits components are actively used.
