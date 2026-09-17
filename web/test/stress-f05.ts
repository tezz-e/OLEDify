/**
 * Empirical Adversarial Stress Test Suite for Feature F05
 * 2:1 Crop & Scale Math Engine
 *
 * Tester: challenger_m1_2 (M1 Crop & Scale Boundary Challenger)
 */

import assert from 'node:assert/strict';
import {
  computeCoverCrop,
  computeContainDestRect,
  clampCropToBounds,
  resizeCropWithHandle,
  zoomCropAroundPoint,
  renderCropTo128x64,
  ResizeHandle,
  OLED_TARGET_WIDTH,
  OLED_TARGET_HEIGHT,
  OLED_TARGET_ASPECT,
} from '../src/engine/cropEngine.ts';
import { CropSettings } from '../src/types/media.ts';

interface TestFailure {
  testId: string;
  category: string;
  description: string;
  input: any;
  output: any;
  violation: string;
}

const failures: TestFailure[] = [];

function recordFailure(
  testId: string,
  category: string,
  description: string,
  input: any,
  output: any,
  violation: string
) {
  const failure: TestFailure = {
    testId,
    category,
    description,
    input,
    output,
    violation,
  };
  failures.push(failure);
  console.error(`[FAIL] ${testId}: ${description}`);
  console.error(`       Input:`, JSON.stringify(input));
  console.error(`       Output:`, JSON.stringify(output));
  console.error(`       Violation: ${violation}\n`);
}

console.log('================================================================');
console.log('=== STARTING ADVERSARIAL STRESS HARNESS: FEATURE F05 ENGINE ===');
console.log('================================================================\n');

// =============================================================================
// TEST SUITE 1: Extreme Aspect Ratios & Boundary Dimensions in computeCoverCrop
// =============================================================================
console.log('>>> Running Suite 1: computeCoverCrop on Extreme Aspect Ratios...');

const extremeDimensions = [
  // 1:1000 slivers
  { w: 1, h: 1000, label: '1:1000 extreme vertical sliver' },
  { w: 2, h: 2000, label: '2:2000 extreme vertical sliver' },
  { w: 3, h: 3000, label: '3:3000 odd extreme vertical sliver' },

  // 1000:1 slivers
  { w: 1000, h: 1, label: '1000:1 extreme horizontal sliver' },
  { w: 2000, h: 2, label: '2000:2 extreme horizontal sliver' },
  { w: 3000, h: 3, label: '3000:3 odd extreme horizontal sliver' },

  // 9:16 vertical reels
  { w: 720, h: 1280, label: '9:16 Instagram Reel 720x1280' },
  { w: 1080, h: 1920, label: '9:16 Full HD Reel 1080x1920' },
  { w: 1440, h: 2560, label: '9:16 2K Reel 1440x2560' },

  // Ultrawide
  { w: 2560, h: 1080, label: '21:9 Ultrawide 2560x1080' },
  { w: 3440, h: 1440, label: '21:9 QHD Ultrawide 3440x1440' },
  { w: 5120, h: 1440, label: '32:9 Super Ultrawide 5120x1440' },

  // Odd dimensions
  { w: 13, h: 17, label: 'Odd prime dimensions 13x17' },
  { w: 721, h: 1281, label: 'Odd reel dimensions 721x1281' },
  { w: 127, h: 63, label: 'Target minus 1 odd 127x63' },
  { w: 129, h: 65, label: 'Target plus 1 odd 129x65' },

  // Degenerate & tiny
  { w: 1, h: 1, label: 'Single pixel 1x1' },
  { w: 2, h: 1, label: 'Exact 2:1 single cell 2x1' },
  { w: 1, h: 2, label: 'Vertical cell 1x2' },
  { w: 4, h: 2, label: 'Small 2:1 cell 4x2' },
  // Uninitialized / zero dimension sources (media loading)
  { w: 0, h: 0, label: 'Uninitialized 0x0 media' },
  { w: 0, h: 100, label: 'Zero width 0x100 media' },
  { w: 100, h: 0, label: 'Zero height 100x0 media' },
];

