// backend/controllers/jitRequestController.js - POSTGRESQL REFACTOR

// [PG_FIX] Import query and getPool
const { query, getPool } = require('../database');
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sendEmail } = require('../services/emailService');

console.log('[CONTROLLER] [JIT_REFACTOR] Loading jitRequestController.js...');

// --- HELPER FUNCTIONS ---

const parseDurationToSeconds = (duration) => {
    if (!duration || (!duration.hours && !duration.minutes && !duration.seconds)) return null;
    const hours = parseInt(duration.hours || 0) * 3600;
    const minutes = parseInt(duration.minutes || 0) * 60;
    const seconds = parseInt(duration.seconds || 0);
    const total = hours + minutes + seconds;
    return total > 0 ? total : null;
};

/**
 * [PG_FIX] Converted to Async/Await & Postgres Syntax ($1, $2)
 */
const checkUserFreeAccess = async (user, roomId) => {
    console.log(`[JIT_HELPER_ACCESS] Checking free access for User ${user.id} to Room ${roomId}`);
    
    // Base Query
    let freeAccessSql = `
        SELECT 1, cr.id, cr.creator_id, raa_self.admin_id, cr.product_id 
        FROM chat_rooms cr 
        LEFT JOIN room_admin_assignments raa_self ON cr.id = raa_self.room_id AND raa_self.admin_id = $1
        LEFT JOIN room_po_assignments rpa_self ON cr.id = rpa_self.room_id AND rpa_self.po_id = $2
        LEFT JOIN (SELECT room_id, COUNT(id) as admin_count FROM room_admin_assignments GROUP BY room_id) rca_count ON cr.id = rca_count.room_id
    `;
    
    // Params: [user.id, user.id, roomId, ...others]
    const params = [user.id, user.id, roomId]; 
    let whereClause = `WHERE cr.id = $3`;
    let havingClause = ``; 
    let accessTypeLog = "";
    
    // Since params are dynamic, we need a counter for $N
    let paramIdx = 4; 

    if (user.role === 'CTO') {
        whereClause += ` AND (1=1)`;
        accessTypeLog = "CTO";
    } else if (user.role === 'ProductOwner') {
        // product_id = $4, creator_id = $5, po_id = $6
        whereClause += ` AND (cr.product_id = $${paramIdx++} OR cr.creator_id = $${paramIdx++} OR (rpa_self.po_id = $${paramIdx++} AND rpa_self.is_unblocked = TRUE))`;
        params.push(user.product_id, user.id, user.id);
        accessTypeLog = "ProductOwner";
    } else if (user.role === 'Administrator') {
        // creator_id = $4, product_id = $5
        havingClause = `
            HAVING 
                cr.creator_id = $${paramIdx++} 
                OR
                raa_self.admin_id IS NOT NULL
                OR
                (cr.product_id = $${paramIdx++} AND (rca_count.admin_count IS NULL OR rca_count.admin_count = 0))
        `;
        params.push(user.id, user.product_id);
        accessTypeLog = "Administrator";
    } else if (user.role === 'User') {
        if (!user.manager_id) return false;
        // Update the base params (admin_id check for manager)
        params[0] = user.manager_id; // Replacing raa_self check with manager
        
        // creator_id = $4
        havingClause = `
            HAVING
                cr.creator_id = $${paramIdx++} 
                OR
                raa_self.admin_id IS NOT NULL
        `;
        params.push(user.manager_id);
        accessTypeLog = "User (via Admin)";
    }
    
    let finalSql = "";
    if (havingClause) {
        const groupBy = `GROUP BY cr.id, cr.creator_id, raa_self.admin_id, cr.product_id, rpa_self.po_id, rpa_self.is_unblocked, rca_count.admin_count`;
        finalSql = `${freeAccessSql} ${whereClause} ${groupBy} ${havingClause} LIMIT 1`;
    } else {
        finalSql = `${freeAccessSql} ${whereClause} LIMIT 1`;
    }

    try {
        const res = await query(finalSql, params);
        const granted = res.rows.length > 0;
        console.log(`[JIT_HELPER_ACCESS] Role: ${accessTypeLog} -> ${granted ? 'GRANTED' : 'DENIED'}`);
        return granted;
    } catch (err) {
        console.error(`[JIT_HELPER_ACCESS_ERROR]`, err.message);
        return false;
    }
};


