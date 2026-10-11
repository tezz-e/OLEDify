import React, { useMemo, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Settings, Cpu, Monitor, X } from 'lucide-react';
import { HardwareConfig, Microcontroller, DisplayController } from '../types/oled';
import { detectGpu } from '../engine/gpuDetector';
import { HW_SPRINGS } from '../theme/springPresets';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: HardwareConfig;
  onChange: (config: HardwareConfig) => void;
  themeMode?: 'light' | 'dark';
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  config, 
  onChange,
  themeMode = 'light' 
}) => {
  const isDark = themeMode === 'dark';
  const gpuInfo = useMemo(() => detectGpu(), []);
  const shouldReduceMotion = useReducedMotion();
  if (!isOpen) return null;

  const mcuOptions: { value: Microcontroller; label: string }[] = [
    { value: 'esp32-s3', label: 'ESP32-S3' },
    { value: 'esp32', label: 'ESP32' },
    { value: 'esp32-c3', label: 'ESP32-C3' },
    { value: 'arduino-uno', label: 'Arduino Uno' },
    { value: 'pi-pico', label: 'Raspberry Pi Pico' }
  ];

  const displayOptions: { value: DisplayController; label: string }[] = [
    { value: 'sh1106', label: 'SH1106' },
    { value: 'ssd1306', label: 'SSD1306' },
    { value: 'ssd1315', label: 'SSD1315' }
  ];

  const handleMcuChange = (mcu: Microcontroller) => {
    let sda = config.sdaPin;
    let scl = config.sclPin;

    if (mcu === 'esp32-s3' || mcu === 'esp32-c3') {
      sda = 8;
      scl = 9;
    } else if (mcu === 'esp32') {
      sda = 21;
      scl = 22;
    } else if (mcu === 'arduino-uno') {
      sda = 18; // A4
      scl = 19; // A5
    } else if (mcu === 'pi-pico') {
      sda = 4;
      scl = 5;
    }

    onChange({ ...config, mcu, sdaPin: sda, sclPin: scl });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
      onClick={handleBackdropClick}
    >
      <motion.div 
        initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
        animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
        exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
        transition={shouldReduceMotion ? { duration: 0.15 } : HW_SPRINGS.soft}
        className={`max-w-md w-full border rounded-[12px] overflow-hidden transition-colors ${
          isDark 
            ? 'bg-[var(--hw-bg-surface)] border-white/[0.10] shadow-[0_20px_50px_rgba(0,0,0,0.85)]' 
            : 'bg-white border-[#1A1A1A]/15 shadow-[0_12px_32px_rgba(0,0,0,0.12)]'
        }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b ${isDark ? 'border-white/[0.08]' : 'border-black/[0.08]'}`}>
          <div className="flex items-center space-x-2">
            <Settings className={`w-4 h-4 ${isDark ? 'text-[var(--hw-text-primary)]' : 'text-[#18181A]'}`} />
            <h3 className={`text-xs font-semibold font-sans tracking-normal ${isDark ? 'text-[var(--hw-text-primary)]' : 'text-[#18181A]'}`}>
              Hardware settings
            </h3>
          </div>
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

        {/* Content Grid */}
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className={`text-[11px] font-medium font-sans flex items-center gap-1.5 ${
              isDark ? 'text-[var(--hw-text-secondary)]' : 'text-[#57575E]'
            }`}>
              <Cpu className="w-3.5 h-3.5 text-[var(--hw-text-tertiary)]" /> Target board
            </label>
            <select
              value={config.mcu}
              onChange={(e) => handleMcuChange(e.target.value as Microcontroller)}
              className={`w-full px-2.5 py-1.5 text-xs font-sans outline-none rounded-[8px] cursor-pointer border transition-colors ${
                isDark 
                  ? 'bg-[var(--hw-bg-canvas)] border-white/[0.08] text-[var(--hw-text-primary)] focus:border-[#FF5500]' 
                  : 'bg-white border-black/[0.1] text-[#18181A] focus:border-[#FF5500]'
              }`}
            >
              {mcuOptions.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className={`text-[11px] font-medium font-sans flex items-center gap-1.5 ${
              isDark ? 'text-[var(--hw-text-secondary)]' : 'text-[#57575E]'
            }`}>
              <Monitor className="w-3.5 h-3.5 text-[var(--hw-text-tertiary)]" /> Display driver
            </label>
            <select
              value={config.display}
              onChange={(e) => onChange({ ...config, display: e.target.value as DisplayController })}
              className={`w-full px-2.5 py-1.5 text-xs font-sans outline-none rounded-[8px] cursor-pointer border transition-colors ${
                isDark 
                  ? 'bg-[var(--hw-bg-canvas)] border-white/[0.08] text-[var(--hw-text-primary)] focus:border-[#FF5500]' 
                  : 'bg-white border-black/[0.1] text-[#18181A] focus:border-[#FF5500]'
              }`}
            >
              {displayOptions.map(d => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className={`text-[11px] font-medium font-sans ${
              isDark ? 'text-[var(--hw-text-secondary)]' : 'text-[#57575E]'
            }`}>SDA pin (GPIO)</label>
            <input
              type="number"
              value={config.sdaPin}
              onChange={(e) => onChange({ ...config, sdaPin: parseInt(e.target.value, 10) || 0 })}
              className={`w-full px-2.5 py-1.5 text-xs font-mono outline-none rounded-[8px] border transition-colors ${
                isDark 
                  ? 'bg-[var(--hw-bg-canvas)] border-white/[0.08] text-[var(--hw-text-primary)] focus:border-[#FF5500]' 
                  : 'bg-white border-black/[0.1] text-[#18181A] focus:border-[#FF5500]'
              }`}
            />
          </div>

          <div className="space-y-1.5">
            <label className={`text-[11px] font-medium font-sans ${
              isDark ? 'text-[var(--hw-text-secondary)]' : 'text-[#57575E]'
            }`}>SCL pin (GPIO)</label>
            <input
              type="number"
              value={config.sclPin}
              onChange={(e) => onChange({ ...config, sclPin: parseInt(e.target.value, 10) || 0 })}
              className={`w-full px-2.5 py-1.5 text-xs font-mono outline-none rounded-[8px] border transition-colors ${
                isDark 
                  ? 'bg-[var(--hw-bg-canvas)] border-white/[0.08] text-[var(--hw-text-primary)] focus:border-[#FF5500]' 
                  : 'bg-white border-black/[0.1] text-[#18181A] focus:border-[#FF5500]'
              }`}
            />
          </div>
        </div>

        {/* GPU Hardware Telemetry Diagnostics */}
        <div className="px-4 pb-4">
          <div className={`p-3 border rounded-[8px] flex flex-col gap-1.5 ${
            isDark ? 'border-white/[0.08] bg-[var(--hw-bg-canvas)]' : 'border-black/[0.08] bg-[#F4F3EF]'
          }`}>
            <div className="flex items-center justify-between">
              <span className={`text-[11px] font-medium font-sans flex items-center gap-1.5 ${
                isDark ? 'text-[var(--hw-text-primary)]' : 'text-[#18181A]'
              }`}>
                <Cpu className="w-3.5 h-3.5 text-[var(--hw-text-secondary)]" /> Host accelerator
              </span>
              <span
                className={`text-[11px] font-sans px-2 py-0.5 rounded-[6px] border ${
                  gpuInfo.isDedicated
                    ? 'border-white/[0.12] bg-white/[0.06] text-[var(--hw-text-primary)] font-medium'
                    : 'border-white/[0.08] bg-transparent text-[var(--hw-text-secondary)]'
                }`}
              >
                {gpuInfo.isDedicated ? 'Dedicated GPU' : 'Integrated GPU'}
              </span>
            </div>
            <div className={`text-xs font-mono font-medium ${isDark ? 'text-[var(--hw-text-primary)]' : 'text-[#18181A]'}`}>
              {gpuInfo.simplifiedName}
            </div>
            <div className={`text-[11px] font-mono break-all leading-tight ${isDark ? 'text-[var(--hw-text-tertiary)]' : 'text-[#7E7E87]'}`}>
              {gpuInfo.renderer}
            </div>
            {!gpuInfo.isDedicated && (
              <div className={`mt-1 text-[11px] font-sans border-t pt-1.5 leading-snug ${
                isDark ? 'text-[var(--hw-signal-danger)] border-white/[0.06]' : 'text-[#DC2626] border-black/[0.06]'
              }`}>
                Rendering on integrated GPU. For full hardware throughput, assign browser to High Performance in Windows Graphics Settings.
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
