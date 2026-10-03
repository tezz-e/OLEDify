import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Search, Music, FileText, Upload, Play, Pause, ArrowLeft, ArrowRight, Plus, Sparkles, Check, RefreshCw, X, RotateCcw, ChevronUp, ChevronDown, CheckCheck, Bot, Cpu, Activity, Zap, Volume2, Terminal, Sliders, Layers, Type, Video, Clock } from 'lucide-react';
import { exportFramesToWebM, downloadBlob } from '../../../engine/kinetic/webmExporter';
import { searchLrclib, getLrclibExact, searchLyricsOvhFallback } from '../../../engine/lyrics/lrclibClient';
import { parseLrc, parsePlainTextLyrics } from '../../../engine/lyrics/lrcParser';
import { LrclibTrack, ParsedLyrics, LyricLine, LyricWord } from '../../../engine/lyrics/types';
import { MotionArchetype, ARCHETYPE_METADATA, STYLE_PACKS, StylePackId, VisualMotif, MotifMode, MOTIF_METADATA, KineticTransitionType, TRANSITION_METADATA, WordBadgeIcon, WORD_BADGE_METADATA } from '../../../engine/kinetic/types';
import { renderKineticSequence } from '../../../engine/kinetic/kineticEngine';
import { getWordEffectiveArchetype, getWordEffectiveFont, getWordFontRole, cleanLyricToken, classifyWordBadge } from '../../../engine/kinetic/semanticClassifier';
import { computeSongMoodProfile, SongMoodProfile, SongVibe } from '../../../engine/kinetic/moodProfileEngine';
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
import { LoaderGooeyBlobs } from '../../ui/loaders-gooey-blobs';

interface LyricsStudioViewProps {
  onClose: () => void;
  onInjectToTimeline: (media: DecodedMedia, shouldClose?: boolean) => void;
  isOpen?: boolean;
  themeMode?: 'light' | 'dark';
  onThemeChange?: (theme: 'light' | 'dark') => void;
}

const SAMPLE_FALLBACK_LRC = `[ti:OLED Kinetic Intro]
[ar:Studio Engine]
[00:00.00] WELCOME TO OLED STUDIO
[00:02.50] PURE KINETIC TYPOGRAPHY
[00:05.00] 1-BIT SYNCHRONIZED REELS
[00:07.50] HARDWARE READY FOR ESP32`;

const SAMPLE_PLAIN_FALLBACK_LYRICS = `Wise men say
Only fools rush in
But I can't help
Falling in love with you`;

const MANUAL_ARCHETYPES: MotionArchetype[] = [
  'gentle_float',
  'waveform_karaoke',
  'typewriter_ribbon',
  'dither_dissolve',
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
  currentBadge?: WordBadgeIcon;
}


