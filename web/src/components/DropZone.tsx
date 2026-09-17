/**
 * Drag & Drop Media Ingestion Component (Features F02, F03, F04)
 * Supports MP4, WebM, Animated GIF, PNG/JPEG frame sequences, and C++ Header (frames.h).
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  UploadCloud,
  Film,
  FileImage,
  Code,
  AlertCircle,
  XCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { DecodedMedia, DecodeProgress } from '../types/media';
import { decodeMedia } from '../engine/mediaDecoder';

interface DropZoneProps {
  onMediaLoaded: (media: DecodedMedia) => void;
  currentMedia?: DecodedMedia | null;
  className?: string;
  disabled?: boolean;
}

export const DropZone: React.FC<DropZoneProps> = ({
  onMediaLoaded,
  currentMedia,
  className = '',
  disabled = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isDecoding, setIsDecoding] = useState(false);
  const [progress, setProgress] = useState<DecodeProgress | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [targetFps, setTargetFps] = useState<number>(30);

  const dragCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Process selected or dropped files
  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      if (!files || files.length === 0 || disabled) return;

      setErrorMessage(null);
      setIsDecoding(true);
      setProgress({
        stage: 'reading',
        currentFrame: 0,
        totalFrames: 0,
        percent: 0,
        message: 'Initializing decoder...',
      });

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const decoded = await decodeMedia(files, {
          targetFps,
          maxDimension: 512,
          signal: abortController.signal,
          onProgress: (p) => setProgress(p),
        });

        onMediaLoaded(decoded);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          setErrorMessage('Decoding canceled by user.');
        } else if (err instanceof Error) {
          setErrorMessage(err.message);
        } else {
          setErrorMessage('An unexpected error occurred during media decoding.');
        }
      } finally {
        setIsDecoding(false);
        abortControllerRef.current = null;
      }
    },
    [targetFps, onMediaLoaded, disabled]
  );

  // Cancel in-flight decoding
  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  // Drag & Drop event handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
      e.target.value = ''; // Reset input so same file can be re-selected
    }
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="video/mp4,video/webm,image/gif,image/png,image/jpeg,image/webp,.h,.hpp,.cpp"
        className="hidden"
        onChange={handleFileInputChange}
        disabled={disabled}
      />

      {/* Main Drop Area */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => !isDecoding && !disabled && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-6 transition-all duration-200 cursor-pointer text-center select-none
          ${
            isDragging
              ? 'border-cyan-400 bg-cyan-950/20 shadow-[0_0_25px_rgba(0,240,255,0.3)] scale-[1.01]'
              : 'border-zinc-700 hover:border-zinc-500 bg-zinc-900/60 hover:bg-zinc-900/90'
          }
          ${isDecoding ? 'pointer-events-none cursor-default' : ''}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        {/* Decoding State */}
        {isDecoding && (
          <div className="py-4 space-y-4">
            <div className="flex items-center justify-center space-x-3 text-cyan-400">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="font-medium text-sm sm:text-base">
                {progress?.message || 'Processing media frames...'}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full max-w-md mx-auto bg-zinc-800 rounded-full h-2.5 overflow-hidden border border-zinc-700">
              <div
                className="bg-cyan-400 h-2.5 rounded-full transition-all duration-150 shadow-[0_0_10px_rgba(0,240,255,0.7)]"
                style={{ width: `${progress?.percent || 0}%` }}
              />
            </div>

            <div className="flex items-center justify-between max-w-md mx-auto text-xs text-zinc-400 px-1">
              <span>
                Frame {progress?.currentFrame || 0} / {progress?.totalFrames || 0}
              </span>
              <span>{progress?.percent || 0}%</span>
            </div>

            {/* Cancel Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleCancel();
              }}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-red-400 bg-red-950/40 hover:bg-red-950/70 border border-red-800 rounded-lg transition-colors pointer-events-auto cursor-pointer"
            >
              <XCircle className="w-3.5 h-3.5 mr-1.5" />
              Cancel Ingestion
            </button>
          </div>
        )}

        {/* Idle / Success State */}
        {!isDecoding && (
          <div className="space-y-4 py-2">
            <div className="flex justify-center">
              <div
                className={`p-3.5 rounded-full transition-colors ${
                  isDragging
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'bg-zinc-800 text-zinc-400 group-hover:text-zinc-200'
                }`}
              >
                <UploadCloud className="w-8 h-8" />
              </div>
            </div>

            <div>
              <p className="text-sm sm:text-base font-medium text-zinc-200">
                Drag & drop video reel, GIF, PNG sequence, or <code className="text-cyan-400">frames.h</code>
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                or click anywhere to browse from your computer
              </p>
            </div>

            {/* Supported Format Tags */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-zinc-800/80 text-zinc-300 border border-zinc-700">
                <Code className="w-3 h-3 mr-1 text-cyan-400" /> C++ frames.h (Instant Import)
              </span>

              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-zinc-800/80 text-zinc-300 border border-zinc-700">
                <Film className="w-3 h-3 mr-1 text-cyan-400" /> MP4 / WebM
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-zinc-800/80 text-zinc-300 border border-zinc-700">
                <FileImage className="w-3 h-3 mr-1 text-yellow-400" /> Animated GIF
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Target FPS Selector & Controls Bar */}
      <div className="mt-3 flex items-center justify-between text-xs text-zinc-400 px-1">
        <div className="flex items-center space-x-2">
          <span className="font-mono text-zinc-500">Target Rate:</span>
          <div className="inline-flex rounded-md shadow-sm bg-zinc-900 border border-zinc-800 p-0.5">
            {[15, 20, 24, 30].map((fps) => (
              <button
                key={fps}
                type="button"
                onClick={() => setTargetFps(fps)}
                disabled={isDecoding}
                className={`px-2.5 py-1 text-xs font-mono rounded transition-colors cursor-pointer ${
                  targetFps === fps
                    ? 'bg-cyan-500/20 text-cyan-300 font-semibold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                } ${isDecoding ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {fps} FPS
              </button>
            ))}
          </div>
        </div>

        {currentMedia && !isDecoding && (
          <div className="flex items-center space-x-2 text-zinc-400">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-mono text-[11px] truncate max-w-[180px]">
              {currentMedia.sourceInfo.filename}
            </span>
            <span className="text-zinc-600">|</span>
            <span className="font-mono text-[11px] text-zinc-300">
              {currentMedia.sourceInfo.frameCount} frames
            </span>
          </div>
        )}
      </div>

      {/* Error Feedback Alert */}
      {errorMessage && (
        <div className="mt-3 p-3 bg-red-950/40 border border-red-800/60 rounded-lg flex items-start space-x-2.5 text-red-300 text-xs">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Media Ingestion Failed</p>
            <p className="mt-0.5 text-red-300/80">{errorMessage}</p>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-red-400 hover:text-red-200 shrink-0 ml-1 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
