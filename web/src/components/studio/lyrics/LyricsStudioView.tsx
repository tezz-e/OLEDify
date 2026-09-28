import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Music, FileText, Upload, Play, Pause, ArrowLeft, Sparkles, Check, RefreshCw, X, RotateCcw, ChevronUp, ChevronDown, CheckCheck } from 'lucide-react';
import { searchLrclib, getLrclibExact, searchLyricsOvhFallback } from '../../../engine/lyrics/lrclibClient';
import { parseLrc, parsePlainTextLyrics } from '../../../engine/lyrics/lrcParser';
import { LrclibTrack, ParsedLyrics, LyricLine, LyricWord } from '../../../engine/lyrics/types';
import { MotionArchetype, ARCHETYPE_METADATA } from '../../../engine/kinetic/types';
import { renderKineticSequence } from '../../../engine/kinetic/kineticEngine';
import { getWordEffectiveArchetype } from '../../../engine/kinetic/semanticClassifier';
import { DecodedMedia, ExtractedFrame } from '../../../types/media';
import { OledCanvas } from '../../OledCanvas';
import { GlassSurface } from '../../reactbits/GlassSurface';
import { ThemeSwitch } from './ThemeSwitch';

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
  // --- THEME STATE (UNIFORM LIGHT / DARK MODE) ---
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light');

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

  // Active currently sung line index based on playheadMs
  const activeLineIndex = useMemo(() => {
    if (parsedLyrics.lines.length === 0) return 0;
    const idx = parsedLyrics.lines.findIndex(
      l => playheadMs >= l.startMs && playheadMs < l.endMs
    );
    if (idx !== -1) return idx;
    for (let i = parsedLyrics.lines.length - 1; i >= 0; i--) {
      if (playheadMs >= parsedLyrics.lines[i].startMs) return i;
    }
    return 0;
  }, [parsedLyrics.lines, playheadMs]);

  // Auto-scroll ref and smooth centering
  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
  const userScrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleUserScroll = () => {
    if (userScrollTimeoutRef.current) {
      clearTimeout(userScrollTimeoutRef.current);
    }
    setIsAutoScrollEnabled(false);
    userScrollTimeoutRef.current = setTimeout(() => {
      setIsAutoScrollEnabled(true);
    }, 4500);
  };

  useEffect(() => {
    if (!isPlaying || !isAutoScrollEnabled) return;
    const el = document.getElementById(`lyric-line-${activeLineIndex}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeLineIndex, isPlaying, isAutoScrollEnabled]);

  // Quick range helpers
  const handleSelectAll = () => {
    setSelectedStartIndex(0);
    setSelectedEndIndex(Math.max(0, parsedLyrics.lines.length - 1));
  };

  const handleExpandRange = (delta: number) => {
    const start = Math.min(selectedStartIndex, selectedEndIndex);
    const end = Math.max(selectedStartIndex, selectedEndIndex);
    if (delta > 0) {
      setSelectedEndIndex(Math.min(parsedLyrics.lines.length - 1, end + 1));
    } else if (delta < 0 && end > start) {
      setSelectedEndIndex(end - 1);
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
    <div className={`fixed inset-0 z-50 flex flex-col font-mono select-none overflow-hidden transition-colors duration-200 ${
      themeMode === 'dark' ? 'bg-[#0E0E10] text-[#E5E5E5]' : 'bg-[#F5F0EB] text-[#1A1A1A]'
    }`}>
      {/* Studio Top Navigation Bar */}
      <header className={`h-14 px-6 border-b-2 flex items-center justify-between shrink-0 z-20 transition-colors duration-200 ${
        themeMode === 'dark' ? 'bg-[#141417] border-[#252528] text-white' : 'bg-white border-[#1A1A1A] text-[#1A1A1A]'
      }`}>
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className={`flex items-center gap-1.5 px-3 py-1.5 border text-xs font-bold transition-colors cursor-pointer ${
              themeMode === 'dark'
                ? 'bg-[#1E1E24] border-white/20 text-white hover:bg-white hover:text-black'
                : 'bg-white border-[#1A1A1A] text-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white'
            }`}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>BACK TO EDITOR</span>
          </button>

          <div className={`h-5 w-px ${themeMode === 'dark' ? 'bg-white/20' : 'bg-[#1A1A1A]/30'}`} />

          <h1 className="text-sm font-bold tracking-widest flex items-center gap-2">
            <span className="text-[#E85D2A]">✦</span>
            <span>KINETIC LYRICS STUDIO</span>
          </h1>
        </div>

        {/* Center: React Bits Squish Switch Theme Controller */}
        <div className="flex items-center gap-4">
          <ThemeSwitch theme={themeMode} onChange={setThemeMode} />
        </div>

        {/* Right Badges */}
        <div className="flex items-center gap-4 text-xs font-bold">
          <span className={`px-2 py-0.5 text-[9px] uppercase tracking-wider ${
            themeMode === 'dark' ? 'bg-[#222228] text-white/90 border border-white/10' : 'bg-[#1A1A1A] text-white'
          }`}>
            128×64 MONO OLED
          </span>
          <span className="text-[#E85D2A]">30 FPS ENGINE</span>
        </div>
      </header>

      {/* Main 3-Pane Workspace */}
      <main className={`flex-1 flex min-h-0 divide-x-2 transition-colors duration-200 ${
        themeMode === 'dark' ? 'divide-[#252528] bg-[#0E0E10]' : 'divide-[#1A1A1A] bg-[#F5F0EB]'
      }`}>
        
        {/* ============================================================== */}
        {/* COLUMN 1: INGESTION & SEARCH                                  */}
        {/* ============================================================== */}
        <section className={`w-[340px] flex flex-col shrink-0 min-h-0 transition-colors duration-200 ${
          themeMode === 'dark' ? 'bg-[#141417] text-white' : 'bg-white text-[#1A1A1A]'
        }`}>
          <div className={`p-3 border-b-2 ${
            themeMode === 'dark' ? 'border-[#252528] bg-[#18181C]' : 'border-[#1A1A1A] bg-[#F5F0EB]'
          }`}>
            <h2 className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 ${
              themeMode === 'dark' ? 'text-white/60' : 'text-[#6B6B6B]'
            }`}>
              <span className="w-2 h-2 bg-[#E85D2A]" />
              <span>1. SONG & LYRICS INGESTION</span>
            </h2>
          </div>

          {/* Sub-tabs */}
          <div className={`flex border-b text-[9px] font-bold ${
            themeMode === 'dark' ? 'border-white/10 bg-[#18181C]' : 'border-[#1A1A1A]/20 bg-[#F5F0EB]'
          }`}>
            <button
              onClick={() => setIngestTab('search')}
              className={`flex-1 py-2 border-b-2 transition-colors cursor-pointer ${
                ingestTab === 'search'
                  ? themeMode === 'dark'
                    ? 'border-[#E85D2A] bg-[#141417] text-white'
                    : 'border-[#E85D2A] bg-white text-[#1A1A1A]'
                  : themeMode === 'dark'
                  ? 'border-transparent text-white/40 hover:text-white/70'
                  : 'border-transparent text-[#6B6B6B] hover:text-[#1A1A1A]'
              }`}
            >
              SEARCH API
            </button>
            <button
              onClick={() => setIngestTab('paste')}
              className={`flex-1 py-2 border-b-2 transition-colors cursor-pointer ${
                ingestTab === 'paste'
                  ? themeMode === 'dark'
                    ? 'border-[#E85D2A] bg-[#141417] text-white'
                    : 'border-[#E85D2A] bg-white text-[#1A1A1A]'
                  : themeMode === 'dark'
                  ? 'border-transparent text-white/40 hover:text-white/70'
                  : 'border-transparent text-[#6B6B6B] hover:text-[#1A1A1A]'
              }`}
            >
              PASTE LRC
            </button>
            <button
              onClick={() => setIngestTab('audio')}
              className={`flex-1 py-2 border-b-2 transition-colors cursor-pointer ${
                ingestTab === 'audio'
                  ? themeMode === 'dark'
                    ? 'border-[#E85D2A] bg-[#141417] text-white'
                    : 'border-[#E85D2A] bg-white text-[#1A1A1A]'
                  : themeMode === 'dark'
                  ? 'border-transparent text-white/40 hover:text-white/70'
                  : 'border-transparent text-[#6B6B6B] hover:text-[#1A1A1A]'
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
                      className={`w-full px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#E85D2A] border ${
                        themeMode === 'dark'
                          ? 'bg-[#1C1C22] border-white/15 text-white placeholder-white/30'
                          : 'bg-[#F5F0EB] border-[#1A1A1A] text-[#1A1A1A] placeholder-[#888]'
                      }`}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSearching}
                    className={`px-3 bg-[#E85D2A] text-white text-xs font-bold border hover:opacity-90 transition-opacity cursor-pointer flex items-center justify-center ${
                      themeMode === 'dark' ? 'border-white/20' : 'border-[#1A1A1A]'
                    }`}
                  >
                    {isSearching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  </button>
                </form>

                {/* Results list */}
                <div className="flex-1 overflow-y-auto flex flex-col gap-2 min-h-0 mt-2">
                  {searchResults.length === 0 ? (
                    <div className={`py-8 text-center text-[10px] border border-dashed p-4 ${
                      themeMode === 'dark'
                        ? 'border-white/15 text-white/40'
                        : 'border-[#1A1A1A]/30 text-[#6B6B6B]'
                    }`}>
                      Type any track name above to fetch real-time synced lyrics from LRCLIB database.
                    </div>
                  ) : (
                    searchResults.map(track => (
                      <div
                        key={track.id}
                        onClick={() => handleSelectTrack(track)}
                        className={`p-2.5 border transition-all cursor-pointer flex flex-col gap-1 shadow-sm ${
                          themeMode === 'dark'
                            ? 'border-white/15 bg-[#1C1C22] hover:border-[#E85D2A] hover:bg-[#25252E] text-white'
                            : 'border-[#1A1A1A] bg-[#F5F0EB] hover:border-[#E85D2A] hover:bg-white text-[#1A1A1A]'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <span className="font-bold text-xs truncate">{track.trackName}</span>
                          {track.syncedLyrics && (
                            <span className="bg-[#E85D2A] text-white text-[7px] font-bold px-1.5 py-0.2 uppercase">
                              SYNCED
                            </span>
                          )}
                        </div>
                        <div className={`text-[10px] truncate ${themeMode === 'dark' ? 'text-white/60' : 'text-[#6B6B6B]'}`}>
                          {track.artistName} {track.albumName ? `• ${track.albumName}` : ''}
                        </div>
                        <div className={`text-[8px] ${themeMode === 'dark' ? 'text-white/40' : 'text-[#888]'}`}>
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
                  className={`flex-1 p-2.5 text-[10px] font-mono resize-none focus:outline-none focus:border-[#E85D2A] border ${
                    themeMode === 'dark'
                      ? 'bg-[#1C1C22] border-white/15 text-white'
                      : 'bg-[#F5F0EB] border-[#1A1A1A] text-[#1A1A1A]'
                  }`}
                />
                <button
                  onClick={handleApplyPastedLrc}
                  className={`w-full py-2 text-xs font-bold uppercase transition-colors cursor-pointer ${
                    themeMode === 'dark'
                      ? 'bg-[#25252B] hover:bg-[#E85D2A] text-white border border-white/20'
                      : 'bg-[#1A1A1A] hover:bg-[#E85D2A] text-white'
                  }`}
                >
                  PARSE & LOAD LYRICS
                </button>
              </div>
            )}

            {ingestTab === 'audio' && (
              <div className={`flex-1 flex flex-col items-center justify-center p-4 border border-dashed text-center gap-3 ${
                themeMode === 'dark' ? 'border-white/20 text-white' : 'border-[#1A1A1A]/40 text-[#1A1A1A]'
              }`}>
                <Upload className="w-8 h-8 text-[#E85D2A]" />
                <p className="text-xs font-bold">DROP LOCAL MP3 / WAV</p>
                <p className={`text-[10px] ${themeMode === 'dark' ? 'text-white/50' : 'text-[#6B6B6B]'}`}>
                  Enables 0-latency audio scrubbing and beat waveform preview
                </p>
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
        <section className={`flex-1 flex flex-col relative min-h-0 overflow-hidden transition-colors duration-200 ${
          themeMode === 'dark' ? 'bg-[#0E0E10]' : 'bg-[#F5F0EB]'
        }`}>
          {/* Apple Music Minimalist Header Bar */}
          <div className={`h-12 px-6 border-b flex justify-between items-center z-10 shrink-0 transition-colors duration-200 ${
            themeMode === 'dark' ? 'border-[#252528] bg-[#141417]' : 'border-b-2 border-[#1A1A1A] bg-white'
          }`}>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#E85D2A] flex items-center gap-1.5 font-mono">
                <span>✦</span>
                <span>LYRICS SELECTION</span>
              </span>
              <span className={`text-[9px] font-mono ${themeMode === 'dark' ? 'text-white/40' : 'text-[#777]'}`}>
                Click line to seek • Shift+Click to expand range
              </span>
            </div>

            {/* Quick Selection Shortcuts */}
            <div className="flex items-center gap-1.5 font-mono text-[9px]">
              <button
                onClick={handleSelectAll}
                className={`px-2.5 py-1 font-bold border transition-colors cursor-pointer ${
                  themeMode === 'dark'
                    ? 'bg-[#222228] hover:bg-white text-white/80 hover:text-black border-white/10 rounded-sm'
                    : 'bg-[#F5F0EB] hover:bg-[#1A1A1A] text-[#1A1A1A] hover:text-white border-[#1A1A1A]'
                }`}
                title="Select all lyrics in song"
              >
                SELECT ALL
              </button>
              <button
                onClick={() => handleExpandRange(1)}
                className={`px-2.5 py-1 font-bold border transition-colors cursor-pointer ${
                  themeMode === 'dark'
                    ? 'bg-[#222228] hover:bg-white text-white/80 hover:text-black border-white/10 rounded-sm'
                    : 'bg-[#F5F0EB] hover:bg-[#1A1A1A] text-[#1A1A1A] hover:text-white border-[#1A1A1A]'
                }`}
                title="Expand selection by 1 line"
              >
                +1 LINE
              </button>
              <button
                onClick={() => handleExpandRange(-1)}
                className={`px-2.5 py-1 font-bold border transition-colors cursor-pointer ${
                  themeMode === 'dark'
                    ? 'bg-[#222228] hover:bg-white text-white/80 hover:text-black border-white/10 rounded-sm'
                    : 'bg-[#F5F0EB] hover:bg-[#1A1A1A] text-[#1A1A1A] hover:text-white border-[#1A1A1A]'
                }`}
                title="Shrink selection by 1 line"
              >
                -1 LINE
              </button>
            </div>
          </div>

          {/* Minimalist Apple Music Lyric List */}
          <div
            ref={lyricsContainerRef}
            onScroll={handleUserScroll}
            className="flex-1 overflow-y-auto px-6 py-10 md:px-16 md:py-16 flex flex-col items-center gap-4 relative z-10 min-h-0 scroll-smooth"
          >
            {parsedLyrics.lines.map((line, idx) => {
              const start = Math.min(selectedStartIndex, selectedEndIndex);
              const end = Math.max(selectedStartIndex, selectedEndIndex);
              const isSelected = idx >= start && idx <= end;
              const isActiveLine = idx === activeLineIndex;
              const isStartPin = idx === start;
              const isEndPin = idx === end;

              return isSelected ? (
                <div key={idx} id={`lyric-line-${idx}`} className="w-full max-w-xl transition-all duration-200">
                  <GlassSurface
                    borderRadius={10}
                    blur={16}
                    brightness={themeMode === 'dark' ? 35 : 95}
                    backgroundOpacity={themeMode === 'dark' ? 0.08 : 0.85}
                    saturation={1}
                    borderWidth={0.02}
                    distortionScale={0}
                    className={`w-full relative transition-all ${
                      themeMode === 'dark'
                        ? 'border border-white/15 shadow-xl bg-white/[0.04]'
                        : 'border-2 border-[#1A1A1A] shadow-[4px_4px_0px_#1A1A1A] bg-white/90'
                    }`}
                  >
                    <div
                      onClick={(e) => handleLineClick(idx, e)}
                      className={`p-4 md:p-5 cursor-pointer relative group transition-all ${
                        isActiveLine
                          ? themeMode === 'dark' ? 'bg-white/[0.04]' : 'bg-[#E85D2A]/10'
                          : ''
                      }`}
                    >
                      {/* Selection Pin Badges */}
                      {isStartPin && (
                        <span className="absolute -top-2.5 left-4 bg-[#E85D2A] text-white text-[8px] font-bold px-2 py-0.5 shadow-sm z-20 font-mono tracking-wider">
                          START • {(line.startMs / 1000).toFixed(2)}s
                        </span>
                      )}
                      {isEndPin && (
                        <span className="absolute -bottom-2.5 right-4 bg-[#E85D2A] text-white text-[8px] font-bold px-2 py-0.5 shadow-sm z-20 font-mono tracking-wider">
                          END • {(line.endMs / 1000).toFixed(2)}s
                        </span>
                      )}

                      {/* Header Timestamp */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] text-[#E85D2A] font-mono font-semibold tracking-wider">
                          {Math.floor(line.startMs / 60000)}:{((line.startMs % 60000) / 1000).toFixed(2).padStart(5, '0')}
                        </span>
                        {isActiveLine && (
                          <span className="text-[8px] font-bold text-white bg-[#E85D2A] px-2 py-0.5 uppercase font-mono tracking-wider">
                            PLAYING
                          </span>
                        )}
                      </div>

                      {/* Clean Apple Music Typography */}
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        {line.words && line.words.length > 0 ? (
                          line.words.map((w, wIdx) => {
                            const isWordActive = isActiveLine && playheadMs >= w.startMs && playheadMs < w.endMs;
                            const isWordPast = isActiveLine ? playheadMs >= w.endMs : idx < activeLineIndex;

                            return (
                              <span
                                key={wIdx}
                                className={`text-xl md:text-2xl font-bold tracking-tight transition-colors duration-150 inline-block ${
                                  themeMode === 'dark'
                                    ? isWordActive
                                      ? 'text-white font-black underline decoration-[#E85D2A] decoration-2'
                                      : isWordPast
                                      ? 'text-white/90'
                                      : 'text-white/40'
                                    : isWordActive
                                    ? 'text-[#1A1A1A] font-black underline decoration-[#E85D2A] decoration-3'
                                    : isWordPast
                                    ? 'text-[#1A1A1A] font-bold'
                                    : 'text-[#888]'
                                }`}
                              >
                                {w.word}
                              </span>
                            );
                          })
                        ) : (
                          <span className={`text-xl md:text-2xl font-bold ${
                            themeMode === 'dark' ? 'text-white' : 'text-[#1A1A1A]'
                          }`}>
                            {line.text}
                          </span>
                        )}
                      </div>

                      {/* Word Motion Badges */}
                      {line.words && line.words.length > 0 && (
                        <div className={`mt-3 pt-2.5 border-t flex flex-wrap gap-1.5 items-center ${
                          themeMode === 'dark' ? 'border-white/10' : 'border-[#1A1A1A]/15'
                        }`}>
                          <span className={`text-[8px] font-bold uppercase tracking-wider mr-1 font-mono ${
                            themeMode === 'dark' ? 'text-white/40' : 'text-[#666]'
                          }`}>
                            {archetype === 'auto_semantic' ? 'DYNAMIC STYLES:' : 'WORDS:'}
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
                                className={`px-2 py-0.5 text-[9px] font-mono flex items-center gap-1 transition-all cursor-pointer ${
                                  isOverridden
                                    ? 'bg-[#E85D2A] text-white font-bold ring-1 ring-[#1A1A1A]'
                                    : themeMode === 'dark'
                                    ? 'bg-white/10 hover:bg-white/20 text-white/80 hover:text-white border border-white/15'
                                    : 'bg-[#F5F0EB] hover:bg-[#1A1A1A] hover:text-white text-[#1A1A1A] border border-[#1A1A1A]/30'
                                }`}
                                title={`Customize motion style for "${w.word}"`}
                              >
                                <span>{meta.icon}</span>
                                <span className="font-semibold">{w.word}</span>
                                <span className="opacity-50 text-[7px] uppercase font-mono">({meta.tag})</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </GlassSurface>
                </div>
              ) : (
                <div
                  key={idx}
                  id={`lyric-line-${idx}`}
                  onClick={(e) => handleLineClick(idx, e)}
                  className={`w-full max-w-xl transition-all duration-200 cursor-pointer p-3.5 relative group ${
                    themeMode === 'dark'
                      ? isActiveLine
                        ? 'text-white font-bold opacity-90'
                        : 'text-white/30 hover:text-white/70 opacity-40 hover:opacity-80'
                      : isActiveLine
                      ? 'text-[#1A1A1A] font-bold opacity-100'
                      : 'text-[#888888] hover:text-[#1A1A1A] opacity-60 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-[9px] font-mono w-12 shrink-0 ${
                      themeMode === 'dark' ? 'text-white/40' : 'text-[#888]'
                    }`}>
                      {Math.floor(line.startMs / 60000)}:{((line.startMs % 60000) / 1000).toFixed(1).padStart(4, '0')}
                    </span>
                    <span className="text-lg font-medium transition-colors">
                      {line.text}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Hidden Audio Player for drop sync */}
          {localAudioUrl && (
            <audio ref={audioRef} src={localAudioUrl} />
          )}

          {/* Minimalist Bottom Audio Scrub Bar */}
          <div className={`h-14 px-6 border-t flex items-center justify-between z-10 shrink-0 gap-4 transition-colors duration-200 ${
            themeMode === 'dark'
              ? 'bg-[#141417] border-[#252528] text-white'
              : 'bg-white border-t-2 border-[#1A1A1A] text-[#1A1A1A]'
          }`}>
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={togglePlay}
                className="w-8 h-8 rounded-full bg-[#E85D2A] text-white flex items-center justify-center hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>

              <div className={`text-[10px] font-mono w-28 shrink-0 ${
                themeMode === 'dark' ? 'text-white/90' : 'text-[#1A1A1A]'
              }`}>
                {(playheadMs / 1000).toFixed(2)}s / {(rangeEndMs / 1000).toFixed(2)}s
              </div>
            </div>

            {/* Minimal Timeline Scrubber */}
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
                className={`w-full accent-[#E85D2A] h-1.5 cursor-pointer ${
                  themeMode === 'dark' ? 'bg-white/15' : 'bg-[#1A1A1A]/15'
                }`}
              />
            </div>

            <div className={`flex items-center gap-3 text-xs font-mono shrink-0 ${
              themeMode === 'dark' ? 'text-white/70' : 'text-[#1A1A1A]'
            }`}>
              {Object.keys(wordOverrides).length > 0 && (
                <div className="flex items-center gap-1.5 bg-[#E85D2A]/15 border border-[#E85D2A]/40 px-2 py-0.5 rounded text-[8px] text-[#E85D2A]">
                  <span>{Object.keys(wordOverrides).length} OVERRIDES</span>
                  <button
                    onClick={() => setWordOverrides({})}
                    className="hover:underline cursor-pointer"
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
        <section className={`w-[360px] flex flex-col shrink-0 min-h-0 transition-colors duration-200 ${
          themeMode === 'dark' ? 'bg-[#141417] text-white' : 'bg-white text-[#1A1A1A]'
        }`}>
          <div className={`p-3 border-b-2 ${
            themeMode === 'dark' ? 'border-[#252528] bg-[#18181C]' : 'border-[#1A1A1A] bg-[#F5F0EB]'
          }`}>
            <h2 className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 ${
              themeMode === 'dark' ? 'text-white/60' : 'text-[#6B6B6B]'
            }`}>
              <span className="w-2 h-2 bg-[#E85D2A]" />
              <span>3. MOTION & OLED PREVIEW</span>
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 min-h-0">
            {/* Live True OLED Display Preview */}
            <div className={`rounded-xl p-3 shadow-lg flex flex-col items-center border ${
              themeMode === 'dark' ? 'bg-[#1B1B20] border-white/10' : 'bg-[#2A2A2A] border-[#111]'
            }`}>
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
                    ? themeMode === 'dark'
                      ? 'border-[#E85D2A] bg-[#E85D2A]/15 shadow-[3px_3px_0px_rgba(255,255,255,0.1)]'
                      : 'border-[#E85D2A] bg-[#FFF5F0] shadow-[3px_3px_0px_#1A1A1A]'
                    : themeMode === 'dark'
                    ? 'border-white/15 hover:border-white/40 bg-[#1C1C22]'
                    : 'border-[#1A1A1A]/30 hover:border-[#1A1A1A] bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">✨</span>
                    <span className={`text-xs font-bold ${themeMode === 'dark' ? 'text-white' : 'text-[#1A1A1A]'}`}>
                      AUTO SEMANTIC DIRECTOR
                    </span>
                  </div>
                  <span className="text-[7px] font-bold bg-[#E85D2A] text-white px-1.5 py-0.5 tracking-wider uppercase rounded-xs">
                    ASHKE DYNAMIC
                  </span>
                </div>
                <p className={`text-[9px] leading-tight font-sans ${
                  themeMode === 'dark' ? 'text-white/60' : 'text-[#6B6B6B]'
                }`}>
                  Adapts typography style dynamically per word according to meaning, phonetics, vocal duration & beats (e.g. blade slashes for sharp words, impact slams for drops, 3D blocks for anthems).
                </p>
              </div>
            </div>

            {/* Manual Motion Archetypes Grid */}
            <div>
              <label className={`text-[9px] font-bold uppercase tracking-wider block mb-2 ${
                themeMode === 'dark' ? 'text-white/60' : 'text-[#6B6B6B]'
              }`}>
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
                          ? themeMode === 'dark'
                            ? 'border-2 border-[#E85D2A] bg-[#E85D2A]/20 shadow-[2px_2px_0px_#E85D2A]'
                            : 'border-2 border-[#E85D2A] bg-[#F5F0EB] shadow-[2px_2px_0px_#1A1A1A]'
                          : themeMode === 'dark'
                          ? 'border-white/15 hover:border-white/40 bg-[#1C1C22]'
                          : 'border-[#1A1A1A]/30 hover:border-[#1A1A1A] bg-white'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-sm">{meta.icon}</span>
                        <span className={`text-[7px] font-mono px-1 py-0.2 font-bold ${
                          themeMode === 'dark' ? 'bg-white/20 text-white' : 'bg-[#1A1A1A] text-white'
                        }`}>
                          {meta.tag}
                        </span>
                      </div>
                      <span className={`text-[9px] font-bold mt-1 ${themeMode === 'dark' ? 'text-white' : 'text-[#1A1A1A]'}`}>
                        {meta.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Font Selector */}
            <div>
              <label className={`text-[9px] font-bold uppercase tracking-wider block mb-1 ${
                themeMode === 'dark' ? 'text-white/60' : 'text-[#6B6B6B]'
              }`}>
                TYPOGRAPHY FONT
              </label>
              <select
                value={fontFamily}
                onChange={e => setFontFamily(e.target.value)}
                className={`w-full p-2 text-xs font-mono focus:outline-none focus:border-[#E85D2A] cursor-pointer border ${
                  themeMode === 'dark'
                    ? 'bg-[#1C1C22] border-white/20 text-white'
                    : 'bg-[#F5F0EB] border-[#1A1A1A] text-[#1A1A1A]'
                }`}
              >
                <option value='"IBM Plex Mono", monospace'>IBM Plex Mono (Classic)</option>
                <option value='VT323, monospace'>VT323 (Retro Arcade)</option>
                <option value='"Space Mono", monospace'>Space Mono (Modern Tech)</option>
                <option value='Impact, sans-serif'>Impact (Heavy Bold)</option>
              </select>
            </div>

            {/* Real-time Telemetry Card */}
            <div className={`p-3 border text-[10px] font-mono flex flex-col gap-1 ${
              themeMode === 'dark'
                ? 'bg-[#18181C] border-white/15 text-white'
                : 'bg-[#F5F0EB] border-[#1A1A1A] text-[#1A1A1A]'
            }`}>
              <div className="flex justify-between">
                <span className={themeMode === 'dark' ? 'text-white/50' : 'text-[#6B6B6B]'}>TOTAL DURATION:</span>
                <span className="font-bold">{rangeDurationSec.toFixed(2)}s</span>
              </div>
              <div className="flex justify-between">
                <span className={themeMode === 'dark' ? 'text-white/50' : 'text-[#6B6B6B]'}>30 FPS FRAMES:</span>
                <span className="font-bold text-[#E85D2A]">{totalFrames} frames</span>
              </div>
              <div className="flex justify-between">
                <span className={themeMode === 'dark' ? 'text-white/50' : 'text-[#6B6B6B]'}>PROGMEM FLASH:</span>
                <span className="font-bold">~{estProgmemKb} KB</span>
              </div>
            </div>

            {/* Main Action Button */}
            <button
              onClick={handleGenerateAndInject}
              disabled={isRendering || selectedLines.length === 0}
              className={`w-full py-3 bg-[#E85D2A] text-white text-xs font-bold tracking-widest uppercase border-2 transition-all cursor-pointer mt-auto flex items-center justify-center gap-2 ${
                themeMode === 'dark'
                  ? 'border-white/20 shadow-[4px_4px_0px_rgba(0,0,0,0.6)] hover:shadow-[2px_2px_0px_rgba(0,0,0,0.6)]'
                  : 'border-[#1A1A1A] shadow-[4px_4px_0px_#1A1A1A] hover:shadow-[2px_2px_0px_#1A1A1A]'
              } hover:translate-x-[1px] hover:translate-y-[1px] ${
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
          <div className={`w-full max-w-md p-5 flex flex-col gap-4 font-mono animate-scale-in border-2 ${
            themeMode === 'dark'
              ? 'bg-[#161619] border-white/20 text-white shadow-[6px_6px_0px_rgba(0,0,0,0.8)]'
              : 'bg-white border-[#1A1A1A] text-[#1A1A1A] shadow-[6px_6px_0px_#1A1A1A]'
          }`}>
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[9px] font-bold text-[#E85D2A] uppercase tracking-wider block">
                  WORD MOTION OVERRIDE
                </span>
                <h3 className="text-base font-bold">
                  "{editingWordTarget.word.word}"
                </h3>
                <span className={`text-[10px] ${themeMode === 'dark' ? 'text-white/50' : 'text-[#666]'}`}>
                  Timing: {(editingWordTarget.word.startMs / 1000).toFixed(2)}s - {(editingWordTarget.word.endMs / 1000).toFixed(2)}s ({Math.round(editingWordTarget.word.endMs - editingWordTarget.word.startMs)}ms)
                </span>
              </div>
              <button
                onClick={() => setEditingWordTarget(null)}
                className={`p-1 transition-colors cursor-pointer border ${
                  themeMode === 'dark'
                    ? 'border-white/20 hover:bg-white hover:text-black'
                    : 'border-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className={`text-[11px] ${themeMode === 'dark' ? 'text-white/70' : 'text-[#444]'}`}>
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
                        ? themeMode === 'dark'
                          ? 'border-2 border-[#E85D2A] bg-[#E85D2A]/20 font-bold shadow-[2px_2px_0px_#E85D2A]'
                          : 'border-2 border-[#E85D2A] bg-[#FFF5F0] font-bold shadow-[2px_2px_0px_#1A1A1A]'
                        : themeMode === 'dark'
                        ? 'border-white/15 hover:border-white/40 bg-[#1C1C22]'
                        : 'border-[#1A1A1A]/30 hover:border-[#1A1A1A] bg-white'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-sm">{meta.icon}</span>
                      <span className={`text-[7px] font-mono px-1 py-0.2 ${
                        themeMode === 'dark' ? 'bg-white/20 text-white' : 'bg-[#1A1A1A] text-white'
                      }`}>
                        {meta.tag}
                      </span>
                    </div>
                    <span className="text-[9px] font-bold mt-1">{meta.name}</span>
                  </button>
                );
              })}
            </div>

            <div className={`flex gap-2 pt-2 border-t ${
              themeMode === 'dark' ? 'border-white/15' : 'border-[#1A1A1A]/20'
            }`}>
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
                className={`flex-1 py-1.5 border text-xs font-bold transition-colors cursor-pointer ${
                  themeMode === 'dark'
                    ? 'border-white/20 hover:bg-white hover:text-black text-white'
                    : 'border-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white text-[#1A1A1A]'
                }`}
              >
                RESTORE AUTO SEMANTIC
              </button>
              <button
                onClick={() => setEditingWordTarget(null)}
                className={`px-4 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                  themeMode === 'dark'
                    ? 'bg-white text-black hover:bg-[#E85D2A] hover:text-white'
                    : 'bg-[#1A1A1A] text-white hover:bg-[#E85D2A]'
                }`}
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


