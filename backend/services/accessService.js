// backend/services/accessService.js

const { getDb } = require('../database');

/**
 * @desc      Unblocks a CTO-assigned room (for POs)
 * @param {number} userId - The PO's user ID
 * @param {number} roomId - The room ID to unblock
 * @returns {Promise<{message: string}>}
 */
const unblockRoomLogic = (userId, roomId) => {
    return new Promise((resolve, reject) => {
        console.log(`[ACCESS_SERVICE] PO ${userId} attempting to unblock room ${roomId}`);
        const db = getDb();
        const sql = `
            UPDATE room_po_assignments
            SET is_unblocked = 1
            WHERE room_id = ? AND po_id = ?
        `;
        const params = [roomId, userId];
        console.log(`[ACCESS_SERVICE_DB] Executing SQL: ${sql} with params: [${roomId}, ${userId}]`);
        
        db.run(sql, params, function(err) {
            if (err) {
                console.error(`[ACCESS_SERVICE_DB_ERROR] Failed to unblock room ${roomId} for PO ${userId}:`, err.message);
                reject({ statusCode: 500, message: "Database error while unblocking room." });
            }
            if (this.changes === 0) {
                console.warn(`[ACCESS_SERVICE_WARN] No room assignment found for room ${roomId} and PO ${userId}.`);
                reject({ statusCode: 404, message: "Room assignment not found or already unblocked." });
            }
            console.log(`[ACCESS_SERVICE_SUCCESS] Successfully unblocked room ${roomId} for PO ${userId}.`);
            resolve({ message: "Room unblocked successfully." });
        });
    });
};

/**
 * @desc      Checks if a user has permission to join a room (free access or JIT)
 * @param {object} user - The full user object (id, role, manager_id, product_id)
 * @param {number} roomId - The room ID to join
 * @returns {Promise<{status: string, expires_at: string | null}>}
 */
