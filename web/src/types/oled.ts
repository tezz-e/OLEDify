export const OLED_WIDTH = 128;
export const OLED_HEIGHT = 64;
export const OLED_ASPECT = 2.0; // 128:64
export const OLED_BYTES_PER_ROW = 16; // 128 / 8
export const OLED_FRAME_BYTES = 1024; // 16 * 64

export type Microcontroller = 'esp32-s3' | 'esp32' | 'esp32-c3' | 'arduino-uno' | 'pi-pico';
export type DisplayController = 'sh1106' | 'ssd1306' | 'ssd1315';

export interface HardwareConfig {
  mcu: Microcontroller;
  display: DisplayController;
  sdaPin: number;
  sclPin: number;
  i2cAddress: string; // '0x3C' | '0x3D'
}

export interface XbmpFrame {
  index: number;
  timestampMs: number;
  durationMs: number;
  bytes: Uint8Array; // Exactly 1024 bytes (row-major, LSB-first)
}

export interface PlaybackState {
  isPlaying: boolean;
  currentFrameIndex: number;
  targetFps: number;
  loop: boolean;
}
