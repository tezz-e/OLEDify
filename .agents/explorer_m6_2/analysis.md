# OLED Studio UI Component Modernization & Integration Blueprint
**Agent**: explorer_m6_2 (Role: OLED Studio UI Component Mapper)  
**Date**: 2026-09-19  
**Target Codebase**: `D:\espprojects\oled\web\src`  
**Aesthetic Mandate**: Strict "WaxyBit Blueprint" (Sharp 1-2px solid black `#1A1A1A` borders, `#F5F0EB` parchment graph background, `#FFFFFF` technical consoles, `#E85D2A` safety orange accents, `IBM Plex Mono` typography).

---

## 1. Executive Summary

The OLED Studio web application is a specialized engineering tool designed to convert video/GIF/sequence media into 1-bit monochrome bitmaps ($128 \times 64$ XBMP format) and stream them live to ESP32-S3 microcontrollers driving SH1106/SSD1306 displays over WebSerial at 921,600 baud.

While the existing interface possesses a strong foundation in layout and utility, its interactive controls rely on conventional HTML `<select>` dropdowns, standard click buttons, static textual labels, and a flat 2D canvas presentation.

This blueprint maps five modern dynamic components from **React Bits** into the OLED Studio interface to transform it into a highly tactile, cyber-physical laboratory dashboard:
1. **Option Wheel**: Replaces standard select dropdowns and flat radio button lists in dense technical parameter consoles (`DitherControls`, `SettingsModal`, `PlaybackBar`).
2. **Click Spark**: Injects electrical particle discharge bursts into high-impact hardware actions (`COMPILE`, `FLASH_DEVICE`, `APPLY_TRIM`, `PLAY/PAUSE`).
3. **Decrypted Text**: Animates system headers, telemetry badges, hardware connection states, and status transitions with rapid cryptographic glyph decryption.
4. **Count Up**: Smoothly animates numeric counters (frame indices, total frame counts, PROGMEM KB sizes, decode percentages) with tabular monospace alignment.
5. **Liquid Ether & Glass Surface**: Provides ambient depth without compromising the flat brutalist blueprint by (a) trapping a WebGL fluid particle simulation behind the simulated OLED monitor, and (b) rendering chromatic optical glass refraction on modal dialogs with strict $0\text{px}$ radius sharp borders.

---

## 2. Current UI Architecture & Design System Audit

### 2.1 Component & Layout Hierarchy
The application UI in `web/src/App.tsx` is structured into three main visual layers:
```
+-----------------------------------------------------------------------------------+
|  Header (Header.tsx) [h-14, z-20]                                                 |
|  - Title: "▲ OLED_STUDIO"                                                         |
|  - Actions: [Settings (Gear)], [WebSerial Connect USB], [COMPILE (Export)]        |
+-----------------------------------------------------------------------------------+
|  Main Stage (flex-1, relative, min-h-0, z-10)                                     |
|  - Background: #F5F0EB Parchment with 40px repeating grid                         |
|  - Center: OledCanvas.tsx (128x64 display scaled 6x in .oled-bezel)                |
|  - Floating Overlay: Status Footer (bottom-[392px], left-4, h-7)                  |
+-----------------------------------------------------------------------------------+
|  Technical Bottom Console (aside, h-[380px], bg-white, border-t-2 #1A1A1A, z-20)  |
|  +-----------------------+-------------------------+----------------------------+ |
|  | Zone 1: MEDIA_POOL    | Zone 2: TIMELINE        | Zone 3: INSPECTOR          | |
|  | (w-[280px], border-r) | (flex-1, border-r)      | (w-[340px])                | |
|  | - DropZone.tsx        | - PlaybackBar.tsx       | - DitherControls.tsx       | |
|  | - FrameStrip.tsx      | - TrimControls.tsx      | - CropControls.tsx         | |
|  +-----------------------+-------------------------+----------------------------+ |
+-----------------------------------------------------------------------------------+
|  Modals (z-50)                                                                    |
|  - SettingsModal.tsx (MCU target, Display driver, I2C SDA/SCL pins)               |
|  - ExportModal.tsx (C++ PROGMEM frames.h preview, Flash WebSerial, Save/Download) |
+-----------------------------------------------------------------------------------+
```

