import React, { useState } from 'react';
import { 
  X, 
  Terminal, 
  Send, 
  Copy, 
  Check, 
  Sparkles, 
  Cpu, 
  Zap, 
  Activity, 
  RefreshCw, 
  AlertCircle, 
  FileText, 
  Code2, 
  Layers 
} from 'lucide-react';
import { 
  OllamaInspectionLog, 
  testSinglePromptWithOllama, 
  VALID_MOTION_ARCHETYPES 
} from '../../../engine/kinetic/ollamaClassifier';
import { ARCHETYPE_METADATA, MotionArchetype } from '../../../engine/kinetic/types';

interface OllamaInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  themeMode: 'light' | 'dark';
  selectedModel: string;
  isOnline: boolean;
  sessionLogs: OllamaInspectionLog[];
}

const PRESET_TEST_LYRICS = [
  {
    title: 'Ashke - Karan Aujla',
    artist: 'Karan Aujla',
    lyrics: `Bebe kehndi tainu vihauna\nTe mera shashtar de naal thaaka\nSHASHTAR\nDas ki kar laina kaava'n ni mera baaja aala rakha`,
  },
  {
    title: 'Harder Better Faster - Daft Punk',
    artist: 'Daft Punk',
    lyrics: `Work it harder make it better\nDo it faster makes us stronger\nMore than ever hour after hour\nWork is never over`,
  },
  {
    title: 'Bohemian Rhapsody - Queen',
    artist: 'Queen',
    lyrics: `Thunderbolt and lightning very very frightening me\nGalileo Figaro magnifico\nI'm just a poor boy nobody loves me\nHe's just a poor boy from a poor family`,
  }
];

