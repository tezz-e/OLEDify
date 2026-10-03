import { MotionArchetype, StylePackConfig, WordFontRole, TextDressing, STYLE_PACKS, MULTILINGUAL_FALLBACK_FONTS, VisualMotif, WordBadgeIcon } from './types';
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
  'prime', 'supreme', 'legacy', 'royal', 'sovereign', 'flex', 'chain', 'ice', 'block', 'solid',
  'zubaan', 'zuban', 'jubaan', 'bol', 'waada', 'vaada', 'lafz', 'shabad', 'sher', 'soorma'
]);

const TARGET_KEYWORDS = new Set([
  'look', 'see', 'watch', 'eyes', 'aim', 'target', 'sight', 'locked',
  'view', 'focus', 'check', 'point', 'spot', 'face', 'stare', 'gaze',
  'scope', 'reddot', 'bullseye', 'hunt', 'prey', 'watchout', 'locate', 'track', 'found'
]);

const SNAKE_KEYWORDS = new Set([
  'snake', 'snakes', 'cobra', 'viper', 'venom', 'poison', 'toxic',
  'serpent', 'serpents', 'venomous', 'poisonous', 'python', 'rattlesnake',
  'hiss', 'ਜ਼ਹਿਰ', 'ਸੱਪ', 'जहर', 'सांप', 'naja'
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
    'manga_impact',
    '3d_block_stack',
    'rolling_odometer',
    'inverted_badge',
    'echo_stack',
    'anvil_stomp',
    'target_focus',
    'squash_bounce',
    'blade_slash',
    'cyber_glitch'
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
    case 'rolling_odometer':
      return 'action';
    case 'cyber_glitch':
    case 'target_focus':
    case 'wiggly_boil':
    case 'echo_stack':
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

// Concrete Symbol Dictionaries for Lyric Iconography & Word Badges
const MOUSTACHE_WORDS = new Set([
  'muchh', 'mooch', 'moustache', 'mustache', 'mustard', 'gabru', 'kundi', 'kundian', 'mucch', 'muchan', 'moochan',
  // Gurmukhi & Devanagari
  'ਮੁੱਛ', 'ਮੁੱਛਾਂ', 'ਗੱਭਰੂ', 'मूंछ', 'मूँछ', 'गबरू'
]);
const SUNGLASSES_WORDS = new Set([
  'akhan', 'shades', 'sunglasses', 'glasses', 'chashma', 'goggles', 'spectacles', 'shady', 'eyewear',
  // Gurmukhi & Devanagari
  'ਚਸ਼ਮਾ', 'ਐਨਕਾਂ', 'ਐਨਕ', 'चश्मा'
]);
const CASH_WORDS = new Set([
  'paisa', 'cash', 'bands', 'money', 'dollar', 'dollars', 'lakh', 'crore', 'rupee', 'rupees', 'bucks', 'rich', 'wealth', 'funds', 'moolah', 'racks',
  // Gurmukhi & Devanagari & Spanish
  'ਪੈਸਾ', 'ਰੁਪਏ', 'ਦੌਲਤ', 'ਧਨ', 'पैसा', 'रुपये', 'दौलत', 'धन', 'dinero', 'plata'
]);
const CAR_WORDS = new Set([
  'gaddi', 'car', 'ride', 'drive', 'wheel', 'wheels', 'porsche', 'ferrari', 'lambo', 'benz', 'drift', 'motor', 'speeding', 'whip', 'coupe',
  // Gurmukhi & Devanagari & Spanish
  'ਗੱਡੀ', 'ਕਾਰ', 'गाड़ी', 'कार', 'coche', 'auto', 'carro'
]);
const HEART_WORDS = new Set([
  'dil', 'heart', 'love', 'pyaar', 'ishq', 'mohabbat', 'jaan', 'sweetheart', 'darling', 'romance',
  // Gurmukhi & Devanagari & Spanish
  'ਦਿਲ', 'ਪਿਆਰ', 'ਇਸ਼ਕ', 'ਜਾਨ', 'ਮੁਹੱਬਤ', 'दिल', 'प्यार', 'इश्क', 'जान', 'मोहब्बत', 'corazon', 'amor'
]);
const BROKEN_HEART_WORDS = new Set([
  'todeya', 'broken', 'heartbreak', 'dhokha', 'dard', 'tears', 'bewafa', 'break', 'crying', 'shattered',
  // Gurmukhi & Devanagari & Spanish
  'ਟੁੱਟਿਆ', 'ਦਰਦ', 'ਧੋਖਾ', 'ਬੇਵਫ਼ਾ', 'ਹੰਝੂ', 'टूटा', 'दर्द', 'धोखा', 'बेवफा', 'आंसू', 'lagrimas', 'roto'
]);
const CROWN_WORDS = new Set([
  'badshah', 'raja', 'king', 'queen', 'crown', 'sultan', 'royalty', 'maharaja', 'ruler', 'prince', 'throne',
  // Gurmukhi & Devanagari & Spanish
  'ਬਾਦਸ਼ਾਹ', 'ਰਾਜਾ', 'ਤਾਜ', 'ਸੁਲਤਾਨ', 'ਮਹਾਰਾਜਾ', 'बादशाह', 'राजा', 'ताज', 'सुल्तान', 'महाराजा', 'corona', 'rey', 'reina'
]);
const FLAME_WORDS = new Set([
  'aag', 'fire', 'flame', 'flames', 'heat', 'cooked', 'lit', 'burn', 'burning', 'hot', 'blaze',
  // Gurmukhi & Devanagari & Spanish
  'ਅੱਗ', 'ਭਾਂਬੜ', 'आग', 'ज्वाला', 'fuego', 'llama', 'ardiente'
]);
const SKULL_WORDS = new Set([
  'khatra', 'death', 'danger', 'skull', 'grave', 'fatal', 'poison', 'dead', 'kill', 'murder', 'deadly',
  // Gurmukhi & Devanagari & Spanish
  'ਮੌਤ', 'ਜ਼ਹਿਰ', 'ਕਬਰ', 'मौत', 'जहर', 'कब्र', 'muerte', 'calavera', 'peligro'
]);
const SWORD_WORDS = new Set([
  'talwar', 'kirpan', 'sword', 'swords', 'dagger', 'blade', 'vair', 'war', 'scimitar', 'knife',
  // Gurmukhi & Devanagari & Spanish
  'ਤਲਵਾਰ', 'ਕਿਰਪਾਨ', 'ਸ਼ਸਤਰ', 'ਖੰਡਾ', 'तलवार', 'कृपाण', 'शस्त्र', 'espada', 'daga'
]);
const TROPHY_WORDS = new Set([
  'trophy', 'winner', 'champion', 'gold', 'cup', 'medal', 'first', 'jeet', 'victory', 'champions',
  // Gurmukhi & Devanagari & Spanish
  'ਜਿੱਤ', 'ਸੋਨਾ', 'ਇਨਾਮ', 'जीत', 'सोना', 'इनाम', 'campeon', 'trofeo', 'victoria'
]);
const DICE_WORDS = new Set([
  'kismat', 'dice', 'gamble', 'roll', 'luck', 'naseeb', 'bet', 'craps', 'casino',
  // Gurmukhi & Devanagari & Spanish
  'ਕਿਸਮਤ', 'ਨਸੀਬ', 'ਜੂਆ', 'किस्मत', 'नसीब', 'जुआ', 'dados', 'suerte'
]);
const WATCH_WORDS = new Set([
  'waqt', 'time', 'watch', 'rolex', 'ghadi', 'clock', 'hours', 'tick', 'ticking', 'second',
  // Gurmukhi & Devanagari & Spanish
  'ਵਕਤ', 'ਘੜੀ', 'ਸਮਾਂ', 'वक्त', 'घड़ी', 'समय', 'reloj', 'tiempo', 'hora'
]);
const DIAMOND_WORDS = new Set([
  'heere', 'heera', 'diamond', 'diamonds', 'ice', 'bling', 'jewelry', 'gems', 'gem', 'jewel',
  // Gurmukhi & Devanagari & Spanish
  'ਹੀਰੇ', 'ਹੀਰਾ', 'ਗਹਿਣੇ', 'हीरे', 'हीरा', 'गहने', 'diamante', 'joya', 'brillante'
]);
const STAR_WORDS = new Set([
  'star', 'superstar', 'fame', 'celebrity', 'bright', 'shine', 'glow', 'stellar',
  // Gurmukhi & Devanagari & Spanish
  'ਤਾਰਾ', 'ਸਿਤਾਰਾ', 'तारा', 'सितारा', 'estrella', 'brillo'
]);

// 16 New Word Badge Keyword Dictionaries (Multilingual: English, Punjabi, Hindi, Spanish)
const GUN_WORDS = new Set([
  'gun', 'guns', 'pistol', 'rifle', 'glock', 'revolver', 'bandook', 'goli', 'revorbar', 'asla', 'tamancha', 'katta', 'pistola', 'arma', 'balas', 'shotgun', 'weapon',
  // Gurmukhi & Devanagari
  'ਬੰਦੂਕ', 'ਗੋਲੀ', 'ਪਿਸਤੌਲ', 'ਅਸਲਾ', 'ਰਿਵਾਲਵਰ', 'बंदूक', 'गोली', 'पिस्तौल', 'तमंचा', 'कट्टा', 'हथियार'
]);
const BOMB_WORDS = new Set([
  'bomb', 'bombs', 'blast', 'explode', 'explosion', 'pataka', 'bam', 'dhamaka', 'bomba', 'dynamite', 'dinamita', 'grenade', 'barood',
  // Gurmukhi & Devanagari
  'ਬੰਬ', 'ਧਮਾਕਾ', 'ਪਟਾਕਾ', 'ਬਾਰੂਦ', 'बम', 'धमाका', 'पटाखा', 'बारूद'
]);
const CHAIN_WORDS = new Set([
  'chain', 'chains', 'cuban', 'chaina', 'soney', 'zanjeer', 'cadena', 'necklace', 'collar', 'pendant', 'goldchain',
  // Gurmukhi & Devanagari
  'ਜ਼ੰਜੀਰ', 'ਸੋਨਾ', 'ਚੈਨ', 'ਚੈਨਾ', 'जंजीर', 'सोना', 'चैन', 'हार'
]);
const MICROPHONE_WORDS = new Set([
  'mic', 'microphone', 'studio', 'rap', 'spit', 'spittin', 'rhyme', 'vocals', 'vocal', 'microfono', 'booth', 'awaaz',
  // Gurmukhi & Devanagari
  'ਮਾਈਕ', 'ਅਵਾਜ਼', 'माइक', 'आवाज', 'स्वर'
]);
const LIGHTNING_WORDS = new Set([
  'lightning', 'thunder', 'shock', 'volt', 'current', 'bijli', 'bijlee', 'rayo', 'trueno', 'electric', 'electricity',
  // Gurmukhi & Devanagari
  'ਬਿਜਲੀ', 'ਤੜਕ', 'बिजली', 'करंट', 'विद्युत'
]);
const ROSE_WORDS = new Set([
  'rose', 'roses', 'gulab', 'flower', 'petal', 'phool', 'rosa', 'blossom', 'bouquet', 'kali',
  // Gurmukhi & Devanagari
  'ਗੁਲਾਬ', 'ਫੁੱਲ', 'ਕਲੀ', 'गुलाब', 'फूल', 'कली'
]);
const CLOUD_RAIN_WORDS = new Set([
  'rain', 'raining', 'barish', 'barsaat', 'barkha', 'cloud', 'clouds', 'badal', 'lluvia', 'llueve', 'storm', 'stormy', 'pour', 'drizzle',
  // Gurmukhi & Devanagari
  'ਮੀਂਹ', 'ਬਾਰਿਸ਼', 'ਬੱਦਲ', 'ਬਰਸਾਤ', 'बारिश', 'बरसात', 'बादल', 'वर्षा'
]);
const MOON_WORDS = new Set([
  'moon', 'chann', 'chand', 'chanda', 'chaand', 'lunar', 'luna', 'moonlight', 'crescent', 'midnight',
  // Gurmukhi & Devanagari
  'ਚੰਨ', 'ਚੰਦ', 'ਚੰਨਣ', 'चाँद', 'चांद', 'चंदा', 'चंद्रमा'
]);
const LIPS_WORDS = new Set([
  'lips', 'lip', 'hont', 'honth', 'buliyan', 'kiss', 'kisses', 'chumma', 'labio', 'labios', 'lipstick', 'pout', 'muah',
  // Gurmukhi & Devanagari
  'ਬੁੱਲ', 'ਬੁਲੀਆਂ', 'ਚੁੰਮਾ', 'होंठ', 'होठ', 'चुम्मा', 'लब'
]);
const WINE_GLASS_WORDS = new Set([
  'wine', 'daru', 'daaru', 'sharab', 'drink', 'drinks', 'peg', 'cheers', 'glass', 'copa', 'vino', 'toast', 'cocktail', 'champagne', 'jaam',
  // Gurmukhi & Devanagari
  'ਦਾਰੂ', 'ਸ਼ਰਾਬ', 'ਪੈੱਗ', 'ਜਾਮ', 'दारू', 'शराब', 'जाम', 'पैग', 'मदिरा'
]);
const GUITAR_WORDS = new Set([
  'guitar', 'saaz', 'riff', 'strum', 'chords', 'guitarra', 'rockstar', 'acoustic', 'strings',
  // Gurmukhi & Devanagari
  'ਗਿਟਾਰ', 'ਸਾਜ਼', 'गिटार', 'साज़', 'तार'
]);
const KEY_WORDS = new Set([
  'key', 'keys', 'chaabi', 'chabi', 'kunci', 'lock', 'unlock', 'llave', 'secret', 'tala',
  // Gurmukhi & Devanagari
  'ਚਾਬੀ', 'ਜਿੰਦਰਾ', 'ਕੁੰਜੀ', 'चाबी', 'कुंजी', 'ताला'
]);
const MASK_WORDS = new Set([
  'mask', 'masked', 'balaclava', 'ski', 'nakab', 'naqab', 'parda', 'mascara', 'disguise', 'stealth', 'hood',
  // Gurmukhi & Devanagari
  'ਨਕਾਬ', 'ਮਾਸਕ', 'ਪਰਦਾ', 'नकाब', 'मुखौटा', 'पर्दा'
]);
const EYE_WORDS = new Set([
  'eye', 'eyes', 'ankhiyan', 'naina', 'nazar', 'deeda', 'ojo', 'ojos', 'vision', 'stare', 'gaze', 'sight',
  // Gurmukhi & Devanagari
  'ਅੱਖਾਂ', 'ਨਜ਼ਰ', 'ਦੀਦਾਰ', 'ਨੈਣ', 'नज़र', 'नजर', 'आँखें', 'आंखें', 'दीदार', 'नैना', 'दृष्टि'
]);
const BUTTERFLY_WORDS = new Set([
  'butterfly', 'butterflies', 'titli', 'titliyan', 'mariposa', 'mariposas', 'flutter', 'wings',
  // Gurmukhi & Devanagari
  'ਤਿਤਲੀ', 'ਤਿਤਲੀਆਂ', 'ਤਿਤਲੀਆ', 'तितली', 'तितलियाँ', 'तितलीयां'
]);
const SHIELD_WORDS = new Set([
  'shield', 'dhaal', 'guard', 'defend', 'defense', 'protect', 'escudo', 'armor', 'protection', 'knight',
  // Gurmukhi & Devanagari
  'ਢਾਲ', 'ਬਚਾਅ', 'ਰੱਖਿਆ', 'ढाल', 'रक्षा', 'बचाव'
]);

/**
 * Normalizes a word token for multilingual keyword dictionary lookup across
 * Latin (with accents stripped e.g. micrófono -> microfono), Devanagari, Gurmukhi, etc.
 */
export function normalizeBadgeMotifToken(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}]/gu, '')
    .trim();
}

