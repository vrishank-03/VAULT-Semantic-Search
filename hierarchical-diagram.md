## VAULT-Semantic-Search — Hierarchical Diagram

An up-to-date hierarchical view of the repository and a short description of the main folders and files. This file is intended to be a living overview and is updated to reflect the current workspace layout.

.
├── LICENSE
├── README.md
├── .gitignore
├── hierarchical-diagram.md   # (this file)
├── backend/
│   ├── package.json                # backend dependencies & scripts
│   ├── package-lock.json
│   ├── index.js                    # Express app / server entry
│   ├── searchService.js            # semantic search orchestration
│   ├── database.js                 # DB helpers (sqlite/vault.db)
│   ├── db_test.js                  # DB test utilities / examples
│   ├── documentProcessor.js        # PDF/text extraction & chunking
│   ├── ml_runner.js                # spawns/coordinates ML workers
│   ├── embedder.py                 # Python embedder for vectors
│   ├── pipeline_test.py            # pipeline integration tests (python)
│   ├── clear_chroma_collection.js  # helper to clear vector DB collections
│   ├── query_chroma.js             # helper/query script for Chroma vector DB
│   ├── controllers/
│   │   └── authController.js       # auth logic (signup/login handlers)
│   ├── middleware/
│   │   └── authMiddleware.js       # JWT/session verification
│   ├── routes/
│   │   └── authRoutes.js           # auth-related API routes
│   ├── storage/
│   │   ├── uploads/                # stored raw upload blobs (hashed names)
│   │   │   ├── 3c3fdf045254ee4ea3a7b5f48e99d12e
│   │   │   ├── 4049b1111abeedcd2dd296bb920516c8
│   │   │   └── ... (many additional upload blobs)
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
│   │   ├── user_1_1757227257268-730703333.pdf
│   │   ├── user_1_1757227374056-655745571.pdf
│   │   ├── user_1_1757235456375-237158943.pdf
│   │   ├── user_1_1757235803329-367064309.pdf
│   │   └── ... (other PDF assets)
│   └── vault.db                     # local sqlite DB (metadata / users)
├── frontend/
│   ├── package.json
│   ├── package-lock.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   ├── README.md
│   ├── .gitignore
│   ├── public/
│   │   ├── index.html
│   │   ├── manifest.json
│   │   ├── site.webmanifest
│   │   ├── robots.txt
│   │   ├── pdf.worker.min.js
│   │   ├── android-chrome-192x192.png
│   │   ├── android-chrome-512x512.png
│   │   ├── favicon-16x16.png
│   │   ├── favicon-32x32.png
│   │   ├── logo192.png
│   │   ├── logo512.png
│   │   ├── apple-touch-icon.png
│   │   └── ... (other public assets)
│   └── src/
│       ├── App.js
│       ├── App.css
│       ├── App.test.js
│       ├── index.js
│       ├── index.css
│       ├── reportWebVitals.js
│       ├── logo.svg
│       ├── PdfViewer.js              # PDF viewing component
│       ├── ProtectedRoute.js         # route wrapper for auth
│       ├── Toast.js                  # toast UI component
│       ├── Toast.css
│       ├── setupTests.js
│       ├── services/
│       │   └── api.js                # API client wrappers
│       ├── pages/
│       │   ├── Dashboard.js
│       │   ├── LoginPage.js
│       │   └── SignupPage.js
│       ├── components/
│       │   ├── AuthLayout.js             # layout wrapper for auth pages
│       │   ├── Navbar.js                 # top navigation bar
│       │   ├── PrivateRoute.js           # route guard (Outlet-based)
│       │   ├── Sidebar.js                # app sidebar navigation
│       │   ├── ThemeToggleButton.js      # toggles light/dark theme
│       │   ├── Typewriter.js             # small typewriter text effect
│       │   ├── GoogleLoginButton.js      # Google OAuth button (react-oauth)
│       │   ├── SuccessAnimation.js       # success animation component
│       │   └── ProcessingAnimation.js    # processing/loading animation
│       ├── context/
│       │   ├── AuthContext.js
│       │   └── ThemeContext.js
│       └── assets/
│           └── logo.png

## Notes
- This diagram aims to accurately reflect the repository layout at the time of update. It lists primary source files, configuration, and the documented sample assets in `backend/storage/`.
- `backend/storage/uploads/` contains binary blobs named by hash
