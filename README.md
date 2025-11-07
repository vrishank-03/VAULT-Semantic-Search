# VAULT — Enterprise RAG & Knowledge Platform (Developer Reference)

## 1. Purpose

This document serves as the primary technical reference for **VAULT**, an enterprise-grade, multi-tenant Retrieval-Augmented Generation (RAG) platform.

VAULT is designed to provide secure, isolated environments (called "Rooms") where teams can upload sensitive documents and perform natural language queries against them. The system is built on a sophisticated, **Admin-Centric Role-Based Access Control (RBAC)** model, ensuring strict data isolation and granular user permissions across different products, clients, and teams.

This README details the system architecture, the RBAC model, key features, a detailed setup guide, and the RAG pipeline.

---

## 2. Core Architecture & Design

VAULT is a modern web application composed of a React frontend, a Node.js/Express backend API, and a Python-based machine learning service for generating vector embeddings.

### 2.1. System Components

* **Frontend (React):** A responsive single-page application (SPA) that provides all user-facing interfaces.
    * **Authentication:** Handles user login, signup, password reset, and Google OAuth integration.
    * **Room Management:** "Purgatory Page" (Room Selector), room creation, and access controls.
    * **Admin Panels:** User & Client Management interfaces with role-based visibility.
    * **Chat Interface:** Real-time messaging with AI, document viewing, and annotations.
    * **Theme System:** Configurable light/dark mode with persistent preferences.

* **Backend (Node/Express):** A secure REST API that orchestrates all business logic.
    * **Authentication System:** JWT-based auth with email verification.
    * **RBAC System:** Complex role-based access control for all operations.
    * **File Processing:** PDF parsing, chunking, and metadata extraction.
    * **RAG Pipeline:** Orchestration of document processing and AI interactions.
    * **Email Service:** Automated notifications for various system events.

* **Database (SQLite):** The primary persistence layer for all relational data.
    * **Core Tables:** 
        * `users`: User accounts with role and status tracking
        * `products`: Product registrations and their approval status
        * `clients`: Client organizations linked to products
        * `chat_rooms`: Chat environments with access controls
        * `documents`: Document metadata and room associations
        * `conversations`: Chat message threads
        * `chat_history`: Individual chat messages
    * **Access Control Columns:** 
        * `users.admin_id`: Links Users to their Admin
        * `chat_rooms.admin_creator_id`: Links Rooms to creators
        * `chat_rooms.client_id`: Associates rooms with clients
    * **Audit System:** 
        * `room_session_logs`: Tracks user room entry/exit
        * Timestamps on all critical operations

* **Vector Store (ChromaDB):** A high-performance vector database for semantic search.
    * Stores document chunks and embeddings
    * Supports metadata-based filtering for room isolation
    * Enables efficient similarity search with room context

* **ML Service Layer:**
    * **Embedding Runner (Python):** 
        * Isolated Python service (`embedder.py`)
        * Handles vector embedding generation
        * Runs in dedicated virtual environment
    * **ML Coordinator (Node.js):**
        * Manages Python subprocess lifecycle
        * Handles ML task queuing and results
        * Ensures resource efficiency

* **External Services:**
    * **LLM Provider (Groq):** High-speed LLM API for generative tasks
    * **Email Provider:** Handles all system notifications
    * **OAuth Providers:** Supports Google login integration

### 2.2. The RAG Pipeline (Detailed)

VAULT's RAG system is designed for verifiable, room-level data isolation.

**1. Ingestion (Admin/PO Only)**
* An **Admin** or **PO** in a `ChatRoomPage` selects and uploads one or more PDF files.
* The frontend sends the files to `POST /api/documents/upload/:roomId`.
* The backend's `index.js` receives the files and performs a permission check: if the user's `role` is "User", the request is rejected with a `403 Forbidden`.

