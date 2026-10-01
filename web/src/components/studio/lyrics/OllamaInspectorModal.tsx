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
  Layers,
  Cloud,
  Key,
  Eye,
  EyeOff,
  BookOpen
} from 'lucide-react';
import { 
  OllamaInspectionLog, 
  testSinglePromptWithOllama, 
  VALID_MOTION_ARCHETYPES,
  LLMProvider,
  GROQ_MODELS,
  getEffectiveGroqApiKey,
  saveGroqApiKey
} from '../../../engine/kinetic/ollamaClassifier';
import { ARCHETYPE_METADATA, MotionArchetype } from '../../../engine/kinetic/types';

interface OllamaInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  themeMode: 'light' | 'dark';
  selectedModel: string;
  isOnline: boolean;
  sessionLogs: OllamaInspectionLog[];
  availableModels?: string[];
  onSelectModel?: (model: string) => void;
  selectedProvider?: LLMProvider;
  onSelectProvider?: (provider: LLMProvider) => void;
}

const PRESET_TEST_LYRICS = [
  {
    title: 'Ashke - Karan Aujla (Punjabi Slang)',
    artist: 'Karan Aujla',
    lyrics: `Bebe kehndi tainu vihauna\nTe mera shashtar de naal thaaka\nSHASHTAR\nDas ki kar laina kaava'n ni mera baaja aala rakha`,
  },
  {
    title: 'Lose Yourself - Eminem (Fast Rap Flow)',
    artist: 'Eminem',
    lyrics: `His palms are sweaty, knees weak, arms are heavy\nThere's vomit on his sweater already, mom's spaghetti\nHe's nervous, but on the surface he looks calm and ready\nTo drop bombs, but he keeps on forgettin'`,
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
  availableModels,
  onSelectModel,
  selectedProvider,
  onSelectProvider,
}) => {
  const [activeTab, setActiveTab] = useState<'sandbox' | 'logs'>('sandbox');
  const [provider, setProvider] = useState<LLMProvider>(selectedProvider || (getEffectiveGroqApiKey() ? 'groq' : 'ollama'));
  const [groqApiKey, setGroqApiKey] = useState<string>(getEffectiveGroqApiKey());
  const [showApiKey, setShowApiKey] = useState(false);
  const [selectedGroqModel, setSelectedGroqModel] = useState<string>('openai/gpt-oss-120b');
  const [activeModel, setActiveModel] = useState<string>(selectedModel);

  React.useEffect(() => {
    if (selectedModel) setActiveModel(selectedModel);
  }, [selectedModel]);

  React.useEffect(() => {
    if (selectedProvider) setProvider(selectedProvider);
  }, [selectedProvider]);

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

  const handleApiKeyChange = (val: string) => {
    setGroqApiKey(val);
    saveGroqApiKey(val);
  };

  const handleRunTest = async () => {
    if (!customText.trim() || isTesting) return;
    setIsTesting(true);
    try {
      const res = await testSinglePromptWithOllama(customText, {
        provider,
        model: provider === 'groq' ? selectedGroqModel : activeModel,
        groqApiKey,
        songTitle,
        artist,
      });
      setActiveTestResult(res);
      setViewSubTab(res.parsedClassifications.length > 0 ? 'parsed' : 'raw');
    } finally {
      setIsTesting(false);
    }
  };

  const handleApplyPreset = (preset: typeof PRESET_TEST_LYRICS[0]) => {
    setCustomText(preset.lyrics);
    setSongTitle(preset.title);
    setArtist(preset.artist);
  };

  const getArchetypeColor = (_arch: MotionArchetype) => {
    return '#D97757';
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div 
        style={{ backgroundColor: themeMode === 'dark' ? '#18181B' : '#FAF9F5' }}
        className={`w-full max-w-4xl max-h-[90vh] rounded-2xl flex flex-col shadow-2xl border overflow-hidden relative z-10 transition-colors ${
          themeMode === 'dark' 
            ? 'border-white/10 text-white' 
            : 'border-[#E8E5DE] text-[#141413]'
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
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-serif text-base tracking-tight font-medium">LLM Kinetic Telemetry & Inspector</h2>

                {/* Provider Switcher */}
                <div className={`flex items-center p-0.5 rounded-lg border text-[11px] font-sans font-medium ${
                  themeMode === 'dark' ? 'bg-[#141418] border-white/10' : 'bg-[#F2EFE9] border-[#E8E5DE]'
                }`}>
                  <button
                    type="button"
                    onClick={() => {
                      setProvider('groq');
                      onSelectProvider?.('groq');
                    }}
                    className={`px-2 py-0.5 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                      provider === 'groq'
                        ? 'bg-[#D97757] text-white shadow-xs'
                        : 'text-[#87867F] hover:text-[#141413] dark:hover:text-white'
                    }`}
                  >
                    <Zap className="w-3 h-3" />
                    <span>Groq Cloud (120B)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProvider('ollama');
                      onSelectProvider?.('ollama');
                    }}
                    className={`px-2 py-0.5 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                      provider === 'ollama'
                        ? 'bg-[#D97757] text-white shadow-xs'
                        : 'text-[#87867F] hover:text-[#141413] dark:hover:text-white'
                    }`}
                  >
                    <Cpu className="w-3 h-3" />
                    <span>Local Ollama</span>
                  </button>
                </div>

                {/* Status Badges */}
                {provider === 'groq' ? (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium flex items-center gap-1 ${
                    groqApiKey 
                      ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                      : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${groqApiKey ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                    {groqApiKey ? 'Groq LPU Active' : 'API Key Required'}
                  </span>
                ) : (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium flex items-center gap-1 ${
                    isOnline 
                      ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                      : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                    {isOnline ? 'GPU Ready (66 tok/s)' : 'Offline'}
                  </span>
                )}
              </div>
              <p className={`text-xs ${themeMode === 'dark' ? 'text-white/50' : 'text-[#87867F]'}`}>
                Compare kinetic motion classification between Groq Cloud (best for Punjabi slang) and local GTX 1650 Ollama.
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
                  {/* Provider Configuration Section */}
                  {provider === 'groq' ? (
                    <div className="space-y-2.5 pb-2 border-b border-[#E8E5DE] dark:border-white/10">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] text-[#87867F] font-medium flex items-center gap-1">
                            <Key className="w-3 h-3 text-[#D97757]" /> Groq API Key
                          </label>
                          <span className="text-[9px] text-emerald-500 font-medium">Auto-saved</span>
                        </div>
                        <div className="relative flex items-center">
                          <input
                            type={showApiKey ? "text" : "password"}
                            value={groqApiKey}
                            onChange={(e) => handleApiKeyChange(e.target.value)}
                            placeholder="gsk_..."
                            className={`w-full text-xs p-2 pr-8 rounded-lg border outline-none font-mono ${
                              themeMode === 'dark' ? 'bg-[#18181B] border-white/10 text-white' : 'bg-[#FAF9F5] border-[#E8E5DE] text-[#141413]'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowApiKey(!showApiKey)}
                            className="absolute right-2 text-[#87867F] hover:text-[#D97757] cursor-pointer"
                          >
                            {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] text-[#87867F] block mb-0.5 font-medium">Groq Cloud Model</label>
                        <select
                          value={selectedGroqModel}
                          onChange={(e) => setSelectedGroqModel(e.target.value)}
                          className={`w-full text-xs p-1.5 rounded-lg border outline-none font-sans cursor-pointer ${
                            themeMode === 'dark' ? 'bg-[#18181B] text-white border-white/10' : 'bg-[#FAF9F5] text-[#141413] border-[#E8E5DE]'
                          }`}
                        >
                          {GROQ_MODELS.map((m) => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 pb-2 border-b border-[#E8E5DE] dark:border-white/10">
                      <div>
                        <label className="text-[10px] text-[#87867F] block mb-0.5 font-medium">Local GPU Model (GTX 1650)</label>
                        <select
                          value={activeModel}
                          onChange={(e) => {
                            setActiveModel(e.target.value);
                            onSelectModel?.(e.target.value);
                          }}
                          className={`w-full text-xs p-1.5 rounded-lg border outline-none font-sans cursor-pointer ${
                            themeMode === 'dark' ? 'bg-[#18181B] text-white border-white/10' : 'bg-[#FAF9F5] text-[#141413] border-[#E8E5DE]'
                          }`}
                        >
                          {(availableModels && availableModels.length > 0 ? availableModels : ['qwen3.5:2b-q4_K_M', 'qwen2.5:3b']).map((m) => (
                            <option key={m} value={m}>
                              {m} {m.includes('qwen3.5:2b-q4_K_M') ? '⚡ 66.5 tok/s (100% GPU)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
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

                  {(() => {
                    const isReadyToRun = provider === 'groq' ? Boolean(groqApiKey.trim()) : isOnline;
                    const modelLabel = provider === 'groq' 
                      ? selectedGroqModel.split('/')[1] || selectedGroqModel
                      : activeModel;

                    return (
                      <>
                        <button
                          type="button"
                          onClick={handleRunTest}
                          disabled={isTesting || !isReadyToRun}
                          className={`w-full py-2.5 px-4 text-xs font-medium rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs ${
                            isTesting
                              ? 'bg-[#D97757]/40 text-white cursor-wait'
                              : isReadyToRun
                              ? 'bg-[#D97757] text-white hover:bg-[#C66545]'
                              : 'bg-black/10 dark:bg-white/10 text-[#87867F] cursor-not-allowed'
                          }`}
                        >
                          {isTesting ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Generating with {modelLabel}...</span>
                            </>
                          ) : (
                            <>
                              <Send className="w-3.5 h-3.5" />
                              <span>Send Test Prompt to {modelLabel}</span>
                            </>
                          )}
                        </button>
                        {!isReadyToRun && (
                          <p className="text-[11px] text-amber-500 text-center font-medium">
                            {provider === 'groq' 
                              ? 'Please paste your Groq API Key above to run cloud tests.'
                              : 'Ollama is offline on http://localhost:11434. Start Ollama to run test.'}
                          </p>
                        )}
                      </>
                    );
                  })()}
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

                    {activeTestResult.parsedClassifications.length === 0 && (
                      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>No archetypes could be parsed from output. Showing <strong>Raw LLM Output</strong> below for debugging.</span>
                      </div>
                    )}

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
                          Visual motion archetype decisions made by <strong className="text-[#D97757]">{activeTestResult.model || activeModel}</strong>:
                        </span>
                        {activeTestResult.parsedClassifications.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[340px] overflow-y-auto pr-1">
                            {activeTestResult.parsedClassifications.map((item, idx) => {
                              const meta = ARCHETYPE_METADATA[item.archetype];
                              const color = getArchetypeColor(item.archetype);
                              return (
                                <div
                                  key={idx}
                                  className={`p-2.5 rounded-xl border flex flex-col gap-1.5 transition-all text-xs ${
                                    themeMode === 'dark' 
                                      ? 'bg-[#18181B] border-white/10 hover:border-white/20' 
                                      : 'bg-[#FAF9F5] border-[#E8E5DE] hover:border-[#D97757]/40'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-mono font-bold text-sm text-[#D97757] tracking-tight">
                                      "{item.word}"
                                    </span>
                                    <div 
                                      className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold whitespace-nowrap"
                                      style={{
                                        backgroundColor: `${color}18`,
                                        color: color,
                                        border: `1px solid ${color}40`,
                                      }}
                                    >
                                      {meta?.name || item.archetype}
                                    </div>
                                  </div>

                                  {item.meaning && (
                                    <div className={`text-[11px] italic font-serif flex items-start gap-1 leading-snug ${
                                      themeMode === 'dark' ? 'text-white/80' : 'text-[#3E3C38]'
                                    }`}>
                                      <span className="text-[#D97757] font-sans not-italic text-[9px] font-bold uppercase tracking-wider shrink-0 mt-0.5">
                                        Def:
                                      </span>
                                      <span>"{item.meaning}"</span>
                                    </div>
                                  )}

                                  {item.reason && (
                                    <div className={`text-[10px] leading-snug flex items-start gap-1 ${
                                      themeMode === 'dark' ? 'text-white/50' : 'text-[#87867F]'
                                    }`}>
                                      <span className="text-white/70 dark:text-white/70 font-semibold shrink-0">
                                        ⚡ Motion:
                                      </span>
                                      <span>{item.reason}</span>
                                    </div>
                                  )}
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
                      Click <strong>"Send Test Prompt"</strong> to execute live inference with <code>{activeModel}</code> on your GTX 1650 and inspect the raw prompt and response.
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
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                            log.provider === 'groq'
                              ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                              : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                          }`}>
                            {log.provider === 'groq' ? '⚡ Groq Cloud' : '💻 Local Ollama'}
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
                              title={item.meaning ? `"${item.word}": ${item.meaning} (${item.reason || ''})` : undefined}
                              className="text-[10px] font-mono px-2 py-0.5 rounded-md flex items-center gap-1 cursor-default"
                              style={{
                                backgroundColor: `${color}18`,
                                color: color,
                                border: `1px solid ${color}40`,
                              }}
                            >
                              <strong>{item.word}</strong>: {meta?.name || item.archetype}
                              {item.meaning && <span className="opacity-70 italic font-serif">({item.meaning})</span>}
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
