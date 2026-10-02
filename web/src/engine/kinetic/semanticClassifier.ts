import { MotionArchetype, StylePackConfig, WordFontRole, TextDressing, STYLE_PACKS, MULTILINGUAL_FALLBACK_FONTS } from './types';
import { LyricWord } from '../lyrics/types';
import { detectScript } from './scriptDetector';
import { getScriptFontStack } from './fontLoader';
import { SongMoodProfile } from './moodProfileEngine';

// Common English, Punjabi, Hindi, Japanese & Arabic Filler / Connective Words
export const FILLER_WORDS = new Set([
  // English
  'a', 'an', 'the', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 
  'about', 'into', 'over', 'after', 'and', 'but', 'or', 'so', 'yet', 'it', 'its', 
  'my', 'your', 'his', 'her', 'their', 'our', 'is', 'am', 'are', 'was', 'were', 'be',
  'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'that', 'this', 'these', 'those',
  'i', 'im', "i'm", 'you', 'he', 'she', 'we', 'they', 'me', 'him', 'us', 'them',
  // Punjabi & Hindi (Latin transliteration)
  'te', 'de', 'da', 'di', 'ne', 'nu', 'ch', 'vich', 'se', 'ko', 'ka', 'ki', 'ke',
  'aur', 'par', 'bhi', 'naal', 'mera', 'meri', 'mere', 'tera', 'teri', 'tere', 
  'asi', 'tussi', 'oh', 'ae', 'hai', 'si', 'han', 'main', 'tu', 'jo', 'woh', 'yeh',
  // Devanagari (Hindi / Marathi)
  'का', 'की', 'के', 'को', 'में', 'से', 'पर', 'और', 'है', 'हैं', 'था', 'थी', 'थे', 'भी', 'तो', 'ने', 'या', 'एक',
  // Gurmukhi (Punjabi)
  'ਤੇ', 'ਦੇ', 'ਦਾ', 'ਦੀ', 'ਨੇ', 'ਨੂੰ', 'ਵਿੱਚ', 'ਨਾਲ', 'ਹੈ', 'ਸੀ', 'ਹਨ', 'ਮੇਰਾ', 'ਤੇਰਾ', 'ਅਸੀਂ', 'ਤੁਸੀਂ',
  // Japanese particles
  'の', 'は', 'が', 'を', 'に', 'で', 'と', 'へ', 'も', 'や',
  // Arabic prepositions
  'في', 'من', 'إلى', 'على', 'عن', 'مع', 'و', 'أو'
]);

