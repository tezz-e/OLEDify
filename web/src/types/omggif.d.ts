/**
 * Type declarations for 'omggif' (Kevin Kwok)
 */
declare module 'omggif' {
  export interface GifFrameInfo {
    x: number;
    y: number;
    width: number;
    height: number;
    disposal: number;          // 0: Unspecified, 1: Do not dispose, 2: Restore to background, 3: Restore to previous
    delay: number;             // Delay in hundredths of a second (10ms units)
    transparent_index: number | null;
    interlaced: boolean;
    has_local_palette: boolean;
  }

  export interface Frame {
    x: number;
    y: number;
    width: number;
    height: number;
    has_local_palette: boolean;
    palette_offset: number | null;
    palette_size: number | null;
    data_offset: number;
    data_length: number;
    transparent_index: number | null;
    interlaced: boolean;
    delay: number;
    disposal: number;
  }

  export class GifReader {
    width: number;
    height: number;
    constructor(buf: Uint8Array | ArrayLike<number>);
    numFrames(): number;
    loopCount(): number;
    frameInfo(frame_num: number): GifFrameInfo & Frame;
    decodeAndBlitFrameRGBA(frame_num: number, pixels: Uint8Array | Uint8ClampedArray | number[]): void;
    decodeAndBlitFrameBGRA(frame_num: number, pixels: Uint8Array | Uint8ClampedArray | number[]): void;
    frameNumber?(timeMs: number): number;
  }

  export class GifWriter {
    width: number;
    height: number;
    constructor(buf: Uint8Array | ArrayLike<number>, width: number, height: number, gopts?: unknown);
    addFrame(x: number, y: number, w: number, h: number, indexed_pixels: number[], opts?: unknown): number;
    end(): number;
    getOutputBuffer(): Uint8Array | ArrayLike<number>;
    getOutputBufferPosition(): number;
    setOutputBuffer(v: Uint8Array | ArrayLike<number>): void;
    setOutputBufferPosition(v: number): void;
  }
}
