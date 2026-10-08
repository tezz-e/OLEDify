import React, { useRef, useEffect, useState } from 'react';
import { CropSettings, FitMode } from '../types/media';
import { ResizeHandle, resizeCropWithHandle } from '../engine/cropEngine';

interface CropControlsProps {
  settings: CropSettings;
  onChange: (settings: CropSettings) => void;
  disabled?: boolean;
  sourceFrame?: ImageData | null;
  themeMode?: 'light' | 'dark';
}

export const CropControls: React.FC<CropControlsProps> = ({ settings, onChange, disabled, sourceFrame, themeMode = 'light' }) => {
  const isDark = themeMode === 'dark';
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragStart, setDragStart] = useState<{
    pointerX: number;
    pointerY: number;
    crop: CropSettings;
    handle: 'move' | ResizeHandle;
  } | null>(null);

  useEffect(() => {
    if (sourceFrame && canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = sourceFrame.width;
      canvas.height = sourceFrame.height;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.putImageData(sourceFrame, 0, 0);
    }
  }, [sourceFrame]);

  const handleModeChange = (mode: FitMode) => {
    onChange({ ...settings, mode });
  };

  const modes: FitMode[] = ['cover', 'contain', 'stretch', 'manual'];

  // Move the crop box or resize it from one of the eight handles.
  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled || settings.mode !== 'manual') return;

    const target = e.target as SVGElement;
    const handle = target.closest<SVGElement>('[data-crop-handle]')?.dataset.cropHandle;
    if (!handle && target.dataset.cropBody !== 'true') return;

    setDragStart({
      pointerX: e.clientX,
      pointerY: e.clientY,
      crop: settings,
      handle: (handle || 'move') as 'move' | ResizeHandle,
    });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragStart || settings.mode !== 'manual' || !containerRef.current || !sourceFrame) return;
    
    const container = containerRef.current.getBoundingClientRect();
    const scale = Math.min(container.width / sourceFrame.width, container.height / sourceFrame.height);
    if (scale === 0) return;
    
    const dx = (e.clientX - dragStart.pointerX) / scale;
    const dy = (e.clientY - dragStart.pointerY) / scale;

    if (dragStart.handle !== 'move') {
      const resized = resizeCropWithHandle(
        dragStart.handle,
        dragStart.crop,
        dx,
        dy,
        sourceFrame.width,
        sourceFrame.height
      );
      onChange({ ...settings, ...resized });
      return;
    }
    
    let newX = Math.round(dragStart.crop.x + dx);
    let newY = Math.round(dragStart.crop.y + dy);
    
    // Clamp to boundaries
    newX = Math.max(0, Math.min(newX, sourceFrame.width - dragStart.crop.width));
    newY = Math.max(0, Math.min(newY, sourceFrame.height - dragStart.crop.height));
    
    onChange({ ...settings, x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragStart) return;
    setDragStart(null);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  return (
    <div className={`space-y-6 transition-all duration-300 ${
      disabled 
        ? 'opacity-35 grayscale pointer-events-none select-none cursor-not-allowed' 
        : ''
    }`}>
      
      {settings.mode === 'manual' && sourceFrame && (
        <div className="space-y-2">
          <label className="text-[10px] font-bold tracking-widest text-[#6B6B6B] uppercase font-mono">Manual Crop (Move or Resize)</label>
          <div 
            ref={containerRef}
            className="relative w-full aspect-video bg-[#080808] border-2 border-[#1A1A1A] overflow-hidden flex items-center justify-center touch-none cursor-move"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {/* The actual video frame scaled to fit */}
            <canvas 
              ref={canvasRef} 
              className="absolute w-full h-full object-contain pointer-events-none opacity-80"
            />
            
            {/* The crop overlay SVG matching the object-contain bounds */}
            <svg 
              viewBox={`0 0 ${sourceFrame.width} ${sourceFrame.height}`}
              className="absolute w-full h-full pointer-events-none"
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Dimmed outside area */}
              <mask
                id="cropMask"
                maskUnits="userSpaceOnUse"
                maskContentUnits="userSpaceOnUse"
                x="0"
                y="0"
                width={sourceFrame.width}
                height={sourceFrame.height}
              >
                <rect x="0" y="0" width={sourceFrame.width} height={sourceFrame.height} fill="white" />
                <rect 
                  x={settings.x} 
                  y={settings.y} 
                  width={settings.width} 
                  height={settings.height} 
                  fill="black" 
                />
              </mask>
              <rect x="0" y="0" width={sourceFrame.width} height={sourceFrame.height} fill="black" mask="url(#cropMask)" opacity="0.6" />
              
              {/* Highlighted bounding box */}
              <rect 
                x={settings.x} 
                y={settings.y} 
                width={settings.width} 
                height={settings.height} 
                fill="none" 
                stroke={isDark ? "#00FF66" : "#E85D2A"} 
                strokeWidth={Math.max(2, sourceFrame.width / 100)} 
                strokeDasharray={`${Math.max(4, sourceFrame.width/50)}`}
              />
              <rect
                data-crop-body="true"
                x={settings.x}
                y={settings.y}
                width={settings.width}
                height={settings.height}
                fill="transparent"
                pointerEvents="all"
                className="cursor-move"
              />
              {(['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as ResizeHandle[]).map((handle) => {
                const positions: Record<ResizeHandle, [number, number]> = {
                  nw: [settings.x, settings.y],
                  n: [settings.x + settings.width / 2, settings.y],
                  ne: [settings.x + settings.width, settings.y],
                  e: [settings.x + settings.width, settings.y + settings.height / 2],
                  se: [settings.x + settings.width, settings.y + settings.height],
                  s: [settings.x + settings.width / 2, settings.y + settings.height],
                  sw: [settings.x, settings.y + settings.height],
                  w: [settings.x, settings.y + settings.height / 2],
                };
                const [cx, cy] = positions[handle];
                return (
                  <circle
                    key={handle}
                    data-crop-handle={handle}
                    cx={cx}
                    cy={cy}
                    r={Math.max(5, sourceFrame.width / 45)}
                    fill={isDark ? "#08080A" : "#F5F0EB"}
                    stroke={isDark ? "#00FF66" : "#E85D2A"}
                    strokeWidth={Math.max(2, sourceFrame.width / 150)}
                    pointerEvents="all"
                    className={handle === 'nw' || handle === 'se' ? 'cursor-nwse-resize' : handle === 'ne' || handle === 'sw' ? 'cursor-nesw-resize' : handle === 'n' || handle === 's' ? 'cursor-ns-resize' : 'cursor-ew-resize'}
                  />
                );
              })}
              <circle cx={settings.x + settings.width/2} cy={settings.y + settings.height/2} r={Math.max(2, sourceFrame.width/150)} fill={isDark ? "#00FF66" : "#E85D2A"} pointerEvents="none" />
            </svg>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <label className={`text-[10px] font-bold tracking-widest uppercase font-mono ${
          isDark ? 'text-[#FAFAFA]' : 'text-[#1A1A1A]'
        }`}>Crop Mode</label>
        <div className={`border p-1 flex gap-1 ${
          isDark ? 'bg-[#0A0A0C]/80 border-white/10' : 'bg-[#F6F6F4] border-[#1A1A1A]'
        }`}>
          {modes.map((mode) => (
            <button
              key={mode}
              onClick={() => handleModeChange(mode)}
              disabled={disabled}
              className={`flex-1 text-[10px] font-mono font-bold tracking-wide py-1.5 transition-all duration-150 border uppercase cursor-pointer ${
                settings.mode === mode
                  ? isDark
                    ? 'bg-[#FF5500] text-white border-[#FF5500] font-extrabold shadow-[0_0_10px_rgba(255,85,0,0.35)]'
                    : 'bg-[#1A1A1A] text-white border-[#1A1A1A]'
                  : isDark
                    ? 'bg-[#121216] text-[#A1A1AA] border-white/10 hover:border-white/30 hover:text-white'
                    : 'bg-white text-[#6B6B6B] border-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <label className={`text-[10px] font-bold tracking-widest uppercase font-mono ${
          isDark ? 'text-[#A1A1AA]' : 'text-[#6B6B6B]'
        }`}>Bicubic Smoothing</label>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange({ ...settings, smoothing: !settings.smoothing })}
          className={`px-3 py-1 text-[9px] font-mono font-bold tracking-wider uppercase border transition-colors cursor-pointer ${
            settings.smoothing
              ? isDark
                ? 'bg-[#FF5500] text-white border-[#FF5500] font-extrabold shadow-[0_0_8px_rgba(255,85,0,0.4)]'
                : 'bg-[#1A1A1A] text-white border-[#1A1A1A]'
              : isDark
                ? 'bg-[#121216] text-[#71717A] border-white/10 hover:border-white/30'
                : 'bg-white text-[#6B6B6B] border-[#1A1A1A]'
          }`}
        >
          {settings.smoothing ? 'ACTIVE' : 'OFF'}
        </button>
      </div>

      {settings.mode === 'manual' && (
      <div className="flex gap-2 pt-2">
        <div className="flex-1 space-y-1">
          <label className={`text-[10px] font-bold tracking-widest uppercase font-mono ${
            isDark ? 'text-[#A1A1AA]' : 'text-[#6B6B6B]'
          }`}>Pan X</label>
          <input
            type="number"
            value={settings.x}
            disabled={disabled || settings.mode !== 'manual'}
            onChange={(e) => onChange({ ...settings, x: parseInt(e.target.value) || 0 })}
            className={`w-full px-2 py-1 text-xs font-mono disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${
              isDark 
                ? 'bg-[#0A0A0C] border border-white/10 text-[#FAFAFA] focus:border-[#00FF66]' 
                : 'bg-white border border-[#1A1A1A] text-[#1A1A1A]'
            }`}
          />
        </div>
        <div className="flex-1 space-y-1">
          <label className={`text-[10px] font-bold tracking-widest uppercase font-mono ${
            isDark ? 'text-[#A1A1AA]' : 'text-[#6B6B6B]'
          }`}>Pan Y</label>
          <input
            type="number"
            value={settings.y}
            disabled={disabled || settings.mode !== 'manual'}
            onChange={(e) => onChange({ ...settings, y: parseInt(e.target.value) || 0 })}
            className={`w-full px-2 py-1 text-xs font-mono disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${
              isDark 
                ? 'bg-[#0A0A0C] border border-white/10 text-[#FAFAFA] focus:border-[#00FF66]' 
                : 'bg-white border border-[#1A1A1A] text-[#1A1A1A]'
            }`}
          />
        </div>
      </div>
      )}

      {settings.mode === 'manual' && <div className={`text-[10px] font-mono ${isDark ? 'text-[#7E7694]' : 'text-[#6B6B6B]'}`}>
        Source: {settings.sourceWidth}×{settings.sourceHeight} <br />
        Crop: {Math.round(settings.width)}×{Math.round(settings.height)}
      </div>}
    </div>
  );
};
