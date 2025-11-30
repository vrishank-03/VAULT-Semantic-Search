// backend/database.js - ENTERPRISE SANITIZATION ADDED

const { Pool } = require('pg'); 
require('dotenv').config();
const crypto = require('crypto');
const logger = require('./utils/logger'); 

let pool = null; 

// --- CONFIGURATION ---
const PG_CONFIG = {
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    database: process.env.PG_DATABASE,
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT || 5432,
    max: 20, 
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
};

// --- CORE ROLES ---
const CORE_ROLES = [
    { key: 'CTO', default_display: 'CTO (Super Admin)', level: 1, manager_key: null },
    { key: 'PO', default_display: 'Product Owner', level: 2, manager_key: 'CTO' },
    { key: 'Admin', default_display: 'Administrator', level: 3, manager_key: 'PO' },
    { key: 'User', default_display: 'Standard User', level: 4, manager_key: 'Admin' },
];

const getPool = () => {
    if (!pool) {
        logger.info('getPool', 'Initializing PostgreSQL connection pool...');
        try {
            pool = new Pool(PG_CONFIG);
            pool.on('error', (err) => {
                logger.error('PG_POOL_ERROR', 'Unexpected error on idle client:', err.message);
            });
        } catch (err) {
            logger.error('getPool', 'FATAL: Error creating pool:', err.message);
            throw err;
        }
    }
    return pool;
};

const query = (text, params) => {
    const dbPool = getPool();
    const safeParams = params?.map(p => {
        if (typeof p === 'string' && p.length > 100) return `${p.substring(0, 50)}...`;
        if (Array.isArray(p)) return `[Array(${p.length})]`;
        return p;
    });
    logger.debug('PG_QUERY', `Executing: ${text.substring(0, 100)}...`, { params: safeParams });
    return dbPool.query(text, params);
};

// --- TRANSACTION UTILITY ---
const executeTransaction = async (callback) => {
    const client = await getPool().connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('TRANSACTION_FAILED', 'Rollback due to error:', error.message);
        throw error;
    } finally {
        client.release();
    }
};

// --- UTILS ---
const generateRoomCode = () => crypto.randomBytes(3).toString('hex').toUpperCase(); 

const backfillRoomCodes = async () => {
    logger.info('DB_ALTER', '[Backfill] Checking for NULL room_codes...');
    try {
        const client = await getPool().connect();
        const res = await client.query('SELECT id FROM chat_rooms WHERE room_code IS NULL');
        if (res.rows.length > 0) {
             logger.info('DB_ALTER', `Backfilling ${res.rows.length} rooms...`);
             for (const row of res.rows) {
                let unique = false;
                let newCode;
                while (!unique) {
                    newCode = generateRoomCode();
                    const check = await client.query('SELECT 1 FROM chat_rooms WHERE room_code = $1', [newCode]);
                    if (check.rowCount === 0) unique = true;
                }
                await client.query('UPDATE chat_rooms SET room_code = $1 WHERE id = $2', [newCode, row.id]);
             }
             logger.info('DB_ALTER_SUCCESS', `Backfill complete.`);
        }
        client.release();
    } catch (error) {
        logger.error('DB_ALTER_ERROR', 'Backfill failed:', error.message);
    }
};

const seedRoleDefinitions = async (client) => {
    logger.info('DB_INIT', 'Seeding roles...');
    for (const role of CORE_ROLES) {
        const queryText = `
            INSERT INTO role_definitions (role_key, display_name, hierarchy_level, default_manager_key)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (role_key) DO UPDATE 
            SET hierarchy_level = EXCLUDED.hierarchy_level, 
                default_manager_key = EXCLUDED.default_manager_key;
        `;
        await client.query(queryText, [role.key, role.default_display, role.level, role.manager_key]);
    }
};

