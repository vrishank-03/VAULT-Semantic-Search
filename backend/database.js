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
                db.run(`
                    CREATE TABLE IF NOT EXISTS users (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        email TEXT NOT NULL UNIQUE,
                        password_hash TEXT NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        is_email_verified INTEGER DEFAULT 0,
                        email_verification_token TEXT,
                        password_reset_token TEXT,
                        password_reset_expires INTEGER,
                        picture_url TEXT
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
                });

                // Create the conversations table
                console.log('[DB_INIT] Attempting to create_conversations_table...');
                db.run(`
                    CREATE TABLE IF NOT EXISTS conversations (
                        conversation_id TEXT PRIMARY KEY,
                        user_id INTEGER NOT NULL,
                        title TEXT NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                    )
                `, (err) => {
                    if (err) {
                        console.error('[DB_INIT_ERROR] Failed to create_conversations_table:', err.message);
                    } else {
                        console.log('[DB_INIT_SUCCESS] conversations_table verified/created.');
                    }
                });

                // Create the chat_history table
                console.log('[DB_INIT] Attempting to create_chat_history_table...');
                db.run(`
                    CREATE TABLE IF NOT EXISTS chat_history (
                        message_id TEXT PRIMARY KEY,
                        conversation_id TEXT NOT NULL,
                        sender TEXT NOT NULL, -- 'user' or 'ai'
                        message TEXT NOT NULL, -- The text content of the message
                        results TEXT, -- NEW: Store JSON string of sources/results for AI messages
                        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (conversation_id) REFERENCES conversations(conversation_id) ON DELETE CASCADE
                    )
                `, (err) => {
                    if (err) {
                        console.error('[DB_INIT_ERROR] Failed to create_chat_history_table:', err.message);
                        // Don't reject immediately, try altering first
                    } else {
                        console.log('[DB_INIT_SUCCESS] chat_history_table verified/created.');
                    }

                    // --- Add 'results' column if it doesn't exist (for existing databases) ---
                    console.log('[DB_ALTER] Checking if chat_history.results column exists...');
                    db.all("PRAGMA table_info(chat_history)", (pragmaErr, columns) => {
                        if (pragmaErr) {
                            console.error('[DB_ALTER_ERROR] Could not get table info for chat_history:', pragmaErr.message);
                            return reject(pragmaErr); // If we can't check, reject
                        }

                        const resultsColumnExists = columns.some(col => col.name === 'results');
                        if (!resultsColumnExists) {
                            console.log('[DB_ALTER] Adding "results" column to chat_history table...');
                            db.run('ALTER TABLE chat_history ADD COLUMN results TEXT', (alterErr) => {
                                if (alterErr) {
                                    console.error('[DB_ALTER_ERROR] Failed to add "results" column:', alterErr.message);
                                    return reject(alterErr); // Reject if alter fails
                                } else {
                                    console.log('[DB_ALTER_SUCCESS] "results" column added successfully.');
                                    resolve(); // Resolve after successful alter
                                }
                            });
                        } else {
                            console.log('[DB_ALTER] "results" column already exists.');
                            resolve(); // Resolve if column already exists
                        }
                    });
                    // --- End Add Column ---
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

                const metadatas = chunksWithVectors.map((chunk, i) => ({
                    userId: Number(userId),
                    documentId: Number(documentId),
                    chunkIndex: i,
                    documentName,
                    pageNumber: chunk.pageNumber
                }));

                await collection.add({
                    ids,
                    embeddings: chunksWithVectors.map(c => c.vector),
                    documents: chunksWithVectors.map(c => c.text),
                    metadatas
                });
                console.log(`Saved ${chunksWithVectors.length} chunks to ChromaDB with page numbers.`);
                resolve({ documentId, chunks: chunksWithVectors.length });
            } catch (chromaErr) {
                reject(chromaErr);
            }
        });
    });
};

// --- NEW FUNCTION START ---
/**
 * Updates the title of a specific conversation.
 * @param {string} conversationId - The ID of the conversation to update.
 * @param {string} newTitle - The new title for the conversation.
 * @returns {Promise<{ changes: number }>} A promise that resolves with the number of rows changed.
 */
const updateConversationTitle = (conversationId, newTitle) => {
    return new Promise((resolve, reject) => {
        console.log(`[DB_UPDATE_TITLE] Attempting to update title for conversation ${conversationId} to "${newTitle}"`);
        const db = getDb();
        const sql = `UPDATE conversations SET title = ? WHERE conversation_id = ?`;
        console.log(`[DB_UPDATE_TITLE_DB] Executing SQL: ${sql} with params: [${newTitle}, ${conversationId}]`);

        db.run(sql, [newTitle, conversationId], function(err) {
            if (err) {
                console.error('[DB_UPDATE_TITLE_ERROR] Failed to update conversation title:', err.message);
                reject(err); // Reject the promise on error
            } else if (this.changes === 0) {
                 console.warn(`[DB_UPDATE_TITLE_WARN] No conversation found with ID ${conversationId} to update title.`);
                 // Resolve, but indicate no changes were made
                 resolve({ changes: 0 });
            } else {
                console.log(`[DB_UPDATE_TITLE_SUCCESS] Successfully updated title for conversation ${conversationId}. Rows affected: ${this.changes}`);
                resolve({ changes: this.changes }); // Resolve the promise on success
            }
        });
    });
};
// --- NEW FUNCTION END ---


module.exports = {
    initializeDatabase,
    getDb,
    saveDocumentChunks,
    updateConversationTitle, // --- ADDED EXPORT ---
    chromaClient
};