## VAULT-Semantic-Search — Hierarchical Diagram (LATEST - November 11, 2025)

This is a completely accurate and up-to-date hierarchical view of the repository including ALL uncommitted files and changes.

**Legend:**
- **(M)** = Modified file (staged or unstaged)
- **(N)** = New/Untracked file
- **[Branch]** = feat/ragRefactor

. (project root)
├── LICENSE
├── README.md
├── .gitignore
├── hierarchical-diagram.md                     # (M) updated with latest file structure
├── backend/
│   ├── .env                                    # local env file (tracked)
│   ├── check_models.js                         # model-check helper script
│   ├── clear_chroma_collection.js              # ChromaDB collection cleanup
│   ├── credentials.js                          # credentials/secrets management
│   ├── database.js                             # manages sqlite connection & schema
│   ├── db_test.js                              # database tests
│   ├── documentProcessor.js                    # PDF parsing & chunking utility
│   ├── embedder.py                             # Python embedding service
│   ├── index.js                                # Express app / server entry point
│   ├── ml_runner.js                            # spawns/coordinates ML workers
│   ├── package.json                            # backend dependencies & scripts
│   ├── package-lock.json                       # locked dependency versions
│   ├── pipeline_test.py                        # ML pipeline tests
│   ├── query_chroma.js                         # ChromaDB query interface
│   ├── searchService.js                        # (M) semantic search orchestration
│   ├── vault.db                                # SQLite database (metadata, users, products, rooms, access)
│   ├── uploads/                                # temporary raw file uploads (empty)
│   ├── ml_env/                                 # Python virtual environment for ML (not tracked in repo)
│   │   ├── pyvenv.cfg
│   │   ├── .gitignore
│   │   ├── Include/
│   │   ├── Lib/
│   │   │   ├── site-packages/                  # installed Python packages
│   │   │   └── __pycache__/
│   │   ├── Scripts/
│   │   │   ├── activate
│   │   │   ├── activate.bat
│   │   │   ├── activate.fish
│   │   │   ├── Activate.ps1
│   │   │   └── deactivate.bat
│   │   └── share/
│   │       └── man/
│   ├── controllers/
│   │   ├── authController.js                   # authentication handlers
│   │   ├── chatController.js                   # (M) chat-related handlers
│   │   ├── clientController.js                 # client management handlers
│   │   ├── jitRequestController.js             # just-in-time request handlers
│   │   ├── productController.js                # product management handlers
│   │   ├── roomController.js                   # room handlers & RBAC logic
│   │   └── userController.js                   # user management handlers
│   ├── middleware/
│   │   └── authMiddleware.js                   # auth/authorization middleware
│   ├── routes/
│   │   ├── authRoutes.js                       # authentication routes
│   │   ├── chatRoutes.js                       # (M) chat routes
│   │   ├── clientRoutes.js                     # client routes
│   │   ├── jitRequestRoutes.js                 # JIT request routes
│   │   ├── productRoutes.js                    # product routes
│   │   ├── roomRoutes.js                       # room routes
│   │   └── userRoutes.js                       # user routes
│   ├── services/
│   │   ├── accessService.js                    # access control service
│   │   ├── ChatHistoryService.js               # (N) chat history management
│   │   ├── emailService.js                     # email notification service
│   │   ├── FormattingService.js                # (N) text formatting utilities for RAG
│   │   ├── GenerationService.js                # (N) response generation service
│   │   ├── logService.js                       # logging service
│   │   ├── RAGPipelineService.js               # (N) RAG pipeline orchestration
│   │   ├── RetrievalService.js                 # (N) document retrieval service
│   │   ├── roomService.js                      # room management service
│   │   └── VectorDBService.js                  # (N) vector database abstraction layer
│   ├── utils/
│   │   ├── logger.js                           # (N) centralized logging utility
│   │   ├── promptTemplates.js                  # (N) prompt templates for LLM
│   │   └── roomUtils.js                        # room utility functions (code generation, etc)
│   ├── storage/
│   │   ├── profile_images/
│   │   │   ├── user_1.jpg
│   │   │   └── user_2.jpg
│   │   ├── profile-pictures/                   # additional profile storage
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
│   │   ├── user_1_1757222678691-741393591.pdf
│   │   ├── user_1_1757225084726-279148904.pdf
│   │   ├── user_1_1757225262847-581654687.pdf
│   │   ├── user_1_1757227257268-730333.pdf
│   │   ├── user_1_1757227374056-655745571.pdf
│   │   ├── user_1_1757235456375-237158943.pdf
│   │   ├── user_1_1757235803329-367064309.pdf
│   │   ├── user_1_1757236090504-686519958.pdf
│   │   ├── user_1_1757263624794-274320923.pdf
│   │   ├── user_1_1759471577124-254312922.pdf
│   │   ├── user_1_1759471699310-32268320.pdf
│   │   ├── user_1_1759565720738-969155726.pdf
│   │   ├── user_1_1759647005911-295162051.pdf
│   │   ├── user_1_1759649151493-868825585.pdf
│   │   ├── user_1_1759651062841-801663079.pdf
│   │   ├── user_1_1759651441142-816663872.pdf
│   │   ├── user_1_1759652070954-656044368.pdf
│   │   ├── user_1_1759652726314-147349869.pdf
│   │   ├── user_1_1759658819745-130812126.pdf
│   │   ├── user_1_1759658838303-81585284.pdf
│   │   ├── user_1_1759658865806-141835340.pdf
│   │   ├── user_1_1759658881924-162893665.pdf
│   │   ├── user_1_1759658898940-340893.pdf
│   │   ├── user_1_1759658965942-330856224.pdf
│   │   ├── user_1_1759834833881-489334665.pdf
│   │   ├── user_1_1761039607798-788269509.pdf
│   │   ├── user_1_1761124820117-836203239.pdf
│   │   ├── user_1_1761124855952-217824.pdf
│   │   ├── user_1_1761640797545-985320182.pdf
│   │   ├── user_1_1761663670574-223601038.pdf
│   │   ├── user_2_1757405936549-603113401.pdf
│   │   ├── user_2_1757405969856-136517443.pdf
│   │   ├── user_2_1757409904439-209828.pdf
│   │   ├── user_2_1757410942276-475222890.pdf
│   │   ├── user_2_1757411708436-641028.pdf
│   │   ├── user_2_1757413014131-14257980.pdf
│   │   ├── user_2_1757413370042-304516305.pdf
│   │   ├── user_2_1757516273015-499381.pdf
│   │   ├── user_2_1757516373951-562132871.pdf
│   │   ├── user_3_1762858345720-308380231.pdf           # (N) new user_3 document
│   │   ├── user_3_1762864639733-118183903.pdf           # (N) new user_3 document
│   │   ├── user_5_1757247452803-960173528.pdf
│   │   ├── user_5_1757247554335-582342896.pdf
│   │   ├── user_5_1757247554337-105336842.pdf
│   │   ├── user_5_1757247554337-77966763.pdf
│   │   ├── user_5_1757247554344-583086087.pdf
│   │   ├── user_5_1757247554349-980960308.pdf
│   │   └── user_7_1757248723065-396853954.pdf
├── frontend/
│   ├── .gitignore
│   ├── package.json                            # frontend dependencies & build scripts
│   ├── package-lock.json                       # locked dependency versions
│   ├── postcss.config.js                       # PostCSS configuration
│   ├── tailwind.config.js                      # Tailwind CSS configuration
│   ├── README.md                               # frontend readme
│   ├── public/
│   │   ├── index.html                          # main HTML entry point
│   │   ├── manifest.json                       # PWA manifest
│   │   ├── pdf.worker.min.js                   # PDF.js worker script
│   │   ├── robots.txt                          # SEO robots file
│   │   ├── site.webmanifest                    # web app manifest
│   │   ├── android-chrome-192x192.png
│   │   ├── android-chrome-512x512.png
│   │   ├── apple-touch-icon.png
│   │   ├── favicon-16x16.png
│   │   ├── favicon-32x32.png
│   │   ├── logo192.png
│   │   └── logo512.png
│   └── src/
│       ├── App.css                             # main app styles
│       ├── App.js                              # (M) main React component
│       ├── App.test.js                         # app tests
│       ├── AppLayout.js                        # (N) app layout wrapper component
│       ├── Toast.css                           # toast notification styles
│       ├── Toast.js                            # toast notification component
│       ├── index.css                           # global styles
│       ├── index.js                            # (M) React app entry point
│       ├── PdfViewer.js                        # PDF viewer component
│       ├── ProtectedRoute.js                   # route protection wrapper
│       ├── reportWebVitals.js                  # performance metrics
│       ├── setupTests.js                       # test configuration
│       ├── logo.svg                            # logo asset
│       ├── assets/
│       │   └── logo.png                        # logo image
│       ├── services/
│       │   └── api.js                          # central axios API client with all endpoints
│       ├── pages/
│       │   ├── ChatRoomPage.js                 # (M) chat room UI page
│       │   ├── Dashboard.js                    # (M) main dashboard page
│       │   ├── LoginPage.js                    # login/authentication page
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
│       │   ├── Sidebar.js                      # (M) sidebar navigation
│       │   ├── SuccessAnimation.js             # success notification animation
│       │   ├── ThemeToggleButton.js            # dark/light theme toggle
│       │   ├── ThinkingAnimation.js            # AI thinking animation
│       │   ├── Typewriter.js                   # typewriter text effect
│       │   ├── UserSettingsMenu.js             # (N) user settings dropdown menu
│       │   ├── modals/
│       │   │   ├── AssignClientModal.js        # client assignment modal
│       │   │   ├── ConfirmModal.js             # reusable confirmation modal
│       │   │   ├── CreateRoomModal.js          # room creation modal
│       │   │   ├── EditRoomModal.js            # room password editing modal
│       │   │   ├── IncomingJitModal.js         # incoming JIT requests modal
│       │   │   ├── IncomingPeerJitModal.js     # incoming peer-to-peer requests modal
│       │   │   ├── PeerRequestModal.js         # peer access request modal
│       │   │   ├── RequestAccessModal.js       # room access request modal
│       │   │   ├── RoomPasswordModal.js        # password entry for room modal
│       │   │   ├── SendDownstreamModal.js      # send room downstream modal
│       │   │   └── UserManagementModal.js      # user management modal
│       │   └── dashboard/
│       │       ├── DashboardHeader.js          # (M) dashboard header with action buttons
│       │       ├── DashboardTabs.js            # dashboard tab navigation
│       │       ├── hooks/
│       │       │   ├── useDashboardData.js     # custom hook for dashboard data fetching
│       │       │   ├── useOnClickOutside.js    # (N) custom hook for click-outside detection
│       │       │   └── useProductManagement.js # custom hook for product management
│       │       └── sections/
│       │           ├── ClientCardsSection.js   # client cards display section
│       │           ├── ManageProductsSection.js # product management section
│       │           ├── OutgoingPeerRequestsSection.js # outgoing peer requests section
│       │           ├── OutgoingRequestsSection.js # outgoing room requests section
│       │           ├── PendingProductsSection.js # pending product approvals section
│       │           ├── ProductCardsSection.js  # product cards display section
│       │           └── RoomCardsSection.js     # room cards display section
│       ├── context/
│       │   ├── AuthContext.js                  # authentication context & state
│       │   ├── LayoutContext.js                # (N) layout/UI state context
│       │   ├── SocketContext.js                # Socket.io context provider
│       │   └── ThemeContext.js                 # theme context & dark/light mode
│       └── utils/
│           └── gravatar.js                     # gravatar URL generation utility

