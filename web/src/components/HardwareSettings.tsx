import React from 'react';
import { HardwareConfig, Microcontroller, DisplayController } from '../types/oled';
import { Cpu, Monitor, Hash, Settings } from 'lucide-react';

interface HardwareSettingsProps {
  config: HardwareConfig;
  onChange: (newConfig: HardwareConfig) => void;
}

export const HardwareSettings: React.FC<HardwareSettingsProps> = ({
  config,
  onChange,
}) => {
  // Preset pin maps when switching MCU
  const handleMcuChange = (mcu: Microcontroller) => {
    let sda = config.sdaPin;
    let scl = config.sclPin;

    if (mcu === 'esp32-s3') {
      sda = 8;
      scl = 9;
    } else if (mcu === 'esp32') {
      sda = 21;
      scl = 22;
    } else if (mcu === 'esp32-c3') {
      sda = 8;
      scl = 9;
    } else if (mcu === 'arduino-uno') {
      sda = 18; // A4
      scl = 19; // A5
    } else if (mcu === 'pi-pico') {
      sda = 4;
      scl = 5;
    }

    onChange({ ...config, mcu, sdaPin: sda, sclPin: scl });
  };

  return (
    <div className="w-full bg-oled-surface border border-oled-border rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between border-b border-oled-border/60 pb-2">
        <div className="flex items-center space-x-2 text-slate-300">
          <Settings className="w-4 h-4 text-oled-cyan" />
          <h3 className="text-xs font-bold uppercase tracking-wider">
            Hardware & Pin Configuration
          </h3>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-oled-cyan border border-cyan-500/20">
          Custom Pins
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Microcontroller Selection */}
        <div className="space-y-1">
          <label className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
            <Cpu className="w-3 h-3 text-cyan-400" /> Target Board:
          </label>
          <select
            value={config.mcu}
            onChange={(e) => handleMcuChange(e.target.value as Microcontroller)}
            className="w-full bg-oled-panel border border-oled-border rounded px-2.5 py-1.5 text-xs text-slate-200 font-mono cursor-pointer"
          >
            <option value="esp32-s3">ESP32-S3 (DevKit / N16R8)</option>
            <option value="esp32">ESP32 Standard (WROOM / 30-pin)</option>
            <option value="esp32-c3">ESP32-C3 SuperMini</option>
            <option value="arduino-uno">Arduino Uno / Nano</option>
            <option value="pi-pico">Raspberry Pi Pico</option>
          </select>
        </div>

        {/* Display Controller Selection */}
        <div className="space-y-1">
          <label className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
            <Monitor className="w-3 h-3 text-cyan-400" /> Display Driver:
          </label>
          <select
            value={config.display}
            onChange={(e) =>
              onChange({ ...config, display: e.target.value as DisplayController })
            }
            className="w-full bg-oled-panel border border-oled-border rounded px-2.5 py-1.5 text-xs text-slate-200 font-mono cursor-pointer"
          >
            <option value="sh1106">SH1106 (Typically 1.3" OLED)</option>
            <option value="ssd1306">SSD1306 (Typically 0.96" OLED)</option>
            <option value="ssd1315">SSD1315 (0.96" OLED variant)</option>
          </select>
        </div>

        {/* Custom SDA Pin Input */}
        <div className="space-y-1">
          <label className="text-[11px] font-mono text-slate-400 flex items-center justify-between">
            <span>SDA Pin (I2C Data):</span>
            <span className="text-oled-cyan">GPIO {config.sdaPin}</span>
          </label>
          <input
            type="number"
            value={config.sdaPin}
            onChange={(e) =>
              onChange({ ...config, sdaPin: parseInt(e.target.value, 10) || 0 })
            }
            className="w-full bg-oled-panel border border-oled-border rounded px-2.5 py-1 text-xs text-slate-200 font-mono"
          />
        </div>

        {/* Custom SCL Pin Input */}
        <div className="space-y-1">
          <label className="text-[11px] font-mono text-slate-400 flex items-center justify-between">
            <span>SCL Pin (I2C Clock):</span>
            <span className="text-oled-cyan">GPIO {config.sclPin}</span>
          </label>
          <input
            type="number"
            value={config.sclPin}
            onChange={(e) =>
              onChange({ ...config, sclPin: parseInt(e.target.value, 10) || 0 })
            }
            className="w-full bg-oled-panel border border-oled-border rounded px-2.5 py-1 text-xs text-slate-200 font-mono"
          />
        </div>
      </div>
    </div>
  );
};
