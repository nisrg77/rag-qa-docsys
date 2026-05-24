import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
// @ts-ignore
import pdf from "pdf-parse";
import dotenv from "dotenv";

dotenv.config();

// Initialize Express
const app = express();
const PORT = 3000;

// Enable JSON parser with large limits for base64 PDF loads
app.use(express.json({ limit: "50mb" }));

// Initialize Gemini API
let aiClient: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  try {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
    console.log("Gemini API Client successfully initialized.");
  } catch (err) {
    console.error("Failed to initialize Gemini Client:", err);
  }
} else {
  console.warn("GEMINI_API_KEY is not set. Google Gemini features will have fallbacks.");
}

// Global In-Memory Store mimicking FAISS and Document Loader states
interface IndexedChunk {
  id: string;
  docId: string;
  docName: string;
  text: string;
  index: number;
  length: number;
  embedding?: number[]; // Dense embedding (Gemini / OpenAI)
  tfIdfVector?: Record<string, number>; // Sparse embedding
}

interface ServerDocument {
  id: string;
  name: string;
  type: "pdf" | "txt" | "md" | "sample";
  size: number;
  text: string;
  chunkCount: number;
  uploadedAt: Date;
  status: "pending" | "processing" | "indexed" | "error";
  errorMessage?: string;
}

interface ServerTraceLog {
  id: string;
  timestamp: string;
  phase: "loader" | "splitter" | "embedding" | "vectorStore" | "retriever" | "generator";
  title: string;
  message: string;
  details?: any;
}

let documents: ServerDocument[] = [];
let indexedChunks: IndexedChunk[] = [];
let pipelineTraces: ServerTraceLog[] = [];

// Clean traces
function addTrace(
  phase: ServerTraceLog["phase"],
  title: string,
  message: string,
  details?: any
) {
  const trace: ServerTraceLog = {
    id: `trace_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    timestamp: new Date().toISOString(),
    phase,
    title,
    message,
    details,
  };
  pipelineTraces.push(trace);
  if (pipelineTraces.length > 150) {
    pipelineTraces.shift();
  }
}

// ---------------------------------------------------------
// Helper: PRE-LOADED INSTRUCTIONAL SAMPLE DOCUMENTS FOR RAG
// ---------------------------------------------------------
const SAMPLES = [
  {
    id: "sample_rag_primer",
    name: "RAG_Architecture_Primer.txt",
    type: "sample" as const,
    text: `RETRIVAL-AUGMENTED GENERATION (RAG) ARCHITECTURE PRIMER
=======================================================

Retrieval-Augmented Generation (RAG) is an architectural pattern that optimizes the output of a Large Language Model (LLM) by interfacing it with an authoritative external knowledge source prior to generating a response. Standard LLMs are frozen in time, meaning their parametric memory captures knowledge only up to their training cutoff point. RAG solves this limitation by searching external indexed databases, pulling relevant snippets (chunks) related to a query, and prepending these snippets to the LLM's context window.

Core Stages in an End-to-End RAG Pipeline:
1. Document Ingestion & Loading: Loading raw files like PDFs, Markdowns, spreadsheets, or database tables, and extracting raw text strings.
2. Intelligent Chunking: Splitting long prose into smaller paragraphs or windows. Since documents are often too long for an LLM's context or contain irrelevant padding, chunking breaks the text down to isolated topics. Standard parameters are Chunk Size (e.g., 500 characters) and Chunk Overlap (e.g., 100 characters) to ensure sentence boundaries and continuous contexts are not cropped off mid-phrase.
3. Dense Vector Embeddings: Sending text chunks to an embedding model (such as Google’s gemini-embedding-2-preview) which projects characters into a high-dimensional vector space (e.g., 768 or 1536 real numbers). These vectors capture semantic meaning rather than word spelling.
4. Vector Storage & Indexing (FAISS): Saving vectors in an indexing system. Facebook AI Similarity Search (FAISS) is an industry-standard library that permits highly optimized nearest-neighbor searches using distance metrics such as L2 (Euclidean distance) or Cosine Similarity (angle projection).
5. Semantic Query & Retrieval: When a user asks a question, the query is embedded into the same vector space. FAISS searches the index and retrieves the top 'K' chunks that have the highest cosine similarity score to the query vector.
6. Contextual Prompt Augmentation: Injecting the retrieved context chunks directly into a prompt template alongside the user's original question.
7. LLM Response Generation: The augmented prompt is resolved by the LLM (e.g., Gemini 3.5 Flash or OpenAI GPT). Prompt engineering instructions instruct the LLM: "Answer the prompt based ONLY on the provided context. If the answer cannot be found, reply 'I do not have access to that information based on the document' and do not hallucinate." This mitigates AI halucinations.

Pros of RAG:
- Low-latency, low-cost adaptation of models to custom private files.
- Transparent sources of information (citations and visual scores).
- No expensive fine-tuning or continuous model re-training is required.
- Easy update of knowledge bases—simply replace index files in the vector store.`,
    size: 2790,
  },
  {
    id: "sample_ai_studio_guide",
    name: "AI_Studio_Advanced_Prompting.txt",
    type: "sample" as const,
    text: `GOOGLE AI STUDIO ADVANCED PROMPTING & HALLUCINATION CONTROLS
===========================================================

Google AI Studio provides access to cutting-edge models like Gemini 3.5 Flash, which feature enormous context windows and native multimodal capabilities. When designing enterprise Q&A assistants, prompt engineering is vital to direct model behavior, enforce boundaries, and reduce hallucinations.

Mitigating Hallucinations in LLMs:
- Grounding Prompts: A grounding prompt is a set of rules prefixed to the context. It states:
  "You are a strict, factual information retriever. Analyze the provided Context chunks underneath. Draft a precise response answering the user's question. Follow these rules carefully:
   1. You must only explain facts that are directly mentioned in the Context.
   2. Do not assume or extrapolate based on general world knowledge.
   3. If a question cannot be resolved using the Context, explicitly output 'The provided documents do not contain sufficient context to answer this query.'
   4. Include visual citations citing which document or chunk index was used."
- Temperature Control: Setting the temperature of the model dynamically. A temperature of 0.0 forces the model to choose highly deterministic tokens, resulting in factual, consistent, and predictable responses. A high temperature (e.g., 1.0) encourages creativity, which is ideal for marketing prose but highly dangerous for technical documentation Q&As.
- System Instructions: Writing rules in the native system prompt segment. In \`@google/genai\`, you can set the \`systemInstruction\` directly inside the configuration object. This forces the model to adopt a persona (e.g., "Medical Assistant", "Corporate Policy Auditor") and respect restrictions across all subsequent chat turns.
- Grounding Metadata: When utilizing Google Search or Google Maps grounding, Gemini provides native grounding metadata, returning a list of search chunks and corresponding Web URIs. Users should display these clickable citations underneath the chatbot response to guarantee user verification.`,
    size: 2150,
  },
];