const joinRoomLogic = (user, roomId) => {
    return new Promise(async (resolve, reject) => {
        const userId = user.id;
        console.log(`[ACCESS_SERVICE] User ${userId} (Role: ${user.role}) attempting to join room ${roomId}`);
        const db = getDb();

        try {
            // --- [BUG_FIX] Select all columns needed for GROUP BY/HAVING ---
            let freeAccessSql = `
                SELECT 1, cr.id, cr.creator_id, raa_self.admin_id, cr.product_id 
                FROM chat_rooms cr 
                LEFT JOIN room_admin_assignments raa_self ON cr.id = raa_self.room_id AND raa_self.admin_id = ?
                LEFT JOIN room_po_assignments rpa_self ON cr.id = rpa_self.room_id AND rpa_self.po_id = ?
                LEFT JOIN (SELECT room_id, COUNT(id) as admin_count FROM room_admin_assignments GROUP BY room_id) rca_count ON cr.id = rca_count.room_id
            `;
            const freeAccessParams = [userId, userId]; 
            // --- [BUG_FIX] Start with a simple WHERE clause. We will add to it. ---
            let whereClause = `WHERE cr.id = ?`;
            const whereParams = [roomId];
            let havingClause = ``; 
            let finalSql = ``;
            let accessTypeLog = "";

            if (user.role === 'CTO') {
                whereClause += ` AND (1=1)`;
                accessTypeLog = "CTO";
            } else if (user.role === 'ProductOwner') {
                whereClause += ` AND (cr.product_id = ? OR cr.creator_id = ? OR (rpa_self.po_id = ? AND rpa_self.is_unblocked = 1))`;
                whereParams.push(user.product_id, userId, userId);
                accessTypeLog = "ProductOwner";
            } else if (user.role === 'Administrator') {
                // Admin logic is HAVING-based, not WHERE-based.
                havingClause = `
                    HAVING 
                        cr.creator_id = ? 
                        OR
                        raa_self.admin_id IS NOT NULL
                        OR
                        (cr.product_id = ? AND (rca_count.admin_count IS NULL OR rca_count.admin_count = 0))
                `;
                whereParams.push(userId, user.product_id);
                accessTypeLog = "Administrator";
            } else if (user.role === 'User') {
                // User logic is also HAVING-based
                if (!user.manager_id) {
                    console.log(`[ACCESS_SERVICE_DENY] User ${userId} has no manager_id. Access denied.`);
                    return reject({ statusCode: 403, message: 'You are not assigned to this room.' });
                }
                freeAccessParams[0] = user.manager_id; // raa_self.admin_id = manager_id
                havingClause = `
                    HAVING
                        cr.creator_id = ? 
                        OR
                        raa_self.admin_id IS NOT NULL
                `;
                whereParams.push(user.manager_id);
                accessTypeLog = "User (via Admin)";
            }
            
            // --- [BUG_FIX] Assemble the SQL correctly ---
            if (havingClause) {
                // This is for Admin or User.
                const groupBy = `GROUP BY cr.id, cr.creator_id, raa_self.admin_id, cr.product_id`;
                finalSql = `${freeAccessSql} ${whereClause} ${groupBy} ${havingClause} LIMIT 1`;
            } else {
                // This is for CTO or PO.
                finalSql = `${freeAccessSql} ${whereClause} LIMIT 1`;
            }
            // --- [END BUG_FIX] ---

            const finalParams = [...freeAccessParams, ...whereParams];

            console.log(`[ACCESS_SERVICE_DB] Checking free access for ${accessTypeLog} with params: [${finalParams.join(',')}]`);
            const freeAccessRow = await new Promise((res, rej) => {
                db.get(finalSql, finalParams, (err, row) => err ? rej(err) : res(row));
            });

            if (freeAccessRow) {
                console.log(`[ACCESS_SERVICE_GRANT] User ${userId} has FREE access to room ${roomId} as ${accessTypeLog}.`);
                return resolve({ status: 'granted', expires_at: null });
            }

            console.log(`[ACCESS_SERVICE_DB] No free access. Checking JIT access for user ${userId} in room ${roomId}...`);
            const jitSql = `SELECT id, status, expires_at FROM room_access_requests 
                            WHERE room_id = ? AND requester_id = ? 
                            ORDER BY updated_at DESC LIMIT 1`;
            
            const jitRequest = await new Promise((res, rej) => {
                db.get(jitSql, [roomId, userId], (err, row) => err ? rej(err) : res(row));
            });

            if (!jitRequest) {
                console.warn(`[ACCESS_SERVICE_DENY] User ${userId} has NO free access and NO JIT request for room ${roomId}.`);
                return reject({ statusCode: 403, status: 'denied', message: 'You do not have access to this room.' });
            }

            console.log(`[ACCESS_SERVICE_DB] Found JIT request ${jitRequest.id} with status: ${jitRequest.status}`);
            const now = new Date();

            if (jitRequest.status === 'approved') {
                if (jitRequest.expires_at === null || new Date(jitRequest.expires_at) > now) {
                    console.log(`[ACCESS_SERVICE_GRANT] User ${userId} has valid JIT access to room ${roomId}. Expires: ${jitRequest.expires_at}`);
                    return resolve({ status: 'granted', expires_at: jitRequest.expires_at });
                } else {
                    console.warn(`[ACCESS_SERVICE_EXPIRED] User ${userId} JIT access for room ${roomId} EXPIRED at ${jitRequest.expires_at}.`);
                    db.run(`UPDATE room_access_requests SET status = 'expired' WHERE id = ?`, [jitRequest.id]);
                    return reject({ statusCode: 403, status: 'expired', message: 'Your temporary access to this room has expired.' });
                }
            }

            if (jitRequest.status === 'pending') {
                console.log(`[ACCESS_SERVICE_PENDING] User ${userId} JIT access for room ${roomId} is still pending.`);
                return reject({ statusCode: 403, status: 'pending', message: 'Your access request is still pending approval.' });
            }

            if (jitRequest.status === 'rejected' || jitRequest.status === 'revoked' || jitRequest.status === 'expired') {
                console.warn(`[ACCESS_SERVICE_DENY] User ${userId} JIT access for room ${roomId} is ${jitRequest.status}.`);
                return reject({ statusCode: 403, status: jitRequest.status, message: `Your access to this room has been ${jitRequest.status}.` });
            }

            console.error(`[ACCESS_SERVICE_ERROR] Reached fallback deny. Unknown JIT status: ${jitRequest.status}`);
            reject({ statusCode: 403, status: 'denied', message: 'You do not have access to this room.' });

        } catch (err) {
            console.error(`[ACCESS_SERVICE_ERROR] Critical error in joinRoomLogic for user ${userId}:`, err.message);
            reject({ statusCode: 500, message: 'Server error checking room access.' });
        }
    });
};

/**
 * @desc      Sends a room "downstream" (PO->Admin or Admin->User)
 * @param {object} user - The full user object (id, role, product_id)
 * @param {number} roomId - The room ID to share
 * @param {Array<number>} assignIds - An array of User IDs or Admin IDs
 * @returns {Promise<{message: string}>}
 */
