# VAULT: Enterprise AI RAG Platform

> **Production-grade, multi-tenant RAG platform with hybrid search, long-context LLMs, and enterprise-style access control.**

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Architecture](#system-architecture)
3. [Core Architecture & Design](#2-core-architecture--design)
4. [Enterprise RAG Pipeline](#3-enterprise-rag-pipeline)
5. [Security & Access Control (RBAC)](#4-security--access-control-rbac)
6. [Technical Innovation & Architecture](#5-technical-innovation--architecture)
7. [Local Development Setup](#6-local-development-setup)
8. [API Reference](#7-api-reference)
9. [Performance Characteristics](#8-performance-characteristics)
10. [File Structure](#9-file-structure)
11. [Troubleshooting](#10-troubleshooting)
12. [Deployment Notes](#11-deployment-notes)

---

## Executive Summary

**VAULT** is a production-oriented AI platform that delivers **enterprise RAG** capabilities:

* Hybrid retrieval engine (vector + keyword + sequential)
* Long-document understanding with intelligent OCR + quality scoring
* Real-time chat streaming with cancellation and progress tracking
* Multiple AI “modes” tuned for different types of questions

The goal: give teams secure, isolated workspaces where they can upload confidential documents and query them with natural language — without sacrificing reliability, observability, or control.

---

## System Architecture

VAULT is built as a layered system:

* **Client layer** – React SPA with streaming chat UI
* **API gateway** – Node.js/Express + Socket.io + JWT/RBAC
* **Message bus** – Redis for pub/sub and job queues
* **Orchestrator & workers** – Node.js services coordinating RAG, jobs, and notifications
* **Python microservices** – Parsing + embedding
* **Data layer** – PostgreSQL (Standard `FLOAT8[]`) + file storage
* **External LLM APIs** – Groq (Llama 3.1), Google Gemini 1.5, Anthropic Claude

> **Note:** Other components are currently evolving as the platform continues to develop.

![VAULT Architecture](docs/architecture.png)
---

## 1. Purpose

This repository is the **developer reference** for the VAULT Enterprise AI Platform.

* Multi-tenant RAG system for sensitive enterprise environments
* Secure, isolated rooms/workspaces
* Production-style behavior (async pipelines, retries, fallbacks, streaming, RBAC, etc.)

If you’re contributing code or integrating VAULT into another system, this README is your map.

---

## 2. Core Architecture & Design

VAULT is a **distributed microservices** platform built on modern web tech with an emphasis on:

* Scalability
* Fault tolerance
* Clear separation of concerns

### 2.1 System Components

**Frontend (React SPA)**

* Zinc-themed enterprise UI (dark/light)
* Real-time chat with token-by-token streaming & cancellation
* Document library with search and file management
* Conversation management (search, delete, organize)

**Backend (Node.js/Express)**

* High-performance API gateway
* **JWT auth** with role validation
* **Redis Pub/Sub** for service decoupling
* **PostgreSQL** with Native Arrays for embeddings
* Async controllers that return `202 Accepted` quickly and push work to queues

**Databases & Storage**

* **PostgreSQL (primary)** – relational data + `FLOAT8[]` for embeddings (No plugins required)
* **Redis** – message broker for queues and real-time events
* **File system storage** – document storage with cleanup of failed uploads

**AI / ML Services (Python microservices)**

* **Parser API (port 8002)**

  * OCR + layout parsing
  * Quality scoring
  * Azure Document Intelligence fallback when local OCR is low quality
* **Embedder API (port 8001)**

  * High-speed embedding service
  * In-memory model caching

**Background Processing**

* **BullMQ worker** for distributed job processing
* **QueueService** orchestrates the document ingestion pipeline
* WebSocket events for live progress + status updates

---

## 3. Enterprise RAG Pipeline

VAULT’s RAG stack is built as a multi-stage pipeline with routing + quality checks.

### 3.1 Document Ingestion (Async)

```text
User Upload → Immediate 202 Response → Redis Queue → Worker Process
````

  * Files are processed **asynchronously** with real-time progress events

  * **Intelligent parsing**:

      * Local OCR first
      * Azure cloud fallback if quality score is below threshold

  * **Transactional saves** in PostgreSQL (rollback if embedding/vector insert fails)

  * Automatic cleanup of failed uploads and partial state

### 3.2 Hybrid Retrieval Engine

  * **Query classification** (intent detection) – e.g. `VECTOR`, `SQL_METADATA`, `LLM`, `ACTION`

  * **Intent-aware routing**:

      * Sequential reading for summaries
      * Hybrid search for Q\&A

  * **Multi-stage search**:

      * Vector similarity (Euclidean Distance on `FLOAT8[]` arrays)
      * Keyword search (`pg_trgm` similarity)
      * Sequential reading for document-level summarization

  * **Reciprocal Rank Fusion (RRF)** to merge vector + keyword rankings

### 3.3 Multi-Mode Generation

  * **STANDARD** – fast responses for straightforward questions
  * **DEEP\_THINK** – heavier reasoning / chain-of-thought style
  * **DEEP\_RESEARCH** – long-document analysis and synthesis
  * Automatic mode switching based on retrieval context and query type

### 3.4 Real-time Streaming & Citations

  * Token streaming over WebSockets
  * Citation badges with hover previews
  * Math expression detection and evaluation
  * Conversation history with fuzzy search

-----

## 4\. Security & Access Control (RBAC)

VAULT implements a **hybrid RBAC model** that combines:

  * Static roles
  * Resource-level assignments
  * Just-In-Time (JIT) temporary access

All of this is designed to follow **least privilege** by default.

### 4.1 Static Role Hierarchy

Enforced via middleware (e.g. `authorize('Admin')`):

  * **CTO (Super Admin)**

      * Full system access: logs, global settings, user management, everything.

  * **Administrator**

      * Manages users, client assignments, and room configuration **within their client scope**.

  * **ProductOwner (PO)**

      * Manages specific products and their rooms.
      * Can upload documents.
      * No access to global/system-wide admin features.

  * **User (Standard)**

      * Read-only by default.
      * Only sees rooms they are explicitly assigned to.

### 4.2 Contextual Resource Assignments

Access is narrowed by database-level relationships:

  * **Room assignments** – `room_user_assignments` links users → rooms
  * **Product assignments** – `room_po_assignments` links POs → products/rooms
  * **Client isolation** – `admin_client_assignments` maps admins → clients

Every query is filtered by these relationships so users only see the data they’re supposed to.

### 4.3 Just-In-Time (JIT) Access

For cases where someone needs **temporary** elevated access:

1.  **Request**

      * User submits a JIT request via `jitRequestController.js`.

2.  **Approval**

      * Admin or CTO reviews and approves/denies.

3.  **Expiry**

      * Access is granted for a fixed time window (e.g. 4 hours).
      * A scheduled job automatically revokes it when time is up.

### 4.4 Security Layers (Summary)

| Layer              | Mechanism        | Description                                                         |
| ------------------ | ---------------- | ------------------------------------------------------------------- |
| **Authentication** | JWT + middleware | `protect` middleware checks identity on every request.              |
| **Authorization** | Role guards      | Endpoint-level constraints (e.g. only POs can upload documents).    |
| **Data scope** | SQL filters      | `WHERE room_id IN (...)` etc., based on assignments and JIT grants. |
| **Audit** | Access logs      | Track JIT requests, approvals, and room access events.              |

-----

## 5\. Technical Innovation & Architecture

### 5.1 Database Architecture

```sql
-- PostgreSQL with Standard Arrays (Maximum Portability)
document_chunks (
    chunk_id     SERIAL PRIMARY KEY,
    content      TEXT,
    embedding    FLOAT8[],     -- Standard Array (No pgvector plugin needed)
    document_id  INTEGER,
    room_id      INTEGER,
    page_number  INTEGER
);
```

### 5.2 Hybrid Search (RRF)

```js
// Reciprocal Rank Fusion for vector + keyword results
const rankedResults = applyRRF(vectorResults, keywordResults, 60);

// Returns:
// [{ chunk_id, content, metadata, rrfScore, methods: ['Vector', 'Keyword'] }]
```

### 5.3 Intelligent Document Processing

```python
# OCR Quality Scoring (0–100)
def calculate_quality_score(local_chunks, file_path):
    score = 100
    # Penalize: empty content, OCR noise, size mismatches, low alphanumeric density
    # If score < threshold → fallback to Azure Document Intelligence
```

### 5.4 Real-time Event System

```js
// Redis Pub/Sub for decoupled streaming
redisPublisher.publish(NOTIFICATION_CHANNEL, JSON.stringify({
  targetSocketId: socketId,
  event: 'chat_response',
  data: { type: 'chunk', data: token }
}));
```

-----

## 6\. Local Development Setup

### Prerequisites

  * **Node.js** 18+
  * **Python** 3.9–3.11
  * **PostgreSQL** 14+ (No special vector plugins required)
  * **Redis** 6+

### 6.1 Clone & Install

```bash
git clone [https://github.com/vrishank-03/VAULT-Semantic-Search](https://github.com/vrishank-03/VAULT-Semantic-Search)
cd VAULT-Semantic-Search
```

#### Backend

```bash
cd backend
npm install

# Environment
cp .env.example .env
# Then set: DATABASE_URL, REDIS_URL, JWT_SECRET, AZURE_FORM_*
```

#### Database Extensions

```sql
-- Only text similarity extension needed
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

#### Python Services

```bash
python -m venv ml_env
source ml_env/bin/activate        # Windows: .\ml_env\Scripts\activate

pip install -r requirements.txt
pip install "fastapi[standard]" "unstructured[local-inference]" "azure-ai-documentintelligence"
```

### 6.2 Run the Stack

**Terminal 1 – PostgreSQL & Redis**

```bash
# Make sure both services are running
sudo service postgresql start
redis-server
```

**Terminal 2 – Embedder API**

```bash
cd backend
source ml_env/bin/activate
python embedder.py
```

**Terminal 3 – Parser API**

```bash
cd backend
source ml_env/bin/activate
python parser.py
```

**Terminal 4 – Main Server**

```bash
cd backend
node index.js
```

**Terminal 5 – Worker**

```bash
cd backend
node worker.js
```

**Terminal 6 – Frontend**

```bash
cd frontend
npm start
```

### 6.3 Quick Smoke Test

1.  Open `http://localhost:3000`
2.  Create an account
3.  Upload a PDF
4.  Ask a question and verify streaming + citations

-----

## 7\. API Reference

### 7.1 Chat Operations

```http
POST /api/chat/:roomId/:conversationId
# Starts async streaming (202 + Socket.io events)

GET /api/chat/search?q=term
# Fuzzy search across conversation history

DELETE /api/chat/:conversationId
# Delete a conversation and its messages
```

### 7.2 Document Management

```http
POST /api/documents/upload/:roomId
# Async upload + processing, with progress events

GET /api/documents/:roomId
# List documents and metadata

DELETE /api/documents/:documentId
# Delete document + associated vectors
```

### 7.3 WebSocket Events

```js
// Chat streaming
socket.on('chat_response_' + conversationId, (data) => {
  // data.type: 'status' | 'chunk' | 'final' | 'error'
});

// Document processing
socket.on('document_status', (data) => {
  // data.type: 'status' | 'complete' | 'error'
});
```

-----

## 8\. Performance Characteristics

**Document processing**

  * Parsing: **2–10 seconds** per document (size/complexity dependent)
  * Embedding: **\~100 ms** per chunk
  * Upload progress: live WebSocket updates

**Query performance**

  * Vector search: **\< 100 ms** for typical queries (optimized via Room isolation)
  * Hybrid search: **200–500 ms** with re-ranking
  * First streamed token: usually **\< 2 seconds**

**Scalability**

  * PostgreSQL handles **10M+ document chunks**
  * Redis can support **10K+ concurrent WebSocket connections**
  * Python microservices are horizontally scalable

-----

## 9\. File Structure

```text
backend/
├── services/
│   ├── RAGPipelineService.js    # Hybrid retrieval orchestration
│   ├── RetrievalService.js      # Vector + keyword + sequential search
│   ├── GenerationService.js     # Multi-mode AI responses
│   └── QueueService.js          # BullMQ worker & job management
├── controllers/
│   ├── chatController.js        # Async streaming endpoints
│   └── documentController.js    # File upload & management
├── database.js                  # PostgreSQL + FLOAT8[] interface
├── parser.py                    # Enterprise document parsing
├── embedder.py                  # High-speed embedding service
└── worker.js                    # Background job processor

frontend/src/
├── pages/ChatRoomPage/
│   ├── hooks/
│   │   ├── useChatStream.js     # WebSocket management
│   │   ├── useConversations.js  # Conversation state
│   │   └── useFileUpload.js     # Upload progress handling
│   └── components/
│       ├── ChatInput/           # Multi-mode input with attachments
│       ├── MessageBubble/       # Streaming UI with citations
│       └── DocumentLibraryModal # Enterprise file management
├── context/
│   ├── SocketContext.js         # WebSocket provider
│   └── LayoutContext.js         # UI state management
└── services/api.js              # API client with error handling
```

-----

## 10\. Troubleshooting

### Database

```bash
# Confirm extension (only pg_trgm is needed now)
psql -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"
```

### Python Services

```bash
curl http://localhost:8001/health  # Embedder
curl http://localhost:8002/health  # Parser
```

### Redis

```bash
redis-cli ping   # Expect: PONG
```

### File Upload Issues

  * Check permissions on `backend/storage/`
  * Validate Multer file size limits
  * Watch `worker.js` logs for parsing/embedding errors

### Performance Tuning

**Indexes:**

```sql
-- Standard index for Room filtering
CREATE INDEX CONCURRENTLY idx_document_chunks_room 
ON document_chunks(room_id);

-- Standard index for Document filtering
CREATE INDEX CONCURRENTLY idx_document_chunks_doc
ON document_chunks(document_id);
```

**Caching ideas:**

  * Redis connection pooling
  * Caching hot vector query results
  * Session storage optimization

-----

## 11\. Deployment Notes

### Production Considerations

  * PostgreSQL + **PgBouncer** for connection pooling
  * Redis in **cluster / HA** mode
  * Python services behind **Gunicorn** with multiple workers
  * Node.js under **PM2** or similar process manager
  * File storage pointed at cloud object storage (S3, etc.)

### Monitoring & Observability

  * DB query metrics
  * Redis memory + connection usage
  * Health checks for Parser/Embedder APIs
  * WebSocket connection metrics

### Security Hardening

  * JWT rotation
  * API rate limiting
  * File upload sanitization
  * Parameterized SQL everywhere to avoid injection

-----

**License:** MIT

```
```
