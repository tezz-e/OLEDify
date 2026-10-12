import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
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
import { HardwareTelemetryHUD } from './components/hardware/HardwareTelemetryHUD';
import { getActiveTheme } from './theme/aestheticConfig';
import { HW_SPRINGS } from './theme/springPresets';
import { BorderBeam } from './components/magicui/BorderBeam';
import { Spotlight } from './components/ui/Spotlight';
import { DropStageCassette } from './components/DropStageCassette';
import { triggerTactileFeedback } from './components/hardware/hapticAudio';
import { GooeySegmentedControl } from './components/ui/GooeySegmentedControl';

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
import { UploadCloud, AlertTriangle, Play, Pause } from 'lucide-react';
import { decodeVideo } from './engine/mediaDecoder';

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
            <h2 className="text-sm font-bold text-[#FF5500] uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Recovery mode activated</span>
            </h2>
            <p className="text-xs text-[#6B6B6B]">An unexpected runtime error occurred, but application state was preserved.</p>
            <pre className="p-3 bg-[#1A1A1A] text-white text-[10px] rounded overflow-auto max-h-36">
              {this.state.error?.message || 'Unknown error'}
            </pre>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
              className="py-2 px-4 bg-[#FF5500] text-white text-xs font-bold border border-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white transition-colors cursor-pointer"
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
  const [fullPreviewScaleMode, setFullPreviewScaleMode] = useState<'fit' | '100%'>('fit');
  const [userOledScale, setUserOledScale] = useState<null | 'fit' | 1 | 2 | 4>(null);
  const [oledMaxN, setOledMaxN] = useState<number>(4);
  const [fullPreviewDims, setFullPreviewDims] = useState<{ width: number; height: number; fitScale: number }>({ width: 0, height: 0, fitScale: 1 });
  const [cppCode, setCppCode] = useState('');
  const [exportXbmpFrames, setExportXbmpFrames] = useState<Uint8Array[]>([]);

  const oledFrameAreaRef = useRef<HTMLDivElement>(null);
  const fullPreviewContainerRef = useRef<HTMLDivElement>(null);
  const fullPreviewCanvasRef = useRef<HTMLCanvasElement>(null);
  const scratchSourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const scratchCroppedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const exportInProgressRef = useRef(false);
  const lastStreamTime = useRef(0);

  // ResizeObserver for dynamic OLED preview Fit & maxN calculation (Task 1)
  useEffect(() => {
    if (!oledFrameAreaRef.current) return;
    const calculateMaxN = () => {
      if (!oledFrameAreaRef.current) return;
      const { clientHeight } = oledFrameAreaRef.current;
      // Frame chrome: bezel padding (~40px) + labels (~48px) + screen padding/borders (~16px) = ~104px
      const chromeH = 104;
      const availH = Math.max(0, clientHeight - chromeH);
      const fitN = Math.floor(availH / 64);
      const computedMax = Math.max(1, Math.min(fitN, 4));
      setOledMaxN(computedMax);
    };
    calculateMaxN();
    const ro = new ResizeObserver(calculateMaxN);
    ro.observe(oledFrameAreaRef.current);
    return () => ro.disconnect();
  }, []);



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

  // ResizeObserver for Full Preview pane fitting (Task 2)
  useEffect(() => {
    if (!fullPreviewContainerRef.current) return;
    const updateFullPreviewDims = () => {
      if (!fullPreviewContainerRef.current) return;
      const { clientWidth, clientHeight } = fullPreviewContainerRef.current;
      // Account for p-2 padding (16px total)
      const availW = Math.max(1, clientWidth - 16);
      const availH = Math.max(1, clientHeight - 16);
      const srcW = media?.sourceInfo.sourceWidth || 128;
      const srcH = media?.sourceInfo.sourceHeight || 64;
      const scale = Math.min(availW / srcW, availH / srcH);
      const renderedW = Math.max(1, Math.round(srcW * scale));
      const renderedH = Math.max(1, Math.round(srcH * scale));
      setFullPreviewDims({ width: renderedW, height: renderedH, fitScale: scale });
    };
    updateFullPreviewDims();
    const ro = new ResizeObserver(updateFullPreviewDims);
    ro.observe(fullPreviewContainerRef.current);
    return () => ro.disconnect();
  }, [media?.sourceInfo.sourceWidth, media?.sourceInfo.sourceHeight]);

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

  const [isStageDragging, setIsStageDragging] = useState(false);
  const [isStageDecoding, setIsStageDecoding] = useState(false);

  const handleStageDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setIsStageDragging(true);
    else if (e.type === 'dragleave') setIsStageDragging(false);
  }, []);

  const handleStageProcessFile = useCallback(async (file: File) => {
    setIsStageDecoding(true);
    try {
      const decoded = await decodeVideo(file, { targetFps: 30 });
      handleMediaLoaded(decoded);
    } catch (err) {
      console.error(err);
      alert('Failed to process media file.');
    } finally {
      setIsStageDecoding(false);
    }
  }, []);

  const handleStageDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsStageDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleStageProcessFile(e.dataTransfer.files[0]);
    }
  }, [handleStageProcessFile]);

  const handleStageFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleStageProcessFile(e.target.files[0]);
    }
  }, [handleStageProcessFile]);

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
      triggerTactileFeedback('toggle');
      await serialStreamer.disconnect();
      setSerialConnected(false);
    } else {
      const success = await serialStreamer.connect(baudRate);
      if (success) {
        triggerTactileFeedback('snap');
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

  const activeMedia = timelineMedia || media;
  const aesthetic = getActiveTheme();
  const isStreaming = Boolean(serialConnected && isPlaying && activeMedia);
  const activeOledScaleMode = userOledScale ?? (activeMedia ? 1 : 'fit');
  const effectiveOledScale = activeOledScaleMode === 'fit' ? oledMaxN : activeOledScaleMode;

  return (
    <div className={`h-screen flex flex-col overflow-hidden relative transition-colors ${isDark ? 'bg-[var(--hw-bg-canvas)] text-[#FAFAFA]' : 'bg-[#F4F2EC] text-[#1A1A1A]'}`}>
      <Header 
        serialConnected={serialConnected}
        baudRate={baudRate}
        onBaudRateToggle={handleBaudRateToggle}
        onSerialToggle={handleSerialToggle}
        onExportClick={handleExport}
        onSettingsOpen={() => setSettingsOpen(true)}
        hasMedia={!!activeMedia}
        isExporting={isExporting}
        exportProgress={exportProgress}
        exportError={exportError}
        activeView={activeView}
        onViewChange={setActiveView}
        themeMode={themeMode}
        onThemeToggle={() => setThemeMode(m => m === 'light' ? 'dark' : 'light')}
      />

      {activeView === 'editor' ? (
        <main className="flex-1 flex flex-col min-h-0 z-10">
        {/* Top: Preview Stage Section (Task 3: Identical 3-pane structure in empty & loaded states) */}
        <section className={`flex-1 flex items-stretch relative min-h-0 border-b transition-colors ${
          aesthetic.sectionBg(isDark)
        } ${aesthetic.sectionBorder(isDark)}`} style={aesthetic.gridStyle(isDark)}>
          {/* Pane 1: Full Preview or Large Drop Zone (flex-1 min-w-0) */}
          <div className={`flex-1 min-w-0 p-4 flex flex-col items-stretch justify-between relative border-r h-full transition-colors ${
            aesthetic.sectionBorder(isDark)
          }`}>
            {!activeMedia ? (
              /* Empty state: Large dashed drop target filling the pane with Hairline Tape Cassette */
              <label
                onDragEnter={handleStageDrag}
                onDragLeave={handleStageDrag}
                onDragOver={handleStageDrag}
                onDrop={handleStageDrop}
                className={`relative overflow-hidden w-full h-full border border-dashed rounded-[10px] flex flex-col items-center justify-between p-3 cursor-pointer transition-colors ${
                  isStageDragging
                    ? 'border-[#FF5500] bg-[#FF5500]/10 shadow-[0_0_30px_rgba(255,85,0,0.15)]'
                    : isDark
                    ? 'border-white/[0.12] bg-[var(--hw-bg-surface)] hover:border-white/20'
                    : 'border-black/[0.12] bg-[var(--hw-bg-surface)] hover:border-black/20'
                }`}
              >
                <Spotlight size={280} />
                <input
                  type="file"
                  accept="video/mp4,video/webm,image/gif,image/png"
                  className="hidden"
                  onChange={handleStageFileInput}
                />
                
                {/* Interactive Hairline Isometric Cassette Figure */}
                <DropStageCassette
                  isDark={isDark}
                  isDragOver={isStageDragging}
                  isDecoding={isStageDecoding}
                />

                <div className="text-center z-10 shrink-0 mb-1">
                  <div className="text-xs font-semibold text-[var(--hw-text-primary)] font-sans">
                    {isStageDecoding ? 'Mounting media...' : 'Drop video or GIF to mount'}
                  </div>
                  <div className="text-[11px] text-[var(--hw-text-secondary)] font-sans mt-0.5">
                    MP4, WebM, GIF, or APNG · Optical 30 FPS
                  </div>
                </div>

                <div className="flex items-center gap-2 z-10 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleLoadSample('dino', 'replace');
                    }}
                    className="px-3 py-1 text-xs font-sans font-medium rounded-[6px] border border-[var(--hw-border-hairline)] bg-[var(--hw-bg-canvas)] text-[var(--hw-text-secondary)] hover:text-[var(--hw-text-primary)] hover:border-[var(--hw-border-specular)] transition-colors cursor-pointer"
                  >
                    Try Dino
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setMediaPoolTab('samples');
                    }}
                    className="text-xs font-sans text-zinc-400 hover:text-[var(--hw-text-primary)] underline underline-offset-2 cursor-pointer"
                  >
                    browse samples
                  </button>
                </div>
              </label>
            ) : (
              /* Loaded state: Full Preview with dynamic Fit sizing & real caption */
              <>
                {/* Header: title + computed caption */}
                <div className="mb-2 shrink-0 text-center w-full">
                  <h3 className="font-sans font-semibold text-xs tracking-tight text-[var(--hw-text-primary)]">
                    Full preview
                  </h3>
                  <p className="text-[11px] text-[var(--hw-text-secondary)]">
                    <span className="font-sans">{activeMedia.sourceInfo.filename}</span> · <span className="font-mono">{activeMedia.sourceInfo.sourceWidth}×{activeMedia.sourceInfo.sourceHeight}</span> <span className="font-sans">px</span> · <span className="font-sans">{fullPreviewScaleMode === 'fit' ? `Fit (${fullPreviewDims.fitScale.toFixed(1)}×)` : '100%'}</span>
                  </p>
                </div>

                {/* Content: Main source display filling pane */}
                <div 
                  ref={fullPreviewContainerRef}
                  className={`flex-1 w-full min-h-0 relative flex items-center justify-center overflow-auto rounded-[6px] ${
                    isDark ? 'bg-black/40' : 'bg-black/5'
                  } border border-[var(--hw-border-hairline)] p-2`}
                >
                  {rawSourceFrame ? (
                    <canvas 
                      ref={fullPreviewCanvasRef}
                      className="block"
                      style={
                        fullPreviewScaleMode === '100%'
                          ? {
                              width: `${activeMedia.sourceInfo.sourceWidth}px`,
                              height: `${activeMedia.sourceInfo.sourceHeight}px`,
                              imageRendering: 'pixelated',
                              flexShrink: 0,
                            }
                          : {
                              width: `${fullPreviewDims.width}px`,
                              height: `${fullPreviewDims.height}px`,
                              imageRendering: fullPreviewDims.fitScale >= 2 ? 'pixelated' : 'auto',
                              flexShrink: 0,
                            }
                      }
                    />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full">
                      <span className="font-sans text-xs text-[var(--hw-text-secondary)]">No source frame</span>
                    </div>
                  )}
                </div>

                {/* Controls Row */}
                <div className="h-8 flex items-center px-2.5 gap-2 rounded-[6px] border border-[var(--hw-border-hairline)] shrink-0 mt-2 bg-[var(--hw-bg-surface)] text-[var(--hw-text-primary)]">
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsPlaying(p => !p);
                    }} 
                    className={`text-xs font-bold transition-colors cursor-pointer px-1 py-1 ${
                      isPlaying ? 'text-[#FF5500]' : 'text-[var(--hw-text-primary)] hover:text-[#FF5500]'
                    }`}
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
                  </button>
                  <div className="text-[11px] font-mono tabular-nums whitespace-nowrap text-[var(--hw-text-secondary)]">
                    {(() => {
                      const totalMs = Math.round((activeFrameIndex / targetFps) * 1000);
                      const m = Math.floor(totalMs / 60000);
                      const s = Math.floor((totalMs % 60000) / 1000);
                      const ms = totalMs % 1000;
                      return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
                    })()}
                  </div>
                  {/* Draggable Scrubber track */}
                  <div 
                    className="flex-1 flex items-center h-5 relative cursor-pointer group px-1"
                    onPointerDown={(e) => {
                      e.currentTarget.setPointerCapture(e.pointerId);
                      const rect = e.currentTarget.getBoundingClientRect();
                      const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                      if (activeMedia && activeMedia.frames.length > 0) {
                        setActiveFrameIndex(Math.min(activeMedia.frames.length - 1, Math.floor(pos * activeMedia.frames.length)));
                      }
                    }}
                    onPointerMove={(e) => {
                      if (e.buttons === 1) {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                        if (activeMedia && activeMedia.frames.length > 0) {
                          setActiveFrameIndex(Math.min(activeMedia.frames.length - 1, Math.floor(pos * activeMedia.frames.length)));
                        }
                      }
                    }}
                  >
                    <div className={`w-full h-1 rounded-full ${isDark ? 'bg-white/10' : 'bg-black/10'} relative overflow-hidden`}>
                      <div 
                        className={`h-full bg-[#FF5500] rounded-full ${isPlaying ? 'transition-none' : 'transition-all duration-75'}`}
                        style={{ width: activeMedia && activeMedia.frames.length ? `${((activeFrameIndex + 1) / activeMedia.frames.length) * 100}%` : '0%' }}
                      />
                    </div>
                    {/* Draggable orange scroll head */}
                    <div 
                      className="absolute pointer-events-none w-2.5 h-2.5 rounded-full bg-[#FF5500] border border-white/60 -translate-x-1/2 top-1/2 -translate-y-1/2 shadow-xs group-hover:scale-125 transition-transform"
                      style={{ left: activeMedia && activeMedia.frames.length ? `${((activeFrameIndex + 1) / activeMedia.frames.length) * 100}%` : '0%' }}
                    />
                  </div>
                  {/* Fit | 100% toggle */}
                  <div className="flex items-center p-0.5 rounded-[4px] border border-[var(--hw-border-hairline)] bg-[var(--hw-bg-canvas)]">
                    <button 
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setFullPreviewScaleMode('fit');
                      }} 
                      className={`text-[10px] font-sans font-medium px-2 py-0.5 rounded-[3px] transition-colors cursor-pointer ${
                        fullPreviewScaleMode === 'fit'
                          ? (isDark ? 'bg-white/15' : 'bg-black/10') + ' text-[var(--hw-text-primary)] font-semibold'
                          : 'text-[var(--hw-text-secondary)] hover:text-[var(--hw-text-primary)]'
                      }`}
                    >
                      Fit
                    </button>
                    <button 
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setFullPreviewScaleMode('100%');
                      }} 
                      className={`text-[10px] font-sans font-medium px-2 py-0.5 rounded-[3px] transition-colors cursor-pointer ${
                        fullPreviewScaleMode === '100%'
                          ? (isDark ? 'bg-white/15' : 'bg-black/10') + ' text-[var(--hw-text-primary)] font-semibold'
                          : 'text-[var(--hw-text-secondary)] hover:text-[var(--hw-text-primary)]'
                      }`}
                    >
                      100%
                    </button>
                  </div>
                  <div className="text-[11px] whitespace-nowrap text-[var(--hw-text-secondary)]">
                    <span className="font-mono">{targetFps}</span> <span className="font-sans">FPS</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Pane 2: OLED Preview (Task 1: [caption row: fixed] [frame area: flex-1 min-h-0] [controls row: fixed]) */}
          <div className="shrink-0 w-auto p-4 flex flex-col items-center justify-between relative min-w-0 h-full">
            {/* 1. Header: title + computed caption */}
            <div className="text-center mb-2 shrink-0">
              <h3 className="font-sans font-semibold text-xs tracking-tight text-[var(--hw-text-primary)]">
                OLED preview
              </h3>
              <p className="text-[11px] text-[var(--hw-text-secondary)]">
                <span className="font-mono">{effectiveOledScale}×</span> · <span className="font-mono">{128 * effectiveOledScale}×{64 * effectiveOledScale}</span> <span className="font-sans">px</span>
              </p>
            </div>

            {/* 2. Content: Hardware Bezel at exact integer scale (overflow hidden to prevent scrollbars) */}
            <div ref={oledFrameAreaRef} className="flex-1 min-h-0 min-w-0 flex items-center justify-center p-1 relative overflow-hidden">
              <div className={`rounded-[12px] p-3.5 sm:p-4 border relative z-10 shrink-0 flex flex-col justify-center items-center transition-all ${
                isDark 
                  ? 'bg-[#18181c] border-white/15 shadow-[0_22px_50px_rgba(0,0,0,0.65),inset_0_1px_1px_rgba(255,255,255,0.18)]' 
                  : 'bg-[#2A2A2A] border-[#111] shadow-[0_16px_36px_rgba(0,0,0,0.45),inset_0_1px_1px_rgba(255,255,255,0.2)]'
              }`}>
                {/* BorderBeam ONLY while connected/streaming */}
                {serialConnected && isStreaming && (
                  <BorderBeam size={160} duration={6} colorFrom="#FF5500" colorTo="#FF5500" borderWidth={1.5} />
                )}

                {/* Screws */}
                <div className="absolute top-2.5 left-2.5 w-2.5 h-2.5 rounded-full bg-[#141517] border border-[#333] shadow-[inset_0_1px_2px_#000] flex items-center justify-center rotate-45"><div className="w-full h-[1px] bg-[#444]" /></div>
                <div className="absolute top-2.5 right-2.5 w-2.5 h-2.5 rounded-full bg-[#141517] border border-[#333] shadow-[inset_0_1px_2px_#000] flex items-center justify-center rotate-12"><div className="w-full h-[1px] bg-[#444]" /></div>
                <div className="absolute bottom-2.5 left-2.5 w-2.5 h-2.5 rounded-full bg-[#141517] border border-[#333] shadow-[inset_0_1px_2px_#000] flex items-center justify-center -rotate-12"><div className="w-full h-[1px] bg-[#444]" /></div>
                <div className="absolute bottom-2.5 right-2.5 w-2.5 h-2.5 rounded-full bg-[#141517] border border-[#333] shadow-[inset_0_1px_2px_#000] flex items-center justify-center rotate-90"><div className="w-full h-[1px] bg-[#444]" /></div>
                
                <div className="font-mono text-[10.5px] tracking-wider uppercase text-center mb-2 text-[var(--hw-text-secondary)] select-none font-medium">
                  SSD1306 128×64 · 0.96″
                </div>
                
                {/* Recessed Display Glass Well with Authentic Chamfer */}
                <div className="bg-[#000] p-1.5 shadow-[inset_0_3px_12px_rgba(0,0,0,0.95)] rounded-[8px] shrink-0 flex items-center justify-center border border-white/[0.08] ring-1 ring-black/80">
                  <OledCanvas frameData={processedFrame} theme={ditherConfig.theme} scale={effectiveOledScale} />
                </div>

                <div className="font-mono text-[10px] tracking-wider uppercase text-center mt-2 text-[var(--hw-text-secondary)] select-none font-medium">
                  I²C 0x3C
                </div>
              </div>
            </div>

            {/* 3. Controls Row: Gooey Sliding & Clickable Scale Segmented Selector */}
            <div className="mt-2 shrink-0 w-44">
              <GooeySegmentedControl
                options={[
                  { id: '1', label: '1×' },
                  { id: '2', label: '2×' },
                  { id: '4', label: '4×' },
                  { id: 'fit', label: 'Fit' },
                ]}
                value={String(activeOledScaleMode)}
                onChange={(val) => {
                  const s = val === 'fit' ? 'fit' : Number(val);
                  setUserOledScale(s as any);
                }}
                size="sm"
                themeMode={themeMode}
              />
            </div>
          </div>

          {/* Pane 3: Hardware Telemetry HUD */}
          <div className={`w-[210px] lg:w-[230px] shrink-0 p-4 border-l flex flex-col justify-start overflow-y-auto transition-colors ${
            aesthetic.sectionBorder(isDark)
          }`}>
            <HardwareTelemetryHUD
              mcu="ESP32-S3"
              displayDriver="SSD1306"
              baudRate={baudRate}
              fps={targetFps}
              currentFrame={activeFrameIndex}
              totalFrames={activeMedia ? activeMedia.frames.length : 0}
              isConnected={serialConnected}
              isStreaming={isStreaming}
              themeMode={themeMode}
            />
          </div>
        </section>

        {/* Bottom Console — Technical Control Panel */}
        <aside className={`h-[340px] shrink-0 flex z-20 p-4 gap-4 relative border-t-2 transition-colors ${
          aesthetic.sectionBg(isDark)
        } ${aesthetic.sectionBorder(isDark)}`}>
          
          {/* Zone 1: Media Pool (Left) */}
          <BlueprintHoverCard className="w-[280px] shrink-0 min-w-0" themeMode={themeMode}>
            <h2 className="text-xs font-semibold px-4 py-2.5 border-b border-[var(--hw-border-hairline)] font-sans z-[2] relative flex items-center bg-[var(--hw-bg-surface)] text-[var(--hw-text-primary)]">
              <span>Media pool</span>
            </h2>
            
            {/* Media Pool Tabs — Unified Morphing Liquid Glass Pill */}
            <LayoutGroup id="mediaPoolTabGroup">
              <div className={`flex border-b border-[var(--hw-border-hairline)] shrink-0 p-1 gap-1 relative ${isDark ? 'bg-black/20' : 'bg-black/5'}`}>
                {(
                  [
                    { id: 'import', label: 'Import' },
                    { id: 'samples', label: 'Samples' },
                    { id: 'recent', label: 'Recent' },
                    { id: 'create', label: 'Create' },
                  ] as const
                ).map((tab) => {
                  const isActive = mediaPoolTab === tab.id;
                  return (
                    <motion.button
                      key={tab.id}
                      type="button"
                      whileTap={{ scale: 0.94 }}
                      onClick={() => setMediaPoolTab(tab.id)}
                      className={`relative flex-1 py-1.5 rounded-[6px] text-xs font-sans font-medium cursor-pointer transition-colors duration-200 z-10 ${
                        isActive
                          ? (isDark ? 'text-[#FAFAFA]' : 'text-[#18181A]') + ' font-medium'
                          : 'text-[var(--hw-text-secondary)] hover:text-[var(--hw-text-primary)]'
                      }`}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="mediaPoolActivePill"
                          transition={HW_SPRINGS.smooth}
                          className={`absolute inset-0 rounded-[6px] z-[-1] ${
                            isDark
                              ? 'bg-white/[0.12] backdrop-blur-md border border-white/20 border-t-white/35 border-b-black/35 shadow-[0_2px_8px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.25)]'
                              : 'bg-white backdrop-blur-md border border-black/10 border-t-white shadow-[0_2px_8px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]'
                          }`}
                        />
                      )}
                      <span className="relative z-10">{tab.label}</span>
                    </motion.button>
                  );
                })}
              </div>
            </LayoutGroup>

            <div className="flex-1 flex flex-col min-h-0 overflow-y-auto z-[2] relative">
              {mediaPoolTab === 'import' && (
                <>
                  <DropZone onMediaLoaded={handleMediaLoaded} currentMedia={null} themeMode={themeMode} />
                  
                  {/* Asset Pool Grid - only shown when assets exist to avoid duplicate empty state with DropZone */}
                  {Object.values(assets).length > 0 && (
                    <div className="p-2.5">
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

                                {/* Bottom Title Bar (min 11px sans, sentence case + frame count caption) */}
                                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black via-black/90 to-transparent p-1.5 pt-3">
                                  <p className="text-[11px] font-sans font-medium text-white truncate">
                                    {asset.media.sourceInfo.filename}
                                  </p>
                                  <p className="text-[10px] font-sans text-zinc-400">
                                    {asset.media.frames.length} frames
                                  </p>
                                </div>

                                {/* Hover Action Overlay */}
                                <div className="absolute inset-0 bg-black/85 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2 gap-1.5 z-10">
                                  <span className="text-[11px] font-sans font-medium text-zinc-300">
                                    Drag or choose
                                  </span>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleAddAssetToTimeline(asset.id); }}
                                    className="w-full py-1 text-xs font-sans font-medium transition-colors cursor-pointer rounded-[6px] bg-white/15 text-white border border-white/20 hover:bg-white/25"
                                  >
                                    Add clip
                                  </button>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleReplaceTimelineWithAsset(asset.id); }}
                                    className="w-full py-0.5 text-[11px] font-sans transition-colors cursor-pointer rounded-[6px] border border-white/15 text-zinc-300 hover:text-white hover:bg-white/10"
                                  >
                                    Replace
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}

              {mediaPoolTab === 'samples' && (
                <div className="p-2.5">
                  <div className="mb-2 px-1">
                    <h4 className="text-xs font-sans font-semibold text-[var(--hw-text-primary)]">
                      Sample animations
                    </h4>
                    <p className="text-[11px] font-sans text-[var(--hw-text-secondary)]">
                      Double-click or drag to timeline
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'dino', name: 'Dino runner' },
                      { id: 'heartbeat', name: 'ECG heartbeat' },
                      { id: 'spinner', name: 'Loading spinner' },
                      { id: 'wificonnect', name: 'Wi-Fi signal' },
                      { id: 'bouncing', name: 'Bouncing logo' },
                      { id: 'pacman', name: 'Pac-Man loop' },
                      { id: 'battery', name: 'Battery charge' },
                      { id: 'sinewave', name: 'Sine wave oscillator' },
                      { id: 'ripple', name: 'Radar ripple' },
                      { id: 'analogclock', name: 'Analog clock' },
                      { id: 'starfield', name: 'Starfield warp' },
                      { id: 'matrix', name: 'Matrix rain' },
                      { id: 'rain', name: 'Rain storm' },
                      { id: 'badapple', name: 'Bad Apple' },
                      { id: 'dvd', name: 'DVD bounce' },
                      { id: 'cube3d', name: '3D cube' },
                      { id: 'flame', name: 'Doom fire' },
                      { id: 'plasma', name: 'Plasma' },
                      { id: 'fireworks', name: 'Fireworks' },
                      { id: 'roboeyes', name: 'Robo eyes' },
                      { id: 'spirograph', name: 'Spirograph' },
                      { id: 'qrcode', name: 'QR scanner' },
                    ].map(sample => (
                      <div
                        key={sample.id}
                        draggable={true}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('application/x-oled-asset', sample.id);
                          e.dataTransfer.setData('text/plain', sample.id);
                        }}
                        onDoubleClick={() => handleLoadSample(sample.id as any, 'append')}
                        className={`bg-[#202225] border rounded-[6px] transition-all cursor-grab active:cursor-grabbing relative group aspect-[4/3] flex flex-col overflow-hidden shadow-xs ${
                          isDark ? 'border-white/10 hover:border-white/25' : 'border-[#1A1A1A] hover:border-black/30'
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

                          {/* Bottom Title Bar (min 11px sans, sentence case + 30 fps caption) */}
                          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black via-black/90 to-transparent p-1.5 pt-3">
                            <p className="text-[11px] font-sans font-medium text-white truncate">
                              {sample.name}
                            </p>
                            <p className="text-[10px] font-sans text-zinc-400">
                              30 fps
                            </p>
                          </div>

                          {/* Hover Action Overlay */}
                          <div className="absolute inset-0 bg-black/85 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2 gap-1.5 z-10">
                            <span className="text-[11px] font-sans font-medium text-zinc-300">
                              Drag or choose
                            </span>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleLoadSample(sample.id as any, 'append'); }}
                              className="w-full py-1 text-xs font-sans font-medium transition-colors cursor-pointer rounded-[6px] bg-white/15 text-white border border-white/20 hover:bg-white/25"
                              title="Append sample animation to timeline"
                            >
                              Add clip
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleLoadSample(sample.id as any, 'replace'); }}
                              className="w-full py-0.5 text-[11px] font-sans transition-colors cursor-pointer rounded-[6px] border border-white/15 text-zinc-300 hover:text-white hover:bg-white/10"
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
                              {/* Bottom Title Bar (min 11px sans, sentence case + frame count caption) */}
                              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black via-black/90 to-transparent p-1.5 pt-3">
                                <p className="text-[11px] font-sans font-medium text-white truncate">
                                  {asset.media.sourceInfo.filename}
                                </p>
                                <p className="text-[10px] font-sans text-zinc-400">
                                  {asset.media.frames.length} frames
                                </p>
                              </div>
                              <div className="absolute inset-0 bg-black/85 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2 gap-1.5 z-10">
                                <span className="text-[11px] font-sans font-medium text-zinc-300">
                                  Drag or choose
                                </span>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleAddAssetToTimeline(asset.id); }}
                                  className="w-full py-1 text-xs font-sans font-medium transition-colors cursor-pointer rounded-[6px] bg-white/15 text-white border border-white/20 hover:bg-white/25"
                                >
                                  Add clip
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleReplaceTimelineWithAsset(asset.id); }}
                                  className="w-full py-0.5 text-[11px] font-sans transition-colors cursor-pointer rounded-[6px] border border-white/15 text-zinc-300 hover:text-white hover:bg-white/10"
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
          </BlueprintHoverCard>

          {/* Zone 2: Timeline & Trimming (Center) */}
          <BlueprintHoverCard className="flex-1 min-w-0 flex flex-col overflow-hidden" themeMode={themeMode}>
            <h2 className="text-xs font-semibold px-4 py-2.5 border-b border-[var(--hw-border-hairline)] font-sans z-[2] relative flex justify-between items-center shrink-0 bg-[var(--hw-bg-surface)] text-[var(--hw-text-primary)]">
              <div className="flex items-center gap-2">
                <span>Timeline</span>
              </div>
            </h2>

            {/* Timeline track — fills remaining space */}
            <div className="flex-1 min-h-0 overflow-hidden z-[2] relative flex flex-col">
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
                isStreaming={isStreaming}
                baudRate={baudRate}
                targetFps={targetFps}
                themeMode={themeMode}
                onToggleSerial={() => setSerialConnected(prev => !prev)}
                onOpenSamples={() => setMediaPoolTab('samples')}
              />
            </div>
          </BlueprintHoverCard>

          {/* Zone 3: Inspector (Right) */}
          <BlueprintHoverCard className="w-[340px] shrink-0 min-w-0" themeMode={themeMode}>
            <h2 className="text-xs font-semibold px-4 py-2.5 border-b border-[var(--hw-border-hairline)] font-sans z-[2] relative bg-[var(--hw-bg-surface)] text-[var(--hw-text-primary)]">
              <span>Inspector</span>
            </h2>
            <div className="flex-1 overflow-y-auto pr-4 px-4 py-4 pb-24 space-y-6 z-[2] relative">
              <div>
                <DitherControls 
                  config={ditherConfig} 
                  onChange={setDitherConfig} 
                  disabled={!activeMedia} 
                  themeMode={themeMode}
                />
              </div>
              <div className={`border-t pt-4 ${aesthetic.sectionBorder(isDark)}`}>
                <CropControls 
                  settings={cropSettings} 
                  onChange={(newSettings) => {
                    if (newSettings.mode !== cropSettings.mode && newSettings.mode === 'cover' && activeMedia) {
                      const cover = computeCoverCrop(activeMedia.sourceInfo.sourceWidth, activeMedia.sourceInfo.sourceHeight);
                      setCropSettings({ ...newSettings, ...cover });
                    } else {
                      setCropSettings(newSettings);
                    }
                  }} 
                  disabled={!activeMedia}
                  sourceFrame={rawSourceFrame}
                  themeMode={themeMode}
                />
              </div>
            </div>
          </BlueprintHoverCard>

        </aside>
      </main>
      ) : (
        <main className="flex-1 flex flex-col min-h-0 z-10 overflow-hidden relative">
          <React.Suspense fallback={<div className="flex-1 flex items-center justify-center font-mono text-xs text-[var(--hw-text-secondary)]">Loading Kinetic Studio...</div>}>
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
          </React.Suspense>
        </main>
      )}

      {/* Modals & Studios (Lazy-Loaded On Demand) */}
      <React.Suspense fallback={null}>
        <AnimatePresence>
          {settingsOpen && (
            <SettingsModal 
              isOpen={settingsOpen} 
              onClose={() => setSettingsOpen(false)} 
              config={hardwareConfig} 
              onChange={setHardwareConfig} 
              themeMode={themeMode}
            />
          )}
        </AnimatePresence>
        <AnimatePresence>
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
        </AnimatePresence>
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
