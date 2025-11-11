// backend/services/roomService.js

const { getDb } = require('../database');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { deleteDocumentFromChroma } = require('../searchService');
const { deleteDocumentById } = require('../database');
const { generateUniqueRoomCode } = require('../utils/roomUtils');

/**
 * @desc      Get chat rooms based on user's role
 * @param {object} user - The full user object (id, role, product_id, manager_id)
 * @returns {Promise<Array<object>>}
 */
const getRoomsLogic = (user) => {
    return new Promise(async (resolve, reject) => {
        const { id: userId, role, product_id: productId, manager_id: managerId } = user;
        console.log(`[ROOM_SERVICE] [BUG_FIX] User ${userId} is Role: ${role}, ProductID: ${productId}, ManagerID: ${managerId}`);
        const db = getDb();

        let sql = ``;
        let params = [];

        const baseSelect = `
            SELECT 
                cr.id, cr.name, cr.color, cr.room_code, cr.product_id,
                cr.password_hash IS NOT NULL AS isPasswordProtected,
                p.product_name,
                GROUP_CONCAT(DISTINCT c.name) AS client_names,
                rar.expires_at AS jit_expires_at 
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
                AND rar.requester_id = ? 
                AND rar.status = 'approved'
                AND rar.expires_at > CURRENT_TIMESTAMP
        `;
        params.push(userId); 

        const groupBy = `GROUP BY cr.id, cr.name, cr.color, cr.room_code, cr.product_id, p.product_name, rar.expires_at`;
        const orderBy = `ORDER BY p.product_name, cr.name`;

        if (role === 'CTO') {
            console.log(`[ROOM_SERVICE] [BUG_FIX] User is 'CTO'. Fetching ALL rooms.`);
            sql = `
                ${baseSelect},
                /* CTOs see 'Send Downstream' on all password-protected rooms */
                (CASE 
                    WHEN cr.password_hash IS NOT NULL THEN 1
                    ELSE 0 
                END) AS isDownstreamable
                ${fromJoins}
                ${groupBy}
                ${orderBy}
            `;
        } else if (role === 'ProductOwner') {
            console.log(`[ROOM_SERVICE] [BUG_FIX] User is 'ProductOwner'. Fetching rooms.`);
            sql = `
                ${baseSelect},
                /* --- [BUG_FIX] 'isDownstreamable' is 1 ONLY IF room has password AND PO owns/is assigned to it. --- */
                (CASE 
                    WHEN cr.password_hash IS NOT NULL AND (cr.creator_id = ? OR rpa.po_id = ?) THEN 1
                    ELSE 0 
                END) AS isDownstreamable
                ${fromJoins}
                WHERE 
                    rar.id IS NOT NULL
                    OR cr.creator_id = ?
                    OR (creator.role = 'CTO' AND cr.password_hash IS NULL AND NOT EXISTS (SELECT 1 FROM room_po_assignments WHERE room_id = cr.id))
                    OR (rpa.po_id = ? AND cr.password_hash IS NULL)
                    OR (rpa.po_id = ? AND cr.password_hash IS NOT NULL)
                    OR (creator.role = 'CTO' AND cr.password_hash IS NOT NULL AND NOT EXISTS (SELECT 1 FROM room_po_assignments WHERE room_id = cr.id))
                    OR (cr.creator_id = ? AND cr.password_hash IS NULL AND NOT EXISTS (SELECT 1 FROM room_admin_assignments WHERE room_id = cr.id))
                ${groupBy}
                ${orderBy}
            `;
            params.push(userId, userId, userId, userId, userId, userId);
        } else if (role === 'Administrator') {
            console.log(`[ROOM_SERVICE] [BUG_FIX] User is 'Administrator'. Fetching rooms.`);
            sql = `
                ${baseSelect},
                /* --- [BUG_FIX] 'isDownstreamable' is 1 ONLY IF room has password AND Admin owns/is assigned to it. --- */
                (CASE 
                    WHEN cr.password_hash IS NOT NULL AND (cr.creator_id = ? OR raa.admin_id = ?) THEN 1
                    ELSE 0 
                END) AS isDownstreamable
                ${fromJoins}
                LEFT JOIN users po ON creator.id = po.id
                WHERE 
                    rar.id IS NOT NULL
                    OR cr.creator_id = ?
                    OR raa.admin_id = ?
                    OR (cr.creator_id = ? AND cr.password_hash IS NULL AND NOT EXISTS (SELECT 1 FROM room_admin_assignments WHERE room_id = cr.id))
                    OR (creator.role = 'CTO' AND cr.password_hash IS NULL AND NOT EXISTS (SELECT 1 FROM room_po_assignments WHERE room_id = cr.id))
                    OR (rpa.po_id = ? AND cr.password_hash IS NULL)
                ${groupBy}
                ${orderBy}
            `;
            params.push(userId, userId, userId, userId, managerId, managerId);
        } else if (role === 'User') {
            console.log(`[ROOM_SERVICE] [BUG_FIX] User is 'User'. Fetching rooms.`);
            if (!managerId) {
                console.log(`[ROOM_SERVICE] User ${userId} has no manager_id, returning 0 rooms.`);
                return resolve([]);
            }
            sql = `
                ${baseSelect},
                0 AS isDownstreamable
                ${fromJoins}
                LEFT JOIN users admin ON creator.id = admin.id
                LEFT JOIN users po ON admin.manager_id = po.id
                WHERE
                    rar.id IS NOT NULL
                    OR rua.user_id = ?
                    OR (cr.creator_id = ? AND cr.password_hash IS NULL AND NOT EXISTS (SELECT 1 FROM room_user_assignments WHERE room_id = cr.id))
                    OR (raa.admin_id = ? AND cr.password_hash IS NULL)
                    OR (cr.creator_id = (SELECT manager_id FROM users WHERE id = ?) AND cr.password_hash IS NULL AND NOT EXISTS (SELECT 1 FROM room_admin_assignments WHERE room_id = cr.id))
                    OR (creator.role = 'CTO' AND cr.password_hash IS NULL AND NOT EXISTS (SELECT 1 FROM room_po_assignments WHERE room_id = cr.id))
                    OR (rpa.po_id = (SELECT manager_id FROM users WHERE id = ?) AND cr.password_hash IS NULL)
                ${groupBy}
                ${orderBy}
            `;
            params.push(userId, managerId, managerId, managerId, managerId);
        } else {
            console.warn(`[ROOM_SERVICE_WARN] Unknown role '${role}' for user ${userId}. Returning no rooms.`);
            return resolve([]);
        }

        console.log(`[ROOM_SERVICE_DB] [BUG_FIX] Executing SQL for role ${role} with ${params.length} params.`);
        db.all(sql, params, (roomErr, rooms) => {
            if (roomErr) {
                console.error(`[ROOM_SERVICE_DB_ERROR] DB error fetching rooms:`, roomErr.message);
                return reject({ statusCode: 500, message: "Error fetching chat rooms." });
            }

            console.log(`[ROOM_SERVICE_SUCCESS] Found ${rooms.length} rooms (pre-uniqueness check).`);
            const uniqueRoomIds = new Set();
            const finalRooms = rooms.map(r => ({
                id: r.id,
                name: r.name,
                color: r.color,
                room_code: r.room_code,
                isPasswordProtected: r.isPasswordProtected === 1,
                client_names: r.client_names,
                product_name: r.product_name,
                isDownstreamable: r.isDownstreamable === 1,
                jit_expires_at: r.jit_expires_at || null 
            })).filter(r => {
                const isDuplicate = uniqueRoomIds.has(r.id);
                uniqueRoomIds.add(r.id);
                return !isDuplicate;
            });
            
            console.log(`[ROOM_SERVICE_SUCCESS] Returning ${finalRooms.length} unique rooms.`);
            resolve(finalRooms);
        });
    });
};

