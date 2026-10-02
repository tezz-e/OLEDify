import { AudioAnalysisResult } from './audioAnalysisEngine';
import { LyricLine } from '../lyrics/types';
import { MotionArchetype, VisualMotif, StylePackId } from './types';

export type SongVibe = 'ballad_acoustic' | 'chill_pop' | 'groove_dance' | 'hype_aggressive';

export interface SongMoodProfile {
  vibe: SongVibe;
  bpm: number;
  averageRms: number;
  energyScore: number;       // Normalized [0..1]
  label: string;             // Human-readable vibe label
  recommendedStylePack: StylePackId;
  defaultArchetype: MotionArchetype;
  allowedArchetypes: MotionArchetype[];
  allowedMotifs: VisualMotif[];
  dwellDecayFactor: number;   // Multiplier for hold duration (1.0 = standard, 1.8 = relaxed)
  easingCurvature: number;   // Easing power (0.6 = soft sine, 1.0 = standard, 1.8 = sharp snappy)
  cameraShakeEnabled: boolean; // Disables camera shake for chill/ballad to eliminate visual jarring
  maxEntryDisplacementPx: number; // Max vertical jump on entry (3px for ballad, 5px for chill pop, 18px for hype)
  crossfadeOverlapMs: number; // Duration of gentle 1-bit Bayer dither cross-fade between consecutive words
}

/**
 * Keywords in lyrics that indicate acoustic/romantic/chill ballad themes.
 */
const CHILL_BALLAD_KEYWORDS = new Set([
  'love', 'heart', 'baby', 'kiss', 'hold', 'touch', 'eyes', 'whisper', 'sweet',
  'darling', 'slow', 'dance', 'rain', 'night', 'tears', 'dream', 'soul', 'breathe',
  'soft', 'warm', 'gentle', 'stay', 'arms', 'fall', 'falling', 'lover', 'bed',
  'acoustic', 'acoustic guitar', 'sing', 'song', 'melody', 'quiet', 'peace', 'home',
  // Punjabi / Hindi acoustic / romance / slow
  'pyaar', 'ishq', 'dil', 'ankhiyan', 'hawa', 'rooh', 'saans', 'khwaab', 'sajna', 'dholna'
]);

/**
 * Keywords in lyrics that indicate hype/aggressive/drill/trap themes.
 */
const HYPE_RAP_KEYWORDS = new Set([
  // English rap / drill / trap
  'drop', 'bitch', 'gun', 'trap', 'drill', 'shoot', 'kill', 'flex', 'cash', 'money',
  'glock', 'gang', 'opps', 'smoke', 'fire', 'bang', 'rage', 'riot', 'bass', 'crazy',
  'blast', 'bleed', 'die', 'murder', 'blood', 'slock', 'draco', 'chopper', 'switch',
  'strap', 'racks', 'bands', 'uzi', 'bullet', 'bullets', 'trigger', 'spin', 'beef',
  'demon', 'threat', 'flow', 'rhyme', 'verse', 'bars', 'clout', 'shooter', 'shooters',
  'hustle', 'grind', 'gangsta', 'gangster', 'cheque', 'check', 'banger', 'king',

  // Punjabi & Desi drill / hip-hop / street
  'asool', 'asoola', 'asoolan', 'toduga', 'tod da', 'todna', 'tod de',
  'velli', 'velliyan', 'velliyaan', 'velly', 'jatt', 'jatta', 'jattwad',
  'shashtar', 'bandook', 'kartoos', 'barood', 'badmashi', 'badmash',
  'gaddi', 'gaddiyan', 'hisaab', 'bapu', 'taiyar', 'muqabla',
  'kude', 'kudi', 'yaar', 'yaari', 'yaaran', 'daang', 'chaku', 'talwar',
  'thana', 'court', 'kabza', 'honsla', 'kaun', 'assi', 'tole', 'panga',
  'dushman', 'soorme', 'munde', 'khadku', 'rifle', 'dunali', 'hater', 'haters',
  'record', 'records', 'hustler', 'game', 'schoolan'
]);

/**
 * Regex matching song title or artist keywords that strongly indicate hype, drill, trap or aggressive rap.
 */
