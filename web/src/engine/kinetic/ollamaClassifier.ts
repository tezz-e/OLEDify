import { MotionArchetype, VisualMotif, StylePackId, STYLE_PACKS } from './types';
import { LyricLine, LyricWord } from '../lyrics/types';
import { cleanLyricToken } from './semanticClassifier';
import { SongMoodProfile, SongVibe } from './moodProfileEngine';

export interface OllamaModelInfo {
  name: string;
  size: number;
  modifiedAt: string;
}

export interface OllamaHealthStatus {
  online: boolean;
  version?: string;
  models: string[];
  recommendedModel: string;
  error?: string;
}

export type LLMProvider = 'ollama' | 'groq';

export interface GroqModelConfig {
  id: string;
  name: string;
  description: string;
  isDefault?: boolean;
}

export const GROQ_MODELS: GroqModelConfig[] = [
  { 
    id: 'openai/gpt-oss-120b', 
    name: 'GPT OSS 120B (Deep Multilingual Reasoning & Slang)', 
    description: '120B parameter frontier model with deep multilingual fluency, nuanced cultural comprehension, and kinetic rhythm mapping.',
    isDefault: true 
  },
  { 
    id: 'qwen/qwen3.8-27b', 
    name: 'Qwen 3.8 27B (High-Speed Multilingual)', 
    description: '27B multilingual powerhouse running at ultra-low latency on Groq LPU.' 
  },
  { 
    id: 'openai/gpt-oss-20b', 
    name: 'GPT OSS 20B (Ultralight & Fast)', 
    description: '20B compact model for near-instant inference.' 
  },
];

export function getEffectiveGroqApiKey(explicitKey?: string): string {
  if (explicitKey && explicitKey.trim()) return explicitKey.trim();
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('oled_groq_api_key');
    if (saved && saved.trim()) return saved.trim();
  }
  const envKey = (import.meta as any).env?.VITE_GROQ_API_KEY;
  if (envKey && typeof envKey === 'string' && envKey.trim()) return envKey.trim();
  return '';
}

export function saveGroqApiKey(key: string): void {
  if (typeof window !== 'undefined') {
    if (key.trim()) {
      localStorage.setItem('oled_groq_api_key', key.trim());
    } else {
      localStorage.removeItem('oled_groq_api_key');
    }
  }
}

export const RECOMMENDED_OLLAMA_MODELS = [
  'qwen3.5:2b-q4_K_M',
  'qwen2.5:3b',
  'qwen3.5:2b',
  'llama3.2:3b',
  'llama3.2:1b',
  'phi3:mini',
];

const DEFAULT_ENDPOINT = 'http://localhost:11434';
export let resolvedOllamaEndpoint = DEFAULT_ENDPOINT;

/**
 * Checks connectivity to local Ollama service and enumerates installed models.
 * Tries direct port 11434 first, then falls back to /ollama-proxy to bypass any CORS restrictions.
 */
export async function checkOllamaHealth(endpoint: string = DEFAULT_ENDPOINT): Promise<OllamaHealthStatus> {
  const endpointsToTry = endpoint === DEFAULT_ENDPOINT ? [DEFAULT_ENDPOINT, '/ollama-proxy'] : [endpoint];

  for (const ep of endpointsToTry) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);

      const [verRes, tagsRes] = await Promise.all([
        fetch(`${ep}/api/version`, { signal: controller.signal }).catch(() => null),
        fetch(`${ep}/api/tags`, { signal: controller.signal }).catch(() => null),
      ]);
      clearTimeout(timeout);

      if (tagsRes && tagsRes.ok) {
        resolvedOllamaEndpoint = ep;
        const tagsData = await tagsRes.json();
        const verData = verRes && verRes.ok ? await verRes.json() : { version: 'unknown' };

        const installedModels: string[] = (tagsData.models || []).map((m: any) => m.name || m.model);
        const recommended = installedModels.find(m => RECOMMENDED_OLLAMA_MODELS.some(r => m.startsWith(r.split(':')[0]))) 
          || installedModels[0] 
          || 'qwen2.5:3b';

        return {
          online: true,
          version: verData.version,
          models: installedModels,
          recommendedModel: recommended,
        };
      }
    } catch {
      // Continue to next endpoint
    }
  }

  return {
    online: false,
    models: [],
    recommendedModel: 'qwen2.5:3b',
    error: 'Ollama is offline or unreachable on http://localhost:11434',
  };
}

export interface OllamaInspectionLog {
  id: string;
  timestamp: number;
  provider?: LLMProvider;
  batchIndex: number;
  totalBatches: number;
  model: string;
  songTitle?: string;
  artist?: string;
  linesAnalyzed: string[];
  prompt: string;
  rawResponse: string;
  parsedClassifications: Array<{
    word: string;
    startMs: number;
    archetype: MotionArchetype;
    motif?: VisualMotif;
    meaning?: string;
    reason?: string;
  }>;
  evalCount?: number;
  promptEvalCount?: number;
  totalDurationMs?: number;
  tokensPerSecond?: number;
  error?: string;
}

export const VALID_MOTION_ARCHETYPES: MotionArchetype[] = [
  'manga_impact',
  'cyber_glitch',
  '3d_block_stack',
  'target_focus',
  'blade_slash',
  'snake_slither',
  'echo_stack',
  'inverted_badge',
  'smooth_fluid',
  'wiggly_boil',
  'rolling_odometer',
  'gentle_float',
  'dither_dissolve',
  'typewriter_ribbon',
  'waveform_karaoke',
  'anvil_stomp',
  'fracture_shatter',
  'pendulum_sway',
  'prism_shimmer',
  'squash_bounce',
];

export const VALID_VISUAL_MOTIFS: VisualMotif[] = [
  'none',
  'manga_speedlines',
  'anime_rush',
  'crown_royal',
  'razor_blade',
  'tactical_scope',
  'flame_tongue',
  'skull_cross',
  'chrome_star',
  'lightning_arc',
  'comic_burst',
  'floating_notes',
  'starlight_glimmer',
  'heartbeat_pulse',
  'water_ripples',
  'minimal_frame',
  'lofi_dust_motes',
  'barbed_wire',
  'sound_blast_rings',
  'shattered_glass',
  'sound_bars_vintage',
  'rain_window',
  'cassette_spool',
  'equalizer_radial',
  'vinyl_grooves',
];

