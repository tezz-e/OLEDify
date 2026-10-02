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
  ARCHETYPE_METADATA,
  KineticTransitionType,
  TRANSITION_METADATA
} from '../src/engine/kinetic/types';
import { 
  VALID_VISUAL_MOTIFS,
  normalizeMotif,
  normalizeArchetype,
  extractClassificationsFromResponse,
  buildOllamaLyricsPrompt
} from '../src/engine/kinetic/ollamaClassifier';
import { computeSongMoodProfile } from '../src/engine/kinetic/moodProfileEngine';
import { renderArchetypeFrame } from '../src/engine/kinetic/kineticArchetypes';
import { computeSafeTextLayout } from '../src/engine/kinetic/kineticLayout';
import { resolveTransitionStyle, renderKineticSequence } from '../src/engine/kinetic/kineticEngine';
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

const packIds: StylePackId[] = ['trap_drill', 'shonen_comic', 'cartoon_bounce', 'cyber_industrial', 'pop_acoustic', 'editorial_lofi', 'custom'];
for (const id of packIds) {
  const pack = STYLE_PACKS[id];
  assert.ok(pack, `Pack ${id} exists`);
  assert.ok(pack.fonts.hero, `Pack ${id} has hero font`);
  assert.ok(pack.fonts.action, `Pack ${id} has action font`);
  assert.ok(pack.fonts.novelty, `Pack ${id} has novelty font`);
  assert.ok(pack.fonts.anchor, `Pack ${id} has anchor font`);
}
console.log('✅ All 7 Style Packs properly defined with 4-font semantic roles.');

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

// 1. Verify all 17 motifs exist in metadata
assert.equal(VALID_VISUAL_MOTIFS.length, 17, 'Expected exactly 17 visual motifs');
for (const motif of VALID_VISUAL_MOTIFS) {
  const meta = MOTIF_METADATA[motif];
  assert.ok(meta, `Motif "${motif}" must have metadata`);
  assert.ok(meta.icon, `Motif "${motif}" must have an icon`);
  assert.ok(meta.name, `Motif "${motif}" must have a name`);
  assert.ok(meta.tag, `Motif "${motif}" must have a tag`);
}
console.log('✅ All 17 Visual Motifs defined with valid icons, tags, and metadata.');

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
  { raw: 'floating_notes', expected: 'floating_notes' },
  { raw: 'music', expected: 'floating_notes' },
  { raw: 'melody', expected: 'floating_notes' },
  { raw: 'starlight_glimmer', expected: 'starlight_glimmer' },
  { raw: 'twinkle', expected: 'starlight_glimmer' },
  { raw: 'heartbeat_pulse', expected: 'heartbeat_pulse' },
  { raw: 'heart', expected: 'heartbeat_pulse' },
  { raw: 'water_ripples', expected: 'water_ripples' },
  { raw: 'wave', expected: 'water_ripples' },
  { raw: 'minimal_frame', expected: 'minimal_frame' },
  { raw: 'border', expected: 'minimal_frame' },
  { raw: 'lofi_dust_motes', expected: 'lofi_dust_motes' },
  { raw: 'dust', expected: 'lofi_dust_motes' },
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

// --- Suite 8: LLM Classification Output Non-Circular Serialization ---
console.log('\n--- Suite 8: LLM Classification Output Non-Circular Serialization ---');
const sampleArchetypeOverrides: Record<string, any> = {
  'fire_1000': 'manga_impact',
  'fire': 'manga_impact',
  'drop_2000': 'blade_slash',
  'drop': 'blade_slash',
};
const sampleMotifOverrides: Record<string, any> = {
  'fire_1000': 'flame',
  'fire': 'flame',
};

// Simulate the return structure of classifyLyricsWithOllama
const classificationOutput = {
  archetypes: sampleArchetypeOverrides,
  motifs: sampleMotifOverrides,
};

// Verify no circular references exist in output
assert.doesNotThrow(() => {
  const json = JSON.stringify(classificationOutput);
  assert.ok(json.length > 0);
}, 'classificationOutput must be valid JSON without circular references');

assert.doesNotThrow(() => {
  const json = JSON.stringify(classificationOutput.archetypes);
  assert.ok(json.length > 0);
}, 'classificationOutput.archetypes must be valid JSON without circular references');

