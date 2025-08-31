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

---
## About The Project

Traditional search methods often fail because they can't understand user intent or the context within a document. VAULT solves this by creating a "meaning map" of your documents using vector embeddings. When you ask a question, it retrieves the most semantically relevant information and then uses a Large Language Model (LLM) to generate a precise, conversational answer, complete with source citations that link back to the exact location in the original document.

---
## Core Features

* **Semantic Search:** Go beyond keywords. Search based on the conceptual meaning of your queries.
* **Conversational Q&A:** Get direct, synthesized answers from your documents, powered by a Google Gemini RAG pipeline.
* **Client-Side PDF Processing:** The browser intelligently parses PDFs, extracting text along with its positional data (page number, coordinates).
* **Interactive Source Highlighting:** Click on a source in the AI's answer, and the original PDF will open in a side panel, automatically scrolling to and highlighting the exact text chunk used.
* **Modern Chat UI:** A sleek, responsive, and professional user interface built with React.
* **Private & Local:** The core embedding model runs locally, and your documents are stored on your backend, ensuring privacy.

---
## Architecture

VAULT is built on a modern, decoupled full-stack architecture. The core logic is a Retrieval-Augmented Generation (RAG) pipeline.

**Document Ingestion Flow:**
`PDF File (Browser)` → `Client-Side Parsing (PDF.js)` → `JSON (Chunks + Positional Data)` → `Backend API` → `Embedding (Local Model)` → `Store (SQLite + ChromaDB)`

**Query Flow:**
`User Query (Browser)` → `Backend API` → `[RAG Pipeline]` → `Final Answer (Browser)`

**RAG Pipeline Breakdown:**
1.  **Retrieve:** The user's query is converted to a vector using the local embedding model. This vector is used to find the most similar text chunks from **ChromaDB**.
2.  **Augment:** The retrieved chunks and the original query are combined into a detailed prompt.
3.  **Generate:** The augmented prompt is sent to the **Google Gemini API**, which generates a final, conversational answer.

---
## Tech Stack

| Category         | Technology                                                                                                  |
| ---------------- | ----------------------------------------------------------------------------------------------------------- |
| **Frontend** | React.js, Axios, `react-pdf`                                                                                |
| **Backend** | Node.js, Express.js                                                                                         |
| **Databases** | **ChromaDB** (Vector Store), **SQLite** (Relational Metadata)                                                 |
| **AI / ML** | **Google Gemini API** (Generation), `sentence-transformers` (Local Embeddings), `langchain` (Text Splitting) |
| **Tooling** | Git, Docker Desktop, VS Code, `nodemon`                                                                     |

---
## Getting Started

Follow these instructions to get a local copy of VAULT up and running.

### Prerequisites

You must have the following software installed on your machine:
* [Node.js](https://nodejs.org/) (LTS version)
* [Python](https://www.python.org/)
* [Git](https://git-scm.com/)
* [Docker Desktop](https://www.docker.com/products/docker-desktop/)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/vrishank-03/VAULT-Semantic-Search.git](https://github.com/vrishank-03/VAULT-Semantic-Search.git)
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
        And remove the line where you hardcoded the key.

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

1.  Click the paperclip icon `📎` to select and upload a PDF. The application will process it in your browser and save it to the backend.
2.  Ask a question in the chat box related to the content of your uploaded document(s).
3.  The AI will provide an answer. Click "Show Sources" to see the text chunks used.
4.  Click on a source link to open the original PDF in a side panel, which will automatically scroll to and highlight the relevant section.

---
## API Endpoints

| Method | Endpoint                  | Description                                                                 |
| ------ | ------------------------- | --------------------------------------------------------------------------- |
| `POST` | `/api/documents/upload`   | Receives and saves a pre-processed document (filename and chunks with metadata). |
| `POST` | `/api/search`             | Receives a query and chat history, returns a RAG-generated answer.         |
| `GET`  | `/api/documents/:id`      | Retrieves a stored PDF file by its ID for the viewer.                        |

---
## Roadmap

-   [ ] **Advanced Conversational Memory:** Implement a more sophisticated method for summarizing and using chat history.
-   [ ] **Support for More File Types:** Add processors for `.docx`, `.txt`, and `.md` files.
-   [ ] **Background Job Queue:** Move the embedding and database-saving process to a background job queue for handling extremely large documents without blocking the server.
-   [ ] **Improved Table Parsing:** Implement a specialized chunking strategy to better understand and query tabular data within PDFs.
