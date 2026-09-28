import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Header } from './components/Header';
import { DropZone } from './components/DropZone';
import { TimelineTrack } from './components/TimelineTrack';
import { OledCanvas } from './components/OledCanvas';
import { PlaybackBar } from './components/PlaybackBar';
import { DitherControls } from './components/DitherControls';
import { CropControls } from './components/CropControls';
import { DecryptedText } from './components/reactbits/DecryptedText';
import { CountUp } from './components/reactbits/CountUp';

// Lazy-loaded heavy studios and modals to speed up initial page reload
const SettingsModal = React.lazy(() => import('./components/SettingsModal').then(m => ({ default: m.SettingsModal })));
const CharacterStudioModal = React.lazy(() => import('./components/studio/CharacterStudioModal').then(m => ({ default: m.CharacterStudioModal })));
const LyricsStudioView = React.lazy(() => import('./components/studio/lyrics/LyricsStudioView').then(m => ({ default: m.LyricsStudioView })));
const ExportModal = React.lazy(() => import('./components/ExportModal').then(m => ({ default: m.ExportModal })));

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
import { generateSampleMedia, generateSampleThumbnail, SamplePresetType } from './engine/sampleGenerator';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("React ErrorBoundary caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#FAF9F5] text-[#141413] p-6 font-sans">
          <div className="bg-white border border-[#E8E5DE] rounded-2xl p-6 max-w-lg shadow-xl flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#D97757]" />
              <h2 className="font-serif text-lg text-[#141413]">Application Error Preserved</h2>
            </div>
            <p className="text-xs text-[#5E5D59] leading-relaxed">An unexpected runtime error occurred, but application state was preserved.</p>
            <pre className="p-3 bg-[#FAF9F5] border border-[#E8E5DE] text-[#141413] text-[11px] font-mono rounded-lg overflow-auto max-h-36">
              {this.state.error?.message || 'Unknown error'}
            </pre>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
              className="py-2 px-4 bg-[#141413] hover:bg-[#2A2926] text-[#FAF9F5] text-xs font-sans font-medium rounded-lg shadow-xs transition-colors cursor-pointer w-fit"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function MainApp() {
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
  const [activeView, setActiveView] = useState<'editor' | 'lyrics-studio'>('editor');
  const [mediaPoolTab, setMediaPoolTab] = useState<'import' | 'samples' | 'recent' | 'create'>('import');
  const [studioOpen, setStudioOpen] = useState(false);
  const [serialConnected, setSerialConnected] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportError, setExportError] = useState<string | null>(null);
  const [rawSourceFrame, setRawSourceFrame] = useState<ImageData | null>(null);
  const [previewFitMode, setPreviewFitMode] = useState<'contain' | 'cover'>('cover');
  const [cppCode, setCppCode] = useState('');
  const [exportXbmpFrames, setExportXbmpFrames] = useState<Uint8Array[]>([]);

  const fullPreviewCanvasRef = useRef<HTMLCanvasElement>(null);
  const exportInProgressRef = useRef(false);
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
      if (asset && asset.media && asset.media.frames) {
        const start = Math.max(0, clip.inFrame);
        const end = Math.min(asset.media.frames.length - 1, clip.outFrame);
        for (let i = start; i <= end; i++) {
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

    const firstAsset = clips[0] ? assets[clips[0].assetId] : undefined;
    if (!firstAsset || !firstAsset.media) return null;

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

  // Sample Thumbnails cache for NLE Grid Bin (computed lazily ONLY when user visits 'samples' tab)
  const [sampleThumbnails, setSampleThumbnails] = useState<Record<string, string>>({});

  useEffect(() => {
    if (mediaPoolTab !== 'samples') return;
    if (Object.keys(sampleThumbnails).length > 0) return;

    const samples = ['dino', 'heartbeat', 'spinner', 'wificonnect', 'bouncing', 'pacman', 'battery', 'sinewave', 'ripple', 'analogclock', 'starfield', 'matrix', 'rain', 'badapple'] as const;
    const map: Record<string, string> = {};
    samples.forEach(id => {
      map[id] = generateSampleThumbnail(id as any);
    });
    setSampleThumbnails(map);
  }, [mediaPoolTab, sampleThumbnails]);

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
      const sourceAsset = assets[clipToSplit.assetId];
      if (!sourceAsset) return;

      const splitPointInAsset = clipToSplit.inFrame + localFrameIndex;

      // Slice frames for Part 1
      const frames1 = sourceAsset.media.frames.slice(clipToSplit.inFrame, splitPointInAsset);
      const asset1Id = `asset_${Date.now()}_a`;
      const asset1: MediaAsset = {
        id: asset1Id,
        media: {
          ...sourceAsset.media,
          sourceInfo: {
            ...sourceAsset.media.sourceInfo,
            frameCount: frames1.length,
          },
          frames: frames1.map((f, idx) => ({ ...f, index: idx }))
        }
      };

      // Slice frames for Part 2
      const frames2 = sourceAsset.media.frames.slice(splitPointInAsset, clipToSplit.outFrame + 1);
      const asset2Id = `asset_${Date.now()}_b`;
      const asset2: MediaAsset = {
        id: asset2Id,
        media: {
          ...sourceAsset.media,
          sourceInfo: {
            ...sourceAsset.media.sourceInfo,
            frameCount: frames2.length,
          },
          frames: frames2.map((f, idx) => ({ ...f, index: idx }))
        }
      };

      const newClip1: TimelineClip = {
        id: clipToSplit.id,
        assetId: asset1Id,
        inFrame: 0,
        outFrame: frames1.length - 1
      };

      const newClip2: TimelineClip = {
        id: "clip_" + Date.now() + "_" + Math.random().toString(36).substring(2, 5),
        assetId: asset2Id,
        inFrame: 0,
        outFrame: frames2.length - 1
      };

      setAssets(prev => ({
        ...prev,
        [asset1Id]: asset1,
        [asset2Id]: asset2
      }));

      const newClips = [...clips];
      newClips.splice(targetClipIndex, 1, newClip1, newClip2);
      setClipsWithHistory(newClips);
    }
  }, [clips, assets, activeFrameIndex, timelineMedia, setClipsWithHistory]);

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

  const handleExport = async () => {
    if (!media || exportInProgressRef.current) return;

    exportInProgressRef.current = true;
    setIsExporting(true);
    setExportProgress(0);
    setExportError(null);

    try {
      const xbmpFrames: Uint8Array[] = [];
      const sourceCanvas = document.createElement('canvas');
      const croppedCanvas = document.createElement('canvas');
      const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true });
      if (!sourceContext) throw new Error('Could not create a canvas for export.');

      const totalFrames = media.frames.length;
      for (let index = 0; index < totalFrames; index++) {
        const frame = media.frames[index];
        if (!frame || !frame.imageData) continue;

        if (sourceCanvas.width !== frame.imageData.width) sourceCanvas.width = frame.imageData.width;
        if (sourceCanvas.height !== frame.imageData.height) sourceCanvas.height = frame.imageData.height;
        sourceContext.putImageData(frame.imageData, 0, 0);

        const croppedFrame = renderCropTo128x64(sourceCanvas, cropSettings, croppedCanvas);
        const { xbmpBytes } = applyDithering(croppedFrame, ditherConfig);
        xbmpFrames.push(xbmpBytes);

        if ((index + 1) % 10 === 0 || index === totalFrames - 1) {
          setExportProgress(Math.round(((index + 1) / totalFrames) * 85));
          await new Promise<void>(resolve => window.setTimeout(resolve, 0));
        }
      }

      if (xbmpFrames.length === 0) {
        throw new Error('No valid frames found to compile.');
      }

      const code = await generateCppHeader(
        xbmpFrames,
        targetFps,
        hardwareConfig,
        undefined,
        undefined,
        progress => setExportProgress(85 + Math.round(progress * 0.14))
      );
      setCppCode(code);
      setExportXbmpFrames(xbmpFrames);
      setExportProgress(100);
      setExportModalOpen(true);
    } catch (error) {
      console.error('Compile/export failed:', error);
      setExportError(error instanceof Error ? error.message : 'Export failed unexpectedly.');
    } finally {
      exportInProgressRef.current = false;
      setIsExporting(false);
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden text-[#1A1A1A] relative">
      <Header 
        serialConnected={serialConnected}
        onSerialToggle={handleSerialToggle}
        onExportClick={handleExport}
        onSettingsOpen={() => setSettingsOpen(true)}
        hasMedia={!!media}
        isExporting={isExporting}
        exportProgress={exportProgress}
        exportError={exportError}
        activeView={activeView}
        onViewChange={setActiveView}
      />

      <main className="flex-1 flex flex-col min-h-0 z-10">
        {/* Top: 3-Column Studio Preview Section */}
        <section className="flex-1 flex items-stretch bg-[#FAF9F5] relative min-h-0 border-b border-[#E8E5DE]">
          {/* Column 1: Full Frame Preview */}
          <div className="flex-[2.5] p-3 lg:p-5 flex flex-col items-center justify-start relative border-r border-[#E8E5DE] min-w-0 h-full bg-[#FAF9F5]">
            <div className="w-full flex flex-col items-center justify-start h-full min-h-0">
              <div className="mb-2 shrink-0 text-center w-full">
                <h3 className="font-serif text-sm tracking-tight text-[#141413]">Full Frame View</h3>
                <p className="font-sans text-[11px] text-[#5E5D59]">Native canvas buffer at 1:1 aspect ratio</p>
              </div>
              
              <div className="flex-1 w-full relative min-h-0">
                <div className="absolute inset-0 p-1 flex items-center justify-center">
                  
                  {/* Aspect-Ratio Bounding Box Container */}
                  <div className="relative flex items-center justify-center max-w-full max-h-full shrink-0">
                    <svg 
                      viewBox="0 0 572 367"
                      width={572}
                      height={367}
                      className="max-w-full max-h-full w-full h-full block opacity-0 pointer-events-none"
                      style={{ objectFit: 'contain' }}
                    />

                    {/* Clean Dark Frame Container */}
                    <div className="absolute inset-0 bg-[#141413] border border-[#2C2B29] rounded-sm shadow-xs flex flex-col justify-between p-2.5 overflow-hidden">
                      {/* Media Display Area */}
                      <div className="flex-1 w-full min-h-0 relative flex items-center justify-center overflow-hidden">
                        {rawSourceFrame ? (
                          <canvas 
                            ref={fullPreviewCanvasRef}
                            className={`w-full h-full block ${previewFitMode === 'cover' ? 'object-cover' : 'object-contain'}`}
                            style={{ imageRendering: 'pixelated' }}
                          />
                        ) : (
                          <div className="flex items-center justify-center w-full h-full bg-[#0D0D0E]">
                            <span className="font-mono text-[#5E5D59] text-xs">No media loaded</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Playback Control Bar */}
                      <div className="h-7 flex items-center px-2.5 gap-2.5 text-white bg-[#1C1C1E]/95 rounded-xs border border-white/10 shrink-0 mt-1 z-10 font-sans">
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsPlaying(p => !p);
                          }} 
                          className="text-xs font-bold text-[#D97757] hover:text-white transition-colors cursor-pointer px-1 py-1"
                        >
                          {isPlaying ? '❚❚' : '▶'}
                        </button>
                        <div className="text-[10px] font-mono whitespace-nowrap text-[#87867F]">
                          {(activeFrameIndex / targetFps).toFixed(2)}s
                        </div>
                        <div className="flex-1 h-1 bg-white/15 rounded-full relative min-w-[30px]">
                          <div 
                            className="absolute inset-y-0 left-0 bg-[#D97757] rounded-full" 
                            style={{ width: media && media.frames.length ? `${(activeFrameIndex / media.frames.length) * 100}%` : '0%' }}
                          />
                        </div>
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setPreviewFitMode(m => m === 'cover' ? 'contain' : 'cover');
                          }} 
                          className="text-[9px] font-mono px-1.5 py-0.5 rounded-xs bg-white/10 hover:bg-[#D97757] text-white transition-colors cursor-pointer uppercase tracking-wider"
                          title="Toggle FIT vs FILL"
                        >
                          {previewFitMode === 'cover' ? 'FILL' : 'FIT'}
                        </button>
                        <div className="text-[10px] font-mono whitespace-nowrap text-[#D97757] font-medium">{targetFps} FPS</div>
                      </div>
                    </div>

                  </div>

                </div>
              </div>
            </div>
          </div>

          {/* Column 2: True Hardware OLED Display Preview */}
          <div className="flex-1 p-4 flex flex-col items-center justify-center relative min-w-0 bg-[#FAF9F5]">
            <div className="text-center mb-2.5 shrink-0">
              <h3 className="font-serif text-sm tracking-tight text-[#141413]">Monochrome Matrix</h3>
              <p className="font-sans text-[11px] text-[#5E5D59]">128 × 64 Physical OLED scale</p>
            </div>

            <div className="relative flex items-center justify-center w-full max-h-full flex-1 min-h-0">
              {/* Precision Engineered Hardware Frame */}
              <div className="bg-[#18181A] rounded-sm p-4 shadow-sm border border-[#2C2B29] relative z-10 shrink-0 max-w-full max-h-full flex flex-col items-center justify-center">
                <div className="text-[#87867F] font-mono text-[8px] tracking-wider text-center mb-1.5 uppercase font-medium">SH1106 / SSD1306</div>
                
                <div className="bg-[#050505] p-1.5 rounded-xs border border-white/5 flex items-center justify-center">
                  <div className="pointer-events-auto w-[128px]">
                    <OledCanvas frameData={processedFrame} theme={ditherConfig.theme} scale={8} />
                  </div>
                </div>

                <div className="text-[#87867F] font-mono text-[8px] tracking-wider text-center mt-1.5 font-medium">I²C Bus (0x3C)</div>
              </div>
            </div>
          </div>

          {/* Column 3: Display Hardware Telemetry */}
          <div className="w-[200px] shrink-0 p-4 border-l border-[#E8E5DE] bg-[#FAF9F5] flex flex-col justify-start overflow-y-auto">
            <div className="bg-white border border-[#E8E5DE] rounded-sm p-3.5 shadow-xs flex flex-col gap-3.5 mb-auto font-sans">
              
              <div>
                <div className="text-[10px] font-sans font-semibold tracking-wider text-[#141413] mb-2 flex justify-between items-center pb-1.5 border-b border-[#E8E5DE]">
                  <span>Telemetry</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#D97757]"></span>
                </div>
                <div className="flex flex-col gap-1 text-[#5E5D59] font-mono text-[10px]">
                  <div className="flex justify-between"><span className="text-[#87867F]">Grid:</span> <span className="text-[#141413] font-medium">128 × 64</span></div>
                  <div className="flex justify-between"><span className="text-[#87867F]">Depth:</span> <span className="text-[#141413] font-medium">1-Bit Mono</span></div>
                  <div className="flex justify-between"><span className="text-[#87867F]">Clock:</span> <span className="text-[#141413] font-medium">{targetFps} FPS</span></div>
                  <div className="flex justify-between"><span className="text-[#87867F]">Bus:</span> <span className="text-[#141413] font-medium">0x3C</span></div>
                </div>
              </div>

              <div className="h-px bg-[#E8E5DE]" />

              <div>
                <div className="text-[10px] font-sans font-semibold tracking-wide text-[#141413] mb-1">Active Frame</div>
                <div className="text-[#5E5D59] font-mono text-[11px]">{activeFrameIndex.toString().padStart(3, '0')} / {media ? media.frames.length.toString().padStart(3, '0') : '000'}</div>
                <div className="text-[#87867F] font-mono text-[10px]">{(activeFrameIndex / targetFps).toFixed(2)}s elapsed</div>
              </div>

              <div className="h-px bg-[#E8E5DE]" />

              <div>
                <div className="text-[10px] font-sans font-semibold tracking-wide text-[#141413] mb-1">Payload Size</div>
                <div className="text-[#5E5D59] font-mono text-[10px]">1,024 B / frame</div>
              </div>

            </div>
          </div>
        </section>

        {/* Bottom Console — Technical Control Panel */}
        <aside className="h-[350px] shrink-0 bg-[#FAF9F5] flex z-20 p-4 gap-4 relative border-t border-[#E8E5DE]">
          
          {/* Zone 1: Media Library (Left) */}
          <div className="w-[300px] shrink-0 min-w-0 bg-white border border-[#E8E5DE] rounded-xl shadow-xs flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E8E5DE] flex items-center justify-between bg-[#FAF9F5]/50 shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#D97757]"></span>
                <h2 className="font-serif text-sm font-normal text-[#141413]">Media Assets</h2>
              </div>
              <span className="text-[11px] font-mono text-[#87867F]">
                {Object.keys(assets).length} items
              </span>
            </div>
            
            {/* Tabs */}
            <div className="flex border-b border-[#E8E5DE] bg-[#FAF9F5] p-1 gap-1 shrink-0">
              <button 
                onClick={() => setMediaPoolTab('import')}
                className={`flex-1 py-1.5 text-xs font-sans font-medium rounded-md transition-all cursor-pointer ${
                  mediaPoolTab === 'import' ? 'bg-white text-[#141413] shadow-xs' : 'text-[#5E5D59] hover:text-[#141413]'
                }`}
              >
                Import
              </button>
              <button 
                onClick={() => setMediaPoolTab('samples')}
                className={`flex-1 py-1.5 text-xs font-sans font-medium rounded-md transition-all cursor-pointer ${
                  mediaPoolTab === 'samples' ? 'bg-white text-[#141413] shadow-xs' : 'text-[#5E5D59] hover:text-[#141413]'
                }`}
              >
                Presets
              </button>
              <button 
                onClick={() => setMediaPoolTab('recent')}
                className={`flex-1 py-1.5 text-xs font-sans font-medium rounded-md transition-all cursor-pointer ${
                  mediaPoolTab === 'recent' ? 'bg-white text-[#141413] shadow-xs' : 'text-[#5E5D59] hover:text-[#141413]'
                }`}
              >
                Recent
              </button>
              <button 
                onClick={() => setMediaPoolTab('create')}
                className={`flex-1 py-1.5 text-xs font-sans font-medium rounded-md transition-all cursor-pointer ${
                  mediaPoolTab === 'create' ? 'bg-[#FAF0EB] text-[#D97757] font-semibold shadow-xs' : 'text-[#D97757] hover:bg-[#FAF0EB]/60'
                }`}
              >
                Lyrics
              </button>
            </div>

            <div className="flex-1 flex flex-col min-h-0 overflow-y-auto relative bg-white">
              {mediaPoolTab === 'import' && (
                <>
                  <DropZone onMediaLoaded={handleMediaLoaded} currentMedia={null} />
                  
                  {/* Asset Pool Grid */}
                  <div className="p-3">
                    {Object.values(assets).length === 0 ? (
                      <p className="text-xs font-sans text-[#87867F] text-center py-6 border border-dashed border-[#E8E5DE] rounded-lg">
                        No imported assets yet. Drop a file above to add to your sequence.
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2.5">
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
                              className="bg-[#141413] border border-[#E8E5DE] hover:border-[#D97757] rounded-lg transition-all cursor-grab active:cursor-grabbing relative group aspect-[4/3] flex flex-col overflow-hidden shadow-xs hover:shadow-sm"
                              title={`Double click or drag ${asset.media.sourceInfo.filename} to timeline`}
                            >
                              {/* Thumbnail Image */}
                              <div className="flex-1 w-full h-full relative overflow-hidden bg-[#0A0A09]">
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
                                <span className="absolute top-1.5 right-1.5 bg-[#141413]/80 backdrop-blur-xs text-[9px] text-[#FAF9F5] font-mono px-1.5 py-0.5 rounded border border-white/10">
                                  {asset.media.frames.length}f
                                </span>

                                {/* Bottom title */}
                                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-[#141413] via-[#141413]/80 to-transparent p-1.5 pt-4">
                                  <p className="text-[10px] font-sans font-medium text-[#FAF9F5] truncate">{asset.media.sourceInfo.filename}</p>
                                </div>

                                {/* Hover Action Overlay */}
                                <div className="absolute inset-0 bg-[#141413]/85 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2 gap-1.5 z-10">
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleAddAssetToTimeline(asset.id); }}
                                    className="w-full py-1 text-xs font-sans font-medium bg-[#D97757] hover:bg-[#C66545] text-white rounded transition-colors cursor-pointer"
                                  >
                                    Add Clip
                                  </button>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleReplaceTimelineWithAsset(asset.id); }}
                                    className="w-full py-0.5 text-[10px] font-sans font-medium border border-white/20 text-white/90 hover:bg-white/10 rounded transition-colors cursor-pointer"
                                  >
                                    Replace
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
                <div className="p-3">
                  <div className="flex justify-between items-center mb-2.5 px-0.5">
                    <span className="text-xs font-sans text-[#141413] font-medium">Curated Presets</span>
                    <span className="text-[10px] font-sans text-[#87867F]">Drag or double-click</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    {[
                      { id: 'dino', icon: '🦖', name: 'Dino Runner', tag: '30fps' },
                      { id: 'heartbeat', icon: '💓', name: 'ECG Heartbeat', tag: 'pqrst' },
                      { id: 'spinner', icon: '🔄', name: 'Loading Spinner', tag: 'arc' },
                      { id: 'wificonnect', icon: '📶', name: 'WiFi Signal', tag: 'pulse' },
                      { id: 'bouncing', icon: '📀', name: 'Bouncing Logo', tag: '60f' },
                      { id: 'pacman', icon: '👾', name: 'Pac-Man Loop', tag: 'chomp' },
                      { id: 'battery', icon: '🔋', name: 'Battery Charge', tag: '100%' },
                      { id: 'sinewave', icon: '🌊', name: 'Sine Wave Osc', tag: '1.2kHz' },
                      { id: 'ripple', icon: '🎯', name: 'Radar Ripple', tag: 'scan' },
                      { id: 'analogclock', icon: '🕒', name: 'Analog Clock', tag: 'ticks' },
                      { id: 'starfield', icon: '🌌', name: 'Starfield Warp', tag: '3d' },
                      { id: 'matrix', icon: '🟩', name: 'Matrix Rain', tag: '1-bit' },
                      { id: 'rain', icon: '🌧', name: 'Rain Storm', tag: 'shower' },
                      { id: 'badapple', icon: '🍎', name: 'Bad Apple', tag: 'mono' },
                      { id: 'dvd', icon: '📀', name: 'DVD Bounce', tag: 'corner' },
                      { id: 'cube3d', icon: '🎲', name: '3D Cube Wiring', tag: '3d mesh' },
                      { id: 'flame', icon: '🔥', name: 'Doom Fire Sim', tag: 'automata' },
                      { id: 'plasma', icon: '⚡', name: 'Dithered Plasma', tag: 'bayer' },
                      { id: 'fireworks', icon: '🎆', name: 'Fireworks Burst', tag: 'sparks' },
                      { id: 'roboeyes', icon: '🤖', name: 'Robo-Eyes Face', tag: 'dynamic' },
                      { id: 'spirograph', icon: '🌀', name: 'Spirograph', tag: 'math' },
                      { id: 'qrcode', icon: '🏁', name: 'QR Scanner', tag: 'laser' },
                    ].map(sample => (
                      <div
                        key={sample.id}
                        draggable={true}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('application/x-oled-asset', sample.id);
                          e.dataTransfer.setData('text/plain', sample.id);
                        }}
                        onDoubleClick={() => handleLoadSample(sample.id as any, 'append')}
                        className="bg-[#141413] border border-[#E8E5DE] hover:border-[#D97757] rounded-lg transition-all cursor-grab active:cursor-grabbing relative group aspect-[4/3] flex flex-col overflow-hidden shadow-xs hover:shadow-sm"
                        title={`Double click or drag ${sample.name} to timeline`}
                      >
                        {/* Thumbnail Image */}
                        <div className="flex-1 w-full h-full relative overflow-hidden bg-[#0A0A09]">
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
                          <span className="absolute top-1.5 right-1.5 bg-[#141413]/80 backdrop-blur-xs text-[9px] text-[#FAF9F5] font-mono px-1.5 py-0.5 rounded border border-white/10">
                            {sample.tag}
                          </span>

                          {/* Bottom Title Bar */}
                          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-[#141413] via-[#141413]/80 to-transparent p-1.5 pt-4">
                            <p className="text-[10px] font-sans font-medium text-[#FAF9F5] truncate flex items-center gap-1.5">
                              <span>{sample.icon}</span>
                              <span>{sample.name}</span>
                            </p>
                          </div>

                          {/* Hover Action Overlay */}
                          <div className="absolute inset-0 bg-[#141413]/85 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2 gap-1.5 z-10">
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleLoadSample(sample.id as any, 'append'); }}
                              className="w-full py-1 text-xs font-sans font-medium bg-[#D97757] hover:bg-[#C66545] text-white rounded transition-colors cursor-pointer"
                              title="Append sample animation to timeline"
                            >
                              Add Clip
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleLoadSample(sample.id as any, 'replace'); }}
                              className="w-full py-0.5 text-[10px] font-sans font-medium border border-white/20 text-white/90 hover:bg-white/10 rounded transition-colors cursor-pointer"
                              title="Replace sequence with this sample animation"
                            >
                              Replace
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {mediaPoolTab === 'create' && (
                <div className="p-4 flex-1 flex flex-col items-center justify-center text-center gap-3 border border-dashed border-[#E8E5DE] rounded-xl m-3 bg-[#FAF9F5]">
                  <div className="w-10 h-10 rounded-full bg-[#FAF0EB] text-[#D97757] flex items-center justify-center text-lg shadow-xs">
                    ✦
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-serif text-sm font-normal text-[#141413]">Kinetic Typography Studio</h3>
                    <p className="text-xs font-sans text-[#5E5D59] leading-relaxed max-w-[210px]">
                      Generate beat-synced 1-bit kinetic lyric animations with fluid Apple Music selector.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveView('lyrics-studio')}
                    className="mt-1 py-1.5 px-4 bg-[#141413] hover:bg-[#2A2926] text-[#FAF9F5] text-xs font-sans font-medium rounded-lg shadow-xs transition-colors cursor-pointer"
                  >
                    Open Studio
                  </button>
                </div>
              )}

              {mediaPoolTab === 'recent' && (
                <div className="p-3">
                  {Object.values(assets).length === 0 ? (
                    <p className="text-xs font-sans text-[#87867F] text-center py-6 border border-dashed border-[#E8E5DE] rounded-lg">
                      No recent files.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2.5">
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
                            className="bg-[#141413] border border-[#E8E5DE] hover:border-[#D97757] rounded-lg transition-all cursor-grab active:cursor-grabbing relative group aspect-[4/3] flex flex-col overflow-hidden shadow-xs hover:shadow-sm"
                          >
                            <div className="flex-1 w-full h-full relative overflow-hidden bg-[#0A0A09]">
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
                              <span className="absolute top-1.5 right-1.5 bg-[#141413]/80 backdrop-blur-xs text-[9px] text-[#FAF9F5] font-mono px-1.5 py-0.5 rounded border border-white/10">
                                {asset.media.frames.length}f
                              </span>
                              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-[#141413] via-[#141413]/80 to-transparent p-1.5 pt-4">
                                <p className="text-[10px] font-sans font-medium text-[#FAF9F5] truncate">{asset.media.sourceInfo.filename}</p>
                              </div>
                              <div className="absolute inset-0 bg-[#141413]/85 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2 gap-1.5 z-10">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleAddAssetToTimeline(asset.id); }}
                                  className="w-full py-1 text-xs font-sans font-medium bg-[#D97757] hover:bg-[#C66545] text-white rounded transition-colors cursor-pointer"
                                >
                                  Add Clip
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleReplaceTimelineWithAsset(asset.id); }}
                                  className="w-full py-0.5 text-[10px] font-sans font-medium border border-white/20 text-white/90 hover:bg-white/10 rounded transition-colors cursor-pointer"
                                >
                                  Replace
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
          </div>

          {/* Zone 2: Timeline & Trimming (Center) */}
          <div className="flex-1 min-w-0 bg-white border border-[#E8E5DE] rounded-xl shadow-xs flex flex-col overflow-hidden">
            <div className="px-5 py-3 border-b border-[#E8E5DE] flex justify-between items-center bg-[#FAF9F5]/50 shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#D97757]"></span>
                <h2 className="font-serif text-sm font-normal text-[#141413]">Timeline Sequence</h2>
              </div>
              {media && (
                <div className="flex items-center gap-3 text-xs font-mono text-[#5E5D59]">
                  <span>{media.frames.length} frames</span>
                  <span className="text-[#D5D0C5]">•</span>
                  <span>{targetFps} fps</span>
                  <span className="text-[#D5D0C5]">•</span>
                  <span>{(media.frames.length / targetFps).toFixed(2)}s</span>
                </div>
              )}
            </div>

            {/* Timeline track — fills remaining space */}
            <div className="flex-1 min-h-0 overflow-hidden relative bg-white">
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
                onSplitClip={handleSplitClip}
              />
            </div>

            {/* Playback bar — always at the bottom, never scrolled away */}
            <div className="shrink-0 px-5 py-2.5 border-t border-[#E8E5DE] bg-[#FAF9F5]">
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
          </div>

          {/* Zone 3: Inspector (Right) */}
          <div className="w-[340px] shrink-0 min-w-0 bg-white border border-[#E8E5DE] rounded-xl shadow-xs flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E8E5DE] flex items-center justify-between bg-[#FAF9F5]/50 shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#D97757]"></span>
                <h2 className="font-serif text-sm font-normal text-[#141413]">Inspector</h2>
              </div>
              <span className="text-[11px] font-sans text-[#87867F]">Processing & Output</span>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
              <div>
                <DitherControls 
                  config={ditherConfig} 
                  onChange={setDitherConfig} 
                  disabled={!media} 
                />
              </div>
              <div className="border-t border-[#E8E5DE] pt-4">
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
                  sourceFrame={rawSourceFrame}
                />
              </div>
            </div>
          </div>

        </aside>
      </main>

      {/* Modals & Studios (Lazy-Loaded On Demand) */}
      <React.Suspense fallback={null}>
        {settingsOpen && (
          <SettingsModal 
            isOpen={settingsOpen} 
            onClose={() => setSettingsOpen(false)} 
            config={hardwareConfig} 
            onChange={setHardwareConfig} 
          />
        )}
        {exportModalOpen && (
          <ExportModal 
            isOpen={exportModalOpen} 
            onClose={() => setExportModalOpen(false)} 
            cppCode={cppCode} 
            frameCount={media ? media.frames.length : 0}
            targetFps={targetFps}
            xbmpFrames={exportXbmpFrames}
          />
        )}
        {studioOpen && (
          <CharacterStudioModal 
            onClose={() => setStudioOpen(false)}
            onInject={(charMedia) => {
              const assetId = "asset_char_" + Date.now();
              const clipId = "clip_" + Date.now();
              setAssets(prev => ({ ...prev, [assetId]: { id: assetId, media: charMedia } }));
              setClipsWithHistory(prev => [
                ...prev,
                { id: clipId, assetId, inFrame: 0, outFrame: charMedia.frames.length - 1 }
              ]);
              setStudioOpen(false);
            }}
          />
        )}
        {activeView === 'lyrics-studio' && (
          <LyricsStudioView 
            onClose={() => setActiveView('editor')}
            onInjectToTimeline={(kineticMedia) => {
              const assetId = "asset_kinetic_" + Date.now();
              const clipId = "clip_" + Date.now();
              setAssets(prev => ({ ...prev, [assetId]: { id: assetId, media: kineticMedia } }));
              setClipsWithHistory(prev => [
                ...prev,
                { id: clipId, assetId, inFrame: 0, outFrame: kineticMedia.frames.length - 1 }
              ]);
              setActiveView('editor');
            }}
          />
        )}
      </React.Suspense>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}