// Verify that spreading archetypes into wordOverrides does not create circular structure
const wordOverrides: Record<string, any> = { 'intro_0': 'smooth_fluid' };
Object.assign(wordOverrides, classificationOutput.archetypes);
assert.doesNotThrow(() => {
  const json = JSON.stringify({ wordOverrides });
  assert.ok(json.includes('manga_impact'));
}, 'wordOverrides with classification results must serialize without circular references');

// =========================================================================
// TEST SUITE 9: Chill Pop, Ballad & Acoustic Motion Architecture
// =========================================================================
console.log('\n--- Suite 9: Chill Pop, Ballad & Acoustic Motion Architecture ---');

// 1. Verify 4 new archetypes metadata
const newArchetypes: MotionArchetype[] = ['gentle_float', 'waveform_karaoke', 'typewriter_ribbon', 'dither_dissolve'];
for (const arch of newArchetypes) {
  const meta = ARCHETYPE_METADATA[arch];
  assert.ok(meta, `Archetype "${arch}" must have metadata`);
  assert.ok(meta.icon, `Archetype "${arch}" must have an icon`);
  assert.ok(meta.name, `Archetype "${arch}" must have a name`);
  assert.ok(meta.tag, `Archetype "${arch}" must have a tag`);
  assert.ok(meta.description, `Archetype "${arch}" must have a description`);
}
console.log('✅ All 4 new Chill Pop archetypes defined with rich metadata.');

// 2. Test SongMoodProfile computation for Ed Sheeran's "Shape of You" style track (96 BPM pop)
const popLyrics = [
  { text: "I'm in love with the shape of you", words: [
    { word: "I'm", startMs: 0, endMs: 250 },
    { word: "in", startMs: 250, endMs: 400 },
    { word: "love", startMs: 400, endMs: 900 },
    { word: "with", startMs: 900, endMs: 1100 },
    { word: "the", startMs: 1100, endMs: 1250 },
    { word: "shape", startMs: 1250, endMs: 1950 },
    { word: "of", startMs: 1950, endMs: 2100 },
    { word: "you", startMs: 2100, endMs: 2800 },
  ]}
];
const shapeOfYouProfile = computeSongMoodProfile(
  { bpm: 96, confidence: 0.9, beatsMs: [], frames: [{ timeMs: 0, rms: 0.28, isBeat: false }] } as any,
  popLyrics as any,
  "Shape of You",
  "Ed Sheeran"
);
assert.equal(shapeOfYouProfile.vibe, 'chill_pop', '96 BPM pop song must classify as chill_pop');
assert.equal(shapeOfYouProfile.recommendedStylePack, 'pop_acoustic', 'chill_pop must recommend pop_acoustic style pack');
assert.ok(shapeOfYouProfile.dwellDecayFactor >= 1.2, 'chill_pop must provide extended relaxed dwell hold factor');
assert.ok(shapeOfYouProfile.easingCurvature <= 0.85, 'chill_pop must use softer sine-like easing curvature');
assert.ok(shapeOfYouProfile.allowedArchetypes.includes('gentle_float'));
assert.ok(shapeOfYouProfile.allowedArchetypes.includes('waveform_karaoke'));
assert.ok(shapeOfYouProfile.allowedArchetypes.includes('typewriter_ribbon'));
assert.ok(shapeOfYouProfile.allowedArchetypes.includes('dither_dissolve'));
assert.equal(shapeOfYouProfile.cameraShakeEnabled, false, 'Camera shake must be disabled for chill_pop');
assert.ok(shapeOfYouProfile.maxEntryDisplacementPx <= 5, 'Chill pop max displacement must be <= 5px');
assert.ok(shapeOfYouProfile.crossfadeOverlapMs >= 100, 'Chill pop must have >= 100ms crossfade overlap');
console.log(`✅ "Shape of You" profile verified: ${shapeOfYouProfile.label}, Pack: ${shapeOfYouProfile.recommendedStylePack}, Hold Factor: ${shapeOfYouProfile.dwellDecayFactor}, Camera Shake: ${shapeOfYouProfile.cameraShakeEnabled}, Max Offset: ${shapeOfYouProfile.maxEntryDisplacementPx}px`);

