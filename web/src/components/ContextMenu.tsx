import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { TimelineClip, MediaAsset } from '../types/media';
import { HW_SPRINGS } from '../theme/springPresets';

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
  themeMode?: 'light' | 'dark';
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
  onClose,
  themeMode = 'light'
}) => {
  const isDark = themeMode === 'dark';
  const menuRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

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

  const targetClip = clipId ? clips.find(c => c.id === clipId) : null;
  const hasSpecificClip = Boolean(targetClip);

  const handleDelete = () => {
    if (!clipId) return;
    const remaining = clips.filter(c => c.id !== clipId);
    onClipsChange(remaining);
    onClose();
  };

  const handleDuplicate = () => {
    if (!targetClip) return;
    const newClip: TimelineClip = {
      ...targetClip,
      id: 'clip_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    };
    const clipIndex = clips.findIndex(c => c.id === clipId);
    const updated = [...clips];
    updated.splice(clipIndex + 1, 0, newClip);
    onClipsChange(updated);
    onClose();
  };

  const handleResetTrim = () => {
    if (!targetClip || !assets) return;
    const asset = assets[targetClip.assetId];
    if (!asset) return;
    const maxFrames = asset.media.frames.length;
    const updated = clips.map(c => 
      c.id === clipId ? { ...c, inFrame: 0, outFrame: maxFrames - 1 } : c
    );
    onClipsChange(updated);
    onClose();
  };

  const handleMoveClip = (direction: 'left' | 'right') => {
    if (!clipId) return;
    const index = clips.findIndex(c => c.id === clipId);
    if (index === -1) return;
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= clips.length) return;

    const newClips = [...clips];
    const [moved] = newClips.splice(index, 1);
    newClips.splice(targetIndex, 0, moved);
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

  const menuWidth = 200;
  const menuHeight = hasSpecificClip ? 260 : 160;
  const safeX = Math.max(8, Math.min(x, window.innerWidth - menuWidth - 8));
  const safeY = Math.max(8, Math.min(y, window.innerHeight - menuHeight - 8));

  return createPortal(
    <AnimatePresence>
      <motion.div 
        ref={menuRef}
        initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -4 }}
        animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
        exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -4 }}
        transition={shouldReduceMotion ? { duration: 0.1 } : HW_SPRINGS.snappy}
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
        className={`fixed z-[99999] w-[200px] border p-1 select-none font-sans text-xs pointer-events-auto rounded-[8px] transition-colors shadow-[0_12px_32px_rgba(0,0,0,0.6)] ${
          isDark 
            ? 'bg-[var(--hw-bg-surface)] text-[var(--hw-text-primary)] border-white/[0.12]' 
            : 'bg-white text-[#18181A] border-black/[0.12]'
        }`}
      >
        {/* Header Label */}
        <div className={`px-2 py-1 border-b text-[11px] font-medium font-sans mb-1 flex items-center justify-between ${
          isDark ? 'border-white/[0.08] text-[var(--hw-text-secondary)]' : 'border-black/[0.08] text-[#57575E]'
        }`}>
          <span>{hasSpecificClip ? 'Clip actions' : 'Timeline actions'}</span>
        </div>

        <div className="space-y-0.5">
          {/* Split Action */}
          {onSplitClip && (
            <motion.button 
              whileTap={{ scale: 0.97 }}
              transition={HW_SPRINGS.snappy}
              onClick={(e) => {
                e.stopPropagation();
                onSplitClip();
                onClose();
              }}
              className="w-full text-left px-2 py-1.5 flex justify-between items-center rounded-[6px] hover:bg-white/[0.08] transition-colors cursor-pointer"
            >
              <span className="font-sans text-xs">Split at playhead</span>
              <kbd className="text-[11px] font-mono text-[var(--hw-text-tertiary)]">Ctrl+B</kbd>
            </motion.button>
          )}

          {hasSpecificClip && (
            <>
              {/* Duplicate */}
              <motion.button 
                whileTap={{ scale: 0.97 }}
                transition={HW_SPRINGS.snappy}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDuplicate();
                }}
                className="w-full text-left px-2 py-1.5 flex justify-between items-center rounded-[6px] hover:bg-white/[0.08] transition-colors cursor-pointer"
              >
                <span className="font-sans text-xs">Duplicate clip</span>
                <kbd className="text-[11px] font-mono text-[var(--hw-text-tertiary)]">Ctrl+D</kbd>
              </motion.button>

              {/* Reset Trim */}
              <motion.button 
                whileTap={{ scale: 0.97 }}
                transition={HW_SPRINGS.snappy}
                onClick={(e) => {
                  e.stopPropagation();
                  handleResetTrim();
                }}
                className="w-full text-left px-2 py-1.5 flex justify-between items-center rounded-[6px] hover:bg-white/[0.08] transition-colors cursor-pointer"
              >
                <span className="font-sans text-xs">Reset trim bounds</span>
              </motion.button>

              {/* Reorder Left / Right Buttons */}
              {clips.length > 1 && (
                <div className="flex gap-1 py-0.5">
                  <motion.button 
                    whileTap={{ scale: 0.95 }}
                    transition={HW_SPRINGS.snappy}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMoveClip('left');
                    }}
                    className="flex-1 px-2 py-1 text-xs font-sans rounded-[6px] border border-white/[0.08] bg-[var(--hw-bg-canvas)] hover:border-white/20 transition-colors flex items-center justify-center cursor-pointer"
                    title="Move clip left in timeline"
                  >
                    Move left
                  </motion.button>
                  <motion.button 
                    whileTap={{ scale: 0.95 }}
                    transition={HW_SPRINGS.snappy}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMoveClip('right');
                    }}
                    className="flex-1 px-2 py-1 text-xs font-sans rounded-[6px] border border-white/[0.08] bg-[var(--hw-bg-canvas)] hover:border-white/20 transition-colors flex items-center justify-center cursor-pointer"
                    title="Move clip right in timeline"
                  >
                    Move right
                  </motion.button>
                </div>
              )}

              <div className={`h-px my-1 ${isDark ? 'bg-white/[0.08]' : 'bg-black/[0.08]'}`} />

              {/* Delete Clip (Neutral text, orange reserved) */}
              <motion.button 
                whileTap={{ scale: 0.97 }}
                transition={HW_SPRINGS.snappy}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete();
                }}
                className="w-full text-left px-2 py-1.5 flex justify-between items-center rounded-[6px] hover:bg-white/[0.08] transition-colors cursor-pointer"
              >
                <span className="font-sans text-xs text-[var(--hw-text-primary)]">Delete clip</span>
                <kbd className="text-[11px] font-mono text-[var(--hw-text-tertiary)]">Del</kbd>
              </motion.button>
            </>
          )}

          {/* Section Divider */}
          <div className={`h-px my-1 ${isDark ? 'bg-white/[0.08]' : 'bg-black/[0.08]'}`} />

          {/* Timeline & Selection Actions */}
          <motion.button 
            whileTap={{ scale: 0.97 }}
            transition={HW_SPRINGS.snappy}
            onClick={(e) => {
              e.stopPropagation();
              handleSelectAll();
            }}
            className="w-full text-left px-2 py-1.5 flex justify-between items-center rounded-[6px] hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            <span className="font-sans text-xs">Select all clips</span>
            <kbd className="text-[11px] font-mono text-[var(--hw-text-tertiary)]">Ctrl+A</kbd>
          </motion.button>

          <motion.button 
            whileTap={{ scale: 0.97 }}
            transition={HW_SPRINGS.snappy}
            onClick={(e) => {
              e.stopPropagation();
              handleDeselectAll();
            }}
            className="w-full text-left px-2 py-1.5 flex justify-between items-center rounded-[6px] hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            <span className="font-sans text-xs">Deselect all</span>
          </motion.button>

          {onZoomChange && (
            <motion.button 
              whileTap={{ scale: 0.97 }}
              transition={HW_SPRINGS.snappy}
              onClick={(e) => {
                e.stopPropagation();
                handleResetZoom();
              }}
              className="w-full text-left px-2 py-1.5 flex justify-between items-center rounded-[6px] hover:bg-white/[0.08] transition-colors cursor-pointer"
            >
              <span className="font-sans text-xs">Reset zoom (100%)</span>
            </motion.button>
          )}

          {!hasSpecificClip && clips.length > 0 && (
            <>
              <div className={`h-px my-1 ${isDark ? 'bg-white/[0.08]' : 'bg-black/[0.08]'}`} />
              <motion.button 
                whileTap={{ scale: 0.97 }}
                transition={HW_SPRINGS.snappy}
                onClick={(e) => {
                  e.stopPropagation();
                  handleClearAll();
                }}
                className="w-full text-left px-2 py-1.5 flex justify-between items-center rounded-[6px] hover:bg-white/[0.08] transition-colors cursor-pointer"
              >
                <span className="font-sans text-xs text-[var(--hw-text-primary)]">Clear all clips</span>
              </motion.button>
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};
