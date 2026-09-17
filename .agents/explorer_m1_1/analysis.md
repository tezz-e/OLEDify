# Architecture Analysis & Implementation Specification: Feature F01 (Web Studio Project Setup)

**Role**: M1 Scaffold Explorer (`explorer_m1_1`)  
**Target Directory**: `D:\espprojects\oled\web`  
**Parent Agent**: `sub_orch_m1` (Conversation ID: `c335cf6b-2b25-4534-bccd-41c60c2542ba`)  
**Date**: 2026-09-18  
**Status**: COMPLETE SPECIFICATION  

---

## 1. Executive Summary & Boundary Definition

Feature **F01 (Web Studio Project Setup)** establishes the complete client-side Web Studio application workspace within `D:\espprojects\oled\web`. It provides the operational bedrock for Milestone M1 (Media Ingestion & 2:1 Preprocessing) and downstream Milestones M2 (Dithering & OLED Canvas), M3 (Procedural FX), M4 (WebSerial & C++ Export), and M5 (E2E Testing).

### Key Architectural Decisions:
1. **Toolchain**: Vite 5 + React 18 + TypeScript 5.5 + Tailwind CSS v3.
2. **Execution Environment Constraint (Windows PowerShell)**: On this Windows system, running PowerShell scripts (`npm.ps1`) is blocked by `PSSecurityException`. All CLI operations must explicitly invoke `npm.cmd` and `npx.cmd`.
3. **Tailwind Version Pinning**: As of 2026, the default unpinned `npm install tailwindcss` installs Tailwind v4.3+, which completely breaks `tailwind.config.js` and `postcss.config.js`. We explicitly pin `"tailwindcss": "^3.4.17"`, `"postcss": "^8.4.47"`, and `"autoprefixer": "^10.4.20"` to guarantee 100% compatibility with the project's declarative configuration design.
4. **Type Safety & CommonJS Interop**: `omggif` is a battle-tested CommonJS GIF decoder. We install `@types/omggif` (^1.0.5) and provide a supplementary `src/types/omggif.d.ts` definition alongside `esModuleInterop: true` and `allowSyntheticDefaultImports: true` in `tsconfig.json` to eliminate any runtime/build-time module resolution failures.
5. **Hardware Readiness**: We install `@types/w3c-web-serial` (^1.0.8) upfront so the TypeScript compiler recognizes `navigator.serial` types without requiring ad-hoc `any` casts in later milestones.

---

## 2. Package Manifest (`package.json`)

The manifest specifies exact dependencies, scripts, and project metadata.

```json
{
  "name": "oled-visual-studio",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "lucide-react": "^0.475.0",
    "omggif": "^1.0.10",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/node": "^20.16.5",
    "@types/omggif": "^1.0.5",
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "@types/w3c-web-serial": "^1.0.8",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.5.3",
    "vite": "^5.4.3"
  }
}
```

### Dependency Rationale:
- **`react` & `react-dom` (^18.3.1)**: Modern concurrent UI runtime for high-frequency canvas rendering and state orchestration.
- **`omggif` (^1.0.10)**: Fast client-side GIF89a decoder extracting raw RGBA frame buffers, disposal modes (0/1/2/3), and variable inter-frame delays without external binaries or web workers.
- **`lucide-react` (^0.475.0)**: Clean, lightweight icon suite for player controls, upload zones, hardware toggles, and sliders.
- **`@types/w3c-web-serial` (^1.0.8)**: Full type declarations for W3C WebSerial API (`SerialPort`, `SerialOptions`, `navigator.serial`) preparing for M4 streaming.
- **`tailwindcss` (^3.4.17)**: Pinned v3 release supporting `@tailwind base; components; utilities;`, PostCSS pipeline, and extended OLED color palettes.

---

## 3. Build & Bundler Configuration

### 3.1 `web/vite.config.ts`
Configures Vite with the React plugin, strict local dev server defaults, and ES2020 build target.

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    open: false,
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: true,
  },
});
```

### 3.2 `web/tsconfig.json`
Configures TypeScript compiler with bundler module resolution, strict type checking, and CommonJS/ESM interop.

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",

    /* Interop & strictness */
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src", "vite.config.ts"]
}
```

