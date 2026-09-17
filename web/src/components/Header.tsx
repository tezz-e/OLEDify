import React from 'react';
import { Cpu, Download, Sparkles, Zap } from 'lucide-react';

interface HeaderProps {
  serialConnected?: boolean;
  onSerialConnect?: () => void;
  onExportClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  serialConnected = false,
  onSerialConnect,
  onExportClick,
}) => {
  return (
    <header className="h-14 border-b border-oled-border bg-oled-surface px-4 flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <div className="h-8 w-8 rounded bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-oled-cyan">
          <Sparkles className="w-4 h-4 animate-pulse" />
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-wider text-slate-100 flex items-center gap-2">
            OLED VISUAL STUDIO
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 text-oled-cyan border border-cyan-500/30">
              128×64 STUDIO
            </span>
          </h1>
          <p className="text-[11px] text-oled-muted">ESP32-S3 SH1106 / SSD1306 Visual Engine</p>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        {/* Connect USB Serial Button */}
        <button
          type="button"
          onClick={onSerialConnect}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-mono border transition-all cursor-pointer ${
            serialConnected
              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 animate-pulse'
              : 'bg-oled-panel text-slate-300 border-oled-border hover:bg-slate-800'
          }`}
        >
          {serialConnected ? <Zap className="w-3.5 h-3.5 text-emerald-400" /> : <Cpu className="w-3.5 h-3.5 text-cyan-400" />}
          <span>{serialConnected ? 'ESP32 Connected (Live Stream)' : 'Connect USB Serial'}</span>
        </button>

        {/* Export frames.h Button */}
        <button
          type="button"
          onClick={onExportClick}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-oled-cyan border border-cyan-500/40 text-xs font-medium transition-all cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export frames.h</span>
        </button>
      </div>
    </header>
  );
};
