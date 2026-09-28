import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Music, FileText, Upload, Play, Pause, ArrowLeft, Sparkles, Check, RefreshCw, X, RotateCcw } from 'lucide-react';
import { searchLrclib, getLrclibExact, searchLyricsOvhFallback } from '../../../engine/lyrics/lrclibClient';
import { parseLrc, parsePlainTextLyrics } from '../../../engine/lyrics/lrcParser';
import { LrclibTrack, ParsedLyrics, LyricLine, LyricWord } from '../../../engine/lyrics/types';
import { MotionArchetype, ARCHETYPE_METADATA } from '../../../engine/kinetic/types';
import { renderKineticSequence } from '../../../engine/kinetic/kineticEngine';
import { getWordEffectiveArchetype } from '../../../engine/kinetic/semanticClassifier';
import { DecodedMedia, ExtractedFrame } from '../../../types/media';
import { OledCanvas } from '../../OledCanvas';

interface LyricsStudioViewProps {
  onClose: () => void;
  onInjectToTimeline: (media: DecodedMedia) => void;
}

const SAMPLE_FALLBACK_LRC = `[ti:OLED Kinetic Intro]
[ar:Studio Engine]
[00:00.00] WELCOME TO OLED STUDIO
[00:02.50] PURE KINETIC TYPOGRAPHY
[00:05.00] 1-BIT SYNCHRONIZED REELS
[00:07.50] HARDWARE READY FOR ESP32`;

const MANUAL_ARCHETYPES: MotionArchetype[] = [
  'blade_slash',
  'manga_impact',
  '3d_block_stack',
  'snake_slither',
  'cyber_glitch',
  'echo_stack',
  'target_focus',
  'smooth_fluid',
  'inverted_badge',
  'wiggly_boil',
];

interface EditingWordTarget {
  word: LyricWord;
  lineIdx: number;
  wordIdx: number;
  currentArchetype: MotionArchetype;
}