**2. Processing & Embedding**
* The PDF is parsed page-by-page by `documentProcessor.js` (using `pdf-parse`).
* The text is split into semantic chunks, carefully preserving the `pageNumber` for each chunk.
* These chunks are sent to the `ml_runner.js`, which calls the Python `embedder.py` script to generate high-fidelity vector embeddings.

**3. Storage (The "Room-Aware" Part)**
* The backend's `database.js` (`saveDocumentChunks`) performs two storage operations in parallel:
    * **SQLite:** The document's metadata (e.g., `Vrishank_Resume.pdf`, `user_id` of the uploader, and `room_id`) is saved to the `documents` table.
    * **ChromaDB:** The text chunks, their embeddings, and a JSON `metadata` object (containing `documentId` and, most importantly, `roomId`) are saved into the "documents" collection.

**4. Retrieval (The Query)**
When any user (Admin, PO, or User) sends a message from a chat room:
* The frontend calls `POST /api/search/:roomId`.
* `searchService.js` (`performRAG`) begins. It **only** looks for documents matching the `roomId`.
* **Step 4a (Query Analysis):** The user's query ("what did it say about that?") and chat history are sent to the LLM (Groq) to generate a clean, standalone "search query" (e.g., "Tell me about the pain points in Vrishank_Resume.pdf").
* **Step 4b (Vector Search):** This new search query is embedded. `ChromaDB` is queried to find the top 10 most similar document chunks, using a **strict metadata filter** `where: { "roomId": [current_room_id] }`. This is the core of our data isolation.
* **Step 4c (Re-Ranking):** The user's *original* query and the 10 document chunks are sent to the LLM a second time. The LLM's job is to "re-rank" the chunks and return a simple array of the *most relevant* ones (e.g., `[0, 2, 5]`).
* **Step 4d (Synthesis):** The re-ranked, relevant chunks are compiled into a final context. This context and the user's *original* query are sent to the LLM a third time with a system prompt: "You are VAULT. Answer the user's question *only* using the provided context."
* This final answer and its sources are sent back to the user.

---

## 3. The VAULT Hierarchy & RBAC Model

This is the core of the VAULT platform. Access is determined by a strict, "Admin-Centric" hierarchy.

### 3.1. Roles & Permissions

* **CTO (Super Admin)**
    * **Authentication:** Bypasses all approval flows. Logs in directly via hard-coded credentials in `backend/credentials.js`.
    * **Permissions:** Full system-wide read/write access. Can see all Products, all Clients, and all Rooms. Has exclusive access to the `room_session_logs` dashboard (future).
* **Product Owner (PO)**
    * **Authentication:** Account is created and set to `active` when their Product is approved by a CTO.
    * **Permissions:** Sees **all** rooms for **all** products. Can manage Admins (approve/reject).
* **Administrator**
    * **Authentication:** Signs up for a specific, *confirmed* Product. Account is `suspended_admin` until approved by a PO.
    * **Permissions:** Tied to a single **Product** (e.g., "TestFX").
        * Sees **all** rooms for **all** clients associated with their Product (e.g., "ICICI" + "SBI" rooms).
        * Can create/edit Clients (e.g., "ICICI", "SBI") within their Product.
        * Can create/edit Rooms and assign them to a Client.
        * Can manage **Users** (approve/reject).
* **User (SDE)**
    * **Authentication:** Signs up for a specific, *confirmed* Product. Account is `suspended_user` until approved by an **Administrator**.
    * **Permissions:** Tied to a single **Admin** (via `users.admin_id`).
        * Sees *only* the rooms created by *their* specific Admin (`chat_rooms.admin_creator_id`).
        * **Cannot** upload documents.
        * **Cannot** create rooms or clients.
        * **Cannot** manage other users.

### 3.2. Data & Entity Relationships

* `Products` are the top-level container (e.g., "TestFX").
* `Clients` (e.g., "ICICI") belong to one `Product`. This is for categorization, not security.
* `Chat Rooms` are created by one `Administrator` (`admin_creator_id`) and assigned to one `Client` (`client_id`).
* `Documents` are uploaded by an Admin/PO and are tied to one `Room` (`room_id`).
* `Conversations` are tied to one `Room` (`room_id`).
* `Users` (role "User") are tied to one `Administrator` (`admin_id`).

