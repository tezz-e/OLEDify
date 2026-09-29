import assert from 'node:assert/strict';

// Test 1: Binary search snapToNearestBeat behavior
console.log('--- Test Suite 1: snapToNearestBeat (Binary Search) ---');

function snapToNearestBeat(beatsMs: number[], timeMs: number, maxToleranceMs = 160): number {
  if (beatsMs.length === 0) return timeMs;

  let low = 0;
  let high = beatsMs.length - 1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    const b = beatsMs[mid];
    if (b === timeMs) return timeMs;
    if (b < timeMs) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  let closest = timeMs;
  let minDiff = Infinity;

  if (high >= 0) {
    const diff = Math.abs(beatsMs[high] - timeMs);
    if (diff < minDiff) {
      minDiff = diff;
      closest = beatsMs[high];
    }
  }
  if (low < beatsMs.length) {
    const diff = Math.abs(beatsMs[low] - timeMs);
    if (diff < minDiff) {
      minDiff = diff;
      closest = beatsMs[low];
    }
  }

  return minDiff <= maxToleranceMs ? closest : timeMs;
}

const testBeats = [500, 1000, 1500, 2000, 2500, 3000];

// Exact match
assert.equal(snapToNearestBeat(testBeats, 1000), 1000, 'Exact beat match failed');
// Near match within tolerance (e.g. 1040ms snaps to 1000ms, diff 40 <= 160)
assert.equal(snapToNearestBeat(testBeats, 1040), 1000, 'Near match (+40ms) should snap to 1000');
assert.equal(snapToNearestBeat(testBeats, 960), 1000, 'Near match (-40ms) should snap to 1000');
// Boundary match at exact tolerance (160ms)
assert.equal(snapToNearestBeat(testBeats, 1160), 1000, 'Exact tolerance (+160ms) should snap to 1000');
// Out of tolerance (170ms) should preserve original
assert.equal(snapToNearestBeat(testBeats, 1170), 1170, 'Out of tolerance (+170ms) should not snap');
// Closer to second beat (e.g. 1350ms is 350ms from 1000, 150ms from 1500)
assert.equal(snapToNearestBeat(testBeats, 1350), 1500, 'Should snap to closest beat (1500)');
// Empty beats array
assert.equal(snapToNearestBeat([], 1200), 1200, 'Empty beats array should preserve timestamp');
// Before first beat out of tolerance
assert.equal(snapToNearestBeat(testBeats, 100), 100, 'Time before first beat should preserve timestamp');
// Before first beat within tolerance
assert.equal(snapToNearestBeat(testBeats, 420), 500, 'Time close to first beat should snap to 500');
// After last beat out of tolerance
assert.equal(snapToNearestBeat(testBeats, 5000), 5000, 'Time after last beat should preserve timestamp');
// Negative timeMs
assert.equal(snapToNearestBeat(testBeats, -200), -200, 'Negative timeMs should preserve timestamp');

console.log('✓ All 11 snapToNearestBeat assertions passed.');

// Test 2: getFrameAtTime bounds check
console.log('\n--- Test Suite 2: getFrameAtTime Out-of-Bounds Silence ---');

interface AudioFrameData {
  timeMs: number;
  rms: number;
  bass: number;
  flux: number;
  isBeat: boolean;
  onsetStrength: number;
}

function makeMockEngine(durationMs: number) {
  const fps = 30;
  const totalFrames = Math.round((durationMs / 1000) * fps);
  const frames: AudioFrameData[] = [];
  for (let i = 0; i < totalFrames; i++) {
    frames.push({
      timeMs: Math.round((i / fps) * 1000),
      rms: 0.8,
      bass: 0.9,
      flux: 0.7,
      isBeat: i === totalFrames - 1, // Last frame is a beat
      onsetStrength: 1.0
    });
  }

  const getFrameAtTime = (timeMs: number): AudioFrameData => {
    if (frames.length === 0 || timeMs < 0 || timeMs > durationMs) {
      return { timeMs, rms: 0, bass: 0, flux: 0, isBeat: false, onsetStrength: 0 };
    }
    const idx = Math.max(0, Math.min(frames.length - 1, Math.round((timeMs / 1000) * fps)));
    return frames[idx];
  };

  return { getFrameAtTime };
}

const engine = makeMockEngine(3000); // 3-second audio

// Frame inside duration has energy and beat at 3000ms
const insideFrame = engine.getFrameAtTime(1500);
assert.equal(insideFrame.rms, 0.8, 'Inside frame should have energy');
assert.equal(insideFrame.bass, 0.9, 'Inside frame should have bass');

// Frame AFTER duration (e.g. 5000ms for a 3000ms audio)
const afterFrame = engine.getFrameAtTime(5000);
assert.equal(afterFrame.rms, 0, 'Frame after audio ends must be silent');
assert.equal(afterFrame.bass, 0, 'Bass after audio ends must be 0');
assert.equal(afterFrame.flux, 0, 'Flux after audio ends must be 0');
assert.equal(afterFrame.isBeat, false, 'isBeat after audio ends must be false (no stuck beat)');

// Frame BEFORE duration (< 0ms)
const beforeFrame = engine.getFrameAtTime(-500);
assert.equal(beforeFrame.rms, 0, 'Frame before 0 must be silent');
assert.equal(beforeFrame.isBeat, false, 'Frame before 0 must have isBeat = false');

console.log('✓ All 7 getFrameAtTime bounds assertions passed.');

// Test 3: Monotonic Line and Word Clamping Algorithm
console.log('\n--- Test Suite 3: Monotonic Line and Word Beat Snapping ---');

interface LyricWord {
  word: string;
  startMs: number;
  endMs: number;
}

interface LyricLine {
  text: string;
  startMs: number;
  endMs: number;
  words: LyricWord[];
}

