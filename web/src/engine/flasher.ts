import { ESPLoader, Transport } from 'esptool-js';

export async function flashAnimationToDevice(xbmpFrames: Uint8Array[], targetFps: number) {
  // 1. Pack the frames into a binary blob
  const totalFrames = xbmpFrames.length;
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
    blob.set(xbmpFrames[i], offset);
    offset += 1024;
  }

  // 2. Connect via WebSerial
  const port = await navigator.serial.requestPort();
  const transport = new Transport(port);
  
  try {
    const loader = new ESPLoader({
      transport,
      baudrate: 115200,
      terminal: {
        writeLine: (data: string) => console.log(data),
        clean: () => {}
      } as any
    });
    
    await loader.main();

    // 3. Flash to offset 0x200000 (animation partition)
    const flashOptions: any = {
      fileArray: [{ data: blob, address: 0x200000 }],
      flashSize: 'keep',
      flashMode: 'keep',
      flashFreq: 'keep',
      eraseAll: false,
      compress: true,
      reportProgress: (fileIndex: number, written: number, total: number) => {
        console.log(`Flashing progress: ${Math.round((written / total) * 100)}%`);
      }
    };

    await loader.writeFlash(flashOptions);
  } finally {
    await transport.disconnect();
  }
}