### 2.2 Design System Tokens
From `web/tailwind.config.js` and `web/src/index.css`:
- **Colors**:
  - Parchment: `#F5F0EB`
  - Ink (Borders & Text): `#1A1A1A`
  - Ink Light (Labels/Muted): `#6B6B6B`
  - Accent: `#E85D2A` (Safety Orange)
  - Accent Dark (Hover): `#C94E22`
  - OLED Bezel / Screen: `#080808` / `#020304`
- **Typography**:
  - Primary Monospace: `IBM Plex Mono, ui-monospace, monospace`
  - Technical Display: `Space Grotesk, system-ui, sans-serif`
  - Formatting: Uppercase, tracking `0.1em` to `0.2em`, font size `10px` to `12px`
- **Border Rules**:
  - Panel borders: `2px solid #1A1A1A`
  - Control borders: `1px solid #1A1A1A`
  - Border radius: Strictly `0px` (no pills, no rounded cards)

---

## 3. Component-by-Component Mapping & Integration Blueprint

### 3.1 Option Wheel (Tactile Cylindrical Selector)

#### Target Controls & Replacements
1. **Primary Target: `DitherControls.tsx` — Dithering Algorithm Selector**
   - *Current implementation* (Lines 23–37): 5 `<button>` elements in a wrapping flex container (`Atkinson`, `Floyd-S`, `Bayer 4×4`, `Bayer 8×8`, `Threshold`).
   - *Replacement*: A vertical or horizontal tactile cylindrical drum wheel with 5 slots.
   - *Why*: Dithering algorithms represent physical mechanical filters. Cycling through them via a tactile wheel mirrors rotating optical filter wheels on scientific instruments.
2. **Secondary Target: `SettingsModal.tsx` — Target Board (`config.mcu`) & Display Driver (`config.display`)**
   - *Current implementation* (Lines 63–74, Lines 81–89): Standard HTML `<select>` elements.
   - *Replacement*: Compact inline Option Wheels. Target Board options: `['ESP32-S3', 'ESP32', 'ESP32-C3', 'ARDUINO UNO', 'PI PICO']`. Display Driver options: `['SH1106', 'SSD1306', 'SSD1315']`.
3. **Tertiary Target: `DitherControls.tsx` — Phosphor Theme Selector**
   - *Current implementation* (Lines 103–114): `<select>` element (`cyan`, `white`, `amber`, `green`, `yellow-blue`).
   - *Replacement*: Cylindrical color drum showing the theme names with active phosphor tinting.
4. **Quaternary Target: `CropControls.tsx` — Fit Mode Selector**
   - *Current implementation* (Lines 24–38): 3 buttons (`cover`, `contain`, `stretch`).
   - *Replacement*: Compact 3-option wheel drum.

#### WaxyBit Blueprint Styling Specifications
- **Container Box**:
  - `height: 88px` (compact height fitting tightly within the 340px inspector column).
  - `background: #F5F0EB` (parchment) or `#FFFFFF` (white).
  - `border: 2px solid #1A1A1A`.
  - Center Selection Reticle: Two horizontal guide rules (`1px solid #1A1A1A`) framing the active central row, flanked by `#E85D2A` pointer carats (`▶` and `◀`).