const PUNCTUATION_CLEAN_REGEX = /^[\s,\.!?;:—\-、。！？،؟؛，．：；「」『』【】（）《》“”‘’"'\~`]+|[\s,\.!?;:—\-、。！？،؟؛，．：；「」『』【】（）《》“”‘’"'\~`]+$/g;

export function isFillerWord(word: string): boolean {
  const trimmed = word.trim().toLowerCase();
  if (FILLER_WORDS.has(trimmed)) return true;
  const clean = trimmed.replace(PUNCTUATION_CLEAN_REGEX, '');
  if (FILLER_WORDS.has(clean)) return true;
  const latinClean = trimmed.replace(/[^a-z0-9']/g, '');
  return FILLER_WORDS.has(latinClean);
}

// Semantic Keyword Dictionaries (Universal Roots)
const BLADE_KEYWORDS = new Set([
  'blade', 'slash', 'razor', 'cut', 'knife', 'sword', 'tear', 'split',
  'edge', 'sharp', 'chop', 'stab', 'dissect', 'rip', 'dagger', 'axe', 'slice',
  'steel', 'shred'
]);

const IMPACT_KEYWORDS = new Set([
  'hit', 'beat', 'drop', 'slam', 'smash', 'boom', 'bang', 'punch', 'kick', 'break',
  'crash', 'blast', 'hammer', 'heavy', 'thud', 'strike', 'fall', 'bullet', 'gun',
  'shot', 'fire', 'shatter', 'knockout', 'stomp', 'ground', 'kill', 'destroy',
  'pistol', 'trigger', 'bass', 'loud', 'clash', 'bomb', 'attack', 'clout', 'pow'
]);

const ANTHEM_KEYWORDS = new Set([
  'king', 'queen', 'boss', 'crown', 'gold', 'god', 'lord', 'pride', 'stand',
  'roar', 'champion', 'lead', 'rule', 'empire', 'power', 'giant', 'iron', 'steel',
  'throne', 'hero', 'top', 'number', 'high', 'peak', 'legend', 'glory',
  'million', 'billion', 'rich', 'money', 'cash', 'dollar', 'star',
  'prime', 'supreme', 'legacy', 'royal', 'sovereign', 'flex', 'chain', 'ice', 'block', 'solid'
]);

const TARGET_KEYWORDS = new Set([
  'look', 'see', 'watch', 'eyes', 'aim', 'target', 'sight', 'locked',
  'view', 'focus', 'check', 'point', 'spot', 'face', 'stare', 'gaze',
  'scope', 'reddot', 'bullseye', 'hunt', 'prey', 'watchout', 'locate', 'track', 'found'
]);

const SNAKE_KEYWORDS = new Set([
  'snake', 'venom', 'poison', 'toxic', 'creep', 'crawl', 'bite', 'sting', 'dark',
  'evil', 'sly', 'hiss', 'spider', 'deadly', 'viper', 'cobra', 'poisonous',
  'serpent', 'venomous', 'shadow', 'underworld'
]);

const GLITCH_KEYWORDS = new Set([
  'speed', 'fast', 'run', 'glitch', 'code', 'neon', 'wire', 'electric', 'volt',
  'lightning', 'spark', 'static', 'matrix', 'data', 'chip', 'flash',
  'current', 'quick', 'rush', 'sprint', 'zoom', 'laser', 'alien', 'tech',
  'cyber', 'hack', 'system', 'signal', 'pulse', 'circuit', 'digital', 'pixel', 'nano', 'hyper'
]);

const ECHO_KEYWORDS = new Set([
  'shout', 'scream', 'call', 'cry', 'sing', 'sound', 'voice', 'loud', 'echo',
  'roar', 'chant', 'whoa', 'yeah', 'oh', 'aah', 'boom',
  'infinite', 'forever', 'always', 'space', 'distance', 'holler', 'yell', 'reverb'
]);

const BADGE_KEYWORDS = new Set([
  'no', 'never', 'stop', 'wait', 'listen', 'rule', 'badge', 'hold', 'keep',
  'true', 'false', 'sign', 'stamp', 'seal', 'title',
  'certified', 'real', 'first', 'only', 'final', 'end', 'don\'t', 'cant',
  'halt', 'warning', 'alert', 'verified', 'official', 'tag', 'mark', 'proof', 'valid',
  'guarantee', 'zero', 'done', 'shut', 'freeze'
]);

const FLUID_KEYWORDS = new Set([
  'fly', 'sky', 'rain', 'wave', 'ocean', 'sea', 'water', 'river', 'air', 'breeze',
  'wind', 'float', 'drift', 'cloud', 'love', 'heart', 'smooth', 'gentle', 'soft',
  'breathe', 'flow', 'glide', 'moon', 'stars', 'melt', 'liquid', 'stream', 'peace', 'calm'
]);

const WIGGLY_KEYWORDS = new Set([
  'shake', 'crazy', 'wild', 'insane', 'mad', 'freak', 'dance', 'jump', 'bounce',
  'wiggle', 'jiggle', 'tremble', 'shiver', 'nervous', 'boil', 'fever', 'psycho',
  'weird', 'groove', 'twist', 'rock', 'roll', 'funky', 'chaos', 'vibe', 'trip'
]);

const ODOMETER_KEYWORDS = new Set([
  'count', 'roll', 'rolling', 'wheel', 'slot', 'spin', 'odometer', 'numbers', 'math',
  'calc', 'meter', 'clock', 'time', 'score', 'jackpot', 'casino', 'lucky', 'tally',
  'stats', 'speedometer', 'counter', 'digits', 'reels', 'tumbler', '777'
]);

const GENTLE_FLOAT_KEYWORDS = new Set([
  'drift', 'float', 'cloud', 'air', 'breeze', 'wind', 'fly', 'sky', 'breathe', 'feather',
  'weightless', 'soft', 'gentle', 'slow', 'dream', 'sleep', 'rest', 'peace', 'quiet',
  'silent', 'calm', 'whisper'
]);

const DITHER_DISSOLVE_KEYWORDS = new Set([
  'fade', 'ghost', 'memory', 'remember', 'past', 'vanish', 'disappear', 'shadow',
  'smoke', 'mist', 'fog', 'haze', 'blur', 'yesterday', 'lost', 'gone', 'dusk', 'dawn',
  'glow', 'shine', 'twilight'
]);

const TYPEWRITER_KEYWORDS = new Set([
  'story', 'tell', 'write', 'letter', 'words', 'diary', 'read', 'book', 'paper',
  'lines', 'message', 'text', 'type', 'record', 'page', 'ink', 'pen'
]);

const WAVE_KARAOKE_KEYWORDS = new Set([
  'sing', 'melody', 'harmony', 'tune', 'music', 'chorus', 'sound', 'voice', 'groove',
  'rhythm', 'acoustic', 'guitar', 'piano', 'notes', 'song'
]);

const ANVIL_STOMP_KEYWORDS = new Set([
  'stomp', 'drop', 'heavy', 'slam', 'ground', 'pound', 'crash', 'crush', 'anvil', 'hammer', 'floor', 'weight'
]);

const FRACTURE_KEYWORDS = new Set([
  'break', 'crack', 'shatter', 'fracture', 'split', 'torn', 'broken', 'snap', 'glass', 'bleed', 'rip', 'tear'
]);

const PENDULUM_KEYWORDS = new Set([
  'sway', 'swing', 'time', 'clock', 'metronome', 'rock', 'strum', 'pendulum', 'slow'
]);

const PRISM_KEYWORDS = new Set([
  'shine', 'shimmer', 'prism', 'beam', 'sparkle', 'diamond', 'glow', 'gleam', 'light', 'bright', 'glint'
]);

const SQUASH_KEYWORDS = new Set([
  'bounce', 'jump', 'hop', 'rebound', 'elastic', 'skip', 'spring', 'ball', 'dance', 'fun', 'pop'
]);

/**
 * Normalizes a lyric token across all languages and scripts (Latin, Indic, CJK, Cyrillic, Arabic).
 * Preserves letters (\p{L}), numbers (\p{N}), and combining vowel marks/diacritics (\p{M}).
 */
export function cleanLyricToken(word: string): string {
  if (!word || typeof word !== 'string') return '';
  return word.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}\p{M}]/gu, '');
}

