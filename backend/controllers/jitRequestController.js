// backend/controllers/jitRequestController.js

const { getDb } = require('../database');
require('dotenv').config();
const bcrypt = require('bcryptjs'); // [JIT_FIX] Import bcrypt for password checking

// Import the centralized email service
const { sendEmail } = require('../services/emailService');

console.log('[CONTROLLER] [JIT_REFACTOR] Loading jitRequestController.js...');

// --- [JIT_FIX] NEW HELPER FUNCTIONS ---

/**
 * @desc      Converts a duration object {h, m, s} to total seconds.
 * @param     {object} duration - An object like { hours, minutes, seconds }
 * @returns   {number|null} - Total seconds, or null if 0.
 */
const parseDurationToSeconds = (duration) => {
    console.log(`[JIT_HELPER] Parsing duration:`, duration);
    if (!duration || (!duration.hours && !duration.minutes && !duration.seconds)) {
        console.log(`[JIT_HELPER] Duration is null or empty.`);
        return null;
    }
    const hours = parseInt(duration.hours || 0) * 3600;
    const minutes = parseInt(duration.minutes || 0) * 60;
    const seconds = parseInt(duration.seconds || 0);
    const total = hours + minutes + seconds;
    console.log(`[JIT_HELPER] Total duration in seconds: ${total}`);
    return total > 0 ? total : null;
};

/**
 * @desc      Checks if a user has "free" (non-JIT) access to a room.
 * @param     {object} db - The database connection.
 * @param     {object} user - The full user object (from req.user).
 * @param     {number} roomId - The ID of the room to check.
 * @returns   {Promise<boolean>} - True if the user has free access, false otherwise.
 */
const checkUserFreeAccess = (db, user, roomId) => {
    // This function logic is complex and from a previous step, we assume it's correct.
    // [Internal Note: This function was fixed in the 'blank screen' bug fix]
    console.log(`[JIT_HELPER_ACCESS] Checking free access for User ${user.id} to Room ${roomId}`);
    return new Promise((resolve, reject) => {
        let freeAccessSql = `
            SELECT 1, cr.id, cr.creator_id, raa_self.admin_id, cr.product_id 
            FROM chat_rooms cr 
            LEFT JOIN room_admin_assignments raa_self ON cr.id = raa_self.room_id AND raa_self.admin_id = ?
            LEFT JOIN room_po_assignments rpa_self ON cr.id = rpa_self.room_id AND rpa_self.po_id = ?
            LEFT JOIN (SELECT room_id, COUNT(id) as admin_count FROM room_admin_assignments GROUP BY room_id) rca_count ON cr.id = rca_count.room_id
        `;
        const freeAccessParams = [user.id, user.id]; 
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
            whereParams.push(user.product_id, user.id, user.id);
            accessTypeLog = "ProductOwner";
        } else if (user.role === 'Administrator') {
            havingClause = `
                HAVING 
                    cr.creator_id = ? 
                    OR
                    raa_self.admin_id IS NOT NULL
                    OR
                    (cr.product_id = ? AND (rca_count.admin_count IS NULL OR rca_count.admin_count = 0))
            `;
            whereParams.push(user.id, user.product_id);
            accessTypeLog = "Administrator";
        } else if (user.role === 'User') {
            if (!user.manager_id) {
                console.log(`[JIT_HELPER_ACCESS] User has no manager, no free access.`);
                return resolve(false);
            }
            freeAccessParams[0] = user.manager_id;
            havingClause = `
                HAVING
                    cr.creator_id = ? 
                    OR
                    raa_self.admin_id IS NOT NULL
            `;
            whereParams.push(user.manager_id);
            accessTypeLog = "User (via Admin)";
        }
        
        if (havingClause) {
            const groupBy = `GROUP BY cr.id, cr.creator_id, raa_self.admin_id, cr.product_id`;
            finalSql = `${freeAccessSql} ${whereClause} ${groupBy} ${havingClause} LIMIT 1`;
        } else {
            finalSql = `${freeAccessSql} ${whereClause} LIMIT 1`;
        }

        const finalParams = [...freeAccessParams, ...whereParams];
        console.log(`[JIT_HELPER_ACCESS_DB] Executing access check: ${finalSql} with params: [${finalParams.join(',')}]`);
        db.get(finalSql, finalParams, (err, row) => {
            if (err) {
                console.error(`[JIT_HELPER_ACCESS_DB_ERROR] Failed access check:`, err.message);
                return reject(err);
            }
            if (row) {
                console.log(`[JIT_HELPER_ACCESS] Result: Free access GRANTED.`);
                resolve(true);
            } else {
                console.log(`[JIT_HELPER_ACCESS] Result: Free access DENIED.`);
                resolve(false);
            }
        });
    });
};
// --- [END JIT_FIX] ---


// --- ROOM-LEVEL JIT FUNCTIONS ---

/**
 * @desc      Get all INCOMING room-level JIT requests
 * @route     GET /api/jit/incoming
 * @access    Private (Admin, PO, CTO)
 */
