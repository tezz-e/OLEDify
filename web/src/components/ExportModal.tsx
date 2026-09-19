import React, { useState } from 'react';
import { X, Copy, Download, Save, Check, Zap } from 'lucide-react';
import { flashAnimationToDevice } from '../engine/flasher';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  cppCode: string;
  frameCount: number;
  targetFps: number;
  frames: ImageData[];
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  cppCode,
  frameCount,
  targetFps,
  frames,
}) => {
  const [activeTab, setActiveTab] = useState<'flash' | 'save' | 'download' | 'copy'>('flash');
  const [copied, setCopied] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [flashStatus, setFlashStatus] = useState<'idle' | 'flashing' | 'flashed' | 'error'>('idle');

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

  const handleSaveToProject = async () => {
    try {
      setSaveStatus('saving');
      // @ts-ignore - File System Access API
      const handle = await window.showSaveFilePicker({
        suggestedName: 'frames.h',
        types: [{ description: 'C++ Header', accept: { 'text/plain': ['.h'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(cppCode);
      await writable.close();
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err: any) {
      if (err.name !== 'AbortError') setSaveStatus('error');
      else setSaveStatus('idle');
    }
  };

  const handleFlash = async () => {
    try {
      setFlashStatus('flashing');
      await flashAnimationToDevice(frames, targetFps);
      setFlashStatus('flashed');
      setTimeout(() => setFlashStatus('idle'), 3000);
    } catch (err) {
      console.error(err);
      setFlashStatus('error');
    }
  };

  const previewLines = cppCode.split('\n').slice(0, 15).join('\n') + '\n... (truncated)';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-oled-surface border border-oled-border rounded-xl max-w-2xl w-full flex flex-col shadow-2xl animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-oled-border">
          <h3 className="text-sm font-semibold text-slate-100">Export C++ Array</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex flex-col md:flex-row gap-6">
          {/* Actions Sidebar */}
          <div className="w-full md:w-48 space-y-2 shrink-0">
            <button
              onClick={() => { setActiveTab('flash'); handleFlash(); }}
              disabled={flashStatus === 'flashing'}
              className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs font-medium transition-colors border ${
                activeTab === 'flash' 
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-400' 
                  : 'bg-oled-panel border-oled-border text-slate-300 hover:bg-oled-border-bright'
              }`}
            >
              <div className="flex items-center gap-2">
                {flashStatus === 'flashed' ? <Check className="w-4 h-4 text-emerald-400" /> : <Zap className="w-4 h-4" />}
                <span>{flashStatus === 'flashing' ? 'Flashing...' : 'Flash to Device'}</span>
              </div>
            </button>
            
            <div className="my-2 border-t border-oled-border"></div>

            <button
              onClick={() => { setActiveTab('save'); handleSaveToProject(); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs font-medium transition-colors border ${
                activeTab === 'save' 
                  ? 'bg-cyan-500/20 border-cyan-500/40 text-oled-cyan' 
                  : 'bg-oled-panel border-oled-border text-slate-300 hover:bg-oled-border-bright'
              }`}
            >
              <div className="flex items-center gap-2">
                {saveStatus === 'saved' ? <Check className="w-4 h-4 text-emerald-400" /> : <Save className="w-4 h-4" />}
                <span>Save to Project</span>
              </div>
            </button>
            
            <button
              onClick={() => { setActiveTab('download'); handleDownload(); }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded text-xs font-medium transition-colors border ${
                activeTab === 'download' 
                  ? 'bg-cyan-500/20 border-cyan-500/40 text-oled-cyan' 
                  : 'bg-oled-panel border-oled-border text-slate-300 hover:bg-oled-border-bright'
              }`}
            >
              <Download className="w-4 h-4" />
              <span>Download File</span>
            </button>
            
            <button
              onClick={() => { setActiveTab('copy'); handleCopy(); }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded text-xs font-medium transition-colors border ${
                activeTab === 'copy' 
                  ? 'bg-cyan-500/20 border-cyan-500/40 text-oled-cyan' 
                  : 'bg-oled-panel border-oled-border text-slate-300 hover:bg-oled-border-bright'
              }`}
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied!' : 'Copy to Clipboard'}</span>
            </button>
          </div>

          {/* Preview Panel */}
          <div className="flex-1 bg-oled-panel border border-oled-border rounded-lg overflow-hidden flex flex-col">
            <div className="px-3 py-2 bg-[#0d1117] border-b border-oled-border flex justify-between items-center text-[10px] font-mono text-slate-400">
              <span>Preview: frames.h</span>
              <span className="text-oled-cyan">PROGMEM: ~{Math.round((frameCount * 1024) / 1024)} KB</span>
            </div>
            <pre className="p-3 text-[10px] leading-relaxed text-cyan-300/80 font-mono overflow-auto h-[200px]">
              {previewLines}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-oled-border bg-[#0a0e14] rounded-b-xl flex justify-between items-center text-[11px] font-mono text-slate-500">
          <span>{frameCount} Frames Exported</span>
          <span>Constant size: 1024 bytes/frame</span>
        </div>
      </div>
    </div>
  );
};
