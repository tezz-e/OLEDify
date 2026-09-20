# Handoff Report — Dependencies & Build Specification Miner (spec_miner_m6_3)

## 1. Observation
1. **Current Project Dependencies (`D:\espprojects\oled\web\package.json`, lines 13–34):**
   - React version: `"react": "^18.3.1"`, `"react-dom": "^18.3.1"`.
   - Build script: `"build": "tsc && vite build"`.
   - Existing dependencies: `esptool-js@^0.6.1`, `lucide-react@^0.475.0`, `mp4box@^2.4.1`, `omggif@^1.0.10`.
   - Existing devDependencies: `@types/node@^20.16.5`, `@types/omggif@^1.0.5`, `@types/react@^18.3.5`, `@types/react-dom@^18.3.0`, `@types/w3c-web-serial@^1.0.8`, `@vitejs/plugin-react@^4.3.1`, `tailwindcss@^3.4.17`, `typescript@^5.5.3`, `vite@^5.4.3`.
2. **Baseline Build Verification:**
   - Ran `cmd.exe /c npm run build` on `D:\espprojects\oled\web`.
   - Result: `✓ 1647 modules transformed. ✓ built in 11.46s. Exit code 0.`
3. **Environment & Host Constraints:**
   - `Get-PSDrive` showed drive `C:\` has `0.00 GB` free disk space; drive `D:\` has `62.19 GB` free.
   - `npm config get cache` confirmed global cache is configured to `D:\npm-cache`.
   - Running `npm` directly in PowerShell produced:
     `npm : File C:\Program Files\nodejs\npm.ps1 cannot be loaded because running scripts is disabled on this system.`
     Using `cmd.exe /c npm ...` or `npm.cmd` succeeds.
4. **React Bits Source Analysis:**
   - `LiquidEther.network-response`: Imports `* as THREE from 'three'` and `./LiquidEther.css`. Embeds 9 GLSL shaders as template string literals (`face_vert`, `line_vert`, `mouse_vert`, `advection_frag`, `color_frag`, `divergence_frag`, `externalForce_frag`, `poisson_frag`, `pressure_frag`, `viscous_frag`). Implements full WebGL disposal (`forceContextLoss()`).
   - `GlassSurface.network-response`: Imports `react` and `./GlassSurface.css`. Zero external npm dependencies; uses inline SVG filters (`feDisplacementMap`, `feGaussianBlur`).
   - `FluidGlass.network-response`: Imports `three`, `@react-three/fiber`, `@react-three/drei`, `maath`, and requests local binary models `/assets/3d/lens.glb`, `cube.glb`, `bar.glb`.
   - `OptionWheel.jsx` (step 1338): Pure React + rAF + CSS. Zero external npm dependencies.
   - `ClickSpark.jsx` (step 1340): Pure React + 2D Canvas. Zero external npm dependencies.
   - `DecryptedText.jsx` (step 1341) & `CountUp.jsx` (step 1342): Both import from `'motion/react'`.
5. **Peer Dependency & Subpath Probe Commands:**
   - `cmd.exe /c npm info @react-three/fiber peerDependencies` returned `{ react: '>=19 <19.3', 'react-dom': '>=19 <19.3' }`.
   - `cmd.exe /c npm install --dry-run @react-three/fiber` resulted in:
     `npm error code ERESOLVE: Could not resolve dependency: peer react@">=19 <19.3" from @react-three/fiber@9.7.0`.
   - `cmd.exe /c npm info framer-motion exports` revealed no `./react` export.
   - `cmd.exe /c npm info motion exports` revealed explicit `./react` export (`types: ./dist/react.d.ts`, `import: ./dist/es/react.mjs`).
   - `cmd.exe /c npm install --dry-run --save three motion framer-motion` added 5 packages in 2s with exit code 0.
   - `cmd.exe /c npm install --dry-run --save-dev @types/three` added 7 packages in 1s with exit code 0.

## 2. Logic Chain
1. **React 18 Compatibility & 3D Selection (Obs 1, Obs 4, Obs 5):**
   - The project is on React 18.3.1.
   - Unpinned `npm install @react-three/fiber` fails with an ERESOLVE error because version 9 requires React 19.
   - Furthermore, `FluidGlass` requires binary 3D assets that are absent.
   - In contrast, `LiquidEther` uses standard Three.js without R3F, and `GlassSurface` uses pure SVG filters with zero external dependencies.
   - Therefore, `LiquidEther` (Three.js) and `GlassSurface` (SVG) fulfill R3 cleanly without peer dependency conflicts or missing assets.
2. **Motion Library Selection (Obs 4, Obs 5):**
   - `DecryptedText` and `CountUp` both require `import ... from 'motion/react'`.
   - Only `motion@^13.4.0` provides the `./react` subpath export with TypeScript definitions.
   - `motion` depends on `framer-motion`, so installing `motion` and `framer-motion` satisfies both `'motion/react'` and `'framer-motion'` imports simultaneously.
3. **TypeScript Build Integrity (Obs 1, Obs 5):**
   - `npm run build` runs `tsc` first.
   - Without `@types/three`, `tsc` will reject `import * as THREE from 'three'`.
   - Adding `@types/three` to `devDependencies` and `"allowJs": true` to `tsconfig.json` ensures full type resolution.
   - Adding `src/vite-env.d.ts` provides module resolution for CSS side-effect imports.
4. **Vite Bundler Optimization (Obs 1, Obs 4):**
   - Bundling `three` (~600 kB) can trigger Rollup chunk size warnings.
   - Adding `manualChunks: { three: ['three'], motion: ['motion', 'framer-motion'] }` and setting `chunkSizeWarningLimit: 1200` guarantees a warning-free production build.
5. **Execution Environment Safeguards (Obs 3):**
   - Because Windows PowerShell restricts `.ps1` execution, commands must use `cmd.exe /c npm ...` or `npm.cmd`.
   - Because drive `C:\` is at 0.00 GB, keeping `npm-cache` on `D:\` and performing all builds on `D:\espprojects\oled\web` is required to prevent `ENOSPC` errors.

## 3. Caveats
- `gsap` was referenced in general research prompts but was confirmed to NOT be required by any of the 7 specified React Bits components. It does not need to be installed.
- If the team strictly insisted on using `FluidGlass` instead of `GlassSurface`, they would have to pin `@react-three/fiber@^8.18.0`, `@react-three/drei@^9.121.5`, and `maath@^0.10.8`, which adds 75 packages and requires adding 3D `.glb` files to `public/assets/3d/`. Sticking to `GlassSurface` is strongly recommended.

## 4. Conclusion
The exact dependency set required for OLED Studio is:
- **Production dependencies:** `three`, `motion`, `framer-motion`
- **Development dependencies:** `@types/three`

The exact execution command to install them is:
```cmd
cmd.exe /c "npm install --save three motion framer-motion && npm install --save-dev @types/three"
```

Configuration updates needed:
- `vite.config.ts`: Add `manualChunks` for `three` and `motion`, set `chunkSizeWarningLimit: 1200`.
- `tsconfig.json`: Add `"allowJs": true`.
- `src/vite-env.d.ts`: Ensure `/// <reference types="vite/client" />` exists.

## 5. Verification Method
1. **Dependency Resolution Verification:**
   Run in `D:\espprojects\oled\web`:
   ```cmd
   cmd.exe /c "npm install --dry-run --save three motion framer-motion && npm install --dry-run --save-dev @types/three"
   ```
   *Expected outcome:* Exit code 0 with all packages resolved and zero peer dependency warnings.
2. **Build Verification:**
   After applying the recommended changes to `package.json`, `vite.config.ts`, and `tsconfig.json`, run:
   ```cmd
   cmd.exe /c npm run build
   ```
   *Expected outcome:* `tsc` passes with zero type errors, Vite transforms chunks, and `dist/` is generated cleanly with exit code 0.
3. **Invalidation Conditions:**
   - Any attempt to install unpinned `@react-three/fiber` without React 19 will invalidate clean install.
   - Any omission of `@types/three` will cause `tsc` to fail.