const getIncomingRequests = async (req, res) => {
    const { id: userId, role: userRole } = req.user;
    console.log(`[JIT_CTRL_GET] User ${userId} (Role: ${userRole}) fetching INCOMING (ROOM) requests.`);

    if (userRole !== 'Administrator' && userRole !== 'ProductOwner' && userRole !== 'CTO') {
         console.warn(`[JIT_CTRL_GET_FAIL] User ${userId} (Role: ${userRole}) tried to fetch requests. Forbidden.`);
         return res.status(403).json({ message: "Forbidden: You do not have permission to view access requests." });
    }
    
    const db = getDb();
    const sql = `
        SELECT 
            rar.id, rar.room_id, rar.requester_id, rar.created_at, rar.status,
            rar.requested_duration_seconds, rar.approved_duration_seconds,
            u.email as requester_email,
            cr.name as room_name, cr.room_code
        FROM room_access_requests rar
        JOIN users u ON rar.requester_id = u.id
        JOIN chat_rooms cr ON rar.room_id = cr.id
        WHERE rar.owner_id = ? AND rar.status != 'expired'
        ORDER BY rar.status, rar.created_at DESC
    `;
    
    console.log(`[JIT_CTRL_DB] Executing: ${sql} with param: [${userId}]`);
    db.all(sql, [userId], (err, requests) => {
        if (err) {
            console.error(`[JIT_CTRL_DB_ERROR] Failed to fetch incoming requests for user ${userId}:`, err.message);
            return res.status(500).json({ message: "Database error fetching requests." });
        }
        console.log(`[JIT_CTRL_SUCCESS] Found ${requests.length} incoming (room) requests for user ${userId}.`);
        res.status(200).json(requests);
    });
};

/**
 * @desc      Approve a pending ROOM-LEVEL access request
 * @route     PUT /api/jit/approve/:requestId
 * @access    Private (Admin, PO, CTO)
 */
const approveRequest = async (req, res) => {
    // This function handles ROOM requests
    const { id: userId, role: userRole } = req.user;
    const { requestId } = req.params;
    const { duration } = req.body;
    console.log(`[JIT_CTRL_APPROVE] User ${userId} (Role: ${userRole}) attempting to approve (ROOM) request ${requestId} with duration:`, duration);

    const approved_duration_seconds = parseDurationToSeconds(duration);
    let durationText = "permanently";
    let expires_at = null;
    const now = new Date();
    
    if (approved_duration_seconds !== null) {
        expires_at = new Date(now.getTime() + approved_duration_seconds * 1000).toISOString();
        durationText = `for ${duration.hours || 0}h ${duration.minutes || 0}m ${duration.seconds || 0}s`;
        console.log(`[JIT_CTRL_APPROVE] Calculated expiration: ${expires_at} (${durationText})`);
    } else {
        console.log(`[JIT_CTRL_APPROVE] No valid duration provided. Access will be permanent (expires_at = NULL).`);
    }

    const updated_at = now.toISOString();
    const db = getDb();

    const sqlGet = `
        SELECT rar.status, rar.owner_id, rar.requested_duration_seconds,
            u.email AS requester_email, cr.name AS room_name
        FROM room_access_requests rar
        JOIN users u ON rar.requester_id = u.id
        JOIN chat_rooms cr ON rar.room_id = cr.id
        WHERE rar.id = ?
    `;
    console.log(`[JIT_CTRL_DB] Fetching request info for request ${requestId}`);
    db.get(sqlGet, [requestId], (getErr, request) => {
        if (getErr) {
            console.error(`[JIT_CTRL_DB_ERROR] Failed to fetch request ${requestId}:`, getErr.message);
            return res.status(500).json({ message: "Database error." });
        }
        if (!request) {
            console.warn(`[JIT_CTRL_APPROVE_FAIL] Request ${requestId} not found.`);
            return res.status(404).json({ message: "Request not found." });
        }
        if (request.owner_id !== userId) {
            console.warn(`[JIT_CTRL_APPROVE_FAIL] User ${userId} is not the owner of request ${requestId}.`);
            return res.status(403).json({ message: "You are not authorized to approve this request." });
        }
        if (request.status !== 'pending') {
            console.warn(`[JIT_CTRL_APPROVE_FAIL] Request ${requestId} is not pending (Status: ${request.status}).`);
            return res.status(400).json({ message: `Request is not pending (Status: ${request.status}).` });
        }

        const sql = `
            UPDATE room_access_requests 
            SET status = 'approved', expires_at = ?, updated_at = ?, approved_duration_seconds = ?
            WHERE id = ? AND owner_id = ? AND status = 'pending'
        `;
        const params = [expires_at, updated_at, approved_duration_seconds, requestId, userId];

        console.log(`[JIT_CTRL_DB] Executing: ${sql} with params: [${expires_at}, ${updated_at}, ${approved_duration_seconds}, ${requestId}, ${userId}]`);
        
        db.run(sql, params, function(err) {
            if (err) {
                console.error(`[JIT_CTRL_DB_ERROR] Failed to approve request ${requestId}:`, err.message);
                return res.status(500).json({ message: "Database error approving request." });
            }
            
            if (this.changes === 0) {
                console.warn(`[JIT_CTRL_APPROVE_FAIL] No matching pending request found for ID ${requestId} and owner ${userId} (race condition?).`);
                return res.status(404).json({ message: "Request not found or you are not authorized to approve it." });
            }
            
            console.log(`[JIT_CTRL_APPROVE_SUCCESS] Request ${requestId} approved by user ${userId}. Rows affected: ${this.changes}`);
            
            console.log(`[JIT_CTRL_EMAIL] Sending approval email to ${request.requester_email}`);
            sendEmail(
                request.requester_email,
                "Your Room Access Request was Approved",
                `<h3>Access Granted</h3>
                 <p>Your request to access the room "<strong>${request.room_name}</strong>" has been <strong>approved</strong>.</p>
                 <p>Access has been granted ${durationText}.</p>
                 <a href="${process.env.FRONTEND_URL}/dashboard" style="background-color:#2563eb;color:white;padding:12px 20px;text-align:center;text-decoration:none;display:inline-block;border-radius:8px;font-size:16px;">Go to Dashboard</a>`
            );

            console.log(`[JIT_CTRL_APPROVE] [SOCKET] Emitting 'JIT_REQUEST_UPDATED' and 'ROOM_LIST_UPDATED' events.`);
            req.io.emit('JIT_REQUEST_UPDATED'); 
            req.io.emit('ROOM_LIST_UPDATED'); 

            res.status(200).json({ message: "Request approved successfully." });
        });
    });
};