/**
 * Normalizes loose or fuzzy motif strings returned by LLMs.
 */
export function normalizeMotif(
  raw: string,
  valid: VisualMotif[] = VALID_VISUAL_MOTIFS
): VisualMotif {
  if (!raw || typeof raw !== 'string') return 'none';
  const clean = raw.toLowerCase().replace(/[-\s]/g, '_').trim();
  if (valid.includes(clean as VisualMotif)) return clean as VisualMotif;

  // Specific multi-word and compound motif matching first
  if (clean.includes('blast') || clean.includes('shockwave') || clean.includes('ring')) return 'sound_blast_rings';
  if (clean.includes('barbed') || clean.includes('wire') || clean.includes('fence')) return 'barbed_wire';
  if (clean.includes('shatter') || clean.includes('shard') || clean.includes('glass')) return 'shattered_glass';
  if (clean.includes('vintage') || clean.includes('graphic_eq') || clean.includes('spectrum') || clean.includes('sound_bar')) return 'sound_bars_vintage';
  if (clean.includes('rain') || clean.includes('window') || clean.includes('storm')) return 'rain_window';
  if (clean.includes('cassette') || clean.includes('spool') || clean.includes('reel') || clean.includes('tape')) return 'cassette_spool';
  if (clean.includes('radial') || clean.includes('orbit') || clean.includes('analyzer')) return 'equalizer_radial';
  if (clean.includes('vinyl') || clean.includes('groove') || clean.includes('record') || clean.includes('turntable')) return 'vinyl_grooves';

  // Standard visual motif matching
  if (clean.includes('note') || clean.includes('music') || clean.includes('melody') || clean.includes('clef')) return 'floating_notes';
  if (clean.includes('starlight') || clean.includes('twinkle') || clean.includes('constellation')) return 'starlight_glimmer';
  if (clean.includes('heart') || clean.includes('pulse') || clean.includes('cardiac') || clean.includes('love')) return 'heartbeat_pulse';
  if (clean.includes('ripple') || clean.includes('water') || clean.includes('wave') || clean.includes('ocean')) return 'water_ripples';
  if (clean.includes('frame') || clean.includes('border') || clean.includes('box') || clean.includes('letterbox')) return 'minimal_frame';
  if (clean.includes('dust') || clean.includes('mote') || clean.includes('particle') || clean.includes('lofi')) return 'lofi_dust_motes';
  if (clean.includes('speed') || clean.includes('wedge') || clean.includes('focus')) return 'manga_speedlines';
  if (clean.includes('rush') || clean.includes('dash') || clean.includes('run') || clean.includes('nagare')) return 'anime_rush';
  if (clean.includes('crown') || clean.includes('king') || clean.includes('royal') || clean.includes('queen') || clean.includes('boss')) return 'crown_royal';
  if (clean.includes('razor') || clean.includes('blade') || clean.includes('cut') || clean.includes('slash') || clean.includes('sword') || clean.includes('knife')) return 'razor_blade';
  if (clean.includes('scope') || clean.includes('target') || clean.includes('crosshair') || clean.includes('aim') || clean.includes('reticle')) return 'tactical_scope';
  if (clean.includes('flame') || clean.includes('fire') || clean.includes('burn') || clean.includes('inferno') || clean.includes('ember') || clean.includes('hot')) return 'flame_tongue';
  if (clean.includes('skull') || clean.includes('dead') || clean.includes('death') || clean.includes('grave') || clean.includes('kill')) return 'skull_cross';
  if (clean.includes('burst') || clean.includes('comic') || clean.includes('pop') || clean.includes('bubble') || clean.includes('starburst') || clean.includes('shout')) return 'comic_burst';
  if (clean.includes('star') || clean.includes('glint') || clean.includes('shine') || clean.includes('diamond') || clean.includes('ice') || clean.includes('chrome') || clean.includes('sparkle')) return 'chrome_star';
  if (clean.includes('lightning') || clean.includes('bolt') || clean.includes('electric') || clean.includes('thunder') || clean.includes('volt')) return 'lightning_arc';
  if (clean.includes('bar') || clean.includes('drop')) return 'sound_bars_vintage';

  return 'none';
}

/**
 * Normalizes loose or fuzzy archetype strings returned by smaller LLMs.
 */
