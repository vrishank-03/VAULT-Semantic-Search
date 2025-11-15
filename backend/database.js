const sqlite3 = require('sqlite3').verbose();
const { ChromaClient } = require('chromadb');
require('dotenv').config();
const crypto = require('crypto');
const logger = require('./utils/logger'); // [WORKER_FIX] Use the logger

const DB_FILE = 'vault.db';
let db = null; // [WORKER_FIX] Initialize db as null

const chromaClient = new ChromaClient({
    path: `http://${process.env.CHROMA_HOST}:${process.env.CHROMA_PORT}`,
});

// [WORKER_FIX] getDb is now a singleton initializer
const getDb = () => {
    if (!db) {
        logger.info('getDb', 'Database connection not found. Creating new connection...');
        db = new sqlite3.Database(DB_FILE, (err) => {
            if (err) {
                logger.error('getDb', 'FATAL: Error opening database:', err.message);
                throw err; 
            }
            logger.info('getDb', 'Connected to the SQLite database.');
        });
        
        db.run('PRAGMA journal_mode = WAL;', (err) => {
            if (err) {
                logger.warn('getDb', 'Failed to enable WAL mode. Concurrency might be limited.', err.message);
            } else {
                logger.info('getDb', 'WAL (Write-Ahead Logging) mode enabled for SQLite.');
            }
        });
    }
    return db;
};

