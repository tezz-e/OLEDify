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
    decoder = new VideoDecoder({
      output: (frame) => {
        let w = frame.codedWidth;
        let h = frame.codedHeight;
        const MAX_DIM = 400;
        if (w > MAX_DIM || h > MAX_DIM) {
           const scale = Math.min(MAX_DIM / w, MAX_DIM / h);
           w = Math.floor(w * scale);
           h = Math.floor(h * scale);
        }

        // Convert VideoFrame to ImageData to send back to main thread
        const canvas = new OffscreenCanvas(w, h);
        const ctx = canvas.getContext('2d');
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
        if (framesProcessed % 10 === 0) {
          postProgress('decoding', (framesProcessed / totalFrames) * 100);
        }
      },
      error: (e) => {
        console.error('VideoDecoder error:', e);
        self.postMessage({ type: 'error', error: e.message });
      }
    });

    // Configure decoder with hardware acceleration hint
    // We need to extract the avcC or hvcC box for the description
    // mp4box.js puts this in track.codec
    let description: Uint8Array | undefined = undefined;
    
    // MP4Box.js puts the AVC/HEVC config record in the avcC/hvcC box inside the sample description
    // This part can be tricky. For a simple implementation, if the browser supports it without description, it might work,
    // but usually avcC is required for avc1.
    // Fortunately, mp4box.js usually exposes it via track info, but the exact path varies.
    // For now, we rely on the codec string. If `description` is required and fails, we'll need to parse the STSD box.
    // Let's assume a modern browser can sometimes handle just the codec string for baseline.
    // Actually, WebCodecs requires `description` (AVCDecoderConfigurationRecord) for avc1.
    
    // Let's grab the description from the track's first avcC box if available
    const trak = mp4boxfile.getTrackById(track.id);
    if (trak && trak.mdia && trak.mdia.minf && trak.mdia.minf.stbl && trak.mdia.minf.stbl.stsd) {
      const stsd = trak.mdia.minf.stbl.stsd.entries[0];
      // @ts-ignore
      if (stsd.avcC) {
        // @ts-ignore
        const stream = new MP4Box.DataStream(undefined, 0, MP4Box.DataStream.BIG_ENDIAN);
        // @ts-ignore
        stsd.avcC.write(stream);
        description = new Uint8Array(stream.buffer, 8); // Skip box header
      // @ts-ignore
      } else if (stsd.hvcC) {
        // @ts-ignore
        const stream = new MP4Box.DataStream(undefined, 0, MP4Box.DataStream.BIG_ENDIAN);
        // @ts-ignore
        stsd.hvcC.write(stream);
        description = new Uint8Array(stream.buffer, 8);
      }
    }

    decoder.configure({
      codec: track.codec.startsWith('avc1') ? track.codec : 'avc1.42E01E', // Fallback to baseline if weird
      codedWidth: track.video.width,
      codedHeight: track.video.height,
      hardwareAcceleration: 'prefer-hardware',
      description: description
    });
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
      const chunk = new EncodedVideoChunk({
        type: sample.is_sync ? 'key' : 'delta',
        timestamp: (sample.cts * 1000000) / sample.timescale,
        duration: (sample.duration * 1000000) / sample.timescale,
        data: sample.data
      });
      if (decoder && decoder.state === 'configured') {
        decoder.decode(chunk);
      }
      samplesFed++;
    }

    if (samplesFed === totalFrames && decoder && decoder.state === 'configured') {
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
