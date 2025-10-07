const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const { initializeDatabase, saveDocumentChunks, getDb } = require('./database.js');
const { processDocument } = require('./documentProcessor.js');
const { performRAG } = require('./searchService.js');
const authRoutes = require('./routes/authRoutes');
const { protect } = require('./middleware/authMiddleware');

const app = express();
const PORT = process.env.PORT || 5000;

// --- MIDDLEWARE ---
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan('dev'));

// --- FILE STORAGE ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'storage/'),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `user_${req.user.id}_${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});
const upload = multer({ storage });

// --- API ROUTES ---
app.use('/api/auth', authRoutes);

app.get('/api/user', protect, (req, res) => {
    const userId = req.user.id;
    const db = getDb();
    
    const sql = `SELECT id, email, picture_url FROM users WHERE id = ?`;
    
    db.get(sql, [userId], (err, user) => {
        if (err) {
            console.error(`Database error fetching user info for user ID ${userId}:`, err.message);
            return res.status(500).json({ message: "Server error fetching user data." });
        }
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }
        res.json({ 
            id: user.id, 
            email: user.email, 
            pictureUrl: user.picture_url 
        });
    });
});

// --- PROTECTED ROUTES ---

// UPDATED: Now checks for duplicate filenames before uploading
app.post('/api/documents/upload', protect, upload.array('documents', 10), async (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded.' });
    }
    
    const userId = req.user.id;
    const db = getDb();
    let documentIds = [];

    try {
        for (const file of req.files) {
            // Check for duplicates before processing
            const existingDoc = await new Promise((resolve, reject) => {
                db.get('SELECT id FROM documents WHERE user_id = ? AND name = ?', [userId, file.originalname], (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                });
            });

            if (existingDoc) {
                // If a duplicate is found, stop and return a 409 Conflict error
                console.warn(`Upload stopped: User ${userId} tried to upload duplicate file "${file.originalname}".`);
                return res.status(409).json({ error: `Duplicate file detected. The document named "${file.originalname}" already exists.` });
            }

            // If no duplicate, proceed with processing and saving
            const chunksWithVectors = await processDocument(file.path);
            const result = await saveDocumentChunks(userId, file.originalname, file.path, chunksWithVectors);
            documentIds.push(result.documentId);
        }
        res.status(201).json({ message: `Success`, documentIds });
    } catch (error) {
        console.error(`Error during batch processing:`, error);
        res.status(500).json({ error: 'A file could not be processed.', details: error.message });
    }
});

app.post('/api/search', protect, async (req, res) => {
    const { query, history } = req.body;
    if (!query) return res.status(400).json({ error: 'Query is required.' });
    try {
        const ragResult = await performRAG(req.user.id, query, history);
        res.status(200).json(ragResult);
    } catch (error) {
        console.error('Error during RAG search:', error);
        res.status(500).json({ error: 'Failed to perform search.' });
    }
});

app.get('/api/documents/:id', protect, (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const db = getDb();
    
    db.get('SELECT file_path FROM documents WHERE id = ? AND user_id = ?', [id, userId], (err, row) => {
        if (err || !row) {
            return res.status(404).json({ error: 'Document not found or access denied.' });
        }
        const resolvedPath = path.resolve(__dirname, row.file_path);
        res.sendFile(resolvedPath);
    });
});

// NEW: Endpoint to get a list of all documents for the logged-in user
app.get('/api/documents', protect, (req, res) => {
    const userId = req.user.id;
    const db = getDb();

    const sql = `SELECT id, name FROM documents WHERE user_id = ? ORDER BY uploaded_at DESC`;

    db.all(sql, [userId], (err, rows) => {
        if (err) {
            console.error(`Database error fetching documents for user ID ${userId}:`, err.message);
            return res.status(500).json({ message: "Server error fetching documents." });
        }
        res.json(rows || []);
    });
});


// --- SERVER START ---
initializeDatabase()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Backend server is running on http://localhost:${PORT}`);
        });
    })
    .catch(err => {
        console.error("Failed to initialize database:", err);
        process.exit(1);
    });