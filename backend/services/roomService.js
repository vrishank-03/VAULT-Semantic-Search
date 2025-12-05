// backend/services/roomService.js - OPTIMIZED for PostgreSQL and DB-Driven RBAC

// Replaced SQLite imports with PostgreSQL imports
const { query, executeTransaction, CORE_ROLES, deleteDocumentById } = require('../database'); 
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { deleteDocumentVectors } = require('./VectorDBService');
const { generateUniqueRoomCode } = require('../utils/roomUtils'); 
const logger = require('../utils/logger');

const SERVICE_NAME = 'roomService';

// Map hardcoded role names to constant keys for internal checks
const ROLE_KEYS = {
    CTO: CORE_ROLES.find(r => r.key === 'CTO').key,
    PO: CORE_ROLES.find(r => r.key === 'PO').key,
    ADMIN: CORE_ROLES.find(r => r.key === 'Admin').key,
    USER: CORE_ROLES.find(r => r.key === 'User').key,
};

// --- CORE LOGIC: Room Visibility (PG-Optimized) ---
/**
 * @desc 	  Get chat rooms based on user's role
 * @param {object} user - The full user object (id, role, product_id, manager_id)
 * @returns {Promise<Array<object>>}
 */
const getRoomsLogic = async (user) => {
    const { id: userId, role, product_id: productId, manager_id: managerId } = user;
    logger.info(SERVICE_NAME, `[ROOM_SERVICE] User ${userId} is Role: ${role}.`);

    let sql = ``;
    let params = [userId]; // $1 is always userId for JIT access

    // [PG_MIGRATE] Using STRING_AGG instead of GROUP_CONCAT and PG syntax
    const baseSelect = `
        SELECT 
            cr.id, cr.name, cr.color, cr.room_code, cr.product_id,
            (cr.password_hash IS NOT NULL) AS "isPasswordProtected",
            p.product_name,
            STRING_AGG(DISTINCT c.name, ', ') AS "client_names",
            rar.expires_at AS "jit_expires_at",
            creator.role AS "creator_role"
    `;
    const fromJoins = `
        FROM chat_rooms cr
        LEFT JOIN products p ON cr.product_id = p.id
        LEFT JOIN room_client_assignments rca ON cr.id = rca.room_id
        LEFT JOIN clients c ON rca.client_id = c.id
        LEFT JOIN room_po_assignments rpa ON cr.id = rpa.room_id
        LEFT JOIN room_admin_assignments raa ON cr.id = raa.room_id
        LEFT JOIN room_user_assignments rua ON cr.id = rua.room_id
        LEFT JOIN users creator ON cr.creator_id = creator.id
        LEFT JOIN room_access_requests rar
            ON cr.id = rar.room_id
            AND rar.requester_id = $1 
            AND rar.status = 'approved'
            AND rar.expires_at > NOW()
    `;

    const groupBy = `
        GROUP BY cr.id, p.product_name, rar.expires_at, creator.role
        ORDER BY p.product_name, cr.name
    `;

    // 1. CTO (Sees All, Can Downstream Passworded Rooms)
    if (role === ROLE_KEYS.CTO) {
        sql = `
            ${baseSelect},
            (cr.password_hash IS NOT NULL) AS "isDownstreamable"
            ${fromJoins}
            ${groupBy}
        `;
    // 2. Product Owner (Sees Rooms in their Product + Assigned/JIT/Unblocked)
    } else if (role === ROLE_KEYS.PO) {
        sql = `
            ${baseSelect},
            (cr.password_hash IS NOT NULL AND (cr.creator_id = $2 OR rpa.po_id = $2)) AS "isDownstreamable"
            ${fromJoins}
            WHERE 
                rar.id IS NOT NULL -- JIT access
                OR rpa.po_id = $2 -- Assigned
                OR cr.creator_id = $2 -- Creator
                OR cr.product_id = $3 -- All rooms in their product (Primary PO view)
            ${groupBy}
        `;
        params.push(userId, productId);
    // 3. Administrator (Sees Rooms assigned to them + JIT/Unblocked)
    } else if (role === ROLE_KEYS.ADMIN) {
        sql = `
            ${baseSelect},
            (cr.password_hash IS NOT NULL AND (cr.creator_id = $2 OR raa.admin_id = $2)) AS "isDownstreamable"
            ${fromJoins}
            WHERE 
                rar.id IS NOT NULL -- JIT access
                OR raa.admin_id = $2 -- Assigned
                OR cr.creator_id = $2 -- Creator
                OR cr.product_id = $3 -- All rooms in their product (View scope)
            ${groupBy}
        `;
        params.push(userId, productId);
    // 4. User (Sees Rooms assigned to them + JIT)
    } else if (role === ROLE_KEYS.USER) {
        sql = `
            ${baseSelect},
            FALSE AS "isDownstreamable"
            ${fromJoins}
            WHERE
                rar.id IS NOT NULL -- JIT access
                OR rua.user_id = $2 -- Assigned
                OR cr.creator_id = $2 -- Creator
            ${groupBy}
        `;
        params.push(userId);
    } else {
        logger.warn(SERVICE_NAME, `Unknown role '${role}' for user ${userId}. Returning no rooms.`);
        return [];
    }

    logger.debug(SERVICE_NAME, `[ROOM_SERVICE_DB] Executing SQL for role ${role}.`);
    
    try {
        const resDb = await query(sql, params);
        const finalRooms = resDb.rows.map(r => ({
            ...r,
            isPasswordProtected: r.isPasswordProtected,
            isDownstreamable: r.isDownstreamable,
            jit_expires_at: r.jit_expires_at || null 
        }));
        
        logger.info(SERVICE_NAME, `[ROOM_SERVICE_SUCCESS] Returning ${finalRooms.length} unique rooms.`);
        return finalRooms;
    } catch (roomErr) {
        logger.error(SERVICE_NAME, `[ROOM_SERVICE_DB_ERROR] DB error fetching rooms:`, roomErr.message);
        throw { statusCode: 500, message: "Error fetching chat rooms." };
    }
};