function snapLyricsToNearestBeats(lines: LyricLine[], beats: number[]): LyricLine[] {
  let lastLineEnd = 0;
  return lines.map((line, lIdx) => {
    let snappedLineStart = snapToNearestBeat(beats, line.startMs);
    let snappedLineEnd = snapToNearestBeat(beats, line.endMs);

    if (lIdx > 0 && snappedLineStart < lastLineEnd) {
      snappedLineStart = Math.max(snappedLineStart, lastLineEnd);
    }

    const finalLineStart = Math.min(snappedLineStart, snappedLineEnd - 100);
    const finalLineEnd = Math.max(snappedLineEnd, finalLineStart + 100);
    lastLineEnd = finalLineEnd;

    let wordPrevEnd = finalLineStart;
    const wordsCount = line.words.length;

    const updatedWords = line.words.map((w, wIdx) => {
      let s = snapToNearestBeat(beats, w.startMs);
      let e = snapToNearestBeat(beats, w.endMs);

      if (wIdx === 0) {
        s = finalLineStart;
      } else {
        s = Math.max(wordPrevEnd, Math.min(finalLineEnd - 60, s));
      }

      if (wIdx === wordsCount - 1) {
        e = finalLineEnd;
      } else {
        e = Math.max(s + 60, Math.min(finalLineEnd, e));
      }

      if (e <= s) {
        e = s + Math.max(60, w.endMs - w.startMs);
      }

      wordPrevEnd = e;
      return {
        ...w,
        startMs: s,
        endMs: e
      };
    });

    return {
      ...line,
      startMs: finalLineStart,
      endMs: finalLineEnd,
      words: updatedWords
    };
  });
}

const inputLines: LyricLine[] = [
  {
    text: 'WELCOME TO OLED STUDIO',
    startMs: 20,
    endMs: 2480,
    words: [
      { word: 'WELCOME', startMs: 20, endMs: 600 },
      { word: 'TO', startMs: 600, endMs: 900 },
      { word: 'OLED', startMs: 900, endMs: 1600 },
      { word: 'STUDIO', startMs: 1600, endMs: 2480 }
    ]
  },
  {
    text: 'PURE KINETIC TYPOGRAPHY',
    startMs: 2520,
    endMs: 4980,
    words: [
      { word: 'PURE', startMs: 2520, endMs: 3100 },
      { word: 'KINETIC', startMs: 3100, endMs: 3900 },
      { word: 'TYPOGRAPHY', startMs: 3900, endMs: 4980 }
    ]
  }
];

const drumHits = [0, 500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000];
const snapped = snapLyricsToNearestBeats(inputLines, drumHits);

// Check line 0 bounds
assert.equal(snapped[0].startMs, 0, 'Line 0 should snap from 20ms to 0ms');
assert.equal(snapped[0].endMs, 2500, 'Line 0 should snap from 2480ms to 2500ms');

// Check line 0 words
assert.equal(snapped[0].words[0].startMs, snapped[0].startMs, 'First word startMs must equal line startMs');
assert.equal(snapped[0].words[3].endMs, snapped[0].endMs, 'Last word endMs must equal line endMs');

// Check monotonic ordering & minimum duration
for (const line of snapped) {
  assert.ok(line.endMs >= line.startMs + 100, 'Line duration must be at least 100ms');
  for (let i = 0; i < line.words.length; i++) {
    const w = line.words[i];
    assert.ok(w.endMs > w.startMs, `Word ${w.word} duration must be positive`);
    assert.ok(w.endMs - w.startMs >= 60, `Word ${w.word} duration must be at least 60ms`);
    assert.ok(w.startMs >= line.startMs, `Word ${w.word} start must be >= line start`);
    assert.ok(w.endMs <= line.endMs, `Word ${w.word} end must be <= line end`);
    if (i > 0) {
      assert.ok(w.startMs >= line.words[i - 1].startMs, `Word ${w.word} start must be >= previous word start`);
    }
  }
}

// Check consecutive line ordering
assert.ok(snapped[1].startMs >= snapped[0].endMs, 'Line 1 must start at or after Line 0 ends');

console.log('✓ All monotonic line and word snapping assertions passed.');

// Test 4: Live Beat Detector (Pulse Flash)
console.log('\n--- Test Suite 4: Live Beat Binary Search Check ---');

function checkIsLiveBeat(beats: number[], playheadMs: number): boolean {
  if (beats.length === 0) return false;
  let low = 0, high = beats.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const diff = beats[mid] - playheadMs;
    if (Math.abs(diff) <= 85) return true;
    if (diff < 0) low = mid + 1;
    else high = mid - 1;
  }
  if (low < beats.length && Math.abs(beats[low] - playheadMs) <= 85) return true;
  if (high >= 0 && Math.abs(beats[high] - playheadMs) <= 85) return true;
  return false;
}

assert.equal(checkIsLiveBeat(drumHits, 1000), true, 'Exact hit at 1000ms should trigger live beat');
assert.equal(checkIsLiveBeat(drumHits, 1050), true, 'Playhead +50ms from hit should trigger live beat');
assert.equal(checkIsLiveBeat(drumHits, 930), true, 'Playhead -70ms from hit should trigger live beat');
assert.equal(checkIsLiveBeat(drumHits, 1085), true, 'Boundary hit at 85ms should trigger live beat');
assert.equal(checkIsLiveBeat(drumHits, 1090), false, 'Playhead +90ms should NOT trigger live beat');
assert.equal(checkIsLiveBeat(drumHits, 1250), false, 'Playhead midpoint between beats should NOT trigger');

console.log('✓ All 6 live beat detector assertions passed.');

console.log('\n🎉 ALL 4 TEST SUITES PASSED FLAWLESSLY WITH ZERO REGRESSIONS!');