/**
 * Deterministically classifies whether a word triggers an inline 1-bit micro-sprite badge.
 * Understands English, Punjabi (Latin + Gurmukhi), Hindi (Latin + Devanagari), Spanish, and common slang synonyms.
 */
export function classifyWordBadge(
  word: string,
  songProfile?: SongMoodProfile | null
): WordBadgeIcon {
  const clean = normalizeBadgeMotifToken(word);
  if (!clean) return 'none';

  if (MOUSTACHE_WORDS.has(clean)) return 'moustache';
  if (SUNGLASSES_WORDS.has(clean)) return 'sunglasses';
  if (CASH_WORDS.has(clean)) return 'cash';
  if (CAR_WORDS.has(clean)) return 'car';
  if (BROKEN_HEART_WORDS.has(clean)) return 'broken_heart';
  if (HEART_WORDS.has(clean)) return 'heart';
  if (CROWN_WORDS.has(clean)) return 'crown';
  if (FLAME_WORDS.has(clean)) return 'flame';
  if (SKULL_WORDS.has(clean)) return 'skull';
  if (SWORD_WORDS.has(clean)) return 'sword';
  if (TROPHY_WORDS.has(clean)) return 'trophy';
  if (DICE_WORDS.has(clean)) return 'dice';
  if (WATCH_WORDS.has(clean)) return 'watch';
  if (DIAMOND_WORDS.has(clean)) return 'diamond';
  if (STAR_WORDS.has(clean)) return 'star';

  // 16 New Badges
  if (GUN_WORDS.has(clean)) return 'gun';
  if (BOMB_WORDS.has(clean)) return 'bomb';
  if (CHAIN_WORDS.has(clean)) return 'chain';
  if (MICROPHONE_WORDS.has(clean)) return 'microphone';
  if (LIGHTNING_WORDS.has(clean)) return 'lightning';
  if (ROSE_WORDS.has(clean)) return 'rose';
  if (CLOUD_RAIN_WORDS.has(clean)) return 'cloud_rain';
  if (MOON_WORDS.has(clean)) return 'moon';
  if (LIPS_WORDS.has(clean)) return 'lips';
  if (WINE_GLASS_WORDS.has(clean)) return 'wine_glass';
  if (GUITAR_WORDS.has(clean)) return 'guitar';
  if (KEY_WORDS.has(clean)) return 'key';
  if (MASK_WORDS.has(clean)) return 'mask';
  if (EYE_WORDS.has(clean)) return 'eye';
  if (BUTTERFLY_WORDS.has(clean)) return 'butterfly';
  if (SHIELD_WORDS.has(clean)) return 'shield';

  return 'none';
}

