// backend/controllers/roomController.js

const roomService = require('../services/roomService');
const accessService = require('../services/accessService');
const logService = require('../services/logService');
const { getDb } = require('../database'); // Still needed for user lookup

/**
 * @desc      Get chat rooms based on user's role (FOR 'User' ROLE or flat list)
 * @route     GET /api/rooms
 * @access    Private
 */
const getRooms = async (req, res) => {
    console.log(`[ROOM_CTRL] Received GET /api/rooms for user ID: ${req.user.id}`);
    try {
        const db = getDb();
        const user = await new Promise((resolve, reject) => {
             db.get(`SELECT id, role, product_id, manager_id FROM users WHERE id = ?`, [req.user.id], (err, row) => {
                if (err) return reject(new Error("DB error fetching user"));
                if (!row) return reject(new Error("User not found"));
                resolve(row);
            });
        });
        
        const rooms = await roomService.getRoomsLogic(user);
        res.status(200).json(rooms);
    } catch (error) {
        console.error(`[ROOM_CTRL_ERROR] Error in getRooms:`, error.message);
        res.status(error.statusCode || 500).json({ message: error.message || "Server error" });
    }
};

// --- [BLOCK 6] NEW HIERARCHICAL DASHBOARD FUNCTION ---
/**
 * @desc      Get all rooms for a specific client, with access level
 * @route     GET /api/rooms/client/:clientId
 * @access    Private (CTO, PO, Admin)
 */
const getRoomsForClient = async (req, res) => {
    const { clientId } = req.params;
    const { user } = req;
    const db = getDb();

    console.log(`[ROOM_CTRL_GET_CLIENT] User ${user.id} (Role: ${user.role}) fetching rooms for Client ${clientId}`);

    try {
        // 1. Get all rooms for this client
        const allRoomsSql = `
            SELECT cr.id, cr.name, cr.color, cr.room_code, cr.product_id,
                   cr.password_hash IS NOT NULL AS isPasswordProtected,
                   cr.creator_id,
                   raa.admin_id,
                   rua.user_id,
                   rar_jit.expires_at AS jit_expires_at,
                   (CASE
                        WHEN cr.creator_id = ? THEN 1
                        WHEN raa.admin_id = ? THEN 1
                        WHEN rua.user_id = ? THEN 1
                        ELSE 0
                    END) AS isAssignedOrCreator
            FROM room_client_assignments rca
            JOIN chat_rooms cr ON rca.room_id = cr.id
            LEFT JOIN room_admin_assignments raa ON cr.id = raa.room_id AND raa.admin_id = ?
            LEFT JOIN room_user_assignments rua ON cr.id = rua.room_id AND rua.user_id = ?
            LEFT JOIN room_access_requests rar_jit ON cr.id = rar_jit.room_id AND rar_jit.requester_id = ? AND rar_jit.status = 'approved' AND rar_jit.expires_at > CURRENT_TIMESTAMP
            WHERE rca.client_id = ?
            GROUP BY cr.id
        `;
        const params = [user.id, user.id, user.id, user.id, user.id, user.id, clientId];
        
        const allRooms = await new Promise((res, rej) => 
            db.all(allRoomsSql, params, (err, rows) => err ? rej(err) : res(rows))
        );

        if (allRooms.length === 0) {
            console.log(`[ROOM_CTRL_GET_CLIENT] No rooms found for client ${clientId}.`);
            return res.status(200).json([]);
        }

        // 2. Determine access level for each room
        const roomsWithAccess = allRooms.map(room => {
            let accessLevel = 'locked';
            let expires_at = null;

            if (user.role === 'CTO') {
                accessLevel = 'full';
            } else if (user.role === 'ProductOwner') {
                // PO has full access to all rooms in their product
                if (room.product_id === user.product_id) {
                    accessLevel = 'full';
                }
                // TODO: Check for PO-to-PO JIT access on the product
            } else if (user.role === 'Administrator') {
                // Admin has full access if they are assigned to the client (which we checked)
                // AND the room is assigned to them OR they created it
                if (room.isAssignedOrCreator) {
                    accessLevel = 'full';
                }
                // TODO: Check for Admin-to-Admin JIT access on the client
            } else if (user.role === 'User') {
                 // User has full access if the room is assigned to them OR they created it
                 // (User should ideally not hit this endpoint, but logic is here as a fallback)
                if (room.isAssignedOrCreator) {
                    accessLevel = 'full';
                }
            }

            // Room-level JIT (the old JIT) overrides all locks
            if (room.jit_expires_at) {
                accessLevel = 'full';
                expires_at = room.jit_expires_at;
            }
            
            // Per your rules, "Send Downstream" is only for password-protected rooms
            const isDownstreamable = (
                (user.role === 'CTO' && room.isPasswordProtected) ||
                ((user.role === 'ProductOwner' || user.role === 'Administrator') && room.isPasswordProtected && room.isAssignedOrCreator)
            );

            return {
                id: room.id,
                name: room.name,
                color: room.color,
                room_code: room.room_code,
                isPasswordProtected: room.isPasswordProtected,
                isDownstreamable: isDownstreamable,
                accessLevel: accessLevel,
                expires_at: expires_at
            };
        });

        console.log(`[ROOM_CTRL_GET_CLIENT_SUCCESS] Returning ${roomsWithAccess.length} rooms for Client ${clientId}.`);
        res.status(200).json(roomsWithAccess);

    } catch (err) {
        console.error(`[ROOM_CTRL_GET_CLIENT_ERROR] Critical error:`, err.message);
        res.status(500).json({ message: "Server error fetching rooms." });
    }
};
// --- [END BLOCK 6] ---


