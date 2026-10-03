import fs from 'fs';
import { classifyLyricsWithOllama } from '../src/engine/kinetic/ollamaClassifier';
import { LyricLine } from '../src/engine/lyrics/types';
import { computeSongMoodProfile } from '../src/engine/kinetic/moodProfileEngine';
import { AudioAnalysisResult } from '../src/engine/kinetic/audioAnalysisEngine';
import { renderKineticSequence } from '../src/engine/kinetic/kineticEngine';

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

// "Beauty and a Beat" - Justin Bieber ft. Nicki Minaj (Prod. Max Martin & Zedd)
// Tempo: 128 BPM (1 beat = ~468.75ms, 4-on-the-floor kick)
const beautyBeatLyrics: LyricLine[] = [
  {
    text: "'Cause all I need is a beauty and a beat",
    startMs: 0,
    endMs: 2800,
    words: [
      { word: "'Cause", startMs: 0, endMs: 250 },
      { word: "all", startMs: 250, endMs: 500 },
      { word: "I", startMs: 500, endMs: 700 },
      { word: "need", startMs: 700, endMs: 1100 },
      { word: "is", startMs: 1100, endMs: 1300 },
      { word: "a", startMs: 1300, endMs: 1450 },
      { word: "beauty", startMs: 1450, endMs: 2000 },
      { word: "and", startMs: 2000, endMs: 2200 },
      { word: "a", startMs: 2200, endMs: 2350 },
      { word: "beat", startMs: 2350, endMs: 2800 }
    ]
  },
  {
    text: "Who can make my life complete",
    startMs: 2900,
    endMs: 5400,
    words: [
      { word: "Who", startMs: 2900, endMs: 3200 },
      { word: "can", startMs: 3200, endMs: 3450 },
      { word: "make", startMs: 3450, endMs: 3800 },
      { word: "my", startMs: 3800, endMs: 4050 },
      { word: "life", startMs: 4050, endMs: 4600 },
      { word: "complete", startMs: 4600, endMs: 5400 }
    ]
  },
  {
    text: "It's all 'bout you when the music makes you move",
    startMs: 5600,
    endMs: 8400,
    words: [
      { word: "It's", startMs: 5600, endMs: 5850 },
      { word: "all", startMs: 5850, endMs: 6100 },
      { word: "'bout", startMs: 6100, endMs: 6400 },
      { word: "you", startMs: 6400, endMs: 6800 },
      { word: "when", startMs: 6800, endMs: 7050 },
      { word: "the", startMs: 7050, endMs: 7200 },
      { word: "music", startMs: 7200, endMs: 7650 },
      { word: "makes", startMs: 7650, endMs: 7950 },
      { word: "you", startMs: 7950, endMs: 8150 },
      { word: "move", startMs: 8150, endMs: 8400 }
    ]
  },
  {
    text: "Body rock girl I wanna see your body rock",
    startMs: 8550,
    endMs: 11200,
    words: [
      { word: "Body", startMs: 8550, endMs: 8900 },
      { word: "rock", startMs: 8900, endMs: 9350 },
      { word: "girl", startMs: 9350, endMs: 9650 },
      { word: "I", startMs: 9650, endMs: 9800 },
      { word: "wanna", startMs: 9800, endMs: 10050 },
      { word: "see", startMs: 10050, endMs: 10300 },
      { word: "your", startMs: 10300, endMs: 10500 },
      { word: "body", startMs: 10500, endMs: 10800 },
      { word: "rock", startMs: 10800, endMs: 11200 }
    ]
  }
];

// 128 BPM Four-on-the-Floor EDM telemetry
// 1 beat = 60000 / 128 = 468.75ms
const DURATION_MS = 11200;
const beatIntervalMs = 60000 / 128;
const beatsMs: number[] = [];
for (let b = 0; b <= DURATION_MS; b += beatIntervalMs) {
  beatsMs.push(Math.round(b));
}

const frameCount = Math.ceil(DURATION_MS / (1000 / 30));
const mockFrames = Array.from({ length: frameCount }, (_, i) => {
  const timeMs = Math.round(i * (1000 / 30));
  const isBeat = beatsMs.some(b => Math.abs(b - timeMs) <= 25);
  return {
    timeMs,
    rms: isBeat ? 0.65 : 0.40,
    bass: isBeat ? 0.75 : 0.30,
    flux: isBeat ? 0.60 : 0.20,
    isBeat,
    onsetStrength: isBeat ? 0.85 : 0.1
  };
});

