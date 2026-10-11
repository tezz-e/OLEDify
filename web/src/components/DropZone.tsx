import React, { useState, useCallback } from 'react';
import { UploadCloud, FileVideo, CheckCircle2 } from 'lucide-react';
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

  // Idle dropzone (Always available to add more media)
  return (
    <div className="p-3 border-b border-white/[0.08] shrink-0">
      <label
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`relative overflow-hidden flex flex-col items-center justify-center p-4 border border-dashed rounded-[8px] cursor-pointer transition-colors duration-150 ${
          isDragging 
            ? 'border-[#FF5500] bg-[#FF5500]/10' 
            : 'border-white/[0.08] hover:border-white/20 hover:bg-white/[0.02]'
        }`}
      >
        <Spotlight size={180} />
        <UploadCloud className={`w-7 h-7 mb-2 transition-colors ${
          isDragging ? 'text-[#FF5500]' : 'text-[var(--hw-text-secondary)]'
        }`} />
        <span className="text-xs font-semibold mb-1 font-sans text-[var(--hw-text-primary)]">
          Import media
        </span>
        <span className="text-[11px] text-center font-sans text-[var(--hw-text-secondary)]">
          MP4, WebM, GIF, or APNG
        </span>
        <input type="file" className="hidden" accept="video/mp4,video/webm,image/gif,.h,.json,application/json" onChange={handleChange} />
      </label>
    </div>
  );
};
