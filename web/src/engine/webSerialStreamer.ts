/**
 * WebSerial helper for streaming 1024-byte OLED frames to ESP32 over USB Serial.
 * Features non-blocking queue guard to prevent WritableStream lock contention when dragging sliders.
 */

export class WebSerialStreamer {
  private port: any = null;
  private writer: any = null;
  private onDisconnectCallback: (() => void) | null = null;
  private isConnected: boolean = false;
  private isWriting: boolean = false;
  private pendingFrame: Uint8Array | null = null;

  constructor() {
    if ('serial' in navigator) {
      (navigator as any).serial.addEventListener('disconnect', (e: any) => {
        if (e.target === this.port) {
          console.log('WebSerial: Device unplugged physically.');
          this.disconnect();
          if (this.onDisconnectCallback) this.onDisconnectCallback();
        }
      });
    }
  }

  public getConnected(): boolean {
    return this.isConnected;
  }

  public setOnDisconnect(callback: () => void) {
    this.onDisconnectCallback = callback;
  }

  public async connect(): Promise<boolean> {
    if (!('serial' in navigator)) {
      alert('WebSerial API is not supported in this browser. Please use Google Chrome or MS Edge.');
      return false;
    }

    try {
      this.port = await (navigator as any).serial.requestPort();
      await this.port.open({ baudRate: 115200 });

      this.writer = this.port.writable.getWriter();
      this.isConnected = true;
      this.isWriting = false;
      this.pendingFrame = null;
      console.log('WebSerial: Connected to ESP32-S3 successfully!');
      return true;
    } catch (err) {
      console.error('WebSerial Connection Error:', err);
      this.isConnected = false;
      return false;
    }
  }

  public async disconnect(): Promise<void> {
    this.isConnected = false;
    this.pendingFrame = null;

    if (this.writer) {
      try {
        this.writer.releaseLock();
      } catch {
        // Ignore release errors on forced disconnect
      }
      this.writer = null;
    }

    if (this.port) {
      try {
        await this.port.close();
      } catch {
        // Ignore close errors
      }
      this.port = null;
    }
  }

  /**
   * Non-blocking queued frame sender.
   * Prevents 'Cannot write to a stream while another write is in progress' errors during rapid UI slider moves.
   */
  public sendFrame(xbmpBytes: Uint8Array): void {
    if (!this.isConnected || !this.writer) return;

    // Always keep latest frame
    this.pendingFrame = xbmpBytes;

    if (this.isWriting) {
      return; // Queue loop will pick up pendingFrame automatically
    }

    this.flushQueue();
  }

  private async flushQueue(): Promise<void> {
    this.isWriting = true;

    try {
      while (this.pendingFrame && this.isConnected && this.writer) {
        const frameToSend = this.pendingFrame;
        this.pendingFrame = null; // Clear pending before await

        const packet = new Uint8Array(1026);
        packet[0] = 0xAA;
        packet[1] = 0xBB;
        packet.set(frameToSend, 2);

        await this.writer.write(packet);
      }
    } catch (err) {
      console.error('WebSerial Write Error:', err);
    } finally {
      this.isWriting = false;
      // If a new frame arrived right as we finished, flush again
      if (this.pendingFrame && this.isConnected && this.writer) {
        this.flushQueue();
      }
    }
  }
}

export const serialStreamer = new WebSerialStreamer();
