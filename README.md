# VAULT — Semantic Search / RAG Prototype (Developer Reference)

Purpose
-------
This README is a single, practical reference for engineers working on VAULT: a small, maintainable Retrieval-Augmented Generation prototype that lets you ingest PDFs, index semantic chunks in a vector store (Chroma), and answer queries with LLM-backed composition and source attributions.

Design goals
------------
- Clear contracts between systems (frontend, backend, embedding runner, vector store).
- Simple, testable ingestion pipeline that preserves page-level provenance.
- Pluggable embedding runner so models and infra can be swapped without changing orchestration logic.
- Developer ergonomics: reproducible local dev steps, quick smoke tests, and clear troubleshooting notes.

Contents (high level)
- Overview & architecture
- File-by-file map (what each file does and why it matters)
- Contracts (embedding, vector store, search service)
- Quick start (Windows / bash.exe)
- Testing and smoke checks
- Troubleshooting & operational notes
- Security, deployment, and next steps

Overview & architecture
-----------------------
- Frontend (React): UI, auth, file upload, PDF viewer, search UX.
- Backend (Node/Express): API surface, ingestion pipeline, DB, and orchestration.
- Embedding runner (Python + Node bridge): deterministic embeddings for text chunks.
- Vector store (Chroma by default): nearest-neighbor retrieval and metadata storage.

File-by-file map — focused and actionable
----------------------------------------
Use this as a quick orientation when you open a file.

Root
- `LICENSE` — project license.
- `hierarchical-diagram.md` — human-readable repo tree and overview.

backend/
- `package.json` / `package-lock.json` — backend deps + scripts (dev/start/test hooks).
- `index.js` — server bootstrap: config, DB init, middleware, route mounting, and server startup. Key responsibilities: fail fast on misconfigured env and ensure DB and Chroma client are initialized before listening.
- `database.js` — thin persistence layer for SQLite (open/init, migrations, helper queries). Expected to expose: `init()`, `saveDocument()`, `getDocument()`, `saveUser()`, and optionally chunk-related helpers.
- `db_test.js` — quick manual DB checks and examples used by devs.
- `documentProcessor.js` — PDF parsing and chunking. Input: PDF filepath. Output: chunk array with { chunkIndex, text, startPage, endPage, charStart?, charEnd?, meta? } — page boundaries are required for accurate UI navigation.
- `ml_runner.js` — orchestrates embedding generation by spawning `embedder.py` or calling a remote service. Responsibilities: batching, timeouts, parsing stdout, validating shapes, retry/backoff policy.
- `embedder.py` — Python embedding helper. Contract: stdin/json-array or file-in/file-out returning a JSON array of vectors. Keep this script minimal and deterministic.
- `pipeline_test.py` — utility tests for Python-side code and embedder verification.
- `clear_chroma_collection.js` — CLI helper to reset a Chroma collection (useful in tests).
- `query_chroma.js` — client adapter that exposes: `upsertVectors(collection, vectorsWithMetadata)`, `queryVectors(collection, vector, topK)`, `deleteCollection(collection)` and normalizes Chroma client responses to { id, score, metadata }.
- `searchService.js` — the RAG orchestration: embed query → retrieve → re-rank (optional) → build prompt → call LLM → post-process and return answer + sources.

Auth / routes / middleware
- `controllers/authController.js` — register/login handlers, user creation, password hashing (bcrypt), and token issuance.
- `routes/authRoutes.js` — route definitions for auth endpoints.
- `middleware/authMiddleware.js` — JWT verification and request user attachment.

Storage & DB assets
- `storage/` — committed sample PDFs used for dev tests and demonstrations. `storage/uploads/` contains hashed blob files produced by the upload pipeline.
- `vault.db` — example SQLite DB file included for convenience in dev; treat it as ephemeral test data.

ml_env/
- Optional committed Python venv (not recommended). Prefer creating a local venv in CI/dev: `python -m venv backend/ml_env` and install packages from `backend/requirements.txt`.

frontend/
- `package.json` / `package-lock.json` — frontend deps.
- `public/` — static assets (PDF worker, icons, index.html).
- `src/` — React app source.

Important frontend files (where to look first)
- `src/index.js` — bootstraps React Router and providers.
- `src/App.js` — routes and global layout.
- `src/PdfViewer.js` — handles PDF rendering and page anchor navigation.
- `src/services/api.js` — central HTTP client (auth token injection, baseURL).
- `src/pages/` — `Dashboard.js`, `LoginPage.js`, `SignupPage.js`.
- `src/components/` — reusable UI pieces:
  - `AuthLayout.js` — auth pages container.
  - `Navbar.js` — top navigation.
  - `PrivateRoute.js` — route guard (Outlet-based) used in v6 router.
  - `Sidebar.js` — app sidebar.
  - `ThemeToggleButton.js` — UI theme control.
  - `Typewriter.js` — micro interaction for headers.
  - `GoogleLoginButton.js` — Google OAuth button (`@react-oauth/google`).
  - `SuccessAnimation.js`, `ProcessingAnimation.js` — small UX animations used across the UI.