for (const dim of extremeDimensions) {
  const crop = computeCoverCrop(dim.w, dim.h);
  const contain = computeContainDestRect(dim.w, dim.h);

  // Check for NaN propagation
  if (Number.isNaN(crop.x) || Number.isNaN(crop.y) || Number.isNaN(crop.width) || Number.isNaN(crop.height)) {
    recordFailure('T1-COV-NAN', 'computeCoverCrop', `${dim.label} produced NaN`, dim, crop, 'NaN coordinate or dimension in cover crop');
  }
  if (Number.isNaN(contain.dx) || Number.isNaN(contain.dy) || Number.isNaN(contain.dw) || Number.isNaN(contain.dh)) {
    recordFailure('T1-CNT-NAN', 'computeContainDestRect', `${dim.label} produced NaN in contain rect`, dim, contain, 'NaN coordinate or dimension in contain destination rect');
  }

  // Invariant 1: Dimensions must be >= 0
  if (crop.width < 0 || crop.height < 0) {
    recordFailure('T1-COV-NEG', 'computeCoverCrop', `${dim.label} negative dimension`, dim, crop, 'Width or height is negative');
  }

  // Invariant 2: Non-degenerate box (width > 0, height > 0)
  if (crop.width === 0 || crop.height === 0) {
    recordFailure('T1-COV-ZERO', 'computeCoverCrop', `${dim.label} produced zero dimension (degenerate)`, dim, crop, 'Width or height is 0, which crashes Canvas drawImage');
  }

  // Invariant 3: W == 2 * H
  if (crop.width !== 2 * crop.height) {
    recordFailure('T1-COV-ASPECT', 'computeCoverCrop', `${dim.label} aspect ratio violation`, dim, crop, `Width ${crop.width} != 2 * Height ${crop.height}`);
  }

  // Invariant 4: Within boundaries
  if (crop.x < 0 || crop.y < 0 || crop.x + crop.width > dim.w || crop.y + crop.height > dim.h) {
    recordFailure('T1-COV-BOUND', 'computeCoverCrop', `${dim.label} boundary violation`, dim, crop, `Box [${crop.x}, ${crop.y}, ${crop.width}, ${crop.height}] exceeds [0, 0, ${dim.w}, ${dim.h}]`);
  }
}

// =============================================================================
// TEST SUITE 2: Boundary Clamping with clampCropToBounds
// =============================================================================
console.log('>>> Running Suite 2: clampCropToBounds boundary stress tests...');

const clampTestCases = [
  // Normal cases
  { src: { w: 800, h: 600 }, crop: { x: 100, y: 100, width: 200, height: 100 }, label: 'Normal within bounds' },

  // Negative origin
  { src: { w: 800, h: 600 }, crop: { x: -50, y: -50, width: 200, height: 100 }, label: 'Negative origin (-50, -50)' },

  // Far positive origin
  { src: { w: 800, h: 600 }, crop: { x: 900, y: 700, width: 200, height: 100 }, label: 'Far positive origin (900, 700)' },

  // Oversized box
  { src: { w: 800, h: 600 }, crop: { x: 0, y: 0, width: 2000, height: 1000 }, label: 'Oversized box (2000x1000)' },

  // Fractional coordinates
  { src: { w: 800, h: 600 }, crop: { x: 10.7, y: 20.3, width: 201.6, height: 100.8 }, label: 'Fractional coordinates' },

  // Small source height: height < 4
  { src: { w: 1000, h: 2 }, crop: { x: 0, y: 0, width: 100, height: 50 }, label: 'Small source height (1000x2, H < 4)' },
  { src: { w: 1000, h: 3 }, crop: { x: 0, y: 0, width: 100, height: 50 }, label: 'Small source height (1000x3, H < 4)' },
  { src: { w: 1000, h: 1 }, crop: { x: 0, y: 0, width: 100, height: 50 }, label: 'Single line height (1000x1)' },

  // Small source width: width < 8
  { src: { w: 2, h: 1000 }, crop: { x: 0, y: 0, width: 100, height: 50 }, label: 'Small source width (2x1000, W < 8)' },
  { src: { w: 4, h: 1000 }, crop: { x: 0, y: 0, width: 100, height: 50 }, label: 'Small source width (4x1000, W < 8)' },
  { src: { w: 6, h: 1000 }, crop: { x: 0, y: 0, width: 100, height: 50 }, label: 'Small source width (6x1000, W < 8)' },

  // 1x1 source
  { src: { w: 1, h: 1 }, crop: { x: 0, y: 0, width: 100, height: 50 }, label: '1x1 source' },
];

