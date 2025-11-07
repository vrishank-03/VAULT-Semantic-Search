const { getDb } = require('../database');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const fs = require('fs'); // [BUG_3_FIX] Import file system module
const path = require('path'); // [BUG_3_FIX] Import path module

// --- [BUG_3_FIX] Import new helper functions (to be created) ---
const { deleteDocumentFromChroma } = require('../searchService');
const { deleteDocumentById, getDocumentById } = require('../database');
// --- [END BUG_3_FIX] ---


// --- [TASK 15 REFACTOR] ---
// Removed all nodemailer setup and sendEmail function
// Import the new centralized email service
const { sendEmail } = require('../services/emailService');
// --- [END REFACTOR] ---

/**
 * @desc      Get chat rooms based on user's role (User, Admin, ProductOwner)
 * @route     GET /api/rooms
 * @access    Private
 */
const getRooms = (req, res) => {
    // (This function is unchanged)
    console.log(`[ROOM_CTRL] Received GET /api/rooms for user ID: ${req.user.id}`);
    
    const db = getDb();
    const userId = req.user.id;

    console.log(`[ROOM_CTRL] Fetching user details (role, product_id, manager_id) for user ${userId}`);
    const userSql = `SELECT role, product_id, manager_id FROM users WHERE id = ?`;

    db.get(userSql, [userId], (err, user) => {
        if (err) {
            console.error(`[ROOM_CTRL_ERROR] DB error fetching user ${userId}:`, err.message);
            return res.status(500).json({ message: "Error fetching user data." });
        }
        if (!user) {
            console.warn(`[ROOM_CTRL_WARN] User ${userId} not found.`);
            return res.status(404).json({ message: "User not found." });
        }

        console.log(`[ROOM_CTRL] User ${userId} is Role: ${user.role}, ProductID: ${user.product_id}, ManagerID: ${user.manager_id}`);

        let roomSql = ``;
        const params = [];

        const baseSelect = `
            SELECT DISTINCT
                cr.id, cr.name, cr.color, cr.client_id,
                cr.password_hash IS NOT NULL AS isPasswordProtected,
                c.name AS client_name, 
                p.product_name
            FROM chat_rooms cr
            LEFT JOIN clients c ON cr.client_id = c.id
            LEFT JOIN products p ON cr.product_id = p.id
        `;

        if (user.role === 'CTO') {
            console.log(`[ROOM_CTRL] User is 'CTO'. Fetching ALL rooms (full access).`);
            roomSql = `${baseSelect} ORDER BY p.product_name, c.name, cr.name`;
        
        } else if (user.role === 'ProductOwner') {
            console.log(`[ROOM_CTRL] User is 'ProductOwner'. Fetching rooms they created OR rooms assigned to them (and unblocked).`);
            roomSql = `
                ${baseSelect}
                LEFT JOIN room_po_assignments rpa ON cr.id = rpa.room_id
                WHERE
                    cr.creator_id = ? 
                    OR
                    (rpa.po_id = ? AND rpa.is_unblocked = 1)
                ORDER BY p.product_name, c.name, cr.name
            `;
            params.push(userId, userId);
        
        } else if (user.role === 'Administrator') {
            console.log(`[ROOM_CTRL] User is 'Administrator'. Fetching rooms they created OR rooms assigned to them by a PO.`);
            roomSql = `
                ${baseSelect}
                LEFT JOIN room_admin_assignments raa ON cr.id = raa.room_id
                WHERE
                    cr.creator_id = ? 
                    OR
                    raa.admin_id = ?
                ORDER BY p.product_name, c.name, cr.name
            `;
            params.push(userId, userId);
        
        } else if (user.role === 'User') {
            console.log(`[ROOM_CTRL] User is 'User'. Checking for Manager ID: ${user.manager_id}`);
            if (!user.manager_id) {
                console.log(`[ROOM_CTRL] User has no manager_id, returning 0 rooms.`);
                return res.status(200).json([]);
            }
            
            console.log(`[ROOM_CTRL] User is 'User'. Fetching rooms created by their Admin (${user.manager_id}) OR rooms assigned to their Admin.`);
            roomSql = `
                ${baseSelect}
                LEFT JOIN room_admin_assignments raa ON cr.id = raa.room_id
                WHERE
                    cr.creator_id = ? 
                    OR
                    raa.admin_id = ?
                ORDER BY p.product_name, c.name, cr.name
            `;
            params.push(user.manager_id, user.manager_id);
        
        } else {
            console.warn(`[ROOM_CTRL_WARN] Unknown role '${user.role}' for user ${userId}. Returning no rooms.`);
            return res.status(200).json([]);
        }

        console.log(`[ROOM_CTRL_DB] Executing: ${roomSql} with params: [${params.join(',')}]`);
        db.all(roomSql, params, (roomErr, rooms) => {
            if (roomErr) {
                console.error(`[ROOM_CTRL_DB_ERROR] DB error fetching rooms:`, roomErr.message);
                return res.status(500).json({ message: "Error fetching chat rooms." });
            }

            console.log(`[ROOM_CTRL_SUCCESS] Found ${rooms.length} rooms.`);
            const finalRooms = rooms.map(r => ({
                id: r.id,
                name: r.name,
                color: r.color,
                isPasswordProtected: r.isPasswordProtected === 1,
                client_id: r.client_id,
                client_name: r.client_name,
                product_name: r.product_name
            }));
            res.status(200).json(finalRooms);
        });
    });
};