export const LyricsStudioView: React.FC<LyricsStudioViewProps> = ({
  onClose,
  onInjectToTimeline,
  isOpen = true,
  themeMode: externalThemeMode,
  onThemeChange,
}) => {
  // --- THEME STATE (PERSISTENT LIGHT / DARK MODE) ---
  const [internalThemeMode, setInternalThemeMode] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('oled_studio_theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch (_) {}
    return 'dark';
  });

  const themeMode = externalThemeMode ?? internalThemeMode;
  const setThemeMode = useCallback((mode: 'light' | 'dark') => {
    setInternalThemeMode(mode);
    onThemeChange?.(mode);
    try {
      localStorage.setItem('oled_studio_theme', mode);
    } catch (_) {}
  }, [onThemeChange]);

  useEffect(() => {
    if (externalThemeMode && externalThemeMode !== internalThemeMode) {
      setInternalThemeMode(externalThemeMode);
    }
  }, [externalThemeMode, internalThemeMode]);

  useEffect(() => {
    try {
      localStorage.setItem('oled_studio_theme', themeMode);
    } catch (_) {}
  }, [themeMode]);

  // Auto pause audio if studio view is hidden/backgrounded
  useEffect(() => {
    if (isOpen === false) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsPlaying(false);
    }
  }, [isOpen]);

  // --- INGESTION STATE ---
  const [ingestTab, setIngestTab] = useState<'search' | 'paste' | 'audio'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<LrclibTrack[]>([]);
  const [pastedLrcText, setPastedLrcText] = useState(() => {
    try {
      return sessionStorage.getItem('oled_studio_lyrics_text') || SAMPLE_FALLBACK_LRC;
    } catch (_) {
      return SAMPLE_FALLBACK_LRC;
    }
  });
  const [plainLyricsTitle, setPlainLyricsTitle] = useState(() => {
    try {
      return sessionStorage.getItem('oled_studio_plain_title') || '';
    } catch (_) {
      return '';
    }
  });
  const [plainLyricsArtist, setPlainLyricsArtist] = useState(() => {
    try {
      return sessionStorage.getItem('oled_studio_plain_artist') || '';
    } catch (_) {
      return '';
    }
  });
  const [plainLyricsPacing, setPlainLyricsPacing] = useState<'ballad' | 'pop' | 'rap'>('pop');

  const isLrcContent = useMemo(() => {
    return /\[\d{2}:\d{2}(?:\.\d{2,3})?\]/.test(pastedLrcText);
  }, [pastedLrcText]);

  // --- PARSED LYRICS & SELECTION ---
  const [parsedLyrics, setParsedLyrics] = useState<ParsedLyrics>(() => parseLrc(SAMPLE_FALLBACK_LRC));
  const [selectedLineIndices, setSelectedLineIndices] = useState<number[]>([0, 1, 2, 3]);
  const [anchorIndex, setAnchorIndex] = useState<number>(0);
  const selectedStartIndex = selectedLineIndices.length > 0 ? Math.min(...selectedLineIndices) : 0;
  const selectedEndIndex = selectedLineIndices.length > 0 ? Math.max(...selectedLineIndices) : 0;

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
  const [wordCustomizerTab, setWordCustomizerTab] = useState<'archetype' | 'font' | 'motif' | 'badge'>('archetype');
  const [stylePack, setStylePack] = useState<StylePackId>('trap_drill');
  const [hasUserSelectedStylePack, setHasUserSelectedStylePack] = useState(false);
  const [showFontHierarchy, setShowFontHierarchy] = useState<boolean>(false);
  const [manualWordOverrides, setManualWordOverrides] = useState<Record<string, MotionArchetype>>({});
  const [manualFontOverrides, setManualFontOverrides] = useState<Record<string, string>>({});
  const [manualMotifOverrides, setManualMotifOverrides] = useState<Record<string, VisualMotif>>({});
  const [manualBadgeOverrides, setManualBadgeOverrides] = useState<Record<string, WordBadgeIcon>>({});
  const [aiWordOverrides, setAiWordOverrides] = useState<Record<string, MotionArchetype>>({});
  const [aiMotifOverrides, setAiMotifOverrides] = useState<Record<string, VisualMotif>>({});
  const [motifMode, setMotifMode] = useState<MotifMode>('dynamic');
  const [transitionStyle, setTransitionStyle] = useState<KineticTransitionType>('auto');
  const [editingWordTarget, setEditingWordTarget] = useState<EditingWordTarget | null>(null);
  const [fontFamily, setFontFamily] = useState<string>(() => STYLE_PACKS.trap_drill.fonts.hero);
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  // --- SONG MOOD PROFILE (Derived from Audio Telemetry, Lyric Pacing & AI Director) ---
  const [aiDetectedVibe, setAiDetectedVibe] = useState<SongVibe | null>(null);

  const songMoodProfile = useMemo(() => {
    return computeSongMoodProfile(
      audioAnalysis,
      parsedLyrics.lines,
      parsedLyrics.title || searchQuery,
      parsedLyrics.artist,
      aiDetectedVibe || undefined
    );
  }, [audioAnalysis, parsedLyrics, searchQuery, aiDetectedVibe]);

  // Automatically adapt recommended style pack when song mood profile changes unless manually chosen
  useEffect(() => {
    if (!hasUserSelectedStylePack && songMoodProfile?.recommendedStylePack) {
      setStylePack(songMoodProfile.recommendedStylePack);
      const pack = STYLE_PACKS[songMoodProfile.recommendedStylePack];
      if (pack) {
        setFontFamily(pack.fonts.hero);
      }
    }
  }, [songMoodProfile, hasUserSelectedStylePack]);

  // --- LLM INFERENCE STATE (Groq Cloud & Local Ollama) ---
  const [inferenceMode, setInferenceMode] = useState<'heuristic' | 'ollama'>('heuristic');

  // Derived effective overrides based on director inferenceMode:
  // - In 'heuristic' (Auto Rules): uses pure algorithmic rules without AI overrides.
  // - In 'ollama' (AI Cloud Director): merges AI director overrides with any manual user tweaks.
  const wordOverrides = useMemo<Record<string, MotionArchetype>>(() => {
    if (directorModeTab === 'manual') return manualWordOverrides;
    if (inferenceMode === 'heuristic') return manualWordOverrides;
    return { ...aiWordOverrides, ...manualWordOverrides };
  }, [directorModeTab, inferenceMode, manualWordOverrides, aiWordOverrides]);

  const wordFontOverrides = manualFontOverrides;

  const wordMotifOverrides = useMemo<Record<string, VisualMotif>>(() => {
    if (directorModeTab === 'manual') return manualMotifOverrides;
    if (inferenceMode === 'heuristic') return manualMotifOverrides;
    return { ...aiMotifOverrides, ...manualMotifOverrides };
  }, [directorModeTab, inferenceMode, manualMotifOverrides, aiMotifOverrides]);

  const [aiBadgeOverrides, setAiBadgeOverrides] = useState<Record<string, WordBadgeIcon>>({});
  const wordBadgeOverrides = useMemo<Record<string, WordBadgeIcon>>(() => {
    if (directorModeTab === 'manual') return manualBadgeOverrides;
    if (inferenceMode === 'heuristic') return manualBadgeOverrides;
    return { ...aiBadgeOverrides, ...manualBadgeOverrides };
  }, [directorModeTab, inferenceMode, manualBadgeOverrides, aiBadgeOverrides]);

  // --- RENDER BUFFER & DIRTY TRACKING ---
  const [renderedMediaBuffer, setRenderedMediaBuffer] = useState<DecodedMedia | null>(null);
  const [renderedFingerprint, setRenderedFingerprint] = useState<string | null>(null);
  const [lastRenderedMode, setLastRenderedMode] = useState<'heuristic' | 'ollama' | null>(null);
  const [injectedToast, setInjectedToast] = useState(false);

  const [llmProvider, setLlmProvider] = useState<LLMProvider>(() => {
    return getEffectiveGroqApiKey() ? 'groq' : 'ollama';
  });
  const [ollamaStatus, setOllamaStatus] = useState<OllamaHealthStatus | null>(null);
  const [selectedOllamaModel, setSelectedOllamaModel] = useState<string>('qwen3.5:2b-q4_K_M');
  const [isAnalyzingOllama, setIsAnalyzingOllama] = useState<boolean>(false);
  const [ollamaProgress, setOllamaProgress] = useState<{ percent: number; message: string } | null>(null);
  const [showOllamaInspector, setShowOllamaInspector] = useState<boolean>(false);
  const [ollamaInspectionLogs, setOllamaInspectionLogs] = useState<OllamaInspectionLog[]>([]);
  const [analysisScope, setAnalysisScope] = useState<'unprocessed' | 'selected' | 'all'>('selected');
  const [lastAnalysisNotice, setLastAnalysisNotice] = useState<{ message: string; count: number; timestamp: number } | null>(null);

  // Selected lines calculation (supports non-contiguous lines via Ctrl+click)
  const selectedLines = useMemo(() => {
    return parsedLyrics.lines.filter((_, idx) => selectedLineIndices.includes(idx));
  }, [parsedLyrics, selectedLineIndices]);

  // Lines in current selection that do not yet have AI-directed overrides
  const selectedUnprocessedLines = useMemo(() => {
    return selectedLines.filter(line => {
      if (!line.words || line.words.length === 0) return false;
      const isDirected = line.words.some(w => {
        const specificKey = `${w.word}_${w.startMs}`;
        const cleanKey = cleanLyricToken(w.word);
        const lowerRaw = w.word.toLowerCase();
        return !!(
          aiWordOverrides[specificKey] || (cleanKey && aiWordOverrides[cleanKey]) || aiWordOverrides[lowerRaw] ||
          aiMotifOverrides[specificKey] || (cleanKey && aiMotifOverrides[cleanKey]) || aiMotifOverrides[lowerRaw]
        );
      });
      return !isDirected;
    });
  }, [selectedLines, aiWordOverrides, aiMotifOverrides]);

  const hasPartialUnprocessed = selectedUnprocessedLines.length > 0 && selectedUnprocessedLines.length < selectedLines.length;

  // Auto-adapt scope to 'unprocessed' when user selects newly added/unprocessed lines alongside existing ones
  useEffect(() => {
    if (hasPartialUnprocessed) {
      setAnalysisScope('unprocessed');
    }
  }, [hasPartialUnprocessed]);

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

    const isUnprocessedMode = analysisScope === 'unprocessed' || (hasPartialUnprocessed && analysisScope !== 'selected' && analysisScope !== 'all');
    const targetLines = (isUnprocessedMode && selectedUnprocessedLines.length > 0)
      ? selectedUnprocessedLines
      : analysisScope === 'selected'
      ? selectedLines
      : parsedLyrics.lines;

    const targetLabel = (isUnprocessedMode && selectedUnprocessedLines.length > 0)
      ? `${targetLines.length} New Lines`
      : analysisScope === 'selected'
      ? `${targetLines.length} Selected Lines`
      : `Full Song (${parsedLyrics.lines.length} lines)`;

    const providerLabel = llmProvider === 'groq' ? 'Groq 120B Cloud' : selectedOllamaModel;

    setOllamaProgress({ 
      percent: 0, 
      message: `Analyzing ${targetLabel} with ${providerLabel}...` 
    });

    try {
      const results = await classifyLyricsWithOllama(
        targetLines,
        {
          provider: llmProvider,
          model: llmProvider === 'groq' ? 'openai/gpt-oss-120b' : selectedOllamaModel,
          songTitle: parsedLyrics.title || searchQuery,
          artist: parsedLyrics.artist,
          songProfile: songMoodProfile,
          onProgress: (percent, message) => {
            setOllamaProgress({ percent, message });
          },
          onInspectionLog: (log) => {
            setOllamaInspectionLogs(prev => [log, ...prev]);
          },
        }
      );

      let appliedCount = 0;
      if (results && results.archetypes && typeof results.archetypes === 'object') {
        const cleanArchetypes: Record<string, MotionArchetype> = {};
        for (const [key, val] of Object.entries(results.archetypes)) {
          if (key !== 'archetypes' && key !== 'motifs' && typeof val === 'string') {
            cleanArchetypes[key] = val as MotionArchetype;
          }
        }
        if (Object.keys(cleanArchetypes).length > 0) {
          setAiWordOverrides(prev => ({ ...prev, ...cleanArchetypes }));
          appliedCount += Object.keys(cleanArchetypes).length;
        }
      }
      if (results && results.motifs && typeof results.motifs === 'object') {
        const cleanMotifs: Record<string, VisualMotif> = {};
        for (const [key, val] of Object.entries(results.motifs)) {
          if (key !== 'archetypes' && key !== 'motifs' && typeof val === 'string') {
            cleanMotifs[key] = val as VisualMotif;
          }
        }
        if (Object.keys(cleanMotifs).length > 0) {
          setAiMotifOverrides(prev => ({ ...prev, ...cleanMotifs }));
          appliedCount += Object.keys(cleanMotifs).length;
        }
      }
      if (results && results.badges && typeof results.badges === 'object') {
        const cleanBadges: Record<string, WordBadgeIcon> = {};
        for (const [key, val] of Object.entries(results.badges)) {
          if (key !== 'archetypes' && key !== 'motifs' && key !== 'badges' && typeof val === 'string' && val !== 'none') {
            cleanBadges[key] = val as WordBadgeIcon;
          }
        }
        if (Object.keys(cleanBadges).length > 0) {
          setAiBadgeOverrides(prev => ({ ...prev, ...cleanBadges }));
          appliedCount += Object.keys(cleanBadges).length;
        }
      }

      if (results?.songVibe) {
        setAiDetectedVibe(results.songVibe);
      }
      if (results?.recommendedStylePack && results.recommendedStylePack in STYLE_PACKS) {
        const packId = results.recommendedStylePack as StylePackId;
        setStylePack(packId);
        setFontFamily(STYLE_PACKS[packId].fonts.hero);
      }

      // Automatically activate AI Cloud Director mode and bust stale render buffer
      setInferenceMode('ollama');
      setRenderedMediaBuffer(null);
      setRenderedFingerprint(null);

      setLastAnalysisNotice({
        message: `Applied ${appliedCount} AI styles across ${targetLines.length} lines with ${providerLabel}`,
        count: appliedCount,
        timestamp: Date.now()
      });
    } catch (err: any) {
      console.error('LLM analysis failed:', err);
    } finally {
      setIsAnalyzingOllama(false);
      setTimeout(() => setOllamaProgress(null), 4000);
    }
  };

  const handleClearSelectedStanzaOverrides = () => {
    const start = Math.min(selectedStartIndex, selectedEndIndex);
    const end = Math.max(selectedStartIndex, selectedEndIndex);
    const stanzaLines = parsedLyrics.lines.slice(start, end + 1);

    const keysToRemove = new Set<string>();
    for (const line of stanzaLines) {
      if (line.words) {
        for (const w of line.words) {
          keysToRemove.add(`${w.word}_${w.startMs}`);
          const cK = cleanLyricToken(w.word);
          if (cK) keysToRemove.add(cK);
          keysToRemove.add(w.word.toLowerCase());
        }
      }
    }

    setManualWordOverrides(prev => {
      const next = { ...prev };
      for (const k of keysToRemove) delete next[k];
      return next;
    });
    setManualFontOverrides(prev => {
      const next = { ...prev };
      for (const k of keysToRemove) delete next[k];
      return next;
    });
    setManualMotifOverrides(prev => {
      const next = { ...prev };
      for (const k of keysToRemove) delete next[k];
      return next;
    });
    setAiWordOverrides(prev => {
      const next = { ...prev };
      for (const k of keysToRemove) delete next[k];
      return next;
    });
    setAiMotifOverrides(prev => {
      const next = { ...prev };
      for (const k of keysToRemove) delete next[k];
      return next;
    });

    setRenderedMediaBuffer(null);
    setRenderedFingerprint(null);
  };

  // Safe word editor snapshot to allow full cancellation
  const initialWordStateRef = useRef<{
    arch?: MotionArchetype;
    font?: string;
    motif?: VisualMotif;
    badge?: WordBadgeIcon;
  } | null>(null);

  const handleOpenWordEditor = (
    w: LyricWord,
    lineIdx: number,
    wIdx: number,
    wordArch: MotionArchetype,
    wordFont: string,
    wordMotif: VisualMotif,
    wordBadge?: WordBadgeIcon
  ) => {
    const specificKey = `${w.word}_${w.startMs}`;
    const cleanKey = cleanLyricToken(w.word);
    initialWordStateRef.current = {
      arch: manualWordOverrides[specificKey] || (cleanKey ? manualWordOverrides[cleanKey] : undefined),
      font: manualFontOverrides[specificKey] || (cleanKey ? manualFontOverrides[cleanKey] : undefined),
      motif: manualMotifOverrides[specificKey] || (cleanKey ? manualMotifOverrides[cleanKey] : undefined),
      badge: manualBadgeOverrides[specificKey] || (cleanKey ? manualBadgeOverrides[cleanKey] : undefined),
    };
    setEditingWordTarget({
      word: w,
      lineIdx,
      wordIdx: wIdx,
      currentArchetype: wordArch,
      currentFont: wordFont,
      currentMotif: wordMotif,
      currentBadge: wordBadge
    });
  };

  const handleCancelWordEditor = () => {
    if (!editingWordTarget || !initialWordStateRef.current) {
      setEditingWordTarget(null);
      return;
    }
    const specificKey = `${editingWordTarget.word.word}_${editingWordTarget.word.startMs}`;
    const cleanKey = cleanLyricToken(editingWordTarget.word.word);
    const { arch, font, motif, badge } = initialWordStateRef.current;

    setManualWordOverrides(prev => {
      const next = { ...prev };
      if (arch) next[specificKey] = arch;
      else { delete next[specificKey]; if (cleanKey) delete next[cleanKey]; }
      return next;
    });

    setManualFontOverrides(prev => {
      const next = { ...prev };
      if (font) next[specificKey] = font;
      else { delete next[specificKey]; if (cleanKey) delete next[cleanKey]; }
      return next;
    });

    setManualMotifOverrides(prev => {
      const next = { ...prev };
      if (motif && motif !== 'none') next[specificKey] = motif;
      else { delete next[specificKey]; if (cleanKey) delete next[cleanKey]; }
      return next;
    });

    setManualBadgeOverrides(prev => {
      const next = { ...prev };
      if (badge && badge !== 'none') next[specificKey] = badge;
      else { delete next[specificKey]; if (cleanKey) delete next[cleanKey]; }
      return next;
    });

    setEditingWordTarget(null);
  };

  // --- PREVIEW FRAME IN OLED CANVAS ---
  const [previewFrame, setPreviewFrame] = useState<ImageData | null>(null);
  const previewFramesRef = useRef<ExtractedFrame[]>([]);

  // --- WEBM EXPORT STATE ---
  const [isRecordingWebm, setIsRecordingWebm] = useState(false);
  const [recordProgress, setRecordProgress] = useState(0);

  const handleRecordWebm = async () => {
    if (previewFramesRef.current.length === 0) return;
    setIsRecordingWebm(true);
    setRecordProgress(0);
    try {
      const blob = await exportFramesToWebM(previewFramesRef.current, {
        scale: 4,
        fps: 30,
        theme: 'cyan',
        onProgress: (p) => setRecordProgress(p)
      });
      const filename = `kinetic_${(parsedLyrics.title || 'preview').toLowerCase().replace(/[^a-z0-9]+/g, '_')}.webm`;
      downloadBlob(blob, filename);
    } catch (err) {
      console.error('WebM export failed:', err);
    } finally {
      setIsRecordingWebm(false);
    }
  };

  // Expose automation hook on window for test scripts and agent evaluation
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__oledStudio = {
        setSong: (title: string, artist: string, lrcText: string, pacingMode?: 'ballad' | 'pop' | 'rap') => {
          setPastedLrcText(lrcText);
          setPlainLyricsTitle(title);
          setPlainLyricsArtist(artist);
          if (pacingMode) setPlainLyricsPacing(pacingMode);
          const hasTimeTags = /\[\d{2}:\d{2}(?:\.\d{2,3})?\]/.test(lrcText);
          const parsed = hasTimeTags
            ? parseLrc(lrcText, undefined, { title, artist })
            : parsePlainTextLyrics(lrcText, { title, artist, pacingMode: pacingMode || 'pop' });
          parsed.title = title;
          parsed.artist = artist;
          setParsedLyrics(parsed);
          setSelectedLineIndices(parsed.lines.map((_, i) => i));
        },
        runAiDirector: async () => {
          await handleRunOllamaAnalysis();
        },
        exportWebmBase64: async () => {
          const frames = previewFramesRef.current;
          if (!frames || frames.length === 0) throw new Error('No frames rendered in previewFramesRef');
          const blob = await exportFramesToWebM(frames, { scale: 4, fps: 30, theme: 'cyan' });
          return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const res = reader.result as string;
              resolve(res.split(',')[1]);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        },
        getFramesCount: () => previewFramesRef.current.length
      };
    }
  }, [parsedLyrics, songMoodProfile, stylePack, archetype, aiWordOverrides, aiMotifOverrides]);


  // Auto-load lyrics on mount from session or fallback
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem('oled_studio_lyrics_text');
      if (cached) {
        const parsed = parseLrc(cached);
        setParsedLyrics(parsed);
        const savedIndicesRaw = sessionStorage.getItem('oled_studio_sel_indices');
        if (savedIndicesRaw) {
          try {
            const parsedIdxs = JSON.parse(savedIndicesRaw);
            if (Array.isArray(parsedIdxs) && parsedIdxs.length > 0) {
              const valid = parsedIdxs.filter(i => i < parsed.lines.length);
              if (valid.length > 0) {
                setSelectedLineIndices(valid);
                setAnchorIndex(valid[0]);
                return;
              }
            }
          } catch (_) {}
        }
        const savedStart = Number(sessionStorage.getItem('oled_studio_sel_start') || 0);
        const savedEnd = Number(sessionStorage.getItem('oled_studio_sel_end') || Math.min(3, parsed.lines.length - 1));
        const s = Math.min(parsed.lines.length - 1, Math.max(0, savedStart));
        const e = Math.min(parsed.lines.length - 1, Math.max(0, savedEnd));
        setSelectedLineIndices(Array.from({ length: e - s + 1 }, (_, i) => s + i));
        setAnchorIndex(s);
        return;
      }
    } catch (_) {}

    const defaultParsed = parseLrc(SAMPLE_FALLBACK_LRC);
    setParsedLyrics(defaultParsed);
    setSelectedLineIndices(Array.from({ length: Math.min(4, defaultParsed.lines.length) }, (_, i) => i));
    setAnchorIndex(0);
  }, []);

  // Persist selection indices to session storage
  useEffect(() => {
    try {
      sessionStorage.setItem('oled_studio_sel_indices', JSON.stringify(selectedLineIndices));
      sessionStorage.setItem('oled_studio_sel_start', String(selectedStartIndex));
      sessionStorage.setItem('oled_studio_sel_end', String(selectedEndIndex));
    } catch (_) {}
  }, [selectedLineIndices, selectedStartIndex, selectedEndIndex]);

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
    // Reset previous song overrides & notices
    setManualWordOverrides({});
    setManualFontOverrides({});
    setManualMotifOverrides({});
    setManualBadgeOverrides({});
    setAiWordOverrides({});
    setAiMotifOverrides({});
    setAiBadgeOverrides({});
    setOllamaInspectionLogs([]);
    setLastAnalysisNotice(null);
    setRenderedMediaBuffer(null);
    setRenderedFingerprint(null);

    const lrcText = track.syncedLyrics || track.plainLyrics || '';
    try {
      sessionStorage.setItem('oled_studio_lyrics_text', lrcText);
    } catch (_) {}

    if (track.syncedLyrics) {
      const parsed = parseLrc(track.syncedLyrics);
      if (!parsed.title && track.trackName) parsed.title = track.trackName;
      if (!parsed.artist && track.artistName) parsed.artist = track.artistName;
      setParsedLyrics(parsed);
      setSelectedLineIndices(Array.from({ length: Math.min(4, parsed.lines.length) }, (_, i) => i));
      setAnchorIndex(0);
      setPlayheadMs(parsed.lines[0]?.startMs || 0);
    } else if (track.plainLyrics) {
      const parsed = parsePlainTextLyrics(track.plainLyrics, track.duration * 1000);
      if (!parsed.title && track.trackName) parsed.title = track.trackName;
      if (!parsed.artist && track.artistName) parsed.artist = track.artistName;
      setParsedLyrics(parsed);
      setSelectedLineIndices(Array.from({ length: Math.min(4, parsed.lines.length) }, (_, i) => i));
      setAnchorIndex(0);
      setPlayheadMs(0);
    }
    setHasUserSelectedStylePack(false);
    setAiDetectedVibe(null);
  };

  // Parse pasted LRC / plain lyrics
  const handleApplyPastedLrc = () => {
    if (!pastedLrcText.trim()) return;
    // Reset previous song overrides & notices
    setManualWordOverrides({});
    setManualFontOverrides({});
    setManualMotifOverrides({});
    setManualBadgeOverrides({});
    setAiWordOverrides({});
    setAiMotifOverrides({});
    setAiBadgeOverrides({});
    setOllamaInspectionLogs([]);
    setLastAnalysisNotice(null);
    setRenderedMediaBuffer(null);
    setRenderedFingerprint(null);
    setAiDetectedVibe(null);
    setHasUserSelectedStylePack(false);

    try {
      sessionStorage.setItem('oled_studio_lyrics_text', pastedLrcText);
      sessionStorage.setItem('oled_studio_plain_title', plainLyricsTitle);
      sessionStorage.setItem('oled_studio_plain_artist', plainLyricsArtist);
    } catch (_) {}

    const parsed = isLrcContent
      ? parseLrc(pastedLrcText, audioAnalysis?.durationMs, {
          title: plainLyricsTitle.trim() || undefined,
          artist: plainLyricsArtist.trim() || undefined,
        })
      : parsePlainTextLyrics(pastedLrcText, {
          totalDurationMs: audioAnalysis?.durationMs,
          pacingMode: plainLyricsPacing,
          title: plainLyricsTitle.trim() || undefined,
          artist: plainLyricsArtist.trim() || undefined,
        });

    if (parsed.title && !plainLyricsTitle) setPlainLyricsTitle(parsed.title);
    if (parsed.artist && !plainLyricsArtist) setPlainLyricsArtist(parsed.artist);

    setParsedLyrics(parsed);
    setSelectedLineIndices(Array.from({ length: Math.min(4, parsed.lines.length) }, (_, i) => i));
    setAnchorIndex(0);
    setPlayheadMs(parsed.lines[0]?.startMs || 0);
  };

  const [snapFeedback, setSnapFeedback] = useState(false);
  const [isDraggingAudio, setIsDraggingAudio] = useState(false);
  const [audioAnalysisError, setAudioAnalysisError] = useState<string | null>(null);
  const [waveformResizeTick, setWaveformResizeTick] = useState(0);
  const waveformCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const localAudioUrlRef = useRef<string | null>(null);

  // Timeline Scrollability & Zoom States
  const [scrubScope, setScrubScope] = useState<'selection' | 'full'>('selection');
  const [timelineZoom, setTimelineZoom] = useState<number>(1);
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);

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

  const rangeStartMs = selectedLines.length > 0 ? selectedLines[0].startMs : 0;
  const rangeEndMs = selectedLines.length > 0 ? selectedLines[selectedLines.length - 1].endMs : 5000;
  const rangeDurationSec = Math.max(0.5, (rangeEndMs - rangeStartMs) / 1000);
  const totalFrames = Math.round(rangeDurationSec * 30);
  const estProgmemKb = Math.round((totalFrames * 1024) / 1024);

  const songTotalDurationMs = useMemo(() => {
    if (audioAnalysis?.durationMs) return audioAnalysis.durationMs;
    if (parsedLyrics.lines.length > 0) {
      return parsedLyrics.lines[parsedLyrics.lines.length - 1].endMs || 5000;
    }
    return 5000;
  }, [audioAnalysis, parsedLyrics.lines]);

  const activeScrubMinMs = scrubScope === 'full' ? 0 : rangeStartMs;
  const activeScrubMaxMs = scrubScope === 'full' ? songTotalDurationMs : rangeEndMs;

  // Summary of overrides, roles, and status for the currently selected stanza
  const selectedStanzaStats = useMemo(() => {
    let wordCount = 0;
    let overrideCount = 0;
    const activeMotifs = new Set<string>();
    const activeArchetypes = new Set<string>();

    let heroCount = 0;
    let actionCount = 0;
    let noveltyCount = 0;
    let anchorCount = 0;
    const autoArchetypeCounts: Record<string, number> = {};

    for (const line of selectedLines) {
      if (line.words) {
        for (let wIdx = 0; wIdx < line.words.length; wIdx++) {
          const w = line.words[wIdx];
          wordCount++;
          const specificKey = `${w.word}_${w.startMs}`;
          const cleanKey = cleanLyricToken(w.word);
          const lowerRaw = w.word.toLowerCase();
          const arch = wordOverrides[specificKey] || (cleanKey ? wordOverrides[cleanKey] : undefined) || wordOverrides[lowerRaw];
          const motif = wordMotifOverrides[specificKey] || (cleanKey ? wordMotifOverrides[cleanKey] : undefined) || wordMotifOverrides[lowerRaw];
          if (arch) {
            overrideCount++;
            activeArchetypes.add(ARCHETYPE_METADATA[arch]?.name || arch);
          }
          if (motif && motif !== 'none') {
            activeMotifs.add(MOTIF_METADATA[motif]?.name || motif);
          }

          // Heuristic assignment calculation
          const precedingWord = wIdx > 0 ? line.words[wIdx - 1] : undefined;
          const effArch = getWordEffectiveArchetype(w, wIdx, archetype, wordOverrides, precedingWord, songMoodProfile);
          const role = getWordFontRole(effArch, w.word);
          if (role === 'hero') heroCount++;
          else if (role === 'action') actionCount++;
          else if (role === 'novelty') noveltyCount++;
          else anchorCount++;

          const archName = ARCHETYPE_METADATA[effArch]?.name || effArch;
          autoArchetypeCounts[archName] = (autoArchetypeCounts[archName] || 0) + 1;
        }
      }
    }

    const topAutoStyles = Object.entries(autoArchetypeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, cnt]) => `${name} (${cnt})`);

    return {
      wordCount,
      overrideCount,
      hasOverrides: overrideCount > 0,
      activeMotifs: Array.from(activeMotifs),
      activeArchetypes: Array.from(activeArchetypes),
      heroCount,
      actionCount,
      noveltyCount,
      anchorCount,
      topAutoStyles
    };
  }, [selectedLines, wordOverrides, wordMotifOverrides, archetype, songMoodProfile]);

  // Global map tracking which lines across the entire song have custom overrides applied
  const lineOverrideStatusMap = useMemo(() => {
    return parsedLyrics.lines.map(line => {
      if (!line.words || line.words.length === 0) return { hasCustom: false, count: 0 };
      let count = 0;
      for (const w of line.words) {
        const specificKey = `${w.word}_${w.startMs}`;
        const cleanKey = cleanLyricToken(w.word);
        const lowerRaw = w.word.toLowerCase();
        if (
          wordOverrides[specificKey] || (cleanKey && wordOverrides[cleanKey]) || wordOverrides[lowerRaw] ||
          wordFontOverrides[specificKey] || (cleanKey && wordFontOverrides[cleanKey]) || wordFontOverrides[lowerRaw] ||
          (wordMotifOverrides[specificKey] && wordMotifOverrides[specificKey] !== 'none') ||
          (cleanKey && wordMotifOverrides[cleanKey] && wordMotifOverrides[cleanKey] !== 'none') ||
          (wordMotifOverrides[lowerRaw] && wordMotifOverrides[lowerRaw] !== 'none')
        ) {
          count++;
        }
      }
      return { hasCustom: count > 0, count };
    });
  }, [parsedLyrics.lines, wordOverrides, wordFontOverrides, wordMotifOverrides]);

  const currentFingerprint = useMemo(() => {
    try {
      return JSON.stringify({
        rangeStartMs,
        rangeEndMs,
        lineCount: selectedLines.length,
        lines: selectedLines.map(l => ({ s: l.startMs, e: l.endMs, t: l.text })),
        archetype,
        fontFamily,
        stylePack,
        motifMode,
        transitionStyle,
        wordOverrides,
        wordFontOverrides,
        wordMotifOverrides,
        inferenceMode,
        hasAudio: !!audioAnalysis
      });
    } catch (err) {
      console.warn('Failed to compute currentFingerprint:', err);
      return `${rangeStartMs}_${rangeEndMs}_${selectedLines.length}_${archetype}_${fontFamily}_${stylePack}_${motifMode}_${transitionStyle}_${inferenceMode}`;
    }
  }, [
    rangeStartMs,
    rangeEndMs,
    selectedLines,
    archetype,
    fontFamily,
    stylePack,
    motifMode,
    transitionStyle,
    wordOverrides,
    wordFontOverrides,
    wordMotifOverrides,
    inferenceMode,
    audioAnalysis
  ]);

  const isDirty = useMemo(() => {
    if (!renderedMediaBuffer || !renderedFingerprint) return true;
    return currentFingerprint !== renderedFingerprint;
  }, [renderedMediaBuffer, renderedFingerprint, currentFingerprint]);

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

  // Line selection click handler (supports Shift for range, Ctrl/Cmd for toggle)
  const handleLineClick = (idx: number, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      // Ctrl / Cmd + Click: Toggle individual line selection
      setSelectedLineIndices(prev => {
        if (prev.includes(idx)) {
          // If only 1 line selected, don't allow empty selection
          if (prev.length <= 1) return prev;
          const nextIndices = prev.filter(i => i !== idx);
          // Pick the nearest remaining selected line instead of staying in the deselected pause!
          const targetIdx = nextIndices.find(i => i > idx) ?? nextIndices[nextIndices.length - 1];
          const targetLine = parsedLyrics.lines[targetIdx];
          if (targetLine) {
            setAnchorIndex(targetIdx);
            setPlayheadMs(targetLine.startMs);
            if (audioRef.current) {
              audioRef.current.currentTime = targetLine.startMs / 1000;
            }
          }
          return nextIndices;
        } else {
          const nextIndices = [...prev, idx].sort((a, b) => a - b);
          setAnchorIndex(idx);
          setPlayheadMs(parsedLyrics.lines[idx].startMs);
          if (audioRef.current) {
            audioRef.current.currentTime = parsedLyrics.lines[idx].startMs / 1000;
          }
          return nextIndices;
        }
      });
    } else if (e.shiftKey) {
      // Shift + Click: Range expand from anchor to clicked index
      const anchor = anchorIndex ?? 0;
      const start = Math.min(anchor, idx);
      const end = Math.max(anchor, idx);
      const range: number[] = [];
      for (let i = start; i <= end; i++) {
        range.push(i);
      }
      setSelectedLineIndices(range);
      setPlayheadMs(parsedLyrics.lines[idx].startMs);
      if (audioRef.current) {
        audioRef.current.currentTime = parsedLyrics.lines[idx].startMs / 1000;
      }
    } else {
      // Normal Click: Single line select
      setSelectedLineIndices([idx]);
      setAnchorIndex(idx);
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
    if (!isAutoScrollEnabled) return;
    if (isPlaying || scrubScope === 'full') {
      const el = document.getElementById(`lyric-line-${activeLineIndex}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeLineIndex, isPlaying, scrubScope, isAutoScrollEnabled]);

  // Quick range helpers
  const handleSelectAll = () => {
    setSelectedLineIndices(parsedLyrics.lines.map((_, i) => i));
    setAnchorIndex(0);
  };

  const handleExpandRange = (delta: number) => {
    if (parsedLyrics.lines.length === 0) return;
    if (delta > 0) {
      const max = selectedLineIndices.length > 0 ? Math.max(...selectedLineIndices) : -1;
      const nextIdx = Math.min(parsedLyrics.lines.length - 1, max + 1);
      if (!selectedLineIndices.includes(nextIdx)) {
        setSelectedLineIndices(prev => [...prev, nextIdx].sort((a, b) => a - b));
      }
    } else if (delta < 0 && selectedLineIndices.length > 1) {
      const max = Math.max(...selectedLineIndices);
      setSelectedLineIndices(prev => prev.filter(i => i !== max));
    }
  };

  // Live real-time OLED Preview rendering
  useEffect(() => {
    // If we already have a freshly rendered media buffer, keep it synced without background re-renders
    if (renderedMediaBuffer && !isDirty) {
      previewFramesRef.current = renderedMediaBuffer.frames;
      const offsetMs = Math.max(0, playheadMs - rangeStartMs);
      const frameIdx = Math.min(
        renderedMediaBuffer.frames.length - 1,
        Math.max(0, Math.floor((offsetMs / 1000) * 30))
      );
      if (renderedMediaBuffer.frames[frameIdx]) {
        setPreviewFrame(renderedMediaBuffer.frames[frameIdx].imageData);
      }
      return;
    }

    let active = true;
    const renderLivePreview = async () => {
      if (selectedLines.length === 0) return;
      setIsPreviewLoading(true);
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
          wordBadgeOverrides,
          motifMode,
          transitionStyle,
          vibe: songMoodProfile.vibe,
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
      } finally {
        if (active) {
          setIsPreviewLoading(false);
        }
      }
    };

    renderLivePreview();
    return () => { active = false; };
  }, [selectedLines, archetype, fontFamily, stylePack, rangeStartMs, rangeEndMs, wordOverrides, wordFontOverrides, wordMotifOverrides, motifMode, transitionStyle, audioAnalysis, renderedMediaBuffer, isDirty]);

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
    if (scrubScope === 'selection') {
      if (playheadMs < rangeStartMs || playheadMs > rangeEndMs) {
        setPlayheadMs(rangeStartMs);
        if (audioRef.current) {
          audioRef.current.currentTime = rangeStartMs / 1000;
        }
      }
    } else {
      if (playheadMs < 0 || playheadMs > songTotalDurationMs) {
        setPlayheadMs(0);
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
        }
      }
    }
  }, [rangeStartMs, rangeEndMs, scrubScope, songTotalDurationMs]);

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

    const activeMinMs = scrubScope === 'full' ? 0 : rangeStartMs;
    const activeMaxMs = scrubScope === 'full' ? songTotalDurationMs : rangeEndMs;
    const activeDuration = Math.max(1, activeMaxMs - activeMinMs);
    const playheadRatio = Math.max(0, Math.min(1, (playheadMs - activeMinMs) / activeDuration));
    const playheadX = playheadRatio * width;

    // Selection range background highlight when in full song mode
    if (scrubScope === 'full' && selectedLines.length > 0) {
      const selStartX = Math.max(0, Math.min(width, ((rangeStartMs - activeMinMs) / activeDuration) * width));
      const selEndX = Math.max(0, Math.min(width, ((rangeEndMs - activeMinMs) / activeDuration) * width));
      const selW = Math.max(3, selEndX - selStartX);

      ctx.fillStyle = themeMode === 'dark' ? 'rgba(217, 119, 87, 0.22)' : 'rgba(217, 119, 87, 0.15)';
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(selStartX, 1, selW, height - 2, 3);
        ctx.fill();
        ctx.strokeStyle = 'rgba(217, 119, 87, 0.6)';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        ctx.fillRect(selStartX, 1, selW, height - 2);
      }
    }

    if (audioAnalysis && audioAnalysis.waveform && audioAnalysis.waveform.length > 0) {
      const waveform = audioAnalysis.waveform;
      const totalAudioDuration = Math.max(1, audioAnalysis.durationMs);

      // Render vertical waveform bars across active range
      const numBars = Math.min(Math.round(100 * timelineZoom), Math.max(28, Math.floor(width / 4)));
      const barWidth = Math.max(1.5, (width / numBars) - 1.5);

      for (let i = 0; i < numBars; i++) {
        const barRatio = i / numBars;
        const barTimeMs = activeMinMs + barRatio * activeDuration;
        const barX = barRatio * width;

        let amplitude = 0.04;
        if (barTimeMs >= 0 && barTimeMs <= totalAudioDuration) {
          const wfIdx = Math.max(0, Math.min(waveform.length - 1, Math.floor((barTimeMs / totalAudioDuration) * waveform.length)));
          const point = waveform[wfIdx] || { min: 0, max: 0 };
          amplitude = Math.max(0.08, Math.min(1, Math.max(Math.abs(point.min), Math.abs(point.max))));
        }

        const barHeight = Math.max(3, amplitude * (height - 8));
        const barY = (height - barHeight) / 2;

        const isTimeInSelected = scrubScope === 'full' || selectedLines.some(l => barTimeMs >= (l.startMs - 50) && barTimeMs <= (l.endMs + 100));
        const isPlayed = barX <= playheadX;

        if (!isTimeInSelected) {
          // Deselected gap / pause - dimmed muted styling indicating it will be skipped
          ctx.fillStyle = themeMode === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.05)';
        } else if (isPlayed) {
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

      // Highlight unselected / deselected gaps in timeline
      if (scrubScope === 'selection' && selectedLines.length > 1) {
        for (let i = 0; i < selectedLines.length - 1; i++) {
          const gapStart = selectedLines[i].endMs;
          const gapEnd = selectedLines[i + 1].startMs;
          if (gapEnd > gapStart + 200) {
            const gx1 = Math.max(0, Math.min(width, ((gapStart - activeMinMs) / activeDuration) * width));
            const gx2 = Math.max(0, Math.min(width, ((gapEnd - activeMinMs) / activeDuration) * width));
            const gw = gx2 - gx1;
            if (gw > 4) {
              ctx.fillStyle = themeMode === 'dark' ? 'rgba(217, 119, 87, 0.08)' : 'rgba(217, 119, 87, 0.06)';
              ctx.fillRect(gx1, 1, gw, height - 2);
              ctx.strokeStyle = themeMode === 'dark' ? 'rgba(217, 119, 87, 0.35)' : 'rgba(217, 119, 87, 0.3)';
              ctx.lineWidth = 1;
              ctx.setLineDash([2, 3]);
              ctx.strokeRect(gx1, 1, gw, height - 2);
              ctx.setLineDash([]);

              if (gw > 38) {
                ctx.fillStyle = themeMode === 'dark' ? 'rgba(217, 119, 87, 0.8)' : 'rgba(217, 119, 87, 0.85)';
                ctx.font = 'bold 7px monospace';
                ctx.textAlign = 'center';
                ctx.fillText('SKIPPED', gx1 + gw / 2, height / 2 + 2.5);
              }
            }
          }
        }
      }

      // Render Beat Onset Marker Ticks with high contrast
      if (audioAnalysis.beatsMs && audioAnalysis.beatsMs.length > 0) {
        for (const beatMs of audioAnalysis.beatsMs) {
          if (beatMs >= activeMinMs && beatMs <= activeMaxMs) {
            const beatX = ((beatMs - activeMinMs) / activeDuration) * width;
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
  }, [audioAnalysis, rangeStartMs, rangeEndMs, playheadMs, themeMode, waveformResizeTick, scrubScope, songTotalDurationMs, timelineZoom, selectedLines]);

  // Auto-scroll timeline scroll container to keep playhead in view when zoomed
  useEffect(() => {
    if (timelineZoom <= 1 || !timelineScrollRef.current) return;
    const container = timelineScrollRef.current;
    const activeMin = scrubScope === 'full' ? 0 : rangeStartMs;
    const activeMax = scrubScope === 'full' ? songTotalDurationMs : rangeEndMs;
    const ratio = Math.max(0, Math.min(1, (playheadMs - activeMin) / Math.max(1, activeMax - activeMin)));
    const trackWidth = container.clientWidth * timelineZoom;
    const playheadPixelX = ratio * trackWidth;
    const targetScrollLeft = playheadPixelX - container.clientWidth / 2;
    container.scrollTo({ left: Math.max(0, targetScrollLeft), behavior: 'auto' });
  }, [playheadMs, timelineZoom, scrubScope, rangeStartMs, rangeEndMs, songTotalDurationMs]);

  // Non-passive wheel listener on timeline container for smooth scrubbing & panning
  useEffect(() => {
    const el = timelineScrollRef.current;
    if (!el) return;

    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // 1. Ctrl + Wheel: Zoom In / Out
      if (e.ctrlKey) {
        setTimelineZoom(prev => {
          const next = e.deltaY < 0 ? Math.min(6, prev + 1) : Math.max(1, prev - 1);
          return Math.round(next);
        });
        return;
      }

      // 2. Shift + Wheel or horizontal trackpad deltaX when zoomed: Pan timeline horizontally
      if (timelineZoom > 1 && (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY))) {
        const panDelta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        el.scrollLeft += panDelta;
        return;
      }

      // 3. Normal Vertical Wheel / Trackpad Scroll: Scrub Time!
      const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
      if (delta === 0) return;
      const direction = delta > 0 ? 1 : -1;
      const activeMin = scrubScope === 'full' ? 0 : (selectedLines[0]?.startMs ?? 0);
      const activeMax = scrubScope === 'full' ? songTotalDurationMs : (selectedLines[selectedLines.length - 1]?.endMs ?? 5000);
      const spanMs = Math.max(100, activeMax - activeMin);
      const stepMs = e.shiftKey ? 33 : Math.max(33, Math.round(spanMs * 0.015));

      setPlayheadMs(curr => {
        let targetMs = Math.max(activeMin, Math.min(activeMax, curr + direction * stepMs));
        if (scrubScope === 'selection' && selectedLines.length > 0) {
          const inSelected = selectedLines.some(l => targetMs >= (l.startMs - 50) && targetMs <= (l.endMs + 50));
          if (!inSelected) {
            const nextLine = direction > 0
              ? selectedLines.find(l => l.startMs > targetMs)
              : [...selectedLines].reverse().find(l => l.endMs < targetMs);
            if (nextLine) {
              targetMs = direction > 0 ? nextLine.startMs : nextLine.endMs;
            }
          }
        }
        if (audioRef.current) {
          audioRef.current.currentTime = targetMs / 1000;
        }
        return targetMs;
      });
    };

    el.addEventListener('wheel', onWheelNative, { passive: false });
    return () => el.removeEventListener('wheel', onWheelNative);
  }, [timelineZoom, scrubScope, songTotalDurationMs, selectedLines]);

  // Toggle audio playback
  const togglePlay = () => {
    if (!isPlaying) {
      let startFromMs = playheadMs;
      const minMs = scrubScope === 'full' ? 0 : rangeStartMs;
      const maxMs = scrubScope === 'full' ? songTotalDurationMs : rangeEndMs;
      if (startFromMs >= maxMs - 50) {
        startFromMs = minMs;
        setPlayheadMs(minMs);
      }
      // If in selection mode and sitting in a deselected gap/pause, snap to next selected line
      if (scrubScope === 'selection' && selectedLines.length > 0) {
        const inSelected = selectedLines.some(l => startFromMs >= (l.startMs - 50) && startFromMs <= (l.endMs + 120));
        if (!inSelected) {
          const nextLine = selectedLines.find(l => l.startMs > startFromMs) || selectedLines[0];
          startFromMs = nextLine.startMs;
          setPlayheadMs(startFromMs);
        }
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

  // Global spacebar playback shortcut
  useEffect(() => {
    if (isOpen === false) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept spacebar if user is typing in an input, textarea, or contentEditable
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.code === 'Space' || e.key === ' ' || e.keyCode === 32) {
        e.preventDefault();
        e.stopPropagation();
        togglePlay();
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isOpen, isPlaying, playheadMs, scrubScope, rangeStartMs, rangeEndMs, songTotalDurationMs, selectedLines]);

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
        const minMs = scrubScope === 'full' ? 0 : rangeStartMs;
        const maxMs = scrubScope === 'full' ? songTotalDurationMs : rangeEndMs;

        // Skip deselected pauses/gaps instantly when playing in selection mode
        if (scrubScope === 'selection' && selectedLines.length > 0) {
          // Check if `next` is currently inside any of our selected lines (with 120ms tail grace hold)
          const inSelectedLine = selectedLines.some(
            l => next >= (l.startMs - 50) && next <= (l.endMs + 120)
          );

          if (!inSelectedLine) {
            // We have fallen outside active selected lines into a deselected pause or gap!
            if (next < rangeStartMs) {
              next = rangeStartMs;
              if (audioRef.current) audioRef.current.currentTime = next / 1000;
              return next;
            }

            // Find the next selected line after current position
            const nextLine = selectedLines.find(l => l.startMs > next);
            if (nextLine) {
              // Immediately jump over the deselected pause to the start of the next line!
              next = nextLine.startMs;
              if (audioRef.current) {
                audioRef.current.currentTime = next / 1000;
              }
              return next;
            } else {
              // Reached the end of all selected lines -> loop cleanly to rangeStartMs
              if (audioRef.current) {
                audioRef.current.currentTime = minMs / 1000;
                audioRef.current.play().catch(() => {});
              }
              return minMs;
            }
          }
        }

        if (next >= maxMs) {
          if (audioRef.current) {
            audioRef.current.currentTime = minMs / 1000;
            audioRef.current.play().catch(() => {});
          }
          return minMs;
        }
        return next;
      });
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, rangeStartMs, rangeEndMs, scrubScope, songTotalDurationMs, selectedLines]);

  // 1. Render in Studio (Calculates 30 FPS sequence, buffers locally, does NOT close studio)
  const handleRenderInStudio = async () => {
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
          wordBadgeOverrides,
          motifMode,
          transitionStyle,
          vibe: songMoodProfile.vibe,
          audioAnalysis: audioAnalysis || undefined
        },
        progress => setRenderProgress(progress)
      );

      setRenderedMediaBuffer(renderedMedia);
      setRenderedFingerprint(currentFingerprint);
      setLastRenderedMode(inferenceMode);
      previewFramesRef.current = renderedMedia.frames;

      // Update current preview frame immediately to match playhead
      const offsetMs = Math.max(0, playheadMs - rangeStartMs);
      const frameIdx = Math.min(
        renderedMedia.frames.length - 1,
        Math.max(0, Math.floor((offsetMs / 1000) * 30))
      );
      if (renderedMedia.frames[frameIdx]) {
        setPreviewFrame(renderedMedia.frames[frameIdx].imageData);
      }
    } catch (err) {
      console.error('In-studio render failed:', err);
      alert('Render failed. Check console for details.');
    } finally {
      setIsRendering(false);
    }
  };

  // 2. Add to Timeline (Injects rendered sequence to timeline with option to stay or go)
  const handleInjectToTimeline = async (shouldClose: boolean = true) => {
    let mediaToInject = renderedMediaBuffer;

    // If not yet rendered or dirty, render first
    if (!mediaToInject || isDirty) {
      setIsRendering(true);
      setRenderProgress(0);
      try {
        mediaToInject = await renderKineticSequence(
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
            wordBadgeOverrides,
            motifMode,
            transitionStyle,
            vibe: songMoodProfile.vibe,
            audioAnalysis: audioAnalysis || undefined
          },
          progress => setRenderProgress(progress)
        );
        setRenderedMediaBuffer(mediaToInject);
        setRenderedFingerprint(currentFingerprint);
        setLastRenderedMode(inferenceMode);
        previewFramesRef.current = mediaToInject.frames;
      } catch (err) {
        console.error('Render and inject failed:', err);
        alert('Render failed. Check console for details.');
        setIsRendering(false);
        return;
      } finally {
        setIsRendering(false);
      }
    }

    if (mediaToInject) {
      onInjectToTimeline(mediaToInject, shouldClose);
      if (!shouldClose) {
        setInjectedToast(true);
        setTimeout(() => setInjectedToast(false), 3000);
      }
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
        <section className={`w-[340px] flex flex-col shrink-0 min-h-0 transition-colors duration-200 overflow-hidden ${
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
          <div className={`flex border-b p-1 gap-1 shrink-0 relative overflow-hidden ${
            themeMode === 'dark' ? 'border-[#2C2B29] bg-[#18181A]' : 'border-[#E8E5DE] bg-[#FAF9F5]'
          }`}>
            {[
              { id: 'search' as const, label: 'Search', Icon: Search },
              { id: 'paste' as const, label: 'Paste Text', Icon: FileText },
              { id: 'audio' as const, label: 'Audio Sync', Icon: Music },
            ].map(tab => {
              const isActive = ingestTab === tab.id;
              const TabIcon = tab.Icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setIngestTab(tab.id)}
                  className={`relative flex-1 py-1.5 px-2 text-xs font-sans rounded-md transition-colors cursor-pointer flex items-center justify-center gap-1.5 z-10 min-w-0 ${
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
              <div className="flex-1 flex flex-col gap-2.5 min-h-0 overflow-y-auto pr-0.5">
                {/* Title & Artist Input Row */}
                <div className="grid grid-cols-2 gap-2 shrink-0">
                  <div className="flex flex-col gap-1">
                    <label className={`text-[10px] font-sans font-medium uppercase tracking-wider ${
                      themeMode === 'dark' ? 'text-white/50' : 'text-[#87867F]'
                    }`}>
                      Song Title
                    </label>
                    <input
                      type="text"
                      value={plainLyricsTitle}
                      onChange={e => setPlainLyricsTitle(e.target.value)}
                      placeholder="e.g. Can't Help Falling in Love"
                      className={`px-2.5 py-1.5 text-xs font-sans rounded-lg border focus:outline-none focus:border-[#D97757] transition-colors shadow-xs ${
                        themeMode === 'dark'
                          ? 'bg-[#1C1C20] border-white/10 text-white placeholder-white/30'
                          : 'bg-white border-[#E8E5DE] text-[#141413] placeholder-[#87867F]'
                      }`}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className={`text-[10px] font-sans font-medium uppercase tracking-wider ${
                      themeMode === 'dark' ? 'text-white/50' : 'text-[#87867F]'
                    }`}>
                      Artist
                    </label>
                    <input
                      type="text"
                      value={plainLyricsArtist}
                      onChange={e => setPlainLyricsArtist(e.target.value)}
                      placeholder="e.g. Elvis Presley"
                      className={`px-2.5 py-1.5 text-xs font-sans rounded-lg border focus:outline-none focus:border-[#D97757] transition-colors shadow-xs ${
                        themeMode === 'dark'
                          ? 'bg-[#1C1C20] border-white/10 text-white placeholder-white/30'
                          : 'bg-white border-[#E8E5DE] text-[#141413] placeholder-[#87867F]'
                      }`}
                    />
                  </div>
                </div>

                {/* Format Detection Badge */}
                {pastedLrcText.trim() && (
                  <div className={`px-2.5 py-1.5 rounded-lg border flex items-center justify-between gap-2 text-[11px] font-sans shrink-0 ${
                    isLrcContent
                      ? themeMode === 'dark'
                        ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : themeMode === 'dark'
                        ? 'bg-[#D97757]/10 border-[#D97757]/30 text-[#E29377]'
                        : 'bg-[#FBF3EF] border-[#D97757]/30 text-[#C66545]'
                  }`}>
                    <div className="flex items-center gap-1.5 truncate">
                      {isLrcContent ? (
                        <>
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          <span className="font-medium truncate">Timestamped LRC Detected</span>
                        </>
                      ) : (
                        <>
                          <FileText className="w-3.5 h-3.5 shrink-0" />
                          <span className="font-medium truncate">Plain Text Lyrics (No Timestamps)</span>
                        </>
                      )}
                    </div>
                    <span className="text-[10px] opacity-75 shrink-0 font-mono">
                      {isLrcContent ? 'Exact Sync' : 'Auto-Timed'}
                    </span>
                  </div>
                )}

                {/* Pacing Preset Selector (shown when plain text without timestamps is detected or empty) */}
                {!isLrcContent && (
                  <div className="flex flex-col gap-1 shrink-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-sans font-medium uppercase tracking-wider ${
                        themeMode === 'dark' ? 'text-white/50' : 'text-[#87867F]'
                      }`}>
                        Line Delivery Pacing
                      </span>
                      <span className={`text-[10px] font-mono ${
                        themeMode === 'dark' ? 'text-white/40' : 'text-[#87867F]'
                      }`}>
                        {plainLyricsPacing === 'ballad' ? '~4.5s/line' : plainLyricsPacing === 'rap' ? '~2.2s/line' : '~3.4s/line'}
                      </span>
                    </div>
                    <div className={`grid grid-cols-3 gap-1 p-0.5 rounded-lg border ${
                      themeMode === 'dark' ? 'bg-[#141416] border-white/10' : 'bg-[#FAF9F5] border-[#E8E5DE]'
                    }`}>
                      {[
                        { id: 'ballad' as const, label: '🕊️ Ballad', desc: 'Slow' },
                        { id: 'pop' as const, label: '🎵 Pop', desc: 'Mid' },
                        { id: 'rap' as const, label: '⚡ Rap', desc: 'Fast' },
                      ].map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setPlainLyricsPacing(p.id)}
                          className={`py-1 px-1.5 text-[11px] font-sans rounded-md transition-all text-center cursor-pointer ${
                            plainLyricsPacing === p.id
                              ? 'bg-[#D97757] text-white font-medium shadow-xs'
                              : themeMode === 'dark'
                                ? 'text-white/60 hover:text-white hover:bg-white/5'
                                : 'text-[#5E5D59] hover:text-[#141413] hover:bg-black/5'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Lyrics Textarea */}
                <div className="flex-1 flex flex-col gap-1 min-h-[130px]">
                  <textarea
                    value={pastedLrcText}
                    onChange={e => setPastedLrcText(e.target.value)}
                    placeholder="Paste plain text lyrics (e.g. from Genius, Spotify, Notes) or raw [mm:ss.xx] LRC here..."
                    className={`flex-1 p-3 text-xs font-mono rounded-xl resize-none focus:outline-none focus:border-[#D97757] focus:ring-1 focus:ring-[#D97757] border transition-colors shadow-xs leading-relaxed ${
                      themeMode === 'dark'
                        ? 'bg-[#1C1C20] border-white/10 text-white placeholder-white/30'
                        : 'bg-white border-[#E8E5DE] text-[#141413] placeholder-[#87867F]'
                    }`}
                  />
                </div>

                {/* Primary Action Button */}
                <button
                  type="button"
                  onClick={handleApplyPastedLrc}
                  className="w-full py-2 text-xs font-sans font-medium rounded-xl bg-[#D97757] hover:bg-[#C66545] text-white transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-1.5 shrink-0"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Parse & Load Into Studio</span>
                </button>

                {/* Quick Helper Actions */}
                <div className="flex items-center justify-between pt-1 border-t border-dashed border-black/10 dark:border-white/10 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setPlainLyricsTitle("Can't Help Falling in Love");
                      setPlainLyricsArtist("Elvis Presley");
                      setPlainLyricsPacing('ballad');
                      setPastedLrcText(SAMPLE_PLAIN_FALLBACK_LYRICS);
                    }}
                    className={`text-[11px] font-sans transition-colors cursor-pointer hover:underline ${
                      themeMode === 'dark' ? 'text-[#E29377]' : 'text-[#D97757]'
                    }`}
                  >
                    Load Sample Ballad (Plain Text)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPastedLrcText('');
                    }}
                    className={`text-[11px] font-sans transition-colors cursor-pointer hover:underline ${
                      themeMode === 'dark' ? 'text-white/40 hover:text-white/70' : 'text-[#87867F] hover:text-[#141413]'
                    }`}
                  >
                    Clear Text
                  </button>
                </div>
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
                Click: Seek • Shift: Range • Ctrl: Toggle • Space: Play/Pause
              </span>
              {/* Prominent Selection Stanza Badge */}
              <span className="px-2.5 py-0.5 rounded-full bg-[#D97757]/15 border border-[#D97757]/30 text-[#D97757] font-mono text-[10px] font-semibold flex items-center gap-1">
                <span>
                  {selectedLineIndices.length === 1
                    ? `Selected: Line ${selectedLineIndices[0] + 1}`
                    : `Selected: Lines ${Math.min(...selectedLineIndices) + 1}–${Math.max(...selectedLineIndices) + 1}`}
                </span>
                <span className="opacity-40">•</span>
                <span>{selectedLines.length} {selectedLines.length === 1 ? 'line' : 'lines'}</span>
                <span className="opacity-40">•</span>
                <span>{rangeDurationSec.toFixed(1)}s</span>
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
              const isSelected = selectedLineIndices.includes(idx);
              const isActiveLine = idx === activeLineIndex;
              const isStartPin = selectedLineIndices.length > 0 && idx === Math.min(...selectedLineIndices);
              const isEndPin = selectedLineIndices.length > 0 && idx === Math.max(...selectedLineIndices);
              const isPauseLine = (!line.words || line.words.length === 0) && !line.text.trim();

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
                      {/* Header Timestamp & Selection Badges (Contained inside, zero clipping!) */}
                      <div className="flex items-center justify-between mb-2.5 flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-[#D97757] font-mono font-semibold tracking-wider">
                            {Math.floor(line.startMs / 60000)}:{((line.startMs % 60000) / 1000).toFixed(2).padStart(5, '0')}
                          </span>
                          {isStartPin && (
                            <span className="bg-[#D97757] text-white text-[8px] font-bold px-2 py-0.5 rounded shadow-xs font-mono tracking-wider">
                              START • {(line.startMs / 1000).toFixed(2)}s
                            </span>
                          )}
                          {isEndPin && (
                            <span className="bg-[#D97757] text-white text-[8px] font-bold px-2 py-0.5 rounded shadow-xs font-mono tracking-wider">
                              END • {(line.endMs / 1000).toFixed(2)}s
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {lineOverrideStatusMap[idx]?.hasCustom ? (
                            <span className="text-[8px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 flex items-center gap-1 shadow-xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              <span>{inferenceMode === 'ollama' ? '✨ AI Cloud Directed' : '✨ Custom Overrides'} ({lineOverrideStatusMap[idx].count} styles)</span>
                            </span>
                          ) : (
                            <span className="text-[8px] font-mono font-medium px-2 py-0.5 rounded bg-black/5 dark:bg-white/5 text-[#5E5D59] dark:text-white/50 border border-black/5 dark:border-white/10 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#D97757]" />
                              <span>⚡ Auto Rules</span>
                            </span>
                          )}
                          {isActiveLine && (
                            <span className="text-[8px] font-bold text-white bg-[#D97757] px-2 py-0.5 rounded uppercase font-mono tracking-wider animate-pulse">
                              PLAYING
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Clean Apple Music Typography or Pause Break */}
                      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1.5">
                        {isPauseLine ? (
                          <div className="flex items-center gap-2.5 py-1.5 px-3 rounded-lg bg-[#D97757]/10 border border-[#D97757]/20 text-[#D97757] w-full">
                            <Pause className="w-3.5 h-3.5 shrink-0" />
                            <span className="text-xs font-mono font-bold tracking-wider uppercase">
                              Instrumental / Vocal Pause
                            </span>
                            <span className="text-[10px] font-mono opacity-70">
                              ({((line.endMs - line.startMs) / 1000).toFixed(1)}s)
                            </span>
                            <span className="text-[10px] opacity-75 ml-auto italic">
                              Ctrl+Click to deselect
                            </span>
                          </div>
                        ) : line.words && line.words.length > 0 ? (
                          line.words.map((w, wIdx) => {
                            const isWordActive = isActiveLine && playheadMs >= w.startMs && playheadMs < w.endMs;
                            const isWordPast = isActiveLine ? playheadMs >= w.endMs : idx < activeLineIndex;

                            const precedingWord = wIdx > 0 ? line.words[wIdx - 1] : undefined;
                            const wordArch = getWordEffectiveArchetype(w, wIdx, archetype, wordOverrides, precedingWord, songMoodProfile);
                            const packConfig = STYLE_PACKS[stylePack] || STYLE_PACKS.trap_drill;
                            const wordFont = getWordEffectiveFont(w, wordArch, packConfig, wordFontOverrides, fontFamily);
                            const specificKey = `${w.word}_${w.startMs}`;
                            const cleanKey = cleanLyricToken(w.word);
                            const lowerRaw = w.word.toLowerCase();
                            const wordMotif = wordMotifOverrides[specificKey] || (cleanKey ? wordMotifOverrides[cleanKey] : undefined) || wordMotifOverrides[lowerRaw] || 'none';
                            const wordBadge = wordBadgeOverrides[specificKey] || (cleanKey ? wordBadgeOverrides[cleanKey] : undefined) || wordBadgeOverrides[lowerRaw] || classifyWordBadge(w.word, songMoodProfile);
                            const badgeMeta = wordBadge && wordBadge !== 'none' ? WORD_BADGE_METADATA[wordBadge] : null;
                            const isOverridden = !!(
                              wordOverrides[specificKey] || (cleanKey && wordOverrides[cleanKey]) || wordOverrides[lowerRaw] ||
                              wordFontOverrides[specificKey] || (cleanKey && wordFontOverrides[cleanKey]) || wordFontOverrides[lowerRaw] ||
                              (wordMotifOverrides[specificKey] && wordMotifOverrides[specificKey] !== 'none') ||
                              (cleanKey && wordMotifOverrides[cleanKey] && wordMotifOverrides[cleanKey] !== 'none') ||
                              (wordMotifOverrides[lowerRaw] && wordMotifOverrides[lowerRaw] !== 'none') ||
                              (wordBadgeOverrides[specificKey] && wordBadgeOverrides[specificKey] !== 'none') ||
                              (cleanKey && wordBadgeOverrides[cleanKey] && wordBadgeOverrides[cleanKey] !== 'none') ||
                              (wordBadgeOverrides[lowerRaw] && wordBadgeOverrides[lowerRaw] !== 'none')
                            );

                            return (
                              <button
                                key={wIdx}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenWordEditor(w, idx, wIdx, wordArch, wordFont, wordMotif, wordBadge);
                                }}
                                className={`text-xl md:text-2xl font-bold tracking-tight transition-all duration-150 relative inline-flex items-baseline cursor-pointer rounded-lg px-2 py-1 -my-1 group/word ${
                                  isOverridden 
                                    ? 'bg-[#D97757]/15 dark:bg-[#D97757]/20 ring-1 ring-[#D97757]/45 shadow-xs' 
                                    : 'hover:bg-black/5 dark:hover:bg-white/5'
                                } ${
                                  themeMode === 'dark'
                                    ? isWordActive
                                      ? 'text-white font-black underline decoration-[#D97757] decoration-2 underline-offset-4'
                                      : isWordPast
                                      ? 'text-white/90 hover:text-[#D97757]'
                                      : 'text-white/40 hover:text-white/80'
                                    : isWordActive
                                    ? 'text-[#1A1A1A] font-black underline decoration-[#D97757] decoration-3 underline-offset-4'
                                    : isWordPast
                                    ? 'text-[#1A1A1A] font-bold hover:text-[#D97757]'
                                    : 'text-[#888] hover:text-[#1A1A1A]'
                                }`}
                                title={isOverridden ? `Active Override: ${ARCHETYPE_METADATA[wordArch]?.name || wordArch}${badgeMeta ? ` • Badge: ${badgeMeta.name}` : ''} • Click to edit` : `Click to customize style for "${w.word}"`}
                              >
                                {/* Floating Superscript Micro-Pill Tag for Badge */}
                                {badgeMeta && (
                                  <span 
                                    className="absolute -top-3 -right-2 z-10 flex items-center justify-center min-w-4 h-4 px-1 rounded-full text-[10px] leading-none bg-[#241B17] dark:bg-[#1A1310] border border-[#D97757]/70 text-[#D97757] shadow-sm select-none pointer-events-none group-hover/word:scale-110 group-hover/word:border-[#D97757] transition-transform"
                                    title={`Badge: ${badgeMeta.name}`}
                                  >
                                    {badgeMeta.icon}
                                  </span>
                                )}
                                <span>{w.word}</span>
                                {/* Discrete Top-Right Indicator Dot for overrides without badges */}
                                {isOverridden && !badgeMeta && (
                                  <span className="absolute -top-1 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#D97757] shadow-xs" title="Custom override active" />
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
                            const wordArch = getWordEffectiveArchetype(w, wIdx, archetype, wordOverrides, precedingWord, songMoodProfile);
                            const packConfig = STYLE_PACKS[stylePack] || STYLE_PACKS.trap_drill;
                            const wordFont = getWordEffectiveFont(w, wordArch, packConfig, wordFontOverrides, fontFamily);
                            const meta = ARCHETYPE_METADATA[wordArch] || ARCHETYPE_METADATA.smooth_fluid;
                            const specificKey = `${w.word}_${w.startMs}`;
                            const cleanKey = cleanLyricToken(w.word);
                            const lowerRaw = w.word.toLowerCase();
                            const wordMotif = wordMotifOverrides[specificKey] || (cleanKey ? wordMotifOverrides[cleanKey] : undefined) || wordMotifOverrides[lowerRaw] || 'none';
                            const motifMeta = MOTIF_METADATA[wordMotif];
                            const wordBadge = wordBadgeOverrides[specificKey] || (cleanKey ? wordBadgeOverrides[cleanKey] : undefined) || wordBadgeOverrides[lowerRaw] || classifyWordBadge(w.word, songMoodProfile);
                            const badgeMeta = wordBadge && wordBadge !== 'none' ? WORD_BADGE_METADATA[wordBadge] : null;
                            const isOverridden = !!(
                              wordOverrides[specificKey] || (cleanKey && wordOverrides[cleanKey]) || wordOverrides[lowerRaw] ||
                              wordFontOverrides[specificKey] || (cleanKey && wordFontOverrides[cleanKey]) || wordFontOverrides[lowerRaw] ||
                              (wordMotifOverrides[specificKey] && wordMotifOverrides[specificKey] !== 'none') ||
                              (cleanKey && wordMotifOverrides[cleanKey] && wordMotifOverrides[cleanKey] !== 'none') ||
                              (wordMotifOverrides[lowerRaw] && wordMotifOverrides[lowerRaw] !== 'none') ||
                              (wordBadgeOverrides[specificKey] && wordBadgeOverrides[specificKey] !== 'none') ||
                              (cleanKey && wordBadgeOverrides[cleanKey] && wordBadgeOverrides[cleanKey] !== 'none') ||
                              (wordBadgeOverrides[lowerRaw] && wordBadgeOverrides[lowerRaw] !== 'none')
                            );

                            return (
                              <button
                                key={wIdx}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenWordEditor(w, idx, wIdx, wordArch, wordFont, wordMotif, wordBadge);
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
                                {badgeMeta && <span>{badgeMeta.icon}</span>}
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
                    {lineOverrideStatusMap[idx]?.hasCustom ? (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 shadow-xs" title={`${lineOverrideStatusMap[idx].count} custom overrides active`} />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-20 shrink-0" />
                    )}
                    {isPauseLine ? (
                      <div className="flex items-center gap-2 italic text-[11px] text-[#D97757]/70">
                        <Pause className="w-3 h-3 text-[#D97757]/60 shrink-0" />
                        <span>[Instrumental / Vocal Pause • {((line.endMs - line.startMs) / 1000).toFixed(1)}s • Ctrl+click to select]</span>
                      </div>
                    ) : (
                      <span className="text-lg font-medium transition-colors">
                        {line.text}
                      </span>
                    )}
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
              className={`w-full max-w-4xl px-4 py-2.5 rounded-2xl border flex items-center justify-between gap-3 shadow-xl backdrop-blur-md transition-colors duration-200 ${
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
                  <NumberFlow value={(activeScrubMaxMs / 1000).toFixed(2) + 's'} />
                </div>

                {/* Scope Toggle: Selection vs Full Song */}
                <div className={`flex items-center p-0.5 rounded-lg border text-[10px] font-sans shrink-0 ${
                  themeMode === 'dark' ? 'bg-[#232220] border-white/10' : 'bg-[#F2EFE9] border-[#E0DCD3]'
                }`}>
                  <button
                    type="button"
                    onClick={() => {
                      setScrubScope('selection');
                      if (playheadMs < rangeStartMs || playheadMs > rangeEndMs) {
                        setPlayheadMs(rangeStartMs);
                      }
                    }}
                    className={`px-2 py-0.5 rounded-md font-medium transition-all cursor-pointer ${
                      scrubScope === 'selection'
                        ? 'bg-[#D97757] text-white shadow-xs'
                        : themeMode === 'dark' ? 'text-white/60 hover:text-white' : 'text-[#5E5D59] hover:text-[#141413]'
                    }`}
                    title="Scrub only selected kinetic phrase"
                  >
                    Selection
                  </button>
                  <button
                    type="button"
                    onClick={() => setScrubScope('full')}
                    className={`px-2 py-0.5 rounded-md font-medium transition-all cursor-pointer ${
                      scrubScope === 'full'
                        ? 'bg-[#D97757] text-white shadow-xs'
                        : themeMode === 'dark' ? 'text-white/60 hover:text-white' : 'text-[#5E5D59] hover:text-[#141413]'
                    }`}
                    title="Continuous scrub across full song"
                  >
                    Full Song
                  </button>
                </div>

                {/* Live Beat Pulse Badge */}
                {audioAnalysis && (
                  <motion.div
                    layout
                    animate={isLiveBeat ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                    transition={{ duration: 0.12 }}
                    className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold transition-all select-none shrink-0 ${
                      isLiveBeat
                        ? 'bg-[#D97757] text-white shadow-[0_0_12px_rgba(217,119,87,0.7)]'
                        : themeMode === 'dark'
                        ? 'bg-[#232220] text-[#D97757] border border-[#D97757]/30'
                        : 'bg-[#FAF0EB] text-[#D97757] border border-[#D97757]/30'
                    }`}
                    title={`Detected Tempo: ${audioAnalysis.bpm} BPM (Flashing on drum hits)`}
                  >
                    <Zap className={`w-3 h-3 transition-transform ${isLiveBeat ? 'scale-125 fill-current' : ''}`} />
                    <span>{audioAnalysis.bpm} BPM</span>
                  </motion.div>
                )}
              </div>

              {/* Interactive Scrollable & Zoomable Mini-Waveform Scrubber */}
              <div className="flex-1 flex items-center gap-2 min-w-0 mx-2">
                {/* Horizontal Scrollable Timeline Track */}
                <div
                  ref={timelineScrollRef}
                  className="flex-1 overflow-x-auto overflow-y-hidden rounded-lg relative h-9 scrollbar-none select-none cursor-pointer border border-transparent hover:border-[#D97757]/30 transition-colors"
                  style={{ scrollbarWidth: 'none' }}
                  title="Hover and scroll mouse wheel to scrub time. Ctrl+Wheel to zoom. Shift+Wheel to pan."
                >
                  <div
                    className="relative h-full flex items-center"
                    style={{ width: `${timelineZoom * 100}%`, minWidth: '100%' }}
                  >
                    <canvas
                      ref={waveformCanvasRef}
                      className="w-full h-8 rounded-lg pointer-events-none"
                    />
                    <input
                      type="range"
                      min={activeScrubMinMs}
                      max={activeScrubMaxMs}
                      step={33}
                      value={playheadMs}
                      onChange={(e) => {
                        let val = parseFloat(e.target.value);
                        if (scrubScope === 'selection' && selectedLines.length > 0) {
                          const inSelected = selectedLines.some(l => val >= (l.startMs - 50) && val <= (l.endMs + 50));
                          if (!inSelected) {
                            const nextLine = selectedLines.find(l => l.startMs > val);
                            if (nextLine) {
                              val = nextLine.startMs;
                            } else {
                              val = selectedLines[selectedLines.length - 1].endMs;
                            }
                          }
                        }
                        setPlayheadMs(val);
                        if (audioRef.current) {
                          audioRef.current.currentTime = val / 1000;
                        }
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      title="Click/drag or scroll mouse wheel to scrub timeline. Ctrl+Wheel to zoom."
                    />
                  </div>
                </div>

                {/* Timeline Zoom Controls */}
                <div className={`flex items-center gap-0.5 text-[10px] font-mono shrink-0 p-0.5 rounded-lg border ${
                  themeMode === 'dark' ? 'bg-[#232220] border-white/10' : 'bg-[#F2EFE9] border-[#E0DCD3]'
                }`}>
                  <button
                    type="button"
                    onClick={() => setTimelineZoom(z => Math.max(1, z - 1))}
                    disabled={timelineZoom <= 1}
                    className="w-5 h-5 rounded flex items-center justify-center font-bold text-xs hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-25 cursor-pointer disabled:cursor-not-allowed transition-all"
                    title="Zoom Out Timeline"
                  >
                    −
                  </button>
                  <span className="min-w-6 text-center font-semibold text-[#D97757] text-[10px]">{timelineZoom}x</span>
                  <button
                    type="button"
                    onClick={() => setTimelineZoom(z => Math.min(6, z + 1))}
                    disabled={timelineZoom >= 6}
                    className="w-5 h-5 rounded flex items-center justify-center font-bold text-xs hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-25 cursor-pointer disabled:cursor-not-allowed transition-all"
                    title="Zoom In Timeline"
                  >
                    +
                  </button>
                </div>
              </div>

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
                      onClick={() => {
                        setManualWordOverrides({});
                        setManualFontOverrides({});
                        setManualMotifOverrides({});
                        setAiWordOverrides({});
                        setAiMotifOverrides({});
                        setRenderedMediaBuffer(null);
                        setRenderedFingerprint(null);
                      }}
                      className="hover:underline cursor-pointer ml-1 opacity-80 hover:opacity-100"
                    >
                      Reset
                    </button>
                  </div>
                )}
                <span className="text-[#D97757] font-medium font-mono text-[11px]">
                  {scrubScope === 'full' ? `${parsedLyrics.lines.length} lines` : `${selectedLines.length} lines`}
                </span>
                <span>•</span>
                <span className="font-mono text-[11px]">
                  {scrubScope === 'full' ? `${(songTotalDurationMs / 1000).toFixed(1)}s` : `${rangeDurationSec.toFixed(1)}s`}
                </span>
              </div>
            </motion.div>
          </div>
        </section>


        {/* ============================================================== */}
        {/* COLUMN 3: MOTION & OLED PREVIEW                               */}
        {/* ============================================================== */}
        <section className={`w-[370px] flex flex-col shrink-0 min-h-0 transition-colors duration-200 ${
          themeMode === 'dark' ? 'bg-[#18181A] text-white' : 'bg-white text-[#141413]'
        }`}>
          <div className={`p-2.5 border-b shrink-0 flex items-center justify-between ${
            themeMode === 'dark' ? 'border-[#2C2B29] bg-[#1E1E20]' : 'border-[#E8E5DE] bg-[#F5F2EB]'
          }`}>
            <h2 className={`text-[11px] font-sans font-semibold tracking-wide flex items-center gap-2 ${
              themeMode === 'dark' ? 'text-white/80' : 'text-[#141413]'
            }`}>
              <span className="w-1.5 h-1.5 rounded-full bg-[#D97757]" />
              <span>3. Motion & Display</span>
            </h2>
            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
              themeMode === 'dark' ? 'bg-white/5 text-white/50' : 'bg-black/5 text-[#5E5D59]'
            }`}>
              128×64 SSD1306
            </span>
          </div>

          {/* Compact Live OLED Display Preview with Technical HUD Corner L-Brackets */}
          <div className={`p-2.5 border-b flex flex-col items-center shrink-0 ${
            themeMode === 'dark' ? 'bg-[#141418] border-[#2C2B29]' : 'bg-[#FAF9F5] border-[#E8E5DE]'
          }`}>
            <div className="flex justify-between items-center w-full px-0.5 mb-1.5 text-[10px] font-mono">
              <span className="opacity-60 flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${
                  isAnalyzingOllama || isPreviewLoading || isRendering
                    ? 'bg-[#D97757] animate-ping'
                    : renderedMediaBuffer && !isDirty
                    ? 'bg-emerald-500'
                    : 'bg-amber-500 animate-pulse'
                }`} />
                <span>OLED PREVIEW</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isRecordingWebm || previewFramesRef.current.length === 0}
                  onClick={handleRecordWebm}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium transition-colors bg-[#D97757]/10 text-[#D97757] hover:bg-[#D97757] hover:text-white disabled:opacity-40 cursor-pointer"
                  title="Record and export animation to WebM video"
                >
                  <Video className="w-3 h-3" />
                  <span>{isRecordingWebm ? `${recordProgress}%` : 'Record WebM'}</span>
                </button>
                <span className={`font-semibold tracking-wider ${
                  isAnalyzingOllama || isPreviewLoading || isRendering
                    ? 'text-[#D97757] animate-pulse'
                    : renderedMediaBuffer && !isDirty
                    ? 'text-emerald-500'
                    : 'text-[#D97757]'
                }`}>
                  {isAnalyzingOllama
                    ? (llmProvider === 'groq' ? 'GROQ 120B DIRECTING' : 'OLLAMA DIRECTING')
                    : isPreviewLoading
                    ? 'BUFFERING PREVIEW'
                    : renderedMediaBuffer && !isDirty
                    ? 'RENDERED BUFFER'
                    : '30 FPS DRAFT'}
                </span>
              </div>
            </div>

            {/* OLED Monitor with Skiper #107 Knockout Corner L-Brackets */}
            <div className="relative p-1.5 flex items-center justify-center">
              {/* Corner L-Brackets */}
              <div className={`absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 transition-all duration-150 pointer-events-none ${
                isLiveBeat ? 'border-[#D97757] scale-110 shadow-[0_0_8px_rgba(217,119,87,0.9)]' : 'border-[#D97757]/70'
              }`} />
              <div className={`absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 transition-all duration-150 pointer-events-none ${
                isLiveBeat ? 'border-[#D97757] scale-110 shadow-[0_0_8px_rgba(217,119,87,0.9)]' : 'border-[#D97757]/70'
              }`} />
              <div className={`absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 transition-all duration-150 pointer-events-none ${
                isLiveBeat ? 'border-[#D97757] scale-110 shadow-[0_0_8px_rgba(217,119,87,0.9)]' : 'border-[#D97757]/70'
              }`} />
              <div className={`absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 transition-all duration-150 pointer-events-none ${
                isLiveBeat ? 'border-[#D97757] scale-110 shadow-[0_0_8px_rgba(217,119,87,0.9)]' : 'border-[#D97757]/70'
              }`} />

              {/* Hardware Display Box */}
              <div className="bg-black p-1 rounded-md shadow-inner flex items-center justify-center border border-white/10 ring-1 ring-black/80 relative overflow-hidden">
                <OledCanvas frameData={previewFrame} theme="cyan" scale={6} />

                {/* Live Buffer / Render Progress Overlay */}
                <AnimatePresence>
                  {(isPreviewLoading || isRendering || isAnalyzingOllama) && (
                    <motion.div
                      key="oled-loader-overlay"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="absolute inset-0 bg-black/85 backdrop-blur-[2px] flex flex-col items-center justify-center gap-3 z-20 pointer-events-none"
                    >
                      <LoaderGooeyBlobs size={12} color="#D97757" duration={1.3} />
                      <div className="flex flex-col items-center gap-0.5 text-center px-4">
                        <span className="text-[11px] font-mono font-bold text-[#D97757] tracking-wider uppercase">
                          {isAnalyzingOllama
                            ? (ollamaProgress?.message || (llmProvider === 'groq' ? 'Groq 120B Directing...' : 'Ollama Directing...'))
                            : isRendering
                            ? `Rendering Sequence (${renderProgress}%)`
                            : 'Buffering Preview...'}
                        </span>
                        <span className="text-[9px] font-mono text-white/50 tracking-wide">
                          {isAnalyzingOllama
                            ? (llmProvider === 'groq' ? 'Streaming choreography from Groq Cloud' : 'Computing local AI motion choreography')
                            : isRendering
                            ? 'Generating full 30 FPS media'
                            : 'Computing kinetic sequence'}
                        </span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Hardware Telemetry Rolling Counters */}
            <div className="flex justify-between items-center w-full px-0.5 mt-1.5 text-[10px] font-mono">
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

          {/* Unified Director Mode Segmented Bar (Auto Rules, AI Director, Single Style) */}
          <div className={`p-2 border-b shrink-0 ${
            themeMode === 'dark' ? 'border-[#2C2B29] bg-[#18181A]' : 'border-[#E8E5DE] bg-white'
          }`}>
            <div className={`flex p-0.5 rounded-xl border gap-0.5 relative ${
              themeMode === 'dark' ? 'bg-[#141418] border-white/10' : 'bg-[#FAF9F5] border-[#E8E5DE]'
            }`}>
              {[
                { id: 'auto' as const, label: 'Auto Rules', Icon: Zap },
                { id: 'ai' as const, label: 'AI Director', Icon: Sparkles },
                { id: 'manual' as const, label: 'Single Style', Icon: Sliders },
              ].map(tab => {
                const activeDirectorMode: 'auto' | 'ai' | 'manual' = 
                  directorModeTab === 'manual'
                    ? 'manual'
                    : inferenceMode === 'ollama'
                      ? 'ai'
                      : 'auto';
                const isActive = activeDirectorMode === tab.id;
                const TabIcon = tab.Icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      if (tab.id === 'auto') {
                        setDirectorModeTab('auto');
                        setInferenceMode('heuristic');
                        setArchetype('auto_semantic');
                      } else if (tab.id === 'ai') {
                        setDirectorModeTab('auto');
                        setInferenceMode('ollama');
                        setArchetype('auto_semantic');
                      } else {
                        setDirectorModeTab('manual');
                        if (archetype === 'auto_semantic') {
                          setArchetype('blade_slash');
                        }
                      }
                      setRenderedMediaBuffer(null);
                      setRenderedFingerprint(null);
                    }}
                    className={`relative flex-1 py-1.5 text-[11px] font-sans rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1 z-10 ${
                      isActive
                        ? 'text-white font-semibold'
                        : themeMode === 'dark' ? 'text-white/50 hover:text-white' : 'text-[#5E5D59] hover:text-[#141413]'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="director-mode-pill"
                        className="absolute inset-0 bg-[#D97757] rounded-lg shadow-xs -z-10"
                        transition={{ type: 'spring', bounce: 0.16, duration: 0.35 }}
                      />
                    )}
                    <TabIcon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scrollable Middle Controls with custom clean scrollbar */}
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 min-h-0">
            {/* 1. DIRECTOR ENGINE PANEL */}
            {directorModeTab === 'manual' ? (
              /* Single Style Uniform Archetypes & Hero Font */
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <label className={`text-[11px] font-sans font-semibold ${
                    themeMode === 'dark' ? 'text-white/80' : 'text-[#141413]'
                  }`}>
                    Uniform Motion Style
                  </label>
                  <span className={`text-[9px] font-mono ${themeMode === 'dark' ? 'text-white/50' : 'text-[#87867F]'}`}>
                    {ARCHETYPE_METADATA[archetype]?.name}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 max-h-[175px] overflow-y-auto pr-0.5">
                  {MANUAL_ARCHETYPES.map(archKey => {
                    const meta = ARCHETYPE_METADATA[archKey];
                    const isSelected = archetype === archKey;
                    return (
                      <button
                        key={archKey}
                        type="button"
                        onClick={() => setArchetype(archKey)}
                        className={`p-1.5 px-2 border text-left transition-all cursor-pointer flex items-center justify-between rounded-xl ${
                          isSelected
                            ? themeMode === 'dark'
                              ? 'border-[#D97757] bg-[#D97757]/15 ring-1 ring-[#D97757]/40 shadow-xs'
                              : 'border-[#D97757] bg-[#FAF0EB] ring-1 ring-[#D97757]/30 shadow-xs'
                            : themeMode === 'dark'
                            ? 'border-white/10 hover:border-white/25 bg-[#1C1C20]'
                            : 'border-[#E8E5DE] hover:border-[#D5D0C5] bg-white shadow-xs'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-sm shrink-0">{meta.icon}</span>
                          <span className={`text-[11px] font-sans font-medium truncate ${themeMode === 'dark' ? 'text-white' : 'text-[#141413]'}`}>
                            {meta.name}
                          </span>
                        </div>
                        <span className={`text-[8px] font-mono px-1 py-0.2 rounded shrink-0 uppercase ${
                          themeMode === 'dark' ? 'bg-white/10 text-white/70' : 'bg-[#FAF9F5] text-[#5E5D59] border border-[#E8E5DE]'
                        }`}>
                          {meta.tag}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Hero Font Override for Single Style */}
                <div>
                  <label className={`text-[10px] font-sans font-medium block mb-1 ${
                    themeMode === 'dark' ? 'text-white/60' : 'text-[#5E5D59]'
                  }`}>
                    Hero Font
                  </label>
                  <select
                    value={fontFamily}
                    onChange={e => setFontFamily(e.target.value)}
                    className={`w-full p-2 text-xs font-sans rounded-xl focus:outline-none focus:border-[#D97757] focus:ring-1 focus:ring-[#D97757] cursor-pointer border shadow-xs transition-colors ${
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
              </div>
            ) : inferenceMode === 'heuristic' ? (
              /* Auto Rules Deterministic Breakdown Card */
              <div className={`p-2.5 rounded-xl border flex flex-col gap-2 ${
                themeMode === 'dark' ? 'bg-[#16161A] border-white/10' : 'bg-[#FAF9F5] border-[#E8E5DE]'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[11px] font-sans font-semibold text-emerald-600 dark:text-emerald-400">
                      Deterministic Heuristic Pacer
                    </span>
                  </div>
                  {selectedStanzaStats.hasOverrides && (
                    <button
                      type="button"
                      onClick={handleClearSelectedStanzaOverrides}
                      className="text-[10px] font-sans text-rose-500 hover:text-rose-600 flex items-center gap-1 cursor-pointer font-medium"
                      title="Reset custom word overrides for this selection"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset ({selectedStanzaStats.overrideCount})</span>
                    </button>
                  )}
                </div>

                {/* 4 Micro Stat Chips */}
                <div className="grid grid-cols-4 gap-1 text-[10px] font-mono text-center">
                  <div className="p-1 rounded-lg bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10">
                    <div className="text-[9px] opacity-60">Hero</div>
                    <div className="font-bold text-[#D97757]">{selectedStanzaStats.heroCount}</div>
                  </div>
                  <div className="p-1 rounded-lg bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10">
                    <div className="text-[9px] opacity-60">Action</div>
                    <div className="font-bold">{selectedStanzaStats.actionCount}</div>
                  </div>
                  <div className="p-1 rounded-lg bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10">
                    <div className="text-[9px] opacity-60">Accents</div>
                    <div className="font-bold">{selectedStanzaStats.noveltyCount}</div>
                  </div>
                  <div className="p-1 rounded-lg bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10">
                    <div className="text-[9px] opacity-60">Anchor</div>
                    <div className="font-bold opacity-75">{selectedStanzaStats.anchorCount}</div>
                  </div>
                </div>

                {/* Applied tags */}
                {selectedStanzaStats.activeArchetypes.length > 0 ? (
                  <div className="flex items-center gap-1 text-[9px] font-mono flex-wrap pt-0.5">
                    <span className="opacity-50">Custom:</span>
                    {selectedStanzaStats.activeArchetypes.map(arch => (
                      <span key={arch} className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                        {arch}
                      </span>
                    ))}
                  </div>
                ) : selectedStanzaStats.topAutoStyles.length > 0 ? (
                  <div className="flex items-center gap-1 text-[9px] font-mono flex-wrap pt-0.5">
                    <span className="opacity-50">Styles:</span>
                    {selectedStanzaStats.topAutoStyles.map(st => (
                      <span key={st} className="px-1.5 py-0.2 rounded bg-black/5 dark:bg-white/5 border border-current/10">
                        {st}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              /* AI Cloud Director Command Deck */
              <div className={`p-2.5 rounded-xl border flex flex-col gap-2 ${
                themeMode === 'dark' ? 'bg-[#16161A] border-white/10' : 'bg-[#FAF9F5] border-[#E8E5DE]'
              }`}>
                {/* Scope & Provider Selector Row */}
                <div className="grid grid-cols-2 gap-1.5">
                  <div className={`flex p-0.5 rounded-lg border text-[10px] font-sans font-medium ${
                    themeMode === 'dark' ? 'bg-[#1F1F24] border-white/10' : 'bg-white border-[#E8E5DE]'
                  }`}>
                    {hasPartialUnprocessed && (
                      <button
                        type="button"
                        onClick={() => setAnalysisScope('unprocessed')}
                        className={`flex-1 py-1 px-1 rounded-md transition-all cursor-pointer text-center truncate ${
                          analysisScope === 'unprocessed'
                            ? 'bg-[#D97757] text-white shadow-xs font-semibold'
                            : 'text-[#87867F] hover:text-[#141413] dark:hover:text-white'
                        }`}
                        title={`Direct only the ${selectedUnprocessedLines.length} newly added/unprocessed lines`}
                      >
                        New ({selectedUnprocessedLines.length})
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setAnalysisScope('selected')}
                      className={`flex-1 py-1 px-1 rounded-md transition-all cursor-pointer text-center truncate ${
                        analysisScope === 'selected' || (!hasPartialUnprocessed && analysisScope === 'unprocessed')
                          ? 'bg-[#D97757] text-white shadow-xs font-semibold'
                          : 'text-[#87867F] hover:text-[#141413] dark:hover:text-white'
                      }`}
                      title="Analyze all selected lines"
                    >
                      {hasPartialUnprocessed ? `Sel (${selectedLines.length})` : `Selected (${selectedLines.length})`}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAnalysisScope('all')}
                      className={`flex-1 py-1 px-1 rounded-md transition-all cursor-pointer text-center truncate ${
                        analysisScope === 'all'
                          ? 'bg-[#D97757] text-white shadow-xs font-semibold'
                          : 'text-[#87867F] hover:text-[#141413] dark:hover:text-white'
                      }`}
                      title="Analyze full song"
                    >
                      All ({parsedLyrics.lines.length})
                    </button>
                  </div>

                  <div className={`flex p-0.5 rounded-lg border text-[10px] font-sans font-medium ${
                    themeMode === 'dark' ? 'bg-[#1F1F24] border-white/10' : 'bg-white border-[#E8E5DE]'
                  }`}>
                    <button
                      type="button"
                      onClick={() => setLlmProvider('groq')}
                      className={`flex-1 py-1 px-1 rounded-md transition-all cursor-pointer flex items-center justify-center gap-1 truncate ${
                        llmProvider === 'groq'
                          ? 'bg-[#D97757] text-white shadow-xs font-semibold'
                          : 'text-[#87867F] hover:text-[#141413] dark:hover:text-white'
                      }`}
                      title="Groq Cloud 120B Fast AI"
                    >
                      <Zap className="w-3 h-3 shrink-0" />
                      <span className="truncate">Groq 120B</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLlmProvider('ollama')}
                      className={`flex-1 py-1 px-1 rounded-md transition-all cursor-pointer flex items-center justify-center gap-1 truncate ${
                        llmProvider === 'ollama'
                          ? 'bg-[#D97757] text-white shadow-xs font-semibold'
                          : 'text-[#87867F] hover:text-[#141413] dark:hover:text-white'
                      }`}
                      title="Local Ollama GPU"
                    >
                      <Cpu className="w-3 h-3 shrink-0" />
                      <span className="truncate">Ollama</span>
                    </button>
                  </div>
                </div>

                {/* Optional Ollama Model Selector */}
                {llmProvider === 'ollama' && (
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <div className="flex items-center gap-1 shrink-0">
                      <span className={`w-1.5 h-1.5 rounded-full ${ollamaStatus?.online ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                      <span className={themeMode === 'dark' ? 'text-white/50' : 'text-[#87867F]'}>
                        {ollamaStatus?.online ? 'GPU Ready' : 'Offline'}
                      </span>
                    </div>
                    {ollamaStatus?.online ? (
                      <select
                        value={selectedOllamaModel}
                        onChange={(e) => setSelectedOllamaModel(e.target.value)}
                        className={`flex-1 text-[10px] font-sans p-1 rounded-md border outline-none truncate ${
                          themeMode === 'dark' ? 'bg-[#232220] text-white border-white/10' : 'bg-white text-[#141413] border-[#E8E5DE]'
                        }`}
                      >
                        {(ollamaStatus.models.length > 0 ? ollamaStatus.models : RECOMMENDED_OLLAMA_MODELS).map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-[10px] text-amber-500 truncate">Run &apos;ollama serve&apos;</span>
                    )}
                  </div>
                )}

                {/* Primary Action Button */}
                <button
                  type="button"
                  onClick={handleRunOllamaAnalysis}
                  disabled={isAnalyzingOllama || (llmProvider === 'ollama' && !ollamaStatus?.online)}
                  className={`w-full py-2 px-3 text-xs font-sans font-semibold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs ${
                    isAnalyzingOllama
                      ? 'bg-[#D97757]/40 text-white cursor-wait'
                      : llmProvider === 'ollama' && !ollamaStatus?.online
                      ? 'bg-black/10 dark:bg-white/10 text-[#87867F] cursor-not-allowed'
                      : 'bg-[#D97757] text-white hover:bg-[#C66545] active:scale-[0.99]'
                  }`}
                >
                  {isAnalyzingOllama ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span className="truncate">{ollamaProgress?.message || 'Directing Motion...'}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">
                        Direct {
                          (analysisScope === 'unprocessed' && selectedUnprocessedLines.length > 0)
                            ? `${selectedUnprocessedLines.length} New Lines`
                            : analysisScope === 'selected' || (analysisScope === 'unprocessed' && selectedUnprocessedLines.length === 0)
                            ? `${selectedLines.length} Selected Lines`
                            : `Full Song (${parsedLyrics.lines.length} Lines)`
                        }
                      </span>
                    </>
                  )}
                </button>

                {/* Progress bar */}
                {ollamaProgress && (
                  <div className="w-full bg-black/10 dark:bg-white/10 h-1 rounded-full overflow-hidden -mt-1">
                    <div
                      className="bg-[#D97757] h-full transition-all duration-300 rounded-full"
                      style={{ width: `${ollamaProgress.percent}%` }}
                    />
                  </div>
                )}

                {/* Status & Quick Action Row */}
                <div className="flex items-center justify-between text-[10px] font-sans pt-0.5">
                  {Object.keys(aiWordOverrides).length > 0 ? (
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-500 font-medium flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        <span>{Object.keys(aiWordOverrides).length} AI Styles Applied</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setAiWordOverrides({});
                          setAiMotifOverrides({});
                          setRenderedMediaBuffer(null);
                          setRenderedFingerprint(null);
                        }}
                        className="text-rose-500 hover:text-rose-600 cursor-pointer font-medium hover:underline"
                        title="Clear all AI director overrides"
                      >
                        Clear
                      </button>
                    </div>
                  ) : (
                    <span className={themeMode === 'dark' ? 'text-white/40' : 'text-[#87867F]'}>
                      No AI overrides active
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowOllamaInspector(true)}
                    className={`flex items-center gap-1 font-mono transition-opacity cursor-pointer ${
                      themeMode === 'dark' ? 'text-white/60 hover:text-white' : 'text-[#5E5D59] hover:text-[#141413]'
                    }`}
                    title="Inspect LLM raw prompts and response JSON"
                  >
                    <Terminal className="w-3 h-3 text-[#D97757]" />
                    <span>Logs{ollamaInspectionLogs.length > 0 ? ` (${ollamaInspectionLogs.length})` : ''}</span>
                  </button>
                </div>

                {/* Notice banner */}
                {lastAnalysisNotice && (
                  <div className="flex items-center justify-between p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-sans">
                    <div className="flex items-center gap-1.5 truncate">
                      <Check className="w-3 h-3 shrink-0 text-emerald-500" />
                      <span className="truncate">{lastAnalysisNotice.message}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLastAnalysisNotice(null)}
                      className="p-0.5 hover:opacity-75 cursor-pointer shrink-0"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 2. THEMATIC STYLE PACK SELECTOR (for Auto & AI modes) */}
            {directorModeTab !== 'manual' && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className={`text-[11px] font-sans font-semibold flex items-center gap-1.5 ${
                    themeMode === 'dark' ? 'text-white/80' : 'text-[#141413]'
                  }`}>
                    <span>Thematic Style Pack</span>
                    {songMoodProfile && (
                      <span className="text-[9px] font-mono font-normal text-[#D97757] bg-[#D97757]/10 px-1.5 py-0.5 rounded-full border border-[#D97757]/20 truncate max-w-[150px]" title={songMoodProfile.label}>
                        {songMoodProfile.label}
                      </span>
                    )}
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowFontHierarchy(!showFontHierarchy)}
                    className="text-[10px] font-sans text-[#D97757] hover:underline cursor-pointer flex items-center gap-0.5 font-medium shrink-0"
                  >
                    <span>{showFontHierarchy ? 'Hide Roles' : 'Font Roles'}</span>
                    {showFontHierarchy ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>

                {/* 6 Curated Style Pack Cards */}
                <div className="grid grid-cols-2 gap-1.5">
                  {(['pop_acoustic', 'editorial_lofi', 'trap_drill', 'shonen_comic', 'cartoon_bounce', 'cyber_industrial'] as StylePackId[]).map(packId => {
                    const pack = STYLE_PACKS[packId];
                    if (!pack) return null;
                    const isSelected = stylePack === packId;
                    const isRecommended = songMoodProfile?.recommendedStylePack === packId;
                    return (
                      <button
                        key={packId}
                        type="button"
                        onClick={() => {
                          setHasUserSelectedStylePack(true);
                          setStylePack(packId);
                          setFontFamily(pack.fonts.hero);
                        }}
                        className={`p-1.5 px-2 border rounded-xl text-left transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? themeMode === 'dark'
                              ? 'border-[#D97757] bg-[#D97757]/15 ring-1 ring-[#D97757]/40 shadow-xs'
                              : 'border-[#D97757] bg-[#FAF0EB] ring-1 ring-[#D97757]/30 shadow-xs'
                            : themeMode === 'dark'
                            ? 'border-white/10 hover:border-white/20 bg-[#1C1C20]'
                            : 'border-[#E8E5DE] hover:border-[#D5D0C5] bg-white shadow-xs'
                        }`}
                      >
                        <div className="min-w-0 pr-1">
                          <div className="flex items-center gap-1">
                            <span className={`text-[8px] font-mono font-bold px-1 py-0.2 rounded uppercase ${
                              isSelected ? 'bg-[#D97757] text-white' : themeMode === 'dark' ? 'bg-white/10 text-white/70' : 'bg-black/5 text-[#5E5D59]'
                            }`}>
                              {pack.tag}
                            </span>
                            {isRecommended && !isSelected && (
                              <span className="text-[9px] text-[#D97757] font-bold" title="Auto-matched to detected song vibe">
                                ★
                              </span>
                            )}
                          </div>
                          <div className={`text-[11px] font-sans font-semibold mt-0.5 truncate ${
                            themeMode === 'dark' ? 'text-white' : 'text-[#141413]'
                          }`}>
                            {pack.name}
                          </div>
                        </div>
                        {/* Live Visual Specimen */}
                        <span
                          style={{ fontFamily: pack.fonts.hero }}
                          className="text-base font-bold opacity-80 shrink-0"
                        >
                          Ag
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Collapsible Font Hierarchy Matrix */}
                <AnimatePresence>
                  {showFontHierarchy && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className={`p-2 rounded-xl border text-[10px] font-sans space-y-1 ${
                        themeMode === 'dark' ? 'bg-[#16161A] border-white/10 text-white/80' : 'bg-[#FAF9F5] border-[#E8E5DE] text-[#444]'
                      }`}>
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-[#D97757] flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#D97757]" />
                            Hero (Climax)
                          </span>
                          <span className="font-mono text-right">{STYLE_PACKS[stylePack].fonts.hero.split(',')[0].replace(/'/g, '')}</span>
                        </div>
                        <div className="flex justify-between items-center opacity-85">
                          <span className="font-medium flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40" />
                            Action (Beats)
                          </span>
                          <span className="font-mono text-right">{STYLE_PACKS[stylePack].fonts.action.split(',')[0].replace(/'/g, '')}</span>
                        </div>
                        <div className="flex justify-between items-center opacity-85">
                          <span className="font-medium flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40" />
                            Novelty (Tech/Glitch)
                          </span>
                          <span className="font-mono text-right">{STYLE_PACKS[stylePack].fonts.novelty.split(',')[0].replace(/'/g, '')}</span>
                        </div>
                        <div className="flex justify-between items-center opacity-70">
                          <span className="font-medium flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-30" />
                            Anchor (Filler Rest)
                          </span>
                          <span className="font-mono text-right">{STYLE_PACKS[stylePack].fonts.anchor.split(',')[0].replace(/['"]/g, '')}</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* 3. VISUAL MOTIFS & MANGA LAYERING */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className={`text-[11px] font-sans font-semibold ${
                  themeMode === 'dark' ? 'text-white/80' : 'text-[#141413]'
                }`}>
                  Visual Motifs & FX Layering
                </label>
                <span className={`text-[10px] font-mono ${themeMode === 'dark' ? 'text-white/40' : 'text-[#87867F]'}`}>
                  {motifMode.toUpperCase()}
                </span>
              </div>

              <div className={`flex p-0.5 rounded-xl border ${
                themeMode === 'dark' ? 'bg-[#141418] border-white/10' : 'bg-[#FAF9F5] border-[#E8E5DE]'
              }`}>
                {[
                  { id: 'off' as MotifMode, label: 'Off', desc: 'Clean typography only. Zero background visuals.' },
                  { id: 'subtle' as MotifMode, label: 'Subtle', desc: 'Minimal speedline flares on beat transients.' },
                  { id: 'dynamic' as MotifMode, label: 'Dynamic', desc: 'Semantic motif assignment per lyric meaning.' },
                  { id: 'heavy' as MotifMode, label: 'Heavy', desc: 'Full manga layering with Bayer halftones.' },
                ].map(mode => {
                  const isSelected = motifMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setMotifMode(mode.id)}
                      className={`flex-1 py-1 text-[11px] font-sans font-medium rounded-lg transition-all cursor-pointer text-center ${
                        isSelected
                          ? 'bg-[#D97757] text-white shadow-xs font-semibold'
                          : themeMode === 'dark' ? 'text-white/60 hover:text-white' : 'text-[#5E5D59] hover:text-[#141413]'
                      }`}
                      title={mode.desc}
                    >
                      {mode.label}
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

            {/* 4. TRANSITION CHOREOGRAPHY */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <label className={`text-[11px] font-sans font-semibold ${
                    themeMode === 'dark' ? 'text-white/80' : 'text-[#141413]'
                  }`}>
                    Transition Flow
                  </label>
                  {songMoodProfile && (
                    <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-semibold ${
                      songMoodProfile.vibe === 'hype_aggressive'
                        ? 'bg-rose-500/15 text-rose-500 border border-rose-500/30'
                        : songMoodProfile.vibe === 'groove_dance'
                        ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                        : 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                    }`}>
                      {songMoodProfile.vibe === 'hype_aggressive' ? '🔥 BANGER' : songMoodProfile.vibe === 'groove_dance' ? '⚡ GROOVE' : '✨ SMOOTH'}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] font-mono ${themeMode === 'dark' ? 'text-white/40' : 'text-[#87867F]'}`}>
                  {TRANSITION_METADATA[transitionStyle]?.tag || 'AUTO'}
                </span>
              </div>

              <div className={`grid grid-cols-4 gap-1 p-0.5 rounded-xl border ${
                themeMode === 'dark' ? 'bg-[#141418] border-white/10' : 'bg-[#FAF9F5] border-[#E8E5DE]'
              }`}>
                {[
                  { id: 'auto' as KineticTransitionType, label: 'Auto Vibe', desc: 'Auto-adapts between bangers (razor, glitch, flash) and smooth (glide, sweep, float).' },
                  { id: 'lateral_glide' as KineticTransitionType, label: 'Glide', desc: 'Smooth horizontal reading-axis slide.' },
                  { id: 'bayer_sweep' as KineticTransitionType, label: 'Sweep', desc: 'Directional 1-bit Bayer dither curtain scan.' },
                  { id: 'vertical_drift' as KineticTransitionType, label: 'Elevator', desc: 'Ethereal vertical float between words.' },
                  { id: 'razor_slice' as KineticTransitionType, label: 'Razor', desc: 'High-energy diagonal split razor cut with bright flash slash.' },
                  { id: 'glitch_tear' as KineticTransitionType, label: 'Glitch', desc: 'Cyberpunk horizontal row tearing and byte shift.' },
                  { id: 'impact_flash' as KineticTransitionType, label: 'Flash', desc: 'Sudden velocity zoom snap with 1-frame negative inversion punch.' },
                  { id: 'dither_dissolve' as KineticTransitionType, label: 'Dissolve', desc: 'Classic stationary 1-bit matrix crossfade.' },
                ].map(item => {
                  const isSelected = transitionStyle === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setTransitionStyle(item.id);
                        setRenderedMediaBuffer(null);
                        setRenderedFingerprint(null);
                      }}
                      className={`py-1 px-0.5 text-[10px] font-sans font-medium rounded-lg transition-all cursor-pointer text-center truncate ${
                        isSelected
                          ? 'bg-[#D97757] text-white shadow-xs font-semibold'
                          : themeMode === 'dark' ? 'text-white/60 hover:text-white' : 'text-[#5E5D59] hover:text-[#141413]'
                      }`}
                      title={item.desc}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
              <p className={`text-[10px] font-sans leading-tight ${
                themeMode === 'dark' ? 'text-white/40' : 'text-[#87867F]'
              }`}>
                {TRANSITION_METADATA[transitionStyle]?.description}
              </p>
            </div>
          </div>

          {/* Pinned Action Dock (Always visible at bottom, sleek and compact) */}
          <div className={`p-2.5 border-t flex flex-col gap-2 shrink-0 ${
            themeMode === 'dark' ? 'border-[#2C2B29] bg-[#18181A]' : 'border-[#E8E5DE] bg-white'
          }`}>
            {/* Scope Mismatch Warning Banner */}
            {analysisScope === 'all' && selectedLines.length < parsedLyrics.lines.length && (
              <div className="flex items-center justify-between text-[10px] text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg">
                <span className="truncate">AI directed all {parsedLyrics.lines.length} lines. Rendering {selectedLines.length} selected.</span>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="underline font-semibold cursor-pointer shrink-0 ml-1.5"
                >
                  Select All
                </button>
              </div>
            )}

            {/* Live Render State & Telemetry Row */}
            <div className="flex items-center justify-between text-[10px] font-mono">
              <div className="flex items-center gap-1.5 truncate">
                {isAnalyzingOllama ? (
                  <span className="flex items-center gap-1.5 text-[#D97757] font-semibold truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#D97757] animate-ping shrink-0" />
                    <span>{llmProvider === 'groq' ? 'AWAITING GROQ 120B...' : 'ANALYZING OLLAMA...'}</span>
                  </span>
                ) : isPreviewLoading ? (
                  <span className="flex items-center gap-1.5 text-[#D97757] font-semibold truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#D97757] animate-ping shrink-0" />
                    <span>BUFFERING PREVIEW...</span>
                  </span>
                ) : renderedMediaBuffer && !isDirty ? (
                  <span className="flex items-center gap-1 text-emerald-500 font-semibold truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span>BUFFERED ({lastRenderedMode === 'heuristic' ? 'AUTO' : 'AI'})</span>
                  </span>
                ) : renderedMediaBuffer && isDirty ? (
                  <span className="flex items-center gap-1 text-amber-500 font-semibold truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                    <span>SETTINGS CHANGED</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 opacity-60 truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                    <span>DRAFT READY</span>
                  </span>
                )}
                <span className="opacity-40 shrink-0">•</span>
                <span className={`truncate ${themeMode === 'dark' ? 'text-white/60' : 'text-[#5E5D59]'}`}>
                  {selectedLines.length}L • {rangeDurationSec.toFixed(1)}s
                </span>
              </div>
              <span className="text-[#D97757] font-semibold shrink-0 ml-1">
                {totalFrames}F (~{estProgmemKb} KB)
              </span>
            </div>

            {/* Action Buttons based on Dirty vs Rendered State */}
            {isDirty ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleRenderInStudio}
                  disabled={isRendering || isAnalyzingOllama || selectedLines.length === 0}
                  className={`flex-1 py-2 px-3 bg-[#D97757] hover:bg-[#C66545] text-white text-xs font-sans font-semibold rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    isRendering || isAnalyzingOllama ? 'opacity-70 cursor-wait' : ''
                  }`}
                >
                  {isRendering ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Rendering ({renderProgress}%)...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Render Preview</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleInjectToTimeline(true)}
                  disabled={isRendering || isAnalyzingOllama || selectedLines.length === 0}
                  className={`py-2 px-3 text-xs font-sans font-medium rounded-xl border transition-all cursor-pointer flex items-center justify-center gap-1 shrink-0 ${
                    themeMode === 'dark'
                      ? 'border-white/10 hover:bg-white/5 text-white/80'
                      : 'border-[#E8E5DE] hover:bg-[#FAF9F5] text-[#5E5D59]'
                  }`}
                  title="Render sequence and immediately jump to timeline editor"
                >
                  <span>Timeline</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => handleInjectToTimeline(true)}
                  disabled={isRendering || isAnalyzingOllama}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-sans font-semibold tracking-wide rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>Add to Timeline & Go to Editor</span>
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleInjectToTimeline(false)}
                    disabled={isRendering}
                    className={`flex-1 py-1.5 text-[11px] font-sans font-medium rounded-xl border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      injectedToast
                        ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/40'
                        : themeMode === 'dark'
                        ? 'border-white/10 hover:bg-white/5 text-white/80'
                        : 'border-[#E8E5DE] hover:bg-[#FAF9F5] text-[#141413]'
                    }`}
                  >
                    {injectedToast ? <Check className="w-3 h-3 text-emerald-500" /> : <Plus className="w-3 h-3 text-[#D97757]" />}
                    <span>{injectedToast ? 'Added to Timeline!' : 'Add & Stay'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleRenderInStudio}
                    disabled={isRendering}
                    className={`px-3 py-1.5 text-[11px] font-sans font-medium rounded-xl border transition-all cursor-pointer flex items-center justify-center gap-1 shrink-0 ${
                      themeMode === 'dark'
                        ? 'border-white/10 hover:bg-white/5 text-white/70'
                        : 'border-[#E8E5DE] hover:bg-[#FAF9F5] text-[#5E5D59]'
                    }`}
                    title="Force re-render sequence"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Re-render</span>
                  </button>
                </div>
              </div>
            )}
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
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[11px] font-mono ${themeMode === 'dark' ? 'text-white/50' : 'text-[#87867F]'}`}>
                    {(editingWordTarget.word.startMs / 1000).toFixed(2)}s – {(editingWordTarget.word.endMs / 1000).toFixed(2)}s ({Math.round(editingWordTarget.word.endMs - editingWordTarget.word.startMs)}ms)
                  </span>
                  {(wordOverrides[`${editingWordTarget.word.word}_${editingWordTarget.word.startMs}`] || wordOverrides[editingWordTarget.word.word.toLowerCase().replace(/[^a-z0-9]/g, '')]) ? (
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/20 font-mono font-medium">
                      ✨ Custom Override
                    </span>
                  ) : (
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/5 text-[#5E5D59] dark:text-white/60 border border-current/10 font-mono font-medium">
                      ⚡ Following Auto Rules
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={handleCancelWordEditor}
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
                { id: 'motif' as const, label: 'Visual Motif' },
                { id: 'badge' as const, label: 'Word Badge' }
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
                        setManualWordOverrides(prev => ({
                          ...prev,
                          [specificKey]: archKey
                        }));
                        setRenderedMediaBuffer(null);
                        setRenderedFingerprint(null);
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
                    (cleanLyricToken(editingWordTarget.word.word) ? wordFontOverrides[cleanLyricToken(editingWordTarget.word.word)] : undefined) ||
                    wordFontOverrides[editingWordTarget.word.word.toLowerCase()] ||
                    editingWordTarget.currentFont
                  }
                  onChange={(e) => {
                    const specificKey = `${editingWordTarget.word.word}_${editingWordTarget.word.startMs}`;
                    setManualFontOverrides(prev => ({
                      ...prev,
                      [specificKey]: e.target.value
                    }));
                    setRenderedMediaBuffer(null);
                    setRenderedFingerprint(null);
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
                  const cleanKey = cleanLyricToken(editingWordTarget.word.word);
                  const lowerRaw = editingWordTarget.word.word.toLowerCase();
                  const currentSelected = (
                    wordMotifOverrides[specificKey] ||
                    (cleanKey ? wordMotifOverrides[cleanKey] : undefined) ||
                    wordMotifOverrides[lowerRaw] ||
                    editingWordTarget.currentMotif ||
                    'none'
                  );
                  const isSelected = currentSelected === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setManualMotifOverrides(prev => ({
                          ...prev,
                          [specificKey]: m.id
                        }));
                        setRenderedMediaBuffer(null);
                        setRenderedFingerprint(null);
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

            {/* Tab 4: Word Micro-Sprite Badge */}
            {wordCustomizerTab === 'badge' && (
              <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                {Object.values(WORD_BADGE_METADATA).map(b => {
                  const specificKey = `${editingWordTarget.word.word}_${editingWordTarget.word.startMs}`;
                  const cleanKey = cleanLyricToken(editingWordTarget.word.word);
                  const lowerRaw = editingWordTarget.word.word.toLowerCase();
                  const currentSelected = (
                    wordBadgeOverrides[specificKey] ||
                    (cleanKey ? wordBadgeOverrides[cleanKey] : undefined) ||
                    wordBadgeOverrides[lowerRaw] ||
                    editingWordTarget.currentBadge ||
                    classifyWordBadge(editingWordTarget.word.word, songMoodProfile)
                  );
                  const isSelected = currentSelected === b.id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        setManualBadgeOverrides(prev => ({
                          ...prev,
                          [specificKey]: b.id
                        }));
                        setRenderedMediaBuffer(null);
                        setRenderedFingerprint(null);
                        setEditingWordTarget(prev => prev ? { ...prev, currentBadge: b.id } : null);
                      }}
                      style={{
                        backgroundColor: isSelected
                          ? (themeMode === 'dark' ? 'rgba(217, 119, 87, 0.2)' : '#FAF0EB')
                          : (themeMode === 'dark' ? '#232228' : '#FAF9F5')
                      }}
                      className={`p-2.5 border rounded-xl text-left transition-all cursor-pointer flex items-center gap-3 ${
                        isSelected
                          ? themeMode === 'dark'
                            ? 'border-[#D97757] ring-1 ring-[#D97757]/40 shadow-xs'
                            : 'border-[#D97757] ring-1 ring-[#D97757]/30 shadow-xs'
                          : themeMode === 'dark'
                          ? 'border-white/10 hover:border-white/20'
                          : 'border-[#E8E5DE] hover:border-[#D5D0C5] shadow-xs'
                      }`}
                    >
                      <span className="text-xl flex-shrink-0">{b.icon}</span>
                      <div className="flex flex-col min-w-0">
                        <span className={`text-xs font-sans font-medium truncate ${themeMode === 'dark' ? 'text-white' : 'text-[#141413]'}`}>
                          {b.name}
                        </span>
                        <span className={`text-[9px] font-mono px-1 py-0.2 rounded self-start mt-0.5 ${
                          themeMode === 'dark' ? 'bg-white/10 text-white/70' : 'bg-white text-[#5E5D59] border border-[#E8E5DE]'
                        }`}>
                          {b.tag}
                        </span>
                      </div>
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
                onClick={handleCancelWordEditor}
                className={`py-2 px-3.5 rounded-xl border text-xs font-sans font-medium transition-colors cursor-pointer ${
                  themeMode === 'dark'
                    ? 'border-white/10 hover:bg-white/10 text-white/70'
                    : 'border-[#E8E5DE] hover:bg-[#FAF9F5] text-[#5E5D59]'
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const specificKey = `${editingWordTarget.word.word}_${editingWordTarget.word.startMs}`;
                  const cleanKey = cleanLyricToken(editingWordTarget.word.word);
                  const lowerRaw = editingWordTarget.word.word.toLowerCase();

                  setManualWordOverrides(prev => {
                    const next = { ...prev };
                    delete next[specificKey];
                    if (cleanKey) delete next[cleanKey];
                    delete next[lowerRaw];
                    return next;
                  });
                  setManualFontOverrides(prev => {
                    const next = { ...prev };
                    delete next[specificKey];
                    if (cleanKey) delete next[cleanKey];
                    delete next[lowerRaw];
                    return next;
                  });
                  setManualMotifOverrides(prev => {
                    const next = { ...prev };
                    delete next[specificKey];
                    if (cleanKey) delete next[cleanKey];
                    delete next[lowerRaw];
                    return next;
                  });
                  setManualBadgeOverrides(prev => {
                    const next = { ...prev };
                    delete next[specificKey];
                    if (cleanKey) delete next[cleanKey];
                    delete next[lowerRaw];
                    return next;
                  });
                  setAiWordOverrides(prev => {
                    const next = { ...prev };
                    delete next[specificKey];
                    if (cleanKey) delete next[cleanKey];
                    delete next[lowerRaw];
                    return next;
                  });
                  setAiMotifOverrides(prev => {
                    const next = { ...prev };
                    delete next[specificKey];
                    if (cleanKey) delete next[cleanKey];
                    delete next[lowerRaw];
                    return next;
                  });
                  setAiBadgeOverrides(prev => {
                    const next = { ...prev };
                    delete next[specificKey];
                    if (cleanKey) delete next[cleanKey];
                    delete next[lowerRaw];
                    return next;
                  });
                  setRenderedMediaBuffer(null);
                  setRenderedFingerprint(null);
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
                onClick={() => {
                  setRenderedMediaBuffer(null);
                  setRenderedFingerprint(null);
                  setEditingWordTarget(null);
                }}
                className="px-6 py-2 rounded-xl text-xs font-sans font-medium bg-[#D97757] hover:bg-[#C66545] text-white transition-colors cursor-pointer shadow-xs"
              >
                Apply
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


