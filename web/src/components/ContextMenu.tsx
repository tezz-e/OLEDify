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
        initial={{ opacity: 0, scale: 0.88, rotate: -1.5, y: -6 }}
        animate={{ opacity: 1, scale: 1, rotate: 0, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, rotate: 1, y: -4 }}
        transition={{ type: 'spring', damping: 26, stiffness: 520, mass: 0.45 }}
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
        className="fixed z-[99999] w-[220px] max-h-[calc(100vh-16px)] overflow-y-auto bg-[#FAF7F2] text-[#1A1A1A] border-2 border-[#1A1A1A] shadow-[4px_4px_0_0_#1A1A1A] p-1.5 select-none font-mono text-xs pointer-events-auto rounded-none"
      >
        {/* Paper Blueprint Header Badge */}
        <div className="px-2.5 py-1.5 mb-2 bg-[#EFECE6] border border-[#1A1A1A] flex justify-between items-center shadow-[1px_1px_0_0_#1A1A1A]">
          <span className="text-[9px] font-bold tracking-widest text-[#E85D2A] uppercase flex items-center gap-1.5 font-mono">
            <span className="w-2 h-2 bg-[#E85D2A] border border-[#1A1A1A] animate-pulse shrink-0" />
            {hasSpecificClip ? 'CLIP EDITING' : 'TIMELINE MENU'}
          </span>
          <span className="text-[8px] font-mono text-[#6B6B6B] font-bold tracking-wider">NLE // 2.0</span>
        </div>

        <div className="space-y-0.5 relative">
          {/* Split Action */}
          {onSplitClip && (
            <motion.button 
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.97 }}
              onClick={(e) => {
                e.stopPropagation();
                onSplitClip();
                onClose();
              }}
              className="w-full text-left px-2 py-1 flex justify-between items-center transition-all cursor-pointer group hover:bg-[#E85D2A] hover:text-white hover:border-[#1A1A1A] border border-transparent rounded-none text-[#1A1A1A] font-bold"
            >
              <span className="flex items-center gap-2 font-medium text-[10px]">
                <span className="text-[#E85D2A] group-hover:text-white">✂</span> Split at Playhead
              </span>
              <kbd className="text-[8px] bg-white border border-[#1A1A1A] px-1 py-0.5 text-[#1A1A1A] font-mono font-bold shadow-[1px_1px_0_0_#1A1A1A] group-hover:bg-[#1A1A1A] group-hover:text-white group-hover:border-white">Ctrl+B</kbd>
            </motion.button>
          )}

          {hasSpecificClip && (
            <>
              {/* Duplicate */}
              <motion.button 
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.97 }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDuplicate();
                }}
                className="w-full text-left px-2 py-1 flex justify-between items-center transition-all cursor-pointer group hover:bg-[#E85D2A] hover:text-white hover:border-[#1A1A1A] border border-transparent rounded-none text-[#1A1A1A] font-bold"
              >
                <span className="flex items-center gap-2 font-medium text-[10px]">
                  <span>📄</span> Duplicate Clip
                </span>
                <kbd className="text-[8px] bg-white border border-[#1A1A1A] px-1 py-0.5 text-[#1A1A1A] font-mono font-bold shadow-[1px_1px_0_0_#1A1A1A] group-hover:bg-[#1A1A1A] group-hover:text-white group-hover:border-white">Ctrl+D</kbd>
              </motion.button>

              {/* Reset Trim */}
              <motion.button 
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.97 }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleResetTrim();
                }}
                className="w-full text-left px-2 py-1 flex justify-between items-center transition-all cursor-pointer group hover:bg-[#E85D2A] hover:text-white hover:border-[#1A1A1A] border border-transparent rounded-none text-[#1A1A1A] font-bold"
              >
                <span className="flex items-center gap-2 font-medium text-[10px]">
                  <span>↺</span> Reset Trim Bounds
                </span>
              </motion.button>

              {/* Reorder Left / Right Buttons */}
              {clips.length > 1 && (
                <div className="flex gap-1 py-0.5">
                  <motion.button 
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMoveClip('left');
                    }}
                    className="flex-1 px-1.5 py-0.5 text-[8px] font-mono font-bold border border-[#1A1A1A] bg-white hover:bg-[#E85D2A] hover:text-white shadow-[1px_1px_0_0_#1A1A1A] transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    title="Move clip left in timeline"
                  >
                    ⬅ Left
                  </motion.button>
                  <motion.button 
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMoveClip('right');
                    }}
                    className="flex-1 px-1.5 py-0.5 text-[8px] font-mono font-bold border border-[#1A1A1A] bg-white hover:bg-[#E85D2A] hover:text-white shadow-[1px_1px_0_0_#1A1A1A] transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    title="Move clip right in timeline"
                  >
                    Right ➡️
                  </motion.button>
                </div>
              )}

              <div className="h-px bg-[#1A1A1A]/20 my-0.5 mx-0.5" />

              {/* Delete Clip */}
              <motion.button 
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.97 }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete();
                }}
                className="w-full text-left px-2 py-1 flex justify-between items-center text-[#D32F2F] hover:bg-[#D32F2F] hover:text-white transition-all cursor-pointer group border border-transparent hover:border-[#1A1A1A] font-bold"
              >
                <span className="flex items-center gap-2 font-medium text-[10px]">
                  <span>🗑</span> Delete Clip
                </span>
                <kbd className="text-[8px] bg-white border border-[#1A1A1A] px-1 py-0.5 text-[#1A1A1A] font-mono font-bold shadow-[1px_1px_0_0_#1A1A1A] group-hover:bg-[#1A1A1A] group-hover:text-white group-hover:border-white">DEL</kbd>
              </motion.button>
            </>
          )}

          {/* Section Divider */}
          <div className="h-px bg-[#1A1A1A]/20 my-0.5 mx-0.5" />

          {/* Timeline & Selection Actions */}
          <motion.button 
            whileHover={{ x: 2 }}
            whileTap={{ scale: 0.97 }}
            onClick={(e) => {
              e.stopPropagation();
              handleSelectAll();
            }}
            className="w-full text-left px-2 py-1 flex justify-between items-center transition-all cursor-pointer group hover:bg-[#E85D2A] hover:text-white hover:border-[#1A1A1A] border border-transparent rounded-none text-[#1A1A1A] font-bold"
          >
            <span className="flex items-center gap-2 font-medium text-[10px]">
              <span>🎯</span> Select All Clips
            </span>
            <kbd className="text-[8px] bg-white border border-[#1A1A1A] px-1 py-0.5 text-[#1A1A1A] font-mono font-bold shadow-[1px_1px_0_0_#1A1A1A] group-hover:bg-[#1A1A1A] group-hover:text-white group-hover:border-white">Ctrl+A</kbd>
          </motion.button>

          <motion.button 
            whileHover={{ x: 2 }}
            whileTap={{ scale: 0.97 }}
            onClick={(e) => {
              e.stopPropagation();
              handleDeselectAll();
            }}
            className="w-full text-left px-2 py-1 flex justify-between items-center transition-all cursor-pointer group hover:bg-[#E85D2A] hover:text-white hover:border-[#1A1A1A] border border-transparent rounded-none text-[#1A1A1A] font-bold"
          >
            <span className="flex items-center gap-2 font-medium text-[10px]">
              <span>✖</span> Deselect All
            </span>
          </motion.button>

          {onZoomChange && (
            <motion.button 
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.97 }}
              onClick={(e) => {
                e.stopPropagation();
                handleResetZoom();
              }}
              className="w-full text-left px-2 py-1 flex justify-between items-center transition-all cursor-pointer group hover:bg-[#E85D2A] hover:text-white hover:border-[#1A1A1A] border border-transparent rounded-none text-[#1A1A1A] font-bold"
            >
              <span className="flex items-center gap-2 font-medium text-[10px]">
                <span>🔍</span> Reset Zoom (100%)
              </span>
            </motion.button>
          )}

          {!hasSpecificClip && clips.length > 0 && (
            <>
              <div className="h-px bg-[#1A1A1A]/20 my-0.5 mx-0.5" />
              <motion.button 
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.97 }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleClearAll();
                }}
                className="w-full text-left px-2 py-1 flex justify-between items-center text-[#D32F2F] hover:bg-[#D32F2F] hover:text-white transition-all cursor-pointer group border border-transparent hover:border-[#1A1A1A] font-bold"
              >
                <span className="flex items-center gap-2 font-medium text-[10px]">
                  <span>🧹</span> Clear All Clips
                </span>
              </motion.button>
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};