---

## 4. Local Development Setup Guide

Follow these steps to set up and run the entire VAULT platform on your local machine.

### Prerequisites
* [Git](https://git-scm.com/)
* [Node.js](https://nodejs.org/) (v18 or higher)
* [Python](https://www.python.org/) (v3.9 or higher)
* [Pip](https://pip.pypa.io/en/stable/installation/) (Python's package manager)

### Step 1: Clone & Checkout Branch
Clone the repository and move into the `development` branch. **Do not** run on `main`.

```bash
git clone https://github.com/vrishank-03/VAULT-Semantic-Search
cd VAULT-Semantic-Search
git checkout development
```
### Step 2: Backend Setup
Install dependencies, set up environment variables, and install Python packages.

1.  Navigate to the backend: `cd backend`
2.  Install Node.js packages: `npm install`
3.  Copy the example environment file: `cp .env.example .env`
4.  **Edit `.env`:** Open the new `.env` file and fill in all the required API keys and credentials (see "Environment Variables" section below).
5.  Install Python packages for the embedder: `pip install -r requirements.txt`

### Step 3: Frontend Setup
In a separate terminal, navigate to the frontend and install its dependencies.

1.  Navigate to the frontend: `cd frontend` (from the project root)
2.  Install Node.js packages: `npm install`

### Step 4: Run All Services
You will need **four separate terminals** open.

* **Terminal 1 (Vector DB):** Start the ChromaDB server.
    ```bash
    cd backend
    chroma run --path ./chroma_db
    ```
    (This will run on `http://localhost:8000`)

* **Terminal 2 (Embedding Runner):** Start the Python embedding service.
    ```bash
    cd backend
    python ml_runner.py
    ```
    (This will run on `http://localhost:5001`)

* **Terminal 3 (Backend API):** Start the Node.js server.
    ```bash
    cd backend
    npm run dev
    ```
    (This will run on `http://localhost:5000`)

* **Terminal 4 (Frontend App):** Start the React development server.
    ```bash
    cd frontend
    npm start
    ```
    (This will open `http://localhost:3000` in your browser)

### Step 5: First-Time Developer Setup (Critical)
The application is now running, but it is a "locked box." You cannot log in because no products or users have been approved. Run the developer setup script to create your "master key."

1.  **Ensure your backend server (Terminal 3) is running.**
2.  In **a new, fifth terminal**, run the following command from the `backend` directory:

    ```bash
    node -e "require('./db_test.js').runSetup()"
    ```
3.  **Output:** You will see a " 𝓈ℯ𝓉𝓊𝓅𝓅𝓅𝓅 𝓭𝓸𝓷𝓮 " message. This script has just:
    * Created a product named "Main Product".
    * Instantly approved it (`status = 'confirmed'`).
    * Created an **active** Admin user linked to this product.

### Step 6: Log In
You can now use the app.
* Go to `http://localhost:3000`
* Log in with the developer credentials:
    * **Email:** `admin@vault.com`
    * **Password:** `Password123!`

You are now logged in as an Administrator for "Main Product" and can begin testing the "Manage Users," "Create Client," and "Create Room" features.

---

## 5. File-by-File Map (Updated Architecture)

#### `backend/`
* `index.js`: Server bootstrap, middleware, and mounting of all API routes. Also contains the core, protected endpoints for document upload, list, and download.
* `database.js`: Manages the SQLite connection and schema.
    * **Tables:** `users`, `products`, `clients`, `chat_rooms`, `documents`, `conversations`, `chat_history`, `room_session_logs`.
    * **Key Columns:** `users.admin_id`, `chat_rooms.admin_creator_id`, `chat_rooms.client_id`, `documents.room_id`.
* `searchService.js`: The RAG engine. **Crucially, `performRAG` is now room-aware and filters all queries by `roomId`.**
* `documentProcessor.js`: Handles PDF parsing, text extraction, and chunk generation.
* `embedder.py`: Python service for generating vector embeddings.
* `ml_runner.js`: Node.js coordinator for ML operations, manages Python subprocess.
* `query_chroma.js`: Interface for ChromaDB vector operations.
* `routes/`:
    * `authRoutes.js`: Handles login, signup, email verification, and password reset.
    * `productRoutes.js`: Handles product registration, listing, and approval.
    * `clientRoutes.js`: Handles creating and listing clients for an Admin.
    * `roomRoutes.js`: Handles creating, listing (with RBAC), and logging entry for rooms.
    * `userRoutes.js`: Handles listing and approving/rejecting pending users.
* `controllers/`:
    * `authController.js`: Logic for signup, login, email verification, etc.
    * `productController.js`: Logic for `requestProductCreation`, `approveProduct`.
    * `clientController.js`: Logic for `getClientsForAdmin`, `createClient`.
    * `roomController.js`: **Core RBAC logic.** Contains the complex, role-based `getRooms` function.
    * `userController.js`: Logic for `getPendingUsers`, `approveUser`, `rejectUser`.
* `services/`:
    * `emailService.js`: Handles all email notifications including verification, password reset, and room access notifications.
* `middleware/`:
    * `authMiddleware.js`: Authentication and authorization middleware for protecting routes.
* `storage/`: 
    * Contains uploaded user documents and profile pictures
    * Organizes files by user ID with timestamps
    * Includes separate directories for profile images and documents
* `ml_env/`: Python virtual environment for ML operations
    * Contains all required packages for embedding generation
    * Isolated from system Python installation
* `uploads/`: Temporary storage for raw file uploads before processing
* `vault.db`: The local SQLite database file.

#### `frontend/`
* `src/App.js`: Main application component, defines routes (`/dashboard`, `/chat/:roomId`).
* `src/services/api.js`: Centralized `axios` client. Exports functions for *all* API endpoints, including new `client` and `user` functions.
* `src/context/`:
    * `AuthContext.js`: Global state for authentication, providing the `user` object (with `user.role`) to all components.
    * `ThemeContext.js`: Manages application-wide theme state (light/dark mode).
* `src/pages/`:
    * `Dashboard.js`: The "Purgatory Page" / Room Selector. Contains the "Create Room" and "Manage Users" modals.
    * `ChatRoomPage.js`: The chat interface. It is room-aware and calls APIs with the `roomId` from the URL.
    * `LoginPage.js`: Handles local email/password login.
    * `SignupPage.js`: Handles the new, non-blocking signup flow.
    * `ResetPasswordPage.js`: Handles password reset workflow.
* `src/components/`:
    * Main Components:
        * `Sidebar.js`: A dynamic component that now hides/shows buttons ("New Chat", "Go Back") based on the page.
        * `Navbar.js`: Top navigation with user info and theme toggle.
        * `PdfViewer.js`: PDF document viewer with annotation support.
        * `AuthLayout.js`: Wrapper component for authentication pages.
        * `PrivateRoute.js`: Route protection based on authentication state.
    * UI Components:
        * `LoadingSpinner.js`: Loading state indicator.
        * `SuccessAnimation.js`: Success state animations.
        * `ThinkingAnimation.js`: AI processing indicator.
        * `ProcessingAnimation.js`: Document processing indicator.
        * `Typewriter.js`: Animated text display for chat responses.
        * `ThemeToggleButton.js`: Light/dark mode toggle.
    * Authentication:
        * `GoogleLoginButton.js`: Google OAuth integration.
    * Modals:
        * `CreateRoomModal.js`: Interface for creating new chat rooms.
        * `JitRequestModal.js`: Just-in-time access request dialog.
        * `UserManagementModal.js`: Admin interface for user management.
* `src/utils/`:
    * `gravatar.js`: User avatar generation utilities. 
