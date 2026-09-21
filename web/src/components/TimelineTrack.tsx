import React, { useMemo, useRef, useEffect, useCallback, useState, startTransition } from 'react';
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
import { ClipBlock, CLIP_HEIGHT } from './ClipBlock';
import { ContextMenu } from './ContextMenu';
import ElasticSlider from './reactbits/ElasticSlider';

const THUMB_BASE = 12; // px per frame at zoom=1 — small so default view fits many frames
const RULER_H = 28;
const GAP_PX = 2; // gap between clips

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
  onPreviewAssetFrame?: (assetId: string | null, frameIndex?: number) => void;
  onAssetDrop?: (assetId: string) => void;
  onSplitClip?: () => void;
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
  onPreviewAssetFrame,
  onAssetDrop,
  onSplitClip,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; clipId: string } | null>(null);
  const [isDropTargetOver, setIsDropTargetOver] = useState(false);

  const thumbPx = THUMB_BASE * zoomLevel;

  // Content width = sum of TRIMMED clip widths + gaps (matches ClipBlock normal render)
  const totalActiveFrames = useMemo(
    () => clips.reduce((acc, c) => acc + (c.outFrame - c.inFrame + 1), 0),
    [clips]
  );

  const contentWidth = useMemo(() => {
    const clipsWidth = clips.reduce((acc, c) => acc + (c.outFrame - c.inFrame + 1) * thumbPx, 0);
    const gapsWidth = Math.max(0, clips.length - 1) * GAP_PX;
    return clipsWidth + gapsWidth;
  }, [clips, thumbPx]);

  // Playhead pixel position — simple: activeGlobalFrame * thumbPx + gap offsets
  const playheadPx = useMemo(() => {
    let px = 0;
    let globalIdx = 0;
    for (let i = 0; i < clips.length; i++) {
      const c = clips[i];
      const len = c.outFrame - c.inFrame + 1;
      if (activeGlobalFrame < globalIdx + len) {
        // Within this clip
        const localFrame = activeGlobalFrame - globalIdx;
        px += localFrame * thumbPx;
        return px;
      }
      globalIdx += len;
      px += len * thumbPx + GAP_PX;
    }
    return px;
  }, [activeGlobalFrame, clips, thumbPx]);

  // Zoom helpers
  const ZOOM_LEVELS = [0.05, 0.1, 0.15, 0.25, 0.33, 0.5, 0.75, 1, 1.5, 2, 3, 4];
  const MIN_ZOOM = ZOOM_LEVELS[0];
  const MAX_ZOOM = ZOOM_LEVELS[ZOOM_LEVELS.length - 1];
  const ZOOM_RATIO = MAX_ZOOM / MIN_ZOOM;
  
  const zoomIn = useCallback(() => {
    const currentIdx = ZOOM_LEVELS.findIndex(z => z > zoomLevel - 0.01);
    if (currentIdx < ZOOM_LEVELS.length - 1) onZoomChange(ZOOM_LEVELS[currentIdx + 1]);
  }, [zoomLevel, onZoomChange]);
  
  const zoomOut = useCallback(() => {
    const currentIdx = ZOOM_LEVELS.findIndex(z => z >= zoomLevel - 0.01);
    if (currentIdx > 0) onZoomChange(ZOOM_LEVELS[currentIdx - 1]);
  }, [zoomLevel, onZoomChange]);

  // Ctrl + Scroll to zoom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        startTransition(() => {
          if (e.deltaY > 0) zoomOut();
          else zoomIn();
        });
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomIn, zoomOut]);

  // Ruler scrub — maps pixel click to global active frame
  const isScrubbing = useRef(false);

  const scrubAt = useCallback((clientX: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const clickPx = clientX - rect.left + el.scrollLeft;

    // Walk clips to find which clip and frame was clicked
    let accumulated = 0;
    let globalIdx = 0;
    for (let i = 0; i < clips.length; i++) {
      const c = clips[i];
      const len = c.outFrame - c.inFrame + 1;
      const clipEndPx = accumulated + len * thumbPx;

      if (clickPx <= clipEndPx) {
        const localFrame = Math.max(0, Math.floor((clickPx - accumulated) / thumbPx));
        onFrameSelect(Math.min(globalIdx + localFrame, totalActiveFrames - 1));
        return;
      }
      accumulated += len * thumbPx + GAP_PX;
      globalIdx += len;
    }
    onFrameSelect(Math.max(0, totalActiveFrames - 1));
  }, [clips, thumbPx, totalActiveFrames, onFrameSelect]);

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

  const handleMiddleMouseDown = (e: React.MouseEvent) => {
    // 1 is the middle mouse button
    if (e.button === 1) {
      e.preventDefault();
      const startX = e.clientX;
      const startScrollLeft = scrollRef.current?.scrollLeft || 0;
      
      document.body.style.cursor = 'grabbing';
      
      const onMove = (mv: MouseEvent) => {
        if (!scrollRef.current) return;
        const dx = mv.clientX - startX;
        scrollRef.current.scrollLeft = startScrollLeft - dx;
      };
      
      const onUp = () => {
        document.body.style.cursor = '';
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    }
  };

  // DnD
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oi = clips.findIndex(c => c.id === active.id);
      const ni = clips.findIndex(c => c.id === over.id);
      onClipsChange(arrayMove(clips, oi, ni));
    }
  };
  const handleUpdateBounds = (id: string, inFrame: number, outFrame: number) => {
    onClipsChange(clips.map(c => c.id === id ? { ...c, inFrame, outFrame } : c));
  };

  // Ruler ticks — only in active regions, no negative labels
  const rulerTicks = useMemo(() => {
    const minTickPx = 55;
    const framesPerTick = Math.max(1, Math.ceil(minTickPx / thumbPx));
    const nice = [1, 2, 5, 10, 15, 20, 30, 60, 90, 120, 180, 300, 600];
    const interval = nice.find(n => n >= framesPerTick) ?? framesPerTick;

    const ticks: { label: number; px: number }[] = [];
    let accumulated = 0;
    let globalIdx = 0;

    for (const c of clips) {
      const len = c.outFrame - c.inFrame + 1;
      // Generate ticks aligned to interval, starting from nearest interval boundary ≥ 0
      const firstTick = Math.ceil(globalIdx / interval) * interval;
      for (let f = firstTick; f < globalIdx + len; f += interval) {
        const localFrame = f - globalIdx;
        ticks.push({ label: f, px: accumulated + localFrame * thumbPx });
      }
      accumulated += len * thumbPx + GAP_PX;
      globalIdx += len;
    }
    return ticks;
  }, [clips, thumbPx]);

  const zoomPct = Math.round(zoomLevel * 100);

  if (clips.length === 0) {
    return (
      <div 
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          setIsDropTargetOver(true);
        }}
        onDragLeave={() => setIsDropTargetOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDropTargetOver(false);
          const data = e.dataTransfer.getData('application/x-oled-asset') || e.dataTransfer.getData('text/plain');
          if (data && onAssetDrop) {
            try {
              const parsed = JSON.parse(data);
              if (parsed && parsed.assetId) onAssetDrop(parsed.assetId);
            } catch {
              onAssetDrop(data);
            }
          }
        }}
        className={`flex-1 flex flex-col items-center justify-center bg-[#F5F0EB] transition-colors ${
          isDropTargetOver ? 'bg-[#E85D2A]/10 border-2 border-dashed border-[#E85D2A]' : ''
        }`}
      >
        <span className="text-[10px] font-mono uppercase tracking-widest text-[#6B6B6B] font-bold mb-1">
          {isDropTargetOver ? '+ DROP ASSET TO START TIMELINE' : 'DRAG & DROP MEDIA FROM POOL HERE'}
        </span>
        <span className="text-[8px] font-mono text-[#888] uppercase tracking-wider">
          or click + ADD on any media asset card
        </span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[#F5F0EB] relative">

      {/* Header bar */}
      <div className="px-3 py-1 border-b border-[#1A1A1A]/20 flex items-center justify-between shrink-0 bg-[#EDEAE5] gap-4">
        <span className="text-[9px] font-mono font-bold tracking-widest text-[#1A1A1A] uppercase">
          {totalActiveFrames} frames ({clips.length} clips)
        </span>

        <div className="flex items-center gap-4 mr-10">
          <div className="w-48">
            <ElasticSlider
              startingValue={0}
              maxValue={100}
              defaultValue={Math.max(0, Math.min(100, 100 * Math.log(zoomLevel / MIN_ZOOM) / Math.log(ZOOM_RATIO)))}
              isStepped={false}
              onChange={(val) => {
                startTransition(() => {
                  onZoomChange(MIN_ZOOM * Math.pow(ZOOM_RATIO, val / 100));
                });
              }}
              formatValue={(val) => `${Math.round(val)}%`}
            />
          </div>
        </div>
      </div>

      {/* Scrollable track area */}
      <div
        ref={scrollRef}
        onContextMenu={(e) => {
          e.preventDefault();
          setContextMenu({ x: e.clientX, y: e.clientY, clipId: '' });
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          if (!isDropTargetOver) setIsDropTargetOver(true);
        }}
        onDragLeave={() => setIsDropTargetOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDropTargetOver(false);
          const data = e.dataTransfer.getData('application/x-oled-asset') || e.dataTransfer.getData('text/plain');
          if (data && onAssetDrop) {
            try {
              const parsed = JSON.parse(data);
              if (parsed && parsed.assetId) onAssetDrop(parsed.assetId);
            } catch {
              onAssetDrop(data);
            }
          }
        }}
        className={`flex-1 overflow-x-auto overflow-y-hidden relative transition-colors ${
          isDropTargetOver ? 'bg-[#E85D2A]/10' : ''
        }`}
        style={{ minHeight: RULER_H + CLIP_HEIGHT + 8 }}
        onMouseDown={handleMiddleMouseDown}
      >
        <div
          className="relative min-h-full"
          style={{ width: Math.max(contentWidth, 100), minHeight: RULER_H + CLIP_HEIGHT + 8 }}
        >

          {/* RULER */}
          <div
            className="absolute top-0 left-0 right-0 select-none cursor-crosshair"
            style={{ height: RULER_H, background: '#E8E4DF', borderBottom: '1px solid rgba(26,26,26,0.2)' }}
            onMouseDown={handleRulerMouseDown}
          >
            {rulerTicks.map(({ label, px }) => (
              <div key={px} className="absolute bottom-0 pointer-events-none" style={{ left: px }}>
                <div style={{ width: 1, height: 7, background: 'rgba(26,26,26,0.35)' }} />
                <span
                  className="absolute text-[7px] font-mono text-[#6B6B6B] select-none"
                  style={{ bottom: 9, left: 2, whiteSpace: 'nowrap' }}
                >
                  {label}
                </span>
              </div>
            ))}

            {/* Playhead triangle on ruler */}
            <div
              className="absolute top-0 pointer-events-none z-20"
              style={{ left: playheadPx, transform: 'translateX(-50%)' }}
            >
              <div style={{
                width: 0, height: 0,
                borderLeft: '5px solid transparent',
                borderRight: '5px solid transparent',
                borderTop: `${RULER_H}px solid #E85D2A`,
              }} />
            </div>
          </div>

          {/* CLIP TRACK */}
          <div
            className="absolute left-0"
            style={{ top: RULER_H + 2, height: CLIP_HEIGHT }}
          >
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={clips.map(c => c.id)} strategy={horizontalListSortingStrategy}>
                <div className="flex h-full" style={{ gap: GAP_PX }}>
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
                          e.stopPropagation();
                          onSelectClips([clip.id]);
                          setContextMenu({ x: e.clientX, y: e.clientY, clipId: clip.id });
                        }}
                        onPreviewAssetFrame={onPreviewAssetFrame}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          {/* PLAYHEAD line */}
          <div
            className="absolute top-0 pointer-events-none z-50"
            style={{
              left: playheadPx,
              width: 1,
              height: RULER_H + CLIP_HEIGHT + 8,
              background: '#E85D2A',
              boxShadow: '0 0 4px rgba(232,93,42,0.5)',
              transform: 'translateX(-0.5px)',
            }}
          />

        </div>
      </div>

      {isDropTargetOver && (
        <div className="absolute inset-0 bg-[#E85D2A]/15 border-2 border-dashed border-[#E85D2A] pointer-events-none flex items-center justify-center z-50">
          <div className="bg-[#1A1A1A] text-white text-[10px] font-mono px-3 py-1.5 font-bold tracking-widest uppercase shadow-lg">
            + RELEASE TO APPEND CLIP TO TIMELINE
          </div>
        </div>
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          clipId={contextMenu.clipId}
          clips={clips}
          onClipsChange={onClipsChange}
          onSplitClip={onSplitClip}
        />
      )}
    </div>
  );
};

// ---- Sortable wrapper ----
const SortableClipWrapper = ({
  clip, asset, onUpdateBounds, thumbPx, isSelected, onSelect, onContextMenu, onPreviewAssetFrame
}: any) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: clip.id });
  return (
    <ClipBlock
      clip={clip}
      asset={asset}
      onUpdateBounds={onUpdateBounds}
      setNodeRef={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      dragHandleProps={{ ...attributes, ...listeners }}
      isDragging={isDragging}
      thumbPx={thumbPx}
      isSelected={isSelected}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      onPreviewAssetFrame={onPreviewAssetFrame}
    />
  );
};
