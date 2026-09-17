import React, { useState } from 'react';
import { X, Copy, Download, Check, Code } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  cppCode: string;
  frameCount: number;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  cppCode,
  frameCount,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(cppCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([cppCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'frames.h';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-oled-surface border border-oled-border rounded-xl max-w-3xl w-full flex flex-col max-h-[85vh] shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-oled-border">
          <div className="flex items-center space-x-2">
            <Code className="w-5 h-5 text-oled-cyan" />
            <h3 className="text-sm font-bold text-slate-100">
              Export C++ PROGMEM Header (`frames.h`)
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-oled-cyan border border-cyan-500/30">
              {frameCount} Frames
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Code Content View */}
        <div className="flex-1 p-4 overflow-auto font-mono text-xs text-slate-300 bg-oled-bg/90 space-y-2">
          <p className="text-[11px] text-slate-400 font-sans">
            Replace your <code className="text-oled-cyan">src/frames.h</code> file in PlatformIO with this content:
          </p>
          <pre className="p-3 bg-black/60 border border-oled-border/60 rounded text-[11px] leading-relaxed text-cyan-300 overflow-x-auto max-h-[450px]">
            {cppCode}
          </pre>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between p-4 border-t border-oled-border bg-oled-panel">
          <span className="text-xs text-oled-muted font-mono">
            Size: ~{Math.round((frameCount * 1024) / 1024)} KB PROGMEM Flash
          </span>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleCopy}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied!' : 'Copy Code'}</span>
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-oled-cyan border border-cyan-500/40 text-xs font-medium cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download frames.h</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
