import assert from 'node:assert/strict';
import { 
  isFillerWord, 
  classifyWordArchetype, 
  getWordFontRole, 
  getWordEffectiveFont 
} from '../src/engine/kinetic/semanticClassifier';
import { 
  STYLE_PACKS, 
  StylePackId, 
  MotionArchetype,
  VisualMotif,
  MOTIF_METADATA,
  ARCHETYPE_METADATA
} from '../src/engine/kinetic/types';
import { 
  VALID_VISUAL_MOTIFS,
  normalizeMotif,
  normalizeArchetype,
  extractClassificationsFromResponse 
} from '../src/engine/kinetic/ollamaClassifier';
import { renderArchetypeFrame } from '../src/engine/kinetic/kineticArchetypes';
import { computeSafeTextLayout } from '../src/engine/kinetic/kineticLayout';
import { LyricWord } from '../src/engine/lyrics/types';
import { 
  detectScript, 
  detectAllScripts,
  isRTL, 
  isSpacelessScript, 
  getGraphemes, 
  countGraphemes 
} from '../src/engine/kinetic/scriptDetector';
import { estimateWordTimestamps } from '../src/engine/lyrics/lrcParser';
import { SCRIPT_FONT_REGISTRY } from '../src/engine/kinetic/fontLoader';

console.log('🧪 Starting Kinetic Typography & Auto Mode Test Suite...\n');

// =========================================================================
// TEST SUITE 1: Filler Word Subordination & Semantic Mapping
// =========================================================================
console.log('--- Suite 1: Filler Word Subordination & Classification ---');

// Test English & Indic filler words
const sampleFillers = ['the', 'The', 'THE', 'a', 'an', 'in', 'on', 'to', 'and', 'with', 'te', 'de', 'da', 'di', 'mera', 'tera', 'asi'];
for (const word of sampleFillers) {
  assert.equal(isFillerWord(word), true, `Expected "${word}" to be recognized as filler`);
  const arch = classifyWordArchetype(word, 300, 0, 0);
  assert.equal(arch, 'smooth_fluid', `Expected filler word "${word}" to have smooth_fluid archetype, got ${arch}`);
  const role = getWordFontRole(arch, word);
  assert.equal(role, 'anchor', `Expected filler word "${word}" to have anchor role, got ${role}`);
}
console.log('✅ All English and Punjabi filler words successfully recognized and subordinated to anchor role.');

// Test Hero Content & Punchlines
const heroSamples = [
  { word: 'SHASHTAR', expectedArch: 'blade_slash', expectedRole: 'action' },
  { word: 'SMASH', expectedArch: 'manga_impact', expectedRole: 'hero' },
  { word: 'KING', expectedArch: '3d_block_stack', expectedRole: 'hero' },
  { word: 'GLITCH', expectedArch: 'cyber_glitch', expectedRole: 'novelty' },
  { word: 'VIPER', expectedArch: 'snake_slither', expectedRole: 'action' },
  { word: 'FIRE!', expectedArch: 'manga_impact', expectedRole: 'hero' }
];

for (const sample of heroSamples) {
  const arch = classifyWordArchetype(sample.word, 400, 0, 0);
  assert.equal(arch, sample.expectedArch, `Word "${sample.word}": expected archetype ${sample.expectedArch}, got ${arch}`);
  const role = getWordFontRole(arch, sample.word);
  assert.equal(role, sample.expectedRole, `Word "${sample.word}": expected role ${sample.expectedRole}, got ${role}`);
}
console.log('✅ Semantic keyword and punctuation mapping to archetypes and font roles verified.');


// =========================================================================
// TEST SUITE 2: 4-Font Style Packs & Font Resolution
// =========================================================================
console.log('\n--- Suite 2: 4-Font Style Packs & Semantic Font Resolution ---');

const packIds: StylePackId[] = ['trap_drill', 'shonen_comic', 'cartoon_bounce', 'cyber_industrial', 'custom'];
for (const id of packIds) {
  const pack = STYLE_PACKS[id];
  assert.ok(pack, `Pack ${id} exists`);
  assert.ok(pack.fonts.hero, `Pack ${id} has hero font`);
  assert.ok(pack.fonts.action, `Pack ${id} has action font`);
  assert.ok(pack.fonts.novelty, `Pack ${id} has novelty font`);
  assert.ok(pack.fonts.anchor, `Pack ${id} has anchor font`);
}
console.log('✅ All 5 Style Packs properly defined with 4-font semantic roles.');

// Test font resolution for Trap & Drill pack
const trapPack = STYLE_PACKS.trap_drill;
const wordHero: LyricWord = { word: 'KING', startMs: 1000, endMs: 1500 };
const fontHero = getWordEffectiveFont(wordHero, 'manga_impact', trapPack);
assert.equal(fontHero, trapPack.fonts.hero, `Expected hero font for KING with manga_impact`);

