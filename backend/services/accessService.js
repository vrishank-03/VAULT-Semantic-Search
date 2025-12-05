// backend/services/accessService.js - OPTIMIZED for PostgreSQL and Hierarchical Access

const { query, executeTransaction, CORE_ROLES } = require('../database');
const logger = require('../utils/logger');

const SERVICE_NAME = 'accessService';

// Map hardcoded role names to constant keys for internal checks
const ROLE_KEYS = {
    CTO: CORE_ROLES.find(r => r.key === 'CTO').key,
    PO: CORE_ROLES.find(r => r.key === 'PO').key,
    ADMIN: CORE_ROLES.find(r => r.key === 'Admin').key,
    USER: CORE_ROLES.find(r => r.key === 'User').key,
};

/**
 * @desc 	  Unblocks a CTO-assigned room (for POs)
 * @param {number} userId - The PO's user ID
 * @param {number} roomId - The room ID to unblock
 * @returns {Promise<{message: string}>}
 */
const unblockRoomLogic = async (userId, roomId) => {
    logger.info(SERVICE_NAME, `[UNBLOCK] PO ${userId} attempting to unblock room ${roomId}`);
    
    // [PG_MIGRATE] Use query and RETURNING
    const sql = `
        UPDATE room_po_assignments
        SET is_unblocked = TRUE -- PG uses TRUE/FALSE instead of 1/0
        WHERE room_id = $1 AND po_id = $2
        RETURNING room_id;
    `;
    const params = [roomId, userId];
    
    try {
        const res = await query(sql, params);
        
        if (res.rowCount === 0) {
            logger.warn(SERVICE_NAME, `[UNBLOCK_FAIL] No room assignment found for room ${roomId} and PO ${userId}.`);
            throw { statusCode: 404, message: "Room assignment not found or already unblocked." };
        }
        
        logger.info(SERVICE_NAME, `[UNBLOCK_SUCCESS] Successfully unblocked room ${roomId} for PO ${userId}.`);
        return { message: "Room unblocked successfully." };

    } catch (err) {
        logger.error(SERVICE_NAME, `[UNBLOCK_ERROR] Failed to unblock room ${roomId} for PO ${userId}:`, err.message);
        // If error is from throwing an object, re-throw it. Otherwise, it's a DB error.
        if (err.statusCode) throw err;
        throw { statusCode: 500, message: "Database error while unblocking room." };
    }
};

/**
 * @desc 	  Checks if a user has permission to join a room (free access or JIT)
 * @param {object} user - The full user object (id, role, manager_id, product_id)
 * @param {number} roomId - The room ID to join
 * @returns {Promise<{status: string, expires_at: string | null}>}
 */
