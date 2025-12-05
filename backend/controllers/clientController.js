// backend/controllers/clientController.js - OPTIMIZED for PostgreSQL and DB-Driven RBAC

// Replaced getDb with the PostgreSQL query utilities and logger
const { query, executeTransaction, CORE_ROLES } = require('../database'); 
const logger = require('../utils/logger');

const SERVICE_NAME = 'clientController';

// Map hardcoded role names to constant keys for internal checks
const ROLE_KEYS = {
    ADMIN: CORE_ROLES.find(r => r.key === 'Admin').key,
    PO: CORE_ROLES.find(r => r.key === 'PO').key,
    CTO: CORE_ROLES.find(r => r.key === 'CTO').key,
};


/**
 * @desc 	  Get all clients (for CreateRoomModal dropdown)
 * @route 	 GET /api/clients
 * @access 	 Private (Admin, PO, CTO)
 */
exports.getClients = async (req, res) => {
    logger.info(SERVICE_NAME, `Received GET /api/clients for user ID: ${req.user.id}`);
    
    const userId = req.user.id;
    
    try {
        // 1. Fetch user details, role, and product_id
        const userSql = `SELECT role, product_id FROM users WHERE id = $1`;
        const userRes = await query(userSql, [userId]);
        const user = userRes.rows[0];

        if (!user) {
            logger.warn(SERVICE_NAME, `User ${userId} not found.`);
            return res.status(404).json({ message: "User not found." });
        }
        
        // 2. Authorize using Role Keys
        const allowedRoles = [ROLE_KEYS.ADMIN, ROLE_KEYS.PO, ROLE_KEYS.CTO];
        if (!allowedRoles.includes(user.role)) {
            logger.warn(SERVICE_NAME, `User ${userId} (Role: ${user.role}) tried to get client list. Forbidden.`);
            return res.status(403).json({ message: "Forbidden: You do not have permission to view clients." });
        }

        logger.info(SERVICE_NAME, `User is '${user.role}'.`);

        // 3. Build the query based on role
        let clientSql = ``;
        let params = [];
        const userProductId = user.product_id; 

        if (user.role === ROLE_KEYS.CTO) {
            logger.info(SERVICE_NAME, `CTO fetching ALL clients from ALL products.`);
            // [PG_MIGRATE] Using PG JOIN syntax
            clientSql = `
                SELECT c.id, c.name, c.product_id, p.product_name 
                FROM clients c 
                JOIN products p ON c.product_id = p.id 
                ORDER BY p.product_name, c.name ASC
            `;
        } else {
            // Admin and PO get clients for their specific product
            logger.info(SERVICE_NAME, `Fetching clients for product ${userProductId}`);
            clientSql = `SELECT id, name, product_id FROM clients WHERE product_id = $1 ORDER BY name ASC`;
            params = [userProductId];
        }

        // 4. Execute the query
        const clientRes = await query(clientSql, params);
        
        logger.info(SERVICE_NAME, `Found ${clientRes.rows.length} clients.`);
        res.status(200).json(clientRes.rows);

    } catch (error) {
        logger.error(SERVICE_NAME, `Error fetching clients:`, error.message);
        res.status(500).json({ message: "Error fetching clients." });
    }
};

/**
 * @desc 	  Create a new client
 * @route 	 POST /api/clients
 * @access 	 Private (Admin, PO, CTO)
 */
