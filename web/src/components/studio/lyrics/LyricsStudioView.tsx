import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Music, FileText, Upload, Play, Pause, ArrowLeft, Sparkles, Check, RefreshCw, X, RotateCcw, ChevronUp, ChevronDown, CheckCheck, Bot, Cpu, Activity, Zap, Volume2, Terminal, Sliders, Layers, Type } from 'lucide-react';
import { searchLrclib, getLrclibExact, searchLyricsOvhFallback } from '../../../engine/lyrics/lrclibClient';
import { parseLrc, parsePlainTextLyrics } from '../../../engine/lyrics/lrcParser';
import { LrclibTrack, ParsedLyrics, LyricLine, LyricWord } from '../../../engine/lyrics/types';
import { MotionArchetype, ARCHETYPE_METADATA, STYLE_PACKS, StylePackId, VisualMotif, MotifMode, MOTIF_METADATA } from '../../../engine/kinetic/types';
import { renderKineticSequence } from '../../../engine/kinetic/kineticEngine';
import { getWordEffectiveArchetype, getWordEffectiveFont, getWordFontRole } from '../../../engine/kinetic/semanticClassifier';
import { analyzeAudioFile, AudioAnalysisResult } from '../../../engine/kinetic/audioAnalysisEngine';
import {
  checkOllamaHealth,
  classifyLyricsWithOllama,
  OllamaHealthStatus,
  RECOMMENDED_OLLAMA_MODELS,
  OllamaInspectionLog,
  LLMProvider,
  getEffectiveGroqApiKey,
} from '../../../engine/kinetic/ollamaClassifier';
import { DecodedMedia, ExtractedFrame } from '../../../types/media';
import { OledCanvas } from '../../OledCanvas';
import { GlassSurface } from '../../reactbits/GlassSurface';
import { ThemeSwitch } from './ThemeSwitch';
import { OllamaInspectorModal } from './OllamaInspectorModal';
import { motion, AnimatePresence } from 'framer-motion';
import { NumberFlow } from './NumberFlow';

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
  'rolling_odometer',
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
  currentFont: string;
  currentMotif: VisualMotif;
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
  const [audioFileName, setAudioFileName] = useState<string | null>(null);
  const [audioAnalysis, setAudioAnalysis] = useState<AudioAnalysisResult | null>(null);
  const [isAnalyzingAudio, setIsAnalyzingAudio] = useState(false);
  const [audioAnalysisStatus, setAudioAnalysisStatus] = useState<string>('');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // --- KINETIC STYLE CONFIG ---
  // Default to AUTO_SEMANTIC (Smart Adaptive Director)
  const [archetype, setArchetype] = useState<MotionArchetype>('auto_semantic');
  const [directorModeTab, setDirectorModeTab] = useState<'auto' | 'manual'>('auto');
  const [showTokenBadges, setShowTokenBadges] = useState<boolean>(false);
  const [wordCustomizerTab, setWordCustomizerTab] = useState<'archetype' | 'font' | 'motif'>('archetype');
  const [stylePack, setStylePack] = useState<StylePackId>('trap_drill');
  const [wordOverrides, setWordOverrides] = useState<Record<string, MotionArchetype>>({});
  const [wordFontOverrides, setWordFontOverrides] = useState<Record<string, string>>({});
  const [motifMode, setMotifMode] = useState<MotifMode>('dynamic');
  const [wordMotifOverrides, setWordMotifOverrides] = useState<Record<string, VisualMotif>>({});
  const [editingWordTarget, setEditingWordTarget] = useState<EditingWordTarget | null>(null);
  const [fontFamily, setFontFamily] = useState<string>("'Lemon Milk', sans-serif");
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);

  // --- LLM INFERENCE STATE (Groq Cloud & Local Ollama) ---
  const [inferenceMode, setInferenceMode] = useState<'heuristic' | 'ollama'>('heuristic');
  const [llmProvider, setLlmProvider] = useState<LLMProvider>(() => {
    return getEffectiveGroqApiKey() ? 'groq' : 'ollama';
  });
  const [ollamaStatus, setOllamaStatus] = useState<OllamaHealthStatus | null>(null);
  const [selectedOllamaModel, setSelectedOllamaModel] = useState<string>('qwen3.5:2b-q4_K_M');
  const [isAnalyzingOllama, setIsAnalyzingOllama] = useState<boolean>(false);
  const [ollamaProgress, setOllamaProgress] = useState<{ percent: number; message: string } | null>(null);
  const [showOllamaInspector, setShowOllamaInspector] = useState<boolean>(false);
  const [ollamaInspectionLogs, setOllamaInspectionLogs] = useState<OllamaInspectionLog[]>([]);

  // Check Ollama status when user toggles to Ollama mode
  useEffect(() => {
    if (inferenceMode === 'ollama') {
      checkOllamaHealth().then(status => {
        setOllamaStatus(status);
        if (status.online && status.recommendedModel) {
          setSelectedOllamaModel(status.recommendedModel);
        }
      });
    }
  }, [inferenceMode]);

  const handleRunOllamaAnalysis = async () => {
    if (!parsedLyrics || parsedLyrics.lines.length === 0) return;
    setIsAnalyzingOllama(true);
    setOllamaProgress({ 
      percent: 0, 
      message: llmProvider === 'groq' ? 'Calling Groq 120B Cloud...' : 'Connecting to local Ollama...' 
    });

    try {
      const selectedLines = parsedLyrics.lines.slice(selectedStartIndex, selectedEndIndex + 1);
      const results = await classifyLyricsWithOllama(
        selectedLines.length > 0 ? selectedLines : parsedLyrics.lines,
        {
          provider: llmProvider,
          model: llmProvider === 'groq' ? 'openai/gpt-oss-120b' : selectedOllamaModel,
          songTitle: parsedLyrics.title || searchQuery,
          artist: parsedLyrics.artist,
          onProgress: (percent, message) => {
            setOllamaProgress({ percent, message });
          },
          onInspectionLog: (log) => {
            setOllamaInspectionLogs(prev => [log, ...prev]);
          },
        }
      );

      if (results.archetypes && Object.keys(results.archetypes).length > 0) {
        setWordOverrides(prev => ({ ...prev, ...results.archetypes }));
      } else if (Object.keys(results).length > 0) {
        setWordOverrides(prev => ({ ...prev, ...results }));
      }
      if (results.motifs && Object.keys(results.motifs).length > 0) {
        setWordMotifOverrides(prev => ({ ...prev, ...results.motifs }));
      }
    } catch (err: any) {
      console.error('LLM analysis failed:', err);
    } finally {
      setIsAnalyzingOllama(false);
      setTimeout(() => setOllamaProgress(null), 3500);
    }
  };

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

  const [snapFeedback, setSnapFeedback] = useState(false);
  const [isDraggingAudio, setIsDraggingAudio] = useState(false);
  const [audioAnalysisError, setAudioAnalysisError] = useState<string | null>(null);
  const [waveformResizeTick, setWaveformResizeTick] = useState(0);
  const waveformCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const localAudioUrlRef = useRef<string | null>(null);

  // Clean up object URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (localAudioUrlRef.current) {
        URL.revokeObjectURL(localAudioUrlRef.current);
      }
    };
  }, []);

  // Handle local audio file processing & analysis
  const handleAudioFile = async (file: File) => {
    try {
      setAudioAnalysisError(null);
      setIsAnalyzingAudio(true);
      setAudioAnalysisStatus('Reading audio file (10%)...');

      const result = await analyzeAudioFile(file, (percent, status) => {
        setAudioAnalysisStatus(`${status} (${percent}%)`);
      });

      // Revoke previous audio URL before allocating new one
      if (localAudioUrlRef.current) {
        URL.revokeObjectURL(localAudioUrlRef.current);
      }
      const url = URL.createObjectURL(file);
      localAudioUrlRef.current = url;
      setLocalAudioUrl(url);
      setAudioFileName(file.name);
      setAudioAnalysis(result);
      setAudioAnalysisStatus('');
    } catch (err: unknown) {
      console.error('Audio analysis failed:', err);
      const errMsg = err instanceof Error ? err.message : 'Failed to analyze audio file. Unsupported or corrupt format.';
      setAudioAnalysisError(errMsg);
      setAudioAnalysisStatus(errMsg);
    } finally {
      setIsAnalyzingAudio(false);
    }
  };

  // Handle local audio file drop or file input select
  const handleAudioDrop = (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
    let file: File | undefined;
    if ('dataTransfer' in e) {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingAudio(false);
      file = e.dataTransfer.files?.[0];
    } else if ('target' in e && e.target.files) {
      file = e.target.files[0];
      e.target.value = '';
    }
    if (file) {
      handleAudioFile(file);
    }
  };

  // Drag and drop events for audio upload area
  const handleAudioDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingAudio(true);
  };

  const handleAudioDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingAudio(false);
  };

  const handleAudioFileDrop = (e: React.DragEvent) => {
    handleAudioDrop(e);
  };

  // Magnetically align lyric lines and individual word timestamps to nearest detected drum onsets
  const handleSnapToNearestBeats = () => {
    if (!audioAnalysis) return;

    setParsedLyrics(prev => {
      let lastLineEnd = 0;
      const updatedLines = prev.lines.map((line, lIdx) => {
        let snappedLineStart = audioAnalysis.snapToNearestBeat(line.startMs);
        let snappedLineEnd = audioAnalysis.snapToNearestBeat(line.endMs);

        // Ensure lines remain strictly ordered and non-overlapping
        if (lIdx > 0 && snappedLineStart < lastLineEnd) {
          snappedLineStart = Math.max(snappedLineStart, lastLineEnd);
        }

        const finalLineStart = Math.min(snappedLineStart, snappedLineEnd - 100);
        const finalLineEnd = Math.max(snappedLineEnd, finalLineStart + 100);
        lastLineEnd = finalLineEnd;

        let wordPrevEnd = finalLineStart;
        const wordsCount = line.words.length;

        const updatedWords = line.words.map((w, wIdx) => {
          let s = audioAnalysis.snapToNearestBeat(w.startMs);
          let e = audioAnalysis.snapToNearestBeat(w.endMs);

          // Guarantee first word starts with line, last word terminates with line
          if (wIdx === 0) {
            s = finalLineStart;
          } else {
            s = Math.max(wordPrevEnd, Math.min(finalLineEnd - 60, s));
          }

          if (wIdx === wordsCount - 1) {
            e = finalLineEnd;
          } else {
            e = Math.max(s + 60, Math.min(finalLineEnd, e));
          }

          if (e <= s) {
            e = s + Math.max(60, w.endMs - w.startMs);
          }

          wordPrevEnd = e;
          return {
            ...w,
            startMs: s,
            endMs: e
          };
        });

        return {
          ...line,
          startMs: finalLineStart,
          endMs: finalLineEnd,
          words: updatedWords
        };
      });

      return {
        ...prev,
        lines: updatedLines
      };
    });

    setSnapFeedback(true);
    setTimeout(() => setSnapFeedback(false), 2500);
  };

  // Live beat detector: checks whether playhead is within ~85ms of any detected drum onset
  const isLiveBeat = useMemo(() => {
    if (!isPlaying || !audioAnalysis || audioAnalysis.beatsMs.length === 0) return false;
    const beats = audioAnalysis.beatsMs;
    let low = 0, high = beats.length - 1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      const diff = beats[mid] - playheadMs;
      if (Math.abs(diff) <= 85) return true;
      if (diff < 0) low = mid + 1;
      else high = mid - 1;
    }
    if (low < beats.length && Math.abs(beats[low] - playheadMs) <= 85) return true;
    if (high >= 0 && Math.abs(beats[high] - playheadMs) <= 85) return true;
    return false;
  }, [isPlaying, audioAnalysis, playheadMs]);

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

  // Live timeline frame counter and playback duration clock
  const currentFrameIndex = useMemo(() => {
    if (totalFrames <= 0) return 0;
    const offsetMs = Math.max(0, playheadMs - rangeStartMs);
    const rangeDurationMs = Math.max(1, rangeEndMs - rangeStartMs);
    const ratio = Math.min(1, Math.max(0, offsetMs / rangeDurationMs));
    return Math.min(totalFrames, Math.floor(ratio * totalFrames));
  }, [playheadMs, rangeStartMs, rangeEndMs, totalFrames]);

  const frameCounterStr = useMemo(() => {
    return `${String(currentFrameIndex).padStart(4, '0')} / ${String(totalFrames).padStart(4, '0')} FRAMES`;
  }, [currentFrameIndex, totalFrames]);

  const playbackClockStr = useMemo(() => {
    const mins = Math.floor(playheadMs / 60000).toString().padStart(2, '0');
    const secs = ((playheadMs % 60000) / 1000).toFixed(1).padStart(4, '0');
    return `${mins}:${secs}s`;
  }, [playheadMs]);

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
          stylePack,
          wordOverrides,
          wordFontOverrides,
          wordMotifOverrides,
          motifMode,
          audioAnalysis: audioAnalysis || undefined
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
  }, [selectedLines, archetype, fontFamily, stylePack, rangeStartMs, rangeEndMs, wordOverrides, wordFontOverrides, wordMotifOverrides, motifMode, audioAnalysis]);

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

  // Clamp playhead if lyric range changes
  useEffect(() => {
    if (playheadMs < rangeStartMs || playheadMs > rangeEndMs) {
      setPlayheadMs(rangeStartMs);
      if (audioRef.current) {
        audioRef.current.currentTime = rangeStartMs / 1000;
      }
    }
  }, [rangeStartMs, rangeEndMs]);

  // Canvas resize observer to keep waveform sharp on any layout or window size change
  useEffect(() => {
    const canvas = waveformCanvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => {
      setWaveformResizeTick(t => t + 1);
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  // Redraw audio scrubber waveform and beat markers
  useEffect(() => {
    const canvas = waveformCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const width = rect.width || canvas.clientWidth || 300;
    const height = rect.height || canvas.clientHeight || 32;

    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Subtle track background
    ctx.fillStyle = themeMode === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)';
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(0, 0, width, height, 6);
      ctx.fill();
    } else {
      ctx.fillRect(0, 0, width, height);
    }

    const rangeDuration = Math.max(1, rangeEndMs - rangeStartMs);
    const playheadRatio = Math.max(0, Math.min(1, (playheadMs - rangeStartMs) / rangeDuration));
    const playheadX = playheadRatio * width;

    if (audioAnalysis && audioAnalysis.waveform && audioAnalysis.waveform.length > 0) {
      const waveform = audioAnalysis.waveform;
      const totalAudioDuration = Math.max(1, audioAnalysis.durationMs);

      // Render vertical waveform bars across range
      const numBars = Math.min(90, Math.max(28, Math.floor(width / 5)));
      const barWidth = Math.max(1.5, (width / numBars) - 1.5);

      for (let i = 0; i < numBars; i++) {
        const barRatio = i / numBars;
        const barTimeMs = rangeStartMs + barRatio * rangeDuration;
        const barX = barRatio * width;

        let amplitude = 0.04;
        if (barTimeMs >= 0 && barTimeMs <= totalAudioDuration) {
          const wfIdx = Math.max(0, Math.min(waveform.length - 1, Math.floor((barTimeMs / totalAudioDuration) * waveform.length)));
          const point = waveform[wfIdx] || { min: 0, max: 0 };
          amplitude = Math.max(0.08, Math.min(1, Math.max(Math.abs(point.min), Math.abs(point.max))));
        }

        const barHeight = Math.max(3, amplitude * (height - 8));
        const barY = (height - barHeight) / 2;

        const isPlayed = barX <= playheadX;

        if (isPlayed) {
          ctx.fillStyle = '#D97757';
        } else {
          ctx.fillStyle = themeMode === 'dark' ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.16)';
        }

        if (ctx.roundRect) {
          ctx.beginPath();
          ctx.roundRect(barX, barY, barWidth, barHeight, 1);
          ctx.fill();
        } else {
          ctx.fillRect(barX, barY, barWidth, barHeight);
        }
      }

      // Render Beat Onset Marker Ticks with high contrast
      if (audioAnalysis.beatsMs && audioAnalysis.beatsMs.length > 0) {
        for (const beatMs of audioAnalysis.beatsMs) {
          if (beatMs >= rangeStartMs && beatMs <= rangeEndMs) {
            const beatX = ((beatMs - rangeStartMs) / rangeDuration) * width;
            const isNearPlayhead = Math.abs(beatX - playheadX) < 5;
            const isPlayed = beatX <= playheadX;

            if (isNearPlayhead) {
              // Active hit: prominent gold/amber flash
              ctx.fillStyle = '#FFE58F';
              ctx.beginPath();
              ctx.arc(beatX, height / 2, 3.5, 0, Math.PI * 2);
              ctx.fill();
              ctx.strokeStyle = '#D97757';
              ctx.lineWidth = 1.5;
              ctx.stroke();
            } else if (isPlayed) {
              // High-contrast clean white dot against terracotta played bars
              ctx.fillStyle = '#FFFFFF';
              ctx.beginPath();
              ctx.arc(beatX, height - 3.5, 1.8, 0, Math.PI * 2);
              ctx.fill();
            } else {
              // Terracotta onset tick on unplayed track
              ctx.fillStyle = themeMode === 'dark' ? 'rgba(217, 119, 87, 0.85)' : 'rgba(217, 119, 87, 0.7)';
              ctx.beginPath();
              ctx.arc(beatX, height - 3.5, 1.8, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      }
    } else {
      // Default flat line when no audio loaded
      const centerY = height / 2;
      ctx.strokeStyle = themeMode === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.12)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();

      if (playheadX > 0) {
        ctx.strokeStyle = '#D97757';
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(playheadX, centerY);
        ctx.stroke();
      }
    }

    // Playhead needle line
    ctx.strokeStyle = '#D97757';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, height);
    ctx.stroke();

    // Playhead glowing center handle
    ctx.fillStyle = '#FAF9F5';
    ctx.beginPath();
    ctx.arc(playheadX, height / 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#D97757';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }, [audioAnalysis, rangeStartMs, rangeEndMs, playheadMs, themeMode, waveformResizeTick]);

  // Toggle audio playback
  const togglePlay = () => {
    if (!isPlaying) {
      let startFromMs = playheadMs;
      if (startFromMs >= rangeEndMs - 50) {
        startFromMs = rangeStartMs;
        setPlayheadMs(rangeStartMs);
      }
      if (audioRef.current) {
        audioRef.current.currentTime = startFromMs / 1000;
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
        if (next >= rangeEndMs) {
          if (audioRef.current) {
            audioRef.current.currentTime = rangeStartMs / 1000;
            audioRef.current.play().catch(() => {});
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
          stylePack,
          wordOverrides,
          wordFontOverrides,
          wordMotifOverrides,
          motifMode,
          audioAnalysis: audioAnalysis || undefined
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
      themeMode === 'dark' ? 'bg-[#141413] text-[#FAF9F5]' : 'bg-[#FAF9F5] text-[#141413]'
    }`}>
      {/* Studio Top Navigation Bar */}
      <header className={`h-13 px-6 border-b flex items-center justify-between shrink-0 z-20 transition-colors duration-200 ${
        themeMode === 'dark' ? 'bg-[#18181A] border-[#2C2B29] text-[#FAF9F5]' : 'bg-[#FAF9F5] border-[#E8E5DE] text-[#141413]'
      }`}>
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className={`flex items-center gap-1.5 px-3 py-1.5 border text-xs font-medium font-sans rounded-lg transition-colors cursor-pointer shadow-xs ${
              themeMode === 'dark'
                ? 'bg-[#232220] border-white/10 text-white/90 hover:bg-white hover:text-black'
                : 'bg-white border-[#E8E5DE] text-[#141413] hover:bg-[#141413] hover:text-[#FAF9F5]'
            }`}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Timeline</span>
          </button>

          <div className={`h-4 w-px ${themeMode === 'dark' ? 'bg-white/10' : 'bg-[#E8E5DE]'}`} />

          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#D97757]" />
            <h1 className="font-sans text-sm font-semibold tracking-tight">
              Kinetic Studio
            </h1>
          </div>
        </div>

        {/* Center: Theme Controller */}
        <div className="flex items-center gap-4">
          <ThemeSwitch theme={themeMode} onChange={setThemeMode} />
        </div>

        {/* Right: Unified Hardware Spec Cluster */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className={`px-2.5 py-1 text-[11px] font-medium border rounded-full ${
            themeMode === 'dark' ? 'bg-[#232220] text-white/80 border-white/10' : 'bg-white text-[#5E5D59] border-[#E8E5DE]'
          }`}>
            128×64 • 1-Bit • 30 FPS
          </span>
        </div>
      </header>

      {/* Main 3-Pane Workspace */}
      <main className={`flex-1 flex min-h-0 divide-x transition-colors duration-200 ${
        themeMode === 'dark' ? 'divide-[#2C2B29] bg-[#141413]' : 'divide-[#E8E5DE] bg-[#FAF9F5]'
      }`}>
        
        {/* ============================================================== */}
        {/* COLUMN 1: INGESTION & SEARCH                                  */}
        {/* ============================================================== */}
        <section className={`w-[340px] flex flex-col shrink-0 min-h-0 transition-colors duration-200 ${
          themeMode === 'dark' ? 'bg-[#18181A] text-white' : 'bg-white text-[#141413]'
        }`}>
          <div className={`p-3 border-b ${
            themeMode === 'dark' ? 'border-[#2C2B29] bg-[#1E1E20]' : 'border-[#E8E5DE] bg-[#F5F2EB]'
          }`}>
            <h2 className={`text-[11px] font-sans font-semibold tracking-wide flex items-center gap-2 ${
              themeMode === 'dark' ? 'text-white/80' : 'text-[#141413]'
            }`}>
              <span className="w-1.5 h-1.5 rounded-full bg-[#D97757]" />
              <span>1. Ingest</span>
            </h2>
          </div>

          {/* Sub-tabs with Framer Motion sliding pill physics */}
          <div className={`flex border-b p-1 gap-1 shrink-0 relative ${
            themeMode === 'dark' ? 'border-[#2C2B29] bg-[#18181A]' : 'border-[#E8E5DE] bg-[#FAF9F5]'
          }`}>
            {[
              { id: 'search' as const, label: 'LRCLIB Search', Icon: Search },
              { id: 'paste' as const, label: 'Paste LRC', Icon: FileText },
              { id: 'audio' as const, label: 'Audio Beat Sync', Icon: Music },
            ].map(tab => {
              const isActive = ingestTab === tab.id;
              const TabIcon = tab.Icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setIngestTab(tab.id)}
                  className={`relative flex-1 py-1.5 px-2 text-xs font-sans rounded-md transition-colors cursor-pointer flex items-center justify-center gap-1.5 z-10 ${
                    isActive
                      ? themeMode === 'dark'
                        ? 'text-white font-semibold'
                        : 'text-[#141413] font-semibold'
                      : themeMode === 'dark'
                      ? 'text-white/50 hover:text-white/80'
                      : 'text-[#5E5D59] hover:text-[#141413]'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="ingest-tab-pill"
                      className={`absolute inset-0 rounded-md shadow-xs -z-10 ${
                        themeMode === 'dark' ? 'bg-[#232220]' : 'bg-white'
                      }`}
                      transition={{ type: 'spring', bounce: 0.16, duration: 0.35 }}
                    />
                  )}
                  <TabIcon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-0">
            {ingestTab === 'search' && (
              <>
                <form onSubmit={handleSearch} className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Search track title or artist..."
                      className={`w-full px-3 py-2 text-xs font-sans rounded-lg focus:outline-none focus:border-[#D97757] focus:ring-1 focus:ring-[#D97757] border transition-colors shadow-xs ${
                        themeMode === 'dark'
                          ? 'bg-[#232220] border-white/10 text-white placeholder-white/30'
                          : 'bg-white border-[#E8E5DE] text-[#141413] placeholder-[#87867F]'
                      }`}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSearching}
                    className="px-3.5 bg-[#D97757] hover:bg-[#C66545] text-white text-xs font-sans font-medium rounded-lg shadow-xs transition-colors cursor-pointer flex items-center justify-center shrink-0"
                  >
                    {isSearching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  </button>
                </form>

                {/* Results list */}
                <div className="flex-1 overflow-y-auto flex flex-col gap-2 min-h-0 mt-2">
                  {searchResults.length === 0 ? (
                    <div className={`py-8 text-center text-xs font-sans rounded-xl border border-dashed p-4 leading-relaxed ${
                      themeMode === 'dark'
                        ? 'border-white/10 bg-white/[0.02] text-white/40'
                        : 'border-[#E8E5DE] bg-[#FAF9F5] text-[#87867F]'
                    }`}>
                      Type any track name above to fetch real-time synced lyrics from LRCLIB database.
                    </div>
                  ) : (
                    searchResults.map(track => (
                      <div
                        key={track.id}
                        onClick={() => handleSelectTrack(track)}
                        className={`p-3 border rounded-xl transition-all cursor-pointer flex flex-col gap-1.5 shadow-xs ${
                          themeMode === 'dark'
                            ? 'border-white/10 bg-[#1C1C20] hover:border-[#D97757]/60 hover:bg-[#232228] text-white'
                            : 'border-[#E8E5DE] bg-white hover:border-[#D97757]/60 hover:bg-[#FAF9F5] text-[#141413]'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <span className="font-sans font-medium text-xs truncate">{track.trackName}</span>
                          {track.syncedLyrics && (
                            <span className="bg-[#D97757] text-white text-[9px] font-sans font-medium px-2 py-0.5 rounded-full shrink-0">
                              Synced
                            </span>
                          )}
                        </div>
                        <div className={`text-[11px] font-sans truncate ${themeMode === 'dark' ? 'text-white/60' : 'text-[#5E5D59]'}`}>
                          {track.artistName} {track.albumName ? `• ${track.albumName}` : ''}
                        </div>
                        <div className={`text-[10px] font-mono ${themeMode === 'dark' ? 'text-white/40' : 'text-[#87867F]'}`}>
                          Duration: {Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, '0')}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}

            {ingestTab === 'paste' && (
              <div className="flex-1 flex flex-col gap-2.5 min-h-0">
                <textarea
                  value={pastedLrcText}
                  onChange={e => setPastedLrcText(e.target.value)}
                  placeholder="Paste raw [mm:ss.xx] LRC or plain lyrics here..."
                  className={`flex-1 p-3 text-xs font-mono rounded-xl resize-none focus:outline-none focus:border-[#D97757] focus:ring-1 focus:ring-[#D97757] border transition-colors shadow-xs ${
                    themeMode === 'dark'
                      ? 'bg-[#1C1C20] border-white/10 text-white placeholder-white/30'
                      : 'bg-white border-[#E8E5DE] text-[#141413] placeholder-[#87867F]'
                  }`}
                />
                <button
                  onClick={handleApplyPastedLrc}
                  className="w-full py-2.5 text-xs font-sans font-medium rounded-xl bg-[#D97757] hover:bg-[#C66545] text-white transition-colors cursor-pointer shadow-xs"
                >
                  Parse & Load Lyrics
                </button>
              </div>
            )}

            {ingestTab === 'audio' && (
              <>
                {isAnalyzingAudio ? (
                  <div className={`flex-1 flex flex-col items-center justify-center p-6 border rounded-2xl text-center gap-3 transition-colors ${
                    themeMode === 'dark' ? 'border-white/10 bg-[#1C1C20] text-white' : 'border-[#E8E5DE] bg-white text-[#141413]'
                  }`}>
                    <RefreshCw className="w-8 h-8 text-[#D97757] animate-spin" />
                    <p className="text-xs font-sans font-medium">Analyzing Audio Telemetry...</p>
                    <p className={`text-[11px] font-mono ${themeMode === 'dark' ? 'text-white/60' : 'text-[#5E5D59]'}`}>
                      {audioAnalysisStatus || 'Computing sub-bass transients & onsets...'}
                    </p>
                    <div className="w-48 bg-black/10 dark:bg-white/10 h-1.5 rounded-full overflow-hidden mt-2">
                      <div className="bg-[#D97757] h-full w-2/3 animate-pulse rounded-full" />
                    </div>
                  </div>
                ) : audioAnalysis ? (
                  <div className={`flex-1 flex flex-col p-4 border rounded-2xl gap-3.5 transition-colors overflow-y-auto ${
                    themeMode === 'dark' ? 'border-white/10 bg-[#1C1C20] text-white' : 'border-[#E8E5DE] bg-white text-[#141413]'
                  }`}>
                    {/* Track Info Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-[#D97757]/15 flex items-center justify-center shrink-0 text-[#D97757]">
                          <Music className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-sans font-medium text-xs truncate" title={audioFileName || 'Audio Track'}>
                            {audioFileName || 'Local Audio Track'}
                          </div>
                          <div className={`text-[10px] font-mono ${themeMode === 'dark' ? 'text-white/50' : 'text-[#87867F]'}`}>
                            {(audioAnalysis.durationMs / 1000).toFixed(1)}s • {audioAnalysis.sampleRate} Hz
                          </div>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-[#D97757]/15 text-[#D97757] font-mono text-[10px] font-semibold shrink-0">
                        LOADED
                      </span>
                    </div>

                    {/* Metrics Badges */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className={`p-2.5 rounded-xl border flex flex-col gap-0.5 ${
                        themeMode === 'dark' ? 'border-white/10 bg-[#232228]' : 'border-[#E8E5DE] bg-[#FAF9F5]'
                      }`}>
                        <span className={`text-[9px] font-sans ${themeMode === 'dark' ? 'text-white/40' : 'text-[#87867F]'}`}>
                          DETECTED TEMPO
                        </span>
                        <span className="font-mono text-xs font-bold text-[#D97757] flex items-center gap-1">
                          <Zap className="w-3 h-3" />
                          {audioAnalysis.bpm} BPM
                        </span>
                      </div>

                      <div className={`p-2.5 rounded-xl border flex flex-col gap-0.5 ${
                        themeMode === 'dark' ? 'border-white/10 bg-[#232228]' : 'border-[#E8E5DE] bg-[#FAF9F5]'
                      }`}>
                        <span className={`text-[9px] font-sans ${themeMode === 'dark' ? 'text-white/40' : 'text-[#87867F]'}`}>
                          BEAT ONSETS
                        </span>
                        <span className="font-mono text-xs font-bold flex items-center gap-1">
                          <Activity className="w-3 h-3 text-[#D97757]" />
                          {audioAnalysis.beatsMs.length} Hits
                        </span>
                      </div>
                    </div>

                    {/* Snap Lyrics to Beats Action */}
                    <button
                      type="button"
                      onClick={handleSnapToNearestBeats}
                      className="w-full py-2.5 px-3 rounded-xl bg-[#D97757] hover:bg-[#C66545] text-white text-xs font-sans font-medium transition-all cursor-pointer shadow-xs flex items-center justify-center gap-2"
                    >
                      {snapFeedback ? <Check className="w-3.5 h-3.5" /> : <Activity className="w-3.5 h-3.5" />}
                      <span>{snapFeedback ? 'Lyrics Snapped to Beats!' : 'Snap Lyrics to Beats'}</span>
                    </button>

                    {snapFeedback && (
                      <div className="text-center text-[10px] font-sans text-emerald-500 font-medium flex items-center justify-center gap-1">
                        <Check className="w-3 h-3" />
                        <span>Timestamps magnetically locked to 808/kick hits</span>
                      </div>
                    )}

                    {/* Change/Re-upload Audio */}
                    <div className={`mt-auto pt-3 border-t border-dashed ${
                      themeMode === 'dark' ? 'border-white/10' : 'border-[#E8E5DE]'
                    }`}>
                      <label className={`w-full py-2 border rounded-xl text-center text-[11px] font-sans font-medium block transition-colors cursor-pointer ${
                        themeMode === 'dark'
                          ? 'border-white/10 hover:bg-white/5 text-white/70 hover:text-white'
                          : 'border-[#E8E5DE] hover:bg-[#FAF9F5] text-[#5E5D59] hover:text-[#141413]'
                      }`}>
                        <Upload className="w-3 h-3 inline-block mr-1.5" />
                        Replace Audio File
                        <input
                          type="file"
                          accept="audio/*"
                          onChange={handleAudioDrop}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <div
                    onDragOver={handleAudioDragOver}
                    onDragLeave={handleAudioDragLeave}
                    onDrop={handleAudioFileDrop}
                    className={`flex-1 flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-2xl text-center gap-3 transition-colors ${
                      isDraggingAudio
                        ? 'border-[#D97757] bg-[#D97757]/10'
                        : themeMode === 'dark'
                        ? 'border-white/15 bg-white/[0.02] text-white'
                        : 'border-[#E8E5DE] bg-white text-[#141413]'
                    }`}
                  >
                    <Upload className="w-8 h-8 text-[#D97757]" />
                    <p className="text-xs font-sans font-medium">Drop Local MP3 / WAV</p>
                    <p className={`text-[11px] font-sans ${themeMode === 'dark' ? 'text-white/50' : 'text-[#5E5D59]'}`}>
                      Enables 0-latency audio scrubbing, live beat sync and waveform preview
                    </p>
                    {audioAnalysisError && (
                      <div className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-[11px] font-sans text-center max-w-xs">
                        {audioAnalysisError}
                      </div>
                    )}
                    <label className="mt-1 px-3 py-1.5 rounded-lg bg-[#D97757] hover:bg-[#C66545] text-white text-xs font-sans font-medium cursor-pointer transition-colors shadow-xs">
                      Choose Audio File
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={handleAudioDrop}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* ============================================================== */}
        {/* COLUMN 2: APPLE MUSIC FLUID GLASS LYRIC SELECTOR             */}
        {/* ============================================================== */}
        <section className={`flex-1 flex flex-col relative min-h-0 overflow-hidden transition-colors duration-200 ${
          themeMode === 'dark' ? 'bg-[#141413]' : 'bg-[#FAF9F5]'
        }`}>
          {/* Editorial Lyrics Header Bar */}
          <div className={`h-12 px-6 border-b flex justify-between items-center z-10 shrink-0 transition-colors duration-200 ${
            themeMode === 'dark' ? 'border-[#2C2B29] bg-[#18181A]' : 'border-[#E8E5DE] bg-white'
          }`}>
            <div className="flex items-center gap-3">
              <span className="text-[12px] font-sans font-semibold tracking-wide text-[#D97757] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#D97757]" />
                <span className={themeMode === 'dark' ? 'text-white' : 'text-[#141413]'}>2. Lyrics Timeline</span>
              </span>
              <span className={`text-[10px] font-sans hidden sm:inline ${themeMode === 'dark' ? 'text-white/40' : 'text-[#777]'}`}>
                Click line to seek • Click word to customize
              </span>
            </div>

            {/* Quick Selection Shortcuts */}
            <div className="flex items-center gap-1.5 font-sans text-xs">
              <button
                onClick={handleSelectAll}
                className={`px-2.5 py-1 font-medium border rounded-lg transition-colors cursor-pointer shadow-xs ${
                  themeMode === 'dark'
                    ? 'bg-[#232220] hover:bg-white text-white/80 hover:text-black border-white/10'
                    : 'bg-white hover:bg-[#FAF9F5] text-[#5E5D59] hover:text-[#141413] border-[#E8E5DE]'
                }`}
                title="Select all lyrics in song"
              >
                Select All
              </button>
              <button
                onClick={() => handleExpandRange(1)}
                className={`px-2 py-1 font-medium border rounded-lg transition-colors cursor-pointer shadow-xs ${
                  themeMode === 'dark'
                    ? 'bg-[#232220] hover:bg-white text-white/80 hover:text-black border-white/10'
                    : 'bg-white hover:bg-[#FAF9F5] text-[#5E5D59] hover:text-[#141413] border-[#E8E5DE]'
                }`}
                title="Expand selection by 1 line"
              >
                +1
              </button>
              <button
                onClick={() => handleExpandRange(-1)}
                className={`px-2 py-1 font-medium border rounded-lg transition-colors cursor-pointer shadow-xs ${
                  themeMode === 'dark'
                    ? 'bg-[#232220] hover:bg-white text-white/80 hover:text-black border-white/10'
                    : 'bg-white hover:bg-[#FAF9F5] text-[#5E5D59] hover:text-[#141413] border-[#E8E5DE]'
                }`}
                title="Shrink selection by 1 line"
              >
                -1
              </button>
              <div className={`h-3 w-px ${themeMode === 'dark' ? 'bg-white/10' : 'bg-[#E8E5DE]'}`} />
              <button
                type="button"
                onClick={() => setShowTokenBadges(prev => !prev)}
                className={`px-2.5 py-1 font-medium border rounded-lg transition-all cursor-pointer shadow-xs flex items-center gap-1.5 ${
                  showTokenBadges
                    ? 'bg-[#D97757] text-white border-[#D97757]'
                    : themeMode === 'dark'
                    ? 'bg-[#232220] hover:bg-white/10 text-white/70 border-white/10'
                    : 'bg-white hover:bg-[#FAF9F5] text-[#5E5D59] border-[#E8E5DE]'
                }`}
                title="Toggle dense word token inspection"
              >
                <Layers className="w-3 h-3" />
                <span>Tokens</span>
              </button>
            </div>
          </div>

          {/* Minimalist Apple Music Lyric List with Skiper #41 Progressive Blur Optical Mask Fade */}
          <div className="flex-1 relative min-h-0 flex flex-col overflow-hidden">
            {/* Top Optical Mask Fade Gradient Overlay */}
            <div className={`absolute top-0 left-0 right-0 h-10 pointer-events-none z-20 bg-gradient-to-b ${
              themeMode === 'dark' ? 'from-[#141413] via-[#141413]/70 to-transparent' : 'from-[#FAF9F5] via-[#FAF9F5]/70 to-transparent'
            }`} />

            <div
              ref={lyricsContainerRef}
              onScroll={handleUserScroll}
              className="flex-1 overflow-y-auto px-6 py-10 md:px-16 md:py-16 flex flex-col items-center gap-4 relative z-10 min-h-0 scroll-smooth"
              style={{
                maskImage: 'linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, 0.4) 3%, rgba(0, 0, 0, 0.95) 7%, black 12%, black 88%, rgba(0, 0, 0, 0.95) 93%, rgba(0, 0, 0, 0.4) 97%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, 0.4) 3%, rgba(0, 0, 0, 0.95) 7%, black 12%, black 88%, rgba(0, 0, 0, 0.95) 93%, rgba(0, 0, 0, 0.4) 97%, transparent 100%)'
              }}
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
                    className={`w-full relative transition-all rounded-xl ${
                      themeMode === 'dark'
                        ? 'border border-white/15 shadow-xl bg-white/[0.04] ring-1 ring-[#D97757]/30'
                        : 'border border-[#E8E5DE] shadow-md bg-white/95 ring-1 ring-[#D97757]/30'
                    }`}
                  >
                    <div
                      onClick={(e) => handleLineClick(idx, e)}
                      className={`p-4 md:p-5 cursor-pointer relative group transition-all ${
                        isActiveLine
                          ? themeMode === 'dark' ? 'bg-white/[0.04]' : 'bg-[#D97757]/10'
                          : ''
                      }`}
                    >
                      {/* Selection Pin Badges */}
                      {isStartPin && (
                        <span className="absolute -top-2.5 left-4 bg-[#D97757] text-white text-[8px] font-bold px-2 py-0.5 shadow-sm z-20 font-mono tracking-wider">
                          START • {(line.startMs / 1000).toFixed(2)}s
                        </span>
                      )}
                      {isEndPin && (
                        <span className="absolute -bottom-2.5 right-4 bg-[#D97757] text-white text-[8px] font-bold px-2 py-0.5 shadow-sm z-20 font-mono tracking-wider">
                          END • {(line.endMs / 1000).toFixed(2)}s
                        </span>
                      )}

                      {/* Header Timestamp */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] text-[#D97757] font-mono font-semibold tracking-wider">
                          {Math.floor(line.startMs / 60000)}:{((line.startMs % 60000) / 1000).toFixed(2).padStart(5, '0')}
                        </span>
                        {isActiveLine && (
                          <span className="text-[8px] font-bold text-white bg-[#D97757] px-2 py-0.5 uppercase font-mono tracking-wider">
                            PLAYING
                          </span>
                        )}
                      </div>

                      {/* Clean Apple Music Typography - Words are directly interactive */}
                      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1.5">
                        {line.words && line.words.length > 0 ? (
                          line.words.map((w, wIdx) => {
                            const isWordActive = isActiveLine && playheadMs >= w.startMs && playheadMs < w.endMs;
                            const isWordPast = isActiveLine ? playheadMs >= w.endMs : idx < activeLineIndex;

                            const precedingWord = wIdx > 0 ? line.words[wIdx - 1] : undefined;
                            const wordArch = getWordEffectiveArchetype(w, wIdx, archetype, wordOverrides, precedingWord);
                            const packConfig = STYLE_PACKS[stylePack] || STYLE_PACKS.trap_drill;
                            const wordFont = getWordEffectiveFont(w, wordArch, packConfig, wordFontOverrides, fontFamily);
                            const specificKey = `${w.word}_${w.startMs}`;
                            const cleanKey = w.word.toLowerCase().replace(/[^a-z0-9]/g, '');
                            const wordMotif = wordMotifOverrides[specificKey] || wordMotifOverrides[cleanKey] || 'none';
                            const isOverridden = !!(
                              wordOverrides[specificKey] || wordOverrides[cleanKey] ||
                              wordFontOverrides[specificKey] || wordFontOverrides[cleanKey] ||
                              (wordMotifOverrides[specificKey] && wordMotifOverrides[specificKey] !== 'none') ||
                              (wordMotifOverrides[cleanKey] && wordMotifOverrides[cleanKey] !== 'none')
                            );

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
                                    currentArchetype: wordArch,
                                    currentFont: wordFont,
                                    currentMotif: wordMotif
                                  });
                                }}
                                className={`text-xl md:text-2xl font-bold tracking-tight transition-all duration-150 inline-flex flex-col items-center cursor-pointer rounded px-1.5 py-0.5 -mx-1 group/word ${
                                  themeMode === 'dark'
                                    ? isWordActive
                                      ? 'text-white font-black underline decoration-[#D97757] decoration-2'
                                      : isWordPast
                                      ? 'text-white/90 hover:text-[#D97757]'
                                      : 'text-white/40 hover:text-white/80'
                                    : isWordActive
                                    ? 'text-[#1A1A1A] font-black underline decoration-[#D97757] decoration-3'
                                    : isWordPast
                                    ? 'text-[#1A1A1A] font-bold hover:text-[#D97757]'
                                    : 'text-[#888] hover:text-[#1A1A1A]'
                                }`}
                                title={`Click to customize style for "${w.word}"`}
                              >
                                <span>{w.word}</span>
                                {isOverridden && (
                                  <span className="w-1 h-1 rounded-full bg-[#D97757] -mt-0.5" title="Custom override active" />
                                )}
                              </button>
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

                      {/* Optional Dense Token Inspection Strip (Toggled via header button) */}
                      {showTokenBadges && line.words && line.words.length > 0 && (
                        <div className={`mt-3 pt-2.5 border-t flex flex-wrap gap-1.5 items-center ${
                          themeMode === 'dark' ? 'border-white/10' : 'border-[#1A1A1A]/10'
                        }`}>
                          <span className={`text-[8px] font-mono tracking-wider mr-1 ${
                            themeMode === 'dark' ? 'text-white/40' : 'text-[#87867F]'
                          }`}>
                            TOKENS:
                          </span>
                          {line.words.map((w, wIdx) => {
                            const precedingWord = wIdx > 0 ? line.words[wIdx - 1] : undefined;
                            const wordArch = getWordEffectiveArchetype(w, wIdx, archetype, wordOverrides, precedingWord);
                            const packConfig = STYLE_PACKS[stylePack] || STYLE_PACKS.trap_drill;
                            const wordFont = getWordEffectiveFont(w, wordArch, packConfig, wordFontOverrides, fontFamily);
                            const meta = ARCHETYPE_METADATA[wordArch] || ARCHETYPE_METADATA.smooth_fluid;
                            const specificKey = `${w.word}_${w.startMs}`;
                            const cleanKey = w.word.toLowerCase().replace(/[^a-z0-9]/g, '');
                            const wordMotif = wordMotifOverrides[specificKey] || wordMotifOverrides[cleanKey] || 'none';
                            const motifMeta = MOTIF_METADATA[wordMotif];
                            const isOverridden = !!(
                              wordOverrides[specificKey] || wordOverrides[cleanKey] ||
                              wordFontOverrides[specificKey] || wordFontOverrides[cleanKey] ||
                              (wordMotifOverrides[specificKey] && wordMotifOverrides[specificKey] !== 'none') ||
                              (wordMotifOverrides[cleanKey] && wordMotifOverrides[cleanKey] !== 'none')
                            );

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
                                    currentArchetype: wordArch,
                                    currentFont: wordFont,
                                    currentMotif: wordMotif
                                  });
                                }}
                                className={`px-2 py-0.5 text-[10px] font-sans rounded-md flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                                  isOverridden
                                    ? 'bg-[#D97757] text-white font-medium'
                                    : themeMode === 'dark'
                                    ? 'bg-white/5 hover:bg-white/10 text-white/80 border border-white/10'
                                    : 'bg-[#FAF9F5] hover:bg-[#F0EEE6] text-[#5E5D59] border border-[#E8E5DE]'
                                }`}
                                title={`Customize style for "${w.word}"`}
                              >
                                <span className="font-medium">{w.word}</span>
                                <span className="opacity-40 font-mono text-[9px]">•</span>
                                <span className="opacity-70 text-[9px] font-mono">{meta.name}</span>
                                {wordMotif !== 'none' && motifMeta && (
                                  <span className="text-[9px] text-[#D97757] font-mono">({motifMeta.name})</span>
                                )}
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

            {/* Bottom Optical Mask Fade Gradient Overlay */}
            <div className={`absolute bottom-0 left-0 right-0 h-10 pointer-events-none z-20 bg-gradient-to-t ${
              themeMode === 'dark' ? 'from-[#141413] via-[#141413]/70 to-transparent' : 'from-[#FAF9F5] via-[#FAF9F5]/70 to-transparent'
            }`} />
          </div>

          {/* Hidden Audio Player for drop sync */}
          {localAudioUrl && (
            <audio
              ref={audioRef}
              src={localAudioUrl}
              onEnded={() => {
                if (audioRef.current) {
                  audioRef.current.currentTime = rangeStartMs / 1000;
                  audioRef.current.play().catch(() => {});
                }
              }}
            />
          )}

          {/* Floating Dynamic Audio Transport Capsule (Skiper UI #02 Dynamic Island + #03 Apple Play Button) */}
          <div className="p-3.5 z-20 shrink-0 flex justify-center w-full relative">
            <motion.div
              layout
              transition={{ type: "spring", bounce: 0.16, duration: 0.4 }}
              className={`w-full ${localAudioUrl ? 'max-w-4xl' : 'max-w-2xl'} px-4 py-2.5 rounded-2xl border flex items-center justify-between gap-4 shadow-xl backdrop-blur-md transition-colors duration-200 ${
                themeMode === 'dark'
                  ? 'bg-[#18181A]/95 border-[#2C2B29] text-white shadow-black/40'
                  : 'bg-white/95 border-[#E8E5DE] text-[#141413] shadow-stone-200/50'
              }`}
            >
              <div className="flex items-center gap-3 shrink-0">
                {/* Tactile Circular Play/Pause Button (Skiper #03 Apple Play Button) */}
                <motion.button
                  type="button"
                  onClick={togglePlay}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  className="w-9 h-9 rounded-full bg-[#D97757] hover:bg-[#C66545] text-white flex items-center justify-center cursor-pointer shadow-md ring-2 ring-[#D97757]/30 transition-all shrink-0"
                  title={isPlaying ? 'Pause Preview' : 'Play Preview'}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {isPlaying ? (
                      <motion.span
                        key="pause"
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.6, opacity: 0 }}
                        transition={{ duration: 0.12 }}
                        className="flex items-center justify-center"
                      >
                        <Pause className="w-4 h-4 fill-current" />
                      </motion.span>
                    ) : (
                      <motion.span
                        key="play"
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.6, opacity: 0 }}
                        transition={{ duration: 0.12 }}
                        className="flex items-center justify-center ml-0.5"
                      >
                        <Play className="w-4 h-4 fill-current" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>

                {/* Rolling Timecode Display */}
                <div className={`text-[11px] font-mono shrink-0 flex items-center gap-1 ${
                  themeMode === 'dark' ? 'text-white/80' : 'text-[#5E5D59]'
                }`}>
                  <NumberFlow value={(playheadMs / 1000).toFixed(2) + 's'} />
                  <span className="opacity-40">/</span>
                  <NumberFlow value={(rangeEndMs / 1000).toFixed(2) + 's'} />
                </div>

                {/* Live Beat Pulse Badge (Skiper #02 Dynamic Island) */}
                {audioAnalysis && (
                  <motion.div
                    layout
                    animate={isLiveBeat ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                    transition={{ duration: 0.12 }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold transition-all select-none shrink-0 ${
                      isLiveBeat
                        ? 'bg-[#D97757] text-white shadow-[0_0_12px_rgba(217,119,87,0.7)]'
                        : themeMode === 'dark'
                        ? 'bg-[#232220] text-[#D97757] border border-[#D97757]/30'
                        : 'bg-[#FAF0EB] text-[#D97757] border border-[#D97757]/30'
                    }`}
                    title={`Detected Tempo: ${audioAnalysis.bpm} BPM (Flashing on drum hits)`}
                  >
                    <Zap className={`w-3.5 h-3.5 transition-transform ${isLiveBeat ? 'scale-125 fill-current' : ''}`} />
                    <span>⚡ {audioAnalysis.bpm} BPM</span>
                  </motion.div>
                )}
              </div>

              {/* Interactive Downsampled Mini-Waveform Scrubber */}
              <motion.div layout transition={{ type: "spring", bounce: 0.16 }} className="flex-1 flex items-center max-w-xl mx-2 relative h-9">
                <canvas
                  ref={waveformCanvasRef}
                  className="w-full h-8 rounded-lg pointer-events-none"
                />
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
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  title="Scrub timeline"
                />
              </motion.div>

              {/* Controls and Selection Info */}
              <div className={`flex items-center gap-3 text-xs font-sans shrink-0 ${
                themeMode === 'dark' ? 'text-white/70' : 'text-[#5E5D59]'
              }`}>
                {/* Snap Beats Button */}
                {audioAnalysis && (
                  <button
                    type="button"
                    onClick={handleSnapToNearestBeats}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-sans font-medium border transition-all cursor-pointer shadow-xs ${
                      snapFeedback
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : themeMode === 'dark'
                        ? 'bg-[#232220] hover:bg-[#2c2b28] border-white/10 text-white/90 hover:text-white'
                        : 'bg-white hover:bg-[#FAF9F5] border-[#E8E5DE] text-[#141413]'
                    }`}
                    title="Magnetically snap lyric and word timestamps to nearest detected beats"
                  >
                    {snapFeedback ? <Check className="w-3.5 h-3.5" /> : <Activity className="w-3.5 h-3.5 text-[#D97757]" />}
                    <span>{snapFeedback ? 'Snapped!' : 'Snap Beats'}</span>
                  </button>
                )}

                {Object.keys(wordOverrides).length > 0 && (
                  <div className="flex items-center gap-1.5 bg-[#D97757]/10 border border-[#D97757]/30 px-2.5 py-0.5 rounded-full text-[10px] text-[#D97757] font-medium">
                    <span>{Object.keys(wordOverrides).length} overrides</span>
                    <button
                      onClick={() => setWordOverrides({})}
                      className="hover:underline cursor-pointer ml-1 opacity-80 hover:opacity-100"
                    >
                      Reset
                    </button>
                  </div>
                )}
                <span className="text-[#D97757] font-medium font-mono text-[11px]">
                  {selectedLines.length} lines
                </span>
                <span>•</span>
                <span className="font-mono text-[11px]">{rangeDurationSec.toFixed(1)}s</span>
              </div>
            </motion.div>
          </div>
        </section>


        {/* ============================================================== */}
        {/* COLUMN 3: MOTION & OLED PREVIEW                               */}
        {/* ============================================================== */}
        <section className={`w-[360px] flex flex-col shrink-0 min-h-0 transition-colors duration-200 ${
          themeMode === 'dark' ? 'bg-[#18181A] text-white' : 'bg-white text-[#141413]'
        }`}>
          <div className={`p-3 border-b shrink-0 ${
            themeMode === 'dark' ? 'border-[#2C2B29] bg-[#1E1E20]' : 'border-[#E8E5DE] bg-[#F5F2EB]'
          }`}>
            <h2 className={`text-[11px] font-sans font-semibold tracking-wide flex items-center gap-2 ${
              themeMode === 'dark' ? 'text-white/80' : 'text-[#141413]'
            }`}>
              <span className="w-1.5 h-1.5 rounded-full bg-[#D97757]" />
              <span>3. Motion & Display</span>
            </h2>
          </div>

          {/* Fixed Live OLED Display Preview with Technical HUD Knockout Brackets */}
          <div className={`p-3.5 border-b flex flex-col items-center shrink-0 ${
            themeMode === 'dark' ? 'bg-[#141418] border-[#2C2B29]' : 'bg-[#FAF9F5] border-[#E8E5DE]'
          }`}>
            <div className="flex justify-between items-center w-full px-1 mb-2 text-[10px] font-mono">
              <span className="opacity-60 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>128×64 SSD1306</span>
              </span>
              <span className="text-[#D97757] font-semibold tracking-wider">30 FPS LIVE</span>
            </div>

            {/* OLED Monitor with Skiper #107 Knockout Corner L-Brackets */}
            <div className="relative p-2 flex items-center justify-center">
              {/* Corner L-Brackets */}
              <div className={`absolute top-0 left-0 w-3.5 h-3.5 border-t-2 border-l-2 transition-all duration-150 pointer-events-none ${
                isLiveBeat ? 'border-[#D97757] scale-110 shadow-[0_0_8px_rgba(217,119,87,0.9)]' : 'border-[#D97757]/70'
              }`} />
              <div className={`absolute top-0 right-0 w-3.5 h-3.5 border-t-2 border-r-2 transition-all duration-150 pointer-events-none ${
                isLiveBeat ? 'border-[#D97757] scale-110 shadow-[0_0_8px_rgba(217,119,87,0.9)]' : 'border-[#D97757]/70'
              }`} />
              <div className={`absolute bottom-0 left-0 w-3.5 h-3.5 border-b-2 border-l-2 transition-all duration-150 pointer-events-none ${
                isLiveBeat ? 'border-[#D97757] scale-110 shadow-[0_0_8px_rgba(217,119,87,0.9)]' : 'border-[#D97757]/70'
              }`} />
              <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 border-b-2 border-r-2 transition-all duration-150 pointer-events-none ${
                isLiveBeat ? 'border-[#D97757] scale-110 shadow-[0_0_8px_rgba(217,119,87,0.9)]' : 'border-[#D97757]/70'
              }`} />

              {/* Hardware Display Box */}
              <div className="bg-black p-1 rounded-md shadow-inner flex items-center justify-center border border-white/10 ring-1 ring-black/80">
                <OledCanvas frameData={previewFrame} theme="cyan" scale={8} />
              </div>
            </div>

            {/* Hardware Telemetry Rolling Counters */}
            <div className="flex justify-between items-center w-full px-1 mt-2 text-[10px] font-mono">
              <NumberFlow
                value={frameCounterStr}
                className="text-[#D97757] font-semibold"
              />
              <NumberFlow
                value={playbackClockStr}
                className={themeMode === 'dark' ? 'text-white/70' : 'text-[#5E5D59]'}
              />
            </div>
          </div>

          {/* Director Mode Segmented Tabs with Sliding Pill Physics */}
          <div className={`p-2.5 border-b shrink-0 ${
            themeMode === 'dark' ? 'border-[#2C2B29] bg-[#18181A]' : 'border-[#E8E5DE] bg-white'
          }`}>
            <div className={`flex p-1 rounded-xl border gap-1 relative ${
              themeMode === 'dark' ? 'bg-[#141418] border-white/10' : 'bg-[#FAF9F5] border-[#E8E5DE]'
            }`}>
              {[
                { id: 'auto' as const, label: 'Smart Director', Icon: Sparkles },
                { id: 'manual' as const, label: 'Manual Lock', Icon: Sliders }
              ].map(tab => {
                const isActive = directorModeTab === tab.id;
                const TabIcon = tab.Icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setDirectorModeTab(tab.id);
                      if (tab.id === 'auto') {
                        setArchetype('auto_semantic');
                      } else if (archetype === 'auto_semantic') {
                        setArchetype('blade_slash');
                      }
                    }}
                    className={`relative flex-1 py-1.5 text-xs font-sans rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 z-10 ${
                      isActive
                        ? 'text-white font-semibold'
                        : themeMode === 'dark' ? 'text-white/50 hover:text-white' : 'text-[#5E5D59] hover:text-[#141413]'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="director-tab-pill"
                        className="absolute inset-0 bg-[#D97757] rounded-lg shadow-xs -z-10"
                        transition={{ type: 'spring', bounce: 0.16, duration: 0.35 }}
                      />
                    )}
                    <TabIcon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scrollable Middle Controls */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 min-h-0">
            {directorModeTab === 'auto' ? (
              <>
                {/* Thematic 4-Font Style Pack Selector */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className={`text-[11px] font-sans font-medium block ${
                      themeMode === 'dark' ? 'text-white/70' : 'text-[#5E5D59]'
                    }`}>
                      Thematic Style Pack
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-2.5">
                    {(['trap_drill', 'shonen_comic', 'cartoon_bounce', 'cyber_industrial'] as StylePackId[]).map(packId => {
                      const pack = STYLE_PACKS[packId];
                      const isSelected = stylePack === packId;
                      return (
                        <button
                          key={packId}
                          type="button"
                          onClick={() => {
                            setStylePack(packId);
                            setFontFamily(pack.fonts.hero);
                          }}
                          className={`p-2.5 border rounded-xl text-left transition-all cursor-pointer flex flex-col justify-between ${
                            isSelected
                              ? themeMode === 'dark'
                                ? 'border-[#D97757] bg-[#D97757]/15 ring-1 ring-[#D97757]/40 shadow-xs'
                                : 'border-[#D97757] bg-[#FAF0EB] ring-1 ring-[#D97757]/30 shadow-xs'
                              : themeMode === 'dark'
                              ? 'border-white/10 hover:border-white/20 bg-[#1C1C20]'
                              : 'border-[#E8E5DE] hover:border-[#D5D0C5] bg-white shadow-xs'
                          }`}
                        >
                          <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded self-start ${
                            themeMode === 'dark' ? 'bg-white/10 text-white/80' : 'bg-[#FAF9F5] text-[#5E5D59] border border-[#E8E5DE]'
                          }`}>
                            {pack.tag}
                          </span>
                          <span className={`text-xs font-sans font-medium mt-2 truncate ${
                            themeMode === 'dark' ? 'text-white' : 'text-[#141413]'
                          }`}>
                            {pack.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Monochromatic Font Hierarchy Matrix (No rainbow tags!) */}
                  {stylePack && STYLE_PACKS[stylePack] && (
                    <div className={`p-3 rounded-xl border text-[11px] font-sans space-y-1.5 ${
                      themeMode === 'dark' ? 'bg-[#16161A] border-white/10 text-white/80' : 'bg-[#FAF9F5] border-[#E8E5DE] text-[#444]'
                    }`}>
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-[#D97757] flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#D97757]" />
                          Hero
                        </span>
                        <span className="font-mono text-[10px] text-right">{STYLE_PACKS[stylePack].fonts.hero.split(',')[0].replace(/'/g, '')}</span>
                      </div>
                      <div className="flex justify-between items-center opacity-85">
                        <span className="font-medium flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40" />
                          Action
                        </span>
                        <span className="font-mono text-[10px] text-right">{STYLE_PACKS[stylePack].fonts.action.split(',')[0].replace(/'/g, '')}</span>
                      </div>
                      <div className="flex justify-between items-center opacity-85">
                        <span className="font-medium flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40" />
                          Novelty
                        </span>
                        <span className="font-mono text-[10px] text-right">{STYLE_PACKS[stylePack].fonts.novelty.split(',')[0].replace(/'/g, '')}</span>
                      </div>
                      <div className="flex justify-between items-center opacity-70">
                        <span className="font-medium flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-30" />
                          Anchor
                        </span>
                        <span className="font-mono text-[10px] text-right">{STYLE_PACKS[stylePack].fonts.anchor.split(',')[0].replace(/['"]/g, '')}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Visual Motifs & Manga Layering */}
                <div>
                  <label className={`text-[11px] font-sans font-medium block mb-2 ${
                    themeMode === 'dark' ? 'text-white/70' : 'text-[#5E5D59]'
                  }`}>
                    Visual Motifs & Manga Layering
                  </label>
                  <div className="grid grid-cols-4 gap-1.5 mb-2">
                    {[
                      { id: 'off' as MotifMode, label: 'Off', desc: 'Clean typography only. Zero background visuals.' },
                      { id: 'subtle' as MotifMode, label: 'Subtle', desc: 'Minimal speedline flares on beat transients.' },
                      { id: 'dynamic' as MotifMode, label: 'Dynamic', desc: 'AI-directed motif assignment per lyric meaning.' },
                      { id: 'heavy' as MotifMode, label: 'Heavy', desc: 'Full manga layering with Bayer halftones.' },
                    ].map(mode => {
                      const isSelected = motifMode === mode.id;
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => setMotifMode(mode.id)}
                          className={`py-1.5 px-2 border rounded-xl text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
                            isSelected
                              ? themeMode === 'dark'
                                ? 'border-[#D97757] bg-[#D97757]/15 ring-1 ring-[#D97757]/40 shadow-xs'
                                : 'border-[#D97757] bg-[#FAF0EB] ring-1 ring-[#D97757]/30 shadow-xs'
                              : themeMode === 'dark'
                              ? 'border-white/10 hover:border-white/20 bg-[#1C1C20]'
                              : 'border-[#E8E5DE] hover:border-[#D5D0C5] bg-white shadow-xs'
                          }`}
                          title={mode.desc}
                        >
                          <span className={`text-[11px] font-sans font-medium ${
                            themeMode === 'dark' ? 'text-white' : 'text-[#141413]'
                          }`}>
                            {mode.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <p className={`text-[10px] font-sans leading-tight ${
                    themeMode === 'dark' ? 'text-white/40' : 'text-[#87867F]'
                  }`}>
                    {motifMode === 'off' && 'Clean typography only. Zero background visuals.'}
                    {motifMode === 'subtle' && 'Minimal speedline flares on beat transients.'}
                    {motifMode === 'dynamic' && 'Semantic motif assignment (crowns, scopes, flames & stars).'}
                    {motifMode === 'heavy' && 'Full manga layering with Bayer halftones and speedlines.'}
                  </p>
                </div>

                {/* Semantic Director Engine (Heuristic vs LLM) */}
                <div className={`p-3 border rounded-xl flex flex-col gap-2.5 ${
                  themeMode === 'dark' ? 'bg-[#16161A] border-white/10' : 'bg-[#FAF9F5] border-[#E8E5DE]'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] font-sans font-medium ${themeMode === 'dark' ? 'text-white/70' : 'text-[#5E5D59]'}`}>
                      Director Engine
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setInferenceMode('heuristic')}
                        className={`px-2.5 py-1 text-[10px] font-sans font-medium rounded-lg border transition-colors cursor-pointer shadow-xs ${
                          inferenceMode === 'heuristic'
                            ? 'bg-[#141413] text-white border-[#141413]'
                            : themeMode === 'dark' ? 'border-white/10 text-white/60 hover:text-white bg-[#232220]' : 'border-[#E8E5DE] text-[#5E5D59] bg-white'
                        }`}
                      >
                        Fast Heuristic
                      </button>
                      <button
                        type="button"
                        onClick={() => setInferenceMode('ollama')}
                        className={`px-2.5 py-1 text-[10px] font-sans font-medium rounded-lg border transition-colors cursor-pointer flex items-center gap-1 shadow-xs ${
                          inferenceMode === 'ollama'
                            ? 'bg-[#D97757] text-white border-[#D97757]'
                            : themeMode === 'dark' ? 'border-white/10 text-white/60 hover:text-white bg-[#232220]' : 'border-[#E8E5DE] text-[#5E5D59] bg-white'
                        }`}
                      >
                        <Bot className="w-3 h-3" />
                        <span>AI LLM</span>
                      </button>
                    </div>
                  </div>

                  {inferenceMode === 'ollama' && (
                    <div className="flex flex-col gap-2 pt-2 border-t border-current/10">
                      {/* Provider Switcher */}
                      <div className={`flex items-center p-0.5 rounded-lg border text-[10px] font-sans font-medium ${
                        themeMode === 'dark' ? 'bg-[#18181B] border-white/10' : 'bg-white border-[#E8E5DE]'
                      }`}>
                        <button
                          type="button"
                          onClick={() => setLlmProvider('groq')}
                          className={`flex-1 py-1 rounded-md transition-all cursor-pointer flex items-center justify-center gap-1 ${
                            llmProvider === 'groq'
                              ? 'bg-[#D97757] text-white shadow-xs font-semibold'
                              : 'text-[#87867F] hover:text-[#141413] dark:hover:text-white'
                          }`}
                        >
                          <Zap className="w-3 h-3" />
                          <span>Groq Cloud (120B)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setLlmProvider('ollama')}
                          className={`flex-1 py-1 rounded-md transition-all cursor-pointer flex items-center justify-center gap-1 ${
                            llmProvider === 'ollama'
                              ? 'bg-[#D97757] text-white shadow-xs font-semibold'
                              : 'text-[#87867F] hover:text-[#141413] dark:hover:text-white'
                          }`}
                        >
                          <Cpu className="w-3 h-3" />
                          <span>Local Ollama</span>
                        </button>
                      </div>

                      {llmProvider === 'groq' ? (
                        <button
                          type="button"
                          onClick={handleRunOllamaAnalysis}
                          disabled={isAnalyzingOllama}
                          className={`w-full py-2 px-3 text-xs font-sans font-medium rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs ${
                            isAnalyzingOllama
                              ? 'bg-[#D97757]/40 text-white cursor-wait'
                              : 'bg-[#D97757] text-white hover:bg-[#C66545]'
                          }`}
                        >
                          {isAnalyzingOllama ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>{ollamaProgress?.message || 'Analyzing...'}</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>Analyze with Groq 120B Cloud</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <>
                          <div className="flex items-center justify-between text-[10px]">
                            <span className={themeMode === 'dark' ? 'text-white/50' : 'text-[#87867F]'}>GPU Status:</span>
                            <span className="font-medium flex items-center gap-1.5">
                              <span className={`w-1.5 h-1.5 rounded-full ${ollamaStatus?.online ? 'bg-[#D97757]' : 'bg-zinc-400'}`} />
                              {ollamaStatus?.online ? 'Connected' : 'Offline'}
                            </span>
                          </div>
                          {ollamaStatus?.online && (
                            <select
                              value={selectedOllamaModel}
                              onChange={(e) => setSelectedOllamaModel(e.target.value)}
                              className={`text-xs font-sans p-1.5 rounded-lg border outline-none shadow-xs ${
                                themeMode === 'dark' ? 'bg-[#232220] text-white border-white/10' : 'bg-white text-[#141413] border-[#E8E5DE]'
                              }`}
                            >
                              {(ollamaStatus.models.length > 0 ? ollamaStatus.models : RECOMMENDED_OLLAMA_MODELS).map(m => (
                                <option key={m} value={m}>{m}</option>
                              ))}
                            </select>
                          )}
                          <button
                            type="button"
                            onClick={handleRunOllamaAnalysis}
                            disabled={isAnalyzingOllama || !ollamaStatus?.online}
                            className={`w-full py-2 px-3 text-xs font-sans font-medium rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs ${
                              isAnalyzingOllama
                                ? 'bg-[#D97757]/40 text-white cursor-wait'
                                : ollamaStatus?.online
                                ? 'bg-[#D97757] text-white hover:bg-[#C66545]'
                                : 'bg-black/10 dark:bg-white/10 text-[#87867F] cursor-not-allowed'
                            }`}
                          >
                            {isAnalyzingOllama ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                <span>{ollamaProgress?.message || 'Analyzing...'}</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>Analyze with {selectedOllamaModel}</span>
                              </>
                            )}
                          </button>
                        </>
                      )}

                      {ollamaProgress && (
                        <div className="w-full bg-black/10 dark:bg-white/10 h-1 rounded-full overflow-hidden">
                          <div
                            className="bg-[#D97757] h-full transition-all duration-300 rounded-full"
                            style={{ width: `${ollamaProgress.percent}%` }}
                          />
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setShowOllamaInspector(true)}
                        className={`w-full py-1.5 px-2.5 text-[11px] font-sans font-medium rounded-xl border transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs ${
                          themeMode === 'dark' 
                            ? 'border-white/10 hover:bg-white/5 text-white/80' 
                            : 'border-[#E8E5DE] hover:bg-[#F2EFE9] text-[#5E5D59]'
                        }`}
                      >
                        <Terminal className="w-3.5 h-3.5 text-[#D97757]" />
                        <span>Inspect Prompts {ollamaInspectionLogs.length > 0 ? `(${ollamaInspectionLogs.length})` : ''}</span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Manual Motion Archetypes Grid */}
                <div>
                  <label className={`text-[11px] font-sans font-medium block mb-2 ${
                    themeMode === 'dark' ? 'text-white/70' : 'text-[#5E5D59]'
                  }`}>
                    Uniform Motion Style
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {MANUAL_ARCHETYPES.map(archKey => {
                      const meta = ARCHETYPE_METADATA[archKey];
                      return (
                        <button
                          key={archKey}
                          onClick={() => setArchetype(archKey)}
                          className={`p-2.5 border text-left transition-all cursor-pointer flex flex-col justify-between rounded-xl ${
                            archetype === archKey
                              ? themeMode === 'dark'
                                ? 'border-[#D97757] bg-[#D97757]/15 ring-1 ring-[#D97757]/40 shadow-xs'
                                : 'border-[#D97757] bg-[#FAF0EB] ring-1 ring-[#D97757]/30 shadow-xs'
                              : themeMode === 'dark'
                              ? 'border-white/10 hover:border-white/25 bg-[#1C1C20]'
                              : 'border-[#E8E5DE] hover:border-[#D5D0C5] bg-white shadow-xs'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <span className="text-base">{meta.icon}</span>
                            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                              themeMode === 'dark' ? 'bg-white/10 text-white/80' : 'bg-[#FAF9F5] text-[#5E5D59] border border-[#E8E5DE]'
                            }`}>
                              {meta.tag}
                            </span>
                          </div>
                          <span className={`text-xs font-sans font-medium mt-1.5 ${themeMode === 'dark' ? 'text-white' : 'text-[#141413]'}`}>
                            {meta.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Hero Font Override */}
                <div>
                  <label className={`text-[11px] font-sans font-medium block mb-1.5 ${
                    themeMode === 'dark' ? 'text-white/70' : 'text-[#5E5D59]'
                  }`}>
                    Hero Font
                  </label>
                  <select
                    value={fontFamily}
                    onChange={e => setFontFamily(e.target.value)}
                    className={`w-full p-2.5 text-xs font-sans rounded-xl focus:outline-none focus:border-[#D97757] focus:ring-1 focus:ring-[#D97757] cursor-pointer border shadow-xs transition-colors ${
                      themeMode === 'dark'
                        ? 'bg-[#1C1C20] border-white/10 text-white'
                        : 'bg-white border-[#E8E5DE] text-[#141413]'
                    }`}
                  >
                    <optgroup label="Trap & Gothic">
                      <option value="'Wilhelm Gotisch', sans-serif">Wilhelm Gotisch (Trap / Gothic)</option>
                      <option value="'Molot', sans-serif">Molot (Brutalist 3D)</option>
                      <option value="'Helvetica Compressed', sans-serif">Helvetica Compressed (Poster)</option>
                      <option value="'Vendetta', cursive">Vendetta (Blade Razor)</option>
                      <option value="'Lemon Milk', sans-serif">Lemon Milk (Clean Streetwear)</option>
                      <option value="'Cinzel Decorative', serif">Cinzel Decorative (Imperial)</option>
                    </optgroup>
                    <optgroup label="Cartoony & Bubbly">
                      <option value="'Luckiest Guy', cursive">Luckiest Guy (Bubbly Title)</option>
                      <option value="'Wicked Mouse', cursive">Wicked Mouse (Retro Cartoon)</option>
                      <option value="'Bubblegum', cursive">Bubblegum (Bubble)</option>
                      <option value="'Supersonic Rocketship', cursive">Supersonic Rocketship (Retro 60s)</option>
                      <option value="'Plumpfull', sans-serif">Plumpfull (Ultra Chonky)</option>
                      <option value="'Dinosaur', cursive">Dinosaur (Playful Block)</option>
                    </optgroup>
                    <optgroup label="Manga & Comic Action">
                      <option value="'Bangers', cursive">Bangers (Comic Action)</option>
                      <option value="'Kraash Black', cursive">Kraash Black (Punk Cutout)</option>
                      <option value="'Super Comic', sans-serif">Super Comic (Heavy Action)</option>
                    </optgroup>
                    <optgroup label="Monospace & Technical">
                      <option value='"IBM Plex Mono", monospace'>IBM Plex Mono (Clean Mono)</option>
                      <option value="VT323, monospace">VT323 (8-Bit Arcade)</option>
                      <option value='"Space Mono", monospace'>Space Mono (Modern Tech)</option>
                      <option value="Impact, sans-serif">Impact (Standard Heavy)</option>
                    </optgroup>
                  </select>
                </div>
              </>
            )}
          </div>

          {/* Pinned Action Dock (Always visible at bottom!) */}
          <div className={`p-4 border-t flex flex-col gap-2.5 shrink-0 ${
            themeMode === 'dark' ? 'border-[#2C2B29] bg-[#18181A]' : 'border-[#E8E5DE] bg-white'
          }`}>
            <div className="flex justify-between items-center text-[11px] font-mono">
              <span className={themeMode === 'dark' ? 'text-white/50' : 'text-[#87867F]'}>
                {selectedLines.length} lines • {rangeDurationSec.toFixed(1)}s
              </span>
              <span className="text-[#D97757] font-semibold">
                {totalFrames} frames (~{estProgmemKb} KB)
              </span>
            </div>
            <button
              onClick={handleGenerateAndInject}
              disabled={isRendering || selectedLines.length === 0}
              className={`w-full py-3 bg-[#D97757] hover:bg-[#C66545] text-white text-xs font-sans font-medium tracking-wide rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2 ${
                isRendering ? 'opacity-70 cursor-wait' : ''
              }`}
            >
              {isRendering ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Rendering sequence ({renderProgress}%)...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Render & Add to Timeline</span>
                </>
              )}
            </button>
          </div>
        </section>

      </main>

      {/* Word Customizer Modal */}
      {editingWordTarget && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div
            style={{ backgroundColor: themeMode === 'dark' ? '#18181C' : '#FFFFFF' }}
            className={`w-full max-w-lg p-5 flex flex-col gap-4 font-sans border rounded-2xl shadow-2xl relative z-10 ${
              themeMode === 'dark'
                ? 'border-white/10 text-white'
                : 'border-[#E8E5DE] text-[#141413]'
            }`}
          >
            {/* Header */}
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-sans font-medium text-[#D97757] tracking-wider block">
                  Word Customizer
                </span>
                <h3 className="font-sans text-xl font-bold tracking-tight mt-0.5">
                  "{editingWordTarget.word.word}"
                </h3>
                <span className={`text-[11px] font-mono ${themeMode === 'dark' ? 'text-white/50' : 'text-[#87867F]'}`}>
                  {(editingWordTarget.word.startMs / 1000).toFixed(2)}s – {(editingWordTarget.word.endMs / 1000).toFixed(2)}s ({Math.round(editingWordTarget.word.endMs - editingWordTarget.word.startMs)}ms)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEditingWordTarget(null)}
                className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                  themeMode === 'dark'
                    ? 'border-white/10 hover:bg-white/10 text-white/80'
                    : 'border-[#E8E5DE] hover:bg-[#FAF9F5] text-[#5E5D59]'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Segmented Inspector Tabs with Sliding Pill Physics */}
            <div className={`flex p-1 rounded-xl border gap-1 relative ${
              themeMode === 'dark' ? 'bg-[#141418] border-white/10' : 'bg-[#FAF9F5] border-[#E8E5DE]'
            }`}>
              {[
                { id: 'archetype' as const, label: 'Motion Style' },
                { id: 'font' as const, label: 'Typography Font' },
                { id: 'motif' as const, label: 'Visual Motif' }
              ].map(tab => {
                const isActive = wordCustomizerTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setWordCustomizerTab(tab.id)}
                    className={`relative flex-1 py-1.5 text-xs font-sans rounded-lg transition-colors cursor-pointer flex items-center justify-center z-10 ${
                      isActive
                        ? 'text-white font-semibold'
                        : themeMode === 'dark' ? 'text-white/50 hover:text-white' : 'text-[#5E5D59] hover:text-[#141413]'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="word-customizer-tab-pill"
                        className="absolute inset-0 bg-[#D97757] rounded-lg shadow-xs -z-10"
                        transition={{ type: 'spring', bounce: 0.16, duration: 0.35 }}
                      />
                    )}
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Tab 1: Motion Style */}
            {wordCustomizerTab === 'archetype' && (
              <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                {MANUAL_ARCHETYPES.map((archKey) => {
                  const meta = ARCHETYPE_METADATA[archKey];
                  const isSelected = editingWordTarget.currentArchetype === archKey;
                  return (
                    <button
                      key={archKey}
                      type="button"
                      onClick={() => {
                        const specificKey = `${editingWordTarget.word.word}_${editingWordTarget.word.startMs}`;
                        setWordOverrides(prev => ({
                          ...prev,
                          [specificKey]: archKey
                        }));
                        setEditingWordTarget(prev => prev ? { ...prev, currentArchetype: archKey } : null);
                      }}
                      style={{
                        backgroundColor: isSelected
                          ? (themeMode === 'dark' ? 'rgba(217, 119, 87, 0.2)' : '#FAF0EB')
                          : (themeMode === 'dark' ? '#232228' : '#FAF9F5')
                      }}
                      className={`p-2.5 border rounded-xl text-left transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? themeMode === 'dark'
                            ? 'border-[#D97757] ring-1 ring-[#D97757]/40 shadow-xs'
                            : 'border-[#D97757] ring-1 ring-[#D97757]/30 shadow-xs'
                          : themeMode === 'dark'
                          ? 'border-white/10 hover:border-white/20'
                          : 'border-[#E8E5DE] hover:border-[#D5D0C5] shadow-xs'
                      }`}
                    >
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded self-start ${
                        themeMode === 'dark' ? 'bg-white/10 text-white/80' : 'bg-white text-[#5E5D59] border border-[#E8E5DE]'
                      }`}>
                        {meta.tag}
                      </span>
                      <span className={`text-xs font-sans font-medium mt-1.5 ${themeMode === 'dark' ? 'text-white' : 'text-[#141413]'}`}>
                        {meta.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Tab 2: Typography Font */}
            {wordCustomizerTab === 'font' && (
              <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
                <span className={`text-[11px] font-medium ${themeMode === 'dark' ? 'text-white/60' : 'text-[#5E5D59]'}`}>
                  Select font family override for this word:
                </span>
                <select
                  value={
                    wordFontOverrides[`${editingWordTarget.word.word}_${editingWordTarget.word.startMs}`] ||
                    wordFontOverrides[editingWordTarget.word.word.toLowerCase().replace(/[^a-z0-9]/g, '')] ||
                    editingWordTarget.currentFont
                  }
                  onChange={(e) => {
                    const specificKey = `${editingWordTarget.word.word}_${editingWordTarget.word.startMs}`;
                    setWordFontOverrides(prev => ({
                      ...prev,
                      [specificKey]: e.target.value
                    }));
                    setEditingWordTarget(prev => prev ? { ...prev, currentFont: e.target.value } : null);
                  }}
                  style={{
                    backgroundColor: themeMode === 'dark' ? '#1C1C20' : '#FFFFFF'
                  }}
                  className={`w-full p-2.5 text-xs font-sans rounded-xl focus:outline-none focus:border-[#D97757] focus:ring-1 focus:ring-[#D97757] cursor-pointer border shadow-xs transition-colors ${
                    themeMode === 'dark'
                      ? 'border-white/10 text-white'
                      : 'border-[#E8E5DE] text-[#141413]'
                  }`}
                >
                  <optgroup label="Style Pack Presets">
                    <option value={STYLE_PACKS[stylePack].fonts.hero}>Hero: {STYLE_PACKS[stylePack].fonts.hero.split(',')[0].replace(/'/g, '')}</option>
                    <option value={STYLE_PACKS[stylePack].fonts.action}>Action: {STYLE_PACKS[stylePack].fonts.action.split(',')[0].replace(/'/g, '')}</option>
                    <option value={STYLE_PACKS[stylePack].fonts.novelty}>Novelty: {STYLE_PACKS[stylePack].fonts.novelty.split(',')[0].replace(/'/g, '')}</option>
                    <option value={STYLE_PACKS[stylePack].fonts.anchor}>Anchor: {STYLE_PACKS[stylePack].fonts.anchor.split(',')[0].replace(/['"]/g, '')}</option>
                  </optgroup>
                  <optgroup label="Curated Fonts">
                    <option value="'Wilhelm Gotisch', sans-serif">Wilhelm Gotisch (Trap / Gothic)</option>
                    <option value="'Molot', sans-serif">Molot (Brutalist 3D)</option>
                    <option value="'Vendetta', cursive">Vendetta (Blade Razor)</option>
                    <option value="'Bangers', cursive">Bangers (Comic Action)</option>
                    <option value="'Luckiest Guy', cursive">Luckiest Guy (Bubbly)</option>
                    <option value="'Wicked Mouse', cursive">Wicked Mouse (Retro)</option>
                    <option value="'Kraash Black', cursive">Kraash Black (Punk)</option>
                    <option value="'Super Comic', sans-serif">Super Comic (Heavy)</option>
                    <option value="'Bubblegum', cursive">Bubblegum (Bubble)</option>
                    <option value="VT323, monospace">VT323 (8-Bit Arcade)</option>
                    <option value='"IBM Plex Mono", monospace'>IBM Plex Mono (Clean Mono)</option>
                    <option value='"Space Mono", monospace'>Space Mono (Modern Tech)</option>
                  </optgroup>
                </select>
              </div>
            )}

            {/* Tab 3: Visual Motif */}
            {wordCustomizerTab === 'motif' && (
              <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                {Object.values(MOTIF_METADATA).map(m => {
                  const specificKey = `${editingWordTarget.word.word}_${editingWordTarget.word.startMs}`;
                  const currentSelected = (
                    wordMotifOverrides[specificKey] ||
                    wordMotifOverrides[editingWordTarget.word.word.toLowerCase().replace(/[^a-z0-9]/g, '')] ||
                    editingWordTarget.currentMotif ||
                    'none'
                  );
                  const isSelected = currentSelected === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setWordMotifOverrides(prev => ({
                          ...prev,
                          [specificKey]: m.id
                        }));
                        setEditingWordTarget(prev => prev ? { ...prev, currentMotif: m.id } : null);
                      }}
                      style={{
                        backgroundColor: isSelected
                          ? (themeMode === 'dark' ? 'rgba(217, 119, 87, 0.2)' : '#FAF0EB')
                          : (themeMode === 'dark' ? '#232228' : '#FAF9F5')
                      }}
                      className={`p-2.5 border rounded-xl text-left transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? themeMode === 'dark'
                            ? 'border-[#D97757] ring-1 ring-[#D97757]/40 shadow-xs'
                            : 'border-[#D97757] ring-1 ring-[#D97757]/30 shadow-xs'
                          : themeMode === 'dark'
                          ? 'border-white/10 hover:border-white/20'
                          : 'border-[#E8E5DE] hover:border-[#D5D0C5] shadow-xs'
                      }`}
                    >
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded self-start ${
                        themeMode === 'dark' ? 'bg-white/10 text-white/80' : 'bg-white text-[#5E5D59] border border-[#E8E5DE]'
                      }`}>
                        {m.tag}
                      </span>
                      <span className={`text-xs font-sans font-medium mt-1.5 ${themeMode === 'dark' ? 'text-white' : 'text-[#141413]'}`}>
                        {m.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Footer Actions */}
            <div className={`flex gap-2.5 pt-3 border-t ${
              themeMode === 'dark' ? 'border-white/10' : 'border-[#E8E5DE]'
            }`}>
              <button
                type="button"
                onClick={() => {
                  const specificKey = `${editingWordTarget.word.word}_${editingWordTarget.word.startMs}`;
                  const cleanKey = editingWordTarget.word.word.toLowerCase().replace(/[^a-z0-9]/g, '');
                  setWordOverrides(prev => {
                    const next = { ...prev };
                    delete next[specificKey];
                    delete next[cleanKey];
                    return next;
                  });
                  setWordFontOverrides(prev => {
                    const next = { ...prev };
                    delete next[specificKey];
                    delete next[cleanKey];
                    return next;
                  });
                  setWordMotifOverrides(prev => {
                    const next = { ...prev };
                    delete next[specificKey];
                    delete next[cleanKey];
                    return next;
                  });
                  setEditingWordTarget(null);
                }}
                className={`flex-1 py-2 rounded-xl border text-xs font-sans font-medium transition-colors cursor-pointer ${
                  themeMode === 'dark'
                    ? 'border-white/10 hover:bg-white/10 text-white/90'
                    : 'border-[#E8E5DE] hover:bg-[#FAF9F5] text-[#141413]'
                }`}
              >
                Reset to Auto
              </button>
              <button
                type="button"
                onClick={() => setEditingWordTarget(null)}
                className="px-6 py-2 rounded-xl text-xs font-sans font-medium bg-[#D97757] hover:bg-[#C66545] text-white transition-colors cursor-pointer shadow-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ollama & Groq LLM Telemetry & Test Inspector Modal */}
      <OllamaInspectorModal
        isOpen={showOllamaInspector}
        onClose={() => setShowOllamaInspector(false)}
        themeMode={themeMode}
        selectedModel={selectedOllamaModel}
        isOnline={Boolean(ollamaStatus?.online)}
        sessionLogs={ollamaInspectionLogs}
        availableModels={ollamaStatus?.models?.length ? ollamaStatus.models : undefined}
        onSelectModel={(model) => setSelectedOllamaModel(model)}
        selectedProvider={llmProvider}
        onSelectProvider={(p) => setLlmProvider(p)}
      />
    </div>
  );
};

export default LyricsStudioView;


