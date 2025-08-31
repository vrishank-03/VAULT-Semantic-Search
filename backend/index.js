const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { processDocument } = require('./documentProcessor.js');
const { saveDocumentChunks } = require('./database.js');
const { performRAG } = require('./searchService.js');
const app = express();
const PORT = 5000;

// Setup multer for file uploads
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());

// New endpoint for uploading documents
app.post('/api/documents/upload', upload.single('document'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  try {
    console.log(`File received: ${req.file.originalname}, processing...`);
    const chunksWithVectors = await processDocument(req.file.path);

    console.log('Saving document and chunks to databases...');
    const result = await saveDocumentChunks(req.file.originalname, chunksWithVectors);

    res.status(201).json({ 
      message: 'File uploaded and processed successfully!',
      ...result 
    });
  } catch (error) {
    console.error('Error during document processing:', error);
    res.status(500).json({ error: 'Failed to process document.' });
  }
});

// Add this new endpoint for searching
app.post('/api/search', async (req, res) => {
  const { query } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'Query is required.' });
  }

  try {
    const ragResult = await performRAG(query);
    res.status(200).json(ragResult);
  } catch (error) {
    console.error('Error during search:', error);
    res.status(500).json({ error: 'Failed to perform search.' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});