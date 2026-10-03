import fs from 'fs';
import path from 'path';
import { classifyLyricsWithOllama } from '../src/engine/kinetic/ollamaClassifier';
import { LyricLine } from '../src/engine/lyrics/types';
import { computeSongMoodProfile } from '../src/engine/kinetic/moodProfileEngine';
import { AudioAnalysisResult } from '../src/engine/kinetic/audioAnalysisEngine';
import { renderKineticSequence } from '../src/engine/kinetic/kineticEngine';
import { ARCHETYPE_METADATA, MOTIF_METADATA, TEXT_DRESSING_METADATA } from '../src/engine/kinetic/types';

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

const testLines: LyricLine[] = [
  {
    text: 'Pehli vaari boleya te laggeya si rokeya',
    startMs: 0,
    endMs: 2400,
    words: [
      { word: 'Pehli', startMs: 0, endMs: 350 },
      { word: 'vaari', startMs: 350, endMs: 700 },
      { word: 'boleya', startMs: 700, endMs: 1100 },
      { word: 'te', startMs: 1100, endMs: 1300 },
      { word: 'laggeya', startMs: 1300, endMs: 1700 },
      { word: 'si', startMs: 1700, endMs: 1900 },
      { word: 'rokeya', startMs: 1900, endMs: 2400 }
    ]
  },
  {
    text: 'Dooji vaari boleya te laggeya si tokeya',
    startMs: 2600,
    endMs: 5000,
    words: [
      { word: 'Dooji', startMs: 2600, endMs: 2950 },
      { word: 'vaari', startMs: 2950, endMs: 3300 },
      { word: 'boleya', startMs: 3300, endMs: 3700 },
      { word: 'te', startMs: 3700, endMs: 3900 },
      { word: 'laggeya', startMs: 3900, endMs: 4300 },
      { word: 'si', startMs: 4300, endMs: 4500 },
      { word: 'tokeya', startMs: 4500, endMs: 5000 }
    ]
  },
  {
    text: 'Teeji vaari boleya te khadka hi karta',
    startMs: 5200,
    endMs: 7600,
    words: [
      { word: 'Teeji', startMs: 5200, endMs: 5550 },
      { word: 'vaari', startMs: 5550, endMs: 5900 },
      { word: 'boleya', startMs: 5900, endMs: 6300 },
      { word: 'te', startMs: 6300, endMs: 6500 },
      { word: 'khadka', startMs: 6500, endMs: 6900 },
      { word: 'hi', startMs: 6900, endMs: 7100 },
      { word: 'karta', startMs: 7100, endMs: 7600 }
    ]
  },
  {
    text: 'Khoon aale chitteyan na parcha hi bharta',
    startMs: 7800,
    endMs: 10400,
    words: [
      { word: 'Khoon', startMs: 7800, endMs: 8200 },
      { word: 'aale', startMs: 8200, endMs: 8550 },
      { word: 'chitteyan', startMs: 8550, endMs: 9100 },
      { word: 'na', startMs: 9100, endMs: 9300 },
      { word: 'parcha', startMs: 9300, endMs: 9750 },
      { word: 'hi', startMs: 9750, endMs: 9950 },
      { word: 'bharta', startMs: 9950, endMs: 10400 }
    ]
  }
];

const beatsMs = [0, 630, 1260, 1890, 2520, 3150, 3780, 4410, 5040, 5670, 6300, 6930, 7560, 8190, 8820, 9450, 10080];
const frameCount = Math.ceil(10400 / (1000 / 30));
const mockFrames = Array.from({ length: frameCount }, (_, i) => {
  const timeMs = Math.round(i * (1000 / 30));
  const isBeat = beatsMs.some(b => Math.abs(b - timeMs) <= 33);
  return {
    timeMs,
    rms: isBeat ? 0.88 : 0.65,
    bass: isBeat ? 0.92 : 0.50,
    flux: isBeat ? 0.80 : 0.30,
    isBeat,
    onsetStrength: isBeat ? 0.95 : 0.1
  };
});