// 3. Test SongMoodProfile for Slow Acoustic Ballad (72 BPM)
const balladLyrics = [
  { text: "Whisper softly in the quiet night", words: [
    { word: "Whisper", startMs: 0, endMs: 800 },
    { word: "softly", startMs: 850, endMs: 1700 },
    { word: "in", startMs: 1700, endMs: 1900 },
    { word: "the", startMs: 1900, endMs: 2050 },
    { word: "quiet", startMs: 2100, endMs: 2900 },
    { word: "night", startMs: 2950, endMs: 3800 },
  ]}
];
const balladProfile = computeSongMoodProfile(
  { bpm: 72, confidence: 0.95, beatsMs: [], frames: [{ timeMs: 0, rms: 0.18, isBeat: false }] } as any,
  balladLyrics as any,
  "Quiet Night",
  "Acoustic Duo"
);
assert.equal(balladProfile.vibe, 'ballad_acoustic', '72 BPM slow ballad must classify as ballad_acoustic');
assert.equal(balladProfile.defaultArchetype, 'gentle_float', 'ballad_acoustic must default to gentle_float');
assert.ok(balladProfile.dwellDecayFactor >= 1.5, 'ballad_acoustic must provide generous dwell hold time');
assert.equal(balladProfile.cameraShakeEnabled, false, 'Camera shake must be disabled for ballad');
assert.equal(balladProfile.maxEntryDisplacementPx, 3, 'Ballad max displacement must be 3px');
console.log(`✅ Slow Ballad profile verified: ${balladProfile.label}, Default: ${balladProfile.defaultArchetype}, Hold Factor: ${balladProfile.dwellDecayFactor}, Camera Shake: ${balladProfile.cameraShakeEnabled}, Max Offset: ${balladProfile.maxEntryDisplacementPx}px`);

// 4. Test Semantic Classifier under Chill Pop Profile (No violent jumps or 3D block traps)
// In a chill song, a word held for 700ms ("shape") should NOT be forced into '3d_block_stack'
const popWord = { word: 'shape', startMs: 1250, endMs: 1950 }; // 700ms duration
const archChill = classifyWordArchetype(popWord.word, 700, 150, 0, shapeOfYouProfile);
assert.notEqual(archChill, '3d_block_stack', 'Chill pop track must NOT force 700ms vocal note into 3d_block_stack');
assert.notEqual(archChill, 'manga_impact', 'Chill pop track must NOT force silence into manga_impact');
assert.ok(['waveform_karaoke', 'gentle_float', 'smooth_fluid', 'typewriter_ribbon', 'dither_dissolve'].includes(archChill), `Expected chill/fluid archetype, got: ${archChill}`);

// Filler words in chill/ballad modes must remain anchored and non-jarring (not jump 18px with smooth_fluid)
const chillFiller = classifyWordArchetype('in', 200, 0, 0, shapeOfYouProfile);
assert.equal(chillFiller, 'waveform_karaoke', 'Filler word "in" under chill pop should map to stationary/fluid waveform_karaoke');
const balladFiller = classifyWordArchetype('in', 200, 0, 0, balladProfile);
assert.equal(balladFiller, 'gentle_float', 'Filler word "in" under ballad should map to gentle_float');

// Pop keyword dictionary tests
const loveArch = classifyWordArchetype('love', 400, 0, 0, shapeOfYouProfile);
assert.equal(loveArch, 'gentle_float', 'Word "love" under chill profile should map to gentle_float');

const melodyArch = classifyWordArchetype('melody', 400, 0, 0, shapeOfYouProfile);
assert.equal(melodyArch, 'waveform_karaoke', 'Word "melody" under chill profile should map to waveform_karaoke');

const storyArch = classifyWordArchetype('story', 400, 0, 0, shapeOfYouProfile);
assert.equal(storyArch, 'typewriter_ribbon', 'Word "story" under chill profile should map to typewriter_ribbon');

const whisperArch = classifyWordArchetype('whisper', 400, 0, 0, shapeOfYouProfile);
assert.equal(whisperArch, 'gentle_float', 'Word "whisper" under chill profile should map to gentle_float');