exports.createClient = async (req, res) => {
    logger.info(SERVICE_NAME, `Received POST /api/clients from user ID: ${req.user.id}`);
    
    const userId = req.user.id;

    try {
        // 1. Fetch user role and product_id
        const userSql = `SELECT role, product_id FROM users WHERE id = $1`;
        const userRes = await query(userSql, [userId]);
        const user = userRes.rows[0];

        if (!user) return res.status(404).json({ message: "User not found." });
        
        // 2. Authorize using Role Keys
        const allowedRoles = [ROLE_KEYS.ADMIN, ROLE_KEYS.PO, ROLE_KEYS.CTO];
        if (!allowedRoles.includes(user.role)) {
            logger.warn(SERVICE_NAME, `User ${userId} (Role: ${user.role}) tried to create a client. Forbidden.`);
            return res.status(403).json({ message: "Forbidden: Insufficient permissions." });
        }

        // 3. Determine product ID for insertion
        const { name, productId: bodyProductId } = req.body;
        if (!name) return res.status(400).json({ message: "Client name is required." });

        let clientProductId;
        if (user.role === ROLE_KEYS.ADMIN || user.role === ROLE_KEYS.PO) {
            clientProductId = user.product_id;
        } else if (user.role === ROLE_KEYS.CTO) {
            if (!bodyProductId) {
                logger.warn(SERVICE_NAME, `CTO ${userId} did not provide a productId.`);
                return res.status(400).json({ message: "Product ID is required for CTO to create a client." });
            }
            clientProductId = bodyProductId;
        }

        // 4. Insert the new client
        const insertSql = `INSERT INTO clients (product_id, name) VALUES ($1, $2) RETURNING id, product_id, name`;
        const params = [clientProductId, name];

        const insertRes = await query(insertSql, params);
        const newClient = insertRes.rows[0];

        logger.info(SERVICE_NAME, `New client created with ID: ${newClient.id}`);
        
        // Emit Socket Event
        req.io.emit('CLIENT_LIST_UPDATED');

        res.status(201).json(newClient);

    } catch (error) {
        if (error.message.includes('unique constraint "clients_product_id_name_key"')) {
            logger.warn(SERVICE_NAME, `Client name '${req.body.name}' already exists for this product.`);
            return res.status(409).json({ message: `A client named '${req.body.name}' already exists for this product.` });
        }
        logger.error(SERVICE_NAME, `Failed to insert new client:`, error.message);
        return res.status(500).json({ message: 'Database error creating client.' });
    }
};

// --- [BLOCK 5] NEW FUNCTIONS ---

/**
 * @desc 	  Get assigned and available clients for a specific Admin
 * @route 	 GET /api/clients/assignments/:adminId
 * @access 	 Private (ProductOwner, CTO)
 */
exports.getAdminClientAssignments = async (req, res) => {
    const { adminId } = req.params;
    // req.user already contains role/product_id, but use keys for safety
    const { id: managerId, role: managerRole, product_id: managerProductId } = req.user;
    logger.info(SERVICE_NAME, `Manager ${managerId} (${managerRole}) fetching assignments for Admin ${adminId}`);

    try {
        // 1. Security Check: Verify Admin reports to this Manager (PO/CTO)
        const adminSql = `SELECT product_id, manager_id FROM users WHERE id = $1 AND role = $2`;
        const adminRes = await query(adminSql, [adminId, ROLE_KEYS.ADMIN]);
        const adminUser = adminRes.rows[0];

        if (!adminUser) return res.status(404).json({ message: "Administrator user not found." });

        // PO check: Must be the direct manager AND in the same product
        if (managerRole === ROLE_KEYS.PO && (adminUser.manager_id !== managerId || adminUser.product_id !== managerProductId)) {
            logger.warn(SERVICE_NAME, `PO ${managerId} not authorized to manage Admin ${adminId}.`);
            return res.status(403).json({ message: "Forbidden: You do not manage this Administrator." });
        }
        // CTO check is implicit: CTO manages everyone.

        // 2. Fetch all clients for this product
        const productClientsSql = `SELECT id, name FROM clients WHERE product_id = $1`;
        const productClientsRes = await query(productClientsSql, [adminUser.product_id]);
        const productClients = productClientsRes.rows;

        // 3. Fetch clients already assigned to this Admin
        const assignedSql = `SELECT client_id FROM admin_client_assignments WHERE admin_id = $1`;
        const assignedRes = await query(assignedSql, [adminId]);
        const assignedClientIds = new Set(assignedRes.rows.map(r => r.client_id));
        
        const assignedClients = [];
        const availableClients = [];

        for (const client of productClients) {
            if (assignedClientIds.has(client.id)) {
                assignedClients.push(client);
            } else {
                availableClients.push(client);
            }
        }

        logger.info(SERVICE_NAME, `Found ${assignedClients.length} assigned and ${availableClients.length} available clients for Admin ${adminId}.`);
        res.status(200).json({ assignedClients, availableClients });

    } catch (err) {
        logger.error(SERVICE_NAME, `Failed to get client assignments:`, err.message);
        res.status(500).json({ message: "Server error fetching client assignments." });
    }
};