/**
 * @desc      Create a new chat room
 * @route     POST /api/rooms
 * @access    Private (Admin, PO, CTO)
 */
const createRoom = async (req, res) => {
    // (This function is unchanged)
    console.log(`[ROOM_CTRL_CREATE] Received POST /api/rooms from user ID: ${req.user.id}`);
    
    const db = getDb();
    const creatorId = req.user.id;

    console.log(`[ROOM_CTRL_CREATE] Fetching user role for user ${creatorId}`);
    const userSql = `SELECT role, product_id, manager_id FROM users WHERE id = ?`;

    db.get(userSql, [creatorId], async (userErr, user) => {
        if (userErr) {
            console.error(`[ROOM_CTRL_CREATE_ERROR] DB error fetching user ${creatorId}:`, userErr.message);
            return res.status(500).json({ message: "Error fetching user data." });
        }
        if (!user) {
            console.warn(`[ROOM_CTRL_CREATE_WARN] User ${creatorId} not found.`);
            return res.status(404).json({ message: "User not found." });
        }

        const allowedRoles = ['Administrator', 'ProductOwner', 'CTO'];
        if (!allowedRoles.includes(user.role)) {
            console.warn(`[ROOM_CTRL_CREATE_FAIL] User ${creatorId} (Role: ${user.role}) tried to create a room. Forbidden.`);
            return res.status(403).json({ message: "Forbidden: You do not have permission to create rooms." });
        }

        console.log(`[ROOM_CTRL_CREATE_SUCCESS] User ${creatorId} (Role: ${user.role}) is authorized. Processing...`);

        const { name, color, password, client_id, adminIds, poIds } = req.body;
        if (!name || !client_id) {
            console.warn(`[ROOM_CTRL_CREATE_WARN] Validation failed: Room 'name' and 'client_id' are required.`);
            return res.status(400).json({ message: "Room name and Client are required." });
        }

        console.log(`[ROOM_CTRL_CREATE] Verifying client ${client_id}`);
        const clientSql = `SELECT product_id FROM clients WHERE id = ?`;
        
        db.get(clientSql, [client_id], async (clientErr, client) => {
            if (clientErr) {
                console.error(`[ROOM_CTRL_CREATE_ERROR] DB error fetching client ${client_id}:`, clientErr.message);
                return res.status(500).json({ message: "Error verifying client." });
            }
            if (!client) {
                console.warn(`[ROOM_CTRL_CREATE_WARN] Client ID ${client_id} not found.`);
                return res.status(404).json({ message: "Client not found." });
            }
            
            if (user.role === 'Administrator' && client.product_id !== user.product_id) {
                console.warn(`[ROOM_CTRL_CREATE_FAIL] Admin ${creatorId} for product ${user.product_id} tried to create a room for client ${client_id} (Product ${client.product_id}). Forbidden.`);
                return res.status(403).json({ message: "Forbidden: You can only create rooms for clients within your own product." });
            }
            
            console.log(`[ROOM_CTRL_CREATE_SUCCESS] Access to client ${client_id} (Product ${client.product_id}) verified.`);

            let password_hash = null;
            if (password) {
                console.log(`[ROOM_CTRL_CREATE] Password provided. Hashing...`);
                const salt = await bcrypt.genSalt(10);
                password_hash = await bcrypt.hash(password, salt);
                console.log(`[ROOM_CTRL_CREATE] Password hashed successfully.`);
            } else {
                console.log(`[ROOM_CTRL_CREATE] No password provided. Room will be public.`);
            }
            
            const roomProductId = client.product_id; 
            
            const insertSql = `
                INSERT INTO chat_rooms (client_id, product_id, creator_id, name, color, password_hash)
                VALUES (?, ?, ?, ?, ?, ?)
            `;
            const params = [client_id, roomProductId, creatorId, name, color || '#FFFFFF', password_hash];

            console.log(`[ROOM_CTRL_DB] Executing insert for client ${client_id} with params: [${client_id}, ${roomProductId}, ${creatorId}, ${name}, ${color}, ${password_hash ? '***' : null}]`);

            db.run(insertSql, params, function (insertErr) {
                if (insertErr) {
                    console.error(`[ROOM_CTRL_DB_ERROR] Failed to insert new room:`, insertErr.message);
                    return res.status(500).json({ message: 'Database error creating room.' });
                }

                const newRoomId = this.lastID;
                console.log(`[ROOM_CTRL_SUCCESS] New room created with ID: ${newRoomId}.`);

                if (user.role === 'ProductOwner' && Array.isArray(adminIds) && adminIds.length > 0) {
                    console.log(`[ROOM_CTRL_CREATE] Role is 'ProductOwner'. Assigning room ${newRoomId} to ${adminIds.length} admins.`);
                    const assignAdminSql = 'INSERT INTO room_admin_assignments (room_id, admin_id) VALUES (?, ?)';
                    
                    const stmt = db.prepare(assignAdminSql, (prepErr) => {
                        if (prepErr) {
                             console.error(`[ROOM_CTRL_DB_ERROR] Failed to prepare admin assignment statement:`, prepErr.message);
                             return;
                        }
                        adminIds.forEach(adminId => {
                            console.log(`[ROOM_CTRL_CREATE_DB] Assigning room ${newRoomId} to admin ${adminId}`);
                            stmt.run(newRoomId, adminId, (assignErr) => {
                                if (assignErr) {
                                    console.error(`[ROOM_CTRL_DB_ERROR] Failed to assign room ${newRoomId} to admin ${adminId}:`, assignErr.message);
                                }
                            });
                        });
                        stmt.finalize();
                    });
                
                } else if (user.role === 'CTO' && Array.isArray(poIds) && poIds.length > 0) {
                    console.log(`[ROOM_CTRL_CREATE] Role is 'CTO'. Assigning room ${newRoomId} to ${poIds.length} POs (default: blocked).`);
                    const assignPoSql = 'INSERT INTO room_po_assignments (room_id, po_id, is_unblocked) VALUES (?, ?, 0)';

                    const stmt = db.prepare(assignPoSql, (prepErr) => {
                        if (prepErr) {
                             console.error(`[ROOM_CTRL_DB_ERROR] Failed to prepare PO assignment statement:`, prepErr.message);
                             return;
                        }
                        poIds.forEach(poId => {
                            console.log(`[ROOM_CTRL_CREATE_DB] Assigning room ${newRoomId} to PO ${poId}`);
                            stmt.run(newRoomId, poId, (assignErr) => {
                                if (assignErr) {
                                    console.error(`[ROOM_CTRL_DB_ERROR] Failed to assign room ${newRoomId} to PO ${poId}:`, assignErr.message);
                                }
                            });
                        });
                        stmt.finalize();
                    });
                
                } else if (user.role === 'Administrator') {
                     console.log(`[ROOM_CTRL_CREATE] Role is 'Administrator'. No extra assignments needed.`);
                }

                const returnSql = `
                    SELECT 
                        cr.id, cr.name, cr.color, cr.client_id,
                        cr.password_hash IS NOT NULL AS isPasswordProtected,
                        c.name AS client_name, 
                        p.product_name
                    FROM chat_rooms cr
                    JOIN clients c ON cr.client_id = c.id
                    JOIN products p ON c.product_id = p.id
                    WHERE cr.id = ?
                `;
                db.get(returnSql, [newRoomId], (err, newRoom) => {
                    if(err || !newRoom) {
                        console.error(`[ROOM_CTRL_DB_ERROR] Failed to query for new room ${newRoomId}:`, err ? err.message : "Not found");
                        return res.status(201).json({ id: newRoomId });
                    }
                    res.status(201).json(newRoom);
                });
            });
        });
    });
};