// --- ROOM-LEVEL JIT FUNCTIONS ---

const getIncomingRequests = async (req, res) => {
    const { id: userId, role: userRole } = req.user;
    if (!['Administrator', 'ProductOwner', 'CTO'].includes(userRole)) {
         return res.status(403).json({ message: "Forbidden." });
    }
    
    const sql = `
        SELECT 
            rar.id, rar.room_id, rar.requester_id, rar.created_at, rar.status,
            rar.requested_duration_seconds, rar.approved_duration_seconds,
            u.email as requester_email,
            cr.name as room_name, cr.room_code
        FROM room_access_requests rar
        JOIN users u ON rar.requester_id = u.id
        JOIN chat_rooms cr ON rar.room_id = cr.id
        WHERE rar.owner_id = $1 AND rar.status != 'expired'
        ORDER BY rar.status, rar.created_at DESC
    `;
    
    try {
        const result = await query(sql, [userId]);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error(`[JIT_CTRL_DB_ERROR]`, err.message);
        res.status(500).json({ message: "Database error." });
    }
};

const approveRequest = async (req, res) => {
    const { id: userId } = req.user;
    const { requestId } = req.params;
    const { duration } = req.body;

    const approved_duration_seconds = parseDurationToSeconds(duration);
    let durationText = "permanently";
    let expires_at = null;
    
    if (approved_duration_seconds !== null) {
        expires_at = new Date(Date.now() + approved_duration_seconds * 1000).toISOString();
        durationText = `for ${duration.hours || 0}h ${duration.minutes || 0}m`;
    }

    try {
        // 1. Fetch Request
        const sqlGet = `
            SELECT rar.status, rar.owner_id, u.email AS requester_email, cr.name AS room_name
            FROM room_access_requests rar
            JOIN users u ON rar.requester_id = u.id
            JOIN chat_rooms cr ON rar.room_id = cr.id
            WHERE rar.id = $1
        `;
        const getRes = await query(sqlGet, [requestId]);
        const request = getRes.rows[0];

        if (!request) return res.status(404).json({ message: "Request not found." });
        if (request.owner_id !== userId) return res.status(403).json({ message: "Unauthorized." });
        if (request.status !== 'pending') return res.status(400).json({ message: "Request not pending." });

        // 2. Update
        const sqlUpdate = `
            UPDATE room_access_requests 
            SET status = 'approved', expires_at = $1, updated_at = NOW(), approved_duration_seconds = $2
            WHERE id = $3 AND owner_id = $4 AND status = 'pending'
        `;
        const updateRes = await query(sqlUpdate, [expires_at, approved_duration_seconds, requestId, userId]);

        if (updateRes.rowCount === 0) return res.status(404).json({ message: "Update failed." });

        // 3. Notify
        sendEmail(
            request.requester_email,
            "Room Access Approved",
            `<h3>Access Granted</h3><p>Room: ${request.room_name}</p><p>Duration: ${durationText}</p>`
        );

        if (req.io) {
            req.io.emit('JIT_REQUEST_UPDATED'); 
            req.io.emit('ROOM_LIST_UPDATED'); 
        }

        res.status(200).json({ message: "Request approved." });

    } catch (err) {
        console.error(`[JIT_APPROVE_ERROR]`, err.message);
        res.status(500).json({ message: "Server error." });
    }
};

