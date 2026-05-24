import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Sliders, ShieldCheck, Thermometer, Clock, Cpu, Award, Zap } from 'lucide-react';
import { ChatMessage, RAGConfig } from '../types';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  indexingInProgress: boolean;
  onSendMessage: (text: string) => Promise<void>;
  isLoading: boolean;
  config: RAGConfig;
  onChangeConfig: (config: RAGConfig) => void;
  onSelectMessageTrace: (msg: ChatMessage) => void;
}

export default function ChatInterface({
  messages,
  indexingInProgress,
  onSendMessage,
  isLoading,
  config,
  onChangeConfig,
  onSelectMessageTrace
}: ChatInterfaceProps) {
  const [inputText, setInputText] = useState("");
  const [showConfig, setShowConfig] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    onSendMessage(inputText);
    setInputText("");
  };

  const starterQuestions = [
    { text: "What are the core stages in a RAG pipeline?", tag: "RAG Primer" },
    { text: "What is the purpose of Chunk Overlap in document indexing?", tag: "Text Splitting" },
    { text: "Explain prompt grounding rules to reduce hallucination.", tag: "Prompt Engineering" },
  ];

  // Helper to render inline markdown-like highlights
  const renderMessageContent = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      // Handle simple list styles
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return (
          <li key={idx} className="ml-4 list-disc text-slate-700 mt-1 pl-1">
            {formatBold(line.slice(2))}
          </li>
        );
      }
      if (line.match(/^\d+\.\s/)) {
        return (
          <li key={idx} className="ml-4 list-decimal text-slate-700 mt-1 pl-1">
            {formatBold(line.replace(/^\d+\.\s/, ''))}
          </li>
        );
      }
      // Handle section headings
      if (line.startsWith('### ')) {
        return <h4 key={idx} className="text-sm font-semibold text-slate-800 mt-4 mb-2 font-sans">{line.slice(4)}</h4>;
      }
      if (line.startsWith('## ')) {
        return <h3 key={idx} className="text-base font-bold text-slate-900 mt-5 mb-2 border-b border-slate-200 pb-1 font-sans">{line.slice(3)}</h3>;
      }
      return <p key={idx} className="mb-2 text-slate-700 leading-relaxed antialiased">{formatBold(line)}</p>;
    });
  };

  const formatBold = (str: string) => {
    const parts = str.split('**');
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        return <strong key={i} className="font-bold text-indigo-700 bg-indigo-50/80 px-1 rounded">{part}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col h-full overflow-hidden">
      
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4 shrink-0">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-5 h-5 text-indigo-600" />
          <div>
            <h2 className="text-lg font-semibold text-slate-800 font-sans tracking-tight">AI Cogent Playground</h2>
            <p className="text-[10px] text-slate-400 font-mono uppercase">
              ENGINE: {config.apiMode === 'gemini' ? 'GOOGLE-GEMINI-3.5-FLASH' : 'OPENAI-GPT-4O-MINI'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowConfig(!showConfig)}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition ${
            showConfig
              ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-semibold'
              : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-100'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>PROMPT CONFIG</span>
        </button>
      </div>

      {/* Settings Panel */}
      {showConfig && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-3 shrink-0 grid grid-cols-1 md:grid-cols-2 gap-5 animate-fade-in shadow-sm">
          {/* Column 1: Core Parameters & Persona Instructions */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 font-mono mb-2">
                <span className="flex items-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  <Thermometer className="w-3.5 h-3.5 text-orange-500 mr-1" />
                  TEMPERATURE ({config.temperature})
                </span>
                <span className="text-[10px] text-slate-400 font-normal">
                  {config.temperature === 0 ? 'Strictly Factual' : config.temperature < 0.4 ? 'Factual Q&A' : 'Creative Content'}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={config.temperature}
                onChange={(e) => onChangeConfig({ ...config, temperature: Number(e.target.value) })}
                className="w-full accent-indigo-600 bg-slate-200 rounded-lg cursor-pointer"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 font-mono mb-2">
                <span className="flex items-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 mr-1" />
                  GROUNDING STRICTNESS
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1 bg-slate-200/80 p-1 rounded-lg border border-slate-250 text-center">
                {(['low', 'medium', 'high'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => onChangeConfig({ ...config, strictness: lvl })}
                    className={`py-1 rounded text-[10px] font-bold font-mono uppercase transition ${
                      config.strictness === lvl
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
              <p className="text-[9px] text-slate-400 mt-1.5 font-sans leading-relaxed">
                {config.strictness === 'high' && '👉 HIGH: Restricts answers entirely to match context chunks. Eliminates hallucinations.'}
                {config.strictness === 'medium' && '👉 MEDIUM: Prioritizes file context, uses structural grammar for fluid responses.'}
                {config.strictness === 'low' && '👉 LOW: Creative. Supplements context with global LLM world knowledge.'}
              </p>
            </div>

            <div>
              <label className="block text-[9px] font-bold text-slate-400 font-mono uppercase tracking-widest mb-1.5">
                System Instruction Prompt Template
              </label>
              <textarea
                rows={2}
                value={config.systemInstruction}
                onChange={(e) => onChangeConfig({ ...config, systemInstruction: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-850 focus:outline-none focus:border-indigo-500 font-sans leading-relaxed resize-none custom-scrollbar shadow-inner"
                placeholder="Inject custom boundaries or persona instructions..."
              />
            </div>
          </div>

          {/* Column 2: Advanced Prompt Customizations & Safety Rules */}
          <div className="space-y-4 border-t-2 md:border-t-0 md:border-l border-slate-200/80 pt-4 md:pt-0 md:pl-5 flex flex-col justify-between">
            <div>
              <span className="flex items-center text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                PROMPTING TECHNIQUE
              </span>
              <div className="grid grid-cols-3 gap-1 bg-slate-200/80 p-1 rounded-lg border border-slate-250 text-center mb-1.5 shadow-sm">
                {([
                  { value: 'standard', label: 'Standard' },
                  { value: 'few-shot', label: 'Few-Shot' },
                  { value: 'chain-of-thought', label: 'CoT' }
                ] as const).map((tech) => (
                  <button
                    key={tech.value}
                    type="button"
                    onClick={() => onChangeConfig({ ...config, promptTechnique: tech.value })}
                    className={`py-1 rounded text-[10px] font-bold font-mono uppercase transition ${
                      config.promptTechnique === tech.value
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                    title={tech.value === 'few-shot' ? 'Provides context-driven examples to guide structured answers' : tech.value === 'chain-of-thought' ? 'Forces the model to reason step-by-step prior to replying' : 'Standard direct generation'}
                  >
                    {tech.label}
                  </button>
                ))}
              </div>
              {config.promptTechnique === 'chain-of-thought' && (
                <p className="text-[9px] text-slate-400 font-sans leading-normal">
                  💡 <strong>Chain-of-Thought</strong>: Instructs the model to output its step-by-step reasoning inside a <em>"### Chain of Thought Analysis"</em> section before replying.
                </p>
              )}
              {config.promptTechnique === 'few-shot' && (
                <p className="text-[9px] text-slate-400 font-sans leading-normal">
                  💡 <strong>Few-Shot</strong>: Injects context-driven input/output examples to guide the model on formatting, citations, and hallucination bounds.
                </p>
              )}
              {config.promptTechnique === 'standard' && (
                <p className="text-[9px] text-slate-400 font-sans leading-normal">
                  💡 <strong>Standard</strong>: Simple and direct context-backed generation. Fast response generation with lower latency.
                </p>
              )}
            </div>

            <div className="space-y-2 mt-4 pt-4 border-t border-slate-200/80">
              <span className="flex items-center text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                PROMPT RULES & SAFETY INSTRUCTIONS
              </span>
              
              <label className="flex items-center space-x-2.5 cursor-pointer py-1.5 hover:bg-slate-100 rounded-lg px-2 transition select-none">
                <input
                  type="checkbox"
                  checked={config.summarizeChunks}
                  onChange={(e) => onChangeConfig({ ...config, summarizeChunks: e.target.checked })}
                  className="form-checkbox h-4 w-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                />
                <div className="flex-1">
                  <p className="text-[11px] font-semibold text-slate-800">Draft Concise Chunks Summaries</p>
                  <p className="text-[8.5px] text-slate-400 leading-normal font-sans">
                    Generates a brief 1-sentence synopsis of each context snippet before tackling the solution.
                  </p>
                </div>
              </label>

              <label className="flex items-center space-x-2.5 cursor-pointer py-1.5 hover:bg-slate-100 rounded-lg px-2 transition select-none">
                <input
                  type="checkbox"
                  checked={config.forceCitations}
                  onChange={(e) => onChangeConfig({ ...config, forceCitations: e.target.checked })}
                  className="form-checkbox h-4 w-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                />
                <div className="flex-1">
                  <p className="text-[11px] font-semibold text-slate-800">Enforce Specific Source Citations</p>
                  <p className="text-[8.5px] text-slate-400 leading-normal font-sans">
                    Instructs the model to strictly append inline bracket citations e.g. <code>[Source Reference #1]</code> to statements.
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Conversations Logs */}
      <div className="flex-1 overflow-y-auto mt-4 mb-4 space-y-4 pr-1 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col justify-center items-center py-10 px-4 text-center">
            <div className="bg-slate-50 p-4 rounded-full border border-slate-200 shadow-sm mb-4">
              <Sparkles className="w-10 h-10 text-indigo-600 animate-spin" style={{ animationDuration: '4s' }} />
            </div>
            <h3 className="text-sm font-semibold text-slate-850 mb-1">RAG Context-Aware Helper</h3>
            <p className="text-xs text-slate-400 max-w-sm mb-6 leading-relaxed font-sans">
              Ask questions backed by your uploaded documentation. The indexer will retrieve relevant contextual chunks first to answer factuality safely.
            </p>

            <div className="w-full max-w-lg grid grid-cols-1 gap-2.5">
              {starterQuestions.map((sq, i) => (
                <button
                  key={i}
                  onClick={() => onSendMessage(sq.text)}
                  className="w-full text-left p-3.5 bg-slate-50/50 hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl rounded-l-none border-l-2 border-l-slate-300 hover:border-l-indigo-600 text-xs transition duration-200 shadow-sm flex items-center justify-between"
                >
                  <p className="text-slate-700 font-semibold font-sans truncate pr-4">"{sq.text}"</p>
                  <span className="bg-white px-2 py-0.5 rounded text-[9px] text-slate-450 font-mono font-medium border border-slate-200 tracking-wider">
                    {sq.tag}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col space-y-1 ${
                msg.role === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-tr-none'
                    : 'bg-slate-100 border border-slate-200 text-slate-800 rounded-tl-none'
                }`}
              >
                {msg.role === 'user' ? (
                  <p className="font-semibold font-sans whitespace-pre-line antialiased">{msg.text}</p>
                ) : (
                  <div className="font-sans">
                    {renderMessageContent(msg.text)}
                  </div>
                )}
              </div>

              {/* Message metadata details */}
              {msg.role === 'assistant' && (
                <div className="flex items-center flex-wrap gap-2 text-[9px] font-mono text-slate-500 mt-1 pl-1">
                  <span className="flex items-center bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-sm">
                    <Cpu className="w-3 h-3 text-indigo-600 mr-1" /> {msg.modelUsed || 'GEMINI'}
                  </span>
                  {msg.latencyMs && (
                    <span className="flex items-center bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-sm">
                      <Clock className="w-3 h-3 text-indigo-600 mr-1" /> {msg.latencyMs}ms
                    </span>
                  )}
                  {msg.retrievedChunks && msg.retrievedChunks.length > 0 && (
                    <span className="flex items-center bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.5 rounded shadow-sm">
                      <Zap className="w-3 h-3 mr-1" /> {msg.retrievedChunks.length} chunks retrieved
                    </span>
                  )}
                  <button
                    onClick={() => onSelectMessageTrace(msg)}
                    className="text-indigo-650 text-[9px] font-bold hover:underline bg-white border border-slate-200 hover:border-slate-350 px-2 py-0.5 rounded ml-1 tracking-wider shadow-sm transition"
                  >
                    EXAMINE FAISS TRACE ➔
                  </button>
                </div>
              )}
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex flex-col space-y-1 items-start">
            <div className="bg-slate-100 border border-slate-200 rounded-2xl rounded-tl-none px-4 py-3 text-xs text-slate-500 flex items-center space-x-2 shadow-sm">
              <div className="flex space-x-1.5 items-center">
                <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
              <span className="font-mono text-[10px] text-slate-400">Retrieving context & reasoning...</span>
            </div>
          </div>
        )}
      </div>

      {/* Message input */}
      <form onSubmit={handleSubmit} className="mt-auto shrink-0 flex items-center bg-white border border-slate-200 rounded-xl p-1.5 mb-1.5 shadow-sm focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500/10">
        <input
          type="text"
          placeholder={indexingInProgress ? "Vector index rebuilding..." : "Ask questions regarding indexed documents..."}
          disabled={isLoading || indexingInProgress}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          className="flex-1 bg-transparent px-3 py-2 text-xs text-slate-800 outline-none focus:outline-none placeholder-slate-400 disabled:cursor-not-allowed"
        />
        <button
          type="submit"
          disabled={isLoading || !inputText.trim() || indexingInProgress}
          className={`flex items-center justify-center p-2 rounded-lg transition ${
            !inputText.trim() || isLoading || indexingInProgress
              ? 'bg-slate-100 text-slate-350'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
          }`}
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