// Initialize sample documents
function loadSamples() {
  SAMPLES.forEach((sample) => {
    if (!documents.some((d) => d.id === sample.id)) {
      documents.push({
        id: sample.id,
        name: sample.name,
        type: sample.type,
        size: sample.size,
        text: sample.text,
        chunkCount: 0,
        uploadedAt: new Date("2026-05-24T05:00:00Z"),
        status: "pending",
      });
    }
  });
}
loadSamples();

// ---------------------------------------------------------
// Additional Chunking Strategies (Paragraph, Sentence, Fixed-Size)
// ---------------------------------------------------------
function splitFixedSize(text: string, chunkSize: number, chunkOverlap: number): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    chunks.push(text.substring(start, start + chunkSize));
    start += chunkSize - chunkOverlap;
    if (start < 0 || chunkSize - chunkOverlap <= 0) break; // Avoid infinite loops
  }
  return chunks.filter(c => c.trim().length > 0);
}

function splitParagraphs(text: string, chunkSize: number): string[] {
  const paragraphs = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  let current = "";
  for (const p of paragraphs) {
    const trimmed = p.trim();
    if (!trimmed) continue;
    if (trimmed.length > chunkSize) {
      // If a single paragraph exceeds the chunk limit, fall back to recursive splitting on that segment
      if (current) {
        chunks.push(current);
        current = "";
      }
      const sub = recursiveSplitText(trimmed, chunkSize, Math.floor(chunkSize * 0.2));
      chunks.push(...sub);
    } else if (current.length + trimmed.length + 2 > chunkSize) {
      if (current) chunks.push(current);
      current = trimmed;
    } else {
      current = current ? current + "\n\n" + trimmed : trimmed;
    }
  }
  if (current) {
    chunks.push(current);
  }
  return chunks.filter(c => c.trim().length > 0);
}