const audioAnalysis128BPM: AudioAnalysisResult = {
  bpm: 128,
  averageRms: 0.46,
  durationMs: DURATION_MS,
  peakRms: 0.80,
  sampleRate: 44100,
  beatsMs,
  frames: mockFrames,
  waveform: Array.from({ length: 1000 }, () => ({ min: -0.9, max: 0.9 })),
  getFrameAtTime: (timeMs: number) => {
    const idx = Math.min(mockFrames.length - 1, Math.max(0, Math.floor((timeMs / DURATION_MS) * mockFrames.length)));
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
  console.log('🎵 Computing Song Mood Profile for "Beauty and a Beat" (128 BPM)...');
  const moodProfile = computeSongMoodProfile(audioAnalysis128BPM, beautyBeatLyrics, 'Beauty and a Beat', 'Justin Bieber');
  console.log('Mood Profile:', {
    vibe: moodProfile.vibe,
    recommendedStylePack: moodProfile.recommendedStylePack,
    defaultArchetype: moodProfile.defaultArchetype,
    cameraShakeAllowed: moodProfile.cameraShakeAllowed,
    dwellDecayFactor: moodProfile.dwellDecayFactor
  });

  console.log('\n🤖 Running Groq Cloud LLM AI Director (openai/gpt-oss-120b)...');
  let rawInspectionLog: any = null;

  const classification = await classifyLyricsWithOllama(beautyBeatLyrics, {
    provider: 'groq',
    groqApiKey: GROQ_API_KEY,
    model: 'openai/gpt-oss-120b',
    songTitle: 'Beauty and a Beat',
    artist: 'Justin Bieber ft. Nicki Minaj',
    songProfile: moodProfile,
    onInspectionLog: (log) => { rawInspectionLog = log; }
  });

  console.log('\n=== LLM CLASSIFICATION RESULT ===');
  console.log('Song Vibe from AI:', classification.songVibe);
  console.log('Style Pack from AI:', classification.recommendedStylePack);
  console.log(rawInspectionLog?.rawResponse);

  const effectiveVibe = classification.songVibe || moodProfile.vibe;
  const effectivePack = classification.recommendedStylePack || moodProfile.recommendedStylePack;

  console.log(`\n=== RENDERING 30 FPS KINETIC SEQUENCE (${effectiveVibe} / ${effectivePack}) ===`);
  const renderedSeq = await renderKineticSequence({
    lyrics: beautyBeatLyrics,
    startMs: 0,
    endMs: DURATION_MS,
    targetFps: 30,
    archetype: 'auto_semantic',
    wordOverrides: classification.archetypes,
    wordMotifOverrides: classification.motifs,
    transitionStyle: 'auto',
    vibe: effectiveVibe,
    stylePack: effectivePack,
    audioAnalysis: audioAnalysis128BPM
  });

  console.log(`✅ Rendered ${renderedSeq.frames.length} frames (${(renderedSeq.frames.length / renderedSeq.fps).toFixed(2)}s).`);

  // Build detailed word analysis list
  const wordSummary: any[] = [];
  beautyBeatLyrics.forEach((line, lIdx) => {
    line.words.forEach(w => {
      const specificKey = `${w.word}_${w.startMs}`;
      const lower = w.word.toLowerCase();
      const arch = classification.archetypes[specificKey] || classification.archetypes[lower] || classification.archetypes[w.word] || 'auto_semantic';
      const motif = classification.motifs[specificKey] || classification.motifs[lower] || classification.motifs[w.word] || 'none';
      const parsedItem = rawInspectionLog?.parsedClassifications?.find((c: any) => c.word.toLowerCase() === lower);
      wordSummary.push({
        word: w.word,
        line: lIdx + 1,
        startMs: w.startMs,
        endMs: w.endMs,
        durationMs: w.endMs - w.startMs,
        archetype: arch,
        motif: motif,
        meaning: parsedItem?.meaning,
        reason: parsedItem?.reason
      });
    });
  });

  fs.writeFileSync('test/eval-beauty-and-a-beat.json', JSON.stringify({
    song: 'Beauty and a Beat - Justin Bieber ft. Nicki Minaj',
    bpm: 128,
    vibe: effectiveVibe,
    stylePack: effectivePack,
    moodProfile,
    totalFrames: renderedSeq.frames.length,
    wordSummary,
    rawLog: rawInspectionLog
  }, null, 2));

  console.log('\nResults saved to test/eval-beauty-and-a-beat.json');
}

main().catch(console.error);
