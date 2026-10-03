import { ExtractedFrame } from '../../types/media';

export interface WebMExportOptions {
  theme?: 'cyan' | 'white' | 'amber' | 'green';
  scale?: number;
  fps?: number;
  onProgress?: (progress: number) => void;
}

/**
 * Encodes ExtractedFrames into a high-definition .webm video
 * matching the authentic OLED phosphor preview display.
 */
export async function exportFramesToWebM(
  frames: ExtractedFrame[],
  options: WebMExportOptions = {}
): Promise<Blob> {
  if (!frames || frames.length === 0) {
    throw new Error('No frames available to export to WebM');
  }

  const scale = options.scale || 4;
  const fps = options.fps || 30;
  const theme = options.theme || 'cyan';

  const width = 128 * scale;
  const height = 64 * scale;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not acquire 2D canvas context for WebM export');

  const phosphorColor = theme === 'amber'
    ? [255, 176, 0]
    : theme === 'white'
    ? [255, 255, 255]
    : theme === 'green'
    ? [0, 255, 102]
    : [0, 240, 255]; // default cyan phosphor

  // Check supported mime types
  const mimeTypes = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm'
  ];
  let chosenMime = mimeTypes.find(m => MediaRecorder.isTypeSupported(m)) || 'video/webm';

  const stream = canvas.captureStream(fps);
  const recorder = new MediaRecorder(stream, {
    mimeType: chosenMime,
    videoBitsPerSecond: 3000000
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const recordingPromise = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: chosenMime }));
    };
    recorder.onerror = (e) => reject(e);
  });

  recorder.start();

  const buffer = new ImageData(width, height);
  const bufData = buffer.data;
  const bgR = 8, bgG = 12, bgB = 18;

  const frameIntervalMs = 1000 / fps;

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const srcData = frame.imageData.data;

    // Render 1-bit pixels scaled up with OLED phosphor look
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 128; x++) {
        const isLit = srcData[(y * 128 + x) * 4] > 128;
        const color = isLit ? phosphorColor : [bgR, bgG, bgB];

        for (let dy = 0; dy < scale; dy++) {
          const rowOffset = ((y * scale + dy) * width + x * scale) * 4;
          for (let dx = 0; dx < scale; dx++) {
            const idx = rowOffset + dx * 4;
            // 1px sub-pixel phosphor border for genuine OLED micro-pixel grid look
            if (scale >= 4 && (dx === 0 || dy === 0)) {
              bufData[idx] = Math.round(color[0] * 0.45);
              bufData[idx + 1] = Math.round(color[1] * 0.45);
              bufData[idx + 2] = Math.round(color[2] * 0.45);
              bufData[idx + 3] = 255;
            } else {
              bufData[idx] = color[0];
              bufData[idx + 1] = color[1];
              bufData[idx + 2] = color[2];
              bufData[idx + 3] = 255;
            }
          }
        }
      }
    }

    ctx.putImageData(buffer, 0, 0);

    if (options.onProgress) {
      options.onProgress(Math.round(((i + 1) / frames.length) * 100));
    }

    // Yield control so MediaRecorder can encode the frame into the stream
    await new Promise(r => setTimeout(r, frameIntervalMs));
  }

  // Request final data and stop
  recorder.stop();
  const videoBlob = await recordingPromise;
  return videoBlob;
}

/**
 * Triggers a direct browser file download for a video blob.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
