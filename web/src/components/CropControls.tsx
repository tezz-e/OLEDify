import React, { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CropSettings, FitMode } from '../types/media';
import { ResizeHandle, resizeCropWithHandle } from '../engine/cropEngine';
import { HW_SPRINGS } from '../theme/springPresets';
import { triggerTactileFeedback } from './hardware/hapticAudio';
import { GooeySegmentedControl } from './ui/GooeySegmentedControl';

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
          <label className="text-xs font-medium text-[var(--hw-text-secondary)] font-sans">Manual crop (drag or resize)</label>
          <div 
            ref={containerRef}
            className="relative w-full aspect-video bg-[var(--hw-bg-canvas)] border border-white/[0.08] rounded-[8px] overflow-hidden flex items-center justify-center touch-none cursor-move"
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
                stroke="#FF5500" 
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
                    fill={isDark ? "#202225" : "#F5F0EB"}
                    stroke="#FF5500"
                    strokeWidth={Math.max(2, sourceFrame.width / 150)}
                    pointerEvents="all"
                    className={handle === 'nw' || handle === 'se' ? 'cursor-nwse-resize' : handle === 'ne' || handle === 'sw' ? 'cursor-nesw-resize' : handle === 'n' || handle === 's' ? 'cursor-ns-resize' : 'cursor-ew-resize'}
                  />
                );
              })}
              <circle cx={settings.x + settings.width/2} cy={settings.y + settings.height/2} r={Math.max(2, sourceFrame.width/150)} fill="#FF5500" pointerEvents="none" />
            </svg>
          </div>
        </div>
      )}

      {/* Crop Mode Switcher with fluid sliding gooey pill */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-[var(--hw-text-secondary)] font-sans">
          Crop mode
        </label>
        <GooeySegmentedControl<FitMode>
          options={[
            { id: 'cover', label: 'Cover' },
            { id: 'contain', label: 'Contain' },
            { id: 'stretch', label: 'Stretch' },
            { id: 'manual', label: 'Manual' }
          ]}
          value={settings.mode}
          onChange={handleModeChange}
          themeMode={themeMode}
        />
      </div>

      {/* Authentic Physical Industrial Mechanical Toggle Switch for Bicubic Smoothing */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <label className="text-xs font-medium text-[var(--hw-text-primary)] font-sans block">
            Bicubic smoothing
          </label>
          <span className="text-[10px] text-[var(--hw-text-secondary)] font-mono">
            {settings.smoothing ? 'ANTI-ALIASED · BICUBIC RESAMPLE' : 'NEAREST NEIGHBOR · 1-BIT CRISP'}
          </span>
        </div>

        {/* Machined Metal Bat Lever Toggle */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            triggerTactileFeedback('toggle');
            onChange({ ...settings, smoothing: !settings.smoothing });
          }}
          className={`flex items-center gap-2 p-1.5 pl-2.5 rounded-[8px] border border-[var(--hw-border-hairline)] ${
            isDark ? 'bg-black/40 hover:bg-black/60' : 'bg-black/5 hover:bg-black/10'
          } transition-all cursor-pointer group disabled:opacity-40 disabled:cursor-not-allowed`}
          title="Toggle bicubic interpolation filter"
        >
          {/* Signal Indicator LED */}
          <div className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${
            settings.smoothing 
              ? 'bg-[#FF5500] shadow-[0_0_6px_#FF5500]' 
              : 'bg-zinc-600'
          }`} />

          {/* Physical Toggle Base Well */}
          <div className="w-10 h-5 rounded-full bg-[#141517] border border-[#2A2B2E] p-0.5 relative shadow-[inset_0_1.5px_3px_rgba(0,0,0,0.8)] flex items-center">
            {/* Sliding Metal Toggle Bat Lever with Chamfer Ring */}
            <motion.div
              animate={{
                x: settings.smoothing ? 20 : 0,
              }}
              transition={HW_SPRINGS.snappy}
              className="w-4 h-4 rounded-full bg-gradient-to-b from-[#E4E4E7] via-[#A1A1AA] to-[#52525B] shadow-[0_1px_3px_rgba(0,0,0,0.7),inset_0_1px_1px_rgba(255,255,255,0.8)] border border-black/60 flex items-center justify-center relative"
            >
              {/* Center knurled metal slot */}
              <div className="w-[1px] h-2 bg-black/50" />
            </motion.div>
          </div>
        </button>
      </div>

      {settings.mode === 'manual' && (
      <div className="flex gap-2 pt-2">
        <div className="flex-1 space-y-1">
          <label className="text-xs font-medium text-[var(--hw-text-secondary)] font-sans">
            Pan X
          </label>
          <input
            type="number"
            value={settings.x}
            disabled={disabled || settings.mode !== 'manual'}
            onChange={(e) => onChange({ ...settings, x: parseInt(e.target.value) || 0 })}
            className="w-full px-2.5 py-1.5 text-xs font-mono rounded-[8px] bg-[var(--hw-bg-canvas)] border border-[var(--hw-border-hairline)] text-[var(--hw-text-primary)] focus:border-[#FF5500] outline-none disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          />
        </div>
        <div className="flex-1 space-y-1">
          <label className="text-xs font-medium text-[var(--hw-text-secondary)] font-sans">
            Pan Y
          </label>
          <input
            type="number"
            value={settings.y}
            disabled={disabled || settings.mode !== 'manual'}
            onChange={(e) => onChange({ ...settings, y: parseInt(e.target.value) || 0 })}
            className="w-full px-2.5 py-1.5 text-xs font-mono rounded-[8px] bg-[var(--hw-bg-canvas)] border border-[var(--hw-border-hairline)] text-[var(--hw-text-primary)] focus:border-[#FF5500] outline-none disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          />
        </div>
      </div>
      )}

      {settings.mode === 'manual' && (
        <div className="text-[11px] font-sans text-[var(--hw-text-secondary)] pt-1">
          Source: <span className="font-mono">{settings.sourceWidth}×{settings.sourceHeight}</span> <br />
          Crop: <span className="font-mono">{Math.round(settings.width)}×{Math.round(settings.height)}</span>
        </div>
      )}
    </div>
  );
};