export const HYPE_META_REGEX = /\b(drill|trap|rap|hiphop|hip\s*hop|bars|banger|rage|metal|rock|phonk|hardstyle|dubstep|karan\s*aujla|sidhu|moose\s*wala|ikky|ap\s*dhillon|shubh|divine|emiway|mc\s*stan|badshah|raftaar|drake|travis|carti|future|21\s*savage|kendrick|eminem|uzi|yeat|chief\s*keef|pop\s*smoke|central\s*cee|nle\s*choppa|lil\s*baby|dababy)\b/i;

/**
 * Regex matching song title or artist keywords that indicate acoustic, ballad, or chill pop.
 */
export const CHILL_META_REGEX = /\b(acoustic|ballad|lofi|lo-fi|chill|slow|peaceful|ambient|piano|unplugged|lullaby|ed\s*sheeran|taylor\s*swift|adele|billie\s*eilish|olivia\s*rodrigo|john\s*mayer|norah\s*jones|laufey|bruno\s*mars)\b/i;

/**
 * Computes a SongMoodProfile from audio telemetry and/or lyrics.
 * If no audio file is provided, it analyzes lyric density, word length, title/artist metadata, and keyword sentiment.
 */
export function computeSongMoodProfile(
  audioAnalysis?: AudioAnalysisResult | null,
  lyrics?: LyricLine[],
  songTitle: string = '',
  artist: string = ''
): SongMoodProfile {
  const hasAudio = !!(audioAnalysis?.bpm && audioAnalysis.bpm > 0);

  // 1. Analyze Audio Metrics
  let bpm = hasAudio ? Math.round(audioAnalysis!.bpm) : 110;
  
  let averageRms = 0.35;
  if (audioAnalysis?.frames && audioAnalysis.frames.length > 0) {
    const totalRms = audioAnalysis.frames.reduce((acc, f) => acc + f.rms, 0);
    averageRms = totalRms / audioAnalysis.frames.length;
  }

  // 2. Analyze Title & Artist Metadata
  const metaText = `${songTitle} ${artist}`.toLowerCase();
  const hasHypeMeta = HYPE_META_REGEX.test(metaText);
  const hasChillMeta = CHILL_META_REGEX.test(metaText);

  // 3. Analyze Lyric Sentiment & Word Density
  let chillCount = 0;
  let hypeCount = 0;
  let totalWords = 0;
  let totalDurationMs = 0;

  if (lyrics && lyrics.length > 0) {
    for (const line of lyrics) {
      const lineLower = line.text.toLowerCase();
      if (/\b(52 bars|karan aujla|sidhu moose|drill flow|gang gang)\b/.test(lineLower)) {
        hypeCount += 2;
      }
      for (const w of line.words) {
        totalWords++;
        totalDurationMs += (w.endMs - w.startMs);
        const lower = w.word.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (CHILL_BALLAD_KEYWORDS.has(lower)) chillCount++;
        if (HYPE_RAP_KEYWORDS.has(lower)) hypeCount++;
      }
    }
  }

  const avgWordDuration = totalWords > 0 ? (totalDurationMs / totalWords) : 400;

  // 4. Compute normalized Energy Score [0..1]
  const tempoNorm = Math.min(1, Math.max(0, (bpm - 55) / (165 - 55)));
  const rmsNorm = Math.min(1, Math.max(0, averageRms * 1.4));
  const sentimentDelta = (hypeCount - chillCount) * 0.04;
  const pacingDelta = (avgWordDuration < 340 && totalWords >= 6) ? 0.08 : (avgWordDuration > 600 ? -0.08 : 0);

  const energyScore = Math.min(1, Math.max(0, 
    (hasAudio ? (tempoNorm * 0.55 + rmsNorm * 0.35) : 0.50) + 
    sentimentDelta + 
    pacingDelta
  ));

  // 5. Classify Vibe Category
  let vibe: SongVibe = 'chill_pop';

  if (hasHypeMeta || (hypeCount >= 2 && hypeCount > chillCount) || energyScore >= 0.65) {
    vibe = 'hype_aggressive';
  } else if (bpm < 84 || (bpm < 90 && energyScore < 0.30 && (hasChillMeta || chillCount > hypeCount))) {
    vibe = 'ballad_acoustic';
  } else if (hasChillMeta || (chillCount >= 2 && chillCount > hypeCount) || energyScore < 0.45) {
    vibe = 'chill_pop';
  } else if (bpm >= 120 || energyScore >= 0.50) {
    vibe = 'groove_dance';
  } else {
    vibe = 'chill_pop';
  }

  // Adjust display BPM when audio analysis is absent to reflect detected archetype vibe
  if (!hasAudio) {
    if (vibe === 'hype_aggressive') bpm = 135;
    else if (vibe === 'ballad_acoustic') bpm = 75;
    else if (vibe === 'chill_pop') bpm = 96;
    else if (vibe === 'groove_dance') bpm = 120;
  }

  // 5. Construct Profile according to Vibe
  switch (vibe) {
    case 'ballad_acoustic':
      return {
        vibe: 'ballad_acoustic',
        bpm,
        averageRms,
        energyScore,
        label: `Ballad & Acoustic (${bpm} BPM)`,
        recommendedStylePack: 'pop_acoustic',
        defaultArchetype: 'gentle_float',
        allowedArchetypes: [
          'gentle_float',
          'dither_dissolve',
          'typewriter_ribbon',
          'waveform_karaoke',
          'smooth_fluid',
          'echo_stack'
        ],
        allowedMotifs: [
          'none',
          'starlight_glimmer',
          'floating_notes',
          'heartbeat_pulse',
          'minimal_frame',
          'water_ripples'
        ],
        dwellDecayFactor: 1.6,
        easingCurvature: 0.6,
        cameraShakeEnabled: false,
        maxEntryDisplacementPx: 3,
        crossfadeOverlapMs: 120
      };

    case 'chill_pop':
      return {
        vibe: 'chill_pop',
        bpm,
        averageRms,
        energyScore,
        label: `Chill Pop & Groove (${bpm} BPM)`,
        recommendedStylePack: 'pop_acoustic',
        defaultArchetype: 'waveform_karaoke',
        allowedArchetypes: [
          'gentle_float',
          'waveform_karaoke',
          'typewriter_ribbon',
          'dither_dissolve',
          'smooth_fluid',
          'rolling_odometer',
          'inverted_badge',
          'target_focus'
        ],
        allowedMotifs: [
          'none',
          'floating_notes',
          'heartbeat_pulse',
          'starlight_glimmer',
          'minimal_frame',
          'chrome_star',
          'lofi_dust_motes'
        ],
        dwellDecayFactor: 1.3,
        easingCurvature: 0.8,
        cameraShakeEnabled: false,
        maxEntryDisplacementPx: 5,
        crossfadeOverlapMs: 100
      };

    case 'groove_dance':
      return {
        vibe: 'groove_dance',
        bpm,
        averageRms,
        energyScore,
        label: `Midtempo Groove (${bpm} BPM)`,
        recommendedStylePack: 'pop_acoustic',
        defaultArchetype: 'rolling_odometer',
        allowedArchetypes: [
          'rolling_odometer',
          'waveform_karaoke',
          'inverted_badge',
          'gentle_float',
          'smooth_fluid',
          'target_focus',
          'wiggly_boil'
        ],
        allowedMotifs: [
          'none',
          'floating_notes',
          'chrome_star',
          'comic_burst',
          'heartbeat_pulse'
        ],
        dwellDecayFactor: 1.0,
        easingCurvature: 1.0,
        cameraShakeEnabled: true,
        maxEntryDisplacementPx: 10,
        crossfadeOverlapMs: 50
      };

    case 'hype_aggressive':
    default:
      return {
        vibe: 'hype_aggressive',
        bpm,
        averageRms,
        energyScore,
        label: `High Energy / Hype (${bpm} BPM)`,
        recommendedStylePack: 'trap_drill',
        defaultArchetype: 'manga_impact',
        allowedArchetypes: [
          'manga_impact',
          'blade_slash',
          'cyber_glitch',
          '3d_block_stack',
          'echo_stack',
          'inverted_badge',
          'rolling_odometer',
          'target_focus',
          'wiggly_boil',
          'snake_slither'
        ],
        allowedMotifs: [
          'none',
          'manga_speedlines',
          'anime_rush',
          'crown_royal',
          'razor_blade',
          'tactical_scope',
          'flame_tongue',
          'skull_cross',
          'lightning_arc',
          'comic_burst'
        ],
        dwellDecayFactor: 1.0,
        easingCurvature: 1.5,
        cameraShakeEnabled: true,
        maxEntryDisplacementPx: 18,
        crossfadeOverlapMs: 65
      };
  }
}