const joinRoomLogic = async (user, roomId) => {
    const userId = user.id;
    logger.info(SERVICE_NAME, `[JOIN] User ${userId} (${user.role}) attempting to join room ${roomId}`);

    try {
        // --- 1. Check FREE ACCESS (PG-Optimized Query) ---
        // This query checks all possible scenarios where a user/manager has intrinsic access
        let freeAccessSql = `
            SELECT 
                cr.id, rar.expires_at 
            FROM chat_rooms cr
            LEFT JOIN room_po_assignments rpa_self ON cr.id = rpa_self.room_id AND rpa_self.po_id = $2
            LEFT JOIN room_admin_assignments raa_self ON cr.id = raa_self.room_id AND raa_self.admin_id = $2
            LEFT JOIN room_user_assignments rua_self ON cr.id = rua_self.room_id AND rua_self.user_id = $2
            LEFT JOIN room_access_requests rar
                ON cr.id = rar.room_id AND rar.requester_id = $2 AND rar.status = 'approved' AND rar.expires_at > NOW()
            WHERE cr.id = $1
        `;
        let whereConditions = [];
        let params = [roomId, userId]; 
        let accessTypeLog = "";
        
        // Build access conditions based on CORE_ROLE keys
        if (user.role === ROLE_KEYS.CTO) {
            whereConditions.push(`TRUE`); // CTO has access to all rooms
            accessTypeLog = "CTO";
        } else if (user.role === ROLE_KEYS.PO) {
            whereConditions.push(`cr.product_id = $3`); // Room is in their product
            whereConditions.push(`cr.creator_id = $2`); // They are the creator
            whereConditions.push(`(rpa_self.po_id IS NOT NULL AND rpa_self.is_unblocked = TRUE)`); // Unblocked assignment
            params.push(user.product_id);
            accessTypeLog = "ProductOwner";
        } else if (user.role === ROLE_KEYS.ADMIN) {
            whereConditions.push(`cr.creator_id = $2`); // They are the creator
            whereConditions.push(`raa_self.admin_id IS NOT NULL`); // They are assigned
            whereConditions.push(`cr.product_id = $3 AND NOT EXISTS (SELECT 1 FROM room_admin_assignments raa WHERE raa.room_id = $1 AND raa.admin_id != $2)`); // Unassigned rooms in their product
            params.push(user.product_id);
            accessTypeLog = "Administrator";
        } else if (user.role === ROLE_KEYS.USER) {
             whereConditions.push(`cr.creator_id = $2`); // They are the creator
             whereConditions.push(`rua_self.user_id IS NOT NULL`); // They are assigned
             accessTypeLog = "User";
        }

        const finalWhere = whereConditions.join(` OR `);
        freeAccessSql += ` AND (${finalWhere}) LIMIT 1`;
        
        logger.debug(SERVICE_NAME, `[JOIN_DB] Checking free access for ${accessTypeLog}.`);

        const freeAccessRes = await query(freeAccessSql, params);
        const freeAccessRow = freeAccessRes.rows[0];

        if (freeAccessRow) {
            logger.info(SERVICE_NAME, `[JOIN_GRANT] User ${userId} has FREE access.`);
            // If the query returns a row, access is granted. Check for JIT expiration carried by the query (for completeness).
            return { status: 'granted', expires_at: freeAccessRow.expires_at || null };
        }

        // --- 2. Check JIT ACCESS (If free access fails) ---
        logger.debug(SERVICE_NAME, `No free access. Checking JIT access...`);
        const jitSql = `
            SELECT status, expires_at 
            FROM room_access_requests 
            WHERE room_id = $1 AND requester_id = $2 
            ORDER BY created_at DESC LIMIT 1
        `;
        const jitRes = await query(jitSql, [roomId, userId]);
        const jitRequest = jitRes.rows[0];
        
        if (!jitRequest) {
            logger.warn(`[JOIN_DENY] User ${userId} has NO free access and NO JIT request.`);
            return Promise.reject({ statusCode: 403, status: 'denied', message: 'You do not have access to this room.' });
        }

        // --- 3. Evaluate JIT Status ---
        const now = new Date();
        const expiresAt = jitRequest.expires_at ? new Date(jitRequest.expires_at) : null;
        
        if (jitRequest.status === 'approved' && (!expiresAt || expiresAt > now)) {
            logger.info(`[JOIN_GRANT] User ${userId} has valid JIT access.`);
            return { status: 'granted', expires_at: jitRequest.expires_at };
        } else if (jitRequest.status === 'approved' && expiresAt <= now) {
            // JIT expired: update status in DB
            await query(`UPDATE room_access_requests SET status = 'expired' WHERE room_id = $1 AND requester_id = $2`, [roomId, userId]);
            return Promise.reject({ statusCode: 403, status: 'expired', message: 'Your temporary access to this room has expired.' });
        } else if (jitRequest.status === 'pending') {
            return Promise.reject({ statusCode: 403, status: 'pending', message: 'Your access request is still pending approval.' });
        } else {
            // Rejected, revoked, or already expired status
            return Promise.reject({ statusCode: 403, status: jitRequest.status, message: `Your access to this room has been ${jitRequest.status}.` });
        }

    } catch (err) {
        logger.error(SERVICE_NAME, `[JOIN_ERROR] Critical error in joinRoomLogic:`, err.message);
        if (err.statusCode) throw err; // Re-throw structured errors
        throw { statusCode: 500, message: 'Server error checking room access.' };
    }
};

/**
 * @desc 	  Sends a room "downstream" (PO->Admin or Admin->User)
 * @param {object} user - The full user object (id, role, product_id)
 * @param {number} roomId - The room ID to share
 * @param {Array<number>} assignIds - An array of User IDs or Admin IDs
 * @returns {Promise<{message: string}>}
 */