// --- CORE LOGIC: Room Creation (Transactional) ---
/**
 * @desc 	  Create a new chat room
 * @param {object} user - The full user object (id, role, product_id)
 * @param {object} body - The request body (name, color, password, clientIds, poIds, adminIds, userIds)
 * @returns {Promise<object>} The newly created room object
 */
const createRoomLogic = async (user, body) => {
    const { id: creatorId, role, product_id: userProductId } = user;
    logger.info(SERVICE_NAME, `[CREATE_ROOM] User ${creatorId} (Role: ${role}) starting room creation.`);
    
    const { name, color, password, clientIds, productId: bodyProductId, poIds, adminIds, userIds } = body;
    
    if (!name || !clientIds || !Array.isArray(clientIds) || clientIds.length === 0) {
        throw { statusCode: 400, message: "Room name and at least one Client are required." };
    }

    let roomProductId;
    // Secure logic: CTO uses body, others MUST use their token's product_id
    if (role === ROLE_KEYS.CTO) {
        if (!bodyProductId) {
            throw { statusCode: 400, message: "Product ID is required for CTO room creation." };
        }
        roomProductId = bodyProductId;
    } else {
        roomProductId = userProductId; 
    }

    try {
        // 1. Client Verification (Ensure clients belong to the product)
        // Using ANY with array parameter for safe client validation
        const clientSql = `
            SELECT COUNT(*) as count 
            FROM clients 
            WHERE id = ANY($1) AND product_id = $2
        `;
        const clientRes = await query(clientSql, [clientIds, roomProductId]);
        
        if (parseInt(clientRes.rows[0].count, 10) !== clientIds.length) {
            throw { statusCode: 403, message: "Forbidden: One or more selected clients do not belong to the chosen product." };
        }
        
        // 2. Password Hashing
        let password_hash = null;
        if (password && password.length > 0) {
            const salt = await bcrypt.genSalt(10);
            password_hash = await bcrypt.hash(password, salt);
        }

        // 3. Start Transaction
        const newRoom = await executeTransaction(async (client) => {
            const roomCode = await generateUniqueRoomCode(client);
            
            // 3a. Insert Room Metadata
            const insertRoomSql = `
                INSERT INTO chat_rooms (product_id, creator_id, name, color, password_hash, room_code)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id;
            `;
            const roomParams = [roomProductId, creatorId, name, color || '#FFFFFF', password_hash, roomCode];
            const roomRes = await client.query(insertRoomSql, roomParams);
            const newRoomId = roomRes.rows[0].id;

            logger.info(SERVICE_NAME, `[PG_TX] New room ID created: ${newRoomId}.`);

            // 3b. Assign Clients (Mandatory N:M relationship) - FIXED SQL INJECTION
            const clientAssignSql = `
                INSERT INTO room_client_assignments (room_id, client_id) 
                SELECT $1, unnest($2::int[])
            `;
            await client.query(clientAssignSql, [newRoomId, clientIds]);
            
            logger.debug(SERVICE_NAME, `[PG_TX] ${clientIds.length} clients assigned.`);

            // 3c. Assign Users (Hierarchy based on creator's role) - FIXED SQL INJECTION
            let assignTargetIds = [];
            let assignTableName = null;
            let assignColumnName = null;
            
            if (role === ROLE_KEYS.CTO && Array.isArray(poIds) && poIds.length > 0) {
                assignTargetIds = poIds;
                assignTableName = 'room_po_assignments';
                assignColumnName = 'po_id';
                logger.debug(SERVICE_NAME, `[PG_TX] Assigning to ${poIds.length} POs.`);
            } else if (role === ROLE_KEYS.PO && Array.isArray(adminIds) && adminIds.length > 0) {
                assignTargetIds = adminIds;
                assignTableName = 'room_admin_assignments';
                assignColumnName = 'admin_id';
                logger.debug(SERVICE_NAME, `[PG_TX] Assigning to ${adminIds.length} Admins.`);
            } else if (role === ROLE_KEYS.ADMIN && Array.isArray(userIds) && userIds.length > 0) {
                assignTargetIds = userIds;
                assignTableName = 'room_user_assignments';
                assignColumnName = 'user_id';
                logger.debug(SERVICE_NAME, `[PG_TX] Assigning to ${userIds.length} Users.`);
            }
            
            if (assignTableName && assignTargetIds.length > 0) {
                const assignSql = `
                    INSERT INTO ${assignTableName} (room_id, ${assignColumnName}) 
                    SELECT $1, unnest($2::int[])
                `;
                await client.query(assignSql, [newRoomId, assignTargetIds]);
                logger.debug(SERVICE_NAME, `[PG_TX] Successfully assigned ${assignTargetIds.length} users.`);
            }

            // 3d. Final Query for the created room (using the transaction client)
            const returnSql = `
                SELECT 
                    cr.id, cr.name, cr.color, cr.room_code,
                    (cr.password_hash IS NOT NULL) AS "isPasswordProtected",
                    p.product_name,
                    STRING_AGG(DISTINCT c.name, ', ') AS "client_names"
                FROM chat_rooms cr
                JOIN room_client_assignments rca ON cr.id = rca.room_id
                JOIN clients c ON rca.client_id = c.id
                JOIN products p ON cr.product_id = p.id
                WHERE cr.id = $1
                GROUP BY cr.id, p.product_name
            `;
            const newRoomRes = await client.query(returnSql, [newRoomId]);

            // Append transient data before returning
            const newRoom = { 
                ...newRoomRes.rows[0], 
                isDownstreamable: newRoomRes.rows[0].isPasswordProtected,
                jit_expires_at: null
            };
            
            return newRoom;
        }); // End executeTransaction

        logger.info(SERVICE_NAME, `[CREATE_ROOM_SUCCESS] Room ${newRoom.id} created and committed.`);
        return newRoom;
        
    } catch (err) {
        logger.error(SERVICE_NAME, `[ROOM_SERVICE_CREATE_ERROR] Failed during room creation:`, err.message);
        
        // Handle specific error cases
        if (err.statusCode) {
            throw err; // Re-throw our custom errors
        } else if (err.message.includes('unique') || err.message.includes('duplicate')) {
            throw { statusCode: 409, message: 'Room code collision. Please try again.' };
        } else {
            throw { statusCode: 500, message: 'Failed to save room due to server error.' };
        }
    }
};