- **Typography & Sharpness**:
  - Font: `font-mono uppercase tracking-widest`.
  - Active Item: `color: #E85D2A; font-weight: 700; font-size: 11px;`
  - Inactive Items: `color: #6B6B6B; font-weight: 500; font-size: 10px; opacity: 0.35;`
  - **Crucial Override**: Set `blur = 0` (or `0.5`). The React Bits default `blur = 2` introduces soft gaussian blur that violates the crisp brutalist aesthetic. Setting blur to 0 ensures pixel-crisp monospace glyphs at all tilt angles.
  - `tilt = 8`, `spacing = 1.3`, `smoothing = 180ms`, `draggable = true`.

#### Code Integration Pattern (`DitherControls.tsx`)
```tsx
// Before:
<div className="bg-[#F5F0EB] border border-[#1A1A1A] p-1 flex flex-wrap gap-1">
  {algorithms.map((algo) => (
    <button key={algo.id} onClick={() => onChange({ ...config, algorithm: algo.id })}>
      {algo.label}
    </button>
  ))}
</div>

// After (Option Wheel Integration):
<div className="relative border-2 border-[#1A1A1A] bg-[#F5F0EB] h-[84px] overflow-hidden">
  {/* Reticle Guide Lines */}
  <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[26px] border-y border-[#1A1A1A] bg-white/40 pointer-events-none z-10 flex items-center justify-between px-2">
    <span className="text-[#E85D2A] text-[9px] font-mono">▶</span>
    <span className="text-[#E85D2A] text-[9px] font-mono">◀</span>
  </div>
  <OptionWheel
    items={['ATKINSON', 'FLOYD-STEINBERG', 'BAYER 4X4', 'BAYER 8X8', 'THRESHOLD']}
    defaultSelected={algorithms.findIndex(a => a.id === config.algorithm)}
    onChange={(idx) => onChange({ ...config, algorithm: algorithms[idx].id })}
    textColor="#6B6B6B"
    activeColor="#E85D2A"
    fontSize={0.7}
    spacing={1.3}
    blur={0}
    tilt={7}
    className="h-full"
  />
</div>
```

---

### 3.2 Click Spark (Electrical Action Feedback)

#### Target Actions & Sparks Configuration
1. **`Header.tsx` — COMPILE Button (Line 50)**:
   - Action: Initiates project compilation and opens the C++ array exporter.
   - Spark Configuration:
     - `sparkColor`: `#E85D2A` (Safety Orange)
     - `sparkCount`: `12` particles
     - `sparkSize`: `7px`
     - `sparkRadius`: `22px`
     - `duration`: `350ms`
2. **`ExportModal.tsx` — FLASH_DEVICE Button (Line 93)**:
   - Action: Directly flashes frame byte buffers to the physical ESP32-S3 over WebSerial.
   - Spark Configuration:
     - `sparkColor`: `#FFFFFF` (High-voltage electrical arc against the `#E85D2A` button background)
     - `sparkCount`: `16` particles
     - `sparkSize`: `8px`
     - `sparkRadius`: `26px`
     - `duration`: `400ms`
3. **`PlaybackBar.tsx` — Play/Pause Toggle (Line 55)**:
   - Action: Starts and stops the 30 FPS playback loop.
   - Spark Configuration:
     - `sparkColor`: `#1A1A1A` (Brutalist ink sparks)
     - `sparkCount`: `8` particles
     - `sparkSize`: `6px`
     - `sparkRadius`: `18px`
     - `duration`: `300ms`
4. **`TrimControls.tsx` — Apply Trim Button (Line 84)**:
   - Action: Destructively truncates the timeline frame array.
   - Spark Configuration:
     - `sparkColor`: `#E85D2A`
     - `sparkCount`: `10` particles
     - `sparkSize`: `7px`
     - `sparkRadius`: `20px`
     - `duration`: `350ms`
5. **`Header.tsx` — Connect USB Button (Line 37)**:
   - Action: Connects/disconnects WebSerial port.
   - Spark Configuration:
     - `sparkColor`: `#E85D2A`
     - `sparkCount`: `8` particles
     - `sparkSize`: `6px`

