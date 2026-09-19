import { ESPLoader, Transport } from 'esptool-js';

export async function flashAnimationToDevice(frames: ImageData[], targetFps: number) {
  // 1. Pack the frames into a binary blob
  const totalFrames = frames.length;
  // Header: 4 bytes frame count, 4 bytes FPS
  const header = new Uint8Array(8);
  header[0] = totalFrames & 0xFF;
  header[1] = (totalFrames >> 8) & 0xFF;
  header[2] = (totalFrames >> 16) & 0xFF;
  header[3] = (totalFrames >> 24) & 0xFF;
  
  header[4] = targetFps & 0xFF;
  header[5] = (targetFps >> 8) & 0xFF;
  header[6] = (targetFps >> 16) & 0xFF;
  header[7] = (targetFps >> 24) & 0xFF;

  // 1024 bytes per frame (128 * 64 / 8)
  const totalSize = 8 + (totalFrames * 1024);
  const blob = new Uint8Array(totalSize);
  blob.set(header, 0);

  let offset = 8;
  for (let i = 0; i < totalFrames; i++) {
    const frameData = frames[i].data;
    // Pack 0/255 dithered ImageData back to 1-bit XBMP
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 128; x += 8) {
        let byte = 0;
        for (let b = 0; b < 8; b++) {
          const pixelIdx = (y * 128 + (x + b)) * 4;
          if (frameData[pixelIdx] > 128) { // If lit
            byte |= (1 << b); // LSB first
          }
        }
        blob[offset++] = byte;
      }
    }
  }

  // 2. Connect via WebSerial
  const port = await navigator.serial.requestPort();
  const transport = new Transport(port);
  
  try {
    const loader = new ESPLoader(transport, 115200, null);
    await loader.main_fn();

    // 3. Flash to offset 0x200000 (animation partition)
    const flashOptions = {
      fileArray: [{ data: blob, address: 0x200000 }],
      flashSize: 'keep',
      eraseAll: false,
      compress: true,
      reportProgress: (fileIndex: number, written: number, total: number) => {
        console.log(`Flashing progress: ${Math.round((written / total) * 100)}%`);
      }
    };

    await loader.write_flash(flashOptions);
    
    // 4. Hard reset
    await loader.hard_reset();
  } finally {
    await transport.disconnect();
  }
}
