# VAULT — Detailed Hierarchical Diagram

This file is a +hierarchical diagram and quick reference for the VAULT project. It shows the file/folder layout, component responsibilities, data flows, environment variables, run commands, and targeted troubleshooting steps.

```
VAULT-Semantic-Search/
│
├── LICENSE                            # Project license
├── README.md                          # High-level overview & setup (primary docs)
├── hierarchical-diagram.md            # This file (detailed tree + notes)
├── system-hierarchy-diagram.md        # Mermaid architecture diagram (visual)
├── project-structure.md               # Short copyable project tree
├── package.json                       # Optional root scripts/meta (if present)
│
├── backend/                           # Node.js backend + Python embedding orchestration
│   ├── package.json                   # backend npm deps & scripts
│   ├── index.js                       # Express server: routes, startup, middleware
│   ├── database.js                    # SQLite init, Chroma client wiring, persistence helpers
│   ├── documentProcessor.js           # PDF reading, text extraction, chunking (pdf-parse + langchain)
│   ├── ml_runner.js                   # Node ↔ Python bridge: runs embedder.py and returns vectors
│   ├── embedder.py                    # Python script to compute embeddings (sentence-transformers etc.)
│   ├── searchService.js               # RAG orchestration: retrieval, re-rank, LLM prompt + synth
│   ├── query_chroma.js                # Optional small helpers to read/write/query Chroma
│   ├── clear_chroma_collection.js     # Maintenance script to clear Chroma collection
│   ├── db_test.js                     # DB smoke test scripts
│   ├── pipeline_test.py               # Python pipeline test(s)
│   └── vault.db                       # Local SQLite DB (metadata table `documents`)
│
├── frontend/                          # React single-page application (SPA)
│   ├── package.json                   # frontend dependencies & scripts
│   ├── README.md                      # frontend-specific notes
│   ├── public/
│   │   ├── index.html                 # SPA host page
│   │   ├── pdf.worker.min.js          # PDF.js worker for `PdfViewer` component
│   │   └── (icons, manifest, favicons)
│   └── src/
│       ├── index.js                   # React bootstrap
│       ├── index.css                  # Base styles
│       ├── App.js                     # Top-level app component + routing
│       ├── App.css                    # App styling
│       ├── PdfViewer.js               # PDF viewer; opens PDF and highlights chunks
│       ├── Toast.js / Toast.css       # small UI helpers for notifications
│       └── services/
│           └── api.js                 # HTTP client (upload, search, fetch document)
│
├── storage/                           # File storage for original PDFs and uploads
│   ├── uploads/                       # Hashed file blobs stored by backend
│   │   ├── <hash1>
│   │   └── <hashN>
│   └── document-*.pdf                 # Example/original PDFs included in repo
│
├── ml_env/                            # Python virtual environment for embedding (optional)
│   ├── pyvenv.cfg
│   └── (Lib, Scripts, etc.)
│
└── uploads/                           # (alternate/mirrored upload folder used by app)
```

## Component responsibilities (concise)
- `backend/index.js`: initializes the system, calls `initializeDatabase()` before listening, exposes API endpoints:
  - `POST /api/documents/upload` — accepts `multipart/form-data` (`document` field), processes PDF, computes embeddings, stores metadata and vectors.
  - `POST /api/search` — accepts `{ query, history }`, runs `performRAG` in `searchService.js` and returns `{ answer, sources }`.
  - `GET /api/documents/:id` — retrieves file path from `vault.db` and streams the file from `storage/`.

- `backend/database.js`: opens `vault.db` (SQLite), ensures `documents` table exists, and connects to ChromaDB. It exposes `initializeDatabase()` and `saveDocumentAndChunks()`.

- `backend/documentProcessor.js`: reads PDF (using `pdf-parse`), splits text into chunks (`langchain` splitter), and returns chunk list.

- `backend/ml_runner.js` + `backend/embedder.py`: `ml_runner.js` calls `embedder.py` (in `ml_env`) to generate embeddings for text chunks. `embedder.py` uses `sentence-transformers` or another embedding model.

- `backend/searchService.js`: performs RAG — obtains query embedding, queries Chroma, optionally re-ranks chunks using LLM prompts, constructs final prompt and calls the generation model (Gemini via Google Generative AI client) to produce the answer.

- `frontend/src/services/api.js`: centralizes requests to backend endpoints, including upload and search. `PdfViewer.js` uses the response metadata to open the PDF at the correct page/position.

## Data flow (end-to-end)
1. User uploads PDF in browser → frontend pre-parses PDF (positional metadata) and/or sends file to backend.
2. Backend `documentProcessor` extracts text and chunks it.
3. `ml_runner` calls `embedder.py` to compute vectors for each chunk.
4. `database.js` stores document metadata in SQLite and writes vectors + metadata into Chroma collection `documents`.
5. User queries via frontend → `searchService.performRAG`:
   - generate query embedding → query Chroma → re-rank selected chunks → generate final answer via Gemini (or configured LLM) → return answer + source chunks.
6. Frontend displays answer and sources; clicking a source opens the original PDF at the chunk location using `PdfViewer.js`.

## Expected environment variables (`backend/.env`)
```env
# Chroma connection
CHROMA_HOST=localhost
CHROMA_PORT=8000
CHROMA_SSL=false

# LLM / Gemini
GEMINI_API_KEY=your_gemini_api_key_here

# Backend
PORT=5000
```

## Quick run commands
Start Chroma (Docker):
```bash
docker run -p 8000:8000 chromadb/chroma
```

Start backend (from `backend/`):
```bash
cd backend
npm install
# create and populate backend/.env
npm run dev
```

Start frontend (from `frontend/`):
```bash
cd frontend
npm install
npm start
```

API usage examples
- Upload a PDF:
```bash
curl -F "document=@/full/path/to/file.pdf" http://localhost:5000/api/documents/upload
```

- Query (RAG):
```bash
curl -X POST http://localhost:5000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query":"Summarize the latest document's conclusion","history": [] }'
```

## Troubleshooting (targeted checks)
- Chroma connection error: confirm the Docker container is running (`docker ps`) and listening on port `8000`. If running on a different host/port, update `backend/.env`.
- Deprecated `path` warning from Chroma client: harmless if code uses `host/port/ssl`. Ensure `database.js` and `searchService.js` use `host/port/ssl` options.
- `TypeError: Cannot read properties of undefined (reading 'all')` in `searchService.js`: means the SQLite `db` reference wasn't available. Ensure `initializeDatabase()` finishes before the server accepts requests and that `vault.db` exists with `documents` table.
- Embedding errors: activate `ml_env` and run `embedder.py` manually to inspect stack traces. Verify installed Python packages.
- Gemini / generation errors: ensure `GEMINI_API_KEY` set and valid; watch `searchService.js` logs for LLM-related errors.

## Files to inspect when debugging
- `backend/index.js` — server startup and route wiring
- `backend/database.js` — Chroma & SQLite initialization
- `backend/documentProcessor.js` — chunking logic
- `backend/ml_runner.js` and `backend/embedder.py` — embeddings
- `backend/searchService.js` — RAG orchestration and LLM calls
- `frontend/src/services/api.js` and `frontend/src/PdfViewer.js` — frontend integration
