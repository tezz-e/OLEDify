# OLED Studio — Dependencies & Build Specification Analysis
**Agent:** `spec_miner_m6_3` (Dependencies & Build Spec Miner)  
**Date:** 2026-09-20  
**Target:** `D:\espprojects\oled\web`

---

## 1. Executive Summary & Baseline Stack Audit

A full audit of `D:\espprojects\oled\web` was conducted to establish baseline build integrity and map out the integration of React Bits components requested in `ORIGINAL_REQUEST.md`.

### 1.1 Baseline Environment & Project Config
- **React Version:** `18.3.1` (`"react": "^18.3.1"`, `"react-dom": "^18.3.1"`)
- **TypeScript:** `5.5.3` (`"typescript": "^5.5.3"`)
- **Vite:** `5.4.3` (`"vite": "^5.4.3"`), `@vitejs/plugin-react@^4.3.1`
- **Tailwind CSS:** `3.4.17` (`"tailwindcss": "^3.4.17"`, PostCSS `8.4.47`, Autoprefixer `10.4.20`)
- **Existing Dependencies:** `esptool-js@^0.6.1`, `lucide-react@^0.475.0`, `mp4box@^2.4.1`, `omggif@^1.0.10`
- **Existing DevDependencies:** `@types/node@^20.16.5`, `@types/omggif@^1.0.5`, `@types/react@^18.3.5`, `@types/react-dom@^18.3.0`, `@types/w3c-web-serial@^1.0.8`
- **Build Script:** `"build": "tsc && vite build"` — **Note:** TypeScript compiler runs strict type checking on all files in `src/` prior to bundling. Any untyped imports or JS syntax errors will abort the build.
- **Baseline Build Verification:** Baseline `cmd.exe /c npm run build` was tested and succeeded cleanly in 11.46s (1647 modules transformed, zero errors).

---

## 2. React Bits Component Dependency & Architecture Matrix

We inspected the authoritative React Bits component source files saved in the local brain archive:
1. `FluidGlass.network-response`
2. `GlassSurface.network-response` + `GlassSurface.css`
3. `LiquidEther.network-response`
4. `OptionWheel.jsx` (step 1338) + `OptionWheel.css` (step 1339)
5. `ClickSpark.jsx` (step 1340)
6. `DecryptedText.jsx` (step 1341)
7. `CountUp.jsx` (step 1342)

| Component | Target Location | Imports & External Packages | Shaders / Rendering Engine | React 18 Compatibility | Recommendation |
|---|---|---|---|---|---|
| **LiquidEther** | `src/components/reactbits/LiquidEther.tsx` | `three` (`^0.186.0`), `@types/three` (`^0.186.0`) | WebGL via Three.js; 9 embedded GLSL raw shader strings (no plugin needed) | 100% Compatible | **Primary Ambient Background** (R3) |
| **GlassSurface** | `src/components/reactbits/GlassSurface.tsx` | **None** (Pure React + SVG) | Inline SVG filter pipeline (`feDisplacementMap`, `feGaussianBlur`) | 100% Compatible | **Primary Depth Accent** (R3) |
| **OptionWheel** | `src/components/reactbits/OptionWheel.tsx` | **None** (Pure React + rAF) | DOM transform & 3D CSS math (`Math.sin`/`cos`), exponential decay rAF | 100% Compatible | **Primary Dropdown Replacement** (R2) |
| **ClickSpark** | `src/components/reactbits/ClickSpark.tsx` | **None** (Pure React + Canvas) | HTML5 2D `<canvas>` with particle animation loop | 100% Compatible | **Primary Action Button Accent** (R2) |
| **DecryptedText** | `src/components/reactbits/DecryptedText.tsx` | `motion` (`^13.4.0`), `framer-motion` (`^13.4.0`) | DOM text scramble ticker + `motion.span` | 100% Compatible | **Primary Status Readout** (R2) |
| **CountUp** | `src/components/reactbits/CountUp.tsx` | `motion` (`^13.4.0`), `framer-motion` (`^13.4.0`) | Spring-based motion value interpolation | 100% Compatible | **Primary Numeric Readout** (R2) |
| **FluidGlass** | *(Alternative)* | `three`, `@react-three/fiber`, `@react-three/drei`, `maath`, external `.glb` models | WebGL via React Three Fiber + Drei MeshTransmissionMaterial | **INCOMPATIBLE** with unpinned npm install (R3F v9 requires React 19) | **Avoid in favor of GlassSurface** |

---

