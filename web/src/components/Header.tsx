import React, { useState, useEffect } from 'react';
import { Settings, Cpu } from 'lucide-react';
import { detectGpu, GpuTelemetry } from '../engine/gpuDetector';
import { LiquidStudioNav } from './navigation/LiquidStudioNav';
import { TextScramble } from './motion/TextScramble';

interface HeaderProps {
  serialConnected: boolean;
  onSerialToggle: () => void;
  onExportClick: () => void;
  onSettingsOpen: () => void;
  hasMedia: boolean;
  isExporting: boolean;
  exportProgress: number;
  exportError: string | null;
  activeView?: 'editor' | 'lyrics-studio';
  onViewChange?: (view: 'editor' | 'lyrics-studio') => void;
  themeMode?: 'light' | 'dark';
  onThemeToggle?: () => void;
  baudRate?: number;
  onBaudRateToggle?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  serialConnected,
  onSerialToggle,
  onExportClick,
  onSettingsOpen,
  hasMedia,
  isExporting,
  exportProgress,
  exportError,
  activeView = 'editor',
  onViewChange,
  themeMode = 'light',
  onThemeToggle,
  baudRate = 115200,
  onBaudRateToggle,
}) => {
  const [gpuInfo, setGpuInfo] = useState<GpuTelemetry | null>(null);
  const isDark = themeMode === 'dark';

  useEffect(() => {
    setGpuInfo(detectGpu());
  }, []);

  return (
    <header className="relative w-full h-12 px-4 border-b border-white/10 bg-[#181A1B] text-[#FAFAFA] flex items-center justify-between shrink-0 z-20 font-mono">
      <div className="flex items-center gap-3">
        <h1 className="text-xs font-bold tracking-widest flex items-center gap-2 select-none group cursor-default">
          <span className="text-[#FF5500]">▲</span>
          <TextScramble text="OLED_STUDIO" className="text-[#FAFAFA]" triggerOnHover={true} />
        </h1>
      </div>

      {/* Center View Mode Switcher: Hero Moment 1 */}
      {onViewChange && (
        <div className="hidden md:flex items-center justify-center">
          <LiquidStudioNav
            activeView={activeView}
            onViewChange={onViewChange}
          />
        </div>
      )}
      
      <div className="flex items-center gap-2">
        {/* GPU Chip (Truncated with ellipsis & tooltip, no green) */}
        {gpuInfo && gpuInfo.webGlSupported && (
          <div
            onClick={onSettingsOpen}
            className="hidden lg:flex items-center gap-2 h-7 px-2.5 rounded-[4px] border border-white/10 bg-[#202225] text-[10px] text-[#A1A1AA] hover:text-[#FAFAFA] hover:border-white/20 cursor-pointer transition-colors max-w-[210px]"
            title={`${gpuInfo.renderer}\nArchitecture: ${gpuInfo.isDedicated ? 'Dedicated GPU' : 'Integrated GPU'}`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                gpuInfo.isDedicated ? 'bg-zinc-400' : 'bg-zinc-500'
              }`}
            />
            <span className="font-medium text-[#FAFAFA] truncate">
              {gpuInfo.simplifiedName.replace(/\s*\(\s*0x[0-9a-fA-F]+\s*\)/gi, '').trim()}
            </span>
          </div>
        )}

        {/* Settings button */}
        <button 
          onClick={onSettingsOpen}
          className="h-7 w-7 rounded-[4px] border border-white/10 bg-[#202225] text-[#A1A1AA] hover:text-[#FAFAFA] hover:border-white/20 flex items-center justify-center transition-colors cursor-pointer"
          title="Hardware Configuration & Settings"
          aria-label="Settings"
        >
          <Settings className="w-3.5 h-3.5 stroke-[1.5]" />
        </button>

        {/* USB Connect Chip - THE SINGLE GREEN ELEMENT IN THE ENTIRE UI */}
        <button
          onClick={onSerialToggle}
          className="h-7 px-2.5 rounded-[4px] border border-white/10 bg-[#202225] text-[10px] text-[#FAFAFA] hover:border-white/20 flex items-center gap-2 transition-colors cursor-pointer"
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              serialConnected 
                ? 'bg-[#00FF66]' 
                : 'bg-[#71717A]'
            }`}
          />
          <span>{serialConnected ? 'CONNECTED' : 'CONNECT USB'}</span>
        </button>

        {/* Serial Baud Chip (Unified style, no emoji) */}
        {onBaudRateToggle && !serialConnected && (
          <button
            onClick={onBaudRateToggle}
            title={`Serial Speed: ${baudRate === 115200 ? '115,200 Baud' : '921,600 Baud'}\nClick to toggle.`}
            className={`h-7 px-2 rounded-[4px] border text-[10px] font-medium transition-colors cursor-pointer ${
              baudRate === 921600
                ? 'border-[#FF5500] text-[#FF5500] bg-transparent'
                : 'border-white/10 text-[#A1A1AA] bg-[#202225] hover:text-[#FAFAFA]'
            }`}
          >
            {baudRate === 115200 ? '115.2K' : '921.6K'}
          </button>
        )}

        {serialConnected && (
          <span
            className="h-7 px-2 rounded-[4px] border border-white/10 bg-[#202225] text-[10px] text-[#FAFAFA] flex items-center"
          >
            {baudRate === 115200 ? '115.2K' : '921.6K'}
          </span>
        )}

        {/* Compile Button (Unified 4px radius, amber active, tertiary disabled) */}
        <button
          onClick={onExportClick}
          disabled={!hasMedia || isExporting}
          className={`h-7 px-3 rounded-[4px] border text-[10px] font-bold tracking-wider uppercase transition-colors flex items-center justify-center ${
            hasMedia && !isExporting
              ? 'border-[#FF5500] bg-[#FF5500] text-[#000000] cursor-pointer hover:bg-[#FF6611]'
              : 'border-white/10 bg-[#202225] text-[#71717A] opacity-50 cursor-not-allowed'
          }`}
        >
          {isExporting ? `COMPILING ${exportProgress}%` : 'COMPILE'}
        </button>
      </div>
      {exportError && (
        <div role="alert" className={`absolute right-6 top-full mt-2 max-w-sm border px-3 py-2 text-[10px] font-mono shadow-md ${
          isDark 
            ? 'border-[#FF1A35] bg-[#0A0A0C] text-[#FF1A35]' 
            : 'border-[#1A1A1A] bg-white text-[#B42318]'
        }`}>
          EXPORT FAILED: {exportError}
        </div>
      )}
    </header>
  );
};