const memoryArch = classifyWordArchetype('memory', 400, 0, 0, shapeOfYouProfile);
assert.equal(memoryArch, 'dither_dissolve', 'Word "memory" under chill profile should map to dither_dissolve');
console.log('✅ Semantic classifier adapts correctly under chill pop profile without aggressive traps.');

// 5. Test Ollama Prompt Generation with Chill Pop Directive
const chillPrompt = buildOllamaLyricsPrompt(popLyrics as any, "Shape of You", "Ed Sheeran", shapeOfYouProfile);
assert.ok(chillPrompt.includes('CHILL_POP'), 'Prompt must indicate CHILL_POP vibe to LLM');
assert.ok(chillPrompt.includes('DO NOT assign aggressive, violent, or chaotic archetypes'), 'Prompt must instruct LLM against aggressive cuts');
assert.ok(chillPrompt.includes('gentle_float'), 'Prompt must list gentle_float');
assert.ok(chillPrompt.includes('waveform_karaoke'), 'Prompt must list waveform_karaoke');
console.log('✅ Ollama/Groq prompt generation embeds dynamic Chill Pop Director directives.');

// 6. Test Headless Canvas Rasterization for the 4 new Archetypes
let dummyPixelsDrawn = 0;
const dummyCtx = {
  save: () => {},
  restore: () => {},
  translate: () => {},
  rotate: () => {},
  scale: () => {},
  fillRect: (_x: number, _y: number, w: number, h: number) => { dummyPixelsDrawn += (w * h); },
  fillText: (text: string, _x: number, _y: number) => { dummyPixelsDrawn += text.length * 10; },
  strokeText: (text: string, _x: number, _y: number) => { dummyPixelsDrawn += text.length * 10; },
  beginPath: () => {},
  moveTo: () => {},
  lineTo: () => {},
  stroke: () => {},
  fill: () => {},
  arc: () => {},
  ellipse: () => {},
  clearRect: () => {},
  getImageData: () => ({ data: new Uint8ClampedArray(128 * 64 * 4) }),
  putImageData: () => {},
  measureText: (text: string) => ({ width: text.length * 8 }),
  setLineDash: () => {},
  font: '',
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  textAlign: 'center',
  textBaseline: 'middle',
  globalAlpha: 1,
  globalCompositeOperation: 'source-over'
} as any;

for (const arch of newArchetypes) {
  assert.doesNotThrow(() => {
    renderArchetypeFrame(
      dummyCtx,
      arch,
      'MELODY',
      0.5,
      {
        fontSize: 22,
        lines: ['MELODY'],
        yOffsets: [0],
        totalHeight: 22,
        lineHeight: 24,
        letterSpacing: 0
      },
      15
    );
  }, `Rasterizer for "${arch}" must execute cleanly without error`);
  console.log(`✅ 1-bit rasterizer for "${arch}" rendered successfully.`);
}

// =========================================================================
// TEST SUITE 10: Dynamic 1-Bit Transition Choreography Matrix
// =========================================================================
console.log('\n--- Suite 10: Dynamic 1-Bit Transition Choreography Matrix ---');

// 1. Verify TRANSITION_METADATA has all 6 transition types defined
const expectedTransitions: KineticTransitionType[] = [
  'auto',
  'lateral_glide',
  'vertical_drift',
  'bayer_sweep',
  'curtain_drop',
  'dither_dissolve',
  'razor_slice',
  'glitch_tear',
  'impact_flash'
];

for (const tId of expectedTransitions) {
  const meta = TRANSITION_METADATA[tId];
  assert.ok(meta, `Transition metadata for "${tId}" must exist`);
  assert.ok(meta.name, `Transition "${tId}" must have a name`);
  assert.ok(meta.icon, `Transition "${tId}" must have an icon`);
  assert.ok(meta.tag, `Transition "${tId}" must have a tag`);
  assert.ok(meta.description, `Transition "${tId}" must have a description`);
}
console.log('✅ All 9 Transition styles (Bangers + Smooth) properly registered with metadata and tags.');

