/**
 * Contract: media.ts
 * Standard types for Web Studio Media Ingestion, Crop/Scale, and Downstream Dithering.
 */

export type MediaType = 'video' | 'gif' | 'sequence';

export interface ExtractedFrame {
  index: number;
  timestampMs: number; // Presentation timestamp in milliseconds
  durationMs: number;  // Frame duration (crucial for variable-delay GIFs)
  imageData: ImageData; // Intermediate or source canvas image data
}

export interface MediaSourceInfo {
  type: MediaType;
  filename: string;
  sourceWidth: number;
  sourceHeight: number;
  frameCount: number;
  fps: number;
  durationMs: number;
}

export interface DecodedMedia {
  sourceInfo: MediaSourceInfo;
  frames: ExtractedFrame[];
}

export type FitMode = 'cover' | 'contain' | 'stretch';

export interface CropSettings {
  mode: FitMode;
  x: number;
  y: number;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
  smoothing: boolean; // true = high quality bicubic, false = pixel-art nearest neighbor
}

export interface DecodeProgress {
  stage: 'reading' | 'decoding' | 'resampling' | 'complete';
  currentFrame: number;
  totalFrames: number;
  percent: number;
  message?: string;
}

export interface DecoderOptions {
  targetFps?: number;           // Target frame rate (default: 30, supports 15, 20, 24, 30)
  maxDimension?: number;        // Max intermediate dimension (e.g. 512, protects against OOM)
  signal?: AbortSignal;         // Cancellation signal
  onProgress?: (progress: DecodeProgress) => void;
}

// ---------------------------------------------------------
// NLE Timeline Models
// ---------------------------------------------------------

export interface MediaAsset {
  id: string; // Unique asset ID
  media: DecodedMedia;
}

export interface TimelineClip {
  id: string; // Unique clip ID
  assetId: string; // Reference to MediaAsset
  inFrame: number; // The start index in the source media's frames array
  outFrame: number; // The end index (inclusive) in the source media's frames array
}

export interface TimelineProject {
  assets: Record<string, MediaAsset>; // Dictionary of all imported assets
  clips: TimelineClip[]; // Ordered sequence of clips in the timeline
  targetFps: number;
}