## 3. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|---|---|---|---|---|---|---|
| 1 | Ambient / WebGL | **LiquidEther Fluid Simulation** | High-performance 2D Navier-Stokes fluid simulation with mouse interaction, BFECC advection, auto-demo wandering, and palette texture interpolation | `mouseForce`, `cursorSize`, `isViscous`, `viscous`, `iterationsViscous`, `iterationsPoisson`, `dt`, `BFECC`, `resolution`, `isBounce`, `colors`, `autoDemo`, `autoSpeed`, `autoIntensity`, `backgroundColor`, `lightMode` | Prepended `<canvas>` within wrapping container `<div>` | Safely disposes WebGL context via `forceContextLoss()`, disconnects `ResizeObserver` & `IntersectionObserver` on unmount | `LiquidEther.network-response` |
| 2 | Tactile / Depth | **GlassSurface Refraction Overlay** | Chromatic aberration and blurred glass refraction effect using dynamic SVG displacement map and backdrop filter | `children`, `width`, `height`, `borderRadius`, `borderWidth`, `brightness`, `opacity`, `blur`, `displace`, `saturation`, `distortionScale`, `redOffset`, `greenOffset`, `blueOffset` | Container `<div>` with inline SVG `<filter>` and children content wrapper | Checks `supportsSVGFilters()`; automatically falls back to `.glass-surface--fallback` on Firefox / non-supporting engines | `GlassSurface.network-response` |
| 3 | Tactile Controls | **OptionWheel Cylindrical Picker** | Tactile 3D-curled option wheel selector with inertia drag, wheel scrolling, and audio feedback | `items`, `defaultSelected`, `onChange`, `textColor`, `activeColor`, `side`, `fontSize`, `spacing`, `curve`, `tilt`, `blur`, `fade`, `minOpacity`, `smoothing`, `loop`, `draggable`, `soundUrl` | Interactive scrollable wheel container with dynamically transformed list items | Clamps wheel bounds unless `loop=true`; gracefully ignores missing audio files | `OptionWheel.jsx` (step 1338) |
| 4 | Micro-interactions | **ClickSpark Tactile Action Spark** | Canvas spark bursting micro-interaction emitted upon user click or button trigger | `sparkColor`, `sparkSize`, `sparkRadius`, `sparkCount`, `duration`, `easing`, `extraScale`, `children` | Relative container `<div>` hosting absolute overlay `<canvas>` and wrapped child elements | Disconnects `ResizeObserver` on cleanup; clamps duration and particle bounds | `ClickSpark.jsx` (step 1340) |
| 5 | Hacker Readout | **DecryptedText Scramble Animation** | Cyberpunk/terminal text decryption effect revealing text sequentially or from center | `text`, `speed`, `maxIterations`, `sequential`, `revealDirection`, `useOriginalCharsOnly`, `characters`, `animateOn`, `clickMode` | `<motion.span>` with animated scrambled characters and accessible sr-only text | Clears `setInterval` on unmount; preserves whitespace correctly | `DecryptedText.jsx` (step 1341) |
| 6 | Technical Readout | **CountUp Spring Counter** | Smooth spring-animated numeric counter formatting integers and decimals | `to`, `from`, `direction`, `delay`, `duration`, `startWhen`, `separator`, `onStart`, `onEnd` | `<span>` with formatted numeric spring value | Clamps to valid numbers; handles decimal precision detection automatically | `CountUp.jsx` (step 1342) |
| 7 | Alternative 3D Depth | **FluidGlass 3D Refractive Lens** | Three.js R3F mesh transmission refraction through 3D meshes | `mode`, `lensProps`, `barProps`, `cubeProps`, `backgroundColor`, `textColor` | Three.js R3F Canvas | Fails if `/assets/3d/*.glb` files are missing or React version mismatch | `FluidGlass.network-response` |

---

## 4. Edge Cases Observed & Probed