#### Usability & Non-Obscuration Rule
The canvas rendered by `ClickSpark` must strictly set `pointer-events: none` and `style={{ position: 'absolute', inset: 0 }}`. It acts as an optical overlay and will not capture or block pointer down/up/click events from the wrapped button element.

#### Code Integration Pattern (`Header.tsx`)
```tsx
// Before:
<button onClick={onExportClick} disabled={!hasMedia} className="px-5 py-1.5 ...">
  COMPILE
</button>

// After (ClickSpark Integration):
<ClickSpark
  sparkColor="#E85D2A"
  sparkSize={7}
  sparkRadius={22}
  sparkCount={12}
  duration={350}
  easing="ease-out"
>
  <button onClick={onExportClick} disabled={!hasMedia} className="px-5 py-1.5 ...">
    COMPILE
  </button>
</ClickSpark>
```

---

### 3.3 Decrypted Text (Hacker/Terminal Cryptographic Telemetry)

#### Target Locations & Triggers
1. **`Header.tsx` — Application Title (Line 22)**:
   - Current: Static text `"▲ OLED_STUDIO"`.
   - Enhancement: Decrypts on hover or page load from alphanumeric hex noise (`0123456789ABCDEF!#$<>[]`) into clean monospace letters:
     ```tsx
     <h1 className="text-base font-bold tracking-wider font-mono text-[#1A1A1A] flex items-center gap-1.5">
       <span className="text-[#E85D2A]">▲</span>
       <DecryptedText
         text="OLED_STUDIO"
         speed={35}
         characters="0123456789ABCDEF_~<>[]"
         animateOn="hover"
         className="font-mono tracking-widest font-bold"
       />
       <span className="text-[10px] text-[#6B6B6B] font-mono font-normal ml-1">// v1.0.0</span>
     </h1>
     ```
2. **`Header.tsx` & Status Footer — WebSerial Connection State**:
   - Current: Static `'Connected'` vs `'Connect USB'` and `'CONNECTED'` vs `'OFFLINE'`.
   - Enhancement: When the user toggles serial, the status text scrambles and decrypts:
     `"HANDSHAKE..."` $\rightarrow$ `"SYNC_0xAA_0x55"` $\rightarrow$ `"CONNECTED: ESP32-S3"`.
3. **`ExportModal.tsx` — Modal Header & Action Status (Lines 83, 104, 120, 145)**:
   - Modal title: `"EXPORT_CPP_ARRAY"` decrypts on modal entrance.
   - Status changes:
     - Flash button: `"FLASHING..."` $\rightarrow$ `"0x06_ACK_OK"` $\rightarrow$ `"FLASH_COMPLETE"`.
     - Save button: `"WRITING..."` $\rightarrow$ `"SAVED_TO_PROJECT"`.
     - Copy button: `"COPIED_TO_CLIPBOARD"`.
4. **`DropZone.tsx` — Decoding Pipeline Stage (Line 85)**:
   - As video/GIF frames are ingested, the stage text (`"reading..."`, `"decoding..."`, `"quantizing..."`) animates like an analytical terminal.

#### Aesthetic & Timing Constraints
- **Speed**: `30ms` to `40ms` per character interval (rapid, crisp, military/BIOS cadence; no sluggish 100ms animations).
- **Characters**: Restricted to uppercase technical characters: `"0123456789ABCDEF_~<>[]{}/\\*!#$%"`.
- **Typography**: Strictly `font-mono font-bold tracking-widest`.

---

### 3.4 Count Up (Animated Numerical Readouts)

#### Target Readouts & Behaviors
1. **`PlaybackBar.tsx` — Total Frames & Scrub Index (Lines 72–74)**:
   - Current: `{pad(displayFrame)}/{pad(durationFrames)}`.
   - Enhancement: When media is loaded or trimmed, the total frame tally counts up from 0 to the target total frames (e.g. `000` $\rightarrow$ `148`) in 0.6s.
   - Alignment: Must use `tabular-nums` CSS (`font-variant-numeric: tabular-nums`) within `font-mono` so numeric changes never cause layout jitter or horizontal shifting of adjacent buttons.
