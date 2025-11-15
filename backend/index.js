// backend/index.js

// --- [NETWORK_FIX] IMPORT DNS ---
const dns = require('dns');
// --- [NETWORK_FIX] Force IPv4 DNS resolution first ---
dns.setDefaultResultOrder('ipv4first');
console.log('[LOG] [NETWORK_FIX] Set DNS default result order to "ipv4first".');
// --- [END NETWORK_FIX] ---

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const fs = require('fs');
require('dotenv').config();

// --- [BLOCK 4] NEW IMPORTS ---
const http = require('http'); // For socket.io
const { Server } = require("socket.io"); // For socket.io

// --- [CASING_FIX] Import the file with the correct lowercase 'q' ---
const QueueService = require('./services/QueueService.js');
const logger = require('./utils/logger'); // Import logger

const { initializeDatabase, saveDocumentChunks, getDb } = require('./database.js');
// [WORKER_QUEUE_FIX] processDocument is no longer called by index.js
// const { processDocument } = require('./documentProcessor.js'); 
const { performRAG } = require('./searchService.js');
const authRoutes = require('./routes/authRoutes');
const chatRoutes = require('./routes/chatRoutes');
const { protect, authorize } = require('./middleware/authMiddleware');

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

// --- [JIT_REFACTOR] IMPORT JIT ROUTES ---
console.log('[LOG] [JIT_REFACTOR] Loading jitRequestRoutes...');
const jitRequestRoutes = require('./routes/jitRequestRoutes');
console.log('[LOG] [JIT_REFACTOR] jitRequestRoutes loaded.');
// --- [END JIT_REFACTOR] ---

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

// --- [BLOCK 4] NEW HTTP SERVER & SOCKET.IO ---
const server = http.createServer(app); 
const io = new Server(server, {
    cors: {
        origin: "http://localhost:3000", 
        methods: ["GET", "POST"],
        credentials: true
    }
});

console.log('[LOG] [BLOCK_4] Socket.io server initialized.');

// --- [WORKER_QUEUE_FIX] Give the io instance to the QueueService ---
QueueService.init(io); 
// --- [END WORKER_QUEUE_FIX] ---


// Listen for new connections
io.on('connection', (socket) => {
    console.log(`[LOG] [BLOCK_4] Socket.io: User connected with socket ID: ${socket.id}`);
    
    socket.on('disconnect', () => {
        console.log(`[LOG] [BLOCK_4] Socket.io: User disconnected with socket ID: ${socket.id}`);
    });
});
// --- [END BLOCK 4] ---


// --- MIDDLEWARE ---
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan('dev'));

app.use((req, res, next) => {
    req.io = io;
    next();
});
console.log('[LOG] [BLOCK_4] Socket.io instance attached to request middleware.');


// --- NEW: SERVE STATIC FILES ---
app.use('/storage', express.static(path.join(__dirname, 'storage')));
console.log(`[LOG] Serving static files from public path '/storage' mapped to: ${path.join(__dirname, 'storage')}`);
// --- END NEW STATIC ---


// --- FILE STORAGE ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'storage/'),
    filename: (req, file, cb) => {
        const userId = req.user?.id || 'unknown'; 
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `user_${userId}_${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});
const upload = multer({ storage });

// --- API ROUTES ---
console.log('[LOG] Configuring API routes...');
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/products', productRoutes);
console.log('[LOG] /api/products routes configured.');
app.use('/api/rooms', roomRoutes);
console.log('[LOG] /api/rooms routes configured.');
app.use('/api/jit', jitRequestRoutes);
console.log('[LOG] [JIT_REFACTOR] /api/jit routes configured.');
app.use('/api/clients', clientRoutes);
console.log('[LOG] /api/clients routes configured.');
app.use('/api/users', userRoutes);
console.log('[LOG] /api/users routes configured.');


// --- MODIFIED /api/user ENDPOINT ---
app.get('/api/user', protect, (req, res) => {
    console.log(`[LOG] GET /api/user for user ID: ${req.user.id}`);
    const userId = req.user.id;
    const db = getDb();
    
    const sql = `
        SELECT u.id, u.email, u.picture_url, u.role, u.product_id, p.product_name 
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

        const baseUrl = process.env.API_URL ? process.env.API_URL.replace('/api', '') : `http://localhost:${PORT}`;
        const fullPictureUrl = user.picture_url ? `${baseUrl}${user.picture_url}` : null;
        console.log(`[LOG] GET /api/user: Sending user data (Role: ${user.role}, Product: ${user.product_name})`);

        res.json({ 
            id: user.id, 
            email: user.email, 
            pictureUrl: fullPictureUrl,
            role: user.role, 
            product_id: user.product_id, 
            productName: user.product_name 
        });
    });
});
// --- END OF MODIFIED /api/user ENDPOINT ---