// --- CORE LOGIC: Document Deletion (PG-Optimized) ---
/**
 * @desc 	  Deletes a document from a room
 * @param {object} user - The full user object (id, role, product_id)
 * @param {number} docId - The document ID to delete
 * @returns {Promise<{message: string, roomId: number}>} 
 */
const deleteDocumentLogic = async (user, docId) => {
    const { id: userId, role: userRole, product_id: userProductId } = user;
    logger.info(SERVICE_NAME, `[DELETE_DOC] User ${userId} (${userRole}) attempting to delete document ${docId}.`);

    try {
        // 1. Authorization & Fetch Document Info (using PG query)
        const sqlGetDoc = `
            SELECT 
                d.file_path, d.room_id, cr.product_id, d.user_id AS "creatorId"
            FROM documents d
            JOIN chat_rooms cr ON d.room_id = cr.id
            WHERE d.id = $1
        `;
        
        const docRes = await query(sqlGetDoc, [docId]);
        const doc = docRes.rows[0];

        if (!doc) {
            logger.warn(SERVICE_NAME, `[DELETE_DOC_WARN] Document ${docId} not found.`);
            throw { statusCode: 404, message: 'Document not found.' };
        }

        // Authorization: CTO/PO/Admin must belong to the document's product OR be the original uploader.
        if ((userRole === ROLE_KEYS.ADMIN || userRole === ROLE_KEYS.PO) && doc.product_id !== userProductId) {
            logger.warn(SERVICE_NAME, `[DELETE_DOC_FAIL] User ${userId} (Product ${userProductId}) FORBIDDEN to delete doc ${docId} (Product ${doc.product_id}).`);
            throw { statusCode: 403, message: 'Forbidden: You do not have permission to delete this document.' };
        }
        // CTO has implicit permission to all products.

        // 2. Perform Atomic Deletion (Metadata + Vectors)
        logger.info(SERVICE_NAME, `[DELETE_DOC_ATOMIC] Deleting vectors and metadata for doc ${docId}.`);
        
        // Delete vectors (document_chunks via pgvector)
        const vectorDeleteResult = await deleteDocumentVectors(docId);
        if (!vectorDeleteResult.success) {
            logger.error(SERVICE_NAME, `[DELETE_DOC_ERROR] Vector deletion failed: ${vectorDeleteResult.error}`);
            // Continue with metadata deletion even if vector deletion fails
        }

        // Delete metadata (documents table)
        await deleteDocumentById(docId);

        // 3. File System Cleanup
        const filePath = path.resolve(__dirname, '..', doc.file_path); 
        logger.info(SERVICE_NAME, `[DELETE_DOC_FS] Deleting file from storage: ${filePath}`);
        try {
            await fs.promises.unlink(filePath);
            logger.info(SERVICE_NAME, `[DELETE_DOC_FS_SUCCESS] File ${filePath} deleted.`);
        } catch (fsErr) {
            if (fsErr.code !== 'ENOENT') { // Only warn if file exists but couldn't be deleted
                logger.warn(SERVICE_NAME, `[DELETE_DOC_FS_WARN] File deletion failed: ${fsErr.message}`);
            } else {
                logger.debug(SERVICE_NAME, `[DELETE_DOC_FS] File already deleted: ${filePath}`);
            }
        }

        return { message: 'Document deleted successfully.', roomId: doc.room_id };

    } catch (err) {
        logger.error(SERVICE_NAME, `[DELETE_DOC_ERROR] Critical error:`, err.message);
        if (err.statusCode) {
            throw err; // Re-throw our custom errors
        }
        throw { statusCode: 500, message: 'An error occurred during document deletion.' };
    }
};