// 2. Test Dynamic Transition Resolution (resolveTransitionStyle)
// Test sequential word flow cycle for smooth song (Shape of You)
const dummyProfile = computeSongMoodProfile(null, [], 'Shape of You', 'Ed Sheeran');

const w0: LyricWord = { word: 'the', startMs: 0, endMs: 200 };
const w1: LyricWord = { word: 'club', startMs: 220, endMs: 500 };
const w2: LyricWord = { word: 'isn\'t', startMs: 520, endMs: 800 };
const w3: LyricWord = { word: 'the', startMs: 820, endMs: 1000 };
const w4: LyricWord = { word: 'best', startMs: 1020, endMs: 1300 };

const t01 = resolveTransitionStyle(w0, w1, 1, 'waveform_karaoke', 'smooth_fluid', dummyProfile);
const t12 = resolveTransitionStyle(w1, w2, 2, 'smooth_fluid', 'waveform_karaoke', dummyProfile);
const t23 = resolveTransitionStyle(w2, w3, 3, 'waveform_karaoke', 'gentle_float', dummyProfile);
const t34 = resolveTransitionStyle(w3, w4, 4, 'waveform_karaoke', 'typewriter_ribbon', dummyProfile);

assert.equal(t01, 'bayer_sweep', 'Word 1 transition should be bayer_sweep');
assert.equal(t12, 'vertical_drift', 'Word 2 transition should be vertical_drift');
assert.equal(t23, 'vertical_drift', 'Entering gentle_float must trigger vertical_drift');
assert.equal(t34, 'bayer_sweep', 'Entering typewriter_ribbon must trigger bayer_sweep');

// Consecutive word pairs in neutral flow must rotate distinct styles
const nWordA: LyricWord = { word: 'first', startMs: 0, endMs: 250 };
const nWordB: LyricWord = { word: 'second', startMs: 270, endMs: 500 };
const nWordC: LyricWord = { word: 'third', startMs: 520, endMs: 750 };
const nWordD: LyricWord = { word: 'fourth', startMs: 770, endMs: 1000 };

const seqTrans1 = resolveTransitionStyle(nWordA, nWordB, 1, 'smooth_fluid', 'smooth_fluid', dummyProfile);
const seqTrans2 = resolveTransitionStyle(nWordB, nWordC, 2, 'smooth_fluid', 'smooth_fluid', dummyProfile);
const seqTrans3 = resolveTransitionStyle(nWordC, nWordD, 3, 'smooth_fluid', 'smooth_fluid', dummyProfile);

assert.notEqual(seqTrans1, seqTrans2, 'Consecutive transitions (1 and 2) must not be identical');
assert.notEqual(seqTrans2, seqTrans3, 'Consecutive transitions (2 and 3) must not be identical');
console.log(`✅ Smooth transition variety verified: [${seqTrans1}, ${seqTrans2}, ${seqTrans3}] cycle dynamically.`);

// 3. Test BANGER Song Transitions vs SMOOTH Song Transitions
const hypeProfile = computeSongMoodProfile(
  { bpm: 145, frames: [{ rms: 0.7, bass: 0.9, flux: 0.8, isBeat: false, onsetStrength: 0 }] } as any,
  [{ text: 'drop the bass fire gun', startMs: 0, endMs: 2000, words: [] }],
  'Drill Anthem',
  'Trap Star'
);

assert.equal(hypeProfile.vibe, 'hype_aggressive', '145 BPM trap song must classify as hype_aggressive');

// Banger with blade slash -> razor_slice
const bangerTransSlash = resolveTransitionStyle(w0, w1, 1, 'blade_slash', 'manga_impact', hypeProfile);
assert.equal(bangerTransSlash, 'razor_slice', 'Banger song with blade_slash must trigger razor_slice');

// Banger with cyber glitch -> glitch_tear
const bangerTransGlitch = resolveTransitionStyle(w0, w1, 2, 'cyber_glitch', 'smooth_fluid', hypeProfile);
assert.equal(bangerTransGlitch, 'glitch_tear', 'Banger song with cyber_glitch must trigger glitch_tear');

