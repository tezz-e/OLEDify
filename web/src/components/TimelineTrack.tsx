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

const THUMB_BASE = 48; // base px per frame at zoom=1
const RULER_H = 24;    // px
const TRACK_H = 56;    // px — must match ClipBlock CLIP_HEIGHT

interface TimelineTrackProps {
  clips: TimelineClip[];
  assets: Record<string, MediaAsset>;
  onClipsChange: (clips: TimelineClip[]) => void;
  /** Global timeline frame index (0-based across all clips) */
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

  const THUMB_PX = THUMB_BASE * zoomLevel;

  // Total visible frames across all clips
  const totalFrames = useMemo(
    () => clips.reduce((acc, c) => acc + (c.outFrame - c.inFrame + 1), 0),
    [clips]
  );

  // Pixel offset of the playhead on the timeline content area
  const playheadPx = useMemo(() => {
    return activeGlobalFrame * THUMB_PX;
  }, [activeGlobalFrame, THUMB_PX]);

  // --- Ctrl+Scroll to zoom ---
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.15 : 0.15;
        onZoomChange(Math.max(0.25, Math.min(zoomLevel + delta, 5)));
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomLevel, onZoomChange]);

  // --- Ruler scrubbing ---
  const isScrubbing = useRef(false);

  const scrubAt = useCallback((clientX: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left + el.scrollLeft;
    const frame = Math.max(0, Math.min(Math.floor(x / THUMB_PX), totalFrames - 1));
    onFrameSelect(frame);
  }, [THUMB_PX, totalFrames, onFrameSelect]);

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

  // --- DnD ---
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

  // Ruler tick generation — one major tick every ~80px
  const tickInterval = useMemo(() => {
    const approxTickPx = 80;
    const framesPerTick = Math.max(1, Math.round(approxTickPx / THUMB_PX));
    // Round to a nice number
    const niceIntervals = [1, 2, 5, 10, 15, 20, 30, 60, 90, 120, 150, 300];
    return niceIntervals.find(n => n >= framesPerTick) ?? framesPerTick;
  }, [THUMB_PX]);

  const rulerTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let f = 0; f <= totalFrames; f += tickInterval) ticks.push(f);
    return ticks;
  }, [totalFrames, tickInterval]);

  const contentWidth = totalFrames * THUMB_PX;

  if (clips.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-[#6B6B6B] bg-[#F5F0EB]">
        <span className="text-[10px] font-mono uppercase tracking-widest">Drop media to get started</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[#F5F0EB] relative">
      {/* Header bar */}
      <div className="px-4 py-2 border-b border-[#1A1A1A]/30 flex justify-between items-center shrink-0 bg-[#F5F0EB]">
        <span className="text-[10px] font-mono font-bold tracking-widest text-[#1A1A1A] uppercase">Clips</span>
        <span className="text-[9px] font-mono font-bold px-2 py-0.5 border border-[#1A1A1A] bg-white text-[#1A1A1A] tabular-nums">
          {totalFrames} FRAMES
        </span>
      </div>

      {/* Scrollable track area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-x-auto overflow-y-hidden relative"
        style={{ minHeight: RULER_H + TRACK_H + 8 }}
      >
        {/* Content container — defines the scrollable width */}
        <div className="relative" style={{ width: Math.max(contentWidth, 100), height: RULER_H + TRACK_H + 8 }}>

          {/* RULER */}
          <div
            className="absolute top-0 left-0 right-0 select-none cursor-crosshair"
            style={{ height: RULER_H, background: '#F5F0EB', borderBottom: '1px solid rgba(26,26,26,0.2)' }}
            onMouseDown={handleRulerMouseDown}
          >
            {rulerTicks.map(f => (
              <div
                key={f}
                className="absolute bottom-0 flex flex-col items-start"
                style={{ left: f * THUMB_PX, transform: 'translateX(-0.5px)' }}
              >
                <span className="text-[7px] font-mono text-[#6B6B6B] pl-0.5 leading-none mb-0.5 pointer-events-none select-none">
                  {f}
                </span>
                <div style={{ width: 1, height: 6, background: 'rgba(26,26,26,0.35)' }} />
              </div>
            ))}

            {/* Playhead triangle on ruler */}
            <div
              className="absolute top-0 pointer-events-none"
              style={{ left: playheadPx, transform: 'translateX(-5px)' }}
            >
              <div style={{
                width: 0, height: 0,
                borderLeft: '5px solid transparent',
                borderRight: '5px solid transparent',
                borderTop: '8px solid #E85D2A',
              }} />
            </div>
          </div>

          {/* CLIP TRACK */}
          <div
            className="absolute left-0"
            style={{ top: RULER_H + 4, height: TRACK_H }}
          >
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={clips.map(c => c.id)} strategy={horizontalListSortingStrategy}>
                <div className="flex h-full gap-[2px]">
                  {clips.map(clip => {
                    const asset = assets[clip.assetId];
                    if (!asset) return null;
                    return (
                      <SortableClipWrapper
                        key={clip.id}
                        clip={clip}
                        asset={asset}
                        onUpdateBounds={handleUpdateBounds}
                        zoomLevel={zoomLevel}
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

          {/* PLAYHEAD LINE — spans ruler + track */}
          <div
            className="absolute top-0 pointer-events-none z-50"
            style={{
              left: playheadPx,
              width: 1,
              height: RULER_H + TRACK_H + 8,
              background: '#E85D2A',
              boxShadow: '0 0 4px rgba(232,93,42,0.6)',
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
  clip, asset, onUpdateBounds, zoomLevel, isSelected, onSelect, onContextMenu,
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
      zoomLevel={zoomLevel}
      isSelected={isSelected}
      onClick={onSelect}
      onContextMenu={onContextMenu}
    />
  );
};