const rejectRequest = async (req, res) => {
    const { id: userId } = req.user;
    const { requestId } = req.params;

    try {
        const sqlGet = `
            SELECT rar.status, rar.owner_id, u.email AS requester_email, cr.name AS room_name
            FROM room_access_requests rar
            JOIN users u ON rar.requester_id = u.id
            JOIN chat_rooms cr ON rar.room_id = cr.id
            WHERE rar.id = $1
        `;
        const getRes = await query(sqlGet, [requestId]);
        const request = getRes.rows[0];

        if (!request) return res.status(404).json({ message: "Request not found." });
        if (request.owner_id !== userId) return res.status(403).json({ message: "Unauthorized." });
        if (request.status !== 'pending') return res.status(400).json({ message: "Request not pending." });

        const sqlUpdate = `
            UPDATE room_access_requests 
            SET status = 'rejected', updated_at = NOW()
            WHERE id = $1 AND owner_id = $2 AND status = 'pending'
        `;
        const updateRes = await query(sqlUpdate, [requestId, userId]);

        if (updateRes.rowCount === 0) return res.status(404).json({ message: "Update failed." });

        sendEmail(request.requester_email, "Room Access Rejected", `<p>Your request for ${request.room_name} was rejected.</p>`);

        if (req.io) {
            req.io.emit('JIT_REQUEST_UPDATED'); 
            req.io.emit('ROOM_LIST_UPDATED'); 
        }

        res.status(200).json({ message: "Request rejected." });

    } catch (err) {
        console.error(`[JIT_REJECT_ERROR]`, err.message);
        res.status(500).json({ message: "Server error." });
    }
};

const requestAccess = async (req, res) => {
    const { roomCode, password, duration } = req.body;
    const { user } = req;
    const requesterId = user.id;
    
    const requested_duration_seconds = parseDurationToSeconds(duration);
    if (requested_duration_seconds === null) return res.status(400).json({ message: "Duration required." });

    try {
        // 1. Find Room
        const roomRes = await query('SELECT * FROM chat_rooms WHERE room_code = $1', [roomCode]);
        const room = roomRes.rows[0];
        if (!room) return res.status(404).json({ message: "Invalid room code." });

        // 2. Check Free Access
        const hasFreeAccess = await checkUserFreeAccess(user, room.id);
        if (hasFreeAccess) return res.status(409).json({ message: "You already have access." });

        // 3. Password Check
        if (room.password_hash) {
            if (!password) return res.status(401).json({ message: "Password required." });
            const isMatch = await bcrypt.compare(password, room.password_hash);
            if (!isMatch) return res.status(403).json({ message: "Invalid password." });
        }

        // 4. Check Existing
        const existRes = await query('SELECT id, status FROM room_access_requests WHERE room_id = $1 AND requester_id = $2', [room.id, requesterId]);
        const existingRequest = existRes.rows[0];

        if (existingRequest) {
            if (['pending', 'approved'].includes(existingRequest.status)) {
                return res.status(409).json({ message: `You already have a ${existingRequest.status} request.` });
            }
            // Reactivate old request
            await query(
                `UPDATE room_access_requests SET status = 'pending', requested_duration_seconds = $1, updated_at = NOW(), approved_duration_seconds = NULL, expires_at = NULL WHERE id = $2`,
                [requested_duration_seconds, existingRequest.id]
            );
        } else {
            // New Request
            await query(
                `INSERT INTO room_access_requests (room_id, requester_id, owner_id, status, created_at, updated_at, requested_duration_seconds) VALUES ($1, $2, $3, 'pending', NOW(), NOW(), $4)`,
                [room.id, requesterId, room.creator_id, requested_duration_seconds]
            );
        }

        // Notify Owner
        const ownerRes = await query('SELECT email FROM users WHERE id = $1', [room.creator_id]);
        if (ownerRes.rows[0]) {
            sendEmail(ownerRes.rows[0].email, "New Room Access Request", `<p>${user.email} requested access to ${room.name}.</p>`);
        }

        if (req.io) req.io.emit('JIT_REQUEST_UPDATED');

        res.status(201).json({ message: 'Request submitted.' });

    } catch (err) {
        console.error(`[JIT_REQUEST_ERROR]`, err.message);
        res.status(500).json({ message: 'Server error.' });
    }
};

const getOutgoingRequests = async (req, res) => {
    const { id: requesterId } = req.user;
    const sql = `
        SELECT 
            rar.id, rar.room_id, rar.status,
            rar.requested_duration_seconds, rar.approved_duration_seconds,
            rar.expires_at, rar.updated_at,
            cr.name as room_name, cr.room_code,
            u.email as owner_email
        FROM room_access_requests rar
        JOIN chat_rooms cr ON rar.room_id = cr.id
        JOIN users u ON rar.owner_id = u.id
        WHERE rar.requester_id = $1
        ORDER BY rar.updated_at DESC
    `;
    try {
        const result = await query(sql, [requesterId]);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error(`[JIT_OUTGOING_ERROR]`, err.message);
        res.status(500).json({ message: "Database error." });
    }
};

