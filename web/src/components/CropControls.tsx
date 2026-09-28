import React, { useRef, useEffect, useState } from 'react';
import { CropSettings, FitMode } from '../types/media';
import { ResizeHandle, resizeCropWithHandle } from '../engine/cropEngine';

interface CropControlsProps {
  settings: CropSettings;
  onChange: (settings: CropSettings) => void;
  disabled?: boolean;
  sourceFrame?: ImageData | null;
}

export const CropControls: React.FC<CropControlsProps> = ({ settings, onChange, disabled, sourceFrame }) => {
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
    <div className={`space-y-4 ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
      
      {settings.mode === 'manual' && sourceFrame && (
        <div className="space-y-2">
          <label className="text-xs font-sans font-medium text-[#141413] block">Manual Frame Cropping</label>
          <div 
            ref={containerRef}
            className="relative w-full aspect-video bg-[#141413] border border-[#E8E5DE] rounded-lg overflow-hidden flex items-center justify-center touch-none cursor-move shadow-inner"
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
              <rect x="0" y="0" width={sourceFrame.width} height={sourceFrame.height} fill="black" mask="url(#cropMask)" opacity="0.65" />
              
              {/* Highlighted bounding box */}
              <rect 
                x={settings.x} 
                y={settings.y} 
                width={settings.width} 
                height={settings.height} 
                fill="none" 
                stroke="#D97757" 
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
                    fill="#FAF9F5"
                    stroke="#D97757"
                    strokeWidth={Math.max(2, sourceFrame.width / 150)}
                    pointerEvents="all"
                    className={handle === 'nw' || handle === 'se' ? 'cursor-nwse-resize' : handle === 'ne' || handle === 'sw' ? 'cursor-nesw-resize' : handle === 'n' || handle === 's' ? 'cursor-ns-resize' : 'cursor-ew-resize'}
                  />
                );
              })}
              <circle cx={settings.x + settings.width/2} cy={settings.y + settings.height/2} r={Math.max(2, sourceFrame.width/150)} fill="#D97757" pointerEvents="none" />
            </svg>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <label className="text-xs font-sans font-medium text-[#141413] block">Fitting Aspect Mode</label>
        <div className="bg-[#FAF9F5] border border-[#E8E5DE] p-1 rounded-lg flex gap-1">
          {modes.map((mode) => (
            <button
              key={mode}
              onClick={() => handleModeChange(mode)}
              className={`flex-1 text-[11px] font-sans py-1 rounded-md transition-all capitalize cursor-pointer ${
                settings.mode === mode
                  ? 'bg-white text-[#141413] font-semibold shadow-xs border border-[#E8E5DE]'
                  : 'text-[#5E5D59] hover:text-[#141413]'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <label className="text-xs font-sans font-medium text-[#141413] cursor-pointer" htmlFor="smoothing-toggle">Bicubic Smoothing</label>
        <input
          id="smoothing-toggle"
          type="checkbox"
          checked={settings.smoothing}
          onChange={(e) => onChange({ ...settings, smoothing: e.target.checked })}
          className="w-4 h-4 accent-[#D97757] cursor-pointer rounded"
        />
      </div>

      {settings.mode === 'manual' && (
      <div className="flex gap-2 pt-1">
        <div className="flex-1 space-y-1">
          <label className="text-xs font-sans text-[#5E5D59]">Pan X</label>
          <input
            type="number"
            value={settings.x}
            disabled={disabled || settings.mode !== 'manual'}
            onChange={(e) => onChange({ ...settings, x: parseInt(e.target.value) || 0 })}
            className="w-full bg-white border border-[#E8E5DE] rounded-md px-2.5 py-1 text-xs font-mono text-[#141413] focus:border-[#D97757] outline-none shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
          />
        </div>
        <div className="flex-1 space-y-1">
          <label className="text-xs font-sans text-[#5E5D59]">Pan Y</label>
          <input
            type="number"
            value={settings.y}
            disabled={disabled || settings.mode !== 'manual'}
            onChange={(e) => onChange({ ...settings, y: parseInt(e.target.value) || 0 })}
            className="w-full bg-white border border-[#E8E5DE] rounded-md px-2.5 py-1 text-xs font-mono text-[#141413] focus:border-[#D97757] outline-none shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
          />
        </div>
      </div>
      )}

      {settings.mode === 'manual' && (
        <div className="text-[11px] font-mono text-[#87867F] bg-[#FAF9F5] p-2 rounded-lg border border-[#E8E5DE]">
          Source: {settings.sourceWidth}×{settings.sourceHeight}px • Crop: {Math.round(settings.width)}×{Math.round(settings.height)}px
        </div>
      )}
    </div>
  );
};