for (const tc of clampTestCases) {
  const res = clampCropToBounds(tc.crop, tc.src.w, tc.src.h);

  // Invariant 1: W == 2 * H
  if (res.width !== 2 * res.height) {
    recordFailure('T2-CLP-ASPECT', 'clampCropToBounds', `${tc.label} aspect ratio violation`, tc, res, `Width ${res.width} != 2 * Height ${res.height}`);
  }

  // Invariant 2: Within boundaries
  const violatesX = res.x < 0 || res.x + res.width > tc.src.w;
  const violatesY = res.y < 0 || res.y + res.height > tc.src.h;

  if (violatesX || violatesY) {
    recordFailure(
      'T2-CLP-BOUND',
      'clampCropToBounds',
      `${tc.label} boundary violation`,
      tc,
      res,
      `Result [${res.x}, ${res.y}, ${res.width}, ${res.height}] exceeds source [0, 0, ${tc.src.w}, ${tc.src.h}] (violatesX=${violatesX}, violatesY=${violatesY})`
    );
  }
}

// =============================================================================
// TEST SUITE 3: 8-Handle Resizing Under Displacements & Collisions
// =============================================================================
console.log('>>> Running Suite 3: resizeCropWithHandle adversarial stress tests...');

const handles: ResizeHandle[] = ['nw', 'ne', 'se', 'sw', 'n', 's', 'e', 'w'];

// Test 3.1: Zero displacement (must be identity or valid within bounds)
for (const handle of handles) {
  const start = { x: 100, y: 100, width: 200, height: 100 };
  const res = resizeCropWithHandle(handle, start, 0, 0, 800, 600);

  if (res.width !== 2 * res.height) {
    recordFailure('T3-ZERO-ASPECT', 'resizeCropWithHandle', `Handle ${handle} with zero displacement aspect violation`, { handle, start }, res, `W ${res.width} != 2*H ${res.height}`);
  }
  if (res.x < 0 || res.y < 0 || res.x + res.width > 800 || res.y + res.height > 600) {
    recordFailure('T3-ZERO-BOUND', 'resizeCropWithHandle', `Handle ${handle} with zero displacement boundary violation`, { handle, start }, res, `Out of bounds`);
  }
}

// Test 3.2: Severe negative displacements (inverted mouse drag across box)
for (const handle of handles) {
  const start = { x: 200, y: 200, width: 200, height: 100 };
  // Drag by -500 in both axes
  const res = resizeCropWithHandle(handle, start, -500, -500, 800, 600);

  if (res.width !== 2 * res.height) {
    recordFailure('T3-NEG-ASPECT', 'resizeCropWithHandle', `Handle ${handle} negative displacement aspect violation`, { handle, start }, res, `W ${res.width} != 2*H ${res.height}`);
  }
  if (res.x < 0 || res.y < 0 || res.x + res.width > 800 || res.y + res.height > 600) {
    recordFailure('T3-NEG-BOUND', 'resizeCropWithHandle', `Handle ${handle} negative displacement boundary violation`, { handle, start }, res, `Out of bounds: [${res.x}, ${res.y}, ${res.width}, ${res.height}]`);
  }
}

