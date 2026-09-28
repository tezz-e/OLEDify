import { LyricLine } from '../lyrics/types';

export type MotionArchetype = 
  | 'manga_impact'
  | 'cyber_glitch'
  | 'smooth_fluid'
  | '3d_block_stack'
  | 'wiggly_boil'
  | 'inverted_badge';

export interface TextLayoutResult {
  lines: string[];
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  totalHeight: number;
  yOffsets: number[];
}

export interface KineticRenderOptions {
  lyrics: LyricLine[];
  startMs: number;
  endMs: number;
  targetFps?: number; // Default 30 FPS
  archetype: MotionArchetype;
  fontFamily?: string;
  theme?: 'cyan' | 'white' | 'amber' | 'green';
}
