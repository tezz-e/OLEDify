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
  | 'waveform_karaoke'
  | 'anvil_stomp'
  | 'fracture_shatter'
  | 'pendulum_sway'
  | 'prism_shimmer'
  | 'squash_bounce';

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
  },
  anvil_stomp: {
    id: 'anvil_stomp',
    icon: '🔨',
    name: 'ANVIL STOMP',
    tag: 'STOMP',
    description: 'Massive vertical slam crashing onto baseline with baseline shock dust and zero rebound'
  },
  fracture_shatter: {
    id: 'fracture_shatter',
    icon: '⚡',
    name: 'FRACTURE SHATTER',
    tag: 'FRACTURE',
    description: 'Angular diagonal fissure crack splitting letterforms into upper and lower shearing halves'
  },
  pendulum_sway: {
    id: 'pendulum_sway',
    icon: '🕰️',
    name: 'PENDULUM SWAY',
    tag: 'SWAY',
    description: 'Harmonic rocking angular tilt rocking smoothly like an acoustic guitar strum or metronome'
  },
  prism_shimmer: {
    id: 'prism_shimmer',
    icon: '💎',
    name: 'PRISM SHIMMER',
    tag: 'SHIMMER',
    description: 'Diagonal 1-bit Bayer light beam sweeping smoothly across glyphs with starlight glints'
  },
  squash_bounce: {
    id: 'squash_bounce',
    icon: '🏀',
    name: 'SQUASH & BOUNCE',
    tag: 'BOUNCE',
    description: 'Elastic Disney squash and stretch physics landing on baseline with rhythmic beat rebound'
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

export type TextDressing =
  | 'solid'
  | 'hollow_wireframe'
  | 'bayer_dither_shade'
  | 'scanline_slice'
  | 'echo_trail'
  | 'inverted_pill';

export interface TextDressingMeta {
  id: TextDressing;
  icon: string;
  name: string;
  tag: string;
  description: string;
}

export const TEXT_DRESSING_METADATA: Record<TextDressing, TextDressingMeta> = {
  solid: {
    id: 'solid',
    icon: '⬛',
    name: 'Solid Clean',
    tag: 'SOLID',
    description: 'Crisp high-contrast solid white glyph fill'
  },
  hollow_wireframe: {
    id: 'hollow_wireframe',
    icon: '🔲',
    name: '1px Hollow Wireframe',
    tag: 'WIRE',
    description: 'Ultra-clean 1px stroke outline with transparent hollow core'
  },
  bayer_dither_shade: {
    id: 'bayer_dither_shade',
    icon: '🏁',
    name: 'Bayer Dither Shade',
    tag: 'SHADE',
    description: 'Upper half solid white with lower half shaded in 2x2 Bayer dither mesh'
  },
  scanline_slice: {
    id: 'scanline_slice',
    icon: '💈',
    name: 'Scanline Slice',
    tag: 'SLICE',
    description: 'Horizontal negative 1px scanline cuts etching through the letterforms'
  },
  echo_trail: {
    id: 'echo_trail',
    icon: '👥',
    name: 'Echo Silhouette Trail',
    tag: 'TRAIL',
    description: 'Twin offset dithered ghost silhouettes trailing behind main text'
  },
  inverted_pill: {
    id: 'inverted_pill',
    icon: '🏷️',
    name: 'Inverted Pill Stamp',
    tag: 'PILL',
    description: 'Solid white rounded container badge with punched-out black text'
  }
};

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
  | 'lofi_dust_motes'
  | 'barbed_wire'
  | 'sound_blast_rings'
  | 'shattered_glass'
  | 'sound_bars_vintage'
  | 'rain_window'
  | 'cassette_spool'
  | 'equalizer_radial'
  | 'vinyl_grooves'
  | 'handlebar_moustache'
  | 'dark_sunglasses'
  | 'money_stack'
  | 'street_racer'
  | 'cracked_heart'
  | 'crossed_swords'
  | 'champion_trophy'
  | 'lucky_dice'
  | 'rolex_watch'
  | 'bullet_chamber_cylinder'
  | 'police_siren_sweep'
  | 'thar_jeep_grille'
  | 'punjabi_khanda'
  | 'cuban_chain_links'
  | 'drill_ski_mask'
  | 'studio_microphone'
  | 'boombox_blaster'
  | 'speaker_subwoofer_pulse'
  | 'electric_guitar'
  | 'metronome_ticker'
  | 'disco_mirror_ball'
  | 'city_skyline_silhouette'
  | 'smoke_ring_drift'
  | 'graffiti_drips'
  | 'champagne_toast'
  | 'neon_lips'
  | 'vault_safe_dial'
  | 'blooming_rose'
  | 'lunar_crescent'
  | 'candle_flame_flicker'
  | 'fluttering_butterflies'
  | 'falling_autumn_leaves'
  | 'feather_drift'
  | 'laser_grid_horizon'
  | 'matrix_rain_code'
  | 'neon_heart_tunnel'
  | 'radar_sweep_sonar'
  | 'hazard_stripes_caution'
  | 'antique_key_lock'
  | 'shonen_ki_aura'
  | 'portal_vortex'
  | 'all_seeing_eye'
  | 'knight_shield';

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
  },
  barbed_wire: {
    id: 'barbed_wire',
    icon: '⛓️',
    name: 'Barbed Wire Tangle',
    tag: 'WIRE',
    description: 'Taut diagonal 1-bit barbed fence wire with sharp razor barb pairs crossing canvas'
  },
  sound_blast_rings: {
    id: 'sound_blast_rings',
    icon: '📢',
    name: 'Sound Blast Rings',
    tag: 'BLAST',
    description: 'Concentric elliptical shockwave blast rings pulsing outward on heavy bass'
  },
  shattered_glass: {
    id: 'shattered_glass',
    icon: '💥',
    name: 'Shattered Glass Shards',
    tag: 'SHARD',
    description: 'Angular polygon glass shards bursting and rotating outward from center'
  },
  sound_bars_vintage: {
    id: 'sound_bars_vintage',
    icon: '📊',
    name: 'Vintage Equalizer Bars',
    tag: 'BARS',
    description: 'Classic hi-fi stereo graphic equalizer spectrum bars dancing along screen floor'
  },
  rain_window: {
    id: 'rain_window',
    icon: '🌧️',
    name: 'Window Rain Streaks',
    tag: 'RAIN',
    description: 'Slanted 1-bit rain streaks with micro-splash ripples at baseline'
  },
  cassette_spool: {
    id: 'cassette_spool',
    icon: '📼',
    name: 'Dual Cassette Spools',
    tag: 'TAPE',
    description: 'Retro dual spinning tape spools with 3-spoke hubs and connecting tape ribbon'
  },
  equalizer_radial: {
    id: 'equalizer_radial',
    icon: '🎛️',
    name: 'Radial Equalizer Orbit',
    tag: 'RADIAL',
    description: 'Circular 360-degree audio spectrum analyzer radiating around center text'
  },
  vinyl_grooves: {
    id: 'vinyl_grooves',
    icon: '📀',
    name: 'Turntable Vinyl Grooves',
    tag: 'VINYL',
    description: 'Concentric turntable record micro-grooves with spinning center spindle hole'
  },
  handlebar_moustache: {
    id: 'handlebar_moustache',
    icon: '🥸',
    name: 'Royal Handlebar Moustache',
    tag: 'SWAG',
    description: 'Curled royal handlebar moustache emblem with swagger tilt and sharp tips'
  },
  dark_sunglasses: {
    id: 'dark_sunglasses',
    icon: '🕶️',
    name: 'Dark Sunglasses',
    tag: 'SHADES',
    description: 'Dark wayfarer sunglasses with sweeping white diagonal specular lens gleam'
  },
  money_stack: {
    id: 'money_stack',
    icon: '💸',
    name: 'Money & Banknotes',
    tag: 'CASH',
    description: 'Floating 1-bit banknotes with currency watermarks and fluttering coin sparks'
  },
  street_racer: {
    id: 'street_racer',
    icon: '🏎️',
    name: 'Street Racer Coupe',
    tag: 'RIDE',
    description: 'Low-slung sports coupe silhouette cruising with spinning spoke wheels'
  },
  cracked_heart: {
    id: 'cracked_heart',
    icon: '💔',
    name: 'Cracked Heart',
    tag: 'HEART',
    description: 'Bold heart split into jagged halves with Bayer dither fade for heartbreak or love'
  },
  crossed_swords: {
    id: 'crossed_swords',
    icon: '⚔️',
    name: 'Crossed Scimitars',
    tag: 'BLADE',
    description: 'Dual curved daggers / kirpan blades meeting with sparkling impact crosshairs'
  },
  champion_trophy: {
    id: 'champion_trophy',
    icon: '🏆',
    name: 'Champion Trophy',
    tag: 'WIN',
    description: 'Golden chalice winner trophy with celebratory floating diamond star sparks'
  },
  lucky_dice: {
    id: 'lucky_dice',
    icon: '🎲',
    name: 'Lucky Dice',
    tag: 'ROLL',
    description: 'Tumbling 3D isometric pixel dice with authentic visible pip dots'
  },
  rolex_watch: {
    id: 'rolex_watch',
    icon: '⌚',
    name: 'Rolex Luxury Watch',
    tag: 'TIME',
    description: 'Fluted watch bezel with ticking second hand, hour pips, and center pivot'
  },
  bullet_chamber_cylinder: {
    id: 'bullet_chamber_cylinder',
    icon: '🎯',
    name: 'Revolver Bullet Chamber',
    tag: 'DRILL',
    description: 'Rotating 6-shot revolver cylinder with fluted edges and hollow chambers'
  },
  police_siren_sweep: {
    id: 'police_siren_sweep',
    icon: '🚨',
    name: 'Police Siren Sweep',
    tag: 'SIREN',
    description: 'High-speed emergency strobe sweeping twin light cones across display'
  },
  thar_jeep_grille: {
    id: 'thar_jeep_grille',
    icon: '🚙',
    name: 'Thar 4x4 Jeep Grille',
    tag: 'THAR',
    description: 'Rugged 7-slot off-road jeep grille with bold circular twin headlamps'
  },
  punjabi_khanda: {
    id: 'punjabi_khanda',
    icon: '⚔️',
    name: 'Sacred Punjabi Khanda',
    tag: 'KHANDA',
    description: 'Sacred Sikh Khanda emblem with double-edged central blade, chakkar and dual kirpans'
  },
  cuban_chain_links: {
    id: 'cuban_chain_links',
    icon: '⛓️',
    name: 'Cuban Chain Links',
    tag: 'CHAIN',
    description: 'Heavy interlocking curb chain draped across canvas with beveled 1-bit links'
  },
  drill_ski_mask: {
    id: 'drill_ski_mask',
    icon: '🥷',
    name: 'Drill Ski Mask',
    tag: 'MASK',
    description: 'Tactical balaclava ski mask with cutouts and knitted ribbing for street drill'
  },
  studio_microphone: {
    id: 'studio_microphone',
    icon: '🎙️',
    name: 'Studio Condenser Mic',
    tag: 'MIC',
    description: 'Broadcast capsule studio microphone with shock-mount frame and wire mesh'
  },
  boombox_blaster: {
    id: 'boombox_blaster',
    icon: '📻',
    name: 'Street Boombox Blaster',
    tag: 'BOX',
    description: 'Vintage 80s ghetto blaster boombox with twin pulsing speaker drivers and tape deck'
  },
  speaker_subwoofer_pulse: {
    id: 'speaker_subwoofer_pulse',
    icon: '🔊',
    name: 'Subwoofer Bass Pulse',
    tag: 'BASS',
    description: 'Flanking dual subwoofers with concentric cones vibrating to audio sub-bass'
  },
  electric_guitar: {
    id: 'electric_guitar',
    icon: '🎸',
    name: 'Electric Guitar',
    tag: 'AXE',
    description: 'Solid-body rock guitar silhouette angled dynamically with frets and pickups'
  },
  metronome_ticker: {
    id: 'metronome_ticker',
    icon: '⏱️',
    name: 'Metronome Ticker',
    tag: 'TEMPO',
    description: 'Acoustic pyramid metronome with mechanical pendulum arm rocking in tempo'
  },
  disco_mirror_ball: {
    id: 'disco_mirror_ball',
    icon: '🪩',
    name: 'Disco Mirror Ball',
    tag: 'DISCO',
    description: 'Suspended faceted mirror disco ball casting rotating radial light reflections'
  },
  city_skyline_silhouette: {
    id: 'city_skyline_silhouette',
    icon: '🏙️',
    name: 'City Skyline Silhouette',
    tag: 'CITY',
    description: 'Metropolis skyscraper skyline with lit window pixel matrix and transmission towers'
  },
  smoke_ring_drift: {
    id: 'smoke_ring_drift',
    icon: '💨',
    name: 'Drifting Smoke Rings',
    tag: 'SMOKE',
    description: 'Concentric organic smoke rings expanding and curling upward in chill air'
  },
  graffiti_drips: {
    id: 'graffiti_drips',
    icon: '🎨',
    name: 'Graffiti Spray Drips',
    tag: 'DRIP',
    description: 'Street spray-paint drips and hanging teardrop beads running down from header'
  },
  champagne_toast: {
    id: 'champagne_toast',
    icon: '🥂',
    name: 'Champagne Toast Flutes',
    tag: 'TOAST',
    description: 'Pair of clinking stemmed champagne flutes with rising effervescent bubbles and sparks'
  },
  neon_lips: {
    id: 'neon_lips',
    icon: '💋',
    name: 'Neon Kiss Lips',
    tag: 'LIPS',
    description: 'Luminous 1-bit neon outline lips with high-contrast electric glow contour'
  },
  vault_safe_dial: {
    id: 'vault_safe_dial',
    icon: '🔒',
    name: 'Bank Vault Safe Dial',
    tag: 'VAULT',
    description: 'Heavy steel vault combination dial with calibrated perimeter ticks and turning handle'
  },
  blooming_rose: {
    id: 'blooming_rose',
    icon: '🌹',
    name: 'Blooming Petal Rose',
    tag: 'ROSE',
    description: 'Detailed blooming botanical rose blossom with swirling petals and stem thorns'
  },
  lunar_crescent: {
    id: 'lunar_crescent',
    icon: '🌙',
    name: 'Lunar Crescent Moon',
    tag: 'MOON',
    description: 'Detailed crescent moon with crater surface stipples and attendant constellation stars'
  },
  candle_flame_flicker: {
    id: 'candle_flame_flicker',
    icon: '🕯️',
    name: 'Candle Flame Flicker',
    tag: 'CANDLE',
    description: 'Wax candle pillar with organic melting drips and a soft flickering teardrop flame'
  },
  fluttering_butterflies: {
    id: 'fluttering_butterflies',
    icon: '🦋',
    name: 'Fluttering Butterflies',
    tag: 'WINGS',
    description: 'Graceful 1-bit butterflies fluttering in gentle sine trajectories across screen'
  },
  falling_autumn_leaves: {
    id: 'falling_autumn_leaves',
    icon: '🍂',
    name: 'Falling Autumn Leaves',
    tag: 'LEAVES',
    description: 'Serrated maple and oak foliage gently tumbling and swirling on the autumn breeze'
  },
  feather_drift: {
    id: 'feather_drift',
    icon: '🪶',
    name: 'Weightless Feather Drift',
    tag: 'FEATHER',
    description: 'Delicate bird quill feather swaying softly through the air with fine barbs'
  },
  laser_grid_horizon: {
    id: 'laser_grid_horizon',
    icon: '📐',
    name: 'Synthwave Laser Grid',
    tag: 'GRID',
    description: 'Retro 80s 3D perspective floor grid receding into distance horizon line'
  },
  matrix_rain_code: {
    id: 'matrix_rain_code',
    icon: '👾',
    name: 'Matrix Digital Rain',
    tag: 'MATRIX',
    description: 'Vertical digital code glyph columns cascading down screen with leading bright heads'
  },
  neon_heart_tunnel: {
    id: 'neon_heart_tunnel',
    icon: '💖',
    name: 'Neon Heart Tunnel',
    tag: 'TUNNEL',
    description: 'Concentric perspective heart wireframes receding infinitely into dynamic depth'
  },
  radar_sweep_sonar: {
    id: 'radar_sweep_sonar',
    icon: '📡',
    name: 'Tactical Radar Sonar',
    tag: 'RADAR',
    description: 'Military radar circle with 360-degree rotating sweep ray and blip target pings'
  },
  hazard_stripes_caution: {
    id: 'hazard_stripes_caution',
    icon: '⚠️',
    name: 'Hazard Caution Stripes',
    tag: 'HAZARD',
    description: '45-degree high-contrast industrial hazard warning stripes framing canvas edges'
  },
  antique_key_lock: {
    id: 'antique_key_lock',
    icon: '🗝️',
    name: 'Antique Key & Keyhole',
    tag: 'KEYLOCK',
    description: 'Ornate Gothic skeleton key hovering over an antique keyhole escutcheon plate'
  },
  shonen_ki_aura: {
    id: 'shonen_ki_aura',
    icon: '🔥',
    name: 'Shonen Ki Energy Aura',
    tag: 'AURA',
    description: 'Surging upward jagged ki energy flames and electric lightning crackles'
  },
  portal_vortex: {
    id: 'portal_vortex',
    icon: '🌀',
    name: 'Dimensional Portal Vortex',
    tag: 'VORTEX',
    description: 'Hypnotic spiraling vortex arms drawing inward with cosmic matter particle dust'
  },
  all_seeing_eye: {
    id: 'all_seeing_eye',
    icon: '👁️',
    name: 'All-Seeing Mystic Eye',
    tag: 'EYE',
    description: 'Sacred geometric pyramid triangle enclosing a centered observant mystical eye'
  },
  knight_shield: {
    id: 'knight_shield',
    icon: '🛡️',
    name: 'Knight Heraldic Shield',
    tag: 'SHIELD',
    description: 'Medieval defensive heraldic shield with embossed cross charge and iron studs'
  }
};