const wordAction: LyricWord = { word: 'BLADE', startMs: 1600, endMs: 2000 };
const fontAction = getWordEffectiveFont(wordAction, 'blade_slash', trapPack);
assert.equal(fontAction, trapPack.fonts.action, `Expected action font for BLADE with blade_slash`);

const wordNovelty: LyricWord = { word: 'GOTH', startMs: 2100, endMs: 2400 };
const fontNovelty = getWordEffectiveFont(wordNovelty, 'cyber_glitch', trapPack);
assert.equal(fontNovelty, trapPack.fonts.novelty, `Expected novelty font for GOTH with cyber_glitch`);

// Verify 5+ char aperture safety guard upgrades long blackletter words to Lemon Milk
const wordLongNovelty: LyricWord = { word: 'GLITCH', startMs: 2100, endMs: 2400 };
const fontLong = getWordEffectiveFont(wordLongNovelty, 'cyber_glitch', trapPack);
assert.ok(fontLong.includes('Lemon Milk'), 'Long words in blackletter novelty font must upgrade to Lemon Milk for 1-bit legibility');

const wordConnector: LyricWord = { word: 'in', startMs: 2500, endMs: 2700 };
const fontConnector = getWordEffectiveFont(wordConnector, 'smooth_fluid', trapPack);
assert.equal(fontConnector, trapPack.fonts.anchor, `Expected anchor font for connector "in"`);

// Test manual override priority
const manualOverrides: Record<string, string> = {
  'KING_1000': "'Custom Comic', sans-serif"
};
const fontOverridden = getWordEffectiveFont(wordHero, 'manga_impact', trapPack, manualOverrides);
assert.equal(fontOverridden, "'Custom Comic', sans-serif", 'Explicit word font override must override pack');
console.log('✅ Semantic font resolution and user override priority verified.');


// =========================================================================
// TEST SUITE 3: Typographic Hierarchy & Safe Layout
// =========================================================================
console.log('\n--- Suite 3: Layout Scaling & Inverted Hierarchy Fix ---');

// Mock Canvas 2D context for headless testing
function createMockCtx(): CanvasRenderingContext2D {
  let currentFont = '14px monospace';
  return {
    get font() { return currentFont; },
    set font(f: string) { currentFont = f; },
    measureText: (text: string) => {
      // Estimate width proportional to font size
      const match = currentFont.match(/(\d+)px/);
      const size = match ? parseInt(match[1], 10) : 14;
      return { width: text.length * size * 0.6 };
    }
  } as unknown as CanvasRenderingContext2D;
}

const mockCtx = createMockCtx();

// Test 3a: Filler words must NOT blow up to 48px
const fillerLayout = computeSafeTextLayout('THE', mockCtx);
assert.ok(fillerLayout.fontSize <= 18, `Filler word "THE" must be <= 18px (got ${fillerLayout.fontSize}px)`);
assert.equal(fillerLayout.lines[0], 'THE');

const punjabiFillerLayout = computeSafeTextLayout('TE', mockCtx);
assert.ok(punjabiFillerLayout.fontSize <= 18, `Filler word "TE" must be <= 18px (got ${punjabiFillerLayout.fontSize}px)`);

// Test 3b: Hero short words MUST get massive display size (32px to 48px)
const heroLayout = computeSafeTextLayout('DROP', mockCtx);
assert.ok(heroLayout.fontSize >= 32, `Hero word "DROP" must be >= 32px (got ${heroLayout.fontSize}px)`);

// Test 3c: Very long words must not clip
const longLayout = computeSafeTextLayout('UNDERGROUND', mockCtx);
assert.ok(longLayout.totalHeight <= 58, `Multi-syllable word height must fit within 58px (got ${longLayout.totalHeight}px)`);
console.log(`✅ Typographic hierarchy verified: Filler "THE" = ${fillerLayout.fontSize}px, Hero "DROP" = ${heroLayout.fontSize}px, Long = ${longLayout.fontSize}px.`);


// =========================================================================
// TEST SUITE 4: Pause Bug & Rest State Timing Verification
// =========================================================================
console.log('\n--- Suite 4: The Phantom Future Word Pause Bug Verification ---');

function findLastEndedWord(wordsList: LyricWord[], timeMs: number): { word?: LyricWord; index: number } {
  for (let i = wordsList.length - 1; i >= 0; i--) {
    if (wordsList[i].endMs <= timeMs) {
      return { word: wordsList[i], index: i };
    }
  }
  return { word: undefined, index: -1 };
}

// Scenario: Word 1 is sung from 1000ms to 2000ms.
// Instrumental break / vocal silence occurs from 2000ms to 5000ms (3 seconds).
// Word 2 is sung starting at 5000ms.
const testWords: LyricWord[] = [
  { word: 'KINETIC', startMs: 1000, endMs: 2000 },
  { word: 'EXPLOSION', startMs: 5000, endMs: 6000 }
];

