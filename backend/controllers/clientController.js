const { getDb } = require('../database');

/**
 * @desc    Get all clients for the logged-in Admin's product
 * @route   GET /api/clients
 * @access  Private (Admin Only)
 */
exports.getClientsForAdmin = (req, res) => {
    console.log(`[CLIENT_CTRL] Received GET /api/clients for user ID: ${req.user.id}`);
    
    // 1. Get database and user info
    const db = getDb();
    const userId = req.user.id;

    console.log(`[CLIENT_CTRL] Fetching user details (role, product_id) for user ${userId}`);
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

        // 2. Authorize: Only Admins and POs can see this list
        if (user.role !== 'Administrator' && user.role !== 'ProductOwner') {
             console.warn(`[CLIENT_CTRL_FAIL] User ${userId} (Role: ${user.role}) tried to get client list. Forbidden.`);
            return res.status(403).json({ message: "Forbidden: You do not have permission to view clients." });
        }

        console.log(`[CLIENT_CTRL] User is '${user.role}'. Fetching clients for product ${user.product_id}`);

        // 3. Build the query
        const clientSql = `SELECT id, name FROM clients WHERE product_id = ? ORDER BY name ASC`;
        const params = [user.product_id];

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
 * @desc    Create a new client
 * @route   POST /api/clients
 * @access  Private (Admin Only)
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

        // 2. Authorize: Only Admins can create clients
        if (user.role !== 'Administrator') {
            console.warn(`[CLIENT_CTRL_CREATE_FAIL] User ${userId} (Role: ${user.role}) tried to create a client. Forbidden.`);
            return res.status(403).json({ message: "Forbidden: Only Administrators can create clients." });
        }

        console.log(`[CLIENT_CTRL_CREATE_SUCCESS] User ${userId} is an Administrator for product ${user.product_id}.`);

        // 3. Get client data from request body
        const { name } = req.body;
        if (!name) {
            console.warn(`[CLIENT_CTRL_CREATE_WARN] Validation failed: Client name is required.`);
            return res.status(400).json({ message: "Client name is required." });
        }

        // 4. Insert the new client into the database
        const adminProductId = user.product_id;
        const insertSql = `INSERT INTO clients (product_id, name) VALUES (?, ?)`;
        const params = [adminProductId, name];

        console.log(`[CLIENT_CTRL_DB] Executing insert for product ${adminProductId} with params: [${adminProductId}, ${name}]`);

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
                product_id: adminProductId,
                name: name,
            });
        });
    });
};
