## VAULT-Semantic-Search — Hierarchical Diagram (LATEST - November 10, 2025)

This is a completely accurate and up-to-date hierarchical view of the repository including all uncommitted files from the feat/Jit_Requests branch.

. (project root)
├── LICENSE
├── README.md
├── .gitignore
├── hierarchical-diagram.md   # (this file, M = modified)
├── backend/
│   ├── .env                                    # local env file
│   ├── check_models.js                         # model-check helper script
│   ├── clear_chroma_collection.js              # ChromaDB collection cleanup
│   ├── credentials.js                          # credentials/secrets management
│   ├── database.js                             # (M) manages sqlite connection & schema
│   ├── db_test.js                              # database tests
│   ├── documentProcessor.js                    # PDF parsing & chunking utility
│   ├── embedder.py                             # Python embedding service
│   ├── index.js                                # (M) Express app / server entry point
│   ├── ml_runner.js                            # spawns/coordinates ML workers
│   ├── package.json                            # (M) backend dependencies & scripts
│   ├── package-lock.json                       # (M) locked dependency versions
│   ├── pipeline_test.py                        # ML pipeline tests
│   ├── query_chroma.js                         # ChromaDB query interface
│   ├── searchService.js                        # semantic search orchestration
│   ├── uploads/                                # (empty) temporary raw file uploads
│   ├── ml_env/                                 # Python virtual environment for ML (not tracked)
│   │   ├── Include/
│   │   ├── Lib/
│   │   │   ├── site-packages/    # many installed Python packages (summarized)
│   │   │   └── __pycache__/
│   │   ├── Scripts/
│   │   ├── pyvenv.cfg
│   │   └── share/
│   ├── controllers/
│   │   ├── authController.js                   # (M) authentication handlers
│   │   ├── chatController.js                   # chat-related handlers
│   │   ├── clientController.js                 # (M) client management handlers
│   │   ├── jitRequestController.js             # (??) just-in-time request handlers (NEW)
│   │   ├── productController.js                # (M) product management handlers
│   │   ├── roomController.js                   # (M) room handlers & RBAC logic
│   │   └── userController.js                   # (M) user management handlers
│   ├── middleware/
│   │   └── authMiddleware.js                   # (M) auth/authorization middleware
│   ├── routes/
│   │   ├── authRoutes.js                       # authentication routes
│   │   ├── chatRoutes.js                       # chat routes
│   │   ├── clientRoutes.js                     # (M) client routes
│   │   ├── jitRequestRoutes.js                 # (??) JIT request routes (NEW)
│   │   ├── productRoutes.js                    # (M) product routes
│   │   ├── roomRoutes.js                       # (M) room routes
│   │   └── userRoutes.js                       # (M) user routes
│   ├── services/
│   │   ├── accessService.js                    # (??) access control service (NEW)
│   │   ├── emailService.js                     # email notification service
│   │   ├── logService.js                       # (??) logging service (NEW)
│   │   └── roomService.js                      # (??) room management service (NEW)
│   ├── utils/
│   │   └── roomUtils.js                        # (??) room utility functions (NEW - room code generation, etc)
│   ├── storage/
│   │   ├── profile_images/
│   │   │   ├── user_1.jpg
│   │   │   └── user_2.jpg
│   │   ├── document-1756615818862-677824898.pdf
│   │   ├── document-1756908427134-455336609.pdf
│   │   ├── document-1756908448809-837068321.pdf
│   │   ├── document-1756909188991-289956320.pdf
│   │   ├── document-1756909514356-477849471.pdf
│   │   ├── document-1756909594029-836775053.pdf
│   │   ├── document-1756911486675-646492353.pdf
│   │   ├── document-1756911507495-903138763.pdf
│   │   ├── document-1756911637425-740190506.pdf
│   │   ├── document-1756912730502-152579802.pdf
│   │   ├── document-1756973362878-15856826.pdf
│   │   ├── document-1756995088875-897166173.pdf
│   │   ├── document-1756995094626-731948720.pdf
│   │   ├── document-1756995147868-688038937.pdf
│   │   ├── document-1756995197360-491302839.pdf
│   │   ├── document-1756995214547-470739053.pdf
│   │   ├── document-1756995233733-511903945.pdf
│   │   ├── document-1756995250293-396290734.pdf
│   │   ├── document-1756995269069-717693725.pdf
│   │   ├── document-1756995286319-423490494.pdf
│   │   ├── documents-1756996388197-434940308.pdf
│   │   ├── documents-1756996565578-49469039.pdf
│   │   ├── documents-1756996596807-914729063.pdf
│   │   ├── documents-1756996998396-46289517.pdf
│   │   ├── documents-1756997015130-586802175.pdf
│   │   ├── documents-1756997015133-166815843.pdf
│   │   ├── documents-1756997015136-444524265.pdf
│   │   ├── documents-1756997039296-117793235.pdf
│   │   ├── documents-1756997039298-648097490.pdf
│   │   ├── documents-1756997071889-887009066.pdf
│   │   ├── documents-1757160659716-6141505.pdf
│   │   ├── user_1_*.pdf (20+ documents)
│   │   ├── user_2_*.pdf (9+ documents)
│   │   ├── user_5_*.pdf (7+ documents)
│   │   └── ... (additional per-user uploaded documents)
│   └── vault.db                                # SQLite database (metadata, users, products, rooms, access)
├── frontend/
│   ├── .gitignore
│   ├── package.json                            # (M) frontend dependencies & build scripts
│   ├── package-lock.json                       # (M) locked dependency versions
│   ├── postcss.config.js                       # PostCSS configuration
│   ├── tailwind.config.js                      # Tailwind CSS configuration
│   ├── README.md                               # frontend readme
│   ├── public/
│   │   ├── index.html                          # main HTML entry point
│   │   ├── manifest.json                       # PWA manifest
│   │   ├── pdf.worker.min.js                   # PDF.js worker script
│   │   ├── robots.txt                          # SEO robots file
│   │   ├── site.webmanifest                    # web app manifest
│   │   ├── icons/
│   │   │   ├── android-chrome-192x192.png
│   │   │   ├── android-chrome-512x512.png
│   │   │   ├── apple-touch-icon.png
│   │   │   ├── favicon-16x16.png
│   │   │   ├── favicon-32x32.png
│   │   │   ├── logo192.png
│   │   │   └── logo512.png
│   │   └── ... (other assets)
│   └── src/
│       ├── App.css                             # main app styles
│       ├── App.js                              # (M) main React component
│       ├── App.test.js                         # app tests
│       ├── Toast.css                           # toast notification styles
│       ├── Toast.js                            # toast notification component
│       ├── Toast.css
│       ├── index.css                           # global styles
│       ├── index.js                            # (M) React app entry point
│       ├── PdfViewer.js                        # PDF viewer component
│       ├── ProtectedRoute.js                   # route protection wrapper
│       ├── reportWebVitals.js                  # performance metrics
│       ├── setupTests.js                       # test configuration
│       ├── services/
│       │   └── api.js                          # (M) central axios API client with all endpoints
│       ├── pages/
│       │   ├── ChatRoomPage.js                 # (tracked) chat room UI page
│       │   ├── Dashboard.js                    # (M) main dashboard page
│       │   ├── LoginPage.js                    # (M) login/authentication page
│       │   ├── ResetPasswordPage.js            # password reset page
│       │   └── SignupPage.js                   # user signup page
│       ├── components/
│       │   ├── AuthLayout.js                   # authentication layout wrapper
│       │   ├── GenericSuccessAnimation.js      # success animation component
│       │   ├── GoogleLoginButton.js            # Google OAuth button
│       │   ├── LoadingSpinner.js               # reusable loading spinner
│       │   ├── Navbar.js                       # navigation bar
│       │   ├── PrivateRoute.js                 # private route protection
│       │   ├── ProcessingAnimation.js          # processing state animation
│       │   ├── Sidebar.js                      # sidebar navigation
│       │   ├── SuccessAnimation.js             # success notification animation
│       │   ├── ThemeToggleButton.js            # dark/light theme toggle
│       │   ├── ThinkingAnimation.js            # AI thinking animation
│       │   ├── Typewriter.js                   # typewriter text effect
│       │   ├── modals/
│       │   │   ├── AssignClientModal.js        # (??) client assignment modal (NEW)
│       │   │   ├── ConfirmModal.js             # (??) reusable confirmation modal (NEW)
│       │   │   ├── CreateRoomModal.js          # (M) room creation modal
│       │   │   ├── EditRoomModal.js            # (??) room password editing modal (NEW)
│       │   │   ├── IncomingJitModal.js         # (??) incoming JIT requests modal (NEW)
│       │   │   ├── IncomingPeerJitModal.js     # (??) incoming peer-to-peer requests modal (NEW)
│       │   │   ├── PeerRequestModal.js         # (??) peer access request modal (NEW)
│       │   │   ├── RequestAccessModal.js       # (??) room access request modal (NEW)
│       │   │   ├── RoomPasswordModal.js        # (??) password entry for room modal (NEW)
│       │   │   ├── SendDownstreamModal.js      # (??) send room downstream modal (NEW)
│       │   │   └── UserManagementModal.js      # (M) user management modal
│       │   └── dashboard/
│       │       ├── DashboardHeader.js          # (??) dashboard header with action buttons (NEW)
│       │       ├── DashboardTabs.js            # (??) dashboard tab navigation (NEW)
│       │       ├── hooks/
│       │       │   ├── useDashboardData.js     # (??) custom hook for dashboard data fetching (NEW)
│       │       │   └── useProductManagement.js # (??) custom hook for product management (NEW)
│       │       └── sections/
│       │           ├── ClientCardsSection.js   # (??) client cards display section (NEW)
│       │           ├── ManageProductsSection.js # (??) product management section (NEW)
│       │           ├── OutgoingPeerRequestsSection.js # (??) outgoing peer requests section (NEW)
│       │           ├── OutgoingRequestsSection.js # (??) outgoing room requests section (NEW)
│       │           ├── PendingProductsSection.js # (??) pending product approvals section (NEW)
│       │           ├── ProductCardsSection.js  # (??) product cards display section (NEW)
│       │           └── RoomCardsSection.js     # (??) room cards display section (NEW)
│       ├── context/
│       │   ├── AuthContext.js                  # (tracked) authentication context & state
│       │   ├── SocketContext.js                # (??) Socket.io context provider (NEW)
│       │   └── ThemeContext.js                 # (tracked) theme context & dark/light mode
│       └── utils/
│           └── gravatar.js                     # gravatar URL generation utility

