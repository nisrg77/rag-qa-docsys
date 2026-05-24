import React, { useState } from 'react';
import { Layers, FileCode, Sliders, Play, AlertCircle, Copy, Check } from 'lucide-react';
import { Chunk } from '../types';

interface ChunkVisualizerProps {
  chunks: Chunk[];
}

export default function ChunkVisualizer({ chunks }: ChunkVisualizerProps) {
  const [selectedChunk, setSelectedChunk] = useState<Chunk | null>(null);
  const [copied, setCopied] = useState(false);

  const copyText = (txt: string) => {
    navigator.clipboard.writeText(txt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center space-x-2 mb-4">
        <Layers className="w-5 h-5 text-indigo-600" />
        <h2 className="text-lg font-semibold text-slate-800 font-sans tracking-tight">LangChain Chunk Visualizer</h2>
      </div>

      <p className="text-xs text-slate-450 mb-5 leading-relaxed">
        This view displays the text structures segmented by the server. Overlapping boundaries are preserved to ensure sentence structures remain uninterrupted.
      </p>

      {chunks.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 border border-dashed border-slate-200 bg-slate-50/50 rounded-xl text-center shadow-inner">
          <Sliders className="w-10 h-10 text-slate-300 animate-pulse mb-3" />
          <h3 className="text-sm font-bold text-slate-750 mb-1">RAG Index Not Compiled</h3>
          <p className="text-xs text-slate-450 max-w-xs leading-relaxed">
            Upload custom documents or configure parameters, then tap the <span className="text-indigo-650 font-bold uppercase">Build RAG Semantic Index</span> button to trigger split visualizers.
          </p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col lg:grid lg:grid-cols-2 gap-4 h-full overflow-hidden">
          
          {/* List of Chunks */}
          <div className="flex flex-col h-[280px] lg:h-full overflow-hidden">
            <h3 className="text-[10px] font-bold text-slate-400 font-mono uppercase tracking-widest mb-2 flex items-center justify-between">
              <span>Segmented Chunks ({chunks.length})</span>
              <span className="bg-emerald-50 px-1.5 py-0.5 border border-emerald-100 rounded text-[9px] text-emerald-700 font-bold font-mono">FAISS Registered</span>
            </h3>
            
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {chunks.map((chunk, count) => (
                <button
                  key={chunk.id}
                  onClick={() => setSelectedChunk(chunk)}
                  className={`w-full text-left p-3 rounded-lg border text-xs leading-relaxed transition flex flex-col justify-between shadow-sm ${
                    selectedChunk?.id === chunk.id
                      ? 'bg-slate-100 border-indigo-600 text-slate-850'
                      : 'bg-slate-50/50 border-slate-200 text-slate-650 hover:border-slate-350 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between font-mono text-[10px] text-slate-400 mb-1.5 w-full">
                    <span className="text-indigo-600 font-bold flex items-center">
                      <FileCode className="w-3.5 h-3.5 mr-1" /> Chunk #{chunk.index}
                    </span>
                    <span className="font-semibold">{chunk.length} CHARS</span>
                  </div>
                  <p className="line-clamp-2 text-slate-705 antialiased font-sans">
                    {chunk.text}
                  </p>
                  <span className="text-[9px] text-slate-450 truncate mt-1.5 bg-white border border-slate-150 rounded px-1.5 py-0.5 self-start w-fit">
                    Doc: {chunk.docName}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Active Chunk Inspector */}
          <div className="flex flex-col h-[260px] lg:h-full bg-slate-50 border border-slate-200 rounded-xl p-4 overflow-hidden shadow-inner">
            {selectedChunk ? (
              <div className="flex flex-col h-full overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-3 shrink-0">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 font-mono flex items-center">
                      <FileCode className="w-4 h-4 text-indigo-600 mr-1" /> Chunk #{selectedChunk.index} Inspector
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">Origin: {selectedChunk.docName}</p>
                  </div>
                  <button
                    onClick={() => copyText(selectedChunk.text)}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition shadow-sm"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto text-xs text-slate-700 leading-relaxed font-sans pr-1 antialiased bg-white p-3 rounded-lg border border-slate-200 shadow-sm custom-scrollbar">
                  {selectedChunk.text}
                </div>

                <div className="mt-3 shrink-0 flex items-center justify-between text-[10px] font-mono text-slate-450 bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm">
                  <span>LENGTH: {selectedChunk.length} CHARS</span>
                  <span className="flex items-center text-indigo-600 font-semibold">
                    <Play className="w-3 h-3 mr-1" /> FAISS VECTOR SYNCED
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                <AlertCircle className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-xs text-slate-450 font-semibold">No Chunk Selected</p>
                <p className="text-[10px] text-slate-400 mt-1 font-sans">Tap any segmented block to inspect its full text contents.</p>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