function splitSentences(text: string, chunkSize: number): string[] {
  // Regex that matches sentence boundaries, handling abbreviations coarsely
  const sentences = text.match(/[^.!?]+[.!?]+(\s+|$)/g) || [text];
  const chunks: string[] = [];
  let current = "";
  for (const s of sentences) {
    const trimmed = s.trim();
    if (!trimmed) continue;
    if (trimmed.length > chunkSize) {
      // If a single sentence exceeds the chunk limit, fall back to recursive splitting on that segment
      if (current) {
        chunks.push(current);
        current = "";
      }
      const sub = recursiveSplitText(trimmed, chunkSize, Math.floor(chunkSize * 0.1));
      chunks.push(...sub);
    } else if (current.length + trimmed.length + 1 > chunkSize) {
      if (current) chunks.push(current);
      current = trimmed;
    } else {
      current = current ? current + " " + trimmed : trimmed;
    }
  }
  if (current) {
    chunks.push(current);
  }
  return chunks.filter(c => c.trim().length > 0);
}

// ---------------------------------------------------------
// Recursive Character Chunker (Implements LangChain logic)
// ---------------------------------------------------------
function recursiveSplitText(
  text: string,
  chunkSize: number,
  chunkOverlap: number,
  separators: string[] = ["\n\n", "\n", " ", ""]
): string[] {
  const finalChunks: string[] = [];
  
  function split(content: string, separatorIdx: number): string[] {
    const separator = separators[separatorIdx];
    
    // If the content is already smaller than chunkSize, return it as a chunk
    if (content.length <= chunkSize) {
      return [content];
    }
    
    // If we have exhausted all separators, slice the content forcefully
    if (separatorIdx >= separators.length) {
      const parts: string[] = [];
      let start = 0;
      while (start < content.length) {
        parts.push(content.substring(start, start + chunkSize));
        start += chunkSize - chunkOverlap;
        if (start < 0 || chunkSize - chunkOverlap <= 0) break; // Avoid infinite loops
      }
      return parts;
    }
    
    const elements = content.split(separator);
    const results: string[] = [];
    let currentChunk = "";
    
    for (const el of elements) {
      // If adding this element exceeds chunkSize
      if (currentChunk.length + el.length + (currentChunk ? separator.length : 0) > chunkSize) {
        if (currentChunk.trim()) {
          results.push(currentChunk);
        }
        
        // Handle overlapping context: roll back to find preceding overlap elements
        if (chunkOverlap > 0) {
          // A simplistic but robust representation of overlap for recursively combined separators:
          // Keep a window of characters from the tail of the current chunk
          currentChunk = currentChunk.substring(Math.max(0, currentChunk.length - chunkOverlap)) + (currentChunk ? separator : "") + el;
        } else {
          currentChunk = el;
        }
      } else {
        currentChunk += (currentChunk ? separator : "") + el;
      }
    }
    
    if (currentChunk.trim()) {
      results.push(currentChunk);
    }
    
    return results;
  }

  // Initial split starting at index 0 (double newlines)
  const initialParts = split(text, 0);
  
  // Recursively apply further separators to parts exceeding constraints
  for (const part of initialParts) {
    if (part.length > chunkSize) {
      // Split with the next level separator
      const subParts = recursiveSplitText(part, chunkSize, chunkOverlap, separators.slice(1));
      finalChunks.push(...subParts);
    } else {
      finalChunks.push(part);
    }
  }
  
  return finalChunks.filter(c => c.trim().length > 0);
}

// ---------------------------------------------------------
// Term-Frequency IDF Sparse Vector Sim (Mock FAISS fallbacks)
// ---------------------------------------------------------
// Standard Stopwords
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "of", "to", "by", "for", "with",
  "at", "by", "from", "in", "on", "to", "to", "is", "was", "are", "were", "been",
  "be", "this", "that", "these", "those", "have", "has", "had", "do", "does", "did",
  "i", "you", "he", "she", "it", "we", "they", "me", "him", "her", "us", "them"
]);

function buildTfIdfVectors(chunks: IndexedChunk[]) {
  // Step 1: Calculate Document Frequencies (DF)
  const df: Record<string, number> = {};
  const totalDocs = chunks.length;

  chunks.forEach((chunk) => {
    const words = new Set(
      chunk.text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .split(/\s+/)
        .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    );
    words.forEach((w) => {
      df[w] = (df[w] || 0) + 1;
    });
  });

  // Step 2: Build Term Frequency (TF) for each chunk and multiply by IDF
  chunks.forEach((chunk) => {
    const words = chunk.text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w));

    const tf: Record<string, number> = {};
    words.forEach((w) => {
      tf[w] = (tf[w] || 0) + 1;
    });

    const vector: Record<string, number> = {};
    for (const [w, count] of Object.entries(tf)) {
      const termFreq = count / words.length;
      const idf = Math.log(totalDocs / ((df[w] || 0) + 0.5)) + 1;
      vector[w] = termFreq * idf;
    }
    chunk.tfIdfVector = vector;
  });
}

