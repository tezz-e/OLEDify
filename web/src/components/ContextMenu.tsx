import React, { useEffect, useRef } from 'react';
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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
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

  const menuWidth = 210;
  const menuHeight = 180;
  const safeX = Math.max(10, Math.min(x, window.innerWidth - menuWidth - 10));
  const safeY = Math.max(10, Math.min(y, window.innerHeight - menuHeight - 10));

  return (
    <div 
      ref={menuRef}
      className="fixed z-[9999] w-[210px] bg-[#1A1A1A] text-white border-2 border-[#E85D2A] shadow-[0_10px_25px_rgba(0,0,0,0.5)] font-mono text-xs select-none"
      style={{ left: safeX, top: safeY }}
    >
      <div className="px-3 py-1.5 bg-[#2A2A2A] border-b border-[#333] flex justify-between items-center">
        <span className="text-[9px] font-bold tracking-widest text-[#E85D2A] uppercase">
          {hasSpecificClip ? 'CLIP OPTIONS' : 'TIMELINE MENU'}
        </span>
        <span className="text-[8px] text-[#888]">NLE EDIT</span>
      </div>

      <div className="p-1 space-y-0.5">
        {onSplitClip && (
          <button 
            onClick={() => { onSplitClip(); onClose(); }}
            className="w-full text-left px-2.5 py-1.5 flex justify-between items-center hover:bg-[#E85D2A] hover:text-white transition-colors cursor-pointer group"
          >
            <span>✂ Split at Playhead</span>
            <span className="text-[8px] bg-black/40 px-1 py-0.5 rounded text-[#AAA] group-hover:text-white font-bold">Ctrl+B</span>
          </button>
        )}

        {hasSpecificClip && (
          <>
            <button 
              onClick={handleDuplicate}
              className="w-full text-left px-2.5 py-1.5 flex justify-between items-center hover:bg-[#E85D2A] hover:text-white transition-colors cursor-pointer group"
            >
              <span>📄 Duplicate Clip</span>
              <span className="text-[8px] bg-black/40 px-1 py-0.5 rounded text-[#AAA] group-hover:text-white font-bold">Ctrl+D</span>
            </button>

            <button 
              onClick={handleResetTrim}
              className="w-full text-left px-2.5 py-1.5 flex justify-between items-center hover:bg-[#E85D2A] hover:text-white transition-colors cursor-pointer group"
            >
              <span>↺ Reset Trim Bounds</span>
            </button>

            <div className="h-px bg-[#333] my-1" />

            <button 
              onClick={handleDelete}
              className="w-full text-left px-2.5 py-1.5 flex justify-between items-center text-[#FF5555] hover:bg-[#FF5555] hover:text-white transition-colors cursor-pointer group"
            >
              <span>🗑 Delete Clip</span>
              <span className="text-[8px] bg-black/40 px-1 py-0.5 rounded text-[#AAA] group-hover:text-white font-bold">DEL</span>
            </button>
          </>
        )}

        {!hasSpecificClip && (
          <>
            <button 
              onClick={handleClearAll}
              className="w-full text-left px-2.5 py-1.5 flex justify-between items-center text-[#FF5555] hover:bg-[#FF5555] hover:text-white transition-colors cursor-pointer group"
            >
              <span>🧹 Clear All Clips</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};
