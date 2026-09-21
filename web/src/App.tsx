import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Header } from './components/Header';
import { SettingsModal } from './components/SettingsModal';
import { DropZone } from './components/DropZone';
import { TimelineTrack } from './components/TimelineTrack';
import { OledCanvas } from './components/OledCanvas';
import { PlaybackBar } from './components/PlaybackBar';
import { DitherControls } from './components/DitherControls';
import { CropControls } from './components/CropControls';
import { ExportModal } from './components/ExportModal';
import { DecryptedText } from './components/reactbits/DecryptedText';
import { CountUp } from './components/reactbits/CountUp';
import Particles from './components/reactbits/Particles';
import { BlueprintHoverCard } from './components/reactbits/BlueprintHoverCard';

const themePalettes: Record<PhosphorTheme, string[]> = {
  cyan: ['#00F0FF', '#083B44', '#E0DBD5'],
  white: ['#FFFFFF', '#4A4A4A', '#E0DBD5'],
  amber: ['#FFB000', '#592B02', '#E0DBD5'],
  green: ['#00FF66', '#023D18', '#E0DBD5'],
  'yellow-blue': ['#00E5FF', '#FFCC00', '#1A1A1A']
};

import { DecodedMedia, CropSettings, TimelineClip, MediaAsset, ExtractedFrame } from './types/media';
import { DitherConfig, PhosphorTheme } from './types/dither';
import { HardwareConfig } from './types/oled';

import { applyDithering, generateCppHeader } from './engine/ditherEngine';
import { serialStreamer } from './engine/webSerialStreamer';
import { renderCropTo128x64, imageDataToCanvas, computeCoverCrop } from './engine/cropEngine';
import { generateSampleMedia, SamplePresetType } from './engine/sampleGenerator';