### 3.3 `web/tailwind.config.js`
Extends Tailwind theme with custom OLED display phosphor colors, PCB dark surfaces, and luminous glow shadows.

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        oled: {
          bg: '#05070a',
          surface: '#0d1117',
          panel: '#161b22',
          border: '#30363d',
          accent: '#58a6ff',
          cyan: '#00f0ff',
          white: '#ffffff',
          amber: '#ffb000',
          green: '#00ff66',
          muted: '#8b949e',
        },
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'oled-cyan': '0 0 15px rgba(0, 240, 255, 0.45)',
        'oled-white': '0 0 15px rgba(255, 255, 255, 0.45)',
        'oled-amber': '0 0 15px rgba(255, 176, 0, 0.45)',
      },
    },
  },
  plugins: [],
};
```

### 3.4 `web/postcss.config.js`
```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

### 3.5 `web/index.html`
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>OLED Visual Studio — 128×64 Animation Engine</title>
  </head>
  <body class="bg-[#05070a] text-slate-100 antialiased min-h-screen selection:bg-cyan-500 selection:text-black">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### 3.6 `web/.gitignore`
```
node_modules
dist
dist-ssr
*.local
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?
```

---

## 4. Directory & Module Architecture under `web/src`

```
D:\espprojects\oled\web\
├── public/
│   └── vite.svg
├── src/
│   ├── main.tsx             # React DOM root render
│   ├── App.tsx              # Main studio workbench coordinator
│   ├── index.css            # Tailwind directives + base styles
│   ├── types/
│   │   ├── media.ts         # Ingestion contracts (F02, F03, F04, F05)
│   │   ├── dither.ts        # Dither algorithms, configs, phosphor palettes (M2 prep)
│   │   ├── oled.ts          # XBMP buffer types, frame dimensions, stats (M2 prep)
│   │   └── omggif.d.ts      # Supplementary omggif type declarations
│   ├── components/
│   │   ├── Header.tsx       # Top navigation, status indicators, quick actions
│   │   ├── DropZone.tsx     # Drag & drop media ingestion UI (F02-F04)
│   │   ├── CropTool.tsx     # 2:1 crop preview bounding box controls (F05)
│   │   └── OledCanvas.tsx   # Simulated 128x64 physical OLED player component
│   ├── engine/
│   │   ├── mediaDecoder.ts  # Master ingestion coordinator
│   │   ├── videoDecoder.ts  # HTML5 <video> offscreen seek loop (F02)
│   │   ├── gifDecoder.ts    # omggif binary frame and disposal parser (F03)
│   │   ├── sequenceLoader.ts# Natural collation multi-file loader (F04)
│   │   └── cropScaler.ts    # 2:1 Cover/Contain/Stretch scaler onto 128x64 (F05)
│   └── styles/
│       └── oled.css         # Authentic phosphor glow, scanline grid, PCB bezel
```

---

## 5. File Content Templates for Implementation

The following complete file contents are ready for immediate writing by the Worker.

### 5.1 `web/src/index.css`
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-oled-bg text-slate-200 overflow-x-hidden;
    font-feature-settings: "cv02", "cv03", "cv04", "cv11";
  }
}
```

### 5.2 `web/src/styles/oled.css`
```css
/* Authentic OLED Pixel Grid and Phosphor Bloom Emulation */

.oled-bezel {
  background: radial-gradient(circle at 50% 30%, #1a2332 0%, #0d1219 100%);
  border: 2px solid #2d3748;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.8), 0 8px 24px rgba(0, 0, 0, 0.6);
}

.oled-screen-glass {
  background-color: #040608;
  box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.95);
  position: relative;
}

.oled-screen-glass::after {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.04) 0%,
    rgba(255, 255, 255, 0.01) 40%,
    transparent 60%
  );
  pointer-events: none;
}

/* Sub-pixel gap grid emulation */
.oled-subpixel-grid {
  background-size: 4px 4px;
  background-image: 
    linear-gradient(to right, rgba(0, 0, 0, 0.7) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(0, 0, 0, 0.7) 1px, transparent 1px);
}