/**
 * @desc 	  Update the clients assigned to a specific Admin
 * @route 	 PUT /api/clients/assignments/:adminId
 * @access 	 Private (ProductOwner, CTO)
 */
exports.updateAdminClientAssignments = async (req, res) => {
    const { adminId } = req.params;
    const { clientIds } = req.body; // Array of client IDs to assign
    const { id: managerId, role: managerRole } = req.user;
    logger.info(SERVICE_NAME, `Manager ${managerId} updating assignments for Admin ${adminId} with ${clientIds.length} clients.`);

    if (!Array.isArray(clientIds)) return res.status(400).json({ message: "clientIds must be an array." });

    try {
        await executeTransaction(async (client) => {
            // 1. Security Check (Admin Verification and Ownership)
            const adminSql = `SELECT product_id, manager_id FROM users WHERE id = $1 AND role = $2`;
            const adminRes = await client.query(adminSql, [adminId, ROLE_KEYS.ADMIN]);
            const adminUser = adminRes.rows[0];

            if (!adminUser) throw new Error("Administrator user not found.");

            // PO check
            if (managerRole === ROLE_KEYS.PO && adminUser.manager_id !== managerId) {
                throw new Error("Forbidden: Manager does not own this Administrator.");
            }
            
            const adminProductId = adminUser.product_id;

            // 2. Security Check: Verify all submitted clientIds belong to the correct product
            if (clientIds.length > 0) {
                const placeholders = clientIds.map((_, i) => `$${i + 2}`).join(','); // $2, $3, ...
                const productCheckSql = `SELECT COUNT(*) FROM clients WHERE id IN (${placeholders}) AND product_id = $1`;
                const productCheckRes = await client.query(productCheckSql, [adminProductId, ...clientIds]);
                
                if (parseInt(productCheckRes.rows[0].count, 10) !== clientIds.length) {
                    throw new Error("Forbidden: One or more selected clients do not belong to this product.");
                }
            }

            // 3. Delete old assignments
            await client.query(`DELETE FROM admin_client_assignments WHERE admin_id = $1`, [adminId]);
            logger.debug(SERVICE_NAME, `Deleted old assignments for Admin ${adminId}.`);

            // 4. Insert new assignments
            if (clientIds.length > 0) {
                // Bulk INSERT (PostgreSQL specific optimization)
                const insertValues = clientIds.map(clientId => `(${adminId}, ${clientId})`).join(',');
                const insertSql = `INSERT INTO admin_client_assignments (admin_id, client_id) VALUES ${insertValues}`;
                await client.query(insertSql);
                logger.debug(SERVICE_NAME, `Inserted ${clientIds.length} new assignments.`);
            }
            
            // Transaction commits here
        });

        // EMIT SOCKET EVENT (Outside transaction)
        req.io.emit('CLIENT_LIST_UPDATED');
        logger.info(SERVICE_NAME, `Successfully updated assignments for Admin ${adminId}.`);
        
        res.status(200).json({ message: "Client assignments updated successfully." });

    } catch (err) {
        logger.error(SERVICE_NAME, `Critical error in update:`, err.message);
        if (err.message.includes("Forbidden")) {
             return res.status(403).json({ message: err.message });
        }
        if (err.message.includes("not found")) {
             return res.status(404).json({ message: err.message });
        }
        res.status(500).json({ message: "Server error updating client assignments." });
    }
};

// --- [BLOCK 6] NEW HIERARCHICAL DASHBOARD FUNCTION ---

/**
 * @desc 	  Get all clients for a specific product, with access level
 * @route 	 GET /api/clients/product/:productId
 * @access 	 Private (CTO, PO, Admin)
 */