const editRequest = async (req, res) => {
    const { id: requesterId } = req.user;
    const { requestId } = req.params;
    const { duration } = req.body;
    const seconds = parseDurationToSeconds(duration);
    if (seconds === null) return res.status(400).json({ message: "Invalid duration." });

    try {
        const result = await query(
            `UPDATE room_access_requests SET requested_duration_seconds = $1, updated_at = NOW() WHERE id = $2 AND requester_id = $3 AND status = 'pending'`,
            [seconds, requestId, requesterId]
        );
        if (result.rowCount === 0) return res.status(403).json({ message: "Update failed." });
        
        if (req.io) req.io.emit('JIT_REQUEST_UPDATED');
        res.status(200).json({ message: "Request updated." });
    } catch (err) {
        res.status(500).json({ message: "Server error." });
    }
};

const revokeRequest = async (req, res) => {
    const { id: ownerId } = req.user;
    const { requestId } = req.params;

    try {
        const getRes = await query(`SELECT status, u.email as requester_email, cr.name as room_name FROM room_access_requests rar JOIN users u ON rar.requester_id = u.id JOIN chat_rooms cr ON rar.room_id = cr.id WHERE rar.id = $1 AND rar.owner_id = $2`, [requestId, ownerId]);
        const reqData = getRes.rows[0];
        
        if (!reqData) return res.status(404).json({ message: "Request not found." });
        if (reqData.status !== 'approved') return res.status(400).json({ message: "Not approved." });

        await query(`UPDATE room_access_requests SET status = 'revoked', updated_at = NOW(), expires_at = NULL WHERE id = $1`, [requestId]);
        
        sendEmail(reqData.requester_email, "Access Revoked", `<p>Access to ${reqData.room_name} revoked.</p>`);
        
        if (req.io) {
            req.io.emit('JIT_REQUEST_UPDATED'); 
            req.io.emit('ROOM_LIST_UPDATED');
        }
        res.status(200).json({ message: "Revoked." });
    } catch (err) {
        res.status(500).json({ message: "Server error." });
    }
};

// --- PEER-TO-PEER JIT ---

const requestPeerAccess = async (req, res) => {
    const { type, resourceId, duration } = req.body;
    const { user } = req;
    const seconds = parseDurationToSeconds(duration);
    if (!seconds) return res.status(400).json({ message: "Invalid duration." });

    try {
        let owners = [];
        let tableName = type === 'product' ? 'product_access_requests' : 'client_access_requests';
        let colName = type === 'product' ? 'product_id' : 'client_id';
        let resourceName = '';

        if (type === 'product') {
            const prodRes = await query(`SELECT p.product_name, u.id as owner_id, u.email FROM products p JOIN users u ON p.product_owner_email = u.email WHERE p.id = $1`, [resourceId]);
            const product = prodRes.rows[0];
            if (!product) return res.status(404).json({ message: "Product/Owner not found." });
            if (product.owner_id === user.id) return res.status(400).json({ message: "You are the owner." });
            owners.push(product);
            resourceName = product.product_name;
        } else {
            const clientRes = await query(`SELECT name FROM clients WHERE id = $1`, [resourceId]);
            if (clientRes.rows.length === 0) return res.status(404).json({ message: "Client not found." });
            resourceName = clientRes.rows[0].name;

            const adminsRes = await query(`SELECT u.id as owner_id, u.email FROM admin_client_assignments aca JOIN users u ON aca.admin_id = u.id WHERE aca.client_id = $1 AND u.status = 'active'`, [resourceId]);
            if (adminsRes.rows.length === 0) return res.status(404).json({ message: "No admins assigned." });
            owners = adminsRes.rows;
        }

        for (const owner of owners) {
            await query(
                `INSERT INTO ${tableName} (${colName}, requester_id, owner_id, status, created_at, updated_at, requested_duration_seconds) VALUES ($1, $2, $3, 'pending', NOW(), NOW(), $4)`,
                [resourceId, user.id, owner.owner_id, seconds]
            );
            sendEmail(owner.email, `Request for ${type}`, `<p>${user.email} requested access to ${resourceName}.</p>`);
        }

        if (req.io) req.io.emit('PEER_JIT_UPDATED');
        res.status(201).json({ message: "Request sent." });

    } catch (err) {
        console.error(`[PEER_REQ_ERROR]`, err.message);
        res.status(500).json({ message: "Server error." });
    }
};