/* Phosphor Glow Drop Shadows */
.glow-cyan {
  filter: drop-shadow(0 0 4px rgba(0, 240, 255, 0.65)) drop-shadow(0 0 12px rgba(0, 240, 255, 0.3));
}

.glow-white {
  filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.7)) drop-shadow(0 0 12px rgba(255, 255, 255, 0.3));
}

.glow-amber {
  filter: drop-shadow(0 0 4px rgba(255, 176, 0, 0.7)) drop-shadow(0 0 12px rgba(255, 176, 0, 0.3));
}

.glow-green {
  filter: drop-shadow(0 0 4px rgba(0, 255, 102, 0.7)) drop-shadow(0 0 12px rgba(0, 255, 102, 0.3));
}
```

### 5.3 `web/src/types/media.ts`
Matches SCOPE.md interface contracts.

```typescript
export interface ExtractedFrame {
  index: number;
  timestampMs: number; // presentation timestamp in milliseconds
  durationMs: number;  // frame duration (especially for variable-delay GIFs)
  imageData: ImageData; // 128x64 or intermediate canvas image data
}

export interface MediaSourceInfo {
  type: 'video' | 'gif' | 'sequence';
  filename: string;
  sourceWidth: number;
  sourceHeight: number;
  frameCount: number;
  fps: number;
  durationMs: number;
}

export type FitMode = 'cover' | 'contain' | 'stretch';

export interface CropSettings {
  mode: FitMode;
  x: number;
  y: number;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
  smoothing: boolean; // true = high quality bicubic, false = pixel-art nearest neighbor
}
```

### 5.4 `web/src/types/dither.ts`
Prepares contracts for Milestone M2.

```typescript
export type DitherAlgorithm = 
  | 'atkinson' 
  | 'floyd-steinberg' 
  | 'bayer-2' 
  | 'bayer-4' 
  | 'bayer-8' 
  | 'threshold';

export type PhosphorTheme = 'cyan' | 'white' | 'amber' | 'green' | 'yellow-blue';

export interface DitherConfig {
  algorithm: DitherAlgorithm;
  brightness: number; // -100 to +100
  contrast: number;   // -100 to +100
  threshold: number;  // 0 to 255
  invert: boolean;
  theme: PhosphorTheme;
}
```

### 5.5 `web/src/types/oled.ts`
Hardware constants and binary buffer types.

```typescript
export const OLED_WIDTH = 128;
export const OLED_HEIGHT = 64;
export const OLED_ASPECT = 2.0; // 128:64
export const OLED_BYTES_PER_ROW = 16; // 128 / 8
export const OLED_FRAME_BYTES = 1024; // 16 * 64

export interface XbmpFrame {
  index: number;
  timestampMs: number;
  durationMs: number;
  bytes: Uint8Array; // Exactly 1024 bytes (row-major, LSB-first)
}

export interface PlaybackState {
  isPlaying: boolean;
  currentFrameIndex: number;
  targetFps: number;
  loop: boolean;
}
```

### 5.6 `web/src/types/omggif.d.ts`
Supplementary type definitions ensuring zero TypeScript breakage for `omggif`.

```typescript
declare module 'omggif' {
  export interface Frame {
    x: number;
    y: number;
    width: number;
    height: number;
    has_local_palette: boolean;
    palette_offset: number | null;
    palette_size: number | null;
    data_offset: number;
    data_length: number;
    transparent_index: number | null;
    interlaced: boolean;
    delay: number;
    disposal: number;
  }

  export class GifReader {
    width: number;
    height: number;
    constructor(buf: Uint8Array | ArrayLike<number>);
    numFrames(): number;
    loopCount(): number;
    frameInfo(frame_num: number): Frame;
    decodeAndBlitFrameRGBA(frame_num: number, pixels: Uint8Array | Uint8ClampedArray | number[]): void;
    decodeAndBlitFrameBGRA(frame_num: number, pixels: Uint8Array | Uint8ClampedArray | number[]): void;
  }