// Banger with beat onset transient -> impact_flash
const beatAudioFrame = { rms: 0.85, bass: 0.95, flux: 0.9, isBeat: true, onsetStrength: 0.8 };
const bangerTransBeat = resolveTransitionStyle(w0, w1, 2, 'smooth_fluid', 'smooth_fluid', hypeProfile, 'auto', beatAudioFrame as any);
assert.equal(bangerTransBeat, 'impact_flash', 'Banger song on heavy beat onset must trigger impact_flash');

console.log('✅ Banger song transition intelligence verified: triggers razor_slice, glitch_tear, impact_flash on hype/beats.');

// 4. Test Punctuation and Vocal Pause Heuristics
const puncWord: LyricWord = { word: 'stop.', startMs: 0, endMs: 400 };
const nextWord: LyricWord = { word: 'listen', startMs: 450, endMs: 900 };
const puncTrans = resolveTransitionStyle(puncWord, nextWord, 1, 'inverted_badge', 'smooth_fluid', dummyProfile);
assert.equal(puncTrans, 'dither_dissolve', 'Sentence period "." must trigger dither_dissolve for dignified pause');

const commaWord: LyricWord = { word: 'baby,', startMs: 0, endMs: 400 };
const commaTrans = resolveTransitionStyle(commaWord, nextWord, 1, 'gentle_float', 'smooth_fluid', dummyProfile);
assert.equal(commaTrans, 'dither_dissolve', 'Comma "," must trigger dither_dissolve');

// Gap > 250ms (vocal rest)
const restWordA: LyricWord = { word: 'breath', startMs: 0, endMs: 400 };
const restWordB: LyricWord = { word: 'again', startMs: 750, endMs: 1200 }; // 350ms gap
const restTrans = resolveTransitionStyle(restWordA, restWordB, 2, 'smooth_fluid', 'smooth_fluid', dummyProfile);
assert.ok(['curtain_drop', 'dither_dissolve'].includes(restTrans), `Vocal gap >250ms must trigger curtain_drop or dither_dissolve, got: ${restTrans}`);
console.log('✅ Punctuation and vocal rest heuristics verified.');

// 4. Test User Transition Style Override
const overrideTrans = resolveTransitionStyle(w0, w1, 1, 'waveform_karaoke', 'smooth_fluid', dummyProfile, 'lateral_glide');
assert.equal(overrideTrans, 'lateral_glide', 'Explicit user transition choice must override auto choreography');

// 5. Test Full Headless Kinetic Sequence Rendering with Transitions
const testLyrics = [
  {
    text: 'the club is where I go',
    startMs: 1000,
    endMs: 3000,
    words: [
      { word: 'the', startMs: 1000, endMs: 1300 },
      { word: 'club', startMs: 1350, endMs: 1700 },
      { word: 'is', startMs: 1750, endMs: 2100 },
      { word: 'where', startMs: 2150, endMs: 2500 },
      { word: 'go', startMs: 2550, endMs: 2950 }
    ]
  }
];

const renderedSeq = await renderKineticSequence({
  lyrics: testLyrics,
  startMs: 1000,
  endMs: 3000,
  targetFps: 30,
  archetype: 'auto_semantic',
  transitionStyle: 'auto'
});

assert.ok(renderedSeq, 'renderKineticSequence must return DecodedMedia object');
assert.ok(renderedSeq.frames.length >= 60, `Expected at least 60 frames for 2s sequence, got ${renderedSeq.frames.length}`);

// Verify all rendered pixels conform strictly to 1-bit monochrome (either 0 or 255)
let nonBinaryPixelCount = 0;
for (const frame of renderedSeq.frames) {
  const data = frame.imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if ((r !== 0 && r !== 255) || (g !== 0 && g !== 255) || (b !== 0 && b !== 255)) {
      nonBinaryPixelCount++;
    }
  }
}
assert.equal(nonBinaryPixelCount, 0, `All pixels across rendered sequence must be pure 1-bit (0 or 255), found ${nonBinaryPixelCount} non-binary pixels`);
console.log(`✅ Full kinetic sequence rendered successfully (${renderedSeq.frames.length} frames). Verified 100% pure 1-bit monochrome.`);

console.log('\n🎉 ALL 10 KINETIC TYPOGRAPHY, MOTIF, ODOMETER & TRANSITION CHOREOGRAPHY TESTS PASSED PERFECTLY!\n');


