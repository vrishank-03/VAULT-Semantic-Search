const sqlite3 = require('sqlite3').verbose();
const { ChromaClient } = require('chromadb');

// Initialize clients
const db = new sqlite3.Database('./vault.db', (err) => {
  if (err) console.error(err.message);
  console.log('Connected to the SQLite database.');
});

const chromaClient = new ChromaClient({ path: "http://localhost:8000" });

// Create table if it doesn't exist
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    uploaded_at TEXT NOT NULL
  )`);
});

// Function to save document chunks
async function saveDocumentChunks(documentName, chunksWithVectors) {
  return new Promise(async (resolve, reject) => {
    // First, save the main document record to SQLite
    const uploadedAt = new Date().toISOString();
    db.run('INSERT INTO documents (name, uploaded_at) VALUES (?, ?)', [documentName, uploadedAt], async function(err) {
      if (err) return reject(err);

      const documentId = this.lastID;
      console.log(`Document saved to SQLite with ID: ${documentId}`);

      // Now, prepare and save chunks to ChromaDB
      try {
        const collection = await chromaClient.getOrCreateCollection({ name: "documents" });

        const ids = chunksWithVectors.map((_, i) => `doc_${documentId}_chunk_${i}`);
        const embeddings = chunksWithVectors.map(c => c.vector);
        const documents = chunksWithVectors.map(c => c.text);
        const metadatas = chunksWithVectors.map((_, i) => ({ documentId, chunkIndex: i }));

        await collection.add({ ids, embeddings, documents, metadatas });
        console.log(`Saved ${chunksWithVectors.length} chunks to ChromaDB.`);
        resolve({ documentId, chunks: chunksWithVectors.length });
      } catch (chromaErr) {
        reject(chromaErr);
      }
    });
  });
}

module.exports = { saveDocumentChunks };