export function normalizeArchetype(
  raw: string,
  valid: MotionArchetype[] = VALID_MOTION_ARCHETYPES
): MotionArchetype | null {
  if (!raw || typeof raw !== 'string') return null;
  const clean = raw.toLowerCase().replace(/[-\s]/g, '_').trim();
  if (valid.includes(clean as MotionArchetype)) return clean as MotionArchetype;

  // Fuzzy keyword matching
  if (clean.includes('float') || clean.includes('drift') || clean.includes('breeze') || clean.includes('cloud')) return 'gentle_float';
  if (clean.includes('dither') || clean.includes('dissolve') || clean.includes('fade') || clean.includes('crossfade')) return 'dither_dissolve';
  if (clean.includes('typewriter') || clean.includes('ribbon') || clean.includes('type') || clean.includes('story') || clean.includes('typing')) return 'typewriter_ribbon';
  if (clean.includes('karaoke') || clean.includes('waveform') || clean.includes('runner') || clean.includes('wave')) return 'waveform_karaoke';
  if (clean.includes('manga') || clean.includes('impact') || clean.includes('punch') || clean.includes('boom')) return 'manga_impact';
  if (clean.includes('glitch') || clean.includes('cyber') || clean.includes('static') || clean.includes('electric')) return 'cyber_glitch';
  if (clean.includes('block') || clean.includes('3d') || clean.includes('stack') || clean.includes('cube')) return '3d_block_stack';
  if (clean.includes('blade') || clean.includes('slash') || clean.includes('razor') || clean.includes('knife') || clean.includes('cut') || clean.includes('sword') || clean.includes('shashtar')) return 'blade_slash';
  if (clean.includes('target') || clean.includes('focus') || clean.includes('aim') || clean.includes('eye')) return 'target_focus';
  if (clean.includes('snake') || clean.includes('slither') || clean.includes('venom') || clean.includes('poison') || clean.includes('crawl')) return 'snake_slither';
  if (clean.includes('echo') || clean.includes('chant') || clean.includes('reverb') || clean.includes('vocal')) return 'echo_stack';
  if (clean.includes('badge') || clean.includes('invert') || clean.includes('stamp') || clean.includes('rule') || clean.includes('stop')) return 'inverted_badge';
  if (clean.includes('fluid') || clean.includes('smooth') || clean.includes('glide')) return 'smooth_fluid';
  if (clean.includes('boil') || clean.includes('wiggly') || clean.includes('shake') || clean.includes('jitter') || clean.includes('chaos')) return 'wiggly_boil';
  if (clean.includes('odometer') || clean.includes('rolling') || clean.includes('roller') || clean.includes('slot') || clean.includes('reel') || clean.includes('tumbler') || clean.includes('counter')) return 'rolling_odometer';
  if (clean.includes('stomp') || clean.includes('anvil') || clean.includes('heavy_drop') || clean.includes('slam')) return 'anvil_stomp';
  if (clean.includes('fracture') || clean.includes('shatter') || clean.includes('fissure') || clean.includes('shear')) return 'fracture_shatter';
  if (clean.includes('pendulum') || clean.includes('sway') || clean.includes('metronome') || clean.includes('rocking')) return 'pendulum_sway';
  if (clean.includes('prism') || clean.includes('shimmer') || clean.includes('light_beam') || clean.includes('sheen')) return 'prism_shimmer';
  if (clean.includes('squash') || clean.includes('bounce') || clean.includes('stretch') || clean.includes('elastic')) return 'squash_bounce';

  return null;
}

/**
 * Normalizes fuzzy style pack strings returned by LLMs.
 */
export function normalizeStylePack(raw?: string): StylePackId | undefined {
  if (!raw || typeof raw !== 'string') return undefined;
  const clean = raw.toLowerCase().replace(/[-\s]/g, '_').trim();
  if (clean in STYLE_PACKS) return clean as StylePackId;
  if (clean.includes('tokyo') || clean.includes('cyber') || clean.includes('industrial') || clean.includes('tech')) return 'cyber_industrial';
  if (clean.includes('comic') || clean.includes('shonen') || clean.includes('action') || clean.includes('manga')) return 'shonen_comic';
  if (clean.includes('bounce') || clean.includes('cartoon') || clean.includes('playful') || clean.includes('pop_art')) return 'cartoon_bounce';
  if (clean.includes('drill') || clean.includes('trap') || clean.includes('heavy') || clean.includes('metal')) return 'trap_drill';
  if (clean.includes('pop') || clean.includes('acoustic') || clean.includes('melody')) return 'pop_acoustic';
  if (clean.includes('serif') || clean.includes('editorial') || clean.includes('fashion') || clean.includes('lofi') || clean.includes('chic')) return 'editorial_lofi';
  if (clean.includes('pixel') || clean.includes('arcade') || clean.includes('retro') || clean.includes('8bit')) return 'cyber_industrial';
  return undefined;
}

/**
 * Resilient multi-strategy extractor that recovers classifications from:
 * 1. Valid JSON arrays { classifications: [...] }
 * 2. Key-value JSON maps { "word": "archetype" }
 * 3. Truncated JSON streams (recovers all completed objects via regex)
 */