/**
 * Classifies a lyric word into its optimal visual kinetic archetype based on
 * semantics, phonetics, vocal duration, and song mood/tempo profile.
 */
export function classifyWordArchetype(
  word: string,
  durationMs: number = 400,
  wordIndex: number = 0,
  precedingSilenceMs: number = 0,
  moodProfile?: SongMoodProfile | null
): MotionArchetype {
  const clean = cleanLyricToken(word);
  const isChill = moodProfile?.vibe === 'ballad_acoustic' || moodProfile?.vibe === 'chill_pop';

  // 1. Punctuation & Structural Markers (Shouts or questions)
  if (word.includes('!') || word.endsWith('!!')) {
    return isChill ? 'inverted_badge' : 'manga_impact';
  }
  if (word.includes('?') || word.includes('...')) {
    return isChill ? 'dither_dissolve' : 'target_focus';
  }

  // 2. Connective / Filler words stay clean and non-distracting
  if (isFillerWord(clean)) {
    if (isChill) {
      if (wordIndex === 0) {
        return moodProfile?.vibe === 'ballad_acoustic' ? 'gentle_float' : 'waveform_karaoke';
      }
      const chillFillers: MotionArchetype[] = moodProfile?.vibe === 'ballad_acoustic'
        ? ['gentle_float', 'waveform_karaoke', 'smooth_fluid', 'dither_dissolve']
        : ['waveform_karaoke', 'gentle_float', 'smooth_fluid', 'typewriter_ribbon'];
      return chillFillers[wordIndex % chillFillers.length];
    }
    return 'smooth_fluid';
  }

  // 3. Direct Semantic Keyword Matching
  if (GENTLE_FLOAT_KEYWORDS.has(clean)) return 'gentle_float';
  if (DITHER_DISSOLVE_KEYWORDS.has(clean)) return 'dither_dissolve';
  if (TYPEWRITER_KEYWORDS.has(clean)) return 'typewriter_ribbon';
  if (WAVE_KARAOKE_KEYWORDS.has(clean)) return 'waveform_karaoke';
  if (PENDULUM_KEYWORDS.has(clean)) return 'pendulum_sway';
  if (PRISM_KEYWORDS.has(clean)) return 'prism_shimmer';

  if (!isChill) {
    if (BLADE_KEYWORDS.has(clean)) return 'blade_slash';
    if (IMPACT_KEYWORDS.has(clean)) return 'manga_impact';
    if (ANTHEM_KEYWORDS.has(clean)) return '3d_block_stack';
    if (GLITCH_KEYWORDS.has(clean)) return 'cyber_glitch';
    if (SNAKE_KEYWORDS.has(clean)) return 'snake_slither';
    if (ANVIL_STOMP_KEYWORDS.has(clean)) return 'anvil_stomp';
    if (FRACTURE_KEYWORDS.has(clean)) return 'fracture_shatter';
    if (SQUASH_KEYWORDS.has(clean)) return 'squash_bounce';
  } else {
    // Soften combat keywords in chill/ballad modes
    if (BLADE_KEYWORDS.has(clean)) return 'waveform_karaoke';
    if (ANVIL_STOMP_KEYWORDS.has(clean)) return 'pendulum_sway';
    if (FRACTURE_KEYWORDS.has(clean)) return 'dither_dissolve';
    if (IMPACT_KEYWORDS.has(clean)) return 'inverted_badge';
    if (ANTHEM_KEYWORDS.has(clean)) return 'gentle_float';
    if (GLITCH_KEYWORDS.has(clean)) return 'dither_dissolve';
    if (SNAKE_KEYWORDS.has(clean)) return 'gentle_float';
    if (SQUASH_KEYWORDS.has(clean)) return 'waveform_karaoke';
  }

  if (TARGET_KEYWORDS.has(clean)) return 'target_focus';
  if (ODOMETER_KEYWORDS.has(clean)) return 'rolling_odometer';
  if (ECHO_KEYWORDS.has(clean)) return isChill ? 'gentle_float' : 'echo_stack';
  if (BADGE_KEYWORDS.has(clean)) return 'inverted_badge';
  if (FLUID_KEYWORDS.has(clean)) return isChill ? 'gentle_float' : 'smooth_fluid';
  if (WIGGLY_KEYWORDS.has(clean)) return isChill ? 'waveform_karaoke' : 'wiggly_boil';

  // 4. Rhythmic & Duration Heuristics
  if (isChill) {
    // In chill/ballad deliveries, syllables are naturally longer: only trigger holds if >1000ms
    if (durationMs > 1000) {
      return (wordIndex % 2 === 0) ? 'gentle_float' : 'dither_dissolve';
    }
    // Breaths (>600ms) enter gentle float or typewriter reveal instead of violent manga speedlines
    if (precedingSilenceMs > 600) {
      return (wordIndex % 2 === 0) ? 'typewriter_ribbon' : 'gentle_float';
    }
    // Quick syllables
    if (durationMs < 250) {
      return (wordIndex % 2 === 0) ? 'waveform_karaoke' : 'smooth_fluid';
    }

    // Chill neutral rotation across rich acoustic & melodic styles
    const chillPalette: MotionArchetype[] = [
      'gentle_float',
      'waveform_karaoke',
      'pendulum_sway',
      'prism_shimmer',
      'smooth_fluid',
      'typewriter_ribbon',
      'rolling_odometer',
      'dither_dissolve',
      'inverted_badge'
    ];
    const charHash = clean.split('').reduce((acc, c, i) => acc + c.charCodeAt(0) * (i + 1), 0);
    return chillPalette[(wordIndex * 2 + charHash) % chillPalette.length];
  }

  // Standard/Hype heuristics
  // Long sustained notes (>650ms) need active hold motion (Echo Stack or 3D Block)
  if (durationMs > 650) {
    return (wordIndex % 2 === 0) ? 'echo_stack' : '3d_block_stack';
  }

  // Large preceding silence (>400ms) indicates a dynamic vocal punch
  if (precedingSilenceMs > 400) {
    return (wordIndex % 2 === 0) ? 'manga_impact' : 'anvil_stomp';
  }

  // Very rapid flows (<220ms) look best with fast glitch, fracture, or fluid glide
  if (durationMs < 220) {
    return (wordIndex % 2 === 0) ? 'cyber_glitch' : 'smooth_fluid';
  }

  // 5. Dynamic Variety Rotation across ALL vibrant archetypes (never monotonous)
  const neutralPalette: MotionArchetype[] = [
    'smooth_fluid',
    'blade_slash',
    'anvil_stomp',
    'rolling_odometer',
    'cyber_glitch',
    'inverted_badge',
    'fracture_shatter',
    'manga_impact',
    'squash_bounce',
    'target_focus',
    '3d_block_stack',
    'wiggly_boil',
    'snake_slither',
    'echo_stack'
  ];

  const charHash = clean.split('').reduce((acc, c, i) => acc + c.charCodeAt(0) * (i + 1), 0);
  return neutralPalette[(wordIndex * 2 + charHash) % neutralPalette.length];
}

