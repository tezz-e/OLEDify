import { ParsedLyrics, LyricLine, LyricWord } from './types';
import { isSpacelessScript, detectScript, getScriptLanguage, countGraphemes } from '../kinetic/scriptDetector';

// Comprehensive multilingual punctuation regex matching Latin, Arabic, CJK, and Thai punctuation/brackets
const MULTILINGUAL_PUNCT_REGEX = /[,\.!?;:—\-、。！？،؟؛，．：；「」『』【】（）《》“”‘’"']/;
const MULTILINGUAL_PUNCT_GLOBAL = /[,\.!?;:—\-、。！？،؟؛，．：；「」『』【】（）《》“”‘’"'\s]/g;

/**
 * Syllable-weighted word interpolation algorithm.
 * Allocates word durations inside a line based on syllable counts, consonant drag,
 * punctuation pauses, and phrase-tail breath reservation.
 */
export function estimateWordTimestamps(
  lineText: string,
  startMs: number,
  endMs: number
): LyricWord[] {
  const trimmed = lineText.trim();
  if (!trimmed) return [];

  let rawTokens: string[] = [];

  // When line contains spaceless CJK/Thai text, segment by natural morphemes/words
  if (isSpacelessScript(trimmed)) {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      // Prioritize Thai if Thai characters present, otherwise Japanese Kana/CJK
      let lang = 'ja';
      if (/[\u0E00-\u0E7F]/.test(trimmed)) {
        lang = 'th';
      } else {
        const script = detectScript(trimmed);
        lang = getScriptLanguage(script, trimmed);
        if (lang === 'en') lang = 'ja'; // Ensure spaceless text doesn't default to English dictionary
      }

      const segmenter = new Intl.Segmenter(lang, { granularity: 'word' });
      const segments = Array.from(segmenter.segment(trimmed));

      let pendingPrefix = '';
      for (const seg of segments) {
        const text = seg.segment.trim();
        if (!text) continue;

        if (seg.isWordLike) {
          rawTokens.push(pendingPrefix + text);
          pendingPrefix = '';
        } else {
          // If non-wordlike punctuation, attach to preceding word if available,
          // or accumulate as prefix for the upcoming word
          if (rawTokens.length > 0) {
            rawTokens[rawTokens.length - 1] += text;
          } else {
            pendingPrefix += text;
          }
        }
      }
      if (pendingPrefix && rawTokens.length === 0) {
        rawTokens.push(pendingPrefix);
      }
    }
  }

  // Fallback to whitespace splitting if not spaceless or if segmentation returned empty
  if (rawTokens.length === 0) {
    rawTokens = trimmed.split(/\s+/).filter(Boolean);
  }

  if (rawTokens.length === 0) return [];

  if (rawTokens.length === 1) {
    return [{ word: rawTokens[0], startMs, endMs }];
  }

  const totalDuration = Math.max(300, endMs - startMs);

  // 1. Reserve phrase-tail breath pause (singers inhale before next line)
  const tailSilenceMs = totalDuration > 1500 ? Math.min(350, Math.round(totalDuration * 0.12)) : 50;

  // 2. Syllable counter heuristic (Latin vowels vs Non-Latin grapheme clusters)
  const countWordSyllables = (word: string): number => {
    const script = detectScript(word);
    if (script === 'latin') {
      const clean = word.toLowerCase().replace(/[^a-z]/g, '');
      if (clean.length <= 3) return 1;
      const vowels = clean.replace(/(?:[^laeiouy]|ed|es|e)$/g, '').match(/[aeiouy]{1,2}/g);
      return vowels ? Math.max(1, vowels.length) : 1;
    }
    // For non-Latin scripts (Devanagari, Gurmukhi, CJK, Arabic, etc.),
    // each grapheme cluster corresponds to an akshara, mora, or syllable beat
    const cleanNonLatin = word.replace(MULTILINGUAL_PUNCT_GLOBAL, '');
    const graphemeCount = countGraphemes(cleanNonLatin);
    return Math.max(1, graphemeCount);
  };

  interface WordMetric {
    rawWord: string;
    weight: number;
    hasPunctuationPause: boolean;
  }

  const metrics: WordMetric[] = rawTokens.map((w, idx) => {
    const script = detectScript(w);
    const isLatin = script === 'latin';
    const clean = isLatin ? w.replace(/[^\w]/g, '') : w.replace(MULTILINGUAL_PUNCT_GLOBAL, '');
    const syllables = countWordSyllables(w);
    const charCount = isLatin ? clean.length : countGraphemes(clean);
    const hasPunctuation = MULTILINGUAL_PUNCT_REGEX.test(w);
    const isLineEnd = idx === rawTokens.length - 1;

    // Weight formula: Syllables dominate sung duration (65%), chars add consonant drag (35%)
    let weight = syllables * 0.65 + charCount * 0.05;
    if (hasPunctuation || isLineEnd) {
      weight += 0.35; // Terminal notes/words are held longer
    }

    return {
      rawWord: w,
      weight,
      hasPunctuationPause: hasPunctuation && !isLineEnd
    };
  });

  const totalWeight = metrics.reduce((acc, m) => acc + m.weight, 0);

  // Budget intermediate punctuation pauses within the available duration
  const pauseCount = metrics.filter(m => m.hasPunctuationPause).length;
  const maxPauseTotal = Math.floor((totalDuration - tailSilenceMs) * 0.25);
  const pauseMs = pauseCount > 0 ? Math.min(100, Math.floor(maxPauseTotal / pauseCount)) : 0;
  const totalPausesMs = pauseCount * pauseMs;

  // Vocal pool after accounting for breath tail silence and punctuation pauses
  const vocalPoolMs = Math.max(metrics.length * 30, totalDuration - tailSilenceMs - totalPausesMs);

  const words: LyricWord[] = [];
  let currentStart = startMs;

  for (let i = 0; i < metrics.length; i++) {
    const m = metrics[i];
    let duration = Math.max(30, Math.round((m.weight / totalWeight) * vocalPoolMs));

    // Ensure the last word stays strictly within line boundary
    if (i === metrics.length - 1 && currentStart + duration > endMs) {
      duration = Math.max(30, endMs - currentStart);
    }

    const wordEnd = currentStart + duration;

    words.push({
      word: m.rawWord,
      startMs: currentStart,
      endMs: wordEnd
    });

    const punctPause = m.hasPunctuationPause ? pauseMs : 0;
    currentStart = wordEnd + punctPause;
  }

  return words;
}

/**
 * Parses standard and enhanced LRC strings into a normalized ParsedLyrics structure.
 */
export function parseLrc(rawLrc: string, fallbackTotalDurationMs?: number): ParsedLyrics {
  const lines = rawLrc.split(/\r?\n/);
  const result: ParsedLyrics = { offsetMs: 0, lines: [] };
  const rawParsedLines: Array<{ startMs: number; rawText: string }> = [];

  const timeTagRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;
  const metaTagRegex = /^\[(ti|ar|al|offset|length):([^\]]*)\]/i;
  const wordTagRegex = /<(\d{2}):(\d{2})(?:\.(\d{2,3}))?>\s*([^<]+)/g;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // 1. Metadata tags
    const metaMatch = trimmed.match(metaTagRegex);
    if (metaMatch) {
      const [, tag, value] = metaMatch;
      const lowerTag = tag.toLowerCase();
      if (lowerTag === 'ti') result.title = value.trim();
      else if (lowerTag === 'ar') result.artist = value.trim();
      else if (lowerTag === 'al') result.album = value.trim();
      else if (lowerTag === 'offset') result.offsetMs = parseInt(value.trim(), 10) || 0;
      continue;
    }

    // 2. Line timestamps
    const timestamps: number[] = [];
    let match: RegExpExecArray | null;
    let lastIndex = 0;

    timeTagRegex.lastIndex = 0;
    while ((match = timeTagRegex.exec(trimmed)) !== null) {
      const min = parseInt(match[1], 10);
      const sec = parseInt(match[2], 10);
      const rawFrac = match[3] || '00';
      const ms = rawFrac.length === 2 ? parseInt(rawFrac, 10) * 10 : parseInt(rawFrac.padEnd(3, '0'), 10);
      timestamps.push(min * 60000 + sec * 1000 + ms);
      lastIndex = timeTagRegex.lastIndex;
    }

    if (timestamps.length === 0) continue;
    const lineContent = trimmed.substring(lastIndex).trim();

    for (const startMs of timestamps) {
      rawParsedLines.push({ startMs: startMs + result.offsetMs, rawText: lineContent });
    }
  }

  // If no time tags found, treat as plain text lyrics
  if (rawParsedLines.length === 0) {
    return parsePlainTextLyrics(rawLrc, fallbackTotalDurationMs);
  }

  rawParsedLines.sort((a, b) => a.startMs - b.startMs);

  for (let i = 0; i < rawParsedLines.length; i++) {
    const current = rawParsedLines[i];
    const nextStartMs = i + 1 < rawParsedLines.length 
      ? rawParsedLines[i + 1].startMs 
      : current.startMs + 4000;
    const lineDuration = Math.max(800, nextStartMs - current.startMs);
    const lineEndMs = current.startMs + lineDuration;

    const words: LyricWord[] = [];
    wordTagRegex.lastIndex = 0;
    let wordMatch: RegExpExecArray | null;

    // Check for enhanced word-level tags
    while ((wordMatch = wordTagRegex.exec(current.rawText)) !== null) {
      const min = parseInt(wordMatch[1], 10);
      const sec = parseInt(wordMatch[2], 10);
      const rawFrac = wordMatch[3] || '00';
      const ms = rawFrac.length === 2 ? parseInt(rawFrac, 10) * 10 : parseInt(rawFrac.padEnd(3, '0'), 10);
      const wordStartMs = min * 60000 + sec * 1000 + ms + result.offsetMs;
      const wordText = wordMatch[4].trim();
      words.push({ word: wordText, startMs: wordStartMs, endMs: 0 });
    }

    let cleanLineText = current.rawText;
    if (words.length > 0) {
      for (let w = 0; w < words.length; w++) {
        const nextWordStart = w + 1 < words.length ? words[w + 1].startMs : lineEndMs;
        words[w].endMs = Math.max(words[w].startMs + 50, nextWordStart);
      }
      cleanLineText = words.map(w => w.word).join(' ');
    } else {
      cleanLineText = current.rawText.replace(/<[^>]+>/g, '').trim();
      words.push(...estimateWordTimestamps(cleanLineText, current.startMs, lineEndMs));
    }

    result.lines.push({
      lineIndex: i,
      text: cleanLineText,
      startMs: current.startMs,
      endMs: lineEndMs,
      words
    });
  }

  result.durationMs = result.lines.length > 0 ? result.lines[result.lines.length - 1].endMs : 0;
  return result;
}

/**
 * Plain-text fallback parser that evenly distributes lines across duration.
 */
export function parsePlainTextLyrics(text: string, totalDurationMs: number = 60000): ParsedLyrics {
  const rawLines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (rawLines.length === 0) return { offsetMs: 0, lines: [] };

  const durationPerLine = Math.max(1500, Math.floor(totalDurationMs / rawLines.length));
  const lines: LyricLine[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const startMs = i * durationPerLine;
    const endMs = startMs + durationPerLine;
    const cleanText = rawLines[i];
    const words = estimateWordTimestamps(cleanText, startMs, endMs);

    lines.push({
      lineIndex: i,
      text: cleanText,
      startMs,
      endMs,
      words
    });
  }

  return {
    offsetMs: 0,
    durationMs: totalDurationMs,
    lines
  };
}