/**
 * @desc      Create a new chat room
 * @param {object} user - The full user object (id, role, product_id)
 * @param {object} body - The request body (name, color, password, clientIds, etc.)
 * @returns {Promise<object>} The newly created room object
 */
const createRoomLogic = (user, body) => {
    return new Promise(async (resolve, reject) => {
        // --- [BUG_FIX] userProductId is from the authenticated user token
        const { id: creatorId, role, product_id: userProductId } = user;
        console.log(`[ROOM_SERVICE_CREATE] [BUG_FIX] User ${creatorId} (Role: ${role}) authorized. Processing...`);
        
        const db = getDb();
        // --- [BUG_FIX] Explicitly separate productId from body
        const { name, color, password, clientIds, productId: bodyProductId, poIds, adminIds, userIds } = body;
        
        if (!name || !clientIds || !Array.isArray(clientIds) || clientIds.length === 0) {
            console.warn(`[ROOM_SERVICE_CREATE_WARN] Validation failed: 'name' and 'clientIds' (array) are required.`);
            return reject({ statusCode: 400, message: "Room name and at least one Client are required." });
        }

        let roomProductId;
        // --- [BUG_FIX] Secure logic: CTO uses body, others MUST use their token's product_id
        if (role === 'CTO') {
            if (!bodyProductId) {
                console.warn(`[ROOM_SERVICE_CREATE_FAIL] [BUG_FIX] CTO ${creatorId} must specify a productId to create a room.`);
                return reject({ statusCode: 400, message: "Product ID is required for CTO room creation." });
            }
            roomProductId = bodyProductId;
            console.log(`[ROOM_SERVICE_CREATE] [BUG_FIX] CTO creating room under product ${roomProductId}.`);
        } else {
            // Admin and PO *must* create rooms for their own product.
            roomProductId = userProductId; 
            console.log(`[ROOM_SERVICE_CREATE] [BUG_FIX] ${role} creating room under their *own* product: ${roomProductId}.`);
        }
        // --- [END BUG_FIX] ---

        const placeholders = clientIds.map(() => '?').join(',');
        const clientSql = `SELECT COUNT(*) AS count FROM clients WHERE id IN (${placeholders}) AND product_id = ?`;
        
        db.get(clientSql, [...clientIds, roomProductId], async (clientErr, result) => {
            if (clientErr) {
                console.error(`[ROOM_SERVICE_CREATE_ERROR] DB error verifying clients:`, clientErr.message);
                return reject({ statusCode: 500, message: "Error verifying clients." });
            }
            if (result.count !== clientIds.length) {
                console.warn(`[ROOM_SERVICE_CREATE_FAIL] Client validation failed. Found ${result.count} matching clients, expected ${clientIds.length}.`);
                return reject({ statusCode: 403, message: "Forbidden: One or more selected clients do not belong to the chosen product." });
            }
            
            console.log(`[ROOM_SERVICE_CREATE_SUCCESS] All ${clientIds.length} clients verified.`);

            try {
                const roomCode = await generateUniqueRoomCode(db);
                let password_hash = null;
                if (password) {
                    console.log(`[ROOM_SERVICE_CREATE] Password provided. Hashing...`);
                    const salt = await bcrypt.genSalt(10);
                    password_hash = await bcrypt.hash(password, salt);
                }

                const insertRoomSql = `
                    INSERT INTO chat_rooms (product_id, creator_id, name, color, password_hash, room_code, client_id)
                    VALUES (?, ?, ?, ?, ?, ?, NULL)
                `;
                const roomParams = [roomProductId, creatorId, name, color || '#FFFFFF', password_hash, roomCode];
                
                db.serialize(() => {
                    db.run("BEGIN TRANSACTION");
                    db.run(insertRoomSql, roomParams, function (insertErr) {
                        if (insertErr) {
                            console.error(`[ROOM_SERVICE_DB_ERROR] Failed to insert new room:`, insertErr.message);
                            db.run("ROLLBACK");
                            return reject({ statusCode: 500, message: 'Database error creating room.' });
                        }

                        const newRoomId = this.lastID;
                        console.log(`[ROOM_SERVICE_SUCCESS] New room created with ID: ${newRoomId} and Code: ${roomCode}.`);

                        const clientAssignSql = 'INSERT INTO room_client_assignments (room_id, client_id) VALUES (?, ?)';
                        const clientStmt = db.prepare(clientAssignSql);
                        clientIds.forEach(cid => clientStmt.run(newRoomId, cid));
                        clientStmt.finalize();

                        if (role === 'CTO' && Array.isArray(poIds) && poIds.length > 0) {
                            console.log(`[ROOM_SERVICE_CREATE] [BLOCK_2] Role is 'CTO'. Assigning room ${newRoomId} to ${poIds.length} POs.`);
                            const assignPoSql = 'INSERT INTO room_po_assignments (room_id, po_id) VALUES (?, ?)';
                            const poStmt = db.prepare(assignPoSql);
                            poIds.forEach(poId => poStmt.run(newRoomId, poId));
                            poStmt.finalize();
                        } else if (role === 'ProductOwner' && Array.isArray(adminIds) && adminIds.length > 0) {
                            console.log(`[ROOM_SERVICE_CREATE] [BLOCK_2] Role is 'ProductOwner'. Assigning room ${newRoomId} to ${adminIds.length} Admins.`);
                            const assignAdminSql = 'INSERT INTO room_admin_assignments (room_id, admin_id) VALUES (?, ?)';
                            const adminStmt = db.prepare(assignAdminSql);
                            adminIds.forEach(adminId => adminStmt.run(newRoomId, adminId));
                            adminStmt.finalize();
                        } else if (role === 'Administrator' && Array.isArray(userIds) && userIds.length > 0) {
                            console.log(`[ROOM_SERVICE_CREATE] [BLOCK_2] Role is 'Administrator'. Assigning room ${newRoomId} to ${userIds.length} Users.`);
                            const assignUserSql = 'INSERT INTO room_user_assignments (room_id, user_id) VALUES (?, ?)';
                            const userStmt = db.prepare(assignUserSql);
                            userIds.forEach(userId => userStmt.run(newRoomId, userId));
                            userStmt.finalize();
                        }

                        db.run("COMMIT", (commitErr) => {
                            if (commitErr) {
                                console.error('[ROOM_SERVICE_DB_ERROR] Failed to COMMIT room creation transaction:', commitErr.message);
                                db.run("ROLLBACK"); 
                                return reject({ statusCode: 500, message: 'Failed to save room.' });
                            }

                            const returnSql = `
                                SELECT 
                                    cr.id, cr.name, cr.color, cr.room_code,
                                    cr.password_hash IS NOT NULL AS isPasswordProtected,
                                    p.product_name,
                                    GROUP_CONCAT(DISTINCT c.name) AS client_names,
                                    0 AS isDownstreamable,
                                    NULL AS jit_expires_at
                                FROM chat_rooms cr
                                LEFT JOIN room_client_assignments rca ON cr.id = rca.room_id
                                LEFT JOIN clients c ON rca.client_id = c.id
                                LEFT JOIN products p ON cr.product_id = p.id
                                WHERE cr.id = ?
                                GROUP BY cr.id
                            `;
                            db.get(returnSql, [newRoomId], (err, newRoom) => {
                                if(err || !newRoom) {
                                    console.error(`[ROOM_SERVICE_DB_ERROR] Failed to query for new room ${newRoomId}:`, err ? err.message : "Not found");
                                    return resolve({ id: newRoomId, room_code: roomCode });
                                }
                                console.log(`[ROOM_SERVICE_CREATE_SUCCESS] Returning new room object.`);
                                resolve(newRoom);
                            });
                        });
                    });
                });
            } catch (err) {
                console.error(`[ROOM_SERVICE_CREATE_ERROR] Outer catch block:`, err.message);
                reject({ statusCode: 500, message: err.message });
            }
        });
    });
};