| # | Feature | Input | Observed Behavior |
|---|---|---|---|
| 1 | **npm install @react-three/fiber** | `npm install @react-three/fiber` with React 18.3.1 | **ERESOLVE Error:** `@react-three/fiber@9.7.0` requires `react@>=19 <19.3`. Fails entire install. |
| 2 | **motion vs framer-motion imports** | `import { motion } from 'motion/react'` with only `framer-motion` installed | **Module Resolution Error:** `framer-motion` exports do NOT include `./react`. Installing `motion@^13.4.0` is mandatory to resolve `motion/react`. |
| 3 | **PowerShell Script Execution** | `npm config get cache` in PowerShell | **PSSecurityException:** `npm.ps1 cannot be loaded because running scripts is disabled`. Commands must be invoked via `cmd.exe /c npm ...` or `npm.cmd`. |
| 4 | **System Drive C: Capacity** | Running write commands on `C:\` | `C:\` has **0.00 GB free**. All work, builds, and npm cache must reside on `D:\` (`D:\npm-cache`, `D:\espprojects\oled\web`). |
| 5 | **LiquidEther Container Zero Size** | Parent element has `0px` width/height | `Common.resize()` enforces `Math.max(1, Math.floor(rect.width))` to prevent WebGL divide-by-zero or 0-sized framebuffers. |
| 6 | **LiquidEther WebGL Context Limit** | Component remounts multiple times (e.g. React StrictMode) | Component invokes `Common.renderer.forceContextLoss()` and removes canvas DOM node on cleanup, preventing WebGL context leaks. |
| 7 | **GlassSurface on Firefox / Safari** | Browser lacking SVG backdrop filter support | Fallback detection triggers `.glass-surface--fallback` CSS with standard semi-opaque background instead of breaking layout. |
| 8 | **TypeScript Strict Build** | Compiling without `@types/three` | `tsc` fails during `npm run build` with `Could not find a declaration file for module 'three'`. Installing `@types/three` fixes this. |
| 9 | **Vite Bundle Chunk Size** | Bundling `three` into monolithic chunk | `three` adds ~600 kB unminified. Rollup may emit chunk size warnings unless chunk limit is adjusted or `manualChunks` is configured. |

---

## 5. Build & Bundling Pitfalls Analysis

### Pitfall 1: React 18 vs React 19 Peer Dependency Conflict (`@react-three/fiber`)
- **Evidence:** Probing `npm info @react-three/fiber peerDependencies` confirmed that the latest version (`v9.7.0`) strictly requires `react: >=19 <19.3`. Running `npm install --dry-run @react-three/fiber` resulted in:
  ```
  npm error code ERESOLVE
  npm error Could not resolve dependency:
  npm error peer react@">=19 <19.3" from @react-three/fiber@9.7.0
  ```
- **Architectural Decision:** `ORIGINAL_REQUEST.md` R3 states: *"Use GlassSurface or FluidGlass sparingly to add depth to specific high-focus elements"*. 
  `GlassSurface` uses 100% native SVG filters with zero external npm dependencies and zero 3D model asset dependencies (`.glb` files). 
  **Strict Recommendation:** Adopt `GlassSurface` instead of `FluidGlass`. If `FluidGlass` were ever required, it would require pinning `@react-three/fiber@^8.18.0` and `@react-three/drei@^9.121.5`, which pulls in 75 additional packages.

### Pitfall 2: `motion/react` Subpath Resolution
- **Evidence:** `DecryptedText` and `CountUp` both import from `'motion/react'`:
  ```javascript
  import { motion } from 'motion/react';
  import { useInView, useMotionValue, useSpring } from 'motion/react';
  ```
  Inspecting `framer-motion` package exports showed that `framer-motion` does NOT export `./react`. 
  The modern unified package `motion` (`v13.4.0`) explicitly provides the `./react` subpath export with full TypeScript types (`./dist/react.d.ts`).
- **Solution:** Install both `motion` and `framer-motion` (`npm install motion framer-motion`).

### Pitfall 3: TypeScript Build Step (`tsc && vite build`)
- **Evidence:** `package.json` specifies `"build": "tsc && vite build"`.
  `tsconfig.json` has `"strict": true`, but currently lacks `"allowJs": true` and `@types/three`.
- **Requirements:**
  1. Install `@types/three` in `devDependencies`.
  2. Write all integrated React Bits components as clean `.tsx` files with explicit TypeScript interfaces.
  3. Ensure `tsconfig.json` includes `"allowJs": true` in `compilerOptions` as a safety net.
  4. Create `src/vite-env.d.ts` with `/// <reference types="vite/client" />` so CSS and Vite asset imports are recognized without type errors.

### Pitfall 4: Three.js Shaders, Canvas Mounting, and WebGL Lifecycle
- **Evidence:** `LiquidEther` embeds all shaders directly as GLSL multiline template literals (`advection_frag`, `color_frag`, `poisson_frag`, etc.) passed to `new THREE.RawShaderMaterial()`.
- **Finding:** No Vite GLSL loader (such as `vite-plugin-glsl`) is required.
- **Canvas & DOM Access:** All Three.js renderer instantiation, DOM mounting (`container.prepend(renderer.domElement)`), event listeners (`mousemove`, `touchmove`, `resize`), and animation frames run strictly inside React `useEffect` hooks. There is **zero top-level window/document execution**, ensuring 100% SSR/build-time safety.
- **Cleanup Guarantee:** On unmount, the component properly cancels `requestAnimationFrame`, disconnects `ResizeObserver` and `IntersectionObserver`, and calls `renderer.forceContextLoss()`.

