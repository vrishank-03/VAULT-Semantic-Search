const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path'); // --- THIS LINE IS NOW FIXED ---
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const { initializeDatabase, saveDocumentChunks, getDb } = require('./database.js');
const { processDocument } = require('./documentProcessor.js');
const { performRAG } = require('./searchService.js');
const authRoutes = require('./routes/authRoutes');
const chatRoutes = require('./routes/chatRoutes');
const { protect } = require('./middleware/authMiddleware');

// --- [NEW] IMPORT PRODUCT ROUTES ---
console.log('[LOG] Loading productRoutes...');
const productRoutes = require('./routes/productRoutes'); 
console.log('[LOG] productRoutes loaded.');
// --- [END NEW] ---

// --- [NEW] IMPORT ROOM ROUTES ---
console.log('[LOG] Loading roomRoutes...');
const roomRoutes = require('./routes/roomRoutes');
console.log('[LOG] roomRoutes loaded.');
// --- [END NEW] ---

// --- [NEW] IMPORT CLIENT ROUTES ---
console.log('[LOG] Loading clientRoutes...');
const clientRoutes = require('./routes/clientRoutes');
console.log('[LOG] clientRoutes loaded.');
// --- [END NEW] ---

// --- [NEW] IMPORT USER ROUTES ---
console.log('[LOG] Loading userRoutes...');
const userRoutes = require('./routes/userRoutes');
console.log('[LOG] userRoutes loaded.');
// --- [END NEW] ---

const app = express();
const PORT = process.env.PORT || 5000;

// --- MIDDLEWARE ---
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan('dev'));

// --- NEW: SERVE STATIC FILES ---
app.use('/storage', express.static(path.join(__dirname, 'storage')));
console.log(`[LOG] Serving static files from public path '/storage' mapped to: ${path.join(__dirname, 'storage')}`);
// --- END NEW STATIC ---


// --- FILE STORAGE ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'storage/'),
    filename: (req, file, cb) => {
        // --- [FIX] Safely access req.user.id ---
        const userId = req.user?.id || 'unknown'; // Use optional chaining
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `user_${userId}_${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});
const upload = multer({ storage });

// --- API ROUTES ---
console.log('[LOG] Configuring API routes...');
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);

// --- [NEW] USE PRODUCT ROUTES ---
app.use('/api/products', productRoutes);
console.log('[LOG] /api/products routes configured.');
// --- [END NEW] ---

// --- [NEW] USE ROOM ROUTES ---
app.use('/api/rooms', roomRoutes);
console.log('[LOG] /api/rooms routes configured.');
// --- [END NEW] ---

// --- [NEW] USE CLIENT ROUTES ---
app.use('/api/clients', clientRoutes);
console.log('[LOG] /api/clients routes configured.');
// --- [END NEW] ---

// --- [NEW] USE USER ROUTES ---
app.use('/api/users', userRoutes);
console.log('[LOG] /api/users routes configured.');
// --- [END NEW] ---


// --- MODIFIED /api/user ENDPOINT ---
app.get('/api/user', protect, (req, res) => {
    console.log(`[LOG] GET /api/user for user ID: ${req.user.id}`);
    const userId = req.user.id;
    const db = getDb();
    
    // --- [MODIFIED] Get user role and product ID ---
    const sql = `
        SELECT u.id, u.email, u.picture_url, u.role, p.product_name 
        FROM users u
        LEFT JOIN products p ON u.product_id = p.id
        WHERE u.id = ?
    `;
    
    db.get(sql, [userId], (err, user) => {
        if (err) {
            console.error(`[ERROR] Database error fetching user info for user ID ${userId}:`, err.message);
            return res.status(500).json({ message: "Server error fetching user data." });
        }
        if (!user) {
            console.warn(`[WARN] GET /api/user: User not found for ID ${userId}.`);
            return res.status(404).json({ message: "User not found." });
        }

        // --- MODIFICATION: Construct Full Picture URL ---
        const baseUrl = process.env.API_URL ? process.env.API_URL.replace('/api', '') : `http://localhost:${PORT}`;
        const fullPictureUrl = user.picture_url ? `${baseUrl}${user.picture_url}` : null;
        console.log(`[LOG] GET /api/user: Sending user data (Role: ${user.role}, Product: ${user.product_name})`);
        // --- END MODIFICATION ---

        res.json({ 
            id: user.id, 
            email: user.email, 
            pictureUrl: fullPictureUrl, // <-- Send the full, absolute URL
            role: user.role, // <-- [NEW] Send user's role
            productName: user.product_name // <-- [NEW] Send user's product
        });
    });
});
// --- END OF MODIFIED /api/user ENDPOINT ---


