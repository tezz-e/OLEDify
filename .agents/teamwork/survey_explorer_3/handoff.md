# OLED Visual Studio — Codebase Architecture & Design Integration Handoff Report

**Agent**: Survey Explorer 3 (Codebase Researcher)  
**Target Codebase**: `D:\espprojects\oled\web`  
**Date**: 2026-10-04  
**Integrity Mode**: Development / Read-Only Investigation  

---

## 1. Observation

All observations were directly gathered by inspecting files located exclusively within `D:\espprojects\oled\web`.

### 1.1 Dependency & Toolchain Manifest (`package.json`)
From `D:\espprojects\oled\web\package.json`:
- **Core Framework**: React `18.3.1`, React DOM `18.3.1`, TypeScript `5.5.3`.
- **Bundler & Build**: Vite `^5.4.3`, `@vitejs/plugin-react` `^4.3.1`, `@types/node` `^20.16.5`.
- **CSS & Utilities**:
  - `tailwindcss` `^3.4.17`, `postcss` `^8.4.47`, `autoprefixer` `^10.4.20`.
  - `clsx` `^2.1.1`, `tailwind-merge` `^3.7.0` (active helper `cn()` in `src/lib/utils.ts:4-6`).
- **Animation & Motion Runtimes (Already Installed)**:
  - `framer-motion` `^13.4.0` AND `motion` `^13.4.0` (both installed and utilized in `src/components/reactbits` and `src/components/studio/lyrics/LyricsStudioView.tsx`).
  - `gsap` `^3.15.0` (installed and available for timeline interpolation / precision tweening).
- **Iconography**: `lucide-react` `^0.475.0` (installed and used globally).
- **Graphics & 3D**: `three` `^0.186.0`, `ogl` `^1.0.11` (installed and split into `graphics-3d` rollup manual chunk).
- **Drag & Drop**: `@dnd-kit/core` `^6.3.1`, `@dnd-kit/sortable` `^10.0.0`, `@dnd-kit/utilities` `^3.2.2`.
- **Hardware & Media**:
  - `esptool-js` `^0.6.1`, `@types/w3c-web-serial` `^1.0.8`.
  - `mp4box` `^2.4.1`, `omggif` `^1.0.10`, `puppeteer-core` `^25.12.0`.
- **Shadcn/UI Schema (`components.json`)**:
  - Aliases configured: `components: "@/components"`, `utils: "@/lib/utils"`, `ui: "@/components/ui"`, `lib: "@/lib"`, `hooks: "@/hooks"`.
  - Registry added: `@react-bits` at `https://reactbits.dev/r/{name}.json`.

