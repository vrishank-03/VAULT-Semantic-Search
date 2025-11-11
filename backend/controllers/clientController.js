// backend/controllers/clientController.js

const { getDb } = require('../database');

/**
 * @desc      Get all clients (for CreateRoomModal dropdown)
 * @route     GET /api/clients
 * @access    Private (Admin, PO, CTO)
 */
exports.getClients = (req, res) => { // Renamed from getClientsForAdmin for clarity
    console.log(`[CLIENT_CTRL] Received GET /api/clients for user ID: ${req.user.id}`);
    
    // 1. Get database and user info
    const db = getDb();
    const userId = req.user.id;

    console.log(`[CLIENT_CTRL] Fetching user details (role, product_id) for user ${userId}`);
    // [BUG_FIX] Also select product_id from the user, not just req.user
    const userSql = `SELECT role, product_id FROM users WHERE id = ?`;

    db.get(userSql, [userId], (err, user) => {
        if (err) {
            console.error(`[CLIENT_CTRL_ERROR] DB error fetching user ${userId}:`, err.message);
            return res.status(500).json({ message: "Error fetching user data." });
        }
        if (!user) {
            console.warn(`[CLIENT_CTRL_WARN] User ${userId} not found.`);
            return res.status(404).json({ message: "User not found." });
        }

        // 2. Authorize: Only Admins, POs, and CTOs can see this list
        const allowedRoles = ['Administrator', 'ProductOwner', 'CTO'];
        if (!allowedRoles.includes(user.role)) {
             console.warn(`[CLIENT_CTRL_FAIL] User ${userId} (Role: ${user.role}) tried to get client list. Forbidden.`);
            return res.status(403).json({ message: "Forbidden: You do not have permission to view clients." });
        }

        console.log(`[CLIENT_CTRL] User is '${user.role}'.`);

        // 3. Build the query based on role
        let clientSql = ``;
        let params = [];
        // [BUG_FIX] Use the product_id from the DB user object, not req.user
        const userProductId = user.product_id; 

        if (user.role === 'CTO') {
            console.log(`[CLIENT_CTRL] CTO fetching ALL clients from ALL products.`);
            clientSql = `
                SELECT c.id, c.name, c.product_id, p.product_name 
                FROM clients c 
                JOIN products p ON c.product_id = p.id 
                ORDER BY p.product_name, c.name ASC
            `;
        } else {
            // Admin and PO get clients for their specific product
            console.log(`[CLIENT_CTRL] Fetching clients for product ${userProductId}`);
            clientSql = `SELECT id, name, product_id FROM clients WHERE product_id = ? ORDER BY name ASC`;
            params = [userProductId];
        }

        // 4. Execute the query
        console.log(`[CLIENT_CTRL_DB] Executing: ${clientSql} with params: [${params.join(',')}]`);
        db.all(clientSql, params, (clientErr, clients) => {
            if (clientErr) {
                console.error(`[CLIENT_CTRL_DB_ERROR] DB error fetching clients:`, clientErr.message);
                return res.status(500).json({ message: "Error fetching clients." });
            }

            console.log(`[CLIENT_CTRL_SUCCESS] Found ${clients.length} clients.`);
            res.status(200).json(clients);
        });
    });
};

/**
 * @desc      Create a new client
 * @route     POST /api/clients
 * @access    Private (Admin, PO, CTO)
 */
