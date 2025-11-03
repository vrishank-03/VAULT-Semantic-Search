## VAULT-Semantic-Search — Hierarchical Diagram

An up-to-date hierarchical view of the repository and a short description of the main folders and files. This file is intended to be a living overview and is updated to reflect the current workspace layout.

.
├── LICENSE
├── README.md
├── .gitignore
├── hierarchical-diagram.md   # (this file) (modified)
├── backend/
│   ├── .env                      # local env (if present)
│   ├── check_models.js           # model-check helper
│   ├── credentials.js            # (untracked) backend credentials helper/config (do not commit secrets)
│   ├── clear_chroma_collection.js
│   ├── db_test.js               # (modified)
│   ├── database.js              # (modified)
│   ├── documentProcessor.js
│   ├── embedder.py
│   ├── index.js                  # Express app / server entry (modified)
│   ├── ml_runner.js              # spawns/coordinates ML workers
│   ├── package-lock.json
│   ├── package.json              # backend dependencies & scripts
│   ├── pipeline_test.py
│   ├── query_chroma.js
│   ├── searchService.js          # semantic search orchestration (modified)
│   ├── uploads/                  # (currently empty) raw upload blobs
│   ├── ml_env/                   # Python virtual environment for ML
│   │   ├── Include/
│   │   ├── Lib/
│   │   │   ├── site-packages/    # many installed packages (certifi, colorama, fsspec, etc.)
│   │   │   └── ...
│   │   ├── Scripts/
│   │   ├── pyvenv.cfg
│   │   └── share/
│   ├── controllers/
│   │   ├── authController.js     # (modified)
│   │   ├── chatController.js     # (modified)
│   │   ├── clientController.js    # (untracked) client-related handlers
│   │   ├── productController.js   # (untracked) product handlers
│   │   ├── roomController.js      # (untracked) room handlers
│   │   └── userController.js      # (untracked) user management
│   ├── middleware/
│   │   └── authMiddleware.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── chatRoutes.js         # (modified)
│   │   ├── clientRoutes.js        # (untracked)
│   │   ├── productRoutes.js       # (untracked)
│   │   ├── roomRoutes.js          # (untracked)
│   │   └── userRoutes.js          # (untracked)
│   ├── storage/                  # uploaded/processed document assets and profile images
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
│   │   ├── profile-pictures/       # directory for user profile pictures (may be empty)
│   │   ├── profile_images/
│   │   │   └── user_1.jpg
│   │   ├── user_1_1757222678691-741393591.pdf
│   │   ├── user_1_1757225084726-279148904.pdf
│   │   ├── user_1_1757225262847-581654687.pdf
│   │   ├── user_1_1757227257268-730703333.pdf
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
│   │   ├── user_1_1759658898940-340093893.pdf
│   │   ├── user_1_1759658965942-330856224.pdf
│   │   ├── user_1_1759834833881-489334665.pdf
│   │   ├── user_1_1761039607798-788269509.pdf
│   │   ├── user_1_1761124820117-836203239.pdf
│   │   ├── user_1_1761124855952-217298884.pdf
│   │   ├── user_1_1761640797545-985320182.pdf
│   │   ├── user_1_1761663670574-223601038.pdf
│   │   ├── user_1_1761751691897-42095510.pdf
│   │   ├── user_1_1761751707820-992888743.pdf
│   │   ├── user_2_1757405936549-603113401.pdf
│   │   ├── user_2_1757405969856-136517443.pdf
│   │   ├── user_2_1757409904439-209980828.pdf
│   │   ├── user_2_1757410942276-475222890.pdf
│   │   ├── user_2_1757411708436-641166028.pdf
│   │   ├── user_2_1757413014131-14257980.pdf
│   │   ├── user_2_1757413370042-304516305.pdf
│   │   ├── user_2_1757516273015-499186381.pdf
│   │   ├── user_2_1757516373951-562132871.pdf
│   │   ├── user_5_1757247452803-960173528.pdf
│   │   ├── user_5_1757247554335-582342896.pdf
│   │   ├── user_5_1757247554337-105336842.pdf
│   │   ├── user_5_1757247554337-77966763.pdf
│   │   ├── user_5_1757247554344-583086087.pdf
│   │   ├── user_5_1757247554349-980960308.pdf
│   │   ├── user_7_1757248723065-396853954.pdf
│   │   └── ... (additional user documents)
│   └── vault.db                    # local sqlite DB (metadata / users)
├── frontend/
│   ├── .gitignore
│   ├── package-lock.json
│   ├── package.json
│   ├── postcss.config.js
│   ├── README.md
│   ├── tailwind.config.js
│   ├── public/
│   │   ├── android-chrome-192x192.png
│   │   ├── android-chrome-512x512.png
│   │   ├── apple-touch-icon.png
│   │   ├── favicon-16x16.png
│   │   ├── favicon-32x32.png
│   │   ├── index.html
│   │   ├── logo192.png
│   │   ├── logo512.png
│   │   ├── manifest.json
│   │   ├── pdf.worker.min.js
│   │   ├── robots.txt
│   │   └── site.webmanifest
│   └── src/
│       ├── App.css
│       ├── App.js                # (modified)
│       ├── App.test.js
│       ├── PdfViewer.js
│       ├── ProtectedRoute.js
│       ├── Toast.css
│       ├── Toast.js
│       ├── index.css
│       ├── index.js
│       ├── logo.svg
│       ├── reportWebVitals.js
│       ├── setupTests.js
│       ├── services/
│       │   └── api.js              # (modified)
│       ├── pages/
│       │   ├── ChatRoomPage.js        # real-time chat room UI (untracked)
│       │   ├── Dashboard.js           # (modified)
│       │   ├── LoginPage.js           # (modified)
│       │   ├── ResetPasswordPage.js
│       │   └── SignupPage.js          # (modified)
│       ├── components/
│       │   ├── AuthLayout.js
│       │   ├── GenericSuccessAnimation.js
│       │   ├── GoogleLoginButton.js
│       │   ├── LoadingSpinner.js
│       │   ├── Navbar.js
│       │   ├── PrivateRoute.js
│       │   ├── ProcessingAnimation.js
│       │   ├── Sidebar.js
│       │   ├── SuccessAnimation.js
│       │   ├── ThemeToggleButton.js
│       │   ├── ThinkingAnimation.js
│       │   └── Typewriter.js
│       ├── context/
│       │   ├── AuthContext.js        # (modified)
│       │   └── ThemeContext.js
│       └── assets/
│           └── logo.png

## Notes
- Dependency directories (for example `node_modules/` and the detailed contents of `ml_env/Lib/site-packages/`) are summarized rather than fully enumerated to keep the diagram readable.
- `backend/uploads/` is present but currently empty; processed documents and images live under `backend/storage/`.