2. **`FrameStrip.tsx` — Header Frame Tally (Line 83)**:
   - Current: `{selectedCount} / {media.frames.length}`.
   - Enhancement: Animate both the active trimmed count and original count using `CountUp`.
3. **`TrimControls.tsx` — Active Trim Readouts (Lines 48, 67, 107–110)**:
   - Current: Static frame numbers.
   - Enhancement: Rapid micro-count up (duration 0.2s) when slider adjusts or trim ranges change.
4. **`ExportModal.tsx` — PROGMEM Memory Footprint & Frame Count (Lines 153, 163)**:
   - Current: `PROGMEM: ~{Math.round((frameCount * 1024) / 1024)} KB` and `{frameCount} FRAMES_EXPORTED`.
   - Enhancement: When the export modal opens, the memory calculator springs upward:
     `PROGMEM: ~[ 0 -> 128 ] KB` | `[ 0 -> 128 ] FRAMES_EXPORTED`.
5. **`DropZone.tsx` — Ingestion Progress Percentage (Line 87)**:
   - Smoothly counts up percentage `[ 0% -> 100% ]`.

#### Code Integration Pattern (`PlaybackBar.tsx` & `ExportModal.tsx`)
```tsx
// ExportModal.tsx integration:
<div className="px-3 py-2 bg-[#F5F0EB] border-b border-[#1A1A1A] flex justify-between items-center text-[10px] font-mono text-[#6B6B6B]">
  <span>PREVIEW: frames.h</span>
  <span className="text-[#E85D2A] font-bold flex items-center gap-1">
    <span>PROGMEM: ~</span>
    <CountUp to={Math.round((frameCount * 1024) / 1024)} duration={0.8} />
    <span>KB</span>
  </span>
</div>
```

---

### 3.5 Liquid Ether & Glass Surface (Ambient Depth & Refraction)

#### Ambient Depth Strategy: Why NOT Global and Why NOT FluidGlass
- **The Pitfall of Global Fluid**: A global WebGL fluid background covering the entire browser window destroys the flat brutalist graph paper aesthetic, consumes continuous GPU fillrate, and distracts from high-density data controls.
- **The Pitfall of FluidGlass**: `FluidGlass` requires `@react-three/fiber`, `@react-three/drei`, `three`, `maath`, and attempts to load external GLTF 3D meshes over HTTP. This violates offline standalone operation and introduces heavy WebGL overhead.
- **The Superior Architecture**:
  1. **Confined `LiquidEther` Canvas Backdrop**: Place `LiquidEther` exclusively within the top main stage area behind the central `OledCanvas`.
  2. **Strictly 0px Radius `GlassSurface`**: Use SVG displacement filter `GlassSurface` on floating modals and HUD badges, with `borderRadius={0}` to preserve sharp brutalist edges.

#### 1. Confined LiquidEther Backdrop (`App.tsx`)
- **Placement**: Inside `<section className="flex-1 flex items-center justify-center p-8 relative min-h-0">`.
- **Layering**:
  - `Layer 0 (Background)`: Parchment `#F5F0EB` with 40px grid pattern.
  - `Layer 1 (LiquidEther)`: Absolute positioned container (`absolute inset-0 pointer-events-none z-0 opacity-40`).
  - `Layer 2 (Foreground Display)`: `OledCanvas` container (`relative z-10`).