exports.createClient = (req, res) => {
    console.log(`[CLIENT_CTRL_CREATE] Received POST /api/clients from user ID: ${req.user.id}`);
    
    // 1. Get user info to check role
    const db = getDb();
    const userId = req.user.id;

    console.log(`[CLIENT_CTRL_CREATE] Fetching user role for user ${userId}`);
    const userSql = `SELECT role, product_id FROM users WHERE id = ?`;

    db.get(userSql, [userId], async (userErr, user) => {
        if (userErr) {
            console.error(`[CLIENT_CTRL_CREATE_ERROR] DB error fetching user ${userId}:`, userErr.message);
            return res.status(500).json({ message: "Error fetching user data." });
        }
        if (!user) {
            console.warn(`[CLIENT_CTRL_CREATE_WARN] User ${userId} not found.`);
            return res.status(404).json({ message: "User not found." });
        }

        // 2. Authorize: Admins, POs, and CTOs can create clients
        const allowedRoles = ['Administrator', 'ProductOwner', 'CTO'];
        if (!allowedRoles.includes(user.role)) {
            console.warn(`[CLIENT_CTRL_CREATE_FAIL] User ${userId} (Role: ${user.role}) tried to create a client. Forbidden.`);
            return res.status(403).json({ message: "Forbidden: Only Administrators, Product Owners, or the CTO can create clients." });
        }

        console.log(`[CLIENT_CTRL_CREATE_AUTH] User ${userId} (Role: ${user.role}) is authorized.`);

        // 3. Get client data from request body
        const { name, productId } = req.body;
        if (!name) {
            console.warn(`[CLIENT_CTRL_CREATE_WARN] Validation failed: Client name is required.`);
            return res.status(400).json({ message: "Client name is required." });
        }

        let clientProductId;
        if (user.role === 'Administrator' || user.role === 'ProductOwner') {
            // [BUG_FIX] Use product_id from the DB user object
            clientProductId = user.product_id;
            console.log(`[CLIENT_CTRL_CREATE] User is ${user.role}, assigning client to product ${clientProductId}.`);
        } else if (user.role === 'CTO') {
            if (!productId) {
                console.warn(`[CLIENT_CTRL_CREATE_FAIL] CTO ${userId} did not provide a productId.`);
                return res.status(400).json({ message: "Product ID is required for CTO to create a client." });
            }
            clientProductId = productId;
            console.log(`[CLIENT_CTRL_CREATE] User is CTO, assigning client to specified product ${clientProductId}.`);
        }

        // 4. Insert the new client into the database
        const insertSql = `INSERT INTO clients (product_id, name) VALUES (?, ?)`;
        const params = [clientProductId, name];

        console.log(`[CLIENT_CTRL_DB] Executing insert for product ${clientProductId} with params: [${clientProductId}, ${name}]`);

        db.run(insertSql, params, function (insertErr) {
            if (insertErr) {
                if (insertErr.message.includes('UNIQUE constraint failed')) {
                    console.warn(`[CLIENT_CTRL_DB_WARN] Client name '${name}' already exists for this product.`);
                    return res.status(409).json({ message: `A client named '${name}' already exists for this product.` });
                }
                console.error(`[CLIENT_CTRL_DB_ERROR] Failed to insert new client:`, insertErr.message);
                return res.status(500).json({ message: 'Database error creating client.' });
            }

            const newClientId = this.lastID;
            console.log(`[CLIENT_CTRL_SUCCESS] New client created with ID: ${newClientId}`);
            
            // 5. Return the newly created client
            res.status(201).json({
                id: newClientId,
                product_id: clientProductId, 
                name: name,
            });
        });
    });
};

// --- [BLOCK 5] NEW FUNCTIONS ---

/**
 * @desc      Get assigned and available clients for a specific Admin
 * @route     GET /api/clients/assignments/:adminId
 * @access    Private (ProductOwner, CTO)
 */