function cosineSimilaritySparse(
  query: string,
  chunkVector: Record<string, number>
): number {
  const words = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));

  if (words.length === 0) return 0;

  // Query vector uses simple term count representation
  const queryVector: Record<string, number> = {};
  words.forEach((w) => {
    queryVector[w] = (queryVector[w] || 0) + 1;
  });

  let dotProduct = 0;
  let queryNormSq = 0;
  let chunkNormSq = 0;

  // Query norm
  for (const val of Object.values(queryVector)) {
    queryNormSq += val * val;
  }

  // Chunk norm
  for (const val of Object.values(chunkVector)) {
    chunkNormSq += val * val;
  }

  // Calculate dot product
  for (const [word, val] of Object.entries(queryVector)) {
    if (chunkVector[word]) {
      dotProduct += val * chunkVector[word];
    }
  }

  if (queryNormSq === 0 || chunkNormSq === 0) return 0;
  return dotProduct / (Math.sqrt(queryNormSq) * Math.sqrt(chunkNormSq));
}

// Cosine Similarity for Dense Vectors
function cosineSimilarityDense(vec1: number[], vec2: number[]): number {
  let dotProd = 0;
  let sqSum1 = 0;
  let sqSum2 = 0;
  const len = Math.min(vec1.length, vec2.length);
  for (let i = 0; i < len; i++) {
    dotProd += vec1[i] * vec2[i];
    sqSum1 += vec1[i] * vec1[i];
    sqSum2 += vec2[i] * vec2[i];
  }
  if (sqSum1 === 0 || sqSum2 === 0) return 0;
  return dotProd / (Math.sqrt(sqSum1) * Math.sqrt(sqSum2));
}

// ---------------------------------------------------------
// Express API Implementation
// ---------------------------------------------------------

// Retrieve all trace logs
app.get("/api/traces", (req, res) => {
  res.json(pipelineTraces);
});

// Clear trace logs
app.post("/api/traces/clear", (req, res) => {
  pipelineTraces = [];
  res.json({ success: true });
});

// Retrieve current index statistics and states
app.get("/api/index-state", (req, res) => {
  res.json({
    documents,
    chunks: indexedChunks.map((c) => ({
      id: c.id,
      docId: c.docId,
      docName: c.docName,
      text: c.text,
      index: c.index,
      length: c.length,
    })),
    indexingInProgress: false,
    totalChunks: indexedChunks.length,
    apiStatus: {
      geminiConnected: !!aiClient,
      openaiConfigured: !!process.env.OPENAI_API_KEY,
    },
  });
});

// Reset RAG Index to initial defaults
app.post("/api/index/reset", (req, res) => {
  documents = [];
  indexedChunks = [];
  loadSamples();
  addTrace("vectorStore", "Reset Vector Index", "FAISS and Document registry reverted to clean state.");
  res.json({ success: true });
});

// Upload and Parse raw/base64 files (supports PDF, TXT, MD)
app.post("/api/documents/upload", async (req, res) => {
  try {
    const { name, type, content, size } = req.body;
    
    if (!name || !type || !content) {
      return res.status(400).json({ error: "Missing required upload parameters (name, type, content)." });
    }

    addTrace("loader", "Document Upload Received", `Loading file '${name}' (${(size / 1024).toFixed(1)} KB)...`);

    const docId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    let text = "";

    if (type === "pdf") {
      try {
        const dataBuffer = Buffer.from(content, "base64");
        const parsed = await pdf(dataBuffer);
        text = parsed.text;
        addTrace("loader", "PDF Successfully Parsed", `Extracted ${parsed.numpages} page(s) containing ${text.length} characters from '${name}'.`);
      } catch (pdfErr: any) {
        addTrace("loader", "PDF Parser Failed", `Failed to parse PDF binary matching '${name}': ${pdfErr.message}`);
        return res.status(500).json({ error: `PDF Parse Failure: ${pdfErr.message}` });
      }
    } else {
      // Direct text or Markdown parsing
      text = content;
      addTrace("loader", "Text Extracted Successfully", `Read plaintext string of ${text.length} characters from '${name}'.`);
    }

    const newDoc: ServerDocument = {
      id: docId,
      name,
      type,
      size,
      text,
      chunkCount: 0,
      uploadedAt: new Date(),
      status: "pending",
    };

    documents.push(newDoc);
    res.json({ success: true, document: { id: docId, name, type } });

  } catch (err: any) {
    console.error("Document upload route crashed:", err);
    res.status(500).json({ error: err.message });
  }
});

