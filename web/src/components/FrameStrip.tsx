import React, { useEffect, useRef, useState } from 'react';
import { DecodedMedia } from '../types/media';

interface FrameStripProps {
  media: DecodedMedia | null;
  activeFrameIndex: number;
  onFrameSelect: (index: number) => void;
}

export const FrameStrip: React.FC<FrameStripProps> = ({ media, activeFrameIndex, onFrameSelect }) => {
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

      // Temporary canvas to put the full size ImageData before scaling
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = media.sourceInfo.sourceWidth;
      tempCanvas.height = media.sourceInfo.sourceHeight;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return;

      const thumbs: string[] = [];
      // We might not want to generate 1000s of data URLs synchronously.
      // For performance, we'll do all of them if < 300, or a subset.
      // But for this simple tool, generating dataURLs for all frames is usually fast enough for short reels.
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
    // Auto-scroll to keep active frame in view if playing
    const container = containerRef.current;
    if (!container) return;
    
    const activeEl = container.children[activeFrameIndex] as HTMLElement;
    if (activeEl) {
      const containerRect = container.getBoundingClientRect();
      const elRect = activeEl.getBoundingClientRect();

      if (elRect.top < containerRect.top || elRect.bottom > containerRect.bottom) {
        activeEl.scrollIntoView({ block: 'nearest', behavior: 'auto' });
      }
    }
  }, [activeFrameIndex]);

  if (!media) {
    return (
      <div className="flex-1 bg-oled-bg flex items-center justify-center text-[10px] font-mono text-oled-muted p-4 text-center">
        No frames loaded
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-oled-surface">
      <div className="px-4 py-2 border-b border-oled-border flex justify-between items-center bg-oled-surface z-10 shrink-0">
        <span className="text-xs font-semibold text-slate-300">Frames</span>
        <span className="text-[10px] font-mono text-oled-cyan bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">
          {media.frames.length}
        </span>
      </div>

      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto p-2 space-y-1.5 hide-scrollbar"
      >
        {thumbnails.map((thumb, index) => (
          <div
            key={index}
            onClick={() => onFrameSelect(index)}
            className={`relative flex items-center p-1 rounded cursor-pointer transition-colors ${
              index === activeFrameIndex 
                ? 'bg-cyan-500/20 border border-oled-cyan' 
                : 'border border-transparent hover:bg-oled-panel'
            }`}
          >
            <span className={`w-8 text-right text-[9px] font-mono pr-2 ${
              index === activeFrameIndex ? 'text-oled-cyan font-bold' : 'text-slate-500'
            }`}>
              {index}
            </span>
            <div className="w-[48px] h-[24px] bg-black rounded-sm border border-slate-800 overflow-hidden shrink-0">
              <img src={thumb} alt={`Frame ${index}`} className="w-full h-full object-cover" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
