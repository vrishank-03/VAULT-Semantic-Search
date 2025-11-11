# VAULT — Enterprise RAG & Knowledge Platform (Developer Reference)

## 1. Purpose

This document serves as the primary technical reference for **VAULT**, an enterprise-grade, multi-tenant Retrieval-Augmented Generation (RAG) platform.

VAULT is designed to provide secure, isolated environments where teams can upload sensitive documents and perform natural language queries against them. The system is built on a sophisticated, **top-down hierarchical Role-Based Access Control (RBAC)** model, ensuring strict data isolation and granular user permissions across different products, clients, and teams.

This README details the system architecture, the new RBAC model, the dual JIT access systems, key features, a detailed setup guide, and the RAG pipeline.

-----

## 2. Core Architecture & Design

VAULT is a modern web application composed of a React frontend, a Node.js/Express backend API, and a Python-based machine learning service for generating vector embeddings.

### 2.1. System Components

* **Frontend (React):** A responsive single-page application (SPA) that provides all user-facing interfaces.

    * **Hierarchical Dashboard:** A role-aware dashboard.
        * **CTO/PO:** Sees a `Products` → `Clients` → `Rooms` view.
        * **Admin:** Sees a `Clients` → `Rooms` view.
        * **User:** Sees a flat `Rooms` list.
    * **Authentication:** Handles user login, signup for different roles, and password reset.
    * **Management Modals:** A suite of modals for:
        * User approval (`UserManagementModal`).
        * Product approval (`PendingProductsSection`).
        * Product editing/deletion (`ManageProductsSection`).
        * Client-to-Admin assignment (`AssignClientModal`).
    * **JIT Systems:** Interfaces for two distinct JIT systems:
        * Requesting access to individual locked **Rooms**.
        * Requesting peer-level access to locked **Products** or **Clients**.
    * **Chat Interface:** Real-time messaging with AI and document viewing.

* **Backend (Node/Express):** A secure REST API that orchestrates all business logic.

    * **Authentication System:** JWT-based auth with email verification.
    * **Hierarchical RBAC System:** A complex, manager-based RBAC model.
    * **JIT Access Controllers:** Manages three types of access requests (Room, Product, Client).
    * **File Processing:** PDF parsing, chunking, and metadata extraction.
    * **RAG Pipeline:** Orchestration of document processing and AI interactions.
    * **Socket.io Service:** Provides real-time updates to all connected clients for dashboard refreshes.

* **Database (SQLite):** The primary persistence layer for all relational data.

    * **Core Tables:**
        * `users`: Stores all user accounts, `role`, `status`, and `manager_id`.
        * `products`: Top-level containers (e.g., "TestFX").
        * `clients`: Mid-level containers (e.g., "ICICI"), linked to a `product_id`.
        * `chat_rooms`: The lowest-level data container, linked to one or more `client_id`s.
        * `documents`: Document metadata.
    * **Key Access Control Tables:**
        * `admin_client_assignments`: **(NEW)** Links Admins to the Clients they manage.
        * `room_user_assignments`: Links Users to the Rooms they can access (via "Send Downstream").
    * **JIT Access Tables:**
        * `room_access_requests`: **(JIT 1)** For room-level JIT.
        * `product_access_requests`: **(JIT 2)** For PO-to-PO JIT.
        * `client_access_requests`: **(JIT 3)** For Admin-to-Admin JIT.

* **Vector Store (ChromaDB):** A high-performance vector database for semantic search. Stores document chunks and embeddings, strictly filtered by `roomId` during retrieval.

* **ML Service Layer & External Services:**

    * **Embedding Runner (Python):** An isolated service for generating vector embeddings.
    * **LLM Provider (Groq):** High-speed LLM API for generative tasks.
    * **Email Provider:** Handles all system notifications.

### 2.2. The RAG Pipeline (Detailed)

VAULT's RAG system is designed for verifiable, room-level data isolation.

**1. Ingestion (Admin/PO/CTO Only)**

