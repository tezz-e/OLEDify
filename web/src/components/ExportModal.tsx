import React, { useState } from 'react';
import { X, Copy, Download, Save, Check, Zap } from 'lucide-react';
import { flashAnimationToDevice } from '../engine/flasher';
import { CountUp } from './reactbits/CountUp';
import { ClickSpark } from './reactbits/ClickSpark';
import { DecryptedText } from './reactbits/DecryptedText';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  cppCode: string;
  frameCount: number;
  targetFps: number;
  xbmpFrames: Uint8Array[];
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  cppCode,
  frameCount,
  targetFps,
  xbmpFrames,
}) => {
  const [activeTab, setActiveTab] = useState<'flash' | 'save' | 'download' | 'copy'>('flash');
  const [copied, setCopied] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [flashStatus, setFlashStatus] = useState<'idle' | 'flashing' | 'flashed' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
      setErrorMessage(null);
      setFlashStatus('flashing');
      await flashAnimationToDevice(xbmpFrames, targetFps);
      setFlashStatus('flashed');
      setTimeout(() => setFlashStatus('idle'), 3000);
    } catch (err: any) {
      console.error(err);
      setFlashStatus('error');
      setErrorMessage(err.message || 'Flashing failed. Ensure WebSerial is supported and device is connected.');
    }
  };

  const previewLines = cppCode ? cppCode.split('\n').slice(0, 15).join('\n') + '\n... (truncated)' : '// No code generated';
  const validFrameCount = typeof frameCount === 'number' && !isNaN(frameCount) ? Math.max(0, frameCount) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#141413]/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="max-w-2xl w-full flex flex-col animate-slide-up bg-white border border-[#E8E5DE] rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E5DE] bg-[#FAF9F5]/60">
          <div className="flex items-center space-x-2.5">
            <span className="w-2 h-2 rounded-full bg-[#D97757]" />
            <h3 className="font-serif text-lg font-normal text-[#141413]">
              Export C++ Header
            </h3>
          </div>
          <button 
            onClick={onClose} 
            className="text-[#5E5D59] hover:text-[#141413] hover:bg-[#FAF0EB] transition-colors p-1.5 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col md:flex-row gap-5">
          {/* Actions Sidebar */}
          <div className="w-full md:w-52 space-y-2.5 shrink-0">
            <button
              onClick={() => { setActiveTab('flash'); handleFlash(); }}
              disabled={flashStatus === 'flashing'}
              className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-sans font-medium rounded-lg transition-colors cursor-pointer bg-[#D97757] hover:bg-[#C66545] text-white shadow-xs"
            >
              <div className="flex items-center gap-2">
                {flashStatus === 'flashed' ? <Check className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                <span>{flashStatus === 'flashing' ? 'Flashing...' : 'Flash to Hardware'}</span>
              </div>
            </button>
            
            <div className="my-1 border-t border-[#E8E5DE]"></div>

            <button
              onClick={() => { setActiveTab('save'); handleSaveToProject(); }}
              className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-sans font-medium rounded-lg transition-colors cursor-pointer bg-[#141413] hover:bg-[#2A2926] text-[#FAF9F5] shadow-xs"
            >
              {saveStatus === 'saved' ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              <span>Save to Project...</span>
            </button>
            
            <button
              onClick={() => { setActiveTab('download'); handleDownload(); }}
              className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-sans font-medium rounded-lg transition-colors cursor-pointer bg-white border border-[#E8E5DE] text-[#141413] hover:bg-[#FAF9F5] shadow-xs"
            >
              <Download className="w-4 h-4 text-[#5E5D59]" />
              <span>Download .h File</span>
            </button>
            
            <button
              onClick={() => { setActiveTab('copy'); handleCopy(); }}
              className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-sans font-medium rounded-lg transition-colors cursor-pointer bg-white border border-[#E8E5DE] text-[#141413] hover:bg-[#FAF9F5] shadow-xs"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-[#5E5D59]" />}
              <span>{copied ? 'Copied to Clipboard' : 'Copy C++ Code'}</span>
            </button>

            {errorMessage && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-[11px] rounded-lg leading-snug">
                {errorMessage}
              </div>
            )}
          </div>

          {/* Preview Panel */}
          <div className="flex-1 border border-[#E8E5DE] rounded-xl overflow-hidden flex flex-col bg-[#FAF9F5]">
            <div className="px-4 py-2.5 bg-white border-b border-[#E8E5DE] flex justify-between items-center text-xs font-sans text-[#5E5D59]">
              <span className="font-mono text-[11px]">frames.h</span>
              <span className="text-[#D97757] font-mono text-[11px] font-medium">
                ~{Math.round((validFrameCount * 1024) / 1024)} KB PROGMEM
              </span>
            </div>
            <pre className="p-3.5 text-[11px] leading-relaxed text-[#141413] font-mono overflow-auto h-[210px] bg-[#FAF9F5]">
              {previewLines}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#E8E5DE] bg-[#FAF9F5]/70 flex justify-between items-center text-xs font-sans text-[#5E5D59]">
          <span>{validFrameCount} frames generated</span>
          <span className="font-mono text-[11px]">1,024 bytes / frame (128×64 1-bit)</span>
        </div>
      </div>
    </div>
  );
};
