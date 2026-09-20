import React, { useEffect, useRef, useState } from 'react';
import { TimelineClip, MediaAsset } from '../types/media';

const thumbCache = new Map<string, string[]>();

interface ClipBlockProps {
  clip: TimelineClip;
  asset: MediaAsset;
  onUpdateBounds: (id: string, inFrame: number, outFrame: number) => void;
  setNodeRef?: (node: HTMLElement | null) => void;
  style?: React.CSSProperties;
  dragHandleProps?: any; // only the drag-handle attributes
  isDragging?: boolean;
  zoomLevel?: number;
  isSelected?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

const CLIP_HEIGHT = 56;

export const ClipBlock: React.FC<ClipBlockProps> = ({
  clip,
  asset,
  onUpdateBounds,
  setNodeRef,
  style,
  dragHandleProps,
  isDragging,
  zoomLevel = 1,
  isSelected = false,
  onClick,
  onContextMenu,
}) => {
  const [thumbs, setThumbs] = useState<string[]>([]);
  const THUMB_PX = Math.round(48 * zoomLevel); // px per frame in the display

  // --- Thumbnail generation (cached per asset) ---
  useEffect(() => {
    if (thumbCache.has(asset.id)) {
      setThumbs(thumbCache.get(asset.id)!);
      return;
    }

    // Throttle: generate every Nth frame so we don't block the thread
    const sourceFrames = asset.media.frames;
    const total = sourceFrames.length;
    // We want a thumbnail every ~5 frames or at least 1
    const step = Math.max(1, Math.round(total / Math.min(total, 60)));

    const generateAsync = async () => {
      const srcW = asset.media.sourceInfo.sourceWidth;
      const srcH = asset.media.sourceInfo.sourceHeight;
      // Render thumbnails at 2x the displayed thumb width for sharpness
      const RENDER_W = 96;
      const RENDER_H = Math.round((RENDER_W * srcH) / srcW);

      const sourceCanvas = document.createElement('canvas');
      sourceCanvas.width = srcW;
      sourceCanvas.height = srcH;
      const sourceCtx = sourceCanvas.getContext('2d')!;

      const renderCanvas = document.createElement('canvas');
      renderCanvas.width = RENDER_W;
      renderCanvas.height = RENDER_H;
      const renderCtx = renderCanvas.getContext('2d')!;
      renderCtx.imageSmoothingEnabled = true;
      renderCtx.imageSmoothingQuality = 'high';

      const generated: string[] = new Array(total).fill('');

      for (let i = 0; i < total; i += step) {
        sourceCtx.putImageData(sourceFrames[i].imageData, 0, 0);
        renderCtx.clearRect(0, 0, RENDER_W, RENDER_H);
        renderCtx.drawImage(sourceCanvas, 0, 0, RENDER_W, RENDER_H);
        const url = renderCanvas.toDataURL('image/jpeg', 0.9);
        // Fill consecutive frames with the same thumb
        for (let j = i; j < Math.min(i + step, total); j++) {
          generated[j] = url;
        }
        // Yield to browser periodically
        if (i % (step * 10) === 0) {
          await new Promise(r => setTimeout(r, 0));
        }
      }

      thumbCache.set(asset.id, generated);
      setThumbs(generated);
    };

    generateAsync();
  }, [asset]);

  const frameCount = asset.media.frames.length;
  const activeFrames = clip.outFrame - clip.inFrame + 1;
  const clipWidth = activeFrames * THUMB_PX;

  // ---- Trim handle drag (left = in-point) ----
  const handleLeftDrag = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const origIn = clip.inFrame;
    const origOut = clip.outFrame;

    const onMove = (mv: MouseEvent) => {
      const dx = mv.clientX - startX;
      const frameDelta = Math.round(dx / THUMB_PX);
      const newIn = Math.max(0, Math.min(origIn + frameDelta, origOut - 1));
      onUpdateBounds(clip.id, newIn, origOut);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ---- Trim handle drag (right = out-point) ----
  const handleRightDrag = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const origIn = clip.inFrame;
    const origOut = clip.outFrame;

    const onMove = (mv: MouseEvent) => {
      const dx = mv.clientX - startX;
      const frameDelta = Math.round(dx / THUMB_PX);
      const newOut = Math.max(origIn + 1, Math.min(origOut + frameDelta, frameCount - 1));
      onUpdateBounds(clip.id, origIn, newOut);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const HANDLE_W = 8; // px

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, width: clipWidth, height: CLIP_HEIGHT }}
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={`relative bg-[#1A1A1A] shrink-0 select-none overflow-visible
        ${isSelected ? 'ring-2 ring-[#E85D2A] ring-inset' : 'ring-2 ring-transparent ring-inset'}
        ${isDragging ? 'opacity-50 z-50' : 'z-10'}
      `}
    >
      {/* Drag handle bar — sits at top, full width */}
      <div
        {...dragHandleProps}
        className="absolute top-0 left-0 right-0 h-4 cursor-grab active:cursor-grabbing z-20 flex items-center justify-center"
        style={{ background: 'rgba(26,26,26,0.7)' }}
        title="Drag to reorder"
      >
        <div className="w-8 h-[2px] rounded-full bg-white/40" />
      </div>

      {/* Thumbnail strip */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-0 bottom-0 flex"
          style={{ left: -(clip.inFrame * THUMB_PX) }}
        >
          {thumbs.map((url, i) => (
            <div
              key={i}
              className="flex-shrink-0 h-full"
              style={{ width: THUMB_PX }}
            >
              {url && (
                <img
                  src={url}
                  alt=""
                  draggable={false}
                  className="w-full h-full"
                  style={{ objectFit: 'cover', opacity: 0.75, display: 'block' }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Clip label */}
      <div className="absolute bottom-0 left-0 right-0 h-5 flex items-center px-2 pointer-events-none z-10"
        style={{ background: 'rgba(0,0,0,0.5)' }}>
        <span className="text-[8px] text-white/70 font-mono truncate tracking-wider">
          {asset.media.sourceInfo.filename} [{clip.inFrame}–{clip.outFrame}]
        </span>
      </div>

      {/* Left trim handle */}
      <div
        onMouseDown={handleLeftDrag}
        className="absolute top-0 bottom-0 z-30 flex items-center justify-center cursor-col-resize"
        style={{
          left: 0,
          width: HANDLE_W,
          background: '#E85D2A',
        }}
        title="Trim in-point"
      >
        <div className="w-px h-6 bg-white/80" />
      </div>

      {/* Right trim handle */}
      <div
        onMouseDown={handleRightDrag}
        className="absolute top-0 bottom-0 z-30 flex items-center justify-center cursor-col-resize"
        style={{
          right: 0,
          width: HANDLE_W,
          background: '#E85D2A',
        }}
        title="Trim out-point"
      >
        <div className="w-px h-6 bg-white/80" />
      </div>
    </div>
  );
};