* An authorized user uploads one or more PDF files within a `ChatRoomPage`.
* The frontend sends the files to `POST /api/documents/upload/:roomId`.
* The backend's `index.js` receives the files and verifies the user has write-access to that room.

**2. Processing & Embedding**

* The PDF is parsed page-by-page by `documentProcessor.js`.
* The text is split into semantic chunks, preserving the `pageNumber`.
* Chunks are sent to the `ml_runner.js`, which calls the Python `embedder.py` script to generate vector embeddings.

**3. Storage (Room-Aware)**

* **SQLite:** The document's metadata (e.g., `contract.pdf`, `user_id`, and `room_id`) is saved to the `documents` table.
* **ChromaDB:** The text chunks, their embeddings, and a JSON `metadata` object (containing `documentId` and, most importantly, **`roomId`**) are saved into the "documents" collection.

**4. Retrieval (The Query)**
When any user sends a message from a chat room:

* The frontend calls `POST /api/search/:roomId`.
* `searchService.js` (`performRAG`) begins.
* **Step 4a (Query Analysis):** The user's query and chat history are sent to the LLM to generate a clean, standalone "search query".
* **Step 4b (Vector Search):** This search query is embedded. `ChromaDB` is queried to find the top 10 most similar document chunks, using a **strict metadata filter** `where: { "roomId": [current_room_id] }`. This is the core of our data isolation.
* **Step 4c (Re-Ranking):** The user's *original* query and the 10 chunks are sent to the LLM a second time to "re-rank" them for relevance.
* **Step 4d (Synthesis):** The re-ranked, relevant chunks are compiled into a final context. This context and the user's *original* query are sent to the LLM a third time with a system prompt: "You are VAULT. Answer the user's question *only* using the provided context."
* This final answer and its sources are sent back to the user.

-----

## 3. The VAULT Hierarchy & RBAC Model

Access is determined by a strict, top-down hierarchical model. Management is "opt-in" (Admins must be *assigned* clients, Users must be *assigned* rooms).

### 3.1. Roles & Permissions

* **CTO (Super Admin)**

    * **Authentication:** Signs up via a special, secret-protected route.
    * **Management:** Manages `Products` (approve/reject/edit/delete). Manages `ProductOwners` (approve/reject/deactivate).
    * **View:** Has full, unrestricted, system-wide access to all Products, Clients, and Rooms.

* **Product Owner (PO)**

    * **Authentication:** Account is created via the "Approve Product" flow (by a CTO).
    * **Management:** Manages `Administrators` for their own product (approve/reject/deactivate). Manages `Clients` for their own product (create/edit/delete).
    * **Assignment (New):** Can assign/unassign their `Admins` to specific `Clients` using the "Assign Clients" modal.
    * **View:**
        * **Own Product:** Full access to all Clients and Rooms within their product.
        * **Other Products:** Can *see* all other products, but they are "locked."
    * **JIT:** Can request peer-to-peer JIT access to other POs' "locked" Products.

* **Administrator (Admin)**

    * **Authentication:** Signs up for a *confirmed* Product. Account is `suspended` until approved by their PO.
    * **Management:** Manages `Users` for their own team (approve/reject/deactivate).
    * **Assignment (New):** Can assign/unassign their `Users` to specific `Rooms` (via "Send Downstream").
    * **View:**
        * **Own Clients:** Full access *only* to Clients they have been *assigned* by their PO.
        * **Other Clients:** Can *see* all other clients in their product, but they are "locked."
    * **JIT:** Can request peer-to-peer JIT access to other Admins' "locked" Clients.
    * **Creation:** Can create new rooms, but *only* for clients they are assigned to.

* **User (SDE)**

    * **Authentication:** Signs up for a *confirmed* Product and chooses an Admin. Account is `suspended` until approved by that Admin.
    * **Management:** None.
    * **View:** Can *only* see and join rooms they have been *explicitly* assigned to by their Admin (via "Send Downstream").
    * **Permissions:** Cannot upload documents, create rooms, or create clients.

### 3.2. Just-in-Time (JIT) Access Systems

VAULT features two distinct JIT systems that run in parallel:

1. **Room-Level JIT (Bypass):**

    * **Who:** Any authenticated user.
    * **What:** Requesting temporary access to a *single, specific room*.
    * **How:** User clicks "Request Access" and enters the 6-digit **Room Code**.
    * **Permission:** This bypasses all hierarchy and sends a request directly to the room's owner.

2. **Peer-to-Peer JIT (Hierarchical):**

    * **Who:** Product Owners or Administrators.
    * **What:** Requesting temporary, read-only access to an entire "locked" resource.
    * **How:** A PO clicks a locked `Product` card, or an Admin clicks a locked `Client` card.
    * **Permission:**
        * **PO:** Sends a request to the *owner* of that Product.
        * **Admin:** Sends a request to *all* Admins assigned to that Client.

-----

## 4. Local Development Setup Guide

Follow these steps to set up and run the entire VAULT platform on your local machine.

### Prerequisites

* [Git](https://git-scm.com/)
* [Node.js](https://nodejs.org/) (v18 or higher)
* [Python](https://www.python.org/) (v3.9 or higher)
* [Pip](https://pip.pypa.io/en/stable/installation/) (Python's package manager)

### Step 1: Clone Repository

```bash
git clone https://github.com/vrishank-03/VAULT-Semantic-Search
cd VAULT-Semantic-Search
```
(Note: This guide assumes you are on the correct branch that contains all the features described.)

### Step 2: Backend Setup

1. Navigate to the backend: `cd backend`
2. Install Node.js packages: `npm install`
3. Copy the example environment file: `cp .env.example .env`
4. **Edit `.env`:** Open the new `.env` file and fill in all required values.
    * `CTO_EMAIL` (e.g., `cto@vault.com`)
    * `CTO_SIGNUP_SECRET` (a strong, unique password)
    * `JWT_SECRET` (a long, random string)
    * `GROQ_API_KEY`
    * Email provider settings (e.g., `EMAIL_USER`, `EMAIL_PASS`)
5. Install Python packages: `pip install -r requirements.txt`

### Step 3: Frontend Setup

1. In a **separate terminal**, navigate to the frontend: `cd frontend`
2. Install Node.js packages: `npm install`

### Step 4: Run All Services

You will need **four separate terminals** open and running simultaneously.

* **Terminal 1 (Vector DB):** Start the ChromaDB server.

  ```bash
  cd backend
  chroma run --path ./chroma_db
  ```
  
### Key Features
- **Hierarchical RBAC**: CTO → PO → Admin → User permission model
- **JIT Access**: Room-level and peer-to-peer just-in-time access requests
- **RAG Search**: ChromaDB + Groq LLM for intelligent document retrieval
- **Real-time Chat [to be implemented...]**: Socket.io-powered messaging with document context
- **Multi-tenant Isolation**: Product → Client → Room data segregation
- **Manager Approval**: All accounts and access require approval

## Architecture

### Tech Stack
- **Backend**: Node.js, Express, SQLite, Socket.io
- **Frontend**: React, Material-UI, Axios
- **ML/AI**: Python Flask, ChromaDB, Groq API, Sentence Transformers
- **Authentication**: JWT, bcrypt, email verification


## Installation

### Prerequisites
- Node.js 16+ and npm
- Python 3.8+
- Git

### Step 1: Clone Repository
- git clone https://github.com/your-org/vault.git
- cd vault

### Step 2: Backend Setup
- cd backend
- npm install
- pip install -r requirements.txt

### Step 3: Frontend Setup
- cd frontend
- npm install


### Step 4: Environment Configuration
Create `.env` files in both `backend/` and `frontend/` directories. See [Environment Variables](#environment-variables) section.

## Running the Application

You need **4 terminals** to run all services:

### Terminal 1 (ChromaDB)
Start the vector database.
- cd backend
- chroma run --path ./chroma_db --port 8000

(Runs on http://localhost:3000)

### Step 5: First-Time Application Setup (Critical)

The application is running, but it's empty. You must create the top-level user and first product.

1. **Sign Up as CTO**:
   - Go to http://localhost:3000/signup-cto
   - Enter the CTO_EMAIL you set in your .env
   - Enter a password
   - Enter the CTO_SIGNUP_SECRET you set in your .env
   - Submit and check your email to verify your account

2. **Log In as CTO**:
   - Log in with your new CTO credentials

3. **Create Your First Product**:
   - You are now on the CTO dashboard
   - Fill out the "Request a New Product" form (e.g., "TestFX", PO Name: "Vrishank", PO Email: "vrishank@example.com")
   - Submit the request

4. **Approve Your Product**:
   - A new card will appear in the "Pending Product Approvals" section
   - Click Approve
   - This action creates the Product and sends an invitation email to the PO

5. **Activate the Product Owner (PO)**:
   - Check the PO's email inbox for the "You've been invited" email
   - Click the link to set their password

6. **Log In as PO**:
   - Log out as the CTO
   - Log in with the PO's credentials
   - You are now on the PO dashboard

You are now set up. From here, you can have new Admins sign up for "TestFX", approve them, create clients, and assign those clients to your new Admins.

## File-by-File Map

### Backend Structure

**backend/**
- `index.js`: Server bootstrap, middleware, Socket.io setup, and route mounting
- `database.js`: Manages SQLite schema, including all users, products, clients, chat_rooms, and all JIT/assignment tables

**routes/**
- `productRoutes.js`: Handles all Product-level GET, POST, PUT, DELETE operations (create, approve, delete)
- `clientRoutes.js`: Handles GET, POST for clients, plus the new GET/PUT for Admin assignments (/assignments/:adminId)
- `roomRoutes.js`: Handles GET /rooms (for Users), GET /rooms/client/:clientId (for hierarchy), and POST /create
- `jitRequestRoutes.js`: Handles all JIT logic: Room-level (/request-access) and Peer-level (/peer-request)

**controllers/**
- `productController.js`: Logic for getAllProducts, approveProduct, updateProduct, deleteProduct
- `clientController.js`: Logic for getClients, getClientsForProduct, getAdminClientAssignments, updateAdminClientAssignments
- `roomController.js`: Logic for getRooms (for Users) and getRoomsForClient (for hierarchy)
- `jitRequestController.js`: All JIT logic for both Room and Peer systems

**services/**
- `roomService.js`: Core logic for finding and creating rooms (used by controllers)
- `accessService.js`: Core logic for checking a user's permission to join or manage a room

### Frontend Structure

**frontend/src/**
- `App.js`: Main router
- `services/api.js`: Centralized axios client. Exports all ~60 API functions
- `context/AuthContext.js`: Global state for user object
- `context/SocketContext.js`: Provides the shared Socket.io instance

**pages/**
- `Dashboard.js`: Main Orchestrator
  - Uses useDashboardData to get global counts and lists
  - Manages the viewState ({level, product, client})
  - Renders all modals
  - Renders renderBrowseContent() which selects the correct section to display

**components/dashboard/**
- `hooks/useDashboardData.js`: Central hook that fetches all data needed for headers, tabs, and badges on load

**sections/**
- `ProductCardsSection.js`: Renders Product cards (Level 1). Handles "locked" state and opening PeerRequestModal
- `ClientCardsSection.js`: Renders Client cards (Level 2). Handles "locked" state and opening PeerRequestModal
- `RoomCardsSection.js`: Renders Room cards (Level 3). Handles "locked" state and opening RequestAccessModal (Room JIT)
- `OutgoingRequestsSection.js`: Renders the list of Room-Level JIT requests
- `OutgoingPeerRequestsSection.js`: Renders the list of Peer-to-Peer JIT requests

**modals/**
- `UserManagementModal.js`: Handles user approvals and (for POs) the "Assign Clients" button
- `AssignClientModal.js`: Dual-list "shuttle" UI for POs to assign clients to Admins
- `IncomingJitModal.js`: Modal for managers to approve/reject Room-Level JIT requests
- `IncomingPeerJitModal.js`: Modal for managers to approve/reject Peer-to-Peer JIT requests
- `PeerRequestModal.js`: Modal for POs/Admins to create a new JIT request for a locked Product/Client
- `RoomPasswordModal.js`: Elegant modal to ask for a room's password

## API Reference

### Authentication
- `POST /api/auth/signup-cto` - CTO registration
- `POST /api/auth/signup` - General user registration
- `POST /api/auth/login` - User login
- `POST /api/auth/verify-email` - Email verification
- `POST /api/auth/forgot-password` - Password reset request
- `POST /api/auth/reset-password` - Password reset

### Products
- `GET /api/products` - Get all products (role-filtered)
- `POST /api/products` - Create product (CTO only)
- `PUT /api/products/:id/approve` - Approve/reject product (CTO only)
- `PUT /api/products/:id` - Update product (CTO/PO)
- `DELETE /api/products/:id` - Delete product (CTO only)

### Clients
- `GET /api/clients` - Get clients (role-filtered)
- `POST /api/clients` - Create client (PO only)
- `GET /api/clients/assignments/:adminId` - Get admin client assignments
- `PUT /api/clients/assignments/:adminId` - Update admin client assignments (PO only)

### Rooms
- `GET /api/rooms` - Get user-accessible rooms
- `GET /api/rooms/client/:clientId` - Get rooms for specific client
- `POST /api/rooms/create` - Create new room (Admin/PO/CTO)
- `POST /api/rooms/:roomId/assign-users` - Assign users to room (Admin/PO/CTO)

### JIT Access
- `POST /api/jit/request-access` - Room-level JIT request
- `POST /api/jit/peer-request` - Peer-to-peer JIT request
- `GET /api/jit/requests` - Get incoming JIT requests
- `PUT /api/jit/requests/:requestId` - Approve/reject JIT request

### Documents & Search
- `POST /api/documents/upload/:roomId` - Upload documents to room
- `POST /api/search/:roomId` - Perform RAG search in room
- `GET /api/documents/:roomId` - Get room documents

### User Management
- `GET /api/users/pending` - Get pending users for approval
- `PUT /api/users/:id/approve` - Approve/reject user
- `PUT /api/users/:id/deactivate` - Deactivate user

## Environment Variables


## Troubleshooting

### Common Issues

**ChromaDB Connection Failed**
- Ensure ChromaDB is running on port 8000
- Check if chroma_db directory exists in backend

**Python Embedding Service Not Starting**
- Verify all Python dependencies are installed: `pip install -r requirements.txt`
- Check if port 5001 is available

**Email Not Sending**
- Verify email credentials in .env
- For Gmail, ensure "App Passwords" are used instead of regular password
- Check email provider SMTP settings

**JWT Authentication Errors**
- Ensure JWT_SECRET is set and consistent
- Clear browser localStorage and login again

**Room Access Denied**
- Verify user has been assigned to the room via "Send Downstream"
- Check user role and hierarchy permissions

**Document Upload Failing**
- Verify user has write permissions in the room
- Check file size and format (PDF only)
- Ensure ML service is running on port 5001

### Debug Mode
Enable debug logging by setting:
- NODE_ENV=development
- DEBUG=true


## Security Features

- **Hierarchical RBAC**: Strict top-down permission model
- **JWT Authentication**: Secure token-based authentication
- **Data Isolation**: Room-level vector store filtering
- **Email Verification**: Required for all user accounts
- **Manager Approval**: All new accounts require approval
- **JIT Access Controls**: Temporary, auditable access grants
- **Input Validation**: Comprehensive request validation
- **CORS Protection**: Configured for production environments

## Contributing

When contributing to VAULT:

1. Follow the existing code structure and patterns
2. Ensure all new endpoints include proper RBAC checks
3. Maintain data isolation principles in all database queries
4. Update this README.md for any architectural changes
5. Test the complete user flow (CTO → PO → Admin → User)
6. Verify JIT systems work for both Room and Peer requests

---

**VAULT - Enterprise RAG & Knowledge Platform | Built for Secure, Multi-Tenant Document Intelligence**
