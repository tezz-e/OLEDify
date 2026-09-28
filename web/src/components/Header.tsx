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
      
      <div className="flex items-center space-x-2.5">
        {gpuInfo && gpuInfo.webGlSupported && (
          <div
            onClick={onSettingsOpen}
            className="hidden lg:flex items-center gap-2 px-2.5 py-1 border border-[#E8E5DE] bg-white rounded-lg text-xs font-sans text-[#5E5D59] cursor-pointer hover:border-[#D97757] transition-colors shadow-xs"
            title={`${gpuInfo.renderer}\nArchitecture: ${gpuInfo.isDedicated ? 'Dedicated GPU' : 'Integrated GPU'}`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                gpuInfo.isDedicated ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
            <span className="font-medium text-[#141413]">{gpuInfo.simplifiedName}</span>
            <span className={`text-[10px] font-mono px-1 py-0.2 rounded ${
              gpuInfo.isDedicated ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
            }`}>
              {gpuInfo.isDedicated ? 'dGPU' : 'iGPU'}
            </span>
          </div>
        )}

        <button 
          onClick={onSettingsOpen}
          className="p-2 bg-white border border-[#E8E5DE] text-[#5E5D59] hover:text-[#141413] hover:bg-[#FAF9F5] transition-colors rounded-lg shadow-xs cursor-pointer"
          title="Hardware Settings"
          aria-label="Hardware Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        <button
          onClick={onSerialToggle}
          className="flex items-center space-x-2 px-3 py-1.5 bg-white border border-[#E8E5DE] text-xs font-sans font-medium text-[#141413] hover:bg-[#FAF9F5] transition-colors rounded-lg shadow-xs cursor-pointer"
        >
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              serialConnected ? 'bg-emerald-500' : 'bg-[#87867F]'
            }`}
          />
          <span>{serialConnected ? 'USB Active' : 'Connect USB'}</span>
        </button>

        <button
          onClick={onExportClick}
          disabled={!hasMedia || isExporting}
          className={`px-4 py-1.5 text-xs font-sans font-medium rounded-lg shadow-xs transition-all cursor-pointer ${
            hasMedia && !isExporting
              ? 'bg-[#D97757] hover:bg-[#C66545] text-white'
              : 'bg-[#FAF9F5] border border-[#E8E5DE] text-[#87867F] opacity-60 cursor-not-allowed'
          }`}
        >
          {isExporting ? `Compiling ${exportProgress}%` : 'Export Header'}
        </button>
      </div>

      {exportError && (
        <div role="alert" className="absolute right-6 top-full mt-2 max-w-sm border border-red-200 bg-red-50 px-3 py-2 text-xs font-sans text-red-700 rounded-lg shadow-md">
          Export failed: {exportError}
        </div>
      )}
    </header>
  );
};