---

## Summary of Changes (feat/ragRefactor branch)

### Modified Files (M):
- `hierarchical-diagram.md` - This file
- `backend/controllers/chatController.js` - Chat handler updates
- `backend/routes/chatRoutes.js` - Chat routing updates
- `backend/searchService.js` - Search service refactoring
- `frontend/src/App.js` - App component updates
- `frontend/src/components/Sidebar.js` - Sidebar refactoring
- `frontend/src/components/dashboard/DashboardHeader.js` - Dashboard header updates
- `frontend/src/pages/ChatRoomPage.js` - Chat room page updates
- `frontend/src/pages/Dashboard.js` - Dashboard page updates

### New/Untracked Files (N):
**Backend Services (RAG Pipeline):**
- `backend/services/ChatHistoryService.js` - Chat history management
- `backend/services/FormattingService.js` - Text formatting utilities
- `backend/services/GenerationService.js` - Response generation
- `backend/services/RAGPipelineService.js` - RAG orchestration
- `backend/services/RetrievalService.js` - Document retrieval
- `backend/services/VectorDBService.js` - Vector DB abstraction

**Backend Utilities:**
- `backend/utils/logger.js` - Centralized logging
- `backend/utils/promptTemplates.js` - LLM prompt templates

**Backend Storage:**
- `backend/storage/user_3_1762858345720-308380231.pdf` - New document
- `backend/storage/user_3_1762864639733-118183903.pdf` - New document

**Frontend Components:**
- `frontend/src/AppLayout.js` - App layout wrapper
- `frontend/src/components/UserSettingsMenu.js` - User settings menu
- `frontend/src/components/dashboard/hooks/useOnClickOutside.js` - Click-outside hook
- `frontend/src/context/LayoutContext.js` - Layout context provider