  export class GifWriter {
    width: number;
    height: number;
    constructor(buf: Uint8Array | ArrayLike<number>, width: number, height: number, gopts?: unknown);
    addFrame(x: number, y: number, w: number, h: number, indexed_pixels: number[], opts?: unknown): number;
    end(): number;
    getOutputBuffer(): Uint8Array | ArrayLike<number>;
    getOutputBufferPosition(): number;
    setOutputBuffer(v: Uint8Array | ArrayLike<number>): void;
    setOutputBufferPosition(v: number): void;
  }
}
```

### 5.7 `web/src/components/Header.tsx`
Top banner with branding, hardware status, and action buttons.

```tsx
import React from 'react';
import { Cpu, Download, Sparkles } from 'lucide-react';

interface HeaderProps {
  serialConnected?: boolean;
  onExportClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  serialConnected = false,
  onExportClick,
}) => {
  return (
    <header className="h-14 border-b border-oled-border bg-oled-surface px-4 flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <div className="h-8 w-8 rounded bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-oled-cyan">
          <Sparkles className="w-4 h-4 animate-pulse" />
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-wider text-slate-100 flex items-center gap-2">
            OLED VISUAL STUDIO
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 text-oled-cyan border border-cyan-500/30">
              128×64
            </span>
          </h1>
          <p className="text-[11px] text-oled-muted">ESP32-S3 SH1106 / SSD1306 Animation Engine</p>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2 px-2.5 py-1 rounded bg-oled-panel border border-oled-border text-xs font-mono">
          <Cpu className={`w-3.5 h-3.5 ${serialConnected ? 'text-green-400' : 'text-slate-500'}`} />
          <span className="text-[11px] text-slate-400">
            {serialConnected ? 'ESP32-S3: 921600 Baud' : 'ESP32-S3: Disconnected'}
          </span>
        </div>

        <button
          onClick={onExportClick}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-oled-cyan border border-cyan-500/40 text-xs font-medium transition-all cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export frames.h</span>
        </button>
      </div>
    </header>
  );
};
```

### 5.8 `web/src/components/DropZone.tsx`
Media dropzone component for video, GIF, and PNG sequences.

```tsx
import React, { useRef, useState } from 'react';
import { Upload, Film, Image as ImageIcon, Layers } from 'lucide-react';

interface DropZoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}

