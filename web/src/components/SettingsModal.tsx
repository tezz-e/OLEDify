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
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, config, onChange }) => {
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#141413]/60 backdrop-blur-sm p-4 animate-fade-in"
      onClick={handleBackdropClick}
    >
      <div className="max-w-md w-full animate-slide-up bg-white border border-[#E8E5DE] rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E5DE] bg-[#FAF9F5]/60">
          <div className="flex items-center space-x-2.5">
            <span className="w-2 h-2 rounded-full bg-[#D97757]" />
            <h3 className="font-serif text-lg font-normal text-[#141413]">Hardware & Environment</h3>
          </div>
          <button 
            onClick={onClose} 
            className="text-[#5E5D59] hover:text-[#141413] hover:bg-[#FAF0EB] transition-colors p-1.5 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Grid */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-sans font-medium text-[#141413] flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-[#5E5D59]" /> Microcontroller Board
            </label>
            <select
              value={config.mcu}
              onChange={(e) => handleMcuChange(e.target.value as Microcontroller)}
              className="w-full bg-white border border-[#E8E5DE] rounded-lg px-3 py-2 text-xs text-[#141413] font-sans focus:border-[#D97757] focus:ring-1 focus:ring-[#D97757] outline-none shadow-xs cursor-pointer"
            >
              {mcuOptions.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-sans font-medium text-[#141413] flex items-center gap-1.5">
              <Monitor className="w-3.5 h-3.5 text-[#5E5D59]" /> Display Driver IC
            </label>
            <select
              value={config.display}
              onChange={(e) => onChange({ ...config, display: e.target.value as DisplayController })}
              className="w-full bg-white border border-[#E8E5DE] rounded-lg px-3 py-2 text-xs text-[#141413] font-sans focus:border-[#D97757] focus:ring-1 focus:ring-[#D97757] outline-none shadow-xs cursor-pointer"
            >
              {displayOptions.map(d => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-sans font-medium text-[#141413]">SDA Pin (GPIO)</label>
            <input
              type="number"
              value={config.sdaPin}
              onChange={(e) => onChange({ ...config, sdaPin: parseInt(e.target.value, 10) || 0 })}
              className="w-full bg-white border border-[#E8E5DE] rounded-lg px-3 py-2 text-xs text-[#141413] font-mono focus:border-[#D97757] focus:ring-1 focus:ring-[#D97757] outline-none shadow-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-sans font-medium text-[#141413]">SCL Pin (GPIO)</label>
            <input
              type="number"
              value={config.sclPin}
              onChange={(e) => onChange({ ...config, sclPin: parseInt(e.target.value, 10) || 0 })}
              className="w-full bg-white border border-[#E8E5DE] rounded-lg px-3 py-2 text-xs text-[#141413] font-mono focus:border-[#D97757] focus:ring-1 focus:ring-[#D97757] outline-none shadow-xs"
            />
          </div>
        </div>

        {/* GPU Hardware Telemetry Diagnostics */}
        <div className="px-6 pb-6">
          <div className="p-4 border border-[#E8E5DE] bg-[#FAF9F5] rounded-xl flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-sans font-medium text-[#141413] flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-[#D97757]" /> Host Video Accelerator
              </span>
              <span
                className={`text-[10px] font-sans font-medium px-2 py-0.5 rounded-full ${
                  gpuInfo.isDedicated
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}
              >
                {gpuInfo.isDedicated ? 'Dedicated GPU Active' : 'Integrated GPU'}
              </span>
            </div>
            <div className="text-xs font-mono text-[#141413] font-semibold">
              {gpuInfo.simplifiedName}
            </div>
            <div className="text-[10px] font-mono text-[#87867F] break-all leading-relaxed">
              {gpuInfo.renderer}
            </div>
            {!gpuInfo.isDedicated && (
              <div className="mt-1 text-[11px] text-[#D97757] font-sans border-t border-[#E8E5DE] pt-2 leading-relaxed">
                Rendering on low-power integrated graphics. For full hardware video decode speed, set your browser to "High performance" in Windows Graphics Settings.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
