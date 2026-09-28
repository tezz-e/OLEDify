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

  // Processing state
  if (progress) {
    return (
      <div className="p-4 border-b border-[#E8E5DE] shrink-0 bg-white">
        <div className="flex flex-col items-center justify-center py-2 space-y-2.5">
          <FileVideo className="w-7 h-7 text-[#D97757] animate-pulse" />
          <div className="text-center">
            <p className="text-xs font-sans font-medium text-[#141413] mb-0.5 capitalize">{progress.stage}...</p>
            <p className="text-[11px] font-mono text-[#5E5D59]">
              {progress.currentFrame} / {progress.totalFrames || '?'} frames
            </p>
          </div>
          <div className="w-full h-1.5 bg-[#FAF9F5] border border-[#E8E5DE] rounded-full overflow-hidden">
            <div 
              className="h-full bg-[#D97757] transition-all duration-200 rounded-full" 
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Idle dropzone (Always available to add more media)
  return (
    <div className="p-3 border-b border-[#E8E5DE] shrink-0 bg-[#FAF9F5]/40">
      <label
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center p-3.5 border border-dashed rounded-xl cursor-pointer transition-all duration-200 ${
          isDragging 
            ? 'border-[#D97757] bg-[#FAF0EB]' 
            : 'border-[#E8E5DE] hover:border-[#D97757] hover:bg-white'
        }`}
      >
        <UploadCloud className={`w-6 h-6 mb-1.5 transition-colors ${isDragging ? 'text-[#D97757]' : 'text-[#87867F]'}`} />
        <span className="text-xs font-sans font-medium text-[#141413] mb-0.5">Drop media or browse</span>
        <span className="text-[10px] text-[#87867F] font-sans">MP4, WebM, animated GIF, or .h</span>
        <input type="file" className="hidden" accept="video/mp4,video/webm,image/gif,.h" onChange={handleChange} />
      </label>
    </div>
  );
};
