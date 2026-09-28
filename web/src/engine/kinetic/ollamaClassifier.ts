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

/**
 * Checks connectivity to local Ollama service and enumerates installed models.
 */
export async function checkOllamaHealth(endpoint: string = DEFAULT_ENDPOINT): Promise<OllamaHealthStatus> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    const [verRes, tagsRes] = await Promise.all([
      fetch(`${endpoint}/api/version`, { signal: controller.signal }).catch(() => null),
      fetch(`${endpoint}/api/tags`, { signal: controller.signal }).catch(() => null),
    ]);
    clearTimeout(timeout);

    if (!tagsRes || !tagsRes.ok) {
      return {
        online: false,
        models: [],
        recommendedModel: 'qwen2.5:3b',
        error: 'Ollama is offline or unreachable on http://localhost:11434',
      };
    }

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
  } catch (err: any) {
    return {
      online: false,
      models: [],
      recommendedModel: 'qwen2.5:3b',
      error: err.name === 'AbortError' ? 'Ollama connection timed out' : err.message,
    };
  }
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
  } = {}
): Promise<Record<string, MotionArchetype>> {
  const endpoint = options.endpoint || DEFAULT_ENDPOINT;
  const model = options.model || 'qwen2.5:3b';
  const archetypeOverrides: Record<string, MotionArchetype> = {};

  const validArchetypes: MotionArchetype[] = [
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

    const formattedLines = batchLines.map((l: LyricLine, i: number) => {
      const wordsList = l.words.map((w: LyricWord) => `"${w.word}" (${w.startMs}ms)`).join(', ');
      return `Line ${i + 1}: "${l.text}" | Words: [${wordsList}]`;
    }).join('\n');

    const prompt = `You are a creative motion design typography director for high-energy 1-bit OLED kinetic lyrics.
Song Context: "${options.songTitle || 'Unknown'}" by ${options.artist || 'Unknown'}.

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
        console.warn(`Ollama batch ${batchIdx} failed with status:`, res.status);
        continue;
      }

      const data = await res.json();
      const parsed = JSON.parse(data.response);

      if (parsed && Array.isArray(parsed.classifications)) {
        for (const item of parsed.classifications) {
          if (item && item.word && validArchetypes.includes(item.archetype)) {
            const key = `${item.word}_${item.startMs}`;
            archetypeOverrides[key] = item.archetype;
          }
        }
      }
    } catch (err) {
      console.warn(`Ollama inference batch ${batchIdx} error:`, err);
    }
  }

  if (options.onProgress) {
    options.onProgress(100, `Completed LLM semantic analysis!`);
  }

  return archetypeOverrides;
}
