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
  'acoustic', 'acoustic guitar', 'sing', 'song', 'melody', 'quiet', 'peace', 'home'
]);

/**
 * Keywords in lyrics that indicate hype/aggressive/drill/trap themes.
 */
const HYPE_RAP_KEYWORDS = new Set([
  'drop', 'bitch', 'gun', 'trap', 'drill', 'shoot', 'kill', 'flex', 'cash', 'money',
  'glock', 'gang', 'opps', 'smoke', 'fire', 'bang', 'rage', 'riot', 'bass', 'crazy',
  'blast', 'bleed', 'die', 'murder', 'blood', 'slock', 'draco', 'chopper', 'switch'
]);

/**
 * Computes a SongMoodProfile from audio telemetry and/or lyrics.
 * If no audio file is provided, it analyzes lyric density, word length and keyword sentiment.
 */
export function computeSongMoodProfile(
  audioAnalysis?: AudioAnalysisResult | null,
  lyrics?: LyricLine[],
  songTitle: string = '',
  artist: string = ''
): SongMoodProfile {
  // 1. Analyze Audio Metrics
  const bpm = audioAnalysis?.bpm && audioAnalysis.bpm > 0 
    ? Math.round(audioAnalysis.bpm) 
    : 110; // Default sensible pop tempo
  
  let averageRms = 0.35;
  if (audioAnalysis?.frames && audioAnalysis.frames.length > 0) {
    const totalRms = audioAnalysis.frames.reduce((acc, f) => acc + f.rms, 0);
    averageRms = totalRms / audioAnalysis.frames.length;
  }

  // 2. Analyze Lyric Sentiment & Word Density
  let chillScore = 0;
  let hypeScore = 0;
  let totalWords = 0;
  let totalDurationMs = 0;

  if (lyrics && lyrics.length > 0) {
    for (const line of lyrics) {
      for (const w of line.words) {
        totalWords++;
        totalDurationMs += (w.endMs - w.startMs);
        const lower = w.word.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (CHILL_BALLAD_KEYWORDS.has(lower)) chillScore++;
        if (HYPE_RAP_KEYWORDS.has(lower)) hypeScore++;
      }
    }
  }

  const avgWordDuration = totalWords > 0 ? (totalDurationMs / totalWords) : 400;

  // 3. Compute normalized Energy Score [0..1]
  // Tempo contribution: 60 BPM -> 0.1, 96 BPM -> 0.42, 130 BPM -> 0.72, 160 BPM -> 0.95
  const tempoNorm = Math.min(1, Math.max(0, (bpm - 55) / (165 - 55)));
  // RMS contribution: 0.1 -> 0.15, 0.4 -> 0.55, 0.7 -> 0.95
  const rmsNorm = Math.min(1, Math.max(0, averageRms * 1.4));
  // Sentiment adjustment
  const sentimentDelta = (hypeScore - chillScore) * 0.05;

  const energyScore = Math.min(1, Math.max(0, 
    tempoNorm * 0.55 + rmsNorm * 0.35 + sentimentDelta + (avgWordDuration > 600 ? -0.1 : 0.05)
  ));

  // 4. Classify Vibe Category
  let vibe: SongVibe = 'chill_pop';

  if (bpm < 84 || (energyScore < 0.28 && bpm < 100)) {
    vibe = 'ballad_acoustic';
  } else if (bpm < 118 || energyScore < 0.48) {
    vibe = 'chill_pop';
  } else if (bpm <= 135 && energyScore < 0.72) {
    vibe = 'groove_dance';
  } else {
    vibe = 'hype_aggressive';
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
        crossfadeOverlapMs: 0
      };
  }
}
