# VAULT — Enterprise RAG & Knowledge Platform (Developer Reference)

## 1\. Purpose

This document serves as the primary technical reference for **VAULT**, an enterprise-grade, multi-tenant Retrieval-Augmented Generation (RAG) platform.

VAULT is designed to provide secure, isolated environments where teams can upload sensitive documents and perform natural language queries against them. The system is built on a sophisticated, **asynchronous microservice architecture** and a **top-down hierarchical Role-Based Access Control (RBAC)** model, ensuring high scalability, data integrity, and granular permissions.

This README details the system architecture, the new RBAC model, the RAG pipeline, key features, and a detailed setup guide.

-----

## 2\. Core Architecture & Design

VAULT is a distributed application composed of a React frontend, a Node.js/Express backend API, a background job queue, and several containerized Python microservices for AI/ML tasks.

### 2.1. System Components

  * **Frontend (React):** A responsive single-page application (SPA) that provides all user-facing interfaces.

      * **Hierarchical Dashboard:** A role-aware dashboard (CTO/PO sees `Products` $\rightarrow$ `Clients` $\rightarrow$ `Rooms`, Admin sees `Clients` $\rightarrow$ `Rooms`, User sees `Rooms`).
      * **Authentication:** Handles login, role-based signup, and password reset.
      * **Management Modals:** A suite of modals for user/product approval, client assignment, etc.
      * **JIT Systems:** Interfaces for two distinct JIT systems (Room-level and Peer-level).
      * **Streaming Chat Interface:** A real-time, streaming chat UI that uses **Socket.io** to receive token-by-token responses from the backend, including a "Document Library" modal with search.

  * **Backend (Node/Express):** A lightweight, non-blocking API server that acts as the central router.

      * **Authentication System:** JWT-based auth with email verification.
      * **Hierarchical RBAC System:** A complex, manager-based RBAC model.
      * **JIT Access Controllers:** Manages all temporary access requests.
      * **Chat Controller (Streaming):** Handles chat queries by returning an **immediate `202 Accepted`** response, then hands the query to the RAG service to stream the answer back via Socket.io.
      * **Upload Controller (Async):** Handles file uploads by returning an **immediate `202 Accepted`** response, then adding a job to the Redis queue.
      * **Socket.io Service:** Provides real-time updates for chat streaming and document processing status.

  * **Databases & Caching:**

      * **Database (SQLite):** The primary persistence layer for all relational data (`users`, `products`, `clients`, `chat_rooms`, `documents`, JIT tables, etc.).
      * **Vector Store (ChromaDB):** Stores document chunks and embeddings, strictly filtered by `roomId` and `documentName` during retrieval.
      * **Queue & Cache (Redis):** A high-speed in-memory store with two roles:
        1.  **Job Queue (BullMQ):** Manages the "document-processing" queue.
        2.  **Cache:** (Future) Caching for expensive queries.

  * **AI/ML Services (Python Microservices):**

      * **Parser API (FastAPI):** A dedicated server (port `8002`) running `unstructured.io`. It provides enterprise-grade, **OCR-powered** parsing for PDFs, `.docx`, `.pptx`, and scanned images.
      * **Embedder API (FastAPI):** A dedicated server (port `8001`) that keeps the `SentenceTransformer` model loaded in memory for high-speed embedding, eliminating the 20-second "cold start."

  * **Backend Worker (Node.js):**

      * A separate Node.js process (`QueueService.js`) that runs the BullMQ worker.
      * This is the **only** process that does heavy work. It pulls jobs from the Redis queue and orchestrates the entire ingestion pipeline:
        1.  Calls the **Parser API** to get clean, logical chunks.
        2.  Calls the **Embedder API** to get vectors for those chunks.
        3.  Calls `database.js` to perform a **transactional save** to SQLite and ChromaDB.
        4.  Emits `document_status` events (`status`, `complete`, `error`) via Socket.io to notify the user.

### 2.2. The RAG Pipeline (Detailed)

VAULT's RAG system is now a fully asynchronous, decoupled architecture.

**1. Ingestion (Asynchronous)**

  * An authorized user uploads one or more files in the chat room.
  * The frontend sends the files (and its `socketId`) to `POST /api/documents/upload/:roomId`.
  * `index.js` receives the file, saves it to `/storage`, adds a job (with file path, name, `roomId`, `userId`, `socketId`) to the Redis queue via `QueueService.js`.
  * The server **immediately returns `202 Accepted`**. The entire request takes **\< 100ms**.
  * The user's UI is not blocked and they can continue working.

