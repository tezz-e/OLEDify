import React, { useState, useEffect } from 'react';
import { Settings, Cpu, Sun, Moon } from 'lucide-react';
import { DecryptedText } from './reactbits/DecryptedText';
import { ClickSpark } from './reactbits/ClickSpark';
import SpecularButton from './reactbits/SpecularButton';
import { detectGpu, GpuTelemetry } from '../engine/gpuDetector';

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
}) => {
  const [gpuInfo, setGpuInfo] = useState<GpuTelemetry | null>(null);
  const isDark = themeMode === 'dark';

  useEffect(() => {
    setGpuInfo(detectGpu());
  }, []);

  return (
    <header className={`relative w-full h-14 px-6 border-b-2 flex items-center justify-between shrink-0 z-20 transition-colors duration-200 ${
      isDark ? 'bg-[#120E1F] border-[#2D2344] text-[#FAF8FC]' : 'bg-white border-[#1A1A1A] text-[#1A1A1A]'
    }`}>
      <div className="flex items-center">
        <h1 className={`text-base font-bold tracking-wider font-mono flex items-center gap-1.5 cursor-pointer select-none ${
          isDark ? 'text-white' : 'text-[#1A1A1A]'
        }`}>
          <span className={isDark ? 'text-[#00F0FF] drop-shadow-[0_0_8px_#00F0FF]' : 'text-[#E85D2A]'}>▲</span>
          <DecryptedText
            text="OLED_STUDIO"
            speed={35}
            characters={isDark ? "0123456789ABCDEF_~<>[]◆◇▲▼" : "0123456789ABCDEF_~<>[]"}
            animateOn="hover"
            className="font-mono tracking-widest font-bold"
          />
        </h1>
      </div>

      {/* Center View Mode Switcher */}
      {onViewChange && (
        <div className={`hidden md:flex items-center border p-0.5 font-mono text-[10px] font-bold ${
          isDark ? 'border-[#2D2344] bg-[#181328]' : 'border-[#1A1A1A] bg-[#F5F0EB]'
        }`}>
          <button
            onClick={() => onViewChange('editor')}
            className={`px-3 py-1 transition-all cursor-pointer ${
              activeView === 'editor'
                ? isDark
                  ? 'bg-[#00F0FF] text-black shadow-[2px_2px_0_#FF2A85] font-extrabold'
                  : 'bg-[#1A1A1A] text-white shadow-sm'
                : isDark ? 'text-zinc-400 hover:text-white' : 'text-[#6B6B6B] hover:text-[#1A1A1A]'
            }`}
          >
            🎞️ NLE TIMELINE
          </button>
          <button
            onClick={() => onViewChange('lyrics-studio')}
            className={`px-3 py-1 transition-all cursor-pointer flex items-center gap-1 ${
              activeView === 'lyrics-studio'
                ? isDark
                  ? 'bg-[#FF2A85] text-white shadow-[2px_2px_0_#00F0FF] font-extrabold'
                  : 'bg-[#E85D2A] text-white shadow-sm'
                : isDark ? 'text-zinc-400 hover:text-[#FF2A85]' : 'text-[#6B6B6B] hover:text-[#E85D2A]'
            }`}
          >
            <span>✨</span>
            <span>KINETIC LYRICS STUDIO</span>
          </button>
        </div>
      )}
      
      <div className="flex items-center space-x-3">
        {gpuInfo && gpuInfo.webGlSupported && (
          <div
            onClick={onSettingsOpen}
            className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 border text-[9px] font-mono cursor-pointer transition-colors ${
              isDark 
                ? 'border-[#2D2344] bg-[#181328] text-zinc-300 hover:border-[#00F0FF]' 
                : 'border-[#1A1A1A] bg-[#F5F0EB] text-[#1A1A1A] hover:border-[#E85D2A]'
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
                ? isDark ? 'bg-[#00F0FF] text-black font-extrabold' : 'bg-[#1A1A1A] text-white' 
                : 'bg-amber-100 text-amber-900 border border-amber-300'
            }`}>
              {gpuInfo.isDedicated ? 'DEDICATED' : 'INTEGRATED'}
            </span>
          </div>
        )}

        {/* Global Theme Toggle Button */}
        {onThemeToggle && (
          <ClickSpark
            sparkColor={isDark ? "#00F0FF" : "#E85D2A"}
            sparkCount={8}
            sparkSize={6}
            sparkRadius={18}
            duration={300}
          >
            <button
              onClick={onThemeToggle}
              className={`p-2 border transition-all duration-150 cursor-pointer flex items-center justify-center ${
                isDark 
                  ? 'bg-[#181328] border-[#2D2344] text-[#E2FF00] hover:border-[#00F0FF] hover:bg-[#221A38]' 
                  : 'bg-white border-[#1A1A1A] text-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white'
              }`}
              title={isDark ? "Switch to Blueprint Light Mode" : "Switch to Arcade Neo-Pop Dark Mode"}
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="w-4 h-4 text-[#E2FF00]" /> : <Moon className="w-4 h-4 text-[#1A1A1A]" />}
            </button>
          </ClickSpark>
        )}

        <button 
          onClick={onSettingsOpen}
          className={`p-2 border transition-colors duration-150 cursor-pointer ${
            isDark 
              ? 'bg-[#181328] border-[#2D2344] text-white hover:bg-[#251D3D] hover:border-[#00F0FF]' 
              : 'bg-white border-[#1A1A1A] text-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white'
          }`}
          title="Settings"
          aria-label="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        <ClickSpark
          sparkColor={isDark ? "#00F0FF" : "#E85D2A"}
          sparkCount={8}
          sparkSize={6}
          sparkRadius={18}
          duration={300}
        >
          <button
            onClick={onSerialToggle}
            className={`flex items-center space-x-2 px-3 py-1.5 border text-xs font-mono font-medium transition-colors duration-150 cursor-pointer ${
              isDark 
                ? 'bg-[#181328] border-[#2D2344] text-white hover:border-[#00F0FF]' 
                : 'bg-white border-[#1A1A1A] text-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white'
            }`}
          >
            <span
              className={`w-[6px] h-[6px] shrink-0 ${
                serialConnected 
                  ? isDark ? 'bg-[#00F0FF] shadow-[0_0_6px_#00F0FF]' : 'bg-[#E85D2A]'
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

        <ClickSpark
          sparkColor={isDark ? "#E2FF00" : "#E85D2A"}
          sparkSize={7}
          sparkRadius={22}
          sparkCount={12}
          duration={350}
        >
          <SpecularButton
            onClick={onExportClick}
            disabled={!hasMedia || isExporting}
            size="sm"
            tint={hasMedia ? (isDark ? "#E2FF00" : "#E85D2A") : (isDark ? "#181328" : "#F5F0EB")}
            tintOpacity={1}
            baseColor={hasMedia ? (isDark ? "#E2FF00" : "#E85D2A") : (isDark ? "#181328" : "#F5F0EB")}
            lineColor={isDark ? "#000000" : "#1A1A1A"}
            textColor={hasMedia ? (isDark ? "#000000" : "#FFFFFF") : (isDark ? "#7E7694" : "#6B6B6B")}
            radius={0}
            className={`text-xs font-mono font-bold tracking-wider rounded-none border-2 ${
              isDark 
                ? 'border-black shadow-[3px_3px_0_#FF2A85] active:translate-x-[1px] active:translate-y-[1px]' 
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
            ? 'border-[#FF2A85] bg-[#181328] text-[#FF4365]' 
            : 'border-[#1A1A1A] bg-white text-[#B42318]'
        }`}>
          EXPORT FAILED: {exportError}
        </div>
      )}
    </header>
  );
};