const sendDownstreamLogic = async (user, roomId, assignIds) => {
    logger.info(SERVICE_NAME, `[DOWNSTREAM] User ${user.id} (${user.role}) sending room ${roomId} to IDs: [${assignIds}]`);

    if (user.role !== ROLE_KEYS.PO && user.role !== ROLE_KEYS.ADMIN) {
        throw { statusCode: 403, message: "Forbidden: Only Product Owners or Administrators can send rooms downstream." };
    }
    if (!assignIds || !Array.isArray(assignIds) || assignIds.length === 0) {
        throw { statusCode: 400, message: "An array of assignIds is required." };
    }

    try {
        const result = await executeTransaction(async (client) => {
            // 1. Verify Room Existence and Authorization
            const roomRes = await client.query(`SELECT product_id, creator_id FROM chat_rooms WHERE id = $1`, [roomId]);
            const room = roomRes.rows[0];

            if (!room) throw { statusCode: 404, message: "Room not found." };
            
            let isAuthorized = false;
            let downstreamTable = '';
            let targetRoleKey = ''; // Role of the users being assigned (Admin or User)
            
            if (user.role === ROLE_KEYS.PO) {
                // PO can send if they created the room OR it's in their product
                if (room.creator_id === user.id || room.product_id === user.product_id) {
                    isAuthorized = true;
                    downstreamTable = 'room_admin_assignments';
                    targetRoleKey = ROLE_KEYS.ADMIN;
                }
            } else if (user.role === ROLE_KEYS.ADMIN) {
                // Admin can send if they created the room OR are assigned to it
                const assignmentRes = await client.query(`SELECT 1 FROM room_admin_assignments WHERE room_id = $1 AND admin_id = $2`, [roomId, user.id]);
                if (room.creator_id === user.id || assignmentRes.rows.length > 0) {
                    isAuthorized = true;
                    downstreamTable = 'room_user_assignments';
                    targetRoleKey = ROLE_KEYS.USER;
                }
            }

            if (!isAuthorized) {
                throw { statusCode: 403, message: "Forbidden: You do not have permission to share this room." };
            }

            // 2. Verify Target Users' Authority (Ensure target users are reports/correct role)
            const assignIdsPlaceholders = assignIds.map((_, i) => `$${i + 3}`).join(',');
            const verificationSql = `
                SELECT COUNT(id) AS count FROM users 
                WHERE id IN (${assignIdsPlaceholders}) 
                AND manager_id = $2 AND role = $1
            `;
            const verificationParams = [targetRoleKey, user.id, ...assignIds];
            const verificationRes = await client.query(verificationSql, verificationParams);

            if (parseInt(verificationRes.rows[0].count, 10) !== assignIds.length) {
                throw { statusCode: 403, message: `Forbidden: Not all target users are your direct reports (Role: ${targetRoleKey}).` };
            }

            // 3. Insert Assignments (Bulk INSERT OR IGNORE logic)
            logger.debug(SERVICE_NAME, `[DOWNSTREAM_PG] Inserting ${assignIds.length} assignments into ${downstreamTable}.`);
            
            // Build bulk insert string: (room_id, target_id)
            const targetColumn = targetRoleKey === ROLE_KEYS.ADMIN ? 'admin_id' : 'user_id';
            const insertValues = assignIds.map(id => `(${roomId}, ${id})`).join(',');
            
            // Use ON CONFLICT DO NOTHING to handle existing assignments gracefully (like SQLite's INSERT OR IGNORE)
            const insertSql = `
                INSERT INTO ${downstreamTable} (room_id, ${targetColumn}) 
                VALUES ${insertValues}
                ON CONFLICT (room_id, ${targetColumn}) DO NOTHING
            `;
            await client.query(insertSql);
            
            return { message: "Room successfully assigned downstream." };
        }); // End executeTransaction

        logger.info(SERVICE_NAME, `[DOWNSTREAM_SUCCESS] Room ${roomId} sent downstream by ${user.role} ${user.id}.`);
        return result;

    } catch (err) {
        logger.error(SERVICE_NAME, `[DOWNSTREAM_ERROR] Critical error in sendDownstream:`, err.message);
        // Re-throw structured errors
        if (err.statusCode) throw err;
        throw { statusCode: 500, message: 'Server error.' };
    }
};

module.exports = {
    unblockRoomLogic,
    joinRoomLogic,
    sendDownstreamLogic
};