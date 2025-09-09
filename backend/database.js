const sqlite3 = require('sqlite3').verbose();
const { ChromaClient } = require('chromadb');
require('dotenv').config();

const DB_FILE = 'vault.db';
let db;

const chromaClient = new ChromaClient({
    path: `http://${process.env.CHROMA_HOST}:${process.env.CHROMA_PORT}`,
});

const initializeDatabase = () => {
    return new Promise((resolve, reject) => {
        db = new sqlite3.Database(DB_FILE, (err) => {
            if (err) {
                console.error('Error opening database:', err.message);
                return reject(err);
            }
            console.log('Connected to the SQLite database.');

            db.serialize(() => {
                // Updated users table schema
                db.run(`
                    CREATE TABLE IF NOT EXISTS users (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        email TEXT NOT NULL UNIQUE,
                        password_hash TEXT NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        is_email_verified INTEGER DEFAULT 0,
                        email_verification_token TEXT,
                        password_reset_token TEXT,
                        password_reset_expires INTEGER
                    )
                `, (err) => {
                    if (err) return reject(err);
                    console.log("Table 'users' is ready.");
                });

                db.run(`
                    CREATE TABLE IF NOT EXISTS documents (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,
                        name TEXT NOT NULL,
                        file_path TEXT NOT NULL,
                        uploaded_at TEXT NOT NULL,
                        FOREIGN KEY (user_id) REFERENCES users (id)
                    )
                `, (err) => {
                    if (err) return reject(err);
                    console.log("Table 'documents' is ready.");
                    resolve();
                });
            });
        });
    });
};

const getDb = () => {
    if (!db) throw new Error('Database not initialized!');
    return db;
};

const saveDocumentChunks = async (userId, documentName, filePath, chunksWithVectors) => {
    const db = getDb();
    return new Promise(async (resolve, reject) => {
        const uploadedAt = new Date().toISOString();
        db.run('INSERT INTO documents (user_id, name, file_path, uploaded_at) VALUES (?, ?, ?, ?)', [userId, documentName, filePath, uploadedAt], async function(err) {
            if (err) return reject(err);
            const documentId = this.lastID;
            console.log(`Document saved to SQLite with ID: ${documentId} for user ID: ${userId}`);

            if (chunksWithVectors.length === 0) return resolve({ documentId, chunks: 0 });

            try {
                const collection = await chromaClient.getOrCreateCollection({ name: "documents" });
                const ids = chunksWithVectors.map((_, i) => `user_${userId}_doc_${documentId}_chunk_${i}`);
                const metadatas = chunksWithVectors.map((_, i) => ({
                    userId: Number(userId),
                    documentId: Number(documentId),
                    chunkIndex: i,
                    documentName,
                }));

                await collection.add({
                    ids,
                    embeddings: chunksWithVectors.map(c => c.vector),
                    documents: chunksWithVectors.map(c => c.text),
                    metadatas
                });
                console.log(`Saved ${chunksWithVectors.length} chunks to ChromaDB.`);
                resolve({ documentId, chunks: chunksWithVectors.length });
            } catch (chromaErr) {
                reject(chromaErr);
            }
        });
    });
};

module.exports = {
    initializeDatabase,
    getDb,
    saveDocumentChunks,
    chromaClient // Export chromaClient for searchService
};