const dummyAudioAnalysis: AudioAnalysisResult = {
  bpm: 95,
  averageRms: 0.72,
  durationMs: 10400,
  peakRms: 0.95,
  sampleRate: 44100,
  beatsMs,
  frames: mockFrames,
  waveform: Array.from({ length: 1000 }, () => ({ min: -0.8, max: 0.8 })),
  getFrameAtTime: (timeMs: number) => {
    const idx = Math.min(mockFrames.length - 1, Math.max(0, Math.floor((timeMs / 10400) * mockFrames.length)));
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

async function run() {
  console.log('=== STEP 1: Song Mood Profile Analysis ===');
  const moodProfile = computeSongMoodProfile(dummyAudioAnalysis, testLines, '52 Bars', 'Karan Aujla');
  console.log({
    vibe: moodProfile.vibe,
    recommendedStylePack: moodProfile.recommendedStylePack,
    defaultArchetype: moodProfile.defaultArchetype
  });

  console.log('\n=== STEP 2: Groq Cloud LLM AI Director (openai/gpt-oss-120b) ===');
  let rawInspectionLog: any = null;

  const classification = await classifyLyricsWithOllama(testLines, {
    provider: 'groq',
    groqApiKey: GROQ_API_KEY,
    model: 'openai/gpt-oss-120b',
    songTitle: '52 Bars',
    artist: 'Karan Aujla',
    songProfile: moodProfile,
    onInspectionLog: (log) => { rawInspectionLog = log; }
  });

  console.log('Classified Words Count:', rawInspectionLog?.parsedClassifications?.length || 0);
  console.log('Detected Song Vibe from AI:', classification.songVibe);
  console.log('Detected Style Pack from AI:', classification.recommendedStylePack);

  console.log('\n=== STEP 3: Kinetic Sequence 30 FPS Frame Rendering ===');
  const effectiveVibe = classification.songVibe || 'hype_aggressive';
  const effectivePack = classification.recommendedStylePack || 'trap_drill';

  const renderedSeq = await renderKineticSequence({
    lyrics: testLines,
    startMs: 0,
    endMs: 10400,
    targetFps: 30,
    archetype: 'auto_semantic',
    wordOverrides: classification.archetypes,
    wordMotifOverrides: classification.motifs,
    transitionStyle: 'auto',
    vibe: effectiveVibe,
    stylePack: effectivePack,
    audioAnalysis: dummyAudioAnalysis
  });

  console.log(`Rendered ${renderedSeq.frames.length} frames (${(renderedSeq.frames.length / renderedSeq.fps).toFixed(2)}s).`);

  // Analyze word-level classifications
  const wordSummary: Array<{
    word: string;
    line: number;
    startMs: number;
    endMs: number;
    archetype: string;
    motif: string;
    meaning?: string;
    reason?: string;
  }> = [];

  testLines.forEach((line, lineIdx) => {
    line.words.forEach(w => {
      const specificKey = `${w.word}_${w.startMs}`;
      const lower = w.word.toLowerCase();
      const arch = classification.archetypes[specificKey] || classification.archetypes[lower] || classification.archetypes[w.word] || 'auto_semantic';
      const motif = classification.motifs[specificKey] || classification.motifs[lower] || classification.motifs[w.word] || 'none';
      const parsedItem = rawInspectionLog?.parsedClassifications?.find((c: any) => c.word.toLowerCase() === lower);
      wordSummary.push({
        word: w.word,
        line: lineIdx + 1,
        startMs: w.startMs,
        endMs: w.endMs,
        archetype: arch,
        motif: motif,
        meaning: parsedItem?.meaning,
        reason: parsedItem?.reason
      });
    });
  });

  console.log('\n=== WORD DIRECTORY SUMMARY ===');
  console.table(wordSummary.map(w => ({
    Word: w.word,
    Time: `${w.startMs}-${w.endMs}ms`,
    Archetype: w.archetype,
    Motif: w.motif,
    Meaning: w.meaning || '-',
    Reason: w.reason ? (w.reason.slice(0, 45) + '...') : '-'
  })));

  // Output json summary for report
  fs.writeFileSync('test/eval-52bars-output.json', JSON.stringify({
    song: '52 Bars - Karan Aujla',
    vibe: classification.songVibe || moodProfile.vibe,
    pack: classification.recommendedStylePack || moodProfile.recommendedStylePack,
    totalFrames: renderedSeq.frames.length,
    wordSummary,
    rawLog: rawInspectionLog
  }, null, 2));

  console.log('\nSaved evaluation metrics to test/eval-52bars-output.json');
}

run().catch(console.error);
