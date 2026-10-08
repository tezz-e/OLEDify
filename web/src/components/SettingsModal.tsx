import React, { useMemo } from 'react';
import { Settings, Cpu, Monitor, X } from 'lucide-react';
import { HardwareConfig, Microcontroller, DisplayController } from '../types/oled';
import { GlassSurface } from './reactbits/GlassSurface';
import { detectGpu } from '../engine/gpuDetector';

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
  if (!isOpen) return null;

  const mcuOptions: { value: Microcontroller; label: string }[] = [
    { value: 'esp32-s3', label: 'ESP32-S3' },
    { value: 'esp32', label: 'ESP32' },
    { value: 'esp32-c3', label: 'ESP32-C3' },
    { value: 'arduino-uno', label: 'ARDUINO UNO' },
    { value: 'pi-pico', label: 'PI PICO' }
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

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-fade-in"
      onClick={handleBackdropClick}
    >
      <GlassSurface 
        borderRadius={0} 
        className={`max-w-md w-full animate-slide-up border transition-all ${
          isDark 
            ? 'bg-[#08080A]/95 border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.15)] backdrop-blur-xl' 
            : 'bg-white border-[#1A1A1A] shadow-[8px_8px_0_0_#1A1A1A]'
        }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b ${isDark ? 'border-white/10' : 'border-[#1A1A1A]'}`}>
          <div className="flex items-center space-x-2">
            <Settings className={`w-4 h-4 ${isDark ? 'text-[#00FF66]' : 'text-[#1A1A1A]'}`} />
            <h3 className={`text-xs font-bold tracking-widest uppercase font-mono ${isDark ? 'text-[#00FF66]' : 'text-[#1A1A1A]'}`}>SETTINGS</h3>
          </div>
          <button 
            onClick={onClose} 
            className={`transition-colors p-1 border cursor-pointer ${
              isDark 
                ? 'text-[#A1A1AA] border-white/10 hover:bg-[#00FF66] hover:text-[#000000] hover:border-[#00FF66]' 
                : 'text-[#6B6B6B] border-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Grid */}
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className={`text-[10px] font-bold tracking-widest uppercase font-mono flex items-center gap-1 ${
              isDark ? 'text-[#A1A1AA]' : 'text-[#6B6B6B]'
            }`}>
              <Cpu className={`w-3 h-3 ${isDark ? 'text-[#00FF66]' : 'text-[#1A1A1A]'}`} /> TARGET_BOARD
            </label>
            <select
              value={config.mcu}
              onChange={(e) => handleMcuChange(e.target.value as Microcontroller)}
              className={`w-full px-2.5 py-1.5 text-xs font-mono outline-none rounded-none cursor-pointer border ${
                isDark 
                  ? 'bg-[#121216] border-white/10 text-[#F1EEF8] focus:border-[#00FF66]' 
                  : 'bg-white border-[#1A1A1A] text-[#1A1A1A] focus:border-[#E85D2A]'
              }`}
            >
              {mcuOptions.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className={`text-[10px] font-bold tracking-widest uppercase font-mono flex items-center gap-1 ${
              isDark ? 'text-[#A1A1AA]' : 'text-[#6B6B6B]'
            }`}>
              <Monitor className={`w-3 h-3 ${isDark ? 'text-[#00FF66]' : 'text-[#1A1A1A]'}`} /> DISPLAY_DRIVER
            </label>
            <select
              value={config.display}
              onChange={(e) => onChange({ ...config, display: e.target.value as DisplayController })}
              className={`w-full px-2.5 py-1.5 text-xs font-mono outline-none rounded-none cursor-pointer border ${
                isDark 
                  ? 'bg-[#121216] border-white/10 text-[#F1EEF8] focus:border-[#00FF66]' 
                  : 'bg-white border-[#1A1A1A] text-[#1A1A1A] focus:border-[#E85D2A]'
              }`}
            >
              {displayOptions.map(d => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className={`text-[10px] font-bold tracking-widest uppercase font-mono ${
              isDark ? 'text-[#A1A1AA]' : 'text-[#6B6B6B]'
            }`}>SDA_PIN_(GPIO)</label>
            <input
              type="number"
              value={config.sdaPin}
              onChange={(e) => onChange({ ...config, sdaPin: parseInt(e.target.value, 10) || 0 })}
              className={`w-full px-2.5 py-1 text-xs font-mono outline-none rounded-none border ${
                isDark 
                  ? 'bg-[#121216] border-white/10 text-[#F1EEF8] focus:border-[#00FF66]' 
                  : 'bg-white border-[#1A1A1A] text-[#1A1A1A] focus:border-[#E85D2A]'
              }`}
            />
          </div>

          <div className="space-y-1">
            <label className={`text-[10px] font-bold tracking-widest uppercase font-mono ${
              isDark ? 'text-[#A1A1AA]' : 'text-[#6B6B6B]'
            }`}>SCL_PIN_(GPIO)</label>
            <input
              type="number"
              value={config.sclPin}
              onChange={(e) => onChange({ ...config, sclPin: parseInt(e.target.value, 10) || 0 })}
              className={`w-full px-2.5 py-1 text-xs font-mono outline-none rounded-none border ${
                isDark 
                  ? 'bg-[#121216] border-white/10 text-[#F1EEF8] focus:border-[#00FF66]' 
                  : 'bg-white border-[#1A1A1A] text-[#1A1A1A] focus:border-[#E85D2A]'
              }`}
            />
          </div>
        </div>

        {/* GPU Hardware Telemetry Diagnostics */}
        <div className="px-4 pb-4">
          <div className={`p-3 border flex flex-col gap-1.5 ${
            isDark ? 'border-white/10 bg-[#0D0D10]' : 'border-[#1A1A1A] bg-[#F5F0EB]/80'
          }`}>
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-bold uppercase tracking-wider font-mono flex items-center gap-1.5 ${
                isDark ? 'text-[#00FF66]' : 'text-[#1A1A1A]'
              }`}>
                <Cpu className={`w-3.5 h-3.5 ${isDark ? 'text-[#00FF66]' : 'text-[#E85D2A]'}`} /> HOST ACCELERATOR (GPU)
              </span>
              <span
                className={`text-[8px] font-bold font-mono px-1.5 py-0.5 uppercase tracking-wider ${
                  gpuInfo.isDedicated
                    ? 'bg-emerald-600 text-white'
                    : 'bg-amber-500 text-white'
                }`}
              >
                {gpuInfo.isDedicated ? 'DEDICATED GPU ACTIVE' : 'INTEGRATED GPU'}
              </span>
            </div>
            <div className={`text-[11px] font-mono font-bold ${isDark ? 'text-[#F1EEF8]' : 'text-[#1A1A1A]'}`}>
              {gpuInfo.simplifiedName}
            </div>
            <div className={`text-[8px] font-mono break-all leading-tight ${isDark ? 'text-[#71717A]' : 'text-[#6B6B6B]'}`}>
              {gpuInfo.renderer}
            </div>
            {!gpuInfo.isDedicated && (
              <div className={`mt-1 text-[9px] font-mono border-t pt-1 leading-snug ${
                isDark ? 'text-[#FF3344] border-white/10' : 'text-[#E85D2A] border-[#1A1A1A]/10'
              }`}>
                ⚠️ Rendering on low-power iGPU. To unlock full NVDEC/hardware speed, assign Edge to "High performance" in Windows Graphics Settings.
              </div>
            )}
          </div>
        </div>
      </GlassSurface>
    </div>
  );
};
