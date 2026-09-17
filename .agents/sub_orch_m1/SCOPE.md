# Scope: Milestone M1 — Web Studio Foundation & Media Ingestion

## Architecture
Milestone M1 establishes the client-side Web Studio application in `web/` using Vite, React 18, TypeScript, and Tailwind CSS. It implements the entire ingestion and preprocessing pipeline for animated visual assets before they hit the dithering and packing engine in M2.

```
+-----------------------------------------------------------------------------------+
|                            Web Studio (Milestone M1)                              |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  |                             DropZone Component                              |  |
|  |  Accepts:                                                                   |  |
|  |  - Video: MP4, WebM (HTML5 video element + canvas frame extraction)         |  |
|  |  - GIF: Animated GIF (omggif parser -> frames, delays, disposal modes)      |  |
|  |  - Sequence: Multiple PNGs / JPEGs (natural alphanumeric sort + bitmap)     |  |
|  +-----------------------------------------------------------------------------+  |
|                                        |                                          |
|                                        v                                          |
|  +-----------------------------------------------------------------------------+  |
|  |                 Raw Decoded Media Stream (FrameBuffer / State)              |  |
|  |  - Array of raw frame canvases / ImageData or ImageBitmaps                  |  |
|  |  - Original resolution (W_src x H_src), durations/FPS, frame timestamps    |  |
|  +-----------------------------------------------------------------------------+  |
|                                        |                                          |
|                                        v                                          |
|  +-----------------------------------------------------------------------------+  |
|  |                     Interactive 2:1 Crop & Scale Tool                       |  |
|  |  - Fixed 2:1 aspect ratio bounding box (W_crop = 2 * H_crop)                |  |
|  |  - Presets: Cover (Center 2:1), Contain (Letterbox/Pillarbox), Stretch      |  |
|  |  - Interactive pan/scale drag handles                                       |  |
|  |  - High quality bicubic vs nearest-neighbor (pixel art) toggle             |  |
|  +-----------------------------------------------------------------------------+  |
|                                        |                                          |
|                                        v                                          |
|  +-----------------------------------------------------------------------------+  |
|  |                Normalized 128x64 Grayscale/RGBA Frames Ready                |  |
|  |  - Scaled precisely to 128x64                                               |  |
|  |  - Ready for M2 Dithering & Binary XBMP Packing                             |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
```

## Feature Inventory
| # | Feature | Description | Status |
|---|---------|-------------|--------|
| F01 | Web Studio Project Setup | Vite + React + TypeScript + Tailwind CSS structure in `web/` with full build pipeline | PLANNED |
| F02 | Video Drag & Drop Decoder | HTML5 `<video>` client-side seek loop extracting frames onto canvas at target FPS | PLANNED |
| F03 | Animated GIF Decoder | `omggif` binary parsing extracting individual frames, delays, and canvas disposal modes | PLANNED |
| F04 | PNG Sequence Loader | Multi-file loader with natural collation sorting (`localeCompare({numeric: true})`) | PLANNED |
| F05 | Interactive 2:1 Crop & Scale | Fixed 2:1 aspect ratio bounding box with Cover, Contain, Stretch presets and drag controls | PLANNED |

## Interface Contracts

### 1. Ingestion Engine ↔ Downstream Pipeline (`types/media.ts`)
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

### 2. Code Layout (`web/`)
- `web/package.json`
- `web/vite.config.ts`
- `web/tsconfig.json`
- `web/tailwind.config.js`
- `web/postcss.config.js`
- `web/index.html`
- `web/src/main.tsx`
- `web/src/App.tsx`
- `web/src/types/media.ts`
- `web/src/engine/mediaDecoder.ts` (Video, GIF via omggif, PNG sequence)
- `web/src/components/DropZone.tsx`
- `web/src/components/CropTool.tsx`
- `web/src/components/MediaPreview.tsx`