export const LyricsStudioView: React.FC<LyricsStudioViewProps> = ({
  onClose,
  onInjectToTimeline,
}) => {
  // --- INGESTION STATE ---
  const [ingestTab, setIngestTab] = useState<'search' | 'paste' | 'audio'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<LrclibTrack[]>([]);
  const [pastedLrcText, setPastedLrcText] = useState(SAMPLE_FALLBACK_LRC);

  // --- PARSED LYRICS & SELECTION ---
  const [parsedLyrics, setParsedLyrics] = useState<ParsedLyrics>(() => parseLrc(SAMPLE_FALLBACK_LRC));
  const [selectedStartIndex, setSelectedStartIndex] = useState(0);
  const [selectedEndIndex, setSelectedEndIndex] = useState(3);

  // --- AUDIO & PLAYBACK PREVIEW ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [playheadMs, setPlayheadMs] = useState(0);
  const [localAudioUrl, setLocalAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // --- KINETIC STYLE CONFIG ---
  // Default to AUTO_SEMANTIC (Dynamic Director as seen in Ashke)
  const [archetype, setArchetype] = useState<MotionArchetype>('auto_semantic');
  const [wordOverrides, setWordOverrides] = useState<Record<string, MotionArchetype>>({});
  const [editingWordTarget, setEditingWordTarget] = useState<EditingWordTarget | null>(null);
  const [fontFamily, setFontFamily] = useState('"IBM Plex Mono", monospace');
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);

  // --- PREVIEW FRAME IN OLED CANVAS ---
  const [previewFrame, setPreviewFrame] = useState<ImageData | null>(null);
  const previewFramesRef = useRef<ExtractedFrame[]>([]);


  // Auto-load sample lyrics on mount
  useEffect(() => {
    const defaultParsed = parseLrc(SAMPLE_FALLBACK_LRC);
    setParsedLyrics(defaultParsed);
    setSelectedStartIndex(0);
    setSelectedEndIndex(Math.min(3, defaultParsed.lines.length - 1));
  }, []);

  // Search LRCLIB
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const results = await searchLrclib(searchQuery);
      setSearchResults(results);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  // Select track from search results
  const handleSelectTrack = (track: LrclibTrack) => {
    if (track.syncedLyrics) {
      const parsed = parseLrc(track.syncedLyrics);
      setParsedLyrics(parsed);
      setSelectedStartIndex(0);
      setSelectedEndIndex(Math.min(4, parsed.lines.length - 1));
      setPlayheadMs(parsed.lines[0]?.startMs || 0);
    } else if (track.plainLyrics) {
      const parsed = parsePlainTextLyrics(track.plainLyrics, track.duration * 1000);
      setParsedLyrics(parsed);
      setSelectedStartIndex(0);
      setSelectedEndIndex(Math.min(4, parsed.lines.length - 1));
      setPlayheadMs(0);
    }
  };

  // Parse pasted LRC / plain lyrics
  const handleApplyPastedLrc = () => {
    if (!pastedLrcText.trim()) return;
    const parsed = parseLrc(pastedLrcText);
    setParsedLyrics(parsed);
    setSelectedStartIndex(0);
    setSelectedEndIndex(Math.min(4, parsed.lines.length - 1));
    setPlayheadMs(parsed.lines[0]?.startMs || 0);
  };

  // Handle local audio file drop
  const handleAudioDrop = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setLocalAudioUrl(url);
    }
  };

  // Selected lines range calculation
  const selectedLines = useMemo(() => {
    const start = Math.min(selectedStartIndex, selectedEndIndex);
    const end = Math.max(selectedStartIndex, selectedEndIndex);
    return parsedLyrics.lines.slice(start, end + 1);
  }, [parsedLyrics, selectedStartIndex, selectedEndIndex]);

  const rangeStartMs = selectedLines.length > 0 ? selectedLines[0].startMs : 0;
  const rangeEndMs = selectedLines.length > 0 ? selectedLines[selectedLines.length - 1].endMs : 5000;
  const rangeDurationSec = Math.max(0.5, (rangeEndMs - rangeStartMs) / 1000);
  const totalFrames = Math.round(rangeDurationSec * 30);
  const estProgmemKb = Math.round((totalFrames * 1024) / 1024);

  // Line selection click handler
  const handleLineClick = (idx: number, e: React.MouseEvent) => {
    if (e.shiftKey) {
      // Range expand
      setSelectedEndIndex(idx);
    } else {
      setSelectedStartIndex(idx);
      setSelectedEndIndex(idx);
      setPlayheadMs(parsedLyrics.lines[idx].startMs);
      if (audioRef.current) {
        audioRef.current.currentTime = parsedLyrics.lines[idx].startMs / 1000;
      }
    }
  };

  // Live real-time OLED Preview rendering
  useEffect(() => {
    let active = true;
    const renderLivePreview = async () => {
      if (selectedLines.length === 0) return;
      try {
        const miniMedia = await renderKineticSequence({
          lyrics: selectedLines,
          startMs: rangeStartMs,
          endMs: rangeEndMs,
          targetFps: 30,
          archetype,
          fontFamily,
          wordOverrides
        });
        if (active) {
          previewFramesRef.current = miniMedia.frames;
          const offsetMs = Math.max(0, playheadMs - rangeStartMs);
          const frameIdx = Math.min(
            miniMedia.frames.length - 1,
            Math.max(0, Math.floor((offsetMs / 1000) * 30))
          );
          if (miniMedia.frames[frameIdx]) {
            setPreviewFrame(miniMedia.frames[frameIdx].imageData);
          }
        }
      } catch (err) {
        console.error('Preview render error:', err);
      }
    };

    renderLivePreview();
    return () => { active = false; };
  }, [selectedLines, archetype, fontFamily, rangeStartMs, rangeEndMs, wordOverrides]);

  // Synchronize live preview frame when playhead updates
  useEffect(() => {
    const frames = previewFramesRef.current;
    if (frames.length === 0) return;
    const offsetMs = Math.max(0, playheadMs - rangeStartMs);
    const frameIdx = Math.min(
      frames.length - 1,
      Math.max(0, Math.floor((offsetMs / 1000) * 30))
    );
    if (frames[frameIdx]) {
      setPreviewFrame(frames[frameIdx].imageData);
    }
  }, [playheadMs, rangeStartMs]);

  // Toggle audio playback
  const togglePlay = () => {
    if (!isPlaying) {
      if (audioRef.current) {
        audioRef.current.currentTime = playheadMs / 1000;
        audioRef.current.play().catch(() => {});
      }
      setIsPlaying(true);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsPlaying(false);
    }
  };

  // Audio playback loop
  useEffect(() => {
    if (!isPlaying) return;
    let rafId: number;
    let lastT = performance.now();

    const loop = (now: number) => {
      const dt = now - lastT;
      lastT = now;
      setPlayheadMs(prev => {
        let next = prev + dt;
        if (audioRef.current && !audioRef.current.paused) {
          next = audioRef.current.currentTime * 1000;
        }
        if (next > rangeEndMs) {
          if (audioRef.current) {
            audioRef.current.currentTime = rangeStartMs / 1000;
          }
          return rangeStartMs;
        }
        return next;
      });
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, rangeStartMs, rangeEndMs]);

  // Generate full kinetic sequence and hand-off to NLE Timeline
  const handleGenerateAndInject = async () => {
    if (selectedLines.length === 0 || isRendering) return;

    setIsRendering(true);
    setRenderProgress(0);

    try {
      const renderedMedia = await renderKineticSequence(
        {
          lyrics: selectedLines,
          startMs: rangeStartMs,
          endMs: rangeEndMs,
          targetFps: 30,
          archetype,
          fontFamily,
          wordOverrides
        },
        progress => setRenderProgress(progress)
      );

      // Send to timeline
      onInjectToTimeline(renderedMedia);
      onClose();
    } catch (err) {
      console.error('Failed to generate kinetic sequence:', err);
      alert('Generation failed. Check console for details.');
    } finally {
      setIsRendering(false);
    }
  };


  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#F5F0EB] text-[#1A1A1A] font-mono select-none overflow-hidden animate-fade-in">
      {/* Studio Top Navigation Bar */}
      <header className="h-14 px-6 bg-white border-b-2 border-[#1A1A1A] flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#1A1A1A] text-xs font-bold hover:bg-[#1A1A1A] hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>BACK TO EDITOR</span>
          </button>

          <div className="h-5 w-px bg-[#1A1A1A]/30" />

          <h1 className="text-sm font-bold tracking-widest flex items-center gap-2">
            <span className="text-[#E85D2A]">✦</span>
            <span>KINETIC LYRICS STUDIO</span>
          </h1>
        </div>

        <div className="flex items-center gap-4 text-xs font-bold">
          <span className="bg-[#1A1A1A] text-white px-2 py-0.5 text-[9px] uppercase tracking-wider">
            128×64 MONO OLED
          </span>
          <span className="text-[#E85D2A]">30 FPS ENGINE</span>
        </div>
      </header>

      {/* Main 3-Pane Workspace */}
      <main className="flex-1 flex min-h-0 divide-x-2 divide-[#1A1A1A] bg-[#F5F0EB]">
        
        {/* ============================================================== */}
        {/* COLUMN 1: INGESTION & SEARCH                                  */}
        {/* ============================================================== */}
        <section className="w-[340px] flex flex-col shrink-0 bg-white min-h-0">
          <div className="p-3 border-b-2 border-[#1A1A1A] bg-[#F5F0EB]">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-[#6B6B6B] flex items-center gap-1.5">
              <span className="w-2 h-2 bg-[#E85D2A]" />
              <span>1. SONG & LYRICS INGESTION</span>
            </h2>
          </div>

          {/* Sub-tabs */}
          <div className="flex border-b border-[#1A1A1A]/20 bg-[#F5F0EB] text-[9px] font-bold">
            <button
              onClick={() => setIngestTab('search')}
              className={`flex-1 py-2 border-b-2 transition-colors cursor-pointer ${
                ingestTab === 'search' ? 'border-[#E85D2A] bg-white text-[#1A1A1A]' : 'border-transparent text-[#6B6B6B]'
              }`}
            >
              SEARCH API
            </button>
            <button
              onClick={() => setIngestTab('paste')}
              className={`flex-1 py-2 border-b-2 transition-colors cursor-pointer ${
                ingestTab === 'paste' ? 'border-[#E85D2A] bg-white text-[#1A1A1A]' : 'border-transparent text-[#6B6B6B]'
              }`}
            >
              PASTE LRC
            </button>
            <button
              onClick={() => setIngestTab('audio')}
              className={`flex-1 py-2 border-b-2 transition-colors cursor-pointer ${
                ingestTab === 'audio' ? 'border-[#E85D2A] bg-white text-[#1A1A1A]' : 'border-transparent text-[#6B6B6B]'
              }`}
            >
              DROP AUDIO
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-0">
            {ingestTab === 'search' && (
              <>
                <form onSubmit={handleSearch} className="flex gap-1.5">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Search any track or artist..."
                      className="w-full bg-[#F5F0EB] border border-[#1A1A1A] px-2.5 py-1.5 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#E85D2A]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSearching}
                    className="px-3 bg-[#E85D2A] text-white text-xs font-bold border border-[#1A1A1A] hover:bg-[#1A1A1A] transition-colors cursor-pointer flex items-center justify-center"
                  >
                    {isSearching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  </button>
                </form>

                {/* Results list */}
                <div className="flex-1 overflow-y-auto flex flex-col gap-2 min-h-0 mt-2">
                  {searchResults.length === 0 ? (
                    <div className="py-8 text-center text-[#6B6B6B] text-[10px] border border-dashed border-[#1A1A1A]/30 p-4">
                      Type any track name above to fetch real-time synced lyrics from LRCLIB database.
                    </div>
                  ) : (
                    searchResults.map(track => (
                      <div
                        key={track.id}
                        onClick={() => handleSelectTrack(track)}
                        className="p-2.5 border border-[#1A1A1A] bg-[#F5F0EB] hover:border-[#E85D2A] hover:bg-white transition-all cursor-pointer flex flex-col gap-1 shadow-sm"
                      >
                        <div className="flex justify-between items-start">
                          <span className="font-bold text-xs text-[#1A1A1A] truncate">{track.trackName}</span>
                          {track.syncedLyrics && (
                            <span className="bg-[#E85D2A] text-white text-[7px] font-bold px-1.5 py-0.2 uppercase">
                              SYNCED
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-[#6B6B6B] truncate">
                          {track.artistName} {track.albumName ? `• ${track.albumName}` : ''}
                        </div>
                        <div className="text-[8px] text-[#888]">
                          Duration: {Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, '0')}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}

            {ingestTab === 'paste' && (
              <div className="flex-1 flex flex-col gap-2 min-h-0">
                <textarea
                  value={pastedLrcText}
                  onChange={e => setPastedLrcText(e.target.value)}
                  placeholder="Paste raw [mm:ss.xx] LRC or plain lyrics here..."
                  className="flex-1 p-2.5 bg-[#F5F0EB] border border-[#1A1A1A] text-[10px] font-mono resize-none focus:outline-none focus:border-[#E85D2A]"
                />
                <button
                  onClick={handleApplyPastedLrc}
                  className="w-full py-2 bg-[#1A1A1A] text-white text-xs font-bold uppercase hover:bg-[#E85D2A] transition-colors cursor-pointer"
                >
                  PARSE & LOAD LYRICS
                </button>
              </div>
            )}

            {ingestTab === 'audio' && (
              <div className="flex-1 flex flex-col items-center justify-center p-4 border border-dashed border-[#1A1A1A]/40 text-center gap-3">
                <Upload className="w-8 h-8 text-[#E85D2A]" />
                <p className="text-xs font-bold">DROP LOCAL MP3 / WAV</p>
                <p className="text-[10px] text-[#6B6B6B]">Enables 0-latency audio scrubbing and beat waveform preview</p>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleAudioDrop}
                  className="text-[10px] cursor-pointer"
                />
              </div>
            )}
          </div>
        </section>

        {/* ============================================================== */}
        {/* COLUMN 2: APPLE MUSIC FLUID GLASS LYRIC SELECTOR             */}
        {/* ============================================================== */}
        <section className="flex-1 flex flex-col bg-[#0D0D0E] relative min-h-0 overflow-hidden">
          {/* Header */}
          <div className="p-3 border-b-2 border-[#1A1A1A] bg-[#161618] flex justify-between items-center z-10">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-[#E85D2A] flex items-center gap-1.5">
              <span>✦</span>
              <span>2. APPLE MUSIC FLUID GLASS SELECTOR</span>
            </h2>
            <span className="text-[9px] text-[#888] font-mono">
              Click to seek • Shift+Click to expand range
            </span>
          </div>

          {/* Fluid Glass Lyric List */}
          <div className="flex-1 overflow-y-auto p-6 md:p-12 flex flex-col items-center gap-4 relative z-10 min-h-0">
            {parsedLyrics.lines.map((line, idx) => {
              const start = Math.min(selectedStartIndex, selectedEndIndex);
              const end = Math.max(selectedStartIndex, selectedEndIndex);
              const isSelected = idx >= start && idx <= end;
              const isStartPin = idx === start;
              const isEndPin = idx === end;

              return (
                <div
                  key={idx}
                  onClick={(e) => handleLineClick(idx, e)}
                  className={`w-full max-w-xl transition-all duration-200 cursor-pointer relative group rounded-md p-3.5 ${
                    isSelected
                      ? 'bg-white/10 backdrop-blur-md border border-white/30 shadow-[0_4px_20px_rgba(0,0,0,0.5)]'
                      : 'opacity-30 hover:opacity-75 blur-[0.4px] hover:blur-none'
                  }`}
                >
                  {/* Pin badges */}
                  {isStartPin && (
                    <span className="absolute -top-2.5 left-3 bg-[#E85D2A] text-white text-[8px] font-bold px-1.5 py-0.5 rounded-sm shadow-md">
                      ▲ START {(line.startMs / 1000).toFixed(2)}s
                    </span>
                  )}
                  {isEndPin && (
                    <span className="absolute -bottom-2.5 right-3 bg-[#E85D2A] text-white text-[8px] font-bold px-1.5 py-0.5 rounded-sm shadow-md">
                      ▼ END {(line.endMs / 1000).toFixed(2)}s
                    </span>
                  )}

                  <div className="flex items-center gap-3">
                    <span className="text-[9px] text-[#E85D2A] font-mono w-12 shrink-0">
                      {Math.floor(line.startMs / 60000)}:{((line.startMs % 60000) / 1000).toFixed(1).padStart(4, '0')}
                    </span>
                    <span className={`text-base font-bold tracking-wide transition-colors ${
                      isSelected ? 'text-white' : 'text-[#888]'
                    }`}>
                      {line.text}
                    </span>
                  </div>

                  {/* Interactive Dynamic Word Badges & Customizer Trigger */}
                  {isSelected && line.words && line.words.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-white/10 flex flex-wrap gap-1.5 items-center">
                      <span className="text-[8px] text-[#888] font-bold uppercase tracking-wider mr-1">
                        {archetype === 'auto_semantic' ? '⚡ DYNAMIC MOTIONS:' : 'WORDS:'}
                      </span>
                      {line.words.map((w, wIdx) => {
                        const precedingWord = wIdx > 0 ? line.words[wIdx - 1] : undefined;
                        const wordArch = getWordEffectiveArchetype(
                          w,
                          wIdx,
                          archetype,
                          wordOverrides,
                          precedingWord
                        );
                        const meta = ARCHETYPE_METADATA[wordArch] || ARCHETYPE_METADATA.smooth_fluid;
                        const specificKey = `${w.word}_${w.startMs}`;
                        const cleanKey = w.word.toLowerCase().replace(/[^a-z0-9]/g, '');
                        const isOverridden = !!(wordOverrides[specificKey] || wordOverrides[cleanKey]);

                        return (
                          <button
                            key={wIdx}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingWordTarget({
                                word: w,
                                lineIdx: idx,
                                wordIdx: wIdx,
                                currentArchetype: wordArch
                              });
                            }}
                            className={`px-2 py-0.5 rounded text-[9px] font-mono flex items-center gap-1 transition-all cursor-pointer ${
                              isOverridden
                                ? 'bg-[#E85D2A] text-white font-bold ring-1 ring-white/50 shadow-sm'
                                : 'bg-white/10 hover:bg-white/25 text-white/90 border border-white/20'
                            }`}
                            title={`Click to customize kinetic style for "${w.word}"`}
                          >
                            <span>{meta.icon}</span>
                            <span className="font-semibold">{w.word}</span>
                            <span className="opacity-60 text-[7px] uppercase font-mono">({meta.tag})</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Hidden Audio Player for drop sync */}
          {localAudioUrl && (
            <audio ref={audioRef} src={localAudioUrl} />
          )}

          {/* Bottom Audio Scrub Bar */}
          <div className="h-16 px-6 bg-[#161618] border-t-2 border-[#1A1A1A] flex items-center justify-between z-10 shrink-0 gap-4">
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={togglePlay}
                className="w-8 h-8 rounded-full bg-[#E85D2A] text-white flex items-center justify-center hover:scale-105 transition-transform cursor-pointer shadow-md"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>

              <div className="text-[10px] text-white font-mono w-28 shrink-0">
                {(playheadMs / 1000).toFixed(2)}s / {(rangeEndMs / 1000).toFixed(2)}s
              </div>
            </div>

            {/* Interactive Timeline Scrubber Slider */}
            <div className="flex-1 flex items-center gap-2 max-w-md">
              <input
                type="range"
                min={rangeStartMs}
                max={rangeEndMs}
                step={33}
                value={playheadMs}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setPlayheadMs(val);
                  if (audioRef.current) {
                    audioRef.current.currentTime = val / 1000;
                  }
                }}
                className="w-full accent-[#E85D2A] h-1.5 bg-white/20 rounded-lg cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-3 text-xs font-mono text-white/80 shrink-0">
              {Object.keys(wordOverrides).length > 0 && (
                <div className="flex items-center gap-1.5 bg-[#E85D2A]/20 border border-[#E85D2A]/50 px-2 py-0.5 rounded text-[8px] text-[#E85D2A]">
                  <span>{Object.keys(wordOverrides).length} CUSTOM OVERRIDES</span>
                  <button
                    onClick={() => setWordOverrides({})}
                    className="hover:text-white underline cursor-pointer"
                  >
                    RESET
                  </button>
                </div>
              )}
              <span className="text-[#E85D2A] font-bold">
                {selectedLines.length} LINES
              </span>
              <span>•</span>
              <span>{rangeDurationSec.toFixed(1)}s</span>
            </div>
          </div>
        </section>

        {/* ============================================================== */}
        {/* COLUMN 3: MOTION & OLED PREVIEW                               */}
        {/* ============================================================== */}
        <section className="w-[360px] flex flex-col shrink-0 bg-white min-h-0">
          <div className="p-3 border-b-2 border-[#1A1A1A] bg-[#F5F0EB]">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-[#6B6B6B] flex items-center gap-1.5">
              <span className="w-2 h-2 bg-[#E85D2A]" />
              <span>3. MOTION & OLED PREVIEW</span>
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 min-h-0">
            {/* Live True OLED Display Preview */}
            <div className="bg-[#2A2A2A] rounded-xl p-3 shadow-lg border border-[#111] flex flex-col items-center">
              <div className="text-[#888] text-[8px] font-mono mb-1">TRUE OLED PREVIEW (128×64)</div>
              <div className="bg-black p-1 rounded shadow-inner w-[128px]">
                <OledCanvas frameData={previewFrame} theme="cyan" scale={8} />
              </div>
              <div className="text-[#666] text-[7px] font-mono mt-1">30 FPS • 1-BIT MONOCHROME</div>
            </div>

            {/* Featured Dynamic Semantic Director Hero Card */}
            <div>
              <div
                onClick={() => setArchetype('auto_semantic')}
                className={`p-3 border-2 transition-all cursor-pointer flex flex-col gap-1.5 rounded-sm ${
                  archetype === 'auto_semantic'
                    ? 'border-[#E85D2A] bg-[#FFF5F0] shadow-[3px_3px_0px_#1A1A1A]'
                    : 'border-[#1A1A1A]/30 hover:border-[#1A1A1A] bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">✨</span>
                    <span className="text-xs font-bold text-[#1A1A1A]">AUTO SEMANTIC DIRECTOR</span>
                  </div>
                  <span className="text-[7px] font-bold bg-[#E85D2A] text-white px-1.5 py-0.5 tracking-wider uppercase rounded-xs">
                    ASHKE DYNAMIC
                  </span>
                </div>
                <p className="text-[9px] text-[#6B6B6B] leading-tight font-sans">
                  Adapts typography style dynamically per word according to meaning, phonetics, vocal duration & beats (e.g. blade slashes for sharp words, impact slams for drops, 3D blocks for anthems).
                </p>
              </div>
            </div>

            {/* Manual Motion Archetypes Grid */}
            <div>
              <label className="text-[9px] font-bold uppercase tracking-wider text-[#6B6B6B] block mb-2">
                OR LOCK UNIFORM MOTION STYLE:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {MANUAL_ARCHETYPES.map(archKey => {
                  const meta = ARCHETYPE_METADATA[archKey];
                  return (
                    <button
                      key={archKey}
                      onClick={() => setArchetype(archKey)}
                      className={`p-2 border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        archetype === archKey
                          ? 'border-[#E85D2A] bg-[#F5F0EB] shadow-[2px_2px_0px_#1A1A1A]'
                          : 'border-[#1A1A1A]/30 hover:border-[#1A1A1A] bg-white'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-sm">{meta.icon}</span>
                        <span className="text-[7px] font-mono bg-[#1A1A1A] text-white px-1 py-0.2 font-bold">
                          {meta.tag}
                        </span>
                      </div>
                      <span className="text-[9px] font-bold text-[#1A1A1A] mt-1">{meta.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Font Selector */}
            <div>
              <label className="text-[9px] font-bold uppercase tracking-wider text-[#6B6B6B] block mb-1">
                TYPOGRAPHY FONT
              </label>
              <select
                value={fontFamily}
                onChange={e => setFontFamily(e.target.value)}
                className="w-full bg-[#F5F0EB] border border-[#1A1A1A] p-2 text-xs font-mono focus:outline-none focus:border-[#E85D2A] cursor-pointer"
              >
                <option value='"IBM Plex Mono", monospace'>IBM Plex Mono (Classic)</option>
                <option value='VT323, monospace'>VT323 (Retro Arcade)</option>
                <option value='"Space Mono", monospace'>Space Mono (Modern Tech)</option>
                <option value='Impact, sans-serif'>Impact (Heavy Bold)</option>
              </select>
            </div>

            {/* Real-time Telemetry Card */}
            <div className="p-3 bg-[#F5F0EB] border border-[#1A1A1A] text-[10px] font-mono flex flex-col gap-1">
              <div className="flex justify-between">
                <span className="text-[#6B6B6B]">TOTAL DURATION:</span>
                <span className="font-bold text-[#1A1A1A]">{rangeDurationSec.toFixed(2)}s</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B6B6B]">30 FPS FRAMES:</span>
                <span className="font-bold text-[#E85D2A]">{totalFrames} frames</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B6B6B]">PROGMEM FLASH:</span>
                <span className="font-bold text-[#1A1A1A]">~{estProgmemKb} KB</span>
              </div>
            </div>

            {/* Main Action Button */}
            <button
              onClick={handleGenerateAndInject}
              disabled={isRendering || selectedLines.length === 0}
              className={`w-full py-3 bg-[#E85D2A] text-white text-xs font-bold tracking-widest uppercase border-2 border-[#1A1A1A] shadow-[4px_4px_0px_#1A1A1A] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_#1A1A1A] transition-all cursor-pointer mt-auto flex items-center justify-center gap-2 ${
                isRendering ? 'opacity-70 cursor-wait' : ''
              }`}
            >
              {isRendering ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>RENDERING {renderProgress}%</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>GENERATE & SEND TO NLE</span>
                </>
              )}
            </button>
          </div>
        </section>

      </main>

      {/* Word Archetype Customizer Modal */}
      {editingWordTarget && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border-2 border-[#1A1A1A] w-full max-w-md shadow-[6px_6px_0px_#1A1A1A] p-5 flex flex-col gap-4 font-mono animate-scale-in">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[9px] font-bold text-[#E85D2A] uppercase tracking-wider block">
                  WORD MOTION OVERRIDE
                </span>
                <h3 className="text-base font-bold text-[#1A1A1A]">
                  "{editingWordTarget.word.word}"
                </h3>
                <span className="text-[10px] text-[#666]">
                  Timing: {(editingWordTarget.word.startMs / 1000).toFixed(2)}s - {(editingWordTarget.word.endMs / 1000).toFixed(2)}s ({Math.round(editingWordTarget.word.endMs - editingWordTarget.word.startMs)}ms)
                </span>
              </div>
              <button
                onClick={() => setEditingWordTarget(null)}
                className="p-1 hover:bg-[#1A1A1A] hover:text-white transition-colors cursor-pointer border border-[#1A1A1A]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] text-[#444]">
              Pick an explicit visual motion archetype for this word, or restore dynamic semantic detection:
            </p>

            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
              {MANUAL_ARCHETYPES.map((archKey) => {
                const meta = ARCHETYPE_METADATA[archKey];
                const isSelected = editingWordTarget.currentArchetype === archKey;
                return (
                  <button
                    key={archKey}
                    onClick={() => {
                      const specificKey = `${editingWordTarget.word.word}_${editingWordTarget.word.startMs}`;
                      setWordOverrides(prev => ({
                        ...prev,
                        [specificKey]: archKey
                      }));
                      setEditingWordTarget(null);
                    }}
                    className={`p-2 border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-[#E85D2A] bg-[#FFF5F0] font-bold shadow-[2px_2px_0px_#1A1A1A]'
                        : 'border-[#1A1A1A]/30 hover:border-[#1A1A1A] bg-white'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-sm">{meta.icon}</span>
                      <span className="text-[7px] font-mono bg-[#1A1A1A] text-white px-1 py-0.2">
                        {meta.tag}
                      </span>
                    </div>
                    <span className="text-[9px] font-bold text-[#1A1A1A] mt-1">{meta.name}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2 pt-2 border-t border-[#1A1A1A]/20">
              <button
                onClick={() => {
                  const specificKey = `${editingWordTarget.word.word}_${editingWordTarget.word.startMs}`;
                  const cleanKey = editingWordTarget.word.word.toLowerCase().replace(/[^a-z0-9]/g, '');
                  setWordOverrides(prev => {
                    const next = { ...prev };
                    delete next[specificKey];
                    delete next[cleanKey];
                    return next;
                  });
                  setEditingWordTarget(null);
                }}
                className="flex-1 py-1.5 border border-[#1A1A1A] text-xs font-bold hover:bg-[#1A1A1A] hover:text-white transition-colors cursor-pointer"
              >
                RESTORE AUTO SEMANTIC
              </button>
              <button
                onClick={() => setEditingWordTarget(null)}
                className="px-4 py-1.5 bg-[#1A1A1A] text-white text-xs font-bold hover:bg-[#E85D2A] transition-colors cursor-pointer"
              >
                DONE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LyricsStudioView;