// --- CORE LOGIC: Room Password Edit (PG-Optimized) ---
/**
 * @desc 	  Edit a room's password
 * @param {object} user - The full user object (id, role)
 * @param {number} roomId - The ID of the room to edit
 * @param {string} password - The new password (or "" to remove)
 * @returns {Promise<{message: string}>}
 */
const editRoomPasswordLogic = async (user, roomId, password) => {
    logger.info(SERVICE_NAME, `[ROOM_SERVICE_PASS] User ${user.id} attempting to change password for room ${roomId}.`);
    
    try {
        let password_hash = null;
        if (password && password.length > 0) {
            const salt = await bcrypt.genSalt(10);
            password_hash = await bcrypt.hash(password, salt);
        } 

        let sql = `UPDATE chat_rooms SET password_hash = $1 WHERE id = $2`;
        const params = [password_hash, roomId];

        // Implement hierarchical edit logic
        if (user.role === ROLE_KEYS.CTO) {
            // CTO can edit any room. No additional WHERE clause.
        } else if (user.role === ROLE_KEYS.PO) {
            // PO can edit rooms they created or rooms created by their direct Admin reports.
            sql += ` AND (creator_id = $3 OR creator_id IN (SELECT id FROM users WHERE manager_id = $4 AND role = $5))`;
            params.push(user.id, user.id, ROLE_KEYS.ADMIN);
        } else if (user.role === ROLE_KEYS.ADMIN) {
            // Admin can edit rooms they created.
            sql += ` AND creator_id = $3`;
            params.push(user.id);
        } else {
            throw { statusCode: 403, message: "You do not have permission to edit this room." };
        }

        const updateRes = await query(sql, params);
        
        if (updateRes.rowCount === 0) {
            logger.warn(SERVICE_NAME, `[ROOM_SERVICE_PASS_FAIL] User ${user.id} failed to update password for room ${roomId}. Not found or not authorized.`);
            throw { statusCode: 403, message: "Failed to update password: You are not authorized to edit this room or the room does not exist." };
        }
        
        const action = password_hash ? 'set' : 'removed';
        logger.info(SERVICE_NAME, `[ROOM_SERVICE_PASS_SUCCESS] Password ${action} successfully.`);
        return { message: `Password ${action} successfully.` };

    } catch (err) {
        logger.error(SERVICE_NAME, `[ROOM_SERVICE_PASS_ERROR] Critical error:`, err.message);
        if (err.statusCode) {
            throw err; // Re-throw our custom errors
        }
        throw { statusCode: 500, message: 'Server error updating password.' };
    }
};

module.exports = {
    getRoomsLogic,
    createRoomLogic,
    deleteDocumentLogic,
    editRoomPasswordLogic
};