/**
 * Resolves the effective archetype for a word, respecting explicit user overrides,
 * auto semantic classification, or global archetype selection.
 */
export function getWordEffectiveArchetype(
  word: LyricWord,
  wordIndex: number,
  globalArchetype: MotionArchetype,
  wordOverrides?: Record<string, MotionArchetype>,
  precedingWord?: LyricWord,
  moodProfile?: SongMoodProfile | null
): MotionArchetype {
  const specificKey = `${word.word}_${word.startMs}`;
  const cleanKey = cleanLyricToken(word.word);
  const lowerRaw = word.word.trim().toLowerCase();

  if (wordOverrides) {
    if (wordOverrides[specificKey]) return wordOverrides[specificKey];
    if (cleanKey && wordOverrides[cleanKey]) return wordOverrides[cleanKey];
    if (wordOverrides[lowerRaw]) return wordOverrides[lowerRaw];
    if (wordOverrides[word.word]) return wordOverrides[word.word];
  }

  if (globalArchetype === 'auto_semantic') {
    const durationMs = Math.max(80, word.endMs - word.startMs);
    const precedingSilence = precedingWord ? Math.max(0, word.startMs - precedingWord.endMs) : 0;
    let arch = classifyWordArchetype(word.word, durationMs, wordIndex, precedingSilence, moodProfile);

    // Anti-repetition: If archetype is identical to preceding word, advance to prevent monotonous repetition
    if (precedingWord) {
      const prevSpecific = `${precedingWord.word}_${precedingWord.startMs}`;
      const prevArch = wordOverrides?.[prevSpecific] 
        || (cleanLyricToken(precedingWord.word) ? wordOverrides?.[cleanLyricToken(precedingWord.word)] : undefined)
        || classifyWordArchetype(precedingWord.word, Math.max(80, precedingWord.endMs - precedingWord.startMs), Math.max(0, wordIndex - 1), 0, moodProfile);
      if (arch === prevArch) {
        const isChill = moodProfile?.vibe === 'ballad_acoustic' || moodProfile?.vibe === 'chill_pop';
        const altPalette: MotionArchetype[] = isChill
          ? ['gentle_float', 'waveform_karaoke', 'typewriter_ribbon', 'dither_dissolve', 'smooth_fluid']
          : ['blade_slash', 'manga_impact', 'cyber_glitch', '3d_block_stack', 'rolling_odometer', 'target_focus', 'smooth_fluid'];
        const curIdx = altPalette.indexOf(arch);
        arch = altPalette[(curIdx + 1) % altPalette.length];
      }
    }
    return arch;
  }

  return globalArchetype;
}

