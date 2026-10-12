import React, { useEffect, useRef } from 'react';

export interface HardwareTelemetryHUDProps {
  mcu?: string;            // "ESP32-S3"
  displayDriver?: string;  // "SSD1306 128x64"
  baudRate?: number;       // 921600
  fps?: number;            // 30
  currentFrame?: number;
  totalFrames?: number;
  audioTelemetry?: number[]; // [0..1] normalized audio energy buffer
  isConnected?: boolean;
  isStreaming?: boolean;
  themeMode?: 'light' | 'dark';
  className?: string;
}

export const HardwareTelemetryHUD: React.FC<HardwareTelemetryHUDProps> = ({
  mcu = 'ESP32-S3',
  displayDriver = 'SSD1306',
  baudRate = 921600,
  fps = 30,
  currentFrame = 0,
  totalFrames = 120,
  audioTelemetry = [],
  isConnected = true,
  isStreaming = false,
  themeMode = 'dark',
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDark = themeMode === 'dark';

  // Micro-oscilloscope drawing loop clamped to len >= 2 to prevent NaN division
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 1.2;

    if (totalFrames === 0) {
      // Honest empty state: clean flat baseline without fake data
      ctx.beginPath();
      ctx.moveTo(0, canvas.height / 2);
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.strokeStyle = isDark ? '#3F3F46' : '#D4D4D8';
      ctx.stroke();
      return;
    }

    // Category 3 allowed orange ONLY when streaming; neutral when idle
    ctx.strokeStyle = isStreaming ? '#FF5500' : (isDark ? '#A1A1AA' : '#71717A');
    ctx.beginPath();
    if (audioTelemetry.length > 0) {
      const len = audioTelemetry.length;
      for (let i = 0; i < len; i++) {
        const val = audioTelemetry[i];
        const x = (i / (len - 1)) * canvas.width;
        const y = canvas.height - val * canvas.height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    } else {
      // Clean flat active level when frames exist but no audio track
      ctx.moveTo(0, canvas.height / 2);
      ctx.lineTo(canvas.width, canvas.height / 2);
    }
    ctx.stroke();
  }, [audioTelemetry, isDark, totalFrames, isStreaming]);

  return (
    <div
      className={`p-3.5 rounded-[12px] border border-[var(--hw-border-hairline)] font-sans text-xs flex flex-col gap-3 select-none bg-[var(--hw-bg-surface)] text-[var(--hw-text-primary)] ${className}`}
      aria-label="Hardware Telemetry HUD"
    >
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-[var(--hw-border-hairline)] pb-2">
        <div className="flex items-center gap-2">
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors ${
              isStreaming
                ? 'bg-[#FF5500]'
                : isConnected
                ? (isDark ? 'bg-white' : 'bg-black')
                : 'bg-[#71717A]'
            }`}
          />
          <span className="font-semibold text-xs tracking-tight text-[var(--hw-text-primary)]">
            Telemetry
          </span>
        </div>
      </div>

      {/* Signal Chain Topology: Three rows, no wrapping, lowercase 'k' on baud, no ASCII arrows */}
      <div className="p-2.5 rounded-[8px] bg-[var(--hw-bg-canvas)] border border-[var(--hw-border-hairline)] text-[11px] font-sans space-y-1">
        <div className="text-[var(--hw-text-primary)] whitespace-nowrap">
          USB · <span className="font-mono">{baudRate === 921600 ? '921.6' : '115.2'}</span><span className="font-sans">k baud</span>
        </div>
        <div className="text-[var(--hw-text-primary)] whitespace-nowrap">
          I²C · <span className="font-mono">400</span> <span className="font-sans">kHz</span>
        </div>
        <div className="text-[var(--hw-text-primary)] whitespace-nowrap">
          SSD1306 · <span className="font-mono">128×64</span> <span className="font-sans">px</span>
        </div>
      </div>

      {/* Telemetry Matrix Grid: Target MCU & Stream clock only (no duplicate bus/serial cells) */}
      <div className="grid grid-cols-2 gap-2.5 text-xs">
        <div>
          <span className="text-[var(--hw-text-secondary)] block text-[11px] font-sans">Target MCU</span>
          <span className="font-medium text-[var(--hw-text-primary)] font-sans">{mcu}</span>
        </div>
        <div>
          <span className="text-[var(--hw-text-secondary)] block text-[11px] font-sans">Stream clock</span>
          <span className="font-medium text-[var(--hw-text-primary)]">
            <span className="font-mono">{fps}</span> <span className="font-sans text-[11px]">FPS</span>
          </span>
        </div>
      </div>

      {/* Frame Counter & Oscilloscope Strip */}
      <div className="flex items-center justify-between gap-2 p-2 rounded-[8px] bg-[var(--hw-bg-canvas)] border border-[var(--hw-border-hairline)]">
        <div className="flex flex-col">
          <span className="text-[var(--hw-text-secondary)] text-[11px]">Frame buffer</span>
          <span className="font-mono text-xs font-medium text-[var(--hw-text-primary)] tabular-nums">
            {totalFrames > 0
              ? `${String(currentFrame + 1).padStart(3, '0')} / ${String(totalFrames).padStart(3, '0')}`
              : '000 / 000'}
          </span>
        </div>

        {/* Micro-Oscilloscope Canvas */}
        <div className={`w-16 h-5 border border-[var(--hw-border-hairline)] overflow-hidden rounded-[4px] ${isDark ? 'bg-black/40' : 'bg-black/10'}`}>
          <canvas ref={canvasRef} width={64} height={20} className="w-full h-full block" />
        </div>
      </div>
    </div>
  );
};