### 1.2 Configuration Layer (`tailwind.config.js` & `vite.config.ts`)
- **`tailwind.config.js` (`D:\espprojects\oled\web\tailwind.config.js`)**:
  - `content`: `["./index.html", "./src/**/*.{js,ts,jsx,tsx}"]`.
  - Existing colors:
    - Warm palette: `parchment: '#F5F0EB'`, `cream: '#FAF9F5'`, `oatmeal: '#F0ECE1'`, `bone: '#E8E5DE'`.
    - Ink / dark tones: `ink: '#1A1A1A'`, `ink-light: '#6B6B6B'`, `obsidian: '#141413'`, `charcoal: '#1F1E1D'`, `stone: '#5E5D59'`.
    - Accent: `accent: '#D97757'`, `accent-dark: '#C96442'`, `terracotta: '#D97757'`, `terracotta-dark: '#C96442'`.
    - Studio panel tokens: `studio.dark: '#141413'`, `studio.card: '#18181C'`, `studio.panel: '#1E1E20'`, `studio.elevated: '#232228'`, `studio.subtle: '#2C2B29'`.
  - Fonts:
    - `serif`: `['"DM Serif Display"', 'Georgia', 'serif']`
    - `sans`: `['"Plus Jakarta Sans"', 'system-ui', 'sans-serif']`
    - `mono`: `['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']`
    - `display`: `['"DM Serif Display"', 'Georgia', 'serif']`
  - Keyframes: `fadeIn` (opacity 0 -> 1), `slideUp` (translateY 4px -> 0).
  - Plugins: `[]` (Empty — no `@tailwindcss/forms` or custom typography plugins).
  - **Gap**: There are NO CSS custom property mappings (`hsl(var(--background))`, etc.) and no token contracts for "Optic Hardware / Nothing Dark" (#000000 / #080808 / signal amber #FF5500 / laser phosphor #00FF66) or "Matte Ceramic / OP-1 Field" (#F6F6F4 / anodized black borders).
- **`vite.config.ts` (`D:\espprojects\oled\web\vite.config.ts`)**:
  - Path alias: `@` resolves to `./src`.
  - Plugins: `react()`, `esp32FlashPlugin()` (custom SSE plugin on `/api/flash` invoking Python PlatformIO flasher).
  - Dev server: Port 5173, reverse proxy `/ollama-proxy` -> `http://127.0.0.1:11434`.
  - Manual chunks: `esptool`, `dicebear`, `graphics-3d` (`three`, `ogl`), `motion` (`motion`, `framer-motion`).

### 1.3 Entry Points & Global Styling (`src/main.tsx`, `index.html`, `src/index.css`)
- **`index.html` (`D:\espprojects\oled\web\index.html`)**:
  - Google Fonts preloaded: `Caveat`, `Courier Prime`, `DM Serif Display`, `IBM Plex Mono`, `Playfair Display`, `Plus Jakarta Sans`, `Poppins`.
  - Title: `OLEDify Studio`.
  - Body class: `bg-[#05070a] text-slate-100 antialiased min-h-screen selection:bg-cyan-500 selection:text-black`.
- **`src/index.css` (`D:\espprojects\oled\web\src\index.css`)**:
  - Imported Google Fonts: `IBM Plex Mono` (400, 500, 600, 700), `Space Grotesk` (500, 600, 700).
  - 15 `@font-face` definitions mapped to `/fonts/*.ttf|otf`: `Wilhelm Gotisch`, `Molot`, `Helvetica Compressed`, `Vendetta`, `Luckiest Guy`, `Bubblegum`, `Bangers`, `Kraash Black`, `Lemon Milk`, `Cinzel Decorative`, `Wicked Mouse`, `Supersonic Rocketship`, `Dinosaur`, `Super Comic`, `Plumpfull`.
  - `@layer base`: Hardcoded body background `#F5F0EB` with 40px linear repeating grid lines in `#e0dbd5`.
  - Technical UI helper classes: `.tech-panel` (border 2px #1A1A1A), `.tech-btn` (IBM Plex Mono uppercase), `.accent-btn` (#E85D2A), `.font-display` (Space Grotesk).
  - Range sliders: Custom webkit-slider track (2px #1A1A1A) and square thumb (#E85D2A).
  - **Gap**: Zero CSS variables (`:root` / `.dark`) are declared in `index.css`.
- **`src/styles/oled.css` (`D:\espprojects\oled\web\src\styles\oled.css`)**:
  - Defines `.oled-bezel` (#080808), `.oled-screen` (#020304), and phosphor bloom drop-shadow classes: `.glow-cyan`, `.glow-white`, `.glow-amber`, `.glow-green`, `.glow-yellow-blue`.

### 1.4 Component Architecture & State Management (`src/App.tsx`)
From `D:\espprojects\oled\web\src\App.tsx`:
- **Root State Variables**:
  - `activeView`: `'editor' | 'lyrics-studio'` (initialized from URL `?view=lyrics-studio` or default `'editor'`).
  - `themeMode`: `'light' | 'dark'` (persisted in `localStorage.getItem('oled_studio_theme')`, defaults to `'dark'`).
  - `assets`: `Record<string, MediaAsset>` (imported video / GIF / sequence frames).
  - `clips`: `TimelineClip[]` (ordered sequence of clips with `inFrame`, `outFrame`, `assetId`).
  - `clipHistory`: 50-step undo/redo stack managed via `setClipsWithHistory`, `handleUndo`, `handleRedo`.
  - `activeFrameIndex`: Current playhead frame (0 to total frames - 1).
  - `isPlaying`: boolean playback toggle at `targetFps` (15, 24, or 30 FPS via requestAnimationFrame accumulator tick, lines 570-597).
  - `ditherConfig`: `DitherConfig` (`algorithm`: 'atkinson' | 'floyd-steinberg' | 'bayer-4' | 'bayer-8' | 'threshold', `brightness`, `contrast`, `threshold`, `invert`, `theme`: 'cyan' | 'white' | 'amber' | 'green' | 'yellow-blue').
  - `cropSettings`: `CropSettings` (`mode`: 'cover' | 'contain' | 'stretch' | 'manual', `x, y, width, height`, `smoothing`).
  - `hardwareConfig`: `HardwareConfig` (`mcu`: 'esp32-s3' | 'esp32' | 'esp32-c3' | 'arduino-uno' | 'pi-pico', `display`: 'sh1106' | 'ssd1306' | 'ssd1315', `sdaPin`: 8, `sclPin`: 9, `i2cAddress`: '0x3C').
  - `serialConnected`: boolean, `baudRate`: number (921600 Turbo vs 115200 Standard).
  - `mediaPoolTab`: `'import' | 'samples' | 'recent' | 'create'`.
- **Top Layout Structure**:
  - `Header`: lines 732-747.
  - 3-Column Preview Workspace (lines 751-956):
    - Col 1: Full Preview (572:367 stable container with pixelated canvas, play/pause, timecode, scrub bar, FIT/FILL toggle).
    - Col 2: True OLED Preview (128x64 physical bezel simulation with corner screws, SSD1306 label, `OledCanvas` at 8x scale).
    - Col 3: Display Info (128x64, 1-bit, I2C 0x3C, FPS, frame counter, byte size).
- **Bottom Console Structure**:
  - Height: 340px (`h-[340px]` flex container wrapped in `BlueprintHoverCard` tilt wrappers).
  - Zone 1: Media Pool (Import drag & drop, 22 sample animations, Recent, Create button).
  - Zone 2: Timeline & Trimming (`TimelineTrack` + `PlaybackBar`).
  - Zone 3: Inspector (`DitherControls` + `CropControls`).
- **Modals & Lazy Views**:
  - `SettingsModal`: MCU, display driver, I2C pins, GPU telemetry.
  - `ExportModal`: C++ header generator (`frames.h`), raw XBMP download, and WebSerial direct flasher.
  - `CharacterStudioModal`: Generates Dicebear mono avatar animations.
  - `LyricsStudioView`: Fullscreen kinetic typography editor (`activeView === 'lyrics-studio'`).

### 1.5 Deep Inspection of Key Modules

#### A. Global Navigation & View Switcher (`Header.tsx` & `LyricsStudioView.tsx`)
- **Location**: `src/components/Header.tsx:68-99`.
- **Current Props**: `activeView?: 'editor' | 'lyrics-studio'`, `onViewChange?: (view: 'editor' | 'lyrics-studio') => void`, `themeMode?: 'light' | 'dark'`, `onThemeToggle?: () => void`.
- **Implementation**:
  - Two buttons inside a bordered container (`NLE TIMELINE` and `KINETIC LYRICS STUDIO`).
  - Active button changes background to `#00F0FF` (dark) or `#1A1A1A` (light) with flat neobrutalist offset shadow (`shadow-[2px_2px_0_#FF2A85]`).
  - In `LyricsStudioView.tsx:1823-1862`: Header bar has a back button (`ArrowLeft`) to return to Timeline, a `ThemeSwitch` pill, and an indicator badge `128×64 • 1-Bit • 30 FPS`.

#### B. Transport Controls / Dock (`PlaybackBar.tsx` & `LyricsStudioView.tsx`)
- **NLE Timeline Transport (`src/components/PlaybackBar.tsx`)**:
  - Props: `isPlaying: boolean`, `onTogglePlay: () => void`, `currentFrame: number`, `totalFrames: number`, `targetFps: number`, `onFpsChange`, `onFrameSeek`, `onReset`, `themeMode`.
  - Elements: Range slider scrub bar, `RotateCcw` reset button, `SkipBack` frame step, Play/Pause toggle using `GlassButton`, `SkipForward`, tabular timecode `001/120`, and FPS select dropdown (15, 24, 30 FPS).
- **Kinetic Lyrics Transport Capsule (`LyricsStudioView.tsx:2700-2886`)**:
  - Framer Motion `motion.div layout` floating island capsule.
  - Tactile circular play/pause button with spring physics (`stiffness: 400, damping: 20`).
  - Rolling timecode display using `NumberFlow` (`00:00.00s / 00:00.00s`).
  - Selection vs Full Song scope switcher.
  - Live beat pulse badge (`isLiveBeat` pulsating in real-time to drum transients).
  - Waveform canvas scrub bar with zoom multiplier (1x to 6x).

#### C. Timeline & Waveform Scrubber (`TimelineTrack.tsx` & `ClipBlock.tsx`)
- **Location**: `src/components/TimelineTrack.tsx:42-547`.
- **Architecture**:
  - Horizontal track scrolling with middle-mouse click drag panning and wheel scroll.
  - Zoom levels: `0.05x` to `4.0x` (`THUMB_BASE = 16px` base frame width, Ctrl+Wheel zoom).
  - Ruler area (`rulerTicks` mapped every 10 or 30 frames with pixel ticks and playhead triangle).
  - Playhead needle with neon glow (`#E2FF00` in dark mode, `#E85D2A` in light mode).
  - Dnd-kit sortable clips: Reorder clips horizontally.
  - Marquee selection: Click and drag on empty track selects clips intersecting bounding box.
  - Context menu (`ContextMenu.tsx`): Split clip, duplicate, delete, ripple delete.
  - `ClipBlock.tsx`: Multi-thumbnail filmstrip generation cached in memory, ghost trim regions with diagonal striped warning patterns, left/right trim handles with hover expand.

#### D. Kinetic Typography Controls (`LyricsStudioView.tsx`)
- **Location**: `src/components/studio/lyrics/LyricsStudioView.tsx` (4,333 lines).
- **Architecture**:
  - 3-Column Studio:
    - Col 1 (Ingest): Search (LRCLIB API), Paste Text (supports timestamped LRC and plain text with Ballad/Pop/Rap pacing auto-timestamps), Audio Sync (decodes AudioBuffer, detects 808/kick transients and BPM).
    - Col 2 (Lyrics Timeline): Apple Music fluid glass stanzas using `GlassSurface` and SVG progressive blur masks, line selection, range expansion (+1/-1), word token breakdown.
    - Col 3 (Motion & Display):
      - 128x64 OLED monitor with corner L-brackets.
      - Segmented bar: `Auto Rules` (heuristic mood pacer), `AI Director` (Groq Cloud 120B / Ollama GPU), `Single Style` (uniform archetype).
      - 15 Motion Archetypes: `gentle_float`, `waveform_karaoke`, `typewriter_ribbon`, `dither_dissolve`, `blade_slash`, `manga_impact`, `rolling_odometer`, `3d_block_stack`, `snake_slither`, `cyber_glitch`, `echo_stack`, `target_focus`, `smooth_fluid`, `inverted_badge`, `wiggly_boil`.
      - 5 Style Packs: `trap_drill`, `anime_cyber`, `lofi_minimal`, `retro_punk`, `bubblegum_pop`.
      - Live WebM sequence recorder (`exportFramesToWebM`).
    - Word Customizer Modal (lines 3910-4250): Per-word override for motion style, font face, visual motif (sparkles, box, outline, invert), and word badges.

#### E. Hardware Telemetry HUD
- **Location**: `Header.tsx`, `SettingsModal.tsx`, `src/engine/webSerialStreamer.ts`, `src/engine/gpuDetector.ts`.
- **WebSerial Streamer (`webSerialStreamer.ts`)**:
  - Baud rates: 115200 (standard) and 921600 (Turbo 30 FPS).
  - Packet protocol: 2-byte header (`0xAA 0xBB`) + 1024 raw XBMP bytes (1026 bytes total per frame).
  - Non-blocking queue prevents stream lock collision during fast slider movement.
  - Auto-disconnect event listener on `navigator.serial`.
- **Hardware Targets (`types/oled.ts` & `SettingsModal.tsx`)**:
  - Microcontrollers: ESP32-S3, ESP32, ESP32-C3, Arduino Uno, Raspberry Pi Pico.
  - Display ICs: SH1106 (132x64 with 2-pixel column offset), SSD1306 (128x64 standard), SSD1315.
  - Default Pins: SDA = GPIO 8, SCL = GPIO 9, I2C Address = `0x3C`.
- **GPU Telemetry (`gpuDetector.ts`)**:
  - Queries WebGL `UNMASKED_RENDERER_WEBGL`.
  - Detects dedicated GPU (NVIDIA/AMD) vs integrated (Intel/Apple), and displays status chip in Header.

---

## 2. Logic Chain

1. **Premise**: The user requests a unified, hyper-cohesive design language merging Apple/Vercel liquid glass fluidity with Teenage Engineering / Nothing Tech precision hardware aesthetics across 8 UI libraries (React Bits, 21st.dev, Lenis, Skiper UI, GSAP, Vanta, Shadcn UI, HeroUI).
2. **Current State Assessment**:
   - `package.json` already contains `framer-motion` (v13.4.0), `motion` (v13.4.0), `gsap` (v3.15.0), `three` (v0.186.0), `lucide-react`, `@dnd-kit`, `clsx`, and `tailwind-merge`. Zero extra heavy packages need to be installed.
   - However, styling is fragmented across hardcoded hex values in `tailwind.config.js` (`#141413`, `#E85D2A`, `#D97757`), inline color definitions in `App.tsx` (`#100D1C`, `#00F0FF`, `#FF2A85`), and light-mode styles in `index.css` (`#F5F0EB`, `#1A1A1A`).
   - The app has two active modes (`themeMode === 'dark'` and `'light'`), but they are currently switched via ternary class strings (e.g. `isDark ? 'bg-[#120E1F]' : 'bg-white'`) rather than centralized Tailwind CSS variables.
3. **Integration Point Identification**:
   - **Token Level**: Define a clean `:root` (Light: Matte Ceramic / OP-1 Field) and `.dark` (Dark: Optic Hardware / Nothing Dark) CSS variable foundation in `src/index.css`, mapped into `tailwind.config.js` via semantic tokens (`bg-studio-canvas`, `border-hairline`, `text-signal-amber`, etc.).
   - **Global Studio Navigation**: `Header.tsx:68-99` is the exact drop-in point for the Skiper UI liquid gooey mercury tab switcher (using the existing `<filter id="gooey">` defined in `src/components/ui/loaders-gooey-blobs.tsx` or an enhanced SVG gooey matrix).
   - **Transport Dock**: `PlaybackBar.tsx` (in Timeline view) and the floating capsule in `LyricsStudioView.tsx:2700-2886` can be consolidated into a unified Floating Island Transport Dock component utilizing frosted acrylic glass (`backdrop-blur-md`, subtle specular border), rolling timecodes, and direct WebSerial telemetry indicators.
   - **Timeline & Waveform Scrubber**: `TimelineTrack.tsx:391-425` ruler and scrub mechanics can drop in Lenis-style smooth inertia dampening and Nothing Tech dot-matrix tick marks without altering clip data contracts.
   - **Kinetic Typography Blocks**: `LyricsStudioView.tsx` word stanzas and Word Customizer cards are the exact drop-in points for React Bits `SpotlightCard` / modular synth patch blocks with cursor-following radial spotlight borders.
   - **Hardware Telemetry HUD**: `App.tsx` Column 3 (Display Info) and `Header.tsx` right cluster are the exact drop-in points for Nothing Tech dot-matrix HUD indicators (COM12, 921600 baud, 30 FPS, SH1106 / SSD1306).
4. **Font Assets Analysis**:
   - Google Fonts in `index.html` load `IBM Plex Mono`, `Space Grotesk`, `Plus Jakarta Sans`, etc.
   - For Teenage Engineering / Nothing Tech hardware precision, monospaced fonts (`JetBrains Mono` or `Geist Mono`) and an authentic dot-matrix font (such as `Silkscreen` or `DotGothic16`) should be imported in `index.html` or `index.css`.

---

## 3. Caveats

1. **Strict Read-Only Investigation**: In accordance with the Explorer archetype and mission directives, no source code files or project configurations were modified. All proposals are presented as drop-in architectural recipes.
2. **WebSerial Browser Support**: WebSerial is supported natively in Chromium-based browsers (Google Chrome, Microsoft Edge, Opera). On unsupported browsers (Firefox, Safari), `navigator.serial` is undefined; the UI gracefully falls back and displays warning tooltips as implemented in `webSerialStreamer.ts`.
3. **Hardware Flasher Integration**: `vite.config.ts` includes `esp32FlashPlugin()` which depends on Python and PlatformIO penv at `~/.platformio/penv/Scripts/python.exe`. Design tokens and UI components must not interfere with this SSE streaming route (`/api/flash`).

---

## 4. Conclusion & Architecture Blueprint

### 4.1 UI Architecture Summary Table

| UI Domain | Existing File Path | Current State / Props | Recommended Design System Drop-In |
|---|---|---|---|
| **Theme & Tokens** | `tailwind.config.js`<br>`src/index.css` | Hardcoded hex colors (`#141413`, `#E85D2A`, `#D97757`); no CSS variables. | Token contract: `:root` (Matte Ceramic) & `.dark` (Optic Hardware / Nothing Dark) with specular hairlines, signal amber, laser phosphor. |
| **Studio View Switcher** | `src/components/Header.tsx`<br>(Lines 68–99) | Static buttons with neobrutal offset shadows (`shadow-[2px_2px_0_#FF2A85]`). | **Skiper UI Gooey Mercury Tab Switcher**: SVG `feGaussianBlur` + `feColorMatrix` liquid pill morphing between NLE Timeline and Kinetic Lyrics Studio. |
| **Transport Dock** | `src/components/PlaybackBar.tsx`<br>`LyricsStudioView.tsx` (Lines 2700–2886) | Two separate playback bars; one flat technical, one floating capsule. | **Floating Island Transport Dock**: Frosted acrylic container (`rgba(18,18,20,0.85)` / `rgba(246,246,244,0.85)`), tactile Apple/Teenage Engineering play toggle, `NumberFlow` timecode, scrub handle, WebSerial pulse. |
| **Timeline Scrubber** | `src/components/TimelineTrack.tsx`<br>`src/components/ClipBlock.tsx` | Ruler ticks with basic divs; raw native mouse dragging. | **Precision Hardware Timeline**: Monospaced dot-matrix ruler, beat tick pulses, Lenis-inspired smooth inertia scrub dampening, specular active clip borders. |
| **Kinetic Typography Controls** | `src/components/studio/lyrics/LyricsStudioView.tsx`<br>(Lines 3140–4250) | Heuristic/AI segmented tabs; modal with standard grid cards. | **Modular Synth Patch Blocks**: React Bits `SpotlightCard` cursor-following radial borders, 21st.dev spring docks, tactile segmented sliders. |
| **Hardware Telemetry HUD** | `src/App.tsx` (Col 3)<br>`src/components/Header.tsx` | Standard text labels in small boxed panel. | **Nothing Tech Dot Matrix Telemetry HUD**: Dot matrix LED display (COM port, 921600 baud, 30 FPS, SH1106), animated status beacon, specular micro-badges. |

---

### 4.2 Exact Token Contract & Theme Configuration

#### A. Proposed `src/index.css` CSS Variables (`:root` & `.dark`)
```css
@layer base {
  :root {
    /* Mode: Matte Ceramic / OP-1 Field (Light) */
    --background: 40 10% 96%;           /* #F6F6F4 Frosted titanium ceramic */
    --foreground: 0 0% 10%;             /* #1A1A1A Anodized dark charcoal */
    
    --card: 0 0% 100%;                  /* #FFFFFF Pure ceramic surface */
    --card-foreground: 0 0% 10%;
    
    --surface-glass: 40 10% 96% / 0.75; /* Translucent white acrylic */
    --surface-border: 0 0% 85%;         /* Razor-sharp hairline border */
    
    --primary: 15 100% 50%;             /* #FF5500 Signal Amber */
    --primary-foreground: 0 0% 100%;
    
    --accent-phosphor: 144 100% 50%;    /* #00FF66 Laser Phosphor Green */
    --accent-amber: 15 100% 50%;        /* #FF5500 */
    --specular-hairline: 0 0% 0% / 0.12;
  }

  .dark {
    /* Mode: Optic Hardware / Nothing Dark (Dark) */
    --background: 0 0% 0%;              /* #000000 True OLED Deep Black */
    --foreground: 0 0% 98%;             /* #FAF9F5 Crisp optic white */
    
    --card: 0 0% 4%;                    /* #0A0A0C Smoked glass substrate */
    --card-foreground: 0 0% 98%;
    
    --surface-glass: 240 5% 7% / 0.75;  /* rgba(18, 18, 20, 0.75) Smoked acrylic */
    --surface-border: 0 0% 100% / 0.12; /* 1px specular white hairline */
    
    --primary: 15 100% 50%;             /* #FF5500 Signal Amber */
    --primary-foreground: 0 0% 0%;
    
    --accent-phosphor: 144 100% 50%;    /* #00FF66 Laser Phosphor Green */
    --accent-amber: 15 100% 50%;        /* #FF5500 Signal Amber */
    --specular-hairline: 0 0% 100% / 0.15;
  }
}
```

#### B. Proposed `tailwind.config.js` Theme Extension
```javascript
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        oled: {
          black: '#000000',
          substrate: '#080808',
          glass: 'rgba(18, 18, 20, 0.75)',
        },
        ceramic: {
          titanium: '#F6F6F4',
          surface: '#FFFFFF',
          glass: 'rgba(255, 255, 255, 0.85)',
        },
        signal: {
          amber: '#FF5500',
          phosphor: '#00FF66',
          cyan: '#00F0FF',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"IBM Plex Mono"', 'ui-monospace', 'monospace'],
        sans: ['Geist', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        dot: ['Silkscreen', 'DotGothic16', 'monospace'],
      },
      boxShadow: {
        'specular-dark': 'inset 0 1px 1px 0 rgba(255, 255, 255, 0.15), 0 10px 30px -10px rgba(0, 0, 0, 0.8)',
        'specular-light': 'inset 0 1px 1px 0 rgba(255, 255, 255, 0.8), 0 10px 30px -10px rgba(0, 0, 0, 0.08)',
        'signal-glow': '0 0 12px rgba(255, 85, 0, 0.45)',
        'phosphor-glow': '0 0 12px rgba(0, 255, 102, 0.45)',
      },
    },
  },
  plugins: [],
};
```

---

### 4.3 Component Implementation Recipes

#### Recipe 1: Liquid Gooey Mercury Tab Switcher (Skiper UI + Framer Motion)
*Drop-in replacement for `Header.tsx:68-99`.*

```tsx
import React from 'react';
import { motion } from 'framer-motion';

interface ViewSwitcherProps {
  activeView: 'editor' | 'lyrics-studio';
  onViewChange: (view: 'editor' | 'lyrics-studio') => void;
  isDark: boolean;
}

export const StudioViewSwitcher: React.FC<ViewSwitcherProps> = ({ activeView, onViewChange, isDark }) => {
  const tabs = [
    { id: 'editor' as const, label: 'NLE TIMELINE', icon: '🎞️' },
    { id: 'lyrics-studio' as const, label: 'KINETIC LYRICS', icon: '✨' },
  ];

  return (
    <div className="relative flex items-center">
      {/* SVG Gooey Filter Definition */}
      <svg className="absolute w-0 h-0 pointer-events-none">
        <defs>
          <filter id="gooey-mercury">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -8"
              result="goo"
            />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>
        </defs>
      </svg>

      <div
        style={{ filter: 'url(#gooey-mercury)' }}
        className={`flex items-center p-1 rounded-full border backdrop-blur-md transition-colors ${
          isDark
            ? 'bg-[#080808]/90 border-white/10 shadow-specular-dark'
            : 'bg-[#F6F6F4]/90 border-black/10 shadow-specular-light'
        }`}
      >
        {tabs.map((tab) => {
          const isActive = activeView === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onViewChange(tab.id)}
              className={`relative z-10 px-4 py-1.5 text-[11px] font-mono font-bold tracking-wider rounded-full transition-colors cursor-pointer flex items-center gap-1.5 ${
                isActive
                  ? isDark ? 'text-black' : 'text-white'
                  : isDark ? 'text-white/60 hover:text-white' : 'text-black/60 hover:text-black'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="mercury-pill"
                  className={`absolute inset-0 rounded-full -z-10 ${
                    isDark ? 'bg-[#00FF66] shadow-phosphor-glow' : 'bg-[#FF5500] shadow-signal-glow'
                  }`}
                  transition={{ type: 'spring', stiffness: 450, damping: 28 }}
                />
              )}
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
```

#### Recipe 2: Floating Island Transport Dock (Apple Glass + Teenage Engineering)
*Drop-in replacement for `PlaybackBar.tsx`.*

```tsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipBack, SkipForward, RotateCcw } from 'lucide-react';
import { NumberFlow } from './studio/lyrics/NumberFlow';

interface FloatingTransportProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  currentFrame: number;
  totalFrames: number;
  targetFps: number;
  onFrameSeek: (frame: number) => void;
  onReset: () => void;
  serialConnected: boolean;
  baudRate: number;
  isDark: boolean;
}

export const FloatingTransportDock: React.FC<FloatingTransportProps> = ({
  isPlaying,
  onTogglePlay,
  currentFrame,
  totalFrames,
  targetFps,
  onFrameSeek,
  onReset,
  serialConnected,
  baudRate,
  isDark,
}) => {
  const timecodeSec = (currentFrame / targetFps).toFixed(3);
  const totalSec = (totalFrames / targetFps).toFixed(3);

  return (
    <motion.div
      layout
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-40 px-4 py-2.5 rounded-2xl border flex items-center gap-4 backdrop-blur-xl shadow-2xl transition-all ${
        isDark
          ? 'bg-[rgba(18,18,20,0.85)] border-white/15 text-white shadow-black/80'
          : 'bg-[rgba(246,246,244,0.88)] border-black/10 text-black shadow-stone-300/60'
      }`}
    >
      {/* 1. Transport Controls */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={onReset}
          className="p-2 rounded-lg hover:bg-white/10 dark:hover:bg-white/10 transition-colors cursor-pointer"
          title="Return to start"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onFrameSeek(Math.max(0, currentFrame - 1))}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          title="Previous frame"
        >
          <SkipBack className="w-3.5 h-3.5" />
        </button>

        {/* Circular Teenage Engineering / Apple Tactile Play Button */}
        <motion.button
          onClick={onTogglePlay}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          transition={{ type: 'spring', stiffness: 400, damping: 22 }}
          className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer shadow-lg transition-colors ${
            isPlaying
              ? isDark ? 'bg-[#00FF66] text-black shadow-phosphor-glow' : 'bg-[#FF5500] text-white shadow-signal-glow'
              : isDark ? 'bg-white text-black hover:bg-[#00FF66]' : 'bg-black text-white hover:bg-[#FF5500]'
          }`}
        >
          <AnimatePresence mode="wait" initial={false}>
            {isPlaying ? (
              <motion.span key="pause" initial={{ scale: 0.6 }} animate={{ scale: 1 }} exit={{ scale: 0.6 }}>
                <Pause className="w-4 h-4 fill-current" />
              </motion.span>
            ) : (
              <motion.span key="play" initial={{ scale: 0.6 }} animate={{ scale: 1 }} exit={{ scale: 0.6 }} className="ml-0.5">
                <Play className="w-4 h-4 fill-current" />
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>

        <button
          onClick={() => onFrameSeek(Math.min(totalFrames - 1, currentFrame + 1))}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          title="Next frame"
        >
          <SkipForward className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 2. Precision Monospace Timecode */}
      <div className="flex items-center gap-1.5 font-mono text-xs font-bold tabular-nums px-2 border-x border-current/10">
        <NumberFlow value={timecodeSec + 's'} className={isDark ? 'text-[#00FF66]' : 'text-[#FF5500]'} />
        <span className="opacity-30">/</span>
        <span className="opacity-60">{totalSec}s</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded border border-current/15 ml-1 opacity-70">
          {targetFps} FPS
        </span>
      </div>

      {/* 3. Scrub Track */}
      <div className="w-48 flex items-center">
        <input
          type="range"
          min={0}
          max={Math.max(0, totalFrames - 1)}
          value={currentFrame}
          onChange={(e) => onFrameSeek(parseInt(e.target.value))}
          className="w-full cursor-pointer h-1.5 appearance-none bg-current/20 rounded-full"
          style={{ accentColor: isDark ? '#00FF66' : '#FF5500' }}
        />
      </div>

      {/* 4. Live Hardware Status HUD Pill */}
      <div className="flex items-center gap-2 font-mono text-[10px]">
        <span
          className={`w-2 h-2 rounded-full ${
            serialConnected ? 'bg-[#00FF66] shadow-phosphor-glow animate-pulse' : 'bg-zinc-500'
          }`}
        />
        <span className="opacity-80">
          {serialConnected ? `USB LIVE • ${baudRate}B` : 'OLED SIMULATOR'}
        </span>
      </div>
    </motion.div>
  );
};
```

#### Recipe 3: Nothing Tech Dot Matrix Telemetry HUD
*Drop-in replacement for Display Info in `App.tsx:910-956`.*

```tsx
import React from 'react';

interface TelemetryHUDProps {
  mcu: string;
  displayDriver: string;
  baudRate: number;
  fps: number;
  currentFrame: number;
  totalFrames: number;
  isConnected: boolean;
  isDark: boolean;
}

export const HardwareTelemetryHUD: React.FC<TelemetryHUDProps> = ({
  mcu,
  displayDriver,
  baudRate,
  fps,
  currentFrame,
  totalFrames,
  isConnected,
  isDark,
}) => {
  return (
    <div
      className={`p-3 rounded-xl border font-mono text-[10px] flex flex-col gap-2.5 backdrop-blur-md ${
        isDark
          ? 'bg-[#080808]/90 border-white/10 text-white shadow-specular-dark'
          : 'bg-[#F6F6F4]/90 border-black/10 text-black shadow-specular-light'
      }`}
    >
      {/* Top LED Dot Header */}
      <div className="flex items-center justify-between border-b border-current/10 pb-2">
        <div className="flex items-center gap-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isConnected ? 'bg-[#00FF66] shadow-phosphor-glow' : 'bg-[#FF5500]'
            }`}
          />
          <span className="font-bold tracking-widest text-[9px]">HARDWARE_HUD</span>
        </div>
        <span className="text-[8px] px-1 py-0.5 rounded border border-current/20 uppercase font-semibold">
          1-BIT MONO
        </span>
      </div>

      {/* Telemetry Matrix Grid */}
      <div className="grid grid-cols-2 gap-2 text-[9px]">
        <div>
          <span className="opacity-50 block text-[8px]">TARGET MCU</span>
          <span className="font-bold text-[#FF5500] uppercase">{mcu}</span>
        </div>
        <div>
          <span className="opacity-50 block text-[8px]">DISPLAY IC</span>
          <span className="font-bold uppercase">{displayDriver.toUpperCase()} (128×64)</span>
        </div>
        <div>
          <span className="opacity-50 block text-[8px]">SERIAL SPEED</span>
          <span className="font-bold text-[#00FF66]">{baudRate.toLocaleString()} BAUD</span>
        </div>
        <div>
          <span className="opacity-50 block text-[8px]">STREAM CLOCK</span>
          <span className="font-bold">{fps} FPS • 33ms</span>
        </div>
      </div>

      {/* Frame Counter Matrix */}
      <div className="p-1.5 rounded bg-black/40 border border-current/10 flex justify-between items-center text-[10px]">
        <span className="opacity-60 text-[8px]">BUFFER FRAME</span>
        <span className="font-bold text-[#00FF66] tabular-nums">
          {String(currentFrame + 1).padStart(3, '0')} / {String(totalFrames).padStart(3, '0')}
        </span>
      </div>
    </div>
  );
};
```

---

## 5. Verification Method

To independently verify the observations, dependency findings, and codebase contracts:

1. **Verify Dependencies & Scripts**:
   ```bash
   cd D:\espprojects\oled\web
   cat package.json
   ```
   *Expectation*: Confirm presence of `react` (18.3.1), `framer-motion` (13.4.0), `gsap` (3.15.0), `three` (0.186.0), `lucide-react` (0.475.0), `clsx`, `tailwind-merge`.

2. **Verify Type-Safety & Zero Compilation Errors**:
   ```bash
   cmd /c "npm run lint"
   ```
   *Expectation*: Runs `tsc --noEmit` and returns Exit Code 0 without errors.

3. **Verify Vite Config & Server Routes**:
   Inspect `D:\espprojects\oled\web\vite.config.ts`.
   *Expectation*: Confirm `@` alias is mapped to `./src`, `/ollama-proxy` routes to `http://127.0.0.1:11434`, and `esp32FlashPlugin()` routes to `/api/flash`.

4. **Verify Component Paths & Structure**:
   Inspect the following files:
   - `D:\espprojects\oled\web\src\App.tsx` (view switching, state hooks, 3-column preview)
   - `D:\espprojects\oled\web\src\components\Header.tsx` (view switcher, WebSerial connect, baud toggle)
   - `D:\espprojects\oled\web\src\components\PlaybackBar.tsx` (timeline transport)
   - `D:\espprojects\oled\web\src\components\TimelineTrack.tsx` (dnd-kit track, zoom, ruler)
   - `D:\espprojects\oled\web\src\components\studio\lyrics\LyricsStudioView.tsx` (kinetic typography 3-pane layout, floating transport capsule)
   - `D:\espprojects\oled\web\src\components\reactbits` (GlassSurface, SpotlightCard, BlueprintHoverCard, ElasticSlider)
   - `D:\espprojects\oled\web\src\engine\webSerialStreamer.ts` (WebSerial 921600 / 115200 streaming)

5. **Invalidation Conditions**:
   - If any file under `C:\Users\manee\Desktop\oled` is used, the observation is invalid.
   - If `tsc --noEmit` fails or reports broken types, the state is invalidated.
