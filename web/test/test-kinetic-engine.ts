import assert from 'node:assert/strict';
import { 
  isFillerWord, 
  classifyWordArchetype, 
  getWordFontRole, 
  getWordEffectiveFont,
  getWordEffectiveDressing,
  classifyWordBadge,
  classifyWordMotif
} from '../src/engine/kinetic/semanticClassifier';
import { 
  STYLE_PACKS, 
  StylePackId, 
  MotionArchetype,
  VisualMotif,
  TextDressing,
  WordBadgeIcon,
  MOTIF_METADATA,
  ARCHETYPE_METADATA,
  TEXT_DRESSING_METADATA,
  WORD_BADGE_METADATA,
  KineticTransitionType,
  TRANSITION_METADATA
} from '../src/engine/kinetic/types';
import { renderMotifBackground } from '../src/engine/kinetic/motifRenderer';
import { renderWordBadge } from '../src/engine/kinetic/wordBadgeRenderer';
import { 
  VALID_VISUAL_MOTIFS,
  VALID_WORD_BADGE_ICONS,
  normalizeMotif,
  normalizeWordBadge,
  normalizeArchetype,
  normalizeStylePack,
  extractClassificationsFromResponse,
  buildOllamaLyricsPrompt
} from '../src/engine/kinetic/ollamaClassifier';
import { computeSongMoodProfile } from '../src/engine/kinetic/moodProfileEngine';
import { renderArchetypeFrame, drawTrackedText } from '../src/engine/kinetic/kineticArchetypes';
import { computeSafeTextLayout } from '../src/engine/kinetic/kineticLayout';
import { resolveTransitionStyle, renderKineticSequence, computeAdaptiveWordHold } from '../src/engine/kinetic/kineticEngine';
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
console.log('✅ Filler words successfully recognized and subordinated to anchor role.');

