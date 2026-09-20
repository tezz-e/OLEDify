import React, { useEffect, useRef, useState, useCallback } from 'react';
import { TimelineClip, MediaAsset } from '../types/media';

// ---------- Thumbnail cache ----------
const thumbCache = new Map<string, string[]>();

// ---------- Constants ----------
const CLIP_HEIGHT = 56; // px, must match TimelineTrack TRACK_H
const HANDLE_W = 8;     // px for trim handle width

// ---------- Types ----------
interface ClipBlockProps {
  clip: TimelineClip;
  asset: MediaAsset;
  onUpdateBounds: (id: string, inFrame: number, outFrame: number) => void;
  setNodeRef?: (node: HTMLElement | null) => void;
  style?: React.CSSProperties;
  dragHandleProps?: any;
  isDragging?: boolean;
  thumbPx: number; // px per frame — passed in so parent controls zoom
  isSelected?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

// ---------- ClipBlock ----------
export const ClipBlock: React.FC<ClipBlockProps> = ({
  clip,
  asset,
  onUpdateBounds,
  setNodeRef,
  style,
  dragHandleProps,
  isDragging,
  thumbPx,
  isSelected = false,
  onClick,
  onContextMenu,
}) => {
  const [thumbs, setThumbs] = useState<string[]>([]);

  // Live preview while dragging trim handles (Premiere-style ghost)
  const [trimPreview, setTrimPreview] = useState<{
    side: 'left' | 'right';
    previewIn: number;
    previewOut: number;
  } | null>(null);

  const isTrimming = trimPreview !== null;

  // ---------- Thumbnail generation ----------
  useEffect(() => {
    if (thumbCache.has(asset.id)) {
      setThumbs(thumbCache.get(asset.id)!);
      return;
    }
    const sourceFrames = asset.media.frames;
    const total = sourceFrames.length;
    // Generate a thumb every ~5 frames to avoid freezing
    const step = Math.max(1, Math.round(total / Math.min(total, 80)));

    const srcW = asset.media.sourceInfo.sourceWidth;
    const srcH = asset.media.sourceInfo.sourceHeight;
    const RENDER_W = 128;
    const RENDER_H = Math.round((RENDER_W * srcH) / srcW);

    const src = document.createElement('canvas');
    src.width = srcW; src.height = srcH;
    const srcCtx = src.getContext('2d')!;

    const dst = document.createElement('canvas');
    dst.width = RENDER_W; dst.height = RENDER_H;
    const dstCtx = dst.getContext('2d')!;
    dstCtx.imageSmoothingEnabled = true;
    dstCtx.imageSmoothingQuality = 'high';

    const generated: string[] = new Array(total).fill('');
    let i = 0;

    const runBatch = () => {
      const end = Math.min(i + step * 5, total);
      for (; i < end; i += step) {
        srcCtx.putImageData(sourceFrames[i].imageData, 0, 0);
        dstCtx.clearRect(0, 0, RENDER_W, RENDER_H);
        dstCtx.drawImage(src, 0, 0, RENDER_W, RENDER_H);
        const url = dst.toDataURL('image/jpeg', 0.85);
        for (let j = i; j < Math.min(i + step, total); j++) {
          generated[j] = url;
        }
      }
      if (i < total) {
        setTimeout(runBatch, 0);
      } else {
        thumbCache.set(asset.id, generated);
        setThumbs([...generated]);
      }
    };
    runBatch();
  }, [asset]);

  // ---------- Derived values ----------
  const frameCount = asset.media.frames.length;

  // The clip ALWAYS occupies its FULL asset width visually (Premiere style).
  // Trimmed regions are shown with a gray hatched overlay.
  const fullWidth = frameCount * thumbPx;
  const displayIn = trimPreview?.previewIn ?? clip.inFrame;
  const displayOut = trimPreview?.previewOut ?? clip.outFrame;

  // ---------- Left trim drag ----------
  const handleLeftDrag = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const origIn = clip.inFrame;
    const origOut = clip.outFrame;

    let latestIn = origIn;

    setTrimPreview({ side: 'left', previewIn: origIn, previewOut: origOut });

    const onMove = (mv: MouseEvent) => {
      const dx = mv.clientX - startX;
      const frameDelta = Math.round(dx / thumbPx);
      latestIn = Math.max(0, Math.min(origIn + frameDelta, origOut - 1));
      setTrimPreview({ side: 'left', previewIn: latestIn, previewOut: origOut });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setTrimPreview(null);
      onUpdateBounds(clip.id, latestIn, origOut);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [clip.inFrame, clip.outFrame, clip.id, thumbPx, onUpdateBounds]);

  // ---------- Right trim drag ----------
  const handleRightDrag = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const origIn = clip.inFrame;
    const origOut = clip.outFrame;

    let latestOut = origOut;

    setTrimPreview({ side: 'right', previewIn: origIn, previewOut: origOut });

    const onMove = (mv: MouseEvent) => {
      const dx = mv.clientX - startX;
      const frameDelta = Math.round(dx / thumbPx);
      latestOut = Math.max(origIn + 1, Math.min(origOut + frameDelta, frameCount - 1));
      setTrimPreview({ side: 'right', previewIn: origIn, previewOut: latestOut });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setTrimPreview(null);
      onUpdateBounds(clip.id, origIn, latestOut);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [clip.inFrame, clip.outFrame, clip.id, thumbPx, onUpdateBounds, frameCount]);

  // ---------- Render ----------
  return (
    <div
      ref={setNodeRef}
      style={{ ...style, width: fullWidth, height: CLIP_HEIGHT, flexShrink: 0 }}
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={`relative select-none ${isDragging ? 'opacity-50 z-50' : 'z-10'}`}
    >
      {/* ---- Background: full thumbnail strip ---- */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none bg-[#1A1A1A]">
        <div className="absolute top-0 bottom-0 flex" style={{ left: 0 }}>
          {thumbs.map((url, i) => (
            <div
              key={i}
              className="flex-shrink-0 h-full"
              style={{ width: thumbPx }}
            >
              {url && (
                <img
                  src={url}
                  alt=""
                  draggable={false}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: 0.8 }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ---- Gray overlay: trimmed from LEFT (frames 0..displayIn-1) ---- */}
      {displayIn > 0 && (
        <div
          className="absolute top-0 bottom-0 pointer-events-none z-10"
          style={{
            left: 0,
            width: displayIn * thumbPx,
            background: 'rgba(26,26,26,0.72)',
            backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.06) 4px, rgba(255,255,255,0.06) 6px)',
          }}
        />
      )}

      {/* ---- Gray overlay: trimmed from RIGHT (frames displayOut+1..end) ---- */}
      {displayOut < frameCount - 1 && (
        <div
          className="absolute top-0 bottom-0 pointer-events-none z-10"
          style={{
            left: (displayOut + 1) * thumbPx,
            right: 0,
            background: 'rgba(26,26,26,0.72)',
            backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.06) 4px, rgba(255,255,255,0.06) 6px)',
          }}
        />
      )}

      {/* ---- Active region border highlight ---- */}
      <div
        className="absolute top-0 bottom-0 pointer-events-none z-20"
        style={{
          left: displayIn * thumbPx,
          width: (displayOut - displayIn + 1) * thumbPx,
          outline: `2px solid ${isSelected ? '#E85D2A' : 'rgba(255,255,255,0.25)'}`,
          outlineOffset: '-2px',
        }}
      />

      {/* ---- Drag handle bar (top center of active region) ---- */}
      <div
        {...dragHandleProps}
        className="absolute top-0 flex items-center justify-center cursor-grab active:cursor-grabbing z-30"
        style={{
          left: displayIn * thumbPx,
          width: (displayOut - displayIn + 1) * thumbPx,
          height: 12,
          background: 'rgba(0,0,0,0.5)',
        }}
        title="Drag to reorder"
      >
        <div className="w-8 h-[2px] rounded-full bg-white/40" />
      </div>

      {/* ---- Clip label (bottom of active region) ---- */}
      <div
        className="absolute bottom-0 flex items-center px-2 pointer-events-none z-20 overflow-hidden"
        style={{
          left: displayIn * thumbPx,
          width: (displayOut - displayIn + 1) * thumbPx,
          height: 16,
          background: 'rgba(0,0,0,0.55)',
        }}
      >
        <span className="text-[7px] text-white/60 font-mono truncate tracking-wide">
          {asset.media.sourceInfo.filename}
          {isTrimming && (
            <span className="text-[#E85D2A] ml-1">
              [{displayIn}–{displayOut}]
            </span>
          )}
        </span>
      </div>

      {/* ---- Left trim handle (at in-point) ---- */}
      <div
        onMouseDown={handleLeftDrag}
        className="absolute top-0 bottom-0 z-30 flex items-center justify-center cursor-col-resize hover:brightness-110 transition-all"
        style={{
          left: displayIn * thumbPx,
          width: HANDLE_W,
          background: '#E85D2A',
        }}
        title="Trim in-point"
      >
        <div className="w-px h-6 bg-white/80" />
      </div>

      {/* ---- Right trim handle (at out-point) ---- */}
      <div
        onMouseDown={handleRightDrag}
        className="absolute top-0 bottom-0 z-30 flex items-center justify-center cursor-col-resize hover:brightness-110 transition-all"
        style={{
          left: (displayOut + 1) * thumbPx - HANDLE_W,
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