/**
 * Maps a motion archetype and word content to one of the 4 typographic roles:
 * - 'hero': 808 drop, punchline, major noun, anthem
 * - 'action': blade, slash, razor, speed
 * - 'novelty': glitch, tech, bounce, echo chant
 * - 'anchor': connective, preposition, conversational
 */
export function getWordFontRole(
  archetype: MotionArchetype,
  word: string
): WordFontRole {
  if (isFillerWord(word)) {
    return 'anchor';
  }

  switch (archetype) {
    case 'manga_impact':
    case '3d_block_stack':
    case 'inverted_badge':
    case 'gentle_float':
    case 'waveform_karaoke':
    case 'anvil_stomp':
      return 'hero';
    case 'blade_slash':
    case 'snake_slither':
    case 'typewriter_ribbon':
    case 'fracture_shatter':
      return 'action';
    case 'cyber_glitch':
    case 'target_focus':
    case 'wiggly_boil':
    case 'echo_stack':
    case 'rolling_odometer':
    case 'dither_dissolve':
    case 'prism_shimmer':
    case 'squash_bounce':
      return 'novelty';
    case 'pendulum_sway':
    case 'smooth_fluid':
    default:
      return 'anchor';
  }
}

/**
 * Resolves the typographic text dressing for a word based on its archetype,
 * duration, and audio dynamics.
 */
