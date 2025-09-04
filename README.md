cat > README.md << 'EOF'
# VAULT: An Enterprise-Grade Semantic Search & Q&A Engine

VAULT is a full-stack application that transforms how you interact with your documents. Instead of relying on simple keyword matching, it uses a sophisticated **Retrieval-Augmented Generation (RAG)** pipeline to provide conversational, context-aware answers to natural language questions based on the content of your private PDF files.

## Table of Contents
- [About The Project](#about-the-project)
- [Core Features](#core-features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [Usage](#usage)
- [API Endpoints](#api-endpoints)
- [Roadmap](#roadmap)
- [Project Difficulty and Commonality](#project-difficulty-and-commonality)

---
## About The Project

Traditional search methods often fail because they can't understand user intent or the context within a document. VAULT solves this by creating a "meaning map" of your documents using vector embeddings. When you ask a question, an **agentic, multi-step RAG pipeline** understands your intent, retrieves the most semantically relevant information, and then uses a Large Language Model (LLM) to generate a precise, conversational answer, complete with source citations that link back to the original document.

---
## Core Features

* **Conversational Q&A:** Get direct, synthesized answers from your documents, powered by a sophisticated, multi-step Google Gemini RAG pipeline.
* **Smart Query Analysis:** An initial LLM call analyzes user intent and chat history to transform natural language questions into precise queries for the best possible retrieval.
* **Interactive Source Viewer:** Click on a source citation in the AI's answer to open the original PDF in an animated side panel for easy verification.
* **Persistent Memory:** Chat history is saved in the browser, allowing for continuous, multi-turn conversations that persist across sessions.
* **Modern Chat UI:** A sleek, responsive, and professional user interface built with React, featuring a dark theme and Markdown rendering for formatted AI responses.
* **Private & Local:** The core embedding model (`sentence-transformers`) runs locally on the backend, ensuring your document content remains private.
* **Multi-Tenant Architecture:** JWT-based authentication ensures strict data isolation between different user teams.

---
## Architecture

VAULT is built on a modern, decoupled full-stack architecture. The core logic is an advanced, multi-step Retrieval-Augmented Generation833 (RAG) pipeline that happens entirely on the backend.

**Document Ingestion Flow:**
`PDF File (Browser)` → `Backend API (File Upload)` → `Parsing & Chunking (LangChain)` → `Embedding (Local Model)` → `Store (SQLite + ChromaDB)`

**Query Flow:**
`User Query + History (Browser)` → `Backend API` → `[RAG Pipeline]` → `Final Answer (Browser)`

**RAG Pipeline Breakdown:**

1.  **Query Analysis (LLM Call #1):** The user's query, chat history, and a list of available documents are sent to the Gemini API. It analyzes the user's true intent and transforms the question into a keyword-rich query optimized for semantic retrieval.
2.  **Retrieve:** The transformed query is converted to a vector using the local embedding model. This vector is used to find the most similar text chunks from **ChromaDB**.
3.  **Re-rank (LLM Call #2):** The retrieved chunks are sent back to the Gemini API, which acts as a re-ranker, filtering for only the most relevant chunks.
4.  **Generate (LLM Call #3):** The final, clean context is combined with system status and chat history into a detailed prompt. This is sent to the Gemini API to synthesize a final, conversational answer.

---
## Tech Stack

| Category         | Technology                                                                                                                              |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Frontend**     | React.js, Axios, `react-pdf`, `react-markdown`, `react-icons`                                                                            |
| **Backend**      | Node.js, Express.js, `multer`                                                                                                           |
| **Databases**    | **ChromaDB** (Vector Store), **SQLite** (Relational Metadata)                                                                            |
| **AI / ML**      | **Google Gemini API** (Generation & Analysis), `sentence-transformers` (Local Embeddings), `langchain` (Text Splitting)                    |
| **Tooling**      | Git, Docker Desktop, VS Code, `nodemon`, `dotenv`, Postman, npm/yarn                                                                     |

---
## Getting Started

Follow these instructions to get a local copy of VAULT up and running.

### Prerequisites

You must have the following software installed on your machine:
* [Node.js](https://nodejs.org/) (LTS version)
* [Python](https://www.python.org/)
* [Git](https://git-scm.com/)
* [Docker Desktop](https://www.docker.com/products/docker-desktop/)
* [Postman](https://www.postman.com/) (for API testing)
* Web Browser: Google Chrome, Firefox, or Microsoft Edge

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/vrishank-03/VAULT-Semantic-Search.git
    cd VAULT-Semantic-Search
    ```
2.  **Install Frontend Dependencies:**
    ```bash
    cd frontend
    npm install
    ```
3.  **Install Backend Dependencies:**
    ```bash
    cd ../backend
    npm install
    ```
4.  **Set up the Python Environment:**
    ```bash
    # From the 'backend' directory
    python -m venv ml_env
    # Activate the environment
    # Windows:
    .\ml_env\Scripts\activate
    # macOS/Linux:
    # source ml_env/bin/activate

    # Install Python packages
    pip install sentence-transformers torch
    ```
5.  **Configure Environment Variables:**
    * In the `backend` directory, create a new file named `.env`.
    * Add your Google Gemini API key to this file:
        ```env
        GEMINI_API_KEY="YOUR_GEMINI_API_KEY_HERE"
        ```
    * Install the `dotenv` package to read this file:
        ```bash
        # From the 'backend' directory
        npm install dotenv
        ```
    * Update `backend/searchService.js` to use the environment variable. At the top of the file, add:
        ```javascript
        require('dotenv').config();
        const API_KEY = process.env.GEMINI_API_KEY;
        ```

6.  **Run the Application Stack:**
    * **Terminal 1 (Database):** Start Docker Desktop, then run:
        ```bash
        docker run -p 8000:8000 chromadb/chroma
        ```
    * **Terminal 2 (Backend):** Navigate to the `backend` folder and run:
        ```bash
        npm run dev
        ```
    * **Terminal 3 (Frontend):** Navigate to the `frontend` folder and run:
        ```bash
        npm start
        ```
    The application will be available at `http://localhost:3000`.

---
## Usage

1. Click the paperclip icon to select and upload one or more PDF files. The backend will process them.
2. Ask a question in the chat box. You can ask about the content of a specific document (e.g., "Summarize document ID 10") or ask general questions about the conversation (e.g., "How many documents have I uploaded?").
3. The AI will provide a formatted, conversational answer.
4. Click "Show Sources" to see the text chunks used to generate the answer.
5. Click on a source link to open the original PDF in a side panel for verification.

---
## API Endpoints

| Method | Endpoint                  | Description                                                                 |
| ------ | ------------------------- | --------------------------------------------------------------------------- |
| `POST` | `/api/documents/upload`   | Receives and saves a pre-processed document (filename and chunks with metadata). |
| `POST` | `/api/search`             | Receives a query and chat history, returns a RAG-generated answer.         |
| `GET`  | `/api/documents/:id`      | Retrieves a stored PDF file by its ID for the viewer.                        |

---
## Roadmap

-   [ ] **Advanced Conversational Memory:** Implement a more sophisticated method for summarizing and using long chat histories to reduce token usage.
-   [ ] **Support for More File Types:** Add processors for `.docx`, `.txt`, and `.md` files.
-   [ ] **Background Job Queue:** Move the embedding and database-saving process to a background job queue (e.g., using Redis) for handling extremely large documents without timing out.
-   [ ] **Improved Table Parsing:** Implement a specialized chunking strategy to better understand and query tabular data within documents.
