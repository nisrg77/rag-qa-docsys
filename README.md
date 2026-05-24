# RAG-Based Document Q&A System

Built an end-to-end **Retrieval-Augmented Generation (RAG) pipeline** utilizing custom visual representations of modular **LangChain** structures and **FAISS** index search, enabling semantic lookup, document chunk tracking, and factual context-aware answering over custom PDFs and plaintext files.

---

## 🚀 Key Architectural Pillars

### 1. Document Loading & Extraction
- Supports loading of plaintext (`.txt`), rich markdown (`.md`), and binary PDF (`.pdf`) documents.
- Uses server-side `pdf-parse` to convert raw PDF bytes into a clean text character cascade.
- Pre-loads factual RAG and prompting guides to offer a fully operational out-of-the-box system.

### 2. Intelligent Document Chunking Strategies
The system supports multiple customizable token-splitting algorithms to adapt chunk boundaries:
- **Recursive Character Splitter (LangChain Default)**: Recursively crawls paragraph (`\n\n`), sentence (`\n`), word (` `), and characters (`""`) boundaries to yield chunks that do not exceed the set character size limits.
- **Paragraph Splitter**: Strictly preserves paragraph limits by splitting text objects on `\n\n`. Large paragraphs that exceed the character count are sequentially sliced to fit length bounds.
- **Sentence Splitter**: Strictly splits on sentence delimiters (`.`, `!`, `?`), ensuring key contexts, statistics, and phrases are not awkwardly severed mid-sentence.
- **Fixed-Size Splitter**: Implements a rigid sliding character slicer of precise character limits. Best for structured documents, technical parameters lists, or strict length mappings.

### 3. FAISS Vector Database & Fallbacks
- **Dense Embedding Generation**: Interlocks with modern Google Gemini API (`gemini-embedding-2-preview` model) or OpenAI Embeddings API (`text-embedding-3-small`) to convert granular fragments into dense floating-point vector formats.
- **FAISS-Like Nearest Neighbor Index**: Operates a stateful in-memory vector indexing catalog.
- **Local TF-IDF Similarity Fallback**: Incorporates sparse-term TF-IDF vector algorithms if API credentials are not provided, ensuring 100% active operational previews offline.

### 4. Advanced Prompt Engineering
The generator utilizes highly optimized prompting methodologies to maximize accuracy and trace factual lines:
- **Techniques Available**:
  - **Standard RAG Prompting**: Direct grounding sequence. Sends system instructions and matched fragments straight into the context payload without overhead.
  - **Few-Shot Priming**: Injects high-quality contextual input/output examples inside the LLM prompt. Guides model formatting, enforces citation constraints, and sets strict grounds on what represents a hallucinated assumption.
  - **Chain-of-Thought (CoT)**: Instructs the model to output a `"### Chain of Thought Analysis"` section, breaking down the query's criteria, referencing isolated source texts, and formulating reasoning steps *prior* to drafting details.
- **Draft Concise Chunk Summaries**: Instructs the system model to construct an elegant itemized summary `"### Concise Retrieved Chunk Summaries"` detailing exactly what facts are captured inside EACH retrieved source block prior to answering.
- **Enforced Specific Source Citations**: Directs the LLM to strictly attach inline bracketed references like `[Source Reference #X]` whenever referencing supporting details.

### 5. High-Contrast Interactive Pipeline Tracing
- Visualizes the entire pipeline **lifecycle** as a step-by-step diagnostic log: **Ingestion ➔ Splitting ➔ Vector Storage ➔ Retrieval ➔ Aggregation ➔ Gen**.
- Logs metadata detailing token counts, cosine parameters, chosen chunking strategies, and model latencies.

---

## 🛠️ Stack & Dependencies
- **Frontend Core**: React 19, Tailwind CSS, Motion
- **Icons**: Lucide-React
- **Server Platform**: Node.js, Express v4, TSX (TypeScript Dev Execution)
- **Deployment Build Compiler**: Esbuild (CJS bundle, target node)
- **Text Parser**: Pure-JS `pdf-parse` for binary layout ingestion

---

## 📖 Installation & Developer Setup

1. **Injected Credentials**: Provide your `GEMINI_API_KEY` in the Secrets configurations.
2. **Launch Dev Environment**:
   ```bash
   npm run dev
   ```
3. **Trigger Production Compilation**:
   ```bash
   npm run build
   ```
4. **Deploy / Run Bundle**:
   ```bash
   npm run start
   ```
