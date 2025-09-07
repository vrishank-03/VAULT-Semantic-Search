# VAULT — Semantic Search / RAG Prototype (Developer Reference)

This README documents the VAULT codebase in technical depth — architecture, component contracts, data models, environment variables, run/debug commands, API details, embedding and vector store contracts, and recommended operational practices.

Table of contents
-----------------
- Project summary and goals
- Architecture and responsibilities (deep)
- File-by-file technical map and contracts
- Data models, schemas and on-disk layout
- Environment variables and configuration
- Local development: step-by-step (Windows / bash.exe)
- Embedding runner contract: `embedder.py` and `ml_runner.js`
- Vector store contract: Chroma usage and `query_chroma.js`
- `searchService.js` — retrieval + generation orchestration (detailed flow)
- API reference (endpoints, request/response, error cases)
- Testing, debugging, and logs
- Deployment and scaling notes
- Security, privacy, and operational concerns
- Next steps and improvements

Project summary and goals
-------------------------
VAULT is a prototype for retrieval-augmented generation over a corpus of PDF documents. It focuses on: 1) reliable PDF ingestion and chunking, 2) embedding generation via a pluggable runner, 3) vector storage in Chroma (or an equivalent), 4) query-time retrieval and LLM composition, and 5) a React frontend that surfaces answers with source links back to the PDF.

Goals of this README:
- Provide precise contracts between components so contributors can modify pieces without breaking the system.
- Capture operational steps for local development and reproduction.
- Document likely failure modes and how to debug them.

Architecture and responsibilities (deep)
---------------------------------------
High-level components:
- Frontend (`frontend/`): React SPA that handles login, upload, search UI, and rendering PDFs with page/position navigation.
- Backend (`backend/`): Node/Express API. Handles uploads, PDF processing, persistence to SQLite, vector store operations, and query orchestration.
- Embedding helper (`backend/embedder.py` + `ml_env/`): Python script and virtual environment that produce numeric vectors for chunked text.
- Vector DB (optional): Chroma running locally (Docker) or remote.

Vertical responsibilities and invariants:
- The backend owns the canonical mapping of document IDs to filepaths and metadata in SQLite.
- The vector DB (Chroma) stores vectors and chunk metadata used for nearest-neighbor retrieval. Chunk metadata MUST include a stable document identifier and a chunk index.
- The embedder is a stateless converter: given a list of strings returns a list of same-length vectors (float arrays). The vector dimension is consistent across calls.
- The search orchestration is idempotent for retrieval: given the same query and vector DB state, it should produce the same set of candidate chunks.

File-by-file technical map and contracts
---------------------------------------
This section lists each important file and the internal contract / expectations.

- `backend/index.js` — app entrypoint
  - Responsibilities: load configuration, initialize `database.js`, connect to Chroma (if configured), attach middleware, mount routes from `routes/`, then `app.listen`.
  - Contract: must not call `app.listen` before `database.init()` (or equivalent) completes. Initialization order matters.

- `backend/database.js` — persistence layer
  - Responsibilities: expose functions to open/initialize SQLite, create tables if missing, and helper functions for document and chunk metadata. Optionally, initialize Chroma client using env variables.
  - Exposed helpers (recommended API):
    - `init(dbPath)` — ensures DB file and tables exist.
    - `saveDocument(documentMeta)` — returns document id.
    - `getDocument(id)`
    - `saveChunk(chunkMeta)` — writes chunk metadata if desired (not required if storing everything in Chroma metadata).
    - `ensureCollections()` — create Chroma collections if missing.
  - Internal invariant: the path stored in `documents.filepath` must be accessible to backend process for streaming.

- `backend/documentProcessor.js` — PDF extraction and chunking
  - Responsibilities: open PDF, extract text per page, compute chunk boundaries using configured chunk size and overlap, return array of chunk objects.
  - Chunk object contract (required fields):
    - `documentId` (optional at chunk creation time) — stable id assigned after document metadata persisted.
    - `chunkIndex` — integer index per document, starting at 0.
    - `text` — UTF-8 cleaned string.
    - `startPage` — integer page number (1-based) where this chunk begins.
    - `endPage` — integer page number where this chunk ends.
    - `charStart` (optional) — character offset within `startPage`.
    - `charEnd` (optional)
    - `meta` (optional) — free-form JSON for future needs.
  - Important behaviors: must preserve page numbers so that UI can jump to the exact page and approximate char/position.