exports.getAdminClientAssignments = async (req, res) => {
    const { adminId } = req.params;
    const { id: poId, role: poRole, product_id: poProductId } = req.user;
    console.log(`[CLIENT_CTRL_ASSIGN] PO/CTO ${poId} (Role: ${poRole}) fetching client assignments for Admin ${adminId}`);

    const db = getDb();

    try {
        // 1. Security Check: Verify Admin reports to this PO/CTO and is in their product
        const adminUser = await new Promise((resolve, reject) => {
            db.get(`SELECT product_id, manager_id FROM users WHERE id = ? AND role = 'Administrator'`, [adminId], (err, row) => err ? reject(err) : resolve(row));
        });

        if (!adminUser) {
            console.warn(`[CLIENT_CTRL_ASSIGN_FAIL] Admin user ${adminId} not found or is not an Administrator.`);
            return res.status(404).json({ message: "Administrator user not found." });
        }

        if (poRole === 'ProductOwner' && (adminUser.manager_id !== poId || adminUser.product_id !== poProductId)) {
            console.warn(`[CLIENT_CTRL_ASSIGN_FAIL] PO ${poId} is not authorized to manage Admin ${adminId}.`);
            return res.status(403).json({ message: "Forbidden: You do not manage this Administrator." });
        }

        // 2. Fetch all clients for this product
        const productClients = await new Promise((resolve, reject) => {
            db.all(`SELECT id, name FROM clients WHERE product_id = ?`, [adminUser.product_id], (err, rows) => err ? reject(err) : resolve(rows));
        });

        // 3. Fetch clients already assigned to this Admin
        const assignedClientRows = await new Promise((resolve, reject) => {
            db.all(`SELECT client_id FROM admin_client_assignments WHERE admin_id = ?`, [adminId], (err, rows) => err ? reject(err) : resolve(rows));
        });
        
        const assignedClientIds = new Set(assignedClientRows.map(r => r.client_id));
        
        const assignedClients = [];
        const availableClients = [];

        for (const client of productClients) {
            if (assignedClientIds.has(client.id)) {
                assignedClients.push(client);
            } else {
                availableClients.push(client);
            }
        }

        console.log(`[CLIENT_CTRL_ASSIGN_SUCCESS] Found ${assignedClients.length} assigned and ${availableClients.length} available clients for Admin ${adminId}.`);
        res.status(200).json({ assignedClients, availableClients });

    } catch (err) {
        console.error(`[CLIENT_CTRL_ASSIGN_ERROR] Failed to get client assignments:`, err.message);
        res.status(500).json({ message: "Server error fetching client assignments." });
    }
};

/**
 * @desc      Update the clients assigned to a specific Admin
 * @route     PUT /api/clients/assignments/:adminId
 * @access    Private (ProductOwner, CTO)
 */