// Test 3.3: Extreme positive displacements (huge drag outward)
for (const handle of handles) {
  const start = { x: 200, y: 200, width: 200, height: 100 };
  const res = resizeCropWithHandle(handle, start, 2000, 2000, 800, 600);

  if (res.width !== 2 * res.height) {
    recordFailure('T3-POS-ASPECT', 'resizeCropWithHandle', `Handle ${handle} positive displacement aspect violation`, { handle, start }, res, `W ${res.width} != 2*H ${res.height}`);
  }
  if (res.x < 0 || res.y < 0 || res.x + res.width > 800 || res.y + res.height > 600) {
    recordFailure('T3-POS-BOUND', 'resizeCropWithHandle', `Handle ${handle} positive displacement boundary violation`, { handle, start }, res, `Out of bounds: [${res.x}, ${res.y}, ${res.width}, ${res.height}]`);
  }
}

// Test 3.4: Boundary collisions (start box adjacent to each edge, drag outward/inward)
const edgeScenarios = [
  // Box touching Right edge: X = 780, W = 20 on 800-wide image
  {
    desc: 'Near Right Edge',
    src: { w: 800, h: 600 },
    start: { x: 780, y: 200, width: 20, height: 10 },
    handleDeltas: [
      { handle: 'se' as ResizeHandle, dx: 50, dy: 25 },
      { handle: 'ne' as ResizeHandle, dx: 50, dy: -25 },
      { handle: 'e' as ResizeHandle, dx: 50, dy: 0 },
    ],
  },
  // Box touching Left edge: X = 0, ax = 10, ay = 10
  {
    desc: 'Top-left anchor with space < hMin for nw handle (ax=10, ay=10)',
    src: { w: 800, h: 600 },
    start: { x: 4, y: 5, width: 6, height: 3 },
    handleDeltas: [
      { handle: 'nw' as ResizeHandle, dx: -10, dy: -5 },
      { handle: 'w' as ResizeHandle, dx: -10, dy: 0 },
      { handle: 'n' as ResizeHandle, dx: 0, dy: -10 },
    ],
  },
  // Box in top-right with space < hMin for ne handle
  {
    desc: 'Top-right anchor with space < hMin for ne handle',
    src: { w: 800, h: 600 },
    start: { x: 794, y: 2, width: 6, height: 3 },
    handleDeltas: [
      { handle: 'ne' as ResizeHandle, dx: 10, dy: -5 },
    ],
  },
  // Box in bottom-left with space < hMin for sw handle
  {
    desc: 'Bottom-left anchor with space < hMin for sw handle',
    src: { w: 800, h: 600 },
    start: { x: 4, y: 597, width: 6, height: 3 },
    handleDeltas: [
      { handle: 'sw' as ResizeHandle, dx: -10, dy: 5 },
    ],
  },

  // Box in a tight corner with available space < hMin (8)
  {
    desc: 'Corner anchor with remaining space < hMin (dx=6, dy=3)',
    src: { w: 800, h: 600 },
    start: { x: 794, y: 597, width: 6, height: 3 },
    handleDeltas: [
      { handle: 'se' as ResizeHandle, dx: 10, dy: 5 },
      { handle: 'e' as ResizeHandle, dx: 10, dy: 0 },
      { handle: 's' as ResizeHandle, dx: 0, dy: 10 },
    ],
  },
];

for (const scenario of edgeScenarios) {
  for (const hd of scenario.handleDeltas) {
    const res = resizeCropWithHandle(hd.handle, scenario.start, hd.dx, hd.dy, scenario.src.w, scenario.src.h);

    if (res.width !== 2 * res.height) {
      recordFailure('T3-EDGE-ASPECT', 'resizeCropWithHandle', `${scenario.desc} [${hd.handle}] aspect violation`, { scenario, hd }, res, `W ${res.width} != 2*H ${res.height}`);
    }

    const violatesX = res.x < 0 || res.x + res.width > scenario.src.w;
    const violatesY = res.y < 0 || res.y + res.height > scenario.src.h;
    if (violatesX || violatesY) {
      recordFailure(
        'T3-EDGE-BOUND',
        'resizeCropWithHandle',
        `${scenario.desc} [${hd.handle}] boundary overflow`,
        { scenario, hd },
        res,
        `Box [${res.x}, ${res.y}, ${res.width}, ${res.height}] exceeds [0, 0, ${scenario.src.w}, ${scenario.src.h}] (violatesX=${violatesX}, violatesY=${violatesY})`
      );
    }
  }
}