// --- PROTECTED ROUTES ---

// --- [MODIFIED] Document Upload Route (Admin/PO Only) ---
app.post('/api/documents/upload/:roomId', protect, upload.array('documents', 10), async (req, res) => {
    const { roomId } = req.params;
    console.log(`[LOG] POST /api/documents/upload/${roomId}: Received ${req.files ? req.files.length : 0} files from user ${req.user.id}`);
    if (!req.files || req.files.length === 0) {
        console.warn('[WARN] POST /api/documents/upload: No files uploaded.');
        return res.status(400).json({ error: 'No files uploaded.' });
    }
    if (!roomId) {
        console.warn('[WARN] POST /api/documents/upload: No room ID provided.');
        return res.status(400).json({ error: 'Room ID is required.' });
    }
    
    const userId = req.user.id;
    const db = getDb();
    
    // --- [NEW] Security Check: Only Admin or PO can upload ---
    db.get('SELECT role FROM users WHERE id = ?', [userId], async (err, user) => {
        if (err || !user) {
            console.error(`[ERROR] Upload Auth: Could not find user ${userId} in DB.`);
            return res.status(401).json({ error: 'Authentication error.' });
        }
        
        if (user.role === 'User') {
            console.warn(`[WARN] Upload Auth: User ${userId} (Role: ${user.role}) attempted to upload to room ${roomId}. FORBIDDEN.`);
            return res.status(403).json({ error: 'You do not have permission to upload documents.' });
        }
        
        console.log(`[LOG] Upload Auth: User ${userId} (Role: ${user.role}) is authorized to upload.`);
        // --- [END NEW] Security Check ---
    
        let documentIds = [];
        try {
            for (const file of req.files) {
                console.log(`[LOG] Processing file: ${file.originalname} for user ${userId} in room ${roomId}`);
                
                // --- [MODIFIED] Check for duplicates *within the same room* ---
                const existingDoc = await new Promise((resolve, reject) => {
                    // --- [MODIFIED] Removed user_id check. Duplicates are per-room, not per-user. ---
                    db.get('SELECT id FROM documents WHERE name = ? AND room_id = ?', [file.originalname, roomId], (err, row) => {
                        if (err) reject(err);
                        resolve(row);
                    });
                });

                if (existingDoc) {
                    console.warn(`[WARN] Upload stopped: Duplicate file "${file.originalname}" in room ${roomId}.`);
                    return res.status(409).json({ error: `Duplicate file detected. The document named "${file.originalname}" already exists in this room.` });
                }

                console.log(`[LOG] No duplicate found for "${file.originalname}". Processing document...`);
                const chunksWithVectors = await processDocument(file.path);
                console.log(`[LOG] Document processed. Saving ${chunksWithVectors.length} chunks to DB and Chroma...`);
                
                // Pass the roomId to saveDocumentChunks
                const result = await saveDocumentChunks(userId, file.originalname, file.path, chunksWithVectors, roomId);
                documentIds.push(result.documentId);
                console.log(`[LOG] File "${file.originalname}" saved with Document ID: ${result.documentId} to room ${roomId}`);
            }
            res.status(201).json({ message: `Success`, documentIds });
        } catch (error) {
            console.error(`[ERROR] Error during batch processing for user ${req.user.id}:`, error);
            res.status(500).json({ error: 'A file could not be processed.', details: error.message });
        }
    });
});
// --- [END MODIFIED] ---

