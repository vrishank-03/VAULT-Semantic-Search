// backend/controllers/roomController.js - FINAL POSTGRES FIX

const roomService = require('../services/roomService');
const accessService = require('../services/accessService');
const logService = require('../services/logService');
const { query, CORE_ROLES } = require('../database'); 
const logger = require('../utils/logger');

const SERVICE_NAME = 'roomController';

// Map hardcoded role names to constant keys
const ROLE_KEYS = {
    CTO: CORE_ROLES.find(r => r.key === 'CTO').key,
    PO: CORE_ROLES.find(r => r.key === 'PO').key,
    ADMIN: CORE_ROLES.find(r => r.key === 'Admin').key,
    USER: CORE_ROLES.find(r => r.key === 'User').key,
};

/**
 * @desc      Get chat rooms based on user's role (FOR 'User' ROLE or flat list)
 * @route     GET /api/rooms
 * @access    Private
 */
const getRooms = async (req, res) => {
    logger.info(SERVICE_NAME, `Received GET /api/rooms for user ID: ${req.user.id}`);
    try {
        const userSql = `SELECT id, role, product_id, manager_id FROM users WHERE id = $1`;
        const userRes = await query(userSql, [req.user.id]);
        const user = userRes.rows[0];
        
        if (!user) throw new Error("User not found");
        
        const rooms = await roomService.getRoomsLogic(user);
        res.status(200).json(rooms);
    } catch (error) {
        logger.error(SERVICE_NAME, `Error in getRooms:`, error.message);
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

    logger.info(SERVICE_NAME, `User ${user.id} (Role: ${user.role}) fetching rooms for Client ${clientId}`);

    try {
        // [PG_STRICT_FIX] Added raa.admin_id and rua.user_id to GROUP BY
        const allRoomsSql = `
            SELECT cr.id, cr.name, cr.color, cr.room_code, cr.product_id,
                   cr.password_hash IS NOT NULL AS "isPasswordProtected",
                   cr.creator_id,
                   rar_jit.expires_at AS "jitExpiresAt",
                   (CASE
                       WHEN cr.creator_id = $1 THEN TRUE
                       WHEN raa.admin_id = $1 THEN TRUE
                       WHEN rua.user_id = $1 THEN TRUE
                       ELSE FALSE
                   END) AS "isAssignedOrCreator"
            FROM room_client_assignments rca
            JOIN chat_rooms cr ON rca.room_id = cr.id
            LEFT JOIN room_admin_assignments raa ON cr.id = raa.room_id AND raa.admin_id = $1
            LEFT JOIN room_user_assignments rua ON cr.id = rua.room_id AND rua.user_id = $1
            LEFT JOIN room_access_requests rar_jit ON cr.id = rar_jit.room_id AND rar_jit.requester_id = $1 
                AND rar_jit.status = 'approved' AND rar_jit.expires_at > NOW()
            WHERE rca.client_id = $2
            GROUP BY cr.id, rar_jit.expires_at, raa.admin_id, rua.user_id
            ORDER BY cr.id ASC
        `;
        
        const params = [user.id, clientId]; 
        const allRoomsRes = await query(allRoomsSql, params);
        const allRooms = allRoomsRes.rows;

        if (allRooms.length === 0) {
            return res.status(200).json([]);
        }

        const roomsWithAccess = allRooms.map(room => {
            let accessLevel = 'locked';
            let expires_at = room.jitExpiresAt;
            const isAssignedOrCreator = room.isAssignedOrCreator;

            if (user.role === ROLE_KEYS.CTO || (user.role === ROLE_KEYS.PO && room.product_id === user.product_id)) {
                accessLevel = 'full';
            } else if (user.role === ROLE_KEYS.ADMIN || user.role === ROLE_KEYS.USER) {
                if (isAssignedOrCreator) {
                    accessLevel = 'full';
                }
            } 
            
            if (expires_at) {
                accessLevel = 'full';
            }
            
            const isDownstreamable = (
                room.isPasswordProtected && 
                (user.role === ROLE_KEYS.CTO || (user.role === ROLE_KEYS.PO && room.product_id === user.product_id) || (user.role === ROLE_KEYS.ADMIN && isAssignedOrCreator))
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

        res.status(200).json(roomsWithAccess);

    } catch (err) {
        logger.error(SERVICE_NAME, `Critical error in getRoomsForClient:`, err.message);
        res.status(500).json({ message: "Server error fetching rooms." });
    }
};

/**
 * @desc      Create a new chat room
 * @route     POST /api/rooms
 * @access    Private (Admin, PO, CTO)
 */
const createRoom = async (req, res) => {
    logger.info(SERVICE_NAME, `Received POST /api/rooms from user ID: ${req.user.id}`);
    try {
        const newRoom = await roomService.createRoomLogic(req.user, req.body);
        
        logger.info(SERVICE_NAME, `[SOCKET] Emitting 'ROOM_LIST_UPDATED' event.`);
        req.io.emit('ROOM_LIST_UPDATED'); 
        
        res.status(201).json(newRoom);
    } catch (error) {
        logger.error(SERVICE_NAME, `Error in createRoom:`, error.message);
        res.status(error.statusCode || 500).json({ message: error.message || "Server error" });
    }
};

/**
 * @desc      Logs a user entry into a chat room
 * @route     POST /api/rooms/log-entry/:roomId
 * @access    Private
 */
const logRoomEntry = async (req, res) => {
    logger.info(SERVICE_NAME, `Received log-entry for user ${req.user.id} in room ${req.params.roomId}`);
    try {
        const result = await logService.logRoomEntryLogic(req.user.id, req.params.roomId);
        res.status(201).json(result);
    } catch (error) {
        logger.error(SERVICE_NAME, `Error in logRoomEntry:`, error.message);
        res.status(error.statusCode || 500).json({ message: error.message || "Server error" });
    }
};

/**
 * @desc      Unblocks a CTO-assigned room (for POs)
 * @route     PUT /api/rooms/unblock/:roomId
 * @access    Private (ProductOwner only)
 */
const unblockRoom = async (req, res) => {
    logger.info(SERVICE_NAME, `Received unblock request for room ${req.params.roomId} from user ${req.user.id}`);
    try {
        const result = await accessService.unblockRoomLogic(req.user.id, req.params.roomId);
        logger.info(SERVICE_NAME, `[SOCKET] Emitting 'ROOM_LIST_UPDATED' event.`);
        req.io.emit('ROOM_LIST_UPDATED'); 
        res.status(200).json(result);
    } catch (error) {
        logger.error(SERVICE_NAME, `Error in unblockRoom:`, error.message);
        res.status(error.statusCode || 500).json({ message: error.message || "Server error" });
    }
};

/**
 * @desc      Checks if a user has permission to join a room (free access or JIT)
 * @route     POST /api/rooms/join/:roomId
 * @access    Private
 */
const joinRoom = async (req, res) => {
    logger.info(SERVICE_NAME, `User ${req.user.id} attempting to join room ${req.params.roomId}`);
    try {
        const userSql = `SELECT id, role, product_id, manager_id FROM users WHERE id = $1`;
        const userRes = await query(userSql, [req.user.id]);
        const user = userRes.rows[0];
        
        if (!user) throw new Error("User not found");

        const result = await accessService.joinRoomLogic(user, req.params.roomId);
        res.status(200).json(result);
    } catch (error) {
        logger.error(SERVICE_NAME, `Error in joinRoom:`, error.message);
        res.status(error.statusCode || 500).json({ status: error.status || 'error', message: error.message || "Server error" });
    }
};

/**
 * @desc      Sends a room "downstream"
 * @route     POST /api/rooms/send-downstream/:roomId
 * @access    Private
 */
const sendDownstream = async (req, res) => {
    logger.info(SERVICE_NAME, `User ${req.user.id} attempting to send room ${req.params.roomId}`);
    try {
        const { assignIds } = req.body;
        const result = await accessService.sendDownstreamLogic(req.user, req.params.roomId, assignIds);
        logger.info(SERVICE_NAME, `[SOCKET] Emitting 'ROOM_LIST_UPDATED' event.`);
        req.io.emit('ROOM_LIST_UPDATED'); 
        res.status(200).json(result);
    } catch (error) {
        logger.error(SERVICE_NAME, `Error in sendDownstream:`, error.message);
        res.status(error.statusCode || 500).json({ message: error.message || "Server error" });
    }
};

/**
 * @desc      Deletes a document from a room
 * @route     DELETE /api/rooms/documents/:docId
 * @access    Private
 */
const deleteDocument = async (req, res) => {
    logger.info(SERVICE_NAME, `User ${req.user.id} attempting to delete document ${req.params.docId}.`);
    try {
        const result = await roomService.deleteDocumentLogic(req.user, req.params.docId);
        logger.info(SERVICE_NAME, `[SOCKET] Emitting 'DOCUMENT_LIST_UPDATED' event for room ${result.roomId}.`);
        req.io.emit('DOCUMENT_LIST_UPDATED', { roomId: result.roomId });
        res.status(200).json(result);
    } catch (error) {
        logger.error(SERVICE_NAME, `Error in deleteDocument:`, error.message);
        res.status(error.statusCode || 500).json({ message: error.message || "Server error" });
    }
};

/**
 * @desc      Edit a room's password
 * @route     PUT /api/rooms/password/:roomId
 * @access    Private
 */
const editRoomPassword = async (req, res) => {
    logger.info(SERVICE_NAME, `User ${req.user.id} (Role: ${req.user.role}) attempting to change password for room ${req.params.roomId}.`);
    const { role } = req.user;
    if (role !== ROLE_KEYS.CTO && role !== ROLE_KEYS.PO && role !== ROLE_KEYS.ADMIN) {
        logger.warn(SERVICE_NAME, `User ${req.user.id} (Role: ${role}) is not authorized.`);
        return res.status(403).json({ message: "You do not have permission to edit rooms." });
    }

    try {
        const { password } = req.body;
        const result = await roomService.editRoomPasswordLogic(req.user, req.params.roomId, password);
        logger.info(SERVICE_NAME, `[SOCKET] Emitting 'ROOM_LIST_UPDATED' event.`);
        req.io.emit('ROOM_LIST_UPDATED'); 
        res.status(200).json(result);
    } catch (error) {
        logger.error(SERVICE_NAME, `Error in editRoomPassword:`, error.message);
        res.status(error.statusCode || 500).json({ message: error.message || "Server error" });
    }
};

module.exports = {
    getRooms,
    getRoomsForClient, 
    createRoom,
    logRoomEntry,
    unblockRoom,
    joinRoom,
    sendDownstream,
    deleteDocument,
    editRoomPassword
};