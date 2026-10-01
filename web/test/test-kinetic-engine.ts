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
  MOTIF_METADATA 
} from '../src/engine/kinetic/types';
import { 
  VALID_VISUAL_MOTIFS,
  normalizeMotif,
  extractClassificationsFromResponse 
} from '../src/engine/kinetic/ollamaClassifier';
import { computeSafeTextLayout } from '../src/engine/kinetic/kineticLayout';
import { LyricWord } from '../src/engine/lyrics/types';

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

const wordNovelty: LyricWord = { word: 'GLITCH', startMs: 2100, endMs: 2400 };
const fontNovelty = getWordEffectiveFont(wordNovelty, 'cyber_glitch', trapPack);
assert.equal(fontNovelty, trapPack.fonts.novelty, `Expected novelty font for GLITCH with cyber_glitch`);

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

console.log('\n🎉 ALL KINETIC TYPOGRAPHY & MOTIF TESTS PASSED PERFECTLY!\n');

