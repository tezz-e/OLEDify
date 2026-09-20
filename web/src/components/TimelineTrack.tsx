import React, { useMemo, useRef, useEffect, useCallback, useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TimelineClip, MediaAsset } from '../types/media';
import { ClipBlock } from './ClipBlock';
import { ContextMenu } from './ContextMenu';

// ---- Constants ----
const THUMB_BASE = 16;  // px per frame at zoomLevel=1. Keep small so default view shows many frames.
const RULER_H = 28;
const TRACK_H = 56;     // must match ClipBlock CLIP_HEIGHT

interface TimelineTrackProps {
  clips: TimelineClip[];
  assets: Record<string, MediaAsset>;
  onClipsChange: (clips: TimelineClip[]) => void;
  activeGlobalFrame: number;
  onFrameSelect: (globalIndex: number) => void;
  zoomLevel: number;
  onZoomChange: (zoom: number) => void;
  selectedClipIds: string[];
  onSelectClips: (ids: string[]) => void;
}

export const TimelineTrack: React.FC<TimelineTrackProps> = ({
  clips,
  assets,
  onClipsChange,
  activeGlobalFrame,
  onFrameSelect,
  zoomLevel,
  onZoomChange,
  selectedClipIds,
  onSelectClips,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; clipId: string } | null>(null);

  const thumbPx = THUMB_BASE * zoomLevel; // actual px per frame

  // ---- Total timeline frames (sum of active frames per clip) ----
  const totalActiveFrames = useMemo(
    () => clips.reduce((acc, c) => acc + (c.outFrame - c.inFrame + 1), 0),
    [clips]
  );

  // Content width uses FULL asset duration (Premiere style — clips show full width)
  const contentWidth = useMemo(() => {
    return clips.reduce((acc, c) => {
      const asset = assets[c.assetId];
      if (!asset) return acc;
      return acc + asset.media.frames.length * thumbPx;
    }, 0);
  }, [clips, assets, thumbPx]);

  // ---- Playhead pixel position ----
  // activeGlobalFrame is a 0-based index into the active (trimmed) frame sequence.
  // We need to map it back to a pixel position in the FULL-width layout.
  const playheadPx = useMemo(() => {
    let globalIdx = 0;
    let px = 0;
    for (const clip of clips) {
      const asset = assets[clip.assetId];
      if (!asset) continue;
      const assetFullPx = asset.media.frames.length * thumbPx;
      const activeLen = clip.outFrame - clip.inFrame + 1;

      if (activeGlobalFrame < globalIdx + activeLen) {
        // The playhead is within this clip
        const localActive = activeGlobalFrame - globalIdx;
        // position = start of clip's px region + in-point offset + local offset
        px += clip.inFrame * thumbPx + localActive * thumbPx;
        return px;
      }
      globalIdx += activeLen;
      px += assetFullPx;
    }
    return px; // past all clips
  }, [activeGlobalFrame, clips, assets, thumbPx]);

  // ---- Ctrl+Scroll to zoom ----
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const factor = e.deltaY > 0 ? -0.2 : 0.2;
        onZoomChange(Math.max(0.1, Math.min(zoomLevel + factor, 8)));
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomLevel, onZoomChange]);

  // ---- Ruler scrubbing ----
  const isScrubbing = useRef(false);

  const scrubAt = useCallback((clientX: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = clientX - rect.left + el.scrollLeft;

    // Map pixel position back to global active frame index
    let globalIdx = 0;
    let accumulated = 0;
    for (const clip of clips) {
      const asset = assets[clip.assetId];
      if (!asset) continue;
      const fullPx = asset.media.frames.length * thumbPx;
      const inPx = clip.inFrame * thumbPx;
      const outPx = (clip.outFrame + 1) * thumbPx;

      if (px >= accumulated && px < accumulated + fullPx) {
        // inside this clip's region
        const localPx = px - accumulated;
        if (localPx >= inPx && localPx < outPx) {
          // inside active region
          const localActive = Math.floor((localPx - inPx) / thumbPx);
          onFrameSelect(Math.min(globalIdx + localActive, totalActiveFrames - 1));
        } else if (localPx < inPx) {
          onFrameSelect(globalIdx);
        } else {
          onFrameSelect(globalIdx + (clip.outFrame - clip.inFrame));
        }
        return;
      }
      globalIdx += clip.outFrame - clip.inFrame + 1;
      accumulated += fullPx;
    }
    // clicked past all clips
    onFrameSelect(Math.max(0, totalActiveFrames - 1));
  }, [clips, assets, thumbPx, totalActiveFrames, onFrameSelect]);

  const handleRulerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isScrubbing.current = true;
    scrubAt(e.clientX);
    const onMove = (mv: MouseEvent) => { if (isScrubbing.current) scrubAt(mv.clientX); };
    const onUp = () => {
      isScrubbing.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ---- DnD reorder ----
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIdx = clips.findIndex(c => c.id === active.id);
      const newIdx = clips.findIndex(c => c.id === over.id);
      onClipsChange(arrayMove(clips, oldIdx, newIdx));
    }
  };

  const handleUpdateBounds = (id: string, inFrame: number, outFrame: number) => {
    onClipsChange(clips.map(c => c.id === id ? { ...c, inFrame, outFrame } : c));
  };

  // ---- Ruler ticks ----
  // We build ticks over the full content width at an interval that looks good at current zoom
  const rulerTicks = useMemo(() => {
    const minTickPx = 60; // minimum px between labeled ticks
    const framesPerTick = Math.max(1, Math.ceil(minTickPx / thumbPx));
    // Snap to nice intervals
    const nice = [1,2,5,10,15,20,25,30,60,90,120,150,300,600];
    const interval = nice.find(n => n >= framesPerTick) ?? framesPerTick;

    const ticks: { frame: number; px: number }[] = [];
    // Walk through clips building cumulative pixel offset
    let px = 0;
    let globalFrame = 0;
    for (const clip of clips) {
      const asset = assets[clip.assetId];
      if (!asset) continue;
      const assetFrames = asset.media.frames.length;
      // Snap first tick to nearest interval boundary
      const firstTick = Math.ceil(0 / interval) * interval;
      for (let f = firstTick; f < assetFrames; f += interval) {
        ticks.push({ frame: globalFrame + (f - clip.inFrame), px: px + f * thumbPx });
      }
      globalFrame += clip.outFrame - clip.inFrame + 1;
      px += assetFrames * thumbPx;
    }
    return ticks;
  }, [clips, assets, thumbPx]);

  // ---- Zoom controls ----
  const zoom = (factor: number) => {
    onZoomChange(Math.max(0.1, Math.min(zoomLevel * factor, 8)));
  };
  const zoomPct = Math.round(zoomLevel * 100);

  if (clips.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#F5F0EB]">
        <span className="text-[10px] font-mono uppercase tracking-widest text-[#6B6B6B]">Drop media to get started</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[#F5F0EB]">

      {/* ---- Header with clip info + zoom controls ---- */}
      <div className="px-4 py-1.5 border-b border-[#1A1A1A]/20 flex items-center justify-between shrink-0 bg-[#F5F0EB] gap-4">
        <span className="text-[9px] font-mono font-bold tracking-widest text-[#1A1A1A] uppercase">
          {totalActiveFrames} active frames
        </span>

        {/* Zoom controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => zoom(0.5)}
            className="w-6 h-6 flex items-center justify-center border border-[#1A1A1A] bg-white hover:bg-[#1A1A1A] hover:text-white text-[#1A1A1A] font-mono text-xs font-bold transition-colors"
            title="Zoom out (Ctrl+Scroll)"
          >−</button>
          <span className="text-[9px] font-mono text-[#6B6B6B] w-10 text-center tabular-nums">{zoomPct}%</span>
          <button
            onClick={() => zoom(2)}
            className="w-6 h-6 flex items-center justify-center border border-[#1A1A1A] bg-white hover:bg-[#1A1A1A] hover:text-white text-[#1A1A1A] font-mono text-xs font-bold transition-colors"
            title="Zoom in (Ctrl+Scroll)"
          >+</button>
          <button
            onClick={() => onZoomChange(1)}
            className="h-6 px-2 flex items-center justify-center border border-[#1A1A1A] bg-white hover:bg-[#1A1A1A] hover:text-white text-[#1A1A1A] font-mono text-[8px] font-bold transition-colors tracking-widest"
            title="Reset zoom"
          >FIT</button>
        </div>
      </div>

      {/* ---- Scrollable track area ---- */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-x-auto overflow-y-hidden relative"
        style={{ minHeight: RULER_H + TRACK_H + 4 }}
      >
        <div
          className="relative"
          style={{ width: Math.max(contentWidth, 200), height: RULER_H + TRACK_H + 4 }}
        >

          {/* RULER */}
          <div
            className="absolute top-0 left-0 right-0 select-none cursor-crosshair"
            style={{
              height: RULER_H,
              background: '#EDEAE5',
              borderBottom: '1px solid rgba(26,26,26,0.2)',
            }}
            onMouseDown={handleRulerMouseDown}
          >
            {rulerTicks.map(({ frame, px }) => (
              <div
                key={px}
                className="absolute bottom-0"
                style={{ left: px }}
              >
                <div style={{ width: 1, height: 8, background: 'rgba(26,26,26,0.4)' }} />
                <span
                  className="absolute text-[7px] font-mono text-[#6B6B6B] select-none pointer-events-none"
                  style={{ bottom: 10, left: 2, whiteSpace: 'nowrap' }}
                >
                  {frame}
                </span>
              </div>
            ))}

            {/* Playhead triangle on ruler */}
            <div
              className="absolute top-0 pointer-events-none z-20"
              style={{ left: playheadPx, transform: 'translateX(-5px)' }}
            >
              <div style={{
                width: 0, height: 0,
                borderLeft: '5px solid transparent',
                borderRight: '5px solid transparent',
                borderTop: `${RULER_H * 0.5}px solid #E85D2A`,
              }} />
            </div>
          </div>

          {/* CLIP TRACK */}
          <div
            className="absolute left-0"
            style={{ top: RULER_H + 2, height: TRACK_H }}
          >
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={clips.map(c => c.id)} strategy={horizontalListSortingStrategy}>
                <div className="flex h-full" style={{ gap: 2 }}>
                  {clips.map(clip => {
                    const asset = assets[clip.assetId];
                    if (!asset) return null;
                    return (
                      <SortableClipWrapper
                        key={clip.id}
                        clip={clip}
                        asset={asset}
                        onUpdateBounds={handleUpdateBounds}
                        thumbPx={thumbPx}
                        isSelected={selectedClipIds.includes(clip.id)}
                        onSelect={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          if (e.shiftKey) {
                            onSelectClips([...new Set([...selectedClipIds, clip.id])]);
                          } else {
                            onSelectClips([clip.id]);
                          }
                        }}
                        onContextMenu={(e: React.MouseEvent) => {
                          e.preventDefault();
                          onSelectClips([clip.id]);
                          setContextMenu({ x: e.clientX, y: e.clientY, clipId: clip.id });
                        }}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          {/* PLAYHEAD line — spans ruler + track */}
          <div
            className="absolute top-0 pointer-events-none z-50"
            style={{
              left: playheadPx,
              width: 1,
              height: RULER_H + TRACK_H + 4,
              background: '#E85D2A',
              boxShadow: '0 0 3px rgba(232,93,42,0.5)',
            }}
          />

        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          clipId={contextMenu.clipId}
          clips={clips}
          onClipsChange={onClipsChange}
        />
      )}
    </div>
  );
};

// ---- Sortable wrapper ----
const SortableClipWrapper = ({
  clip, asset, onUpdateBounds, thumbPx, isSelected, onSelect, onContextMenu,
}: any) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: clip.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <ClipBlock
      clip={clip}
      asset={asset}
      onUpdateBounds={onUpdateBounds}
      setNodeRef={setNodeRef}
      style={style}
      dragHandleProps={{ ...attributes, ...listeners }}
      isDragging={isDragging}
      thumbPx={thumbPx}
      isSelected={isSelected}
      onClick={onSelect}
      onContextMenu={onContextMenu}
    />
  );
};
