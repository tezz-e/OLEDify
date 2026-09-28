// @ts-ignore
import * as MP4Box from 'mp4box';

interface DecodeWorkerMessage {
  buffer: ArrayBuffer;
  targetFps: number;
}

self.onmessage = async (e: MessageEvent<DecodeWorkerMessage>) => {
  const { buffer, targetFps } = e.data;
  
  let mp4boxfile = MP4Box.createFile();
  let videoTrack: any = null;
  let decoder: any = null;

  let framesProcessed = 0;
  let totalFrames = 0;
  let frameDurationUs = Math.floor(1000000 / targetFps);

  const postProgress = (stage: string, percent: number) => {
    self.postMessage({ type: 'progress', stage, currentFrame: framesProcessed, totalFrames, percent });
  };

  const initDecoder = (track: any) => {
    let canvas: OffscreenCanvas | null = null;
    let ctx: OffscreenCanvasRenderingContext2D | null = null;

    decoder = new VideoDecoder({
      output: (frame) => {
        let w = frame.codedWidth;
        let h = frame.codedHeight;
        const MAX_DIM = 256; // High-detail supersampling for 128x64 display (avoids tab OOM)
        if (w > MAX_DIM || h > MAX_DIM) {
           const scale = Math.min(MAX_DIM / w, MAX_DIM / h);
           w = Math.floor(w * scale);
           h = Math.floor(h * scale);
        }

        // Reuse canvas to avoid allocating thousands of GPU surfaces
        if (!canvas || canvas.width !== w || canvas.height !== h) {
          canvas = new OffscreenCanvas(w, h);
          ctx = canvas.getContext('2d', { willReadFrequently: true });
        }

        if (ctx) {
          ctx.drawImage(frame, 0, 0, w, h);
          const imageData = ctx.getImageData(0, 0, w, h);
          
          (self as any).postMessage(
            { type: 'frame', imageData, index: framesProcessed, durationMs: 1000 / targetFps },
            [imageData.data.buffer] // Transfer ownership
          );
        }
        frame.close();
        
        framesProcessed++;
        if (framesProcessed % 5 === 0 || framesProcessed >= totalFrames) {
          postProgress('decoding', Math.min(100, (framesProcessed / totalFrames) * 100));
        }
      },
      error: (e) => {
        console.error('VideoDecoder error:', e);
        self.postMessage({ type: 'error', error: e.message });
      }
    });

    // Extract description from avcC / hvcC box
    let description: Uint8Array | undefined = undefined;
    const trak = mp4boxfile.getTrackById(track.id);
    if (trak && trak.mdia && trak.mdia.minf && trak.mdia.minf.stbl && trak.mdia.minf.stbl.stsd) {
      const stsd = trak.mdia.minf.stbl.stsd.entries[0];
      // @ts-ignore
      if (stsd.avcC) {
        // @ts-ignore
        const stream = new MP4Box.DataStream(undefined, 0, MP4Box.DataStream.BIG_ENDIAN);
        // @ts-ignore
        stsd.avcC.write(stream);
        if (stream.buffer.byteLength >= 8) {
          description = new Uint8Array(stream.buffer.slice(8, (stream as any).position || stream.buffer.byteLength));
        }
      // @ts-ignore
      } else if (stsd.hvcC) {
        // @ts-ignore
        const stream = new MP4Box.DataStream(undefined, 0, MP4Box.DataStream.BIG_ENDIAN);
        // @ts-ignore
        stsd.hvcC.write(stream);
        if (stream.buffer.byteLength >= 8) {
          description = new Uint8Array(stream.buffer.slice(8, (stream as any).position || stream.buffer.byteLength));
        }
      }
    }

    const config: VideoDecoderConfig = {
      codec: track.codec.startsWith('avc1') ? track.codec : 'avc1.42E01E',
      codedWidth: track.video.width,
      codedHeight: track.video.height,
      hardwareAcceleration: 'prefer-hardware',
      description: description
    };

    try {
      decoder.configure(config);
    } catch (e) {
      console.warn('Hardware acceleration configure failed, falling back to software:', e);
      config.hardwareAcceleration = 'prefer-software';
      decoder.configure(config);
    }
  };

  mp4boxfile.onReady = (info: any) => {
    videoTrack = info.videoTracks[0];
    if (!videoTrack) {
      self.postMessage({ type: 'error', error: 'No video track found' });
      return;
    }
    
    totalFrames = videoTrack.nb_samples;
    postProgress('reading', 0);
    
    initDecoder(videoTrack);
    
    mp4boxfile.setExtractionOptions(videoTrack.id, null, { nbSamples: totalFrames });
    mp4boxfile.start();
  };

  let samplesFed = 0;
  mp4boxfile.onSamples = async (id: number, user: any, samples: any[]) => {
    for (const sample of samples) {
      // BACKPRESSURE: Wait if hardware NVDEC queue is busy
      // NVIDIA drivers fail and crash the GPU process if flooded with unthrottled frames
      while (decoder && decoder.state === 'configured' && decoder.decodeQueueSize > 4) {
        await new Promise(r => setTimeout(r, 4));
      }

      if (!decoder || decoder.state !== 'configured') break;

      const chunk = new EncodedVideoChunk({
        type: sample.is_sync ? 'key' : 'delta',
        timestamp: (sample.cts * 1000000) / sample.timescale,
        duration: (sample.duration * 1000000) / sample.timescale,
        data: sample.data
      });
      decoder.decode(chunk);
      samplesFed++;
    }

    if (samplesFed >= totalFrames && decoder && decoder.state === 'configured') {
      try {
        await decoder.flush();
      } catch (e) {
        console.error('Flush error:', e);
      }
      self.postMessage({ type: 'complete' });
    }
  };

  // Provide the buffer to mp4box
  // @ts-ignore
  (buffer as any).fileStart = 0;
  // @ts-ignore
  mp4boxfile.appendBuffer(buffer);
  mp4boxfile.flush();
};
