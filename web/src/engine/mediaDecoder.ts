import { DecodedMedia, DecodeProgress, ExtractedFrame, DecoderOptions } from '../types/media';

export async function decodeVideo(
  file: File,
  options: DecoderOptions = {}
): Promise<DecodedMedia> {
  const { targetFps = 30, onProgress } = options;

  if ('VideoDecoder' in window && file.type === 'video/mp4') {
    return decodeVideoWebCodecs(file, { targetFps, onProgress });
  } else {
    // Fallback to legacy <video> seek for non-mp4 or browsers without WebCodecs
    return decodeVideoLegacy(file, { targetFps, onProgress });
  }
}

async function decodeVideoWebCodecs(
  file: File,
  options: DecoderOptions
): Promise<DecodedMedia> {
  const { targetFps = 30, onProgress } = options;
  const buffer = await file.arrayBuffer();
  const frames: ExtractedFrame[] = [];

  return new Promise((resolve, reject) => {
    // Vite specific worker URL
    const worker = new Worker(new URL('./decodeWorker.ts', import.meta.url), { type: 'module' });

    worker.onmessage = (e) => {
      const msg = e.data;
      if (msg.type === 'progress' && onProgress) {
        onProgress({
          stage: msg.stage,
          currentFrame: msg.currentFrame,
          totalFrames: msg.totalFrames,
          percent: msg.percent
        });
      } else if (msg.type === 'frame') {
        frames.push({
          index: msg.index,
          timestampMs: msg.index * msg.durationMs,
          durationMs: msg.durationMs,
          imageData: msg.imageData
        });
      } else if (msg.type === 'complete') {
        worker.terminate();
        resolve({
          sourceInfo: {
            type: 'video',
            filename: file.name,
            sourceWidth: frames[0]?.imageData.width || 128,
            sourceHeight: frames[0]?.imageData.height || 64,
            frameCount: frames.length,
            fps: targetFps,
            durationMs: frames.length * (1000 / targetFps)
          },
          frames
        });
      } else if (msg.type === 'error') {
        worker.terminate();
        reject(new Error(msg.error));
      }
    };

    worker.postMessage({ buffer, targetFps }, [buffer]); // Transfer buffer
  });
}

// The old implementation for fallback
async function decodeVideoLegacy(
  file: File,
  options: DecoderOptions
): Promise<DecodedMedia> {
  const { targetFps = 30, onProgress } = options;
  const url = URL.createObjectURL(file);
  
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    video.onloadedmetadata = async () => {
      const duration = video.duration;
      const width = video.videoWidth;
      const height = video.videoHeight;
      const totalFrames = Math.floor(duration * targetFps);
      const frames: ExtractedFrame[] = [];
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

      let currentFrame = 0;
      
      const captureFrame = async () => {
        if (currentFrame >= totalFrames) {
          URL.revokeObjectURL(url);
          resolve({
            sourceInfo: { type: 'video', filename: file.name, sourceWidth: width, sourceHeight: height, frameCount: frames.length, fps: targetFps, durationMs: duration * 1000 },
            frames
          });
          return;
        }

        video.currentTime = currentFrame / targetFps;
      };

      video.onseeked = () => {
        ctx.drawImage(video, 0, 0, width, height);
        frames.push({
          index: currentFrame,
          timestampMs: (currentFrame / targetFps) * 1000,
          durationMs: 1000 / targetFps,
          imageData: ctx.getImageData(0, 0, width, height)
        });

        if (onProgress) {
          onProgress({
            stage: 'decoding',
            currentFrame,
            totalFrames,
            percent: (currentFrame / totalFrames) * 100
          });
        }

        currentFrame++;
        captureFrame();
      };

      captureFrame();
    };
    
    video.onerror = () => reject(new Error('Failed to load video'));
  });
}
