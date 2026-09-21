import React, { useState } from 'react';
import { X, Copy, Download, Save, Check, Zap } from 'lucide-react';
import { flashAnimationToDevice } from '../engine/flasher';
import { GlassSurface } from './reactbits/GlassSurface';
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

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const previewLines = cppCode.split('\n').slice(0, 15).join('\n') + '\n... (truncated)';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-fade-in">
      <GlassSurface borderRadius={0} className="max-w-2xl w-full flex flex-col animate-slide-up bg-white">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b-2 border-[#1A1A1A]">
          <h3 className="text-xs font-bold tracking-widest text-[#1A1A1A] uppercase font-mono">
            <DecryptedText text="EXPORT_CPP_ARRAY" speed={30} animateOn="view" />
          </h3>
          <button onClick={onClose} className="text-[#6B6B6B] hover:text-[#1A1A1A] transition-colors p-1 border border-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex flex-col md:flex-row gap-4">
          {/* Actions Sidebar */}
          <div className="w-full md:w-48 space-y-2 shrink-0">
            <ClickSpark
              sparkColor="#FFFFFF"
              sparkCount={16}
              sparkSize={8}
              sparkRadius={26}
              duration={400}
              className="w-full"
            >
              <button
                onClick={() => { setActiveTab('flash'); handleFlash(); }}
                disabled={flashStatus === 'flashing'}
                className={`w-full flex items-center justify-between px-3 py-2 text-[10px] font-bold tracking-widest uppercase font-mono transition-colors border ${
                  activeTab === 'flash' 
                    ? 'bg-[#E85D2A] border-[#1A1A1A] text-white' 
                    : 'bg-white border-[#1A1A1A] text-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  {flashStatus === 'flashed' ? <Check className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                  <span>{flashStatus === 'flashing' ? 'FLASHING...' : 'FLASH_DEVICE'}</span>
                </div>
              </button>
            </ClickSpark>
            
            <div className="my-2 border-t border-[#1A1A1A]"></div>

            <ClickSpark
              sparkColor="#E85D2A"
              sparkCount={8}
              sparkSize={6}
              sparkRadius={18}
              duration={300}
              className="w-full"
            >
              <button
                onClick={() => { setActiveTab('save'); handleSaveToProject(); }}
                className={`w-full flex items-center justify-between px-3 py-2 text-[10px] font-bold tracking-widest uppercase font-mono transition-colors border ${
                  activeTab === 'save' 
                    ? 'bg-[#1A1A1A] border-[#1A1A1A] text-white' 
                    : 'bg-white border-[#1A1A1A] text-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  {saveStatus === 'saved' ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                  <span>SAVE_TO_PROJECT</span>
                </div>
              </button>
            </ClickSpark>
            
            <ClickSpark
              sparkColor="#E85D2A"
              sparkCount={8}
              sparkSize={6}
              sparkRadius={18}
              duration={300}
              className="w-full"
            >
              <button
                onClick={() => { setActiveTab('download'); handleDownload(); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-[10px] font-bold tracking-widest uppercase font-mono transition-colors border ${
                  activeTab === 'download' 
                    ? 'bg-[#1A1A1A] border-[#1A1A1A] text-white' 
                    : 'bg-white border-[#1A1A1A] text-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white'
                }`}
              >
                <Download className="w-4 h-4" />
                <span>DOWNLOAD_FILE</span>
              </button>
            </ClickSpark>
            
            <ClickSpark
              sparkColor="#E85D2A"
              sparkCount={8}
              sparkSize={6}
              sparkRadius={18}
              duration={300}
              className="w-full"
            >
              <button
                onClick={() => { setActiveTab('copy'); handleCopy(); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-[10px] font-bold tracking-widest uppercase font-mono transition-colors border ${
                  activeTab === 'copy' 
                    ? 'bg-[#1A1A1A] border-[#1A1A1A] text-white' 
                    : 'bg-white border-[#1A1A1A] text-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white'
                }`}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'COPIED' : 'COPY_CLIPBOARD'}</span>
              </button>
            </ClickSpark>
          </div>

          {/* Preview Panel */}
          <div className="flex-1 border-2 border-[#1A1A1A] overflow-hidden flex flex-col">
            <div className="px-3 py-2 bg-[#F5F0EB] border-b border-[#1A1A1A] flex justify-between items-center text-[10px] font-mono text-[#6B6B6B]">
              <span>PREVIEW: frames.h</span>
              <span className="text-[#E85D2A] font-bold flex items-center gap-1">
                <span>PROGMEM: ~</span>
                <CountUp to={Math.round((frameCount * 1024) / 1024)} duration={0.8} />
                <span>KB</span>
              </span>
            </div>
            <pre className="p-3 text-[10px] leading-relaxed text-[#1A1A1A] font-mono overflow-auto h-[200px] bg-white">
              {previewLines}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t-2 border-[#1A1A1A] bg-[#F5F0EB] flex justify-between items-center text-[10px] font-mono text-[#6B6B6B]">
          <span className="flex items-center gap-1">
            <CountUp to={frameCount} duration={0.8} />
            <span>FRAMES_EXPORTED</span>
          </span>
          <span>FRAME_SIZE: 1024 BYTES</span>
        </div>
      </GlassSurface>
    </div>
  );
};
