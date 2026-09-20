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
  // Normally: trimmed width. During drag: full asset width.
  const isActiveDrag = trimDrag !== null;
  const activeIn  = trimDrag?.previewIn  ?? clip.inFrame;
  const activeOut = trimDrag?.previewOut ?? clip.outFrame;

  const clipWidth = isActiveDrag
    ? frameCount * thumbPx          // expand to full during drag/fade
    : (clip.outFrame - clip.inFrame + 1) * thumbPx; // normal trimmed width

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
    };
    const onUp = (upEv: MouseEvent) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      // Commit to parent immediately
      onUpdateBounds(clip.id, latestIn, origOut);
      // Start ghost fade
      setTrimDrag({ side: 'left', previewIn: latestIn, previewOut: origOut, fading: true });
      setTimeout(() => setTrimDrag(null), GHOST_FADE_MS);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [clip.inFrame, clip.outFrame, clip.id, thumbPx, onUpdateBounds]);

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
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      onUpdateBounds(clip.id, origIn, latestOut);
      setTrimDrag({ side: 'right', previewIn: origIn, previewOut: latestOut, fading: true });
      setTimeout(() => setTrimDrag(null), GHOST_FADE_MS);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [clip.inFrame, clip.outFrame, clip.id, thumbPx, onUpdateBounds, frameCount]);

  // ---- Thumbnail slots ----
  // Compute slots over the FULL asset duration so ghost regions show frames during trim.
  const SLOT_W = 48; // px
  const fullWidth = frameCount * thumbPx;
  const numSlots = Math.max(1, Math.ceil(fullWidth / SLOT_W));
  const thumbSlots: { src: string; slotWidth: number }[] = [];

  if (thumbs.length > 0) {
    for (let s = 0; s < numSlots; s++) {
      const ratio = numSlots === 1 ? 0.5 : s / (numSlots - 1);
      const frameIdx = Math.round(ratio * (frameCount - 1));
      const safeSrc = thumbs[Math.min(frameIdx, thumbs.length - 1)] ?? '';
      const slotWidth = fullWidth / numSlots;
      thumbSlots.push({ src: safeSrc, slotWidth });
    }
  }

  // Ghost opacity: full while dragging, fades to 0 on release
  const ghostOpacity = trimDrag?.fading ? 0 : 0.75;

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, width: clipWidth, height: CLIP_HEIGHT, flexShrink: 0, position: 'relative' }}
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={`select-none ${isDragging ? 'opacity-40 z-50' : 'z-10'}`}
    >
      {/* ---- Full thumbnail strip ---- */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none bg-[#1A1A1A]">
        {/* Solid color fallback (always visible behind thumbs) */}
        <div className="absolute inset-0" style={{ background: '#1e3040' }} />

        {/* Thumbnail strip — represents the FULL asset */}
        {thumbSlots.length > 0 && (
          <div
            className="absolute top-0 bottom-0 flex"
            style={{ 
              left: isActiveDrag ? 0 : -clip.inFrame * thumbPx,
              width: fullWidth 
            }}
          >
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
                      // Always render the image at SLOT_W wide so it's never squished.
                      // The parent div clips it to slotWidth.
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

      {/* ---- Ghost: left gray (frames 0 → activeIn-1) ---- */}
      {isActiveDrag && activeIn > 0 && (
        <div
          className="absolute top-0 bottom-0 pointer-events-none z-10"
          style={{
            left: 0,
            width: activeIn * thumbPx,
            background: 'rgba(10,10,10,0.8)',
            backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 5px, rgba(255,255,255,0.04) 5px, rgba(255,255,255,0.04) 7px)',
            opacity: ghostOpacity,
            transition: `opacity ${GHOST_FADE_MS}ms ease-out`,
          }}
        />
      )}

      {/* ---- Ghost: right gray (frames activeOut+1 → end) ---- */}
      {isActiveDrag && activeOut < frameCount - 1 && (
        <div
          className="absolute top-0 bottom-0 pointer-events-none z-10"
          style={{
            left: (activeOut + 1) * thumbPx,
            right: 0,
            background: 'rgba(10,10,10,0.8)',
            backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 5px, rgba(255,255,255,0.04) 5px, rgba(255,255,255,0.04) 7px)',
            opacity: ghostOpacity,
            transition: `opacity ${GHOST_FADE_MS}ms ease-out`,
          }}
        />
      )}

      {/* ---- Active region border ---- */}
      {isActiveDrag && (
        <div
          className="absolute top-0 bottom-0 pointer-events-none z-20"
          style={{
            left: activeIn * thumbPx,
            width: (activeOut - activeIn + 1) * thumbPx,
            boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.25)',
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
          {isActiveDrag && !trimDrag?.fading && (
            <span className="text-[#E85D2A] ml-1">[{activeIn}–{activeOut}]</span>
          )}
        </span>
      </div>

      {/* ---- Left trim handle ---- */}
      <div
        onMouseDown={handleLeftDrag}
        className="absolute top-0 bottom-0 z-30 flex items-center justify-center cursor-col-resize hover:brightness-110 group transition-colors"
        style={{
          left: isActiveDrag ? activeIn * thumbPx : 0,
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
        className="absolute top-0 bottom-0 z-30 flex items-center justify-center cursor-col-resize hover:brightness-110 group transition-colors"
        style={{
          left: isActiveDrag
            ? (activeOut + 1) * thumbPx - HANDLE_W
            : clipWidth - HANDLE_W,
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
