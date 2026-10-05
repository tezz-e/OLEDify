# Project: OLED Visual Studio — Unified Hardware-Fluid Design Language

## Architecture & Design Philosophy
Merges **Apple/Vercel Liquid Glass Fluidity** (frosted acrylic diffusion, sub-surface specular reflections, SVG mercury-gooey thresholding, and continuous spring curves) with **Teenage Engineering / Nothing Tech Precision Hardware Aesthetics** (true OLED pitch black #000000, 1px anodized hairlines, monospaced dot-matrix typography, laser phosphor green #00FF66 and signal amber #FF5500 indicators, mechanical detent rotary dials, and milled tactile textures).

### Mathematical & Interaction Foundations
1. **Skiper UI Liquid Gooey Thresholding**:
   - Filter: `<feGaussianBlur stdDeviation="8" />` + `<feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9" />`
   - Alpha mapping: $\alpha_{\text{out}} = 19 \alpha_{\text{in}} - 9$, creating fluid mercury bridges when elements approach within 16px.
2. **21st.dev Spring Dock Magnification**:
   - Cosine-squared bell curve kernel: $s(d) = 1 + (M - 1) \cos^2\left(\frac{\pi d}{2 R}\right)$ for $|d| \le R$, zero outside.
   - Spring physics: `{ mass: 0.1, stiffness: 220, damping: 14 }`.
3. **React Bits Magnetic Pull & Spotlight Hairlines**:
   - Magnetic vector pull with quadratic attenuation: $\Delta \vec{p} = (\vec{x}_{\text{mouse}} - \vec{x}_{\text{center}}) \cdot \max\left(0, 1 - \frac{d^2}{R^2}\right) \cdot S$.
   - Spotlight border using `mask-composite: exclude` with radial-gradient following cursor coordinates.
4. **Lenis Frame-Independent Inertia Scrubbing**:
   - Exponential decay: $x(t + \Delta t) = \text{lerp}(x(t), x^*, 1 - e^{-\lambda \Delta t})$ with $\lambda = 24.0\text{ s}^{-1}$.
5. **GSAP Precision Master-Slave & Audio PLL**:
   - Deterministic audio clock slave lock: Web Audio DAC crystal clock as master, GSAP timeline with `lagSmoothing(0)` as slave.
   - Sub-frame timecode math: Millisecond `00:02.150` and SMPTE `00:00:02:04.50` at 30 FPS / 60 FPS.
6. **Vanta Zero-Bloat Canvas/Shader Dynamics**:
   - Pure 2D Canvas (1.4KB) & Micro-WebGL fragment shader (2.0KB) dot-matrix wave dynamics reacting to cursor and Web Audio telemetry (`bass` + `rms`) without bundling 600KB Three.js.
7. **HeroUI / Shadcn UI Acrylic Glass & Tactile Hardware Tokens**:
   - 4-layer acrylic glass: base tint `rgba(12, 12, 14, 0.72)` + `backdrop-filter: blur(24px) saturate(190%) contrast(108%)` + 1px specular white hairline highlight + bottom ambient drop shadow.
   - Dual theme architecture: "Optic Hardware / Nothing Dark" vs "Matte Ceramic / OP-1 Field".

---

## Feature Inventory
| # | Feature / Component | Description | Milestone | Source Library |
|---|---------------------|-------------|-----------|----------------|
| 1 | Dual-Mode Token Contract & CSS Variables | Optic Hardware Dark (#000000, #00FF66, #FF5500) and Matte Ceramic Light (#F6F6F4, anodized black) CSS tokens + Tailwind theme extension | M1 | HeroUI, Nothing Tech, Teenage Engineering |
| 2 | Global Studio Navigation | Liquid gooey mercury tab switcher (NLE Timeline vs Kinetic Lyrics Studio) with SVG feGaussianBlur/feColorMatrix filter and layoutId pill | M2 | Skiper UI, 21st.dev |
| 3 | Floating Island Transport Dock | Frosted acrylic container, tactile play/pause button, NumberFlow rolling timecode counter (00:02.150), scrub handle, live WebSerial HUD | M2 | HeroUI, 21st.dev, Apple Island |
| 4 | Timeline & Waveform Scrubber | Monospaced dot-matrix ruler, beat tick pulses, Lenis smooth inertia scrub mechanics, and GSAP sub-frame playhead | M2 | Lenis, GSAP, Nothing Tech |
| 5 | Kinetic Typography Controls | Modular synth patch block cards with cursor-following radial spotlight borders, decrypter scramble text, and patch cord connectors | M2 | React Bits, Teenage Engineering |
| 6 | Hardware Telemetry HUD | Nothing Tech-inspired dot matrix status indicators (COM12, 921600 baud, 30 FPS, SH1106) with micro-oscilloscope canvas | M2 | Nothing Tech, HeroUI, Shadcn |
| 7 | Tactile Rotary Knob (`TactileRotaryKnob`) | 270° rotary encoder dial with radial SVG gauge, dual drag modes, Shift fine-tuning, and mechanical angular detents | M3 | Teenage Engineering OP-1, Shadcn |
| 8 | Industrial Toggle Switch (`HardwareToggleSwitch`) | 3-position heavy metal bat lever (UP / OFF / DOWN) with spring snap physics and tactile haptic click | M3 | Teenage Engineering, HeroUI |
| 9 | Perimeter Border Trail (`BorderTrail`) | Smooth animated luminous beam running along card perimeter using pure CSS/Framer Motion | M3 | React Bits, 21st.dev |
| 10 | Dot-Matrix Pixel Canvas (`PixelCard`) | Interactive monochrome LED dot matrix card with cursor proximity illumination and phosphor decay ($\tau = 350\text{ms}$) | M3 | React Bits, Nothing Tech |
| 11 | Procedural Ambient Wave Canvas (`ZeroBloatWaveField`) | Pure 2D Canvas ambient dot/halo waves reacting to cursor and Web Audio bass/rms (<1.5KB, 0% CPU idle) | M3 | Vanta (re-engineered), Three.js zero-bloat |
| 12 | Procedural Haptic Audio Generator (`hapticAudio.ts`) | Zero-asset Web Audio API micro-synthesizer generating 2ms tactile clicks, mechanical detents, and relay snaps | M3 | Teenage Engineering, Web Audio |
| 13 | Design Blueprint Catalog Artifact | Master standalone Markdown / TypeScript catalog artifact detailing all tokens, mechanics, and copy-paste ready recipes | M4 | Synthesis & Validation |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Tokenized Palette & Theme Architecture | Tailwind config extension object, `:root` and `.dark` CSS variables, acrylic glass utility classes | none | DONE |
| M2 | Core OLED Studio Component Recipes | Drop-in code recipes for the 5 baseline studio components (Navigation, Transport Dock, Timeline Scrubber, Kinetic Typography Patch Cards, Hardware Telemetry HUD) | M1 | DONE |
| M3 | Extended Creative Gems & Micro-Interactions | Drop-in code recipes for the 6 creative gems (Rotary Knob, Bat Toggle Switch, Border Trail, PixelCard, Zero-Bloat WaveField, Haptic Audio Synthesizer) | M1 | DONE |
| M4 | Comprehensive Blueprint Catalog Artifact & Verification | Production of the master design blueprint artifact in the conversation artifacts directory and rigorous verification | M2, M3 | DONE |

---

## Code Layout & Drop-In Targets in `D:\espprojects\oled\web`
- Design Tokens & Config:
  - `D:\espprojects\oled\web\tailwind.config.js` — Theme extension with colors, fonts, shadows, and animations.
  - `D:\espprojects\oled\web\src\index.css` — `:root` and `.dark` CSS variables, SVG filter definitions, noise textures.
- Core Mapped Components:
  - Global Navigation: `D:\espprojects\oled\web\src\components\navigation\LiquidStudioNav.tsx` (drops into `Header.tsx:68-99`)
  - Transport Dock: `D:\espprojects\oled\web\src\components\transport\FloatingTransportDock.tsx` (unifies `PlaybackBar.tsx` & `LyricsStudioView.tsx:2700-2886`)
  - Timeline Scrubber: `D:\espprojects\oled\web\src\components\timeline\InertiaTimelineScrubber.tsx` (drops into `TimelineTrack.tsx` / `ClipBlock.tsx`)
  - Kinetic Typography: `D:\espprojects\oled\web\src\components\kinetic\ModularSynthPatchCard.tsx` (drops into `LyricsStudioView.tsx:3140-4250`)
  - Telemetry HUD: `D:\espprojects\oled\web\src\components\hardware\HardwareTelemetryHUD.tsx` (drops into `App.tsx:910-956`)
- Extended Creative Gems:
  - `D:\espprojects\oled\web\src\components\hardware\TactileRotaryKnob.tsx`
  - `D:\espprojects\oled\web\src\components\hardware\HardwareToggleSwitch.tsx`
  - `D:\espprojects\oled\web\src\components\hardware\PixelCard.tsx`
  - `D:\espprojects\oled\web\src\components\hardware\BorderTrail.tsx`
  - `D:\espprojects\oled\web\src\components\ambient\ZeroBloatWaveField.tsx`
  - `D:\espprojects\oled\web\src\lib\hapticAudio.ts`
