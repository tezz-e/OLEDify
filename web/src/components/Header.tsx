import React, { useState, useEffect } from 'react';
import { Settings, Cpu, Sun, Moon } from 'lucide-react';
import { DecryptedText } from './reactbits/DecryptedText';
import { ClickSpark } from './reactbits/ClickSpark';
import SpecularButton from './reactbits/SpecularButton';
import { ThemeToggle } from './reactbits/ThemeToggle';
import { detectGpu, GpuTelemetry } from '../engine/gpuDetector';
import { LiquidStudioNav } from './navigation/LiquidStudioNav';

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
    <header className={`relative w-full h-14 px-6 border-b flex items-center justify-between shrink-0 z-20 transition-colors duration-200 ${
      isDark ? 'bg-[#000000] border-white/10 text-[#FAFAFA]' : 'bg-[#FFFFFF] border-[#1A1A1A] text-[#1A1A1A]'
    }`}>
      <div className="flex items-center">
        <h1 className={`text-base font-bold tracking-wider font-mono flex items-center gap-2 cursor-pointer select-none ${
          isDark ? 'text-white' : 'text-[#1A1A1A]'
        }`}>
          <span className={isDark ? 'text-[#FF5500] drop-shadow-[0_0_8px_rgba(255,85,0,0.6)]' : 'text-[#E85D2A]'}>▲</span>
          <DecryptedText
            text="OLED_STUDIO"
            speed={35}
            characters={isDark ? "0123456789ABCDEF_~<>[]◆◇▲▼" : "0123456789ABCDEF_~<>[]"}
            animateOn="hover"
            className="font-mono tracking-widest font-bold"
          />
        </h1>
      </div>

      {/* Center View Mode Switcher: Liquid Mercury Gooey Nav */}
      {onViewChange && (
        <div className="hidden md:flex items-center justify-center">
          <LiquidStudioNav
            activeView={activeView}
            onViewChange={onViewChange}
            themeMode={themeMode}
          />
        </div>
      )}
      
      <div className="flex items-center space-x-3">
        {gpuInfo && gpuInfo.webGlSupported && (
          <div
            onClick={onSettingsOpen}
            className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 border text-[9px] font-mono cursor-pointer transition-colors ${
              isDark 
                ? 'border-white/10 bg-[#0A0A0C] text-zinc-300 hover:border-white/30' 
                : 'border-[#1A1A1A] bg-[#F6F6F4] text-[#1A1A1A] hover:border-[#E85D2A]'
            }`}
            title={`${gpuInfo.renderer}\nArchitecture: ${gpuInfo.isDedicated ? 'Dedicated GPU' : 'Integrated GPU'}`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                gpuInfo.isDedicated ? 'bg-emerald-400 shadow-[0_0_5px_#10B981]' : 'bg-amber-400'
              }`}
            />
            <span className={`font-bold ${isDark ? 'text-white' : 'text-[#1A1A1A]'}`}>{gpuInfo.simplifiedName}</span>
            <span className={`text-[7px] px-1 py-0.2 font-bold uppercase rounded-xs ${
              gpuInfo.isDedicated 
                ? isDark ? 'bg-[#00FF66] text-black font-extrabold shadow-[0_0_6px_rgba(0,255,102,0.4)]' : 'bg-[#1A1A1A] text-white' 
                : 'bg-amber-100 text-amber-900 border border-amber-300'
            }`}>
              {gpuInfo.isDedicated ? 'DEDICATED' : 'INTEGRATED'}
            </span>
          </div>
        )}

        {/* Skiper UI & React Bits Theme Toggle */}
        {onThemeToggle && (
          <ThemeToggle
            themeMode={themeMode}
            onToggle={onThemeToggle}
          />
        )}

        <button 
          onClick={onSettingsOpen}
          className={`p-2 border transition-colors duration-150 cursor-pointer ${
            isDark 
              ? 'bg-[#0A0A0C] border-white/10 text-white hover:bg-white/10 hover:border-white/30' 
              : 'bg-white border-[#1A1A1A] text-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white'
          }`}
          title="Settings"
          aria-label="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        <div className="flex items-center">
          <ClickSpark
            sparkColor={isDark ? "#FF5500" : "#E85D2A"}
            sparkCount={8}
            sparkSize={6}
            sparkRadius={18}
            duration={300}
          >
            <button
              onClick={onSerialToggle}
              className={`flex items-center space-x-2 px-3 py-1.5 border text-xs font-mono font-medium transition-colors duration-150 cursor-pointer ${
                isDark 
                  ? 'bg-[#0A0A0E] border-white/10 text-white hover:border-[#FF5500] hover:bg-white/5' 
                  : 'bg-white border-[#1A1A1A] text-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white'
              }`}
            >
              <span
                className={`w-[6px] h-[6px] shrink-0 rounded-full ${
                  serialConnected 
                    ? isDark ? 'bg-[#FF5500] shadow-[0_0_8px_#FF5500]' : 'bg-[#E85D2A]'
                    : 'bg-[#6B6B6B]'
                }`}
              />
              <span className="font-mono">
                <DecryptedText
                  key={serialConnected ? 'connected' : 'disconnected'}
                  text={serialConnected ? 'Connected' : 'Connect USB'}
                  speed={30}
                  characters={isDark ? "0123456789ABCDEF◆◇" : "0123456789ABCDEF"}
                  animateOn="view"
                />
              </span>
            </button>
          </ClickSpark>

          {onBaudRateToggle && !serialConnected && (
            <button
              onClick={onBaudRateToggle}
              title={`Serial Speed: ${baudRate === 115200 ? '115,200 Baud (Standard)' : '921,600 Baud (Turbo 30FPS)'}\nClick to toggle.`}
              className={`ml-1 px-2 py-1.5 border text-[10px] font-mono font-bold transition-colors cursor-pointer select-none ${
                baudRate === 921600
                  ? isDark ? 'border-[#FF5500] bg-[#FF5500]/15 text-[#FF5500] shadow-[0_0_10px_rgba(255,85,0,0.25)]' : 'border-[#E85D2A] bg-[#FFF5F0] text-[#E85D2A]'
                  : isDark ? 'border-white/10 bg-[#0A0A0C] text-zinc-400 hover:text-white' : 'border-[#1A1A1A] bg-white text-[#6B6B6B] hover:text-[#1A1A1A]'
              }`}
            >
              {baudRate === 115200 ? '115.2K' : '921.6K ⚡'}
            </button>
          )}

          {serialConnected && (
            <span
              title={`Streaming active at ${baudRate} baud`}
              className={`ml-1 px-1.5 py-1 text-[9px] font-mono font-bold border ${
                isDark ? 'border-white/10 bg-[#0A0A0C] text-[#FF5500]' : 'border-[#1A1A1A]/30 bg-white text-[#E85D2A]'
              }`}
            >
              {baudRate === 115200 ? '115.2K' : '921.6K'}
            </span>
          )}
        </div>

        <ClickSpark
          sparkColor={isDark ? "#FF5500" : "#E85D2A"}
          sparkSize={7}
          sparkRadius={22}
          sparkCount={12}
          duration={350}
        >
          <SpecularButton
            onClick={onExportClick}
            disabled={!hasMedia || isExporting}
            size="sm"
            tint={hasMedia ? (isDark ? "#00FF66" : "#E85D2A") : (isDark ? "#121214" : "#F5F0EB")}
            tintOpacity={1}
            baseColor={hasMedia ? (isDark ? "#00FF66" : "#E85D2A") : (isDark ? "#121214" : "#F5F0EB")}
            lineColor={isDark ? "#000000" : "#1A1A1A"}
            textColor={hasMedia ? (isDark ? "#000000" : "#FFFFFF") : (isDark ? "#71717A" : "#6B6B6B")}
            radius={0}
            className={`text-xs font-mono font-bold tracking-wider rounded-none border ${
              isDark 
                ? 'border-white/20 shadow-[0_0_12px_rgba(0,255,102,0.35)] active:translate-y-[1px]' 
                : 'border-[#1A1A1A]'
            } ${!hasMedia || isExporting ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            {isExporting ? `COMPILING ${exportProgress}%` : 'COMPILE'}
          </SpecularButton>
        </ClickSpark>
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