export const OllamaInspectorModal: React.FC<OllamaInspectorModalProps> = ({
  isOpen,
  onClose,
  themeMode,
  selectedModel,
  isOnline,
  sessionLogs,
}) => {
  const [activeTab, setActiveTab] = useState<'sandbox' | 'logs'>('sandbox');
  const [customText, setCustomText] = useState(PRESET_TEST_LYRICS[0].lyrics);
  const [songTitle, setSongTitle] = useState(PRESET_TEST_LYRICS[0].title);
  const [artist, setArtist] = useState(PRESET_TEST_LYRICS[0].artist);
  const [isTesting, setIsTesting] = useState(false);
  const [activeTestResult, setActiveTestResult] = useState<OllamaInspectionLog | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [viewSubTab, setViewSubTab] = useState<'prompt' | 'raw' | 'parsed'>('parsed');

  if (!isOpen) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleRunTest = async () => {
    if (!customText.trim() || isTesting) return;
    setIsTesting(true);
    try {
      const res = await testSinglePromptWithOllama(customText, {
        model: selectedModel,
        songTitle,
        artist,
      });
      setActiveTestResult(res);
      setViewSubTab('parsed');
    } finally {
      setIsTesting(false);
    }
  };

  const handleApplyPreset = (preset: typeof PRESET_TEST_LYRICS[0]) => {
    setCustomText(preset.lyrics);
    setSongTitle(preset.title);
    setArtist(preset.artist);
  };

const ARCHETYPE_COLORS: Record<MotionArchetype, string> = {
  auto_semantic: '#D97757',
  manga_impact: '#E11D48',
  blade_slash: '#8B5CF6',
  cyber_glitch: '#06B6D4',
  smooth_fluid: '#14B8A6',
  '3d_block_stack': '#EAB308',
  echo_stack: '#6366F1',
  target_focus: '#3B82F6',
  snake_slither: '#10B981',
  wiggly_boil: '#EC4899',
  inverted_badge: '#F97316',
};

  const getArchetypeColor = (arch: MotionArchetype) => {
    return ARCHETYPE_COLORS[arch] || '#D97757';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div 
        className={`w-full max-w-4xl max-h-[90vh] rounded-2xl flex flex-col shadow-2xl border overflow-hidden transition-colors ${
          themeMode === 'dark' 
            ? 'bg-[#18181B] border-white/10 text-white' 
            : 'bg-[#FAF9F5] border-[#E8E5DE] text-[#141413]'
        }`}
      >
        {/* Header */}
        <div className={`p-4 border-b flex items-center justify-between ${
          themeMode === 'dark' ? 'border-white/10 bg-[#202024]' : 'border-[#E8E5DE] bg-white'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#D97757]/15 border border-[#D97757]/30 flex items-center justify-center text-[#D97757]">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-serif text-base tracking-tight font-medium">Local LLM Telemetry & Test Inspector</h2>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium flex items-center gap-1 ${
                  isOnline 
                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                    : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                  {selectedModel} ({isOnline ? 'GPU Ready' : 'Offline'})
                </span>
              </div>
              <p className={`text-xs ${themeMode === 'dark' ? 'text-white/50' : 'text-[#87867F]'}`}>
                Inspect the prompt payloads sent to your local Ollama daemon and monitor token throughput.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Top Navigation Tabs */}
            <div className={`flex items-center p-1 rounded-lg border text-xs font-sans font-medium ${
              themeMode === 'dark' ? 'bg-[#141418] border-white/10' : 'bg-[#F2EFE9] border-[#E8E5DE]'
            }`}>
              <button
                type="button"
                onClick={() => setActiveTab('sandbox')}
                className={`px-3 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'sandbox'
                    ? 'bg-[#D97757] text-white shadow-xs'
                    : 'text-[#87867F] hover:text-[#141413] dark:hover:text-white'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Test Sandbox</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('logs')}
                className={`px-3 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'logs'
                    ? 'bg-[#D97757] text-white shadow-xs'
                    : 'text-[#87867F] hover:text-[#141413] dark:hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Session Logs ({sessionLogs.length})</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                themeMode === 'dark' 
                  ? 'border-white/10 hover:bg-white/10 text-white/70 hover:text-white' 
                  : 'border-[#E8E5DE] hover:bg-black/5 text-[#5E5D59] hover:text-[#141413]'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeTab === 'sandbox' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left Column: Input Form (5 cols) */}
              <div className="lg:col-span-5 space-y-3">
                <div className={`p-3.5 rounded-xl border space-y-3 ${
                  themeMode === 'dark' ? 'bg-[#202024] border-white/10' : 'bg-white border-[#E8E5DE]'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#D97757]">
                      Test Lyrics Input
                    </span>
                    <span className="text-[10px] text-[#87867F]">Quick Presets:</span>
                  </div>

                  {/* Presets Chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_TEST_LYRICS.map((p) => (
                      <button
                        key={p.title}
                        type="button"
                        onClick={() => handleApplyPreset(p)}
                        className={`text-[11px] px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                          songTitle === p.title
                            ? 'bg-[#D97757]/15 border-[#D97757] text-[#D97757]'
                            : themeMode === 'dark'
                            ? 'border-white/10 text-white/60 hover:text-white bg-white/5'
                            : 'border-[#E8E5DE] text-[#5E5D59] hover:text-[#141413] bg-[#FAF9F5]'
                        }`}
                      >
                        {p.title.split(' - ')[0]}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-[#87867F] block mb-0.5 font-medium">Song Title</label>
                      <input
                        type="text"
                        value={songTitle}
                        onChange={(e) => setSongTitle(e.target.value)}
                        className={`w-full text-xs p-2 rounded-lg border outline-none font-sans ${
                          themeMode === 'dark' ? 'bg-[#18181B] border-white/10 text-white' : 'bg-[#FAF9F5] border-[#E8E5DE] text-[#141413]'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-[#87867F] block mb-0.5 font-medium">Artist</label>
                      <input
                        type="text"
                        value={artist}
                        onChange={(e) => setArtist(e.target.value)}
                        className={`w-full text-xs p-2 rounded-lg border outline-none font-sans ${
                          themeMode === 'dark' ? 'bg-[#18181B] border-white/10 text-white' : 'bg-[#FAF9F5] border-[#E8E5DE] text-[#141413]'
                        }`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-[#87867F] block mb-0.5 font-medium">Lyric Stanza Lines</label>
                    <textarea
                      rows={5}
                      value={customText}
                      onChange={(e) => setCustomText(e.target.value)}
                      placeholder="Type or paste lyrics to test..."
                      className={`w-full text-xs p-2.5 rounded-lg border outline-none font-mono resize-none leading-relaxed ${
                        themeMode === 'dark' ? 'bg-[#18181B] border-white/10 text-white' : 'bg-[#FAF9F5] border-[#E8E5DE] text-[#141413]'
                      }`}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleRunTest}
                    disabled={isTesting || !isOnline}
                    className={`w-full py-2.5 px-4 text-xs font-medium rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs ${
                      isTesting
                        ? 'bg-[#D97757]/40 text-white cursor-wait'
                        : isOnline
                        ? 'bg-[#D97757] text-white hover:bg-[#C66545]'
                        : 'bg-black/10 dark:bg-white/10 text-[#87867F] cursor-not-allowed'
                    }`}
                  >
                    {isTesting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Generating with {selectedModel}...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Send Test Prompt to {selectedModel}</span>
                      </>
                    )}
                  </button>
                  {!isOnline && (
                    <p className="text-[11px] text-amber-500 text-center font-medium">
                      Ollama is currently offline on http://localhost:11434. Start Ollama to run test.
                    </p>
                  )}
                </div>
              </div>

              {/* Right Column: Inspector Telemetry & Payloads (7 cols) */}
              <div className="lg:col-span-7 space-y-3">
                {activeTestResult ? (
                  <div className={`p-4 rounded-xl border space-y-3 ${
                    themeMode === 'dark' ? 'bg-[#202024] border-white/10' : 'bg-white border-[#E8E5DE]'
                  }`}>
                    {/* Performance Telemetry Bar */}
                    <div className="grid grid-cols-4 gap-2 border-b pb-3 border-[#E8E5DE] dark:border-white/10">
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-[#87867F] flex items-center gap-1">
                          <Activity className="w-3 h-3 text-[#D97757]" /> Total Latency
                        </span>
                        <p className="font-mono text-xs font-semibold text-[#D97757]">
                          {activeTestResult.totalDurationMs ? `${activeTestResult.totalDurationMs} ms` : '—'}
                        </p>
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-[10px] text-[#87867F] flex items-center gap-1">
                          <Zap className="w-3 h-3 text-emerald-500" /> Speed
                        </span>
                        <p className="font-mono text-xs font-semibold text-emerald-500">
                          {activeTestResult.tokensPerSecond ? `${activeTestResult.tokensPerSecond} tok/s` : '—'}
                        </p>
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-[10px] text-[#87867F] flex items-center gap-1">
                          <Cpu className="w-3 h-3 text-blue-500" /> Tokens Eval
                        </span>
                        <p className="font-mono text-xs font-semibold">
                          {activeTestResult.evalCount ? `${activeTestResult.evalCount} tokens` : '—'}
                        </p>
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-[10px] text-[#87867F] flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-purple-500" /> Words Mapped
                        </span>
                        <p className="font-mono text-xs font-semibold text-purple-500">
                          {activeTestResult.parsedClassifications.length} archetypes
                        </p>
                      </div>
                    </div>

                    {/* Sub-Tabs: Parsed Archetypes | Exact Prompt | Raw JSON */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 border rounded-lg p-0.5 text-xs font-medium border-[#E8E5DE] dark:border-white/10">
                        <button
                          type="button"
                          onClick={() => setViewSubTab('parsed')}
                          className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                            viewSubTab === 'parsed'
                              ? 'bg-[#D97757] text-white shadow-xs'
                              : 'text-[#87867F] hover:text-[#141413] dark:hover:text-white'
                          }`}
                        >
                          Visual Archetypes ({activeTestResult.parsedClassifications.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewSubTab('prompt')}
                          className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                            viewSubTab === 'prompt'
                              ? 'bg-[#D97757] text-white shadow-xs'
                              : 'text-[#87867F] hover:text-[#141413] dark:hover:text-white'
                          }`}
                        >
                          📤 Exact Prompt Sent
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewSubTab('raw')}
                          className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                            viewSubTab === 'raw'
                              ? 'bg-[#D97757] text-white shadow-xs'
                              : 'text-[#87867F] hover:text-[#141413] dark:hover:text-white'
                          }`}
                        >
                          📥 Raw LLM Output
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const text = viewSubTab === 'prompt' 
                            ? activeTestResult.prompt 
                            : activeTestResult.rawResponse;
                          handleCopy(text, viewSubTab);
                        }}
                        className={`text-[11px] px-2.5 py-1 rounded-md border flex items-center gap-1 transition-colors cursor-pointer ${
                          themeMode === 'dark' ? 'border-white/10 hover:bg-white/10' : 'border-[#E8E5DE] hover:bg-black/5'
                        }`}
                      >
                        {copiedKey === viewSubTab ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-500" />
                            <span className="text-emerald-500 font-medium">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Sub-tab view area */}
                    {viewSubTab === 'parsed' && (
                      <div className="space-y-2">
                        <span className="text-[11px] text-[#87867F] block">
                          Visual motion archetype decisions made by <strong className="text-[#D97757]">{selectedModel}</strong>:
                        </span>
                        {activeTestResult.parsedClassifications.length > 0 ? (
                          <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-1">
                            {activeTestResult.parsedClassifications.map((item, idx) => {
                              const meta = ARCHETYPE_METADATA[item.archetype];
                              const color = getArchetypeColor(item.archetype);
                              return (
                                <div
                                  key={idx}
                                  className={`p-2 rounded-lg border flex items-center justify-between text-xs ${
                                    themeMode === 'dark' ? 'bg-[#18181B] border-white/5' : 'bg-[#FAF9F5] border-[#E8E5DE]'
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-sm text-[#D97757]">
                                      "{item.word}"
                                    </span>
                                  </div>
                                  <div 
                                    className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold"
                                    style={{
                                      backgroundColor: `${color}18`,
                                      color: color,
                                      border: `1px solid ${color}40`,
                                    }}
                                  >
                                    {meta?.name || item.archetype}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="p-6 text-center text-xs text-[#87867F]">
                            No valid archetypes parsed from output. Check the Raw LLM Output tab.
                          </div>
                        )}
                      </div>
                    )}

                    {viewSubTab === 'prompt' && (
                      <div className="relative">
                        <pre className={`p-3 rounded-lg text-[11px] font-mono whitespace-pre-wrap max-h-[320px] overflow-y-auto border leading-relaxed ${
                          themeMode === 'dark' ? 'bg-[#141418] border-white/10 text-white/90' : 'bg-[#F2EFE9] border-[#E8E5DE] text-[#141413]'
                        }`}>
                          {activeTestResult.prompt}
                        </pre>
                      </div>
                    )}

                    {viewSubTab === 'raw' && (
                      <div className="relative">
                        <pre className={`p-3 rounded-lg text-[11px] font-mono whitespace-pre-wrap max-h-[320px] overflow-y-auto border leading-relaxed text-emerald-600 dark:text-emerald-400 ${
                          themeMode === 'dark' ? 'bg-[#141418] border-white/10' : 'bg-[#F2EFE9] border-[#E8E5DE]'
                        }`}>
                          {activeTestResult.rawResponse || 'No response returned.'}
                        </pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={`h-full min-h-[320px] rounded-xl border border-dashed flex flex-col items-center justify-center p-6 text-center ${
                    themeMode === 'dark' ? 'border-white/10 text-white/40' : 'border-[#E8E5DE] text-[#87867F]'
                  }`}>
                    <Code2 className="w-10 h-10 mb-2 opacity-50 text-[#D97757]" />
                    <p className="font-serif text-sm font-medium mb-1">Ready for Test Run</p>
                    <p className="text-xs max-w-sm">
                      Click <strong>"Send Test Prompt"</strong> to execute live inference with <code>{selectedModel}</code> on your GTX 1650 and inspect the raw prompt and response.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Tab B: Session Logs */
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#E8E5DE] dark:border-white/10">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#D97757]">
                  All Session Inferences ({sessionLogs.length} batches recorded)
                </span>
                <span className="text-xs text-[#87867F]">
                  Logs generated whenever "Analyze Lyrics" is executed in the studio.
                </span>
              </div>

              {sessionLogs.length > 0 ? (
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {sessionLogs.map((log) => (
                    <div
                      key={log.id}
                      className={`p-3.5 rounded-xl border space-y-2 transition-all ${
                        themeMode === 'dark' ? 'bg-[#202024] border-white/10' : 'bg-white border-[#E8E5DE]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-serif font-medium text-[#D97757]">
                            Stanza Batch {log.batchIndex} of {log.totalBatches}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10">
                            {log.model}
                          </span>
                          {log.tokensPerSecond && (
                            <span className="text-[10px] font-mono text-emerald-500 font-medium">
                              ⚡ {log.tokensPerSecond} tok/s
                            </span>
                          )}
                          {log.totalDurationMs && (
                            <span className="text-[10px] font-mono text-[#87867F]">
                              ({log.totalDurationMs} ms)
                            </span>
                          )}
                        </div>

                        <span className="text-[10px] text-[#87867F]">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>

                      {/* Lines Analyzed */}
                      <div className="text-xs italic text-[#5E5D59] dark:text-white/70">
                        {log.linesAnalyzed.join(' • ')}
                      </div>

                      {/* Mapped chips */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {log.parsedClassifications.map((item, cIdx) => {
                          const meta = ARCHETYPE_METADATA[item.archetype];
                          const color = getArchetypeColor(item.archetype);
                          return (
                            <span
                              key={cIdx}
                              className="text-[10px] font-mono px-2 py-0.5 rounded-md flex items-center gap-1"
                              style={{
                                backgroundColor: `${color}18`,
                                color: color,
                                border: `1px solid ${color}40`,
                              }}
                            >
                              <strong>{item.word}</strong>: {meta?.name || item.archetype}
                            </span>
                          );
                        })}
                      </div>

                      {/* Collapsible raw response */}
                      <details className="text-xs pt-1">
                        <summary className="text-[10px] text-[#87867F] hover:text-[#D97757] cursor-pointer">
                          View Prompt & Raw JSON Output
                        </summary>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <pre className={`p-2 rounded text-[10px] font-mono whitespace-pre-wrap max-h-40 overflow-y-auto ${
                            themeMode === 'dark' ? 'bg-[#141418] text-white/80' : 'bg-[#F2EFE9] text-[#141413]'
                          }`}>
                            {log.prompt}
                          </pre>
                          <pre className={`p-2 rounded text-[10px] font-mono whitespace-pre-wrap max-h-40 overflow-y-auto text-emerald-600 dark:text-emerald-400 ${
                            themeMode === 'dark' ? 'bg-[#141418]' : 'bg-[#F2EFE9]'
                          }`}>
                            {log.rawResponse}
                          </pre>
                        </div>
                      </details>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={`p-8 text-center text-xs rounded-xl border border-dashed ${
                  themeMode === 'dark' ? 'border-white/10 text-white/40' : 'border-[#E8E5DE] text-[#87867F]'
                }`}>
                  <p>No session logs recorded yet.</p>
                  <p className="mt-1 opacity-70">
                    Run <strong>"Analyze Lyrics with {selectedModel}"</strong> in the studio or use the <strong>Test Sandbox</strong> tab to generate logs.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
