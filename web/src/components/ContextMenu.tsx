import React, { useEffect, useRef } from 'react';
import { TimelineClip } from '../types/media';

interface ContextMenuProps {
  x: number;
  y: number;
  clipId: string;
  clips: TimelineClip[];
  onClipsChange: (clips: TimelineClip[]) => void;
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, clipId, clips, onClipsChange, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleDelete = () => {
    onClipsChange(clips.filter(c => c.id !== clipId));
    onClose();
  };

  const handleDuplicate = () => {
    const clipToDup = clips.find(c => c.id === clipId);
    if (!clipToDup) return;
    
    const newClip = {
      ...clipToDup,
      id: "clip_" + Date.now()
    };
    
    const index = clips.findIndex(c => c.id === clipId);
    const newClips = [...clips];
    newClips.splice(index + 1, 0, newClip);
    onClipsChange(newClips);
    onClose();
  };

  return (
    <div 
      ref={menuRef}
      className="fixed z-[100] w-48 bg-white border-2 border-[#1A1A1A] shadow-[4px_4px_0_0_#1A1A1A]"
      style={{ left: Math.min(x, window.innerWidth - 200), top: Math.min(y, window.innerHeight - 150) }}
    >
      <div className="px-3 py-2 bg-[#F5F0EB] border-b-2 border-[#1A1A1A]">
        <span className="text-[10px] font-mono font-bold tracking-widest text-[#1A1A1A] uppercase">CLIP OPTIONS</span>
      </div>
      <div className="flex flex-col p-1">
        <button 
          onClick={handleDuplicate}
          className="text-left px-3 py-2 text-xs font-mono font-bold text-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white transition-colors"
        >
          DUPLICATE
        </button>
        <button 
          onClick={handleDelete}
          className="text-left px-3 py-2 text-xs font-mono font-bold text-[#E85D2A] hover:bg-[#E85D2A] hover:text-white transition-colors"
        >
          DELETE
        </button>
      </div>
    </div>
  );
};
