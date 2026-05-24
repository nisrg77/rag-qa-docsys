import React, { useRef, useState } from 'react';
import { Upload, FileText, CheckCircle, RefreshCw, Trash2, Database, HelpCircle, Inbox, FileCode } from 'lucide-react';
import { Document, ChunkingStrategy } from '../types';

interface DocumentManagerProps {
  documents: Document[];
  indexingInProgress: boolean;
  onUpload: (name: string, type: 'pdf' | 'txt' | 'md', content: string, size: number) => Promise<void>;
  onIndex: (chunkSize: number, chunkOverlap: number, apiMode: 'gemini' | 'openai', openaiKey: string, strategy: ChunkingStrategy) => Promise<void>;
  onReset: () => Promise<void>;
  chunkSize: number;
  setChunkSize: (size: number) => void;
  chunkOverlap: number;
  setChunkOverlap: (overlap: number) => void;
  apiMode: 'gemini' | 'openai';
  setApiMode: (mode: 'gemini' | 'openai') => void;
  openaiKey: string;
  setOpenaiKey: (key: string) => void;
  chunkingStrategy: ChunkingStrategy;
  setChunkingStrategy: (strategy: ChunkingStrategy) => void;
}

export default function DocumentManager({
  documents,
  indexingInProgress,
  onUpload,
  onIndex,
  onReset,
  chunkSize,
  setChunkSize,
  chunkOverlap,
  setChunkOverlap,
  apiMode,
  setApiMode,
  openaiKey,
  setOpenaiKey,
  chunkingStrategy,
  setChunkingStrategy
}: DocumentManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [showSettings, setShowSettings] = useState(true);

  const handleFile = (file: File) => {
    if (!file) return;
    const name = file.name;
    const size = file.size;
    const ext = name.split('.').pop()?.toLowerCase();
    
    let type: 'pdf' | 'txt' | 'md';
    if (ext === 'pdf') {
      type = 'pdf';
    } else if (ext === 'md') {
      type = 'md';
    } else if (ext === 'txt') {
      type = 'txt';
    } else {
      alert("Unsupported file format! Please upload PDF, TXT, or MD files.");
      return;
    }

    const reader = new FileReader();
    if (type === 'pdf') {
      reader.onload = async () => {
        const result = reader.result as string;
        // Extract raw base64 context from data url
        const base64 = result.split(',')[1];
        await onUpload(name, type, base64, size);
      };
      reader.readAsDataURL(file);
    } else {
      reader.onload = async () => {
        const text = reader.result as string;
        await onUpload(name, type, text, size);
      };
      reader.readAsText(file);
    }
  };

  const onDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Database className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-slate-800 font-sans tracking-tight">FAISS Document Store</h2>
        </div>
        <button
          onClick={onReset}
          className="text-xs flex items-center bg-slate-100 hover:bg-slate-200 text-slate-600 font-mono px-2.5 py-1.5 rounded-md border border-slate-250 transition"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1 text-slate-500" /> Reset Index
        </button>
      </div>

      {/* Drag & Drop Box */}
      <div
        onDragEnter={onDrag}
        onDragOver={onDrag}
        onDragLeave={onDrag}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 mb-6 flex flex-col items-center justify-center text-center cursor-pointer transition ${
          dragActive
            ? 'border-indigo-600 bg-indigo-50/50'
            : 'border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.md"
          className="hidden"
          onChange={handleInputChange}
        />
        <div className="bg-white p-3 rounded-full border border-slate-100 text-indigo-600 mb-3 shadow-sm">
          <Upload className="w-6 h-6 animate-pulse" />
        </div>
        <p className="text-sm font-medium text-slate-800">Drag files here or click to upload</p>
        <p className="text-xs text-slate-400 mt-1">Accepts custom PDF, text (TXT), or markdown (MD)</p>
      </div>

      {/* Ingested Documents List */}
      <div className="flex-1 overflow-y-auto space-y-2 mb-6 max-h-[220px] pr-1">
        <h3 className="text-[10px] font-bold text-slate-400 font-mono uppercase tracking-widest mb-2">
          Ingested Documents ({documents.length})
        </h3>
        {documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 border border-dashed border-slate-200 rounded-lg text-slate-400 bg-slate-50/50">
            <Inbox className="w-8 h-8 mb-1 opacity-65 text-slate-400" />
            <p className="text-xs">No documents uploaded</p>
          </div>
        ) : (
          documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-3 bg-slate-50/50 hover:bg-slate-50 border border-slate-150 rounded-lg hover:border-slate-300 transition"
            >
              <div className="flex items-center space-x-3 truncate max-w-[80%]">
                <div className="bg-white p-2 rounded-md border border-slate-200">
                  {doc.type === 'pdf' ? (
                    <FileCode className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <FileText className="w-4 h-4 text-indigo-600" />
                  )}
                </div>
                <div className="truncate">
                  <p className="text-xs font-semibold text-slate-800 truncate" title={doc.name}>
                    {doc.name}
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono uppercase mt-0.5">
                    {(doc.size / 1024).toFixed(1)} KB • {doc.type.toUpperCase()}
                  </p>
                </div>
              </div>

              {/* Status or loading indicators */}
              <div className="flex items-center space-x-2">
                {doc.status === 'indexed' ? (
                  <div className="flex items-center bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full px-2.5 py-0.5 text-[10px] font-semibold font-mono">
                    <CheckCircle className="w-3 h-3 mr-1 text-emerald-500" /> Ready
                  </div>
                ) : doc.status === 'processing' ? (
                  <div className="flex items-center text-indigo-600 text-[10px] font-semibold font-mono">
                    <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Splitting
                  </div>
                ) : (
                  <div className="flex items-center bg-slate-100 text-slate-500 border border-slate-200 rounded-full px-2 py-0.5 text-[10px] font-mono">
                    Pending
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* RAG Pipeline Settings Configuration Block */}
      <div className="bg-slate-50 border border-slate-205/60 rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3 text-slate-800 font-semibold text-xs">
          <span>LangChain Splitting Parameters</span>
          <HelpCircle className="w-4 h-4 text-slate-400 hover:text-indigo-600 cursor-pointer" />
        </div>

        <div className="mb-4">
          <label className="block text-[9px] font-bold text-slate-400 font-mono uppercase tracking-widest mb-1.5">
            Chunking Strategy
          </label>
          <select
            value={chunkingStrategy}
            onChange={(e) => setChunkingStrategy(e.target.value as ChunkingStrategy)}
            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500/20 focus:border-indigo-500 mb-1.5 shadow-sm"
          >
            <option value="recursive">Recursive Character (LangChain default)</option>
            <option value="paragraph">Paragraph Splitter (Double newlines)</option>
            <option value="sentence">Sentence Splitter (Delimit sentences)</option>
            <option value="fixed-size">Fixed-Size Splitter (Rigid slicer)</option>
          </select>
          {chunkingStrategy === "paragraph" && (
            <p className="text-[9px] text-slate-400 leading-normal font-sans">
              👉 Splits on paragraph boundaries. Large paragraphs are split recursively inside boundaries.
            </p>
          )}
          {chunkingStrategy === "sentence" && (
            <p className="text-[9px] text-slate-400 leading-normal font-sans">
              👉 Segments into whole sentences so phrases and context metrics remain continuous.
            </p>
          )}
          {chunkingStrategy === "recursive" && (
            <p className="text-[9px] text-slate-400 leading-normal font-sans">
              👉 Splits recursively by double newlines, single newlines, and space bounds up to limits.
            </p>
          )}
          {chunkingStrategy === "fixed-size" && (
            <p className="text-[9px] text-slate-400 leading-normal font-sans">
              👉 Strict slicing of characters of exact length with overlaps. Great for uniform maps.
            </p>
          )}
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-[9px] font-bold text-slate-400 font-mono uppercase tracking-widest mb-1.5">
              Chunk Size ({chunkSize} char)
            </label>
            <input
              type="range"
              min="150"
              max="1500"
              step="50"
              value={chunkSize}
              onChange={(e) => setChunkSize(Number(e.target.value))}
              className="w-full accent-indigo-600 bg-slate-200 rounded-lg cursor-pointer"
            />
          </div>
          <div>
            <label className="block text-[9px] font-bold text-slate-400 font-mono uppercase tracking-widest mb-1.5">
              Overlap ({chunkOverlap} char)
            </label>
            <input
              type="range"
              min="0"
              max="400"
              step="10"
              value={chunkOverlap}
              disabled={chunkingStrategy === 'paragraph' || chunkingStrategy === 'sentence'}
              className={`w-full accent-indigo-600 bg-slate-200 rounded-lg cursor-not-allowed ${
                chunkingStrategy === 'paragraph' || chunkingStrategy === 'sentence'
                  ? 'opacity-50'
                  : 'cursor-pointer'
              }`}
              onChange={(e) => setChunkOverlap(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-[9px] font-bold text-slate-400 font-mono uppercase tracking-widest mb-1.5">
              Embedding Provider Backend
            </label>
            <div className="grid grid-cols-2 gap-2 bg-slate-150 p-1 rounded-lg border border-slate-200/80">
              <button
                type="button"
                onClick={() => setApiMode('gemini')}
                className={`py-1.5 rounded text-xs font-semibold font-mono transition ${
                  apiMode === 'gemini'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-550 hover:text-slate-800'
                }`}
              >
                Gemini (Free)
              </button>
              <button
                type="button"
                onClick={() => setApiMode('openai')}
                className={`py-1.5 rounded text-xs font-semibold font-mono transition ${
                  apiMode === 'openai'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-550 hover:text-slate-800'
                }`}
              >
                OpenAI GPT
              </button>
            </div>
          </div>

          {apiMode === 'openai' && (
            <div>
              <label className="block text-[9px] font-bold text-slate-400 font-mono uppercase tracking-widest mb-1">
                OpenAI SECRET KEY
              </label>
              <input
                type="password"
                placeholder="sk-..."
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                className="w-full bg-white border border-slate-250 rounded px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
              <p className="text-[9px] text-slate-400 mt-1">Key is ephemeral; only sent server-side to proxy embeddings.</p>
            </div>
          )}
        </div>
      </div>

      {/* Core CTA: Build Indexing */}
      <button
        onClick={() => onIndex(chunkSize, chunkOverlap, apiMode, openaiKey, chunkingStrategy)}
        disabled={indexingInProgress || documents.length === 0}
        className={`w-full flex items-center justify-center space-x-2 py-3.5 rounded-xl text-sm font-semibold tracking-wide transition uppercase ${
          indexingInProgress || documents.length === 0
            ? 'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed'
            : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow'
        }`}
      >
        <Database className={`w-4 h-4 ${indexingInProgress ? 'animate-spin' : ''}`} />
        <span>
          {indexingInProgress ? "Slicing & Embedding Chunks..." : "Build RAG Semantic Index (FAISS)"}
        </span>
      </button>
    </div>
  );
}
