const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const morgan = require('morgan'); // <-- Import morgan
const { processDocument } = require('./documentProcessor.js');
const { saveDocumentChunks, db } = require('./database.js');
const { performRAG } = require('./searchService.js');

const app = express();
const PORT = 5000;

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());
app.use(morgan('dev')); // <-- Use morgan for detailed request logging

// --- FILE STORAGE CONFIG ---
const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, 'storage/'); },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// --- API ENDPOINTS ---

// POST /api/documents/upload
app.post('/api/documents/upload', upload.single('document'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  try {
    const result = await saveDocumentChunks(req.file.originalname, req.file.path, await processDocument(req.file.path));
    res.status(201).json({ message: 'File uploaded and processed successfully!', ...result });
  } catch (error) {
    console.error('Error during document processing:', error);
    res.status(500).json({ error: 'Failed to process document.' });
  }
});

// POST /api/search
app.post('/api/search', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Query is required.' });
  try {
    const ragResult = await performRAG(query);
    res.status(200).json(ragResult);
  } catch (error) {
    console.error('Error during RAG search:', error);
    res.status(500).json({ error: 'Failed to perform search.' });
  }
});

// GET /api/documents/:id
app.get('/api/documents/:id', (req, res) => {
  const { id } = req.params;
  console.log(`[Backend] Request received for document with ID: ${id}`);
  db.get('SELECT file_path FROM documents WHERE id = ?', [id], (err, row) => {
    if (err) {
      console.error("[Backend] Database error:", err);
      return res.status(500).json({ error: 'Database error.' });
    }
    if (!row) {
      console.error(`[Backend] Document with ID ${id} not found in database.`);
      return res.status(404).json({ error: 'Document not found.' });
    }
    const resolvedPath = path.resolve(__dirname, row.file_path);
    console.log(`[Backend] Database query successful. Found file path: ${row.file_path}`);
    console.log(`[Backend] Attempting to send file from resolved path: ${resolvedPath}`);
    res.sendFile(resolvedPath, (err) => {
      if (err) {
        console.error(`[Backend] Error sending file:`, err);
      } else {
        console.log(`[Backend] File sent successfully!`);
      }
    });
  });
});

// --- SERVER START ---
app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});