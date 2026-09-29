import { MotionArchetype } from './types';
import { LyricLine, LyricWord } from '../lyrics/types';

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

export const RECOMMENDED_OLLAMA_MODELS = [
  'qwen2.5:3b',
  'qwen2.5:1.5b',
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
];

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
  if (clean.includes('manga') || clean.includes('impact') || clean.includes('punch') || clean.includes('boom')) return 'manga_impact';
  if (clean.includes('glitch') || clean.includes('cyber') || clean.includes('static') || clean.includes('electric')) return 'cyber_glitch';
  if (clean.includes('block') || clean.includes('3d') || clean.includes('stack') || clean.includes('cube')) return '3d_block_stack';
  if (clean.includes('blade') || clean.includes('slash') || clean.includes('razor') || clean.includes('knife') || clean.includes('cut') || clean.includes('sword') || clean.includes('shashtar')) return 'blade_slash';
  if (clean.includes('target') || clean.includes('focus') || clean.includes('aim') || clean.includes('eye')) return 'target_focus';
  if (clean.includes('snake') || clean.includes('slither') || clean.includes('venom') || clean.includes('poison') || clean.includes('crawl')) return 'snake_slither';
  if (clean.includes('echo') || clean.includes('chant') || clean.includes('reverb') || clean.includes('vocal')) return 'echo_stack';
  if (clean.includes('badge') || clean.includes('invert') || clean.includes('stamp') || clean.includes('rule') || clean.includes('stop')) return 'inverted_badge';
  if (clean.includes('fluid') || clean.includes('smooth') || clean.includes('float') || clean.includes('glide')) return 'smooth_fluid';
  if (clean.includes('boil') || clean.includes('wiggly') || clean.includes('shake') || clean.includes('jitter') || clean.includes('chaos')) return 'wiggly_boil';

  return null;
}

/**
 * Resilient multi-strategy extractor that recovers classifications from:
 * 1. Valid JSON arrays { classifications: [...] }
 * 2. Key-value JSON maps { "word": "archetype" }
 * 3. Truncated JSON streams (recovers all completed objects via regex)
 */
