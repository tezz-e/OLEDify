import { classifyLyricsWithOllama } from '../src/engine/kinetic/ollamaClassifier';
import { LyricLine } from '../src/engine/lyrics/types';
import { computeSongMoodProfile } from '../src/engine/kinetic/moodProfileEngine';
import { AudioAnalysisResult } from '../src/engine/kinetic/audioAnalysisEngine';

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

// Audio profile matching "52 Bars" (Heavy 808s, Drill/Trap, 95 BPM)
const dummyAudioAnalysis: AudioAnalysisResult = {
  bpm: 95,
  averageRms: 0.72,
  durationMs: 10400,
  peakRms: 0.95,
  frames: [],
  beats: [
    { timeMs: 0, confidence: 0.9, type: 'downbeat' },
    { timeMs: 630, confidence: 0.85, type: 'regular' },
    { timeMs: 1260, confidence: 0.9, type: 'regular' },
    { timeMs: 1890, confidence: 0.85, type: 'regular' },
    { timeMs: 2520, confidence: 0.95, type: 'downbeat' },
    { timeMs: 3150, confidence: 0.85, type: 'regular' },
    { timeMs: 3780, confidence: 0.9, type: 'regular' },
    { timeMs: 4410, confidence: 0.85, type: 'regular' },
    { timeMs: 5040, confidence: 0.95, type: 'downbeat' },
    { timeMs: 5670, confidence: 0.85, type: 'regular' },
    { timeMs: 6300, confidence: 0.9, type: 'regular' },
    { timeMs: 6930, confidence: 0.85, type: 'regular' },
    { timeMs: 7560, confidence: 0.95, type: 'downbeat' },
    { timeMs: 8190, confidence: 0.85, type: 'regular' },
    { timeMs: 8820, confidence: 0.9, type: 'regular' },
    { timeMs: 9450, confidence: 0.85, type: 'regular' },
    { timeMs: 10080, confidence: 0.95, type: 'downbeat' },
  ],
  rmsTimeline: []
};

async function main() {
  console.log('🎵 Computing Song Mood Profile...');
  const moodProfile = computeSongMoodProfile(dummyAudioAnalysis, testLines);
  console.log('Mood Profile Result:', {
    vibe: moodProfile.vibe,
    recommendedStylePack: moodProfile.recommendedStylePack,
    defaultArchetype: moodProfile.defaultArchetype,
    cameraShakeAllowed: moodProfile.cameraShakeAllowed,
    transitionPalette: moodProfile.transitionPalette,
    dwellDecayFactor: moodProfile.dwellDecayFactor
  });

  console.log('\n🤖 Sending to AI Director (Groq Cloud openai/gpt-oss-120b)...');
  let rawInspectionLog: any = null;

  const classification = await classifyLyricsWithOllama(testLines, {
    provider: 'groq',
    groqApiKey: GROQ_API_KEY,
    model: 'openai/gpt-oss-120b',
    songTitle: '52 Bars',
    artist: 'Karan Aujla',
    songProfile: moodProfile,
    onProgress: (p, msg) => console.log(`[${p}%] ${msg}`),
    onInspectionLog: (log) => {
      rawInspectionLog = log;
    }
  });

  console.log('\n✅ AI Classification Finished!');
  console.log('Detected Song Vibe from AI:', classification.detectedSongVibe);
  console.log('Detected Style Pack from AI:', classification.detectedStylePack);
  console.log('\nArchetype Overrides count:', Object.keys(classification.archetypes).length);
  console.log('Motif Overrides count:', Object.keys(classification.motifs).length);

  console.log('\n--- RAW LLM RESPONSE ---');
  console.log(rawInspectionLog?.rawResponse || '(none)');
}

main().catch(console.error);