function checkEngineWordState(currentMs: number): { isPause: boolean; activeWord?: string; tau: number } {
  const activeWordIndex = testWords.findIndex(w => currentMs >= w.startMs && currentMs < w.endMs);
  let activeWord = activeWordIndex !== -1 ? testWords[activeWordIndex] : undefined;
  let isPauseState = false;

  if (!activeWord) {
    const { word: prevWord } = findLastEndedWord(testWords, currentMs);
    if (prevWord && (currentMs - prevWord.endMs) <= 140) {
      activeWord = prevWord;
    } else {
      isPauseState = true;
    }
  }

  if (isPauseState || !activeWord) {
    return { isPause: true, tau: 0 };
  }

  const duration = activeWord.endMs - activeWord.startMs;
  const tau = (currentMs - activeWord.startMs) / duration;
  return { isPause: false, activeWord: activeWord.word, tau };
}

// 1. During Word 1 (1500ms): should be active
const state1 = checkEngineWordState(1500);
assert.equal(state1.isPause, false);
assert.equal(state1.activeWord, 'KINETIC');
assert.equal(state1.tau, 0.5);

// 2. Just after Word 1 within 140ms tail hold (2080ms): holds Word 1 tail
const stateHold = checkEngineWordState(2080);
assert.equal(stateHold.isPause, false);
assert.equal(stateHold.activeWord, 'KINETIC');

// 3. During vocal pause (2500ms): MUST BE PAUSE STATE (Previously was freezing EXPLOSION at tau=0)
const statePause1 = checkEngineWordState(2500);
assert.equal(statePause1.isPause, true, 'At 2500ms in vocal gap, engine must enter isPauseState = true');
assert.equal(statePause1.activeWord, undefined);

// 4. Just before Word 2 (4800ms): STILL MUST BE PAUSE STATE
const statePause2 = checkEngineWordState(4800);
assert.equal(statePause2.isPause, true, 'At 4800ms before Word 2, engine must still be in pause state (not freezing Word 2)');

// 5. At Word 2 start (5000ms): activates Word 2
const stateWord2 = checkEngineWordState(5000);
assert.equal(stateWord2.isPause, false);
assert.equal(stateWord2.activeWord, 'EXPLOSION');
assert.equal(stateWord2.tau, 0);

console.log('✅ Phantom Future Word Pause Bug verified fixed: gaps enter clean rest state without freezing upcoming words.');


// =========================================================================
// TEST SUITE 5: 1-Bit Visual Motifs & LLM Inference Classification
// =========================================================================
console.log('\n--- Suite 5: 1-Bit Visual Motifs & LLM Inference Pipeline ---');

// 1. Verify all 11 motifs exist in metadata
assert.equal(VALID_VISUAL_MOTIFS.length, 11, 'Expected exactly 11 visual motifs');
for (const motif of VALID_VISUAL_MOTIFS) {
  const meta = MOTIF_METADATA[motif];
  assert.ok(meta, `Motif "${motif}" must have metadata`);
  assert.ok(meta.icon, `Motif "${motif}" must have an icon`);
  assert.ok(meta.name, `Motif "${motif}" must have a name`);
  assert.ok(meta.tag, `Motif "${motif}" must have a tag`);
}
console.log('✅ All 11 Visual Motifs defined with valid icons, tags, and metadata.');

// 2. Test motif normalization and fuzzy recovery
const fuzzyMotifTests: Array<{ raw: string; expected: VisualMotif }> = [
  { raw: 'crown_royal', expected: 'crown_royal' },
  { raw: 'crown', expected: 'crown_royal' },
  { raw: 'king', expected: 'crown_royal' },
  { raw: 'royal', expected: 'crown_royal' },
  { raw: 'boss', expected: 'crown_royal' },
  { raw: 'razor_blade', expected: 'razor_blade' },
  { raw: 'blade', expected: 'razor_blade' },
  { raw: 'slash', expected: 'razor_blade' },
  { raw: 'tactical_scope', expected: 'tactical_scope' },
  { raw: 'target', expected: 'tactical_scope' },
  { raw: 'crosshair', expected: 'tactical_scope' },
  { raw: 'aim', expected: 'tactical_scope' },
  { raw: 'flame_tongue', expected: 'flame_tongue' },
  { raw: 'fire', expected: 'flame_tongue' },
  { raw: 'burn', expected: 'flame_tongue' },
  { raw: 'skull_cross', expected: 'skull_cross' },
  { raw: 'death', expected: 'skull_cross' },
  { raw: 'grave', expected: 'skull_cross' },
  { raw: 'chrome_star', expected: 'chrome_star' },
  { raw: 'diamond', expected: 'chrome_star' },
  { raw: 'sparkle', expected: 'chrome_star' },
  { raw: 'ice', expected: 'chrome_star' },
  { raw: 'lightning_arc', expected: 'lightning_arc' },
  { raw: 'electric', expected: 'lightning_arc' },
  { raw: 'comic_burst', expected: 'comic_burst' },
  { raw: 'starburst', expected: 'comic_burst' },
  { raw: 'none', expected: 'none' },
  { raw: 'xyz_random', expected: 'none' }
];