- **Dynamic Phosphor-Matched Color Palettes**:
  The fluid simulation adapts dynamically to the active `ditherConfig.theme`:
  - **Cyan Phosphor**: `['#00F0FF', '#083B44', '#E0DBD5']` (Deep cybernetic teal eddies)
  - **White Phosphor**: `['#FFFFFF', '#4A4A4A', '#E0DBD5']` (Monochrome smoke)
  - **Amber Phosphor**: `['#FFB000', '#592B02', '#E0DBD5']` (Vintage CRT amber embers)
  - **Green Phosphor**: `['#00FF66', '#023D18', '#E0DBD5']` (Oscilloscope matrix phosphor)
  - **Yellow/Blue Dual**: `['#00E5FF', '#FFCC00', '#1A1A1A']` (Dual-channel wave)
- **Fluid Parameters**:
  - `resolution`: `0.5` (Optimized half-res grid preventing frame drops during 30 FPS video playback).
  - `lightMode`: `true` (Blends cleanly onto `#F5F0EB` parchment background).
  - `mouseForce`: `15`, `cursorSize`: `80` (Fluid ripples respond to mouse movements across the graph area).
  - `autoDemo`: `true`, `autoSpeed`: `0.2` (Subtle slow drifting currents when idle).

#### 2. Brutalist GlassSurface Integration (`SettingsModal.tsx` & `ExportModal.tsx`)
- **Placement**: Replaces the flat modal container wrapper in `SettingsModal.tsx` and `ExportModal.tsx`.
- **Brutalist Adjustments**:
  - `borderRadius`: Strictly `0` (eliminates default 20px curves).
  - `borderWidth`: `0.06` (thin peripheral refraction rim).
  - `blur`: `8` (soft frosted glass backdrop).
  - `displace`: `1.5` (controlled optical edge distortion).
  - `backgroundOpacity`: `0.05` (maintains high readability while letting the live animated studio blur underneath).
  - Outer border: `2px solid #1A1A1A` remains intact on the container.
- **Fallback**: Includes automatic feature detection for SVG filter support with graceful CSS fallback (`backdrop-filter: blur(8px); background: rgba(255,255,255,0.95)`).

---

## 4. UI Layout, Usability & Non-Obscuration Verification

To ensure that the added motion and depth never obscure controls or impair application performance:

| Aspect | Safeguard Implementation | Verification Metric |
|---|---|---|
| **Control Hitboxes** | Bottom console (`MEDIA_POOL`, `TIMELINE`, `INSPECTOR`) remains completely opaque `#FFFFFF` with `z-20`. `LiquidEther` never renders behind or over console inputs. | All sliders (`brightness`, `contrast`, `threshold`, `trim`) and buttons maintain 100% click/drag responsiveness. |
| **Pointer Events** | Ambient `LiquidEther` canvas is set to `pointer-events-none`. `ClickSpark` canvas is set to `pointer-events-none`. | Drag-and-drop file ingestion onto `DropZone` and canvas seeking functions with zero dropped events. |
| **Framerate Budget** | `LiquidEther` runs at `resolution: 0.5` with internal `IntersectionObserver` that automatically suspends WebGL rendering when hidden. | Studio maintains solid 30 FPS rendering on simulated OLED canvas during active video decoding and streaming. |
| **Layout Shift (CLS)** | All animated numbers in `CountUp` use `tabular-nums` monospace styling with fixed-width wrappers. | Zero layout shifts or horizontal button bouncing during numeric counting. |
| **Brutalist Aesthetic** | `borderRadius: 0` enforced on all React Bits components. `OptionWheel` blur eliminated (`blur: 0`). Sharp 1px and 2px `#1A1A1A` borders preserved. | No rounded corners or generic consumer glass aesthetics introduced. |

---

## 5. Dependency & Integration Roadmap

### 5.1 Required Dependencies
To support all 5 React Bits components, the following packages must be added to `web/package.json`:
```bash
npm install three framer-motion
npm install --save-dev @types/three
```
*(Note: `three` powers `LiquidEther`; `framer-motion` powers `DecryptedText` and `CountUp`; `OptionWheel` and `ClickSpark` are pure React/Canvas/CSS implementations with zero external dependencies; `GlassSurface` is pure React + SVG filters).*

