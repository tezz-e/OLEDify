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
 * Computes a SongMoodProfile from audio telemetry, lyric pacing, or an explicit AI director vibe.
 * Does not rely on hardcoded artist names or ethnic vocabularies; the LLM director
 * performs deep multilingual lyric understanding when invoked.
 */
export function computeSongMoodProfile(
  audioAnalysis?: AudioAnalysisResult | null,
  lyrics?: LyricLine[],
  songTitle: string = '',
  artist: string = '',
  overrideVibe?: SongVibe
): SongMoodProfile {
  const hasAudio = !!(audioAnalysis?.bpm && audioAnalysis.bpm > 0);

  // 1. Analyze Audio Metrics
  let bpm = hasAudio ? Math.round(audioAnalysis!.bpm) : 115;
  
  let averageRms = 0.35;
  if (audioAnalysis?.frames && audioAnalysis.frames.length > 0) {
    const totalRms = audioAnalysis.frames.reduce((acc, f) => acc + f.rms, 0);
    averageRms = totalRms / audioAnalysis.frames.length;
  } else if (audioAnalysis?.averageRms) {
    averageRms = audioAnalysis.averageRms;
  }

  // 2. Physical Lyric Delivery Pacing (duration per word)
  let totalWords = 0;
  let totalDurationMs = 0;

  if (lyrics && lyrics.length > 0) {
    for (const line of lyrics) {
      for (const w of line.words) {
        totalWords++;
        totalDurationMs += (w.endMs - w.startMs);
      }
    }
  }

  const avgWordDuration = totalWords > 0 ? (totalDurationMs / totalWords) : 400;

  // 3. Compute normalized Energy Score [0..1]
  const tempoNorm = Math.min(1, Math.max(0, (bpm - 55) / (165 - 55)));
  const rmsNorm = Math.min(1, Math.max(0, averageRms * 1.4));
  // Pacing: Rapid syllable delivery (< 310ms/word) indicates fast flow, > 580ms indicates slow held vocals
  const pacingDelta = (avgWordDuration < 310 && totalWords >= 6) ? 0.12 : (avgWordDuration > 580 && totalWords >= 4 ? -0.12 : 0);

  const energyScore = Math.min(1, Math.max(0, 
    (hasAudio ? (tempoNorm * 0.55 + rmsNorm * 0.45) : 0.50) + 
    pacingDelta
  ));

  // 4. Classify Vibe Category
  let vibe: SongVibe = 'groove_dance';

  if (overrideVibe) {
    vibe = overrideVibe;
  } else if (hasAudio) {
    // Pure physical sound wave metrics
    if (bpm < 84 || (bpm < 92 && energyScore < 0.28)) {
      vibe = 'ballad_acoustic';
    } else if ((bpm >= 128 && energyScore >= 0.58) || (bpm >= 80 && bpm <= 108 && energyScore >= 0.50)) {
      vibe = 'hype_aggressive'; // Uptempo hype OR Halftime Drill/Trap/Boom-Bap with heavy 808s
    } else if (bpm >= 115 || energyScore >= 0.42) {
      vibe = 'groove_dance';
    } else {
      vibe = 'chill_pop';
    }
  } else {
    // Audio telemetry absent: infer from physical lyric pacing or provide balanced versatile default
    if (avgWordDuration < 310 && totalWords >= 6) {
      vibe = 'hype_aggressive'; // Rapid rap/drill flow pacing
      bpm = 135;
    } else if (avgWordDuration > 580 && totalWords >= 4) {
      vibe = 'ballad_acoustic'; // Slow vocal drawl
      bpm = 75;
    } else {
      vibe = 'groove_dance'; // Balanced, versatile kinetic default
      bpm = 115;
    }
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
