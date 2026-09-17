export type DitherAlgorithm = 
  | 'atkinson' 
  | 'floyd-steinberg' 
  | 'bayer-2' 
  | 'bayer-4' 
  | 'bayer-8' 
  | 'threshold';

export type PhosphorTheme = 'cyan' | 'white' | 'amber' | 'green' | 'yellow-blue';

export interface DitherConfig {
  algorithm: DitherAlgorithm;
  brightness: number; // -100 to +100
  contrast: number;   // -100 to +100
  threshold: number;  // 0 to 255
  invert: boolean;
  theme: PhosphorTheme;
}