const sendDownstreamLogic = (user, roomId, assignIds) => {
    return new Promise(async (resolve, reject) => {
        console.log(`[ACCESS_SERVICE] [BLOCK_2] User ${user.id} (Role: ${user.role}) attempting to send room ${roomId} to IDs: [${assignIds}]`);

        if (user.role !== 'ProductOwner' && user.role !== 'Administrator') {
            console.warn(`[ACCESS_SERVICE_FAIL] User ${user.id} (Role: ${user.role}) is not a PO or Admin. Forbidden.`);
            return reject({ statusCode: 403, message: "Forbidden: Only Product Owners or Administrators can send rooms downstream." });
        }
        if (!assignIds || !Array.isArray(assignIds) || assignIds.length === 0) {
            return reject({ statusCode: 400, message: "An array of assignIds is required." });
        }

        const db = getDb();
        
        try {
            const room = await new Promise((res, rej) => {
                db.get(`SELECT product_id, creator_id FROM chat_rooms WHERE id = ?`, [roomId], (err, row) => err ? rej(err) : res(row));
            });

            if (!room) {
                console.warn(`[ACCESS_SERVICE_FAIL] Room ${roomId} not found.`);
                return reject({ statusCode: 404, message: "Room not found." });
            }

            let isAuthorized = false;
            let downstreamTable = '';
            let downstreamColumn = '';

            if (user.role === 'ProductOwner') {
                console.log(`[ACCESS_SERVICE] [BLOCK_2] Verifying PO ${user.id} (Product ${user.product_id}) for room ${roomId} (Product ${room.product_id}).`);
                if (room.creator_id === user.id || room.product_id === user.product_id) {
                    isAuthorized = true;
                    downstreamTable = 'room_admin_assignments';
                    downstreamColumn = 'admin_id';
                }
            } else if (user.role === 'Administrator') {
                console.log(`[ACCESS_SERVICE] [BLOCK_2] Verifying Admin ${user.id} for room ${roomId}.`);
                const assignment = await new Promise((res, rej) => {
                    db.get(`SELECT 1 FROM room_admin_assignments WHERE room_id = ? AND admin_id = ?`, [roomId, user.id], (err, row) => err ? rej(err) : res(row));
                });
                
                if (room.creator_id === user.id || assignment) {
                    isAuthorized = true;
                    downstreamTable = 'room_user_assignments';
                    downstreamColumn = 'user_id';
                }
            }

            if (!isAuthorized) {
                console.warn(`[ACCESS_SERVICE_FAIL] User ${user.id} (Role: ${user.role}) is NOT authorized to send room ${roomId} downstream.`);
                return reject({ statusCode: 403, message: "Forbidden: You do not have permission to share this room." });
            }

            console.log(`[ACCESS_SERVICE_DB] [BLOCK_2] User ${user.id} is authorized. Assigning to ${downstreamTable}...`);
            db.serialize(() => {
                db.run("BEGIN TRANSACTION");
                const stmt = db.prepare(`INSERT OR IGNORE INTO ${downstreamTable} (room_id, ${downstreamColumn}) VALUES (?, ?)`);
                assignIds.forEach(id => {
                    stmt.run(roomId, id, (err) => {
                        if (err) console.error(`[ACCESS_SERVICE_DB_ERROR] Failed to assign ID ${id} to room ${roomId}:`, err.message);
                    });
                });
                stmt.finalize((err) => {
                    if (err) {
                        console.error(`[ACCESS_SERVICE_DB_ERROR] Failed to finalize assignment:`, err.message);
                        db.run("ROLLBACK");
                        return reject({ statusCode: 500, message: 'Failed to assign room (finalize).' });
                    }
                    
                    db.run("COMMIT", (commitErr) => {
                        if (commitErr) {
                            console.error('[ACCESS_SERVICE_ERROR] Failed to COMMIT transaction:', commitErr.message);
                            db.run("ROLLBACK");
                            return reject({ statusCode: 500, message: 'Failed to assign room (commit).' });
                        }
                        console.log(`[ACCESS_SERVICE_SUCCESS] Room ${roomId} sent downstream by ${user.role} ${user.id}.`);
                        resolve({ message: "Room successfully assigned downstream." });
                    });
                });
            });

        } catch (err) {
            console.error(`[ACCESS_SERVICE_ERROR] Critical error in sendDownstream:`, err.message);
            reject({ statusCode: 500, message: 'Server error.' });
        }
    });
};

module.exports = {
    unblockRoomLogic,
    joinRoomLogic,
    sendDownstreamLogic
};