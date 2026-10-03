import React, { useState } from 'react';
import { X, Copy, Download, Save, Check, Zap, AlertCircle, Loader } from 'lucide-react';
import { flashAnimationToDevice, FlashProgress } from '../engine/flasher';
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
  themeMode?: 'light' | 'dark';
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  cppCode,
  frameCount,
  targetFps,
  xbmpFrames,
  themeMode = 'light',
}) => {
  const isDark = themeMode === 'dark';
  const [activeTab, setActiveTab] = useState<'flash' | 'save' | 'download' | 'copy'>('flash');
  const [copied, setCopied] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [flashStatus, setFlashStatus] = useState<'idle' | 'flashing' | 'flashed' | 'error'>('idle');
  const [flashProgress, setFlashProgress] = useState<FlashProgress>({ percent: 0, message: '' });
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
      setFlashProgress({ percent: 0, message: 'Initializing flasher...' });
      await flashAnimationToDevice(xbmpFrames, targetFps, (p) => {
        setFlashProgress(p);
      });
      setFlashStatus('flashed');
      setTimeout(() => {
        setFlashStatus('idle');
        setFlashProgress({ percent: 0, message: '' });
      }, 4000);
    } catch (err: any) {
      if (err?.name === 'NotFoundError' || err?.message?.includes('No port selected')) {
        // User closed or cancelled the port selection dialog - silently return to idle
        setFlashStatus('idle');
        setFlashProgress({ percent: 0, message: '' });
        return;
      }
      console.error(err);
      setFlashStatus('error');
      setErrorMessage(err.message || 'Flashing failed. Ensure WebSerial is supported and device is connected.');
    }
  };

  const previewLines = cppCode ? cppCode.split('\n').slice(0, 15).join('\n') + '\n... (truncated)' : '// No code generated';
  const validFrameCount = typeof frameCount === 'number' && !isNaN(frameCount) ? Math.max(0, frameCount) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-fade-in">
      <div className={`max-w-2xl w-full flex flex-col animate-slide-up border-2 transition-all ${
        isDark 
          ? 'bg-[#161126] border-[#00F0FF] shadow-[8px_8px_0_0_#FF2A85]' 
          : 'bg-white border-[#1A1A1A] shadow-[8px_8px_0_0_#1A1A1A]'
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b-2 ${isDark ? 'border-[#2D2344]' : 'border-[#1A1A1A]'}`}>
          <h3 className={`text-xs font-bold tracking-widest uppercase font-mono ${isDark ? 'text-[#00F0FF]' : 'text-[#1A1A1A]'}`}>
            <DecryptedText text="EXPORT_CPP_ARRAY" speed={30} animateOn="view" />
          </h3>
          <button 
            onClick={onClose} 
            className={`transition-colors p-1 border cursor-pointer ${
              isDark 
                ? 'text-[#A59CB8] border-[#2D2344] hover:bg-[#00F0FF] hover:text-[#100D1C] hover:border-[#00F0FF]' 
                : 'text-[#6B6B6B] border-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex flex-col md:flex-row gap-4">
          {/* Actions Sidebar */}
          <div className="w-full md:w-48 space-y-2 shrink-0">
            <ClickSpark
              sparkColor={isDark ? "#00F0FF" : "#FFFFFF"}
              sparkCount={16}
              sparkSize={8}
              sparkRadius={26}
              duration={400}
              className="w-full"
            >
              <button
                onClick={() => { setActiveTab('flash'); handleFlash(); }}
                disabled={flashStatus === 'flashing'}
                className={`w-full flex items-center justify-between px-3 py-2 text-[10px] font-bold tracking-widest uppercase font-mono transition-colors border cursor-pointer ${
                  activeTab === 'flash' 
                    ? (isDark ? 'bg-[#00F0FF] border-[#00F0FF] text-[#100D1C]' : 'bg-[#E85D2A] border-[#1A1A1A] text-white')
                    : (isDark ? 'bg-[#1A142C] border-[#2D2344] text-[#F1EEF8] hover:bg-[#00F0FF] hover:text-[#100D1C]' : 'bg-white border-[#1A1A1A] text-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white')
                }`}
              >
                <div className="flex items-center gap-2">
                  {flashStatus === 'flashing' ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : flashStatus === 'flashed' ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Zap className="w-4 h-4" />
                  )}
                  <span>{flashStatus === 'flashing' ? `${flashProgress.percent}%` : 'FLASH_DEVICE'}</span>
                </div>
              </button>
            </ClickSpark>
            
            <div className={`my-2 border-t ${isDark ? 'border-[#2D2344]' : 'border-[#1A1A1A]'}`}></div>

            <ClickSpark
              sparkColor={isDark ? "#FF2A85" : "#E85D2A"}
              sparkCount={8}
              sparkSize={6}
              sparkRadius={18}
              duration={300}
              className="w-full"
            >
              <button
                onClick={() => { setActiveTab('save'); handleSaveToProject(); }}
                className={`w-full flex items-center justify-between px-3 py-2 text-[10px] font-bold tracking-widest uppercase font-mono transition-colors border cursor-pointer ${
                  activeTab === 'save' 
                    ? (isDark ? 'bg-[#FF2A85] border-[#FF2A85] text-white' : 'bg-[#1A1A1A] border-[#1A1A1A] text-white')
                    : (isDark ? 'bg-[#1A142C] border-[#2D2344] text-[#F1EEF8] hover:bg-[#FF2A85] hover:text-white' : 'bg-[#1A1A1A] text-white hover:bg-white hover:text-[#1A1A1A]')
                }`}
              >
                <div className="flex items-center gap-2">
                  {saveStatus === 'saved' ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                  <span>SAVE_TO_PROJECT</span>
                </div>
              </button>
            </ClickSpark>
            
            <ClickSpark
              sparkColor={isDark ? "#00F0FF" : "#E85D2A"}
              sparkCount={8}
              sparkSize={6}
              sparkRadius={18}
              duration={300}
              className="w-full"
            >
              <button
                onClick={() => { setActiveTab('download'); handleDownload(); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-[10px] font-bold tracking-widest uppercase font-mono transition-colors border cursor-pointer ${
                  activeTab === 'download' 
                    ? (isDark ? 'bg-[#00F0FF] border-[#00F0FF] text-[#100D1C]' : 'bg-[#1A1A1A] border-[#1A1A1A] text-white')
                    : (isDark ? 'bg-[#1A142C] border-[#2D2344] text-[#F1EEF8] hover:bg-[#00F0FF] hover:text-[#100D1C]' : 'bg-white border-[#1A1A1A] text-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white')
                }`}
              >
                <Download className="w-4 h-4" />
                <span>DOWNLOAD_FILE</span>
              </button>
            </ClickSpark>
            
            <ClickSpark
              sparkColor={isDark ? "#00F0FF" : "#E85D2A"}
              sparkCount={8}
              sparkSize={6}
              sparkRadius={18}
              duration={300}
              className="w-full"
            >
              <button
                onClick={() => { setActiveTab('copy'); handleCopy(); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-[10px] font-bold tracking-widest uppercase font-mono transition-colors border cursor-pointer ${
                  activeTab === 'copy' 
                    ? (isDark ? 'bg-[#00F0FF] border-[#00F0FF] text-[#100D1C]' : 'bg-[#1A1A1A] border-[#1A1A1A] text-white')
                    : (isDark ? 'bg-[#1A142C] border-[#2D2344] text-[#F1EEF8] hover:bg-[#00F0FF] hover:text-[#100D1C]' : 'bg-white border-[#1A1A1A] text-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white')
                }`}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'COPIED' : 'COPY_CLIPBOARD'}</span>
              </button>
            </ClickSpark>
          </div>

          {/* Preview Panel */}
          <div className={`flex-1 border-2 overflow-hidden flex flex-col ${isDark ? 'border-[#2D2344]' : 'border-[#1A1A1A]'}`}>
            <div className={`px-3 py-2 border-b flex justify-between items-center text-[10px] font-mono ${
              isDark ? 'bg-[#140F24] border-[#2D2344] text-[#A59CB8]' : 'bg-[#F5F0EB] border-[#1A1A1A] text-[#6B6B6B]'
            }`}>
              <span>PREVIEW: frames.h</span>
              <span className={`font-bold flex items-center gap-1 ${isDark ? 'text-[#00F0FF]' : 'text-[#E85D2A]'}`}>
                <span>PROGMEM: ~</span>
                <CountUp to={Math.round((validFrameCount * 1024) / 1024)} duration={0.8} />
                <span>KB</span>
              </span>
            </div>
            <pre className={`p-3 text-[10px] leading-relaxed font-mono overflow-auto h-[200px] ${
              isDark ? 'bg-[#0E0B1A] text-[#00F0FF]' : 'bg-white text-[#1A1A1A]'
            }`}>
              {previewLines}
            </pre>
          </div>
        </div>

        {/* Flash Status & Progress Banner */}
        {flashStatus === 'flashing' && (
          <div className={`mx-4 mb-4 p-3 border font-mono text-[10px] space-y-2 ${
            isDark ? 'bg-[#140F24] border-[#00F0FF] text-[#00F0FF]' : 'bg-[#FFF5F0] border-[#E85D2A] text-[#E85D2A]'
          }`}>
            <div className="flex justify-between items-center font-bold">
              <span className="flex items-center gap-2">
                <Loader className="w-3.5 h-3.5 animate-spin" />
                <span>FLASHING TO ESP32 (PARTITION 0x200000 @ 460800 BAUD)</span>
              </span>
              <span>{flashProgress.percent}%</span>
            </div>
            <div className={`w-full h-2 overflow-hidden ${isDark ? 'bg-[#2D2344]' : 'bg-[#E5D7C9]'}`}>
              <div
                className={`h-full transition-all duration-200 ${isDark ? 'bg-[#00F0FF]' : 'bg-[#E85D2A]'}`}
                style={{ width: `${flashProgress.percent}%` }}
              />
            </div>
            <div className={`text-[9px] truncate ${isDark ? 'text-[#A59CB8]' : 'text-[#6B6B6B]'}`}>
              {flashProgress.message || 'Writing flash memory...'}
            </div>
          </div>
        )}

        {flashStatus === 'flashed' && (
          <div className="mx-4 mb-4 p-3 border font-mono text-[10px] bg-emerald-950/40 border-emerald-500 text-emerald-400 flex items-start gap-2">
            <Check className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
            <div>
              <div className="font-bold">FLASH COMPLETE! REBOOTING ESP32</div>
              <div className="text-[9px] text-emerald-300 mt-0.5">
                Animation loaded to partition 0x200000. ESP32 rebooted and is now playing standalone at {targetFps} FPS.
              </div>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="mx-4 mb-4 p-3 border font-mono text-[10px] bg-red-950/40 border-red-500 text-red-400 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-red-400">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>FLASH ERROR</span>
            </div>
            <div className="text-[9px] text-red-300 break-words">{errorMessage}</div>
            <div className="text-[9px] text-amber-300/80 pt-1 border-t border-red-900/50">
              💡 Troubleshooting: Close serial monitors (PlatformIO/Arduino IDE). For ESP32-S3 USB, hold BOOT button, press RST once, release BOOT, then retry flashing.
            </div>
          </div>
        )}

        {/* Footer */}
        <div className={`px-4 py-3 border-t-2 flex justify-between items-center text-[10px] font-mono ${
          isDark ? 'border-[#2D2344] bg-[#140F24] text-[#A59CB8]' : 'border-[#1A1A1A] bg-[#F5F0EB] text-[#6B6B6B]'
        }`}>
          <span className="flex items-center gap-1">
            <CountUp to={validFrameCount} duration={0.8} />
            <span>FRAMES_EXPORTED</span>
          </span>
          <span>FRAME_SIZE: 1024 BYTES</span>
        </div>
      </div>
    </div>
  );
};
