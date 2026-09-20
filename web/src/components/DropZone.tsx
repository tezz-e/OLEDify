import React, { useState, useCallback } from 'react';
import { UploadCloud, FileVideo, CheckCircle2 } from 'lucide-react';
import { DecodedMedia, DecodeProgress } from '../types/media';
import { decodeVideo } from '../engine/mediaDecoder';

interface DropZoneProps {
  onMediaLoaded: (media: DecodedMedia) => void;
  currentMedia: DecodedMedia | null;
}

export const DropZone: React.FC<DropZoneProps> = ({ onMediaLoaded, currentMedia }) => {
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

  // Loaded state
  if (currentMedia && !progress) {
    return (
      <div className="p-3 border-b-2 border-[#1A1A1A] shrink-0">
        <div className="flex items-center space-x-3 mb-2">
          <div className="p-1.5 border border-[#1A1A1A] bg-white">
            <CheckCircle2 className="w-5 h-5 text-[#E85D2A]" />
          </div>
          <div className="overflow-hidden">
            <p className="text-xs font-bold text-[#1A1A1A] truncate font-mono" title={currentMedia.sourceInfo.filename}>
              {currentMedia.sourceInfo.filename}
            </p>
            <p className="text-[10px] font-mono text-[#6B6B6B] mt-0.5">
              {currentMedia.frames.length} frames • {currentMedia.sourceInfo.sourceWidth}×{currentMedia.sourceInfo.sourceHeight}
            </p>
          </div>
        </div>
        <label className="block w-full py-2 text-center tech-btn cursor-pointer">
          REPLACE_MEDIA
          <input type="file" className="hidden" accept="video/mp4,video/webm,image/gif" onChange={handleChange} />
        </label>
      </div>
    );
  }

  // Processing state
  if (progress) {
    return (
      <div className="p-4 border-b-2 border-[#1A1A1A] shrink-0">
        <div className="flex flex-col items-center justify-center py-4 space-y-3">
          <FileVideo className="w-8 h-8 text-[#E85D2A]" />
          <div className="text-center">
            <p className="text-xs font-bold text-[#1A1A1A] mb-1 uppercase tracking-widest font-mono">{progress.stage}...</p>
            <p className="text-[10px] font-mono text-[#6B6B6B]">
              {progress.currentFrame} / {progress.totalFrames || '?'} frames
            </p>
          </div>
          <div className="w-full h-2 bg-[#F5F0EB] border border-[#1A1A1A]">
            <div 
              className="h-full bg-[#E85D2A] transition-all duration-200" 
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Idle dropzone
  return (
    <div className="p-3 border-b-2 border-[#1A1A1A] shrink-0">
      <label
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center p-4 border-2 border-dashed cursor-pointer transition-colors duration-150 ${
          isDragging 
            ? 'border-[#E85D2A] bg-[#E85D2A]/5' 
            : 'border-[#1A1A1A] hover:border-[#E85D2A] hover:bg-[#F5F0EB]'
        }`}
      >
        <UploadCloud className={`w-8 h-8 mb-2 ${isDragging ? 'text-[#E85D2A]' : 'text-[#6B6B6B]'}`} />
        <span className="text-xs font-bold tracking-widest text-[#1A1A1A] mb-1 font-mono uppercase">DROP_MEDIA</span>
        <span className="text-[10px] text-[#6B6B6B] text-center uppercase tracking-widest font-mono">MP4, WEBM, GIF</span>
        <input type="file" className="hidden" accept="video/mp4,video/webm,image/gif" onChange={handleChange} />
      </label>
    </div>
  );
};
