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
        console.log('[DB_INIT] Attempting to connect to SQLite database...');
        db = new sqlite3.Database(DB_FILE, (err) => {
            if (err) {
                console.error('[DB_INIT_ERROR] Error opening database:', err.message);
                return reject(err);
            }
            console.log('[DB_INIT_SUCCESS] Connected to the SQLite database.');
            
            db.serialize(() => {
                console.log('[DB_INIT] Starting table serialization...');

                // --- Users Table [MODIFIED] ---
                console.log('[DB_INIT] Attempting to create_users_table (with manager_id)...');
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
                        picture_url TEXT,
                        role TEXT NOT NULL DEFAULT 'User',
                        status TEXT NOT NULL DEFAULT 'pending_email_verification',
                        product_id INTEGER,
                        manager_id INTEGER, -- [MODIFIED] Links user to their manager (User->Admin, Admin->PO, PO->CTO)
                        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
                        FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL -- [MODIFIED]
                    )
                `, (err) => {
                    if (err) {
                        console.error('[DB_INIT_ERROR] Failed to create_users_table:', err.message);
                        return reject(err);
                    }
                    console.log("[DB_INIT_SUCCESS] 'users' table verified/created.");
                });

                // --- Products Table [PHASE 1.B MODIFIED] ---
                console.log('[DB_INIT] Attempting to create_products_table...');
                db.run(`
                    CREATE TABLE IF NOT EXISTS products (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        product_name TEXT NOT NULL UNIQUE,
                        product_owner_name TEXT NOT NULL,
                        product_owner_email TEXT NOT NULL,
                        status TEXT NOT NULL DEFAULT 'pending', -- [PHASE 1.B] Changed default from 'suspended' to 'pending'
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `, (err) => {
                    if (err) {
                        console.error('[DB_INIT_ERROR] Failed to create_products_table:', err.message);
                        return reject(err); 
                    } else {
                        console.log('[DB_INIT_SUCCESS] products_table verified/created.');
                    }
                });
                
                // --- Clients Table (For categorization) ---
                console.log('[DB_INIT] Attempting to create_clients_table...');
                db.run(`
                    CREATE TABLE IF NOT EXISTS clients (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        product_id INTEGER NOT NULL,
                        name TEXT NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
                        UNIQUE(product_id, name)
                    )
                `, (err) => {
                    if (err) {
                        console.error('[DB_INIT_ERROR] Failed to create_clients_table:', err.message);
                        return reject(err);
                    }
                    console.log('[DB_INIT_SUCCESS] clients_table verified/created.');
                });
                
                // --- [REMOVED] user_client_access table ---
                console.log('[DB_INIT] Dropping obsolete table user_client_access if it exists...');
                db.run(`DROP TABLE IF EXISTS user_client_access`, (err) => {
                    if (err) {
                        console.error('[DB_INIT_ERROR] Failed to drop user_client_access_table:', err.message);
                        return reject(err);
                    }
                    console.log('[DB_INIT_SUCCESS] Obsolete table user_client_access removed.');
                });
                // --- [END REMOVED] ---

                // --- [MODIFIED] Chat Rooms Table ---
                console.log('[DB_INIT] Attempting to create_chat_rooms_table (with creator_id)...');
                db.run(`
                    CREATE TABLE IF NOT EXISTS chat_rooms (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        product_id INTEGER NOT NULL,
                        client_id INTEGER,
                        creator_id INTEGER, -- [MODIFIED] Links room to its creator (Admin, PO, or CTO)
                        name TEXT NOT NULL,
                        color TEXT,
                        password_hash TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
                        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
                        FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL -- [MODIFIED]
                    )
                `, (err) => {
                    if (err) {
                        console.error('[DB_INIT_ERROR] Failed to create_chat_rooms_table:', err.message);
                        return reject(err);
                    } else {
                        console.log('[DB_INIT_SUCCESS] chat_rooms_table verified/created.');
                    }
                });
                // --- [END MODIFIED] ---

                // --- [NEW] Room Admin Assignments Table (For PO -> Admin room sharing) ---
                console.log('[DB_INIT] Attempting to create_room_admin_assignments_table...');
                db.run(`
                    CREATE TABLE IF NOT EXISTS room_admin_assignments (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        room_id INTEGER NOT NULL,
                        admin_id INTEGER NOT NULL,
                        FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
                        FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE,
                        UNIQUE(room_id, admin_id)
                    )
                `, (err) => {
                    if (err) {
                        console.error('[DB_INIT_ERROR] Failed to create_room_admin_assignments_table:', err.message);
                        return reject(err);
                    }
                    console.log('[DB_INIT_SUCCESS] room_admin_assignments_table verified/created.');
                });
                // --- [END NEW] ---

                // --- [NEW] Room PO Assignments Table (For CTO -> PO room sharing) ---
                console.log('[DB_INIT] Attempting to create_room_po_assignments_table...');
                db.run(`
                    CREATE TABLE IF NOT EXISTS room_po_assignments (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        room_id INTEGER NOT NULL,
                        po_id INTEGER NOT NULL,
                        is_unblocked INTEGER NOT NULL DEFAULT 0, -- 0 = blocked, 1 = unblocked
                        FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
                        FOREIGN KEY (po_id) REFERENCES users(id) ON DELETE CASCADE,
                        UNIQUE(room_id, po_id)
                    )
                `, (err) => {
                    if (err) {
                        console.error('[DB_INIT_ERROR] Failed to create_room_po_assignments_table:', err.message);
                        return reject(err);
                    }
                    console.log('[DB_INIT_SUCCESS] room_po_assignments_table verified/created.');
                });
                // --- [END NEW] ---

                // --- [NEW] Room Access Requests Table (For Admin/PO JIT Access) ---
                console.log('[DB_INIT] Attempting to create_room_access_requests_table...');
                db.run(`
                    CREATE TABLE IF NOT EXISTS room_access_requests (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        room_id INTEGER NOT NULL,
                        requester_id INTEGER NOT NULL,
                        owner_id INTEGER NOT NULL,
                        status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        expires_at DATETIME, -- NULL for no expiration
                        FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
                        FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
                        FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
                    )
                `, (err) => {
                    if (err) {
                        console.error('[DB_INIT_ERROR] Failed to create_room_access_requests_table:', err.message);
                        return reject(err);
                    }
                    console.log('[DB_INIT_SUCCESS] room_access_requests_table verified/created.');
                });
                // --- [END NEW] ---

                // --- [NEW] Room Session Logs Table ---
                console.log('[DB_INIT] Attempting to create_room_session_logs_table...');
                db.run(`
                    CREATE TABLE IF NOT EXISTS room_session_logs (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,
                        room_id INTEGER NOT NULL,
                        login_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                        logout_timestamp DATETIME,
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                        FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE
                    )
                `, (err) => {
                    if (err) {
                        console.error('[DB_INIT_ERROR] Failed to create_room_session_logs_table:', err.message);
                        return reject(err);
                    }
                    console.log('[DB_INIT_SUCCESS] room_session_logs_table verified/created.');
                });
                // --- [END NEW] ---

                // --- [MODIFIED] Documents Table (Added room_id) ---
                console.log('[DB_INIT] Attempting to create_documents_table...');
                db.run(`
                    CREATE TABLE IF NOT EXISTS documents (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,
                        room_id INTEGER,
                        name TEXT NOT NULL,
                        file_path TEXT NOT NULL,
                        uploaded_at TEXT NOT NULL,
                        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                        FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE SET NULL
                    )
                `, (err) => {
                    if (err) {
                         console.error('[DB_INIT_ERROR] Failed to create_documents_table:', err.message);
                        return reject(err);
                    }
                    console.log("[DB_INIT_SUCCESS] 'documents' table verified/created.");
                });
                // --- [END MODIFIED] ---

                // --- [MODIFIED] Conversations Table (Added room_id) ---
                console.log('[DB_INIT] Attempting to create_conversations_table...');
                db.run(`
                    CREATE TABLE IF NOT EXISTS conversations (
                        conversation_id TEXT PRIMARY KEY,
                        user_id INTEGER NOT NULL,
                        room_id INTEGER, 
                        title TEXT NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                        FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE
                    )
                `, (err) => {
                    if (err) {
                        console.error('[DB_INIT_ERROR] Failed to create_conversations_table:', err.message);
                    } else {
                        console.log('[DB_INIT_SUCCESS] conversations_table verified/created.');
                    }
                });
                // --- [END MODIFIED] ---


                // --- Chat History Table (and final migration checks) ---
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
                    } else {
                        console.log('[DB_INIT_SUCCESS] chat_history_table verified/created.');
                    }

                    // --- [NEW] Start DB Alter block ---
                    console.log('[DB_ALTER] Checking if "users" RBAC columns exist...');
                    db.all("PRAGMA table_info(users)", (userPragmaErr, userColumns) => {
                        if (userPragmaErr) {
                            console.error('[DB_ALTER_ERROR] Could not get table info for users:', userPragmaErr.message);
                            return reject(userPragmaErr);
                        }

                        const hasRole = userColumns.some(col => col.name === 'role');
                        const hasStatus = userColumns.some(col => col.name === 'status');
                        const hasProductId = userColumns.some(col => col.name === 'product_id');
                        const hasManagerId = userColumns.some(col => col.name === 'manager_id'); // [MODIFIED]

                        db.serialize(() => {
                            // --- Users Table Migration ---
                            if (!hasRole) {
                                console.log('[DB_ALTER] Adding "role" column to "users" table...');
                                db.run('ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT \'User\'', (alterErr) => {
                                    if (alterErr) return reject(alterErr);
                                    console.log('[DB_ALTER_SUCCESS] "role" column added.');
                                });
                            } else {
                                console.log('[DB_ALTER] "role" column already exists.');
                            }
                            if (!hasStatus) {
                                console.log('[DB_ALTER] Adding "status" column to "users" table...');
                                db.run('ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT \'pending_email_verification\'', (alterErr) => {
                                    if (alterErr) return reject(alterErr);
                                    console.log('[DB_ALTER_SUCCESS] "status" column added.');
                                });
                            } else {
                                console.log('[DB_ALTER] "status" column already. (Note: New users are `pending_email_verification` or `invited`)');
                            }
                            if (!hasProductId) {
                                console.log('[DB_ALTER] Adding "product_id" column to "users" table...');
                                db.run('ALTER TABLE users ADD COLUMN product_id INTEGER', (alterErr) => {
                                    if (alterErr) return reject(alterErr);
                                    console.log('[DB_ALTER_SUCCESS] "product_id" column added.');
                                });
                            } else {
                                console.log('[DB_ALTER] "product_id" column already exists.');
                            }
                            if (!hasManagerId) { // [MODIFIED]
                                console.log('[DB_ALTER] Adding "manager_id" column to "users" table...');
                                db.run('ALTER TABLE users ADD COLUMN manager_id INTEGER', (alterErr) => {
                                    if (alterErr) return reject(alterErr);
                                    console.log('[DB_ALTER_SUCCESS] "manager_id" column added.');
                                });
                            } else {
                                console.log('[DB_ALTER] "manager_id" column already exists.');
                            }
                            
                            // --- Conversations Table Migration ---
                            console.log('[DB_ALTER] Checking if "conversations.room_id" column exists...');
                            db.all("PRAGMA table_info(conversations)", (convoPragmaErr, convoColumns) => {
                                if (convoPragmaErr) return reject(convoPragmaErr);
                                const hasRoomId = convoColumns.some(col => col.name === 'room_id');
                                if (!hasRoomId) {
                                    console.log('[DB_ALTER] Adding "room_id" column to "conversations" table...');
                                    db.run('ALTER TABLE conversations ADD COLUMN room_id INTEGER', (alterErr) => {
                                        if (alterErr) return reject(alterErr);
                                        console.log('[DB_ALTER_SUCCESS] "room_id" column added.');
                                    });
                                } else {
                                    console.log('[DB_ALTER] "room_id" column already exists.');
                                }
                            });
                            
                            // --- Documents Table Migration ---
                            console.log('[DB_ALTER] Checking if "documents.room_id" column exists...');
                            db.all("PRAGMA table_info(documents)", (docPragmaErr, docColumns) => {
                                if (docPragmaErr) return reject(docPragmaErr);
                                const hasRoomId = docColumns.some(col => col.name === 'room_id');
                                if (!hasRoomId) {
                                    console.log('[DB_ALTER] Adding "room_id" column to "documents" table...');
                                    db.run('ALTER TABLE documents ADD COLUMN room_id INTEGER', (alterErr) => {
                                        if (alterErr) return reject(alterErr);
                                        console.log('[DB_ALTER_SUCCESS] "room_id" column added to documents.');
                                    });
                                } else {
                                    console.log('[DB_ALTER] "documents.room_id" column already exists.');
                                }
                            });

                            // --- Chat Rooms Table Migration ---
                            console.log('[DB_ALTER] Checking if "chat_rooms.client_id" and "creator_id" columns exist...');
                            db.all("PRAGMA table_info(chat_rooms)", (roomPragmaErr, roomColumns) => {
                                if (roomPragmaErr) return reject(roomPragmaErr);
                                const hasClientId = roomColumns.some(col => col.name === 'client_id');
                                const hasCreatorId = roomColumns.some(col => col.name === 'creator_id'); // [MODIFIED]
                                
                                if (!hasClientId) {
                                    console.log('[DB_ALTER] Adding "client_id" column to "chat_rooms" table...');
                                    db.run('ALTER TABLE chat_rooms ADD COLUMN client_id INTEGER', (alterErr) => {
                                        if (alterErr) return reject(alterErr);
                                        console.log('[DB_ALTER_SUCCESS] "client_id" column added to chat_rooms.');
                                    });
                                } else {
                                    console.log('[DB_ALTER] "chat_rooms.client_id" column already exists.');
                                }
                                if (!hasCreatorId) { // [MODIFIED]
                                    console.log('[DB_ALTER] Adding "creator_id" column to "chat_rooms" table...');
                                    db.run('ALTER TABLE chat_rooms ADD COLUMN creator_id INTEGER', (alterErr) => {
                                        if (alterErr) return reject(alterErr);
                                        console.log('[DB_ALTER_SUCCESS] "creator_id" column added to chat_rooms.');
                                    });
                                } else {
                                    console.log('[DB_ALTER] "chat_rooms.creator_id" column already exists.');
                                }
                            });

                            // --- [PHASE 1.B] Products Table Migration ---
                            console.log('[DB_ALTER] Checking if "products.status" column exists and matches new flow...');
                            db.all("PRAGMA table_info(products)", (prodPragmaErr, prodColumns) => {
                                if (prodPragmaErr) return reject(prodPragmaErr);
                                
                                const hasStatus = prodColumns.some(col => col.name === 'status');
                                
                                if (!hasStatus) {
                                    console.log('[DB_ALTER] [PHASE 1.B] Adding "status" column to "products" table with DEFAULT \'pending\'...');
                                    db.run('ALTER TABLE products ADD COLUMN status TEXT NOT NULL DEFAULT \'pending\'', (alterErr) => {
                                        if (alterErr) return reject(alterErr);
                                        console.log('[DB_ALTER_SUCCESS] [PHASE 1.B] "products.status" column added.');
                                    });
                                } else {
                                    console.log('[DB_ALTER] [PHASE 1.B] "products.status" column already exists.');
                                    // This is the migration: update old 'suspended' (un-approved) to 'pending' (new un-approved).
                                    console.log('[DB_ALTER] [PHASE 1.B] Updating old \'suspended\' product statuses to \'pending\' for new CTO approval flow...');
                                    db.run("UPDATE products SET status = 'pending' WHERE status = 'suspended'", function(updateErr) {
                                        if (updateErr) return reject(updateErr);
                                        if (this.changes > 0) {
                                            console.log(`[DB_ALTER_SUCCESS] [PHASE 1.B] Migrated ${this.changes} 'suspended' products to 'pending'.`);
                                        } else {
                                            console.log(`[DB_ALTER_SUCCESS] [PHASE 1.B] No 'suspended' products needed migration.`);
                                        }
                                    });
                                    
                                    // --- [PHASE 1.E] NEW MIGRATION ---
                                    // This fixes the causality flaw for existing data
                                    console.log('[DB_ALTER] [PHASE 1.E] Checking for confirmed products with invited POs...');
                                    db.run(`
                                        UPDATE products SET status = 'awaiting_po_activation' 
                                        WHERE status = 'confirmed' AND id IN (
                                            SELECT product_id FROM users WHERE role = 'ProductOwner' AND status = 'invited'
                                        )
                                    `, function(updateErr) {
                                        if (updateErr) return reject(updateErr);
                                        if (this.changes > 0) {
                                            console.log(`[DB_ALTER_SUCCESS] [PHASE 1.E] Migrated ${this.changes} 'confirmed' products to 'awaiting_po_activation'.`);
                                        } else {
                                            console.log(`[DB_ALTER_SUCCESS] [PHASE 1.E] No products needed 'awaiting_po_activation' migration.`);
                                        }
                                    });
                                    // --- [END PHASE 1.E] ---
                                }
                            });
                            // --- [END PHASE 1.B] ---

                            // --- Chat History Table Migration (FINAL STEP) ---
                            console.log('[DB_ALTER] Checking if chat_history.results column exists...');
                            db.all("PRAGMA table_info(chat_history)", (pragmaErr, columns) => {
                                if (pragmaErr) {
                                    console.error('[DB_ALTER_ERROR] Could not get table info for chat_history:', pragmaErr.message);
                                    return reject(pragmaErr); 
                                }
                                const resultsColumnExists = columns.some(col => col.name === 'results');
                                if (!resultsColumnExists) {
                                    console.log('[DB_ALTER] Adding "results" column to chat_history table...');
                                    db.run('ALTER TABLE chat_history ADD COLUMN results TEXT', (alterErr) => {
                                        if (alterErr) {
                                            return reject(alterErr);
                                        } else {
                                            console.log('[DB_ALTER_SUCCESS] "results" column added successfully.');
                                            console.log('[DB_INIT] Database initialization complete.');
                                            resolve(); 
                                        }
                                    });
                                } else {
                                    console.log('[DB_ALTER] "results" column already exists.');
                                    console.log('[DB_INIT] Database initialization complete.');
                                    resolve(); 
                                }
                            });
                        });
                    });
                });
            });
        });
    });
};

const getDb = () => {
    if (!db) throw new Error('Database not initialized!');
    return db;
};

// --- [MODIFIED] Added roomId parameter ---
const saveDocumentChunks = async (userId, documentName, filePath, chunksWithVectors, roomId = null) => {
    const db = getDb();
    return new Promise(async (resolve, reject) => {
        const uploadedAt = new Date().toISOString();
        
        // --- [MODIFIED] Added room_id to insert ---
        const sql = 'INSERT INTO documents (user_id, name, file_path, uploaded_at, room_id) VALUES (?, ?, ?, ?, ?)';
        const params = [userId, documentName, filePath, uploadedAt, roomId];
        
        console.log(`[DB_SAVE_DOC] Saving doc metadata with room_id: ${roomId}`);
        db.run(sql, params, async function(err) {
            if (err) return reject(err);
            const documentId = this.lastID;
            console.log(`[DB_SAVE_DOC] Document metadata saved to SQLite with ID: ${documentId} for user ID: ${userId}`);

            if (chunksWithVectors.length === 0) {
                 console.log(`[DB_SAVE_DOC] No chunks to save to Chroma for document ${documentId}.`);
                 return resolve({ documentId, chunks: 0 });
            }

            try {
                console.log(`[DB_SAVE_DOC] Getting or creating Chroma collection 'documents' for doc ${documentId}.`);
                const collection = await chromaClient.getOrCreateCollection({ name: "documents" });
                const ids = chunksWithVectors.map((_, i) => `user_${userId}_doc_${documentId}_chunk_${i}`);

                // --- [MODIFIED] Added roomId to metadata ---
                const metadatas = chunksWithVectors.map((chunk, i) => ({
                    userId: Number(userId),
                    documentId: Number(documentId),
                    roomId: Number(roomId), // Add roomId to Chroma metadata
                    chunkIndex: i,
                    documentName,
                    pageNumber: chunk.pageNumber
                }));
                // --- [END MODIFIED] ---

                console.log(`[DB_SAVE_DOC] Adding ${chunksWithVectors.length} chunks to Chroma for doc ${documentId}...`);
                await collection.add({
                    ids,
                    embeddings: chunksWithVectors.map(c => c.vector),
                    documents: chunksWithVectors.map(c => c.text),
                    metadatas
                });
                console.log(`[DB_SAVE_DOC_SUCCESS] Saved ${chunksWithVectors.length} chunks to ChromaDB for doc ${documentId}.`);
                resolve({ documentId, chunks: chunksWithVectors.length });
            } catch (chromaErr) {
                console.error(`[DB_SAVE_DOC_ERROR] Failed to save chunks to Chroma for doc ${documentId}:`, chromaErr);
                reject(chromaErr);
            }
        });
    });
};
// --- [END MODIFIED] ---


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


module.exports = {
    initializeDatabase,
    getDb,
    saveDocumentChunks,
    updateConversationTitle,
    chromaClient
};