- `backend/ml_runner.js` — Node → Python embedding runner
  - Responsibilities: run `embedder.py`, stream input texts, receive vectors, and return them to the caller.
  - Contract:
    - Input: array of strings.
    - Output: array of float arrays (same length, same order) or error.
    - Expected error semantics: on partial failure, runner should either fail whole request or clearly mark which indices failed. Prefer atomic failures for simplicity.
    - Performance: batch texts (e.g., 256 texts per call) to reduce process overhead.

- `backend/embedder.py` — Python embedding script
  - Responsibilities: run inside `ml_env` and expose a CLI or stdin JSON contract for embedding texts.
  - Minimal interface patterns (choose one and document which is used):
    1. CLI: `python embedder.py --input texts.json --output vectors.json`
    2. stdin/stdout JSON streaming: read JSON array from stdin and write JSON array of vectors to stdout.
  - Vector format: JSON array of arrays (floats). Example: [[0.0123, -0.234, ...], ...]
  - Important: embedder must guarantee deterministic dimension and consistent ordering.

- `backend/query_chroma.js` — helper for talking to Chroma
  - Responsibilities: wrap low-level Chroma client, expose simplified functions such as:
    - `upsertVectors(collectionName, vectorsWithMetadata)`
    - `queryVectors(collectionName, queryVector, topK)`
    - `deleteCollection(collectionName)`
  - Data shapes: `vectorsWithMetadata`: array of { id, vector, metadata }, where metadata contains: { documentId, chunkIndex, startPage, endPage, textSnippet }

- `backend/searchService.js` — retrieval + generation orchestrator
  - Responsibilities: Embeds the query, retrieves neighbors from Chroma, optionally re-ranks candidates, constructs LLM prompt, calls LLM (Gemini or other), and returns composed response.
  - Detailed flow (see dedicated section below).

- `backend/clear_chroma_collection.js` — maintenance helper
  - Responsibilities: safely remove/reset a named Chroma collection.

- `backend/controllers/authController.js`, `backend/routes/authRoutes.js`, `backend/middleware/authMiddleware.js`
  - Responsibilities: basic username/password auth storing minimal user records in SQLite. Token issuance (JWT) expected for protected endpoints. The middleware should attach `req.user` after verifying tokens.

- `frontend/` (selected files):
  - `frontend/src/services/api.js` — API client wrapper. Provide a base URL and helpers for auth token injection, retries, and error handling.
  - `frontend/src/PdfViewer.js` — display PDF and accept location anchors: `?page=3` and optional `#char=123` or similar. The backend must provide `page` or `position` metadata to enable direct navigation.

Data models, schemas and on-disk layout
--------------------------------------
This section describes the concrete data shapes and on-disk expectations.

SQLite (suggested schema)
- `documents` table:
  - `id` INTEGER PRIMARY KEY AUTOINCREMENT
  - `filename` TEXT NOT NULL
  - `filepath` TEXT NOT NULL
  - `uploaded_at` DATETIME DEFAULT CURRENT_TIMESTAMP
  - `pages` INTEGER
  - `metadata` TEXT -- JSON string

- `users` table (if auth implemented):
  - `id` INTEGER PRIMARY KEY AUTOINCREMENT
  - `username` TEXT UNIQUE
  - `password_hash` TEXT
  - `created_at` DATETIME

- `chunks` table (optional; if chunk metadata is also kept in SQLite):
  - `id` INTEGER PRIMARY KEY AUTOINCREMENT
  - `document_id` INTEGER REFERENCES documents(id)
  - `chunk_index` INTEGER
  - `start_page` INTEGER
  - `end_page` INTEGER
  - `text_snippet` TEXT
  - `metadata` TEXT

On-disk layout
- `backend/vault.db` (default, not committed) — SQLite DB file if used.
- `backend/storage/` — stored PDFs (committed example PDFs included for testing). These are referenced by `documents.filepath`.
- `backend/storage/uploads/` — hashed blobs representing uploaded files. Backed by app logic that maps upload id → filename.

Environment variables and configuration
---------------------------------------
The app expects certain env vars. Put them into `backend/.env` (NOT committed). Example:

```env
# Chroma connection
CHROMA_HOST=localhost
CHROMA_PORT=8000
CHROMA_SSL=false
CHROMA_API_KEY=

# LLM / generation
GEMINI_API_KEY=
LLM_PROVIDER=gemini   # or openai, etc.
LLM_MODEL=gemini-1.0

# Backend
PORT=5000
NODE_ENV=development
SQLITE_PATH=./vault.db

# Auth / security
JWT_SECRET=replace_with_a_strong_random_secret
JWT_EXPIRY=7d
```

Local development: step-by-step (Windows / bash.exe)
---------------------------------------------------
This section gives ready-to-paste commands for a developer using `bash.exe`.

1) Backend - install and configure

```bash
cd backend
npm install
# create .env from template above (use an editor)
```