exports.getClientsForProduct = async (req, res) => {
    const { productId } = req.params;
    const { user } = req;
    logger.info(SERVICE_NAME, `User ${user.id} (${user.role}) fetching clients for Product ${productId}`);

    try {
        // 1. Get all clients for the product
        const allClientsSql = `SELECT id, name FROM clients WHERE product_id = $1`;
        const allClientsRes = await query(allClientsSql, [productId]);
        const allClients = allClientsRes.rows;

        if (allClients.length === 0) {
            logger.warn(SERVICE_NAME, `No clients found for product ${productId}.`);
            return res.status(200).json([]);
        }
        
        // 2. CTO/PO (Product Owner) Access Check
        if (user.role === ROLE_KEYS.CTO || (user.role === ROLE_KEYS.PO && user.product_id === parseInt(productId, 10))) {
            logger.info(SERVICE_NAME, `User is CTO or PO owner. Granting full access.`);
            const clientsWithAccess = allClients.map(c => ({ ...c, accessLevel: 'full', expires_at: null }));
            return res.status(200).json(clientsWithAccess);
        }
        
        let jitClientMap = new Map();

        // 3. PO JIT Access Check (PO accessing another PO's product)
        if (user.role === ROLE_KEYS.PO && user.product_id !== parseInt(productId, 10)) {
            const jitSql = `SELECT expires_at FROM product_access_requests 
                             WHERE product_id = $1 AND requester_id = $2 AND status = 'approved' AND expires_at > NOW()`;
            const jitAccessRes = await query(jitSql, [productId, user.id]);
            
            if (jitAccessRes.rows.length > 0) {
                logger.info(SERVICE_NAME, `PO ${user.id} granted JIT access to Product ${productId}.`);
                const clientsWithAccess = allClients.map(c => ({ ...c, accessLevel: 'full', expires_at: jitAccessRes.rows[0].expires_at }));
                return res.status(200).json(clientsWithAccess);
            }
             // If PO has no JIT, they see the clients but they are locked/read-only (default below)
        }


        // 4. Administrator Access Check (Assigned Clients + Client JIT)
        if (user.role === ROLE_KEYS.ADMIN) {
            if (user.product_id !== parseInt(productId, 10)) {
                logger.warn(SERVICE_NAME, `Admin ${user.id} tried to access clients for wrong product ${productId}.`);
                return res.status(403).json({ message: "Forbidden: You do not belong to this product." });
            }

            // Get Assigned Clients
            const assignmentsSql = `SELECT client_id FROM admin_client_assignments WHERE admin_id = $1`;
            const assignedRes = await query(assignmentsSql, [user.id]);
            const assignedClientIds = new Set(assignedRes.rows.map(r => r.client_id));

            // Get Client JIT Access
            const jitSql = `SELECT client_id, expires_at FROM client_access_requests 
                             WHERE requester_id = $1 AND status = 'approved' AND expires_at > NOW()`;
            const jitRes = await query(jitSql, [user.id]);
            jitClientMap = new Map(jitRes.rows.map(r => [r.client_id, r.expires_at]));

            logger.info(SERVICE_NAME, `Admin ${user.id} has ${assignedClientIds.size} assigned and ${jitClientMap.size} JIT clients.`);
            
            const clientsWithAccess = allClients.map(client => {
                if (assignedClientIds.has(client.id)) {
                    return { ...client, accessLevel: 'full', expires_at: null };
                }
                if (jitClientMap.has(client.id)) {
                    return { ...client, accessLevel: 'full', expires_at: jitClientMap.get(client.id) };
                }
                // Default: Locked/Visible
                return { ...client, accessLevel: 'locked', expires_at: null }; 
            });

            return res.status(200).json(clientsWithAccess);
        }

        // 5. Default Deny/Locked View for unassigned roles (e.g., PO viewing another product without JIT)
        logger.warn(SERVICE_NAME, `User ${user.id} (Role: ${user.role}) is not authorized for full client view.`);
        const clientsWithAccess = allClients.map(c => ({ ...c, accessLevel: 'locked', expires_at: null }));
        return res.status(200).json(clientsWithAccess);


    } catch (err) {
        logger.error(SERVICE_NAME, `Critical error:`, err.message);
        res.status(500).json({ message: "Server error fetching clients." });
    }
};
// --- [END BLOCK 6] ---