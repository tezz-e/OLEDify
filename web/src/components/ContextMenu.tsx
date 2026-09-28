import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { TimelineClip, MediaAsset } from '../types/media';

interface ContextMenuProps {
  x: number;
  y: number;
  clipId?: string;
  clips: TimelineClip[];
  assets?: Record<string, MediaAsset>;
  onClipsChange: (clips: TimelineClip[]) => void;
  onSplitClip?: () => void;
  onSelectClips?: (ids: string[]) => void;
  onZoomChange?: (zoom: number) => void;
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ 
  x, 
  y, 
  clipId, 
  clips, 
  assets,
  onClipsChange, 
  onSplitClip,
  onSelectClips,
  onZoomChange,
  onClose 
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDownOutside = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    const handleScrollOrBlur = () => onClose();

    window.addEventListener('pointerdown', handlePointerDownOutside, { capture: true });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleScrollOrBlur);
    window.addEventListener('blur', handleScrollOrBlur);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDownOutside, { capture: true });
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleScrollOrBlur);
      window.removeEventListener('blur', handleScrollOrBlur);
    };
  }, [onClose]);

  const activeClip = clipId ? clips.find(c => c.id === clipId) : undefined;
  const hasSpecificClip = Boolean(activeClip);

  const handleDelete = () => {
    if (clipId) {
      onClipsChange(clips.filter(c => c.id !== clipId));
      if (onSelectClips) onSelectClips([]);
    }
    onClose();
  };

  const handleDuplicate = () => {
    if (!clipId) return;
    const clipToDup = clips.find(c => c.id === clipId);
    if (!clipToDup) return;
    
    const newClip: TimelineClip = {
      ...clipToDup,
      id: "clip_" + Date.now() + "_" + Math.random().toString(36).substring(2, 5)
    };
    
    const index = clips.findIndex(c => c.id === clipId);
    const newClips = [...clips];
    newClips.splice(index + 1, 0, newClip);
    onClipsChange(newClips);
    if (onSelectClips) onSelectClips([newClip.id]);
    onClose();
  };

  const handleResetTrim = () => {
    if (!clipId || !activeClip) return;
    const asset = assets?.[activeClip.assetId];
    const maxFrame = asset ? Math.max(0, asset.media.frames.length - 1) : activeClip.outFrame;
    
    onClipsChange(clips.map(c => {
      if (c.id === clipId) {
        return { ...c, inFrame: 0, outFrame: maxFrame };
      }
      return c;
    }));
    onClose();
  };

  const handleMoveClip = (direction: 'left' | 'right') => {
    if (!clipId) return;
    const idx = clips.findIndex(c => c.id === clipId);
    if (idx === -1) return;
    const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= clips.length) return;

    const newClips = [...clips];
    const [moved] = newClips.splice(idx, 1);
    newClips.splice(targetIdx, 0, moved);
    onClipsChange(newClips);
    onClose();
  };

  const handleSelectAll = () => {
    if (onSelectClips) {
      onSelectClips(clips.map(c => c.id));
    }
    onClose();
  };

  const handleDeselectAll = () => {
    if (onSelectClips) {
      onSelectClips([]);
    }
    onClose();
  };

  const handleResetZoom = () => {
    if (onZoomChange) {
      onZoomChange(1);
    }
    onClose();
  };

  const handleClearAll = () => {
    onClipsChange([]);
    if (onSelectClips) onSelectClips([]);
    onClose();
  };

  const menuWidth = 220;
  const menuHeight = hasSpecificClip ? 340 : 230;
  const safeX = Math.max(8, Math.min(x, window.innerWidth - menuWidth - 8));
  const safeY = Math.max(8, Math.min(y, window.innerHeight - menuHeight - 8));

  return createPortal(
    <AnimatePresence>
      <motion.div 
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.96, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.12 }}
        style={{ 
          left: safeX, 
          top: safeY, 
          transformOrigin: 'top left',
          willChange: 'transform, opacity'
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        className="fixed z-[99999] w-[210px] max-h-[calc(100vh-16px)] overflow-y-auto bg-white/95 backdrop-blur-md text-[#141413] border border-[#E8E5DE] rounded-xl shadow-lg p-1.5 select-none font-sans text-xs pointer-events-auto"
      >
        {/* Subtle Header */}
        <div className="px-2.5 py-1 mb-1 border-b border-[#E8E5DE] flex justify-between items-center">
          <span className="text-[10px] font-sans font-medium text-[#87867F] uppercase tracking-wider">
            {hasSpecificClip ? 'Clip Actions' : 'Timeline'}
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#D97757]" />
        </div>

        <div className="space-y-0.5 relative">
          {/* Split Action */}
          {onSplitClip && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onSplitClip();
                onClose();
              }}
              className="w-full text-left px-2.5 py-1.5 rounded-lg flex justify-between items-center transition-colors cursor-pointer text-[#141413] hover:bg-[#FAF0EB] hover:text-[#D97757]"
            >
              <span className="flex items-center gap-2 font-medium text-xs">
                <span>✂</span> Split at Playhead
              </span>
              <kbd className="text-[10px] bg-[#FAF9F5] border border-[#E8E5DE] px-1.5 py-0.5 text-[#5E5D59] font-mono rounded">Ctrl+B</kbd>
            </button>
          )}

          {hasSpecificClip && (
            <>
              {/* Duplicate */}
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleDuplicate();
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg flex justify-between items-center transition-colors cursor-pointer text-[#141413] hover:bg-[#FAF0EB] hover:text-[#D97757]"
              >
                <span className="flex items-center gap-2 font-medium text-xs">
                  <span>📄</span> Duplicate Clip
                </span>
                <kbd className="text-[10px] bg-[#FAF9F5] border border-[#E8E5DE] px-1.5 py-0.5 text-[#5E5D59] font-mono rounded">Ctrl+D</kbd>
              </button>

              {/* Reset Trim */}
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleResetTrim();
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg flex justify-between items-center transition-colors cursor-pointer text-[#141413] hover:bg-[#FAF0EB] hover:text-[#D97757]"
              >
                <span className="flex items-center gap-2 font-medium text-xs">
                  <span>↺</span> Reset Trim Bounds
                </span>
              </button>

              {/* Reorder Left / Right Buttons */}
              {clips.length > 1 && (
                <div className="flex gap-1.5 py-1 px-1">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMoveClip('left');
                    }}
                    className="flex-1 py-1 text-[11px] font-sans font-medium border border-[#E8E5DE] bg-[#FAF9F5] hover:bg-[#FAF0EB] hover:text-[#D97757] rounded-md transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    title="Move clip left in timeline"
                  >
                    ← Move Left
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMoveClip('right');
                    }}
                    className="flex-1 py-1 text-[11px] font-sans font-medium border border-[#E8E5DE] bg-[#FAF9F5] hover:bg-[#FAF0EB] hover:text-[#D97757] rounded-md transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    title="Move clip right in timeline"
                  >
                    Move Right →
                  </button>
                </div>
              )}

              <div className="h-px bg-[#E8E5DE] my-1 mx-1" />

              {/* Delete Clip */}
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete();
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg flex justify-between items-center text-[#C53030] hover:bg-[#FFF5F5] transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2 font-medium text-xs">
                  <span>🗑</span> Delete Clip
                </span>
                <kbd className="text-[10px] bg-[#FFF5F5] border border-[#FED7D7] px-1.5 py-0.5 text-[#C53030] font-mono rounded">DEL</kbd>
              </button>
            </>
          )}

          {/* Section Divider */}
          <div className="h-px bg-[#E8E5DE] my-1 mx-1" />

          {/* Timeline & Selection Actions */}
          <button 
            onClick={(e) => {
              e.stopPropagation();
              handleSelectAll();
            }}
            className="w-full text-left px-2.5 py-1.5 rounded-lg flex justify-between items-center transition-colors cursor-pointer text-[#141413] hover:bg-[#FAF0EB] hover:text-[#D97757]"
          >
            <span className="flex items-center gap-2 font-medium text-xs">
              <span>🎯</span> Select All
            </span>
            <kbd className="text-[10px] bg-[#FAF9F5] border border-[#E8E5DE] px-1.5 py-0.5 text-[#5E5D59] font-mono rounded">Ctrl+A</kbd>
          </button>

          <button 
            onClick={(e) => {
              e.stopPropagation();
              handleDeselectAll();
            }}
            className="w-full text-left px-2.5 py-1.5 rounded-lg flex justify-between items-center transition-colors cursor-pointer text-[#141413] hover:bg-[#FAF0EB] hover:text-[#D97757]"
          >
            <span className="flex items-center gap-2 font-medium text-xs">
              <span>✖</span> Deselect All
            </span>
          </button>

          {onZoomChange && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleResetZoom();
              }}
              className="w-full text-left px-2.5 py-1.5 rounded-lg flex justify-between items-center transition-colors cursor-pointer text-[#141413] hover:bg-[#FAF0EB] hover:text-[#D97757]"
            >
              <span className="flex items-center gap-2 font-medium text-xs">
                <span>🔍</span> Reset Zoom
              </span>
            </button>
          )}

          {!hasSpecificClip && clips.length > 0 && (
            <>
              <div className="h-px bg-[#E8E5DE] my-1 mx-1" />
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleClearAll();
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg flex justify-between items-center text-[#C53030] hover:bg-[#FFF5F5] transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2 font-medium text-xs">
                  <span>🧹</span> Clear All Clips
                </span>
              </button>
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};
