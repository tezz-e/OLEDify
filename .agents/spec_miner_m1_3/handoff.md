# Handoff Report: F05 Interactive 128×64 Crop & Scale Specification

**Agent**: `spec_miner_m1_3` (M1 Crop & Scale Spec Miner)  
**Parent**: `sub_orch_m1` (Conversation ID: `c335cf6b-2b25-4534-bccd-41c60c2542ba`)  
**Target Milestone**: Milestone 1 (Web Studio Foundation & Media Ingestion)  
**Deliverable**: `D:\espprojects\oled\.agents\spec_miner_m1_3\analysis.md`

---

## 1. Observation

1. **Requirements & Scope Directives**:
   - `D:\espprojects\oled\.agents\ORIGINAL_REQUEST.md`, Line 26: `"Interactive 128×64 crop & scale bounding box tool."`
   - `D:\espprojects\oled\.agents\sub_orch_m1\SCOPE.md`, Lines 27–32:
     ```
     |  +-----------------------------------------------------------------------------+  |
     |  |                     Interactive 2:1 Crop & Scale Tool                       |  |
     |  |  - Fixed 2:1 aspect ratio bounding box (W_crop = 2 * H_crop)                |  |
     |  |  - Presets: Cover (Center 2:1), Contain (Letterbox/Pillarbox), Stretch      |  |
     |  |  - Interactive pan/scale drag handles                                       |  |
     |  |  - High quality bicubic vs nearest-neighbor (pixel art) toggle             |  |
     |  +-----------------------------------------------------------------------------+  |
     ```
   - `D:\espprojects\oled\.agents\sub_orch_m1\SCOPE.md`, Lines 73–84:
     ```typescript
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

2. **Reference Implementation Observation**:
   - `D:\espprojects\oled\convert_reel.py`, Lines 55–69:
     ```python
     target_aspect = target_w / target_h  # 2.0
     orig_aspect = orig_w / orig_h        # 0.5625 for 9:16 vertical reel
     
     if mode == 'crop':
         # Crop vertical video to 2:1 width-to-height ratio centered
         crop_h = int(orig_w / target_aspect)
         crop_w = orig_w
         if crop_h > orig_h:
             crop_h = orig_h
             crop_w = int(orig_h * target_aspect)
         
         crop_x = (orig_w - crop_w) // 2
         crop_y = (orig_h - crop_h) // 2
         print(f"Crop box: x={crop_x}, y={crop_y}, w={crop_w}, h={crop_h}")
     ```
   - `D:\espprojects\oled\convert_reel.py`, Line 88:
     ```python
     resized = cv2.resize(cropped, (target_w, target_h), interpolation=cv2.INTER_AREA)
     ```

3. **Empirical Media Probe**:
   - Executed `py -c "import cv2; cap = cv2.VideoCapture('igexport-DckvRqKPsI_.mp4'); print('W:', cap.get(cv2.CAP_PROP_FRAME_WIDTH), 'H:', cap.get(cv2.CAP_PROP_FRAME_HEIGHT), 'FPS:', cap.get(cv2.CAP_PROP_FPS), 'Frames:', cap.get(cv2.CAP_PROP_FRAME_COUNT))"` on the repository's sample video `igexport-DckvRqKPsI_.mp4`:
     ```
     W: 720.0 H: 1280.0 FPS: 30.0 Frames: 466.0
     ```
   - For this video:
     - $W_{src} = 720, H_{src} = 1280, R_{src} = 720/1280 = 0.5625$
     - Cover crop: $W_{crop} = 720, H_{crop} = 360, X_{crop} = 0, Y_{crop} = (1280 - 360)/2 = 460$.
     - Contain scale: $s = \min(128/720, 64/1280) = 0.05 \implies 36 \times 64$ centered, $dx = 46, dy = 0$.

4. **Frame Contract Observation**:
   - `D:\espprojects\oled\PROJECT.md`, Lines 100–111:
     - Destination display: strictly 128×64 pixels.
     - Row-major LSB-first XBMP 1024-byte layout.

---

## 2. Logic Chain

1. **Aspect Ratio Preservation**:
   - Physical OLED displays target $128 \times 64$ pixels (Observation 4).
   - $128 / 64 = 2.0$. Thus, any crop window extracted from arbitrary media must scale into a 2:1 viewport without distortion unless Stretch mode is explicitly chosen.
   - For an arbitrary source $(W_{src}, H_{src})$, if $W_{src} / H_{src} \le 2.0$ (e.g. 9:16 reels, 1:1 square art, or 16:9 widescreen), width is the limiting dimension. Cover crop maximizes area by setting $W_{crop} = W_{src}$ and $H_{crop} = W_{crop} / 2$, centering vertically: $Y_{crop} = (H_{src} - H_{crop})/2$.
   - This directly mirrors and generalizes the reference behavior observed in `convert_reel.py` (Observation 2).

2. **Odd Parity & Antialiasing Prevention**:
   - Canvas `ctx.drawImage` with fractional subpixel source rectangles induces bilinear edge blurring.
   - To guarantee integer pixel coordinates, $W_{crop}$ must be constrained to even integers ($W_{crop} \in 2\mathbb{Z}^+$), which mathematically guarantees $H_{crop} = W_{crop} / 2$ is an exact integer.

3. **Fluid 8-Handle Resizing via Orthogonal Least-Squares Projection**:
   - Locking aspect ratio during mouse resizing requires projecting cursor displacement $(d_x, d_y)$ onto the 2:1 aspect vector $\vec{v} = (2, 1)$.
   - Minimizing Euclidean error $E(H) = (2H - d_x)^2 + (H - d_y)^2$ yields $\frac{dE}{dH} = 10H - 4d_x - 2d_y = 0 \implies H = \frac{2d_x + d_y}{5}$.
   - This provides completely smooth, jitter-free cursor tracking across all 4 corner handles and 4 edge handles while strictly preserving $W = 2H$.

4. **Contain vs Cover vs Stretch Rendering Pipeline**:
   - Direct translation into `renderCropTo128x64()` produces standardized $128 \times 64$ `ImageData` ($32,768$ bytes) using HTML5 Canvas 2D context.
   - High-quality bicubic filtering (`imageSmoothingQuality = 'high'`) downsamples high-res video frames without moiré artifacts.
   - Disabling smoothing (`imageSmoothingEnabled = false`) preserves razor-sharp single-pixel art edges for Aseprite sprites.

---

## 3. Caveats

1. **GPU Acceleration Variance**:
   - Browser implementations of `imageSmoothingQuality = 'high'` differ slightly across engines (Skia on Blink/Chromium vs CoreGraphics on WebKit vs Moz2D on Gecko), though all implement multi-tap bicubic or Lanczos decimation.
2. **Subpixel CSS Viewport Scaling**:
   - In CSS layouts where the preview container size is not an integer pixel multiple of the source media, mouse event coordinates (`e.clientX, e.clientY`) must be transformed using `container.getBoundingClientRect()` to compute the exact scale factor $S_{ui}$.
3. **Downstream Dithering Scope**:
   - Milestone M1 produces the standardized 128×64 `ImageData`; conversion to 1-bit monochrome and 1024-byte XBMP packing is handled in Milestone M2 (`ditherEngine.ts` and `xbmpPacker.ts`).

---

## 4. Conclusion

The specification for **F05: Interactive 128×64 Crop & Scale Tool** is fully documented in `analysis.md` with:
- Closed-form mathematical models for 2:1 aspect ratio locking and clamping on arbitrary resolutions.
- Exact algorithmic definitions for Cover, Contain, and Stretch presets.
- Complete orthogonal least-squares equations for all 8 resize handles, center pan drag, and mouse wheel zoom.
- Formal canvas rendering pipeline contract producing $128 \times 64$ `ImageData` for Milestone M2.
- Clean component architecture for `CropTool.tsx` and utility module `cropEngine.ts`.

---

## 5. Verification Method

1. **Mathematical Invariant Verification**:
   - Inspect `analysis.md` §4 and verify Cover and Contain algorithms against:
     - 720×1280 (9:16 reel): Cover $\to 720\times 360$ at $(0, 460)$; Contain $\to 36 \times 64$ at $(46, 0)$.
     - 1920×1080 (16:9 video): Cover $\to 1920 \times 960$ at $(0, 60)$; Contain $\to 114 \times 64$ at $(7, 0)$.
     - 2560×1080 (21:9 ultrawide): Cover $\to 2160 \times 1080$ at $(200, 0)$; Contain $\to 128 \times 54$ at $(0, 5)$.
2. **Python Reference Validation**:
   - Compare `analysis.md` §4.1 with `convert_reel.py` lines 58–68. Confirm identical coordinate outputs for 720×1280 video.
3. **Handle Formula Orthogonality**:
   - Test $\vec{d} = (200, 100)$: $H = (2(200) + 100)/5 = 100, W = 200$. Confirm exact aspect match.
