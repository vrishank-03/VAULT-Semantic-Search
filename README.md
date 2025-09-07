# VAULT — Semantic Search / RAG Prototype (Developer Reference)

Welcome — this README is a concise, developer-focused reference for VAULT: a Retrieval-Augmented Generation (RAG) prototype that indexes PDF documents, stores chunk vectors in a vector store (Chroma by default), and delivers retrieval-backed answers via an LLM-backed orchestration.

What you'll find here
- Quick project summary and goals
- Architecture and component responsibilities
- Precise file map (what each file does)
- Data models and on-disk layout
- Environment variables and local setup (Windows / bash.exe)
- Embedding and vector store contracts
- API reference and important endpoints
- Testing, debugging, and troubleshooting
- Security, deployment, and next steps

Quick project summary
---------------------
VAULT is designed to demonstrate a small, maintainable RAG pipeline:
- Ingest PDFs, extract text and chunk it while preserving page boundaries.
- Generate embeddings using a pluggable Python embedder (`backend/embedder.py`).
- Store embeddings and chunk metadata in a vector DB (Chroma) via `backend/query_chroma.js`.
- Orchestrate retrieval and LLM composition in `backend/searchService.js`.
- Provide a React frontend (`frontend/`) with auth, upload, search, and PDF navigation UI.

High-level architecture
-----------------------
- Frontend: React SPA in `frontend/` — handles UI, auth, uploads, and displays RAG answers with source links back to PDFs.
- Backend: Node/Express in `backend/` — handles file storage, processing pipelines, embedding orchestration, vector store access, and API endpoints.
- ML/Embedding layer: `backend/embedder.py` + `backend/ml_runner.js` — Python model/runner that produces embeddings for text chunks.
- Vector store: Chroma (local Docker or remote). `backend/query_chroma.js` wraps the low-level client.

File map — what each important file/folder does
-----------------------------------------------
Top-level
- `LICENSE`, `hierarchical-diagram.md` — repo metadata and an overview tree.

backend/
- `package.json`, `package-lock.json` — backend dependencies and scripts.
- `index.js` — Express app entrypoint: loads config, initializes DB, mounts routes and starts the server.
- `database.js` — SQLite access and helper functions (document/user metadata operations).
- `db_test.js` — quick DB sanity checks / examples.
- `documentProcessor.js` — PDF parsing and chunking. Produces chunk objects that include page ranges and snippet text.
- `ml_runner.js` — spawns / manages the embedding process (Node → Python bridging), batches inputs and validates outputs.
- `embedder.py` — Python embedding script. Reads texts and returns vectors via stdin/stdout or file-based contract.
- `pipeline_test.py` — Python-side pipeline tests for embedder or parsing behaviors.
- `clear_chroma_collection.js` — maintenance utility to remove/reset collections in Chroma.
- `query_chroma.js` — adapter for Chroma: upsert, query, delete helpers that handle metadata shapes.
- `searchService.js` — orchestrates query embedding, retrieval, optional re-ranking, prompt construction, and LLM calls.

Auth and routing
- `controllers/authController.js` — handlers for signup/login flows.
- `routes/authRoutes.js` — mounts auth-related routes.
- `middleware/authMiddleware.js` — verifies JWT/session and attaches `req.user`.

Storage and DB
- `storage/` — committed sample PDFs and an `uploads/` folder of hashed blobs used by the app during uploads.
- `vault.db` — example/local SQLite DB file (present in repo for convenience; treat carefully).

ml_env/
- A local Python virtual environment containing packages used by `embedder.py` (if present). Prefer to create your own local venv instead of using committed `ml_env`.

frontend/
- `package.json`, `package-lock.json` — frontend dependencies.
- `public/` — static assets (icons, `index.html`, `pdf.worker.min.js`).
- `src/` — app source code.

Key frontend source files
- `src/index.js` — app bootstrap and route setup.
- `src/App.js`, `src/App.css` — root app.
- `src/PdfViewer.js` — PDF renderer with page navigation anchors.
- `src/ProtectedRoute.js` — legacy/alternate route guard (if used).
- `src/Toast.js`, `src/Toast.css` — UI toast notifications.

Services, pages and components
- `src/services/api.js` — HTTP client wrapper for backend endpoints (auth token injection, baseURL, error handling).
- `src/pages/` — `Dashboard.js`, `LoginPage.js`, `SignupPage.js`.
- `src/components/` — modular UI components used across pages:
  - `AuthLayout.js` — layout for auth pages.
  - `Navbar.js` — top navigation bar.
  - `PrivateRoute.js` — Outlet-based route guard for protected views.
  - `Sidebar.js` — app navigation sidebar.
  - `ThemeToggleButton.js` — switch light/dark themes.
  - `Typewriter.js` — small typewriter text effect used in landing or headers.
  - `GoogleLoginButton.js` — Google OAuth sign-in button (uses `@react-oauth/google`).
  - `SuccessAnimation.js` — visual success animation used in UI flows.
  - `ProcessingAnimation.js` — processing/loading animation for long-running tasks.