// Test 3.5: Comprehensive Sweep of All Handles with Random & Boundary Displacements
console.log('>>> Running Suite 3.5: Systematic Sweep of 1,000 Handle Displacements...');
const sweepDisplacements = [-1000, -200, -50, -10, -1, 0, 1, 10, 50, 200, 1000];
const testSources = [
  { w: 720, h: 1280 },
  { w: 1920, h: 1080 },
  { w: 2560, h: 1080 },
  { w: 512, h: 512 },
  { w: 64, h: 32 },
  { w: 16, h: 8 },
];

let sweepViolations = 0;
for (const src of testSources) {
  const startCrop = computeCoverCrop(src.w, src.h);
  for (const handle of handles) {
    for (const dx of sweepDisplacements) {
      for (const dy of sweepDisplacements) {
        const res = resizeCropWithHandle(handle, startCrop, dx, dy, src.w, src.h);

        // Check aspect ratio
        if (res.width !== 2 * res.height) {
          sweepViolations++;
          if (sweepViolations <= 5) {
            recordFailure('T3-SWEEP-ASPECT', 'resizeCropWithHandle', `Sweep aspect violation on ${src.w}x${src.h}`, { handle, startCrop, dx, dy }, res, `W ${res.width} != 2*H ${res.height}`);
          }
        }

        // Check boundary clamping
        if (res.x < 0 || res.y < 0 || res.x + res.width > src.w || res.y + res.height > src.h) {
          sweepViolations++;
          if (sweepViolations <= 5) {
            recordFailure('T3-SWEEP-BOUND', 'resizeCropWithHandle', `Sweep boundary violation on ${src.w}x${src.h}`, { handle, startCrop, dx, dy }, res, `Out of bounds`);
          }
        }
      }
    }
  }
}
console.log(`Sweep completed: ${sweepViolations} violations found in sweep.`);

// =============================================================================
// TEST SUITE 4: Canvas Rendering Contract (renderCropTo128x64)
// =============================================================================
console.log('>>> Running Suite 4: Canvas Rendering Contract (renderCropTo128x64)...');

// Mock HTMLCanvasElement and CanvasRenderingContext2D to verify rendering contract
class MockImageData {
  width: number;
  height: number;
  data: Uint8ClampedArray;
  constructor(w: number, h: number) {
    this.width = w;
    this.height = h;
    this.data = new Uint8ClampedArray(w * h * 4);
  }
}

class MockCanvasRenderingContext2D {
  canvas: MockCanvasElement;
  fillStyle: string = '#000000';
  imageSmoothingEnabled: boolean = true;
  imageSmoothingQuality: string = 'low';

  drawCalls: Array<{ method: string; args: any[] }> = [];

  constructor(canvas: MockCanvasElement) {
    this.canvas = canvas;
  }

  fillRect(x: number, y: number, w: number, h: number) {
    this.drawCalls.push({ method: 'fillRect', args: [x, y, w, h] });
  }

  drawImage(...args: any[]) {
    this.drawCalls.push({ method: 'drawImage', args });
    // Simulate real browser behavior: drawImage with zero width or height throws IndexSizeError
    if (args.length === 9) {
      const [img, sx, sy, sw, sh, dx, dy, dw, dh] = args;
      if (sw === 0 || sh === 0 || dw === 0 || dh === 0) {
        throw new Error(`IndexSizeError: The source or destination size is zero (sw=${sw}, sh=${sh}, dw=${dw}, dh=${dh})`);
      }
    }
  }

  getImageData(sx: number, sy: number, sw: number, sh: number): ImageData {
    this.drawCalls.push({ method: 'getImageData', args: [sx, sy, sw, sh] });
    return new MockImageData(sw, sh) as unknown as ImageData;
  }
}

class MockCanvasElement {
  width: number = 0;
  height: number = 0;
  private ctx: MockCanvasRenderingContext2D;

  constructor() {
    this.ctx = new MockCanvasRenderingContext2D(this);
  }