export type WordBadgeIcon =
  | 'none'
  | 'moustache'
  | 'sunglasses'
  | 'crown'
  | 'cash'
  | 'car'
  | 'heart'
  | 'broken_heart'
  | 'flame'
  | 'skull'
  | 'sword'
  | 'trophy'
  | 'dice'
  | 'watch'
  | 'diamond'
  | 'star'
  | 'gun'
  | 'bomb'
  | 'chain'
  | 'microphone'
  | 'lightning'
  | 'rose'
  | 'cloud_rain'
  | 'moon'
  | 'lips'
  | 'wine_glass'
  | 'guitar'
  | 'key'
  | 'mask'
  | 'eye'
  | 'butterfly'
  | 'shield';

export interface WordBadgeMeta {
  id: WordBadgeIcon;
  icon: string;
  name: string;
  tag: string;
  description: string;
}

export const WORD_BADGE_METADATA: Record<WordBadgeIcon, WordBadgeMeta> = {
  none: {
    id: 'none',
    icon: '🚫',
    name: 'None',
    tag: 'NONE',
    description: 'No badge icon attached to word'
  },
  moustache: {
    id: 'moustache',
    icon: '🥸',
    name: 'Royal Moustache',
    tag: 'MUCHH',
    description: 'Curled handlebar moustache badge above word for pride/masculinity'
  },
  sunglasses: {
    id: 'sunglasses',
    icon: '🕶️',
    name: 'Dark Shades',
    tag: 'SHADES',
    description: 'Cool black wayfarer shades badge for swag and attitude'
  },
  crown: {
    id: 'crown',
    icon: '👑',
    name: 'Royal Crown',
    tag: 'KING',
    description: '3-point royal crown badge crowning the word'
  },
  cash: {
    id: 'cash',
    icon: '💸',
    name: 'Cash Banknote',
    tag: 'CASH',
    description: 'Folded banknote with currency symbol for wealth/money punchlines'
  },
  car: {
    id: 'car',
    icon: '🏎️',
    name: 'Sports Car',
    tag: 'RIDE',
    description: 'Fast sports coupe badge for cars, rides, and speed lyrics'
  },
  heart: {
    id: 'heart',
    icon: '❤️',
    name: 'Solid Heart',
    tag: 'LOVE',
    description: 'Classic solid heart badge for love, affection, and emotional cues'
  },
  broken_heart: {
    id: 'broken_heart',
    icon: '💔',
    name: 'Broken Heart',
    tag: 'PAIN',
    description: 'Fractured heart badge with jagged lightning crack'
  },
  flame: {
    id: 'flame',
    icon: '🔥',
    name: 'Fire Flame',
    tag: 'FIRE',
    description: 'Sharp rising fire contour for heat, lit, and fiery delivery'
  },
  skull: {
    id: 'skull',
    icon: '💀',
    name: 'Skull Stamp',
    tag: 'DEAD',
    description: 'Micro pixel skull mark for lethal danger and grave lyrics'
  },
  sword: {
    id: 'sword',
    icon: '🗡️',
    name: 'Curved Dagger',
    tag: 'BLADE',
    description: 'Crossed blade dagger for violence, war, cuts, and Kirpan'
  },
  trophy: {
    id: 'trophy',
    icon: '🏆',
    name: 'Winner Trophy',
    tag: 'WIN',
    description: 'Winner trophy cup with handles for number 1 / champion lyrics'
  },
  dice: {
    id: 'dice',
    icon: '🎲',
    name: 'Lucky Dice',
    tag: 'ROLL',
    description: 'Isometric 3D pixel dice with pips for gambling and destiny'
  },
  watch: {
    id: 'watch',
    icon: '⌚',
    name: 'Luxury Watch',
    tag: 'TIME',
    description: 'Circular wristwatch bezel with ticking hands for time and Rolex lyrics'
  },
  diamond: {
    id: 'diamond',
    icon: '💎',
    name: 'Brilliant Diamond',
    tag: 'ICE',
    description: 'Faceted gem with sparkling glints for jewelry, ice, and luxury'
  },
  star: {
    id: 'star',
    icon: '⭐',
    name: 'Comic Star',
    tag: 'STAR',
    description: '4-point diamond glint star for celebrity, fame, and glow'
  },
  gun: {
    id: 'gun',
    icon: '🔫',
    name: 'Handgun Pistol',
    tag: 'GUN',
    description: 'Semi-auto pistol silhouette for drill, street heat, and firepower'
  },
  bomb: {
    id: 'bomb',
    icon: '💣',
    name: 'Time Bomb',
    tag: 'BOMB',
    description: 'Spherical round bomb with burning fuse for explosive drops and heat'
  },
  chain: {
    id: 'chain',
    icon: '⛓️',
    name: 'Cuban Chain',
    tag: 'CHAIN',
    description: 'Heavy interlinked cuban curb chain for drip, ice, and flex'
  },
  microphone: {
    id: 'microphone',
    icon: '🎤',
    name: 'Studio Microphone',
    tag: 'MIC',
    description: 'Vintage vocal capsule microphone for rap bars, spitting, and vocals'
  },
  lightning: {
    id: 'lightning',
    icon: '⚡',
    name: 'Lightning Bolt',
    tag: 'VOLT',
    description: 'Jagged high-voltage thunder bolt for energy, shocks, and electricity'
  },
  rose: {
    id: 'rose',
    icon: '🌹',
    name: 'Blooming Rose',
    tag: 'ROSE',
    description: 'Ornate blooming petal rose with stem for romance, beauty, and love'
  },
  cloud_rain: {
    id: 'cloud_rain',
    icon: '🌧️',
    name: 'Rain Cloud',
    tag: 'RAIN',
    description: 'Storm cloud dropping rain streaks for sadness, tears, and storms'
  },
  moon: {
    id: 'moon',
    icon: '🌙',
    name: 'Crescent Moon',
    tag: 'MOON',
    description: 'Glowing crescent moon for midnight, night drives, and dreaming'
  },
  lips: {
    id: 'lips',
    icon: '💋',
    name: 'Kiss Lips',
    tag: 'LIPS',
    description: 'Sultry kiss lips contour for kisses, passion, romance, and lust'
  },
  wine_glass: {
    id: 'wine_glass',
    icon: '🍷',
    name: 'Wine Glass',
    tag: 'DRINK',
    description: 'Stemmed chalice goblet with liquid for toasts, party, and drinks'
  },
  guitar: {
    id: 'guitar',
    icon: '🎸',
    name: 'Electric Guitar',
    tag: 'GUITAR',
    description: 'Solid-body rock guitar for riffs, acoustic strums, and rockstars'
  },
  key: {
    id: 'key',
    icon: '🔑',
    name: 'Antique Key',
    tag: 'KEY',
    description: 'Ornate skeleton key for secrets, locks, success, and car keys'
  },
  mask: {
    id: 'mask',
    icon: '🎭',
    name: 'Ski Mask / Balaclava',
    tag: 'MASK',
    description: 'Tactical ski mask balaclava cutout for drill, stealth, and mystery'
  },
  eye: {
    id: 'eye',
    icon: '👁️',
    name: 'All-Seeing Eye',
    tag: 'EYE',
    description: 'Mystic almond eye with centered pupil for vision, gazing, and truth'
  },
  butterfly: {
    id: 'butterfly',
    icon: '🦋',
    name: 'Fluttering Butterfly',
    tag: 'FLY',
    description: 'Symmetrical winged butterfly for transformation, beauty, and flutter'
  },
  shield: {
    id: 'shield',
    icon: '🛡️',
    name: 'Knight Shield',
    tag: 'GUARD',
    description: 'Defensive heraldic shield emblem for protection, armor, and defense'
  }
};

