import { DecodedMedia, DecodeProgress, ExtractedFrame, DecoderOptions } from '../types/media';

import { GifReader } from 'omggif';

export async function decodeVideo(
  file: File,
  options: DecoderOptions = {}
): Promise<DecodedMedia> {
  const { targetFps = 30, onProgress } = options;

  if (file.name.endsWith('.h')) {
    return decodeHeader(file, options);
  }

  if (file.name.endsWith('.json') || file.type === 'application/json') {
    return decodeJsonSequence(file, options);
  }

  if (file.type === 'image/gif' || file.name.endsWith('.gif')) {
    return decodeGif(file, options);
  }

  if ('VideoDecoder' in window && file.type === 'video/mp4') {
    try {
      return await decodeVideoWebCodecs(file, { targetFps, onProgress });
    } catch (err) {
      console.warn('WebCodecs failed, gracefully falling back to native video decoder:', err);
      return decodeVideoLegacy(file, { targetFps, onProgress });
    }
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

    worker.onerror = (err) => {
      worker.terminate();
      reject(new Error(err.message || 'Worker decoding error'));
    };

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
      const MAX_DIM = 256;
      let w = width;
      let h = height;
      if (w > MAX_DIM || h > MAX_DIM) {
        const scale = Math.min(MAX_DIM / w, MAX_DIM / h);
        w = Math.floor(w * scale);
        h = Math.floor(h * scale);
      }
      
      const totalFrames = Math.floor(duration * targetFps);
      const frames: ExtractedFrame[] = [];
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

      let currentFrame = 0;
      
      const captureFrame = async () => {
        if (currentFrame >= totalFrames) {
          URL.revokeObjectURL(url);
          resolve({
            sourceInfo: { type: 'video', filename: file.name, sourceWidth: w, sourceHeight: h, frameCount: frames.length, fps: targetFps, durationMs: duration * 1000 },
            frames
          });
          return;
        }

        video.currentTime = currentFrame / targetFps;
      };

      video.onseeked = () => {
        ctx.drawImage(video, 0, 0, w, h);
        frames.push({
          index: currentFrame,
          timestampMs: (currentFrame / targetFps) * 1000,
          durationMs: 1000 / targetFps,
          imageData: ctx.getImageData(0, 0, w, h)
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

async function decodeGif(
  file: File,
  options: DecoderOptions
): Promise<DecodedMedia> {
  const buffer = await file.arrayBuffer();
  const reader = new GifReader(new Uint8Array(buffer));
  const width = reader.width;
  const height = reader.height;
  const frames: ExtractedFrame[] = [];
  
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(width, height);
  
  let totalDurationMs = 0;

  for (let i = 0; i < reader.numFrames(); i++) {
    const frameInfo = reader.frameInfo(i);
    
    // omgGif decodes into RGBA array
    reader.decodeAndBlitFrameRGBA(i, imageData.data);
    
    // Save state
    const newImageData = new ImageData(
      new Uint8ClampedArray(imageData.data),
      width,
      height
    );
    
    const durationMs = (frameInfo.delay || 10) * 10; // delay is in hundredths of a second, default to 100ms if 0
    frames.push({
      index: i,
      timestampMs: totalDurationMs,
      durationMs: durationMs,
      imageData: newImageData
    });
    totalDurationMs += durationMs;

    if (options.onProgress) {
      options.onProgress({
        stage: 'decoding',
        currentFrame: i,
        totalFrames: reader.numFrames(),
        percent: ((i + 1) / reader.numFrames()) * 100
      });
    }
  }
  
  return {
    sourceInfo: {
      type: 'gif',
      filename: file.name,
      sourceWidth: width,
      sourceHeight: height,
      frameCount: frames.length,
      fps: frames.length > 0 ? 1000 / frames[0].durationMs : 10,
      durationMs: totalDurationMs
    },
    frames
  };
}

async function decodeHeader(
  file: File,
  options: DecoderOptions
): Promise<DecodedMedia> {
  const text = await file.text();
  
  // Extract width, height, frames, fps
  const widthMatch = text.match(/#define FRAME_WIDTH (\d+)/);
  const heightMatch = text.match(/#define FRAME_HEIGHT (\d+)/);
  const fpsMatch = text.match(/#define FRAME_FPS (\d+)/);
  
  const width = widthMatch ? parseInt(widthMatch[1]) : 128;
  const height = heightMatch ? parseInt(heightMatch[1]) : 64;
  const fps = fpsMatch ? parseInt(fpsMatch[1]) : 30;
  
  const frames: ExtractedFrame[] = [];
  
  // Match arrays of hex bytes
  const arrayMatches = text.match(/\{\s*(0x[0-9a-fA-F]{2}[,\s]*)+\}/g);
  
  if (arrayMatches) {
    let index = 0;
    for (const arrStr of arrayMatches) {
      const hexVals = arrStr.match(/0x[0-9a-fA-F]{2}/g);
      if (hexVals && hexVals.length > 0) {
        // Convert XBMP to ImageData
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        const imageData = ctx.createImageData(width, height);
        const bytesPerRow = Math.ceil(width / 8);
        
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const byteIdx = y * bytesPerRow + Math.floor(x / 8);
            if (byteIdx < hexVals.length) {
              const byte = parseInt(hexVals[byteIdx], 16);
              const bitBit = x % 8;
              const isWhite = (byte & (1 << bitBit)) !== 0;
              const val = isWhite ? 255 : 0;
              const rgbaIdx = (y * width + x) * 4;
              imageData.data[rgbaIdx] = val;
              imageData.data[rgbaIdx + 1] = val;
              imageData.data[rgbaIdx + 2] = val;
              imageData.data[rgbaIdx + 3] = 255;
            }
          }
        }
        
        frames.push({
          index,
          timestampMs: index * (1000 / fps),
          durationMs: 1000 / fps,
          imageData
        });
        index++;
      }
    }
  } else {
    throw new Error("Could not parse arrays from header file");
  }
  
  return {
    sourceInfo: {
      type: 'sequence',
      filename: file.name,
      sourceWidth: width,
      sourceHeight: height,
      frameCount: frames.length,
      fps: fps,
      durationMs: frames.length * (1000 / fps)
    },
    frames
  };
}

async function decodeJsonSequence(
  file: File,
  options: DecoderOptions = {}
): Promise<DecodedMedia> {
  const { onProgress } = options;
  const text = await file.text();
  const data = JSON.parse(text);

  const fps = data.fps || data.sourceInfo?.fps || 30;
  const frameIntervalMs = 1000 / fps;
  const rawFrames: any[] = Array.isArray(data) ? data : (data.frames || []);
  const total = rawFrames.length;
  if (total === 0) throw new Error("JSON animation file contains no frames");

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  const frames: ExtractedFrame[] = [];

  for (let i = 0; i < total; i++) {
    const raw = rawFrames[i];
    let imgData: ImageData;

    if (typeof raw === 'string') {
      const src = raw.startsWith('data:') ? raw : `data:image/png;base64,${raw}`;
      try {
        const resp = await fetch(src);
        const blob = await resp.blob();
        const bitmap = await createImageBitmap(blob);
        ctx.clearRect(0, 0, 128, 64);
        ctx.drawImage(bitmap, 0, 0, 128, 64);
        imgData = ctx.getImageData(0, 0, 128, 64);
        bitmap.close();
      } catch {
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error(`Failed to load frame ${i}`));
          img.src = src;
        });
        ctx.clearRect(0, 0, 128, 64);
        ctx.drawImage(img, 0, 0, 128, 64);
        imgData = ctx.getImageData(0, 0, 128, 64);
      }
    } else if (raw.imageData && raw.imageData.data) {
      const w = raw.imageData.width || 128;
      const h = raw.imageData.height || 64;
      const arr = new Uint8ClampedArray(Object.values(raw.imageData.data));
      imgData = new ImageData(arr, w, h);
    } else {
      continue;
    }

    frames.push({
      index: i,
      timestampMs: i * frameIntervalMs,
      durationMs: frameIntervalMs,
      imageData: imgData
    });

    if (onProgress && (i % 25 === 0 || i === total - 1)) {
      onProgress({
        stage: 'reading',
        currentFrame: i + 1,
        totalFrames: total,
        percent: Math.round(((i + 1) / total) * 100)
      });
      await new Promise<void>(r => setTimeout(r, 0));
    }
  }

  return {
    sourceInfo: {
      type: 'sequence',
      filename: file.name,
      sourceWidth: 128,
      sourceHeight: 64,
      frameCount: frames.length,
      fps,
      durationMs: frames.length * frameIntervalMs
    },
    frames
  };
}