/**
 * @desc      Create a new chat room
 * @route     POST /api/rooms
 * @access    Private (Admin, PO, CTO)
 */
const createRoom = async (req, res) => {
    console.log(`[ROOM_CTRL_CREATE] Received POST /api/rooms from user ID: ${req.user.id}`);
    try {
        const newRoom = await roomService.createRoomLogic(req.user, req.body);
        
        // --- [BLOCK 4] EMIT SOCKET EVENT ---
        console.log(`[ROOM_CTRL_CREATE] [SOCKET] Emitting 'ROOM_LIST_UPDATED' event.`);
        req.io.emit('ROOM_LIST_UPDATED'); // Tell all clients to refresh their room list
        // --- [END BLOCK 4] ---
        
        res.status(201).json(newRoom);
    } catch (error) {
        console.error(`[ROOM_CTRL_CREATE_ERROR] Error in createRoom:`, error.message);
        res.status(error.statusCode || 500).json({ message: error.message || "Server error" });
    }
};

/**
 * @desc      Logs a user entry into a chat room
 * @route     POST /api/rooms/log-entry/:roomId
 * @access    Private
 */
const logRoomEntry = async (req, res) => {
    console.log(`[ROOM_LOG_CTRL] Received log-entry for user ${req.user.id} in room ${req.params.roomId}`);
    try {
        const result = await logService.logRoomEntryLogic(req.user.id, req.params.roomId);
        res.status(201).json(result);
    } catch (error) {
        console.error(`[ROOM_LOG_CTRL_ERROR] Error in logRoomEntry:`, error.message);
        res.status(error.statusCode || 500).json({ message: error.message || "Server error" });
    }
};

/**
 * @desc      Unblocks a CTO-assigned room (for POs)
 * @route     PUT /api/rooms/unblock/:roomId
 * @access    Private (ProductOwner only)
 */
const unblockRoom = async (req, res) => {
    console.log(`[ROOM_UNBLOCK_CTRL] Received unblock request for room ${req.params.roomId} from user ${req.user.id}`);
    try {
        const result = await accessService.unblockRoomLogic(req.user.id, req.params.roomId);

        // --- [BLOCK 4] EMIT SOCKET EVENT ---
        console.log(`[ROOM_UNBLOCK_CTRL] [SOCKET] Emitting 'ROOM_LIST_UPDATED' event.`);
        req.io.emit('ROOM_LIST_UPDATED'); // Tell all clients to refresh their room list
        // --- [END BLOCK 4] ---

        res.status(200).json(result);
    } catch (error) {
        console.error(`[ROOM_UNBLOCK_CTRL_ERROR] Error in unblockRoom:`, error.message);
        res.status(error.statusCode || 500).json({ message: error.message || "Server error" });
    }
};

/**
 * @desc      Checks if a user has permission to join a room (free access or JIT)
 * @route     POST /api/rooms/join/:roomId
 * @access    Private
 */