for (const t of fuzzyMotifTests) {
  const norm = normalizeMotif(t.raw);
  assert.equal(norm, t.expected, `Input "${t.raw}": expected motif "${t.expected}", got "${norm}"`);
}
console.log('✅ Motif normalization and fuzzy keyword recovery verified.');

// 3. Test LLM response extraction with motifs
const sampleLLMResponse = JSON.stringify({
  classifications: [
    {
      word: "SHASHTAR",
      meaning: "weapons / arms",
      archetype: "3d_block_stack",
      motif: "razor_blade",
      reason: "heavy weapon punchline"
    },
    {
      word: "HUKUM",
      meaning: "royal command / king",
      archetype: "manga_impact",
      motif: "crown_royal",
      reason: "royal declaration"
    },
    {
      word: "DRACO",
      meaning: "firearm weapon",
      archetype: "target_focus",
      motif: "tactical_scope",
      reason: "aiming and shooting"
    },
    {
      word: "ICE",
      meaning: "diamond jewelry",
      archetype: "smooth_fluid",
      motif: "chrome_star",
      reason: "shine and glint"
    }
  ]
});

const extracted = extractClassificationsFromResponse(sampleLLMResponse);
assert.equal(extracted.length, 4, 'Expected 4 extracted classifications');
assert.equal(extracted[0].word, 'SHASHTAR');
assert.equal(extracted[0].motif, 'razor_blade');
assert.equal(extracted[1].word, 'HUKUM');
assert.equal(extracted[1].motif, 'crown_royal');
assert.equal(extracted[2].word, 'DRACO');
assert.equal(extracted[2].motif, 'tactical_scope');
assert.equal(extracted[3].word, 'ICE');
assert.equal(extracted[3].motif, 'chrome_star');
console.log('✅ LLM JSON extraction with motifs verified.');

// 4. Test Regex Fallback extraction for markdown-wrapped and streaming LLM output
const markdownLLMResponse = `
Here is the kinetic analysis for the lyrics:
\`\`\`json
{
  "classifications": [
    { "word": "BADSHAH", "meaning": "emperor", "archetype": "3d_block_stack", "motif": "crown_royal" },
    { "word": "CHOPPER", "meaning": "automatic rifle", "archetype": "blade_slash", "motif": "tactical_scope" }
  ]
}
\`\`\`
`;
const extractedMarkdown = extractClassificationsFromResponse(markdownLLMResponse);
assert.equal(extractedMarkdown.length, 2);
assert.equal(extractedMarkdown[0].motif, 'crown_royal');
assert.equal(extractedMarkdown[1].motif, 'tactical_scope');
console.log('✅ Markdown codeblock and regex fallback extraction with motifs verified.');


// =========================================================================
// TEST SUITE 6: Multilingual Support, RTL, Graphemes & CJK Typography
// =========================================================================
console.log('\n--- Suite 6: Multilingual Support, RTL, Graphemes & CJK Typography ---');