export function extractClassificationsFromResponse(
  rawResponse: string,
  validArchetypes: MotionArchetype[] = VALID_MOTION_ARCHETYPES,
  validMotifs: VisualMotif[] = VALID_VISUAL_MOTIFS
): Array<{ word: string; startMs?: number; archetype: MotionArchetype; motif?: VisualMotif; meaning?: string; reason?: string }> {
  const results: Array<{ word: string; startMs?: number; archetype: MotionArchetype; motif?: VisualMotif; meaning?: string; reason?: string }> = [];
  if (!rawResponse || typeof rawResponse !== 'string') return results;

  let cleaned = rawResponse.trim();
  // Strip markdown codeblocks if model enclosed output in ```json ... ```
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
  }

  // Strategy 1: Strict JSON Parse
  try {
    const parsed = JSON.parse(cleaned);

    const list = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.classifications)
      ? parsed.classifications
      : Array.isArray(parsed.words)
      ? parsed.words
      : null;

    if (list) {
      for (const item of list) {
        if (!item) continue;
        const word = (item.word || item.text || item.token || '').trim();
        const rawArch = (item.archetype || item.style || item.motion || '').toString();
        const arch = normalizeArchetype(rawArch, validArchetypes);
        const rawMotif = (item.motif || item.visualMotif || item.symbol || item.graphic || '').toString();
        const motif = normalizeMotif(rawMotif, validMotifs);
        const meaning = (item.meaning || item.definition || item.translation || '').toString().trim() || undefined;
        const reason = (item.reason || item.rationale || item.explanation || '').toString().trim() || undefined;
        if (word && arch) {
          results.push({
            word,
            startMs: typeof item.startMs === 'number' ? item.startMs : undefined,
            archetype: arch,
            motif,
            meaning,
            reason,
          });
        }
      }
    } else if (typeof parsed === 'object' && parsed !== null) {
      // Key-value map: { "word": "archetype" } or { "word": { archetype, motif, meaning, reason } }
      for (const [key, val] of Object.entries(parsed)) {
        if (['classifications', 'words', 'analysis', 'notes'].includes(key.toLowerCase())) continue;
        if (typeof val === 'string') {
          const arch = normalizeArchetype(val, validArchetypes);
          if (arch) results.push({ word: key.trim(), archetype: arch, motif: 'none' });
        } else if (typeof val === 'object' && val !== null && 'archetype' in val) {
          const arch = normalizeArchetype((val as any).archetype, validArchetypes);
          const rawMotif = (val as any).motif || (val as any).visualMotif || '';
          const motif = normalizeMotif(rawMotif, validMotifs);
          const meaning = (val as any).meaning || (val as any).translation || undefined;
          const reason = (val as any).reason || (val as any).rationale || undefined;
          if (arch) results.push({ word: key.trim(), archetype: arch, motif, meaning, reason });
        }
      }
    }

    if (results.length > 0) return results;
  } catch {
    // Truncated or malformed JSON — proceed to regex extraction
  }

  // Strategy 2: Robust Regex Extraction for individual JSON object blocks with motif/meaning/reason
  const blockRegex = /\{[^{}]*"word"\s*:\s*"([^"]+)"[^{}]*\}/gi;
  let blockMatch: RegExpExecArray | null;
  while ((blockMatch = blockRegex.exec(cleaned)) !== null) {
    const block = blockMatch[0];
    const wordMatch = /"word"\s*:\s*"([^"]+)"/i.exec(block);
    const archMatch = /"archetype"\s*:\s*"([^"]+)"/i.exec(block);
    const motifMatch = /"motif"\s*:\s*"([^"]+)"/i.exec(block);
    const meaningMatch = /"meaning"\s*:\s*"([^"]+)"/i.exec(block);
    const reasonMatch = /"reason"\s*:\s*"([^"]+)"/i.exec(block);
    if (wordMatch && archMatch) {
      const arch = normalizeArchetype(archMatch[1], validArchetypes);
      const motif = motifMatch ? normalizeMotif(motifMatch[1], validMotifs) : 'none';
      if (arch) {
        results.push({
          word: wordMatch[1].trim(),
          archetype: arch,
          motif,
          meaning: meaningMatch ? meaningMatch[1].trim() : undefined,
          reason: reasonMatch ? reasonMatch[1].trim() : undefined,
        });
      }
    }
  }

  // Strategy 3: Loose word-archetype pair regex if object blocks were not matched
  if (results.length === 0) {
    const objectRegex = /"word"\s*:\s*"([^"]+)"[\s\S]*?"archetype"\s*:\s*"([a-zA-Z0-9_\-\s]+)"/gi;
    let match: RegExpExecArray | null;
    while ((match = objectRegex.exec(cleaned)) !== null) {
      const word = match[1].trim();
      const arch = normalizeArchetype(match[2], validArchetypes);
      if (word && arch) {
        results.push({ word, archetype: arch, motif: 'none' });
      }
    }
  }

  // Strategy 4: Inverted key order ("archetype" before "word")
  if (results.length === 0) {
    const invertedRegex = /"archetype"\s*:\s*"([a-zA-Z0-9_\-\s]+)"[\s\S]*?"word"\s*:\s*"([^"]+)"/gi;
    let match: RegExpExecArray | null;
    while ((match = invertedRegex.exec(cleaned)) !== null) {
      const arch = normalizeArchetype(match[1], validArchetypes);
      const word = match[2].trim();
      if (word && arch) {
        results.push({ word, archetype: arch, motif: 'none' });
      }
    }
  }

  return results;
}

/**
 * Builds the exact prompt sent to Ollama for a given list of lyric lines.
 */
