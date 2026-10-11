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
import { TapeDeckEmptyState } from './timeline/TapeDeckEmptyState';

const THUMB_BASE = 16; // px per frame at zoom=1 — clear default view
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
  onLoadSample?: (sampleId: string) => void;
  onLaunchLyrics?: () => void;
  onSplitClip?: () => void;
  serialConnected?: boolean;
  isStreaming?: boolean;
  baudRate?: number;
  targetFps?: number;
  themeMode?: 'light' | 'dark';
  onToggleSerial?: () => void;
  onOpenSamples?: () => void;
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
  onLoadSample,
  onLaunchLyrics,
  onSplitClip,
  serialConnected = false,
  isStreaming = false,
  baudRate = 921600,
  targetFps = 30,
  themeMode = 'light',
  onToggleSerial,
  onOpenSamples,
}) => {
  const isDark = themeMode === 'dark';
  const scrollRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; clipId: string } | null>(null);
  const [isDropTargetOver, setIsDropTargetOver] = useState(false);
  const [marqueeBox, setMarqueeBox] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);

  const handleTrackMouseDown = (e: React.MouseEvent) => {
    if (clips.length === 0) return; // Disable box marquee selection when timeline is empty
    if (e.button === 1) {
      handleMiddleMouseDown(e);
      return;
    }
    if (e.button !== 0) return; // Left-click only for marquee box

    const target = e.target as HTMLElement;
    if (target.closest('.ruler-area') || target.closest('[data-clip-id]') || target.closest('button, input, select')) {
      return;
    }

    e.preventDefault();
    document.body.style.userSelect = 'none';

    const rect = scrollRef.current?.getBoundingClientRect();
    if (!rect) return;

    const startX = e.clientX - rect.left + (scrollRef.current?.scrollLeft || 0);
    const startY = e.clientY - rect.top + (scrollRef.current?.scrollTop || 0);

    setMarqueeBox({ startX, startY, currentX: startX, currentY: startY });

    const onMove = (mv: MouseEvent) => {
      if (!scrollRef.current) return;
      const currentRect = scrollRef.current.getBoundingClientRect();
      const curX = mv.clientX - currentRect.left + scrollRef.current.scrollLeft;
      const curY = mv.clientY - currentRect.top + scrollRef.current.scrollTop;

      setMarqueeBox({ startX, startY, currentX: curX, currentY: curY });

      const boxLeft = Math.min(startX, curX);
      const boxRight = Math.max(startX, curX);

      let accPx = 0;
      const selected: string[] = [];
      clips.forEach(clip => {
        const len = clip.outFrame - clip.inFrame + 1;
        const clipLeft = accPx;
        const clipRight = accPx + len * thumbPx;
        if (boxRight >= clipLeft && boxLeft <= clipRight) {
          selected.push(clip.id);
        }
        accPx += len * thumbPx + GAP_PX;
      });

      onSelectClips(selected);
    };

    const onUp = () => {
      setMarqueeBox(null);
      document.body.style.userSelect = '';
      window.getSelection()?.removeAllRanges();
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

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
    e.stopPropagation();
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

  return (
    <div 
      className={`w-full h-full flex-1 flex flex-col min-h-0 relative select-none transition-colors ${
        isDark ? 'bg-[#181A1B] text-[#FAFAFA]' : 'bg-[#F5F0EB] text-[#1A1A1A]'
      }`}
    >

      {/* Header bar */}
      <div className={`px-3 py-1.5 border-b flex items-center justify-between shrink-0 overflow-x-visible transition-colors ${
        isDark 
          ? 'bg-[#202225] border-white/10 text-[#FAFAFA]' 
          : 'bg-[#EDEAE5] border-[#1A1A1A]/20 text-[#1A1A1A]'
      }`}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-sans text-[var(--hw-text-secondary)]">
            <span className="font-mono">{totalActiveFrames}</span> frames (<span className="font-mono">{clips.length}</span> {clips.length === 1 ? 'clip' : 'clips'}) · <span className="font-mono">{targetFps}</span> FPS
          </span>
          {selectedClipIds.length > 0 && (
            <span className="text-[11px] font-sans font-medium px-2 py-0.5 rounded-[4px] bg-white/10 border border-white/15 text-[var(--hw-text-primary)]">
              Selected: <span className="font-mono">{selectedClipIds.length}</span> {selectedClipIds.length > 1 ? 'clips' : 'clip'}
            </span>
          )}
        </div>

        <div className="ml-auto mr-16 flex min-w-0 shrink-0 items-center">
          <div className="w-48 sm:w-52 min-w-0">
              <ElasticSlider
                leftIcon={<span className="flex items-center gap-1 font-sans text-xs text-[var(--hw-text-secondary)]"><span>Zoom</span><span>-</span></span>}
                startingValue={0}
                maxValue={100}
                defaultValue={Math.max(0, Math.min(100, 100 * Math.log(zoomLevel / MIN_ZOOM) / Math.log(ZOOM_RATIO)))}
                isStepped={false}
                onChange={(val) => {
                  const nextZoom = (val / 100);
                  onZoomChange(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoom)));
                }}
                themeMode={themeMode}
              />
          </div>
        </div>
      </div>



      {/* Scrollable track area (horizontal AND vertical scrolling enabled) */}
      <div
        ref={scrollRef}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setContextMenu({ x: e.clientX, y: e.clientY, clipId: '' });
        }}
        onMouseDown={handleTrackMouseDown}
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
        className={`flex-1 overflow-auto relative transition-colors ${
          isDropTargetOver ? (isDark ? 'bg-[#FF5500]/10' : 'bg-[#FF5500]/10') : ''
        }`}
        style={{ minHeight: clips.length === 0 ? undefined : RULER_H + CLIP_HEIGHT + 40 }}
      >
        <div
          className="relative h-full min-h-full"
          style={{ width: clips.length === 0 ? '100%' : Math.max(contentWidth, 100), minHeight: clips.length === 0 ? undefined : RULER_H + CLIP_HEIGHT + 40 }}
        >

          {/* RULER */}
          <div
            className={`ruler-area absolute top-0 left-0 right-0 select-none ${clips.length > 0 ? 'cursor-crosshair' : 'cursor-default'} z-20`}
            style={{ 
              height: RULER_H, 
              background: isDark ? '#282A2E' : '#E8E4DF', 
              borderBottom: isDark ? '1px solid rgba(255,255,255,0.10)' : '1px solid rgba(26,26,26,0.2)' 
            }}
            onMouseDown={clips.length > 0 ? handleRulerMouseDown : undefined}
          >
            {rulerTicks.map(({ label, px }) => (
              <div key={px} className="absolute bottom-0 pointer-events-none" style={{ left: px }}>
                <div style={{ width: 1, height: 7, background: isDark ? 'rgba(255,85,0,0.6)' : 'rgba(26,26,26,0.35)' }} />
                <span
                  className={`absolute text-[11px] font-mono select-none ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}
                  style={{ bottom: 8, left: 2, whiteSpace: 'nowrap' }}
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
                borderTop: `${RULER_H}px solid #FF5500`,
              }} />
            </div>
          </div>

          {/* PURE AESTHETIC HAIRLINE MULTI-LAYER SHOWCASE */}
          {clips.length === 0 && (
            <TapeDeckEmptyState
              isDark={isDark}
              isDropTargetOver={isDropTargetOver}
              serialConnected={serialConnected}
              isStreaming={isStreaming}
              baudRate={baudRate}
              targetFps={targetFps}
              onToggleSerial={onToggleSerial}
              onOpenSamples={onOpenSamples}
            />
          )}

          <div
            className="absolute left-0"
            style={{ top: RULER_H + 4, height: CLIP_HEIGHT }}
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
                        themeMode={themeMode}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          {/* PLAYHEAD line */}
          <div
            className="absolute top-0 pointer-events-none z-30"
            style={{
              left: playheadPx,
              width: 1,
              height: '100%',
              background: '#FF5500',
              transform: 'translateX(-50%)',
            }}
          />

          {/* Marquee Selection Box Overlay */}
          {marqueeBox && (
            <div
              className="absolute border-2 border-dashed pointer-events-none z-40 border-[#FF5500] bg-[#FF5500]/15"
              style={{
                left: Math.min(marqueeBox.startX, marqueeBox.currentX),
                top: Math.min(marqueeBox.startY, marqueeBox.currentY),
                width: Math.abs(marqueeBox.currentX - marqueeBox.startX),
                height: Math.abs(marqueeBox.currentY - marqueeBox.startY),
              }}
            />
          )}

        </div>
      </div>

      {isDropTargetOver && (
        <div className="absolute inset-0 border-2 border-dashed pointer-events-none flex items-center justify-center z-50 bg-[#FF5500]/15 border-[#FF5500]">
          <div className={`text-[10px] font-mono px-3 py-1.5 font-bold tracking-widest uppercase shadow-lg ${
            isDark ? 'bg-[#282A2E] text-[#FF5500] border border-[#FF5500]/50' : 'bg-[#1A1A1A] text-white'
          }`}>
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
          assets={assets}
          onClipsChange={onClipsChange}
          onSplitClip={onSplitClip}
          onSelectClips={onSelectClips}
          onZoomChange={onZoomChange}
          themeMode={themeMode}
        />
      )}
    </div>
  );
};

// ---- Sortable wrapper ----
const SortableClipWrapper = ({
  clip, asset, onUpdateBounds, thumbPx, isSelected, onSelect, onContextMenu, onPreviewAssetFrame, themeMode
}: any) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: clip.id });
  return (
    <ClipBlock
      clip={clip}
      asset={asset}
      data-clip-id={clip.id}
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
      themeMode={themeMode}
    />
  );
};
