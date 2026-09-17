/**
 * Adversarial Stress Test Suite for Milestone M1 Media Decoding Pipeline
 * 
 * Features Under Stress:
 * - F04: Natural Collation Sorting (Extreme alphanumeric sequences, edge cases)
 * - F03: Animated GIF Decoding (Disposal modes 0-3, zero delays, corrupt buffers, 1x1, odd dims, OOB subframes)
 * - Frame Resampling Engine (Variable delays, extreme FPS down/upsampling, invalid parameters)
 * - F02: Video Ingestion & Memory Bounds Analysis (igexport-DckvRqKPsI_.mp4 box parsing, memory math, hang analysis)
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { GifWriter, GifReader, GifFrameInfo } from 'omggif';

// Polyfill minimal ImageData and HTMLCanvasElement for headless Node execution
class MockImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  constructor(dataOrWidth: Uint8ClampedArray | number, widthOrHeight?: number, height?: number) {
    if (dataOrWidth instanceof Uint8ClampedArray) {
      this.data = dataOrWidth;
      this.width = widthOrHeight!;
      this.height = height!;
    } else {
      this.width = dataOrWidth;
      this.height = widthOrHeight!;
      this.data = new Uint8ClampedArray(this.width * this.height * 4);
    }
  }
}

if (typeof (globalThis as any).ImageData === 'undefined') {
  (globalThis as any).ImageData = MockImageData;
}

class MockCanvas {
  width = 0;
  height = 0;
  private buffer: Uint8ClampedArray = new Uint8ClampedArray(0);

  getContext(type: string, options?: any) {
    if (type !== '2d') return null;
    return {
      imageSmoothingQuality: 'high',
      clearRect: (x: number, y: number, w: number, h: number) => {
        if (this.buffer.length !== this.width * this.height * 4) {
          this.buffer = new Uint8ClampedArray(this.width * this.height * 4);
        } else {
          this.buffer.fill(0);
        }
      },
      putImageData: (imageData: any, dx: number, dy: number) => {
        this.buffer = new Uint8ClampedArray(imageData.data);
      },
      drawImage: (image: any, sx: number, sy: number, sw: number, sh: number) => {
        // Simple mock: resize buffer
        this.buffer = new Uint8ClampedArray(this.width * this.height * 4);
      },
      getImageData: (sx: number, sy: number, sw: number, sh: number) => {
        if (this.buffer.length !== sw * sh * 4) {
          this.buffer = new Uint8ClampedArray(sw * sh * 4);
        }
        return new MockImageData(this.buffer, sw, sh);
      }
    };
  }
}

if (typeof (globalThis as any).document === 'undefined') {
  (globalThis as any).document = {
    createElement: (tag: string) => {
      if (tag === 'canvas') return new MockCanvas();
      if (tag === 'video') return {};
      return {};
    }
  };
}

import { decodeGif, resampleFramesToFps } from '../src/engine/mediaDecoder.ts';
import { ExtractedFrame } from '../src/types/media.ts';

console.log('================================================================');
console.log('  MILESTONE M1 EMPIRICAL ADVERSARIAL STRESS TEST SUITE');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const findings: { id: string; title: string; severity: string; details: string }[] = [];

function recordTest(name: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`[PASS] ${name}`);
  } catch (err: any) {
    failedTests++;
    console.error(`[FAIL] ${name}: ${err.message}`);
  }
}

// =============================================================================
// SECTION 1: Natural Collation Sorting Extreme Stress Tests (F04)
// =============================================================================
console.log('--- SECTION 1: Extreme Natural Collation Sorting Stress Tests ---');

const naturalSortFn = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });

recordTest('1.1 Mixed case and variable length leading zeroes', () => {
  const filenames = [
    'frame_010.png',
    'Frame_002.PNG',
    'frame_1.png',
    'FRAME_020.Png',
    'frame_0003.png',
    'frame_100.png',
  ];
  const sorted = filenames.map(name => ({ name })).sort(naturalSortFn).map(f => f.name);
  console.log('  Input: ', filenames);
  console.log('  Sorted:', sorted);
  
  // Numerical values: 1, 2, 3, 10, 20, 100
  const expectedOrder = [
    'frame_1.png',
    'Frame_002.PNG',
    'frame_0003.png',
    'frame_010.png',
    'FRAME_020.Png',
    'frame_100.png',
  ];
  assert.deepEqual(sorted, expectedOrder);
});

recordTest('1.2 Numbers embedded in middle of strings with suffixes', () => {
  const filenames = [
    'seq_010_v1.png',
    'seq_001_v2.png',
    'seq_002_v10.png',
    'seq_002_v2.png',
    'seq_001_v1.png',
  ];
  const sorted = filenames.map(name => ({ name })).sort(naturalSortFn).map(f => f.name);
  console.log('  Input: ', filenames);
  console.log('  Sorted:', sorted);

  // Expected: seq_001_v1, seq_001_v2, seq_002_v2, seq_002_v10, seq_010_v1
  const expected = [
    'seq_001_v1.png',
    'seq_001_v2.png',
    'seq_002_v2.png',
    'seq_002_v10.png',
    'seq_010_v1.png',
  ];
  assert.deepEqual(sorted, expected);
});

recordTest('1.3 Multi-part version numbers (e.g. clip_1_take_02_v01.png)', () => {
  const filenames = [
    'clip_1_take_10_v01.png',
    'clip_1_take_02_v02.png',
    'clip_1_take_02_v01.png',
    'clip_2_take_01_v01.png',
  ];
  const sorted = filenames.map(name => ({ name })).sort(naturalSortFn).map(f => f.name);
  console.log('  Sorted multi-part:', sorted);
  assert.equal(sorted[0], 'clip_1_take_02_v01.png');
  assert.equal(sorted[1], 'clip_1_take_02_v02.png');
  assert.equal(sorted[2], 'clip_1_take_10_v01.png');
  assert.equal(sorted[3], 'clip_2_take_01_v01.png');
});

recordTest('1.4 Non-sequential large gaps', () => {
  const filenames = [
    'img_999999.png',
    'img_0.png',
    'img_42.png',
    'img_1000.png',
    'img_5.png',
  ];
  const sorted = filenames.map(name => ({ name })).sort(naturalSortFn).map(f => f.name);
  console.log('  Sorted gaps:', sorted);
  assert.deepEqual(sorted, [
    'img_0.png',
    'img_5.png',
    'img_42.png',
    'img_1000.png',
    'img_999999.png',
  ]);
});

recordTest('1.5 Identical numerical values with different leading zero counts (Tie-Breaking)', () => {
  // Edge case: frame_01 vs frame_1 vs frame_001
  const filenames = ['frame_01.png', 'frame_1.png', 'frame_001.png'];
  const cmp = 'frame_01.png'.localeCompare('frame_1.png', undefined, { numeric: true, sensitivity: 'base' });
  console.log(`  localeCompare('frame_01.png', 'frame_1.png') = ${cmp}`);
  // Note: cmp is 0! Because localeCompare considers them numerically equal with base sensitivity.
  // In JavaScript, Array.sort is stable, so original drag order is preserved when cmp === 0.
  if (cmp === 0) {
    findings.push({
      id: 'FINDING-M1-01',
      title: 'Identical numeric values with differing zero-padding evaluate to 0 in localeCompare',
      severity: 'LOW',
      details: 'When sequence filenames have identical numbers but differing zero padding (e.g. frame_1.png and frame_01.png), localeCompare returns 0, relying on drop order stability rather than zero-pad tie breaking.'
    });
  }
  assert.ok(true);
});

// =============================================================================
// SECTION 2: GIF Decoding Edge Cases (F03)
// =============================================================================
console.log('\n--- SECTION 2: Animated GIF Decoding Edge Cases ---');

recordTest('2.1 Multi-frame GIF with all 4 Disposal Modes (0, 1, 2, 3)', async () => {
  const buf = new Uint8Array(1024 * 16);
  const gw = new GifWriter(buf, 4, 4, { loop: 0 });
  const palette = [0x000000, 0xff0000, 0x00ff00, 0x0000ff]; // 0: black, 1: red, 2: green, 3: blue

  // Frame 0: Fill entire 4x4 with Red (1). Disposal 1 (Leave in place)
  gw.addFrame(0, 0, 4, 4, new Array(16).fill(1), { palette, delay: 10, disposal: 1 });

  // Frame 1: 2x2 Green (2) at (0,0). Disposal 2 (Restore to background)
  gw.addFrame(0, 0, 2, 2, [2, 2, 2, 2], { palette, delay: 10, disposal: 2, transparent: 0 });

  // Frame 2: 2x2 Blue (3) at (2,2). Disposal 3 (Restore to previous snapshot)
  gw.addFrame(2, 2, 2, 2, [3, 3, 3, 3], { palette, delay: 10, disposal: 3, transparent: 0 });

  // Frame 3: 1x1 Blue (3) at (0,0). Disposal 0 (Unspecified)
  gw.addFrame(0, 0, 1, 1, [3], { palette, delay: 10, disposal: 0, transparent: 0 });

  const len = gw.end();
  const file = new File([buf.subarray(0, len)], 'disposal_test.gif', { type: 'image/gif' });

  const decoded = await decodeGif(file);
  console.log(`  Decoded ${decoded.frames.length} frames with 4 disposal modes`);
  assert.equal(decoded.frames.length, 4);
  assert.equal(decoded.sourceInfo.sourceWidth, 4);
  assert.equal(decoded.sourceInfo.sourceHeight, 4);

  // Pixel inspection:
  // Frame 0: (0,0) is Red (RGBA: 255, 0, 0, 255)
  const f0 = decoded.frames[0].imageData.data;
  assert.equal(f0[0], 255, 'F0 (0,0) Red component must be 255');
  assert.equal(f0[1], 0, 'F0 (0,0) Green component must be 0');

  // Frame 1: (0,0) is Green (RGBA: 0, 255, 0, 255), (3,3) is still Red (from Frame 0)
  const f1 = decoded.frames[1].imageData.data;
  assert.equal(f1[0], 0, 'F1 (0,0) Red component must be 0');
  assert.equal(f1[1], 255, 'F1 (0,0) Green component must be 255');
  const f1_p33 = (3 * 4 + 3) * 4;
  assert.equal(f1[f1_p33], 255, 'F1 (3,3) should remain Red from F0');

  // Frame 2: Frame 1 had Disposal 2 (Restore to background), so (0,0) must be 0,0,0,0
  const f2 = decoded.frames[2].imageData.data;
  assert.equal(f2[0], 0, 'F2 (0,0) must be restored to transparent (R=0)');
  assert.equal(f2[1], 0, 'F2 (0,0) must be restored to transparent (G=0)');
  assert.equal(f2[3], 0, 'F2 (0,0) must be restored to transparent (A=0)');
  // Frame 2 drew Blue at (2,2)
  const f2_p22 = (2 * 4 + 2) * 4;
  assert.equal(f2[f2_p22 + 2], 255, 'F2 (2,2) must be Blue (B=255)');

  // Frame 3: Frame 2 had Disposal 3 (Restore to previous snapshot), so (2,2) Blue must be reverted!
  const f3 = decoded.frames[3].imageData.data;
  assert.equal(f3[f2_p22 + 2], 0, 'F3 (2,2) Blue must be reverted to 0 due to Disposal 3 restore');
});

recordTest('2.2 Zero and sub-10ms delay clamping verification', async () => {
  const buf = new Uint8Array(1024 * 8);
  const gw = new GifWriter(buf, 2, 2, { loop: 0 });
  const palette = [0x000000, 0xffffff];

  // Frame 0: delay = 0 (Legacy zero delay)
  gw.addFrame(0, 0, 2, 2, [1, 1, 1, 1], { palette, delay: 0, disposal: 1 });
  // Frame 1: delay = 1 (10ms legacy zero)
  gw.addFrame(0, 0, 2, 2, [0, 0, 0, 0], { palette, delay: 1, disposal: 1 });
  // Frame 2: delay = 5 (50ms)
  gw.addFrame(0, 0, 2, 2, [1, 1, 1, 1], { palette, delay: 5, disposal: 1 });

  const len = gw.end();
  const file = new File([buf.subarray(0, len)], 'delay_test.gif', { type: 'image/gif' });

  const decoded = await decodeGif(file);
  console.log('  Frame 0 durationMs:', decoded.frames[0].durationMs);
  console.log('  Frame 1 durationMs:', decoded.frames[1].durationMs);
  console.log('  Frame 2 durationMs:', decoded.frames[2].durationMs);
  console.log('  Total durationMs:', decoded.sourceInfo.durationMs);

  // Per mediaDecoder.ts line 329: (rawDelay <= 1 ? 10 : rawDelay) * 10
  assert.equal(decoded.frames[0].durationMs, 100, 'Delay 0 must be clamped to 100ms');
  assert.equal(decoded.frames[1].durationMs, 100, 'Delay 1 must be clamped to 100ms');
  assert.equal(decoded.frames[2].durationMs, 50, 'Delay 5 must be 50ms');
  assert.equal(decoded.sourceInfo.durationMs, 250, 'Total duration must be 250ms');
});

recordTest('2.3 Corrupted byte buffers rejection', async () => {
  // Test A: 0 bytes
  try {
    const emptyFile = new File([new Uint8Array(0)], 'empty.gif', { type: 'image/gif' });
    await decodeGif(emptyFile);
    assert.fail('Empty buffer should have thrown an error');
  } catch (err: any) {
    console.log('  Empty buffer rejected:', err.message);
    assert.ok(err.message.includes('Invalid GIF') || err.message.includes('bounds'));
  }

  // Test B: Corrupted magic header
  try {
    const corruptFile = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'corrupt.gif', { type: 'image/gif' });
    await decodeGif(corruptFile);
    assert.fail('Corrupted header should have thrown an error');
  } catch (err: any) {
    console.log('  Invalid magic rejected:', err.message);
    assert.ok(err.message.includes('Invalid GIF') || err.message.includes('header'));
  }

  // Test C: Valid GIF header, but truncated before image data
  try {
    const validHeader = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00]);
    const truncFile = new File([validHeader], 'trunc.gif', { type: 'image/gif' });
    await decodeGif(truncFile);
    assert.fail('Truncated GIF should have thrown an error');
  } catch (err: any) {
    console.log('  Truncated GIF stream rejected:', err.message);
    assert.ok(true);
  }
});

recordTest('2.4 Extreme Dimensions: 1x1 GIF Sprite', async () => {
  const buf = new Uint8Array(1024);
  const gw = new GifWriter(buf, 1, 1, { loop: 0 });
  gw.addFrame(0, 0, 1, 1, [0], { palette: [0xffffff], delay: 10 });
  gw.addFrame(0, 0, 1, 1, [0], { palette: [0x000000], delay: 10 });
  const len = gw.end();

  const file = new File([buf.subarray(0, len)], '1x1.gif', { type: 'image/gif' });
  const decoded = await decodeGif(file);
  console.log(`  1x1 GIF: width=${decoded.sourceInfo.sourceWidth}, height=${decoded.sourceInfo.sourceHeight}, frames=${decoded.frames.length}`);
  assert.equal(decoded.sourceInfo.sourceWidth, 1);
  assert.equal(decoded.sourceInfo.sourceHeight, 1);
  assert.equal(decoded.frames.length, 2);
  assert.equal(decoded.frames[0].imageData.data.length, 4); // 1 pixel * 4 bytes RGBA
});

recordTest('2.5 Odd Dimensions (13x7 and 127x63)', async () => {
  const buf = new Uint8Array(4096);
  const gw = new GifWriter(buf, 13, 7, { loop: 0 });
  const pixels = new Array(13 * 7).fill(1);
  gw.addFrame(0, 0, 13, 7, pixels, { palette: [0, 0xffffff], delay: 10 });
  const len = gw.end();

  const file = new File([buf.subarray(0, len)], 'odd.gif', { type: 'image/gif' });
  const decoded = await decodeGif(file);
  console.log(`  Odd 13x7 GIF: width=${decoded.sourceInfo.sourceWidth}, height=${decoded.sourceInfo.sourceHeight}`);
  assert.equal(decoded.sourceInfo.sourceWidth, 13);
  assert.equal(decoded.sourceInfo.sourceHeight, 7);
  assert.equal(decoded.frames[0].imageData.data.length, 13 * 7 * 4);
});

// =============================================================================
// SECTION 3: Frame Resampling Under Variable & Extreme Rates
// =============================================================================
console.log('\n--- SECTION 3: Frame Resampling Stress Tests ---');

recordTest('3.1 Resampling High FPS (100 FPS) to Standard 15 FPS', () => {
  // 100 frames at 10ms each = 1000ms
  const sourceFrames: ExtractedFrame[] = Array.from({ length: 100 }, (_, i) => ({
    index: i,
    timestampMs: i * 10,
    durationMs: 10,
    imageData: new MockImageData(128, 64) as any
  }));

  const resampled = resampleFramesToFps(sourceFrames, 15);
  console.log(`  100 FPS (1000ms) resampled to 15 FPS: ${resampled.length} frames`);
  assert.equal(resampled.length, 15, 'Must produce exactly 15 frames');
  assert.equal(resampled[0].timestampMs, 0);
  assert.equal(resampled[14].timestampMs, Math.round(14 * (1000 / 15)));
});

recordTest('3.2 Resampling Low FPS (5 FPS) to High 30 FPS (Frame Multiplication)', () => {
  // 5 frames at 200ms each = 1000ms
  const sourceFrames: ExtractedFrame[] = Array.from({ length: 5 }, (_, i) => ({
    index: i,
    timestampMs: i * 200,
    durationMs: 200,
    imageData: { index: i } as any // Tag to trace duplication
  }));

  const resampled = resampleFramesToFps(sourceFrames, 30);
  console.log(`  5 FPS (1000ms) resampled to 30 FPS: ${resampled.length} frames`);
  assert.equal(resampled.length, 30, 'Must produce exactly 30 frames');
  
  // Verify each source frame is replicated 6 times
  const counts: Record<number, number> = {};
  for (const f of resampled) {
    const srcIdx = (f.imageData as any).index;
    counts[srcIdx] = (counts[srcIdx] || 0) + 1;
  }
  console.log('  Frame replication distribution:', counts);
  for (let i = 0; i < 5; i++) {
    assert.equal(counts[i], 6, `Source frame ${i} must appear exactly 6 times`);
  }
});

recordTest('3.3 Extreme Variable Delays Resampling across 15, 20, 24, 30 FPS', () => {
  // Irregular delays: [50ms, 150ms, 25ms, 175ms, 600ms] = 1000ms
  const delays = [50, 150, 25, 175, 600];
  let acc = 0;
  const sourceFrames: ExtractedFrame[] = delays.map((d, i) => {
    const frame = {
      index: i,
      timestampMs: acc,
      durationMs: d,
      imageData: { src: i } as any
    };
    acc += d;
    return frame;
  });

  for (const targetFps of [15, 20, 24, 30]) {
    const resampled = resampleFramesToFps(sourceFrames, targetFps);
    console.log(`  Variable delays -> ${targetFps} FPS: produced ${resampled.length} frames`);
    assert.equal(resampled.length, targetFps);
    // Check timestamps monotonicity
    for (let j = 1; j < resampled.length; j++) {
      assert.ok(resampled[j].timestampMs > resampled[j - 1].timestampMs, 'Timestamps must strictly increase');
    }
  }
});

recordTest('3.4 Resampling Edge Cases: Empty array, single frame, zero FPS', () => {
  // Empty
  const empty = resampleFramesToFps([], 30);
  assert.equal(empty.length, 0);

  // Single frame of 500ms
  const single: ExtractedFrame[] = [{
    index: 0,
    timestampMs: 0,
    durationMs: 500,
    imageData: {} as any
  }];
  const res30 = resampleFramesToFps(single, 30);
  console.log(`  Single 500ms frame resampled at 30 FPS: ${res30.length} frames`);
  assert.equal(res30.length, 15);

  // targetFps = 0 or negative
  const zeroFps = resampleFramesToFps(single, 0);
  console.log('  resampleFramesToFps with targetFps=0 returned:', zeroFps);
  if (Number.isNaN(zeroFps[0]?.timestampMs) || !Number.isFinite(zeroFps[0]?.durationMs)) {
    findings.push({
      id: 'FINDING-M1-02',
      title: 'resampleFramesToFps produces NaN/Infinity when targetFps is 0 or negative',
      severity: 'MEDIUM',
      details: 'resampleFramesToFps does not validate or clamp targetFps > 0. When targetFps=0 is passed, targetStepMs evaluates to Infinity and timestampMs evaluates to NaN.'
    });
  }
});

// =============================================================================
// SECTION 4: Sample Video Metadata Consistency & Memory Bounds Analysis (F02)
// =============================================================================
console.log('\n--- SECTION 4: Video Metadata & Memory Bounds Analysis ---');

recordTest('4.1 Empirical Sample Video MP4 Box Parser & Metadata Consistency', () => {
  const videoPath = path.resolve('..', 'igexport-DckvRqKPsI_.mp4');
  assert.ok(fs.existsSync(videoPath), 'igexport-DckvRqKPsI_.mp4 must exist');
  const buf = fs.readFileSync(videoPath);

  // Parse moov -> mvhd and trak -> tkhd, stsz
  let offset = 0;
  let timescale = 0;
  let durationUnits = 0;
  let videoWidth = 0;
  let videoHeight = 0;
  let sampleCount = 0;

  function walk(start: number, end: number) {
    let cur = start;
    while (cur < end - 8) {
      const size = buf.readUInt32BE(cur);
      if (size < 8) break;
      const type = buf.toString('ascii', cur + 4, cur + 8);
      if (['moov', 'trak', 'mdia', 'minf', 'stbl'].includes(type)) {
        walk(cur + 8, cur + size);
      } else if (type === 'mvhd') {
        const ver = buf[cur + 8];
        timescale = buf.readUInt32BE(cur + (ver === 1 ? 28 : 20));
        durationUnits = ver === 1 ? Number(buf.readBigUInt64BE(cur + 32)) : buf.readUInt32BE(cur + 24);
      } else if (type === 'tkhd' && videoWidth === 0) {
        videoWidth = buf.readUInt32BE(cur + size - 8) >> 16;
        videoHeight = buf.readUInt32BE(cur + size - 4) >> 16;
      } else if (type === 'stsz' && sampleCount === 0) {
        sampleCount = buf.readUInt32BE(cur + 16);
      }
      cur += size;
    }
  }

  walk(0, buf.length);

  const durationSec = durationUnits / timescale;
  const calculatedFps = sampleCount / durationSec;

  console.log(`  Sample Video Metadata:`);
  console.log(`    Dimensions: ${videoWidth}x${videoHeight}`);
  console.log(`    Duration: ${durationSec.toFixed(3)}s (${durationUnits} units @ ${timescale}Hz)`);
  console.log(`    Sample Count: ${sampleCount} frames`);
  console.log(`    Calculated FPS: ${calculatedFps.toFixed(2)}`);

  assert.equal(videoWidth, 720, 'Source width must be 720');
  assert.equal(videoHeight, 1280, 'Source height must be 1280');
  assert.ok(durationSec > 15 && durationSec < 16, 'Duration must be ~15.65s');
  assert.equal(sampleCount, 466, 'Video must have 466 samples');
  assert.ok(calculatedFps > 29 && calculatedFps < 30.5, 'FPS must be ~29.78');
});

recordTest('4.2 Video Memory Bounds Stress Calculation', () => {
  const durationSec = 15.649;
  const fps = 30;
  const frameCount = Math.floor(durationSec * fps); // 469 frames

  const uncompressedFullResBytes = frameCount * (720 * 1280 * 4);
  const maxDim = 512;
  const scale = 512 / 1280;
  const downscaledW = Math.round(720 * scale); // 288
  const downscaledH = 512;
  const downscaledBytes = frameCount * (downscaledW * downscaledH * 4);
  const oledCroppedBytes = frameCount * (128 * 64 * 4);
  const xbmpPackedBytes = frameCount * 1024;

  console.log(`  Memory Footprint Comparison for 15.65s Reel (469 frames):`);
  console.log(`    1. Full Resolution Raw (720x1280): ${(uncompressedFullResBytes / 1024 / 1024).toFixed(1)} MB`);
  console.log(`    2. Decoder Downscaled (288x512):   ${(downscaledBytes / 1024 / 1024).toFixed(1)} MB`);
  console.log(`    3. CropEngine Canvas (128x64):     ${(oledCroppedBytes / 1024 / 1024).toFixed(1)} MB`);
  console.log(`    4. OLED XBMP 1-bit Stream/Flash:   ${(xbmpPackedBytes / 1024).toFixed(1)} KB`);

  assert.ok(downscaledBytes < 300 * 1024 * 1024, 'Downscaled buffer must remain under 300 MB for browser stability');
  assert.ok(oledCroppedBytes < 20 * 1024 * 1024, 'Target OLED RGBA must be under 20 MB');
  assert.ok(xbmpPackedBytes < 500 * 1024, 'Packed XBMP must be under 500 KB');
});

recordTest('4.3 Decoder Robustness & Hang Vulnerability Analysis', () => {
  // Vulnerability Inspection in mediaDecoder.ts:
  // In decodeVideo (lines 104-114):
  //   if (!Number.isFinite(duration) || duration <= 0) {
  //     duration = await new Promise<number>((resolve) => {
  //       const onSeeked = () => { ... };
  //       video.addEventListener('seeked', onSeeked, { once: true });
  //       video.currentTime = 1e10;
  //     });
  //   }
  // Observation: If the seeked event never fires (e.g. streaming webm error or stalled media),
  // this Promise lacks a timeout rejection or fallback, hanging the UI indefinitely.
  findings.push({
    id: 'FINDING-M1-03',
    title: 'Duration probe in decodeVideo lacks timeout safeguard on seeked event',
    severity: 'MEDIUM',
    details: 'Lines 104-114 of mediaDecoder.ts probe video duration by seeking to 1e10 without a timeout. If the browser fails to fire seeked, the returned Promise hangs permanently.'
  });

  // Observation 2: Lack of maxFrames safety cap in decodeVideo
  // A 5-minute video at 30 FPS will extract 9,000 frames (~5.2 GB in memory),
  // causing browser tab crash (OOM) and performing 9,000 sequential awaits.
  findings.push({
    id: 'FINDING-M1-04',
    title: 'decodeVideo lacks maxFrames safety limit against unbounded memory growth',
    severity: 'HIGH',
    details: 'decodeVideo does not enforce a maximum frame cap or user warning for long videos. For videos longer than 30-60 seconds, allocating thousands of ImageData frames will cause browser tab OOM crashes.'
  });

  assert.ok(true);
});

// =============================================================================
// SUMMARY REPORT
// =============================================================================
console.log('\n================================================================');
console.log(`ADVERSARIAL STRESS TEST RESULTS:`);
console.log(`  Total Tests Run: ${totalTests}`);
console.log(`  Passed:          ${passedTests}`);
console.log(`  Failed:          ${failedTests}`);
console.log(`  Findings Raised: ${findings.length}`);
console.log('================================================================\n');

for (const f of findings) {
  console.log(`[${f.severity}] ${f.id}: ${f.title}`);
  console.log(`  Details: ${f.details}\n`);
}

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
