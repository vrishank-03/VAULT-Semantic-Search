const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const morgan = require('morgan');
const { processDocument } = require('./documentProcessor.js');
const { saveDocumentChunks, db } = require('./database.js');
const { performRAG } = require('./searchService.js');

const app = express();
const PORT = 5000;

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

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

// POST /api/documents/upload - WITH CORRECTED ERROR HANDLING
app.post('/api/documents/upload', upload.array('documents', 10), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded.' });
  }

  console.log(`Received batch of ${req.files.length} files for processing.`);
  
  // We wrap the entire process in a single try...catch block.
  try {
    let successCount = 0;
    let documentIds = [];

    // Process files sequentially. If any file throws an error,
    // the execution will jump immediately to the catch block below.
    for (const file of req.files) {
      const chunksWithVectors = await processDocument(file.path);
      const result = await saveDocumentChunks(file.originalname, file.path, chunksWithVectors);
      successCount++;
      documentIds.push(result.documentId);
    }

    // This success response is now ONLY sent if the entire loop completes without error.
    res.status(201).json({
      message: `Batch processing complete. Success: ${successCount}`,
      documentIds
    });

  } catch (error) {
    // If any file in the batch fails, we send a single 500 error response.
    console.error(`A critical error occurred during batch processing:`, error);
    res.status(500).json({
      error: 'A file in the batch could not be processed.',
      details: error.message
    });
  }
});


// POST /api/search
app.post('/api/search', async (req, res) => {
  const { query, history } = req.body;
  if (!query) return res.status(400).json({ error: 'Query is required.' });
  try {
    const ragResult = await performRAG(query, history);
    res.status(200).json(ragResult);
  } catch (error) {
    console.error('Error during RAG search:', error);
    res.status(500).json({ error: 'Failed to perform search. Please try again later...🤕' });
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