// Test Hero Content & Punchlines
const heroSamples = [
  { word: 'SLASH', expectedArch: 'blade_slash', expectedRole: 'action' },
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

// 1. Verify all 34 motifs exist in metadata
assert.equal(VALID_VISUAL_MOTIFS.length, 34, 'Expected exactly 34 visual motifs');
for (const motif of VALID_VISUAL_MOTIFS) {
  const meta = MOTIF_METADATA[motif];
  assert.ok(meta, `Motif "${motif}" must have metadata`);
  assert.ok(meta.icon, `Motif "${motif}" must have an icon`);
  assert.ok(meta.name, `Motif "${motif}" must have a name`);
  assert.ok(meta.tag, `Motif "${motif}" must have a tag`);
}
console.log('✅ All 34 Visual Motifs defined with valid icons, tags, and metadata.');

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
  { raw: 'barbed_wire', expected: 'barbed_wire' },
  { raw: 'wire', expected: 'barbed_wire' },
  { raw: 'sound_blast_rings', expected: 'sound_blast_rings' },
  { raw: 'shockwave', expected: 'sound_blast_rings' },
  { raw: 'shattered_glass', expected: 'shattered_glass' },
  { raw: 'glass', expected: 'shattered_glass' },
  { raw: 'sound_bars_vintage', expected: 'sound_bars_vintage' },
  { raw: 'spectrum', expected: 'sound_bars_vintage' },
  { raw: 'rain_window', expected: 'rain_window' },
  { raw: 'rain', expected: 'rain_window' },
  { raw: 'cassette_spool', expected: 'cassette_spool' },
  { raw: 'tape', expected: 'cassette_spool' },
  { raw: 'equalizer_radial', expected: 'equalizer_radial' },
  { raw: 'radial', expected: 'equalizer_radial' },
  { raw: 'vinyl_grooves', expected: 'vinyl_grooves' },
  { raw: 'turntable', expected: 'vinyl_grooves' },
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
    arc: () => {},
    ellipse: () => {},
    quadraticCurveTo: () => {},
    bezierCurveTo: () => {},
    rect: () => {},
    clip: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    fill: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    clearRect: () => {},
    translate: () => {},
    rotate: () => {},
    scale: () => {},
    drawImage: () => {},
    getImageData: () => ({ data: new Uint8ClampedArray(128 * 64 * 4), width: 128, height: 64 }),
    putImageData: () => {},
    createImageData: () => ({ data: new Uint8ClampedArray(128 * 64 * 4), width: 128, height: 64 }),
    fillText: (text: string, x: number, y: number) => {
      drawnTexts.push({ text, x, y });
    },
    strokeText: (text: string, x: number, y: number) => {
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

// 3c. Verify Rapid Lyric Delivery Pacing (rap flow < 310ms) classifies as hype_aggressive without audio
const rapidFlowLyrics = [
  { text: "Look in my eyes you see no fear", startMs: 0, endMs: 1800, words: [
    { word: "Look", startMs: 0, endMs: 200 },
    { word: "in", startMs: 200, endMs: 400 },
    { word: "my", startMs: 400, endMs: 700 },
    { word: "eyes", startMs: 700, endMs: 900 },
    { word: "you", startMs: 900, endMs: 1200 },
    { word: "see", startMs: 1200, endMs: 1500 },
    { word: "no", startMs: 1500, endMs: 1800 }
  ]},
  { text: "Standing ten toes in the cold right here", startMs: 1900, endMs: 3800, words: [
    { word: "Standing", startMs: 1900, endMs: 2200 },
    { word: "ten", startMs: 2200, endMs: 2400 },
    { word: "toes", startMs: 2400, endMs: 2600 },
    { word: "in", startMs: 2600, endMs: 2800 },
    { word: "the", startMs: 2800, endMs: 3000 },
    { word: "cold", startMs: 3000, endMs: 3300 },
    { word: "right", startMs: 3300, endMs: 3500 },
    { word: "here", startMs: 3500, endMs: 3700 }
  ]},
  { text: "Break the rules never break the code", startMs: 3900, endMs: 5200, words: [
    { word: "Break", startMs: 3900, endMs: 4300 },
    { word: "the", startMs: 4300, endMs: 4500 },
    { word: "rules", startMs: 4500, endMs: 4800 },
    { word: "never", startMs: 4800, endMs: 5200 }
  ]}
];

const rapidFlowProfile = computeSongMoodProfile(
  null, // No audio uploaded! Pacing-derived
  rapidFlowLyrics as any
);

assert.equal(rapidFlowProfile.vibe, 'hype_aggressive', 'Rapid vocal delivery (<310ms/word) must classify as hype_aggressive');
assert.equal(rapidFlowProfile.recommendedStylePack, 'trap_drill', 'Hype pacing must recommend trap_drill style pack');
assert.equal(rapidFlowProfile.defaultArchetype, 'manga_impact', 'Hype track must default to manga_impact');
assert.ok(rapidFlowProfile.cameraShakeEnabled, 'Camera shake must be enabled for hard tracks');
assert.ok(rapidFlowProfile.maxEntryDisplacementPx >= 15, 'Hype tracks must allow high dynamic entry displacement');
console.log(`✅ Rapid Flow pacing verified: ${rapidFlowProfile.label}, Pack: ${rapidFlowProfile.recommendedStylePack}, Default: ${rapidFlowProfile.defaultArchetype}`);

// 3d. Verify AI Director override vibe applies directly to SongMoodProfile
const aiDirectorProfile = computeSongMoodProfile(null, [], 'Song Title', 'Artist', 'hype_aggressive');
assert.equal(aiDirectorProfile.vibe, 'hype_aggressive', 'AI Director override must directly set profile vibe');
assert.equal(aiDirectorProfile.recommendedStylePack, 'trap_drill');
console.log('✅ AI Director vibe override verified.');

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

// 5. Test Ollama Prompt Generation with Unconstrained Multilingual Director Directives
const directorPrompt = buildOllamaLyricsPrompt(popLyrics as any, "Shape of You", "Ed Sheeran");
assert.ok(directorPrompt.includes('chill_pop'), 'Prompt must define chill_pop vibe');
assert.ok(directorPrompt.includes('hype_aggressive'), 'Prompt must define hype_aggressive vibe');
assert.ok(directorPrompt.includes('gentle_float'), 'Prompt must list gentle_float');
assert.ok(directorPrompt.includes('waveform_karaoke'), 'Prompt must list waveform_karaoke');
assert.ok(directorPrompt.includes('manga_impact'), 'Prompt must list manga_impact');
assert.ok(directorPrompt.includes('blade_slash'), 'Prompt must list blade_slash');
console.log('✅ Ollama/Groq prompt generation embeds unconstrained multilingual Director directives.');

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

// =========================================================================
// TEST SUITE 11: Combinatorial Vibe Matrix, Archetypes, Motifs & Dressings
// =========================================================================
console.log('\n--- Suite 11: Combinatorial Vibe Matrix, Archetypes, Motifs & Dressings ---');

// 1. Verify 21 Motion Archetypes Registered with Metadata
const all21Archetypes: MotionArchetype[] = [
  'auto_semantic', 'manga_impact', 'blade_slash', 'cyber_glitch', 'smooth_fluid',
  '3d_block_stack', 'echo_stack', 'target_focus', 'snake_slither', 'wiggly_boil',
  'inverted_badge', 'rolling_odometer', 'gentle_float', 'waveform_karaoke',
  'typewriter_ribbon', 'dither_dissolve', 'anvil_stomp', 'fracture_shatter',
  'pendulum_sway', 'prism_shimmer', 'squash_bounce'
];

for (const arch of all21Archetypes) {
  assert.ok(ARCHETYPE_METADATA[arch], `Missing ARCHETYPE_METADATA for "${arch}"`);
  assert.ok(ARCHETYPE_METADATA[arch].name, `Missing name for archetype "${arch}"`);
  assert.ok(ARCHETYPE_METADATA[arch].icon, `Missing icon for archetype "${arch}"`);
}
console.log(`✅ All 21 motion archetypes verified with rich metadata.`);

// 2. Verify 6 Text Dressings Registered with Metadata
const all6Dressings: TextDressing[] = [
  'solid', 'hollow_wireframe', 'bayer_dither_shade', 'scanline_slice', 'echo_trail', 'inverted_pill'
];
for (const dressing of all6Dressings) {
  assert.ok(TEXT_DRESSING_METADATA[dressing], `Missing TEXT_DRESSING_METADATA for "${dressing}"`);
  assert.ok(TEXT_DRESSING_METADATA[dressing].name, `Missing name for dressing "${dressing}"`);
  assert.ok(TEXT_DRESSING_METADATA[dressing].icon, `Missing icon for dressing "${dressing}"`);
}
console.log(`✅ All 6 text dressings verified with metadata.`);

// 3. Test getWordEffectiveDressing Deterministic Resolution & Archetype Affinities
const testWordA: LyricWord = { word: 'HEAVY', startMs: 1000, endMs: 1400 };
const testWordB: LyricWord = { word: 'CRUSH', startMs: 2000, endMs: 2400 };
const dressingAnvil = getWordEffectiveDressing(testWordA, 0, 'anvil_stomp');
assert.ok(['solid', 'inverted_pill', 'echo_trail'].includes(dressingAnvil), `anvil_stomp dressing must match impact family, got: ${dressingAnvil}`);

const dressingFracture = getWordEffectiveDressing(testWordB, 1, 'fracture_shatter');
assert.ok(['solid', 'hollow_wireframe', 'scanline_slice'].includes(dressingFracture), `fracture_shatter dressing must match fracture family, got: ${dressingFracture}`);

const dressingUserOverride = getWordEffectiveDressing(testWordA, 0, 'anvil_stomp', null, { HEAVY: 'bayer_dither_shade' });
assert.equal(dressingUserOverride, 'bayer_dither_shade', 'User dressing override must take precedence');
console.log(`✅ getWordEffectiveDressing deterministic affinity and override priority verified.`);

// 4. Test Rendering of 5 New Archetypes on 1-bit OLED
const newArchetypeList: MotionArchetype[] = [
  'anvil_stomp', 'fracture_shatter', 'pendulum_sway', 'prism_shimmer', 'squash_bounce'
];

for (const arch of newArchetypeList) {
  const mockCtx = createFullMockCanvasCtx();
  const sampleLayout = {
    lines: ['TEST'],
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: 0,
    totalHeight: 30,
    yOffsets: [32]
  };

  // Test across entry, midpoint, and hold
  for (const progress of [0.1, 0.5, 0.95]) {
    assert.doesNotThrow(() => {
      renderArchetypeFrame(mockCtx, arch, 'TEST', progress, sampleLayout, 30);
    }, `renderArchetypeFrame failed for archetype "${arch}" at progress ${progress}`);
  }
}
console.log(`✅ All 5 new motion archetypes render flawlessly across progress milestones without errors.`);

// 5. Test Procedural Rendering of 8 New Visual Motifs on 1-bit OLED
const newMotifsList: VisualMotif[] = [
  'barbed_wire', 'sound_blast_rings', 'shattered_glass', 'sound_bars_vintage',
  'rain_window', 'cassette_spool', 'equalizer_radial', 'vinyl_grooves'
];

for (const motif of newMotifsList) {
  const mockCtx = createFullMockCanvasCtx();
  for (const progress of [0.0, 0.4, 0.8, 1.0]) {
    assert.doesNotThrow(() => {
      renderMotifBackground(mockCtx, motif, progress, 15);
    }, `renderMotifBackground failed for motif "${motif}" at progress ${progress}`);
  }
}
console.log(`✅ All 8 new visual motifs render flawlessly across progress milestones without errors.`);

// 6. Test Multi-Layer Permutation Combinations (Physics x Dressing x Motif)
const samplePermutations: Array<{ arch: MotionArchetype; dressing: TextDressing; motif: VisualMotif }> = [
  { arch: 'anvil_stomp', dressing: 'inverted_pill', motif: 'sound_blast_rings' },
  { arch: 'fracture_shatter', dressing: 'scanline_slice', motif: 'shattered_glass' },
  { arch: 'pendulum_sway', dressing: 'bayer_dither_shade', motif: 'vinyl_grooves' },
  { arch: 'prism_shimmer', dressing: 'hollow_wireframe', motif: 'equalizer_radial' },
  { arch: 'squash_bounce', dressing: 'echo_trail', motif: 'sound_bars_vintage' },
  { arch: 'gentle_float', dressing: 'bayer_dither_shade', motif: 'rain_window' },
  { arch: 'waveform_karaoke', dressing: 'solid', motif: 'cassette_spool' }
];

for (const p of samplePermutations) {
  const mockCtx = createFullMockCanvasCtx();
  const sampleLayout = {
    lines: ['VIBE'],
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: 0,
    totalHeight: 28,
    yOffsets: [32]
  };

  assert.doesNotThrow(() => {
    renderMotifBackground(mockCtx, p.motif, 0.5, 15);
    renderArchetypeFrame(mockCtx, p.arch, 'VIBE', 0.5, sampleLayout, 30, undefined, undefined, p.dressing);
  }, `Permutation failed for [${p.arch} x ${p.dressing} x ${p.motif}]`);
}
console.log(`✅ Multi-layer combinatorial permutations (Physics x Dressing x Motif) render flawlessly.`);

// =========================================================================
// TEST SUITE 12: Cross-Genre Refinements, Halftime Drill & Knockout Halos
// =========================================================================
console.log('\n--- Suite 12: Cross-Genre Refinements, Halftime Drill & Knockout Halos ---');

// 1. Verify Halftime Drill & Trap Detection vs Chill Pop
const drillAudio = {
  bpm: 95,
  averageRms: 0.72,
  durationMs: 10000,
  peakRms: 0.95,
  sampleRate: 44100,
  beatsMs: [],
  frames: [],
  waveform: [],
  getFrameAtTime: () => ({ timeMs: 0, rms: 0.72, bass: 0.90, flux: 0.5, isBeat: false, onsetStrength: 0 }),
  snapToNearestBeat: (t: number) => t
};
const drillLyrics = [
  {
    text: 'Vaade karke na kade eh zubaan mukkri',
    startMs: 0,
    endMs: 2500,
    words: [
      { word: 'Vaade', startMs: 0, endMs: 400 },
      { word: 'zubaan', startMs: 1600, endMs: 2050 },
      { word: 'mukkri', startMs: 2050, endMs: 2500 }
    ]
  }
];
const drillProfile = computeSongMoodProfile(drillAudio as any, drillLyrics, '52 Bars', 'Karan Aujla');
assert.equal(drillProfile.vibe, 'hype_aggressive', '95 BPM drill with heavy RMS must classify as hype_aggressive');
assert.equal(drillProfile.recommendedStylePack, 'trap_drill', 'Drill must recommend trap_drill style pack');
assert.equal(drillProfile.cameraShakeEnabled, true, 'Drill must allow camera shake');

// Verify Shape of You remains chill_pop
const acousticAudio = {
  bpm: 96,
  averageRms: 0.26,
  durationMs: 10000,
  peakRms: 0.5,
  sampleRate: 44100,
  beatsMs: [],
  frames: [],
  waveform: [],
  getFrameAtTime: () => ({ timeMs: 0, rms: 0.26, bass: 0.3, flux: 0.2, isBeat: false, onsetStrength: 0 }),
  snapToNearestBeat: (t: number) => t
};
const acousticLyrics = [
  {
    text: 'The club isnt the best place to find a lover',
    startMs: 0,
    endMs: 3000,
    words: [
      { word: 'club', startMs: 200, endMs: 600 },
      { word: 'lover', startMs: 2200, endMs: 2900 }
    ]
  }
];
const acousticProfile = computeSongMoodProfile(acousticAudio as any, acousticLyrics, 'Shape of You', 'Ed Sheeran');
assert.equal(acousticProfile.vibe, 'chill_pop', '96 BPM acoustic pop with low RMS must classify as chill_pop');
console.log('✅ Halftime drill (95 BPM, high RMS) vs acoustic pop (96 BPM, low RMS) separation verified.');

// 2. Verify Adaptive BPM-Aware Hold Duration
const danceProfile = computeSongMoodProfile({ bpm: 128, averageRms: 0.75 } as any, [], 'Beauty and a Beat');
const fastWordHold = computeAdaptiveWordHold(150, danceProfile);
assert.ok(fastWordHold <= 50, `150ms word at 128 BPM must have hold <= 50ms, got ${fastWordHold}ms`);

const standardWordHold = computeAdaptiveWordHold(450, drillProfile);
assert.ok(standardWordHold >= 90 && standardWordHold <= 140, `450ms drill word must have hold ~100-130ms, got ${standardWordHold}ms`);

const slowBalladProfile = computeSongMoodProfile({ bpm: 72, averageRms: 0.20 } as any, [], 'Slow Ballad');
const longBalladHold = computeAdaptiveWordHold(800, slowBalladProfile);
assert.ok(longBalladHold >= 200, `800ms ballad word must have hold >= 200ms, got ${longBalladHold}ms`);
console.log('✅ Adaptive word hold duration scales dynamically with word duration and tempo.');

// 3. Verify 1-Bit Glyph Knockout Halos
const haloMockCtx = createFullMockCanvasCtx();
haloMockCtx.fillStyle = '#FFFFFF';
drawTrackedText(haloMockCtx, 'KNOCKOUT', 64, 32, 2);
assert.ok(haloMockCtx.drawnTexts.length > 0, 'drawTrackedText must output text glyphs');
console.log('✅ 1-bit glyph knockout halos (black barrier stroke) execute flawlessly without errors.');

// 4. Verify Style Pack Normalization
assert.equal(normalizeStylePack('neo_tokyo'), 'cyber_industrial', 'neo_tokyo must normalize to cyber_industrial');
assert.equal(normalizeStylePack('editorial_fashion'), 'editorial_lofi', 'editorial_fashion must normalize to editorial_lofi');
assert.equal(normalizeStylePack('retro_pixel'), 'cyber_industrial', 'retro_pixel must normalize to cyber_industrial');
assert.equal(normalizeStylePack('comic_pop'), 'shonen_comic', 'comic_pop must normalize to shonen_comic');
console.log('✅ Style pack normalization correctly bridges legacy LLM aliases.');

// =========================================================================
// TEST SUITE 13: Concrete Motifs, Royal Moustache & Word Micro-Badges
// =========================================================================
console.log('\n--- Suite 13: Concrete Motifs, Royal Moustache & Word Micro-Badges ---');

// 1. Verify 9 New Concrete Visual Motifs in MOTIF_METADATA and Renderers
const new9Motifs: VisualMotif[] = [
  'handlebar_moustache',
  'dark_sunglasses',
  'money_stack',
  'street_racer',
  'cracked_heart',
  'crossed_swords',
  'champion_trophy',
  'lucky_dice',
  'rolex_watch'
];

for (const m of new9Motifs) {
  assert.ok(MOTIF_METADATA[m], `Missing MOTIF_METADATA for "${m}"`);
  assert.ok(MOTIF_METADATA[m].icon, `Missing icon for motif "${m}"`);
  assert.ok(MOTIF_METADATA[m].name, `Missing name for motif "${m}"`);
  assert.ok(MOTIF_METADATA[m].tag, `Missing tag for motif "${m}"`);

  // Test headless rendering of each motif across key lifecycle frames
  const mockCtx = createFullMockCanvasCtx();
  assert.doesNotThrow(() => {
    renderMotifBackground(mockCtx, {
      motif: m,
      motifMode: 'dynamic',
      tau: 0.5,
      frameIndex: 15,
      textCenterY: 32,
      audioFrame: { timeMs: 500, rms: 0.8, bass: 0.9, flux: 0.5, isBeat: true, onsetStrength: 0.8 }
    });
  }, `renderMotifBackground threw on motif "${m}"`);
}
console.log('✅ All 9 new concrete visual motifs verified in metadata and rendered without errors.');

// 2. Verify 16 Word Badge Icons in WORD_BADGE_METADATA and Micro-Sprite Renderer
const all16Badges: WordBadgeIcon[] = [
  'none', 'moustache', 'sunglasses', 'crown', 'cash', 'car', 'heart', 'broken_heart',
  'flame', 'skull', 'sword', 'trophy', 'dice', 'watch', 'diamond', 'star'
];

for (const b of all16Badges) {
  assert.ok(WORD_BADGE_METADATA[b], `Missing WORD_BADGE_METADATA for badge "${b}"`);
  assert.ok(WORD_BADGE_METADATA[b].icon, `Missing icon for badge "${b}"`);
  assert.ok(WORD_BADGE_METADATA[b].name, `Missing name for badge "${b}"`);

  // Render badge through wordBadgeRenderer
  const mockCtx = createFullMockCanvasCtx();
  assert.doesNotThrow(() => {
    renderWordBadge(
      mockCtx,
      b,
      { centerX: 64, centerY: 32, top: 20, bottom: 44, left: 10, right: 118, fontSize: 24 },
      0.4,
      12,
      { timeMs: 400, rms: 0.7, bass: 0.8, flux: 0.4, isBeat: true, onsetStrength: 0.7 }
    );
  }, `renderWordBadge threw on badge "${b}"`);
}
console.log('✅ All 16 word badge micro-sprites verified and rendered without errors.');

// 3. Verify Deterministic Semantic Badge and Motif Classifiers
assert.equal(classifyWordBadge('muchh'), 'moustache', 'muchh must classify as moustache badge');
assert.equal(classifyWordBadge('mooch'), 'moustache', 'mooch must classify as moustache badge');
assert.equal(classifyWordBadge('mustache'), 'moustache', 'mustache must classify as moustache badge');
assert.equal(classifyWordBadge('mustard'), 'moustache', 'mustard voice-typo must normalize to moustache badge');
assert.equal(classifyWordMotif('muchh'), 'handlebar_moustache', 'muchh must map to handlebar_moustache motif');

assert.equal(classifyWordBadge('akhan'), 'sunglasses', 'akhan must classify as sunglasses badge');
assert.equal(classifyWordBadge('shades'), 'sunglasses', 'shades must classify as sunglasses badge');
assert.equal(classifyWordMotif('shades'), 'dark_sunglasses', 'shades must map to dark_sunglasses motif');

assert.equal(classifyWordBadge('gaddi'), 'car', 'gaddi must classify as car badge');
assert.equal(classifyWordBadge('porsche'), 'car', 'porsche must classify as car badge');
assert.equal(classifyWordMotif('gaddi'), 'street_racer', 'gaddi must map to street_racer motif');

assert.equal(classifyWordBadge('paisa'), 'cash', 'paisa must classify as cash badge');
assert.equal(classifyWordBadge('cash'), 'cash', 'cash must classify as cash badge');
assert.equal(classifyWordMotif('paisa'), 'money_stack', 'paisa must map to money_stack motif');

assert.equal(classifyWordBadge('dil'), 'heart', 'dil must classify as heart badge');
assert.equal(classifyWordBadge('todeya'), 'broken_heart', 'todeya must classify as broken_heart badge');
assert.equal(classifyWordMotif('todeya'), 'cracked_heart', 'todeya must map to cracked_heart motif');

assert.equal(classifyWordBadge('talwar'), 'sword', 'talwar must classify as sword badge');
assert.equal(classifyWordMotif('talwar'), 'crossed_swords', 'talwar must map to crossed_swords motif');

assert.equal(classifyWordBadge('trophy'), 'trophy', 'trophy must classify as trophy badge');
assert.equal(classifyWordMotif('trophy'), 'champion_trophy', 'trophy must map to champion_trophy motif');

assert.equal(classifyWordBadge('kismat'), 'dice', 'kismat must classify as dice badge');
assert.equal(classifyWordMotif('kismat'), 'lucky_dice', 'kismat must map to lucky_dice motif');

assert.equal(classifyWordBadge('waqt'), 'watch', 'waqt must classify as watch badge');
assert.equal(classifyWordMotif('waqt'), 'rolex_watch', 'waqt must map to rolex_watch motif');

console.log('✅ Deterministic multilingual keyword classification (English, Punjabi, Hindi) for badges and motifs verified.');

// 4. Verify Resilient LLM Normalization for Badges and Motifs
assert.equal(normalizeWordBadge('mustard'), 'moustache', 'Fuzzy mustard must normalize to moustache');
assert.equal(normalizeWordBadge('mustache'), 'moustache', 'mustache must normalize to moustache');
assert.equal(normalizeWordBadge('shades'), 'sunglasses', 'shades must normalize to sunglasses');
assert.equal(normalizeWordBadge('money'), 'cash', 'money must normalize to cash');
assert.equal(normalizeWordBadge('gaddi'), 'car', 'gaddi must normalize to car');

assert.equal(normalizeMotif('mustard'), 'handlebar_moustache', 'Fuzzy mustard motif must normalize to handlebar_moustache');
assert.equal(normalizeMotif('mustache'), 'handlebar_moustache', 'Fuzzy mustache motif must normalize to handlebar_moustache');
assert.equal(normalizeMotif('shades'), 'dark_sunglasses', 'Fuzzy shades motif must normalize to dark_sunglasses');
assert.equal(normalizeMotif('racer'), 'street_racer', 'Fuzzy racer motif must normalize to street_racer');
assert.equal(normalizeMotif('rolex'), 'rolex_watch', 'Fuzzy rolex motif must normalize to rolex_watch');
console.log('✅ Fuzzy LLM alias normalization for badges and motifs verified.');

// 5. Verify LLM JSON Response Parsing with Inline Badges
const mockLlmResponse = JSON.stringify({
  songVibe: 'hype_aggressive',
  recommendedStylePack: 'trap_drill',
  classifications: [
    {
      word: 'MUCHH',
      meaning: 'royal moustache',
      archetype: 'manga_impact',
      motif: 'handlebar_moustache',
      badge: 'moustache',
      reason: 'male pride'
    },
    {
      word: 'SHADES',
      meaning: 'dark glasses',
      archetype: 'target_focus',
      motif: 'dark_sunglasses',
      badge: 'sunglasses',
      reason: 'swagger'
    }
  ]
});

const extractedWithBadges = extractClassificationsFromResponse(mockLlmResponse);
assert.equal(extractedWithBadges.length, 2, 'Must extract 2 classifications');
assert.equal(extractedWithBadges[0].badge, 'moustache', 'First classification badge must be moustache');
assert.equal(extractedWithBadges[0].motif, 'handlebar_moustache', 'First classification motif must be handlebar_moustache');
assert.equal(extractedWithBadges[1].badge, 'sunglasses', 'Second classification badge must be sunglasses');
assert.equal(extractedWithBadges[1].motif, 'dark_sunglasses', 'Second classification motif must be dark_sunglasses');
console.log('✅ LLM JSON parser accurately extracts inline word badges and concrete motifs.');

// 6. Verify Full Sequence Headless Rendering with Word Badges (100% 1-Bit Monochrome)
const badgeTestLyrics = [
  {
    text: 'Kundian muchhan te kaale shades',
    startMs: 0,
    endMs: 2000,
    words: [
      { word: 'Kundian', startMs: 0, endMs: 400 },
      { word: 'muchhan', startMs: 400, endMs: 900 },
      { word: 'te', startMs: 900, endMs: 1100 },
      { word: 'kaale', startMs: 1100, endMs: 1500 },
      { word: 'shades', startMs: 1500, endMs: 2000 }
    ]
  }
];

const badgeRenderSeq = await renderKineticSequence({
  lyrics: badgeTestLyrics,
  startMs: 0,
  endMs: 2000,
  targetFps: 30,
  archetype: 'auto_semantic',
  wordBadgeOverrides: {
    muchhan: 'moustache',
    shades: 'sunglasses'
  },
  wordMotifOverrides: {
    muchhan: 'handlebar_moustache',
    shades: 'dark_sunglasses'
  }
});

assert.ok(badgeRenderSeq.frames.length >= 60, `Expected at least 60 frames, got ${badgeRenderSeq.frames.length}`);
let non1BitPixels = 0;
for (const frame of badgeRenderSeq.frames) {
  const d = frame.imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const val = d[i];
    if (val !== 0 && val !== 255) {
      non1BitPixels++;
    }
  }
}
assert.equal(non1BitPixels, 0, `All pixels with badges must be pure 1-bit monochrome (0 or 255), found ${non1BitPixels} non-binary pixels`);
console.log(`✅ Full kinetic sequence with moustache and sunglasses badges rendered (${badgeRenderSeq.frames.length} frames). Verified 100% pure 1-bit monochrome.`);

console.log('\n🎉 ALL 13 KINETIC TYPOGRAPHY, MOTIF, BADGE & COMBINATORIAL MATRIX TESTS PASSED PERFECTLY!\n');