Contracts — keep these small and testable
--------------------------------------
Embedding contract (critical):
- Input: array<string> (texts), same order as produced by `documentProcessor`.
- Output: array<array<number>> (vectors) with identical length and order.
- The first-run vector dimension is authoritative — `ml_runner.js` must assert subsequent calls match.

Vector store contract (Chroma):
- Upsert item: `{ id: string, vector: number[], metadata: { documentId, chunkIndex, startPage, endPage, textSnippet } }`.
- Query return: normalized `{ id, score, metadata }`.

Search service contract:
- Input: `{ query: string, topK?: number, history?: Array }`.
- Output: `{ answer: string, sources: Array<{ documentId, chunkIndex, score, page, textSnippet }>, raw?: { chroma, llm } }`.

Data models (suggested schemas)
--------------------------------
SQLite (recommended fields):
- `documents` — { id INTEGER PK, filename TEXT, filepath TEXT, uploaded_at, pages INTEGER, metadata JSON }
- `chunks` (optional) — { id, document_id, chunk_index, start_page, end_page, text_snippet, metadata JSON }
- `users` — { id, username TEXT UNIQUE, password_hash TEXT, created_at }

Environment variables (create `backend/.env`, DO NOT COMMIT)
------------------------------------------------------------
Example minimal env:

```env
# Chroma
CHROMA_HOST=localhost
CHROMA_PORT=8000
CHROMA_SSL=false
CHROMA_API_KEY=

# LLM
LLM_PROVIDER=gemini
LLM_API_KEY=
LLM_MODEL=gemini-1.0

# Backend
PORT=5000
NODE_ENV=development
SQLITE_PATH=./vault.db

# Auth
JWT_SECRET=replace_with_a_strong_random_secret
JWT_EXPIRY=7d
```

Quick start — local developer flow (Windows / bash.exe)
------------------------------------------------------
1) Backend setup

```bash
cd backend
npm install
# create backend/.env from the example above
```

2) Python embedding environment (recommended)

```bash
# from repo root
python -m venv backend/ml_env
source backend/ml_env/Scripts/activate
pip install --upgrade pip
pip install -r backend/requirements.txt || pip install sentence-transformers numpy torch transformers
```

3) Optional: start Chroma locally (Docker)

```bash
docker run -d --name chroma-local -p 8000:8000 chromadb/chroma
```

4) Start backend

```bash
cd backend
# dev script recommended
npm run dev || node index.js
```

5) Start frontend

```bash
cd frontend
npm install
npm start
```

Quick smoke tests
-----------------
These are fast checks we can run to confirm the main pipeline works on your machine.

- DB sanity: run `node backend/db_test.js` to exercise DB helpers.
- Embedder check (Python):

```bash
source backend/ml_env/Scripts/activate
echo '["hello world","second text"]' | python backend/embedder.py
```

- Ingestion smoke (end-to-end):
  1. Start backend and Chroma.
  2. Use `curl` or Postman to POST a local PDF to `/api/documents/upload` and observe `ingestion` status in the response.

Testing strategy
----------------
- Unit tests: `documentProcessor` (chunking/page mapping), `ml_runner` (shape/timeout), `query_chroma` (adapter behavior).
- Integration: upload a small PDF from `backend/storage/` and assert Chroma has vectors and `searchService.js` returns sources.

Troubleshooting & common failure modes
-------------------------------------
- Embedding runtime errors: run `embedder.py` directly in `backend/ml_env` with a small JSON input to inspect stack traces.
- Mismatched vector dimensions: `ml_runner.js` must detect and reject dimensionality changes.
- Chroma connection failures: verify `CHROMA_HOST`/`CHROMA_PORT` and Docker container health.
- Auth issues: ensure `JWT_SECRET` is set and consistent; check token expiry times.

Security & operational notes
---------------------------
- Never commit secrets or `.env` files.
- Protect uploaded files and enforce file-size limits.
- Use bcrypt for passwords and rotate `JWT_SECRET` as needed.
- Monitor and redact LLM prompts in logs to avoid leaking PII.

Next steps & high-value improvements
-----------------------------------
- Add CI pipeline that runs a headless ingestion smoke test and verifies vector upserts.
- Introduce background ingestion (Redis + worker queue) for scalability and reliability.
- Replace SQLite with Postgres for multi-instance deployments.
- Add re-ranking (cross-encoder) and stronger prompt engineering for higher precision answers.

Contributing
------------
- Open PRs against `development`. Keep changes small and include tests for ingestion/search logic.

If you'd like, I can also:
- generate a JSON machine-readable tree of the repo,
- expand `hierarchical-diagram.md` to list every file in `backend/storage/`, or
- add a small `backend/README.md` describing how to setup the embedder and a `requirements.txt` file.

License
-------
See `LICENSE` in repository root.