/**
 * @desc      Reject a pending ROOM-LEVEL access request
 * @route     PUT /api/jit/reject/:requestId
 * @access    Private (Admin, PO, CTO)
 */
const rejectRequest = async (req, res) => {
    // This function handles ROOM requests
    const { id: userId, role: userRole } = req.user;
    const { requestId } = req.params;
    
    console.log(`[JIT_CTRL_REJECT] User ${userId} (Role: ${userRole}) attempting to reject (ROOM) request ${requestId}`);
    
    const updated_at = new Date().toISOString();
    const db = getDb();

    const sqlGet = `
        SELECT rar.status, rar.owner_id, u.email AS requester_email, cr.name AS room_name
        FROM room_access_requests rar
        JOIN users u ON rar.requester_id = u.id
        JOIN chat_rooms cr ON rar.room_id = cr.id
        WHERE rar.id = ?
    `;
    console.log(`[JIT_CTRL_DB] Fetching request info for request ${requestId}`);
    db.get(sqlGet, [requestId], (getErr, request) => {
        if (getErr) {
            console.error(`[JIT_CTRL_DB_ERROR] Failed to fetch request ${requestId}:`, getErr.message);
            return res.status(500).json({ message: "Database error." });
        }
        if (!request) {
            console.warn(`[JIT_CTRL_REJECT_FAIL] Request ${requestId} not found.`);
            return res.status(404).json({ message: "Request not found." });
        }
        if (request.owner_id !== userId) {
            console.warn(`[JIT_CTRL_REJECT_FAIL] User ${userId} is not the owner of request ${requestId}.`);
            return res.status(403).json({ message: "You are not authorized to reject this request." });
        }
        if (request.status !== 'pending') {
            console.warn(`[JIT_CTRL_REJECT_FAIL] Request ${requestId} is not pending (Status: ${request.status}).`);
            return res.status(400).json({ message: `Request is not pending (Status: ${request.status}).` });
        }

        const sql = `
            UPDATE room_access_requests 
            SET status = 'rejected', updated_at = ?
            WHERE id = ? AND owner_id = ? AND status = 'pending'
        `;
        const params = [updated_at, requestId, userId];

        console.log(`[JIT_CTRL_DB] Executing: ${sql} with params: [${updated_at}, ${requestId}, ${userId}]`);

        db.run(sql, params, function(err) {
            if (err) {
                console.error(`[JIT_CTRL_DB_ERROR] Failed to reject request ${requestId}:`, err.message);
                return res.status(500).json({ message: "Database error rejecting request." });
            }
            
            if (this.changes === 0) {
                console.warn(`[JIT_CTRL_REJECT_FAIL] No matching pending request found for ID ${requestId} and owner ${userId} (race condition?).`);
                return res.status(404).json({ message: "Request not found or you are not authorized to reject it." });
            }
            
            console.log(`[JIT_CTRL_REJECT_SUCCESS] Request ${requestId} rejected by user ${userId}. Rows affected: ${this.changes}`);
            
            console.log(`[JIT_CTRL_EMAIL] Sending rejection email to ${request.requester_email}`);
            sendEmail(
                request.requester_email,
                "Your Room Access Request was Rejected",
                `<h3>Access Denied</h3>
                 <p>Your request to access the room "<strong>${request.room_name}</strong>" has been <strong>rejected</strong> by the owner.</p>
                 <p>If you believe this is an error, please contact the room owner directly.</p>`
            );

            console.log(`[JIT_CTRL_REJECT] [SOCKET] Emitting 'JIT_REQUEST_UPDATED' and 'ROOM_LIST_UPDATED' events.`);
            req.io.emit('JIT_REQUEST_UPDATED'); 
            req.io.emit('ROOM_LIST_UPDATED'); 

            res.status(200).json({ message: "Request rejected successfully." });
        });
    });
};

/**
 * @desc      Submit a new JIT request for a ROOM
 * @route     POST /api/jit/request-access
 * @access    Private (Any authenticated user)
 */
