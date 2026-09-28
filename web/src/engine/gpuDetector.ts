export interface GpuTelemetry {
  renderer: string;
  vendor: string;
  simplifiedName: string;
  isDedicated: boolean;
  webGlSupported: boolean;
  webGpuSupported: boolean;
}

export function detectGpu(): GpuTelemetry {
  const result: GpuTelemetry = {
    renderer: 'Unknown',
    vendor: 'Unknown',
    simplifiedName: 'Generic GPU',
    isDedicated: false,
    webGlSupported: false,
    webGpuSupported: typeof navigator !== 'undefined' && 'gpu' in navigator,
  };

  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;

    if (gl) {
      result.webGlSupported = true;
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const rawRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
        const rawVendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || '';
        result.renderer = rawRenderer;
        result.vendor = rawVendor;

        // Clean name extraction from ANGLE string e.g. "ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 Direct3D11 ...)"
        const match = rawRenderer.match(/ANGLE \([^,]+,\s*([^,]+?)(?:\s+Direct3D|\s+Vulkan|\s+OpenGL|\))/i);
        if (match && match[1]) {
          result.simplifiedName = match[1].trim();
        } else if (rawRenderer.length > 0) {
          result.simplifiedName = rawRenderer.replace(/^ANGLE \(/, '').replace(/\)$/, '').slice(0, 32);
        }

        // Dedicated vs Integrated check
        const lower = rawRenderer.toLowerCase();
        result.isDedicated = (
          lower.includes('geforce') ||
          lower.includes('rtx') ||
          lower.includes('gtx') ||
          lower.includes('nvidia') ||
          lower.includes('radeon rx') ||
          lower.includes('discrete')
        ) && !lower.includes('radeon(tm) graphics') && !lower.includes('intel hd') && !lower.includes('intel iris');
      }
    }
  } catch (err) {
    console.warn('Failed to detect GPU info:', err);
  }

  return result;
}