  getContext(type: string, options?: any) {
    if (type === '2d') return this.ctx;
    return null;
  }
}

// Test cases across all 3 presets ('cover', 'contain', 'stretch') and both smoothing modes
const presets = ['cover', 'contain', 'stretch'] as const;
const smoothingModes = [true, false];

for (const mode of presets) {
  for (const smoothing of smoothingModes) {
    const mockCanvas = new MockCanvasElement() as unknown as HTMLCanvasElement;
    const mockSource = new MockCanvasElement() as unknown as CanvasImageSource;

    const cropSettings: CropSettings = {
      mode,
      x: 0,
      y: 100,
      width: 720,
      height: 360,
      sourceWidth: 720,
      sourceHeight: 1280,
      smoothing,
    };

    try {
      const imageData = renderCropTo128x64(mockSource, cropSettings, mockCanvas);

      // Verify dimensions
      if (imageData.width !== 128) {
        recordFailure('T4-CANVAS-W', 'renderCropTo128x64', `ImageData width is not 128 (was ${imageData.width})`, { mode, smoothing }, imageData, 'Width != 128');
      }
      if (imageData.height !== 64) {
        recordFailure('T4-CANVAS-H', 'renderCropTo128x64', `ImageData height is not 64 (was ${imageData.height})`, { mode, smoothing }, imageData, 'Height != 64');
      }
      if (imageData.data.length !== 32768) {
        recordFailure('T4-CANVAS-BYTES', 'renderCropTo128x64', `ImageData byte size is not 32,768 (was ${imageData.data.length})`, { mode, smoothing }, imageData, 'data.length != 32768');
      }

      // Verify canvas context state
      const ctx = (mockCanvas as any).ctx as MockCanvasRenderingContext2D;
      if (ctx.imageSmoothingEnabled !== smoothing) {
        recordFailure('T4-CANVAS-SMOOTH', 'renderCropTo128x64', `imageSmoothingEnabled mismatch`, { mode, smoothing }, ctx.imageSmoothingEnabled, `Expected ${smoothing}`);
      }
      if (smoothing && ctx.imageSmoothingQuality !== 'high') {
        recordFailure('T4-CANVAS-QUAL', 'renderCropTo128x64', `imageSmoothingQuality was not 'high'`, { mode, smoothing }, ctx.imageSmoothingQuality, `Expected 'high'`);
      }

    } catch (err: any) {
      recordFailure('T4-CANVAS-EX', 'renderCropTo128x64', `Exception during rendering: ${err.message}`, { mode, smoothing }, null, err.message);
    }
  }
}

// Test 4.2: Zero-dimension crop crash test (e.g. 1:1000 sliver)
{
  const mockCanvas = new MockCanvasElement() as unknown as HTMLCanvasElement;
  const mockSource = new MockCanvasElement() as unknown as CanvasImageSource;
  const zeroCrop = computeCoverCrop(1, 1000); // returns { width: 0, height: 0 }

  const cropSettings: CropSettings = {
    mode: 'cover',
    x: zeroCrop.x,
    y: zeroCrop.y,
    width: zeroCrop.width,
    height: zeroCrop.height,
    sourceWidth: 1,
    sourceHeight: 1000,
    smoothing: true,
  };

  try {
    renderCropTo128x64(mockSource, cropSettings, mockCanvas);
    console.log('  Zero-dimension crop rendered without throw (browser might silently drop draw)');
  } catch (err: any) {
    recordFailure('T4-ZERO-DRAW', 'renderCropTo128x64', `Zero-dimension crop crashes Canvas drawImage`, cropSettings, null, err.message);
  }
}

// =============================================================================
// SUMMARY & VERDICT GENERATION
// =============================================================================
console.log('\n================================================================');
console.log(`STRESS TESTING COMPLETE. TOTAL FAILURES DETECTED: ${failures.length}`);
console.log('================================================================\n');

for (const [idx, f] of failures.entries()) {
  console.log(`${idx + 1}. [${f.testId}] (${f.category}): ${f.description}`);
  console.log(`   Violation: ${f.violation}`);
}