export const DropZone: React.FC<DropZoneProps> = ({ onFilesSelected, disabled = false }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelected(Array.from(e.dataTransfer.files));
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(Array.from(e.target.files));
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`border-2 border-dashed rounded-lg p-6 text-center transition-all cursor-pointer ${
        isDragOver
          ? 'border-oled-cyan bg-cyan-500/10'
          : 'border-oled-border hover:border-slate-500 bg-oled-surface/50'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="video/mp4,video/webm,image/gif,image/png,image/jpeg"
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled}
      />

      <div className="flex flex-col items-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-oled-panel border border-oled-border flex items-center justify-center text-oled-cyan">
          <Upload className="w-6 h-6" />
        </div>

        <div>
          <p className="text-sm font-medium text-slate-200">
            Drag & drop media files here, or <span className="text-oled-cyan underline">browse</span>
          </p>
          <p className="text-xs text-oled-muted mt-1">
            Supports MP4, WebM reels, animated GIFs, or multi-frame PNG sequences
          </p>
        </div>

        <div className="flex items-center space-x-4 text-[11px] text-slate-400 pt-2 border-t border-oled-border/60">
          <span className="flex items-center gap-1">
            <Film className="w-3.5 h-3.5 text-blue-400" /> MP4 / WebM
          </span>
          <span className="flex items-center gap-1">
            <ImageIcon className="w-3.5 h-3.5 text-green-400" /> GIF89a
          </span>
          <span className="flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-amber-400" /> PNG Sequence
          </span>
        </div>
      </div>
    </div>
  );
};
```

### 5.9 `web/src/components/CropTool.tsx`
Preset 2:1 bounding box controls and status display.

```tsx
import React from 'react';
import { Crop, Maximize2 } from 'lucide-react';
import { CropSettings, FitMode } from '../types/media';

interface CropToolProps {
  settings: CropSettings;
  onChange: (settings: CropSettings) => void;
  disabled?: boolean;
}

export const CropTool: React.FC<CropToolProps> = ({
  settings,
  onChange,
  disabled = false,
}) => {
  const handleModeChange = (mode: FitMode) => {
    onChange({ ...settings, mode });
  };

  const handleSmoothingToggle = () => {
    onChange({ ...settings, smoothing: !settings.smoothing });
  };

  return (
    <div className="bg-oled-surface border border-oled-border rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between text-xs font-medium text-slate-300">
        <span className="flex items-center gap-1.5">
          <Crop className="w-3.5 h-3.5 text-oled-cyan" /> 2:1 Aspect Ratio Crop & Scale
        </span>
        <span className="font-mono text-[11px] text-oled-muted">128 × 64 px</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => handleModeChange('cover')}
          className={`px-2.5 py-1.5 rounded text-xs font-medium border transition-all cursor-pointer ${
            settings.mode === 'cover'
              ? 'bg-cyan-500/20 text-oled-cyan border-cyan-500/50'
              : 'bg-oled-panel text-slate-400 border-oled-border hover:bg-slate-800'
          }`}
        >
          Cover (2:1 Fill)
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => handleModeChange('contain')}
          className={`px-2.5 py-1.5 rounded text-xs font-medium border transition-all cursor-pointer ${
            settings.mode === 'contain'
              ? 'bg-cyan-500/20 text-oled-cyan border-cyan-500/50'
              : 'bg-oled-panel text-slate-400 border-oled-border hover:bg-slate-800'
          }`}
        >
          Contain (Letterbox)
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => handleModeChange('stretch')}
          className={`px-2.5 py-1.5 rounded text-xs font-medium border transition-all cursor-pointer ${
            settings.mode === 'stretch'
              ? 'bg-cyan-500/20 text-oled-cyan border-cyan-500/50'
              : 'bg-oled-panel text-slate-400 border-oled-border hover:bg-slate-800'
          }`}
        >
          Stretch
        </button>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-oled-border/60 text-xs text-slate-400">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.smoothing}
            onChange={handleSmoothingToggle}
            disabled={disabled}
            className="rounded border-oled-border bg-oled-panel text-cyan-500 focus:ring-0"
          />
          <span>Bicubic Smoothing (Uncheck for Pixel Art)</span>
        </label>
        <span className="flex items-center gap-1 text-[11px] text-oled-muted">
          <Maximize2 className="w-3 h-3" /> Auto-Centered
        </span>
      </div>
    </div>
  );
};
```

### 5.10 `web/src/components/OledCanvas.tsx`
Simulated 128×64 physical OLED panel with phosphor themes, bezel frame, and silkscreen pins.

```tsx
import React, { useRef, useEffect } from 'react';
import { PhosphorTheme } from '../types/dither';
import '../styles/oled.css';

interface OledCanvasProps {
  frameData?: ImageData | null;
  theme?: PhosphorTheme;
  scale?: number; // Canvas pixel magnification (default 4x = 512x256)
}

export const OledCanvas: React.FC<OledCanvasProps> = ({
  frameData = null,
  theme = 'cyan',
  scale = 4,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const width = 128;
  const height = 64;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#05070a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // If frameData is provided, render pixels with sub-pixel spacing
    const colorMap: Record<PhosphorTheme, string> = {
      cyan: '#00f0ff',
      white: '#ffffff',
      amber: '#ffb000',
      green: '#00ff66',
      'yellow-blue': '#00e5ff',
    };

    const litColor = colorMap[theme] || '#00f0ff';

    if (frameData) {
      const data = frameData.data;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          const r = data[idx];
          const isLit = r > 128;

          if (isLit) {
            if (theme === 'yellow-blue' && y < 16) {
              ctx.fillStyle = '#ffcc00';
            } else {
              ctx.fillStyle = litColor;
            }
            ctx.fillRect(x * scale, y * scale, scale - 1, scale - 1);
          } else {
            // Faint pad for unlit pixel
            ctx.fillStyle = '#0d131a';
            ctx.fillRect(x * scale, y * scale, scale - 1, scale - 1);
          }
        }
      }
    } else {
      // Default placeholder text
      ctx.fillStyle = '#1e293b';
      ctx.font = '16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('128 × 64 OLED DISPLAY READY', canvas.width / 2, canvas.height / 2 + 5);
    }
  }, [frameData, theme, scale]);

  const glowClass = `glow-${theme === 'yellow-blue' ? 'cyan' : theme}`;

  return (
    <div className="oled-bezel p-3 rounded-xl inline-block">
      {/* Silkscreen Pin Headers */}
      <div className="flex justify-between items-center px-4 pb-2 text-[10px] font-mono tracking-widest text-slate-500 select-none">
        <span>[ GND ]</span>
        <span>[ VCC ]</span>
        <span>[ SCL ]</span>
        <span>[ SDA ]</span>
      </div>

      {/* Screen Glass Surface */}
      <div className="oled-screen-glass rounded border border-slate-800 p-2 overflow-hidden flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={width * scale}
          height={height * scale}
          className={`block ${glowClass}`}
          style={{ width: width * scale, height: height * scale }}
        />
      </div>

      <div className="flex justify-between items-center px-2 pt-2 text-[10px] font-mono text-slate-600">
        <span>SH1106 / SSD1306</span>
        <span>I2C 0x3C</span>
      </div>
    </div>
  );
};
```

### 5.11 `web/src/engine/mediaDecoder.ts`
Scaffold coordinator with types and validation logic.

```typescript
import { ExtractedFrame, MediaSourceInfo, CropSettings } from '../types/media';

export class MediaDecoder {
  /**
   * Sniffs file type and returns initial metadata
   */
  public static async inspectFile(file: File): Promise<MediaSourceInfo> {
    const isVideo = file.type.startsWith('video/') || /\.(mp4|webm)$/i.test(file.name);
    const isGif = file.type === 'image/gif' || /\.gif$/i.test(file.name);
    const isImage = file.type.startsWith('image/') || /\.(png|jpe?g)$/i.test(file.name);

    if (isVideo) {
      return this.inspectVideo(file);
    } else if (isGif) {
      return this.inspectGif(file);
    } else if (isImage) {
      return this.inspectImageSequence([file]);
    } else {
      throw new Error(`Unsupported media format: ${file.name}`);
    }
  }

  private static async inspectVideo(file: File): Promise<MediaSourceInfo> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;

      const url = URL.createObjectURL(file);
      video.src = url;

      video.onloadedmetadata = () => {
        const durationMs = Math.round(video.duration * 1000);
        const fps = 30; // Default target
        const frameCount = Math.floor(video.duration * fps);

        resolve({
          type: 'video',
          filename: file.name,
          sourceWidth: video.videoWidth,
          sourceHeight: video.videoHeight,
          frameCount,
          fps,
          durationMs,
        });
        URL.revokeObjectURL(url);
      };

      video.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error(`Failed to read video metadata from ${file.name}`));
      };
    });
  }

  private static async inspectGif(file: File): Promise<MediaSourceInfo> {
    return {
      type: 'gif',
      filename: file.name,
      sourceWidth: 128,
      sourceHeight: 64,
      frameCount: 1,
      fps: 30,
      durationMs: 1000,
    };
  }

  public static async inspectImageSequence(files: File[]): Promise<MediaSourceInfo> {
    // Alphanumeric natural sorting
    files.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    );

    return {
      type: 'sequence',
      filename: files[0]?.name || 'sequence',
      sourceWidth: 128,
      sourceHeight: 64,
      frameCount: files.length,
      fps: 30,
      durationMs: (files.length / 30) * 1000,
    };
  }

  public static async extractFrames(
    _file: File,
    _crop: CropSettings,
    _targetFps: number,
    _onProgress?: (progress: number) => void
  ): Promise<ExtractedFrame[]> {
    // Implementation placeholder populated in Feature F02/F03/F04
    return [];
  }
}
```

### 5.12 `web/src/App.tsx`
Full studio layout wiring Header, DropZone, CropTool, and OledCanvas.

```tsx
import { useState } from 'react';
import { Header } from './components/Header';
import { DropZone } from './components/DropZone';
import { CropTool } from './components/CropTool';
import { OledCanvas } from './components/OledCanvas';
import { CropSettings, MediaSourceInfo } from './types/media';
import { PhosphorTheme } from './types/dither';
import { Play, Pause, SkipBack, SkipForward, RefreshCw, Sliders } from 'lucide-react';

export default function App() {
  const [sourceInfo, setSourceInfo] = useState<MediaSourceInfo | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [targetFps, setTargetFps] = useState<number>(30);
  const [theme, setTheme] = useState<PhosphorTheme>('cyan');

  const [cropSettings, setCropSettings] = useState<CropSettings>({
    mode: 'cover',
    x: 0,
    y: 0,
    width: 128,
    height: 64,
    sourceWidth: 128,
    sourceHeight: 64,
    smoothing: true,
  });

  const handleFilesSelected = (files: File[]) => {
    if (files.length === 0) return;
    const first = files[0];
    setSourceInfo({
      type: first.name.endsWith('.gif') ? 'gif' : files.length > 1 ? 'sequence' : 'video',
      filename: first.name,
      sourceWidth: 1080,
      sourceHeight: 1920,
      frameCount: files.length > 1 ? files.length : 90,
      fps: targetFps,
      durationMs: 3000,
    });
  };

  return (
    <div className="flex flex-col min-h-screen bg-oled-bg text-slate-100">
      <Header
        serialConnected={false}
        onExportClick={() => alert('Feature F18 (C++ Exporter) will be active in Milestone M4.')}
      />

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Media Ingestion & Crop Configuration */}
        <section className="lg:col-span-5 space-y-6">
          <div className="bg-oled-surface border border-oled-border rounded-xl p-4 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
              Media Ingestion (F02–F04)
            </h2>
            <DropZone onFilesSelected={handleFilesSelected} />

            {sourceInfo && (
              <div className="p-3 bg-oled-panel border border-oled-border rounded-lg text-xs font-mono space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>File:</span>
                  <span className="text-oled-cyan truncate max-w-[200px]">{sourceInfo.filename}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Source Res:</span>
                  <span>{sourceInfo.sourceWidth} × {sourceInfo.sourceHeight}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Frames / FPS:</span>
                  <span>{sourceInfo.frameCount} frames @ {sourceInfo.fps} FPS</span>
                </div>
              </div>
            )}
          </div>

          <div className="bg-oled-surface border border-oled-border rounded-xl p-4 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400"></span>
              2:1 Preprocessing (F05)
            </h2>
            <CropTool settings={cropSettings} onChange={setCropSettings} />
          </div>
        </section>

        {/* Right Column: Simulated OLED Display & Timeline Player */}
        <section className="lg:col-span-7 space-y-6 flex flex-col items-center">
          <div className="w-full bg-oled-surface border border-oled-border rounded-xl p-6 flex flex-col items-center space-y-6">
            <div className="flex items-center justify-between w-full border-b border-oled-border/60 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Simulated 128×64 OLED Hardware Panel
              </span>
              <div className="flex items-center space-x-2 text-xs">
                <span className="text-oled-muted">Phosphor:</span>
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as PhosphorTheme)}
                  className="bg-oled-panel border border-oled-border rounded px-2 py-1 text-xs text-slate-200"
                >
                  <option value="cyan">Classic Cyan</option>
                  <option value="white">Crisp White</option>
                  <option value="amber">Amber Glow</option>
                  <option value="green">Matrix Green</option>
                  <option value="yellow-blue">Yellow/Blue Dual</option>
                </select>
              </div>
            </div>

            {/* OLED Hardware Canvas */}
            <div className="py-2">
              <OledCanvas theme={theme} scale={4} />
            </div>

            {/* Timeline Controls */}
            <div className="w-full bg-oled-panel border border-oled-border rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="p-2 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-oled-cyan border border-cyan-500/40 cursor-pointer"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button className="p-2 rounded hover:bg-slate-800 text-slate-400 cursor-pointer">
                    <SkipBack className="w-4 h-4" />
                  </button>
                  <button className="p-2 rounded hover:bg-slate-800 text-slate-400 cursor-pointer">
                    <SkipForward className="w-4 h-4" />
                  </button>
                  <button className="p-2 rounded hover:bg-slate-800 text-slate-400 cursor-pointer">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center space-x-3 text-xs font-mono">
                  <span className="text-slate-400">FPS:</span>
                  {[15, 20, 24, 30].map((rate) => (
                    <button
                      key={rate}
                      onClick={() => setTargetFps(rate)}
                      className={`px-2 py-0.5 rounded cursor-pointer ${
                        targetFps === rate
                          ? 'bg-cyan-500/20 text-oled-cyan border border-cyan-500/40 font-bold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {rate}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scrubber Bar */}
              <div className="flex items-center space-x-3">
                <input
                  type="range"
                  min="0"
                  max="100"
                  defaultValue="0"
                  className="flex-1 accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
                <span className="text-[11px] font-mono text-slate-400">000 / 000</span>
              </div>
            </div>
          </div>

          <div className="w-full bg-oled-surface border border-oled-border rounded-xl p-4 flex items-center justify-between text-xs font-mono text-slate-400">
            <span className="flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-oled-cyan" /> Dithering Engine: Atkinson / Floyd-Steinberg / Bayer (M2)
            </span>
            <span>1024-Byte Row-Major XBMP Buffer</span>
          </div>
        </section>
      </main>
    </div>
  );
}
```

### 5.13 `web/src/main.tsx`
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

---

## 6. Verification Playbook for Implementer Worker

The Implementer Worker must execute the following operations in sequence:

### Step 1: Write All Configuration & Source Files
Write files in `D:\espprojects\oled\web`:
1. `package.json`
2. `vite.config.ts`
3. `tsconfig.json`
4. `tailwind.config.js`
5. `postcss.config.js`
6. `index.html`
7. `.gitignore`
8. `src/index.css`
9. `src/styles/oled.css`
10. `src/types/media.ts`
11. `src/types/dither.ts`
12. `src/types/oled.ts`
13. `src/types/omggif.d.ts`
14. `src/components/Header.tsx`
15. `src/components/DropZone.tsx`
16. `src/components/CropTool.tsx`
17. `src/components/OledCanvas.tsx`
18. `src/engine/mediaDecoder.ts`
19. `src/App.tsx`
20. `src/main.tsx`

### Step 2: Install Node Dependencies
On Windows PowerShell:
```powershell
# In D:\espprojects\oled\web
npm.cmd install
```
*Expected Result*: `added XX packages in ...`, `audit: 0 vulnerabilities`.

### Step 3: Verify TypeScript Compilation (`tsc`)
```powershell
# In D:\espprojects\oled\web
npx.cmd tsc --noEmit
```
*Expected Result*: Exit code `0`, no type errors, no unused variable errors, complete resolution of React, Lucide, and omggif types.

### Step 4: Verify Vite Production Build
```powershell
# In D:\espprojects\oled\web
npm.cmd run build
```
*Expected Result*:
- `vite v5.4.3 building for production...`
- `✓ XX modules transformed.`
- Output generated in `web/dist/`:
  - `dist/index.html`
  - `dist/assets/index-[hash].js`
  - `dist/assets/index-[hash].css`
- Exit code `0`.

---

## 7. Common Pitfalls & Invalidation Conditions

| Condition | Cause | Remediation |
|---|---|---|
| `PSSecurityException: running scripts is disabled` | Running `npm` instead of `npm.cmd` in Windows PowerShell | Always execute `npm.cmd` and `npx.cmd`. |
| `Unknown at-rule @tailwind` | Tailwind v4 installed without PostCSS plugin | Ensure `"tailwindcss": "^3.4.17"` is strictly installed. |
| `Cannot find module 'omggif'` | Missing typings | `src/types/omggif.d.ts` and `@types/omggif` ensure resolution. |
| `vite.config.ts not in project` | `tsconfig.json` include excludes it | Keep `"include": ["src", "vite.config.ts"]` in `tsconfig.json`. |
