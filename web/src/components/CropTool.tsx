/**
 * Interactive 128×64 Crop & Scale Bounding Box Tool (Feature F05)
 *
 * Enforces:
 * - Fixed 2:1 aspect ratio bounding box (W = 2 * H)
 * - Cover, Contain, and Stretch presets
 * - 8-handle orthogonal least-squares resizing
 * - Interactive pan dragging and mouse wheel zooming
 * - High quality bicubic smoothing vs nearest-neighbor pixel art
 * - Real-time 128x64 target canvas preview
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Crop,
  Maximize2,
  Minimize2,
  StretchHorizontal,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { CropSettings, FitMode } from '../types/media';
import {
  computeCoverCrop,
  computeContainDestRect,
  clampCropToBounds,
  resizeCropWithHandle,
  zoomCropAroundPoint,
  renderCropTo128x64,
  ResizeHandle,
  OLED_TARGET_WIDTH,
  OLED_TARGET_HEIGHT,
} from '../engine/cropEngine';

interface CropToolProps {
  sourceImageData: ImageData | null;
  cropSettings: CropSettings;
  onCropChange: (settings: CropSettings) => void;
  disabled?: boolean;
  className?: string;
}

export const CropTool: React.FC<CropToolProps> = ({
  sourceImageData,
  cropSettings,
  onCropChange,
  disabled = false,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement>(null);
  const preview128x64CanvasRef = useRef<HTMLCanvasElement>(null);

  // Interaction tracking state
  const [activeDrag, setActiveDrag] = useState<{
    type: 'pan' | ResizeHandle;
    startX: number;
    startY: number;
    startCrop: CropSettings;
  } | null>(null);

  // Cache source offscreen canvas for blitting
  const offscreenSourceCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const sourceWidth = sourceImageData?.width || cropSettings.sourceWidth || 128;
  const sourceHeight = sourceImageData?.height || cropSettings.sourceHeight || 64;

  // Prepare offscreen canvas when sourceImageData changes
  useEffect(() => {
    if (!sourceImageData) {
      offscreenSourceCanvasRef.current = null;
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = sourceImageData.width;
    canvas.height = sourceImageData.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.putImageData(sourceImageData, 0, 0);
      offscreenSourceCanvasRef.current = canvas;
    }
  }, [sourceImageData]);

  // Redraw source display canvas when source changes or container resizes
  useEffect(() => {
    const canvas = sourceCanvasRef.current;
    const offscreen = offscreenSourceCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (offscreen) {
      ctx.imageSmoothingEnabled = cropSettings.smoothing;
      ctx.drawImage(offscreen, 0, 0, canvas.width, canvas.height);
    } else {
      // Placeholder background
      ctx.fillStyle = '#0d1117';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#30363d';
      ctx.strokeRect(0, 0, canvas.width, canvas.height);
    }
  }, [sourceImageData, cropSettings.smoothing]);

  // Update mini 128x64 preview canvas whenever crop or source changes
  useEffect(() => {
    const previewCanvas = preview128x64CanvasRef.current;
    const offscreen = offscreenSourceCanvasRef.current;
    if (!previewCanvas) return;

    const ctx = previewCanvas.getContext('2d');
    if (!ctx) return;

    if (offscreen) {
      renderCropTo128x64(offscreen, cropSettings, previewCanvas);
    } else {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, OLED_TARGET_WIDTH, OLED_TARGET_HEIGHT);
      ctx.fillStyle = '#334155';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('128 × 64', 64, 36);
    }
  }, [cropSettings, sourceImageData]);

  // Preset Handlers
  const handlePresetCover = useCallback(() => {
    const cover = computeCoverCrop(sourceWidth, sourceHeight);
    onCropChange({
      ...cropSettings,
      mode: 'cover',
      x: cover.x,
      y: cover.y,
      width: cover.width,
      height: cover.height,
      sourceWidth,
      sourceHeight,
    });
  }, [sourceWidth, sourceHeight, cropSettings, onCropChange]);

  const handlePresetContain = useCallback(() => {
    onCropChange({
      ...cropSettings,
      mode: 'contain',
      x: 0,
      y: 0,
      width: sourceWidth,
      height: sourceHeight,
      sourceWidth,
      sourceHeight,
    });
  }, [sourceWidth, sourceHeight, cropSettings, onCropChange]);

  const handlePresetStretch = useCallback(() => {
    onCropChange({
      ...cropSettings,
      mode: 'stretch',
      x: 0,
      y: 0,
      width: sourceWidth,
      height: sourceHeight,
      sourceWidth,
      sourceHeight,
    });
  }, [sourceWidth, sourceHeight, cropSettings, onCropChange]);

  const handleToggleSmoothing = () => {
    onCropChange({
      ...cropSettings,
      smoothing: !cropSettings.smoothing,
    });
  };

  // Convert client viewport pixels to source coordinates
  const getScaleFactor = useCallback(() => {
    const container = containerRef.current;
    if (!container || sourceWidth <= 0 || sourceHeight <= 0) return 1;
    const rect = container.getBoundingClientRect();
    return rect.width / sourceWidth;
  }, [sourceWidth, sourceHeight]);

  // Pointer event handlers for drag and resize
  const handlePointerDown = (
    e: React.PointerEvent,
    dragType: 'pan' | ResizeHandle
  ) => {
    if (disabled || cropSettings.mode !== 'cover') return;
    e.preventDefault();
    e.stopPropagation();

    setActiveDrag({
      type: dragType,
      startX: e.clientX,
      startY: e.clientY,
      startCrop: { ...cropSettings },
    });
  };

  useEffect(() => {
    if (!activeDrag) return;

    const handlePointerMove = (e: PointerEvent) => {
      const scale = getScaleFactor();
      if (scale <= 0) return;

      const deltaX = (e.clientX - activeDrag.startX) / scale;
      const deltaY = (e.clientY - activeDrag.startY) / scale;

      if (activeDrag.type === 'pan') {
        const newX = activeDrag.startCrop.x + deltaX;
        const newY = activeDrag.startCrop.y + deltaY;

        const clamped = clampCropToBounds(
          {
            x: newX,
            y: newY,
            width: activeDrag.startCrop.width,
            height: activeDrag.startCrop.height,
          },
          sourceWidth,
          sourceHeight
        );

        onCropChange({
          ...cropSettings,
          x: clamped.x,
          y: clamped.y,
          width: clamped.width,
          height: clamped.height,
        });
      } else {
        // Handle resize with orthogonal least-squares 2:1 projection
        const resized = resizeCropWithHandle(
          activeDrag.type,
          activeDrag.startCrop,
          deltaX,
          deltaY,
          sourceWidth,
          sourceHeight
        );

        onCropChange({
          ...cropSettings,
          x: resized.x,
          y: resized.y,
          width: resized.width,
          height: resized.height,
        });
      }
    };

    const handlePointerUp = () => {
      setActiveDrag(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [activeDrag, getScaleFactor, sourceWidth, sourceHeight, cropSettings, onCropChange]);

  // Mouse wheel zoom handler
  const handleWheel = (e: React.WheelEvent) => {
    if (disabled || cropSettings.mode !== 'cover') return;
    e.preventDefault();

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const scale = rect.width / sourceWidth;
    const mouseSourceX = (e.clientX - rect.left) / scale;
    const mouseSourceY = (e.clientY - rect.top) / scale;

    const zoomDelta = e.deltaY < 0 ? 0.95 : 1.05;

    const zoomed = zoomCropAroundPoint(
      cropSettings,
      sourceWidth,
      sourceHeight,
      zoomDelta,
      mouseSourceX,
      mouseSourceY
    );

    onCropChange({
      ...cropSettings,
      x: zoomed.x,
      y: zoomed.y,
      width: zoomed.width,
      height: zoomed.height,
    });
  };

  // Convert source crop coordinates to percentage for CSS placement
  const boxLeftPercent = (cropSettings.x / sourceWidth) * 100;
  const boxTopPercent = (cropSettings.y / sourceHeight) * 100;
  const boxWidthPercent = (cropSettings.width / sourceWidth) * 100;
  const boxHeightPercent = (cropSettings.height / sourceHeight) * 100;

  const isCover = cropSettings.mode === 'cover';

  return (
    <div className={`bg-oled-surface border border-oled-border rounded-xl p-4 space-y-4 ${className}`}>
      {/* Header & Preset Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-oled-border/60 pb-3">
        <div className="flex items-center space-x-2">
          <Crop className="w-4 h-4 text-oled-cyan" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
            2:1 Crop & Scale Bounding Box
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-oled-cyan border border-cyan-500/30">
            128×64
          </span>
        </div>

        {/* Preset Buttons */}
        <div className="inline-flex rounded-lg bg-oled-panel border border-oled-border p-1 space-x-1">
          <button
            type="button"
            disabled={disabled}
            onClick={handlePresetCover}
            className={`flex items-center space-x-1.5 px-2.5 py-1 text-xs font-medium rounded transition-all cursor-pointer ${
              cropSettings.mode === 'cover'
                ? 'bg-cyan-500/20 text-oled-cyan font-semibold border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Cover (2:1 Fill)</span>
          </button>

          <button
            type="button"
            disabled={disabled}
            onClick={handlePresetContain}
            className={`flex items-center space-x-1.5 px-2.5 py-1 text-xs font-medium rounded transition-all cursor-pointer ${
              cropSettings.mode === 'contain'
                ? 'bg-cyan-500/20 text-oled-cyan font-semibold border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Minimize2 className="w-3.5 h-3.5" />
            <span>Contain (Letterbox)</span>
          </button>

          <button
            type="button"
            disabled={disabled}
            onClick={handlePresetStretch}
            className={`flex items-center space-x-1.5 px-2.5 py-1 text-xs font-medium rounded transition-all cursor-pointer ${
              cropSettings.mode === 'stretch'
                ? 'bg-cyan-500/20 text-oled-cyan font-semibold border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <StretchHorizontal className="w-3.5 h-3.5" />
            <span>Stretch</span>
          </button>
        </div>
      </div>

      {/* Main Interactive Viewport Area */}
      <div className="relative flex flex-col md:flex-row gap-4 items-center">
        {/* Source Media Viewport with Crop Overlay */}
        <div
          ref={containerRef}
          onWheel={handleWheel}
          className="relative flex-1 w-full bg-oled-bg border border-oled-border rounded-lg overflow-hidden select-none touch-none aspect-auto min-h-[220px] max-h-[380px] flex items-center justify-center"
        >
          {/* Base Source Canvas */}
          <canvas
            ref={sourceCanvasRef}
            width={sourceWidth}
            height={sourceHeight}
            className="w-full h-auto max-h-[380px] object-contain block pointer-events-none"
          />

          {/* Shading Mask Overlay (visible only in Cover mode) */}
          {isCover && (
            <>
              {/* Top Mask */}
              <div
                className="absolute bg-black/70 pointer-events-none left-0 right-0 top-0 transition-[height]"
                style={{ height: `${boxTopPercent}%` }}
              />
              {/* Bottom Mask */}
              <div
                className="absolute bg-black/70 pointer-events-none left-0 right-0 bottom-0 transition-[height]"
                style={{ height: `${100 - (boxTopPercent + boxHeightPercent)}%` }}
              />
              {/* Left Mask */}
              <div
                className="absolute bg-black/70 pointer-events-none left-0 transition-[width]"
                style={{
                  top: `${boxTopPercent}%`,
                  height: `${boxHeightPercent}%`,
                  width: `${boxLeftPercent}%`,
                }}
              />
              {/* Right Mask */}
              <div
                className="absolute bg-black/70 pointer-events-none right-0 transition-[width]"
                style={{
                  top: `${boxTopPercent}%`,
                  height: `${boxHeightPercent}%`,
                  width: `${100 - (boxLeftPercent + boxWidthPercent)}%`,
                }}
              />

              {/* Interactive Bounding Box */}
              <div
                onPointerDown={(e) => handlePointerDown(e, 'pan')}
                style={{
                  left: `${boxLeftPercent}%`,
                  top: `${boxTopPercent}%`,
                  width: `${boxWidthPercent}%`,
                  height: `${boxHeightPercent}%`,
                }}
                className={`absolute border-2 border-oled-cyan shadow-[0_0_12px_rgba(0,240,255,0.4)] cursor-grab active:cursor-grabbing ${
                  activeDrag?.type === 'pan' ? 'cursor-grabbing' : ''
                }`}
              >
                {/* Rule of Thirds Composition Grid */}
                <div className="w-full h-full grid grid-cols-3 grid-rows-3 pointer-events-none opacity-40">
                  <div className="border-r border-b border-cyan-400/50" />
                  <div className="border-r border-b border-cyan-400/50" />
                  <div className="border-b border-cyan-400/50" />
                  <div className="border-r border-b border-cyan-400/50" />
                  <div className="border-r border-b border-cyan-400/50" />
                  <div className="border-b border-cyan-400/50" />
                  <div className="border-r border-cyan-400/50" />
                  <div className="border-r border-cyan-400/50" />
                  <div />
                </div>

                {/* Corner Resize Handles */}
                <div
                  onPointerDown={(e) => handlePointerDown(e, 'nw')}
                  className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-oled-cyan border border-slate-900 rounded-sm cursor-nwse-resize shadow-md"
                />
                <div
                  onPointerDown={(e) => handlePointerDown(e, 'ne')}
                  className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-oled-cyan border border-slate-900 rounded-sm cursor-nesw-resize shadow-md"
                />
                <div
                  onPointerDown={(e) => handlePointerDown(e, 'se')}
                  className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-oled-cyan border border-slate-900 rounded-sm cursor-nwse-resize shadow-md"
                />
                <div
                  onPointerDown={(e) => handlePointerDown(e, 'sw')}
                  className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-oled-cyan border border-slate-900 rounded-sm cursor-nesw-resize shadow-md"
                />

                {/* Edge Resize Handles */}
                <div
                  onPointerDown={(e) => handlePointerDown(e, 'n')}
                  className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-2 bg-oled-cyan border border-slate-900 rounded-sm cursor-ns-resize"
                />
                <div
                  onPointerDown={(e) => handlePointerDown(e, 's')}
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-2 bg-oled-cyan border border-slate-900 rounded-sm cursor-ns-resize"
                />
                <div
                  onPointerDown={(e) => handlePointerDown(e, 'w')}
                  className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-4 bg-oled-cyan border border-slate-900 rounded-sm cursor-ew-resize"
                />
                <div
                  onPointerDown={(e) => handlePointerDown(e, 'e')}
                  className="absolute -right-1 top-1/2 -translate-y-1/2 w-2 h-4 bg-oled-cyan border border-slate-900 rounded-sm cursor-ew-resize"
                />
              </div>
            </>
          )}

          {/* Status badge when not in cover mode */}
          {!isCover && (
            <div className="absolute top-2 left-2 px-2 py-1 rounded bg-slate-900/80 border border-slate-700 text-[11px] font-mono text-cyan-400">
              Preset Mode: {cropSettings.mode.toUpperCase()} (Entire source scaled to 128×64)
            </div>
          )}
        </div>

        {/* Mini 128x64 Output Preview */}
        <div className="flex flex-col items-center justify-center p-3 bg-oled-panel border border-oled-border rounded-lg space-y-2 shrink-0">
          <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-oled-cyan" /> 128×64 Live Cropped
          </span>
          <div className="p-1.5 bg-black rounded border border-slate-800 shadow-inner flex items-center justify-center">
            <canvas
              ref={preview128x64CanvasRef}
              width={128}
              height={64}
              className="block w-[128px] h-[64px] rounded-sm"
              style={{
                imageRendering: cropSettings.smoothing ? 'auto' : 'pixelated',
              }}
            />
          </div>
          <span className="text-[10px] font-mono text-slate-500">Target OLED Resolution</span>
        </div>
      </div>

      {/* Footer Controls: Smoothing Toggle & Metrics */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-oled-border/60 text-xs text-slate-400 font-mono">
        <label className="flex items-center space-x-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={cropSettings.smoothing}
            onChange={handleToggleSmoothing}
            disabled={disabled}
            className="rounded border-oled-border bg-oled-panel text-cyan-500 focus:ring-0 cursor-pointer"
          />
          <span className={cropSettings.smoothing ? 'text-slate-200' : 'text-slate-400'}>
            Bicubic Smoothing (Lanczos/Bicubic)
          </span>
          <span className="text-[10px] text-slate-500 font-sans">
            (Uncheck for sharp pixel art / Aseprite)
          </span>
        </label>

        <div className="flex items-center space-x-3 text-[11px]">
          <span>
            Crop:{' '}
            <strong className="text-slate-200">
              {cropSettings.width} × {cropSettings.height} px
            </strong>
          </span>
          <span className="text-slate-600">|</span>
          <span>
            Source:{' '}
            <strong className="text-slate-400">
              {sourceWidth} × {sourceHeight} px
            </strong>
          </span>
          <span className="text-slate-600">|</span>
          <button
            type="button"
            onClick={handlePresetCover}
            className="text-oled-cyan hover:underline flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" /> Reset 2:1
          </button>
        </div>
      </div>
    </div>
  );
};
