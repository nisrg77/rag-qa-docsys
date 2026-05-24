export type DocumentType = 'pdf' | 'txt' | 'md' | 'sample';

export interface Document {
  id: string;
  name: string;
  type: DocumentType;
  size: number;
  text: string;
  chunkCount: number;
  uploadedAt: Date;
  status: 'pending' | 'processing' | 'indexed' | 'error';
  errorMessage?: string;
}

export interface Chunk {
  id: string;
  docId: string;
  docName: string;
  text: string;
  index: number;
  length: number;
  score?: number; // Similarity score for retrieval results
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  retrievedChunks?: Chunk[];
  rawPrompt?: string;
  modelUsed?: string;
  apiMode?: 'gemini' | 'openai';
  latencyMs?: number;
}

export type ChunkingStrategy = 'recursive' | 'paragraph' | 'sentence' | 'fixed-size';

export interface RAGConfig {
  chunkSize: number;
  chunkOverlap: number;
  temperature: number;
  strictness: 'low' | 'medium' | 'high'; // high: Answer only from context, medium: answer primarily, low: rely more on general knowlege if context is quiet.
  systemInstruction: string;
  apiMode: 'gemini' | 'openai';
  openaiKey: string;
  // Advanced Prompt Customizations
  promptTechnique: 'standard' | 'few-shot' | 'chain-of-thought';
  summarizeChunks: boolean;
  forceCitations: boolean;
}

export interface PipelineTraceStep {
  id: string;
  timestamp: string;
  phase: 'loader' | 'splitter' | 'embedding' | 'vectorStore' | 'retriever' | 'generator';
  title: string;
  message: string;
  details?: Record<string, any>;
}

export interface IndexState {
  documents: Document[];
  chunks: Chunk[];
  indexingInProgress: boolean;
  totalChunks: number;
  apiStatus: {
    geminiConnected: boolean;
    openaiConfigured: boolean;
  };
}
