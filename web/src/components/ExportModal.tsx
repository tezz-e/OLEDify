import React, { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { X, Copy, Download, Save, Check, Zap, AlertCircle, Loader } from 'lucide-react';
import { flashAnimationToDevice, FlashProgress } from '../engine/flasher';
import { CountUp } from './reactbits/CountUp';
import { HW_SPRINGS } from '../theme/springPresets';

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
  const shouldReduceMotion = useReducedMotion();
  const [activeTab, setActiveTab] = useState<'flash' | 'save' | 'download' | 'copy'>('flash');
  const [copied, setCopied] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [flashStatus, setFlashStatus] = useState<'idle' | 'flashing' | 'flashed' | 'error'>('idle');
  const [flashProgress, setFlashProgress] = useState<FlashProgress>({ percent: 0, message: '' });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error(err);
        setSaveStatus('error');
      } else {
        setSaveStatus('idle');
      }
    }
  };

  const handleFlash = async () => {
    if (xbmpFrames.length === 0) {
      setErrorMessage('No frame data available to flash.');
      return;
    }

    try {
      setFlashStatus('flashing');
      setErrorMessage(null);
      setFlashProgress({ percent: 0, message: 'Opening serial port...' });

      await flashAnimationToDevice(xbmpFrames, targetFps, (p) => {
        setFlashProgress(p);
      });

      setFlashStatus('flashed');
    } catch (err: any) {
      if (err.name === 'NotFoundError' || err.message?.includes('No port selected')) {
        setFlashStatus('idle');
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
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div 
        initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
        animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
        exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
        transition={shouldReduceMotion ? { duration: 0.15 } : HW_SPRINGS.soft}
        className={`max-w-2xl w-full flex flex-col border rounded-[12px] overflow-hidden transition-colors ${
          isDark 
            ? 'bg-[var(--hw-bg-surface)] border-white/[0.10] shadow-[0_24px_60px_rgba(0,0,0,0.85)]' 
            : 'bg-white border-[#1A1A1A]/15 shadow-[0_12px_32px_rgba(0,0,0,0.12)]'
        }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b ${isDark ? 'border-white/[0.08]' : 'border-black/[0.08]'}`}>
          <h3 className={`text-xs font-semibold font-sans tracking-normal ${isDark ? 'text-[var(--hw-text-primary)]' : 'text-[#18181A]'}`}>
            Compile & export
          </h3>
          <motion.button 
            whileTap={{ scale: 0.92 }}
            transition={HW_SPRINGS.snappy}
            onClick={onClose} 
            className={`p-1.5 border rounded-[8px] cursor-pointer transition-colors ${
              isDark 
                ? 'text-[var(--hw-text-secondary)] border-white/[0.08] hover:text-[var(--hw-text-primary)] hover:bg-white/[0.05]' 
                : 'text-[#57575E] border-black/[0.08] hover:bg-black/[0.05] hover:text-[#18181A]'
            }`}
          >
            <X className="w-4 h-4" />
          </motion.button>
        </div>

        {/* Content */}
        <div className="p-4 flex flex-col md:flex-row gap-4">
          {/* Actions Sidebar */}
          <div className="w-full md:w-48 space-y-2 shrink-0">
            <motion.button
              whileTap={{ scale: 0.97 }}
              transition={HW_SPRINGS.snappy}
              onClick={() => { setActiveTab('flash'); handleFlash(); }}
              disabled={flashStatus === 'flashing'}
              className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium font-sans transition-colors border rounded-[8px] cursor-pointer ${
                activeTab === 'flash' 
                  ? 'bg-[#FF5500] border-[#FF5500] text-black font-semibold'
                  : (isDark ? 'bg-[var(--hw-bg-canvas)] border-white/[0.08] text-[var(--hw-text-primary)] hover:border-white/20' : 'bg-white border-black/[0.1] text-[#18181A] hover:border-black/20')
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
                <span>{flashStatus === 'flashing' ? `${flashProgress.percent}%` : 'Flash device'}</span>
              </div>
            </motion.button>
            
            <div className={`my-2 border-t ${isDark ? 'border-white/[0.08]' : 'border-black/[0.08]'}`}></div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              transition={HW_SPRINGS.snappy}
              onClick={() => { setActiveTab('save'); handleSaveToProject(); }}
              className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium font-sans transition-colors border rounded-[8px] cursor-pointer ${
                activeTab === 'save' 
                  ? 'bg-[#FF5500] border-[#FF5500] text-black font-semibold'
                  : (isDark ? 'bg-[var(--hw-bg-canvas)] border-white/[0.08] text-[var(--hw-text-primary)] hover:border-white/20' : 'bg-white border-black/[0.1] text-[#18181A] hover:border-black/20')
              }`}
            >
              <div className="flex items-center gap-2">
                {saveStatus === 'saved' ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                <span>Save to file</span>
              </div>
            </motion.button>
            
            <motion.button
              whileTap={{ scale: 0.97 }}
              transition={HW_SPRINGS.snappy}
              onClick={() => { setActiveTab('download'); handleDownload(); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium font-sans transition-colors border rounded-[8px] cursor-pointer ${
                activeTab === 'download' 
                  ? 'bg-[#FF5500] border-[#FF5500] text-black font-semibold'
                  : (isDark ? 'bg-[var(--hw-bg-canvas)] border-white/[0.08] text-[var(--hw-text-primary)] hover:border-white/20' : 'bg-white border-black/[0.1] text-[#18181A] hover:border-black/20')
              }`}
            >
              <Download className="w-4 h-4" />
              <span>Download .h</span>
            </motion.button>
            
            <motion.button
              whileTap={{ scale: 0.97 }}
              transition={HW_SPRINGS.snappy}
              onClick={() => { setActiveTab('copy'); handleCopy(); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium font-sans transition-colors border rounded-[8px] cursor-pointer ${
                activeTab === 'copy' 
                  ? 'bg-[#FF5500] border-[#FF5500] text-black font-semibold'
                  : (isDark ? 'bg-[var(--hw-bg-canvas)] border-white/[0.08] text-[var(--hw-text-primary)] hover:border-white/20' : 'bg-white border-black/[0.1] text-[#18181A] hover:border-black/20')
              }`}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied' : 'Copy array'}</span>
            </motion.button>
          </div>

          {/* Preview Panel */}
          <div className={`flex-1 border rounded-[8px] overflow-hidden flex flex-col ${isDark ? 'border-white/[0.08]' : 'border-black/[0.08]'}`}>
            <div className={`px-3 py-2 border-b flex justify-between items-center text-[11px] font-sans ${
              isDark ? 'bg-[var(--hw-bg-canvas)] border-white/[0.08] text-[var(--hw-text-secondary)]' : 'bg-[#F4F3EF] border-black/[0.08] text-[#57575E]'
            }`}>
              <span className="font-medium">Preview: frames.h</span>
              <span className="flex items-center gap-1 font-mono text-[11px]">
                <span>PROGMEM ~</span>
                <CountUp to={Math.round((validFrameCount * 1024) / 1024)} duration={0.8} />
                <span>kB</span>
              </span>
            </div>
            <pre className={`p-3 text-[11px] leading-relaxed font-mono overflow-auto h-[200px] ${
              isDark ? 'bg-[#0f0f11] text-[var(--hw-text-secondary)]' : 'bg-white text-[#18181A]'
            }`}>
              {previewLines}
            </pre>
          </div>
        </div>

        {/* Flash Status & Progress Banner */}
        {flashStatus === 'flashing' && (
          <div className={`mx-4 mb-4 p-3 border rounded-[8px] font-sans text-xs space-y-2 ${
            isDark ? 'bg-[var(--hw-bg-canvas)] border-white/[0.12] text-[var(--hw-text-primary)]' : 'bg-[#F4F3EF] border-black/[0.1] text-[#18181A]'
          }`}>
            <div className="flex justify-between items-center font-medium">
              <span className="flex items-center gap-2">
                <Loader className="w-3.5 h-3.5 animate-spin text-[#FF5500]" />
                <span>Flashing ESP32 (partition 0x200000 @ 460.8k baud)</span>
              </span>
              <span className="font-mono">{flashProgress.percent}%</span>
            </div>
            <div className={`w-full h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/[0.08]' : 'bg-black/[0.08]'}`}>
              <div
                className="h-full bg-[#FF5500] transition-all duration-200"
                style={{ width: `${flashProgress.percent}%` }}
              />
            </div>
            <div className={`text-[11px] font-mono truncate ${isDark ? 'text-[var(--hw-text-tertiary)]' : 'text-[#7E7E87]'}`}>
              {flashProgress.message || 'Writing flash memory...'}
            </div>
          </div>
        )}

        {flashStatus === 'flashed' && (
          <div className={`mx-4 mb-4 p-3 border rounded-[8px] font-sans text-xs flex items-start gap-2.5 ${
            isDark ? 'bg-[var(--hw-bg-canvas)] border-white/[0.12] text-[var(--hw-text-primary)]' : 'bg-[#F4F3EF] border-black/[0.1] text-[#18181A]'
          }`}>
            <Check className="w-4 h-4 shrink-0 text-[#FF5500] mt-0.5" />
            <div>
              <div className="font-medium">Flash complete. Device rebooted.</div>
              <div className="text-[11px] text-[var(--hw-text-secondary)] mt-0.5">
                Animation loaded to partition 0x200000. ESP32 rebooted and playing standalone at {targetFps} FPS.
              </div>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className={`mx-4 mb-4 p-3 border rounded-[8px] font-sans text-xs space-y-1.5 ${
            isDark ? 'bg-[var(--hw-bg-canvas)] border-[var(--hw-signal-danger)] text-[var(--hw-signal-danger)]' : 'bg-white border-[#DC2626] text-[#DC2626]'
          }`}>
            <div className="flex items-center gap-1.5 font-medium">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Flash error</span>
            </div>
            <div className="text-[11px] text-[var(--hw-text-secondary)] break-words">{errorMessage}</div>
            <div className={`text-[11px] text-[var(--hw-text-tertiary)] pt-1 border-t ${isDark ? 'border-white/[0.08]' : 'border-black/[0.08]'}`}>
              Troubleshooting: Close serial monitors (PlatformIO/Arduino IDE). For ESP32-S3 USB, hold BOOT button, press RST once, release BOOT, then retry flashing.
            </div>
          </div>
        )}

        {/* Footer */}
        <div className={`px-4 py-3 border-t flex justify-between items-center text-[11px] font-sans ${
          isDark ? 'border-white/[0.08] bg-[var(--hw-bg-canvas)] text-[var(--hw-text-secondary)]' : 'border-black/[0.08] bg-[#F4F3EF] text-[#57575E]'
        }`}>
          <span className="flex items-center gap-1">
            <span className="font-mono"><CountUp to={validFrameCount} duration={0.8} /></span>
            <span>frames exported</span>
          </span>
          <span className="font-mono">1,024 bytes / frame</span>
        </div>
      </motion.div>
    </motion.div>
  );
};
