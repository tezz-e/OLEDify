import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Header } from './components/Header';
import { DropZone } from './components/DropZone';
import { TimelineTrack } from './components/TimelineTrack';
import { OledCanvas } from './components/OledCanvas';
import { DitherControls } from './components/DitherControls';
import { CropControls } from './components/CropControls';
import { DecryptedText } from './components/reactbits/DecryptedText';
import { CountUp } from './components/reactbits/CountUp';
import { BlueprintHoverCard } from './components/reactbits/BlueprintHoverCard';
import { FloatingTransportDock } from './components/transport/FloatingTransportDock';
import { HardwareTelemetryHUD } from './components/transport/HardwareTelemetryHUD';
import { getActiveTheme } from './theme/aestheticConfig';
import { HW_SPRINGS } from './theme/springPresets';

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
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#F5F0EB] text-[#1A1A1A] p-6 font-mono">
          <div className="bg-white border-2 border-[#1A1A1A] p-6 max-w-lg shadow-[8px_8px_0_0_#1A1A1A] flex flex-col gap-4">
            <h2 className="text-sm font-bold text-[#E85D2A] uppercase tracking-wider">⚠️ RECOVERY MODE ACTIVATED</h2>
            <p className="text-xs text-[#6B6B6B]">An unexpected runtime error occurred, but application state was preserved.</p>
            <pre className="p-3 bg-[#1A1A1A] text-white text-[10px] rounded overflow-auto max-h-36">
              {this.state.error?.message || 'Unknown error'}
            </pre>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
              className="py-2 px-4 bg-[#E85D2A] text-white text-xs font-bold border border-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white transition-colors cursor-pointer"
            >
              RELOAD STUDIO
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
  const [activeView, setActiveView] = useState<'editor' | 'lyrics-studio'>(() => {
    try {
      if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('view') === 'lyrics-studio') {
        return 'lyrics-studio';
      }
    } catch (_) {}
    return 'editor';
  });
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('oled_studio_theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch (_) {}
    return 'dark';
  });

  useEffect(() => {
    try {
      localStorage.setItem('oled_studio_theme', themeMode);
    } catch (_) {}
    if (themeMode === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }, [themeMode]);

  const isDark = themeMode === 'dark';
  const [mediaPoolTab, setMediaPoolTab] = useState<'import' | 'samples' | 'recent' | 'create'>('import');
  const [studioOpen, setStudioOpen] = useState(false);
  const [serialConnected, setSerialConnected] = useState(false);
  const [baudRate, setBaudRate] = useState<number>(() => {
    const saved = localStorage.getItem('oled_serial_baud');
    if (!saved || saved === '115200') {
      localStorage.setItem('oled_serial_baud', '921600');
      return 921600;
    }
    return Number(saved);
  });

  const handleBaudRateToggle = () => {
    const nextRate = baudRate === 921600 ? 115200 : 921600;
    setBaudRate(nextRate);
    localStorage.setItem('oled_serial_baud', String(nextRate));
  };
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportError, setExportError] = useState<string | null>(null);
  const [rawSourceFrame, setRawSourceFrame] = useState<ImageData | null>(null);
  const [previewFitMode, setPreviewFitMode] = useState<'contain' | 'cover'>('contain');
  const [cppCode, setCppCode] = useState('');
  const [exportXbmpFrames, setExportXbmpFrames] = useState<Uint8Array[]>([]);

  const fullPreviewCanvasRef = useRef<HTMLCanvasElement>(null);
  const scratchSourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const scratchCroppedCanvasRef = useRef<HTMLCanvasElement | null>(null);
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
    const w = asset.media.sourceInfo.sourceWidth;
    const h = asset.media.sourceInfo.sourceHeight;
    const cover = computeCoverCrop(w, h);
    setCropSettings(prev => ({
      ...prev,
      sourceWidth: w,
      sourceHeight: h,
      x: cover.x,
      y: cover.y,
      width: cover.width,
      height: cover.height
    }));
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
      // If Lyrics Studio is currently active, yield all keyboard shortcuts to the studio view
      if (activeView === 'lyrics-studio') return;

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
      if (activeView === 'lyrics-studio') return;
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
  }, [activeView, handleSplitClip, handleUndo, handleRedo, media, timelineMedia, selectedClipIds, clips, setClipsWithHistory]);

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
      const activeMedia = timelineMedia || media;
      if (!activeMedia || !activeMedia.frames[activeFrameIndex]) {
        setProcessedFrame(null);
        setRawSourceFrame(null);
        return;
      }
      sourceFrame = activeMedia.frames[activeFrameIndex].imageData;
    }

    setRawSourceFrame(sourceFrame);

    if (!sourceFrame) {
      setProcessedFrame(null);
      return;
    }
    
    // Efficiently reuse persistent scratch canvases to avoid 30fps DOM allocation pauses
    if (!scratchSourceCanvasRef.current) {
      scratchSourceCanvasRef.current = document.createElement('canvas');
    }
    const sourceCanvas = scratchSourceCanvasRef.current;
    if (sourceCanvas.width !== sourceFrame.width || sourceCanvas.height !== sourceFrame.height) {
      sourceCanvas.width = sourceFrame.width;
      sourceCanvas.height = sourceFrame.height;
    }
    const srcCtx = sourceCanvas.getContext('2d');
    if (srcCtx) srcCtx.putImageData(sourceFrame, 0, 0);

    if (!scratchCroppedCanvasRef.current) {
      scratchCroppedCanvasRef.current = document.createElement('canvas');
    }
    const cropped128x64 = renderCropTo128x64(sourceCanvas, cropSettings, scratchCroppedCanvasRef.current);
    
    const { ditheredImageData, xbmpBytes } = applyDithering(cropped128x64, ditherConfig);
    setProcessedFrame(ditheredImageData);

    if (serialStreamer.getConnected() && xbmpBytes) {
      serialStreamer.sendFrame(xbmpBytes);
    }
  }, [media, timelineMedia, activeFrameIndex, ditherConfig, cropSettings, serialConnected, targetFps, previewOverride, assets]);

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
      const success = await serialStreamer.connect(baudRate);
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

  const aesthetic = getActiveTheme();

  return (
    <div className={`h-screen flex flex-col overflow-hidden relative transition-colors ${isDark ? 'bg-[#181A1B] text-[#FAFAFA]' : 'bg-[#F6F6F4] text-[#1A1A1A]'}`}>
      <Header 
        serialConnected={serialConnected}
        baudRate={baudRate}
        onBaudRateToggle={handleBaudRateToggle}
        onSerialToggle={handleSerialToggle}
        onExportClick={handleExport}
        onSettingsOpen={() => setSettingsOpen(true)}
        hasMedia={!!media}
        isExporting={isExporting}
        exportProgress={exportProgress}
        exportError={exportError}
        activeView={activeView}
        onViewChange={setActiveView}
        themeMode={themeMode}
        onThemeToggle={() => setThemeMode(m => m === 'light' ? 'dark' : 'light')}
      />

      <main className="flex-1 flex flex-col min-h-0 z-10">
        {/* Top: 3-Column Preview Section */}
        <section className={`flex-1 flex items-stretch relative min-h-0 border-b transition-colors ${
          aesthetic.sectionBg(isDark)
        } ${aesthetic.sectionBorder(isDark)}`} style={aesthetic.gridStyle(isDark)}>
          {/* Column 1: Full Preview */}
          <div className={`flex-[2.5] p-2 lg:p-4 flex flex-col items-center justify-start relative border-r min-w-0 h-full transition-colors ${
            aesthetic.sectionBorder(isDark)
          }`}>
            <div className="w-full flex flex-col items-center justify-start h-full min-h-0">
              <div className="mb-1.5 shrink-0 text-center w-full">
                <h3 className={`font-mono font-bold text-xs tracking-wider ${aesthetic.accentTitle(isDark)}`}>FULL PREVIEW</h3>
                <p className={`font-mono text-[10px] ${aesthetic.accentSub(isDark)}`}>See the full video/animation here at normal scale</p>
              </div>
              
              <div className="flex-1 w-full relative min-h-0">
                <div className="absolute inset-0 p-1 flex items-center justify-center">
                  
                  {/* Flawless Aspect-Ratio Bounding Box (2:1 Container matching 128x64 display) */}
                  <div className="relative flex items-center justify-center max-w-full max-h-full shrink-0">
                    {/* Sizing SVG establishing constant 2:1 (512x256) box size */}
                    <svg 
                      viewBox="0 0 512 256"
                      width={512}
                      height={256}
                      className="max-w-full max-h-full w-full h-full block opacity-0 pointer-events-none"
                      style={{ objectFit: 'contain' }}
                    />

                    {/* Actual Container Box overlaying the exact expanded bounds */}
                    <div className={`absolute inset-0 border rounded-[4px] flex flex-col justify-between p-2 overflow-hidden transition-all ${
                      aesthetic.previewBox(isDark)
                    }`}>
                      {/* Media Display Area */}
                      <div className="flex-1 w-full min-h-0 relative flex items-center justify-center overflow-hidden">
                        {rawSourceFrame ? (
                          <canvas 
                            ref={fullPreviewCanvasRef}
                            className={`w-full h-full block ${previewFitMode === 'cover' ? 'object-cover' : 'object-contain'}`}
                            style={{ imageRendering: 'pixelated' }}
                          />
                        ) : (
                          <div className={`flex items-center justify-center w-full h-full ${isDark ? 'bg-[#181A1B]' : 'bg-[#111]'}`}>
                            <span className={`font-mono text-xs ${aesthetic.accentSub(isDark)}`}>NO MEDIA</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Playback Control Bar */}
                      <div className={`h-7 flex items-center px-2 gap-2 rounded-[4px] border shrink-0 mt-1 z-10 transition-colors ${
                        isDark 
                          ? 'bg-[#282A2E] border-white/10 text-[#FAFAFA]' 
                          : 'bg-[#111] border-white/10 text-white'
                      }`}>
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsPlaying(p => !p);
                          }} 
                          className={`text-xs font-bold transition-colors cursor-pointer px-1 py-1 ${
                            isPlaying ? 'text-[#00FF66]' : 'text-[#FAFAFA] hover:text-[#FF5500]'
                          }`}
                        >
                          {isPlaying ? '❚❚' : '▶'}
                        </button>
                        <div className="text-[9px] font-mono tabular-nums whitespace-nowrap text-[#FAFAFA]">
                          {(() => {
                            const totalMs = Math.round((activeFrameIndex / targetFps) * 1000);
                            const m = Math.floor(totalMs / 60000);
                            const s = Math.floor((totalMs % 60000) / 1000);
                            const ms = totalMs % 1000;
                            return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
                          })()}
                        </div>
                        <div className="flex-1 h-1 rounded-full relative min-w-[30px] bg-white/10">
                          <div 
                            className="absolute inset-y-0 left-0 rounded-full bg-[#FF5500]" 
                            style={{ width: media && media.frames.length ? `${(activeFrameIndex / media.frames.length) * 100}%` : '0%' }}
                          />
                        </div>
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setPreviewFitMode(m => m === 'cover' ? 'contain' : 'cover');
                          }} 
                          className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-[4px] transition-colors cursor-pointer uppercase tracking-wider bg-white/10 border border-white/10 text-[#FAFAFA] hover:bg-[#FF5500] hover:text-black hover:border-[#FF5500]"
                          title="Toggle FIT (contain full frame) vs FILL (zoom to fill box)"
                        >
                          {previewFitMode === 'cover' ? 'FILL' : 'FIT'}
                        </button>
                        <div className="text-[9px] font-mono whitespace-nowrap font-bold text-[#A1A1AA]">{targetFps} FPS</div>
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
              <h3 className={`font-mono font-bold text-xs tracking-wider ${aesthetic.accentTitle(isDark)}`}>TRUE OLED PREVIEW (128 × 64)</h3>
              <p className={`font-mono text-[10px] ${aesthetic.accentSub(isDark)}`}>Exact physical scale • 1:1 pixels</p>
            </div>

            <div className="relative flex items-center justify-center w-full max-h-full flex-1 min-h-0 gap-3">
              {/* Hardware Bezel */}
              <div className={`rounded-xl p-3 border relative z-10 shrink-0 max-w-full max-h-full flex flex-col justify-center transition-all ${
                isDark 
                  ? 'bg-[#202225] border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.5)]' 
                  : 'bg-[#2A2A2A] border-[#111] shadow-[0_10px_30px_rgba(0,0,0,0.5)]'
              }`}>
                {/* Screws */}
                <div className="absolute top-2 left-2 w-2.5 h-2.5 rounded-full bg-[#181A1B] border border-[#333] shadow-[inset_0_1px_2px_#000] flex items-center justify-center rotate-45"><div className="w-full h-[1px] bg-[#444]" /></div>
                <div className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-[#181A1B] border border-[#333] shadow-[inset_0_1px_2px_#000] flex items-center justify-center rotate-12"><div className="w-full h-[1px] bg-[#444]" /></div>
                <div className="absolute bottom-2 left-2 w-2.5 h-2.5 rounded-full bg-[#181A1B] border border-[#333] shadow-[inset_0_1px_2px_#000] flex items-center justify-center -rotate-12"><div className="w-full h-[1px] bg-[#444]" /></div>
                <div className="absolute bottom-2 right-2 w-2.5 h-2.5 rounded-full bg-[#181A1B] border border-[#333] shadow-[inset_0_1px_2px_#000] flex items-center justify-center rotate-90"><div className="w-full h-[1px] bg-[#444]" /></div>
                
                <div className={`font-mono text-[8px] text-center mb-1 ${aesthetic.accentSub(isDark)}`}>SSD1306 128x64</div>
                
                <div className="bg-[#000] p-1 shadow-[inset_0_0_10px_#000] rounded shrink flex items-center justify-center">
                  <div className="pointer-events-auto w-[128px]">
                    <OledCanvas frameData={processedFrame} theme={ditherConfig.theme} scale={8} />
                  </div>
                </div>

                <div className={`font-mono text-[8px] text-center mt-1 ${aesthetic.accentSub(isDark)}`}>I²C 0x3C</div>
              </div>

              {/* Technical Calibration Badge */}
              <div className="hidden xl:block shrink-0">
                <div className={`p-2.5 font-mono text-[8px] tracking-wider uppercase border rounded-[4px] ${
                  isDark ? 'bg-[#202225] border-white/10 text-[#71717A]' : 'bg-[#EAE8E3] border-[#1A1A1A]/20 text-[#5E5D59]'
                }`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00FF66]" />
                    <span className="font-bold text-[#FAFAFA]">SCALE 1:1</span>
                  </div>
                  <span>0.96" OLED MONO</span>
                </div>
              </div>
            </div>
          </div>

          {/* Column 3: Hardware Telemetry HUD / Display Info */}
          <div className={`w-[210px] shrink-0 p-3 border-l flex flex-col justify-start overflow-y-auto transition-colors ${
            aesthetic.sectionBorder(isDark)
          }`}>
            {aesthetic.id === 'hardware' ? (
              <HardwareTelemetryHUD
                mcu="ESP32-S3"
                displayDriver="SSD1306"
                baudRate={baudRate}
                fps={targetFps}
                currentFrame={activeFrameIndex}
                totalFrames={media ? media.frames.length : 0}
                isConnected={serialConnected}
                themeMode={themeMode}
              />
            ) : (
              <div className={`border p-3 font-mono text-xs flex flex-col gap-4 mb-auto transition-all ${
                isDark 
                  ? 'bg-[#0D0D10] border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.8)] text-[#F1EEF8]' 
                  : 'bg-white border-[#1A1A1A] shadow-[3px_3px_0_0_#1A1A1A] text-[#1A1A1A]'
              }`}>
                <div>
                  <div className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider mb-2 flex justify-between items-center ${
                    isDark ? 'bg-[#18181C] text-[#00FF66]' : 'bg-[#1A1A1A] text-white'
                  }`}>
                    <span>DISPLAY INFO</span>
                    <span className={`w-1.5 h-1.5 rounded-full ${isDark ? 'bg-[#00FF66]' : 'bg-[#E85D2A]'}`}></span>
                  </div>
                  <div className={`flex flex-col gap-0.5 text-[11px] ${isDark ? 'text-[#A1A1AA]' : 'text-[#6B6B6B]'}`}>
                    <div>128 × 64</div>
                    <div>1-BIT (MONO)</div>
                    <div>I²C 0x3C</div>
                    <div>{targetFps} FPS</div>
                  </div>
                </div>

                <div className={`h-px ${isDark ? 'bg-white/10' : 'bg-[#1A1A1A]/20'}`} />

                <div>
                  <div className={`text-[9px] font-bold uppercase tracking-wider mb-1 ${isDark ? 'text-[#F1EEF8]' : 'text-[#1A1A1A]'}`}>CURRENT FRAME</div>
                  <div className={`text-[11px] ${isDark ? 'text-[#A1A1AA]' : 'text-[#6B6B6B]'}`}>
                    {activeFrameIndex.toString().padStart(3, '0')} / {media ? media.frames.length.toString().padStart(3, '0') : '000'}
                  </div>
                  <div className={`text-[11px] ${isDark ? 'text-[#A1A1AA]' : 'text-[#6B6B6B]'}`}>
                    {(activeFrameIndex / targetFps).toFixed(2)}s
                  </div>
                </div>

                <div className={`h-px ${isDark ? 'bg-white/10' : 'bg-[#1A1A1A]/20'}`} />

                <div>
                  <div className={`text-[9px] font-bold uppercase tracking-wider mb-1 ${isDark ? 'text-[#F1EEF8]' : 'text-[#1A1A1A]'}`}>OUTPUT SIZE</div>
                  <div className={`text-[11px] ${isDark ? 'text-[#A59CB8]' : 'text-[#6B6B6B]'}`}>1024 bytes/frame</div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Bottom Console — Technical Control Panel */}
        <aside className={`h-[340px] shrink-0 flex z-20 p-4 gap-4 relative border-t-2 transition-colors ${
          aesthetic.sectionBg(isDark)
        } ${aesthetic.sectionBorder(isDark)}`}>
          
          {/* Zone 1: Media Pool (Left) */}
          <BlueprintHoverCard className="w-[280px] shrink-0 min-w-0" themeMode={themeMode}>
            <h2 className={`text-[10px] font-bold uppercase tracking-[0.2em] px-4 py-3 border-b-2 font-mono z-[2] relative flex items-center gap-2 ${
              aesthetic.panelHeader(isDark)
            }`}>
              <span className={`w-2 h-2 rounded-full ${aesthetic.signalDot(isDark)}`}></span>
              <span className={aesthetic.accentTitle(isDark)}>MEDIA_POOL</span>
            </h2>
            
            {/* Media Pool Tabs */}
            <div className={`flex border-b shrink-0 p-1 gap-1 relative ${isDark ? 'border-white/10 bg-[#202225]' : 'border-[#1A1A1A]/15 bg-[#EAE7E1]'}`}>
              {(
                [
                  { id: 'import', label: '+ IMPORT' },
                  { id: 'samples', label: 'SAMPLES' },
                  { id: 'recent', label: 'RECENT' },
                  { id: 'create', label: 'CREATE' },
                ] as const
              ).map((tab) => {
                const isActive = mediaPoolTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setMediaPoolTab(tab.id)}
                    className={`relative flex-1 py-1.5 rounded-[4px] text-[9px] font-bold font-mono tracking-widest cursor-pointer transition-colors duration-150 z-10 ${
                      isActive
                        ? isDark ? 'text-black' : 'text-white'
                        : isDark ? 'text-[#A1A1AA] hover:text-[#FAFAFA]' : 'text-[#5E5D59] hover:text-[#1A1A1A]'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="mediaPoolActivePill"
                        transition={HW_SPRINGS.smooth}
                        className={`absolute inset-0 rounded-[4px] z-[-1] ${
                          isDark ? 'bg-[#FF5500]' : 'bg-[#1A1A1A]'
                        }`}
                      />
                    )}
                    <span className="relative z-10">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex-1 flex flex-col min-h-0 overflow-y-auto z-[2] relative">
              {mediaPoolTab === 'import' && (
                <>
                  <DropZone onMediaLoaded={handleMediaLoaded} currentMedia={null} themeMode={themeMode} />
                  
                  {/* Asset Pool Grid */}
                  <div className="p-2.5">
                    {Object.values(assets).length === 0 ? (
                      <p className={`text-[9px] font-mono text-center py-6 border border-dashed ${
                        isDark ? 'text-[#71717A] border-white/10' : 'text-[#6B6B6B] border-[#1A1A1A]/30'
                      }`}>
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
                              className={`bg-[#202225] border transition-all cursor-grab active:cursor-grabbing relative group aspect-[4/3] flex flex-col overflow-hidden shadow-sm ${
                                isDark ? 'border-white/10 hover:border-[#FF5500]' : 'border-[#1A1A1A] hover:border-[#FF5500]'
                              }`}
                              title={`Double click or drag ${asset.media.sourceInfo.filename} to timeline`}
                            >
                              {/* Thumbnail Image */}
                              <div className="flex-1 w-full h-full relative overflow-hidden bg-[#181A1B]">
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
                                <span className={`absolute top-1 right-1 bg-black/80 text-[7px] font-mono px-1 py-0.5 border font-bold ${
                                  isDark ? 'text-[#FAFAFA] border-white/20' : 'text-white border-white/20'
                                }`}>
                                  {asset.media.frames.length}f
                                </span>

                                {/* Bottom title */}
                                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black via-black/90 to-transparent p-1 pt-3">
                                  <p className="text-[8px] font-bold text-white font-mono truncate">{asset.media.sourceInfo.filename}</p>
                                </div>

                                {/* Hover Action Overlay */}
                                <div className="absolute inset-0 bg-black/85 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-1.5 gap-1.5 z-10">
                                  <span className="text-[7px] font-mono font-bold uppercase tracking-wider text-[#FF5500]">
                                    DRAG OR CHOOSE
                                  </span>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleAddAssetToTimeline(asset.id); }}
                                    className="w-full py-1 text-[8px] font-bold transition-colors cursor-pointer uppercase font-mono tracking-wider bg-[#FF5500] text-black font-extrabold hover:bg-white"
                                  >
                                    + ADD CLIP
                                  </button>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleReplaceTimelineWithAsset(asset.id); }}
                                    className={`w-full py-0.5 text-[7px] font-bold transition-colors cursor-pointer uppercase font-mono tracking-wider ${
                                      isDark ? 'border border-white/20 text-white hover:bg-white/10' : 'border border-white/40 text-white hover:bg-white hover:text-[#1A1A1A]'
                                    }`}
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
                    <span className={`text-[8px] font-mono uppercase tracking-wider font-bold ${
                      isDark ? 'text-[#A59CB8]' : 'text-[#6B6B6B]'
                    }`}>SAMPLE ANIMATION BIN</span>
                    <span className={`text-[7px] font-mono ${isDark ? 'text-[#7E7694]' : 'text-[#888]'}`}>Double-click or drag card</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'dino', name: 'DINO RUNNER', tag: '30FPS' },
                      { id: 'heartbeat', name: 'ECG HEARTBEAT', tag: 'PQRST' },
                      { id: 'spinner', name: 'LOADING SPINNER', tag: 'ARC' },
                      { id: 'wificonnect', name: 'WIFI SIGNAL', tag: 'PULSE' },
                      { id: 'bouncing', name: 'BOUNCING LOGO', tag: '60f' },
                      { id: 'pacman', name: 'PAC-MAN LOOP', tag: 'CHOMP' },
                      { id: 'battery', name: 'BATTERY CHARGE', tag: '100%' },
                      { id: 'sinewave', name: 'SINE WAVE OSC', tag: '1.2kHz' },
                      { id: 'ripple', name: 'RADAR RIPPLE', tag: 'SCAN' },
                      { id: 'analogclock', name: 'ANALOG CLOCK', tag: 'TICKS' },
                      { id: 'starfield', name: 'STARFIELD WARP', tag: '3D' },
                      { id: 'matrix', name: 'MATRIX RAIN', tag: '1-BIT' },
                      { id: 'rain', name: 'RAIN STORM', tag: 'SHOWER' },
                      { id: 'badapple', name: 'BAD APPLE', tag: 'MONO' },
                      { id: 'dvd', name: 'DVD BOUNCE', tag: 'CORNER' },
                      { id: 'cube3d', name: '3D CUBE WIRING', tag: '3D MESH' },
                      { id: 'flame', name: 'DOOM FIRE SIM', tag: 'AUTOMATA' },
                      { id: 'plasma', name: 'DITHERED PLASMA', tag: 'BAYER4x4' },
                      { id: 'fireworks', name: 'FIREWORKS BURST', tag: 'SPARKS' },
                      { id: 'roboeyes', name: 'ROBO-EYES FACE', tag: 'DYNAMIC' },
                      { id: 'spirograph', name: 'SPIROGRAPH ROULETTE', tag: 'MATH' },
                      { id: 'qrcode', name: 'QR SCANNER WIPE', tag: 'LASER' },
                    ].map(sample => (
                      <div
                        key={sample.id}
                        draggable={true}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('application/x-oled-asset', sample.id);
                          e.dataTransfer.setData('text/plain', sample.id);
                        }}
                        onDoubleClick={() => handleLoadSample(sample.id as any, 'append')}
                        className={`bg-[#202225] border rounded-[4px] transition-all cursor-grab active:cursor-grabbing relative group aspect-[4/3] flex flex-col overflow-hidden shadow-sm ${
                          isDark ? 'border-white/10 hover:border-[#FF5500]' : 'border-[#1A1A1A] hover:border-[#FF5500]'
                        }`}
                        title={`Double click or drag ${sample.name} to timeline`}
                      >
                        {/* Thumbnail Image */}
                        <div className="flex-1 w-full h-full relative overflow-hidden bg-[#181A1B]">
                          {sampleThumbnails[sample.id] ? (
                            <img 
                              src={sampleThumbnails[sample.id]} 
                              alt={sample.name} 
                              className="w-full h-full object-cover opacity-85 group-hover:opacity-100 transition-opacity" 
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs font-mono text-[#71717A]">{sample.id}</div>
                          )}

                          {/* FPS Badge */}
                          <span className={`absolute top-1 right-1 bg-black/90 text-[7px] font-mono px-1 py-0.5 border rounded-[2px] font-bold ${
                            isDark ? 'text-[#FAFAFA] border-white/20' : 'text-white border-white/20'
                          }`}>
                            {sample.tag}
                          </span>

                          {/* Bottom Title Bar */}
                          <div className="absolute bottom-0 inset-x-0 bg-black/90 p-1">
                            <p className="text-[8px] font-bold text-white font-mono truncate">
                              {sample.name}
                            </p>
                          </div>

                          {/* Hover Action Overlay */}
                          <div className="absolute inset-0 bg-black/90 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-1.5 gap-1.5 z-10">
                            <span className="text-[7px] font-mono font-bold uppercase tracking-wider text-[#FF5500]">DRAG OR CHOOSE</span>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleLoadSample(sample.id as any, 'append'); }}
                              className="w-full py-1 text-[8px] font-bold transition-colors cursor-pointer uppercase font-mono tracking-wider rounded-[4px] bg-[#FF5500] text-black font-extrabold hover:bg-white"
                              title="Append sample animation to timeline"
                            >
                              + ADD CLIP
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleLoadSample(sample.id as any, 'replace'); }}
                              className="w-full py-0.5 text-[7px] font-bold transition-colors cursor-pointer uppercase font-mono tracking-wider rounded-[4px] border border-white/20 text-white hover:bg-white/10"
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

              {mediaPoolTab === 'create' && (
                <div className={`p-4 flex-1 flex flex-col items-center justify-center text-center gap-4 border border-dashed m-2 rounded ${
                  isDark ? 'border-white/10 bg-[#202225]' : 'border-[#1A1A1A]/30 bg-[#F6F6F4]'
                }`}>
                  <p className={`text-[10px] font-mono ${isDark ? 'text-[#A1A1AA]' : 'text-[#6B6B6B]'}`}>
                    Generate pure beat-synced kinetic typography sequence
                  </p>
                  <button
                    onClick={() => setActiveView('lyrics-studio')}
                    className="py-2.5 px-5 text-xs font-mono font-bold tracking-widest border rounded-[4px] transition-colors cursor-pointer bg-[#FF5500] text-black border-[#FF5500] hover:bg-white hover:border-white"
                  >
                    LAUNCH KINETIC LYRICS STUDIO
                  </button>
                </div>
              )}

              {mediaPoolTab === 'recent' && (
                <div className="p-2.5">
                  {Object.values(assets).length === 0 ? (
                    <p className={`text-[9px] font-mono text-center py-6 border border-dashed ${
                      isDark ? 'text-[#71717A] border-white/10' : 'text-[#6B6B6B] border-[#1A1A1A]/30'
                    }`}>
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
                            className={`bg-[#202225] border transition-all cursor-grab active:cursor-grabbing relative group aspect-[4/3] flex flex-col overflow-hidden shadow-sm ${
                              isDark ? 'border-white/10 hover:border-[#FF5500]' : 'border-[#1A1A1A] hover:border-[#FF5500]'
                            }`}
                          >
                            <div className="flex-1 w-full h-full relative overflow-hidden bg-[#181A1B]">
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
                              <span className={`absolute top-1 right-1 bg-black/80 text-[7px] font-mono px-1 py-0.5 border font-bold ${
                                isDark ? 'text-[#00FF66] border-[#00FF66]/30' : 'text-white border-white/20'
                              }`}>
                                {asset.media.frames.length}f
                              </span>
                              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black via-black/90 to-transparent p-1 pt-3">
                                <p className="text-[8px] font-bold text-white font-mono truncate">{asset.media.sourceInfo.filename}</p>
                              </div>
                              <div className="absolute inset-0 bg-black/85 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-1.5 gap-1.5 z-10">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleAddAssetToTimeline(asset.id); }}
                                  className="w-full py-1 text-[8px] font-bold transition-colors cursor-pointer uppercase font-mono tracking-wider bg-[#FF5500] text-black font-extrabold hover:bg-white"
                                >
                                  + ADD CLIP
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleReplaceTimelineWithAsset(asset.id); }}
                                  className={`w-full py-0.5 text-[7px] font-bold transition-colors cursor-pointer uppercase font-mono tracking-wider ${
                                    isDark ? 'border border-white/20 text-white hover:bg-white/10' : 'border border-white/40 text-white hover:bg-white hover:text-[#1A1A1A]'
                                  }`}
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
          <BlueprintHoverCard className="flex-1 min-w-0 flex flex-col overflow-hidden" themeMode={themeMode}>
            <h2 className={`text-[10px] font-bold uppercase tracking-[0.2em] px-6 py-3 border-b-2 font-mono z-[2] relative flex justify-between items-center shrink-0 ${
              aesthetic.panelHeader(isDark)
            }`}>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${aesthetic.signalDot(isDark)}`}></span>
                <span className={aesthetic.accentTitle(isDark)}>TIMELINE</span>
              </div>
              {media && <span className={aesthetic.accentSub(isDark)}>{media.frames.length} FRAMES | {targetFps} FPS</span>}
            </h2>

            {/* Timeline track — fills remaining space */}
            <div className="flex-1 min-h-0 overflow-hidden z-[2] relative pb-16">
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
                onLaunchLyrics={() => setActiveView('lyrics-studio')}
                onSplitClip={handleSplitClip}
                serialConnected={serialConnected}
                baudRate={baudRate}
                targetFps={targetFps}
                themeMode={themeMode}
                onToggleSerial={() => setSerialConnected(prev => !prev)}
              />
            </div>
          </BlueprintHoverCard>

          {/* Zone 3: Inspector (Right) */}
          <BlueprintHoverCard className="w-[340px] shrink-0 min-w-0" themeMode={themeMode}>
            <h2 className={`text-[10px] font-bold uppercase tracking-[0.2em] px-4 py-3 border-b-2 font-mono z-[2] relative ${
              aesthetic.panelHeader(isDark)
            }`}>
              <span className={aesthetic.accentTitle(isDark)}>INSPECTOR</span>
            </h2>
            <div className="flex-1 overflow-y-auto pr-4 px-4 py-4 pb-24 space-y-6 z-[2] relative">
              <div>
                <DitherControls 
                  config={ditherConfig} 
                  onChange={setDitherConfig} 
                  disabled={!media} 
                  themeMode={themeMode}
                />
              </div>
              <div className={`border-t pt-4 ${aesthetic.sectionBorder(isDark)}`}>
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
                  themeMode={themeMode}
                />
              </div>
            </div>
          </BlueprintHoverCard>

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
            themeMode={themeMode}
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
            themeMode={themeMode}
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
        <div className={activeView === 'lyrics-studio' ? 'contents' : 'hidden'}>
          <LyricsStudioView 
            isOpen={activeView === 'lyrics-studio'}
            onClose={() => setActiveView('editor')}
            themeMode={themeMode}
            onThemeChange={setThemeMode}
            onInjectToTimeline={(kineticMedia, shouldClose = true) => {
              const assetId = "asset_kinetic_" + Date.now();
              const clipId = "clip_" + Date.now();
              setAssets(prev => ({ ...prev, [assetId]: { id: assetId, media: kineticMedia } }));
              setClipsWithHistory(prev => [
                ...prev,
                { id: clipId, assetId, inFrame: 0, outFrame: kineticMedia.frames.length - 1 }
              ]);
              setCropSettings({
                mode: 'cover',
                sourceWidth: 128,
                sourceHeight: 64,
                x: 0,
                y: 0,
                width: 128,
                height: 64,
                smoothing: true
              });
              if (shouldClose) {
                setActiveView('editor');
              }
            }}
          />
        </div>
      </React.Suspense>

      {/* Floating Dynamic Island Transport Dock (Option A) */}
      {activeView === 'editor' && (
        <FloatingTransportDock
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
          docked={false}
          serialConnected={serialConnected}
          baudRate={baudRate}
          themeMode={themeMode}
        />
      )}
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