export function buildOllamaLyricsPrompt(
  lines: LyricLine[],
  songTitle: string = 'Unknown',
  artist: string = 'Unknown',
  _profile?: SongMoodProfile | null
): string {
  const formattedLines = lines.map((l: LyricLine, i: number) => {
    return `Line ${i + 1}: "${l.text}"`;
  }).join('\n');

  return `You are an elite motion typography director for 1-bit OLED kinetic lyrics on a monochrome 128x64 display.
Track: "${songTitle}" by ${artist}.

Lyrics:
${formattedLines}

DIRECTOR MISSION:
1. Deeply analyze the language, slang, metaphors, mood, rhythm, and emotional intensity of the lyrics.
2. Determine the overarching song vibe:
   - "hype_aggressive": hard rap, drill, trap, metal, rock, high-energy battle/flex tracks with aggressive cuts and heavy punchlines.
   - "chill_pop": acoustic pop, R&B, lo-fi, melodic love songs, gentle storytelling.
   - "ballad_acoustic": slow emotional ballads, deep heartbreak, quiet acoustic poetry.
   - "groove_dance": upbeat rhythmic dance, disco, funk, bouncy midtempo beats.
3. Recommend the best matching typography style pack:
   - "trap_drill": aggressive display fonts, high contrast, hard 808 cuts, heavy punches.
   - "pop_acoustic": clean modern sans, friendly rounded geometry, warm acoustic melody.
   - "editorial_lofi": elegant high-contrast fashion serif & cursive, emotional poetry, deep ballads, lo-fi warmth.
   - "cyber_industrial": cyberpunk brutalist gothic, futuristic synths, EDM club dance, tech velocity.
   - "shonen_comic": high-octane manga action, explosive comic block lettering, superhero energy.
   - "cartoon_bounce": rubber-hose animation, playful bouncy funk, Y2K bubblegum rhythm.
4. Select 2 to 4 key expressive words per line (punchlines, verbs, core metaphors, climax words). Direct the kinetic choreography so every line feels dynamic and alive.
   - NEVER classify generic connective filler words, prepositions, conjunctions, or weak pronouns (e.g. "and", "the", "with", "of", "to", "in", "it", "my", "you", "me", "is", "a", "an", or their equivalents in any language).
   - ANTI-MONOTONY & MAXIMUM VISUAL VARIETY MANDATE:
     * Over long sequences, repeating the same archetype or motif feels robotic. Distribute choices broadly across the entire palette!
     * NEVER assign the same archetype twice to consecutive words or adjacent lines.
     * Balance high-impact punches ("manga_impact", "blade_slash", "cyber_glitch", "3d_block_stack") with structural and mechanical maneuvers ("rolling_odometer", "inverted_badge", "target_focus", "snake_slither", "wiggly_boil", "echo_stack", "gentle_float", "typewriter_ribbon").
   - Tailor the motion archetype and background motif to match the word's genuine intensity:
     * Hard punchlines, threats, flexes, fast flow: use "manga_impact", "blade_slash", "cyber_glitch", "3d_block_stack", "echo_stack" with motifs like "razor_blade", "tactical_scope", "flame_tongue", "manga_speedlines", "lightning_arc".
     * Gentle vocal runs, love confessions, dreamy drift: use "gentle_float", "waveform_karaoke", "typewriter_ribbon", "dither_dissolve", "smooth_fluid" with motifs like "floating_notes", "starlight_glimmer", "heartbeat_pulse", "water_ripples", "minimal_frame".
     * Rhythmic counts, bets, slot tumbling, bouncy lines: use "rolling_odometer", "inverted_badge", "target_focus", "wiggly_boil" with motifs like "chrome_star", "comic_burst", "floating_notes".
5. VIBE SEMANTIC GUARDRAILS (CRITICAL FOR AESTHETIC RELEVANCE):
   - In "hype_aggressive" (rap, drill, trap, metal, flex tracks): NEVER assign soft/dreamy motifs like "starlight_glimmer", "water_ripples", or "floating_notes". Treat colloquial street slang (police/FIR cases, rivalries, brawls, weapons, respect) as hard-hitting punchlines. Pair with "anvil_stomp", "fracture_shatter", "manga_impact", "blade_slash" and motifs like "sound_blast_rings", "barbed_wire", "shattered_glass", "crown_royal".
   - In "groove_dance" (pop, dance, disco, EDM, club): NEVER assign lethal combat/gore motifs like "razor_blade" or "barbed_wire" to dancefloor commands (e.g. "body rock", "move", "complete", "party"). Treat "rock" and "move" as kinetic groove cues, using "rolling_odometer", "wiggly_boil", "squash_bounce", "prism_shimmer" with motifs like "sound_bars_vintage", "equalizer_radial", "vinyl_grooves", "comic_burst".
   - In "chill_pop" & "ballad_acoustic": Avoid violent combat cuts ("blade_slash", "anvil_stomp"). Favor "gentle_float", "waveform_karaoke", "pendulum_sway", "dither_dissolve" with motifs like "heartbeat_pulse", "rain_window", "starlight_glimmer", "minimal_frame".
6. ALWAYS assign an evocative background visual motif ("motif") to key punchlines and emotional climaxes matching the imagery. If no motif fits, use "none". Rotate motifs dynamically across lines to maintain visual freshness.
7. For each selected word, provide its meaning and rationale for the motion choice.

Choose from these 20 visual archetypes:
- "gentle_float": weightless acoustic drift, floating, romance, calm breeze, dreaming
- "waveform_karaoke": sing-along melody, catchy choruses, vocal rhythm, musical hooks
- "typewriter_ribbon": storytelling reveal, confessions, letters, narrative, diary lines
- "dither_dissolve": nostalgic memory, vintage Game Boy/Mac dither fade, fading away, shadows
- "manga_impact": explosive hits, punches, loud shouts, beat drops
- "cyber_glitch": high-tech speed, rapid flows, digital panic, lightning
- "3d_block_stack": royalty, power, anthems, pride, heavy boss energy, solid blocks
- "target_focus": eye contact, pointing, questions ("who", "you", "why"), aiming
- "blade_slash": sharp slicing, weapons, danger, razor blades, conflict
- "snake_slither": sinister, poison, dark crawl, toxic, venom, eerie mystery
- "echo_stack": prolonged vocal notes, chants, reverberating shouting
- "inverted_badge": declarations, "NO", stops, rules, verification stamps, warnings
- "smooth_fluid": floating, love, breeze, calm sky/water, romantic drift, gentle
- "wiggly_boil": wild dancing, boiling jitter, chaos, fun, quirky shaking
- "rolling_odometer": slot machine tumbler, rolling digits, reels, mechanical spin, count, numbers, casino
- "anvil_stomp": massive vertical slam onto baseline, heavy hits, bass drops, crushing power, ground slam
- "fracture_shatter": angular diagonal crack splitting text, heartbreak, pain, cracking glass, tearing apart
- "pendulum_sway": harmonic rocking acoustic tilt, guitar strums, ticking clock, steady rhythm, acoustic ballads
- "prism_shimmer": light beam sweeping across glyphs, diamond shine, luxury, glow, star glints
- "squash_bounce": elastic Disney squash and stretch rebound, playful hops, dance grooves, bouncy funk

Choose from these 24 visual motifs (or "none"):
- "none": clean typography only with zero background visual distractions
- "floating_notes": drifting music notes (♪ ♫) for melodies, singing, instruments, romance
- "starlight_glimmer": breathing twinkling stars for dreams, night, magic, sparkling emotions
- "heartbeat_pulse": romantic heart pulse with concentric ripples for love, feelings, heartbeat
- "water_ripples": calming ocean waves and liquid ripples along screen floor
- "minimal_frame": cinematic minimalist border frame with corner cuts for elegant ballads
- "lofi_dust_motes": cozy floating dust particles for coffee shop / bedroom pop warmth
- "barbed_wire": razor barbed wire fence across corners for trap, danger, street, struggle
- "sound_blast_rings": concentric shockwave blast rings expanding from center on heavy 808s
- "shattered_glass": sharp flying glass shards exploding outward from center
- "sound_bars_vintage": classic hi-fi graphic equalizer spectrum bars dancing along bottom
- "rain_window": slanted falling rain streaks with splashes on bottom for melancholy and rain
- "cassette_spool": retro dual spinning cassette tape hubs for analog nostalgia and lo-fi tapes
- "equalizer_radial": circular 360-degree audio spectrum ring orbiting around text
- "vinyl_grooves": concentric turntable record grooves with rotating center label for DJ/groove
- "manga_speedlines": radial tapered focus lines converging around text
- "anime_rush": horizontal rapid speed barrage streaks
- "crown_royal": gothic 3-point crown for kings, bosses, wealth, royalty, supreme power
- "razor_blade": sharp diagonal cut slice with impact glints for sharp cuts, danger
- "tactical_scope": HUD corner brackets and targeting reticle for guns, aim, targets
- "flame_tongue": rising fire contours with detached ember sparks for heat, cooked, fire
- "skull_cross": 12x12 micro-sprite skull mark for lethal, death, danger, grave lyrics
- "chrome_star": 4-point diamond glint sparkles for ice, diamonds, luxury, shine, jewelry
- "lightning_arc": high-voltage jagged electric bolt for sudden voltage surges, shocks
- "comic_burst": 14-point pop-art comic starburst bubble for punchy comic shoutouts

Output JSON strictly matching this format:
{
  "songVibe": "hype_aggressive",
  "recommendedStylePack": "trap_drill",
  "classifications": [
    {
      "word": "FIRE",
      "meaning": "energy / flames",
      "archetype": "manga_impact",
      "motif": "flame_tongue",
      "reason": "explosive energetic punchline"
    }
  ]
}
`;
}