export default function App() {
  // --- STATE ---
  // Media & Playback
  const [assets, setAssets] = useState<Record<string, MediaAsset>>({});
  const [clips, setClips] = useState<TimelineClip[]>([]);
  const [activeFrameIndex, setActiveFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [targetFps, setTargetFps] = useState(30);
  const [processedFrame, setProcessedFrame] = useState<ImageData | null>(null);

  // Undo / Redo
  const [clipHistory, setClipHistory] = useState<TimelineClip[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // UI State
  const [mediaPoolTab, setMediaPoolTab] = useState<'import' | 'samples' | 'recent'>('import');
  const [serialConnected, setSerialConnected] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [rawSourceFrame, setRawSourceFrame] = useState<ImageData | null>(null);
  const [previewFitMode, setPreviewFitMode] = useState<'contain' | 'cover'>('cover');
  const [cppCode, setCppCode] = useState('');
  const [exportXbmpFrames, setExportXbmpFrames] = useState<Uint8Array[]>([]);

  const fullPreviewCanvasRef = useRef<HTMLCanvasElement>(null);
  const lastStreamTime = useRef(0);

  // WebSerial Auto Disconnect Handler
  useEffect(() => {
    serialStreamer.setOnDisconnect(() => setSerialConnected(false));
  }, []);

  const setClipsWithHistory = useCallback((next: TimelineClip[] | ((prev: TimelineClip[]) => TimelineClip[])) => {
    setClips(prev => {
      const resolved = typeof next === 'function' ? next(prev) : next;
      setClipHistory(h => {
        const trimmed = h.slice(0, historyIndex + 1);
        return [...trimmed, resolved].slice(-50); // cap at 50 entries
      });
      setHistoryIndex(i => Math.min(i + 1, 49));
      return resolved;
    });
  }, [historyIndex]);

  const handleUndo = useCallback(() => {
    setHistoryIndex(i => {
      const next = Math.max(0, i - 1);
      setClipHistory(h => { setClips(h[next] ?? []); return h; });
      return next;
    });
  }, []);

  const handleRedo = useCallback(() => {
    setHistoryIndex(i => {
      setClipHistory(h => {
        const next = Math.min(h.length - 1, i + 1);
        setClips(h[next] ?? []); 
        return h;
      });
      return Math.min(clipHistory.length - 1, i + 1);
    });
  }, [clipHistory.length]);

  // Advanced Timeline State
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>([]);
  const [previewOverride, setPreviewOverride] = useState<{assetId: string, frameIndex: number} | null>(null);

  const timelineMedia = useMemo(() => {
    if (clips.length === 0) return null;
    const frames: ExtractedFrame[] = [];
    let frameIndex = 0;
    
    clips.forEach(clip => {
      const asset = assets[clip.assetId];
      if (asset && asset.media) {
        for (let i = clip.inFrame; i <= clip.outFrame; i++) {
          if (asset.media.frames[i]) {
            frames.push({
               ...asset.media.frames[i],
               index: frameIndex++
            });
          }
        }
      }
    });

    if (frames.length === 0) return null;

    const firstAsset = assets[clips[0].assetId];
    return {
       sourceInfo: {
          ...firstAsset.media.sourceInfo,
          frameCount: frames.length
       },
       frames
    } as DecodedMedia;
  }, [clips, assets]);

  // Derived state to retain compatibility
  const media = timelineMedia;

  // Configuration
  const [ditherConfig, setDitherConfig] = useState<DitherConfig>({
    algorithm: 'atkinson',
    brightness: 0,
    contrast: 0,
    threshold: 128,
    invert: false,
    theme: 'cyan',
  });
  const [cropSettings, setCropSettings] = useState<CropSettings>({
    mode: 'cover',
    x: 0, y: 0, width: 128, height: 64, sourceWidth: 128, sourceHeight: 64, smoothing: true
  });
  const [hardwareConfig, setHardwareConfig] = useState<HardwareConfig>({
    mcu: 'esp32-s3', display: 'sh1106', sdaPin: 8, sclPin: 9, i2cAddress: '0x3C'
  });

  // --- INITIALIZATION ---
  const handleMediaLoaded = (newMedia: DecodedMedia) => {
    const assetId = "asset_" + Date.now();
    const clipId = "clip_" + Date.now();
    
    setAssets(prev => ({ ...prev, [assetId]: { id: assetId, media: newMedia } }));
    setClipsWithHistory(prev => [...prev, { id: clipId, assetId, inFrame: 0, outFrame: newMedia.frames.length - 1 }]);
    setActiveFrameIndex(0);
    
    setCropSettings(prev => {
      const cover = computeCoverCrop(newMedia.sourceInfo.sourceWidth, newMedia.sourceInfo.sourceHeight);
      return {
        ...prev,
        sourceWidth: newMedia.sourceInfo.sourceWidth,
        sourceHeight: newMedia.sourceInfo.sourceHeight,
        x: cover.x,
        y: cover.y,
        width: cover.width,
        height: cover.height
      };
    });
  };

  const handleLoadSample = useCallback((sampleType: SamplePresetType, mode: 'append' | 'replace' = 'append') => {
    const newMedia = generateSampleMedia(sampleType);
    const assetId = "asset_" + sampleType + "_" + Date.now();
    const clipId = "clip_" + Date.now();
    
    setAssets(prev => ({ ...prev, [assetId]: { id: assetId, media: newMedia } }));
    
    if (mode === 'replace') {
      setClipsWithHistory([{ id: clipId, assetId, inFrame: 0, outFrame: newMedia.frames.length - 1 }]);
      setActiveFrameIndex(0);
      setIsPlaying(false);
    } else {
      setClipsWithHistory(prev => [...prev, { id: clipId, assetId, inFrame: 0, outFrame: newMedia.frames.length - 1 }]);
    }
    
    setCropSettings(prev => {
      const cover = computeCoverCrop(newMedia.sourceInfo.sourceWidth, newMedia.sourceInfo.sourceHeight);
      return {
        ...prev,
        sourceWidth: newMedia.sourceInfo.sourceWidth,
        sourceHeight: newMedia.sourceInfo.sourceHeight,
        x: cover.x,
        y: cover.y,
        width: cover.width,
        height: cover.height
      };
    });
  }, [setClipsWithHistory]);

  const handleAddAssetToTimeline = useCallback((assetId: string) => {
    const sampleIds = ['dino', 'heartbeat', 'spinner', 'wificonnect', 'bouncing', 'pacman', 'battery', 'sinewave', 'ripple', 'analogclock', 'starfield', 'matrix', 'rain', 'badapple'];
    if (sampleIds.includes(assetId)) {
      handleLoadSample(assetId as any, 'append');
      return;
    }
    const asset = assets[assetId];
    if (!asset) return;
    const clipId = "clip_" + Date.now();
    setClipsWithHistory(prev => [...prev, { id: clipId, assetId, inFrame: 0, outFrame: asset.media.frames.length - 1 }]);
  }, [assets, setClipsWithHistory, handleLoadSample]);

  const handleReplaceTimelineWithAsset = useCallback((assetId: string) => {
    const sampleIds = ['dino', 'heartbeat', 'spinner', 'wificonnect', 'bouncing', 'pacman', 'battery', 'sinewave', 'ripple', 'analogclock', 'starfield', 'matrix', 'rain', 'badapple'];
    if (sampleIds.includes(assetId)) {
      handleLoadSample(assetId as any, 'replace');
      return;
    }
    const asset = assets[assetId];
    if (!asset) return;
    const clipId = "clip_" + Date.now();
    setClipsWithHistory([{ id: clipId, assetId, inFrame: 0, outFrame: asset.media.frames.length - 1 }]);
    setActiveFrameIndex(0);
    setIsPlaying(false);
  }, [assets, setClipsWithHistory, handleLoadSample]);

  // Sample Thumbnails cache for NLE Grid Bin
  const sampleThumbnails = useMemo(() => {
    const samples = ['dino', 'heartbeat', 'spinner', 'wificonnect', 'bouncing', 'pacman', 'battery', 'sinewave', 'ripple', 'analogclock', 'starfield', 'matrix', 'rain', 'badapple'] as const;
    const map: Record<string, string> = {};
    samples.forEach(id => {
      const media = generateSampleMedia(id as any);
      const frame = media.frames[Math.min(10, media.frames.length - 1)];
      if (frame) {
        const canvas = document.createElement('canvas');
        canvas.width = frame.imageData.width;
        canvas.height = frame.imageData.height;
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.putImageData(frame.imageData, 0, 0);
        map[id] = canvas.toDataURL();
      }
    });
    return map;
  }, []);

  // Trimming is now handled at the clip level

  // --- PLAYBACK ENGINE & HOTKEYS ---
  const handleSplitClip = useCallback(() => {
    if (!timelineMedia || clips.length === 0) return;
    
    let framesBefore = 0;
    let targetClipIndex = -1;
    let localFrameIndex = -1;

    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      const clipLength = clip.outFrame - clip.inFrame + 1;
      
      if (activeFrameIndex >= framesBefore && activeFrameIndex < framesBefore + clipLength) {
        targetClipIndex = i;
        localFrameIndex = activeFrameIndex - framesBefore;
        break;
      }
      framesBefore += clipLength;
    }

    // Only split if we are not at the very start of the clip
    if (targetClipIndex !== -1 && localFrameIndex > 0) {
      const clipToSplit = clips[targetClipIndex];
      const splitPointInAsset = clipToSplit.inFrame + localFrameIndex;

      const newClip1 = {
        ...clipToSplit,
        outFrame: splitPointInAsset - 1
      };

      const newClip2 = {
        id: "clip_" + Date.now(),
        assetId: clipToSplit.assetId,
        inFrame: splitPointInAsset,
        outFrame: clipToSplit.outFrame
      };

      const newClips = [...clips];
      newClips.splice(targetClipIndex, 1, newClip1, newClip2);
      setClips(newClips);
    }
  }, [clips, activeFrameIndex, timelineMedia]);

  // Global native right-click prevention
  useEffect(() => {
    const suppressNativeContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    window.addEventListener('contextmenu', suppressNativeContextMenu, { capture: true });
    return () => window.removeEventListener('contextmenu', suppressNativeContextMenu, { capture: true });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input or textarea
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;

      // 1. Split Clip: Ctrl+B, Cmd+B, Ctrl+K, Cmd+K, or 'S'
      if ((isCmdOrCtrl && (e.key === 'b' || e.key === 'B' || e.key === 'k' || e.key === 'K')) || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        handleSplitClip();
        return;
      }

      // 2. Play / Pause: Spacebar
      if (e.code === 'Space' || e.key === ' ' || e.keyCode === 32) {
        e.preventDefault();
        e.stopPropagation();
        (document.activeElement as HTMLElement)?.blur();
        setIsPlaying(p => !p);
        return;
      }

      // 3. Step 1 Frame Left / Right Arrow
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setIsPlaying(false);
        setActiveFrameIndex(prev => Math.max(0, prev - 1));
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setIsPlaying(false);
        const maxLen = (timelineMedia?.frames.length ?? media?.frames.length ?? 1) - 1;
        setActiveFrameIndex(prev => Math.min(maxLen, prev + 1));
        return;
      }

      // 4. Jump to Start / End: Home / End
      if (e.key === 'Home') {
        e.preventDefault();
        setIsPlaying(false);
        setActiveFrameIndex(0);
        return;
      }
      if (e.key === 'End') {
        e.preventDefault();
        setIsPlaying(false);
        const maxLen = (timelineMedia?.frames.length ?? media?.frames.length ?? 1) - 1;
        setActiveFrameIndex(maxLen);
        return;
      }

      // 5. Delete Selected Clips: Delete or Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedClipIds.length > 0) {
          e.preventDefault();
          setClipsWithHistory(prev => prev.filter(c => !selectedClipIds.includes(c.id)));
          setSelectedClipIds([]);
        }
        return;
      }

      // 6. Duplicate Selected Clip: Ctrl+D / Cmd+D
      if (isCmdOrCtrl && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        if (selectedClipIds.length > 0) {
          setClipsWithHistory(prev => {
            const newClips = [...prev];
            selectedClipIds.forEach(id => {
              const idx = newClips.findIndex(c => c.id === id);
              if (idx !== -1) {
                const dup = { ...newClips[idx], id: "clip_" + Date.now() + "_" + Math.random().toString(36).substring(2, 5) };
                newClips.splice(idx + 1, 0, dup);
              }
            });
            return newClips;
          });
        }
        return;
      }

      // 7. Select All: Ctrl+A / Cmd+A
      if (isCmdOrCtrl && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        setSelectedClipIds(clips.map(c => c.id));
        return;
      }

      // 8. Deselect All: Escape
      if (e.key === 'Escape') {
        setSelectedClipIds([]);
        return;
      }

      // 9. Undo / Redo
      if (isCmdOrCtrl && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }
      if (isCmdOrCtrl && (e.key === 'y' || e.key === 'Y' || ((e.key === 'z' || e.key === 'Z') && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
        return;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ' || e.keyCode === 32) {
        if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('keyup', handleKeyUp, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('keyup', handleKeyUp, { capture: true });
    };
  }, [handleSplitClip, handleUndo, handleRedo, media, timelineMedia, selectedClipIds, clips, setClipsWithHistory]);

  useEffect(() => {
    const activeMedia = timelineMedia || media;
    if (!isPlaying || !activeMedia || activeMedia.frames.length === 0) return;
    let lastTime = 0;
    let accumulator = 0;
    const frameInterval = 1000 / targetFps;
    let rafId: number;

    const tick = (timestamp: number) => {
      if (lastTime === 0) lastTime = timestamp;
      accumulator += timestamp - lastTime;
      lastTime = timestamp;

      let framesToAdvance = 0;
      while (accumulator >= frameInterval) {
        framesToAdvance++;
        accumulator -= frameInterval;
      }

      if (framesToAdvance > 0) {
        setActiveFrameIndex(prev => (prev + framesToAdvance) % activeMedia.frames.length);
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, media, timelineMedia, targetFps]);

  // --- PROCESSING PIPELINE ---
  useEffect(() => {
    let sourceFrame;
    if (previewOverride && assets[previewOverride.assetId]) {
      sourceFrame = assets[previewOverride.assetId].media.frames[previewOverride.frameIndex]?.imageData;
    } else {
      if (!media || !media.frames[activeFrameIndex]) {
        setProcessedFrame(null);
        setRawSourceFrame(null);
        return;
      }
      sourceFrame = media.frames[activeFrameIndex].imageData;
    }

    setRawSourceFrame(sourceFrame);

    if (!sourceFrame) {
      setProcessedFrame(null);
      return;
    }
    
    const sourceCanvas = imageDataToCanvas(sourceFrame);
    const cropped128x64 = renderCropTo128x64(sourceCanvas, cropSettings);
    
    const { ditheredImageData, xbmpBytes } = applyDithering(cropped128x64, ditherConfig);
    setProcessedFrame(ditheredImageData);

    const now = performance.now();
    if (serialStreamer.getConnected() && (now - lastStreamTime.current > 1000 / targetFps)) {
      lastStreamTime.current = now;
      serialStreamer.sendFrame(xbmpBytes);
    }
  }, [media, activeFrameIndex, ditherConfig, cropSettings, serialConnected, targetFps, previewOverride, assets]);

  // Fast direct canvas rendering for Full Preview (no base64 allocation per frame)
  useEffect(() => {
    if (!rawSourceFrame || !fullPreviewCanvasRef.current) return;
    const canvas = fullPreviewCanvasRef.current;
    if (canvas.width !== rawSourceFrame.width) canvas.width = rawSourceFrame.width;
    if (canvas.height !== rawSourceFrame.height) canvas.height = rawSourceFrame.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.putImageData(rawSourceFrame, 0, 0);
    }
  }, [rawSourceFrame]);

  // --- ACTIONS ---
  const handleSerialToggle = async () => {
    if (serialConnected) {
      await serialStreamer.disconnect();
      setSerialConnected(false);
    } else {
      const success = await serialStreamer.connect();
      if (success) {
        setSerialConnected(true);
      }
    }
  };

  const handleExport = () => {
    if (!media) return;
    const croppedAndDithered = media.frames.map((f: ExtractedFrame) => {
      const sourceCanvas = imageDataToCanvas(f.imageData);
      const cropped128x64 = renderCropTo128x64(sourceCanvas, cropSettings);
      return applyDithering(cropped128x64, ditherConfig);
    });

    const xbmpFrames = croppedAndDithered.map((res: { ditheredImageData: ImageData, xbmpBytes: Uint8Array }) => res.xbmpBytes);

    const code = generateCppHeader(xbmpFrames, targetFps, hardwareConfig);
    setCppCode(code);
    setExportXbmpFrames(xbmpFrames);
    setExportModalOpen(true);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden text-[#1A1A1A] relative">
      <Header 
        serialConnected={serialConnected}
        onSerialToggle={handleSerialToggle}
        onExportClick={handleExport}
        onSettingsOpen={() => setSettingsOpen(true)}
        hasMedia={!!media}
      />

      <main className="flex-1 flex flex-col min-h-0 z-10">
        {/* Top: New 3-Column Preview Section */}
        <section className="flex-1 flex items-stretch bg-[#F5F0EB] relative min-h-0 border-b border-[#1A1A1A]/20" style={{
          backgroundImage: `
            repeating-linear-gradient(0deg, #e0dbd5 0 1px, transparent 1px 40px),
            repeating-linear-gradient(90deg, #e0dbd5 0 1px, transparent 1px 40px)
          `
        }}>
          {/* Column 1: Full Preview */}
          <div className="flex-[2.5] p-2 lg:p-4 flex flex-col items-center justify-start relative border-r border-[#1A1A1A]/20 min-w-0 h-full">
            <div className="w-full flex flex-col items-center justify-start h-full min-h-0">
              <div className="mb-1.5 shrink-0 text-center w-full">
                <h3 className="font-mono font-bold text-xs tracking-wider text-[#1A1A1A]">FULL PREVIEW</h3>
                <p className="font-mono text-[10px] text-[#6B6B6B]">See the full video/animation here at normal scale</p>
              </div>
              
              <div className="flex-1 w-full relative min-h-0">
                <div className="absolute inset-0 p-1 flex items-center justify-center">
                  
                  {/* Flawless Aspect-Ratio Bounding Box (Always Stable 572:367 Container) */}
                  <div className="relative flex items-center justify-center max-w-full max-h-full shrink-0">
                    {/* Sizing SVG establishing constant 572:367 box size before & after media import */}
                    <svg 
                      viewBox="0 0 572 367"
                      width={572}
                      height={367}
                      className="max-w-full max-h-full w-full h-full block opacity-0 pointer-events-none"
                      style={{ objectFit: 'contain' }}
                    />

                    {/* Actual Black Container Box overlaying the exact expanded bounds */}
                    <div className="absolute inset-0 bg-[#080808] border-2 border-[#1A1A1A] rounded-md shadow-[4px_4px_0_0_#1A1A1A] flex flex-col justify-between p-2 overflow-hidden">
                      {/* Media Display Area */}
                      <div className="flex-1 w-full min-h-0 relative flex items-center justify-center overflow-hidden">
                        {rawSourceFrame ? (
                          <canvas 
                            ref={fullPreviewCanvasRef}
                            className={`w-full h-full block ${previewFitMode === 'cover' ? 'object-cover' : 'object-contain'}`}
                            style={{ imageRendering: 'pixelated' }}
                          />
                        ) : (
                          <div className="flex items-center justify-center w-full h-full bg-[#111]">
                            <span className="font-mono text-[#6B6B6B] text-xs">NO MEDIA</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Playback Control Bar */}
                      <div className="h-7 flex items-center px-2 gap-2 text-white bg-[#111]/90 backdrop-blur rounded border border-white/10 shrink-0 mt-1 z-10">
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsPlaying(p => !p);
                          }} 
                          className="text-xs font-bold text-[#E85D2A] hover:text-white transition-colors cursor-pointer px-1 py-1"
                        >
                          {isPlaying ? '❚❚' : '▶'}
                        </button>
                        <div className="text-[9px] font-mono whitespace-nowrap opacity-70">
                          {(activeFrameIndex / targetFps).toFixed(2)}s
                        </div>
                        <div className="flex-1 h-1 bg-white/20 rounded-full relative min-w-[30px]">
                          <div 
                            className="absolute inset-y-0 left-0 bg-[#E85D2A] rounded-full" 
                            style={{ width: media && media.frames.length ? `${(activeFrameIndex / media.frames.length) * 100}%` : '0%' }}
                          />
                        </div>
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setPreviewFitMode(m => m === 'cover' ? 'contain' : 'cover');
                          }} 
                          className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-white/10 hover:bg-[#E85D2A] text-white transition-colors cursor-pointer uppercase tracking-wider"
                          title="Toggle FIT (contain full frame) vs FILL (zoom to fill box)"
                        >
                          {previewFitMode === 'cover' ? 'FILL' : 'FIT'}
                        </button>
                        <div className="text-[9px] font-mono whitespace-nowrap text-[#E85D2A] font-bold">{targetFps} FPS</div>
                      </div>
                    </div>

                  </div>

                </div>
              </div>
            </div>
          </div>

          {/* Column 2: True OLED Preview */}
          <div className="flex-1 p-3 flex flex-col items-center justify-center relative min-w-0">
            <div className="text-center mb-2 shrink-0">
              <h3 className="font-mono font-bold text-xs tracking-wider text-[#1A1A1A]">TRUE OLED PREVIEW (128 × 64)</h3>
              <p className="font-mono text-[10px] text-[#6B6B6B]">Exact physical scale • 1:1 pixels</p>
            </div>

            <div className="relative flex items-center justify-center w-full max-h-full flex-1 min-h-0 gap-3">
              {/* Hardware Bezel */}
              <div className="bg-[#2A2A2A] rounded-xl p-3 shadow-[0_10px_30px_rgba(0,0,0,0.5),inset_0_2px_1px_rgba(255,255,255,0.1),inset_0_-2px_1px_rgba(0,0,0,0.5)] border border-[#111] relative z-10 shrink-0 max-w-full max-h-full flex flex-col justify-center">
                {/* Screws */}
                <div className="absolute top-2 left-2 w-2.5 h-2.5 rounded-full bg-[#1A1A1A] border border-[#333] shadow-[inset_0_1px_2px_#000] flex items-center justify-center rotate-45"><div className="w-full h-[1px] bg-[#333]" /></div>
                <div className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-[#1A1A1A] border border-[#333] shadow-[inset_0_1px_2px_#000] flex items-center justify-center rotate-12"><div className="w-full h-[1px] bg-[#333]" /></div>
                <div className="absolute bottom-2 left-2 w-2.5 h-2.5 rounded-full bg-[#1A1A1A] border border-[#333] shadow-[inset_0_1px_2px_#000] flex items-center justify-center -rotate-12"><div className="w-full h-[1px] bg-[#333]" /></div>
                <div className="absolute bottom-2 right-2 w-2.5 h-2.5 rounded-full bg-[#1A1A1A] border border-[#333] shadow-[inset_0_1px_2px_#000] flex items-center justify-center rotate-90"><div className="w-full h-[1px] bg-[#333]" /></div>
                
                <div className="text-[#555] font-mono text-[8px] text-center mb-1">SSD1306 128x64</div>
                
                <div className="bg-[#000] p-1 shadow-[inset_0_0_10px_#000] rounded shrink flex items-center justify-center">
                  <div className="pointer-events-auto w-[128px]">
                    <OledCanvas frameData={processedFrame} theme={ditherConfig.theme} scale={8} />
                  </div>
                </div>

                <div className="text-[#555] font-mono text-[8px] text-center mt-1">I²C 0x3C</div>
              </div>

              {/* Decorative Sticky Note (Right) */}
              <div className="hidden xl:block shrink-0">
                <div className="bg-[#FFD485] text-[#1A1A1A] p-2.5 font-mono text-[9px] w-32 shadow-lg rotate-2">
                  <div className="flex justify-between items-start mb-1">
                    <div className="w-2 h-2 rounded-full bg-[#1A1A1A]/20" />
                    <span>💡</span>
                  </div>
                  OLED output shows 1:1 true scale.
                </div>
              </div>
            </div>
          </div>

          {/* Column 3: Display Info */}
          <div className="w-[180px] shrink-0 p-4 border-l border-[#1A1A1A]/20 flex flex-col justify-start overflow-y-auto">
            <div className="bg-white border-2 border-[#1A1A1A] shadow-[3px_3px_0_0_#1A1A1A] p-3 font-mono text-xs flex flex-col gap-4 mb-auto">
              
              <div>
                <div className="bg-[#1A1A1A] text-white px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider mb-2 flex justify-between items-center">
                  <span>DISPLAY INFO</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E85D2A]"></span>
                </div>
                <div className="flex flex-col gap-0.5 text-[#6B6B6B] text-[11px]">
                  <div>128 × 64</div>
                  <div>1-BIT (MONO)</div>
                  <div>I²C 0x3C</div>
                  <div>{targetFps} FPS</div>
                </div>
              </div>

              <div className="h-px bg-[#1A1A1A]/20" />

              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-[#1A1A1A] mb-1">CURRENT FRAME</div>
                <div className="text-[#6B6B6B] text-[11px]">{activeFrameIndex.toString().padStart(3, '0')} / {media ? media.frames.length.toString().padStart(3, '0') : '000'}</div>
                <div className="text-[#6B6B6B] text-[11px]">{(activeFrameIndex / targetFps).toFixed(2)}s</div>
              </div>

              <div className="h-px bg-[#1A1A1A]/20" />

              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-[#1A1A1A] mb-1">OUTPUT SIZE</div>
                <div className="text-[#6B6B6B] text-[11px] mb-1">1024 bytes/frame</div>
              </div>

            </div>
          </div>
        </section>

        {/* Bottom Console — Technical Control Panel */}
        <aside className="h-[310px] shrink-0 bg-white flex z-20 p-4 gap-4 relative border-t-2 border-[#1A1A1A]">
          
          {/* Zone 1: Media Pool (Left) */}
          <BlueprintHoverCard className="w-[280px] shrink-0 min-w-0">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6B6B6B] px-4 py-3 border-b-2 border-[#1A1A1A] font-mono z-[2] relative flex items-center gap-2">
              <span className="w-2 h-2 bg-[#E85D2A]"></span>
              <span className="text-[#1A1A1A]">MEDIA_POOL</span>
            </h2>
            
            {/* Tabs */}
            <div className="flex border-b border-[#1A1A1A]/20 bg-[#F5F0EB] shrink-0">
              <button 
                onClick={() => setMediaPoolTab('import')}
                className={`flex-1 py-2 text-[9px] font-bold font-mono tracking-widest cursor-pointer transition-colors ${
                  mediaPoolTab === 'import' ? 'text-[#1A1A1A] border-b-2 border-[#E85D2A] bg-white' : 'text-[#6B6B6B] hover:text-[#1A1A1A]'
                }`}
              >
                + IMPORT
              </button>
              <button 
                onClick={() => setMediaPoolTab('samples')}
                className={`flex-1 py-2 text-[9px] font-bold font-mono tracking-widest cursor-pointer transition-colors ${
                  mediaPoolTab === 'samples' ? 'text-[#1A1A1A] border-b-2 border-[#E85D2A] bg-white' : 'text-[#6B6B6B] hover:text-[#1A1A1A]'
                }`}
              >
                SAMPLES
              </button>
              <button 
                onClick={() => setMediaPoolTab('recent')}
                className={`flex-1 py-2 text-[9px] font-bold font-mono tracking-widest cursor-pointer transition-colors ${
                  mediaPoolTab === 'recent' ? 'text-[#1A1A1A] border-b-2 border-[#E85D2A] bg-white' : 'text-[#6B6B6B] hover:text-[#1A1A1A]'
                }`}
              >
                RECENT
              </button>
            </div>

            <div className="flex-1 flex flex-col min-h-0 overflow-y-auto z-[2] relative">
              {mediaPoolTab === 'import' && (
                <>
                  <DropZone onMediaLoaded={handleMediaLoaded} currentMedia={null} />
                  
                  {/* Asset Pool Grid */}
                  <div className="p-2.5">
                    {Object.values(assets).length === 0 ? (
                      <p className="text-[9px] font-mono text-[#6B6B6B] text-center py-6 border border-dashed border-[#1A1A1A]/30">
                        No imported video assets yet. Drop a file above to add to your bin!
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {Object.values(assets).map(asset => {
                          const firstFrame = asset.media.frames[0];
                          return (
                            <div 
                              key={asset.id} 
                              draggable={true}
                              onDragStart={(e) => {
                                e.dataTransfer.setData('application/x-oled-asset', asset.id);
                                e.dataTransfer.setData('text/plain', asset.id);
                              }}
                              onDoubleClick={() => handleAddAssetToTimeline(asset.id)}
                              className="bg-[#080808] border-2 border-[#1A1A1A] hover:border-[#E85D2A] transition-all cursor-grab active:cursor-grabbing relative group aspect-[4/3] flex flex-col overflow-hidden shadow-sm"
                              title={`Double click or drag ${asset.media.sourceInfo.filename} to timeline`}
                            >
                              {/* Thumbnail Image */}
                              <div className="flex-1 w-full h-full relative overflow-hidden bg-[#050505]">
                                {firstFrame && (
                                  <img 
                                    src={(() => {
                                      const canvas = document.createElement('canvas');
                                      canvas.width = firstFrame.imageData.width;
                                      canvas.height = firstFrame.imageData.height;
                                      const ctx = canvas.getContext('2d');
                                      if (ctx) ctx.putImageData(firstFrame.imageData, 0, 0);
                                      return canvas.toDataURL();
                                    })()} 
                                    className="w-full h-full object-cover opacity-85 group-hover:opacity-100 transition-opacity" 
                                    alt={asset.id} 
                                  />
                                )}

                                {/* Frame badge */}
                                <span className="absolute top-1 right-1 bg-black/80 text-[7px] text-white font-mono px-1 py-0.5 border border-white/20 font-bold">
                                  {asset.media.frames.length}f
                                </span>

                                {/* Bottom title */}
                                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black via-black/90 to-transparent p-1 pt-3">
                                  <p className="text-[8px] font-bold text-white font-mono truncate">{asset.media.sourceInfo.filename}</p>
                                </div>

                                {/* Hover Action Overlay */}
                                <div className="absolute inset-0 bg-black/85 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-1.5 gap-1.5 z-10">
                                  <span className="text-[7px] font-mono text-[#E85D2A] font-bold uppercase tracking-wider">DRAG OR CHOOSE</span>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleAddAssetToTimeline(asset.id); }}
                                    className="w-full py-1 text-[8px] font-bold bg-[#E85D2A] text-white hover:bg-white hover:text-[#1A1A1A] transition-colors cursor-pointer uppercase font-mono tracking-wider"
                                  >
                                    + ADD CLIP
                                  </button>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleReplaceTimelineWithAsset(asset.id); }}
                                    className="w-full py-0.5 text-[7px] font-bold border border-white/40 text-white hover:bg-white hover:text-[#1A1A1A] transition-colors cursor-pointer uppercase font-mono tracking-wider"
                                  >
                                    REPLACE
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}

              {mediaPoolTab === 'samples' && (
                <div className="p-2.5">
                  <div className="flex justify-between items-center mb-2 px-1">
                    <span className="text-[8px] font-mono text-[#6B6B6B] uppercase tracking-wider font-bold">SAMPLE ANIMATION BIN</span>
                    <span className="text-[7px] font-mono text-[#888]">Double-click or drag card</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'dino', icon: '🦖', name: 'DINO RUNNER', tag: '30FPS' },
                      { id: 'heartbeat', icon: '💓', name: 'ECG HEARTBEAT', tag: 'PQRST' },
                      { id: 'spinner', icon: '🔄', name: 'LOADING SPINNER', tag: 'ARC' },
                      { id: 'wificonnect', icon: '📶', name: 'WIFI SIGNAL', tag: 'PULSE' },
                      { id: 'bouncing', icon: '📀', name: 'BOUNCING LOGO', tag: '60f' },
                      { id: 'pacman', icon: '👾', name: 'PAC-MAN LOOP', tag: 'CHOMP' },
                      { id: 'battery', icon: '🔋', name: 'BATTERY CHARGE', tag: '100%' },
                      { id: 'sinewave', icon: '🌊', name: 'SINE WAVE OSC', tag: '1.2kHz' },
                      { id: 'ripple', icon: '🎯', name: 'RADAR RIPPLE', tag: 'SCAN' },
                      { id: 'analogclock', icon: '🕒', name: 'ANALOG CLOCK', tag: 'TICKS' },
                      { id: 'starfield', icon: '🌌', name: 'STARFIELD WARP', tag: '3D' },
                      { id: 'matrix', icon: '🟩', name: 'MATRIX RAIN', tag: '1-BIT' },
                      { id: 'rain', icon: '🌧', name: 'RAIN STORM', tag: 'SHOWER' },
                      { id: 'badapple', icon: '🍎', name: 'BAD APPLE', tag: 'MONO' },
                      { id: 'dvd', icon: '📀', name: 'DVD BOUNCE', tag: 'CORNER' },
                      { id: 'cube3d', icon: '🎲', name: '3D CUBE WIRING', tag: '3D MESH' },
                      { id: 'flame', icon: '🔥', name: 'DOOM FIRE SIM', tag: 'AUTOMATA' },
                      { id: 'plasma', icon: '⚡', name: 'DITHERED PLASMA', tag: 'BAYER4x4' },
                      { id: 'fireworks', icon: '🎆', name: 'FIREWORKS BURST', tag: 'SPARKS' },
                      { id: 'roboeyes', icon: '🤖', name: 'ROBO-EYES FACE', tag: 'DYNAMIC' },
                      { id: 'spirograph', icon: '🌀', name: 'SPIROGRAPH ROULETTE', tag: 'MATH' },
                      { id: 'qrcode', icon: '🏁', name: 'QR SCANNER WIPE', tag: 'LASER' },
                    ].map(sample => (
                      <div
                        key={sample.id}
                        draggable={true}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('application/x-oled-asset', sample.id);
                          e.dataTransfer.setData('text/plain', sample.id);
                        }}
                        onDoubleClick={() => handleLoadSample(sample.id as any, 'append')}
                        className="bg-[#080808] border-2 border-[#1A1A1A] hover:border-[#E85D2A] transition-all cursor-grab active:cursor-grabbing relative group aspect-[4/3] flex flex-col overflow-hidden shadow-sm"
                        title={`Double click or drag ${sample.name} to timeline`}
                      >
                        {/* Thumbnail Image */}
                        <div className="flex-1 w-full h-full relative overflow-hidden bg-[#050505]">
                          {sampleThumbnails[sample.id] ? (
                            <img 
                              src={sampleThumbnails[sample.id]} 
                              alt={sample.name} 
                              className="w-full h-full object-cover opacity-85 group-hover:opacity-100 transition-opacity" 
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xl">{sample.icon}</div>
                          )}

                          {/* FPS Badge */}
                          <span className="absolute top-1 right-1 bg-black/80 text-[7px] text-white font-mono px-1 py-0.5 border border-white/20 font-bold">
                            {sample.tag}
                          </span>

                          {/* Bottom Title Bar */}
                          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black via-black/90 to-transparent p-1 pt-3">
                            <p className="text-[8px] font-bold text-white font-mono truncate flex items-center gap-1">
                              <span>{sample.icon}</span>
                              <span>{sample.name}</span>
                            </p>
                          </div>

                          {/* Hover Action Overlay */}
                          <div className="absolute inset-0 bg-black/85 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-1.5 gap-1.5 z-10">
                            <span className="text-[7px] font-mono text-[#E85D2A] font-bold uppercase tracking-wider">DRAG OR CHOOSE</span>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleLoadSample(sample.id as any, 'append'); }}
                              className="w-full py-1 text-[8px] font-bold bg-[#E85D2A] text-white hover:bg-white hover:text-[#1A1A1A] transition-colors cursor-pointer uppercase font-mono tracking-wider"
                              title="Append sample animation to timeline"
                            >
                              + ADD CLIP
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleLoadSample(sample.id as any, 'replace'); }}
                              className="w-full py-0.5 text-[7px] font-bold border border-white/40 text-white hover:bg-white hover:text-[#1A1A1A] transition-colors cursor-pointer uppercase font-mono tracking-wider"
                              title="Replace sequence with this sample animation"
                            >
                              REPLACE
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {mediaPoolTab === 'recent' && (
                <div className="p-2.5">
                  {Object.values(assets).length === 0 ? (
                    <p className="text-[9px] font-mono text-[#6B6B6B] text-center py-6 border border-dashed border-[#1A1A1A]/30">
                      No recent files.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {Object.values(assets).map(asset => {
                        const firstFrame = asset.media.frames[0];
                        return (
                          <div 
                            key={asset.id} 
                            draggable={true}
                            onDragStart={(e) => {
                              e.dataTransfer.setData('application/x-oled-asset', asset.id);
                              e.dataTransfer.setData('text/plain', asset.id);
                            }}
                            onDoubleClick={() => handleAddAssetToTimeline(asset.id)}
                            className="bg-[#080808] border-2 border-[#1A1A1A] hover:border-[#E85D2A] transition-all cursor-grab active:cursor-grabbing relative group aspect-[4/3] flex flex-col overflow-hidden shadow-sm"
                          >
                            <div className="flex-1 w-full h-full relative overflow-hidden bg-[#050505]">
                              {firstFrame && (
                                <img 
                                  src={(() => {
                                    const canvas = document.createElement('canvas');
                                    canvas.width = firstFrame.imageData.width;
                                    canvas.height = firstFrame.imageData.height;
                                    const ctx = canvas.getContext('2d');
                                    if (ctx) ctx.putImageData(firstFrame.imageData, 0, 0);
                                    return canvas.toDataURL();
                                  })()} 
                                  className="w-full h-full object-cover opacity-85 group-hover:opacity-100 transition-opacity" 
                                  alt={asset.id} 
                                />
                              )}
                              <span className="absolute top-1 right-1 bg-black/80 text-[7px] text-white font-mono px-1 py-0.5 border border-white/20 font-bold">
                                {asset.media.frames.length}f
                              </span>
                              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black via-black/90 to-transparent p-1 pt-3">
                                <p className="text-[8px] font-bold text-white font-mono truncate">{asset.media.sourceInfo.filename}</p>
                              </div>
                              <div className="absolute inset-0 bg-black/85 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-1.5 gap-1.5 z-10">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleAddAssetToTimeline(asset.id); }}
                                  className="w-full py-1 text-[8px] font-bold bg-[#E85D2A] text-white hover:bg-white hover:text-[#1A1A1A] transition-colors cursor-pointer uppercase font-mono tracking-wider"
                                >
                                  + ADD CLIP
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleReplaceTimelineWithAsset(asset.id); }}
                                  className="w-full py-0.5 text-[7px] font-bold border border-white/40 text-white hover:bg-white hover:text-[#1A1A1A] transition-colors cursor-pointer uppercase font-mono tracking-wider"
                                >
                                  REPLACE
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </BlueprintHoverCard>

          {/* Zone 2: Timeline & Trimming (Center) */}
          <BlueprintHoverCard className="flex-1 min-w-0 flex flex-col overflow-hidden">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6B6B6B] px-6 py-3 border-b-2 border-[#1A1A1A] font-mono z-[2] relative flex justify-between items-center bg-[#F5F0EB] shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-[#E85D2A]"></span>
                <span className="text-[#1A1A1A]">TIMELINE</span>
              </div>
              {media && <span>{media.frames.length} FRAMES | {targetFps} FPS</span>}
            </h2>

            {/* Timeline track — fills remaining space */}
            <div className="flex-1 min-h-0 overflow-hidden z-[2] relative">
              <TimelineTrack 
                clips={clips}
                assets={assets}
                onClipsChange={setClipsWithHistory}
                activeGlobalFrame={activeFrameIndex} 
                onFrameSelect={(i) => {
                  setIsPlaying(false);
                  setActiveFrameIndex(i);
                }}
                onPreviewAssetFrame={(assetId, frameIndex) => {
                  if (assetId && frameIndex !== undefined) {
                    setPreviewOverride({ assetId, frameIndex });
                  } else {
                    setPreviewOverride(null);
                  }
                }}
                zoomLevel={zoomLevel}
                onZoomChange={setZoomLevel}
                selectedClipIds={selectedClipIds}
                onSelectClips={setSelectedClipIds}
                onAssetDrop={handleAddAssetToTimeline}
              />
            </div>

            {/* Playback bar — always at the bottom, never scrolled away */}
            <div className="shrink-0 px-6 py-3 border-t border-[#1A1A1A]/20 bg-[#F5F0EB] z-[2]">
              <PlaybackBar 
                isPlaying={isPlaying}
                onTogglePlay={() => setIsPlaying(p => !p)}
                currentFrame={activeFrameIndex}
                totalFrames={timelineMedia ? timelineMedia.frames.length : 0}
                targetFps={targetFps}
                onFpsChange={setTargetFps}
                onFrameSeek={(f) => {
                  setIsPlaying(false);
                  setActiveFrameIndex(f);
                }}
                onReset={() => {
                  setIsPlaying(false);
                  setActiveFrameIndex(0);
                }}
              />
            </div>
          </BlueprintHoverCard>

          {/* Zone 3: Inspector (Right) */}
          <BlueprintHoverCard className="w-[340px] shrink-0 min-w-0">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#E85D2A] px-4 py-3 border-b-2 border-[#1A1A1A] font-mono z-[2] relative">INSPECTOR</h2>
            <div className="flex-1 overflow-y-auto pr-4 px-4 py-4 space-y-6 z-[2] relative">
              <div>
                <DitherControls 
                  config={ditherConfig} 
                  onChange={setDitherConfig} 
                  disabled={!media} 
                />
              </div>
              <div className="border-t border-[#1A1A1A] pt-4">
                <CropControls 
                  settings={cropSettings} 
                  onChange={(newSettings) => {
                    if (newSettings.mode !== cropSettings.mode && newSettings.mode === 'cover' && media) {
                      const cover = computeCoverCrop(media.sourceInfo.sourceWidth, media.sourceInfo.sourceHeight);
                      setCropSettings({ ...newSettings, ...cover });
                    } else {
                      setCropSettings(newSettings);
                    }
                  }} 
                  disabled={!media} 
                />
              </div>
            </div>
          </BlueprintHoverCard>

        </aside>
      </main>

      {/* Modals */}
      <SettingsModal 
        isOpen={settingsOpen} 
        onClose={() => setSettingsOpen(false)} 
        config={hardwareConfig} 
        onChange={setHardwareConfig} 
      />
      <ExportModal 
        isOpen={exportModalOpen} 
        onClose={() => setExportModalOpen(false)} 
        cppCode={cppCode} 
        frameCount={media ? media.frames.length : 0}
        targetFps={targetFps}
        xbmpFrames={exportXbmpFrames}
      />
    </div>
  );
}