// --- [MODIFIED] Search Endpoint (now room-aware) ---
app.post('/api/search/:roomId', protect, async (req, res) => {
    // 1. Get roomId from params
    const { roomId } = req.params;
    if (!roomId) {
        return res.status(400).json({ error: 'Room ID is required.' });
    }

    // 2. Destructure conversationId from the request body
    const { query, history, conversationId } = req.body;
    if (!query) return res.status(400).json({ error: 'Query is required.' });

    // 3. Added log
    console.log(`[LOG] POST /api/search/${roomId}: Received search for Convo ID: ${conversationId || 'new'} by user ${req.user.id}`);

    // TODO: Add validation here to ensure user (req.user.id) has access to this roomId

    try {
        // 4. Pass conversationId AND roomId to performRAG
        const ragResult = await performRAG(req.user.id, query, history, conversationId, roomId);
        res.status(200).json(ragResult);
    } catch (error) {
        console.error(`[ERROR] Error during RAG search for user ${req.user.id} in room ${roomId}:`, error);
        res.status(500).json({ error: 'Failed to perform search.' });
    }
});
// --- [END MODIFIED] ---

// --- [MODIFIED] Get Single Document (for PDF Viewer) ---
app.get('/api/documents/download/:id', protect, (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const db = getDb();
    
    console.log(`[LOG] GET /api/documents/download/${id}: User ${userId} requesting document.`);

    // --- [MODIFIED] Removed user_id check. Any user who can see the room can download. ---
    // We implicitly trust the user has access to the room if they have the document ID.
    // A future security enhancement would be to check if user has access to the doc's room_id.
    db.get('SELECT file_path FROM documents WHERE id = ?', [id], (err, row) => {
        if (err || !row) {
            console.warn(`[WARN] GET /api/documents/download/${id}: Document not found for ID ${id}.`);
            return res.status(404).json({ error: 'Document not found.' });
        }
        console.log(`[LOG] GET /api/documents/download/${id}: Sending file at path: ${row.file_path}`);
        const resolvedPath = path.resolve(__dirname, row.file_path);
        res.sendFile(resolvedPath);
    });
});
// --- [END MODIFIED] ---

// --- [MODIFIED] Get Document List (now room-aware) ---
app.get('/api/documents/list/:roomId', protect, (req, res) => {
    const { roomId } = req.params;
    const userId = req.user.id;
    const db = getDb();
    console.log(`[LOG] GET /api/documents/list/${roomId}: Fetching document list for user ${userId} in room ${roomId}`);

    // TODO: Add validation to ensure user has access to this room

    // --- [MODIFIED] SQL query is now room-specific, *not* user-specific ---
    const sql = `SELECT id, name FROM documents WHERE room_id = ? ORDER BY uploaded_at DESC`;
    const params = [roomId];

    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error(`[ERROR] Database error fetching documents for room ${roomId}:`, err.message);
            return res.status(500).json({ message: "Server error fetching documents." });
        }
        console.log(`[LOG] GET /api/documents/list: Found ${rows.length} documents in room ${roomId}.`);
        res.json(rows || []);
    });
});
// --- [END MODIFIED] ---


// --- SERVER START ---
console.log('[LOG] Initializing database...');
initializeDatabase()
    .then(() => {
        console.log('[LOG] Database initialized successfully.');
        app.listen(PORT, () => {
            console.log(`Backend server is running on http://localhost:${PORT}`);
        });
    })
    .catch(err => {
        console.error("[FATAL] Failed to initialize database:", err);
        process.exit(1);
    });