/**
 * @desc      Deletes a document from a room
 * @param {object} user - The full user object (id, role, product_id)
 * @param {number} docId - The document ID to delete
 * @returns {Promise<{message: string, roomId: number}>} 
 */
const deleteDocumentLogic = (user, docId) => {
    return new Promise(async (resolve, reject) => {
        const { id: userId, role: userRole, product_id: userProductId } = user;
        const db = getDb();
        console.log(`[ROOM_SERVICE_DELETE_DOC] User ${userId} (Role: ${userRole}) attempting to delete document ${docId}.`);

        try {
            const sqlGetDoc = `
                SELECT 
                    d.file_path, d.room_id, cr.product_id
                FROM documents d
                JOIN chat_rooms cr ON d.room_id = cr.id
                WHERE d.id = ?
            `;
            
            const doc = await new Promise((res, rej) => {
                db.get(sqlGetDoc, [docId], (err, row) => err ? rej(err) : res(row));
            });

            if (!doc) {
                console.warn(`[ROOM_SERVICE_DELETE_DOC_WARN] Document ${docId} not found.`);
                return reject({ statusCode: 404, message: 'Document not found.' });
            }

            if ((userRole === 'Administrator' || userRole === 'ProductOwner') && doc.product_id !== userProductId) {
                console.warn(`[ROOM_SERVICE_DELETE_DOC_FAIL] User ${userId} (Product ${userProductId}) FORBIDDEN to delete doc ${docId} (Product ${doc.product_id}).`);
                return reject({ statusCode: 403, message: 'Forbidden: You do not have permission to delete this document.' });
            }
            
            console.log(`[ROOM_SERVICE_DELETE_DOC_PERMITTED] User ${userId} has permission. Proceeding.`);
            console.log(`[ROOM_SERVICE_DELETE_DOC_CHROMA] Deleting vectors for doc ${docId} from Chroma...`);
            await deleteDocumentFromChroma(docId);
            
            console.log(`[ROOM_SERVICE_DELETE_DOC_SQLITE] Deleting metadata for doc ${docId} from SQLite...`);
            await deleteDocumentById(docId);

            const filePath = path.resolve(__dirname, '..', doc.file_path); 
            console.log(`[ROOM_SERVICE_DELETE_DOC_FS] Deleting file from storage: ${filePath}`);
            try {
                await fs.promises.unlink(filePath);
                console.log(`[ROOM_SERVICE_DELETE_DOC_FS_SUCCESS] File ${filePath} deleted.`);
            } catch (fsErr) {
                console.warn(`[ROOM_SERVICE_DELETE_DOC_FS_WARN] Failed to delete file ${filePath}:`, fsErr.message);
            }

            resolve({ message: 'Document deleted successfully.', roomId: doc.room_id });

        } catch (err) {
            console.error(`[ROOM_SERVICE_DELETE_DOC_ERROR] Critical error:`, err.message);
            reject({ statusCode: 500, message: 'An error occurred during document deletion.' });
        }
    });
};

