import React, { useState, useCallback } from 'react';
import { FileVideo } from 'lucide-react';
import { Drawer } from '@lucasmarkes/hairline/react';
import { DecodedMedia, DecodeProgress } from '../types/media';
import { decodeVideo } from '../engine/mediaDecoder';
import { Spotlight } from './ui/Spotlight';

interface DropZoneProps {
  onMediaLoaded: (media: DecodedMedia) => void;
  currentMedia: DecodedMedia | null;
  themeMode?: 'light' | 'dark';
}

export const DropZone: React.FC<DropZoneProps> = ({ onMediaLoaded, currentMedia, themeMode = 'light' }) => {
  const isDark = themeMode === 'dark';
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState<DecodeProgress | null>(null);
  const [drawerReadout, setDrawerReadout] = useState<string>('rest');

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setIsDragging(true);
    else if (e.type === 'dragleave') setIsDragging(false);
  }, []);

  const processFile = async (file: File) => {
    setProgress({ stage: 'reading', currentFrame: 0, totalFrames: 0, percent: 0 });
    try {
      const media = await decodeVideo(file, {
        onProgress: setProgress,
        targetFps: 30,
      });
      onMediaLoaded(media);
    } catch (error) {
      console.error(error);
      alert('Failed to process media.');
    } finally {
      setProgress(null);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  // Processing state
  if (progress) {
    return (
      <div className="p-4 border-b border-white/[0.08] shrink-0">
        <div className="flex flex-col items-center justify-center py-4 space-y-3">
          <FileVideo className="w-7 h-7 text-[#FF5500]" />
          <div className="text-center">
            <p className="text-xs font-semibold mb-1 capitalize font-sans text-[var(--hw-text-primary)]">
              {progress.stage}...
            </p>
            <p className="text-xs font-mono text-[var(--hw-text-secondary)]">
              {progress.currentFrame} / {progress.totalFrames || '?'} frames
            </p>
          </div>
          <div className="w-full h-2 border border-white/[0.08] rounded-[8px] overflow-hidden bg-[var(--hw-bg-canvas)]">
            <div 
              className="h-full bg-[#FF5500] transition-all duration-200" 
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Idle dropzone with official Hairline Drawer component
  return (
    <div className="p-3 border-b border-[var(--hw-border-hairline)] shrink-0">
      <label
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`relative overflow-hidden flex flex-col items-center justify-center p-3 border border-dashed rounded-[10px] cursor-pointer transition-all duration-200 group ${
          isDragging 
            ? 'border-[#FF5500] bg-[#FF5500]/10 scale-[1.02] shadow-[0_0_24px_rgba(255,85,0,0.2),inset_0_1px_0_rgba(255,255,255,0.2)]' 
            : (isDark
                ? 'border-white/[0.08] hover:border-white/20 hover:bg-white/[0.02]'
                : 'border-black/[0.12] hover:border-black/25 hover:bg-black/[0.02]')
        }`}
        style={{
          ['--hairline-plate' as any]: isDark ? '#141416' : '#EAE7E1',
          ['--hairline-hi' as any]: '#FF5500',
          ['--hairline-edge' as any]: isDark ? '#FFFFFF' : '#27272A',
          ['--hairline-mid' as any]: isDark ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.55)',
          ['--hairline-lo' as any]: isDark ? 'rgba(255, 255, 255, 0.35)' : 'rgba(0, 0, 0, 0.25)',
          ['--hairline-stroke' as any]: 1.1,
        }}
      >
        <Spotlight size={180} />
        
        {/* Hairline Drawer Figure: Filing cabinet with three drawers and dividers */}
        <div className="w-full h-28 relative flex items-center justify-center mb-1 pointer-events-auto">
          <Drawer 
            theme={isDark ? 'dark' : 'light'}
            intensity={isDragging ? 1.0 : 0.6}
            onRead={setDrawerReadout}
            className="w-full h-full"
          />
        </div>

        <div className="flex items-center gap-1.5 mb-0.5">
          <span
            className={`w-1.5 h-1.5 rounded-full transition-colors ${
              isDragging ? 'bg-[#FF5500]' : 'bg-zinc-500'
            }`}
          />
          <span className="text-xs font-semibold font-sans text-[var(--hw-text-primary)]">
            {isDragging ? 'Drop to archive clip' : 'Import media pool'}
          </span>
        </div>

        <span className="text-[11px] text-center font-sans text-[var(--hw-text-secondary)]">
          {drawerReadout !== 'rest' ? drawerReadout : 'MP4, WebM, GIF, or APNG'}
        </span>
        <input type="file" className="hidden" accept="video/mp4,video/webm,image/gif,.h,.json,application/json" onChange={handleChange} />
      </label>
    </div>
  );
};
