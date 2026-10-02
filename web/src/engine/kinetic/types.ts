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
  | 'inverted_badge'
  | 'rolling_odometer'
  | 'gentle_float'
  | 'dither_dissolve'
  | 'typewriter_ribbon'
  | 'waveform_karaoke';

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
  },
  rolling_odometer: {
    id: 'rolling_odometer',
    icon: '🎰',
    name: 'ROLLING ODOMETER',
    tag: 'REEL',
    description: 'Mechanical slot-machine tumbler reels rolling vertically into locked alignment'
  },
  gentle_float: {
    id: 'gentle_float',
    icon: '🍃',
    name: 'GENTLE FLOAT',
    tag: 'DRIFT',
    description: 'Weightless acoustic drift with subtle dual-harmonic Lissajous floating and volume breathing'
  },
  dither_dissolve: {
    id: 'dither_dissolve',
    icon: '✨',
    name: 'DITHER DISSOLVE',
    tag: 'DITHER',
    description: 'Nostalgic 1-bit Bayer ordered dither matrix crossfade and dissolve with zero crawling'
  },
  typewriter_ribbon: {
    id: 'typewriter_ribbon',
    icon: '📜',
    name: 'TYPEWRITER RIBBON',
    tag: 'STORY',
    description: 'Intimate progressive storytelling reveal with blinking block cursor and expanding underline ribbon'
  },
  waveform_karaoke: {
    id: 'waveform_karaoke',
    icon: '🎵',
    name: 'WAVEFORM KARAOKE',
    tag: 'MELODY',
    description: 'Rock-solid centered lyric with fluid vocal wave and tracking runner beacon'
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
  | 'pop_acoustic'
  | 'editorial_lofi'
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

export const MULTILINGUAL_FALLBACK_FONTS = 
  "'Yatra One', 'Anek Gurmukhi', 'Dela Gothic One', 'Black Han Sans', 'Rubik Mono One', 'Lalezar', 'Anek Tamil', 'Anek Telugu', 'Rubik'";

export const STYLE_PACKS: Record<StylePackId, StylePackConfig> = {
  trap_drill: {
    id: 'trap_drill',
    name: 'Trap & Drill Opium',
    icon: '🗡️',
    tag: 'TRAP',
    description: 'Lemon Milk & Molot brutalist punch with Wilhelm Gotisch punchlines and clean mono connectors',
    fonts: {
      hero: `'Lemon Milk', ${MULTILINGUAL_FALLBACK_FONTS}, sans-serif`,
      action: `'Molot', ${MULTILINGUAL_FALLBACK_FONTS}, sans-serif`,
      novelty: `'Wilhelm Gotisch', ${MULTILINGUAL_FALLBACK_FONTS}, sans-serif`,
      anchor: `"IBM Plex Mono", ${MULTILINGUAL_FALLBACK_FONTS}, monospace`
    }
  },
  shonen_comic: {
    id: 'shonen_comic',
    name: 'Shonen Manga Action',
    icon: '💥',
    tag: 'COMIC',
    description: 'Bangers hero impact, Kraash punk slashes, Super Comic blocks, and mono conversational flow',
    fonts: {
      hero: `'Bangers', ${MULTILINGUAL_FALLBACK_FONTS}, cursive`,
      action: `'Kraash Black', ${MULTILINGUAL_FALLBACK_FONTS}, cursive`,
      novelty: `'Super Comic', ${MULTILINGUAL_FALLBACK_FONTS}, sans-serif`,
      anchor: `"IBM Plex Mono", ${MULTILINGUAL_FALLBACK_FONTS}, monospace`
    }
  },
  cartoon_bounce: {
    id: 'cartoon_bounce',
    name: 'Y2K Cartoon Bounce',
    icon: '🎈',
    tag: 'BOUNCE',
    description: '1930s Wicked Mouse hero, bubbly Luckiest Guy actions, puffy Bubblegum, and clean modern tech mono',
    fonts: {
      hero: `'Wicked Mouse', ${MULTILINGUAL_FALLBACK_FONTS}, cursive`,
      action: `'Luckiest Guy', ${MULTILINGUAL_FALLBACK_FONTS}, cursive`,
      novelty: `'Bubblegum', ${MULTILINGUAL_FALLBACK_FONTS}, cursive`,
      anchor: `"Space Mono", ${MULTILINGUAL_FALLBACK_FONTS}, monospace`
    }
  },
  cyber_industrial: {
    id: 'cyber_industrial',
    name: 'Cyberpunk Industrial',
    icon: '⚡',
    tag: 'CYBER',
    description: 'Brutalist Molot hero, VT323 retro pixel glitch, Space Mono speed, and IBM Plex anchor',
    fonts: {
      hero: `'Molot', ${MULTILINGUAL_FALLBACK_FONTS}, sans-serif`,
      action: `VT323, ${MULTILINGUAL_FALLBACK_FONTS}, monospace`,
      novelty: `"Space Mono", ${MULTILINGUAL_FALLBACK_FONTS}, monospace`,
      anchor: `"IBM Plex Mono", ${MULTILINGUAL_FALLBACK_FONTS}, monospace`
    }
  },
  pop_acoustic: {
    id: 'pop_acoustic',
    name: 'Pop & Acoustic Melodies',
    icon: '🎸',
    tag: 'POP',
    description: 'Rounded Poppins hero, clean DM Sans actions, handwritten Caveat lyrics, and Inter anchor',
    fonts: {
      hero: `'Poppins', 'Outfit', ${MULTILINGUAL_FALLBACK_FONTS}, sans-serif`,
      action: `'DM Sans', 'Plus Jakarta Sans', ${MULTILINGUAL_FALLBACK_FONTS}, sans-serif`,
      novelty: `'Caveat', 'Patrick Hand', ${MULTILINGUAL_FALLBACK_FONTS}, cursive`,
      anchor: `'Inter', "IBM Plex Mono", ${MULTILINGUAL_FALLBACK_FONTS}, sans-serif`
    }
  },
  editorial_lofi: {
    id: 'editorial_lofi',
    name: 'Editorial & Lo-Fi Chill',
    icon: '☕',
    tag: 'LO-FI',
    description: 'Neoclassical Playfair Display hero, vintage Courier Prime typewriter, Space Mono and IBM Plex',
    fonts: {
      hero: `'Playfair Display', 'Lora', ${MULTILINGUAL_FALLBACK_FONTS}, serif`,
      action: `'Courier Prime', 'Special Elite', ${MULTILINGUAL_FALLBACK_FONTS}, monospace`,
      novelty: `"Space Mono", ${MULTILINGUAL_FALLBACK_FONTS}, monospace`,
      anchor: `"IBM Plex Mono", ${MULTILINGUAL_FALLBACK_FONTS}, monospace`
    }
  },
  custom: {
    id: 'custom',
    name: 'Custom Curated',
    icon: '⚙️',
    tag: 'CUSTOM',
    description: 'User-selected custom Hero typography with automatically tuned semantic companion fonts',
    fonts: {
      hero: `"IBM Plex Mono", ${MULTILINGUAL_FALLBACK_FONTS}, monospace`,
      action: `'Vendetta', ${MULTILINGUAL_FALLBACK_FONTS}, cursive`,
      novelty: `'Molot', ${MULTILINGUAL_FALLBACK_FONTS}, sans-serif`,
      anchor: `"IBM Plex Mono", ${MULTILINGUAL_FALLBACK_FONTS}, monospace`
    }
  }
};

export type VisualMotif =
  | 'none'
  | 'manga_speedlines'
  | 'anime_rush'
  | 'crown_royal'
  | 'razor_blade'
  | 'tactical_scope'
  | 'flame_tongue'
  | 'skull_cross'
  | 'chrome_star'
  | 'lightning_arc'
  | 'comic_burst'
  | 'floating_notes'
  | 'starlight_glimmer'
  | 'heartbeat_pulse'
  | 'water_ripples'
  | 'minimal_frame'
  | 'lofi_dust_motes';

export type MotifMode = 'off' | 'subtle' | 'dynamic' | 'heavy';

export interface MotifMeta {
  id: VisualMotif;
  icon: string;
  name: string;
  tag: string;
  description: string;
}

export const MOTIF_METADATA: Record<VisualMotif, MotifMeta> = {
  none: {
    id: 'none',
    icon: '🚫',
    name: 'None (Pure Typography)',
    tag: 'CLEAN',
    description: 'Clean typography only with zero background visual distractions'
  },
  manga_speedlines: {
    id: 'manga_speedlines',
    icon: '💥',
    name: 'Manga Speedlines',
    tag: 'RADIAL',
    description: 'Tapered ink focus wedges converging around text'
  },
  anime_rush: {
    id: 'anime_rush',
    icon: '💨',
    name: 'Anime Rush Lines',
    tag: 'RUSH',
    description: 'Horizontal speed barrage streaks simulating rapid velocity'
  },
  crown_royal: {
    id: 'crown_royal',
    icon: '👑',
    name: 'Royal Crown',
    tag: 'ROYAL',
    description: 'Gothic / Basquiat 3-point crown for boss and king lyrics'
  },
  razor_blade: {
    id: 'razor_blade',
    icon: '🗡️',
    name: 'Razor Blade Slice',
    tag: 'CUT',
    description: 'Diagonal razor slice with impact cutting glints'
  },
  tactical_scope: {
    id: 'tactical_scope',
    icon: '🎯',
    name: 'Tactical Crosshairs',
    tag: 'AIM',
    description: 'HUD corner brackets and reticle targeting key nouns'
  },
  flame_tongue: {
    id: 'flame_tongue',
    icon: '🔥',
    name: 'Inferno Flames',
    tag: 'FIRE',
    description: 'Procedural 1-bit flame contours with rising ember particles'
  },
  skull_cross: {
    id: 'skull_cross',
    icon: '💀',
    name: 'Skull Stamp',
    tag: 'DEAD',
    description: '12x12 micro-sprite skull mark for lethal and grave lyrics'
  },
  chrome_star: {
    id: 'chrome_star',
    icon: '✨',
    name: 'Chrome Star Glint',
    tag: 'ICE',
    description: '4-point curved anime diamond sparkles for luxury and shine'
  },
  lightning_arc: {
    id: 'lightning_arc',
    icon: '⚡',
    name: 'Lightning Bolt',
    tag: 'VOLT',
    description: 'High-voltage electric jagged bolt for sudden voltage surges'
  },
  comic_burst: {
    id: 'comic_burst',
    icon: '🗯️',
    name: 'Comic Starburst',
    tag: 'BURST',
    description: '14-point pop-art comic explosion bubble behind text'
  },
  floating_notes: {
    id: 'floating_notes',
    icon: '🎶',
    name: 'Drifting Music Notes',
    tag: 'NOTES',
    description: 'Eighth notes and beamed sixteenth pairs drifting softly upward on melodies'
  },
  starlight_glimmer: {
    id: 'starlight_glimmer',
    icon: '✨',
    name: 'Twinkling Starlight',
    tag: 'STARS',
    description: 'Gentle constellation field of micro-stars breathing with harmonic twinkle'
  },
  heartbeat_pulse: {
    id: 'heartbeat_pulse',
    icon: '💓',
    name: 'Heartbeat & Love Ripple',
    tag: 'HEART',
    description: 'Acoustic cardiac two-phase heartbeat pulse with concentric expanding ripple rings'
  },
  water_ripples: {
    id: 'water_ripples',
    icon: '🌊',
    name: 'Ambient Ocean Waves',
    tag: 'WAVES',
    description: 'Gentle horizontal liquid surface waves along screen floor with translucent Bayer stipple'
  },
  minimal_frame: {
    id: 'minimal_frame',
    icon: '◻️',
    name: 'Editorial Minimalist Frame',
    tag: 'FRAME',
    description: 'Cinematic 1px hairline border with inset corner notches for refined ballad focus'
  },
  lofi_dust_motes: {
    id: 'lofi_dust_motes',
    icon: '🫧',
    name: 'Lo-Fi Dust Motes',
    tag: 'DUST',
    description: 'Ambient floating particles dancing lazily in warm light with proximity threads'
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
  wordMotifOverrides?: Record<string, VisualMotif>;
  motifMode?: MotifMode;
  stylePack?: StylePackId;
  customPalette?: StylePackConfig['fonts'];
  audioAnalysis?: AudioAnalysisResult;
}