const joinRoom = async (req, res) => {
    console.log(`[ROOM_JOIN_CTRL] User ${req.user.id} attempting to join room ${req.params.roomId}`);
    try {
         const db = getDb();
         const user = await new Promise((resolve, reject) => {
             db.get(`SELECT id, role, product_id, manager_id FROM users WHERE id = ?`, [req.user.id], (err, row) => {
                if (err) return reject(new Error("DB error fetching user"));
                if (!row) return reject(new Error("User not found"));
                resolve(row);
            });
        });

        const result = await accessService.joinRoomLogic(user, req.params.roomId);
        res.status(200).json(result);
    } catch (error) {
        console.error(`[ROOM_JOIN_ERROR] Error in joinRoom:`, error.message);
        const status = error.statusCode || 500;
        res.status(status).json({ status: error.status || 'error', message: error.message || "Server error" });
    }
};

/**
 * @desc      Sends a room "downstream" (PO->Admin or Admin->User)
 * @route     POST /api/rooms/send-downstream/:roomId
 * @access    Private (ProductOwner, Administrator)
 */
const sendDownstream = async (req, res) => {
    console.log(`[SEND_DOWNSTREAM] User ${req.user.id} attempting to send room ${req.params.roomId}`);
    try {
        const { assignIds } = req.body;
        const result = await accessService.sendDownstreamLogic(req.user, req.params.roomId, assignIds);

        // --- [BLOCK 4] EMIT SOCKET EVENT ---
        console.log(`[SEND_DOWNSTREAM] [SOCKET] Emitting 'ROOM_LIST_UPDATED' event.`);
        req.io.emit('ROOM_LIST_UPDATED'); // Tell all clients to refresh their room list
        // --- [END BLOCK 4] ---

        res.status(200).json(result);
    } catch (error) {
        console.error(`[SEND_DOWNSTREAM_ERROR] Error in sendDownstream:`, error.message);
        res.status(error.statusCode || 500).json({ message: error.message || "Server error" });
    }
};

/**
 * @desc      Deletes a document from a room
 * @route     DELETE /api/rooms/documents/:docId
 * @access    Private (Admin, PO, CTO)
 */
const deleteDocument = async (req, res) => {
    console.log(`[DELETE_DOC] User ${req.user.id} attempting to delete document ${req.params.docId}.`);
    try {
        const result = await roomService.deleteDocumentLogic(req.user, req.params.docId);

        // --- [BLOCK 4] EMIT SOCKET EVENT ---
        console.log(`[DELETE_DOC] [SOCKET] Emitting 'DOCUMENT_LIST_UPDATED' event for room ${result.roomId}.`);
        req.io.emit('DOCUMENT_LIST_UPDATED', { roomId: result.roomId });
        // --- [END BLOCK 4] ---

        res.status(200).json(result);
    } catch (error) {
        console.error(`[DELETE_DOC_ERROR] Error in deleteDocument:`, error.message);
        res.status(error.statusCode || 500).json({ message: error.message || "Server error" });
    }
};

/**
 * @desc      Edit a room's password
 * @route     PUT /api/rooms/password/:roomId
 * @access    Private (Creator only: Admin, PO, CTO)
 */
const editRoomPassword = async (req, res) => {
    console.log(`[ROOM_PASS_CTRL] [BUG_FIX] User ${req.user.id} (Role: ${req.user.role}) attempting to change password for room ${req.params.roomId}.`);
    
    // --- [BUG_FIX] Add authorization check ---
    const { role } = req.user;
    if (role !== 'CTO' && role !== 'ProductOwner' && role !== 'Administrator') {
        console.warn(`[ROOM_PASS_CTRL_FAIL] [BUG_FIX] User ${req.user.id} (Role: ${role}) is not authorized.`);
        return res.status(403).json({ message: "You do not have permission to edit rooms." });
    }
    // --- [END BUG_FIX] ---

    try {
        const { password } = req.body;
        // --- [BUG_FIX] Pass the full req.user object ---
        const result = await roomService.editRoomPasswordLogic(req.user, req.params.roomId, password);

        // --- [BLOCK 4] EMIT SOCKET EVENT ---
        console.log(`[ROOM_PASS_CTRL] [SOCKET] Emitting 'ROOM_LIST_UPDATED' event.`);
        req.io.emit('ROOM_LIST_UPDATED'); // Tell all clients to refresh their room list
        // --- [END BLOCK 4] ---

        res.status(200).json(result);
    } catch (error) {
        console.error(`[ROOM_PASS_ERROR] Error in editRoomPassword:`, error.message);
        res.status(error.statusCode || 500).json({ message: error.message || "Server error" });
    }
};

module.exports = {
    getRooms,
    getRoomsForClient, // --- [BLOCK 6] NEW EXPORT ---
    createRoom,
    logRoomEntry,
    unblockRoom,
    joinRoom,
    sendDownstream,
    deleteDocument,
    editRoomPassword
};