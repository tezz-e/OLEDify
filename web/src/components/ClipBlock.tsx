import React, { useEffect, useRef, useState, useCallback } from 'react';
import { TimelineClip, MediaAsset } from '../types/media';

// ---------- Cache ----------
const thumbCache = new Map<string, string[]>();

// ---------- Constants ----------
export const CLIP_HEIGHT = 56;
const HANDLE_W = 16;
const GHOST_FADE_MS = 280;

interface ClipBlockProps {
  clip: TimelineClip;
  asset: MediaAsset;
  onUpdateBounds: (id: string, inFrame: number, outFrame: number) => void;
  setNodeRef?: (node: HTMLElement | null) => void;
  style?: React.CSSProperties;
  dragHandleProps?: any;
  isDragging?: boolean;
  thumbPx: number;
  isSelected?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onPreviewAssetFrame?: (assetId: string | null, frameIndex?: number) => void;
}

type TrimDrag = {
  side: 'left' | 'right';
  previewIn: number;
  previewOut: number;
  fading: boolean; // true = released, fading out
};

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
  onPreviewAssetFrame,
}) => {
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [trimDrag, setTrimDrag] = useState<TrimDrag | null>(null);
  const sparkRef = useRef<{ trigger: (x: number, y: number) => void } | null>(null);

  // ---- Thumbnail generation ----
  useEffect(() => {
    if (thumbCache.has(asset.id)) {
      setThumbs(thumbCache.get(asset.id)!);
      return;
    }
    const sourceFrames = asset.media.frames;
    const total = sourceFrames.length;
    // Sample every ~step frames — aim for ~60 unique thumbnails max
    const step = Math.max(1, Math.ceil(total / 60));
    const srcW = asset.media.sourceInfo.sourceWidth;
    const srcH = asset.media.sourceInfo.sourceHeight;
    const RW = 128, RH = Math.round((128 * srcH) / srcW);

    const src = document.createElement('canvas');
    src.width = srcW; src.height = srcH;
    const sCtx = src.getContext('2d')!;
    const dst = document.createElement('canvas');
    dst.width = RW; dst.height = RH;
    const dCtx = dst.getContext('2d')!;
    dCtx.imageSmoothingEnabled = true;
    dCtx.imageSmoothingQuality = 'high';

    const generated: string[] = new Array(total).fill('');
    let i = 0;

    const batch = () => {
      const end = Math.min(i + step * 8, total);
      for (; i < end; i += step) {
        sCtx.putImageData(sourceFrames[i].imageData, 0, 0);
        dCtx.clearRect(0, 0, RW, RH);
        dCtx.drawImage(src, 0, 0, RW, RH);
        const url = dst.toDataURL('image/jpeg', 0.85);
        for (let j = i; j < Math.min(i + step, total); j++) generated[j] = url;
      }
      if (i < total) setTimeout(batch, 0);
      else { thumbCache.set(asset.id, generated); setThumbs([...generated]); }
    };
    batch();
  }, [asset]);

  const frameCount = asset.media.frames.length;

  // ---- Layout ----
  const isActiveDrag = trimDrag !== null;
  const activeIn  = trimDrag?.previewIn  ?? clip.inFrame;
  const activeOut = trimDrag?.previewOut ?? clip.outFrame;

  const clipWidth = (activeOut - activeIn + 1) * thumbPx; // active trimmed width

  // ---- Left trim ----
  const handleLeftDrag = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    const startX = e.clientX;
    const origIn = clip.inFrame, origOut = clip.outFrame;
    let latestIn = origIn;

    setTrimDrag({ side: 'left', previewIn: origIn, previewOut: origOut, fading: false });

    const onMove = (mv: MouseEvent) => {
      const dx = mv.clientX - startX;
      latestIn = Math.max(0, Math.min(origIn + Math.round(dx / thumbPx), origOut - 1));
      setTrimDrag({ side: 'left', previewIn: latestIn, previewOut: origOut, fading: false });
      if (onPreviewAssetFrame) onPreviewAssetFrame(asset.id, latestIn);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      onUpdateBounds(clip.id, latestIn, origOut);
      if (onPreviewAssetFrame) onPreviewAssetFrame(null);
      setTrimDrag(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [clip.inFrame, clip.outFrame, clip.id, thumbPx, onUpdateBounds, onPreviewAssetFrame, asset.id]);

  // ---- Right trim ----
  const handleRightDrag = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    const startX = e.clientX;
    const origIn = clip.inFrame, origOut = clip.outFrame;
    let latestOut = origOut;

    setTrimDrag({ side: 'right', previewIn: origIn, previewOut: origOut, fading: false });

    const onMove = (mv: MouseEvent) => {
      const dx = mv.clientX - startX;
      latestOut = Math.max(origIn + 1, Math.min(origOut + Math.round(dx / thumbPx), frameCount - 1));
      setTrimDrag({ side: 'right', previewIn: origIn, previewOut: latestOut, fading: false });
      if (onPreviewAssetFrame) onPreviewAssetFrame(asset.id, latestOut);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      onUpdateBounds(clip.id, origIn, latestOut);
      if (onPreviewAssetFrame) onPreviewAssetFrame(null);
      setTrimDrag(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [clip.inFrame, clip.outFrame, clip.id, thumbPx, onUpdateBounds, frameCount, onPreviewAssetFrame, asset.id]);

  // ---- Thumbnail slots ----
  const SLOT_W = 48; // px
  const numSlots = Math.max(1, Math.ceil(clipWidth / SLOT_W));
  const thumbSlots: { src: string; slotWidth: number }[] = [];

  if (thumbs.length > 0) {
    for (let s = 0; s < numSlots; s++) {
      const ratio = numSlots === 1 ? 0.5 : s / (numSlots - 1);
      const frameIdx = Math.round(activeIn + ratio * (activeOut - activeIn));
      const safeSrc = thumbs[Math.min(frameIdx, thumbs.length - 1)] ?? '';
      const slotWidth = clipWidth / numSlots;
      thumbSlots.push({ src: safeSrc, slotWidth });
    }
  }

  return (
    <div
      ref={setNodeRef}
      data-clip-id={clip.id}
      style={{ ...style, width: clipWidth, height: CLIP_HEIGHT, flexShrink: 0, position: 'relative' }}
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={`select-none overflow-hidden rounded border border-white/10 ${isDragging ? 'opacity-40 z-50' : 'z-10'}`}
    >
      {/* ---- Full thumbnail strip ---- */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none bg-[#1A1A1A]">
        {/* Solid color fallback (always visible behind thumbs) */}
        <div className="absolute inset-0" style={{ background: '#1e3040' }} />

        {/* Thumbnail strip */}
        {thumbSlots.length > 0 && (
          <div className="absolute inset-0 flex">
            {thumbSlots.map(({ src, slotWidth }, i) => (
              <div
                key={i}
                className="flex-shrink-0 h-full overflow-hidden"
                style={{ width: slotWidth }}
              >
                {src && (
                  <img
                    src={src}
                    alt=""
                    draggable={false}
                    style={{
                      width: SLOT_W,
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                      opacity: 0.85,
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---- Active region border during trim ---- */}
      {isActiveDrag && (
        <div
          className="absolute inset-0 pointer-events-none z-20"
          style={{
            boxShadow: 'inset 0 0 0 2px #E85D2A',
          }}
        />
      )}

      {/* ---- Selected border (always) ---- */}
      {isSelected && (
        <div
          className="absolute inset-0 pointer-events-none z-20"
          style={{ boxShadow: 'inset 0 0 0 2px #E85D2A' }}
        />
      )}

      {/* ---- Drag handle ---- */}
      <div
        {...dragHandleProps}
        className="absolute top-0 left-0 right-0 flex items-center justify-center cursor-grab active:cursor-grabbing z-30"
        style={{ height: 12, background: 'rgba(0,0,0,0.45)' }}
        title="Drag to reorder"
      >
        <div className="w-8 h-[2px] rounded-full bg-white/35" />
      </div>

      {/* ---- Clip label ---- */}
      <div
        className="absolute bottom-0 left-0 right-0 flex items-center px-2 pointer-events-none z-20 overflow-hidden"
        style={{ height: 16, background: 'rgba(0,0,0,0.5)' }}
      >
        <span className="text-[7px] text-white/60 font-mono truncate tracking-wide">
          {asset.media.sourceInfo.filename}
          {isActiveDrag && (
            <span className="text-[#E85D2A] ml-1">[{activeIn}–{activeOut}]</span>
          )}
        </span>
      </div>

      {/* ---- Left trim handle ---- */}
      <div
        onMouseDown={handleLeftDrag}
        className="absolute top-0 bottom-0 left-0 z-30 flex items-center justify-center cursor-col-resize hover:brightness-110 group transition-colors"
        style={{
          width: HANDLE_W,
          background: '#E85D2A',
        }}
        title="Trim in-point"
      >
        <div className="w-[3px] h-6 bg-white/90 rounded-full group-hover:bg-white group-active:scale-y-110 transition-transform" />
      </div>

      {/* ---- Right trim handle ---- */}
      <div
        onMouseDown={handleRightDrag}
        className="absolute top-0 bottom-0 right-0 z-30 flex items-center justify-center cursor-col-resize hover:brightness-110 group transition-colors"
        style={{
          width: HANDLE_W,
          background: '#E85D2A',
        }}
        title="Trim out-point"
      >
        <div className="w-[3px] h-6 bg-white/90 rounded-full group-hover:bg-white group-active:scale-y-110 transition-transform" />
      </div>
    </div>
  );
};
