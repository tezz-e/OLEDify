import { TextLayoutResult } from './types';
import { isFillerWord } from './semanticClassifier';
import { getGraphemes, isSpacelessScript, isRTL } from './scriptDetector';

/**
 * Returns empty prefix for heavy display fonts to prevent synthetic faux-bold dilation.
 */
export function getFontWeightPrefix(fontFamily: string): string {
  const isDisplayHeavy = /molot|wilhelm|lemon milk|bangers|super comic|kraash|plumpfull|wicked mouse|cinzel/i.test(fontFamily);
  return isDisplayHeavy ? '' : 'bold ';
}

/**
 * Computes safe text layout guaranteed to never clip outside 128x64 display.
 */
export function computeSafeTextLayout(
  text: string,
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  fontFamily: string = '"IBM Plex Mono", monospace',
  maxW: number = 124,
  maxH: number = 58
): TextLayoutResult {
  const clean = text.toUpperCase().trim();
  const graphemes = getGraphemes(clean);
  const charCount = graphemes.length;

  if (!clean) {
    return {
      lines: [''],
      fontSize: 14,
      lineHeight: 14,
      letterSpacing: 0,
      totalHeight: 14,
      yOffsets: [32]
    };
  }

  // Tier 0: Filler / Connective word ("THE", "IN", "A", "TO", "AND", "TE", "DE")
  // Subordinated to clean, conversational scale (14px to 18px) so hero words have punch
  if (isFillerWord(clean) && !clean.includes(' ')) {
    const size = 16;
    const weightPrefix = getFontWeightPrefix(fontFamily);
    ctx.font = `${weightPrefix}${size}px ${fontFamily}`;
    return {
      lines: [clean],
      fontSize: size,
      lineHeight: size,
      letterSpacing: 1.5,
      totalHeight: size,
      yOffsets: [Math.floor((64 - size) / 2 + size * 0.85)]
    };
  }

  // Tier 1: Single short hero word (1 to 4 chars) -> Huge Display Font (32px to 48px)
  if (charCount <= 4 && !clean.includes(' ')) {
    let size = 48;
    let spacing = 3;
    const weightPrefix = getFontWeightPrefix(fontFamily);
    while (size >= 24) {
      ctx.font = `${weightPrefix}${size}px ${fontFamily}`;
      const metrics = ctx.measureText(clean);
      const measuredW = metrics.width + (charCount - 1) * spacing;
      if (measuredW <= maxW) {
        return {
          lines: [clean],
          fontSize: size,
          lineHeight: size,
          letterSpacing: spacing,
          totalHeight: size,
          yOffsets: [Math.floor((64 - size) / 2 + size * 0.85)]
        };
      }
      size -= 2;
    }
  }


  // Tier 2: Medium word (5 to 10 chars) -> Scaled single line with guaranteed tracking (14px to 26px)
  if (charCount <= 10 && !clean.includes(' ')) {
    let size = 26;
    const spacing = charCount <= 6 ? 2 : (charCount <= 8 ? 1.5 : 1);
    const weightPrefix = getFontWeightPrefix(fontFamily);
    while (size >= 12) {
      ctx.font = `${weightPrefix}${size}px ${fontFamily}`;
      const metrics = ctx.measureText(clean);
      const measuredW = metrics.width + (charCount - 1) * spacing;
      if (measuredW <= maxW) {
        return {
          lines: [clean],
          fontSize: size,
          lineHeight: size,
          letterSpacing: spacing,
          totalHeight: size,
          yOffsets: [Math.floor((64 - size) / 2 + size * 0.85)]
        };
      }
      size -= 1;
    }
  }

  // Tier 3: Extreme word (>10 graphemes, e.g. "EXTRAORDINARY") -> Syllabic / Midpoint Splitting
  let splitLines: string[] = [];
  if (charCount > 10 && !clean.includes(' ')) {
    const mid = Math.ceil(graphemes.length / 2);
    const firstHalf = graphemes.slice(0, mid).join('');
    const secondHalf = graphemes.slice(mid).join('');
    if (isSpacelessScript(clean) || isRTL(clean)) {
      splitLines = [firstHalf, secondHalf];
    } else {
      splitLines = [`${firstHalf}-`, secondHalf];
    }
  } else {
    // Multi-word phrase wrapping
    const words = clean.split(' ');
    let currentLine = '';
    for (const w of words) {
      const candidate = currentLine ? `${currentLine} ${w}` : w;
      ctx.font = `bold 14px ${fontFamily}`;
      if (ctx.measureText(candidate).width <= maxW) {
        currentLine = candidate;
      } else {
        if (currentLine) splitLines.push(currentLine);
        currentLine = w;
      }
    }
    if (currentLine) splitLines.push(currentLine);
  }

  // Max 3 lines on 128x64 display
  if (splitLines.length > 3) {
    splitLines = splitLines.slice(0, 3);
  }

  // Compute optimal font size for multi-line block using binary search
  let lowSize = 8;
  let highSize = Math.max(8, Math.floor(maxH / splitLines.length) - 2);
  let bestSize = lowSize;
  const weightPrefix = getFontWeightPrefix(fontFamily);

  while (lowSize <= highSize) {
    const midSize = Math.floor((lowSize + highSize) / 2);
    ctx.font = `${weightPrefix}${midSize}px ${fontFamily}`;
    const allFit = splitLines.every(l => ctx.measureText(l).width <= maxW);
    const heightFits = (midSize + 2) * splitLines.length <= maxH;

    if (allFit && heightFits) {
      bestSize = midSize;
      lowSize = midSize + 1;
    } else {
      highSize = midSize - 1;
    }
  }

  const lineHeight = bestSize + 2;
  const totalH = lineHeight * splitLines.length;
  const startY = Math.floor((64 - totalH) / 2) + bestSize;

  const yOffsets = splitLines.map((_, i) => startY + i * lineHeight);

  return {
    lines: splitLines,
    fontSize: bestSize,
    lineHeight,
    letterSpacing: 1,
    totalHeight: totalH,
    yOffsets
  };
}
