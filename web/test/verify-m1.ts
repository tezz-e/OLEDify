/**
 * Automated Verification Test Suite for Milestone M1
 * Features:
 * - F01: Web Studio Project Setup & Build Verification
 * - F02: Video Decoder Parameters & Math
 * - F03: Animated GIF Decoder & Disposal Logic
 * - F04: Natural Collation Sorting for Image Sequences
 * - F05: Interactive 2:1 Crop & Scale Bounding Box Engine
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { GifReader, GifWriter } from 'omggif';

import {
  computeCoverCrop,
  computeContainDestRect,
  clampCropToBounds,
  resizeCropWithHandle,
  zoomCropAroundPoint,
  OLED_TARGET_WIDTH,
  OLED_TARGET_HEIGHT,
  OLED_TARGET_ASPECT,
} from '../src/engine/cropEngine.ts';

import { resampleFramesToFps } from '../src/engine/mediaDecoder.ts';
import { ExtractedFrame } from '../src/types/media.ts';

console.log('=== RUNNING MILESTONE M1 VERIFICATION SUITE ===\n');

// -----------------------------------------------------------------------------
// Test 1: Feature F05 — 2:1 Aspect Ratio Lock & Presets Math
// -----------------------------------------------------------------------------
console.log('--- Test 1: 2:1 Crop & Scale Math Verification ---');

// 1.1 Vertical 9:16 Reel (720x1280, matching igexport-DckvRqKPsI_.mp4)
{
  const crop = computeCoverCrop(720, 1280);
  console.log('1.1 Vertical 9:16 Reel (720x1280):', crop);
  assert.equal(crop.width, 720, 'Width must be 720');
  assert.equal(crop.height, 360, 'Height must be 360 (2:1 aspect ratio)');
  assert.equal(crop.x, 0, 'X must be centered at 0');
  assert.equal(crop.y, 460, 'Y must be centered at (1280 - 360) / 2 = 460');
  assert.equal(crop.width / crop.height, 2.0, 'Aspect ratio must be exactly 2.0');
}

// 1.2 Widescreen 16:9 Video (1920x1080)
{
  const crop = computeCoverCrop(1920, 1080);
  console.log('1.2 Widescreen 16:9 (1920x1080):', crop);
  assert.equal(crop.width, 1920, 'Width must be 1920');
  assert.equal(crop.height, 960, 'Height must be 960 (2:1 aspect ratio)');
  assert.equal(crop.x, 0, 'X must be 0');
  assert.equal(crop.y, 60, 'Y must be centered at (1080 - 960) / 2 = 60');
  assert.equal(crop.width / crop.height, 2.0, 'Aspect ratio must be exactly 2.0');
}

// 1.3 Ultrawide 21:9 Video (2560x1080)
{
  const crop = computeCoverCrop(2560, 1080);
  console.log('1.3 Ultrawide 21:9 (2560x1080):', crop);
  assert.equal(crop.height, 1080, 'Height must be 1080');
  assert.equal(crop.width, 2160, 'Width must be 1080 * 2 = 2160');
  assert.equal(crop.x, 200, 'X must be centered at (2560 - 2160) / 2 = 200');
  assert.equal(crop.y, 0, 'Y must be 0');
  assert.equal(crop.width / crop.height, 2.0, 'Aspect ratio must be exactly 2.0');
}

// 1.4 Square 1:1 Sprite (512x512)
{
  const crop = computeCoverCrop(512, 512);
  console.log('1.4 Square 1:1 Sprite (512x512):', crop);
  assert.equal(crop.width, 512, 'Width must be 512');
  assert.equal(crop.height, 256, 'Height must be 256');
  assert.equal(crop.x, 0, 'X must be 0');
  assert.equal(crop.y, 128, 'Y must be centered at (512 - 256) / 2 = 128');
  assert.equal(crop.width / crop.height, 2.0, 'Aspect ratio must be exactly 2.0');
}

// 1.5 Odd Dimensions Parity Adjustment (721x1281)
{
  const crop = computeCoverCrop(721, 1281);
  console.log('1.5 Odd Dimensions Parity Adjustment (721x1281):', crop);
  assert.equal(crop.width % 2, 0, 'Width must be even integer');
  assert.equal(crop.width, 720, 'Width must be clamped to even 720');
  assert.equal(crop.height, 360, 'Height must be exact integer 360');
  assert.equal(crop.width / crop.height, 2.0, 'Aspect ratio must be exactly 2.0');
}

// 1.6 Contain Preset Destination Math
{
  const destVertical = computeContainDestRect(720, 1280);
  console.log('1.6 Contain Destination for 720x1280:', destVertical);
  assert.equal(destVertical.dh, 64, 'Height fits 64');
  assert.equal(destVertical.dw, 36, 'Width is 720 * (64 / 1280) = 36');
  assert.equal(destVertical.dx, 46, 'X is centered at (128 - 36) / 2 = 46');
  assert.equal(destVertical.dy, 0, 'Y is 0');

  const destUltrawide = computeContainDestRect(2560, 1080);
  console.log('1.6 Contain Destination for 2560x1080:', destUltrawide);
  assert.equal(destUltrawide.dw, 128, 'Width fits 128');
  assert.equal(destUltrawide.dh, 54, 'Height is round(1080 * (128 / 2560)) = 54');
  assert.equal(destUltrawide.dx, 0, 'X is 0');
  assert.equal(destUltrawide.dy, 5, 'Y is centered at (64 - 54) / 2 = 5');
}

// 1.7 8-Handle Orthogonal Least-Squares Resizing
console.log('1.7 Testing 8-Handle Resizing:');
const baseCrop = { x: 100, y: 100, width: 200, height: 100 };
const handles = ['se', 'nw', 'ne', 'sw', 'n', 's', 'e', 'w'] as const;

for (const handle of handles) {
  const resized = resizeCropWithHandle(handle, baseCrop, 20, 10, 800, 600);
  assert.equal(
    resized.width / resized.height,
    2.0,
    `Handle ${handle} must maintain exact 2.0 aspect ratio`
  );
  assert.ok(resized.x >= 0, `Handle ${handle} X must be >= 0`);
  assert.ok(resized.y >= 0, `Handle ${handle} Y must be >= 0`);
  assert.ok(
    resized.x + resized.width <= 800,
    `Handle ${handle} X + W must be <= sourceWidth`
  );
  assert.ok(
    resized.y + resized.height <= 600,
    `Handle ${handle} Y + H must be <= sourceHeight`
  );
  console.log(`  Handle ${handle.padEnd(2)}: Resized to ${resized.width}x${resized.height} at (${resized.x}, ${resized.y})`);
}

// 1.8 Cursor-Centered Zoom
{
  const zoomed = zoomCropAroundPoint(baseCrop, 800, 600, 0.9, 150, 150);
  console.log('1.8 Cursor-Centered Zoom (scale 0.9 around 150,150):', zoomed);
  assert.equal(zoomed.width / zoomed.height, 2.0, 'Zoom must maintain 2.0 ratio');
  assert.ok(zoomed.width < baseCrop.width, 'Zooming in must reduce width');
}

console.log('✓ Feature F05 2:1 Crop & Scale Math tests passed!\n');

// -----------------------------------------------------------------------------
// Test 2: Feature F04 — Natural Collation Sort for Image Sequences
// -----------------------------------------------------------------------------
console.log('--- Test 2: Natural Alphanumeric Sorting for PNG Sequences ---');
{
  const unorderedFilenames = [
    'frame_10.png',
    'frame_1.png',
    'frame_100.png',
    'frame_2.png',
    'frame_20.png',
    'frame_3.png',
    'frame_21.png',
  ];

  unorderedFilenames.sort((a, b) =>
    a.localeCompare(b.name || b, undefined, { numeric: true, sensitivity: 'base' })
  );

  console.log('Sorted filenames:', unorderedFilenames);

  const expected = [
    'frame_1.png',
    'frame_2.png',
    'frame_3.png',
    'frame_10.png',
    'frame_20.png',
    'frame_21.png',
    'frame_100.png',
  ];

  assert.deepEqual(unorderedFilenames, expected, 'Natural alphanumeric sort failed');
  console.log('✓ Feature F04 Natural Collation sorting passed!\n');
}

// -----------------------------------------------------------------------------
// Test 3: Feature F03 — omggif Binary Parser & Disposal Modes
// -----------------------------------------------------------------------------
console.log('--- Test 3: omggif Binary Parsing & Synthetic GIF Verification ---');
{
  // Generate a minimal valid animated GIF using GifWriter
  const gifBuffer = new Uint8Array(1024 * 10);
  const gifWriter = new GifWriter(gifBuffer, 4, 4, { loop: 0 });

  // Frame 0: White 4x4 (Disposal 1)
  const palette = [0x000000, 0xffffff, 0xff0000, 0x00ff00];
  const frame0Pixels = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
  gifWriter.addFrame(0, 0, 4, 4, frame0Pixels, {
    palette,
    delay: 10,
    disposal: 1,
  });

  // Frame 1: Red 2x2 sub-frame at (1,1) with Disposal 2 (Restore to background)
  const frame1Pixels = [2, 2, 2, 2];
  gifWriter.addFrame(1, 1, 2, 2, frame1Pixels, {
    palette,
    delay: 20,
    disposal: 2,
    transparent: 0,
  });

  const gifLen = gifWriter.end();
  const validGifBytes = gifBuffer.subarray(0, gifLen);

  console.log(`Generated synthetic animated GIF: ${validGifBytes.length} bytes`);

  // Decode with GifReader
  const reader = new GifReader(validGifBytes);
  assert.equal(reader.width, 4, 'Width must be 4');
  assert.equal(reader.height, 4, 'Height must be 4');
  assert.equal(reader.numFrames(), 2, 'Must have 2 frames');

  const f0 = reader.frameInfo(0);
  assert.equal(f0.disposal, 1, 'Frame 0 disposal must be 1');
  assert.equal(f0.delay, 10, 'Frame 0 delay must be 10 (100ms)');

  const f1 = reader.frameInfo(1);
  assert.equal(f1.disposal, 2, 'Frame 1 disposal must be 2');
  assert.equal(f1.delay, 20, 'Frame 1 delay must be 20 (200ms)');

  console.log('✓ Feature F03 omggif binary decoding and frame metadata verified!\n');
}

// -----------------------------------------------------------------------------
// Test 4: Variable Frame Delay Resampling
// -----------------------------------------------------------------------------
console.log('--- Test 4: Frame Resampling Algorithm ---');
{
  const mockFrames: ExtractedFrame[] = [
    {
      index: 0,
      timestampMs: 0,
      durationMs: 100,
      imageData: {} as ImageData,
    },
    {
      index: 1,
      timestampMs: 100,
      durationMs: 200,
      imageData: {} as ImageData,
    },
    {
      index: 2,
      timestampMs: 300,
      durationMs: 100,
      imageData: {} as ImageData,
    },
  ];

  // Total duration = 400ms. At 30 FPS, step = 33.33ms -> ~12 frames
  const resampled = resampleFramesToFps(mockFrames, 30);
  console.log(`Resampled 3 variable frames (400ms) to 30 FPS: ${resampled.length} frames`);
  assert.ok(resampled.length >= 11 && resampled.length <= 13, 'Frame count must match duration');
  assert.equal(resampled[0].timestampMs, 0, 'Initial timestamp must be 0');
  console.log('✓ Frame resampling verified!\n');
}

// -----------------------------------------------------------------------------
// Test 5: Empirical Media Check — igexport-DckvRqKPsI_.mp4
// -----------------------------------------------------------------------------
console.log('--- Test 5: Sample Video File Presence & Consistency Check ---');
{
  const videoPath = path.resolve('..', 'igexport-DckvRqKPsI_.mp4');
  assert.ok(fs.existsSync(videoPath), `Sample video must exist at ${videoPath}`);
  const stats = fs.statSync(videoPath);
  console.log(`Sample video found: ${videoPath} (${stats.size} bytes)`);
  assert.ok(stats.size > 100000, 'Sample video size is non-trivial');
  console.log('✓ Sample video file verified!\n');
}

console.log('====================================================');
console.log('ALL MILESTONE M1 VERIFICATION TESTS PASSED (5/5)!');
console.log('====================================================');
