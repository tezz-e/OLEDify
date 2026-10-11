import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, Cpu } from 'lucide-react';
import { detectGpu, GpuTelemetry } from '../engine/gpuDetector';
import { LiquidStudioNav } from './navigation/LiquidStudioNav';
import { TextScramble } from './motion/TextScramble';
import { HW_SPRINGS } from '../theme/springPresets';

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
    <header className="relative w-full h-12 px-4 border-b border-white/[0.08] bg-[var(--hw-bg-canvas)] text-[var(--hw-text-primary)] flex items-center justify-between shrink-0 z-20 font-sans">
      {/* Left: Logo + Mode Switcher Tabs */}
      <div className="flex items-center gap-4">
        <h1 className="text-sm font-semibold tracking-tight flex items-center gap-2 select-none group cursor-default">
          <span className="text-[var(--hw-text-primary)] font-semibold">OLED Studio</span>
        </h1>

        {onViewChange && (
          <LiquidStudioNav
            activeView={activeView}
            onViewChange={onViewChange}
          />
        )}
      </div>

      {/* Right: Device cluster (GPU, connect, baud) + Primary action (Compile) */}
      <div className="flex items-center gap-2">
        {/* GPU Chip */}
        {gpuInfo && gpuInfo.webGlSupported && (
          <div
            onClick={onSettingsOpen}
            className="hidden xl:flex items-center gap-2 h-8 px-2.5 rounded-[8px] border border-white/[0.08] bg-[var(--hw-bg-surface)] text-xs text-[var(--hw-text-secondary)] hover:text-[var(--hw-text-primary)] hover:border-white/20 cursor-pointer transition-colors max-w-[190px]"
            title={`${gpuInfo.renderer}\nArchitecture: ${gpuInfo.isDedicated ? 'Dedicated GPU' : 'Integrated GPU'}`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                gpuInfo.isDedicated ? 'bg-zinc-400' : 'bg-zinc-500'
              }`}
            />
            <span className="font-medium text-[var(--hw-text-primary)] truncate">
              {gpuInfo.simplifiedName.replace(/\s*\(\s*0x[0-9a-fA-F]+\s*\)/gi, '').trim()}
            </span>
          </div>
        )}

        {/* USB Connect Button */}
        <motion.button
          whileTap={{ scale: 0.96 }}
          transition={HW_SPRINGS.snappy}
          onClick={onSerialToggle}
          className="h-8 px-3 rounded-[8px] border border-white/[0.08] bg-[var(--hw-bg-surface)] text-xs font-medium text-[var(--hw-text-primary)] hover:border-white/20 flex items-center gap-2 transition-colors cursor-pointer"
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              serialConnected 
                ? 'bg-white' 
                : 'bg-[#71717A]'
            }`}
          />
          <span>{serialConnected ? 'Connected' : 'Connect USB'}</span>
        </motion.button>

        {/* USB Serial Baud Chip (Mono number, clean sans label) */}
        {onBaudRateToggle && !serialConnected && (
          <motion.button
            whileTap={{ scale: 0.96 }}
            transition={HW_SPRINGS.snappy}
            onClick={onBaudRateToggle}
            title={`USB serial speed: ${baudRate === 115200 ? '115,200 baud' : '921,600 baud'}\nClick to toggle.`}
            className="h-8 px-2.5 rounded-[8px] border border-white/[0.08] text-xs font-medium text-[var(--hw-text-secondary)] bg-[var(--hw-bg-surface)] hover:text-[var(--hw-text-primary)] hover:border-white/20 transition-colors cursor-pointer flex items-center gap-1"
          >
            <span className="font-mono">{baudRate === 115200 ? '115.2k' : '921.6k'}</span>
            <span className="text-[11px] text-[var(--hw-text-secondary)] font-sans">baud</span>
          </motion.button>
        )}

        {serialConnected && (
          <span
            className="h-8 px-2.5 rounded-[8px] border border-white/[0.08] bg-[var(--hw-bg-surface)] text-xs text-[var(--hw-text-primary)] flex items-center gap-1"
            title={`USB serial speed: ${baudRate === 115200 ? '115,200 baud' : '921,600 baud'}`}
          >
            <span className="font-mono">{baudRate === 115200 ? '115.2k' : '921.6k'}</span>
            <span className="text-[11px] text-[var(--hw-text-secondary)] font-sans">baud</span>
          </span>
        )}

        {/* Hardware Settings Button */}
        <motion.button 
          whileTap={{ scale: 0.94 }}
          transition={HW_SPRINGS.snappy}
          onClick={onSettingsOpen}
          className="h-8 w-8 rounded-[8px] border border-white/[0.08] bg-[var(--hw-bg-surface)] text-[var(--hw-text-secondary)] hover:text-[var(--hw-text-primary)] hover:border-white/20 flex items-center justify-center transition-colors cursor-pointer"
          title="Hardware Configuration & Settings"
          aria-label="Settings"
        >
          <Settings className="w-4 h-4 stroke-[1.5]" />
        </motion.button>

        {/* Compile Button (Primary action - ONE orange) */}
        <motion.button
          whileTap={hasMedia && !isExporting ? { scale: 0.96 } : undefined}
          transition={HW_SPRINGS.snappy}
          onClick={onExportClick}
          disabled={!hasMedia || isExporting}
          className={`h-8 px-3.5 rounded-[8px] border text-xs font-semibold transition-colors flex items-center justify-center ${
            hasMedia && !isExporting
              ? 'border-[#FF5500] bg-[#FF5500] text-black cursor-pointer hover:bg-[#FF6611]'
              : 'border-white/[0.08] bg-[var(--hw-bg-surface)] text-[var(--hw-text-tertiary)] opacity-40 cursor-not-allowed'
          }`}
        >
          {isExporting ? `Compiling ${exportProgress}%` : 'Compile'}
        </motion.button>
      </div>
      {exportError && (
        <div role="alert" className={`absolute right-6 top-full mt-2 max-w-sm border px-3 py-2 text-xs font-sans rounded-[8px] shadow-md ${
          isDark 
            ? 'border-[#EF4444] bg-[#1c1c1f] text-[#EF4444]' 
            : 'border-[#1A1A1A] bg-white text-[#B42318]'
        }`}>
          Export failed: {exportError}
        </div>
      )}
    </header>
  );
};