export function getWordEffectiveDressing(
  word: LyricWord,
  wordIndex: number,
  archetype: MotionArchetype,
  moodProfile?: SongMoodProfile | null,
  dressingOverrides?: Record<string, TextDressing>
): TextDressing {
  const specificKey = `${word.word}_${word.startMs}`;
  const clean = cleanLyricToken(word.word);
  const lowerRaw = word.word.trim().toLowerCase();

  if (dressingOverrides) {
    const override = dressingOverrides[specificKey]
      || (clean ? dressingOverrides[clean] : undefined)
      || dressingOverrides[lowerRaw]
      || dressingOverrides[word.word];
    if (override) return override;
  }

  const isChill = moodProfile?.vibe === 'ballad_acoustic' || moodProfile?.vibe === 'chill_pop';
  const charHash = clean.split('').reduce((acc, c, i) => acc + c.charCodeAt(0) * (i + 1), 0);

  // High-intensity or technical archetypes pair well with wireframes or scanlines
  if (archetype === 'cyber_glitch' || archetype === 'target_focus') {
    return (wordIndex % 2 === 0) ? 'scanline_slice' : 'hollow_wireframe';
  }

  if (archetype === 'fracture_shatter' || archetype === 'blade_slash') {
    return (charHash % 2 === 0) ? 'hollow_wireframe' : 'solid';
  }

  // Chill / nostalgic archetypes pair well with Bayer dither shading or echo trails
  if (archetype === 'dither_dissolve' || archetype === 'prism_shimmer') {
    return (wordIndex % 2 === 0) ? 'bayer_dither_shade' : 'solid';
  }

  if (archetype === 'echo_stack' || archetype === 'gentle_float') {
    return (charHash % 3 === 0) ? 'echo_trail' : 'solid';
  }

  if (archetype === 'inverted_badge') {
    return 'inverted_pill';
  }

  // Dynamic subtle rotation for accent words
  const duration = word.endMs - word.startMs;
  if (duration >= 350 && (wordIndex % 3 === 2)) {
    const dressings: TextDressing[] = isChill
      ? ['solid', 'bayer_dither_shade', 'hollow_wireframe', 'echo_trail']
      : ['solid', 'hollow_wireframe', 'scanline_slice', 'inverted_pill'];
    return dressings[(wordIndex + charHash) % dressings.length];
  }

  return 'solid';
}