/**
 * @desc      Logs a user entry into a chat room
 * @route     POST /api/rooms/log-entry/:roomId
 * @access    Private
 */
const logRoomEntry = (req, res) => {
    // (This function is unchanged)
    const { roomId } = req.params;
    const userId = req.user.id;
    console.log(`[ROOM_LOG_CTRL] Received log-entry for user ${userId} in room ${roomId}`);

    const db = getDb();
    
    const sql = `INSERT INTO room_session_logs (user_id, room_id, login_timestamp) VALUES (?, ?, ?)`;
    const params = [userId, roomId, new Date().toISOString()];

    console.log(`[ROOM_LOG_DB] Executing: ${sql} with params: [${userId}, ${roomId}, ...]`);

    db.run(sql, params, function(err) {
        if (err) {
            console.error(`[ROOM_LOG_DB_ERROR] Failed to log room entry:`, err.message);
            return res.status(500).json({ message: "Failed to create log entry." });
        }
        
        const logId = this.lastID;
        console.log(`[ROOM_LOG_SUCCESS] Logged session entry with ID: ${logId}`);
        
        res.status(201).json({ sessionLogId: logId });
    });
};

/**
 * @desc      Unblocks a CTO-assigned room (for POs)
 * @route     PUT /api/rooms/unblock/:roomId
 * @access    Private (ProductOwner only)
 */
