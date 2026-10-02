import { MotionArchetype, StylePackConfig, WordFontRole, STYLE_PACKS, MULTILINGUAL_FALLBACK_FONTS } from './types';
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

  if (!isChill) {
    if (BLADE_KEYWORDS.has(clean)) return 'blade_slash';
    if (IMPACT_KEYWORDS.has(clean)) return 'manga_impact';
    if (ANTHEM_KEYWORDS.has(clean)) return '3d_block_stack';
    if (GLITCH_KEYWORDS.has(clean)) return 'cyber_glitch';
    if (SNAKE_KEYWORDS.has(clean)) return 'snake_slither';
  } else {
    // Soften combat keywords in chill/ballad modes
    if (BLADE_KEYWORDS.has(clean)) return 'waveform_karaoke';
    if (IMPACT_KEYWORDS.has(clean)) return 'inverted_badge';
    if (ANTHEM_KEYWORDS.has(clean)) return 'gentle_float';
    if (GLITCH_KEYWORDS.has(clean)) return 'dither_dissolve';
    if (SNAKE_KEYWORDS.has(clean)) return 'gentle_float';
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

    // Chill neutral rotation (Zero violent styles!)
    const chillPalette: MotionArchetype[] = [
      'gentle_float',
      'waveform_karaoke',
      'smooth_fluid',
      'typewriter_ribbon',
      'rolling_odometer',
      'dither_dissolve',
      'inverted_badge'
    ];
    return chillPalette[wordIndex % chillPalette.length];
  }

  // Standard/Hype heuristics
  // Long sustained notes (>650ms) need active hold motion (Echo Stack or 3D Block)
  if (durationMs > 650) {
    return (wordIndex % 2 === 0) ? 'echo_stack' : '3d_block_stack';
  }

  // Large preceding silence (>400ms) indicates a dynamic vocal punch
  if (precedingSilenceMs > 400) {
    return 'manga_impact';
  }

  // Very rapid flows (<220ms) look best with fast glitch or fluid glide
  if (durationMs < 220) {
    return (wordIndex % 2 === 0) ? 'cyber_glitch' : 'smooth_fluid';
  }

  // 5. Dynamic Variety Rotation for neutral words (never monotonous)
  const neutralPalette: MotionArchetype[] = [
    'smooth_fluid',
    'rolling_odometer',
    'inverted_badge',
    '3d_block_stack',
    'wiggly_boil',
    'cyber_glitch',
    'manga_impact'
  ];

  return neutralPalette[wordIndex % neutralPalette.length];
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
    return classifyWordArchetype(word.word, durationMs, wordIndex, precedingSilence, moodProfile);
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
      return 'hero';
    case 'blade_slash':
    case 'snake_slither':
    case 'typewriter_ribbon':
      return 'action';
    case 'cyber_glitch':
    case 'target_focus':
    case 'wiggly_boil':
    case 'echo_stack':
    case 'rolling_odometer':
    case 'dither_dissolve':
      return 'novelty';
    case 'smooth_fluid':
    default:
      return 'anchor';
  }
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
  // If the font is ornate blackletter or delicate cursive ('Wilhelm Gotisch', 'Vendetta')
  // and the word has 5+ characters (not a short 1-4 punchline like 'NO', 'WAR', 'ICE'),
  // upgrade to a high-legibility geometric display font ('Lemon Milk') so counters and apertures stay open.
  if (
    !wordFontOverrides?.[cleanKey] &&
    /wilhelm|vendetta/i.test(baseFont) &&
    word.word.replace(/[^a-zA-Z0-9]/g, '').length >= 5
  ) {
    baseFont = `'Lemon Milk', ${MULTILINGUAL_FALLBACK_FONTS}, sans-serif`;
  }

  return baseFont;
}