/**
 * Resolves the final font family for a word, respecting manual overrides,
 * the active StylePack, and word semantic role.
 */
export function getWordEffectiveFont(
  word: LyricWord,
  archetype: MotionArchetype,
  packConfig: StylePackConfig = STYLE_PACKS.trap_drill,
  wordFontOverrides?: Record<string, string>,
  globalFont?: string
): string {
  const specificKey = `${word.word}_${word.startMs}`;
  const cleanKey = cleanLyricToken(word.word);
  const lowerRaw = word.word.trim().toLowerCase();

  // 1. Explicit user override for this word takes absolute priority
  if (wordFontOverrides) {
    if (wordFontOverrides[specificKey]) return wordFontOverrides[specificKey];
    if (cleanKey && wordFontOverrides[cleanKey]) return wordFontOverrides[cleanKey];
    if (wordFontOverrides[lowerRaw]) return wordFontOverrides[lowerRaw];
    if (wordFontOverrides[word.word]) return wordFontOverrides[word.word];
  }

  // 2. Resolve semantic role in the style pack
  const role = getWordFontRole(archetype, word.word);
  const fonts = packConfig.fonts;

  let baseFont: string;
  switch (role) {
    case 'hero':
      // If user selected a custom font dropdown, use it as hero font
      baseFont = globalFont || fonts.hero;
      break;
    case 'action':
      baseFont = fonts.action;
      break;
    case 'novelty':
      baseFont = fonts.novelty;
      break;
    case 'anchor':
    default:
      baseFont = fonts.anchor;
      break;
  }

  // 3. Multilingual Font Cascade: Prepend curated 1-bit display font for foreign scripts
  const script = detectScript(word.word);
  if (script !== 'latin' && script !== 'unknown') {
    return getScriptFontStack(script, baseFont);
  }

  // 4. Low-Resolution 128x64 Aperture Safety Guard:
  // If the font is ornate blackletter or delicate cursive ('Wilhelm Gotisch', 'Vendetta'):
  // - Any word with 5+ characters (e.g. 'GLITCH', 'SYSTEM')
  // - OR any word with lowercase/mixed-case characters >= 3 chars (e.g. 'ikky', 'drill', 'trap')
  //   because lowercase blackletter glyphs have dense hairline loops and internal hatching
  //   that completely collapse into unreadable pixel soup on 1-bit OLED displays!
  // Short uppercase words (e.g. 'OG', 'NO', 'WAR', 'GOTH') retain blackletter punch.
  const rawLetters = word.word.replace(/[^a-zA-Z0-9]/g, '');
  const isAllUpper = rawLetters.length > 0 && rawLetters === rawLetters.toUpperCase();
  if (
    !wordFontOverrides?.[cleanKey] &&
    /wilhelm|vendetta/i.test(baseFont) &&
    (rawLetters.length >= 5 || (!isAllUpper && rawLetters.length >= 3))
  ) {
    baseFont = `'Lemon Milk', ${MULTILINGUAL_FALLBACK_FONTS}, sans-serif`;
  }

  return baseFont;
}



