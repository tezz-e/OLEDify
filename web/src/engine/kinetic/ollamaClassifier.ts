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
  parsedClassifications: Array<{ word: string; startMs: number; archetype: MotionArchetype }>;
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
 * Builds the exact prompt sent to Ollama for a given list of lyric lines.
 */
export function buildOllamaLyricsPrompt(
  lines: LyricLine[],
  songTitle: string = 'Unknown',
  artist: string = 'Unknown'
): string {
  const formattedLines = lines.map((l: LyricLine, i: number) => {
    const wordsList = l.words.map((w: LyricWord) => `"${w.word}" (${w.startMs}ms)`).join(', ');
    return `Line ${i + 1}: "${l.text}" | Words: [${wordsList}]`;
  }).join('\n');

  return `You are a creative motion design typography director for high-energy 1-bit OLED kinetic lyrics.
Song Context: "${songTitle}" by ${artist}.

Analyze the emotions, intensity, and rhythm of these lines:
${formattedLines}

Choose the single best visual archetype for each key word from these 10 styles:
- "manga_impact": Explosive punches, violent hits, sudden loud shouts, beat drops
- "cyber_glitch": High-tech speed, rapid flows, digital panic, lightning, urgency
- "3d_block_stack": Royalty, power, anthems, pride, heavy boss energy, solid blocks
- "target_focus": Eye contact, pointing, questions ("who", "you", "why"), aiming
- "blade_slash": Sharp slicing, cut, edge, danger, razor blades, conflict
- "snake_slither": Sinister, poison, dark crawl, toxic, venom, eerie mystery
- "echo_stack": Prolonged vocal notes, chants, reverberating shouting, infinite space
- "inverted_badge": Declarations, "NO", stops, rules, verification stamps, warnings
- "smooth_fluid": Floating, love, breeze, calm sky/water, romantic drift, gentle
- "wiggly_boil": Wild dancing, boiling jitter, chaos, fun, quirky shaking

Output JSON strictly matching this format:
{
  "classifications": [
    { "word": "example", "startMs": 1200, "archetype": "manga_impact" }
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
  const model = options.model || 'qwen2.5:3b';
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
            temperature: 0.2,
            num_predict: 512,
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

      const parsed = JSON.parse(data.response);

      if (parsed && Array.isArray(parsed.classifications)) {
        for (const item of parsed.classifications) {
          if (item && item.word && VALID_MOTION_ARCHETYPES.includes(item.archetype)) {
            const key = `${item.word}_${item.startMs}`;
            archetypeOverrides[key] = item.archetype;
            logEntry.parsedClassifications.push({
              word: item.word,
              startMs: item.startMs,
              archetype: item.archetype,
            });
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
          temperature: 0.2,
          num_predict: 512,
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

    const parsed = JSON.parse(data.response);
    if (parsed && Array.isArray(parsed.classifications)) {
      for (const item of parsed.classifications) {
        if (item && item.word && VALID_MOTION_ARCHETYPES.includes(item.archetype)) {
          logEntry.parsedClassifications.push({
            word: item.word,
            startMs: item.startMs,
            archetype: item.archetype,
          });
        }
      }
    }

    return logEntry;
  } catch (err: any) {
    logEntry.error = err.message || 'Unknown network error connecting to Ollama';
    return logEntry;
  }
}