**2. Processing (Background Worker)**

  * The separate **Node.js Worker** process picks up the job from the queue.
  * The worker sends a `document_status: 'status', message: 'Parsing...'` event to the user's socket.
  * **Step 2a (Parse):** The worker sends the file to the **Parser API (port 8002)**. `unstructured.io` performs layout analysis and OCR, returning high-quality, logical chunks (`[{text, page_number}]`).
  * **Step 2b (Embed):** The worker sends the text chunks to the **Embedder API (port 8001)**, which returns vectors instantly.
  * **Step 2c (Save):** The worker calls `saveDocumentChunks`. This function performs a **transactional save**:
    1.  It first saves the document metadata (name, path) to the SQLite `documents` table.
    2.  It then attempts to save all chunks and vectors to `ChromaDB`.
    3.  **If the ChromaDB save fails,** it `catch`es the error and **immediately deletes** the "ghost" entry from the SQLite table, ensuring data integrity.
  * **Step 2d (Notify):** The worker sends a `document_status: 'complete'` or `document_status: 'error'` event to the user, who receives a final toast notification.

**3. Retrieval (Streaming & Scoped)**
When a user sends a message from a chat room:

  * The frontend calls `POST /api/chat/...` with the `query` and `socketId`.
  * The server **immediately returns `202 Accepted`**.
  * The `RAGPipelineService.js` begins processing in the background.
  * **Step 3a (Agentic Classification):** The query is sent to the LLM (via `GenerationService.js`) to be classified. The agent returns a JSON object:
    ```json
    {
      "queryType": "VECTOR",
      "rephrasedQuery": "advantages and disadvantages of document...",
      "sql": null,
      "documentFilter": ["3I2DH7KNN6KICUFNT6P4MKHUAPPBJD2Y.pdf"]
    }
    ```
  * **Step 3b (Action):** The pipeline analyzes the classification.
      * **If `METADATA`:** It runs the provided `sql` query against `vault.db`.
      * **If `VECTOR`:** It proceeds to the RAG pipeline.
  * **Step 3c (Scoped Vector Search):** The `rephrasedQuery` is embedded (via the Embedder API). `ChromaDB` is queried using a **strict `where` filter** that combines the `roomId` AND the `documentFilter`:
    ```javascript
    where: {
      "$and": [
        { "roomId": 1 },
        { "documentName": { "$in": ["3I2DH7KNN6KICUFNT6P4MKHUAPPBJD2Y.pdf"] } }
      ]
    }
    ```
  * **Step 3d (Re-Ranking):** The user's *original* query and the filtered chunks are sent to the LLM to find the most relevant chunks.
  * **Step 3e (Reasoning & Synthesis):** The top-ranked, relevant chunks are compiled into a final context. This context and the user's *original* query are sent to the LLM with the upgraded **reasoning prompt**, instructing it to "synthesize, reason over, and infer" the answer, even for negative queries ("what does it *fail* to cover?").
  * **Step 3f (Streaming):** The LLM response is streamed. As tokens arrive, they are immediately sent over **Socket.io** using `socket.emit('chat_response_...', { type: 'chunk', ... })`, creating the typewriter effect in the UI.
  * **Step 3g (Cleanup):** The final, complete answer is sent via a `type: 'final'` event and saved to the chat history.

-----

## 3\. The VAULT Hierarchy & RBAC Model

*(This section is largely unchanged, as the business logic is the same)*

### 3.1. Roles & Permissions

  * **CTO (Super Admin):** Manages `Products` and `ProductOwners`. Has unrestricted system-wide access.
  * **Product Owner (PO):** Manages `Administrators` and `Clients` for their product. Assigns Admins to Clients. Can request JIT access to other *Products*.
  * **Administrator (Admin):** Manages `Users` for their team. Assigns Users to Rooms. Can *only* see Clients they are assigned to. Can request JIT access to other *Clients*.
  * **User (SDE):** No management. Can *only* see Rooms they are assigned to. Cannot upload documents.

### 3.2. Just-in-Time (JIT) Access Systems

1.  **Room-Level JIT (Bypass):** Any user can request temporary access to a *single* room by its 6-digit code.
2.  **Peer-to-Peer JIT (Hierarchical):** POs/Admins can request temporary, read-only access to "locked" `Products` or `Clients`.

-----

## 4\. Local Development Setup Guide (Enterprise Edition)

Follow these steps to set up and run the entire VAULT platform.