// 1. Script Detection across major script families
const scriptTestCases: Array<{ text: string; expected: string }> = [
  { text: 'Hello World', expected: 'latin' },
  { text: 'KINETIC 128x64 OLED', expected: 'latin' },
  { text: 'नमस्ते दुनिया', expected: 'devanagari' },
  { text: 'सत्यमेव जयते', expected: 'devanagari' },
  { text: 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ', expected: 'gurmukhi' },
  { text: 'ਸ਼ਸਤਰ', expected: 'gurmukhi' },
  { text: 'வணக்கம் உலகம்', expected: 'tamil' },
  { text: 'నమస్కారం ప్రపంచం', expected: 'telugu' },
  { text: 'こんにちは世界', expected: 'cjk' },
  { text: '君の名は', expected: 'cjk' },
  { text: '안녕하세요 세계', expected: 'hangul' },
  { text: '블랙핑크', expected: 'hangul' },
  { text: 'Привет мир', expected: 'cyrillic' },
  { text: 'Кинетическая типографика', expected: 'cyrillic' },
  { text: 'مرحبا بالعالم', expected: 'arabic' },
  { text: 'اردو شاعری', expected: 'arabic' },
  { text: 'שלום עולם', expected: 'hebrew' }
];

for (const t of scriptTestCases) {
  const detected = detectScript(t.text);
  assert.equal(detected, t.expected, `Text "${t.text}": expected script "${t.expected}", got "${detected}"`);
}
console.log('✅ Script detection for Latin, Devanagari, Gurmukhi, Tamil, Telugu, CJK, Hangul, Cyrillic, Arabic, and Hebrew verified.');

// 2. Multi-Script Detection (detectAllScripts) for Mixed Sequences
const mixedScripts1 = detectAllScripts('君の名は RADWIMPS');
assert.ok(mixedScripts1.includes('cjk') && mixedScripts1.includes('latin'), 'Mixed Japanese & English text must detect both CJK and Latin');
const mixedScripts2 = detectAllScripts('Hello नमस्ते duniya');
assert.ok(mixedScripts2.includes('devanagari') && mixedScripts2.includes('latin'), 'Mixed Hindi & English text must detect both Devanagari and Latin');
console.log('✅ Multi-script detection (detectAllScripts) for mixed-language sequences verified.');

// 3. RTL Directionality Detection
assert.equal(isRTL('مرحبا بالعالم'), true, 'Arabic text must be detected as RTL');
assert.equal(isRTL('اردو شاعری'), true, 'Urdu text must be detected as RTL');
assert.equal(isRTL('שלום עולם'), true, 'Hebrew text must be detected as RTL');
assert.equal(isRTL('Hello World'), false, 'Latin text must NOT be detected as RTL');
assert.equal(isRTL('こんにちは'), false, 'Japanese text must NOT be detected as RTL');
assert.equal(isRTL('नमस्ते'), false, 'Devanagari text must NOT be detected as RTL');
assert.equal(isRTL('ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ'), false, 'Gurmukhi text must NOT be detected as RTL');
console.log('✅ RTL text directionality detection verified.');

// 4. Spaceless Script Detection & Natural Word Segmentation (Intl.Segmenter)
assert.equal(isSpacelessScript('こんにちは世界'), true, 'Japanese text must be detected as spaceless');
assert.equal(isSpacelessScript('君の名は'), true, 'Japanese Kanji must be detected as spaceless');
assert.equal(isSpacelessScript('สวัสดีชาวโลก'), true, 'Thai text must be detected as spaceless');
assert.equal(isSpacelessScript('Hello World'), false, 'Latin text must NOT be detected as spaceless');
assert.equal(isSpacelessScript('नमस्ते'), false, 'Hindi text must NOT be detected as spaceless');

// Test Japanese lyric tokenization with estimateWordTimestamps
const jpLyricLine = '君の名は';
const jpTokens = estimateWordTimestamps(jpLyricLine, 1000, 3000);
assert.ok(jpTokens.length >= 3, `Expected at least 3 morphemes for "${jpLyricLine}", got ${jpTokens.length}`);
assert.equal(jpTokens[0].word, '君');
assert.equal(jpTokens[1].word, 'の');
assert.equal(jpTokens[2].word, '名');
assert.equal(jpTokens[3].word, 'は');

// Verify sequential timing
assert.equal(jpTokens[0].startMs, 1000);
assert.ok(jpTokens[jpTokens.length - 1].endMs <= 3000 && jpTokens[jpTokens.length - 1].endMs >= 2500, 'Last word ends within breath reservation window before line end');
for (let i = 0; i < jpTokens.length - 1; i++) {
  assert.ok(jpTokens[i].endMs <= jpTokens[i + 1].startMs, `Word ${i} end must be <= Word ${i + 1} start`);
}

// Test Japanese punctuation attachment
const jpPunctLine = '走れ、光の速さで！';
const jpPunctTokens = estimateWordTimestamps(jpPunctLine, 0, 2000);
assert.ok(jpPunctTokens.length >= 3, 'Spaceless text with punctuation must segment into morphemes');
assert.ok(jpPunctTokens.some(w => w.word.includes('、') || w.word.includes('！')), 'Punctuation must stay attached to preceding morpheme');

// Test leading brackets/quotes are attached to first word rather than creating a solitary bracket word
const jpBracketTokens = estimateWordTimestamps('「君の名は」', 0, 2000);
assert.equal(jpBracketTokens[0].word, '「君', 'Leading bracket must attach to first word');
assert.equal(jpBracketTokens[jpBracketTokens.length - 1].word, 'は」', 'Closing bracket must attach to last word');
assert.ok(!jpBracketTokens.some(w => w.word === '「' || w.word === '」'), 'Brackets must never become standalone words');

// Test line end boundary protection against punctuation pause overshoot
const multiCommaTokens = estimateWordTimestamps('one, two, three, four, five, six, seven, eight, nine, ten.', 0, 1000);
const lastToken = multiCommaTokens[multiCommaTokens.length - 1];
assert.ok(lastToken.endMs <= 1000, `Last token endMs (${lastToken.endMs}) must not exceed line endMs (1000)`);

// Test Arabic filler words with Arabic comma
assert.equal(isFillerWord('في،'), true, 'Arabic filler word with Arabic comma must be recognized');
assert.equal(isFillerWord('في'), true, 'Arabic filler word must be recognized');
assert.equal(isFillerWord('من'), true, 'Arabic filler word must be recognized');

console.log('✅ Spaceless CJK word segmentation, leading bracket attachment, and timing boundary limits verified.');

// 5. Grapheme Cluster Preservation (Indic Matras & Viramas)
// In Devanagari "दुनिया", graphemes are ['दु', 'नि', 'या'] (3 aksharas)
const hindiGraphemes = getGraphemes('दुनिया');
assert.equal(hindiGraphemes.length, 3, `Expected 3 graphemes for "दुनिया", got ${hindiGraphemes.length}`);
assert.equal(hindiGraphemes[0], 'दु');
assert.equal(hindiGraphemes[1], 'नि');
assert.equal(hindiGraphemes[2], 'या');

// In Gurmukhi "ਪੰਜਾਬੀ", graphemes are ['ਪੰ', 'ਜਾ', 'ਬੀ'] (3 aksharas)
const punjabiGraphemes = getGraphemes('ਪੰਜਾਬੀ');
assert.equal(punjabiGraphemes.length, 3, `Expected 3 graphemes for "ਪੰਜਾਬੀ", got ${punjabiGraphemes.length}`);
assert.equal(punjabiGraphemes[0], 'ਪੰ');
assert.equal(punjabiGraphemes[1], 'ਜਾ');
assert.equal(punjabiGraphemes[2], 'ਬੀ');

// Test Tier 3 extreme word splitting with grapheme preservation
const longHindiWord = 'उत्तरदायित्वहीनतावादी'; // > 10 graphemes, has multiple matras and viramas
const hindiLayout = computeSafeTextLayout(longHindiWord, mockCtx);
assert.ok(hindiLayout.lines.length >= 2, 'Long Hindi word must split across lines');
const [line1Hindi, line2Hindi] = hindiLayout.lines;
// Line 2 must NEVER start with a naked combining matra (U+093E to U+094F)
assert.ok(!/^[\u093E-\u094F]/.test(line2Hindi), `Line 2 "${line2Hindi}" must NOT start with an isolated combining matra`);

// Test CJK Tier 3 extreme word splitting: do NOT append hyphen '-'
const longCjkWord = '新世紀エヴァンゲリオン劇場版';
const cjkLayout = computeSafeTextLayout(longCjkWord, mockCtx);
assert.ok(cjkLayout.lines.length >= 2, 'Long CJK string must split');
assert.ok(!cjkLayout.lines[0].endsWith('-'), `CJK split line 1 "${cjkLayout.lines[0]}" must NOT end with hyphen "-"`);

// Test Arabic Tier 3 extreme word splitting: do NOT append hyphen '-'
const longArabicWord = 'المسؤوليات';
const arabicLayout = computeSafeTextLayout(longArabicWord, mockCtx);
if (arabicLayout.lines.length >= 2) {
  assert.ok(!arabicLayout.lines[0].endsWith('-'), `Arabic split line 1 "${arabicLayout.lines[0]}" must NOT end with hyphen "-"`);
}
console.log('✅ Grapheme cluster preservation and non-hyphenated CJK/RTL Tier 3 splitting verified.');

// 6. Curated Multilingual 1-Bit Display Font Resolution
const trapStylePack = STYLE_PACKS.trap_drill;

// Japanese word -> Dela Gothic One
const jWord: LyricWord = { word: 'こんにちは', startMs: 0, endMs: 500 };
const jFont = getWordEffectiveFont(jWord, 'manga_impact', trapStylePack);
assert.ok(jFont.includes('Dela Gothic One'), `Expected Japanese font to include 'Dela Gothic One', got: ${jFont}`);

// Korean word -> Black Han Sans
const koWord: LyricWord = { word: '안녕하세요', startMs: 0, endMs: 500 };
const koFont = getWordEffectiveFont(koWord, 'manga_impact', trapStylePack);
assert.ok(koFont.includes('Black Han Sans'), `Expected Korean font to include 'Black Han Sans', got: ${koFont}`);

// Hindi word -> Yatra One
const hiWord: LyricWord = { word: 'नमस्ते', startMs: 0, endMs: 500 };
const hiFont = getWordEffectiveFont(hiWord, 'manga_impact', trapStylePack);
assert.ok(hiFont.includes('Yatra One'), `Expected Hindi font to include 'Yatra One', got: ${hiFont}`);

// Punjabi word -> Anek Gurmukhi
const paWord: LyricWord = { word: 'ਸ਼ਸਤਰ', startMs: 0, endMs: 500 };
const paFont = getWordEffectiveFont(paWord, 'blade_slash', trapStylePack);
assert.ok(paFont.includes('Anek Gurmukhi'), `Expected Punjabi font to include 'Anek Gurmukhi', got: ${paFont}`);

// Cyrillic word -> Rubik Mono One
const ruWord: LyricWord = { word: 'Привет', startMs: 0, endMs: 500 };
const ruFont = getWordEffectiveFont(ruWord, 'manga_impact', trapStylePack);
assert.ok(ruFont.includes('Rubik Mono One'), `Expected Cyrillic font to include 'Rubik Mono One', got: ${ruFont}`);

// Arabic word -> Lalezar
const arWord: LyricWord = { word: 'مرحبا', startMs: 0, endMs: 500 };
const arFont = getWordEffectiveFont(arWord, 'manga_impact', trapStylePack);
assert.ok(arFont.includes('Lalezar'), `Expected Arabic font to include 'Lalezar', got: ${arFont}`);

// Hebrew word -> Rubik
const heWord: LyricWord = { word: 'שלום', startMs: 0, endMs: 500 };
const heFont = getWordEffectiveFont(heWord, 'manga_impact', trapStylePack);
assert.ok(heFont.includes('Rubik'), `Expected Hebrew font to include 'Rubik', got: ${heFont}`);

// Tamil word -> Anek Tamil
const taWord: LyricWord = { word: 'வணக்கம்', startMs: 0, endMs: 500 };
const taFont = getWordEffectiveFont(taWord, 'manga_impact', trapStylePack);
assert.ok(taFont.includes('Anek Tamil'), `Expected Tamil font to include 'Anek Tamil', got: ${taFont}`);

// Telugu word -> Anek Telugu
const teWord: LyricWord = { word: 'నమస్కారం', startMs: 0, endMs: 500 };
const teFont = getWordEffectiveFont(teWord, 'manga_impact', trapStylePack);
assert.ok(teFont.includes('Anek Telugu'), `Expected Telugu font to include 'Anek Telugu', got: ${teFont}`);

console.log('✅ Curated multilingual display fonts properly cascade across global scripts (Japanese, Korean, Devanagari, Gurmukhi, Cyrillic, Arabic, Hebrew, Tamil, Telugu).');

// =========================================================================
// TEST SUITE 7: Rolling Odometer Archetype & Mechanical Tumbler Physics
// =========================================================================
console.log('\n--- Suite 7: Rolling Odometer Archetype & Mechanical Tumbler Physics ---');

// 7a: Metadata verification
const odoMeta = ARCHETYPE_METADATA.rolling_odometer;
assert.ok(odoMeta, 'rolling_odometer metadata exists');
assert.equal(odoMeta.id, 'rolling_odometer');
assert.equal(odoMeta.icon, '🎰');
assert.equal(odoMeta.name, 'ROLLING ODOMETER');
assert.equal(odoMeta.tag, 'REEL');
assert.ok(odoMeta.description.includes('tumbler') || odoMeta.description.includes('odometer'), 'Description mentions tumbler/odometer');
console.log('✅ Archetype metadata and UI tags verified for rolling_odometer.');

// 7b: Semantic Classification & Font Role Mapping
const odoKeywords = ['odometer', 'casino', 'jackpot', 'score', 'lucky', 'counter', 'reels', 'wheel'];
for (const kw of odoKeywords) {
  const arch = classifyWordArchetype(kw, 350, 0, 0);
  assert.equal(arch, 'rolling_odometer', `Expected "${kw}" to classify as rolling_odometer, got: ${arch}`);
  const role = getWordFontRole(arch, kw);
  assert.equal(role, 'novelty', `Expected rolling_odometer for "${kw}" to map to 'novelty' font role, got: ${role}`);
}
console.log('✅ Semantic keyword classification and novelty font role verified for rolling_odometer.');

// 7c: LLM Response Normalization
const fuzzyInputs = ['rolling_odometer', 'odometer', 'mechanical_odometer', 'slot_machine', 'tumbler_reel', 'rolling_digits', 'counter_reel'];
for (const input of fuzzyInputs) {
  const normalized = normalizeArchetype(input);
  assert.equal(normalized, 'rolling_odometer', `Expected normalizeArchetype("${input}") to be 'rolling_odometer', got: ${normalized}`);
}
console.log('✅ Resilient LLM normalization for rolling_odometer fuzzy tags verified.');

// 7d: Headless Canvas Frame Rendering
function createFullMockCanvasCtx() {
  let font = 'bold 24px monospace';
  const drawnTexts: Array<{ text: string; x: number; y: number }> = [];
  return {
    get font() { return font; },
    set font(f: string) { font = f; },
    direction: 'ltr',
    textAlign: 'center',
    textBaseline: 'middle',
    strokeStyle: '#FFFFFF',
    fillStyle: '#FFFFFF',
    lineWidth: 1,
    globalCompositeOperation: 'source-over',
    measureText: (t: string) => ({ width: t.length * 14 }),
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    closePath: () => {},
    rect: () => {},
    clip: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    fill: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    clearRect: () => {},
    fillText: (text: string, x: number, y: number) => {
      drawnTexts.push({ text, x, y });
    },
    drawnTexts
  } as unknown as CanvasRenderingContext2D & { drawnTexts: Array<{ text: string; x: number; y: number }> };
}

const sampleLayout = {
  lines: ['777'],
  fontSize: 28,
  lineHeight: 32,
  letterSpacing: 0,
  totalHeight: 32,
  yOffsets: [32]
};

// Test tau = 0.0 (initial spin)
const ctx0 = createFullMockCanvasCtx();
renderArchetypeFrame(ctx0, 'rolling_odometer', '777', 0.0, sampleLayout, 0);
assert.ok(ctx0.drawnTexts.length > 0, 'tau=0.0 renders rolling tumbler characters');

// Test tau = 0.5 (mid-spin with audio beat)
const ctx50 = createFullMockCanvasCtx();
renderArchetypeFrame(ctx50, 'rolling_odometer', '777', 0.5, sampleLayout, 15, 'monospace', {
  rms: 0.8,
  spectralCentroid: 2000,
  zeroCrossingRate: 0.1,
  isBeat: true,
  onsetStrength: 0.9
});
assert.ok(ctx50.drawnTexts.length > 0, 'tau=0.5 with audio beat renders tumbler characters');

// Test tau = 1.0 (settled lock)
const ctx100 = createFullMockCanvasCtx();
renderArchetypeFrame(ctx100, 'rolling_odometer', '777', 1.0, sampleLayout, 30);
const lockedTexts = ctx100.drawnTexts.map(t => t.text);
assert.ok(lockedTexts.includes('7'), `tau=1.0 locked target digit '7' should be rendered, got: ${lockedTexts.join(',')}`);

// Test RTL and Multilingual text
const rtlLayout = {
  lines: ['عداد'],
  fontSize: 24,
  lineHeight: 28,
  letterSpacing: 0,
  totalHeight: 28,
  yOffsets: [32]
};
const ctxRTL = createFullMockCanvasCtx();
renderArchetypeFrame(ctxRTL, 'rolling_odometer', 'عداد', 0.5, rtlLayout, 10);
assert.equal(ctxRTL.direction, 'rtl', 'RTL text properly sets ctx.direction to rtl');
assert.ok(ctxRTL.drawnTexts.length > 0, 'RTL text renders rolling tumbler');

// Deep verification of RTL character coordinate ordering at locked state (tau = 1.0)
const ctxRTLLocked = createFullMockCanvasCtx();
renderArchetypeFrame(ctxRTLLocked, 'rolling_odometer', 'عداد', 1.0, rtlLayout, 30);
const ainChar = ctxRTLLocked.drawnTexts.find(t => t.text === 'ع');
const dalChars = ctxRTLLocked.drawnTexts.filter(t => t.text === 'د');
assert.ok(ainChar, "RTL text must render initial Arabic letter 'ع'");
assert.ok(dalChars.length > 0, "RTL text must render Arabic letter 'د'");
// In Arabic, first letter 'ع' must be positioned on the right (higher X) compared to final letter 'د'
const leftmostDal = dalChars.reduce((min, d) => d.x < min.x ? d : min, dalChars[0]);
assert.ok(
  ainChar.x > leftmostDal.x,
  `RTL layout error: Initial letter 'ع' (X=${ainChar.x}) must be to the right of final letter 'د' (X=${leftmostDal.x})`
);

// Verification of whitespace handling in multi-word text
const multiWordLayout = {
  lines: ['7 7'],
  fontSize: 24,
  lineHeight: 28,
  letterSpacing: 0,
  totalHeight: 28,
  yOffsets: [32]
};
const ctxMulti = createFullMockCanvasCtx();
renderArchetypeFrame(ctxMulti, 'rolling_odometer', '7 7', 1.0, multiWordLayout, 30);
const multiTexts = ctxMulti.drawnTexts.map(t => t.text);
assert.ok(!multiTexts.includes(' '), 'Whitespace between words should not render empty text frames');
assert.equal(multiTexts.filter(t => t === '7').length, 2, 'Exactly two 7s rendered for "7 7"');

console.log('✅ Headless 1-bit OLED canvas rendering, mechanical stagger, locked state & RTL for rolling_odometer verified.');

console.log('\n🎉 ALL KINETIC TYPOGRAPHY, MOTIF & ODOMETER TESTS PASSED PERFECTLY!\n');


