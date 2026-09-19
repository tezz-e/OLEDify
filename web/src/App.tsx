import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { SettingsModal } from './components/SettingsModal';
import { DropZone } from './components/DropZone';
import { FrameStrip } from './components/FrameStrip';
import { OledCanvas } from './components/OledCanvas';
import { PlaybackBar } from './components/PlaybackBar';
import { DitherControls } from './components/DitherControls';
import { CropControls } from './components/CropControls';
import { TrimControls } from './components/TrimControls';
import { ExportModal } from './components/ExportModal';

import { DecodedMedia, CropSettings } from './types/media';
import { DitherConfig, PhosphorTheme } from './types/dither';
import { HardwareConfig } from './types/oled';

import { applyDithering, generateCppHeader } from './engine/ditherEngine';
import { serialStreamer } from './engine/webSerialStreamer';
import { renderCropTo128x64, imageDataToCanvas, computeCoverCrop } from './engine/cropEngine';

export default function App() {
  // --- STATE ---
  // Media & Playback
  const [media, setMedia] = useState<DecodedMedia | null>(null);
  const [rawMedia, setRawMedia] = useState<DecodedMedia | null>(null);
  const [activeFrameIndex, setActiveFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [targetFps, setTargetFps] = useState(30);
  const [trimRange, setTrimRange] = useState({ start: 0, end: 0 });
  const [processedFrame, setProcessedFrame] = useState<ImageData | null>(null);

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
    setRawMedia(newMedia);
    setMedia(newMedia);
    setTrimRange({ start: 0, end: newMedia.frames.length - 1 });
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

  const handleApplyTrim = (start: number, end: number) => {
    if (!media) return;
    setIsPlaying(false);
    const slicedFrames = media.frames.slice(start, end + 1).map((f, i) => ({
      ...f,
      index: i
    }));
    setMedia({
      ...media,
      frames: slicedFrames,
      sourceInfo: {
        ...media.sourceInfo,
        frameCount: slicedFrames.length
      }
    });
    setActiveFrameIndex(0);
    setTrimRange({ start: 0, end: slicedFrames.length - 1 });
  };

  const handleResetTrim = () => {
    if (!rawMedia) return;
    setIsPlaying(false);
    setMedia(rawMedia);
    setActiveFrameIndex(0);
    setTrimRange({ start: 0, end: rawMedia.frames.length - 1 });
  };

  // --- PLAYBACK ENGINE ---
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
    
    // Crop & scale to 128x64
    const sourceCanvas = imageDataToCanvas(sourceFrame);
    const cropped128x64 = renderCropTo128x64(sourceCanvas, cropSettings);
    
    // Apply dithering
    const { ditheredImageData, xbmpBytes } = applyDithering(cropped128x64, ditherConfig);
    setProcessedFrame(ditheredImageData);

    // Hardware Stream (Throttled)
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
    const croppedAndDithered = media.frames.map(f => {
      const sourceCanvas = imageDataToCanvas(f.imageData);
      const cropped128x64 = renderCropTo128x64(sourceCanvas, cropSettings);
      return applyDithering(cropped128x64, ditherConfig);
    });

    const xbmpFrames = croppedAndDithered.map(res => res.xbmpBytes);

    const code = generateCppHeader(xbmpFrames, targetFps, hardwareConfig);
    setCppCode(code);
    setExportXbmpFrames(xbmpFrames);
    setExportModalOpen(true);
  };

  return (
    <div className="h-screen flex flex-col bg-oled-bg overflow-hidden">
      <Header 
        serialConnected={serialConnected}
        onSerialToggle={handleSerialToggle}
        onExportClick={handleExport}
        onSettingsOpen={() => setSettingsOpen(true)}
        hasMedia={!!media}
      />

      <main className="flex-1 flex min-h-0">
        {/* Left: Source Panel */}
        <aside className="w-[220px] border-r border-oled-border flex flex-col shrink-0">
          <DropZone onMediaLoaded={handleMediaLoaded} currentMedia={media} />
          <FrameStrip 
            media={media} 
            activeFrameIndex={activeFrameIndex} 
            onFrameSelect={(i) => {
              setIsPlaying(false);
              setActiveFrameIndex(i);
            }} 
          />
        </aside>

        {/* Center: Canvas + Playback */}
        <section className="flex-1 flex flex-col items-center justify-center p-6 relative">
          <OledCanvas frameData={processedFrame} theme={ditherConfig.theme} scale={4} />
          <PlaybackBar 
            isPlaying={isPlaying}
            onTogglePlay={() => setIsPlaying(p => !p)}
            currentFrame={activeFrameIndex}
            totalFrames={media ? media.frames.length : 0}
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
        </section>

        {/* Right: Inspector */}
        <aside className="w-[260px] border-l border-oled-border overflow-y-auto p-4 space-y-6 shrink-0 custom-scrollbar">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Dithering</h2>
            <DitherControls 
              config={ditherConfig} 
              onChange={setDitherConfig} 
              disabled={!media} 
            />
          </div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Crop / Scale</h2>
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
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Trim Sequence</h2>
            <TrimControls 
              totalFrames={media ? media.frames.length : 0} 
              originalTotalFrames={rawMedia ? rawMedia.frames.length : undefined}
              onApplyTrim={handleApplyTrim}
              onResetTrim={handleResetTrim}
              onFrameSeek={(f) => {
                setIsPlaying(false);
                setActiveFrameIndex(f);
              }}
              disabled={!media}
            />
          </div>
        </aside>
      </main>

      {/* Status Footer */}
      <footer className="h-7 border-t border-oled-border px-4 flex items-center justify-between text-[10px] font-mono text-oled-muted bg-oled-surface shrink-0">
        <div className="flex items-center space-x-4">
          <span className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${serialConnected ? 'bg-emerald-500' : 'bg-slate-600'}`}></span>
            {hardwareConfig.mcu.toUpperCase()} ({serialConnected ? 'Connected' : 'Offline'})
          </span>
          <span>{ditherConfig.algorithm.toUpperCase()}</span>
          <span>{targetFps} FPS</span>
        </div>
        <div>
          {media ? `${trimRange.end - trimRange.start + 1} frames selected` : 'No media'}
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
        frameCount={trimRange.end - trimRange.start + 1}
        targetFps={targetFps}
        xbmpFrames={exportXbmpFrames}
      />
    </div>
  );
}
