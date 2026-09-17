/**
 * MediaPreview Component (Milestone M1)
 *
 * Displays decoded media stream details, active frame selection,
 * timeline scrubber, thumbnail reel, and interactive Frame Trimmer.
 */

import React, { useState, useEffect } from 'react';
import {
  Film,
  FileImage,
  Layers,
  ChevronLeft,
  ChevronRight,
  Clock,
  Maximize,
  Scissors,
  Check,
} from 'lucide-react';
import { DecodedMedia } from '../types/media';

interface MediaPreviewProps {
  media: DecodedMedia | null;
  activeFrameIndex: number;
  onFrameSelect: (index: number) => void;
  onTrimMedia?: (trimmedMedia: DecodedMedia) => void;
  className?: string;
}

export const MediaPreview: React.FC<MediaPreviewProps> = ({
  media,
  activeFrameIndex,
  onFrameSelect,
  onTrimMedia,
  className = '',
}) => {
  const [trimStart, setTrimStart] = useState<number>(0);
  const [trimEnd, setTrimEnd] = useState<number>(0);
  const [isTrimmed, setIsTrimmed] = useState<boolean>(false);

  useEffect(() => {
    if (media) {
      setTrimStart(0);
      setTrimEnd(media.frames.length - 1);
      setIsTrimmed(false);
    }
  }, [media]);

  if (!media) {
    return (
      <div className={`bg-oled-surface border border-oled-border rounded-xl p-4 text-center text-xs text-oled-muted font-mono ${className}`}>
        No media loaded yet. Ingest an MP4, WebM, GIF, PNG sequence, or frames.h above.
      </div>
    );
  }

  const { sourceInfo, frames } = media;
  const currentFrame = frames[activeFrameIndex] || frames[0];

  const getTypeIcon = () => {
    switch (sourceInfo.type) {
      case 'video':
        return <Film className="w-4 h-4 text-cyan-400" />;
      case 'gif':
        return <FileImage className="w-4 h-4 text-yellow-400" />;
      case 'sequence':
        return <Layers className="w-4 h-4 text-emerald-400" />;
    }
  };

  const handlePrev = () => {
    if (activeFrameIndex > 0) {
      onFrameSelect(activeFrameIndex - 1);
    }
  };

  const handleNext = () => {
    if (activeFrameIndex < frames.length - 1) {
      onFrameSelect(activeFrameIndex + 1);
    }
  };

  const handleApplyTrim = () => {
    if (!onTrimMedia || trimStart >= trimEnd) return;

    const trimmedFrames = frames.slice(trimStart, trimEnd + 1).map((f, i) => ({
      ...f,
      index: i,
    }));

    const updatedMedia: DecodedMedia = {
      ...media,
      sourceInfo: {
        ...sourceInfo,
        frameCount: trimmedFrames.length,
        durationMs: Math.round(trimmedFrames.length * (1000 / sourceInfo.fps)),
      },
      frames: trimmedFrames,
    };

    onTrimMedia(updatedMedia);
    setIsTrimmed(true);
  };

  return (
    <div className={`bg-oled-surface border border-oled-border rounded-xl p-4 space-y-4 ${className}`}>
      {/* Media Metadata Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-oled-border/60 pb-3">
        <div className="flex items-center space-x-2">
          {getTypeIcon()}
          <span className="text-xs font-bold text-slate-200 truncate max-w-[220px]">
            {sourceInfo.filename}
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-oled-panel text-slate-400 border border-oled-border uppercase">
            {sourceInfo.type}
          </span>
        </div>

        <div className="flex items-center space-x-4 text-xs font-mono text-slate-400">
          <span className="flex items-center gap-1">
            <Maximize className="w-3.5 h-3.5 text-slate-500" />
            {sourceInfo.sourceWidth} × {sourceInfo.sourceHeight}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            {(sourceInfo.durationMs / 1000).toFixed(1)}s @ {sourceInfo.fps} FPS
          </span>
        </div>
      </div>

      {/* Frame Scrubber Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-mono">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handlePrev}
              disabled={activeFrameIndex <= 0}
              className="p-1 rounded bg-oled-panel border border-oled-border text-slate-400 hover:text-slate-200 disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={activeFrameIndex >= frames.length - 1}
              className="p-1 rounded bg-oled-panel border border-oled-border text-slate-400 hover:text-slate-200 disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <span className="text-slate-300">
              Frame <strong className="text-oled-cyan">{activeFrameIndex + 1}</strong> of{' '}
              {frames.length}
            </span>
          </div>

          <span className="text-slate-500">
            Timestamp: {(currentFrame ? currentFrame.timestampMs / 1000 : 0).toFixed(2)}s
          </span>
        </div>

        <input
          type="range"
          min="0"
          max={Math.max(0, frames.length - 1)}
          value={activeFrameIndex}
          onChange={(e) => onFrameSelect(parseInt(e.target.value, 10))}
          className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
        />
      </div>

      {/* Interactive Frame Trimmer (Trim Start / End Frames) */}
      <div className="bg-oled-panel border border-oled-border/60 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="flex items-center gap-1.5 text-slate-300 font-bold">
            <Scissors className="w-3.5 h-3.5 text-amber-400" />
            Frame Trimmer (Trim Start / End):
          </span>
          <button
            type="button"
            onClick={handleApplyTrim}
            disabled={trimStart >= trimEnd}
            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-mono cursor-pointer disabled:opacity-40"
          >
            {isTrimmed ? <Check className="w-3 h-3 text-emerald-400" /> : <Scissors className="w-3 h-3" />}
            <span>{isTrimmed ? 'Trimmed!' : `Trim to Frames ${trimStart + 1}–${trimEnd + 1}`}</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 text-[11px] font-mono text-slate-400">
          <div>
            <div className="flex justify-between">
              <span>Start Frame:</span>
              <span className="text-amber-300">#{trimStart + 1}</span>
            </div>
            <input
              type="range"
              min="0"
              max={Math.max(0, trimEnd - 1)}
              value={trimStart}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setTrimStart(val);
                onFrameSelect(val);
              }}
              className="w-full accent-amber-400 h-1 bg-slate-800 rounded cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between">
              <span>End Frame:</span>
              <span className="text-amber-300">#{trimEnd + 1}</span>
            </div>
            <input
              type="range"
              min={Math.min(frames.length - 1, trimStart + 1)}
              max={Math.max(0, frames.length - 1)}
              value={trimEnd}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setTrimEnd(val);
                onFrameSelect(val);
              }}
              className="w-full accent-amber-400 h-1 bg-slate-800 rounded cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Frame Reel Thumbnail Strip */}
      <div className="flex space-x-2 overflow-x-auto py-1 scrollbar-thin scrollbar-thumb-zinc-700">
        {frames.slice(0, 30).map((frame, idx) => {
          const isSelected = idx === activeFrameIndex;
          return (
            <button
              key={frame.index}
              type="button"
              onClick={() => onFrameSelect(idx)}
              className={`shrink-0 w-16 h-10 rounded border transition-all overflow-hidden relative cursor-pointer ${
                isSelected
                  ? 'border-oled-cyan ring-1 ring-oled-cyan'
                  : 'border-oled-border opacity-70 hover:opacity-100'
              }`}
            >
              <span className="absolute bottom-0 right-0 bg-black/80 px-1 text-[9px] font-mono text-slate-300">
                #{idx + 1}
              </span>
            </button>
          );
        })}
        {frames.length > 30 && (
          <div className="shrink-0 flex items-center justify-center px-3 text-[10px] font-mono text-slate-500 bg-oled-panel rounded border border-oled-border">
            +{frames.length - 30} more frames
          </div>
        )}
      </div>
    </div>
  );
};