exports.updateAdminClientAssignments = async (req, res) => {
    const { adminId } = req.params;
    const { clientIds } = req.body; // Array of client IDs to assign
    const { id: poId, role: poRole, product_id: poProductId } = req.user;
    console.log(`[CLIENT_CTRL_UPDATE_ASSIGN] PO/CTO ${poId} updating client assignments for Admin ${adminId} with clients: [${clientIds}]`);

    if (!Array.isArray(clientIds)) {
        return res.status(400).json({ message: "clientIds must be an array." });
    }

    const db = getDb();

    try {
        // 1. Security Check: Verify Admin reports to this PO/CTO
        const adminUser = await new Promise((resolve, reject) => {
            db.get(`SELECT product_id, manager_id FROM users WHERE id = ? AND role = 'Administrator'`, [adminId], (err, row) => err ? reject(err) : resolve(row));
        });

        if (!adminUser) {
            console.warn(`[CLIENT_CTRL_UPDATE_ASSIGN_FAIL] Admin user ${adminId} not found or is not an Administrator.`);
            return res.status(404).json({ message: "Administrator user not found." });
        }

        if (poRole === 'ProductOwner' && (adminUser.manager_id !== poId || adminUser.product_id !== poProductId)) {
            console.warn(`[CLIENT_CTRL_UPDATE_ASSIGN_FAIL] PO ${poId} is not authorized to manage Admin ${adminId}.`);
            return res.status(403).json({ message: "Forbidden: You do not manage this Administrator." });
        }
        
        // 2. Security Check: Verify all submitted clientIds belong to the correct product
        if (clientIds.length > 0) {
            const placeholders = clientIds.map(() => '?').join(',');
            const result = await new Promise((resolve, reject) => {
                db.get(`SELECT COUNT(*) as count FROM clients WHERE id IN (${placeholders}) AND product_id = ?`, 
                       [...clientIds, adminUser.product_id], 
                       (err, row) => err ? reject(err) : resolve(row));
            });
            
            if (result.count !== clientIds.length) {
                console.warn(`[CLIENT_CTRL_UPDATE_ASSIGN_FAIL] One or more client IDs do not belong to product ${adminUser.product_id}.`);
                return res.status(403).json({ message: "Forbidden: One or more selected clients do not belong to this product." });
            }
        }

        // 3. Perform Transaction: Delete all old, Insert all new
        db.serialize(() => {
            db.run("BEGIN TRANSACTION");

            // Delete old assignments
            db.run(`DELETE FROM admin_client_assignments WHERE admin_id = ?`, [adminId], (err) => {
                if (err) {
                    console.error(`[CLIENT_CTRL_UPDATE_ASSIGN_DB_ERROR] Failed to delete old assignments:`, err.message);
                    db.run("ROLLBACK");
                    return res.status(500).json({ message: "Database error during assignment update." });
                }
            });

            // Insert new assignments
            if (clientIds.length > 0) {
                const stmt = db.prepare(`INSERT INTO admin_client_assignments (admin_id, client_id) VALUES (?, ?)`);
                clientIds.forEach(clientId => {
                    stmt.run(adminId, clientId);
                });
                stmt.finalize((err) => {
                    if (err) {
                        console.error(`[CLIENT_CTRL_UPDATE_ASSIGN_DB_ERROR] Failed to insert new assignments:`, err.message);
                        db.run("ROLLBACK");
                        return res.status(500).json({ message: "Database error during assignment update." });
                    }
                });
            }

            // Commit transaction
            db.run("COMMIT", (err) => {
                if (err) {
                    console.error(`[CLIENT_CTRL_UPDATE_ASSIGN_DB_ERROR] Failed to commit transaction:`, err.message);
                    return res.status(500).json({ message: "Database error committing changes." });
                }

                console.log(`[CLIENT_CTRL_UPDATE_ASSIGN_SUCCESS] Successfully updated assignments for Admin ${adminId}.`);
                
                // --- [BLOCK 5] EMIT SOCKET EVENT ---
                console.log(`[CLIENT_CTRL_UPDATE_ASSIGN] [SOCKET] Emitting 'CLIENT_LIST_UPDATED' event.`);
                req.io.emit('CLIENT_LIST_UPDATED'); 
                // --- [END BLOCK 5] ---
                
                res.status(200).json({ message: "Client assignments updated successfully." });
            });
        });

    } catch (err) {
        console.error(`[CLIENT_CTRL_UPDATE_ASSIGN_ERROR] Critical error in update:`, err.message);
        res.status(500).json({ message: "Server error updating client assignments." });
    }
};

// --- [END BLOCK 5] ---

// --- [BLOCK 6] NEW HIERARCHICAL DASHBOARD FUNCTION ---
/**
 * @desc      Get all clients for a specific product, with access level
 * @route     GET /api/clients/product/:productId
 * @access    Private (CTO, PO, Admin)
 */
