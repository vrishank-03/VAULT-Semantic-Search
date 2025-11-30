// backend/index.js - ENTERPRISE BRIDGE VERSION
// --------------------------------------------------------
// [LOGGING] Atomic logs enabled for Redis Bridge and Socket.io
// [FIXED] Explicit transports to match Frontend config
// --------------------------------------------------------

const dns = require('dns');
// [NETWORK_FIX] Prefer IPv4 to prevent delay/timeout on some Node versions
dns.setDefaultResultOrder('ipv4first');
console.log('[LOG] [NETWORK_FIX] Set DNS default result order to "ipv4first".');

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const Redis = require('ioredis'); // [ENTERPRISE] Required for Pub/Sub
require('dotenv').config();

const http = require('http');
const { Server } = require("socket.io");

const QueueService = require('./services/QueueService.js');
const logger = require('./utils/logger');
const { initializeDatabase, query } = require('./database.js');
const { performRAG } = require('./searchService.js');
const authRoutes = require('./routes/authRoutes');
const chatRoutes = require('./routes/chatRoutes');
const { protect, authorize } = require('./middleware/authMiddleware');

// --- ROUTES IMPORTS ---
const productRoutes = require('./routes/productRoutes');
const roomRoutes = require('./routes/roomRoutes');
const jitRequestRoutes = require('./routes/jitRequestRoutes');
const clientRoutes = require('./routes/clientRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// --- [BLOCK 4] SOCKET.IO SERVER ---
const server = http.createServer(app);

// [FIX] Added 'transports' to match frontend and prevent handshake closures
const io = new Server(server, {
    cors: {
        origin: FRONTEND_URL, // Dynamic origin based on env
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        credentials: true
    },
    transports: ['websocket', 'polling'], // [CRITICAL] Match frontend config
    pingTimeout: 60000, // Wait 60s before assuming dead (helps with long gen)
    pingInterval: 25000
});

console.log('[LOG] [BLOCK_4] Socket.io server initialized with extended timeouts & transports.');

// --- [ENTERPRISE FIX] REDIS SUBSCRIBER BRIDGE ---
// This listens for messages from ANY worker (GenerationService, Pipeline, etc.)
const redisSubscriber = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
});

const NOTIFICATION_CHANNEL = 'socket-notifications';

redisSubscriber.subscribe(NOTIFICATION_CHANNEL, (err, count) => {
    if (err) console.error('[REDIS] 🔴 Failed to subscribe: %s', err.message);
    else console.log(`[LOG] [BLOCK_4] 🟢 Subscribed to ${NOTIFICATION_CHANNEL}. Ready to bridge Workers.`);
});

redisSubscriber.on('message', (channel, message) => {
    if (channel === NOTIFICATION_CHANNEL) {
        try {
            const parsed = JSON.parse(message);
            const { targetSocketId, event, data } = parsed;

            // Bridge: Redis -> Socket.io
            // Only emit if the user is connected to THIS specific server instance
            const socket = io.sockets.sockets.get(targetSocketId);

            if (socket) {
                socket.emit(event, data);
                // [ATOMIC LOG] confirm relay
                console.log(`[REDIS-BRIDGE] 🟢 Relaying event '${event}' to socket ${targetSocketId}`);
            } else {
                // This is normal in multi-instance, but in single-instance implies stale ID
                // console.warn(`[REDIS-BRIDGE] 🟡 Socket ${targetSocketId} not found on this instance.`);
            }
        } catch (e) {
            console.error('[REDIS-BRIDGE] 🔴 Error parsing message:', e);
        }
    }
});

// Initialize Queue Service 
QueueService.init();

// --------------------------------------------------

io.on('connection', (socket) => {
    console.log(`[LOG] [BLOCK_4] Socket.io: User connected: ${socket.id}`);

    socket.on('disconnect', (reason) => {
        console.log(`[LOG] [BLOCK_4] Socket.io: User disconnected: ${socket.id} Reason: ${reason}`);
    });
});