const requestAccess = async (req, res) => {
    // This function handles ROOM requests
    const { roomCode, password, duration } = req.body;
    const { user } = req; // Full user object from authMiddleware
    const requesterId = user.id;

    console.log(`[JIT_REQUEST] User ${requesterId} (Role: ${user.role}) requesting access to room code ${roomCode}`);

    if (!roomCode) {
        console.warn(`[JIT_REQUEST_FAIL] No room code provided by user ${requesterId}.`);
        return res.status(400).json({ message: "Room code is required." });
    }

    const requested_duration_seconds = parseDurationToSeconds(duration);
    if (requested_duration_seconds === null) {
        console.warn(`[JIT_REQUEST_FAIL] No duration provided by user ${requesterId}.`);
        return res.status(400).json({ message: "A valid duration is required." });
    }
    
    const db = getDb();
    const now = new Date().toISOString();

    try {
        // 1. Find the room by its code
        console.log(`[JIT_REQUEST_DB] Searching for room with code ${roomCode}...`);
        const room = await new Promise((resolve, reject) => {
            db.get(`SELECT * FROM chat_rooms WHERE room_code = ?`, [roomCode], (err, row) => err ? reject(err) : resolve(row));
        });

        if (!room) {
            console.warn(`[JIT_REQUEST_FAIL] User ${requesterId} provided an invalid room code: ${roomCode}`);
            return res.status(404).json({ message: "Invalid room code." });
        }
        
        console.log(`[JIT_REQUEST_DB] Found room ${room.id} (Owner: ${room.creator_id}).`);

        // 2. Check if user already has free access
        const hasFreeAccess = await checkUserFreeAccess(db, user, room.id);
        if (hasFreeAccess) {
            console.warn(`[JIT_REQUEST_FAIL] User ${requesterId} already has free access to room ${room.id}.`);
            return res.status(409).json({ message: "You already have permanent access to this room." });
        }

        // 3. Check password if the room is protected
        if (room.password_hash) {
            console.log(`[JIT_REQUEST] Room ${room.id} is password protected. Checking password...`);
            if (!password) {
                console.warn(`[JIT_REQUEST_FAIL] User ${requesterId} did not provide a password for protected room ${room.id}.`);
                return res.status(401).json({ message: "Password is required for this room." });
            }
            const isMatch = await bcrypt.compare(password, room.password_hash);
            if (!isMatch) {
                console.warn(`[JIT_REQUEST_FAIL] User ${requesterId} provided incorrect password for room ${room.id}.`);
                return res.status(403).json({ message: "Invalid password." });
            }
            console.log(`[JIT_REQUEST] Password correct for room ${room.id}.`);
        } else {
            console.log(`[JIT_REQUEST] Room ${room.id} is not password protected.`);
        }

        // 4. Check for existing request
        console.log(`[JIT_REQUEST_DB] Checking for existing request for user ${requesterId} and room ${room.id}...`);
        const existingRequest = await new Promise((resolve, reject) => {
            db.get(`SELECT id, status FROM room_access_requests WHERE room_id = ? AND requester_id = ?`, [room.id, requesterId], (err, row) => err ? reject(err) : resolve(row));
        });

        if (existingRequest) {
            console.log(`[JIT_REQUEST_DB] Found existing request ${existingRequest.id} with status ${existingRequest.status}.`);
            if (existingRequest.status === 'pending' || existingRequest.status === 'approved') {
                console.warn(`[JIT_REQUEST_FAIL] User ${requesterId} has an active or pending request for room ${room.id}.`);
                return res.status(409).json({ message: `You already have a "${existingRequest.status}" request for this room.` });
            }

            // 5a. Update old (rejected/expired/revoked) request
            console.log(`[JIT_REQUEST_DB] Updating existing inactive request ${existingRequest.id} to 'pending'.`);
            const sql = `UPDATE room_access_requests 
                         SET status = 'pending', requested_duration_seconds = ?, updated_at = ?, 
                             approved_duration_seconds = NULL, expires_at = NULL
                         WHERE id = ?`;
            await new Promise((resolve, reject) => {
                db.run(sql, [requested_duration_seconds, now, existingRequest.id], (err) => err ? reject(err) : resolve());
            });
        } else {
            // 5b. Insert new request
            console.log(`[JIT_REQUEST_DB] No existing request found. Creating new 'pending' request.`);
            const sql = `INSERT INTO room_access_requests 
                         (room_id, requester_id, owner_id, status, created_at, updated_at, requested_duration_seconds)
                         VALUES (?, ?, ?, 'pending', ?, ?, ?)`;
            await new Promise((resolve, reject) => {
                db.run(sql, [room.id, requesterId, room.creator_id, now, now, requested_duration_seconds], (err) => err ? reject(err) : resolve());
            });
        }

        // 6. Send email to owner (don't await)
        db.get('SELECT email FROM users WHERE id = ?', [room.creator_id], (err, owner) => {
            if (owner && owner.email) {
                console.log(`[JIT_REQUEST_EMAIL] Sending notification to room owner ${owner.email}.`);
                sendEmail(
                    owner.email,
                    "New Room Access Request",
                    `<h3>New Access Request</h3>
                     <p>The user <strong>${user.email}</strong> has requested access to your room "<strong>${room.name}</strong>" (${room.room_code}).</p>
                     <p>Please log in to your dashboard to approve or reject this request.</p>
                     <a href="${process.env.FRONTEND_URL}/dashboard" style="background-color:#2563eb;color:white;padding:12px 20px;text-align:center;text-decoration:none;display:inline-block;border-radius:8px;font-size:16px;">Go to Dashboard</a>`
                );
            }
        });

        console.log(`[JIT_REQUEST] [SOCKET] Emitting 'JIT_REQUEST_UPDATED' event.`);
        req.io.emit('JIT_REQUEST_UPDATED'); // For all JIT lists

        console.log(`[JIT_REQUEST_SUCCESS] Request for user ${requesterId} to room ${room.id} is now pending.`);
        res.status(201).json({ message: 'Access request submitted successfully.' });

    } catch (err) {
        console.error(`[JIT_REQUEST_ERROR] Critical error in requestAccess for user ${requesterId}:`, err.message);
        res.status(500).json({ message: 'Server error while processing your request.' });
    }
};

