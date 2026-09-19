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

  // State: Loaded
  if (currentMedia && !progress) {
    return (
      <div className="p-4 border-b border-oled-border bg-oled-surface shrink-0">
        <div className="flex items-center space-x-3 mb-3">
          <div className="p-2 bg-emerald-500/10 rounded border border-emerald-500/20">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="overflow-hidden">
            <p className="text-xs font-semibold text-slate-200 truncate" title={currentMedia.sourceInfo.filename}>
              {currentMedia.sourceInfo.filename}
            </p>
            <p className="text-[10px] font-mono text-slate-500">
              {currentMedia.frames.length} frames • {currentMedia.sourceInfo.sourceWidth}×{currentMedia.sourceInfo.sourceHeight}
            </p>
          </div>
        </div>
        <label className="block w-full py-1.5 text-center bg-oled-panel hover:bg-oled-border-bright border border-oled-border rounded text-xs font-medium text-slate-300 transition-colors cursor-pointer">
          Replace Media
          <input type="file" className="hidden" accept="video/mp4,video/webm,image/gif" onChange={handleChange} />
        </label>
      </div>
    );
  }

  // State: Processing
  if (progress) {
    return (
      <div className="p-4 border-b border-oled-border bg-oled-surface shrink-0">
        <div className="flex flex-col items-center justify-center py-4 space-y-3">
          <FileVideo className="w-8 h-8 text-oled-cyan animate-pulse" />
          <div className="text-center">
            <p className="text-xs font-semibold text-slate-200 mb-1 capitalize">{progress.stage}...</p>
            <p className="text-[10px] font-mono text-slate-500">
              {progress.currentFrame} / {progress.totalFrames || '?'} frames
            </p>
          </div>
          <div className="w-full h-1.5 bg-oled-bg rounded-full overflow-hidden border border-oled-border">
            <div 
              className="h-full bg-oled-cyan transition-all duration-200" 
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  // State: Idle Dropzone
  return (
    <div className="p-4 border-b border-oled-border bg-oled-surface shrink-0">
      <label
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
          isDragging 
            ? 'border-oled-cyan bg-cyan-500/10' 
            : 'border-oled-border hover:border-slate-500 hover:bg-oled-panel'
        }`}
      >
        <UploadCloud className={`w-8 h-8 mb-2 ${isDragging ? 'text-oled-cyan' : 'text-slate-400'}`} />
        <span className="text-xs font-medium text-slate-300 mb-1">Drop video or GIF</span>
        <span className="text-[10px] text-slate-500 text-center">MP4, WebM, GIF</span>
        <input type="file" className="hidden" accept="video/mp4,video/webm,image/gif" onChange={handleChange} />
      </label>
    </div>
  );
};