### 5.2 Component File Layout
Place cleaned-up React Bits components in a dedicated subdirectory `web/src/components/reactbits/`:
```
web/src/components/
├── reactbits/
│   ├── OptionWheel.tsx       # Cylindrical selector with blur:0 and blueprint styling
│   ├── OptionWheel.css       # Option wheel base geometry
│   ├── ClickSpark.tsx        # Particle discharge click feedback
│   ├── DecryptedText.tsx     # Terminal cryptographic glyph decryptor
│   ├── CountUp.tsx           # Tabular monospace spring counter
│   ├── LiquidEther.tsx       # Three.js WebGL fluid background
│   ├── LiquidEther.css       # Full-bleed fluid container styling
│   ├── GlassSurface.tsx      # SVG chromatic displacement filter container
│   └── GlassSurface.css      # SVG filter definitions & fallbacks
```

---

## 6. Comprehensive Component Matrix

| React Bits Component | Target File(s) | Exact DOM Anchor Point | Aesthetic Adaptation |
|---|---|---|---|
| **OptionWheel** | `DitherControls.tsx` | Lines 22–38 (Algorithm list) | `h-[84px]`, reticle guide lines `[ ▶ ... ◀ ]`, `blur: 0`, `#E85D2A` active |
| **OptionWheel** | `SettingsModal.tsx` | Lines 63–74 (Target MCU select) | Inline drum selector, 2px `#1A1A1A` border, monospace |
| **OptionWheel** | `CropControls.tsx` | Lines 24–38 (Fit mode list) | 3-item horizontal/vertical wheel |
| **ClickSpark** | `Header.tsx` | Lines 50–60 (`COMPILE` button) | `#E85D2A` sparks, count 12, size 7px, radius 22px |
| **ClickSpark** | `ExportModal.tsx` | Lines 93–106 (`FLASH_DEVICE` button) | `#FFFFFF` electric sparks, count 16, radius 26px |
| **ClickSpark** | `PlaybackBar.tsx` | Lines 55–60 (Play/Pause button) | `#1A1A1A` crisp ink sparks, count 8, radius 18px |
| **ClickSpark** | `TrimControls.tsx` | Lines 84–94 (`Apply Trim` button) | `#E85D2A` sparks, count 10, radius 20px |
| **DecryptedText**| `Header.tsx` | Lines 22–24 (Title: `▲ OLED_STUDIO`) | Hex glyphs `0123456789ABCDEF`, speed 35ms, hover trigger |
| **DecryptedText**| `Header.tsx` & Footer | Line 46, Line 310 (Serial state) | Dynamic status decrypt (`OFFLINE` $\rightarrow$ `CONNECTED`) |
| **DecryptedText**| `ExportModal.tsx` | Line 83, Line 104 (Modal & Flash status)| `FLASHING...` $\rightarrow$ `FLASH_COMPLETE` |
| **CountUp** | `PlaybackBar.tsx` | Line 73 (Frame readout: `000 / 120`) | `tabular-nums font-mono`, duration 0.6s |
| **CountUp** | `FrameStrip.tsx` | Line 83 (Frame badge: `45 / 90`) | Tabular spring counter |
| **CountUp** | `ExportModal.tsx` | Line 153, 163 (PROGMEM KB & Frame count) | Animate memory calculation `0` $\rightarrow$ `~128 KB` |
| **LiquidEther** | `App.tsx` | Lines 215–217 (Canvas stage `<section>`) | Trapped in canvas stage, opacity 0.4, theme-adaptive phosphor colors |
| **GlassSurface** | `ExportModal.tsx` | Lines 79–81 (Modal outer card) | `borderRadius: 0`, 2px solid `#1A1A1A`, optical chromatic refraction |
| **GlassSurface** | `SettingsModal.tsx`| Lines 45–46 (Modal outer card) | `borderRadius: 0`, frosted backdrop filter with fallback |