### Pitfall 5: Windows Host Environment Constraints
- **Execution Policy:** PowerShell blocks `.ps1` script execution (`npm.ps1 cannot be loaded`). Workers must execute commands via `npm.cmd` or `cmd.exe /c npm ...`.
- **Disk Space Allocation:** `C:\` has 0.00 GB free, while `D:\` has 62.19 GB free. The global npm cache is verified to be set to `D:\npm-cache`. All operations must remain scoped to `D:\espprojects\oled\web`.

---

## 6. Exact npm Installation Specification

To support the full suite of React Bits components without dependency conflicts or peer resolution failures, execute the following commands in `D:\espprojects\oled\web`:

```cmd
cmd.exe /c "npm install --save three motion framer-motion"
cmd.exe /c "npm install --save-dev @types/three"
```

### Dry-Run Verification Result
- `npm install --dry-run --save three motion framer-motion`: **SUCCESS (added 5 packages in 2s, exit code 0)**
- `npm install --dry-run --save-dev @types/three`: **SUCCESS (added 7 packages in 1s, exit code 0)**

---

## 7. Configuration Specifications

### 7.1 Vite Configuration (`D:\espprojects\oled\web\vite.config.ts`)
To eliminate Rollup chunk size warnings and ensure clean vendor chunking:

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
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          motion: ['motion', 'framer-motion'],
        },
      },
    },
  },
});
```

### 7.2 TypeScript Configuration (`D:\espprojects\oled\web\tsconfig.json`)
Add `"allowJs": true` to compiler options:

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
    "allowJs": true,
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

### 7.3 Vite Client Declaration (`D:\espprojects\oled\web\src\vite-env.d.ts`)
Create this file if not already present:
```typescript
/// <reference types="vite/client" />
```

### 7.4 Tailwind & Blueprint Aesthetic Configuration
The existing `tailwind.config.js` already includes the full blueprint palette:
- `parchment`: `#F5F0EB`
- `ink`: `#1A1A1A`
- `ink-light`: `#6B6B6B`
- `accent`: `#E85D2A`
- `accent-dark`: `#C94E22`
- `fontFamily.mono`: `['IBM Plex Mono', 'monospace']`

**React Bits Styling Rules for Blueprint Fidelity:**
1. **OptionWheel:** 
   - Set `--ow-text-color: #6B6B6B;`
   - Set `--ow-active-color: #E85D2A;`
   - Apply `font-mono border-2 border-ink bg-parchment`
2. **ClickSpark:**
   - Set `sparkColor="#E85D2A"` or `sparkColor="#1A1A1A"`
   - Set `sparkSize={8}` and `sparkRadius={20}` for crisp technical bursts
3. **DecryptedText:**
   - Apply `font-mono text-ink tracking-wider`
   - Use technical glyph set: `"0123456789ABCDEF_>#*"`
4. **CountUp:**
   - Apply `font-mono font-bold text-ink`
5. **LiquidEther:**
   - Constrain strictly to the OLED canvas container or sub-canvas preview backing
   - Use blueprint-tuned palette stops: `['#1A1A1A', '#E85D2A', '#F5F0EB']` with `lightMode={true}` and `backgroundColor="#F5F0EB"` (avoid neon cyberpunk purples)
6. **GlassSurface:**
   - Restrict to panel header badges or inspector overlays
   - Use sharp `borderRadius={0}` or `borderRadius={2}` to maintain brutalist edges, NOT pill-shaped rounded glass.

---

## 8. Summary of Action Items for Implementation Team

1. **Install Dependencies:**
   Run `cmd.exe /c "npm install --save three motion framer-motion && npm install --save-dev @types/three"` in `D:\espprojects\oled\web`.
2. **Apply Config Updates:**
   - Update `vite.config.ts` with `manualChunks` and `chunkSizeWarningLimit: 1200`.
   - Update `tsconfig.json` with `"allowJs": true`.
   - Ensure `src/vite-env.d.ts` exists.
3. **Component Placement:**
   Save clean TypeScript implementations into `D:\espprojects\oled\web\src\components/reactbits/` (`LiquidEther.tsx`, `GlassSurface.tsx`, `OptionWheel.tsx`, `ClickSpark.tsx`, `DecryptedText.tsx`, `CountUp.tsx`) alongside their CSS files.
4. **Build Verification:**
   Run `cmd.exe /c npm run build` and ensure exit code 0 with zero warnings.
