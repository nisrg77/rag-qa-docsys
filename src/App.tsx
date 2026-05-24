import React, { useState, useEffect } from 'react';
import { Database, HelpCircle, Terminal, Layers, Sparkles, RefreshCw, FileText } from 'lucide-react';
import { Document, Chunk, ChatMessage, RAGConfig, PipelineTraceStep, ChunkingStrategy } from './types';
import DocumentManager from './components/DocumentManager';
import ChunkVisualizer from './components/ChunkVisualizer';
import ChatInterface from './components/ChatInterface';
import PipelineTrace from './components/PipelineTrace';

export default function App() {
  // State from server indexing
  const [documents, setDocuments] = useState<Document[]>([]);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [traces, setTraces] = useState<PipelineTraceStep[]>([]);
  
  // UI Loading controls
  const [indexingInProgress, setIndexingInProgress] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  
  // Selected trace messaging
  const [selectedMessageTrace, setSelectedMessageTrace] = useState<ChatMessage | null>(null);
  
  // Active layouts
  const [activePlaygroundTab, setActivePlaygroundTab] = useState<'chat' | 'chunks'>('chat');

  // Interactive settings
  const [chunkSize, setChunkSize] = useState<number>(500);
  const [chunkOverlap, setChunkOverlap] = useState<number>(100);
  const [apiMode, setApiMode] = useState<'gemini' | 'openai'>('gemini');
  const [openaiKey, setOpenaiKey] = useState<string>('');
  const [chunkingStrategy, setChunkingStrategy] = useState<ChunkingStrategy>('recursive');
  
  const [ragConfig, setRagConfig] = useState<RAGConfig>({
    chunkSize: 500,
    chunkOverlap: 100,
    temperature: 0.2,
    strictness: 'high',
    systemInstruction: "You are a factual RAG Q&A Assistant. Only answer questions using the facts loaded in the context chunks.",
    apiMode: 'gemini',
    openaiKey: '',
    promptTechnique: 'standard',
    summarizeChunks: false,
    forceCitations: true,
  });

  // Chat Conversational store
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

  // Periodically update active configs in trace states
  useEffect(() => {
    setRagConfig((prev) => ({
      ...prev,
      chunkSize,
      chunkOverlap,
      apiMode,
      openaiKey,
    }));
  }, [chunkSize, chunkOverlap, apiMode, openaiKey]);

  // Sync state from Express backend on mount
  const syncState = async () => {
    try {
      const res = await fetch('/api/index-state');
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents);
        setChunks(data.chunks);
      }
      
      const traceRes = await fetch('/api/traces');
      if (traceRes.ok) {
        const traceData = await traceRes.json();
        setTraces(traceData);
      }
    } catch (err) {
      console.error("Failed to sync status from Node server:", err);
    }
  };

  useEffect(() => {
    syncState();
    const interval = setInterval(syncState, 4000); // Poll status logs every 4s
    return () => clearInterval(interval);
  }, []);

  // Handle document upload conversions
  const handleUpload = async (name: string, type: 'pdf' | 'txt' | 'md', content: string, size: number) => {
    try {
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, type, content, size }),
      });

      if (response.ok) {
        await syncState();
      } else {
        const errData = await response.json();
        alert(`Ingestion failed: ${errData.error}`);
      }
    } catch (err) {
      console.error("Failed to upload document stream:", err);
    }
  };

  // Re-run the token splitter and regenerate embed index arrays
  const handleIndex = async (size: number, overlap: number, mode: 'gemini' | 'openai', key: string, strategy: ChunkingStrategy) => {
    if (indexingInProgress) return;
    setIndexingInProgress(true);
    try {
      const response = await fetch('/api/documents/index', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chunkSize: size,
          chunkOverlap: overlap,
          apiMode: mode,
          openaiKey: key,
          chunkingStrategy: strategy,
        }),
      });

      if (response.ok) {
        await syncState();
        setActivePlaygroundTab('chunks'); // Direct viewer to chunks so they visually verify split outcomes
      } else {
        const errData = await response.json();
        alert(`Indexing failed: ${errData.error}`);
      }
    } catch (err) {
      console.error("Failure indexing documents:", err);
    } finally {
      setIndexingInProgress(false);
    }
  };

  const handleReset = async () => {
    if (window.confirm("Are you sure you want to flush FAISS index records? This will restore original tutorial segments.")) {
      try {
        const res = await fetch('/api/index/reset', { method: 'POST' });
        if (res.ok) {
          setChatHistory([]);
          setSelectedMessageTrace(null);
          setChunkSize(500);
          setChunkOverlap(100);
          await syncState();
        }
      } catch (err) {
        console.error("Reset core index failed:", err);
      }
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || chatLoading) return;
    
    // Check if index is loaded
    if (chunks.length === 0) {
      alert("Please index documents into FAISS vector database first! Tap 'Build RAG Semantic Index' in the store.");
      return;
    }

    const userMsg: ChatMessage = {
      id: `msg_user_${Date.now()}`,
      role: 'user',
      text,
      timestamp: new Date().toLocaleTimeString(),
    };

    setChatHistory((prev) => [...prev, userMsg]);
    setChatLoading(true);

    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: text,
          config: ragConfig,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const aiMsg: ChatMessage = {
          id: `msg_ai_${Date.now()}`,
          role: 'assistant',
          text: data.answerText,
          timestamp: new Date().toLocaleTimeString(),
          retrievedChunks: data.retrievedChunks,
          rawPrompt: data.rawPrompt,
          modelUsed: data.modelUsed,
          apiMode: ragConfig.apiMode,
          latencyMs: data.latencyMs,
        };
        setChatHistory((prev) => [...prev, aiMsg]);
        setSelectedMessageTrace(aiMsg); // Update interactive prompt tracing live!
      } else {
        const errData = await response.json();
        const errorMsg: ChatMessage = {
          id: `msg_err_${Date.now()}`,
          role: 'assistant',
          text: `⚠️ Generator Error: ${errData.error || "The server could not communicate with the LLM API successfully. Please review API keys."}`,
          timestamp: new Date().toLocaleTimeString(),
        };
        setChatHistory((prev) => [...prev, errorMsg]);
      }
    } catch (err: any) {
      console.error("Dispatched query failed:", err);
    } finally {
      setChatLoading(false);
      await syncState(); // Fetch logs generated during prompt
    }
  };

  const clearLogs = async () => {
    try {
      await fetch('/api/traces/clear', { method: 'POST' });
      setTraces([]);
    } catch (err) {
      console.error("Logs flush crashed:", err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col">
      {/* Universal Dashboard Banner Header */}
      <header className="border-b border-slate-200 bg-white px-8 py-4 flex items-center justify-between shrink-0 select-none shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="bg-indigo-600 p-2.5 rounded-lg shadow-sm">
            <Database className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-md text-[9px] font-mono font-bold uppercase tracking-wider">
              Secure RAG Studio v1.2
            </span>
            <h1 className="text-base font-bold text-slate-850 tracking-tight mt-0.5 font-sans">
              RAG Document Q&A Console
            </h1>
          </div>
        </div>

        {/* Dynamic overall counts */}
        <div className="flex items-center space-x-4 text-xs font-mono text-slate-500">
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-center">
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Active Documents</p>
            <p className="text-slate-850 mt-0.5 font-semibold text-sm">{documents.length}</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-center">
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Indexed Chunks</p>
            <p className="text-slate-850 mt-0.5 font-semibold text-sm">{chunks.length}</p>
          </div>
        </div>
      </header>

      {/* Main Dev Console Grid Row Layout */}
      <main className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-4 gap-6 p-6 h-[calc(100vh-105px)]">
        
        {/* Left Hand: Loader and configuration Store (Column 1) */}
        <div className="lg:col-span-1 h-full overflow-hidden flex flex-col">
          <DocumentManager
            documents={documents}
            indexingInProgress={indexingInProgress}
            onUpload={handleUpload}
            onIndex={handleIndex}
            onReset={handleReset}
            chunkSize={chunkSize}
            setChunkSize={setChunkSize}
            chunkOverlap={chunkOverlap}
            setChunkOverlap={setChunkOverlap}
            apiMode={apiMode}
            setApiMode={setApiMode}
            openaiKey={openaiKey}
            setOpenaiKey={setOpenaiKey}
            chunkingStrategy={chunkingStrategy}
            setChunkingStrategy={setChunkingStrategy}
          />
        </div>

        {/* Center Sandbox: Interactive Q&A and document segmentation explorer (Columns 2 & 3) */}
        <div className="lg:col-span-2 h-full flex flex-col overflow-hidden">
          {/* Internal playground header menu */}
          <div className="flex bg-white border border-slate-200 p-1 rounded-xl mb-4 shrink-0 space-x-1 shadow-sm">
            <button
              onClick={() => setActivePlaygroundTab('chat')}
              className={`flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold rounded-lg font-mono transition ${
                activePlaygroundTab === 'chat'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Pipeline Playground</span>
            </button>
            <button
              onClick={() => setActivePlaygroundTab('chunks')}
              className={`flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold rounded-lg font-mono transition ${
                activePlaygroundTab === 'chunks'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Splitter Explorer</span>
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            {activePlaygroundTab === 'chat' ? (
              <ChatInterface
                messages={chatHistory}
                indexingInProgress={indexingInProgress}
                onSendMessage={handleSendMessage}
                isLoading={chatLoading}
                config={ragConfig}
                onChangeConfig={setRagConfig}
                onSelectMessageTrace={setSelectedMessageTrace}
              />
            ) : (
              <ChunkVisualizer chunks={chunks} />
            )}
          </div>
        </div>

        {/* Right Hand: Trace diagnostics node (Column 4) */}
        <div className="lg:col-span-1 h-full overflow-hidden flex flex-col">
          <PipelineTrace
            traces={traces}
            selectedMessage={selectedMessageTrace}
            onClearTraces={clearLogs}
          />
        </div>

      </main>

      {/* Sub-Footer Status Bar */}
      <footer className="h-8 bg-slate-100 border-t border-slate-200 px-6 flex items-center justify-between text-[10px] font-medium text-slate-500 shrink-0 select-none">
        <div className="flex gap-4">
          <span>Session: active-8821</span>
          <span>Memory: LangChainBufferWindow</span>
        </div>
        <div className="flex gap-4 uppercase tracking-wider font-mono">
          <span>LangChain v0.1.0</span>
          <span>FAISS-CPU v1.7.4</span>
        </div>
      </footer>
    </div>
  );
}