2) Python environment for embeddings (if `ml_env` is missing or incomplete)

```bash
# from repo root
python -m venv ml_env
# use bash.exe activation for Windows (Git Bash)
source ml_env/Scripts/activate
pip install --upgrade pip
pip install sentence-transformers numpy torch transformers # adjust per embedder.py requirements
# optionally pin versions
pip freeze > backend/requirements.txt
```

3) Start Chroma (optional but recommended for local dev)

```bash
# requires Docker installed
docker run -d --name chroma-local -p 8000:8000 chromadb/chroma
# confirm
docker ps
curl http://localhost:8000/ || true
```

4) Start backend

```bash
cd backend
# dev script may use nodemon if defined
npm run dev
# or
node index.js
```

5) Start frontend

```bash
cd frontend
npm install
npm start
```

Embedding runner contract: `embedder.py` and `ml_runner.js`
-----------------------------------------------------------
The embedder is a critical contract boundary. The system expects a simple, robust interface.

Requirements (contract):
- Input: JSON array of strings (texts) via stdin or a file.
- Output: JSON array of numeric arrays with the same length and order as the input.
- Vector dimension must be consistent. The backend should detect and assert the dimension for the first run.

Suggested CLI behavior for `embedder.py`:
- Exit code 0 on success; write vectors to stdout as JSON.
- On error, write a JSON object to stderr with `error` and `trace` fields and exit with non-zero code.

Example (stdin/stdout):

Input (stdin):
["first text chunk", "second chunk"]

Output (stdout):
[[0.123, -0.234, ...], [0.456, -0.789, ...]]

`ml_runner.js` responsibilities:
- Batch inputs, call embedder, parse stdout safely (timeout + size limits), verify output shapes and lengths.
- On mismatch or dimension change, raise an explicit error and do not write to Chroma.
- Implement a retry/backoff for transient Python process failures.

Vector store contract: Chroma usage and `query_chroma.js`
--------------------------------------------------------
Chroma data model (as used by this project):
- Collection name (suggestion: `vault_documents` or per-tenant collection)
- Each vector entry has:
  - `id`: stable string (e.g., `${documentId}_${chunkIndex}`)
  - `vector`: float array
  - `metadata`: object with at least `{ documentId, chunkIndex, startPage, endPage, textSnippet }`

Recommended upsert flow:
1. Persist document metadata in SQLite and get `documentId`.
2. Use `documentId` to build vector ids for each chunk.
3. Call `query_chroma.upsertVectors(collection, vectorsWithMetadata)`.
4. Confirm Chroma returned success before marking document ingestion complete.

`query_chroma.js` should surface clear promise-based APIs and map Chroma SDK errors into well-typed backend errors.

`searchService.js` — retrieval + generation orchestration (detailed flow)
-------------------------------------------------------------------------
This is the heart of RAG. The service should be structured in clear phases.

Inputs: { query: string, history?: [{role, content}], topK?: number }
Outputs: { answer: string, sources: Array<source>, raw?: { chroma, llm } }

Phases:
1. Validate input and auth (via middleware). Sanitize text (strip control chars).
2. Embed query using `ml_runner`.
   - Assert returned vector dimension matches indexed vectors.
3. Retrieve nearest neighbors from Chroma (`topK`, default 10-25).
   - Each neighbor should contain: id, distance/score, metadata.
4. (Optional) Re-rank with a small cross-encoder or LLM if higher precision is required.
5. Construct prompt for generation:
   - Include system instruction describing the role (concise), the top retrieved chunks (text + provenance lines), and the user query.
   - Explicitly include source attributions like `[[source:documentId|chunkIndex|pageRange]]` so LLM can cite.
   - Limit context tokens: trim chunk text to allowable token budget based on `LLM_MODEL`.
6. Call LLM provider with the prompt and streaming or non-streaming mode.
7. Post-process response:
   - Extract `answer` text.
   - Map source attributions back to `documentId` and `page` and produce `sources` array: `{ documentId, chunkIndex, score, page, textSnippet }`.
8. Return final payload to client.

Failure modes and handling:
- If embeddings fail: return 503 with structured error and `retryable: true`.
- If Chroma times out: 503 with `retryable: true`.
- If LLM returns empty or nonsensical answer: return 200 but include `raw.llm` and `raw.chroma` for client debugging and mark `answerConfidence: low`.

API reference (endpoints, request/response, and examples)
--------------------------------------------------------
High-level base path: `/api` (adjust in `index.js` as needed)

Auth
- POST `/api/auth/register`
  - body: { username, password }
  - success: 201 { success: true, userId }
  - errors: 400 (validation), 409 (username exists)