// --- PROTECTED ROUTES ---

// --- [WORKER_QUEUE_FIX] Document Upload Route ---
app.post(
    '/api/documents/upload/:roomId', 
    protect, 
    authorize('Administrator', 'ProductOwner', 'CTO'),
    upload.array('documents', 10), 
    async (req, res) => {
        
        const { roomId } = req.params;
        const userId = req.user.id;
        const { socketId } = req.body; 

        // [CASING_FIX] Use logger (assuming it's available) or console.log
        const log = logger || console;
        
        log.info(`[UPLOAD_ROUTE] POST /api/documents/upload/${roomId}: Received ${req.files ? req.files.length : 0} files from user ${userId}. Socket: ${socketId}`);
        
        if (!req.files || req.files.length === 0) {
            log.warn('[UPLOAD_ROUTE] No files uploaded.');
            return res.status(400).json({ error: 'No files uploaded.' });
        }
        if (!roomId) {
            log.warn('[UPLOAD_ROUTE] No room ID provided.');
            return res.status(400).json({ error: 'Room ID is required.' });
        }
        if (!socketId) {
            log.warn('[UPLOAD_ROUTE] No socketId provided.');
            return res.status(400).json({ error: 'Socket ID is required for progress updates.' });
        }
        
        const db = getDb();
        const jobsAdded = [];

        for (const file of req.files) {
            log.debug(`[UPLOAD_ROUTE] Checking duplicate for: ${file.originalname}`);
            try {
                const existingDoc = await new Promise((resolve, reject) => {
                    db.get('SELECT id FROM documents WHERE name = ? AND room_id = ?', [file.originalname, roomId], (err, row) => {
                        if (err) reject(err);
                        resolve(row);
                    });
                });

                if (existingDoc) {
                    log.warn(`[UPLOAD_ROUTE] Duplicate file "${file.originalname}" in room ${roomId}. Skipping.`);
                    fs.unlinkSync(file.path);
                } else {
                    const jobData = {
                        filePath: file.path,
                        originalName: file.originalname,
                        userId: userId,
                        roomId: roomId,
                        socketId: socketId
                    };
                    await QueueService.addDocumentJob(jobData);
                    jobsAdded.push(jobData);
                    log.info(`[UPLOAD_ROUTE] Queued job for: ${file.originalname}`);
                }

            } catch (error) {
                log.error(`[UPLOAD_ROUTE] Error checking duplicate for ${file.originalname}:`, error);
                fs.unlinkSync(file.path);
            }
        }
        
        log.info(`[UPLOAD_ROUTE] Batch upload complete. ${jobsAdded.length} new jobs queued.`);
        
        res.status(202).json({ 
            message: `Upload received. ${jobsAdded.length} new documents are being processed in the background.`,
            jobsQueued: jobsAdded.length
        });
    }
);
// --- [END WORKER_QUEUE_FIX] ---


// --- [MODIFIED] Search Endpoint (unchanged from your file) ---
app.post('/api/search/:roomId', protect, async (req, res) => {
    const { roomId } = req.params;
    if (!roomId) {
        return res.status(400).json({ error: 'Room ID is required.' });
    }
    const { query, history, conversationId } = req.body;
    if (!query) return res.status(400).json({ error: 'Query is required.' });

    console.log(`[LOG] POST /api/search/${roomId}: Received search for Convo ID: ${conversationId || 'new'} by user ${req.user.id}`);

    try {
        const ragResult = await performRAG(req.user.id, query, history, conversationId, roomId);
        res.status(200).json(ragResult);
    } catch (error) {
        console.error(`[ERROR] Error during RAG search for user ${req.user.id} in room ${roomId}:`, error);
        res.status(500).json({ error: 'Failed to perform search.' });
    }
});
// --- [END MODIFIED] ---

// --- [MODIFIED] Get Single Document (unchanged from your file) ---
app.get('/api/documents/download/:id', protect, (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const db = getDb();
    
    console.log(`[LOG] GET /api/documents/download/${id}: User ${userId} requesting document.`);

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

// --- [MODIFIED] Get Document List (unchanged from your file) ---
app.get('/api/documents/list/:roomId', protect, (req, res) => {
    const { roomId } = req.params;
    const userId = req.user.id;
    const db = getDb();
    console.log(`[LOG] GET /api/documents/list/${roomId}: Fetching document list for user ${userId} in room ${roomId}`);

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
        server.listen(PORT, () => {
            console.log(`[LOG] [BLOCK_4] Backend server (with Socket.io) is running on http://localhost:${PORT}`);
        });
    })
    .catch(err => {
        console.error("[FATAL] Failed to initialize database:", err);
        process.exit(1);
    });