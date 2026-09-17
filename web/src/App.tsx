import { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { DropZone } from './components/DropZone';
import { CropTool } from './components/CropTool';
import { MediaPreview } from './components/MediaPreview';
import { OledCanvas } from './components/OledCanvas';
import { DitherControls } from './components/DitherControls';
import { HardwareSettings } from './components/HardwareSettings';
import { ExportModal } from './components/ExportModal';

import { CropSettings, DecodedMedia } from './types/media';
import { DitherConfig, PhosphorTheme } from './types/dither';
import { HardwareConfig } from './types/oled';

import {
  computeCoverCrop,
  renderCropTo128x64,
  imageDataToCanvas,
  OLED_TARGET_WIDTH,
  OLED_TARGET_HEIGHT,
} from './engine/cropEngine';

import { applyDithering, generateCppHeader } from './engine/ditherEngine';
import { serialStreamer } from './engine/webSerialStreamer';

import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RefreshCw,
  Cpu,
  Layers,
  Sparkles,
  Zap,
  Gauge,
} from 'lucide-react';

export default function App() {
  const [media, setMedia] = useState<DecodedMedia | null>(null);
  const [activeFrameIndex, setActiveFrameIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [targetFps, setTargetFps] = useState<number>(30);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1.0);
  const [theme, setTheme] = useState<PhosphorTheme>('cyan');

  // Serial status state
  const [serialConnected, setSerialConnected] = useState<boolean>(false);

  // Export Modal state
  const [exportModalOpen, setExportModalOpen] = useState<boolean>(false);
  const [cppCode, setCppCode] = useState<string>('');

  // Hardware Config State (Supports custom SDA, SCL pins, bus clocks & drivers)
  const [hardwareConfig, setHardwareConfig] = useState<HardwareConfig>({
    mcu: 'esp32-s3',
    display: 'sh1106',
    sdaPin: 8,
    sclPin: 9,
    i2cAddress: '0x3C',
  });

  // 1-Bit Dithering Configuration
  const [ditherConfig, setDitherConfig] = useState<DitherConfig>({
    algorithm: 'atkinson',
    brightness: 0,
    contrast: 0,
    threshold: 128,
    invert: false,
    theme: 'cyan',
  });

  // Crop settings
  const [cropSettings, setCropSettings] = useState<CropSettings>({
    mode: 'cover',
    x: 0,
    y: 0,
    width: OLED_TARGET_WIDTH,
    height: OLED_TARGET_HEIGHT,
    sourceWidth: OLED_TARGET_WIDTH,
    sourceHeight: OLED_TARGET_HEIGHT,
    smoothing: true,
  });

  // Final 1-bit dithered 128x64 ImageData & XBMP bytes
  const [ditheredFrame, setDitheredFrame] = useState<ImageData | null>(null);

  // Scratch canvas ref for blitting
  const scratchCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Handle media load
  const handleMediaLoaded = useCallback((loadedMedia: DecodedMedia) => {
    setMedia(loadedMedia);
    setActiveFrameIndex(0);
    setIsPlaying(false);

    const { sourceWidth, sourceHeight, fps } = loadedMedia.sourceInfo;
    setTargetFps(fps);

    const initialCover = computeCoverCrop(sourceWidth, sourceHeight);
    const initialCrop: CropSettings = {
      mode: 'cover',
      x: initialCover.x,
      y: initialCover.y,
      width: initialCover.width,
      height: initialCover.height,
      sourceWidth,
      sourceHeight,
      smoothing: true,
    };
    setCropSettings(initialCrop);
  }, []);

  // Update dithered frame buffer whenever active frame, crop, or dither config changes
  useEffect(() => {
    if (!media || media.frames.length === 0) {
      setDitheredFrame(null);
      return;
    }

    const frame = media.frames[activeFrameIndex] || media.frames[0];
    const srcCanvas = imageDataToCanvas(frame.imageData);

    if (!scratchCanvasRef.current) {
      scratchCanvasRef.current = document.createElement('canvas');
      scratchCanvasRef.current.width = OLED_TARGET_WIDTH;
      scratchCanvasRef.current.height = OLED_TARGET_HEIGHT;
    }

    // 1. Crop/Scale to 128x64
    const cropped = renderCropTo128x64(srcCanvas, cropSettings, scratchCanvasRef.current);

    // 2. Apply 1-Bit Dithering (Atkinson / Floyd-Steinberg / Bayer)
    const { ditheredImageData, xbmpBytes } = applyDithering(cropped, ditherConfig);

    setDitheredFrame(ditheredImageData);

    // Stream live to ESP32 over WebSerial if connected
    if (serialConnected && xbmpBytes) {
      serialStreamer.sendFrame(xbmpBytes);
    }
  }, [media, activeFrameIndex, cropSettings, ditherConfig, serialConnected]);

  // Animation playback loop with speed multiplier support
  useEffect(() => {
    if (!isPlaying || !media || media.frames.length <= 1) return;

    const effectiveFps = targetFps * speedMultiplier;
    const intervalMs = 1000 / effectiveFps;

    const timer = setInterval(() => {
      setActiveFrameIndex((prev) => (prev + 1) % media.frames.length);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, media, targetFps, speedMultiplier]);

  // Handle WebSerial Connection
  const handleSerialToggle = async () => {
    if (serialConnected) {
      await serialStreamer.disconnect();
      setSerialConnected(false);
    } else {
      const connected = await serialStreamer.connect();
      setSerialConnected(connected);
    }
  };

  // Generate C++ header for all frames using user's hardware config & custom SDA/SCL pins
  const handleExportClick = () => {
    if (!media || media.frames.length === 0) {
      alert('Please upload a video or GIF animation first!');
      return;
    }

    const scratch = document.createElement('canvas');
    scratch.width = OLED_TARGET_WIDTH;
    scratch.height = OLED_TARGET_HEIGHT;

    const allXbmp: Uint8Array[] = [];
    for (let f = 0; f < media.frames.length; f++) {
      const srcCanvas = imageDataToCanvas(media.frames[f].imageData);
      const cropped = renderCropTo128x64(srcCanvas, cropSettings, scratch);
      const { xbmpBytes } = applyDithering(cropped, ditherConfig);
      allXbmp.push(xbmpBytes);
    }

    const effectiveFps = Math.round(targetFps * speedMultiplier);
    const code = generateCppHeader(
      allXbmp,
      effectiveFps,
      hardwareConfig,
      OLED_TARGET_WIDTH,
      OLED_TARGET_HEIGHT
    );
    setCppCode(code);
    setExportModalOpen(true);
  };

  const activeImageData =
    media && media.frames[activeFrameIndex] ? media.frames[activeFrameIndex].imageData : null;

  return (
    <div className="flex flex-col min-h-screen bg-oled-bg text-slate-100 font-sans">
      <Header
        serialConnected={serialConnected}
        onSerialConnect={handleSerialToggle}
        onExportClick={handleExportClick}
      />

      <main className="flex-1 p-4 lg:p-6 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Media Ingestion, Crop & Dithering Suite */}
        <section className="lg:col-span-6 space-y-6">
          {/* Hardware & Custom Pin Selector */}
          <HardwareSettings config={hardwareConfig} onChange={setHardwareConfig} />

          {/* Media Ingestion */}
          <div className="bg-oled-surface border border-oled-border rounded-xl p-4 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
              Media Ingestion (MP4, GIF, WebM)
            </h2>
            <DropZone onMediaLoaded={handleMediaLoaded} currentMedia={media} />
          </div>

          {/* Timeline & Frame Inspector */}
          {media && (
            <MediaPreview
              media={media}
              activeFrameIndex={activeFrameIndex}
              onFrameSelect={setActiveFrameIndex}
              onTrimMedia={setMedia}
            />
          )}


          {/* Interactive 2:1 Crop Tool */}
          <CropTool
            sourceImageData={activeImageData}
            cropSettings={cropSettings}
            onCropChange={setCropSettings}
            disabled={!media}
          />

          {/* 1-Bit Dithering Engine Controls */}
          <DitherControls
            config={ditherConfig}
            onChange={setDitherConfig}
            disabled={!media}
          />
        </section>

        {/* Right Column: Physical OLED Canvas Simulator & Hardware Controls */}
        <section className="lg:col-span-6 space-y-6 flex flex-col items-center">
          <div className="w-full bg-oled-surface border border-oled-border rounded-xl p-6 flex flex-col items-center space-y-6 shadow-lg">
            {/* Display Header & Phosphor Theme Selector */}
            <div className="flex items-center justify-between w-full border-b border-oled-border/60 pb-3">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-oled-cyan" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Simulated 128×64 Physical OLED Panel
                </span>
              </div>

              <div className="flex items-center space-x-2 text-xs">
                <span className="text-oled-muted font-mono">Phosphor:</span>
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as PhosphorTheme)}
                  className="bg-oled-panel border border-oled-border rounded px-2.5 py-1 text-xs text-slate-200 font-mono cursor-pointer"
                >
                  <option value="cyan">Classic Cyan (0x00F0FF)</option>
                  <option value="white">Crisp White (0xFFFFFF)</option>
                  <option value="amber">Warm Amber (0xFFB000)</option>
                  <option value="green">Matrix Green (0x00FF66)</option>
                  <option value="yellow-blue">Yellow/Blue Dual</option>
                </select>
              </div>
            </div>

            {/* Physical OLED Canvas */}
            <div className="py-2">
              <OledCanvas frameData={ditheredFrame} theme={theme} scale={4} />
            </div>

            {/* Playback Controls & FPS / Speed Accelerator Bar */}
            <div className="w-full bg-oled-panel border border-oled-border rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsPlaying(!isPlaying)}
                    disabled={!media}
                    className="p-2 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-oled-cyan border border-cyan-500/40 disabled:opacity-40 cursor-pointer"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFrameIndex(0)}
                    disabled={!media}
                    className="p-2 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-40 cursor-pointer"
                  >
                    <SkipBack className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      media && setActiveFrameIndex(Math.max(0, media.frames.length - 1))
                    }
                    disabled={!media}
                    className="p-2 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-40 cursor-pointer"
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlaying(false);
                      setActiveFrameIndex(0);
                    }}
                    disabled={!media}
                    className="p-2 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-40 cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>

                {/* Target FPS Selector */}
                <div className="flex items-center space-x-2 text-xs font-mono">
                  <span className="text-slate-400">Target FPS:</span>
                  {[15, 24, 30, 45, 60].map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => setTargetFps(rate)}
                      className={`px-2 py-0.5 rounded cursor-pointer ${
                        targetFps === rate
                          ? 'bg-cyan-500/20 text-oled-cyan border border-cyan-500/40 font-bold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {rate}
                    </button>
                  ))}
                </div>

                {/* Speed Multiplier Accelerator */}
                <div className="flex items-center space-x-2 text-xs font-mono">
                  <Gauge className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-slate-400">Speed:</span>
                  {[1.0, 1.25, 1.5, 2.0].map((mult) => (
                    <button
                      key={mult}
                      type="button"
                      onClick={() => setSpeedMultiplier(mult)}
                      className={`px-1.5 py-0.5 rounded cursor-pointer ${
                        speedMultiplier === mult
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {mult}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Scrubber Bar */}
              <div className="flex items-center space-x-3">
                <input
                  type="range"
                  min="0"
                  max={media ? Math.max(0, media.frames.length - 1) : 0}
                  value={activeFrameIndex}
                  onChange={(e) => setActiveFrameIndex(parseInt(e.target.value, 10))}
                  disabled={!media}
                  className="flex-1 accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
                <span className="text-[11px] font-mono text-slate-400 min-w-[65px] text-right">
                  {String(activeFrameIndex + 1).padStart(3, '0')} /{' '}
                  {String(media ? media.frames.length : 0).padStart(3, '0')}
                </span>
              </div>
            </div>
          </div>

          {/* Architecture & Dynamic Target Hardware Status */}
          <div className="w-full bg-oled-surface border border-oled-border rounded-xl p-4 space-y-2.5 text-xs font-mono text-slate-400">
            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-oled-cyan" />
                Pipeline State:
              </span>
              <span className="text-emerald-400">
                {media
                  ? `Ingested (${media.sourceInfo.type.toUpperCase()}) — ${ditherConfig.algorithm.toUpperCase()} @ ${Math.round(
                      targetFps * speedMultiplier
                    )} FPS`
                  : 'Awaiting Media Ingestion'}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-400 text-[11px]">
              <span>Hardware Transmission Speed:</span>
              <span className="text-amber-300 font-bold">800kHz Overclocked I2C Bus (~10ms/frame)</span>
            </div>
            <div className="flex items-center justify-between text-slate-400 text-[11px]">
              <span>WebSerial Live Stream:</span>
              <span className="flex items-center gap-1 text-cyan-300">
                <Zap className="w-3 h-3 text-amber-400 animate-pulse" />
                {serialConnected ? 'Active (Live streaming frames)' : 'Ready (Click Connect USB)'}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-400 text-[11px]">
              <span>Target Hardware:</span>
              <span className="flex items-center gap-1 text-cyan-300 font-bold">
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                {hardwareConfig.mcu.toUpperCase()} {hardwareConfig.display.toUpperCase()} (SDA={hardwareConfig.sdaPin}, SCL={hardwareConfig.sclPin})
              </span>
            </div>
          </div>
        </section>
      </main>

      {/* Export Modal */}
      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        cppCode={cppCode}
        frameCount={media ? media.frames.length : 0}
      />
    </div>
  );
}
