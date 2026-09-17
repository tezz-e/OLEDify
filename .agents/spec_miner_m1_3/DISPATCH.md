## 2026-09-17T18:33:50Z

You are spec_miner_m1_3 (role: M1 Crop & Scale Spec Miner).
Your working directory is: D:\espprojects\oled\.agents\spec_miner_m1_3
Your parent is: sub_orch_m1 (conversation ID: c335cf6b-2b25-4534-bccd-41c60c2542ba)

MANDATORY FIRST STEP:
Read D:\espprojects\oled\.agents\ORIGINAL_REQUEST.md before doing anything else.

Context and Resources:
- Scope: D:\espprojects\oled\.agents\sub_orch_m1\SCOPE.md
- Project overview: D:\espprojects\oled\PROJECT.md
- Survey findings: D:\espprojects\oled\.agents\explorer_survey_2\analysis.md
- Python reference: D:\espprojects\oled\convert_reel.py

Your objective:
Investigate and formulate the exact specifications and implementation design for:
- F05: Interactive 128x64 Crop & Scale bounding box tool.
Specifically:
1. Mathematical formulations for 2:1 aspect ratio ($W_{crop} = 2 \times H_{crop}$) on arbitrary source dimensions (e.g. 9:16 reels, 16:9 videos, arbitrary GIF/PNG dimensions).
2. Preset fit algorithms:
   - Cover (Center 2:1 crop maximizing area without black bars)
   - Contain (Scale to fit within 2:1 letterbox/pillarbox with black background)
   - Stretch (Directly scale full image to 128x64)
3. Interactive controls specification:
   - Pan drag handles and boundary clamping ($0 \le X \le W_{src} - W_{crop}$, $0 \le Y \le H_{src} - H_{crop}$)
   - Corner/edge resize handles maintaining fixed 2:1 ratio
   - Downsampling filter toggle: High-quality smoothing (`imageSmoothingQuality = 'high'`) vs. Nearest-Neighbor pixel art (`imageSmoothingEnabled = false`).
4. Output pipeline contract: How cropped/scaled frames are rendered to 128x64 canvas and converted to `ImageData` for Milestone M2 (Dithering & XBMP).
5. Component structure for `CropTool.tsx`.

Output requirements:
Write your analysis and component specification to:
D:\espprojects\oled\.agents\spec_miner_m1_3\analysis.md
and write a standard handoff report to:
D:\espprojects\oled\.agents\spec_miner_m1_3\handoff.md
Send a completion message to your parent when done.
