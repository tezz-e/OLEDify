import { LyricLine } from '../lyrics/types';

export type MotionArchetype = 
  | 'auto_semantic'
  | 'manga_impact'
  | 'blade_slash'
  | 'cyber_glitch'
  | 'smooth_fluid'
  | '3d_block_stack'
  | 'echo_stack'
  | 'target_focus'
  | 'snake_slither'
  | 'wiggly_boil'
  | 'inverted_badge';

export interface ArchetypeMeta {
  id: MotionArchetype;
  icon: string;
  name: string;
  tag: string;
  description: string;
}

export const ARCHETYPE_METADATA: Record<MotionArchetype, ArchetypeMeta> = {
  auto_semantic: {
    id: 'auto_semantic',
    icon: '✨',
    name: 'AUTO SEMANTIC DIRECTOR',
    tag: 'DYNAMIC',
    description: 'Auto-adapts motion style per word dynamically based on semantic meaning, beats & duration'
  },
  blade_slash: {
    id: 'blade_slash',
    icon: '⚔️',
    name: 'BLADE SLASH',
    tag: 'CUT',
    description: 'Split halves sliding apart along a sharp diagonal razor slice'
  },
  manga_impact: {
    id: 'manga_impact',
    icon: '💥',
    name: 'MANGA IMPACT',
    tag: 'SNAP',
    description: 'Radial action speed lines with sudden velocity punch'
  },
  '3d_block_stack': {
    id: '3d_block_stack',
    icon: '🧊',
    name: '3D BLOCK STACK',
    tag: 'DEPTH',
    description: 'Isometric extruded block stack with Bayer matrix shading'
  },
  snake_slither: {
    id: 'snake_slither',
    icon: '🐍',
    name: 'SNAKE SLITHER',
    tag: 'VENOM',
    description: 'Sinusoidal venomous creeping motion along horizontal wave'
  },
  cyber_glitch: {
    id: 'cyber_glitch',
    icon: '⚡',
    name: 'CYBER GLITCH',
    tag: 'TEAR',
    description: 'Matrix horizontal scanline displacement & byte flicker'
  },
  echo_stack: {
    id: 'echo_stack',
    icon: '📢',
    name: 'ECHO STACK',
    tag: 'TRAIL',
    description: 'Cascading vertical ghost trails for held vocals and chants'
  },
  target_focus: {
    id: 'target_focus',
    icon: '🎯',
    name: 'TARGET FOCUS',
    tag: 'LOCK',
    description: 'Tactical crosshair reticle zooming and snapping to text'
  },
  smooth_fluid: {
    id: 'smooth_fluid',
    icon: '🌊',
    name: 'SMOOTH FLUID',
    tag: 'GLIDE',
    description: 'Liquid ease-in-out kinetic glide with soft deceleration'
  },
  inverted_badge: {
    id: 'inverted_badge',
    icon: '🏷️',
    name: 'INVERTED BADGE',
    tag: 'PUNCH',
    description: 'Negative solid black-on-white badge punch'
  },
  wiggly_boil: {
    id: 'wiggly_boil',
    icon: '〰️',
    name: 'WIGGLY BOIL',
    tag: 'BOIL',
    description: 'Squigglevision 12 FPS boiling hand-drawn jitter'
  }
};

export interface TextLayoutResult {
  lines: string[];
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  totalHeight: number;
  yOffsets: number[];
}

export type WordFontRole = 'hero' | 'action' | 'novelty' | 'anchor';

export type StylePackId = 
  | 'trap_drill'
  | 'shonen_comic'
  | 'cartoon_bounce'
  | 'cyber_industrial'
  | 'custom';

export interface StylePackConfig {
  id: StylePackId;
  name: string;
  icon: string;
  tag: string;
  description: string;
  fonts: {
    hero: string;      // Punchline, bass drop, 808, major noun
    action: string;    // Blade slash, razor, speed, aggressive
    novelty: string;   // Glitch, bounce, ad-libs, sound FX
    anchor: string;    // Connective words, conversational flow
  };
}

export const STYLE_PACKS: Record<StylePackId, StylePackConfig> = {
  trap_drill: {
    id: 'trap_drill',
    name: 'Trap & Drill Opium',
    icon: '🗡️',
    tag: 'TRAP',
    description: 'Wilhelm Gotisch hero with razor Vendetta slashes, brutalist Molot punch, and clean mono connectors',
    fonts: {
      hero: "'Wilhelm Gotisch', sans-serif",
      action: "'Vendetta', cursive",
      novelty: "'Molot', sans-serif",
      anchor: '"IBM Plex Mono", monospace'
    }
  },
  shonen_comic: {
    id: 'shonen_comic',
    name: 'Shonen Manga Action',
    icon: '💥',
    tag: 'COMIC',
    description: 'Bangers hero impact, Kraash punk slashes, Super Comic blocks, and mono conversational flow',
    fonts: {
      hero: "'Bangers', cursive",
      action: "'Kraash Black', cursive",
      novelty: "'Super Comic', sans-serif",
      anchor: '"IBM Plex Mono", monospace'
    }
  },
  cartoon_bounce: {
    id: 'cartoon_bounce',
    name: 'Y2K Cartoon Bounce',
    icon: '🎈',
    tag: 'BOUNCE',
    description: '1930s Wicked Mouse hero, bubbly Luckiest Guy actions, puffy Bubblegum, and clean modern tech mono',
    fonts: {
      hero: "'Wicked Mouse', cursive",
      action: "'Luckiest Guy', cursive",
      novelty: "'Bubblegum', cursive",
      anchor: '"Space Mono", monospace'
    }
  },
  cyber_industrial: {
    id: 'cyber_industrial',
    name: 'Cyberpunk Industrial',
    icon: '⚡',
    tag: 'CYBER',
    description: 'Brutalist Molot hero, VT323 retro pixel glitch, Space Mono speed, and IBM Plex anchor',
    fonts: {
      hero: "'Molot', sans-serif",
      action: "VT323, monospace",
      novelty: '"Space Mono", monospace',
      anchor: '"IBM Plex Mono", monospace'
    }
  },
  custom: {
    id: 'custom',
    name: 'Custom Curated',
    icon: '⚙️',
    tag: 'CUSTOM',
    description: 'User-selected custom Hero typography with automatically tuned semantic companion fonts',
    fonts: {
      hero: '"IBM Plex Mono", monospace',
      action: "'Vendetta', cursive",
      novelty: "'Molot', sans-serif",
      anchor: '"IBM Plex Mono", monospace'
    }
  }
};

import { AudioAnalysisResult } from './audioAnalysisEngine';

export interface KineticRenderOptions {
  lyrics: LyricLine[];
  startMs: number;
  endMs: number;
  targetFps?: number; // Default 30 FPS
  archetype: MotionArchetype;
  fontFamily?: string;
  theme?: 'cyan' | 'white' | 'amber' | 'green';
  wordOverrides?: Record<string, MotionArchetype>;
  wordFontOverrides?: Record<string, string>;
  stylePack?: StylePackId;
  customPalette?: StylePackConfig['fonts'];
  audioAnalysis?: AudioAnalysisResult;
}