## Key / Status Legend
- **(M)** = file shown as modified in git status (staged or unstaged changes)
- **(D)** = file shown as deleted in git status
- **(??)** = untracked / new file according to git status (uncommitted, NOT staged)
- **(tracked)** = present, tracked by git with no recent uncommitted changes

## Branch Information
- **Current Branch**: `feat/Jit_Requests` (feature branch for Just-In-Time access requests)
- **Latest Update**: November 10, 2025

## Modified Files Summary (M = 26 total)
**Backend (13 files)**:
- database.js, index.js, package.json, package-lock.json
- Controllers: authController.js, clientController.js, productController.js, roomController.js, userController.js
- Middleware: authMiddleware.js
- Routes: clientRoutes.js, productRoutes.js, roomRoutes.js, userRoutes.js

**Frontend (13 files)**:
- App.js, index.js, Dashboard.js, LoginPage.js
- package.json, package-lock.json
- api.js (services)
- modals/CreateRoomModal.js, modals/UserManagementModal.js
- hierarchical-diagram.md

## Untracked Files Summary (?? = 22 total)
**Backend (5)**:
- controllers/jitRequestController.js
- routes/jitRequestRoutes.js
- services/accessService.js, logService.js, roomService.js
- utils/roomUtils.js

**Frontend Modals (9 - all NEW)**:
- AssignClientModal.js, ConfirmModal.js, EditRoomModal.js
- IncomingJitModal.js, IncomingPeerJitModal.js, PeerRequestModal.js
- RequestAccessModal.js, RoomPasswordModal.js, SendDownstreamModal.js

**Frontend Dashboard (7 - all NEW)**:
- DashboardHeader.js, DashboardTabs.js
- sections/: ClientCardsSection.js, ManageProductsSection.js, OutgoingPeerRequestsSection.js, OutgoingRequestsSection.js, PendingProductsSection.js, ProductCardsSection.js, RoomCardsSection.js
- hooks/: useDashboardData.js, useProductManagement.js

**Frontend Context (1 - NEW)**:
- context/SocketContext.js

## Deleted Files (D = 1 total)
- frontend/src/components/modals/JitRequestModal.js (replaced by newer modals)

