import React, { useState, useEffect } from 'react';
import { Settings, Cpu } from 'lucide-react';
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
}) => {
  const [gpuInfo, setGpuInfo] = useState<GpuTelemetry | null>(null);

  useEffect(() => {
    setGpuInfo(detectGpu());
  }, []);
  return (
    <header className="relative w-full h-14 px-6 bg-[#FAF9F5] border-b border-[#E8E5DE] flex items-center justify-between shrink-0 z-20">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-serif text-[#141413] flex items-center gap-2.5 cursor-pointer select-none">
          <span className="w-2.5 h-2.5 rounded-full bg-[#D97757]" />
          <span className="font-serif italic tracking-tight font-normal text-xl">OLEDify</span>
          <span className="text-[9px] font-mono tracking-widest text-[#5E5D59] uppercase px-1.5 py-0.5 border border-[#E8E5DE] bg-white not-italic font-semibold">
            STUDIO
          </span>
        </h1>
      </div>

      {/* Center View Mode Switcher */}
      {onViewChange && (
        <div className="hidden md:flex items-center border border-[#E8E5DE] bg-[#F0ECE1]/80 p-0.5 font-sans text-[11px] font-medium rounded-xs">
          <button
            onClick={() => onViewChange('editor')}
            className={`px-3.5 py-1 transition-all cursor-pointer rounded-xs flex items-center gap-1.5 ${
              activeView === 'editor'
                ? 'bg-[#141413] text-[#FAF9F5] shadow-xs font-semibold'
                : 'text-[#5E5D59] hover:text-[#141413]'
            }`}
          >
            <span>Timeline</span>
          </button>
          <button
            onClick={() => onViewChange('lyrics-studio')}
            className={`px-3.5 py-1 transition-all cursor-pointer flex items-center gap-1.5 rounded-xs ${
              activeView === 'lyrics-studio'
                ? 'bg-[#D97757] text-white shadow-xs font-semibold'
                : 'text-[#5E5D59] hover:text-[#D97757]'
            }`}
          >
            <span>Kinetic Typography</span>
          </button>
        </div>
      )}
      
      <div className="flex items-center space-x-3">
        {gpuInfo && gpuInfo.webGlSupported && (
          <div
            onClick={onSettingsOpen}
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 border border-[#1A1A1A] bg-[#F5F0EB] text-[9px] font-mono cursor-pointer hover:border-[#E85D2A] transition-colors"
            title={`${gpuInfo.renderer}\nArchitecture: ${gpuInfo.isDedicated ? 'Dedicated GPU' : 'Integrated GPU'}`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                gpuInfo.isDedicated ? 'bg-emerald-500 shadow-[0_0_5px_#10B981]' : 'bg-amber-500'
              }`}
            />
            <span className="font-bold text-[#1A1A1A]">{gpuInfo.simplifiedName}</span>
            <span className={`text-[7px] px-1 py-0.2 font-bold uppercase rounded-xs ${
              gpuInfo.isDedicated ? 'bg-[#1A1A1A] text-white' : 'bg-amber-100 text-amber-900 border border-amber-300'
            }`}>
              {gpuInfo.isDedicated ? 'DEDICATED' : 'INTEGRATED'}
            </span>
          </div>
        )}

        <button 
          onClick={onSettingsOpen}
          className="p-2 bg-white border border-[#1A1A1A] text-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white transition-colors duration-150 rounded-none cursor-pointer"
          title="Settings"
          aria-label="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        <ClickSpark
          sparkColor="#E85D2A"
          sparkCount={8}
          sparkSize={6}
          sparkRadius={18}
          duration={300}
        >
          <button
            onClick={onSerialToggle}
            className="flex items-center space-x-2 px-3 py-1.5 bg-white border border-[#1A1A1A] text-xs font-mono font-medium text-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white transition-colors duration-150 rounded-none cursor-pointer"
          >
            <span
              className={`w-[6px] h-[6px] shrink-0 ${
                serialConnected ? 'bg-[#E85D2A]' : 'bg-[#6B6B6B]'
              }`}
            />
            <span className="font-mono">
              <DecryptedText
                key={serialConnected ? 'connected' : 'disconnected'}
                text={serialConnected ? 'Connected' : 'Connect USB'}
                speed={30}
                characters="0123456789ABCDEF"
                animateOn="view"
              />
            </span>
          </button>
        </ClickSpark>

        <ClickSpark
          sparkColor="#E85D2A"
          sparkSize={7}
          sparkRadius={22}
          sparkCount={12}
          duration={350}
        >
          <SpecularButton
            onClick={onExportClick}
            disabled={!hasMedia || isExporting}
            size="sm"
            tint={hasMedia ? "#E85D2A" : "#F5F0EB"}
            tintOpacity={1}
            baseColor={hasMedia ? "#E85D2A" : "#F5F0EB"}
            lineColor="#1A1A1A"
            textColor={hasMedia ? "#FFFFFF" : "#6B6B6B"}
            radius={0}
            className={`text-xs font-mono font-bold tracking-wider rounded-none border-2 border-[#1A1A1A] ${!hasMedia || isExporting ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            {isExporting ? `COMPILING ${exportProgress}%` : 'COMPILE'}
          </SpecularButton>
        </ClickSpark>
      </div>
      {exportError && (
        <div role="alert" className="absolute right-6 top-full mt-2 max-w-sm border border-[#1A1A1A] bg-white px-3 py-2 text-[10px] font-mono text-[#B42318] shadow-md">
          EXPORT FAILED: {exportError}
        </div>
      )}
    </header>
  );
};
