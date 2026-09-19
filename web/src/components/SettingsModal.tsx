import React from 'react';
import { Settings, Cpu, Monitor, X } from 'lucide-react';
import { HardwareConfig, Microcontroller, DisplayController } from '../types/oled';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: HardwareConfig;
  onChange: (config: HardwareConfig) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, config, onChange }) => {
  if (!isOpen) return null;

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in"
      onClick={handleBackdropClick}
    >
      <div className="bg-oled-surface border border-oled-border rounded-xl max-w-md w-full shadow-2xl animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-oled-border">
          <div className="flex items-center space-x-2">
            <Settings className="w-4 h-4 text-oled-cyan" />
            <h3 className="text-sm font-semibold text-slate-100">Settings</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Grid */}
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs text-slate-400 flex items-center gap-1">
              <Cpu className="w-3 h-3 text-cyan-400" /> Target Board
            </label>
            <select
              value={config.mcu}
              onChange={(e) => handleMcuChange(e.target.value as Microcontroller)}
              className="w-full bg-oled-panel border border-oled-border rounded px-2.5 py-1.5 text-xs text-slate-200 font-mono"
            >
              <option value="esp32-s3">ESP32-S3</option>
              <option value="esp32">ESP32 (Standard)</option>
              <option value="esp32-c3">ESP32-C3</option>
              <option value="arduino-uno">Arduino Uno</option>
              <option value="pi-pico">Pi Pico</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-400 flex items-center gap-1">
              <Monitor className="w-3 h-3 text-cyan-400" /> Display Driver
            </label>
            <select
              value={config.display}
              onChange={(e) => onChange({ ...config, display: e.target.value as DisplayController })}
              className="w-full bg-oled-panel border border-oled-border rounded px-2.5 py-1.5 text-xs text-slate-200 font-mono"
            >
              <option value="sh1106">SH1106</option>
              <option value="ssd1306">SSD1306</option>
              <option value="ssd1315">SSD1315</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-400">SDA Pin (GPIO)</label>
            <input
              type="number"
              value={config.sdaPin}
              onChange={(e) => onChange({ ...config, sdaPin: parseInt(e.target.value, 10) || 0 })}
              className="w-full bg-oled-panel border border-oled-border rounded px-2.5 py-1 text-xs text-slate-200 font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-400">SCL Pin (GPIO)</label>
            <input
              type="number"
              value={config.sclPin}
              onChange={(e) => onChange({ ...config, sclPin: parseInt(e.target.value, 10) || 0 })}
              className="w-full bg-oled-panel border border-oled-border rounded px-2.5 py-1 text-xs text-slate-200 font-mono"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
