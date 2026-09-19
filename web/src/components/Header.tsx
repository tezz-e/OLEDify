import React from 'react';
import { Settings } from 'lucide-react';

interface HeaderProps {
  serialConnected: boolean;
  onSerialToggle: () => void;
  onExportClick: () => void;
  onSettingsOpen: () => void;
  hasMedia: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  serialConnected,
  onSerialToggle,
  onExportClick,
  onSettingsOpen,
  hasMedia,
}) => {
  return (
    <header className="h-[44px] flex items-center justify-between px-4 bg-oled-surface border-b border-oled-border shrink-0">
      <div className="flex items-center">
        <h1 className="text-base font-semibold tracking-tight text-slate-100">OLEDify</h1>
      </div>
      
      <div className="flex items-center space-x-3">
        <button 
          onClick={onSettingsOpen}
          className="text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-oled-panel transition-colors"
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        <button
          onClick={onSerialToggle}
          className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-oled-panel border border-oled-border hover:bg-oled-border-bright transition-colors text-xs font-medium text-slate-200"
        >
          <span className="relative flex h-2 w-2">
            {serialConnected && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            )}
            <span className={`relative inline-flex rounded-full h-2 w-2 ${serialConnected ? 'bg-emerald-500' : 'bg-slate-600'}`}></span>
          </span>
          <span>{serialConnected ? 'Connected' : 'Connect USB'}</span>
        </button>

        <button
          onClick={onExportClick}
          disabled={!hasMedia}
          title={!hasMedia ? "Upload media first" : "Export project"}
          className={`px-4 py-1 rounded text-xs font-medium transition-colors ${
            hasMedia 
              ? 'bg-cyan-500/20 text-oled-cyan border border-cyan-500/40 hover:bg-cyan-500/30 cursor-pointer' 
              : 'bg-oled-panel text-slate-500 border border-oled-border cursor-not-allowed'
          }`}
        >
          Export
        </button>
      </div>
    </header>
  );
};