export function extractClassificationsFromResponse(
  rawResponse: string,
  validArchetypes: MotionArchetype[] = VALID_MOTION_ARCHETYPES
): Array<{ word: string; startMs?: number; archetype: MotionArchetype; meaning?: string; reason?: string }> {
  const results: Array<{ word: string; startMs?: number; archetype: MotionArchetype; meaning?: string; reason?: string }> = [];
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
        const meaning = (item.meaning || item.punjabiMeaning || item.translation || '').toString().trim() || undefined;
        const reason = (item.reason || item.rationale || item.explanation || '').toString().trim() || undefined;
        if (word && arch) {
          results.push({
            word,
            startMs: typeof item.startMs === 'number' ? item.startMs : undefined,
            archetype: arch,
            meaning,
            reason,
          });
        }
      }
    } else if (typeof parsed === 'object' && parsed !== null) {
      // Key-value map: { "word": "archetype" } or { "word": { archetype, meaning, reason } }
      for (const [key, val] of Object.entries(parsed)) {
        if (['classifications', 'words', 'analysis', 'notes'].includes(key.toLowerCase())) continue;
        if (typeof val === 'string') {
          const arch = normalizeArchetype(val, validArchetypes);
          if (arch) results.push({ word: key.trim(), archetype: arch });
        } else if (typeof val === 'object' && val !== null && 'archetype' in val) {
          const arch = normalizeArchetype((val as any).archetype, validArchetypes);
          const meaning = (val as any).meaning || (val as any).translation || undefined;
          const reason = (val as any).reason || (val as any).rationale || undefined;
          if (arch) results.push({ word: key.trim(), archetype: arch, meaning, reason });
        }
      }
    }

    if (results.length > 0) return results;
  } catch {
    // Truncated or malformed JSON — proceed to regex extraction
  }

  // Strategy 2: Robust Regex Extraction for individual JSON object blocks with meaning/reason
  const blockRegex = /\{[^{}]*"word"\s*:\s*"([^"]+)"[^{}]*\}/gi;
  let blockMatch: RegExpExecArray | null;
  while ((blockMatch = blockRegex.exec(cleaned)) !== null) {
    const block = blockMatch[0];
    const wordMatch = /"word"\s*:\s*"([^"]+)"/i.exec(block);
    const archMatch = /"archetype"\s*:\s*"([^"]+)"/i.exec(block);
    const meaningMatch = /"meaning"\s*:\s*"([^"]+)"/i.exec(block);
    const reasonMatch = /"reason"\s*:\s*"([^"]+)"/i.exec(block);
    if (wordMatch && archMatch) {
      const arch = normalizeArchetype(archMatch[1], validArchetypes);
      if (arch) {
        results.push({
          word: wordMatch[1].trim(),
          archetype: arch,
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
        results.push({ word, archetype: arch });
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
        results.push({ word, archetype: arch });
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
  artist: string = 'Unknown'
): string {
  const formattedLines = lines.map((l: LyricLine, i: number) => {
    return `Line ${i + 1}: "${l.text}"`;
  }).join('\n');

  return `You are an elite motion typography director for high-energy 1-bit OLED kinetic lyrics.
Song Context: "${songTitle}" by ${artist}.

Analyze the emotions, language, and rhythm of these lines:
${formattedLines}

CRITICAL RULES:
1. ONLY select 1 to 2 high-impact punchline words per line (e.g. key nouns, weapons, powerful verbs, emotional climaxes, shouting words).
2. NEVER classify filler words, prepositions, conjunctions, or pronouns. Specifically DO NOT classify: "te", "de", "naal", "mera", "ni", "ki", "tainu", "and", "the", "with", "of", "to", "in", "it", "my", "you", "me".
3. For each selected word, provide its translated meaning/definition and your artistic reasoning for choosing that visual archetype so we can verify you understand the lyrics.

Choose from these 10 visual archetypes:
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

Output JSON strictly matching this format:
{
  "classifications": [
    {
      "word": "SHASHTAR",
      "meaning": "weapons / guns (Punjabi)",
      "archetype": "3d_block_stack",
      "reason": "heavy impactful weapon punchline"
    }
  ]
}`;
}

/**
 * Classifies kinetic archetypes for lyric words using context-aware local Ollama inference.
 */
export async function classifyLyricsWithOllama(
  lines: LyricLine[],
  options: {
    model?: string;
    endpoint?: string;
    songTitle?: string;
    artist?: string;
    onProgress?: (percent: number, message: string) => void;
    onInspectionLog?: (log: OllamaInspectionLog) => void;
  } = {}
): Promise<Record<string, MotionArchetype>> {
  const endpoint = options.endpoint || resolvedOllamaEndpoint || DEFAULT_ENDPOINT;
  const model = options.model || 'qwen2.5:1.5b';
  const archetypeOverrides: Record<string, MotionArchetype> = {};

  // Batch lines into stanzas of up to 4 lines for optimal context window & throughput
  const BATCH_SIZE = 4;
  const totalBatches = Math.ceil(lines.length / BATCH_SIZE);

  for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
    const batchLines = lines.slice(batchIdx * BATCH_SIZE, (batchIdx + 1) * BATCH_SIZE);
    if (batchLines.length === 0) continue;

    if (options.onProgress) {
      options.onProgress(
        Math.round((batchIdx / totalBatches) * 100),
        `Analyzing stanza ${batchIdx + 1}/${totalBatches} with ${model}...`
      );
    }

    const prompt = buildOllamaLyricsPrompt(
      batchLines,
      options.songTitle || 'Unknown',
      options.artist || 'Unknown'
    );

    const logEntry: OllamaInspectionLog = {
      id: `log-${Date.now()}-${batchIdx}`,
      timestamp: Date.now(),
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

    try {
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

      const extracted = extractClassificationsFromResponse(data.response, VALID_MOTION_ARCHETYPES);

      for (const item of extracted) {
        logEntry.parsedClassifications.push({
          word: item.word,
          startMs: item.startMs ?? 0,
          archetype: item.archetype,
          meaning: item.meaning,
          reason: item.reason,
        });

        // Clean target string
        const cleanTarget = item.word.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!cleanTarget) continue;

        // Apply to any matching words in the batch lines
        for (const line of batchLines) {
          for (const w of line.words) {
            const cleanWord = w.word.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (cleanWord === cleanTarget || (cleanTarget.length > 3 && cleanTarget.includes(cleanWord))) {
              const specificKey = `${w.word}_${w.startMs}`;
              archetypeOverrides[specificKey] = item.archetype;
              archetypeOverrides[cleanWord] = item.archetype;
            }
          }
        }
      }

      options.onInspectionLog?.(logEntry);
    } catch (err: any) {
      logEntry.error = err.message || 'Unknown network or parsing error';
      options.onInspectionLog?.(logEntry);
      console.warn(`Ollama inference batch ${batchIdx} error:`, err);
    }
  }

  if (options.onProgress) {
    options.onProgress(100, `Completed LLM semantic analysis!`);
  }

  return archetypeOverrides;
}

/**
 * Executes a standalone test prompt to Ollama with arbitrary custom text,
 * returning full timing, raw response, tokens/second, and parsed archetypes.
 */
export async function testSinglePromptWithOllama(
  rawInput: string,
  options: {
    model?: string;
    endpoint?: string;
    songTitle?: string;
    artist?: string;
  } = {}
): Promise<OllamaInspectionLog> {
  const endpoint = options.endpoint || resolvedOllamaEndpoint || DEFAULT_ENDPOINT;
  const model = options.model || 'qwen2.5:1.5b';

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

  try {
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

    const extracted = extractClassificationsFromResponse(data.response, VALID_MOTION_ARCHETYPES);
    for (const item of extracted) {
      // Find timestamp from synthetic lines if not provided
      let sMs = item.startMs;
      if (sMs === undefined) {
        const cleanT = item.word.toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const line of syntheticLines) {
          const matchW = line.words.find(w => w.word.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanT);
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
        meaning: item.meaning,
        reason: item.reason,
      });
    }

    return logEntry;
  } catch (err: any) {
    logEntry.error = err.message || 'Unknown network error connecting to Ollama';
    return logEntry;
  }
}