// Perform Recursive splitting and Vector Embedding for all pending documents
app.post("/api/documents/index", async (req, res) => {
  try {
    const { chunkSize = 500, chunkOverlap = 100, apiMode = "gemini", openaiKey = "", chunkingStrategy = "recursive" } = req.body;

    addTrace("splitter", "LangChain Splitter Invoked", `Segmenting files using Strategy: ${chunkingStrategy.toUpperCase()}, Chunk Size: ${chunkSize}, Overlap: ${chunkOverlap}...`);

    let newChunksCreated = 0;
    
    // Clear previously structured chunks for indexing
    indexedChunks = indexedChunks.filter((c) => !documents.some((d) => d.id === c.docId && d.status === "pending"));

    for (const doc of documents) {
      if (doc.status === "pending" || doc.status === "processing") {
        doc.status = "processing";
        addTrace("splitter", "Chunking Document", `Processing '${doc.name}' (${doc.text.length} chars) with ${chunkingStrategy} strategy...`);

        let txtChunks: string[] = [];
        if (chunkingStrategy === "paragraph") {
          txtChunks = splitParagraphs(doc.text, chunkSize);
        } else if (chunkingStrategy === "sentence") {
          txtChunks = splitSentences(doc.text, chunkSize);
        } else if (chunkingStrategy === "fixed-size") {
          txtChunks = splitFixedSize(doc.text, chunkSize, chunkOverlap);
        } else {
          txtChunks = recursiveSplitText(doc.text, chunkSize, chunkOverlap);
        }

        addTrace("splitter", "Chunks Segmented", `Split prose of '${doc.name}' into ${txtChunks.length} distinct chunks.`, {
          docName: doc.name,
          chunkCount: txtChunks.length,
          strategy: chunkingStrategy,
          sampleChunk: txtChunks[0]?.substring(0, 100) + "...",
        });

        // Insert structured chunks into state
        const chunksToEmbed = txtChunks.map((txt, index) => ({
          id: `chunk_${doc.id}_${index}_${Math.random().toString(36).substr(2, 4)}`,
          docId: doc.id,
          docName: doc.name,
          text: txt,
          index,
          length: txt.length,
        }));

        doc.chunkCount = txtChunks.length;
        indexedChunks.push(...chunksToEmbed);
        newChunksCreated += chunksToEmbed.length;
        doc.status = "indexed";
      }
    }

    // ---------------------------------------------------------
    // Compute Text Embeddings (FAISS Vector Space Synthesis)
    // ---------------------------------------------------------
    let useOpenAI = apiMode === "openai" && (openaiKey || process.env.OPENAI_API_KEY);
    let useGemini = apiMode === "gemini" && aiClient;

    addTrace("embedding", "Embedding Vector Synthesis", `Generating vectors using ${useGemini ? "Google Gemini Embedding API" : useOpenAI ? "OpenAI Embeddings API" : "Local Vector Space (TF-IDF fallback)"}...`);

    if (useGemini && aiClient) {
      try {
        // Embed each chunk using Google's embedding-2-preview
        for (const chunk of indexedChunks) {
          if (!chunk.embedding) {
            const embedRes = (await aiClient.models.embedContent({
              model: "gemini-embedding-2-preview",
              contents: chunk.text,
            })) as any;
            const values = embedRes.embedding?.values || embedRes.embeddings?.[0]?.values || embedRes.embeddings?.values;
            if (values) {
              chunk.embedding = values;
            }
          }
        }
        addTrace("vectorStore", "FAISS Database Updated", `Successfully loaded and indexed dense vector files in-memory for ${newChunksCreated} chunks (Dimension: 768 / Linear Inner Product).`);
      } catch (gemIniErr: any) {
        addTrace("embedding", "Gemini Embeddings Failed", `Failover directly into local Term Vector representation: ${gemIniErr.message}`);
        // Fallback to tfidf
        buildTfIdfVectors(indexedChunks);
      }
    } else if (useOpenAI) {
      try {
        const actualKey = openaiKey || process.env.OPENAI_API_KEY;
        for (const chunk of indexedChunks) {
          if (!chunk.embedding) {
            const response = await fetch("https://api.openai.com/v1/embeddings", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${actualKey}`,
              },
              body: JSON.stringify({
                input: chunk.text,
                model: "text-embedding-3-small",
              }),
            });
            if (response.ok) {
              const resData = await response.json();
              chunk.embedding = resData.data[0].embedding;
            } else {
              throw new Error(`OpenAI response returned status: ${response.status}`);
            }
          }
        }
        addTrace("vectorStore", "FAISS Index Constructed", `Successfully synchronized index using OpenAI 1536-dim text embeddings.`);
      } catch (openAiErr: any) {
        addTrace("embedding", "OpenAI Embeddings Failed", `Failing over to TF-IDF matching: ${openAiErr.message}`);
        buildTfIdfVectors(indexedChunks);
      }
    } else {
      // Local TF-IDF representation
      buildTfIdfVectors(indexedChunks);
      addTrace("vectorStore", "Index Loaded", `Constructed local sparse similarity vectors based on Term Frequencies for ${indexedChunks.length} documents.`);
    }

    res.json({ success: true, processedCount: newChunksCreated });

  } catch (err: any) {
    console.error("Indexing failed entirely:", err);
    res.status(500).json({ error: err.message });
  }
});

// Run semantic query over FAISS Vector Database, Augment content, and Generate LLM response
app.post("/api/query", async (req, res) => {
  const startTime = Date.now();
  try {
    const { question, config } = req.body;
    
    if (!question) {
      return res.status(400).json({ error: "No prompt query provided." });
    }

    const {
      chunkSize = 500,
      chunkOverlap = 100,
      temperature = 0.2,
      strictness = "high",
      systemInstruction = "You are a strict technical Q&A bot.",
      apiMode = "gemini",
      openaiKey = "",
      promptTechnique = "standard",
      summarizeChunks = false,
      forceCitations = true,
    } = config || {};

    addTrace("retriever", "Semantic Lookup Triggered", `Searching vector database index for query: "${question}"...`);

    if (indexedChunks.length === 0) {
      return res.status(400).json({ error: "The vector database is currently empty. Please load or index documents first." });
    }

    // Embed Query
    let queryEmbedding: number[] | null = null;
    let useOpenAI = apiMode === "openai" && (openaiKey || process.env.OPENAI_API_KEY);
    let useGemini = apiMode === "gemini" && aiClient;

    if (useGemini && aiClient) {
      try {
        const qEmbedRes = (await aiClient.models.embedContent({
          model: "gemini-embedding-2-preview",
          contents: question,
        })) as any;
        queryEmbedding = qEmbedRes.embedding?.values || qEmbedRes.embeddings?.[0]?.values || qEmbedRes.embeddings?.values || null;
      } catch (err) {
        addTrace("retriever", "Query Dense Embed Failed", "Falling back to Term frequency match for retrieval lookup.");
      }
    } else if (useOpenAI) {
      try {
        const actualKey = openaiKey || process.env.OPENAI_API_KEY;
        const qEmbedRes = await fetch("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${actualKey}`,
          },
          body: JSON.stringify({
            input: question,
            model: "text-embedding-3-small",
          }),
        });
        if (qEmbedRes.ok) {
          const resData = await qEmbedRes.json();
          queryEmbedding = resData.data[0].embedding;
        }
      } catch (err) {
        addTrace("retriever", "Query Dense Embed Failed (OpenAI)", "Falling back to Word semantic tf-idf sparse index match.");
      }
    }

    // Sort chunks based on cosine similarity
    const scoredChunks = indexedChunks.map((chunk) => {
      let score = 0;
      if (queryEmbedding && chunk.embedding) {
        score = cosineSimilarityDense(queryEmbedding, chunk.embedding);
      } else if (chunk.tfIdfVector) {
        score = cosineSimilaritySparse(question, chunk.tfIdfVector);
      } else {
        // Fallback simple word overlap
        const querySet = new Set<string>(question.toLowerCase().split(/\s+/));
        const docSet = new Set<string>(chunk.text.toLowerCase().split(/\s+/));
        const intersection = [...querySet].filter((x) => docSet.has(x) && !STOPWORDS.has(x));
        score = intersection.length / Math.sqrt(querySet.size * docSet.size);
      }
      return { ...chunk, score };
    });

    // Sort by descending score
    scoredChunks.sort((a, b) => b.score - a.score);

    // Retrieve K=4 chunks
    const retrieved = scoredChunks.slice(0, 4).filter((c) => c.score > 0.05);
    
    addTrace("retriever", "Top Context Retrieved", `FAISS retrieved ${retrieved.length} relevant chunks matching prompt.`, {
      highestScore: retrieved[0]?.score || 0,
    });

    // Organize grounding context
    let contextStr = "";
    if (retrieved.length > 0) {
      contextStr = retrieved
        .map((chunk, count) => `SOURCE REFERENCE #${count + 1} (File: ${chunk.docName}, Chunk: ${chunk.index}):\n"""\n${chunk.text}\n"""`)
        .join("\n\n");
    } else {
      contextStr = "[NO RELEVANT TEXT EXTENSION FOUND IN FAISS INDEX]";
    }

    // Prompt Engineering: Build prompt based on strictness configuration to prevent hallucination
    let groundingInstructions = "";
    if (strictness === "high") {
      groundingInstructions = `
      Instructions: Answer the question strictly using the referenced context chunks provided below. Follow these safeguards to avoid hallucinations:
      - Rely ONLY on facts stated in the context snippets. If the snippet text does not contain the explanation, respond literally: "The loaded documents do not contain instructions or facts to resolve this query." Do not utilize external AI parametric memory.
      - Never fabricate links, figures, or assumptions.
      - Be direct and concise. Use clear visual citations referencing which SOURCE REFERENCE was used.
      `;
    } else if (strictness === "medium") {
      groundingInstructions = `
      Instructions: Formulate a response prioritizing facts listed in the context below. You can use general linguistic knowledge or structural logic to provide natural prose, but keep facts strongly bounded to the material. If the context is empty, gently alert the user that the doc is quiet, then provide a standard high-quality generic response but flag it as ungrounded.
      - Cite your sources in the text.
      `;
    } else {
      groundingInstructions = `
      Instructions: You are a creative Q&A agent. Draft an incredibly rich text based on the user question. You can reference the context fragments below, but build on top of them freely using your extensive worldly knowledge.
      `;
    }

    // 1. Precise Citation Enforcement
    let citationRule = "";
    if (forceCitations) {
      citationRule = `
      Citations Rule:
      - You MUST include inline citations to the SOURCE REFERENCES provided. Whenever referencing a fact from the text, end the sentence or paragraph with a bracketed reference like [SOURCE REFERENCE #X] where X corresponds to the reference number of the source used (e.g., "[SOURCE REFERENCE #1]" or "[SOURCE REFERENCE #1, #2]").
      - Do NOT make statements of fact without referencing the source number. If drawing from multiple sources, group them.
      `;
    }

    // 2. Transcribing Concise Summaries
    let summaryRule = "";
    if (summarizeChunks) {
      summaryRule = `
      Chunk Summarization Rule:
      - BEFORE answering the user's question, you MUST include a Section with heading "### Concise Retrieved Chunk Summaries" (or "### Concise Chunk Summaries").
      - Provide a brief 1-sentence bullet point summarizing the core context/fact of EACH provided SOURCE REFERENCE (e.g., "Source #1: Details the stages of indexing documents...").
      - After that section, write a heading "### Answer" and then proceed with your final grounded response.
      `;
    }

    // 3. Prompting Techniques (Few-shot or Chain-of-Thought)
    let techniqueInstructions = "";
    if (promptTechnique === "few-shot") {
      techniqueInstructions = `
      Few-shot Priming Examples:
      Below is an example of the desired response structure when answering user queries using retrieved chunks:
      
      ---
      EXAMPLE INPUT:
      Context Material:
      SOURCE REFERENCE #1 (File: Sample_Doc.txt, Chunk: 0):
      """
      Einsteinian space-time is structured as a four-dimensional manifold where mass-energy curves the geometric fabric. Gravity is not a traditional force but rather the path of least resistance through curved geometry.
      """
      SOURCE REFERENCE #2 (File: Physics_Notes.txt, Chunk: 4):
      """
      Quantum mechanics treats spatial intervals as field excitations. General relativity and quantum mechanics diverge at the Planck scale, causing mathematical singularity errors in standard quantum field manifolds.
      """
      User Question: What is gravity and where do quantum theories diverge?
      
      EXAMPLE OUTPUT:
      ${summarizeChunks ? `### Concise Retrieved Chunk Summaries
      - Source #1: Explains space-time manifold geometry and defines gravity as geometric curvature in space-time rather than a distinct force.
      - Source #2: Introduces spatial intervals as field excitations and shows divergence with GR at the Planck length scale.` : ''}
      
      ### Answer
      According to Einstein's theories, gravity is described not as a traditional force, but as the path of least resistance objects take through a curved four-dimensional space-time manifold warped by mass-energy [SOURCE REFERENCE #1]. Quantum mechanics and general relativity diverge mathematically at the Planck scale, resulting in singularity errors in quantum field manifolds [SOURCE REFERENCE #2].
      ---
      `;
    } else if (promptTechnique === "chain-of-thought") {
      techniqueInstructions = `
      Chain-of-Thought (CoT) Prompting Rule:
      - BEFORE writing your final answer block (and after prompt summaries if requested), think out-loud step-by-step.
      - Draft a section titled "### Chain of Thought Analysis". In 2-3 concise steps, write down your reasoning:
        1. Parse what the query asks for.
        2. Identify which SOURCE REFERENCES contain facts about these queries.
        3. Determine what conclusions are fully supported vs what would be a hallucination.
      - After your Chain of Thought section, write a heading "### Answer" and then formulate your final responses based strictly on the CoT findings.
      `;
    }

    const finalSystemPrompt = `${systemInstruction}\n${groundingInstructions}\n${citationRule}\n${summaryRule}\n${techniqueInstructions}`;
    const promptPayload = `
    Context Material:
    =======================================================
    ${contextStr}
    =======================================================

    User Question: ${question}
    
    Answer:
    `;

    addTrace("generator", "LLM Prompt Augmentation", `Augmented system instructions and dispatched payload directly to server-side generator using technique ${promptTechnique.toUpperCase()}...`);

    let answerText = "";
    let latencyMs = 0;

    if (useOpenAI) {
      const actualKey = openaiKey || process.env.OPENAI_API_KEY;
      const apiReqStart = Date.now();
      const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${actualKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: finalSystemPrompt },
            { role: "user", content: promptPayload },
          ],
          temperature,
        }),
      });
      latencyMs = Date.now() - apiReqStart;

      if (openAiRes.ok) {
        const payload = await openAiRes.json();
        answerText = payload.choices[0].message.content;
        addTrace("generator", "Response Generated (OpenAI)", `Received completion using GPT-4o-mini successfully in ${latencyMs}ms.`);
      } else {
        throw new Error(`OpenAI API responded with status ${openAiRes.status}`);
      }
    } else if (aiClient) {
      // Default: Google Gemini 3.5 Flash server-side
      const apiReqStart = Date.now();
      const geminiResponse = await aiClient.models.generateContent({
        model: "gemini-3.5-flash",
        contents: promptPayload,
        config: {
          systemInstruction: finalSystemPrompt,
          temperature: temperature,
        },
      });
      latencyMs = Date.now() - apiReqStart;
      answerText = geminiResponse.text || "An error occurred generating response.";
      addTrace("generator", "Response Generated (Gemini)", `Received completion from gemini-3.5-flash successfully in ${latencyMs}ms.`);
    } else {
      latencyMs = Date.now() - startTime;
      
      // Simulate prompt techniques offline for debug/dev verification
      let mockSummary = "";
      if (summarizeChunks && retrieved.length > 0) {
        mockSummary += `### Concise Retrieved Chunk Summaries\n`;
        retrieved.forEach((c, idx) => {
          mockSummary += `- Source #${idx + 1}: Summarized overview of document chunk explaining '${c.text.substring(0, 45).replace(/\n/g, " ")}...'\n`;
        });
        mockSummary += `\n`;
      }
      
      let mockCoT = "";
      if (promptTechnique === "chain-of-thought") {
        mockCoT += `### Chain of Thought Analysis\n`;
        mockCoT += `1. **Query breakdown**: The user asked "${question}".\n`;
        mockCoT += `2. **Reference review**: Checked FAISS database, isolated ${retrieved.length} relevant match(es).\n`;
        mockCoT += `3. **Grounded synthesis**: Ensure all claims map back to sources exactly.\n\n`;
      }
      
      answerText = `[Offline / No API Key Connected]
${mockSummary}${mockCoT}### Answer
I simulated a retrieval from your indexing engine and found ${retrieved.length} matched text segments!

${retrieved.length > 0 ? `Based on the retrieved context, we have key details: "${retrieved[0]?.text.substring(0, 180).trim()}..." [SOURCE REFERENCE #1].\n` : "No matches were found in index."}
Let's display what RAG would have sent to the generator.

Here is the context we isolated:
---
${contextStr.substring(0, 350)}...

Answer would be generated using your System Instructions: "${systemInstruction.substring(0, 50)}..."`;
      addTrace("generator", "Pipeline Complete (Offline Mock)", `Simulated retrieval output calculated in ${latencyMs}ms.`);
    }

    res.json({
      answerText,
      retrievedChunks: retrieved.map((c) => ({
        id: c.id,
        docId: c.docId,
        docName: c.docName,
        text: c.text,
        index: c.index,
        length: c.length,
        score: c.score,
      })),
      rawPrompt: `[System Instruction]\n${finalSystemPrompt}\n\n[Core Prompt]\n${promptPayload}`,
      modelUsed: useOpenAI ? "gpt-4o-mini" : "gemini-3.5-flash",
      latencyMs,
    });

  } catch (err: any) {
    console.error("Query failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// Start dev server block or static file handlers
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`RAG Node Server running on http://localhost:${PORT}`);
  });
}

startServer();
