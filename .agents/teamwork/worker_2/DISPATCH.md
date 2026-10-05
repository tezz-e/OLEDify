## 2026-10-04T07:41:53Z

You are Worker 2 (Design Blueprint Hardening Architect).
Your working directory is: `D:\espprojects\oled\.agents\teamwork\worker_2`.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

CRITICAL DIRECTIVE:
Do NOT inspect, touch, or read from `C:\Users\manee\Desktop\oled`. That is an outdated folder.
The active OLED Studio project codebase is strictly located at:
`D:\espprojects\oled` and `D:\espprojects\oled\web`.

BEFORE STARTING:
You MUST read:
1. `D:\espprojects\oled\.agents\teamwork\ORIGINAL_REQUEST.md` (authoritative user request)
2. `D:\espprojects\oled\.agents\teamwork\orchestrator\PROJECT.md` (master architecture)
3. `D:\espprojects\oled\.agents\teamwork\explorer_iter2\handoff.md` (exact remediation plan and drop-in code fixes)
4. Base blueprint: `D:\espprojects\oled\.agents\teamwork\worker_1\DESIGN_BLUEPRINT.md`

MISSION:
Apply all the concrete remediations and hardened code recipes from `explorer_iter2/handoff.md` to update `DESIGN_BLUEPRINT.md`:
1. `FloatingTransportDock.tsx`: Fix IEEE-754 subtraction bug with integer millisecond arithmetic (`Math.round((safeFrame / targetFps) * 1000)` yielding exact `00:02.150`), add `onFpsChange` interactive selector, add `docked?: boolean` layout mode, add dual-mode audio adapter props for `LyricsStudioView` (`playheadMs`, `isLooping`, `onToggleLoop`, `scrubScope`), and implement dynamic cosine-squared dock magnification.
2. `InertiaTimelineScrubber.tsx`: Decouple `visualFrame` and `onSeek` from the RAF `useEffect` dependency array using refs to prevent effect teardown loops, replace unvirtualized $O(N)$ DOM tick generation with an HTML5 Canvas ruler (0 DOM nodes, <0.2ms draw time), and wire playhead transform directly via DOM ref.
3. `LiquidStudioNav.tsx`: Add stationary meniscus anchor droplet pads inside the `#hw-mercury-goo` container to provide the adjacent geometry required for authentic Skiper UI molten mercury neck coalescence.
4. `HardwareToggleSwitch.tsx`: Replace invalid rotation classes with validated arbitrary values `-rotate-[24deg]`/`rotate-[24deg]`, add `transformOrigin: '50% 75%'` for base collar pivot, and convert bare `<div>`s to accessible `<button role="radio">` controls.
5. `ModularSynthPatchCard.tsx`: Store cipher scramble timer in `useRef`, add deterministic cleanup on `handleMouseLeave` and component unmount to eliminate race conditions and memory leaks.
6. `HardwareTelemetryHUD.tsx`: Clamp audio buffer length with `Math.max(2, ...)` to guard against $0/0 = \text{NaN}$ coordinates on single-element buffers.
7. `hapticAudio.ts`: Add SSR window check, add 0.3ms linear attack ramp to eliminate DC offset click pops, and replace `setTimeout` with Web Audio hardware clock scheduling (`ctx.currentTime + 0.004`).
8. Codebase Integration Guide: Explicitly mount `SvgFilterLibrary.tsx` at the root of `App.tsx` (Line 730) in Section 5.1 and differentiate NLE vs Lyrics Studio drop-in targets.
9. Polish on edge cases: Fix `TactileRotaryKnob` (`min === max`), `PixelCard` (`accent` dependency), `BorderTrail` (conic stop clamping for small arcs), and `ZeroBloatWaveField` (path batching & idle sleep).

VERIFICATION:
Verify all TypeScript types via `npx tsc --noEmit` in `D:\espprojects\oled\web` and run existing test suite (`npm test`).
Save the hardened master blueprint to:
`D:\espprojects\oled\.agents\teamwork\worker_2\DESIGN_BLUEPRINT.md`
and also update `D:\espprojects\oled\.agents\teamwork\worker_1\DESIGN_BLUEPRINT.md`.
Write your completion handoff report to `D:\espprojects\oled\.agents\teamwork\worker_2\handoff.md`.
Send a message to parent when finished.
