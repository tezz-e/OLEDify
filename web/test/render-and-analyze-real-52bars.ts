import fs from 'fs';
import { classifyLyricsWithOllama } from '../src/engine/kinetic/ollamaClassifier';
import { LyricLine } from '../src/engine/lyrics/types';
import { computeSongMoodProfile } from '../src/engine/kinetic/moodProfileEngine';
import { AudioAnalysisResult } from '../src/engine/kinetic/audioAnalysisEngine';
import { renderKineticSequence } from '../src/engine/kinetic/kineticEngine';

const GROQ_API_KEY = 'GROQ_API_KEY_PLACEHOLDER';

// ACTUAL 52 Bars (Karan Aujla, Prod. Ikky) Opening Verse
const actual52BarsLyrics: LyricLine[] = [
  {
    text: 'Vaade karke na kade eh zubaan mukkri',
    startMs: 0,
    endMs: 2500,
    words: [
      { word: 'Vaade', startMs: 0, endMs: 400 },
      { word: 'karke', startMs: 400, endMs: 800 },
      { word: 'na', startMs: 800, endMs: 1050 },
      { word: 'kade', startMs: 1050, endMs: 1400 },
      { word: 'eh', startMs: 1400, endMs: 1600 },
      { word: 'zubaan', startMs: 1600, endMs: 2050 },
      { word: 'mukkri', startMs: 2050, endMs: 2500 }
    ]
  },
  {
    text: 'Jehde fukkre ne muhron ohna de layi fukkri',
    startMs: 2650,
    endMs: 5150,
    words: [
      { word: 'Jehde', startMs: 2650, endMs: 3000 },
      { word: 'fukkre', startMs: 3000, endMs: 3450 },
      { word: 'ne', startMs: 3450, endMs: 3650 },
      { word: 'muhron', startMs: 3650, endMs: 4100 },
      { word: 'ohna', startMs: 4100, endMs: 4400 },
      { word: 'de', startMs: 4400, endMs: 4550 },
      { word: 'layi', startMs: 4550, endMs: 4750 },
      { word: 'fukkri', startMs: 4750, endMs: 5150 }
    ]
  },
  {
    text: 'Hunn mitran nu shonk haini race-an laun da',
    startMs: 5300,
    endMs: 7800,
    words: [
      { word: 'Hunn', startMs: 5300, endMs: 5600 },
      { word: 'mitran', startMs: 5600, endMs: 6050 },
      { word: 'nu', startMs: 6050, endMs: 6250 },
      { word: 'shonk', startMs: 6250, endMs: 6650 },
      { word: 'haini', startMs: 6650, endMs: 7000 },
      { word: 'race-an', startMs: 7000, endMs: 7400 },
      { word: 'laun', startMs: 7400, endMs: 7600 },
      { word: 'da', startMs: 7600, endMs: 7800 }
    ]
  },
  {
    text: 'Ni meri khinch la lagaam mainu akhe nukkri',
    startMs: 7950,
    endMs: 10450,
    words: [
      { word: 'Ni', startMs: 7950, endMs: 8150 },
      { word: 'meri', startMs: 8150, endMs: 8450 },
      { word: 'khinch', startMs: 8450, endMs: 8850 },
      { word: 'la', startMs: 8850, endMs: 9050 },
      { word: 'lagaam', startMs: 9050, endMs: 9550 },
      { word: 'mainu', startMs: 9550, endMs: 9850 },
      { word: 'akhe', startMs: 9850, endMs: 10100 },
      { word: 'nukkri', startMs: 10100, endMs: 10450 }
    ]
  }
];

const beatsMs = [0, 630, 1260, 1890, 2520, 3150, 3780, 4410, 5040, 5670, 6300, 6930, 7560, 8190, 8820, 9450, 10080];
const frameCount = Math.ceil(10450 / (1000 / 30));
const mockFrames = Array.from({ length: frameCount }, (_, i) => {
  const timeMs = Math.round(i * (1000 / 30));
  const isBeat = beatsMs.some(b => Math.abs(b - timeMs) <= 33);
  return {
    timeMs,
    rms: isBeat ? 0.88 : 0.65,
    bass: isBeat ? 0.94 : 0.52,
    flux: isBeat ? 0.82 : 0.32,
    isBeat,
    onsetStrength: isBeat ? 0.95 : 0.1
  };
});

const dummyAudioAnalysis: AudioAnalysisResult = {
  bpm: 95,
  averageRms: 0.74,
  durationMs: 10450,
  peakRms: 0.98,
  sampleRate: 44100,
  beatsMs,
  frames: mockFrames,
  waveform: Array.from({ length: 1000 }, () => ({ min: -0.85, max: 0.85 })),
  getFrameAtTime: (timeMs: number) => {
    const idx = Math.min(mockFrames.length - 1, Math.max(0, Math.floor((timeMs / 10450) * mockFrames.length)));
    return mockFrames[idx];
  },
  snapToNearestBeat: (timeMs: number, maxToleranceMs = 120) => {
    let closest = timeMs;
    let minDiff = Infinity;
    for (const b of beatsMs) {
      const diff = Math.abs(b - timeMs);
      if (diff < minDiff) {
        minDiff = diff;
        closest = b;
      }
    }
    return minDiff <= maxToleranceMs ? closest : timeMs;
  }
};

async function main() {
  console.log('🎵 Computing Song Mood Profile on REAL 52 Bars...');
  const moodProfile = computeSongMoodProfile(dummyAudioAnalysis, actual52BarsLyrics, '52 Bars', 'Karan Aujla');

  console.log('\n🤖 Running Groq Cloud LLM AI Director (openai/gpt-oss-120b)...');
  let rawInspectionLog: any = null;

  const classification = await classifyLyricsWithOllama(actual52BarsLyrics, {
    provider: 'groq',
    groqApiKey: GROQ_API_KEY,
    model: 'openai/gpt-oss-120b',
    songTitle: '52 Bars',
    artist: 'Karan Aujla',
    songProfile: moodProfile,
    onInspectionLog: (log) => { rawInspectionLog = log; }
  });

  console.log('\n=== REAL 52 BARS LLM RESPONSE ===');
  console.log(rawInspectionLog?.rawResponse);

  const effectiveVibe = classification.songVibe || 'hype_aggressive';
  const effectivePack = classification.recommendedStylePack || 'trap_drill';

  console.log('\n=== RENDERING 30 FPS KINETIC SEQUENCE ===');
  const renderedSeq = await renderKineticSequence({
    lyrics: actual52BarsLyrics,
    startMs: 0,
    endMs: 10450,
    targetFps: 30,
    archetype: 'auto_semantic',
    wordOverrides: classification.archetypes,
    wordMotifOverrides: classification.motifs,
    transitionStyle: 'auto',
    vibe: effectiveVibe,
    stylePack: effectivePack,
    audioAnalysis: dummyAudioAnalysis
  });

  console.log(`Rendered ${renderedSeq.frames.length} frames successfully.`);

  fs.writeFileSync('test/eval-real-52bars-output.json', JSON.stringify({
    song: '52 Bars - Karan Aujla (Real Lyrics)',
    vibe: effectiveVibe,
    pack: effectivePack,
    rawLog: rawInspectionLog
  }, null, 2));
}

main().catch(console.error);