// --- INITIALIZATION ---
const initializeDatabase = async () => {
    const dbPool = getPool(); 
    const client = await dbPool.connect();
    try {
        logger.info('DB_INIT', 'Starting Schema Initialization...');
        
        await client.query('CREATE EXTENSION IF NOT EXISTS vector'); 
        await client.query('CREATE EXTENSION IF NOT EXISTS pg_trgm'); 
        
        const createTable = async (name, schema) => {
            await client.query(schema);
            logger.info('DB_INIT', `Table '${name}' verified.`);
        };
        
        // 1. Roles
        await createTable('role_definitions', `
            CREATE TABLE IF NOT EXISTS role_definitions (
                role_key TEXT PRIMARY KEY,               
                display_name TEXT NOT NULL UNIQUE,      
                hierarchy_level INTEGER NOT NULL UNIQUE, 
                default_manager_key TEXT                 
            )
        `);
        await seedRoleDefinitions(client);

        // 2. Products
        await createTable('products', `
            CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                product_name TEXT NOT NULL UNIQUE,
                product_owner_name TEXT NOT NULL,
                product_owner_email TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 3. Users
        await createTable('users', `
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                is_email_verified BOOLEAN DEFAULT FALSE,
                email_verification_token TEXT,
                password_reset_token TEXT,
                password_reset_expires BIGINT,
                picture_url TEXT,
                role TEXT NOT NULL DEFAULT 'User' REFERENCES role_definitions(role_key), 
                status TEXT NOT NULL DEFAULT 'pending_email_verification',
                product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
                manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL
            )
        `);
        
        // Role Migration
        logger.info('DB_MIGRATE', 'Checking for legacy role names...');
        for (const role of CORE_ROLES) {
            try {
                await client.query(`UPDATE users SET role = $1 WHERE role = $2`, [role.key, role.default_display]);
            } catch (migErr) {}
        }
        
        // 4. Clients
        await createTable('clients', `
            CREATE TABLE IF NOT EXISTS clients (
                id SERIAL PRIMARY KEY,
                product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(product_id, name)
            )
        `);

        // 5. Assignments
        await createTable('admin_client_assignments', `
            CREATE TABLE IF NOT EXISTS admin_client_assignments (
                id SERIAL PRIMARY KEY,
                admin_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
                UNIQUE(admin_id, client_id)
            )
        `);
        
        // 6. Chat Rooms
        await createTable('chat_rooms', `
            CREATE TABLE IF NOT EXISTS chat_rooms (
                id SERIAL PRIMARY KEY,
                product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
                creator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                name TEXT NOT NULL,
                color TEXT,
                password_hash TEXT,
                room_code TEXT UNIQUE, 
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // 7-10. Room Assignments
        const assignmentTables = ['room_client_assignments', 'room_admin_assignments', 'room_po_assignments', 'room_user_assignments'];
        const idCols = ['client_id', 'admin_id', 'po_id', 'user_id'];
        const refs = ['clients(id)', 'users(id)', 'users(id)', 'users(id)'];

        for (let i = 0; i < assignmentTables.length; i++) {
             await createTable(assignmentTables[i], `
                CREATE TABLE IF NOT EXISTS ${assignmentTables[i]} (
                    id SERIAL PRIMARY KEY,
                    room_id INTEGER NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
                    ${idCols[i]} INTEGER NOT NULL REFERENCES ${refs[i]} ON DELETE CASCADE,
                    ${assignmentTables[i] === 'room_po_assignments' ? 'is_unblocked BOOLEAN DEFAULT FALSE,' : ''}
                    UNIQUE(room_id, ${idCols[i]})
                )
            `);
        }

        // 11. Room Access Requests (Room JIT)
        await createTable('room_access_requests', `
            CREATE TABLE IF NOT EXISTS room_access_requests (
                id SERIAL PRIMARY KEY,
                room_id INTEGER NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
                requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                status TEXT NOT NULL DEFAULT 'pending',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                requested_duration_seconds INTEGER,
                approved_duration_seconds INTEGER,
                expires_at TIMESTAMP WITH TIME ZONE
            )
        `);

        // 12. Product Access Requests (Peer JIT)
        await createTable('product_access_requests', `
            CREATE TABLE IF NOT EXISTS product_access_requests (
                id SERIAL PRIMARY KEY,
                product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                status TEXT NOT NULL DEFAULT 'pending',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                requested_duration_seconds INTEGER,
                approved_duration_seconds INTEGER,
                expires_at TIMESTAMP WITH TIME ZONE
            )
        `);

        // 13. Client Access Requests (Peer JIT)
        await createTable('client_access_requests', `
            CREATE TABLE IF NOT EXISTS client_access_requests (
                id SERIAL PRIMARY KEY,
                client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
                requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                status TEXT NOT NULL DEFAULT 'pending',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                requested_duration_seconds INTEGER,
                approved_duration_seconds INTEGER,
                expires_at TIMESTAMP WITH TIME ZONE
            )
        `);

        // 14. Room Session Logs (Audit)
        await createTable('room_session_logs', `
            CREATE TABLE IF NOT EXISTS room_session_logs (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                room_id INTEGER NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
                login_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                logout_timestamp TIMESTAMP WITH TIME ZONE
            )
        `);

        // 15. Documents
        await createTable('documents', `
            CREATE TABLE IF NOT EXISTS documents (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
                room_id INTEGER REFERENCES chat_rooms(id) ON DELETE SET NULL,
                name TEXT NOT NULL,
                file_path TEXT NOT NULL,
                uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // 16. Document Chunks (pgvector)
        await createTable('document_chunks', `
            CREATE TABLE IF NOT EXISTS document_chunks (
                id SERIAL PRIMARY KEY,
                document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
                room_id INTEGER NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
                chunk_id TEXT NOT NULL, 
                content TEXT NOT NULL,
                page_number INTEGER,
                embedding VECTOR(${process.env.EMBEDDING_DIMENSION || 384}), 
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(document_id, chunk_id)
            )
        `);
        
        // 17. Conversations
        await createTable('conversations', `
            CREATE TABLE IF NOT EXISTS conversations (
                conversation_id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                room_id INTEGER REFERENCES chat_rooms(id) ON DELETE CASCADE, 
                title TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 18. Chat History (pg_trgm)
        await createTable('chat_history', `
            CREATE TABLE IF NOT EXISTS chat_history (
                message_id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL REFERENCES conversations(conversation_id) ON DELETE CASCADE,
                sender TEXT NOT NULL, 
                message TEXT NOT NULL, 
                results JSONB, 
                timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // 19. Indexes
        await client.query(`CREATE INDEX IF NOT EXISTS trgm_idx_chat_message ON chat_history USING GIN (message gin_trgm_ops)`);

        await backfillRoomCodes(); 
        logger.info('DB_INIT_FINAL', 'All PostgreSQL schemas and extensions verified.');

    } catch (err) {
        logger.error('DB_INIT_FATAL', 'Schema Initialization Failed:', err.message);
        throw err;
    } finally {
        client.release();
    }
};

// --- ATOMIC SAVE FUNCTION (ENTERPRISE SANITIZATION) ---
async function saveDocumentChunks(userId, originalName, filePath, chunksWithVectors, roomId) {
    logger.info('saveDocumentChunks', `[PG_TX_START] Atomic save for: ${originalName}`);
    
    // [SANITIZATION] Filter out chunks that are null, undefined, empty strings, or just whitespace.
    // This prevents the "null value in column content" error from PostgreSQL.
    const chunksToInsert = chunksWithVectors.filter(c => {
        const hasVector = c.vector && c.vector.length > 0;
        const hasContent = c.content && typeof c.content === 'string' && c.content.trim().length > 0;
        
        if (!hasContent && hasVector) {
            logger.warn('saveDocumentChunks', `[SANITIZATION] Dropping chunk ${c.id} (Valid Vector, NULL/Empty Content).`);
        }
        
        return hasVector && hasContent;
    });
    
    logger.info('saveDocumentChunks', `[SANITIZATION] ${chunksWithVectors.length} chunks in -> ${chunksToInsert.length} valid chunks out.`);

    return executeTransaction(async (client) => {
        const docRes = await client.query(
            `INSERT INTO documents (user_id, room_id, name, file_path) VALUES ($1, $2, $3, $4) RETURNING id`,
            [userId, roomId, originalName, filePath]
        );
        const documentId = docRes.rows[0].id;
        
        if (chunksToInsert.length > 0) {
            const chunkValues = [];
            const chunkPlaceholders = [];
            let idx = 1;
            
            chunksToInsert.forEach((chunk, i) => {
                const chunkId = `${documentId}-${i}-${crypto.randomBytes(4).toString('hex')}`;
                const vecStr = `[${chunk.vector.join(',')}]`;
                chunkValues.push(chunkId, documentId, roomId, chunk.content, chunk.page_number, vecStr);
                chunkPlaceholders.push(`($${idx}, $${idx+1}, $${idx+2}, $${idx+3}, $${idx+4}, $${idx+5})`);
                idx += 6;
            });

            const insertSql = `
                INSERT INTO document_chunks (chunk_id, document_id, room_id, content, page_number, embedding) 
                VALUES ${chunkPlaceholders.join(', ')}
            `;
            await client.query(insertSql, chunkValues);
        } else {
            logger.warn('saveDocumentChunks', '[WARNING] Document saved but NO valid chunks were extracted (likely empty or image-only PDF).');
        }
        
        return { documentId };
    });
}

// --- EXPORTS ---
const deleteDocumentById = async (docId) => {
    return query('DELETE FROM documents WHERE id = $1', [docId]);
}

const updateConversationTitle = async (conversationId, title) => {
    return query('UPDATE conversations SET title = $1 WHERE conversation_id = $2', [title, conversationId]);
}

module.exports = {
    getPool, 
    query, 
    initializeDatabase,
    executeTransaction, 
    saveDocumentChunks,
    deleteDocumentById,
    updateConversationTitle,
    CORE_ROLES, 
};