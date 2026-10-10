import React, { useState, useCallback } from 'react';
import { UploadCloud, FileVideo, CheckCircle2 } from 'lucide-react';
import { DecodedMedia, DecodeProgress } from '../types/media';
import { decodeVideo } from '../engine/mediaDecoder';

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
      <div className={`p-4 border-b shrink-0 ${isDark ? 'border-white/10' : 'border-[#1A1A1A]'}`}>
        <div className="flex flex-col items-center justify-center py-4 space-y-3">
          <FileVideo className={`w-8 h-8 ${isDark ? 'text-[#00FF66]' : 'text-[#FF5500]'}`} />
          <div className="text-center">
            <p className={`text-xs font-bold mb-1 uppercase tracking-widest font-mono ${
              isDark ? 'text-[#FAFAFA]' : 'text-[#1A1A1A]'
            }`}>{progress.stage}...</p>
            <p className={`text-[10px] font-mono ${isDark ? 'text-[#71717A]' : 'text-[#6B6B6B]'}`}>
              {progress.currentFrame} / {progress.totalFrames || '?'} frames
            </p>
          </div>
          <div className={`w-full h-2 border rounded-[4px] overflow-hidden ${isDark ? 'bg-[#282A2E] border-white/10' : 'bg-[#F5F0EB] border-[#1A1A1A]'}`}>
            <div 
              className={`h-full transition-all duration-200 ${isDark ? 'bg-[#00FF66]' : 'bg-[#FF5500]'}`} 
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Idle dropzone (Always available to add more media)
  return (
    <div className={`p-3 border-b shrink-0 ${isDark ? 'border-white/10' : 'border-[#1A1A1A]'}`}>
      <label
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center p-4 border border-dashed rounded-[4px] cursor-pointer transition-colors duration-150 ${
          isDragging 
            ? isDark ? 'border-[#FF5500] bg-[#FF5500]/10' : 'border-[#FF5500] bg-[#FF5500]/5' 
            : isDark ? 'border-white/10 hover:border-[#FF5500]/60 hover:bg-white/[0.03]' : 'border-[#1A1A1A] hover:border-[#FF5500] hover:bg-[#F5F0EB]'
        }`}
      >
        <UploadCloud className={`w-8 h-8 mb-2 transition-colors ${
          isDragging 
            ? 'text-[#FF5500]' 
            : isDark ? 'text-[#71717A] hover:text-[#FF5500]' : 'text-[#6B6B6B]'
        }`} />
        <span className={`text-xs font-bold tracking-widest mb-1 font-mono uppercase ${
          isDark ? 'text-[#FAFAFA]' : 'text-[#1A1A1A]'
        }`}>IMPORT_MEDIA</span>
        <span className={`text-[10px] text-center uppercase tracking-widest font-mono ${
          isDark ? 'text-[#71717A]' : 'text-[#6B6B6B]'
        }`}>MP4, WEBM, GIF, .H, .JSON</span>
        <input type="file" className="hidden" accept="video/mp4,video/webm,image/gif,.h,.json,application/json" onChange={handleChange} />
      </label>
    </div>
  );
};
