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

  // Advanced Timeline State
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>([]);

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
  const [cppCode, setCppCode] = useState('');
  const [exportXbmpFrames, setExportXbmpFrames] = useState<Uint8Array[]>([]);

  const lastStreamTime = useRef(0);

  // --- INITIALIZATION ---
  const handleMediaLoaded = (newMedia: DecodedMedia) => {
    const assetId = "asset_" + Date.now();
    const clipId = "clip_" + Date.now();
    
    setAssets(prev => ({ ...prev, [assetId]: { id: assetId, media: newMedia } }));
    setClips(prev => [...prev, { id: clipId, assetId, inFrame: 0, outFrame: newMedia.frames.length - 1 }]);
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
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSplitClip]);
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
    if (!media || !media.frames[activeFrameIndex]) {
      setProcessedFrame(null);
      return;
    }
    const sourceFrame = media.frames[activeFrameIndex].imageData;
    
    const sourceCanvas = imageDataToCanvas(sourceFrame);
    const cropped128x64 = renderCropTo128x64(sourceCanvas, cropSettings);
    
    const { ditheredImageData, xbmpBytes } = applyDithering(cropped128x64, ditherConfig);
    setProcessedFrame(ditheredImageData);

    const now = performance.now();
    if (serialStreamer.getConnected() && (now - lastStreamTime.current > 1000 / targetFps)) {
      lastStreamTime.current = now;
      serialStreamer.sendFrame(xbmpBytes);
    }
  }, [media, activeFrameIndex, ditherConfig, cropSettings, serialConnected, targetFps]);

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
        {/* Top: Canvas Area on Graph Paper */}
        <section className="flex-1 flex items-center justify-center p-8 relative min-h-0 overflow-hidden">
          <div className="absolute inset-0 z-0">
            <Particles
              particleColors={['#1A1A1A', '#E85D2A']}
              particleCount={150}
              particleSpread={15}
              speed={0.08}
              particleBaseSize={80}
              alphaParticles={true}
            />
          </div>
          <div className="relative z-10 w-full flex items-center justify-center">
            <div className="pointer-events-auto">
              <OledCanvas frameData={processedFrame} theme={ditherConfig.theme} scale={6} />
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
                onClipsChange={setClips}
                activeGlobalFrame={activeFrameIndex} 
                onFrameSelect={(i) => {
                  setIsPlaying(false);
                  setActiveFrameIndex(i);
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

      {/* Status Footer */}
      <footer className="absolute bottom-[392px] left-4 h-7 bg-white border border-[#1A1A1A] px-4 flex items-center justify-between text-[10px] font-mono text-[#6B6B6B] z-20 gap-4">
        <div className="flex items-center space-x-3">
          <span className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 ${serialConnected ? 'bg-[#E85D2A]' : 'bg-[#6B6B6B]'}`}></span>
            {hardwareConfig.mcu.toUpperCase()} (
            <DecryptedText
              key={serialConnected ? 'connected' : 'offline'}
              text={serialConnected ? 'CONNECTED' : 'OFFLINE'}
              speed={30}
              characters="0123456789ABCDEF"
              animateOn="view"
            />
            )
          </span>
          <span>{ditherConfig.algorithm.toUpperCase()}</span>
          <span>{targetFps} FPS</span>
        </div>
        <div className="flex items-center gap-1">
          {media ? (
            <>
              <CountUp to={media.frames.length} duration={0.4} />
              <span>FRAMES_TOTAL</span>
            </>
          ) : 'NO_MEDIA'}
        </div>
      </footer>

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
