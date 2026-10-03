import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { classifyLyricsWithOllama } from '../src/engine/kinetic/ollamaClassifier';
import { LyricLine, LyricWord } from '../src/engine/lyrics/types';
import { computeSongMoodProfile } from '../src/engine/kinetic/moodProfileEngine';
import { AudioAnalysisResult, AudioFrameData } from '../src/engine/kinetic/audioAnalysisEngine';
import { renderKineticSequence } from '../src/engine/kinetic/kineticEngine';

const DEFAULT_GROQ_API_KEY = process.env.GROQ_API_KEY || '';

// Preset Song Catalogs with word-level timestamps
const PRESETS: Record<string, { song: string; artist: string; bpm: number; lines: LyricLine[] }> = {
  '52bars': {
    song: '52 Bars',
    artist: 'Karan Aujla',
    bpm: 95,
    lines: [
      {
        text: 'Boleya kyunki chup baitha dekhda',
        startMs: 0,
        endMs: 2400,
        words: [
          { word: 'Boleya', startMs: 0, endMs: 400 },
          { word: 'kyunki', startMs: 400, endMs: 800 },
          { word: 'chup', startMs: 800, endMs: 1200 },
          { word: 'baitha', startMs: 1200, endMs: 1700 },
          { word: 'dekhda', startMs: 1700, endMs: 2400 }
        ]
      },
      {
        text: "Zameer'an kidan ruldiyan rahiyan ne",
        startMs: 2600,
        endMs: 5000,
        words: [
          { word: "Zameer'an", startMs: 2600, endMs: 3200 },
          { word: 'kidan', startMs: 3200, endMs: 3700 },
          { word: 'ruldiyan', startMs: 3700, endMs: 4300 },
          { word: 'rahiyan', startMs: 4300, endMs: 4700 },
          { word: 'ne', startMs: 4700, endMs: 5000 }
        ]
      },
      {
        text: 'Rakhe kade kade patshah vi chup',
        startMs: 5200,
        endMs: 7600,
        words: [
          { word: 'Rakhe', startMs: 5200, endMs: 5600 },
          { word: 'kade', startMs: 5600, endMs: 6000 },
          { word: 'kade', startMs: 6000, endMs: 6400 },
          { word: 'patshah', startMs: 6400, endMs: 7000 },
          { word: 'vi', startMs: 7000, endMs: 7200 },
          { word: 'chup', startMs: 7200, endMs: 7600 }
        ]
      },
      {
        text: 'Te kade kade raniyan vi rulldiyan ne',
        startMs: 7800,
        endMs: 10400,
        words: [
          { word: 'Te', startMs: 7800, endMs: 8000 },
          { word: 'kade', startMs: 8000, endMs: 8400 },
          { word: 'kade', startMs: 8400, endMs: 8800 },
          { word: 'raniyan', startMs: 8800, endMs: 9400 },
          { word: 'vi', startMs: 9400, endMs: 9700 },
          { word: 'rulldiyan', startMs: 9700, endMs: 10100 },
          { word: 'ne', startMs: 10100, endMs: 10400 }
        ]
      }
    ]
  },
  'shape_of_you': {
    song: 'Shape of You',
    artist: 'Ed Sheeran',
    bpm: 96,
    lines: [
      {
        text: 'The club isn\'t the best place to find a lover',
        startMs: 0,
        endMs: 2400,
        words: [
          { word: 'The', startMs: 0, endMs: 200 },
          { word: 'club', startMs: 200, endMs: 500 },
          { word: 'isn\'t', startMs: 500, endMs: 800 },
          { word: 'the', startMs: 800, endMs: 1000 },
          { word: 'best', startMs: 1000, endMs: 1400 },
          { word: 'place', startMs: 1400, endMs: 1700 },
          { word: 'to', startMs: 1700, endMs: 1850 },
          { word: 'find', startMs: 1850, endMs: 2100 },
          { word: 'a', startMs: 2100, endMs: 2200 },
          { word: 'lover', startMs: 2200, endMs: 2400 }
        ]
      },
      {
        text: 'So the bar is where I go',
        startMs: 2600,
        endMs: 4800,
        words: [
          { word: 'So', startMs: 2600, endMs: 2800 },
          { word: 'the', startMs: 2800, endMs: 3000 },
          { word: 'bar', startMs: 3000, endMs: 3400 },
          { word: 'is', startMs: 3400, endMs: 3600 },
          { word: 'where', startMs: 3600, endMs: 4000 },
          { word: 'I', startMs: 4000, endMs: 4300 },
          { word: 'go', startMs: 4300, endMs: 4800 }
        ]
      },
      {
        text: 'Me and my friends at the table doing shots',
        startMs: 5000,
        endMs: 7600,
        words: [
          { word: 'Me', startMs: 5000, endMs: 5200 },
          { word: 'and', startMs: 5200, endMs: 5400 },
          { word: 'my', startMs: 5400, endMs: 5600 },
          { word: 'friends', startMs: 5600, endMs: 6100 },
          { word: 'at', startMs: 6100, endMs: 6300 },
          { word: 'the', startMs: 6300, endMs: 6500 },
          { word: 'table', startMs: 6500, endMs: 6900 },
          { word: 'doing', startMs: 6900, endMs: 7200 },
          { word: 'shots', startMs: 7200, endMs: 7600 }
        ]
      }
    ]
  }
};

