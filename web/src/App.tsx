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

  // UI State
  const [serialConnected, setSerialConnected] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [rawSourceFrame, setRawSourceFrame] = useState<ImageData | null>(null);
  const [cppCode, setCppCode] = useState('');
  const [exportXbmpFrames, setExportXbmpFrames] = useState<Uint8Array[]>([]);

  const lastStreamTime = useRef(0);

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      
      if (e.key === 's' || e.key === 'S') {
        handleSplitClip();
      }
      // Undo / Redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSplitClip, handleUndo, handleRedo]);
  useEffect(() => {
    if (!isPlaying || !media || media.frames.length === 0) return;
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
        setActiveFrameIndex(prev => (prev + framesToAdvance) % media.frames.length);
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, media, targetFps]);

  // --- KEYBOARD SHORTCUTS ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!media) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying(p => !p);
      } else if (e.code === 'ArrowLeft') {
        setIsPlaying(false);
        setActiveFrameIndex(p => Math.max(0, p - 1));
      } else if (e.code === 'ArrowRight') {
        setIsPlaying(false);
        setActiveFrameIndex(p => Math.min(media.frames.length - 1, p + 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [media]);

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
          <div className="flex-1 p-6 lg:p-8 flex flex-col relative border-r border-[#1A1A1A]/20 min-w-0">
            <div className="w-full max-w-[420px] ml-auto mr-0 xl:mr-8 flex flex-col h-full justify-center">
              <div className="mb-4 shrink-0">
                <h3 className="font-mono font-bold text-sm text-[#1A1A1A]">FULL PREVIEW</h3>
                <p className="font-mono text-[10px] text-[#6B6B6B]">See the full video/animation here at normal scale</p>
              </div>
              
              <div className="flex-1 bg-[#080808] border-2 border-[#1A1A1A] p-2 flex flex-col relative overflow-hidden rounded-md shadow-[4px_4px_0_0_#1A1A1A]">
                <div className="flex-1 relative w-full h-full min-h-0 flex items-center justify-center">
                  {rawSourceFrame ? (
                    <img 
                      src={(() => {
                        const canvas = document.createElement('canvas');
                        canvas.width = rawSourceFrame.width;
                        canvas.height = rawSourceFrame.height;
                        const ctx = canvas.getContext('2d');
                        if (ctx) ctx.putImageData(rawSourceFrame, 0, 0);
                        return canvas.toDataURL();
                      })()}
                      className="max-w-full max-h-full object-contain"
                      alt="Source"
                    />
                  ) : (
                    <span className="font-mono text-[#6B6B6B] text-xs">NO MEDIA</span>
                  )}
                </div>
                
                {/* Dummy Playbar for Aesthetics (The real one is below) */}
                <div className="h-8 mt-2 flex items-center px-2 gap-3 text-white">
                  <button className="text-sm font-bold opacity-80 hover:opacity-100">▶</button>
                  <div className="text-[9px] font-mono whitespace-nowrap opacity-60">
                    {(activeFrameIndex / targetFps).toFixed(2)} / {media ? (media.frames.length / targetFps).toFixed(2) : '0.00'}
                  </div>
                  <div className="flex-1 h-1 bg-white/20 rounded-full relative">
                    <div 
                      className="absolute inset-y-0 left-0 bg-[#E85D2A] rounded-full" 
                      style={{ width: media && media.frames.length ? `${(activeFrameIndex / media.frames.length) * 100}%` : '0%' }}
                    />
                    <div 
                      className="absolute w-3 h-3 bg-[#E85D2A] rounded-full top-1/2 -translate-y-1/2"
                      style={{ left: media && media.frames.length ? `calc(${(activeFrameIndex / media.frames.length) * 100}% - 6px)` : '0%' }}
                    />
                  </div>
                  <div className="text-[9px] font-mono whitespace-nowrap opacity-60">30 FPS</div>
                </div>
              </div>
            </div>
          </div>

          {/* Column 2: True OLED Preview */}
          <div className="flex-1 p-6 lg:p-8 flex flex-col items-center justify-center relative min-w-0">
            <div className="text-center mb-8">
              <h3 className="font-mono font-bold text-sm text-[#1A1A1A]">TRUE OLED PREVIEW (128 × 64)</h3>
              <p className="font-mono text-[10px] text-[#6B6B6B]">Exact physical scale • 1:1 pixels • What will display on device</p>
            </div>

            <div className="relative flex items-center justify-center w-full max-h-full flex-1 min-h-0 gap-6 xl:gap-12">
              {/* Decorative Arrow & Text (Left) */}
              <div className="flex items-center gap-2 text-[#E85D2A] font-display font-medium text-xs leading-tight hidden lg:flex">
                <div className="text-right">
                  Shows the exact<br/>128 × 64 output<br/>(1:1 pixel scale)
                </div>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="rotate-[15deg]">
                  <path d="M4 12C9 12 15 10 20 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M16 8L20 12L16 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>

              {/* Hardware Bezel */}
              <div className="bg-[#2A2A2A] rounded-xl p-4 shadow-[0_10px_30px_rgba(0,0,0,0.5),inset_0_2px_1px_rgba(255,255,255,0.1),inset_0_-2px_1px_rgba(0,0,0,0.5)] border border-[#111] relative z-10 shrink max-w-full max-h-full flex flex-col justify-center">
                {/* Screws */}
                <div className="absolute top-2 left-2 w-3 h-3 rounded-full bg-[#1A1A1A] border border-[#333] shadow-[inset_0_1px_2px_#000] flex items-center justify-center rotate-45"><div className="w-full h-[1px] bg-[#333]" /></div>
                <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-[#1A1A1A] border border-[#333] shadow-[inset_0_1px_2px_#000] flex items-center justify-center rotate-12"><div className="w-full h-[1px] bg-[#333]" /></div>
                <div className="absolute bottom-2 left-2 w-3 h-3 rounded-full bg-[#1A1A1A] border border-[#333] shadow-[inset_0_1px_2px_#000] flex items-center justify-center -rotate-12"><div className="w-full h-[1px] bg-[#333]" /></div>
                <div className="absolute bottom-2 right-2 w-3 h-3 rounded-full bg-[#1A1A1A] border border-[#333] shadow-[inset_0_1px_2px_#000] flex items-center justify-center rotate-90"><div className="w-full h-[1px] bg-[#333]" /></div>
                
                <div className="text-[#555] font-mono text-[8px] text-center mb-1">SSD1306 128x64</div>
                
                <div className="bg-[#000] p-1 shadow-[inset_0_0_10px_#000] rounded max-w-full max-h-full shrink">
                  <div className="pointer-events-auto max-w-full max-h-full flex items-center justify-center">
                    <OledCanvas frameData={processedFrame} theme={ditherConfig.theme} scale={1} />
                  </div>
                </div>

                <div className="text-[#555] font-mono text-[8px] text-center mt-1">I²C 0x3C</div>
              </div>

              {/* Decorative Sticky Note (Right) */}
              <div className="hidden xl:block">
                <div className="bg-[#FFD485] text-[#1A1A1A] p-4 font-mono text-[10px] w-40 shadow-lg rotate-3">
                  <div className="flex justify-between items-start mb-2">
                    <div className="w-3 h-3 rounded-full bg-[#1A1A1A]/20" />
                    <span>💡</span>
                  </div>
                  The full preview shows the entire video. The small OLED shows exactly what will be displayed on your device.
                </div>
              </div>
            </div>
          </div>

          {/* Column 3: Display Info */}
          <div className="w-[200px] shrink-0 p-6 border-l border-[#1A1A1A]/20 flex flex-col justify-start overflow-y-auto">
            <div className="bg-white border-2 border-[#1A1A1A] shadow-[4px_4px_0_0_#1A1A1A] p-4 font-mono text-xs flex flex-col gap-5 mb-auto">
              
              <div>
                <div className="bg-[#1A1A1A] text-white px-2 py-1 text-[10px] font-bold uppercase tracking-wider mb-3 flex justify-between items-center">
                  <span>DISPLAY INFO</span>
                  <span className="w-2 h-2 rounded-full bg-[#E85D2A]"></span>
                </div>
                <div className="flex flex-col gap-1 text-[#6B6B6B]">
                  <div>128 × 64</div>
                  <div>1-BIT (MONO)</div>
                  <div>I²C 0x3C</div>
                  <div>{targetFps} FPS</div>
                </div>
              </div>

              <div className="h-px bg-[#1A1A1A]/20" />

              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-[#1A1A1A] mb-2">CURRENT FRAME</div>
                <div className="text-[#6B6B6B]">{activeFrameIndex.toString().padStart(3, '0')} / {media ? media.frames.length.toString().padStart(3, '0') : '000'}</div>
                <div className="text-[#6B6B6B]">{(activeFrameIndex / targetFps).toFixed(2)}s</div>
              </div>

              <div className="h-px bg-[#1A1A1A]/20" />

              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-[#1A1A1A] mb-2">OUTPUT SIZE</div>
                <div className="text-[#6B6B6B] mb-2">1024 bytes/frame</div>
                <div className="h-2 w-full flex">
                  {Array.from({length: 10}).map((_, i) => (
                    <div key={i} className="h-full flex-1 border-r border-white/20 last:border-0" style={{ backgroundColor: `rgba(26,26,26,${0.1 + (i*0.1)})` }} />
                  ))}
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* Bottom Console — Technical Control Panel */}
        <aside className="h-[380px] shrink-0 bg-white flex z-20 p-6 gap-6 relative border-t-2 border-[#1A1A1A]">
          
          {/* Zone 1: Media Pool (Left) */}
          <BlueprintHoverCard className="w-[280px] shrink-0 min-w-0">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6B6B6B] px-4 py-3 border-b-2 border-[#1A1A1A] font-mono z-[2] relative flex items-center gap-2">
              <span className="w-2 h-2 bg-[#E85D2A]"></span>
              <span className="text-[#1A1A1A]">MEDIA_POOL</span>
            </h2>
            
            {/* Tabs */}
            <div className="flex border-b border-[#1A1A1A]/20 bg-[#F5F0EB] shrink-0">
              <button className="flex-1 py-2 text-[9px] font-bold font-mono tracking-widest text-[#1A1A1A] border-b-2 border-[#E85D2A]">+ IMPORT</button>
              <button className="flex-1 py-2 text-[9px] font-bold font-mono tracking-widest text-[#6B6B6B] hover:text-[#1A1A1A]">SAMPLES</button>
              <button className="flex-1 py-2 text-[9px] font-bold font-mono tracking-widest text-[#6B6B6B] hover:text-[#1A1A1A]">RECENT</button>
            </div>

            <div className="flex-1 flex flex-col min-h-0 overflow-y-auto z-[2] relative">
              <DropZone onMediaLoaded={handleMediaLoaded} currentMedia={null} />
              
              {/* Asset Pool */}
              <div className="p-3">
                <div className="flex flex-wrap gap-2">
                  {Object.values(assets).map(asset => {
                    const firstFrame = asset.media.frames[0];
                    return (
                      <div key={asset.id} className="w-[calc(33.333%-0.34rem)] aspect-[4/3] bg-[#080808] border-2 border-[#1A1A1A] hover:border-[#E85D2A] p-0.5 flex items-center justify-center cursor-pointer transition-colors relative group">
                        {firstFrame && (
                          <div className="w-full h-full border border-[#1A1A1A] overflow-hidden">
                            <img 
                              src={(() => {
                                const canvas = document.createElement('canvas');
                                canvas.width = firstFrame.imageData.width;
                                canvas.height = firstFrame.imageData.height;
                                const ctx = canvas.getContext('2d');
                                if (ctx) ctx.putImageData(firstFrame.imageData, 0, 0);
                                return canvas.toDataURL();
                              })()} 
                              className="w-full h-full object-cover opacity-80 group-hover:opacity-100" 
                              alt={asset.id} 
                            />
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-[#1A1A1A]/80 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <p className="text-[7px] text-[#F5F0EB] font-mono truncate text-center">{asset.media.sourceInfo.filename}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
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
