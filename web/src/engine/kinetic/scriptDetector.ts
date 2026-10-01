/**
 * Script Detection & Multilingual Directionality Engine for 128x64 OLED Typography
 */

export type ScriptType =
  | 'latin'
  | 'devanagari'
  | 'gurmukhi'
  | 'cjk'
  | 'japanese'
  | 'hangul'
  | 'korean'
  | 'cyrillic'
  | 'arabic'
  | 'tamil'
  | 'telugu'
  | 'thai'
  | 'unknown';

// Unicode Regex Ranges
const ARABIC_HEBREW_RTL_REGEX = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const SPACELESS_REGEX = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF\u0E00-\u0E7F]/;
const JAPANESE_KANA_REGEX = /[\u3040-\u309F\u30A0-\u30FF]/;

/**
 * Detects whether text is written in a Right-to-Left (RTL) script (Arabic, Urdu, Persian, Hebrew).
 */
export function isRTL(text: string): boolean {
  if (!text) return false;
  return ARABIC_HEBREW_RTL_REGEX.test(text);
}

/**
 * Detects whether text is in a spaceless script (Japanese, Chinese, Thai).
 */
export function isSpacelessScript(text: string): boolean {
  if (!text) return false;
  return SPACELESS_REGEX.test(text);
}

/**
 * Detects whether text specifically contains Japanese Kana (Hiragana or Katakana).
 */
export function isJapanese(text: string): boolean {
  if (!text) return false;
  return JAPANESE_KANA_REGEX.test(text);
}

/**
 * Extracts true grapheme clusters from text, preserving combining vowel marks (matras),
 * viramas, ligatures, and surrogate pairs across Indic, Arabic, Thai, and CJK scripts.
 */
export function getGraphemes(text: string): string[] {
  if (!text) return [];
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    return Array.from(segmenter.segment(text), s => s.segment);
  }
  return Array.from(text);
}

/**
 * Returns the count of true grapheme clusters.
 */
export function countGraphemes(text: string): number {
  return getGraphemes(text).length;
}

/**
 * Detects the primary script family of a given text segment.
 */
export function detectScript(text: string): ScriptType {
  if (!text || !text.trim()) return 'unknown';

  const counts: Record<string, number> = {
    devanagari: 0,
    gurmukhi: 0,
    tamil: 0,
    telugu: 0,
    arabic: 0,
    cyrillic: 0,
    hangul: 0,
    cjk: 0,
    thai: 0,
    latin: 0,
  };

  for (const char of text) {
    if (/[\u0900-\u097F]/.test(char)) counts.devanagari++;
    else if (/[\u0A00-\u0A7F]/.test(char)) counts.gurmukhi++;
    else if (/[\u0B80-\u0BFF]/.test(char)) counts.tamil++;
    else if (/[\u0C00-\u0C7F]/.test(char)) counts.telugu++;
    else if (/[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(char)) counts.arabic++;
    else if (/[\u0400-\u04FF\u0500-\u052F\u2DE0-\u2DFF\uA640-\uA69F]/.test(char)) counts.cyrillic++;
    else if (/[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uD7B0-\uD7FF]/.test(char)) counts.hangul++;
    else if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/.test(char)) counts.cjk++;
    else if (/[\u0E00-\u0E7F]/.test(char)) counts.thai++;
    else if (/[a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]/.test(char)) counts.latin++;
  }

  let maxScript: ScriptType = 'latin';
  let maxCount = 0;

  for (const [script, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      maxScript = script as ScriptType;
    }
  }

  if (maxCount === 0) {
    return 'latin';
  }

  return maxScript;
}

/**
 * Returns BCP 47 language code best suited for Intl segmentation given a script.
 */
export function getScriptLanguage(script: ScriptType, sampleText?: string): string {
  switch (script) {
    case 'devanagari': return 'hi';
    case 'gurmukhi': return 'pa';
    case 'tamil': return 'ta';
    case 'telugu': return 'te';
    case 'arabic': return 'ar';
    case 'cyrillic': return 'ru';
    case 'hangul':
    case 'korean': return 'ko';
    case 'thai': return 'th';
    case 'japanese': return 'ja';
    case 'cjk':
      if (sampleText && isJapanese(sampleText)) return 'ja';
      return 'ja'; // Default CJK in kinetic lyrics to Japanese
    case 'latin':
    case 'unknown':
    default:
      return 'en';
  }
}
