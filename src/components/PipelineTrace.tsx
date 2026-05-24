import React, { useState } from 'react';
import { Terminal, Cpu, Info, Search, Code, CheckCircle2, ChevronRight, Clipboard, ChevronDown, ListFilter, RotateCcw } from 'lucide-react';
import { PipelineTraceStep, ChatMessage } from '../types';

interface PipelineTraceProps {
  traces: PipelineTraceStep[];
  selectedMessage: ChatMessage | null;
  onClearTraces: () => void;
}

export default function PipelineTrace({ traces, selectedMessage, onClearTraces }: PipelineTraceProps) {
  const [activeTab, setActiveTab] = useState<'agent-logs' | 'qa-payload' | 'similarity-matrix'>('agent-logs');
  const [copied, setCopied] = useState(false);

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case 'loader': return 'text-sky-700 bg-sky-50 border-sky-100';
      case 'splitter': return 'text-indigo-700 bg-indigo-50 border-indigo-100';
      case 'embedding': return 'text-orange-700 bg-orange-50 border-orange-100';
      case 'vectorStore': return 'text-pink-700 bg-pink-50 border-pink-100';
      case 'retriever': return 'text-emerald-700 bg-emerald-50 border-emerald-100';
      case 'generator': return 'text-amber-700 bg-amber-50 border-amber-100';
      default: return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  const copyPromptToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col h-full overflow-hidden">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4 shrink-0">
        <div className="flex items-center space-x-2">
          <Terminal className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-slate-850 font-sans tracking-tight">LangChain Diagnostics Node</h2>
        </div>
        <button
          onClick={onClearTraces}
          className="text-[10px] flex items-center bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-705 hover:bg-slate-100 font-mono px-2 py-1 rounded shadow-sm transition"
        >
          <RotateCcw className="w-3 h-3 mr-1" /> Clear Logs
        </button>
      </div>

      {/* Mode Switches */}
      <div className="grid grid-cols-3 gap-1 bg-slate-100 border border-slate-200/60 p-1 rounded-lg mt-4 shrink-0 shadow-sm">
        <button
          onClick={() => setActiveTab('agent-logs')}
          className={`py-2 text-[10px] font-mono font-bold uppercase tracking-wider rounded transition ${
            activeTab === 'agent-logs' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Pipeline Logs
        </button>
        <button
          onClick={() => setActiveTab('qa-payload')}
          className={`py-2 text-[10px] font-mono font-bold uppercase tracking-wider rounded transition relative ${
            activeTab === 'qa-payload' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Prompts & Payload
          {selectedMessage && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-indigo-600 rounded-full animate-ping"></span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('similarity-matrix')}
          className={`py-2 text-[10px] font-mono font-bold uppercase tracking-wider rounded transition ${
            activeTab === 'similarity-matrix' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          FAISS Metrics
        </button>
      </div>

      {/* Tab Area */}
      <div className="flex-1 overflow-y-auto mt-4 custom-scrollbar">
        
        {/* TAB 1: Live Pipeline logs */}
        {activeTab === 'agent-logs' && (
          <div className="space-y-2">
            {traces.length === 0 ? (
              <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center">
                <Terminal className="w-8 h-8 text-slate-350 animate-pulse mb-2" />
                <p className="text-xs font-semibold text-slate-700">Pipeline logger is empty.</p>
                <p className="text-[10px] text-slate-400 mt-1 max-w-[200px] leading-relaxed">Logs are registered asynchronously as documents are indexed and query operations execute.</p>
              </div>
            ) : (
              [...traces].reverse().map((trace) => (
                <div key={trace.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-start space-x-3 text-xs shadow-sm">
                  <span className={`px-2 py-0.5 mt-0.5 rounded font-mono text-[9px] uppercase font-bold border shrink-0 ${getPhaseColor(trace.phase)}`}>
                    {trace.phase === 'vectorStore' ? 'Vec DB' : trace.phase}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-slate-800 font-bold text-xs mb-1">
                      <p className="truncate font-sans tracking-tight">{trace.title}</p>
                      <span className="text-[9px] text-slate-400 font-mono shrink-0 ml-2">
                        {new Date(trace.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-slate-600 leading-relaxed font-sans">{trace.message}</p>
                    
                    {trace.details && (
                      <pre className="mt-2 text-[10px] bg-white border border-slate-205 p-2 rounded text-indigo-700 font-mono leading-relaxed overflow-x-auto">
                        {JSON.stringify(trace.details, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 2: Dynamic Compiled Prompt (Prompt-Engineering) */}
        {activeTab === 'qa-payload' && (
          <div className="h-full flex flex-col space-y-3">
            {selectedMessage ? (
              <div className="flex flex-col h-full bg-slate-50 border border-slate-205 rounded-xl p-4 overflow-hidden relative shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-3 shrink-0">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-800 font-mono">Augmented Prompt Template</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Model used: {selectedMessage.modelUsed || 'Gemini 3.5'}</p>
                  </div>
                  <button
                    onClick={() => copyPromptToClipboard(selectedMessage.rawPrompt || '')}
                    className="flex items-center bg-white border border-slate-200 hover:bg-slate-100 text-slate-650 hover:text-slate-800 font-mono text-[10px] px-2.5 py-1.5 rounded-md transition shadow-sm font-semibold"
                  >
                    <Clipboard className="w-3.5 h-3.5 mr-1" /> {copied ? "Copied" : "Copy Payload"}
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto bg-white p-3 rounded-lg border border-slate-205 text-[11px] text-slate-650 font-mono space-y-4 whitespace-pre-wrap leading-relaxed custom-scrollbar shadow-inner">
                  {selectedMessage.rawPrompt || "No prompt payload stored."}
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <Code className="w-8 h-8 text-slate-350 mb-2" />
                <p className="text-xs font-semibold text-slate-700 font-sans">Payload Inspector Unfocused</p>
                <p className="text-[10px] text-slate-400 mt-1 max-w-sm px-4 leading-relaxed font-sans">
                  Send a query first, or tap <span className="text-indigo-650 font-semibold">EXAMINE FAISS TRACE ➔</span> inside an assistant chat response to extract and inspect the exact contextual text injected into the prompt.
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Semantic Similarity Score Charts (FAISS simulation) */}
        {activeTab === 'similarity-matrix' && (
          <div className="space-y-4">
            {selectedMessage && selectedMessage.retrievedChunks && selectedMessage.retrievedChunks.length > 0 ? (
              <div className="space-y-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg shrink-0 shadow-sm">
                  <h3 className="text-[10px] font-bold text-slate-400 font-mono uppercase tracking-widest mb-1.5">
                    Query Reference
                  </h3>
                  <p className="text-xs text-indigo-750 font-semibold italic">"{selectedMessage.text}"</p>
                </div>

                <h3 className="text-[10px] font-bold text-slate-400 font-mono uppercase tracking-widest mb-2">
                  Cosine Similarity Metrics (Target: Cosine ➔ 1.0)
                </h3>

                <div className="space-y-2.5">
                  {selectedMessage.retrievedChunks.map((chunk, i) => {
                    const pct = Math.round((chunk.score || 0) * 100);
                    return (
                      <div key={chunk.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-col space-y-2 text-xs shadow-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-emerald-705 text-[10px] font-bold flex items-center">
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-500" /> SOURCE #{i + 1}
                          </span>
                          <span className="font-mono text-[10px] text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-sm">
                            SCORE: {(chunk.score || 0).toFixed(4)}
                          </span>
                        </div>

                        {/* Visual score graph */}
                        <div className="w-full h-2 bg-slate-200 rounded-full border border-slate-250 overflow-hidden shadow-inner">
                          <div
                            className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(5, Math.min(100, pct))}%` }}
                          ></div>
                        </div>

                        <div className="pt-1">
                          <p className="text-[10px] text-slate-400 font-mono">
                            Doc: {chunk.docName} • Chunk #{chunk.index}
                          </p>
                          <blockquote className="text-[11px] italic text-slate-650 antialiased leading-relaxed mt-1.5 border-l-2 border-indigo-500 pl-2 bg-white py-1.5 pr-2 rounded-r-lg border border-slate-202 border-l-0">
                            "...{chunk.text.substring(0, 150)}..."
                          </blockquote>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <Search className="w-8 h-8 text-slate-350 mb-2" />
                <p className="text-xs font-semibold text-slate-700 font-sans">Cosine Matrix Inactive</p>
                <p className="text-[10px] text-slate-400 mt-1 max-w-sm px-4 leading-relaxed font-sans">
                  Cosine coefficients are generated live when search executions target the FAISS vector indices. Execute a chat query first to trigger analysis.
                </p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