/**
 * Maps a concrete lyric word to its optimal visual motif background if appropriate.
 */
export function classifyWordMotif(
  word: string,
  songProfile?: SongMoodProfile | null
): VisualMotif | null {
  const clean = normalizeBadgeMotifToken(word);
  if (!clean || isFillerWord(clean)) return null;

  // Direct keyword matching for specific visual motifs (multilingual)
  if (clean === 'khanda' || clean === 'chakkar' || clean === 'ਖੰਡਾ' || clean === 'खंडा') return 'punjabi_khanda';
  if (clean === 'siren' || clean === 'police' || clean === 'cop' || clean === 'cops' || clean === 'ਸਾਇਰਨ' || clean === 'साइरन') return 'police_siren_sweep';
  if (clean === 'thar' || clean === 'jeep' || clean === '4x4' || clean === 'ਥਾਰ' || clean === 'थार') return 'thar_jeep_grille';
  if (clean === 'boombox' || clean === 'blaster') return 'boombox_blaster';
  if (clean === 'subwoofer' || clean === 'bass') return 'speaker_subwoofer_pulse';
  if (clean === 'metronome' || clean === 'tempo') return 'metronome_ticker';
  if (clean === 'disco') return 'disco_mirror_ball';
  if (clean === 'skyline' || clean === 'city' || clean === 'skyscrapers' || clean === 'cityscape' || clean === 'ਸ਼ਹਿਰ' || clean === 'शहर') return 'city_skyline_silhouette';
  if (clean === 'smoke' || clean === 'smokering' || clean === 'haze' || clean === 'ਧੂੰਆਂ' || clean === 'धुआं' || clean === 'धुआँ') return 'smoke_ring_drift';
  if (clean === 'graffiti' || clean === 'drip' || clean === 'drips') return 'graffiti_drips';
  if (clean === 'vault' || clean === 'safe' || clean === 'ਤਿਜੋਰੀ' || clean === 'तिजोरी') return 'vault_safe_dial';
  if (clean === 'candle' || clean === 'ਮੋਮਬੱਤੀ' || clean === 'मोमबत्ती') return 'candle_flame_flicker';
  if (clean === 'autumn' || clean === 'leaves' || clean === 'leaf' || clean === 'ਪੱਤੇ' || clean === 'पत्ते') return 'falling_autumn_leaves';
  if (clean === 'feather' || clean === 'quill' || clean === 'ਖੰਭ' || clean === 'पंखा') return 'feather_drift';
  if (clean === 'grid' || clean === 'synthwave' || clean === 'laser') return 'laser_grid_horizon';
  if (clean === 'matrix') return 'matrix_rain_code';
  if (clean === 'tunnel') return 'neon_heart_tunnel';
  if (clean === 'radar' || clean === 'sonar') return 'radar_sweep_sonar';
  if (clean === 'hazard' || clean === 'caution' || clean === 'warning' || clean === 'ਖ਼ਤਰਾ' || clean === 'खतरा') return 'hazard_stripes_caution';
  if (clean === 'aura' || clean === 'ki') return 'shonen_ki_aura';
  if (clean === 'portal' || clean === 'vortex') return 'portal_vortex';

  const badge = classifyWordBadge(word, songProfile);
  switch (badge) {
    case 'moustache': return 'handlebar_moustache';
    case 'sunglasses': return 'dark_sunglasses';
    case 'cash': return 'money_stack';
    case 'car': return 'street_racer';
    case 'broken_heart': return 'cracked_heart';
    case 'heart': return 'heartbeat_pulse';
    case 'crown': return 'crown_royal';
    case 'sword': return 'crossed_swords';
    case 'trophy': return 'champion_trophy';
    case 'dice': return 'lucky_dice';
    case 'watch': return 'rolex_watch';
    case 'flame': return 'flame_tongue';
    case 'skull': return 'skull_cross';
    case 'diamond':
    case 'star': return 'chrome_star';
    case 'gun': return 'bullet_chamber_cylinder';
    case 'bomb': return 'sound_blast_rings';
    case 'chain': return 'cuban_chain_links';
    case 'microphone': return 'studio_microphone';
    case 'lightning': return 'lightning_arc';
    case 'rose': return 'blooming_rose';
    case 'cloud_rain': return 'rain_window';
    case 'moon': return 'lunar_crescent';
    case 'lips': return 'neon_lips';
    case 'wine_glass': return 'champagne_toast';
    case 'guitar': return 'electric_guitar';
    case 'key': return 'antique_key_lock';
    case 'mask': return 'drill_ski_mask';
    case 'eye': return 'all_seeing_eye';
    case 'butterfly': return 'fluttering_butterflies';
    case 'shield': return 'knight_shield';
    default: return null;
  }
}




