const { getDb } = require('../database');
const bcrypt = require('bcryptjs');

/**
 * @desc    Get chat rooms based on user's role (User, Admin, ProductOwner)
 * @route   GET /api/rooms
 * @access  Private
 */
const getRooms = (req, res) => {
    console.log(`[ROOM_CTRL] Received GET /api/rooms for user ID: ${req.user.id}`);
    
    // 1. Get database and user info
    const db = getDb();
    const userId = req.user.id;

    console.log(`[ROOM_CTRL] Fetching user details (role, product_id, admin_id) for user ${userId}`);
    // --- [MODIFIED] Fetch admin_id as well ---
    const userSql = `SELECT role, product_id, admin_id FROM users WHERE id = ?`;

    db.get(userSql, [userId], (err, user) => {
        if (err) {
            console.error(`[ROOM_CTRL_ERROR] DB error fetching user ${userId}:`, err.message);
            return res.status(500).json({ message: "Error fetching user data." });
        }
        if (!user) {
            console.warn(`[ROOM_CTRL_WARN] User ${userId} not found.`);
            return res.status(404).json({ message: "User not found." });
        }

        console.log(`[ROOM_CTRL] User ${userId} is Role: ${user.role}, ProductID: ${user.product_id}, AdminID: ${user.admin_id}`);

        // 2. Build the query based on the user's role (NEW HIERARCHY)
        let roomSql = ``;
        const params = [];

        // Base query columns
        const baseSelect = `
            SELECT 
                cr.id, cr.name, cr.color, cr.client_id,
                cr.password_hash IS NOT NULL AS isPasswordProtected,
                c.name AS client_name, 
                p.product_name
            FROM chat_rooms cr
            LEFT JOIN clients c ON cr.client_id = c.id
            LEFT JOIN products p ON cr.product_id = p.id
        `;

        if (user.role === 'ProductOwner' || user.role === 'CTO') {
            // --- Product Owners/CTO see all rooms for all products ---
            console.log(`[ROOM_CTRL] User is '${user.role}'. Fetching ALL rooms.`);
            roomSql = `${baseSelect} ORDER BY p.product_name, c.name, cr.name`;
        
        } else if (user.role === 'Administrator') {
            // --- Admins see all rooms for their one product ---
            console.log(`[ROOM_CTRL] User is 'Administrator'. Fetching all rooms for product ${user.product_id}`);
            roomSql = `
                ${baseSelect}
                WHERE cr.product_id = ?
                ORDER BY c.name, cr.name
            `;
            params.push(user.product_id);
        
        // --- [MODIFIED] This is the new, correct logic for Users ---
        } else if (user.role === 'User') {
            // --- Users see ONLY rooms created by their assigned Admin ---
            console.log(`[ROOM_CTRL] User is 'User'. Fetching rooms for their Admin ID: ${user.admin_id}`);
            if (!user.admin_id) {
                console.log(`[ROOM_CTRL] User has no admin_id, returning 0 rooms.`);
                return res.status(200).json([]); // Return empty array if user has no admin
            }
            roomSql = `
                ${baseSelect}
                WHERE cr.admin_creator_id = ?
                ORDER BY c.name, cr.name
            `;
            params.push(user.admin_id);
        // --- [END MODIFIED] ---
        
        } else {
            // Default (e.g., a new role we haven't defined) - no access
            console.warn(`[ROOM_CTRL_WARN] Unknown role '${user.role}' for user ${userId}. Returning no rooms.`);
            return res.status(200).json([]);
        }

        // 3. Execute the query
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
 * @desc    Create a new chat room
 * @route   POST /api/rooms
 * @access  Private (Admin Only)
 */
const createRoom = async (req, res) => {
    console.log(`[ROOM_CTRL_CREATE] Received POST /api/rooms from user ID: ${req.user.id}`);
    
    // 1. Get user info to check role
    const db = getDb();
    const userId = req.user.id; // This is the admin_creator_id

    console.log(`[ROOM_CTRL_CREATE] Fetching user role for user ${userId}`);
    const userSql = `SELECT role, product_id FROM users WHERE id = ?`;

    db.get(userSql, [userId], async (userErr, user) => {
        if (userErr) {
            console.error(`[ROOM_CTRL_CREATE_ERROR] DB error fetching user ${userId}:`, userErr.message);
            return res.status(500).json({ message: "Error fetching user data." });
        }
        if (!user) {
            console.warn(`[ROOM_CTRL_CREATE_WARN] User ${userId} not found.`);
            return res.status(404).json({ message: "User not found." });
        }

        // 2. Authorize: Only Admins can create rooms
        if (user.role !== 'Administrator') {
            console.warn(`[ROOM_CTRL_CREATE_FAIL] User ${userId} (Role: ${user.role}) tried to create a room. Forbidden.`);
            return res.status(403).json({ message: "Forbidden: Only Administrators can create rooms." });
        }

        console.log(`[ROOM_CTRL_CREATE_SUCCESS] User ${userId} is an Administrator for product ${user.product_id}.`);

        // 3. Get room data from request body
        const { name, color, password, client_id } = req.body;
        if (!name || !client_id) {
            console.warn(`[ROOM_CTRL_CREATE_WARN] Validation failed: Room 'name' and 'client_id' are required.`);
            return res.status(400).json({ message: "Room name and Client are required." });
        }

        // 4. [NEW] Verify Admin has access to this client_id
        console.log(`[ROOM_CTRL_CREATE] Verifying Admin for product ${user.product_id} has access to client ${client_id}`);
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
            if (client.product_id !== user.product_id) {
                console.warn(`[ROOM_CTRL_CREATE_FAIL] Admin for product ${user.product_id} tried to create a room for client ${client_id} (Product ${client.product_id}). Forbidden.`);
                return res.status(403).json({ message: "Forbidden: You can only create rooms for clients within your own product." });
            }

            console.log(`[ROOM_CTRL_CREATE_SUCCESS] Admin access to client ${client_id} verified.`);

            // 5. Hash password if it was provided
            let password_hash = null;
            if (password) {
                console.log(`[ROOM_CTRL_CREATE] Password provided. Hashing...`);
                const salt = await bcrypt.genSalt(10);
                password_hash = await bcrypt.hash(password, salt);
                console.log(`[ROOM_CTRL_CREATE] Password hashed successfully.`);
            } else {
                console.log(`[ROOM_CTRL_CREATE] No password provided. Room will be public.`);
            }
            
            // --- [MODIFIED] Added product_id AND admin_creator_id to the INSERT statement ---
            const adminProductId = user.product_id; 
            const adminCreatorId = userId; // The ID of the admin creating the room
            
            const insertSql = `
                INSERT INTO chat_rooms (client_id, product_id, admin_creator_id, name, color, password_hash)
                VALUES (?, ?, ?, ?, ?, ?)
            `;
            const params = [client_id, adminProductId, adminCreatorId, name, color || '#FFFFFF', password_hash];

            console.log(`[ROOM_CTRL_DB] Executing insert for client ${client_id} with params: [${client_id}, ${adminProductId}, ${adminCreatorId}, ${name}, ${color}, ${password_hash ? '***' : null}]`);
            // --- [END MODIFIED] ---

            db.run(insertSql, params, function (insertErr) {
                if (insertErr) {
                    console.error(`[ROOM_CTRL_DB_ERROR] Failed to insert new room:`, insertErr.message);
                    return res.status(500).json({ message: 'Database error creating room.' });
                }

                const newRoomId = this.lastID;
                console.log(`[ROOM_CTRL_SUCCESS] New room created with ID: ${newRoomId}`);
                
                // 7. Return the newly created room (minus the hash)
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
                        return res.status(201).json({ id: newRoomId }); // Send minimal response
                    }
                    res.status(201).json(newRoom);
                });
            });
        });
    });
};

