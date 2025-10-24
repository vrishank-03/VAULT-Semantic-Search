# VAULT — Semantic Search / RAG Prototype (Developer Reference)

## Purpose
This README is a single, practical reference for engineers working on VAULT: a small, maintainable Retrieval-Augmented Generation prototype that lets you ingest PDFs, index semantic chunks in a vector store (Chroma), and answer queries with LLM-backed composition and source attributions.

## Design Goals
- Clear contracts between systems (frontend, backend, embedding runner, vector store).
- Simple, testable ingestion pipeline that preserves page-level provenance.
- Pluggable LLM provider (currently Groq) so models and infrastructure can be swapped.
- Developer ergonomics: reproducible local dev steps, quick smoke tests, and clear troubleshooting notes.

---
## Overview & Architecture
- **Frontend (React):** Handles all user interaction, including authentication (standard and Google OAuth), file uploads, chat interface, and PDF viewing with source navigation.
- **Backend (Node/Express):** Provides the API surface, orchestrates the ingestion pipeline, manages the user/document database (SQLite), and executes the RAG search logic.
- **Embedding Runner (Python):** A separate Python process responsible for generating deterministic embeddings for text chunks.
- **Vector Store (Chroma):** Manages vector storage and nearest-neighbor retrieval for semantic search.
- **LLM Provider (Groq):** A fast, cloud-based API that provides the language models for all generative tasks (query analysis, re-ranking, and final answer synthesis).

---
## File-by-File Map

Use this as a quick orientation when you open a file.

#### Root
- `LICENSE`: Project license.
- `hierarchical-diagram.md`: Human-readable repo tree and overview.

#### backend/
- `package.json` / `package-lock.json`: Backend dependencies and scripts.
- `index.js`: Server bootstrap, middleware setup, route mounting, and startup logic.
- `database.js`: Persistence layer for SQLite, defining schemas for `users` and `documents`.
- `documentProcessor.js`: Handles PDF parsing and chunking. **Crucially, it is page-aware, preserving the page number for each chunk.**
- `ml_runner.js`: A bridge to the Python embedding script.
- `embedder.py`: The Python script that generates vector embeddings from text.
- `searchService.js`: The core RAG orchestration engine. It uses Groq for its three LLM calls: Query Analysis, Re-ranking, and Final Answer Synthesis.
- `controllers/authController.js`: Handles all authentication logic: standard signup/login, Google OAuth 2.0 login, password reset, and email verification. **Saves Google profile pictures to the database.**
- `routes/authRoutes.js`: Defines all authentication-related API endpoints.
- `middleware/authMiddleware.js`: Verifies JWTs on protected routes and attaches the user to the request object.
- `storage/`: Contains uploaded user documents.
- `vault.db`: The local SQLite database file.

#### frontend/
- `package.json` / `package-lock.json`: Frontend dependencies.
- `public/`: Static assets (icons, `index.html`, etc.).
- `src/`: React application source code.
- `src/App.js`: Main application component, defines routes and global layout.
- `src/services/api.js`: Centralized `axios` client. Handles API base URL and automatic injection of JWT for authenticated requests.
- `src/context/AuthContext.js`: Global state management for authentication, providing user data (including profile picture) to all components.
- `src/pages/`: Contains the main page components (`Dashboard.js`, `LoginPage.js`, `SignupPage.js`, `ResetPasswordPage.js`).
- `src/components/`: Contains reusable UI pieces like `Sidebar.js`, `PdfViewer.js`, `GoogleLoginButton.js`, and our custom animations (`ProcessingAnimation.js`, `ThinkingAnimation.js`).

## Key Features

* **RAG Pipeline:** Ingests PDFs, performs page-aware text chunking (`langchain`), generates embeddings (Python), stores in ChromaDB, and uses an LLM (Groq) for context retrieval and answer synthesis.
* **Document Management:** Secure PDF upload with duplicate detection and user cancellation support. Displays a list of uploaded documents with options to view.
* **Interactive Chat Interface:**
    * Conversational Q&A with source attribution linking to specific PDF pages/text.
    * **Stop Generation:** Allows users to cancel the LLM response generation mid-stream.
    * **Message Editing:** Users can edit their previous questions and resubmit.
    * **Copy Functionality:** Easily copy both user prompts and AI responses.
    * **Multi-Chat Management:** Supports multiple distinct conversations, saving previous chats in component state when starting a new one.
* **Authentication:** Secure user accounts via standard email/password (with verification, password reset) and Google OAuth 2.0 (handling profile picture download and storage).
* **Integrated PDF Viewer:** Displays source documents with text highlighting capabilities (`react-pdf`).
  
---
## Environment Variables
Create a `backend/.env` file with the following keys. **Do not commit this file.**

```env
# ChromaDB Connection
CHROMA_HOST=localhost
CHROMA_PORT=8000

# Groq API Key (Get from console.groq.com)
GROQ_API_KEY=gsk_YourSecretKeyHere

# Backend Server Port
PORT=5000

# JWT Secret for Authentication
JWT_SECRET=replace_with_a_strong_random_secret

# Google OAuth Credentials (For Sign in with Google)
GOOGLE_CLIENT_ID=YourGoogleClientID.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=YourGoogleClientSecret

# Nodemailer Credentials (For verification and password reset emails)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-gmail-app-password

# Base URLs for API and Frontend
API_URL=http://localhost:5000
FRONTEND_URL=http://localhost:3000