Contracts and important invariants
---------------------------------
Embedding contract (`embedder.py` / `ml_runner.js`)
- Input: JSON array of strings (texts) in the same order the chunks were produced.
- Output: JSON array of float arrays (vectors) with the same length and order.
- Dimension: vector length is stable across calls; the backend must assert and enforce consistent dimensioning.

Vector store contract (Chroma via `query_chroma.js`)
- Each upsert entry: `{ id: string, vector: number[], metadata: { documentId, chunkIndex, startPage, endPage, textSnippet } }`.
- `id` recommendation: `${documentId}_${chunkIndex}` for stable uniqueness.

Search service contract (`searchService.js`)
- Input: `{ query: string, topK?: number, history?: [] }`.
- Output: `{ answer: string, sources: [{ documentId, chunkIndex, score, page, textSnippet }], raw?: { chroma, llm } }`.

Data models & on-disk layout
---------------------------
Suggested SQLite schema (in `backend/database.js` expectations):
- `documents`: `{ id, filename, filepath, uploaded_at, pages, metadata }`.
- `chunks` (optional): `{ id, document_id, chunk_index, start_page, end_page, text_snippet, metadata }`.
- `users`: `{ id, username, password_hash, created_at }`.

Files on disk:
- `backend/vault.db` — local SQLite database file (treat as an example/test DB).
- `backend/storage/` — PDFs and `uploads/` blobs.

Environment variables
---------------------
Create `backend/.env` (DO NOT COMMIT). Minimal example:

```env
# Chroma
CHROMA_HOST=localhost
CHROMA_PORT=8000
CHROMA_SSL=false
CHROMA_API_KEY=

# LLM / generation
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

Local development — quick start (Windows, bash.exe)
-------------------------------------------------
1) Backend

```bash
cd backend
npm install
# copy sample .env into backend/.env and update values
```

2) Python embedding environment

```bash
# from repo root
python -m venv backend/ml_env
# activate (Git Bash / bash.exe)
source backend/ml_env/Scripts/activate
pip install --upgrade pip
pip install -r backend/requirements.txt || pip install sentence-transformers numpy torch transformers
```

3) Start local Chroma (optional, for dev)

```bash
# requires Docker
docker run -d --name chroma-local -p 8000:8000 chromadb/chroma
```

4) Start backend

```bash
cd backend
# use npm script or node directly
npm run dev || node index.js
```

5) Start frontend

```bash
cd frontend
npm install
npm start
```

Embedding / ml runner notes
---------------------------
- `ml_runner.js` batches text chunks and invokes `embedder.py`. It must validate that the number and dimensionality of returned vectors match the request.
- `embedder.py` should provide a simple stdin/stdout JSON contract or file-based CLI for batch embedding to simplify integration and retries.

Vector store and ingestion flow
------------------------------
1. Persist document metadata to SQLite and obtain `documentId`.
2. Use `documentProcessor.js` to chunk PDF text and produce chunk objects with page boundaries.
3. Pass chunk texts to `ml_runner.js` to obtain vectors.
4. Build vector entries and call `query_chroma.upsertVectors(collection, vectorsWithMetadata)`.
5. On success, mark ingestion complete; on failure, provide clear retryable errors and rollback registration if necessary.

API reference (selected endpoints)
---------------------------------
Base path: `/api`

- POST `/api/auth/register` — register user (body: `{ username, password }`).
- POST `/api/auth/login` — login (body: `{ username, password }`). Returns JWT.
- POST `/api/documents/upload` — upload PDF (multipart form): stores file, queues ingestion, returns `documentId` and ingestion status.
- GET `/api/documents/:id` — stream the original PDF for viewing in the frontend.
- POST `/api/search` — search query: `{ query, topK?, history? }` → returns `{ answer, sources, raw }`.

Testing and verification
------------------------
- Unit tests: add tests for `documentProcessor`, `ml_runner`, and `query_chroma`.
- Integration smoke test: upload one PDF from `backend/storage/` and assert that ingestion completes and `query_chroma` returns vectors.

Troubleshooting & common issues
-------------------------------
- Embedding failures: run `embedder.py` manually inside `backend/ml_env` with a small JSON input; inspect stack traces.
- Chroma connectivity errors: ensure Docker port mapping and `CHROMA_HOST/PORT` are correct.
- Token / auth issues: verify `JWT_SECRET` consistency between backend and any token-issuing clients.

Security and operational considerations
-------------------------------------
- Never commit `backend/.env` or any secrets; add them to `.gitignore`.
- Validate and sanitize uploaded PDFs. Enforce size limits.
- Use bcrypt for password hashing with a safe cost factor.
- Log safely: redact prompt content or store it only in secure, access-controlled locations.

Next steps / recommended improvements
-----------------------------------
- Add CI tests that run a small ingestion flow and validate vector upsert.
- Replace SQLite with Postgres or another networked DB for multi-instance deployments.
- Add background processing (Redis + Bull) for ingestion scalability.
- Improve frontend UX: show ingestion progress, document previews, and source linkouts with page anchors.

Contributing
------------
- Please open issues or PRs against the `development` branch.
- Follow the existing code style; add unit tests for any new logic affecting ingestion or search.

Contact / attribution
---------------------
If you need a guided walkthrough of the code, point me to a file or an area you want to inspect and I will create focused documentation, tests, or example runs.

---

End of file

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