/**
 * @desc      Get all JIT requests *sent by* the logged-in user for ROOMS
 * @route     GET /api/jit/outgoing
 * @access    Private (Any authenticated user)
 */
const getOutgoingRequests = async (req, res) => {
    const { id: requesterId } = req.user;
    console.log(`[JIT_CTRL_OUTGOING] User ${requesterId} fetching OUTGOING (ROOM) requests.`);
    const db = getDb();

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
        WHERE rar.requester_id = ?
        ORDER BY rar.updated_at DESC
    `;
    
    db.all(sql, [requesterId], (err, requests) => {
        if (err) {
            console.error(`[JIT_CTRL_OUTGOING_ERROR] Failed to fetch outgoing requests for user ${requesterId}:`, err.message);
            return res.status(500).json({ message: "Database error fetching requests." });
        }
        
        console.log(`[JIT_CTRL_OUTGOING_SUCCESS] Found ${requests.length} outgoing (room) requests for user ${requesterId}.`);
        res.status(200).json(requests);
    });
};

/**
 * @desc      Allows a requester to edit the time on their *pending* ROOM request
 * @route     PUT /api/jit/edit/:requestId
 * @access    Private (Requester only)
 */
const editRequest = async (req, res) => {
    // This function handles ROOM requests
    const { id: requesterId } = req.user;
    const { requestId } = req.params;
    const { duration } = req.body;
    
    console.log(`[JIT_EDIT] Requester ${requesterId} attempting to edit time for (ROOM) request ${requestId} with duration:`, duration);
    
    const requested_duration_seconds = parseDurationToSeconds(duration);
    if (requested_duration_seconds === null) {
        console.warn(`[JIT_EDIT_FAIL] No duration provided by user ${requesterId}.`);
        return res.status(400).json({ message: "A valid duration is required." });
    }
    
    const db = getDb();
    const sql = `
        UPDATE room_access_requests 
        SET requested_duration_seconds = ?, updated_at = ?
        WHERE id = ? AND requester_id = ? AND status = 'pending'
    `;
    const params = [requested_duration_seconds, new Date().toISOString(), requestId, requesterId];
    
    db.run(sql, params, function(err) {
        if (err) {
            console.error(`[JIT_EDIT_ERROR] Failed to edit request ${requestId}:`, err.message);
            return res.status(500).json({ message: "Database error editing request." });
        }
        if (this.changes === 0) {
            console.warn(`[JIT_EDIT_FAIL] No matching pending request found for ID ${requestId} and requester ${requesterId}.`);
            return res.status(403).json({ message: "Request not found, or you are not authorized to edit it (it may already be approved)." });
        }
        
        console.log(`[JIT_EDIT_SUCCESS] Requester ${requesterId} updated duration for request ${requestId}.`);
        
        console.log(`[JIT_EDIT] [SOCKET] Emitting 'JIT_REQUEST_UPDATED' event.`);
        req.io.emit('JIT_REQUEST_UPDATED'); 

        res.status(200).json({ message: "Request duration updated." });
    });
};

/**
 * @desc      Revokes a previously approved ROOM access request
 * @route     PUT /api/jit/revoke/:requestId
 * @access    Private (Admin, PO, CTO)
 */
const revokeRequest = async (req, res) => {
    // This function handles ROOM requests
    const { id: ownerId } = req.user;
    const { requestId } = req.params;
    
    console.log(`[JIT_REVOKE] Owner ${ownerId} attempting to REVOKE (ROOM) request ${requestId}.`);
    
    const db = getDb();
    const sqlGet = `
        SELECT rar.status, u.email AS requester_email, cr.name AS room_name
        FROM room_access_requests rar
        JOIN users u ON rar.requester_id = u.id
        JOIN chat_rooms cr ON rar.room_id = cr.id
        WHERE rar.id = ? AND rar.owner_id = ?
    `;
    
    db.get(sqlGet, [requestId, ownerId], (getErr, request) => {
        if (getErr) {
            console.error(`[JIT_REVOKE_ERROR] DB error fetching request ${requestId}:`, getErr.message);
            return res.status(500).json({ message: "Database error." });
        }
        if (!request) {
            console.warn(`[JIT_REVOKE_FAIL] Request ${requestId} not found or not owned by user ${ownerId}.`);
            return res.status(404).json({ message: "Request not found or you are not the owner." });
        }
        if (request.status !== 'approved') {
            console.warn(`[JIT_REVOKE_FAIL] Request ${requestId} cannot be revoked (Status: ${request.status}).`);
            return res.status(400).json({ message: `Only 'approved' requests can be revoked.` });
        }
        
        const sqlUpdate = `
            UPDATE room_access_requests 
            SET status = 'revoked', updated_at = ?, expires_at = NULL, approved_duration_seconds = NULL
            WHERE id = ? AND owner_id = ? AND status = 'approved'
        `;
        const params = [new Date().toISOString(), requestId, ownerId];
        
        db.run(sqlUpdate, params, function(err) {
            if (err) {
                console.error(`[JIT_REVOKE_ERROR] Failed to revoke request ${requestId}:`, err.message);
                return res.status(500).json({ message: "Database error revoking request." });
            }
            if (this.changes === 0) {
                console.warn(`[JIT_REVOKE_FAIL] No approved request found for ID ${requestId} and owner ${ownerId} (race condition?).`);
                return res.status(404).json({ message: "Request not found or not in a revokable state." });
            }
            
            console.log(`[JIT_REVOKE_SUCCESS] Owner ${ownerId} revoked access for request ${requestId}.`);
            
            console.log(`[JIT_REVOKE_EMAIL] Sending revocation email to ${request.requester_email}`);
            sendEmail(
                request.requester_email,
                "Your Room Access Has Been Revoked",
                `<h3>Access Revoked</h3>
                 <p>Your access to the room "<strong>${request.room_name}</strong>" has been <strong>revoked</strong> by the owner.</p>
                 <p>If you need access again, you must submit a new request.</p>`
            );

            console.log(`[JIT_REVOKE] [SOCKET] Emitting 'JIT_REQUEST_UPDATED' and 'ROOM_LIST_UPDATED' events.`);
            req.io.emit('JIT_REQUEST_UPDATED'); 
            req.io.emit('ROOM_LIST_UPDATED'); 

            res.status(200).json({ message: "Access revoked successfully." });
        });
    });
};
// --- [JIT_FIX] FUNCTIONS END HERE ---


// --- [BLOCK 6] NEW PEER-TO-PEER JIT FUNCTIONS ---

/**
 * @desc      Request access to a Product (PO-to-PO) or Client (Admin-to-Admin)
 * @route     POST /api/jit/peer-request
 * @access    Private (ProductOwner, Administrator)
 */
const requestPeerAccess = async (req, res) => {
    const { type, resourceId, duration } = req.body; // type: 'product' | 'client'
    const { user } = req;
    const db = getDb();
    const now = new Date().toISOString();
    const requested_duration_seconds = parseDurationToSeconds(duration);

    console.log(`[JIT_PEER_REQ] User ${user.id} (Role: ${user.role}) requesting ${type} access for resource ${resourceId}`);

    if (requested_duration_seconds === null) {
        return res.status(400).json({ message: "A valid duration is required." });
    }

    try {
        let owners = [];
        let tableName = '';
        let resourceName = '';
        let resourceColumn = '';

        if (type === 'product' && user.role === 'ProductOwner') {
            tableName = 'product_access_requests';
            resourceColumn = 'product_id';
            
            // Find the product and its owner
            const product = await new Promise((resolve, reject) => {
                db.get(`SELECT p.product_name, u.id as owner_id, u.email as owner_email
                        FROM products p
                        JOIN users u ON p.product_owner_email = u.email
                        WHERE p.id = ?`, [resourceId], (err, row) => err ? reject(err) : resolve(row));
            });

            if (!product) return res.status(404).json({ message: "Product not found or has no owner." });
            if (product.owner_id === user.id) return res.status(400).json({ message: "You are already the owner of this product." });
            
            owners.push({ id: product.owner_id, email: product.owner_email });
            resourceName = product.product_name;

        } else if (type === 'client' && user.role === 'Administrator') {
            tableName = 'client_access_requests';
            resourceColumn = 'client_id';

            // Find the client and its assigned Admins
            const client = await new Promise((resolve, reject) => {
                db.get(`SELECT name FROM clients WHERE id = ?`, [resourceId], (err, row) => err ? reject(err) : resolve(row));
            });
            if (!client) return res.status(404).json({ message: "Client not found." });
            resourceName = client.name;

            const adminOwners = await new Promise((resolve, reject) => {
                db.all(`SELECT u.id, u.email 
                        FROM admin_client_assignments aca
                        JOIN users u ON aca.admin_id = u.id
                        WHERE aca.client_id = ? AND u.status = 'active'`, [resourceId], (err, rows) => err ? reject(err) : resolve(rows));
            });

            if (!adminOwners || adminOwners.length === 0) return res.status(404).json({ message: "This client has no assigned Administrator to request access from." });
            if (adminOwners.some(admin => admin.id === user.id)) return res.status(400).json({ message: "You are already an assigned manager for this client." });
            
            owners = adminOwners;
        
        } else {
            return res.status(403).json({ message: "Forbidden: You do not have permission to request this access type." });
        }

        // Create a request for each owner
        for (const owner of owners) {
            console.log(`[JIT_PEER_REQ_DB] Creating request for resource ${resourceId} from requester ${user.id} to owner ${owner.id}`);
            const insertSql = `
                INSERT INTO ${tableName} (
                    ${resourceColumn}, requester_id, owner_id, status, created_at, updated_at, requested_duration_seconds
                ) VALUES (?, ?, ?, 'pending', ?, ?, ?)
            `;
            await new Promise((resolve, reject) => {
                db.run(insertSql, [resourceId, user.id, owner.id, now, now, requested_duration_seconds], (err) => err ? reject(err) : resolve());
            });

            // Send email notification
            console.log(`[JIT_PEER_REQ_EMAIL] Sending notification to ${owner.email}`);
            sendEmail(
                owner.email,
                `New VAULT Access Request for ${type}`,
                `<h3>New Access Request</h3>
                 <p>The user <strong>${user.email}</strong> has requested temporary access to the ${type} "<strong>${resourceName}</strong>".</p>
                 <p>Please log in to your dashboard to approve or reject this request.</p>
                 <a href="${process.env.FRONTEND_URL}/dashboard" style="background-color:#2563eb;color:white;padding:12px 20px;text-align:center;text-decoration:none;display:inline-block;border-radius:8px;font-size:16px;">Go to Dashboard</a>`
            );
        }

        console.log(`[JIT_PEER_REQ] [SOCKET] Emitting 'PEER_JIT_UPDATED' event.`);
        req.io.emit('PEER_JIT_UPDATED'); // For all peer JIT lists

        res.status(201).json({ message: "Access request submitted successfully." });

    } catch (err) {
        console.error(`[JIT_PEER_REQ_ERROR] Critical error in requestPeerAccess for user ${user.id}:`, err.message);
        res.status(500).json({ message: 'Server error while processing your request.' });
    }
};

/**
 * @desc      Get all INCOMING peer-to-peer (Product/Client) JIT requests
 * @route     GET /api/jit/peer-incoming
 * @access    Private (ProductOwner, Administrator)
 */
const getIncomingPeerRequests = async (req, res) => {
    const { id: userId } = req.user;
    console.log(`[JIT_PEER_GET_IN] User ${userId} fetching INCOMING (Peer) requests.`);
    const db = getDb();
    
    try {
        const productRequestsSql = `
            SELECT 'product' as type, pr.id, pr.status, pr.created_at, pr.requested_duration_seconds,
                   p.product_name as resource_name, u.email as requester_email
            FROM product_access_requests pr
            JOIN products p ON pr.product_id = p.id
            JOIN users u ON pr.requester_id = u.id
            WHERE pr.owner_id = ? AND pr.status = 'pending'
        `;
        
        const clientRequestsSql = `
            SELECT 'client' as type, cr.id, cr.status, cr.created_at, cr.requested_duration_seconds,
                   c.name as resource_name, u.email as requester_email
            FROM client_access_requests cr
            JOIN clients c ON cr.client_id = c.id
            JOIN users u ON cr.requester_id = u.id
            WHERE cr.owner_id = ? AND cr.status = 'pending'
        `;

        const productRequests = await new Promise((res, rej) => db.all(productRequestsSql, [userId], (err, rows) => err ? rej(err) : res(rows)));
        const clientRequests = await new Promise((res, rej) => db.all(clientRequestsSql, [userId], (err, rows) => err ? rej(err) : res(rows)));

        console.log(`[JIT_PEER_GET_IN_SUCCESS] Found ${productRequests.length} product requests and ${clientRequests.length} client requests.`);
        res.status(200).json({ productRequests, clientRequests });

    } catch (err) {
        console.error(`[JIT_PEER_GET_IN_ERROR] Failed to fetch incoming peer requests for user ${userId}:`, err.message);
        res.status(500).json({ message: "Database error fetching requests." });
    }
};

/**
 * @desc      Get all OUTGOING peer-to-peer (Product/Client) JIT requests
 * @route     GET /api/jit/peer-outgoing
 * @access    Private (ProductOwner, Administrator)
 */
const getOutgoingPeerRequests = async (req, res) => {
    const { id: userId } = req.user;
    console.log(`[JIT_PEER_GET_OUT] User ${userId} fetching OUTGOING (Peer) requests.`);
    const db = getDb();
    
    try {
        const productRequestsSql = `
            SELECT 'product' as type, pr.id, pr.status, pr.updated_at, pr.expires_at, pr.approved_duration_seconds,
                   p.product_name as resource_name, u.email as owner_email
            FROM product_access_requests pr
            JOIN products p ON pr.product_id = p.id
            JOIN users u ON pr.owner_id = u.id
            WHERE pr.requester_id = ?
        `;
        
        const clientRequestsSql = `
            SELECT 'client' as type, cr.id, cr.status, cr.updated_at, cr.expires_at, cr.approved_duration_seconds,
                   c.name as resource_name, u.email as owner_email
            FROM client_access_requests cr
            JOIN clients c ON cr.client_id = c.id
            JOIN users u ON cr.owner_id = u.id
            WHERE cr.requester_id = ?
        `;

        const productRequests = await new Promise((res, rej) => db.all(productRequestsSql, [userId], (err, rows) => err ? rej(err) : res(rows)));
        const clientRequests = await new Promise((res, rej) => db.all(clientRequestsSql, [userId], (err, rows) => err ? rej(err) : res(rows)));
        
        const allRequests = [...productRequests, ...clientRequests].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

        console.log(`[JIT_PEER_GET_OUT_SUCCESS] Found ${allRequests.length} total outgoing peer requests.`);
        res.status(200).json(allRequests);

    } catch (err) {
        console.error(`[JIT_PEER_GET_OUT_ERROR] Failed to fetch outgoing peer requests for user ${userId}:`, err.message);
        res.status(500).json({ message: "Database error fetching requests." });
    }
};

/**
 * @desc      Respond to a peer request (approve, reject, revoke)
 * @route     PUT /api/jit/peer-respond
 * @access    Private (ProductOwner, Administrator)
 */
const respondToPeerRequest = async (req, res) => {
    const { requestId, type, action, duration } = req.body; // type: 'product' | 'client', action: 'approved' | 'rejected' | 'revoked'
    const { id: ownerId } = req.user;
    
    console.log(`[JIT_PEER_RESPOND] User ${ownerId} responding to ${type} request ${requestId} with action: ${action}`);

    const db = getDb();
    const now = new Date().toISOString();
    
    const tableName = type === 'product' ? 'product_access_requests' : 'client_access_requests';
    const resourceColumn = type === 'product' ? 'product_id' : 'client_id';

    let sql = `UPDATE ${tableName} SET status = ?, updated_at = ?`;
    const params = [action, now];

    try {
        let sqlGet = `
            SELECT r.status, r.${resourceColumn}, u.email AS requester_email
            FROM ${tableName} r
            JOIN users u ON r.requester_id = u.id
            WHERE r.id = ? AND r.owner_id = ?
        `;
        
        const request = await new Promise((res, rej) => db.get(sqlGet, [requestId, ownerId], (err, row) => err ? rej(err) : res(row)));

        if (!request) {
            console.warn(`[JIT_PEER_RESPOND_FAIL] Request ${requestId} (type: ${type}) not found or not owned by user ${ownerId}.`);
            return res.status(404).json({ message: "Request not found or you are not the owner." });
        }

        if (action === 'approved') {
            if (request.status !== 'pending') return res.status(400).json({ message: `Request is not pending (Status: ${request.status}).` });
            
            const approved_duration_seconds = parseDurationToSeconds(duration);
            let expires_at = null;
            if (approved_duration_seconds !== null) {
                expires_at = new Date(new Date().getTime() + approved_duration_seconds * 1000).toISOString();
            }
            sql += `, expires_at = ?, approved_duration_seconds = ?`;
            params.push(expires_at, approved_duration_seconds);

        } else if (action === 'rejected') {
            if (request.status !== 'pending') return res.status(400).json({ message: `Request is not pending (Status: ${request.status}).` });
        
        } else if (action === 'revoked') {
            if (request.status !== 'approved') return res.status(400).json({ message: `Only 'approved' requests can be revoked.` });
            sql += `, expires_at = NULL, approved_duration_seconds = NULL`;
        
        } else {
            return res.status(400).json({ message: "Invalid action." });
        }

        sql += ` WHERE id = ? AND owner_id = ?`;
        params.push(requestId, ownerId);

        const changes = await new Promise((resolve, reject) => {
            db.run(sql, params, function(err) {
                if (err) return reject(err);
                resolve(this.changes);
            });
        });

        if (changes === 0) {
            console.warn(`[JIT_PEER_RESPOND_FAIL] No request was updated for ID ${requestId} and owner ${ownerId} (race condition?).`);
            return res.status(404).json({ message: "Request state may have changed. Please refresh." });
        }

        console.log(`[JIT_PEER_RESPOND_SUCCESS] User ${ownerId} successfully set ${type} request ${requestId} to ${action}.`);
        
        // --- [BLOCK 6] EMIT SOCKET EVENT ---
        console.log(`[JIT_PEER_RESPOND] [SOCKET] Emitting 'PEER_JIT_UPDATED' and 'HIERARCHY_UPDATED' events.`);
        req.io.emit('PEER_JIT_UPDATED'); // For all peer JIT lists
        req.io.emit('HIERARCHY_UPDATED'); // For the main dashboard view
        // --- [END BLOCK 6] ---

        // TODO: Send notification email
        
        res.status(200).json({ message: `Request ${action} successfully.` });

    } catch (err) {
        console.error(`[JIT_PEER_RESPOND_ERROR] Critical error in respondToPeerRequest:`, err.message);
        res.status(500).json({ message: "Server error responding to request." });
    }
};

// --- [END BLOCK 6] ---


module.exports = {
    // Room JIT
    getIncomingRequests,
    approveRequest,
    rejectRequest,
    requestAccess,        
    getOutgoingRequests,  
    editRequest,          
    revokeRequest,
    
    // Peer JIT (New)
    requestPeerAccess,
    getIncomingPeerRequests,
    getOutgoingPeerRequests,
    respondToPeerRequest
};