// [WORKER_FIX] initializeDatabase now *uses* getDb
const initializeDatabase = () => {
    return new Promise((resolve, reject) => {
        logger.info('DB_INIT', 'Ensuring database connection...');
        const dbInstance = getDb(); // This will create the connection
        
        logger.info('DB_INIT', 'Database connection ensured. Starting table serialization...');
        dbInstance.serialize(() => {
            // --- Users Table [MODIFIED] ---
            logger.info('DB_INIT', 'Attempting to create_users_table (with manager_id)...');
            dbInstance.run(`
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
                    manager_id INTEGER,
                    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
                    FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL
                )
            `, (err) => {
                if (err) {
                    logger.error('DB_INIT_ERROR', 'Failed to create_users_table:', err.message);
                    return reject(err);
                }
                logger.info('DB_INIT_SUCCESS', "'users' table verified/created.");
            });

            // --- Products Table [PHASE 1.B MODIFIED] ---
            logger.info('DB_INIT', 'Attempting to create_products_table...');
            dbInstance.run(`
                CREATE TABLE IF NOT EXISTS products (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    product_name TEXT NOT NULL UNIQUE,
                    product_owner_name TEXT NOT NULL,
                    product_owner_email TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'pending',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) {
                    logger.error('DB_INIT_ERROR', 'Failed to create_products_table:', err.message);
                    return reject(err); 
                } else {
                    logger.info('DB_INIT_SUCCESS', 'products_table verified/created.');
                }
            });
            
            // --- Clients Table (For categorization) ---
            logger.info('DB_INIT', 'Attempting to create_clients_table...');
            dbInstance.run(`
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
                    logger.error('DB_INIT_ERROR', 'Failed to create_clients_table:', err.message);
                    return reject(err);
                }
                logger.info('DB_INIT_SUCCESS', 'clients_table verified/created.');
            });

            // --- [BLOCK 5] NEW Admin/Client junction table ---
            logger.info('DB_INIT', '[BLOCK_5] Attempting to create_admin_client_assignments_table...');
            dbInstance.run(`
                CREATE TABLE IF NOT EXISTS admin_client_assignments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    admin_id INTEGER NOT NULL,
                    client_id INTEGER NOT NULL,
                    FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
                    UNIQUE(admin_id, client_id)
                )
            `, (err) => {
                if (err) {
                    logger.error('DB_INIT_ERROR', '[BLOCK_5] Failed to create_admin_client_assignments_table:', err.message);
                    return reject(err);
                }
                logger.info('DB_INIT_SUCCESS', '[BLOCK_5] admin_client_assignments_table verified/created.');
            });
            
            // --- [REMOVED] user_client_access table ---
            logger.info('DB_INIT', 'Dropping obsolete table user_client_access if it exists...');
            dbInstance.run(`DROP TABLE IF EXISTS user_client_access`, (err) => {
                if (err) {
                    logger.error('DB_INIT_ERROR', 'Failed to drop user_client_access_table:', err.message);
                    return reject(err);
                }
                logger.info('DB_INIT_SUCCESS', 'Obsolete table user_client_access removed.');
            });

            // --- [JIT_FIX] MODIFIED Chat Rooms Table ---
            logger.info('DB_INIT', 'Attempting to create_chat_rooms_table (with creator_id and room_code)...');
            dbInstance.run(`
                CREATE TABLE IF NOT EXISTS chat_rooms (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    product_id INTEGER NOT NULL,
                    client_id INTEGER,
                    creator_id INTEGER,
                    name TEXT NOT NULL,
                    color TEXT,
                    password_hash TEXT,
                    room_code TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
                    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
                    FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL
                )
            `, (err) => {
                if (err) {
                    logger.error('DB_INIT_ERROR', 'Failed to create_chat_rooms_table:', err.message);
                    return reject(err);
                } else {
                    logger.info('DB_INIT_SUCCESS', 'chat_rooms_table verified/created.');
                }
            });

            // --- [ROOM_FIX] NEW Many-to-Many Room/Client junction table ---
            logger.info('DB_INIT', '[ROOM_FIX] Attempting to create_room_client_assignments_table...');
            dbInstance.run(`
                CREATE TABLE IF NOT EXISTS room_client_assignments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    room_id INTEGER NOT NULL,
                    client_id INTEGER NOT NULL,
                    FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
                    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
                    UNIQUE(room_id, client_id)
                )
            `, (err) => {
                if (err) {
                    logger.error('DB_INIT_ERROR', '[ROOM_FIX] Failed to create_room_client_assignments_table:', err.message);
                    return reject(err);
                }
                logger.info('DB_INIT_SUCCESS', '[ROOM_FIX] room_client_assignments_table verified/created.');
            });

            // --- [NEW] Room Admin Assignments Table (For PO -> Admin room sharing) ---
            logger.info('DB_INIT', 'Attempting to create_room_admin_assignments_table...');
            dbInstance.run(`
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
                    logger.error('DB_INIT_ERROR', 'Failed to create_room_admin_assignments_table:', err.message);
                    return reject(err);
                }
                logger.info('DB_INIT_SUCCESS', 'room_admin_assignments_table verified/created.');
            });

            // --- [NEW] Room PO Assignments Table (For CTO -> PO room sharing) ---
            logger.info('DB_INIT', 'Attempting to create_room_po_assignments_table...');
            dbInstance.run(`
                CREATE TABLE IF NOT EXISTS room_po_assignments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    room_id INTEGER NOT NULL,
                    po_id INTEGER NOT NULL,
                    is_unblocked INTEGER NOT NULL DEFAULT 0,
                    FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
                    FOREIGN KEY (po_id) REFERENCES users(id) ON DELETE CASCADE,
                    UNIQUE(room_id, po_id)
                )
            `, (err) => {
                if (err) {
                    logger.error('DB_INIT_ERROR', 'Failed to create_room_po_assignments_table:', err.message);
                    return reject(err);
                }
                logger.info('DB_INIT_SUCCESS', 'room_po_assignments_table verified/created.');
            });

            // --- [BLOCK_2_NEW] Room User Assignments Table (For Admin -> User room sharing) ---
            logger.info('DB_INIT', '[BLOCK_2] Attempting to create_room_user_assignments_table...');
            dbInstance.run(`
                CREATE TABLE IF NOT EXISTS room_user_assignments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    room_id INTEGER NOT NULL,
                    user_id INTEGER NOT NULL,
                    FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    UNIQUE(room_id, user_id)
                )
            `, (err) => {
                if (err) {
                    logger.error('DB_INIT_ERROR', '[BLOCK_2] Failed to create_room_user_assignments_table:', err.message);
                    return reject(err);
                }
                logger.info('DB_INIT_SUCCESS', '[BLOCK_2] room_user_assignments_table verified/created.');
            });

            // --- [JIT_FIX] MODIFIED Room Access Requests Table (FOR ROOMS) ---
            logger.info('DB_INIT', 'Attempting to create_room_access_requests_table (with JIT duration columns)...');
            dbInstance.run(`
                CREATE TABLE IF NOT EXISTS room_access_requests (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    room_id INTEGER NOT NULL,
                    requester_id INTEGER NOT NULL,
                    owner_id INTEGER NOT NULL,
                    status TEXT NOT NULL DEFAULT 'pending',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    requested_duration_seconds INTEGER,
                    approved_duration_seconds INTEGER,
                    expires_at DATETIME,
                    FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
                    FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
                )
            `, (err) => {
                if (err) {
                    logger.error('DB_INIT_ERROR', 'Failed to create_room_access_requests_table:', err.message);
                    return reject(err);
                }
                logger.info('DB_INIT_SUCCESS', 'room_access_requests_table verified/created.');
            });

            // --- [BLOCK 6] NEW Peer-to-Peer JIT Tables ---
            logger.info('DB_INIT', '[BLOCK_6] Attempting to create_product_access_requests_table...');
            dbInstance.run(`
                CREATE TABLE IF NOT EXISTS product_access_requests (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    product_id INTEGER NOT NULL,
                    requester_id INTEGER NOT NULL,
                    owner_id INTEGER NOT NULL,
                    status TEXT NOT NULL DEFAULT 'pending',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    requested_duration_seconds INTEGER,
                    approved_duration_seconds INTEGER,
                    expires_at DATETIME,
                    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
                    FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
                )
            `, (err) => {
                if (err) {
                    logger.error('DB_INIT_ERROR', '[BLOCK_6] Failed to create_product_access_requests_table:', err.message);
                    return reject(err);
                }
                logger.info('DB_INIT_SUCCESS', '[BLOCK_6] product_access_requests_table verified/created.');
            });

            logger.info('DB_INIT', '[BLOCK_6] Attempting to create_client_access_requests_table...');
            dbInstance.run(`
                CREATE TABLE IF NOT EXISTS client_access_requests (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    client_id INTEGER NOT NULL,
                    requester_id INTEGER NOT NULL,
                    owner_id INTEGER NOT NULL,
                    status TEXT NOT NULL DEFAULT 'pending',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    requested_duration_seconds INTEGER,
                    approved_duration_seconds INTEGER,
                    expires_at DATETIME,
                    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
                    FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
                )
            `, (err) => {
                if (err) {
                    logger.error('DB_INIT_ERROR', '[BLOCK_6] Failed to create_client_access_requests_table:', err.message);
                    return reject(err);
                }
                logger.info('DB_INIT_SUCCESS', '[BLOCK_6] client_access_requests_table verified/created.');
            });

            // --- [NEW] Room Session Logs Table ---
            logger.info('DB_INIT', 'Attempting to create_room_session_logs_table...');
            dbInstance.run(`
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
                    logger.error('DB_INIT_ERROR', 'Failed to create_room_session_logs_table:', err.message);
                    return reject(err);
                }
                logger.info('DB_INIT_SUCCESS', 'room_session_logs_table verified/created.');
            });

            // --- [MODIFIED] Documents Table (Added room_id) ---
            logger.info('DB_INIT', 'Attempting to create_documents_table...');
            dbInstance.run(`
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
                    logger.error('DB_INIT_ERROR', 'Failed to create_documents_table:', err.message);
                    return reject(err);
                }
                logger.info('DB_INIT_SUCCESS', "'documents' table verified/created.");
            });

            // --- [MODIFIED] Conversations Table (Added room_id) ---
            logger.info('DB_INIT', 'Attempting to create_conversations_table...');
            dbInstance.run(`
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
                    logger.error('DB_INIT_ERROR', 'Failed to create_conversations_table:', err.message);
                } else {
                    logger.info('DB_INIT_SUCCESS', 'conversations_table verified/created.');
                }
            });


            // --- Chat History Table (and final migration checks) ---
            logger.info('DB_INIT', 'Attempting to create_chat_history_table...');
            dbInstance.run(`
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
                    logger.error('DB_INIT_ERROR', 'Failed to create_chat_history_table:', err.message);
                } else {
                    logger.info('DB_INIT_SUCCESS', 'chat_history_table verified/created.');
                }

                // --- [NEW] Start DB Alter block ---
                logger.info('DB_ALTER', 'Checking if "users" RBAC columns exist...');
                dbInstance.all("PRAGMA table_info(users)", (userPragmaErr, userColumns) => {
                    if (userPragmaErr) {
                        logger.error('DB_ALTER_ERROR', 'Could not get table info for users:', userPragmaErr.message);
                        return reject(userPragmaErr);
                    }

                    const hasRole = userColumns.some(col => col.name === 'role');
                    const hasStatus = userColumns.some(col => col.name === 'status');
                    const hasProductId = userColumns.some(col => col.name === 'product_id');
                    const hasManagerId = userColumns.some(col => col.name === 'manager_id'); 

                    dbInstance.serialize(() => {
                        // --- Users Table Migration ---
                        if (!hasRole) {
                            logger.info('DB_ALTER', 'Adding "role" column to "users" table...');
                            dbInstance.run('ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT \'User\'', (alterErr) => {
                                if (alterErr) return reject(alterErr);
                                logger.info('DB_ALTER_SUCCESS', '"role" column added.');
                            });
                        } else {
                            logger.info('DB_ALTER', '"role" column already exists.');
                        }
                        if (!hasStatus) {
                            logger.info('DB_ALTER', 'Adding "status" column to "users" table...');
                            dbInstance.run('ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT \'pending_email_verification\'', (alterErr) => {
                                if (alterErr) return reject(alterErr);
                                logger.info('DB_ALTER_SUCCESS', '"status" column added.');
                            });
                        } else {
                            logger.info('DB_ALTER', '"status" column already. (Note: New users are `pending_email_verification` or `invited`)');
                        }
                        if (!hasProductId) {
                            logger.info('DB_ALTER', 'Adding "product_id" column to "users" table...');
                            dbInstance.run('ALTER TABLE users ADD COLUMN product_id INTEGER', (alterErr) => {
                                if (alterErr) return reject(alterErr);
                                logger.info('DB_ALTER_SUCCESS', '"product_id" column added.');
                            });
                        } else {
                            logger.info('DB_ALTER', '"product_id" column already exists.');
                        }
                        if (!hasManagerId) { 
                            logger.info('DB_ALTER', 'Adding "manager_id" column to "users" table...');
                            dbInstance.run('ALTER TABLE users ADD COLUMN manager_id INTEGER', (alterErr) => {
                                if (alterErr) return reject(alterErr);
                                logger.info('DB_ALTER_SUCCESS', '"manager_id" column added.');
                            });
                        } else {
                            logger.info('DB_ALTER', '"manager_id" column already exists.');
                        }
                        
                        // --- Conversations Table Migration ---
                        logger.info('DB_ALTER', 'Checking if "conversations.room_id" column exists...');
                        dbInstance.all("PRAGMA table_info(conversations)", (convoPragmaErr, convoColumns) => {
                            if (convoPragmaErr) return reject(convoPragmaErr);
                            const hasRoomId = convoColumns.some(col => col.name === 'room_id');
                            if (!hasRoomId) {
                                logger.info('DB_ALTER', 'Adding "room_id" column to "conversations" table...');
                                dbInstance.run('ALTER TABLE conversations ADD COLUMN room_id INTEGER', (alterErr) => {
                                    if (alterErr) return reject(alterErr);
                                    logger.info('DB_ALTER_SUCCESS', '"room_id" column added.');
                                });
                            } else {
                                logger.info('DB_ALTER', '"room_id" column already exists.');
                            }
                        });
                        
                        // --- Documents Table Migration ---
                        logger.info('DB_ALTER', 'Checking if "documents.room_id" column exists...');
                        dbInstance.all("PRAGMA table_info(documents)", (docPragmaErr, docColumns) => {
                            if (docPragmaErr) return reject(docPragmaErr);
                            const hasRoomId = docColumns.some(col => col.name === 'room_id');
                            if (!hasRoomId) {
                                logger.info('DB_ALTER', 'Adding "room_id" column to "documents" table...');
                                dbInstance.run('ALTER TABLE documents ADD COLUMN room_id INTEGER', (alterErr) => {
                                    if (alterErr) return reject(alterErr);
                                    logger.info('DB_ALTER_SUCCESS', '"room_id" column added to documents.');
                                });
                            } else {
                                logger.info('DB_ALTER', '"documents.room_id" column already exists.');
                            }
                        });

                        // --- [JIT_FIX] Chat Rooms Table Migration (ADD room_code) ---
                        logger.info('DB_ALTER', 'Checking if "chat_rooms.client_id", "creator_id", and "room_code" columns exist...');
                        dbInstance.all("PRAGMA table_info(chat_rooms)", (roomPragmaErr, roomColumns) => {
                            if (roomPragmaErr) return reject(roomPragmaErr);
                            const hasClientId = roomColumns.some(col => col.name === 'client_id');
                            const hasCreatorId = roomColumns.some(col => col.name === 'creator_id');
                            const hasRoomCode = roomColumns.some(col => col.name === 'room_code'); 
                            
                            if (!hasClientId) {
                                logger.info('DB_ALTER', 'Adding "client_id" column to "chat_rooms" table...');
                                dbInstance.run('ALTER TABLE chat_rooms ADD COLUMN client_id INTEGER', (alterErr) => {
                                    if (alterErr) return reject(alterErr);
                                    logger.info('DB_ALTER_SUCCESS', '"client_id" column added to chat_rooms.');
                                });
                            } else {
                                logger.info('DB_ALTER', '"chat_rooms.client_id" column already exists.');
                            }
                            if (!hasCreatorId) { 
                                logger.info('DB_ALTER', 'Adding "creator_id" column to "chat_rooms" table...');
                                dbInstance.run('ALTER TABLE chat_rooms ADD COLUMN creator_id INTEGER', (alterErr) => {
                                    if (alterErr) return reject(alterErr);
                                    logger.info('DB_ALTER_SUCCESS', '"creator_id" column added to chat_rooms.');
                                });
                            } else {
                                logger.info('DB_ALTER', '"chat_rooms.creator_id" column already exists.');
                            }
                            
                            if (!hasRoomCode) {
                                logger.info('DB_ALTER', '[JIT_FIX] Adding "room_code" column to "chat_rooms" table...');
                                dbInstance.run('ALTER TABLE chat_rooms ADD COLUMN room_code TEXT', (alterErr) => {
                                    if (alterErr) return reject(alterErr);
                                    logger.info('DB_ALTER_SUCCESS', '[JIT_FIX] "room_code" column added. Now backfilling...');
                                    backfillRoomCodes(); 
                                });
                            } else {
                                logger.info('DB_ALTER', '[JIT_FIX] "room_code" column already exists. Checking for NULLs...');
                                backfillRoomCodes(); 
                            }
                            
                            dbInstance.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_room_code_unique ON chat_rooms (room_code);', (indexErr) => {
                                if (indexErr) logger.error('DB_ALTER_ERROR', '[JIT_FIX] Failed to create unique index on room_code:', indexErr.message);
                                else logger.info('DB_ALTER', '[JIT_FIX] Unique index on room_code verified.');
                            });
                        });

                        // --- [PHASE 1.B] Products Table Migration ---
                        logger.info('DB_ALTER', 'Checking if "products.status" column exists and matches new flow...');
                        dbInstance.all("PRAGMA table_info(products)", (prodPragmaErr, prodColumns) => {
                            if (prodPragmaErr) return reject(prodPragmaErr);
                            
                            const hasStatus = prodColumns.some(col => col.name === 'status');
                            
                            if (!hasStatus) {
                                logger.info('DB_ALTER', '[PHASE 1.B] Adding "status" column to "products" table with DEFAULT \'pending\'...');
                                dbInstance.run('ALTER TABLE products ADD COLUMN status TEXT NOT NULL DEFAULT \'pending\'', (alterErr) => {
                                    if (alterErr) return reject(alterErr);
                                    logger.info('DB_ALTER_SUCCESS', '[PHASE 1.B] "products.status" column added.');
                                });
                            } else {
                                logger.info('DB_ALTER', '[PHASE 1.B] "products.status" column already exists.');
                                logger.info('DB_ALTER', '[PHASE 1.B] Updating old \'suspended\' product statuses to \'pending\' for new CTO approval flow...');
                                dbInstance.run("UPDATE products SET status = 'pending' WHERE status = 'suspended'", function(updateErr) {
                                    if (updateErr) return reject(updateErr);
                                    if (this.changes > 0) {
                                        logger.info('DB_ALTER_SUCCESS', `[PHASE 1.B] Migrated ${this.changes} 'suspended' products to 'pending'.`);
                                    } else {
                                        logger.info('DB_ALTER_SUCCESS', `[PHASE 1.B] No 'suspended' products needed migration.`);
                                    }
                                });
                                
                                // --- [PHASE 1.E] NEW MIGRATION ---
                                logger.info('DB_ALTER', '[PHASE 1.E] Checking for confirmed products with invited POs...');
                                dbInstance.run(`
                                    UPDATE products SET status = 'awaiting_po_activation' 
                                    WHERE status = 'confirmed' AND id IN (
                                        SELECT product_id FROM users WHERE role = 'ProductOwner' AND status = 'invited'
                                    )
                                `, function(updateErr) {
                                    if (updateErr) return reject(updateErr);
                                    if (this.changes > 0) {
                                        logger.info('DB_ALTER_SUCCESS', `[PHASE 1.E] Migrated ${this.changes} 'confirmed' products to 'awaiting_po_activation'.`);
                                    } else {
                                        logger.info('DB_ALTER_SUCCESS', `[PHASE 1.E] No products needed 'awaiting_po_activation' migration.`);
                                    }
                                });
                            }
                        });

                        // --- [ROOM_FIX] Run new migration for room_client_assignments ---
                        runRoomClientMigration(); 

                        // --- [JIT_FIX] Chat History & Room Access Requests Migration (FINAL STEP) ---
                        logger.info('DB_ALTER', 'Checking if chat_history.results column exists...');
                        dbInstance.all("PRAGMA table_info(chat_history)", (pragmaErr, columns) => {
                            if (pragmaErr) {
                                logger.error('DB_ALTER_ERROR', 'Could not get table info for chat_history:', pragmaErr.message);
                                return reject(pragmaErr); 
                            }
                            const resultsColumnExists = columns.some(col => col.name === 'results');
                            if (!resultsColumnExists) {
                                logger.info('DB_ALTER', 'Adding "results" column to chat_history table...');
                                dbInstance.run('ALTER TABLE chat_history ADD COLUMN results TEXT', (alterErr) => {
                                    if (alterErr) return reject(alterErr);
                                    else logger.info('DB_ALTER_SUCCESS', '"results" column added successfully.');
                                    
                                    runRoomAccessRequestsMigration(resolve, reject);
                                });
                            } else {
                                logger.info('DB_ALTER', '"results" column already exists.');
                                runRoomAccessRequestsMigration(resolve, reject);
                            }
                        });
                    });
                });
            });
        });
    });
};



// --- [JIT_FIX] NEW HELPER FUNCTION FOR MIGRATION ---
const generateUniqueCode = (existingCodesSet) => {
    let code;
    let isUnique = false;
    while (!isUnique) {
        code = Math.floor(100000 + Math.random() * 900000).toString();
        if (!existingCodesSet.has(code)) {
            isUnique = true;
            existingCodesSet.add(code); 
        }
    }
    return code;
};


const backfillRoomCodes = () => {
    const dbInstance = getDb();
    logger.info('JIT_MIGRATE', 'Checking for existing room codes...');
    dbInstance.all('SELECT room_code FROM chat_rooms WHERE room_code IS NOT NULL', (err, existingRows) => {
        if (err) {
            logger.error('JIT_MIGRATE_ERROR', 'Could not query existing room codes:', err.message);
            return;
        }
        
        const existingCodes = new Set(existingRows.map(r => r.room_code));
        logger.info('JIT_MIGRATE', `Found ${existingCodes.size} existing codes.`);

        dbInstance.all('SELECT id FROM chat_rooms WHERE room_code IS NULL', (err, roomsToUpdate) => {
            if (err) {
                logger.error('JIT_MIGRATE_ERROR', 'Could not find rooms to backfill:', err.message);
                return;
            }
            
            if (roomsToUpdate.length === 0) {
                logger.info('JIT_MIGRATE', 'No rooms need a code backfill.');
                return;
            }

            logger.info('JIT_MIGRATE', `Backfilling ${roomsToUpdate.length} rooms with new codes...`);
            let completed = 0;
            const stmt = dbInstance.prepare('UPDATE chat_rooms SET room_code = ? WHERE id = ?', (prepErr) => {
                if (prepErr) {
                    logger.error('JIT_MIGRATE_ERROR', 'Failed to prepare statement:', prepErr.message);
                    return;
                }
                roomsToUpdate.forEach((room) => {
                    const newCode = generateUniqueCode(existingCodes);
                    stmt.run(newCode, room.id, (updateErr) => {
                        if (updateErr) {
                            logger.error('JIT_MIGRATE_ERROR', `Failed to update room ${room.id} with code ${newCode}:`, updateErr.message);
                        }
                        completed++;
                        if (completed === roomsToUpdate.length) {
                            logger.info('JIT_MIGRATE_SUCCESS', `Finished backfilling ${completed} rooms.`);
                            stmt.finalize();
                        }
                    });
                });
            });
        });
    });
};


const runRoomAccessRequestsMigration = (resolve, reject) => {
    const dbInstance = getDb();
    logger.info('DB_ALTER', '[JIT_FIX] Checking if "room_access_requests" JIT columns exist...');
    dbInstance.all("PRAGMA table_info(room_access_requests)", (pragmaErr, columns) => {
        if (pragmaErr) {
            logger.error('DB_ALTER_ERROR', '[JIT_FIX] Could not get table info for room_access_requests:', pragmaErr.message);
            return reject(pragmaErr);
        }
        
        const hasReqDuration = columns.some(col => col.name === 'requested_duration_seconds');
        const hasAppDuration = columns.some(col => col.name === 'approved_duration_seconds');

        const addReqDuration = (callback) => {
            if (!hasReqDuration) {
                logger.info('DB_ALTER', '[JIT_FIX] Adding "requested_duration_seconds" column...');
                dbInstance.run('ALTER TABLE room_access_requests ADD COLUMN requested_duration_seconds INTEGER', (alterErr) => {
                    if (alterErr) return reject(alterErr);
                    logger.info('DB_ALTER_SUCCESS', '[JIT_FIX] "requested_duration_seconds" column added.');
                    callback();
                });
            } else {
                logger.info('DB_ALTER', '[JIT_FIX] "requested_duration_seconds" column already exists.');
                callback();
            }
        };

        const addAppDuration = (callback) => {
            if (!hasAppDuration) {
                logger.info('DB_ALTER', '[JIT_FIX] Adding "approved_duration_seconds" column...');
                dbInstance.run('ALTER TABLE room_access_requests ADD COLUMN approved_duration_seconds INTEGER', (alterErr) => {
                    if (alterErr) return reject(alterErr);
                    logger.info('DB_ALTER_SUCCESS', '[JIT_FIX] "approved_duration_seconds" column added.');
                    callback();
                });
            } else {
                logger.info('DB_ALTER', '[JIT_FIX] "approved_duration_seconds" column already exists.');
                callback();
            }
        };

        addReqDuration(() => {
            addAppDuration(() => {
                logger.info('DB_INIT', 'Database initialization complete.');
                resolve(); 
            });
        });
    });
};


const runRoomClientMigration = () => {
    const dbInstance = getDb();
    logger.info('ROOM_FIX_MIGRATE', 'Checking if chat_rooms.client_id column exists for migration...');
    dbInstance.all("PRAGMA table_info(chat_rooms)", (pragmaErr, columns) => {
        if (pragmaErr) {
            logger.error('ROOM_FIX_MIGRATE_ERROR', 'Could not get table info for chat_rooms:', pragmaErr.message);
            return;
        }

        const hasClientId = columns.some(col => col.name === 'client_id');
        if (!hasClientId) {
            logger.info('ROOM_FIX_MIGRATE', 'chat_rooms.client_id column not found. Skipping migration.');
            return;
        }

        logger.info('ROOM_FIX_MIGRATE', 'Found client_id column. Finding rooms to migrate...');
        dbInstance.all("SELECT id, client_id FROM chat_rooms WHERE client_id IS NOT NULL", (err, rooms) => {
            if (err) {
                logger.error('ROOM_FIX_MAGRATE_ERROR', 'Could not query rooms for migration:', err.message);
                return;
            }
            if (rooms.length === 0) {
                logger.info('ROOM_FIX_MIGRATE', 'No rooms found with old client_id. No migration needed.');
                return;
            }

            logger.info('ROOM_FIX_MIGRATE', `Found ${rooms.length} rooms to migrate to new junction table...`);
            let completed = 0;
            const stmt = dbInstance.prepare('INSERT OR IGNORE INTO room_client_assignments (room_id, client_id) VALUES (?, ?)', (prepErr) => {
                if (prepErr) {
                    logger.error('ROOM_FIX_MIGRATE_ERROR', 'Failed to prepare migration statement:', prepErr.message);
                    return;
                }
                rooms.forEach((room) => {
                    stmt.run(room.id, room.client_id, (runErr) => {
                        if (runErr) {
                            logger.error('ROOM_FIX_MIGRATE_ERROR', `Failed to migrate room ${room.id}:`, runErr.message);
                        }
                        completed++;
                        if (completed === rooms.length) {
                            logger.info('ROOM_FIX_MIGRATE_SUCCESS', `Finished migrating ${completed} room-client assignments.`);
                            stmt.finalize();
                        }
                    });
                });
            });
        });
    });
};

// [GHOST_BUG_FIX] NEW: Extracted async Chroma operations
const saveToChroma = async (documentId, userId, roomId, documentName, chunksWithVectors) => {
    logger.info('DB_SAVE_CHROMA', `Getting or creating Chroma collection 'documents' for doc ${documentId}.`);
    const collection = await chromaClient.getOrCreateCollection({ name: "documents" });
    
    const ids = chunksWithVectors.map((_, i) => `user_${userId}_doc_${documentId}_chunk_${i}`);
    const metadatas = chunksWithVectors.map((chunk, i) => ({
        userId: Number(userId),
        documentId: Number(documentId),
        roomId: Number(roomId), 
        chunkIndex: i,
        documentName,
        // pageNumber now comes from the parser.py payload
        pageNumber: chunk.page_number 
    }));

    logger.info('DB_SAVE_CHROMA', `Adding ${chunksWithVectors.length} chunks to Chroma for doc ${documentId}...`);
    await collection.add({
        ids,
        embeddings: chunksWithVectors.map(c => c.vector),
        documents: chunksWithVectors.map(c => c.text),
        metadatas
    });
    
    logger.info('DB_SAVE_CHROMA_SUCCESS', `Saved ${chunksWithVectors.length} chunks to ChromaDB for doc ${documentId}.`);
};


// [GHOST_BUG_FIX] This function is now refactored to be transactional.
const saveDocumentChunks = async (userId, documentName, filePath, chunksWithVectors, roomId = null) => {
    const db = getDb();
    
    // Step 1: Save to SQLite (Promisified)
    logger.info('DB_SAVE_DOC', `Saving doc metadata with room_id: ${roomId}`);
    const documentId = await new Promise((resolve, reject) => {
        const uploadedAt = new Date().toISOString();
        const sql = 'INSERT INTO documents (user_id, name, file_path, uploaded_at, room_id) VALUES (?, ?, ?, ?, ?)';
        const params = [userId, documentName, filePath, uploadedAt, roomId];
        
        db.run(sql, params, function(err) {
            if (err) {
                logger.error('DB_SAVE_DOC', 'Failed to save document metadata to SQLite', err);
                reject(err);
            } else {
                resolve(this.lastID);
            }
        });
    });
    
    logger.info('DB_SAVE_DOC', `Document metadata saved to SQLite with ID: ${documentId} for user ID: ${userId}`);
    
    // Step 2: If no chunks, we're done
    if (chunksWithVectors.length === 0) {
        logger.warn('DB_SAVE_DOC', `No chunks to save to Chroma for document ${documentId}.`);
        return { documentId, chunks: 0 };
    }
    
    // Step 3: Save to ChromaDB (with Transactional Rollback)
    try {
        await saveToChroma(documentId, userId, roomId, documentName, chunksWithVectors);
        return { documentId, chunks: chunksWithVectors.length };
    } catch (chromaErr) {
        // Rollback on Chroma failure
        logger.error('DB_SAVE_DOC_ERROR', `Failed to save chunks to Chroma for doc ${documentId}:`, chromaErr);
        
        try {
            await deleteDocumentById(documentId);
            logger.info('DB_SAVE_DOC_ROLLBACK', `Rolled back SQLite entry for doc ID: ${documentId}`);
        } catch (rollbackErr) {
            logger.error('DB_SAVE_DOC_ROLLBACK_FATAL', `CRITICAL: Chroma save failed AND SQLite rollback failed for doc ID: ${documentId}.`, rollbackErr);
        }
        
        throw chromaErr; // Re-throw the original error for the worker
    }
};


const updateConversationTitle = (conversationId, newTitle) => {
    return new Promise((resolve, reject) => {
        logger.info('DB_UPDATE_TITLE', `Attempting to update title for conversation ${conversationId} to "${newTitle}"`);
        const db = getDb();
        const sql = `UPDATE conversations SET title = ? WHERE conversation_id = ?`;
        logger.info('DB_UPDATE_TITLE_DB', `Executing SQL: ${sql} with params: [${newTitle}, ${conversationId}]`);

        db.run(sql, [newTitle, conversationId], function(err) {
            if (err) {
                logger.error('DB_UPDATE_TITLE_ERROR', 'Failed to update conversation title:', err.message);
                reject(err);
            } else if (this.changes === 0) {
                 logger.warn('DB_UPDATE_TITLE_WARN', `No conversation found with ID ${conversationId} to update title.`);
                 resolve({ changes: 0 });
            } else {
                logger.info('DB_UPDATE_TITLE_SUCCESS', `Successfully updated title for conversation ${conversationId}. Rows affected: ${this.changes}`);
                resolve({ changes: this.changes });
            }
        });
    });
};


const deleteDocumentById = (docId) => {
    return new Promise((resolve, reject) => {
        logger.info('DB_DELETE_DOC', `Attempting to delete doc ${docId} from SQLite.`);
        const db = getDb();
        const sql = `DELETE FROM documents WHERE id = ?`;

        db.run(sql, [docId], function(err) {
            if (err) {
                logger.error('DB_DELETE_DOC_ERROR', `Failed to delete doc ${docId} from SQLite:`, err.message);
                return reject(err);
            }
            if (this.changes === 0) {
                logger.warn('DB_DELETE_DOC_WARN', `No document found with ID ${docId} to delete from SQLite.`);
            } else {
                logger.info('DB_DELETE_DOC_SUCCESS', `Successfully deleted doc ${docId} from SQLite. Rows: ${this.changes}`);
            }
            resolve({ changes: this.changes });
        });
    });
};


module.exports = {
    initializeDatabase,
    getDb,
    saveDocumentChunks,
    updateConversationTitle,
    chromaClient,
    deleteDocumentById 
};