### Prerequisites

  * [Git](https://git-scm.com/)
  * [Node.js](https://nodejs.org/) (v18 or higher)
  * [Python](https://www.python.org/) (v3.9 - 3.11)
  * [Redis](https://www.google.com/search?q=https://redis.io/docs/latest/operate/data-persistence/install/) (The job queue message broker)

### Step 1: Clone Repository

```bash
git clone https://github.com/vrishank-03/VAULT-Semantic-Search
cd VAULT-Semantic-Search
```

### Step 2: Backend Setup

1.  Navigate to the backend: `cd backend`
2.  Install Node.js packages: `npm install`
3.  Install **new** dependencies: `npm install bullmq ioredis axios form-data`
4.  Copy environment file: `cp .env.example .env` (and fill it out)
5.  Create the Python virtual environment: `python -m venv ml_env`
6.  Activate the environment: `.\ml_env\Scripts\activate` (Windows)
7.  Install all Python packages (now includes `fastapi`, `uvicorn`, `unstructured`):
    ```bash
    (ml_env) > pip install -r requirements.txt
    (ml_env) > pip install fastapi "uvicorn[standard]" "unstructured[local-inference]"
    ```
8.  Deactivate the environment: `deactivate`

### Step 3: Frontend Setup

1.  In a **separate terminal**, navigate to the frontend: `cd frontend`
2.  Install Node.js packages: `npm install`
3.  (No new packages are needed for the frontend)

### Step 4: Run All Services

You will need **six separate terminals** open and running simultaneously.

  * **Terminal 1 (Redis):** Start the job queue.

    ```bash
    redis-server
    ```

  * **Terminal 2 (ChromaDB):** Start the vector database.

    ```bash
    cd backend
    chroma run --path ./chroma_db
    ```

  * **Terminal 3 (Embedder API):** Start the Python embedding server.

    ```bash
    cd backend
    .\ml_env\Scripts\activate
    (ml_env) > python embedder.py
    ```

  * **Terminal 4 (Parser API):** Start the Python parsing server.

    ```bash
    cd backend
    .\ml_env\Scripts\activate
    (ml_env) > python parser.py
    ```

  * **Terminal 5 (Web Server):** Start the main Node.js API server.

    ```bash
    cd backend
    node index.js
    ```

  * **Terminal 6 (Worker):** Start the Node.js job worker.

    ```bash
    cd backend
    node -e "require('./services/QueueService.js')"
    ```

### Step 5: Frontend

  * In your frontend terminal, run: `npm start`
  * The application is now fully operational at `http://localhost:3000`.

## File-by-File Map (Refactored)

### Backend Structure

**backend/**

  * `index.js`: Server bootstrap, middleware, **non-blocking** upload route.
  * `database.js`: Manages SQLite schema. `getDb()` is now a **singleton** to support workers. `saveDocumentChunks` is **transactional** to prevent "ghost" documents.

**services/**

  * `QueueService.js`: (NEW) Manages the BullMQ queue and contains the **main Worker logic** for all document processing.
  * `RAGPipelineService.js`: (REFACTORED) Now a **streaming, agentic** service.
  * `GenerationService.js`: (REFACTORED) Upgraded to be a **Query Classifier** and **Reasoning** agent.
  * `VectorDBService.js`: (REFACTORED) Upgraded to support **`$and` filters** for Scoped Search.

**Python APIs (New)**

  * `parser.py`: (NEW) FastAPI server on port 8002 using `unstructured.io` for parsing and OCR.
  * `embedder.py`: (REFACTORED) FastAPI server on port 8001; keeps the model in memory.

**Processing Flow (Replaced)**

  * `documentProcessor.js`: (REFACTORED) Now an `axios` client for `parser.py`.
  * `ml_runner.js`: (REFACTORED) Now an `axios` client for `embedder.py`.

### Frontend Structure

**frontend/src/**

  * `App.js` / `index.js`: Main router, correctly wraps `AuthProvider` \> `SocketProvider`.
  * `services/api.js`: `uploadDocument` now sends `socketId` and expects `202`. `postChatQuery` sends `socketId`. `deleteDocument` is now used.
  * `context/SocketContext.js`: Provides the shared `socket` and `socketId` to all components.

**pages/ChatRoomPage/**

  * `index.js`: (REFACTORED) Orchestrator component. Manages all shared state.
  * `hooks/`: (NEW) All business logic is extracted into hooks:
      * `useChatStream.js`: Manages all Socket.io listeners for streaming chat.
      * `useFileUpload.js`: Manages all Socket.io listeners for document upload status.
      * `useDocuments.js`, `useConversations.js`, `useRoomAccess.js`
  * `components/`: (NEW) All UI is extracted into components:
      * `DocumentLibraryModal.js`: (NEW) Enterprise-grade modal with search bar and delete button.
      * `ChatHeader.js`: (REFACTORED) Simplified to be a button that opens the modal.
      * `ChatInput.js`, `MessageList.js`, `MessageBubble.js`

## Troubleshooting

### Common Issues

  * **`ECONNREFUSED 127.0.0.1:6379`**: **Redis is not running.** (Run `redis-server` in Terminal 1).
  * **`ECONNREFUSED 127.0.0.1:8001`**: **Embedder API is not running.** (Run `python embedder.py` in Terminal 3).
  * **`ECONNREFUSED 127.0.0.1:8002`**: **Parser API is not running.** (Run `python parser.py` in Terminal 4).
  * **`socket.on is not a function`**: Race condition. Fixed by adding `if (socket && isConnected)` guards in all `useEffect` hooks.
  * **Upload hangs/fails:** Ensure all 6 terminals are running. Check the **Worker** terminal (Terminal 6) for errors.
  * **"Ghost Documents"**: A failed upload appears in the list. Use the new **Delete** button in the Document Library modal to remove it. This bug is now fixed for all future uploads.