function parseArgs() {
  const args = process.argv.slice(2);
  const options: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        options[key] = next;
        i++;
      } else {
        options[key] = 'true';
      }
    }
  }
  return options;
}

function parseSimpleLyrics(rawText: string, bpm = 100): LyricLine[] {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const msPerBeat = (60 / bpm) * 1000;
  let curTime = 0;

  return lines.map((lineText) => {
    const rawWords = lineText.split(/\s+/).filter(Boolean);
    const lineStart = curTime;
    const words: LyricWord[] = [];

    rawWords.forEach((w) => {
      const wordLen = Math.max(1, w.length);
      const durationMs = Math.round(Math.max(220, Math.min(700, wordLen * 75 + msPerBeat * 0.4)));
      const wStart = curTime;
      const wEnd = curTime + durationMs;
      words.push({ word: w, startMs: wStart, endMs: wEnd });
      curTime = wEnd + 40; // slight gap
    });

    const lineEnd = curTime;
    curTime += 400; // breath between lines

    return {
      text: lineText,
      startMs: lineStart,
      endMs: lineEnd,
      words
    };
  });
}

function generateMockAudioAnalysis(lines: LyricLine[], bpm = 95): AudioAnalysisResult {
  const totalMs = lines.length > 0 ? lines[lines.length - 1].endMs + 800 : 10000;
  const msPerBeat = (60 / bpm) * 1000;
  const beatsMs: number[] = [];
  for (let t = 0; t <= totalMs; t += msPerBeat) {
    beatsMs.push(Math.round(t));
  }

  const frameCount = Math.ceil(totalMs / (1000 / 30));
  const frames: AudioFrameData[] = Array.from({ length: frameCount }, (_, i) => {
    const timeMs = Math.round(i * (1000 / 30));
    const isBeat = beatsMs.some(b => Math.abs(b - timeMs) <= 33);
    return {
      timeMs,
      rms: isBeat ? 0.85 : 0.60,
      bass: isBeat ? 0.90 : 0.45,
      flux: isBeat ? 0.75 : 0.25,
      isBeat,
      onsetStrength: isBeat ? 0.95 : 0.10
    };
  });

  return {
    bpm,
    averageRms: 0.68,
    durationMs: totalMs,
    peakRms: 0.95,
    sampleRate: 44100,
    beatsMs,
    frames,
    waveform: Array.from({ length: 1000 }, () => ({ min: -0.7, max: 0.7 })),
    getFrameAtTime: (timeMs: number) => {
      const idx = Math.min(frames.length - 1, Math.max(0, Math.floor((timeMs / totalMs) * frames.length)));
      return frames[idx];
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
}

async function main() {
  const opts = parseArgs();

  // 1. Resolve Song, Artist, BPM, and Lyrics
  const presetKey = opts.preset || (opts.song && opts.song.toLowerCase().includes('shape') ? 'shape_of_you' : '52bars');
  const preset = PRESETS[presetKey];

  const songTitle = opts.song || preset?.song || '52 Bars';
  const artist = opts.artist || preset?.artist || 'Karan Aujla';
  const bpm = opts.bpm ? parseInt(opts.bpm, 10) : (preset?.bpm || 95);

  let lyricLines: LyricLine[];
  if (opts.lyrics) {
    if (fs.existsSync(opts.lyrics)) {
      const fileContent = fs.readFileSync(opts.lyrics, 'utf8');
      lyricLines = parseSimpleLyrics(fileContent, bpm);
    } else {
      lyricLines = parseSimpleLyrics(opts.lyrics, bpm);
    }
  } else if (preset) {
    lyricLines = preset.lines;
  } else {
    lyricLines = parseSimpleLyrics(
      `Pehli vaari boleya te laggeya si rokeya\nDooji vaari boleya te laggeya si tokeya\nTeeji vaari boleya te khadka hi karta\nKhoon aale chitteyan na parcha hi bharta`,
      bpm
    );
  }

  const outPath = path.resolve(opts.out || `output_${songTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.webm`);
  const apiKey = opts.groqKey || process.env.GROQ_API_KEY || DEFAULT_GROQ_API_KEY;

  console.log('================================================================');
  console.log(`🎬 KINETIC TYPOGRAPHY AI DIRECTOR & WEBM RECORDER`);
  console.log(`🎵 Song:   "${songTitle}" by ${artist} (${bpm} BPM)`);
  console.log(`📝 Lines:  ${lyricLines.length} lines (${lyricLines.reduce((s, l) => s + l.words.length, 0)} words)`);
  console.log(`🎯 Output: ${outPath}`);
  console.log('================================================================\n');

  // 2. Synthesize Audio Analysis
  const audioAnalysis = generateMockAudioAnalysis(lyricLines, bpm);

  // 3. Compute Song Mood Profile
  console.log('⚡ [1/4] Deriving Song Mood Profile & Kinetic Physics Profile...');
  const moodProfile = computeSongMoodProfile(audioAnalysis, lyricLines, songTitle, artist);
  console.log(`   -> Detected Vibe:  ${moodProfile.vibe.toUpperCase()}`);
  console.log(`   -> Style Pack:     ${moodProfile.recommendedStylePack}`);
  console.log(`   -> Default Motion: ${moodProfile.defaultArchetype}`);
  console.log(`   -> Hold Scaling:   ${moodProfile.holdFactor}x`);
  console.log(`   -> Max Offset:     ${moodProfile.maxEntryDisplacementPx}px\n`);

  // 4. Run AI Director (Groq 120B / Ollama)
  console.log('🤖 [2/4] Calling Groq Cloud AI Director (openai/gpt-oss-120b)...');
  let inspectionLog: any = null;
  const classification = await classifyLyricsWithOllama(lyricLines, {
    provider: 'groq',
    groqApiKey: apiKey,
    model: 'openai/gpt-oss-120b',
    songTitle,
    artist,
    songProfile: moodProfile,
    onInspectionLog: (log) => { inspectionLog = log; }
  });

  const classifiedCount = inspectionLog?.parsedClassifications?.length || 0;
  console.log(`   -> Successfully classified ${classifiedCount} key punchlines and accents.`);
  console.log(`   -> AI Recommended Vibe:  ${classification.songVibe}`);
  console.log(`   -> AI Recommended Pack:  ${classification.recommendedStylePack}\n`);

  // 5. Render 30 FPS Monochrome Frames
  const totalDurationMs = lyricLines[lyricLines.length - 1].endMs + 600;
  console.log(`🎨 [3/4] Rendering 30 FPS 1-bit Monochrome Sequence (0 to ${totalDurationMs}ms)...`);
  const effectiveVibe = classification.songVibe || moodProfile.vibe;
  const effectivePack = classification.recommendedStylePack || moodProfile.recommendedStylePack;

  const renderedSeq = await renderKineticSequence({
    lyrics: lyricLines,
    startMs: 0,
    endMs: totalDurationMs,
    targetFps: 30,
    archetype: 'auto_semantic',
    wordOverrides: classification.archetypes,
    wordMotifOverrides: classification.motifs,
    transitionStyle: 'auto',
    vibe: effectiveVibe,
    stylePack: effectivePack,
    audioAnalysis
  });

  const frameCount = renderedSeq.frames.length;
  console.log(`   -> Successfully rendered ${frameCount} frames (${(frameCount / 30).toFixed(2)}s).\n`);

  // 6. Encode into High-Res WebM via FFmpeg
  console.log(`📹 [4/4] Encoding ${frameCount} frames to WebM (512x256, VP9, 30 FPS)...`);
  await new Promise<void>((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-y',
      '-f', 'rawvideo',
      '-vcodec', 'rawvideo',
      '-s', '128x64',
      '-pix_fmt', 'rgba',
      '-r', '30',
      '-i', '-',
      '-c:v', 'libvpx-vp9',
      '-b:v', '2M',
      '-crf', '22',
      '-vf', 'scale=512:256:flags=neighbor,format=yuv420p',
      '-auto-alt-ref', '0',
      outPath
    ]);

    ffmpeg.stdin.on('error', (err) => {
      console.warn('FFmpeg stdin error:', err.message);
    });

    for (const frame of renderedSeq.frames) {
      const rawData = Buffer.from(frame.imageData.data.buffer);
      ffmpeg.stdin.write(rawData);
    }
    ffmpeg.stdin.end();

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        console.log(`   -> FFmpeg encoding complete!`);
        resolve();
      } else {
        reject(new Error(`FFmpeg exited with error code ${code}`));
      }
    });

    ffmpeg.on('error', reject);
  });

  console.log('\n================================================================');
  console.log('✅ WEBM GENERATION COMPLETE');
  console.log(`📁 File Path: ${outPath}`);
  console.log('================================================================\n');

  // Print word classifications table
  const wordSummary: any[] = [];
  lyricLines.forEach((line) => {
    line.words.forEach((w) => {
      const specificKey = `${w.word}_${w.startMs}`;
      const lower = w.word.toLowerCase();
      const arch = classification.archetypes[specificKey] || classification.archetypes[lower] || classification.archetypes[w.word] || 'auto_semantic';
      const motif = classification.motifs[specificKey] || classification.motifs[lower] || classification.motifs[w.word] || 'none';
      const parsedItem = inspectionLog?.parsedClassifications?.find((c: any) => c.word.toLowerCase() === lower);
      wordSummary.push({
        Word: w.word,
        Time: `${w.startMs}-${w.endMs}ms`,
        Archetype: arch,
        Motif: motif,
        Reason: parsedItem?.reason ? (parsedItem.reason.slice(0, 45) + '...') : '-'
      });
    });
  });

  console.table(wordSummary);
}

main().catch(err => {
  console.error('Fatal error during kinetic video generation:', err);
  process.exit(1);
});
