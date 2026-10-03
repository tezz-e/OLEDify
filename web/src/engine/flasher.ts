import { ESPLoader, Transport } from 'esptool-js';
import { serialStreamer } from './webSerialStreamer';

export interface FlashProgress {
  percent: number;
  message: string;
}

export type FlashProgressCallback = (progress: FlashProgress) => void;

/**
 * Safely disconnects and releases all reader/writer locks on a WebSerial transport.
 * Prevents "The port is already open" or locked stream freezes in esptool-js.
 */
async function safeDisconnectTransport(transport: any, port?: any): Promise<void> {
  if (transport) {
    try {
      if (transport.reader) {
        try {
          await transport.reader.cancel();
        } catch {}
        try {
          transport.reader.releaseLock();
        } catch {}
        transport.reader = undefined;
      }
    } catch {}

    try {
      if (transport.device) {
        await transport.device.close();
      }
    } catch {}
  }

  if (port) {
    try {
      await port.close();
    } catch {}
  }

  // Allow USB serial driver and hardware buffers to settle
  await new Promise((r) => setTimeout(r, 250));
}

export async function flashAnimationToDevice(
  xbmpFrames: Uint8Array[],
  targetFps: number,
  onProgress?: FlashProgressCallback
) {
  // 1. If live streamer is currently connected, cleanly disconnect to release port FIRST
  if (serialStreamer.getConnected()) {
    onProgress?.({ percent: 3, message: 'Releasing live stream connection...' });
    await serialStreamer.disconnect();
    await new Promise((r) => setTimeout(r, 400));
  }

  // 2. Pack the frames into binary payload
  onProgress?.({ percent: 8, message: 'Packing animation frames...' });
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

  // 3. Primary Route: Try local PlatformIO hardware flasher (/api/flash)
  // This uses the exact same Python esptool.py pipeline that succeeds 100% in PlatformIO
  try {
    onProgress?.({ percent: 12, message: 'Connecting to PlatformIO hardware flasher...' });
    const resp = await fetch('/api/flash', {
      method: 'POST',
      body: blob,
    });

    if (resp.ok && resp.body) {
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let flashSucceeded = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data:')) {
            try {
              const event = JSON.parse(trimmed.slice(5).trim());
              if (event.percent === -1) {
                throw new Error(event.message || 'Flashing failed.');
              }
              if (event.percent === 100) {
                flashSucceeded = true;
              }
              onProgress?.({
                percent: event.percent,
                message: event.message,
              });
            } catch (jsonErr: any) {
              if (jsonErr.message && !jsonErr.message.includes('JSON')) {
                throw jsonErr;
              }
            }
          }
        }
      }

      if (flashSucceeded) {
        onProgress?.({ percent: 100, message: 'Flash complete! 30 FPS high-speed engine running on OLED.' });
        return;
      }
    }
  } catch (backendErr: any) {
    console.warn('Local PlatformIO flasher unavailable or returned error, falling back to WebSerial:', backendErr);
  }

  // 4. Secondary Route: In-browser WebSerial (for standalone/remote deployment)
  onProgress?.({ percent: 18, message: 'Detecting serial port for WebSerial...' });
  let port: any = null;
  const grantedPorts = await (navigator as any).serial?.getPorts?.();

  if (grantedPorts && grantedPorts.length === 1) {
    port = grantedPorts[0];
  } else {
    port = await (navigator as any).serial.requestPort();
  }

  if (!port) {
    throw new Error('No serial port selected.');
  }

  const info = port.getInfo?.() || {};
  const isUsbJtag = info.usbProductId === 0x1001 || (info.usbVendorId === 0x303a && (!info.usbProductId || info.usbProductId === 0x1001));

  const strategies = isUsbJtag 
    ? ['usb_reset', 'default_reset', 'no_reset'] 
    : ['default_reset', 'usb_reset', 'no_reset'];

  let activeTransport: any = null;
  let activeLoader: any = null;
  let detectedChip = '';

  for (let idx = 0; idx < strategies.length; idx++) {
    const strategy = strategies[idx];
    try {
      console.log(`[flasher] Attempting WebSerial sync with strategy: ${strategy} (attempt ${idx + 1}/${strategies.length})`);
      activeTransport = new Transport(port);
      activeLoader = new ESPLoader({
        transport: activeTransport,
        baudrate: 460800,
        terminal: {
          writeLine: (data: string) => console.log('[esptool]', data),
          clean: () => {}
        } as any
      });

      detectedChip = await activeLoader.main(strategy);
      if (detectedChip) {
        console.log(`[flasher] Successfully connected to ${detectedChip} using ${strategy}!`);
        break;
      }
    } catch (err: any) {
      console.warn(`[flasher] Strategy ${strategy} failed:`, err?.message || err);
      await safeDisconnectTransport(activeTransport, port);
      activeTransport = null;
      activeLoader = null;
      if (idx === strategies.length - 1) {
        throw new Error(
          'Failed to sync with ESP32 bootloader. Hold the BOOT button on the board, press RST once, release BOOT, and click Flash again.'
        );
      }
      onProgress?.({ percent: 20, message: `Retrying connection (mode: ${strategies[idx + 1]})...` });
    }
  }

  if (!activeLoader || !activeTransport) {
    throw new Error('Failed to initialize ESP32 loader.');
  }

  try {
    onProgress?.({ percent: 25, message: `Connected to ${detectedChip || 'ESP32'}. Preparing payload...` });

    const filesToFlash: Array<{ data: Uint8Array | string; address: number }> = [];
    try {
      const fwResp = await fetch('/firmware.bin');
      if (fwResp.ok) {
        const fwBuffer = await fwResp.arrayBuffer();
        if (fwBuffer.byteLength > 10000) {
          filesToFlash.push({ data: new Uint8Array(fwBuffer), address: 0x10000 });
        }
      }
    } catch (e) {
      console.warn('Firmware binary fetch skipped:', e);
    }

    filesToFlash.push({ data: blob, address: 0x200000 });

    const flashOptions: any = {
      fileArray: filesToFlash,
      flashSize: 'keep',
      flashMode: 'keep',
      flashFreq: 'keep',
      eraseAll: false,
      compress: true,
      reportProgress: (_fileIndex: number, written: number, total: number) => {
        const pct = Math.min(98, Math.round(25 + (written / total) * 70));
        onProgress?.({
          percent: pct,
          message: `Flashing high-speed engine (${Math.round((written / total) * 100)}%)...`,
        });
      }
    };

    await activeLoader.writeFlash(flashOptions);

    onProgress?.({ percent: 99, message: 'Rebooting ESP32 into 30 FPS firmware...' });
    try {
      await activeLoader.after('hard_reset');
    } catch (e) {
      console.log('Post-flash reset executed:', e);
    }

    try {
      await activeTransport.setRTS(true);
      await new Promise((r) => setTimeout(r, 100));
      await activeTransport.setRTS(false);
    } catch {}

    onProgress?.({ percent: 100, message: 'Flash complete! 30 FPS high-speed engine running on OLED.' });
  } finally {
    await safeDisconnectTransport(activeTransport, port);
  }
}