/**
 * @desc    Logs a user entry into a chat room
 * @route   POST /api/rooms/log-entry/:roomId
 * @access  Private
 */
const logRoomEntry = (req, res) => {
    const { roomId } = req.params;
    const userId = req.user.id;
    console.log(`[ROOM_LOG_CTRL] Received log-entry for user ${userId} in room ${roomId}`);

    const db = getDb();
    
    // TODO: We should validate that the user has access to this room before logging.
    // For now, we will just log the entry directly.

    const sql = `INSERT INTO room_session_logs (user_id, room_id, login_timestamp) VALUES (?, ?, ?)`;
    const params = [userId, roomId, new Date().toISOString()];

    console.log(`[ROOM_LOG_DB] Executing: ${sql} with params: [${userId}, ${roomId}, ...]`);

    db.run(sql, params, function(err) {
        if (err) {
            console.error(`[ROOM_LOG_DB_ERROR] Failed to log room entry:`, err.message);
            // We'll return 500 but this shouldn't block the user
            return res.status(500).json({ message: "Failed to create log entry." });
        }
        
        const logId = this.lastID;
        console.log(`[ROOM_LOG_SUCCESS] Logged session entry with ID: ${logId}`);
        
        // We will also need a 'log-exit' endpoint later.
        // For now, just return the ID of the new log.
        res.status(201).json({ sessionLogId: logId });
    });
};

module.exports = {
    getRooms,
    createRoom,
    logRoomEntry
};