- POST `/api/auth/login`
  - body: { username, password }
  - success: 200 { token: "JWT...", user: { id, username } }
  - errors: 401 (invalid credentials)

Documents
- POST `/api/documents/upload` (multipart/form-data)
  - fields: `document` file, optional `title` and `tags`.
  - behavior: store file to `backend/storage/uploads/`, persist metadata to `documents` table, run `documentProcessor` to chunk, call embedder and upsert vectors.
  - response: 200 { ok: true, documentId, ingestion: { status: 'queued'|'completed', details } }
  - important: ingestion may be asynchronous; consider returning 202 if background processing is used.

- GET `/api/documents/:id`
  - streams the PDF with appropriate `Content-Type: application/pdf` and `Content-Disposition: inline; filename="..."`.

Search
- POST `/api/search`
  - body: { query: string, topK?: number, history?: [{ role, content }] }
  - success: 200 {
      answer: string,
      sources: [ { documentId, chunkIndex, score, page, textSnippet } ],
      raw: { chromaResponse, llmResponse }
    }
  - errors: 400 (missing query), 401 (unauthenticated), 503 (external service failure)

Error payloads (recommended)
- `{ error: { message: string, code?: string, retryable?: boolean, details?: any } }`

Testing, debugging, and logs
---------------------------
Recommended quick tests:
- Unit:
  - `documentProcessor` with a small PDF fixture — assert chunk count and page ranges.
  - `ml_runner` with synthetic texts — expect correct vector shapes.
- Integration:
  - Full pipeline test that uploads a PDF from `backend/storage/` and asserts ingestion finishes and vectors present in Chroma (use ephemeral test collection).

Run-time logging:
- Backend should log at levels: DEBUG / INFO / WARN / ERROR.
- Log critical events: upload received, ingestion started/completed, embedding errors, Chroma upsert responses, LLM requests/responses (truncate prompts in logs for PII safety), auth failures.

Debugging tips:
- If ingestion fails during embeddings: activate `ml_env` manually and run `embedder.py` with sample inputs. Inspect Python exceptions.
- If Chroma queries return unexpected distances: verify the vector normalization scheme (if you use cosine vs euclidean) — Chroma's client config must match how embeddings are compared.

Deployment and scaling notes
----------------------------
- Chroma in prod: evaluate using a managed vector DB or cluster; local Chromadb Docker is fine for dev.
- Batch embeddings and background ingestion workers: use a job queue (Redis + Bull/Queue) for larger uploads.
- LLM calls: use streaming for better UX; add rate limiting and caching for frequent queries.
- Horizontal scaling: keep backend stateless (except SQLite which should be replaced by a networked DB for scaling).

Security, privacy, and operational concerns
------------------------------------------
- DO NOT commit secrets. `backend/.env` must be in `.gitignore`.
- Sanitize uploaded files: validate MIME types, limit file size, and scan for PDFs that exploit vulnerabilities.
- Data retention: consider purging or encrypting older PDFs.
- Auth: use strong password hashing (bcrypt with cost >= 12) and rotate `JWT_SECRET` when needed.
- Logging: redact PII and prompt text when logging LLM prompts; store full raw data only if required and secured.

Next steps and improvements
--------------------------
Short-term:
- Add `backend/requirements.txt` for the embedder and a `backend/README.md` describing how to update embeddings.
- Implement background ingestion with a job queue and progress tracking.
- Add unit tests for `documentProcessor`, `ml_runner`, and `query_chroma`.

Mid-term:
- Replace SQLite with Postgres for production persistence.
- Add opt-in user-level document ownership and per-tenant Chroma collections.
- Add monitoring and distributed tracing for LLM calls and heavy ingestion tasks.

Long-term:
- Add re-ranking model (cross-encoder) for higher-quality retrieval.
- Add differential privacy options for storing user queries.

Appendix — quick commands
-------------------------
Backend dev (from repo root):

```bash
cd backend
npm install
# ensure .env exists
npm run dev
```

Frontend dev:

```bash
cd frontend
npm install
npm start
```

Start Chroma (Docker):

```bash
docker run -d --name chroma-local -p 8000:8000 chromadb/chroma
```

How to run `embedder.py` for a quick test:

```bash
source ml_env/Scripts/activate
# If embedder.py expects stdin JSON
echo '["hello world","second text"]' | python backend/embedder.py
# Or, if it accepts a file
python backend/embedder.py --input tests/texts.json --output /tmp/vectors.json
```

Contacts and contributing
-------------------------
Open an issue or PR. For architectural changes, update this README and `hierarchical-diagram.md` to reflect the new contracts.

License
-------
See `LICENSE` in repository root.