const getIncomingPeerRequests = async (req, res) => {
    const { id: userId } = req.user;
    try {
        const prodSql = `
            SELECT 'product' as type, pr.id, pr.status, pr.created_at, pr.requested_duration_seconds, p.product_name as resource_name, u.email as requester_email
            FROM product_access_requests pr JOIN products p ON pr.product_id = p.id JOIN users u ON pr.requester_id = u.id
            WHERE pr.owner_id = $1 AND pr.status = 'pending'
        `;
        const clientSql = `
            SELECT 'client' as type, cr.id, cr.status, cr.created_at, cr.requested_duration_seconds, c.name as resource_name, u.email as requester_email
            FROM client_access_requests cr JOIN clients c ON cr.client_id = c.id JOIN users u ON cr.requester_id = u.id
            WHERE cr.owner_id = $1 AND cr.status = 'pending'
        `;
        const [prodRes, clientRes] = await Promise.all([query(prodSql, [userId]), query(clientSql, [userId])]);
        res.status(200).json({ productRequests: prodRes.rows, clientRequests: clientRes.rows });
    } catch (err) {
        res.status(500).json({ message: "DB Error" });
    }
};

const getOutgoingPeerRequests = async (req, res) => {
    const { id: userId } = req.user;
    try {
        const prodSql = `
            SELECT 'product' as type, pr.id, pr.status, pr.updated_at, pr.expires_at, pr.approved_duration_seconds, p.product_name as resource_name, u.email as owner_email
            FROM product_access_requests pr JOIN products p ON pr.product_id = p.id JOIN users u ON pr.owner_id = u.id
            WHERE pr.requester_id = $1
        `;
        const clientSql = `
            SELECT 'client' as type, cr.id, cr.status, cr.updated_at, cr.expires_at, cr.approved_duration_seconds, c.name as resource_name, u.email as owner_email
            FROM client_access_requests cr JOIN clients c ON cr.client_id = c.id JOIN users u ON cr.owner_id = u.id
            WHERE cr.requester_id = $1
        `;
        const [prodRes, clientRes] = await Promise.all([query(prodSql, [userId]), query(clientSql, [userId])]);
        const all = [...prodRes.rows, ...clientRes.rows].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
        res.status(200).json(all);
    } catch (err) {
        res.status(500).json({ message: "DB Error" });
    }
};

const respondToPeerRequest = async (req, res) => {
    const { requestId, type, action, duration } = req.body;
    const { id: ownerId } = req.user;
    const tableName = type === 'product' ? 'product_access_requests' : 'client_access_requests';
    
    let sql = `UPDATE ${tableName} SET status = $1, updated_at = NOW()`;
    const params = [action];
    let paramIdx = 2;

    if (action === 'approved') {
        const seconds = parseDurationToSeconds(duration);
        const expires = seconds ? new Date(Date.now() + seconds * 1000).toISOString() : null;
        sql += `, expires_at = $${paramIdx++}, approved_duration_seconds = $${paramIdx++}`;
        params.push(expires, seconds);
    } else if (action === 'revoked') {
        sql += `, expires_at = NULL, approved_duration_seconds = NULL`;
    }

    sql += ` WHERE id = $${paramIdx++} AND owner_id = $${paramIdx++}`;
    params.push(requestId, ownerId);

    try {
        const resUpdate = await query(sql, params);
        if (resUpdate.rowCount === 0) return res.status(404).json({ message: "Update failed." });

        if (req.io) {
            req.io.emit('PEER_JIT_UPDATED');
            req.io.emit('HIERARCHY_UPDATED');
        }
        res.status(200).json({ message: `Request ${action}.` });
    } catch (err) {
        res.status(500).json({ message: "DB Error" });
    }
};

module.exports = {
    getIncomingRequests, approveRequest, rejectRequest, requestAccess,        
    getOutgoingRequests, editRequest, revokeRequest,
    requestPeerAccess, getIncomingPeerRequests, getOutgoingPeerRequests, respondToPeerRequest
};