export type KineticTransitionType = 
  | 'auto'
  | 'lateral_glide'
  | 'vertical_drift'
  | 'bayer_sweep'
  | 'curtain_drop'
  | 'dither_dissolve'
  | 'razor_slice'
  | 'glitch_tear'
  | 'impact_flash';

export interface TransitionMeta {
  id: KineticTransitionType;
  icon: string;
  name: string;
  tag: string;
  description: string;
}

export const TRANSITION_METADATA: Record<KineticTransitionType, TransitionMeta> = {
  auto: {
    id: 'auto',
    icon: '🔀',
    name: 'Vibe-Adaptive Flow',
    tag: 'AUTO',
    description: 'Auto-adapts between bangers (razor slices, glitch tears) and smooth (glides, dither sweeps)'
  },
  lateral_glide: {
    id: 'lateral_glide',
    icon: '➡️',
    name: 'Lateral Reading Glide',
    tag: 'GLIDE',
    description: 'Smooth horizontal reading-axis flow; outgoing word slides away as incoming word glides in'
  },
  bayer_sweep: {
    id: 'bayer_sweep',
    icon: '🌊',
    name: 'Bayer Curtain Sweep',
    tag: 'SWEEP',
    description: 'Directional 1-bit Bayer dither wavefront sweeping across the display'
  },
  vertical_drift: {
    id: 'vertical_drift',
    icon: '⬆️',
    name: 'Vertical Elevator Drift',
    tag: 'FLOAT',
    description: 'Ethereal acoustic lift; outgoing word drifts upward while incoming word rises from below'
  },
  curtain_drop: {
    id: 'curtain_drop',
    icon: '⬇️',
    name: 'Curtain Blinds Drop',
    tag: 'DROP',
    description: 'Top-to-bottom blinds wave unveiling the incoming word with sparkling Bayer fringe'
  },
  dither_dissolve: {
    id: 'dither_dissolve',
    icon: '✨',
    name: 'Dither Crossfade',
    tag: 'FADE',
    description: 'Classic in-place 1-bit Bayer matrix crossfade for contemplative pauses'
  },
  razor_slice: {
    id: 'razor_slice',
    icon: '⚔️',
    name: 'Razor Blade Slice',
    tag: 'SLICE',
    description: 'High-energy diagonal razor cut splitting halves apart with bright slash flash'
  },
  glitch_tear: {
    id: 'glitch_tear',
    icon: '⚡',
    name: 'Cyber Glitch Tear',
    tag: 'TEAR',
    description: 'Aggressive horizontal scanline row displacement and matrix byte tearing'
  },
  impact_flash: {
    id: 'impact_flash',
    icon: '💥',
    name: 'Impact Flash Snap',
    tag: 'SNAP',
    description: 'Sudden velocity zoom snap with a 1-frame negative inversion punch on beat drops'
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
  wordDressingOverrides?: Record<string, TextDressing>;
  wordBadgeOverrides?: Record<string, WordBadgeIcon>;
  badgeMode?: 'off' | 'auto' | 'always';
  motifMode?: MotifMode;
  stylePack?: StylePackId;
  vibe?: import('./moodProfileEngine').SongVibe;
  customPalette?: StylePackConfig['fonts'];
  audioAnalysis?: AudioAnalysisResult;
  transitionStyle?: KineticTransitionType;
}


