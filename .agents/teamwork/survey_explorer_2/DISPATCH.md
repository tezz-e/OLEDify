## 2026-10-04T07:08:33Z
You are Survey Explorer 2 (Library Researcher B: GSAP, Vanta, Shadcn UI, HeroUI).
Your working directory is: `D:\espprojects\oled\.agents\teamwork\survey_explorer_2`.
You MUST read `D:\espprojects\oled\.agents\teamwork\ORIGINAL_REQUEST.md` before starting your work.

CRITICAL DIRECTIVE:
Do NOT inspect, touch, or read from `C:\Users\manee\Desktop\oled`. That is an outdated folder.
The active OLED Studio project codebase is strictly located at:
`D:\espprojects\oled` and `D:\espprojects\oled\web`.

MISSION:
Deeply research and extract interaction mechanics, formulas, and code patterns from target libraries:
5. GSAP (https://github.com/greensock/gsap):
   - Precision multi-track timeline tweening, scrub-synchronized playhead mechanics.
   - Frame-accurate easing curves (custom cubic beziers vs linear scrub), sub-frame timecode calculation (e.g. 00:02.150 at 30 FPS / 60 FPS).
   - Synchronization patterns between audio clock / Web Audio API and visual timeline tracks.
6. Vanta (https://github.com/tengbao/vanta):
   - Ambient background field dynamics (subtle ambient dot/halo waves reacting to audio or cursor).
   - ZERO-BLOAT IMPLEMENTATION: How to implement this in pure HTML5 2D Canvas or micro-WebGL shader (<3KB) WITHOUT bundling Three.js (which is ~600KB). Provide the complete procedural dot wave algorithm (perlin/simplex math or sinusoidal wave synthesis reacting to cursor and audio amplitude).
7. Shadcn UI (https://github.com/shadcn-ui/ui):
   - Radix-based accessible primitives: Sliders, Popovers, Tooltip overlays, Keyboard shortcuts.
   - How to adapt Radix primitives with Teenage Engineering / Nothing Tech hardware styling (sharp edges, monospaced numeric readouts, micro-borders, tactile thumb grips).
8. HeroUI / NextUI (https://github.com/heroui-inc/heroui):
   - Acrylic backdrop blur formulations: multi-layer backdrop-filter formulas, light transmission ratios, specular reflection highlights (1px white/opacity hairline borders).
   - Compound styling variants (cva / tailwind-variants pattern for hardware states).
   - Cohesive light/dark token architecture for high-contrast precision hardware.

DELIVERABLE:
Write a comprehensive, rigorous extraction report in `D:\espprojects\oled\.agents\teamwork\survey_explorer_2\handoff.md`. Include mathematical formulas, zero-bloat Canvas 2D / shader code, Radix component styling patterns, and exact CSS/Tailwind classes. Update your progress.md while working. When finished, send a message to parent with summary and artifact path.


## 2026-10-04T07:12:42Z
**Context**: User Creative Directive for UI Library Research
**Content**: The user explicitly emphasized: "do note when im giving the link to a website im not telling u just visit that particular link, look around the entire website what they have to offer, and dont be narrow minded there, be creative and see what cool stuff can u pick up from each and try to incorporate it".
Please ensure you broaden your exploration across GSAP, Vanta, Shadcn UI, and HeroUI:
- Look for additional creative gems: tactile rotary/slider knobs, hardware toggle switches, accordions, HUD popovers, precision scrub physics, and micro-interactions.
- Include a dedicated section in your handoff report: "✨ Extended Creative Gems & Micro-Interactions" highlighting these cool patterns and how they enhance OLED Visual Studio.
**Action**: Incorporate these gems into your findings in handoff.md without getting stuck in infinite loops.