/**
 * @desc      Edit a room's password
 * @param {object} user - The full user object (id, role)
 * @param {number} roomId - The ID of the room to edit
 * @param {string} password - The new password (or "" to remove)
 * @returns {Promise<{message: string}>}
 */
const editRoomPasswordLogic = (user, roomId, password) => {
    return new Promise(async (resolve, reject) => {
        console.log(`[ROOM_SERVICE_PASS] [BUG_FIX] User ${user.id} (Role: ${user.role}) attempting to change password for room ${roomId}.`);
        const db = getDb();
        try {
            let password_hash = null;
            if (password && password.length > 0) {
                console.log(`[ROOM_SERVICE_PASS] New password provided. Hashing...`);
                const salt = await bcrypt.genSalt(10);
                password_hash = await bcrypt.hash(password, salt);
            } else {
                console.log(`[ROOM_SERVICE_PASS] No password provided. Room will be made public.`);
            }

            let sql = `UPDATE chat_rooms SET password_hash = ? WHERE id = ? `;
            const params = [password_hash, roomId];

            // --- [BUG_FIX] Implement hierarchical edit logic ---
            if (user.role === 'CTO') {
                console.log(`[ROOM_SERVICE_PASS] [BUG_FIX] CTO role confirmed. Granting edit access.`);
                // No additional WHERE clause needed. CTO can edit any room.
            } else if (user.role === 'ProductOwner') {
                console.log(`[ROOM_SERVICE_PASS] [BUG_FIX] PO role confirmed. Checking creator or managed Admin creator.`);
                sql += ` AND (creator_id = ? OR creator_id IN (SELECT id FROM users WHERE manager_id = ? AND role = 'Administrator'))`;
                params.push(user.id, user.id);
            } else if (user.role === 'Administrator') {
                console.log(`[ROOM_SERVICE_PASS] [BUG_FIX] Admin role confirmed. Checking creator.`);
                sql += ` AND creator_id = ?`;
                params.push(user.id);
            } else {
                // This case should be blocked by the controller, but as a safeguard:
                console.warn(`[ROOM_SERVICE_PASS_FAIL] [BUG_FIX] User (Role: ${user.role}) is not authorized to edit passwords.`);
                return reject({ statusCode: 403, message: "You do not have permission to edit this room." });
            }
            // --- [END BUG_FIX] ---

            db.run(sql, params, function (err) {
                if (err) {
                    console.error(`[ROOM_SERVICE_PASS_DB_ERROR] Failed to update password for room ${roomId}:`, err.message);
                    return reject({ statusCode: 500, message: "Database error updating password." });
                }
                if (this.changes === 0) {
                    console.warn(`[ROOM_SERVICE_PASS_FAIL] [BUG_FIX] User ${user.id} failed to update password for room ${roomId}. Not found or not authorized.`);
                    return reject({ statusCode: 403, message: "Failed to update password: You are not authorized to edit this room or the room does not exist." });
                }
                console.log(`[ROOM_SERVICE_PASS_SUCCESS] User ${user.id} successfully updated password for room ${roomId}.`);
                resolve({ message: "Password updated successfully." });
            });

        } catch (err) {
            console.error(`[ROOM_SERVICE_PASS_ERROR] Critical error in editRoomPasswordLogic:`, err.message);
            reject({ statusCode: 500, message: 'Server error updating password.' });
        }
    });
};

module.exports = {
    getRoomsLogic,
    createRoomLogic,
    deleteDocumentLogic,
    editRoomPasswordLogic
};