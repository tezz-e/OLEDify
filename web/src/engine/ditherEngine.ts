import { DitherConfig } from '../types/dither';
import { HardwareConfig } from '../types/oled';

// 4x4 Bayer Matrix (scaled to 0-255)
const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((row) => row.map((val) => Math.floor((val / 16) * 255)));

// 8x8 Bayer Matrix
const BAYER_8X8 = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
].map((row) => row.map((val) => Math.floor((val / 64) * 255)));

/**
 * Applies contrast and brightness to 128x64 ImageData.
 * Fixes reverse brightness math so +brightness increases luminance (brighter/whiter).
 */
function preprocessGrayscale(
  srcImageData: ImageData,
  brightness: number,
  contrast: number
): Float32Array {
  const width = srcImageData.width;
  const height = srcImageData.height;
  const data = srcImageData.data;
  const grayBuffer = new Float32Array(width * height);

  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // Perceived luminance (0..255)
    let luminance = 0.299 * r + 0.587 * g + 0.114 * b;

    // Apply contrast first
    luminance = factor * (luminance - 128) + 128;

    // Apply brightness (+ increases brightness / white pixels)
    luminance += brightness * 2.55;

    // Clamp between 0 and 255
    grayBuffer[i / 4] = Math.max(0, Math.min(255, luminance));
  }

  return grayBuffer;
}

/**
 * Runs 1-bit dithering algorithm on preprocessed grayscale buffer.
 * Returns 128x64 ImageData (with 0x00 or 0xFF pixels) and XBMP byte array.
 */
export function applyDithering(
  srcImageData: ImageData,
  config: DitherConfig
): { ditheredImageData: ImageData; xbmpBytes: Uint8Array } {
  const width = srcImageData.width;
  const height = srcImageData.height;
  const gray = preprocessGrayscale(srcImageData, config.brightness, config.contrast);
  const binaryBuffer = new Uint8Array(width * height);

  const { algorithm, threshold, invert } = config;

  if (algorithm === 'threshold') {
    for (let i = 0; i < gray.length; i++) {
      binaryBuffer[i] = gray[i] >= threshold ? 255 : 0;
    }
  } else if (algorithm === 'bayer-4' || algorithm === 'bayer-8' || algorithm === 'bayer-2') {
    const matrix = algorithm === 'bayer-8' ? BAYER_8X8 : BAYER_4X4;
    const mSize = matrix.length;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const bayerVal = matrix[y % mSize][x % mSize];
        binaryBuffer[idx] = gray[idx] >= bayerVal ? 255 : 0;
      }
    }
  } else if (algorithm === 'floyd-steinberg') {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const oldVal = gray[idx];
        const newVal = oldVal >= 128 ? 255 : 0;
        binaryBuffer[idx] = newVal;
        const error = oldVal - newVal;

        if (x + 1 < width) gray[idx + 1] += error * (7 / 16);
        if (y + 1 < height) {
          if (x - 1 >= 0) gray[idx + width - 1] += error * (3 / 16);
          gray[idx + width] += error * (5 / 16);
          if (x + 1 < width) gray[idx + width + 1] += error * (1 / 16);
        }
      }
    }
  } else {
    // Atkinson Dithering
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const oldVal = gray[idx];
        const newVal = oldVal >= 128 ? 255 : 0;
        binaryBuffer[idx] = newVal;
        const error = (oldVal - newVal) / 8;

        if (x + 1 < width) gray[idx + 1] += error;
        if (x + 2 < width) gray[idx + 2] += error;
        if (y + 1 < height) {
          if (x - 1 >= 0) gray[idx + width - 1] += error;
          gray[idx + width] += error;
          if (x + 1 < width) gray[idx + width + 1] += error;
        }
        if (y + 2 < height) {
          gray[idx + width * 2] += error;
        }
      }
    }
  }

  const outImgData = new ImageData(width, height);
  const outData = outImgData.data;

  const bytesPerRow = width / 8;
  const xbmpBytes = new Uint8Array(bytesPerRow * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      let val = binaryBuffer[idx];

      if (invert) {
        val = val === 255 ? 0 : 255;
      }

      const rgbaIdx = idx * 4;
      outData[rgbaIdx] = val;
      outData[rgbaIdx + 1] = val;
      outData[rgbaIdx + 2] = val;
      outData[rgbaIdx + 3] = 255;

      if (val > 0) {
        const byteIdx = y * bytesPerRow + Math.floor(x / 8);
        const bitBit = x % 8;
        xbmpBytes[byteIdx] |= 1 << bitBit;
      }
    }
  }

  return { ditheredImageData: outImgData, xbmpBytes };
}

/**
 * Generates a ready-to-compile C++ `src/frames.h` string for PlatformIO with hardware config setup comments.
 */
export function generateCppHeader(
  allXbmpFrames: Uint8Array[],
  targetFps: number = 30,
  hwConfig?: HardwareConfig,
  width: number = 128,
  height: number = 64
): string {
  const numFrames = allXbmpFrames.length;
  const bytesPerFrame = width * (height / 8);
  const sda = hwConfig ? hwConfig.sdaPin : 8;
  const scl = hwConfig ? hwConfig.sclPin : 9;
  const displayDriver = hwConfig ? hwConfig.display.toUpperCase() : 'SH1106';
  const board = hwConfig ? hwConfig.mcu.toUpperCase() : 'ESP32-S3';

  let cpp = `// Auto-generated frames header by OLED Visual Engine Studio\n`;
  cpp += `// Target Board: ${board} | Driver: ${displayDriver} | Custom Pins: SDA=GPIO ${sda}, SCL=GPIO ${scl}\n`;
  cpp += `#ifndef FRAMES_H\n#define FRAMES_H\n\n`;
  cpp += `#include <Arduino.h>\n\n`;
  cpp += `#define OLED_SDA ${sda}\n`;
  cpp += `#define OLED_SCL ${scl}\n`;
  cpp += `#define NUM_FRAMES ${numFrames}\n`;
  cpp += `#define FRAME_WIDTH ${width}\n`;
  cpp += `#define FRAME_HEIGHT ${height}\n`;
  cpp += `#define FRAME_SIZE_BYTES ${bytesPerFrame}\n`;
  cpp += `#define FRAME_FPS ${targetFps}\n\n`;
  cpp += `// Total Size: ${numFrames} * ${bytesPerFrame} = ${numFrames * bytesPerFrame} bytes (~${Math.round(
    (numFrames * bytesPerFrame) / 1024
  )} KB)\n`;
  cpp += `const uint8_t reel_frames[NUM_FRAMES][FRAME_SIZE_BYTES] PROGMEM = {\n`;

  for (let f = 0; f < numFrames; f++) {
    cpp += `  { `;
    const frame = allXbmpFrames[f];
    const hexArray: string[] = [];
    for (let b = 0; b < frame.length; b++) {
      hexArray.push(`0x${frame[b].toString(16).padStart(2, '0').toUpperCase()}`);
    }
    cpp += hexArray.join(', ');
    cpp += f < numFrames - 1 ? ` },\n` : ` }\n`;
  }

  cpp += `};\n\n#endif // FRAMES_H\n`;
  return cpp;
}