// --- MIDDLEWARE ---
app.use(cors({
    origin: FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan('dev'));

// Attach IO to request (Legacy support, though QueueService is now decoupled)
app.use((req, res, next) => {
    req.io = io;
    next();
});

// --- STATIC FILES ---
app.use('/storage', express.static(path.join(__dirname, 'storage')));

// --- FILE STORAGE CONFIG ---
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
app.use('/api/rooms', roomRoutes);
app.use('/api/jit', jitRequestRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/users', userRoutes);


// --- CORE USER ENDPOINT ---
app.get('/api/user', protect, async (req, res) => {
    const userId = req.user.id;

    const sql = `
        SELECT u.id, u.email, u.picture_url, u.role, u.product_id, p.product_name 
        FROM users u
        LEFT JOIN products p ON u.product_id = p.id
        WHERE u.id = $1
    `;

    try {
        const result = await query(sql, [userId]);
        const user = result.rows[0];

        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        const baseUrl = process.env.API_URL ? process.env.API_URL.replace('/api', '') : `http://localhost:${PORT}`;
        const fullPictureUrl = user.picture_url ? `${baseUrl}${user.picture_url}` : null;

        res.json({
            id: user.id,
            email: user.email,
            pictureUrl: fullPictureUrl,
            role: user.role,
            product_id: user.product_id,
            productName: user.product_name
        });
    } catch (err) {
        console.error(`[ERROR] DB error fetching user ${userId}:`, err.message);
        res.status(500).json({ message: "Server error fetching user data." });
    }
});


// --- DOCUMENT UPLOAD (Protected) ---
app.post('/api/documents/upload/:roomId', protect, authorize('Administrator', 'ProductOwner', 'CTO'), upload.array('documents', 10), async (req, res) => {
    const { roomId } = req.params;
    const userId = req.user.id;
    const { socketId } = req.body;

    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded.' });

    // Use the imported QueueService
    const jobsAdded = [];
    for (const file of req.files) {
        const jobData = {
            filePath: file.path,
            originalName: file.originalname,
            userId,
            roomId,
            socketId
        };
        await QueueService.addDocumentJob(jobData);
        jobsAdded.push(jobData);
    }

    res.status(202).json({
        message: `Upload received. ${jobsAdded.length} documents queued.`,
        jobsQueued: jobsAdded.length
    });
});

// --- SEARCH ---
app.post('/api/search/:roomId', protect, async (req, res) => {
    const { roomId } = req.params;
    const { query, history, conversationId } = req.body;
    try {
        const ragResult = await performRAG(req.user.id, query, history, conversationId, roomId);
        res.status(200).json(ragResult);
    } catch (error) {
        res.status(500).json({ error: 'Failed to perform search.' });
    }
});

// --- DOWNLOAD ---
app.get('/api/documents/download/:id', protect, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await query('SELECT file_path FROM documents WHERE id = $1', [id]);
        const row = result.rows[0];
        if (!row) return res.status(404).json({ error: 'Document not found.' });
        res.sendFile(path.resolve(__dirname, row.file_path));
    } catch (err) {
        res.status(500).json({ error: 'DB Error' });
    }
});

// --- LIST DOCS ---
app.get('/api/documents/list/:roomId', protect, async (req, res) => {
    const { roomId } = req.params;
    try {
        const result = await query('SELECT id, name FROM documents WHERE room_id = $1 ORDER BY uploaded_at DESC', [roomId]);
        res.json(result.rows || []);
    } catch (err) {
        res.status(500).json({ error: 'DB Error' });
    }
});

// --- GLOBAL ERROR SAFETY ---
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Application specific logging, throwing an error, or other logic here
});

// --- START ---
initializeDatabase()
    .then(() => {
        server.listen(PORT, () => {
            console.log(`[LOG] [BLOCK_4] Backend running on http://localhost:${PORT}`);
        });
    })
    .catch(err => {
        console.error("[FATAL] Database init failed:", err);
        process.exit(1);
    });