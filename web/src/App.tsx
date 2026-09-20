import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { SettingsModal } from './components/SettingsModal';
import { DropZone } from './components/DropZone';
import { FrameStrip } from './components/FrameStrip';
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
              <DropZone onMediaLoaded={handleMediaLoaded} currentMedia={media} />
              
              {/* Sample Media Placeholders */}
              <div className="p-3">
                <div className="flex gap-2">
                  <div className="w-1/3 aspect-[4/3] bg-[#080808] border-2 border-[#E85D2A] p-0.5 flex items-center justify-center cursor-pointer">
                    <div className="w-full h-full border border-[#1A1A1A] bg-[url('https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=100')] bg-cover opacity-90" />
                  </div>
                  <div className="w-1/3 aspect-[4/3] bg-[#1A1A1A] border border-[#6B6B6B] p-0.5 flex items-center justify-center cursor-pointer hover:border-[#1A1A1A]">
                    <div className="w-full h-full border border-[#1A1A1A] bg-[url('https://images.unsplash.com/photo-1614730321146-b6fa6a46bcb4?auto=format&fit=crop&q=80&w=100')] bg-cover opacity-40 grayscale hover:grayscale-0 hover:opacity-100 transition-all" />
                  </div>
                  <div className="w-1/3 aspect-[4/3] bg-[#1A1A1A] border border-[#6B6B6B] p-0.5 flex items-center justify-center cursor-pointer hover:border-[#1A1A1A]">
                    <div className="w-full h-full border border-[#1A1A1A] bg-[url('https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&q=80&w=100')] bg-cover opacity-40 grayscale hover:grayscale-0 hover:opacity-100 transition-all" />
                  </div>
                </div>
              </div>
            </div>
          </BlueprintHoverCard>

          {/* Zone 2: Timeline & Trimming (Center) */}
          <BlueprintHoverCard className="flex-1 min-w-0 shrink-0">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6B6B6B] px-6 py-3 border-b-2 border-[#1A1A1A] font-mono z-[2] relative flex justify-between items-center bg-[#F5F0EB]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-[#E85D2A]"></span>
                <span className="text-[#1A1A1A]">TIMELINE</span>
              </div>
              {media && <span>{media.frames.length} FRAMES | {targetFps} FPS | 00:00 - 00:08.00</span>}
            </h2>
            <div className="flex-1 flex flex-col overflow-y-auto z-[2] relative bg-[#F5F0EB]">
              <FrameStrip 
                media={media} 
                activeFrameIndex={activeFrameIndex} 
                onFrameSelect={(i) => {
                  setIsPlaying(false);
                  setActiveFrameIndex(i);
                }} 
              />
              
              <div className="px-6 py-4 flex flex-col w-full mx-auto space-y-6">
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

                <div className="w-full h-20 bg-[#1A1A1A] border-2 border-[#1A1A1A] rounded-sm overflow-hidden relative">
                   <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#F5F0EB_1px,transparent_1px)] [background-size:16px_16px]"></div>
                   <div className="w-full h-full flex items-end px-1 gap-0.5 opacity-60">
                     {Array.from({length: 120}).map((_, i) => (
                       <div key={i} className="flex-1 bg-[#6B6B6B]" style={{ height: `${Math.random() * 70 + 10}%` }}></div>
                     ))}
                   </div>
                </div>
                
                <div className="text-[9px] font-mono tracking-widest text-[#6B6B6B] flex items-center justify-between uppercase border-t border-[#1A1A1A]/20 pt-4">
                  <span>&gt; DRAG TO SCRUB</span>
                  <span>|</span>
                  <span>SCROLL TO ZOOM</span>
                  <span>|</span>
                  <span>SHIFT + DRAG TO SELECT</span>
                  <span>|</span>
                  <span>RIGHT CLICK FOR OPTIONS</span>
                </div>
              </div>
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
              <CountUp to={trimRange.end - trimRange.start + 1} duration={0.4} />
              <span>FRAMES_SELECTED</span>
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
        frameCount={trimRange.end - trimRange.start + 1}
        targetFps={targetFps}
        xbmpFrames={exportXbmpFrames}
      />
    </div>
  );
}