exports.getClientsForProduct = async (req, res) => {
    const { productId } = req.params;
    const { user } = req;
    const db = getDb();

    console.log(`[CLIENT_CTRL_GET_PROD] User ${user.id} (Role: ${user.role}) fetching clients for Product ${productId}`);

    try {
        // 1. Get all clients for the product
        const allClientsSql = `SELECT id, name FROM clients WHERE product_id = ?`;
        const allClients = await new Promise((res, rej) => 
            db.all(allClientsSql, [productId], (err, rows) => err ? rej(err) : res(rows))
        );

        if (allClients.length === 0) {
            console.log(`[CLIENT_CTRL_GET_PROD] No clients found for product ${productId}.`);
            return res.status(200).json([]);
        }

        // 2. Determine access level based on role
        if (user.role === 'CTO') {
            console.log(`[CLIENT_CTRL_GET_PROD] User is CTO. Granting full access to all clients.`);
            const clientsWithAccess = allClients.map(c => ({ ...c, accessLevel: 'full', expires_at: null }));
            return res.status(200).json(clientsWithAccess);
        }

        if (user.role === 'ProductOwner') {
            // PO has access if it's their product OR they have JIT access
            if (user.product_id === parseInt(productId, 10)) {
                console.log(`[CLIENT_CTRL_GET_PROD] User is PO. This is their own product. Granting full access.`);
                const clientsWithAccess = allClients.map(c => ({ ...c, accessLevel: 'full', expires_at: null }));
                return res.status(200).json(clientsWithAccess);
            }
            
            // Check for PO-to-PO JIT access
            const jitSql = `SELECT expires_at FROM product_access_requests 
                            WHERE product_id = ? AND requester_id = ? AND status = 'approved' AND expires_at > CURRENT_TIMESTAMP`;
            const jitAccess = await new Promise((res, rej) => db.get(jitSql, [productId, user.id], (err, row) => err ? rej(err) : res(row)));

            if (jitAccess) {
                console.log(`[CLIENT_CTRL_GET_PROD] User is PO. Granting JIT access via product_access_requests.`);
                const clientsWithAccess = allClients.map(c => ({ ...c, accessLevel: 'full', expires_at: jitAccess.expires_at }));
                return res.status(200).json(clientsWithAccess);
            }

            console.log(`[CLIENT_CTRL_GET_PROD] User is PO. This is not their product and no JIT. Returning locked.`);
            const clientsWithAccess = allClients.map(c => ({ ...c, accessLevel: 'locked', expires_at: null }));
            return res.status(200).json(clientsWithAccess);
        }

        if (user.role === 'Administrator') {
            if (user.product_id !== parseInt(productId, 10)) {
                console.warn(`[CLIENT_CTRL_GET_PROD_FAIL] Admin ${user.id} tried to access clients for wrong product ${productId}.`);
                return res.status(403).json({ message: "Forbidden: You do not belong to this product." });
            }

            // Admin is in the right product. Now check assignments and JIT.
            const assignmentsSql = `SELECT client_id FROM admin_client_assignments WHERE admin_id = ?`;
            const assignedRows = await new Promise((res, rej) => db.all(assignmentsSql, [user.id], (err, rows) => err ? rej(err) : res(rows)));
            const assignedClientIds = new Set(assignedRows.map(r => r.client_id));

            const jitSql = `SELECT client_id, expires_at FROM client_access_requests 
                            WHERE requester_id = ? AND status = 'approved' AND expires_at > CURRENT_TIMESTAMP`;
            const jitRows = await new Promise((res, rej) => db.all(jitSql, [user.id], (err, rows) => err ? rej(err) : res(rows)));
            const jitClientMap = new Map(jitRows.map(r => [r.client_id, r.expires_at]));

            console.log(`[CLIENT_CTRL_GET_PROD] Admin ${user.id} has ${assignedClientIds.size} assigned clients and ${jitClientMap.size} JIT clients.`);

            const clientsWithAccess = allClients.map(client => {
                if (assignedClientIds.has(client.id)) {
                    return { ...client, accessLevel: 'full', expires_at: null };
                }
                if (jitClientMap.has(client.id)) {
                    return { ...client, accessLevel: 'full', expires_at: jitClientMap.get(client.id) };
                }
                return { ...client, accessLevel: 'locked', expires_at: null };
            });

            return res.status(200).json(clientsWithAccess);
        }

        // Default deny for 'User' role
        console.warn(`[CLIENT_CTRL_GET_PROD_FAIL] User ${user.id} (Role: ${user.role}) is not authorized to view clients.`);
        return res.status(403).json({ message: "Forbidden: You do not have permission to view this resource." });

    } catch (err) {
        console.error(`[CLIENT_CTRL_GET_PROD_ERROR] Critical error:`, err.message);
        res.status(500).json({ message: "Server error fetching clients." });
    }
};
// --- [END BLOCK 6] ---