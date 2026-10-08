import React, { useEffect, useRef } from 'react';

export interface HardwareTelemetryHUDProps {
  mcu?: string;            // "ESP32-S3"
  displayDriver?: string;  // "SH1106 128x64"
  baudRate?: number;       // 921600
  fps?: number;            // 30
  currentFrame?: number;
  totalFrames?: number;
  audioTelemetry?: number[]; // [0..1] normalized audio energy buffer
  isConnected?: boolean;
  themeMode?: 'light' | 'dark';
  className?: string;
}

export const HardwareTelemetryHUD: React.FC<HardwareTelemetryHUDProps> = ({
  mcu = 'ESP32-S3',
  displayDriver = 'SH1106',
  baudRate = 921600,
  fps = 30,
  currentFrame = 0,
  totalFrames = 120,
  audioTelemetry = [],
  isConnected = true,
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
    ctx.strokeStyle = isDark ? '#00FF66' : '#02963B';
    ctx.lineWidth = 1.2;

    ctx.beginPath();
    const len = Math.max(2, audioTelemetry.length > 0 ? audioTelemetry.length : 32);
    for (let i = 0; i < len; i++) {
      const val = audioTelemetry[i] ?? (Math.sin(i * 0.45 + Date.now() * 0.005) * 0.4 + 0.5);
      const x = (i / (len - 1)) * canvas.width;
      const y = canvas.height - val * canvas.height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }, [audioTelemetry, isDark]);

  return (
    <div
      className={`p-3 rounded-[8px] border font-mono text-[10px] flex flex-col gap-2.5 backdrop-blur-xl select-none ${
        isDark
          ? 'bg-[#080808]/90 border-[#27272A] text-[#FAFAFA] shadow-[0_8px_24px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.14)]'
          : 'bg-[#F6F6F4]/90 border-[#1A1A1A] text-[#1A1A1A] shadow-[0_4px_16px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.95)]'
      } ${className}`}
      aria-label="Hardware Telemetry HUD"
    >
      {/* Top Header with Nothing Glyph Matrix and LED Beacon */}
      <div className="flex items-center justify-between border-b border-current/15 pb-2">
        <div className="flex items-center gap-2">
          {/* 2x2 Glyph Matrix */}
          <div className="grid grid-cols-2 gap-[2px]">
            <span
              className={`w-1 h-1 rounded-full ${
                isConnected
                  ? 'bg-[#00FF66] shadow-[0_0_6px_#00FF66]'
                  : 'bg-[#FF5500]'
              }`}
            />
            <span className="w-1 h-1 rounded-full bg-current opacity-40" />
            <span className="w-1 h-1 rounded-full bg-current opacity-60" />
            <span className="w-1 h-1 rounded-full bg-current opacity-20" />
          </div>
          <span className="font-bold tracking-widest text-[9px]">HARDWARE_HUD</span>
        </div>

        <span className="text-[8px] px-1.5 py-0.2 rounded border border-current/20 uppercase font-semibold">
          1-BIT MONO
        </span>
      </div>

      {/* Telemetry Matrix Grid */}
      <div className="grid grid-cols-2 gap-2 text-[9px]">
        <div>
          <span className="opacity-50 block text-[8px] uppercase">TARGET MCU</span>
          <span className="font-bold text-[#FF5500] uppercase">{mcu}</span>
        </div>
        <div>
          <span className="opacity-50 block text-[8px] uppercase">CONTROLLER</span>
          <span className="font-bold uppercase">{displayDriver} 128×64</span>
        </div>
        <div>
          <span className="opacity-50 block text-[8px] uppercase">SERIAL SPEED</span>
          <span className="font-bold text-[#00FF66]">{baudRate.toLocaleString()} BAUD</span>
        </div>
        <div>
          <span className="opacity-50 block text-[8px] uppercase">STREAM CLOCK</span>
          <span className="font-bold">{fps} FPS • 33ms</span>
        </div>
      </div>

      {/* Frame Counter & Oscilloscope Strip */}
      <div className="flex items-center justify-between gap-2 p-1.5 rounded-[4px] bg-black/40 border border-current/15">
        <div className="flex flex-col">
          <span className="opacity-50 text-[8px]">FRAME BUFFER</span>
          <span className="font-bold text-[#00FF66] tabular-nums">
            {String(currentFrame + 1).padStart(3, '0')} / {String(totalFrames).padStart(3, '0')}
          </span>
        </div>

        {/* Micro-Oscilloscope Canvas */}
        <div className="w-16 h-5 border border-current/20 bg-black/60 overflow-hidden rounded-[2px]">
          <canvas ref={canvasRef} width={64} height={20} className="w-full h-full block" />
        </div>
      </div>
    </div>
  );
};
