const sqlite3 = require('sqlite3').verbose();
const { ChromaClient } = require('chromadb');

const db = new sqlite3.Database('./vault.db', (err) => {
  if (err) {
    console.error("Error connecting to SQLite:", err.message);
  } else {
    console.log('Connected to the SQLite database.');
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        uploaded_at TEXT NOT NULL
      )`);
    });
  }
});

const chromaClient = new ChromaClient({ path: "http://localhost:8000" });

async function saveDocumentChunks(documentName, filePath, chunksWithVectors) {
  return new Promise(async (resolve, reject) => {
    const uploadedAt = new Date().toISOString();
    db.run('INSERT INTO documents (name, file_path, uploaded_at) VALUES (?, ?, ?)', [documentName, filePath, uploadedAt], async function(err) {
      if (err) return reject(err);

      const documentId = this.lastID;
      console.log(`Document saved to SQLite with ID: ${documentId}`);

      // NEW: Check if there are any chunks to save before proceeding
      if (chunksWithVectors.length === 0) {
        console.log("No chunks with vectors to save. Skipping ChromaDB.");
        return resolve({ documentId, chunks: 0 });
      }

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

module.exports = { saveDocumentChunks, db };