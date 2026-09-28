import { MotionArchetype } from './types';
import { LyricWord } from '../lyrics/types';

// Semantic Keyword Dictionaries
const BLADE_KEYWORDS = new Set([
  'blade', 'slash', 'razor', 'cut', 'knife', 'sword', 'shashtar', 'talwar', 'tear', 'split',
  'edge', 'sharp', 'chop', 'stab', 'dissect', 'rip', 'dagger', 'axe', 'slice', 'kat', 'teer',
  'chhuri', 'khanjar', 'chaku', 'katar', 'khanda', 'vad', 'chir', 'dhaar', 'steel', 'shred'
]);

const IMPACT_KEYWORDS = new Set([
  'hit', 'beat', 'drop', 'slam', 'smash', 'boom', 'bang', 'punch', 'kick', 'break',
  'crash', 'blast', 'hammer', 'heavy', 'thud', 'strike', 'fall', 'bullet', 'gun',
  'thaaka', 'rodhe', 'dhamaka', 'thok', 'fuego', 'shot', 'blast', 'fire', 'aag', 'toot',
  'shatter', 'knockout', 'stomp', 'ground', 'kill', 'destroy', 'goli', 'pistol', 'trigger',
  'bass', 'loud', 'clash', 'bomb', 'attack', 'clout', 'pow'
]);

const ANTHEM_KEYWORDS = new Set([
  'jatt', 'king', 'queen', 'boss', 'crown', 'gold', 'god', 'lord', 'pride', 'stand',
  'roar', 'champion', 'lead', 'rule', 'empire', 'power', 'giant', 'iron', 'steel',
  'throne', 'mahal', 'raja', 'badshah', 'hero', 'top', 'number', 'high', 'peak',
  'legend', 'glory', 'million', 'billion', 'rich', 'shaan', 'hukum', 'money', 'cash',
  'dollar', 'star', 'munda', 'yaari', 'gabru', 'sher', 'prime', 'supreme', 'legacy',
  'royal', 'sovereign', 'flex', 'chain', 'ice', 'bentley', 'rolex', 'block', 'solid'
]);

const TARGET_KEYWORDS = new Set([
  'you', 'tainu', 'look', 'see', 'watch', 'eyes', 'aim', 'target', 'sight', 'locked',
  'view', 'focus', 'check', 'akhan', 'dekh', 'point', 'spot', 'me', 'mera', 'meri',
  'tere', 'meri', 'face', 'stare', 'gaze', 'takk', 'nazar', 'dhyan', 'scope', 'reddot',
  'bullseye', 'hunt', 'prey', 'watchout', 'locate', 'track', 'found'
]);

const SNAKE_KEYWORDS = new Set([
  'snake', 'venom', 'poison', 'toxic', 'creep', 'crawl', 'bite', 'sting', 'dark',
  'evil', 'sly', 'hiss', 'zehri', 'naag', 'saap', 'vish', 'spider', 'deadly', 'viper',
  'cobra', 'dass', 'das', 'sapp', 'dang', 'poisonous', 'serpent', 'venomous', 'shadow',
  'creep', 'underworld', 'kida'
]);

const GLITCH_KEYWORDS = new Set([
  'speed', 'fast', 'run', 'glitch', 'code', 'neon', 'wire', 'electric', 'volt',
  'lightning', 'spark', 'static', 'matrix', 'data', 'chip', 'flash', 'bijli',
  'current', 'taar', 'quick', 'rush', 'sprint', 'zoom', 'laser', 'alien', 'tech',
  'cyber', 'hack', 'system', 'signal', 'pulse', 'circuit', 'digital', 'pixel', 'nano', 'hyper'
]);

const ECHO_KEYWORDS = new Set([
  'shout', 'scream', 'call', 'cry', 'sing', 'sound', 'voice', 'loud', 'echo',
  'roar', 'aawaz', 'bol', 'shor', 'chant', 'whoa', 'yeah', 'oh', 'aah', 'boom',
  'infinite', 'forever', 'always', 'space', 'distance', 'door', 'awaaz', 'goonj',
  'pukaar', 'gaana', 'sangeet', 'raag', 'alaap', 'holler', 'yell', 'reverb'
]);