const unblockRoom = async (req, res) => {
    // (This function is unchanged)
    const { roomId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    console.log(`[ROOM_UNBLOCK_CTRL] Received unblock request for room ${roomId} from user ${userId} (Role: ${userRole})`);

    const db = getDb();
    const sql = `
        UPDATE room_po_assignments
        SET is_unblocked = 1
        WHERE room_id = ? AND po_id = ?
    `;
    const params = [roomId, userId];

    console.log(`[ROOM_UNBLOCK_DB] Executing SQL: ${sql} with params: [${roomId}, ${userId}]`);

    db.run(sql, params, function(err) {
        if (err) {
            console.error(`[ROOM_UNBLOCK_DB_ERROR] Failed to unblock room ${roomId} for PO ${userId}:`, err.message);
            return res.status(500).json({ message: "Database error while unblocking room." });
        }

        if (this.changes === 0) {
            console.warn(`[ROOM_UNBLOCK_WARN] No room assignment found for room ${roomId} and PO ${userId}. No changes made.`);
            return res.status(404).json({ message: "Room assignment not found or already unblocked." });
        }

        console.log(`[ROOM_UNBLOCK_SUCCESS] Successfully unblocked room ${roomId} for PO ${userId}. Rows affected: ${this.changes}`);
        res.status(200).json({ message: "Room unblocked successfully." });
    });
};

/**
 * @desc      Checks if a user has permission to join a room
 * @route     POST /api/rooms/join/:roomId
 * @access    Private
 */
const joinRoom = async (req, res) => {
    // [TASK 15 BUG FIX] This function is now correct
    const { roomId } = req.params;
    const { id: userId, role: userRole, manager_id: userManagerId } = req.user;

    console.log(`[ROOM_JOIN_CTRL] User ${userId} (Role: ${userRole}) attempting to join room ${roomId}`);

    if (userRole === 'CTO') {
        console.log(`[ROOM_JOIN_CTO_ACCESS] User is CTO. Access granted.`);
        return res.json({ status: 'granted' });
    }

    const db = getDb();

    const sqlRoomInfo = `
        SELECT
            cr.creator_id,
            creator.role AS creator_role,
            creator.manager_id AS creator_manager_id
        FROM chat_rooms cr
        LEFT JOIN users creator ON cr.creator_id = creator.id
        WHERE cr.id = ?
    `;

    console.log(`[ROOM_JOIN_DB] Fetching room/creator info for room ${roomId}`);
    db.get(sqlRoomInfo, [roomId], (err, roomInfo) => {
        if (err) {
            console.error(`[ROOM_JOIN_DB_ERROR] Failed to fetch room info:`, err.message);
            return res.status(500).json({ status: 'error', message: 'Database error' });
        }

        if (!roomInfo) {
            console.warn(`[ROOM_JOIN_ERROR_NOT_FOUND] Room ${roomId} not found.`);
            return res.status(404).json({ status: 'denied', message: 'Room not found' });
        }

        console.log(`[ROOM_JOIN_DATA] UserMgr: ${userManagerId}. CreatorID: ${roomInfo.creator_id}, CreatorRole: ${roomInfo.creator_role}, CreatorMgr: ${roomInfo.creator_manager_id}`);

        if (userId === roomInfo.creator_id) {
            console.log(`[ROOM_JOIN_SELF_ACCESS] User is the room creator. Access granted.`);
            return res.json({ status: 'granted' });
        }

        if (userRole === 'ProductOwner' && roomInfo.creator_role === 'Administrator' && roomInfo.creator_manager_id === userId) {
            console.log(`[ROOM_JOIN_PO_TO_ADMIN_ACCESS] User is PO, joining their direct Admin's room. Access granted.`);
            return res.json({ status: 'granted' });
        }

        const checkAndCreateJitRequest = (ownerId) => {
            const sqlCheck = `
                SELECT id, status, expires_at 
                FROM room_access_requests 
                WHERE room_id = ? AND requester_id = ? AND owner_id = ?
                ORDER BY updated_at DESC
                LIMIT 1
            `;
            const paramsCheck = [roomId, userId, ownerId];
            
            console.log(`[ROOM_JOIN_DB_CHECK] Checking JIT request status. SQL: ${sqlCheck} Params: [${paramsCheck.join(',')}]`);
            const now = new Date().toISOString();

            db.get(sqlCheck, paramsCheck, (errCheck, request) => {
                if (errCheck) {
                    console.error(`[ROOM_JOIN_DB_ERROR] Failed to check for access request:`, errCheck.message);
                    return res.status(500).json({ status: 'error', message: 'Database error checking access' });
                }

                if (request) {
                    console.log(`[ROOM_JOIN_DB_CHECK] Found existing request ${request.id} with status: ${request.status}, expires: ${request.expires_at}`);
                    
                    if (request.status === 'approved') {
                        if (request.expires_at === null || request.expires_at > now) {
                            console.log(`[ROOM_JOIN_JIT_GRANTED] Access is approved and valid. Access granted.`);
                            return res.json({ status: 'granted' });
                        } else {
                            console.log(`[ROOM_JOIN_JIT_EXPIRED] Access for request ${request.id} expired at ${request.expires_at}. Resetting to pending.`);
                            const sqlUpdate = `UPDATE room_access_requests SET status = 'pending', expires_at = NULL, updated_at = ? WHERE id = ?`;
                            db.run(sqlUpdate, [now, request.id], (errUpdate) => {
                                if (errUpdate) {
                                    console.error(`[ROOM_JOIN_DB_ERROR] Failed to reset expired request ${request.id}:`, errUpdate.message);
                                    return res.status(500).json({ status: 'error', message: 'Database error' });
                                }
                                console.log(`[ROOM_JOIN_JIT_RESET] Request ${request.id} reset to pending.`);
                                return res.json({ status: 'pending' });
                            });
                        }
                    } else if (request.status === 'pending') {
                        console.log(`[ROOM_JOIN_JIT_PENDING] Access request ${request.id} is already pending.`);
                        return res.json({ status: 'pending' });
                    } else if (request.status === 'rejected') {
                        console.log(`[ROOM_JOIN_JIT_REJECTED] Access request ${request.id} was rejected.`);
                        return res.json({ status: 'rejected' });
                    }
                } else {
                    console.log(`[ROOM_JOIN_DB_INSERT] No valid/pending request found. Creating new pending request.`);
                    const sqlInsert = `
                        INSERT INTO room_access_requests (room_id, requester_id, owner_id, status, created_at, updated_at)
                        VALUES (?, ?, ?, 'pending', ?, ?)
                    `;
                    const paramsInsert = [roomId, userId, ownerId, now, now];

                    db.run(sqlInsert, paramsInsert, function(errInsert) {
                        if (errInsert) {
                            console.error(`[ROOM_JOIN_DB_ERROR] Failed to create new pending request:`, errInsert.message);
                            return res.status(500).json({ status: 'error', message: 'Database error creating request' });
                        }
                        console.log(`[ROOM_JOIN_JIT_CREATED] New pending request created with ID: ${this.lastID}.`);
                        return res.json({ status: 'pending' });
                    });
                }
            });
        };

        if (userRole === 'User') {
            if (roomInfo.creator_id === userManagerId) {
                console.log(`[ROOM_JOIN_USER_DIRECT_ACCESS] User's direct manager created the room. Access granted.`);
                return res.json({ status: 'granted' });
            }
            
            console.log(`[ROOM_JOIN_DB] Checking transitive access for User ${userId} via Admin ${userManagerId} for room ${roomId}`);
            const sqlUserTransitive = `SELECT 1 FROM room_admin_assignments WHERE room_id = ? AND admin_id = ? LIMIT 1`;
            db.get(sqlUserTransitive, [roomId, userManagerId], (transitiveErr, assignment) => {
                if (transitiveErr) {
                    console.error(`[ROOM_JOIN_DB_ERROR] Failed to check transitive access:`, transitiveErr.message);
                    return res.status(500).json({ status: 'error', message: 'Database error' });
                }

                if (assignment) {
                    console.log(`[ROOM_JOIN_USER_TRANSITIVE_ACCESS] Room was assigned to user's manager. Access granted.`);
                    return res.json({ status: 'granted' });
                } else {
                    console.warn(`[ROOM_JOIN_JIT_TRIGGER] User ${userId} has no direct access. Triggering JIT flow to room owner ${roomInfo.creator_id}.`);
                    checkAndCreateJitRequest(roomInfo.creator_id);
                    return;
                }
            });
            return; 
        }

        if (userRole === 'Administrator' && roomInfo.creator_role === 'Administrator') {
            console.log(`[ROOM_JOIN_ADMIN_PEER_ACCESS] Admin ${userId} attempting to join peer Admin's (${roomInfo.creator_id}) room. Checking JIT access...`);
            checkAndCreateJitRequest(roomInfo.creator_id);
            return;
        }

        if (userRole === 'ProductOwner' && roomInfo.creator_role === 'ProductOwner') {
            console.log(`[ROOM_JOIN_PO_PEER_ACCESS] PO ${userId} attempting to join peer PO's (${roomInfo.creator_id}) room. Checking JIT access...`);
            checkAndCreateJitRequest(roomInfo.creator_id);
            return;
        }

        console.log(`[ROOM_JOIN_FALLBACK_ACCESS] No specific rules matched. Granting access based on visibility from getRooms.`);
        return res.json({ status: 'granted' });
    });
};

/**
 * @desc      Get all pending access requests for the logged-in user
 * @route     GET /api/rooms/requests/pending
 * @access    Private (Admin, PO)
 */
const getPendingRequests = async (req, res) => {
    // (This function is unchanged)
    const { id: userId, role: userRole } = req.user;
    console.log(`[ROOM_REQUESTS_GET] User ${userId} (Role: ${userRole}) fetching pending requests.`);

    if (userRole !== 'Administrator' && userRole !== 'ProductOwner') {
         console.warn(`[ROOM_REQUESTS_GET_FAIL] User ${userId} (Role: ${userRole}) tried to fetch requests. Forbidden.`);
         return res.status(403).json({ message: "Forbidden: You do not have permission to view access requests." });
    }
    
    const db = getDb();
    const sql = `
        SELECT 
            rar.id, 
            rar.room_id, 
            rar.requester_id,
            rar.created_at,
            u.email as requester_email,
            cr.name as room_name
        FROM room_access_requests rar
        JOIN users u ON rar.requester_id = u.id
        JOIN chat_rooms cr ON rar.room_id = cr.id
        WHERE rar.owner_id = ? AND rar.status = 'pending'
        ORDER BY rar.created_at DESC
    `;
    
    console.log(`[ROOM_REQUESTS_DB] Executing: ${sql} with param: [${userId}]`);
    db.all(sql, [userId], (err, requests) => {
        if (err) {
            console.error(`[ROOM_REQUESTS_DB_ERROR] Failed to fetch pending requests for user ${userId}:`, err.message);
            return res.status(500).json({ message: "Database error fetching requests." });
        }
        
        console.log(`[ROOM_REQUESTS_SUCCESS] Found ${requests.length} pending requests for user ${userId}.`);
        res.status(200).json(requests);
    });
};

/**
 * @desc      Approve a pending access request
 * @route     PUT /api/rooms/requests/approve/:requestId
 * @access    Private (Admin, PO)
 */
const approveRequest = async (req, res) => {
    // (This function is unchanged)
    const { id: userId, role: userRole } = req.user;
    const { requestId } = req.params;
    const { duration } = req.body;
    
    console.log(`[ROOM_REQUESTS_APPROVE] User ${userId} (Role: ${userRole}) attempting to approve request ${requestId} with duration: ${duration}`);

    let expires_at = null;
    const now = new Date();
    
    if (duration === '4h') {
        expires_at = new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString();
        console.log(`[ROOM_REQUESTS_APPROVE] Calculated 4h expiration: ${expires_at}`);
    } else if (duration === '1d') {
        expires_at = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
        console.log(`[ROOM_REQUESTS_APPROVE] Calculated 1d expiration: ${expires_at}`);
    } else {
        console.log(`[ROOM_REQUESTS_APPROVE] No valid duration provided. Access will be permanent (expires_at = NULL).`);
    }

    const updated_at = now.toISOString();
    const db = getDb();

    const sqlGet = `
        SELECT 
            rar.status, rar.owner_id,
            u.email AS requester_email,
            cr.name AS room_name
        FROM room_access_requests rar
        JOIN users u ON rar.requester_id = u.id
        JOIN chat_rooms cr ON rar.room_id = cr.id
        WHERE rar.id = ?
    `;
    console.log(`[ROOM_REQUESTS_DB] Fetching request info for request ${requestId}`);
    db.get(sqlGet, [requestId], (getErr, request) => {
        if (getErr) {
            console.error(`[ROOM_REQUESTS_DB_ERROR] Failed to fetch request ${requestId}:`, getErr.message);
            return res.status(500).json({ message: "Database error." });
        }
        if (!request) {
            console.warn(`[ROOM_REQUESTS_APPROVE_FAIL] Request ${requestId} not found.`);
            return res.status(404).json({ message: "Request not found." });
        }
        if (request.owner_id !== userId) {
            console.warn(`[ROOM_REQUESTS_APPROVE_FAIL] User ${userId} is not the owner of request ${requestId}.`);
            return res.status(403).json({ message: "You are not authorized to approve this request." });
        }
        if (request.status !== 'pending') {
            console.warn(`[ROOM_REQUESTS_APPROVE_FAIL] Request ${requestId} is not pending (Status: ${request.status}).`);
            return res.status(400).json({ message: `Request is not pending (Status: ${request.status}).` });
        }

        const sql = `
            UPDATE room_access_requests 
            SET status = 'approved', expires_at = ?, updated_at = ?
            WHERE id = ? AND owner_id = ? AND status = 'pending'
        `;
        const params = [expires_at, updated_at, requestId, userId];

        console.log(`[ROOM_REQUESTS_DB] Executing: ${sql} with params: [${expires_at}, ${updated_at}, ${requestId}, ${userId}]`);
        
        db.run(sql, params, function(err) {
            if (err) {
                console.error(`[ROOM_REQUESTS_DB_ERROR] Failed to approve request ${requestId}:`, err.message);
                return res.status(500).json({ message: "Database error approving request." });
            }
            
            if (this.changes === 0) {
                console.warn(`[ROOM_REQUESTS_APPROVE_FAIL] No matching pending request found for ID ${requestId} and owner ${userId} (this should not happen).`);
                return res.status(404).json({ message: "Request not found or you are not authorized to approve it." });
            }
            
            console.log(`[ROOM_REQUESTS_APPROVE_SUCCESS] Request ${requestId} approved by user ${userId}. Rows affected: ${this.changes}`);
            
            const durationText = duration === '4h' ? "for 4 hours" : (duration === '1d' ? "for 24 hours" : "permanently");
            console.log(`[ROOM_REQUESTS_EMAIL] Sending approval email to ${request.requester_email}`);
            sendEmail(
                request.requester_email,
                "Your Room Access Request was Approved",
                `<h3>Access Granted</h3>
                 <p>Your request to access the room "<strong>${request.room_name}</strong>" has been <strong>approved</strong>.</p>
                 <p>Access has been granted ${durationText}.</p>
                 <a href="${process.env.FRONTEND_URL}/dashboard" style="background-color:#2563eb;color:white;padding:12px 20px;text-align:center;text-decoration:none;display:inline-block;border-radius:8px;font-size:16px;">Go to Dashboard</a>`
            );

            res.status(200).json({ message: "Request approved successfully." });
        });
    });
};

/**
 * @desc      Reject a pending access request
 * @route     PUT /api/rooms/requests/reject/:requestId
 * @access    Private (Admin, PO)
 */
const rejectRequest = async (req, res) => {
    // (This function is unchanged)
    const { id: userId, role: userRole } = req.user;
    const { requestId } = req.params;
    
    console.log(`[ROOM_REQUESTS_REJECT] User ${userId} (Role: ${userRole}) attempting to reject request ${requestId}`);
    
    const updated_at = new Date().toISOString();
    const db = getDb();

    const sqlGet = `
        SELECT 
            rar.status, rar.owner_id,
            u.email AS requester_email,
            cr.name AS room_name
        FROM room_access_requests rar
        JOIN users u ON rar.requester_id = u.id
        JOIN chat_rooms cr ON rar.room_id = cr.id
        WHERE rar.id = ?
    `;
    console.log(`[ROOM_REQUESTS_DB] Fetching request info for request ${requestId}`);
    db.get(sqlGet, [requestId], (getErr, request) => {
        if (getErr) {
            console.error(`[ROOM_REQUESTS_DB_ERROR] Failed to fetch request ${requestId}:`, getErr.message);
            return res.status(500).json({ message: "Database error." });
        }
        if (!request) {
            console.warn(`[ROOM_REQUESTS_REJECT_FAIL] Request ${requestId} not found.`);
            return res.status(404).json({ message: "Request not found." });
        }
        if (request.owner_id !== userId) {
            console.warn(`[ROOM_REQUESTS_REJECT_FAIL] User ${userId} is not the owner of request ${requestId}.`);
            return res.status(403).json({ message: "You are not authorized to reject this request." });
        }
        if (request.status !== 'pending') {
            console.warn(`[ROOM_REQUESTS_REJECT_FAIL] Request ${requestId} is not pending (Status: ${request.status}).`);
            return res.status(400).json({ message: `Request is not pending (Status: ${request.status}).` });
        }

        const sql = `
            UPDATE room_access_requests 
            SET status = 'rejected', updated_at = ?
            WHERE id = ? AND owner_id = ? AND status = 'pending'
        `;
        const params = [updated_at, requestId, userId];

        console.log(`[ROOM_REQUESTS_DB] Executing: ${sql} with params: [${updated_at}, ${requestId}, ${userId}]`);

        db.run(sql, params, function(err) {
            if (err) {
                console.error(`[ROOM_REQUESTS_DB_ERROR] Failed to reject request ${requestId}:`, err.message);
                return res.status(500).json({ message: "Database error rejecting request." });
            }
            
            if (this.changes === 0) {
                console.warn(`[ROOM_REQUESTS_REJECT_FAIL] No matching pending request found for ID ${requestId} and owner ${userId} (this should not happen).`);
                return res.status(404).json({ message: "Request not found or you are not authorized to reject it." });
            }
            
            console.log(`[ROOM_REQUESTS_REJECT_SUCCESS] Request ${requestId} rejected by user ${userId}. Rows affected: ${this.changes}`);
            
            console.log(`[ROOM_REQUESTS_EMAIL] Sending rejection email to ${request.requester_email}`);
            sendEmail(
                request.requester_email,
                "Your Room Access Request was Rejected",
                `<h3>Access Denied</h3>
                 <p>Your request to access the room "<strong>${request.room_name}</strong>" has been <strong>rejected</strong> by the owner.</p>
                 <p>If you believe this is an error, please contact the room owner directly.</p>`
            );

            res.status(200).json({ message: "Request rejected successfully." });
        });
    });
};


// --- [BUG_3_FIX] NEW FUNCTION ---
/**
 * @desc      Deletes a document from a room
 * @route     DELETE /api/rooms/documents/:docId
 * @access    Private (Admin, PO, CTO)
 */
const deleteDocument = async (req, res) => {
    const { docId } = req.params;
    const { id: userId, role: userRole, product_id: userProductId } = req.user;
    const db = getDb();

    console.log(`[DELETE_DOC] User ${userId} (Role: ${userRole}) attempting to delete document ${docId}.`);

    try {
        // --- Step 1: Get Doc Info & Verify Permissions ---
        // We MUST join to get the product_id for permission checking
        const sqlGetDoc = `
            SELECT 
                d.file_path, 
                d.room_id, 
                cr.product_id
            FROM documents d
            JOIN chat_rooms cr ON d.room_id = cr.id
            WHERE d.id = ?
        `;
        
        // We must use a promise-based wrapper or db.get to use await
        const doc = await new Promise((resolve, reject) => {
            db.get(sqlGetDoc, [docId], (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });

        if (!doc) {
            console.warn(`[DELETE_DOC_WARN] Document ${docId} not found.`);
            return res.status(404).json({ message: 'Document not found.' });
        }

        // --- Step 2: Permission Check ---
        // CTOs can delete anything. Admins/POs can only delete within their own product.
        if (userRole === 'Administrator' || userRole === 'ProductOwner') {
            if (doc.product_id !== userProductId) {
                console.warn(`[DELETE_DOC_FAIL] User ${userId} (Product ${userProductId}) FORBIDDEN to delete doc ${docId} (Product ${doc.product_id}).`);
                return res.status(403).json({ message: 'Forbidden: You do not have permission to delete this document.' });
            }
        }
        console.log(`[DELETE_DOC_PERMITTED] User ${userId} has permission. Proceeding with deletion of doc ${docId}.`);

        // --- Step 3: Delete from ChromaDB ---
        console.log(`[DELETE_DOC_CHROMA] Deleting vectors for doc ${docId} from Chroma...`);
        const chromaResult = await deleteDocumentFromChroma(docId);
        console.log(`[DELETE_DOC_CHROMA_SUCCESS] ${chromaResult.deletedCount} vectors deleted from Chroma.`);

        // --- Step 4: Delete from SQLite ---
        console.log(`[DELETE_DOC_SQLITE] Deleting metadata for doc ${docId} from SQLite...`);
        await deleteDocumentById(docId);
        console.log(`[DELETE_DOC_SQLITE_SUCCESS] Metadata deleted from SQLite.`);

        // --- Step 5: Delete from File System ---
        const filePath = path.resolve(__dirname, '..', doc.file_path); // e.g., ../storage/doc-123.pdf
        console.log(`[DELETE_DOC_FS] Deleting file from storage: ${filePath}`);
        
        try {
            await fs.promises.unlink(filePath);
            console.log(`[DELETE_DOC_FS_SUCCESS] File ${filePath} deleted.`);
        } catch (fsErr) {
            // This is a non-critical error. The data is gone, which is most important.
            // We log a warning but still send success to the user.
            console.warn(`[DELETE_DOC_FS_WARN] Failed to delete file ${filePath} for doc ${docId}. Data is cleared, but file remains. Error:`, fsErr.message);
        }

        // --- Step 6: Send Success Response ---
        res.status(200).json({ message: 'Document deleted successfully.' });

    } catch (err) {
        console.error(`[DELETE_DOC_ERROR] A critical error occurred while deleting document ${docId}:`, err.message);
        res.status(500).json({ message: 'An error occurred during document deletion.' });
    }
};
// --- [END BUG_3_FIX] ---


module.exports = {
    getRooms,
    createRoom,
    logRoomEntry,
    unblockRoom,
    joinRoom,
    getPendingRequests,
    approveRequest,
    rejectRequest,
    deleteDocument // [BUG_3_FIX] Export new controller function
};