import React from 'react';
import { Settings, Cpu, Monitor, X } from 'lucide-react';
import { HardwareConfig, Microcontroller, DisplayController } from '../types/oled';
import { GlassSurface } from './reactbits/GlassSurface';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: HardwareConfig;
  onChange: (config: HardwareConfig) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, config, onChange }) => {
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
      <GlassSurface borderRadius={0} className="max-w-md w-full animate-slide-up bg-white">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b-2 border-[#1A1A1A]">
          <div className="flex items-center space-x-2">
            <Settings className="w-4 h-4 text-[#1A1A1A]" />
            <h3 className="text-xs font-bold tracking-widest text-[#1A1A1A] uppercase font-mono">SETTINGS</h3>
          </div>
          <button onClick={onClose} className="text-[#6B6B6B] hover:text-[#1A1A1A] transition-colors p-1 border border-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Grid */}
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold tracking-widest text-[#6B6B6B] uppercase font-mono flex items-center gap-1">
              <Cpu className="w-3 h-3 text-[#1A1A1A]" /> TARGET_BOARD
            </label>
            <select
              value={config.mcu}
              onChange={(e) => handleMcuChange(e.target.value as Microcontroller)}
              className="w-full bg-white border border-[#1A1A1A] px-2.5 py-1.5 text-xs text-[#1A1A1A] font-mono focus:border-[#E85D2A] outline-none rounded-none cursor-pointer"
            >
              {mcuOptions.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold tracking-widest text-[#6B6B6B] uppercase font-mono flex items-center gap-1">
              <Monitor className="w-3 h-3 text-[#1A1A1A]" /> DISPLAY_DRIVER
            </label>
            <select
              value={config.display}
              onChange={(e) => onChange({ ...config, display: e.target.value as DisplayController })}
              className="w-full bg-white border border-[#1A1A1A] px-2.5 py-1.5 text-xs text-[#1A1A1A] font-mono focus:border-[#E85D2A] outline-none rounded-none cursor-pointer"
            >
              {displayOptions.map(d => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold tracking-widest text-[#6B6B6B] uppercase font-mono">SDA_PIN_(GPIO)</label>
            <input
              type="number"
              value={config.sdaPin}
              onChange={(e) => onChange({ ...config, sdaPin: parseInt(e.target.value, 10) || 0 })}
              className="w-full bg-white border border-[#1A1A1A] px-2.5 py-1 text-xs text-[#1A1A1A] font-mono focus:border-[#E85D2A] outline-none rounded-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold tracking-widest text-[#6B6B6B] uppercase font-mono">SCL_PIN_(GPIO)</label>
            <input
              type="number"
              value={config.sclPin}
              onChange={(e) => onChange({ ...config, sclPin: parseInt(e.target.value, 10) || 0 })}
              className="w-full bg-white border border-[#1A1A1A] px-2.5 py-1 text-xs text-[#1A1A1A] font-mono focus:border-[#E85D2A] outline-none rounded-none"
            />
          </div>
        </div>
      </GlassSurface>
    </div>
  );
};
