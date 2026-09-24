import { applyDithering } from './ditherEngine';

/**
 * WigglyEngine - Handles the 3-frame deterministic "Line-Boil" / Squigglevision effect.
 * It intercepts pristine SVG vectors, applies a 3-phase procedural displacement map,
 * and caches them for zero-cost runtime playback.
 */

export class WigglyEngine {
  private static readonly BOIL_FPS = 12; // Standard hand-drawn line boil rate
  private static readonly SEEDS = [101, 503, 907]; // Deterministic phases

  /**
   * Injects an SVG filter definition into an existing SVG string to apply the wiggly effect.
   * This uses feTurbulence and feDisplacementMap to perturb the vector strokes.
   */
  public static injectWigglyFilter(svgString: string, phaseIndex: number, roughness: number = 2.0): string {
    const seed = this.SEEDS[phaseIndex % 3];
    
    // Define the SVG filter
    const filterDef = `
      <defs>
        <filter id="wiggly-filter-${phaseIndex}" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" seed="${seed}" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="${roughness}" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    `;

    // Match the opening <svg ...> tag
    const svgTagMatch = svgString.match(/<svg[^>]*>/);
    if (!svgTagMatch) return svgString; // Invalid SVG
    
    const openingTag = svgTagMatch[0];
    const innerContent = svgString.slice(openingTag.length, svgString.lastIndexOf('</svg>'));
    
    return `
      ${openingTag}
      ${filterDef}
      <g filter="url(#wiggly-filter-${phaseIndex})">
        ${innerContent}
      </g>
      </svg>
    `;
  }

  /**
   * Pre-renders the 3 frames of the line boil for a given SVG into offscreen canvases.
   */
  public static async createWigglyCache(svgString: string, width: number, height: number, roughness: number = 2.0): Promise<HTMLCanvasElement[]> {
    const cache: HTMLCanvasElement[] = [];
    
    for (let i = 0; i < 3; i++) {
      const wigglySvg = this.injectWigglyFilter(svgString, i, roughness);
      
      // Convert SVG string to Blob URL
      const blob = new Blob([wigglySvg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      
      // Create an image and wait for it to load
      const img = new Image();
      img.src = url;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
      });
      
      // Draw to offscreen canvas
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        
        // Extract ImageData to apply local-space dithering
        const imageData = ctx.getImageData(0, 0, width, height);
        
        // Save original alpha channel to restore transparency mask
        const originalAlpha = new Uint8Array(width * height);
        for (let j = 0; j < width * height; j++) {
          originalAlpha[j] = imageData.data[j * 4 + 3];
        }
        
        // Apply Bayer-8 Dithering for shading quantization
        const { ditheredImageData } = applyDithering(imageData, {
          algorithm: 'bayer-8',
          threshold: 128,
          contrast: 0,
          brightness: 0,
          invert: false
        });
        
        // Sharp Outline Thresholding: restore alpha but threshold it for a 1-bit crisp edge
        for (let j = 0; j < width * height; j++) {
          ditheredImageData.data[j * 4 + 3] = originalAlpha[j] > 127 ? 255 : 0;
        }
        
        ctx.putImageData(ditheredImageData, 0, 0);
      }
      
      cache.push(canvas);
      URL.revokeObjectURL(url);
    }
    
    return cache;
  }

  /**
   * Helper to get the current phase index based on elapsed time
   */
  public static getActivePhase(timeSeconds: number): number {
    return Math.floor(timeSeconds * this.BOIL_FPS) % 3;
  }
}
