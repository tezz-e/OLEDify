import React, { useEffect, useRef, useState } from 'react';
import { DecodedMedia } from '../types/media';
import { CountUp } from './reactbits/CountUp';

interface FrameStripProps {
  media: DecodedMedia | null;
  activeFrameIndex: number;
  trimRange?: { start: number; end: number };
  onFrameSelect: (index: number) => void;
}

export const FrameStrip: React.FC<FrameStripProps> = ({ media, activeFrameIndex, trimRange, onFrameSelect }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [thumbnails, setThumbnails] = useState<string[]>([]);

  useEffect(() => {
    if (!media) {
      setThumbnails([]);
      return;
    }

    // Generate thumbnails (48x24) for the filmstrip
    const generateThumbnails = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 48;
      canvas.height = 24;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = media.sourceInfo.sourceWidth;
      tempCanvas.height = media.sourceInfo.sourceHeight;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return;

      const thumbs: string[] = [];
      for (let i = 0; i < media.frames.length; i++) {
        tempCtx.putImageData(media.frames[i].imageData, 0, 0);
        ctx.clearRect(0, 0, 48, 24);
        ctx.drawImage(tempCanvas, 0, 0, 48, 24);
        thumbs.push(canvas.toDataURL('image/jpeg', 0.5));
      }
      setThumbnails(thumbs);
    };

    generateThumbnails();
  }, [media]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const activeEl = container.children[activeFrameIndex] as HTMLElement;
    if (activeEl) {
      const containerRect = container.getBoundingClientRect();
      const elRect = activeEl.getBoundingClientRect();

      if (elRect.left < containerRect.left || elRect.right > containerRect.right) {
        activeEl.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [activeFrameIndex]);

  if (!media) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-[#6B6B6B] bg-[#F5F0EB]">
        <span className="text-[10px] font-mono uppercase tracking-widest">Awaiting Media</span>
      </div>
    );
  }

  const isExcluded = (index: number) => {
    if (!trimRange) return false;
    return index < trimRange.start || index > trimRange.end;
  };

  const selectedCount = trimRange ? (trimRange.end - trimRange.start + 1) : media.frames.length;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-transparent">
      <div className="px-6 py-4 border-b border-[#1A1A1A] flex justify-between items-center z-10 shrink-0">
        <span className="text-xs font-mono font-bold tracking-widest text-[#1A1A1A] uppercase">Frames</span>
        <span className="text-[10px] font-mono font-bold px-2 py-1 border border-[#1A1A1A] bg-white text-[#1A1A1A] flex items-center gap-1 tabular-nums">
          <CountUp to={selectedCount} duration={0.4} />
          <span>/</span>
          <span>{media.frames.length}</span>
        </span>
      </div>

      <div 
        ref={containerRef}
        className="flex-1 overflow-x-auto flex flex-row items-center px-4 py-8 gap-0 custom-scrollbar bg-[#e5e5e5] shadow-inner"
      >
        <div className="bg-[#1A1A1A] p-1 flex gap-0.5 rounded-sm shadow-xl">
          {thumbnails.map((thumb, index) => {
            const excluded = isExcluded(index);
            const isActive = index === activeFrameIndex;
            return (
              <div
                key={index}
                onClick={() => onFrameSelect(index)}
                className={`relative flex flex-col shrink-0 cursor-pointer ${
                  isActive ? 'z-10' : 'opacity-70 hover:opacity-100'
                }`}
              >
                {isActive && (
                  <>
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-transparent border-t-[#E85D2A] z-20" />
                    <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-[#E85D2A] -translate-x-1/2 pointer-events-none z-20 shadow-[0_0_8px_rgba(232,93,42,0.8)]" />
                    <div className="absolute inset-0 border-2 border-[#E85D2A] pointer-events-none z-20" />
                  </>
                )}
                <div className="h-[64px] aspect-video bg-[#080808] overflow-hidden shrink-0 border border-white/5">
                  <img src={thumb} alt={`Frame ${index}`} className="w-full h-full object-contain" />
                </div>
                <span className={`text-[8px] font-mono mt-1 text-center ${isActive ? 'text-[#E85D2A] font-bold' : 'text-[#6B6B6B]'}`}>
                  {index.toString().padStart(3, '0')}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
