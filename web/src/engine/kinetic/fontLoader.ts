import { ScriptType, detectScript } from './scriptDetector';

export interface ScriptFontMeta {
  script: ScriptType;
  primaryFont: string;
  fontStack: string;
  googleFontFamily: string;
  cssUrl: string;
}

/**
 * Curated 1-bit high-contrast punchy Google Display Fonts for global scripts.
 */
export const SCRIPT_FONT_REGISTRY: Record<string, ScriptFontMeta> = {
  cjk: {
    script: 'cjk',
    primaryFont: 'Dela Gothic One',
    fontStack: "'Dela Gothic One', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif",
    googleFontFamily: 'Dela+Gothic+One',
    cssUrl: 'https://fonts.googleapis.com/css2?family=Dela+Gothic+One&display=swap'
  },
  japanese: {
    script: 'japanese',
    primaryFont: 'Dela Gothic One',
    fontStack: "'Dela Gothic One', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif",
    googleFontFamily: 'Dela+Gothic+One',
    cssUrl: 'https://fonts.googleapis.com/css2?family=Dela+Gothic+One&display=swap'
  },
  hangul: {
    script: 'hangul',
    primaryFont: 'Black Han Sans',
    fontStack: "'Black Han Sans', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif",
    googleFontFamily: 'Black+Han+Sans',
    cssUrl: 'https://fonts.googleapis.com/css2?family=Black+Han+Sans&display=swap'
  },
  korean: {
    script: 'korean',
    primaryFont: 'Black Han Sans',
    fontStack: "'Black Han Sans', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif",
    googleFontFamily: 'Black+Han+Sans',
    cssUrl: 'https://fonts.googleapis.com/css2?family=Black+Han+Sans&display=swap'
  },
  devanagari: {
    script: 'devanagari',
    primaryFont: 'Yatra One',
    fontStack: "'Yatra One', 'Rozha One', 'Nirmala UI', sans-serif",
    googleFontFamily: 'Yatra+One',
    cssUrl: 'https://fonts.googleapis.com/css2?family=Yatra+One&display=swap'
  },
  gurmukhi: {
    script: 'gurmukhi',
    primaryFont: 'Anek Gurmukhi',
    fontStack: "'Anek Gurmukhi', 'Raavi', 'Mukta Mahee', sans-serif",
    googleFontFamily: 'Anek+Gurmukhi:wght@800',
    cssUrl: 'https://fonts.googleapis.com/css2?family=Anek+Gurmukhi:wght@800&display=swap'
  },
  cyrillic: {
    script: 'cyrillic',
    primaryFont: 'Rubik Mono One',
    fontStack: "'Rubik Mono One', 'Impact', sans-serif",
    googleFontFamily: 'Rubik+Mono+One',
    cssUrl: 'https://fonts.googleapis.com/css2?family=Rubik+Mono+One&display=swap'
  },
  arabic: {
    script: 'arabic',
    primaryFont: 'Lalezar',
    fontStack: "'Lalezar', 'Geeza Pro', 'Arial', sans-serif",
    googleFontFamily: 'Lalezar',
    cssUrl: 'https://fonts.googleapis.com/css2?family=Lalezar&display=swap'
  },
  tamil: {
    script: 'tamil',
    primaryFont: 'Anek Tamil',
    fontStack: "'Anek Tamil', 'Nirmala UI', sans-serif",
    googleFontFamily: 'Anek+Tamil:wght@800',
    cssUrl: 'https://fonts.googleapis.com/css2?family=Anek+Tamil:wght@800&display=swap'
  },
  telugu: {
    script: 'telugu',
    primaryFont: 'Anek Telugu',
    fontStack: "'Anek Telugu', 'Nirmala UI', sans-serif",
    googleFontFamily: 'Anek+Telugu:wght@800',
    cssUrl: 'https://fonts.googleapis.com/css2?family=Anek+Telugu:wght@800&display=swap'
  }
};

const loadedFonts = new Set<string>();
const inflightPromises = new Map<string, Promise<void>>();

/**
 * Dynamically loads curated Google Display Fonts for the specified script using the CSS FontFace API.
 * Uses an in-memory cache and prevents redundant network fetches.
 */
export async function loadFontForScript(script: ScriptType): Promise<void> {
  const meta = SCRIPT_FONT_REGISTRY[script];
  if (!meta) return;

  if (loadedFonts.has(meta.primaryFont)) {
    return;
  }

  if (inflightPromises.has(meta.primaryFont)) {
    return inflightPromises.get(meta.primaryFont);
  }

  const loadPromise = (async () => {
    // Headless / Test environment safeguard
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      loadedFonts.add(meta.primaryFont);
      return;
    }

    try {
      // 1. Inject link tag if not present
      const existingLink = document.querySelector(`link[href*="${meta.googleFontFamily}"]`);
      if (!existingLink) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = meta.cssUrl;
        document.head.appendChild(link);
      }

      // 2. Fetch and register directly via FontFace API if supported
      if (typeof FontFace !== 'undefined' && document.fonts) {
        try {
          const res = await fetch(meta.cssUrl);
          if (res.ok) {
            const cssText = await res.text();
            const match = cssText.match(/url\((https:\/\/[^)]+\.woff2)\)/);
            if (match && match[1]) {
              const fontFace = new FontFace(meta.primaryFont, `url(${match[1]})`);
              await fontFace.load();
              document.fonts.add(fontFace);
            }
          }
        } catch {
          // If direct fetch is blocked by CORS/offline, fallback to document.fonts.load below
        }
      }

      // 3. Wait for browser font set readiness
      if (document.fonts?.load) {
        await document.fonts.load(`bold 16px "${meta.primaryFont}"`);
      }
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }

      loadedFonts.add(meta.primaryFont);
    } catch (err) {
      console.warn(`[fontLoader] Failed to load font "${meta.primaryFont}" for script "${script}":`, err);
    } finally {
      inflightPromises.delete(meta.primaryFont);
    }
  })();

  inflightPromises.set(meta.primaryFont, loadPromise);
  return loadPromise;
}

/**
 * Preloads fonts for any foreign script detected within the provided text.
 */
export async function ensureFontForText(text: string): Promise<void> {
  const script = detectScript(text);
  if (script !== 'latin' && script !== 'unknown') {
    await loadFontForScript(script);
  }
}

/**
 * Returns a high-impact fallback font stack for the detected script, prepending the curated display font.
 */
export function getScriptFontStack(script: ScriptType, baseFont?: string): string {
  const meta = SCRIPT_FONT_REGISTRY[script];
  if (!meta) {
    return baseFont || '"IBM Plex Mono", monospace';
  }
  if (!baseFont) {
    return meta.fontStack;
  }
  // Prepend curated high-impact display font to base font stack
  return `'${meta.primaryFont}', ${baseFont}`;
}