const BADGE_KEYWORDS = new Set([
  'no', 'never', 'stop', 'wait', 'listen', 'rule', 'badge', 'hold', 'keep',
  'naam', 'sun', 'ruk', 'sach', 'true', 'false', 'sign', 'stamp', 'seal', 'title',
  'certified', 'real', 'asli', 'first', 'only', 'final', 'end', 'don\'t', 'cant',
  'halt', 'warning', 'alert', 'verified', 'official', 'tag', 'mark', 'proof', 'valid',
  'guarantee', 'zero', 'done', 'shut', 'freeze'
]);

const FLUID_KEYWORDS = new Set([
  'fly', 'sky', 'rain', 'wave', 'ocean', 'sea', 'water', 'river', 'air', 'breeze',
  'wind', 'float', 'drift', 'cloud', 'hawawan', 'paani', 'nadi', 'udna', 'love',
  'heart', 'dil', 'pyaar', 'smooth', 'gentle', 'soft', 'breathe', 'flow', 'glide',
  'hwa', 'meenh', 'lehar', 'beh', 'doob', 'kinara', 'chand', 'moon', 'tare', 'stars',
  'melt', 'liquid', 'stream', 'peace', 'calm'
]);

const WIGGLY_KEYWORDS = new Set([
  'shake', 'crazy', 'wild', 'insane', 'mad', 'freak', 'dance', 'jump', 'bounce',
  'wiggle', 'jiggle', 'tremble', 'shiver', 'nervous', 'boil', 'fever', 'psycho',
  'weird', 'groove', 'twist', 'rock', 'roll', 'funky', 'chaos', 'vibe', 'trip'
]);

/**
 * Classifies a lyric word into its optimal visual kinetic archetype based on
 * semantics, phonetics, and vocal duration.
 */
export function classifyWordArchetype(
  word: string,
  durationMs: number = 400,
  wordIndex: number = 0,
  precedingSilenceMs: number = 0
): MotionArchetype {
  const clean = word.toLowerCase().replace(/[^a-z0-9']/g, '');

  // 1. Direct Semantic Keyword Matching
  if (BLADE_KEYWORDS.has(clean)) return 'blade_slash';
  if (IMPACT_KEYWORDS.has(clean)) return 'manga_impact';
  if (ANTHEM_KEYWORDS.has(clean)) return '3d_block_stack';
  if (TARGET_KEYWORDS.has(clean)) return 'target_focus';
  if (SNAKE_KEYWORDS.has(clean)) return 'snake_slither';
  if (GLITCH_KEYWORDS.has(clean)) return 'cyber_glitch';
  if (ECHO_KEYWORDS.has(clean)) return 'echo_stack';
  if (BADGE_KEYWORDS.has(clean)) return 'inverted_badge';
  if (FLUID_KEYWORDS.has(clean)) return 'smooth_fluid';
  if (WIGGLY_KEYWORDS.has(clean)) return 'wiggly_boil';

  // 2. Punctuation & Structural Markers
  if (word.includes('!') || word.endsWith('!!')) {
    return 'manga_impact';
  }
  if (word.includes('?') || word.includes('...')) {
    return 'target_focus';
  }

  // 3. Rhythmic & Duration Heuristics
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

  // 4. Dynamic Variety Rotation for neutral words (never monotonous)
  const neutralPalette: MotionArchetype[] = [
    'smooth_fluid',
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
  precedingWord?: LyricWord
): MotionArchetype {
  const specificKey = `${word.word}_${word.startMs}`;
  const cleanKey = word.word.toLowerCase().replace(/[^a-z0-9]/g, '');

  if (wordOverrides && wordOverrides[specificKey]) {
    return wordOverrides[specificKey];
  }
  if (wordOverrides && wordOverrides[cleanKey]) {
    return wordOverrides[cleanKey];
  }

  if (globalArchetype === 'auto_semantic') {
    const durationMs = Math.max(80, word.endMs - word.startMs);
    const precedingSilence = precedingWord ? Math.max(0, word.startMs - precedingWord.endMs) : 0;
    return classifyWordArchetype(word.word, durationMs, wordIndex, precedingSilence);
  }

  return globalArchetype;
}