export interface LLMClassificationOutput {
  archetypes: Record<string, MotionArchetype>;
  motifs: Record<string, VisualMotif>;
  songVibe?: SongVibe;
  recommendedStylePack?: StylePackId;
}

/**
 * Classifies kinetic archetypes and visual motifs for lyric words using local Ollama or cloud Groq inference.
 */
export async function classifyLyricsWithOllama(
  lines: LyricLine[],
  options: {
    provider?: LLMProvider;
    groqApiKey?: string;
    model?: string;
    endpoint?: string;
    songTitle?: string;
    artist?: string;
    songProfile?: SongMoodProfile | null;
    onProgress?: (percent: number, message: string) => void;
    onInspectionLog?: (log: OllamaInspectionLog) => void;
  } = {}
): Promise<LLMClassificationOutput> {
  const provider = options.provider || 'ollama';
  const endpoint = options.endpoint || resolvedOllamaEndpoint || DEFAULT_ENDPOINT;
  const model = options.model || (provider === 'groq' ? 'openai/gpt-oss-120b' : 'qwen3.5:2b-q4_K_M');
  const archetypeOverrides: Record<string, MotionArchetype> = {};
  const motifOverrides: Record<string, VisualMotif> = {};
  let detectedSongVibe: SongVibe | undefined;
  let detectedStylePack: StylePackId | undefined;

  // Batch lines into stanzas of up to 4 lines for optimal context window & throughput
  const BATCH_SIZE = 4;
  const totalBatches = Math.ceil(lines.length / BATCH_SIZE);

  for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
    const batchLines = lines.slice(batchIdx * BATCH_SIZE, (batchIdx + 1) * BATCH_SIZE);
    if (batchLines.length === 0) continue;

    if (options.onProgress) {
      options.onProgress(
        Math.round((batchIdx / totalBatches) * 100),
        `Analyzing stanza ${batchIdx + 1}/${totalBatches} with ${model} (${provider === 'groq' ? 'Groq Cloud' : 'Local Ollama'})...`
      );
    }

    const prompt = buildOllamaLyricsPrompt(
      batchLines,
      options.songTitle || 'Unknown',
      options.artist || 'Unknown',
      options.songProfile
    );

    const logEntry: OllamaInspectionLog = {
      id: `log-${Date.now()}-${batchIdx}`,
      timestamp: Date.now(),
      provider,
      batchIndex: batchIdx + 1,
      totalBatches,
      model,
      songTitle: options.songTitle,
      artist: options.artist,
      linesAnalyzed: batchLines.map(l => l.text),
      prompt,
      rawResponse: '',
      parsedClassifications: [],
    };

    const startTime = performance.now();

    try {
      if (provider === 'groq') {
        const apiKey = getEffectiveGroqApiKey(options.groqApiKey);
        if (!apiKey) {
          throw new Error('Groq API Key missing. Please provide a key in the modal or web/.env.local');
        }

        let res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: 'system',
                content: 'You are an elite motion typography director for high-energy 1-bit OLED kinetic lyrics. Output strictly valid JSON matching the schema.',
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
            temperature: 0.1,
            response_format: { type: 'json_object' },
          }),
        });

        // Automatic retry on rate limits (TPM throttle)
        if (res.status === 429) {
          console.warn(`Groq rate limit reached (HTTP 429). Waiting 9s before auto-retry...`);
          await new Promise((r) => setTimeout(r, 9000));
          res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model,
              messages: [
                {
                  role: 'system',
                  content: 'You are an elite motion typography director for high-energy 1-bit OLED kinetic lyrics. Output strictly valid JSON matching the schema.',
                },
                {
                  role: 'user',
                  content: prompt,
                },
              ],
              temperature: 0.1,
              response_format: { type: 'json_object' },
            }),
          });
        }

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          logEntry.error = `Groq HTTP ${res.status}: ${errText}`;
          console.warn(`Groq batch ${batchIdx} failed:`, errText);
          options.onInspectionLog?.(logEntry);
          continue;
        }

        const data = await res.json();
        const durationMs = Math.round(performance.now() - startTime);
        logEntry.totalDurationMs = durationMs;
        const textResponse = data.choices?.[0]?.message?.content || '';
        logEntry.rawResponse = textResponse;
        if (data.usage) {
          logEntry.evalCount = data.usage.completion_tokens;
          logEntry.promptEvalCount = data.usage.prompt_tokens;
          if (data.usage.completion_time) {
            logEntry.tokensPerSecond = Math.round((data.usage.completion_tokens / data.usage.completion_time) * 10) / 10;
          } else if (durationMs > 0 && data.usage.completion_tokens) {
            logEntry.tokensPerSecond = Math.round((data.usage.completion_tokens / (durationMs / 1000)) * 10) / 10;
          }
        }

        try {
          let jsonStr = textResponse.trim();
          if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
          }
          const parsed = JSON.parse(jsonStr);
          if (!detectedSongVibe && parsed.songVibe && ['hype_aggressive', 'chill_pop', 'ballad_acoustic', 'groove_dance'].includes(parsed.songVibe)) {
            detectedSongVibe = parsed.songVibe as SongVibe;
          }
          if (!detectedStylePack && parsed.recommendedStylePack) {
            detectedStylePack = normalizeStylePack(parsed.recommendedStylePack);
          }
        } catch (_) {}

        const extracted = extractClassificationsFromResponse(textResponse, VALID_MOTION_ARCHETYPES, VALID_VISUAL_MOTIFS);
        for (const item of extracted) {
          logEntry.parsedClassifications.push({
            word: item.word,
            startMs: item.startMs ?? 0,
            archetype: item.archetype,
            motif: item.motif,
            meaning: item.meaning,
            reason: item.reason,
          });

          const cleanTarget = cleanLyricToken(item.word);
          const rawTargetLower = item.word.trim().toLowerCase();
          if (!cleanTarget && !rawTargetLower) continue;

          for (const line of batchLines) {
            for (const w of line.words) {
              const cleanWord = cleanLyricToken(w.word);
              const rawWordLower = w.word.trim().toLowerCase();

              const isMatch = (cleanTarget && cleanWord === cleanTarget) ||
                rawWordLower === rawTargetLower ||
                (cleanTarget.length >= 3 && cleanWord.includes(cleanTarget)) ||
                (cleanWord.length >= 3 && cleanTarget.includes(cleanWord));

              if (isMatch) {
                const specificKey = `${w.word}_${w.startMs}`;
                archetypeOverrides[specificKey] = item.archetype;
                if (cleanWord) archetypeOverrides[cleanWord] = item.archetype;
                archetypeOverrides[rawWordLower] = item.archetype;
                if (item.motif && item.motif !== 'none') {
                  motifOverrides[specificKey] = item.motif;
                  if (cleanWord) motifOverrides[cleanWord] = item.motif;
                  motifOverrides[rawWordLower] = item.motif;
                }
              }
            }
          }
        }

        options.onInspectionLog?.(logEntry);
      } else {
        // Ollama Local Provider
        const res = await fetch(`${endpoint}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            prompt,
            format: 'json',
            stream: false,
            options: {
              temperature: 0.1,
              num_predict: 1024,
            },
          }),
        });

        if (!res.ok) {
          logEntry.error = `Ollama returned HTTP ${res.status}: ${res.statusText}`;
          console.warn(`Ollama batch ${batchIdx} failed with status:`, res.status);
          options.onInspectionLog?.(logEntry);
          continue;
        }

        const data = await res.json();
        logEntry.rawResponse = data.response || '';
        logEntry.evalCount = data.eval_count;
        logEntry.promptEvalCount = data.prompt_eval_count;
        if (data.total_duration) {
          logEntry.totalDurationMs = Math.round(data.total_duration / 1e6);
        }
        if (data.eval_count && data.eval_duration) {
          logEntry.tokensPerSecond = Math.round((data.eval_count / (data.eval_duration / 1e9)) * 10) / 10;
        }

        try {
          let jsonStr = (data.response || '').trim();
          if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
          }
          const parsed = JSON.parse(jsonStr);
          if (!detectedSongVibe && parsed.songVibe && ['hype_aggressive', 'chill_pop', 'ballad_acoustic', 'groove_dance'].includes(parsed.songVibe)) {
            detectedSongVibe = parsed.songVibe as SongVibe;
          }
          if (!detectedStylePack && parsed.recommendedStylePack && parsed.recommendedStylePack in STYLE_PACKS) {
            detectedStylePack = parsed.recommendedStylePack as StylePackId;
          }
        } catch (_) {}

        const extracted = extractClassificationsFromResponse(data.response, VALID_MOTION_ARCHETYPES, VALID_VISUAL_MOTIFS);

        for (const item of extracted) {
          logEntry.parsedClassifications.push({
            word: item.word,
            startMs: item.startMs ?? 0,
            archetype: item.archetype,
            motif: item.motif,
            meaning: item.meaning,
            reason: item.reason,
          });

          const cleanTarget = cleanLyricToken(item.word);
          const rawTargetLower = item.word.trim().toLowerCase();
          if (!cleanTarget && !rawTargetLower) continue;

          for (const line of batchLines) {
            for (const w of line.words) {
              const cleanWord = cleanLyricToken(w.word);
              const rawWordLower = w.word.trim().toLowerCase();

              const isMatch = (cleanTarget && cleanWord === cleanTarget) ||
                rawWordLower === rawTargetLower ||
                (cleanTarget.length >= 3 && cleanWord.includes(cleanTarget)) ||
                (cleanWord.length >= 3 && cleanTarget.includes(cleanWord));

              if (isMatch) {
                const specificKey = `${w.word}_${w.startMs}`;
                archetypeOverrides[specificKey] = item.archetype;
                if (cleanWord) archetypeOverrides[cleanWord] = item.archetype;
                archetypeOverrides[rawWordLower] = item.archetype;
                if (item.motif && item.motif !== 'none') {
                  motifOverrides[specificKey] = item.motif;
                  if (cleanWord) motifOverrides[cleanWord] = item.motif;
                  motifOverrides[rawWordLower] = item.motif;
                }
              }
            }
          }
        }

        options.onInspectionLog?.(logEntry);
      }
    } catch (err: any) {
      logEntry.error = err.message || 'Unknown network or parsing error';
      options.onInspectionLog?.(logEntry);
      console.warn(`LLM inference batch ${batchIdx} error:`, err);
    }
  }

  if (options.onProgress) {
    options.onProgress(100, `Completed LLM semantic analysis!`);
  }

  return {
    archetypes: archetypeOverrides,
    motifs: motifOverrides,
    songVibe: detectedSongVibe,
    recommendedStylePack: detectedStylePack,
  };
}


/**
 * Executes a standalone test prompt with arbitrary custom text to either
 * local Ollama or Groq Cloud, returning timing, raw response, tokens/s, and parsed archetypes.
 */
export async function testSinglePromptWithOllama(
  rawInput: string,
  options: {
    provider?: LLMProvider;
    groqApiKey?: string;
    model?: string;
    endpoint?: string;
    songTitle?: string;
    artist?: string;
  } = {}
): Promise<OllamaInspectionLog> {
  const provider = options.provider || 'ollama';
  const endpoint = options.endpoint || resolvedOllamaEndpoint || DEFAULT_ENDPOINT;
  const model = options.model || (provider === 'groq' ? 'openai/gpt-oss-120b' : 'qwen3.5:2b-q4_K_M');

  // Parse lines and words
  const rawLines = rawInput.split('\n').map(s => s.trim()).filter(Boolean);
  let currentTimeMs = 0;
  const syntheticLines: LyricLine[] = rawLines.map((lineText, lineIndex) => {
    const rawWords = lineText.split(/\s+/).filter(Boolean);
    const lineStart = currentTimeMs;
    const words: LyricWord[] = rawWords.map((word) => {
      const wStart = currentTimeMs;
      const wEnd = wStart + 400;
      currentTimeMs += 450;
      return { word, startMs: wStart, endMs: wEnd };
    });
    const lineEnd = currentTimeMs + 300;
    currentTimeMs += 600;
    return {
      lineIndex,
      text: lineText,
      startMs: lineStart,
      endMs: lineEnd,
      words,
    };
  });

  const prompt = buildOllamaLyricsPrompt(
    syntheticLines,
    options.songTitle || 'Test Experiment',
    options.artist || 'Test Artist'
  );

  const logEntry: OllamaInspectionLog = {
    id: `test-${Date.now()}`,
    timestamp: Date.now(),
    provider,
    batchIndex: 1,
    totalBatches: 1,
    model,
    songTitle: options.songTitle || 'Test Experiment',
    artist: options.artist || 'Test Artist',
    linesAnalyzed: syntheticLines.map(l => l.text),
    prompt,
    rawResponse: '',
    parsedClassifications: [],
  };

  const startTime = performance.now();

  try {
    if (provider === 'groq') {
      const apiKey = getEffectiveGroqApiKey(options.groqApiKey);
      if (!apiKey) {
        logEntry.error = 'Groq API Key is missing. Please provide a key in the modal or web/.env.local';
        return logEntry;
      }

      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: 'You are an elite motion typography director for high-energy 1-bit OLED kinetic lyrics. Output strictly valid JSON matching the schema.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' },
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText);
        logEntry.error = `Groq HTTP ${res.status}: ${errText}`;
        return logEntry;
      }

      const data = await res.json();
      const durationMs = Math.round(performance.now() - startTime);
      logEntry.totalDurationMs = durationMs;
      const textResponse = data.choices?.[0]?.message?.content || '';
      logEntry.rawResponse = textResponse;

      if (data.usage) {
        logEntry.evalCount = data.usage.completion_tokens;
        logEntry.promptEvalCount = data.usage.prompt_tokens;
        if (data.usage.completion_time) {
          logEntry.tokensPerSecond = Math.round((data.usage.completion_tokens / data.usage.completion_time) * 10) / 10;
        } else if (durationMs > 0 && data.usage.completion_tokens) {
          logEntry.tokensPerSecond = Math.round((data.usage.completion_tokens / (durationMs / 1000)) * 10) / 10;
        }
      }

      const extracted = extractClassificationsFromResponse(textResponse, VALID_MOTION_ARCHETYPES, VALID_VISUAL_MOTIFS);
      for (const item of extracted) {
        let sMs = item.startMs;
        if (sMs === undefined) {
          const cleanT = cleanLyricToken(item.word);
          const rawTLower = item.word.trim().toLowerCase();
          for (const line of syntheticLines) {
            const matchW = line.words.find(w => {
              const cW = cleanLyricToken(w.word);
              return (cleanT && cW === cleanT) || w.word.trim().toLowerCase() === rawTLower;
            });
            if (matchW) {
              sMs = matchW.startMs;
              break;
            }
          }
        }
        logEntry.parsedClassifications.push({
          word: item.word,
          startMs: sMs ?? 0,
          archetype: item.archetype,
          motif: item.motif,
          meaning: item.meaning,
          reason: item.reason,
        });
      }

      return logEntry;
    } else {
      // Ollama Local Provider
      const res = await fetch(`${endpoint}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          format: 'json',
          stream: false,
          options: {
            temperature: 0.1,
            num_predict: 1024,
          },
        }),
      });

      if (!res.ok) {
        logEntry.error = `Ollama HTTP ${res.status}: ${res.statusText}`;
        return logEntry;
      }

      const data = await res.json();
      logEntry.rawResponse = data.response || '';
      logEntry.evalCount = data.eval_count;
      logEntry.promptEvalCount = data.prompt_eval_count;
      if (data.total_duration) {
        logEntry.totalDurationMs = Math.round(data.total_duration / 1e6);
      }
      if (data.eval_count && data.eval_duration) {
        logEntry.tokensPerSecond = Math.round((data.eval_count / (data.eval_duration / 1e9)) * 10) / 10;
      }

      const extracted = extractClassificationsFromResponse(data.response, VALID_MOTION_ARCHETYPES, VALID_VISUAL_MOTIFS);
      for (const item of extracted) {
        let sMs = item.startMs;
        if (sMs === undefined) {
          const cleanT = cleanLyricToken(item.word);
          const rawTLower = item.word.trim().toLowerCase();
          for (const line of syntheticLines) {
            const matchW = line.words.find(w => {
              const cW = cleanLyricToken(w.word);
              return (cleanT && cW === cleanT) || w.word.trim().toLowerCase() === rawTLower;
            });
            if (matchW) {
              sMs = matchW.startMs;
              break;
            }
          }
        }
        logEntry.parsedClassifications.push({
          word: item.word,
          startMs: sMs ?? 0,
          archetype: item.archetype,
          motif: item.motif,
          meaning: item.meaning,
          reason: item.reason,
        });
      }

      return logEntry;
    }
  } catch (err: any) {
    logEntry.error = err.message || `Unknown network error connecting to ${provider}`;
    return logEntry;
  }
}

export const classifyLyricsWithLLM = classifyLyricsWithOllama;
export const testSinglePromptWithLLM = testSinglePromptWithOllama;

