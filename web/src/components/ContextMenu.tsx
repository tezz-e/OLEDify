import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TimelineClip } from '../types/media';

interface ContextMenuProps {
  x: number;
  y: number;
  clipId?: string;
  clips: TimelineClip[];
  onClipsChange: (clips: TimelineClip[]) => void;
  onSplitClip?: () => void;
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ 
  x, 
  y, 
  clipId, 
  clips, 
  onClipsChange, 
  onSplitClip,
  onClose 
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [activeItem, setActiveItem] = useState<string | null>(null);

  useEffect(() => {
    const preventNative = (e: MouseEvent) => {
      e.preventDefault();
    };
    window.addEventListener('contextmenu', preventNative, { capture: true });

    const handleClickOutside = (e: MouseEvent) => {
      if (e.button !== 0 && e.type === 'mousedown') return;
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleContextMenuOutside = (e: MouseEvent) => {
      e.preventDefault();
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    const timer = setTimeout(() => {
      window.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('contextmenu', handleContextMenuOutside);
      window.addEventListener('keydown', handleKeyDown);
    }, 50);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('contextmenu', preventNative, { capture: true });
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('contextmenu', handleContextMenuOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const hasSpecificClip = clipId && clips.some(c => c.id === clipId);

  const handleDelete = () => {
    if (clipId) {
      onClipsChange(clips.filter(c => c.id !== clipId));
    }
    onClose();
  };

  const handleDuplicate = () => {
    if (!clipId) return;
    const clipToDup = clips.find(c => c.id === clipId);
    if (!clipToDup) return;
    
    const newClip = {
      ...clipToDup,
      id: "clip_" + Date.now() + "_" + Math.random().toString(36).substring(2, 5)
    };
    
    const index = clips.findIndex(c => c.id === clipId);
    const newClips = [...clips];
    newClips.splice(index + 1, 0, newClip);
    onClipsChange(newClips);
    onClose();
  };

  const handleResetTrim = () => {
    if (!clipId) return;
    onClipsChange(clips.map(c => {
      if (c.id === clipId) {
        return { ...c, inFrame: 0 };
      }
      return c;
    }));
    onClose();
  };

  const handleClearAll = () => {
    onClipsChange([]);
    onClose();
  };

  const menuWidth = 220;
  const menuHeight = 200;
  const safeX = Math.max(12, Math.min(x, window.innerWidth - menuWidth - 12));
  const safeY = Math.max(12, Math.min(y, window.innerHeight - menuHeight - 12));

  return (
    <AnimatePresence>
      <motion.div 
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.8, filter: 'blur(12px)', y: -8 }}
        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)', y: 0 }}
        exit={{ opacity: 0, scale: 0.85, filter: 'blur(8px)', y: -4 }}
        transition={{ type: 'spring', damping: 22, stiffness: 480, mass: 0.55 }}
        className="fixed z-[9999] w-[220px] backdrop-blur-xl bg-[#121214]/92 text-white border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.65),inset_0_1px_1px_rgba(255,255,255,0.2)] rounded-2xl p-1.5 select-none font-mono text-xs overflow-hidden"
        style={{ left: safeX, top: safeY, transformOrigin: 'top left' }}
      >
        {/* Apple Header */}
        <div className="px-3 py-1.5 mb-1 rounded-xl bg-white/5 border border-white/10 flex justify-between items-center">
          <span className="text-[9px] font-bold tracking-widest text-[#E85D2A] uppercase flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#E85D2A] animate-pulse" />
            {hasSpecificClip ? 'CLIP ACTIONS' : 'TIMELINE MENU'}
          </span>
          <span className="text-[8px] font-mono text-white/40 tracking-wider">NLE 2.0</span>
        </div>

        <div className="space-y-0.5 relative">
          {onSplitClip && (
            <motion.button 
              whileHover={{ scale: 1.025, x: 2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => { onSplitClip(); onClose(); }}
              className="w-full text-left px-2.5 py-1.5 rounded-xl flex justify-between items-center transition-colors cursor-pointer group hover:bg-[#E85D2A] hover:text-white"
            >
              <span className="flex items-center gap-2 font-medium">
                <span className="opacity-70 group-hover:opacity-100 transition-opacity">✂</span> Split at Playhead
              </span>
              <kbd className="text-[8px] bg-white/10 border border-white/10 px-1.5 py-0.5 rounded-md text-white/70 font-mono font-bold group-hover:border-white/30 group-hover:text-white">Ctrl+B</kbd>
            </motion.button>
          )}

          {hasSpecificClip && (
            <>
              <motion.button 
                whileHover={{ scale: 1.025, x: 2 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleDuplicate}
                className="w-full text-left px-2.5 py-1.5 rounded-xl flex justify-between items-center transition-colors cursor-pointer group hover:bg-[#E85D2A] hover:text-white"
              >
                <span className="flex items-center gap-2 font-medium">
                  <span className="opacity-70 group-hover:opacity-100 transition-opacity">📄</span> Duplicate Clip
                </span>
                <kbd className="text-[8px] bg-white/10 border border-white/10 px-1.5 py-0.5 rounded-md text-white/70 font-mono font-bold group-hover:border-white/30 group-hover:text-white">Ctrl+D</kbd>
              </motion.button>

              <motion.button 
                whileHover={{ scale: 1.025, x: 2 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleResetTrim}
                className="w-full text-left px-2.5 py-1.5 rounded-xl flex justify-between items-center transition-colors cursor-pointer group hover:bg-[#E85D2A] hover:text-white"
              >
                <span className="flex items-center gap-2 font-medium">
                  <span className="opacity-70 group-hover:opacity-100 transition-opacity">↺</span> Reset Trim Bounds
                </span>
              </motion.button>

              <div className="h-px bg-white/10 my-1 mx-1" />

              <motion.button 
                whileHover={{ scale: 1.025, x: 2 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleDelete}
                className="w-full text-left px-2.5 py-1.5 rounded-xl flex justify-between items-center text-[#FF5555] hover:bg-[#FF3B30] hover:text-white transition-colors cursor-pointer group"
              >
                <span className="flex items-center gap-2 font-medium">
                  <span className="opacity-70 group-hover:opacity-100 transition-opacity">🗑</span> Delete Clip
                </span>
                <kbd className="text-[8px] bg-white/10 border border-white/10 px-1.5 py-0.5 rounded-md text-white/70 font-mono font-bold group-hover:border-white/30 group-hover:text-white">DEL</kbd>
              </motion.button>
            </>
          )}

          {!hasSpecificClip && (
            <>
              <motion.button 
                whileHover={{ scale: 1.025, x: 2 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleClearAll}
                className="w-full text-left px-2.5 py-1.5 rounded-xl flex justify-between items-center text-[#FF5555] hover:bg-[#FF3B30] hover:text-white transition-colors cursor-pointer group"
              >
                <span className="flex items-center gap-2 font-medium">
                  <span className="opacity-70 group-hover:opacity-100 transition-opacity">🧹</span> Clear All Clips
                </span>
              </motion.button>
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
