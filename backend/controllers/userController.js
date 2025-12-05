// backend/controllers/userController.js - OPTIMIZED for PostgreSQL Concurrency

// Replaced SQLite imports with PostgreSQL imports
const { query, executeTransaction } = require('../database'); 
const logger = require('../utils/logger'); // Use centralized logger
const { sendEmail } = require('../services/emailService');

const SERVICE_NAME = 'userController';

/**
 * @desc 	  Get all users pending approval for the logged-in manager
 * @route 	 GET /api/users/pending
 * @access 	 Private (Admin, ProductOwner, CTO)
 */
const getPendingUsers = async (req, res) => {
    // [TASK 10 ATOMIC LOG] Get the logged-in manager's ID from req.user
    const managerId = req.user.id;
    logger.info(SERVICE_NAME, `Received GET /pending for manager ID: ${managerId}`);
    
    // [PG_MIGRATE] SQL conversion: using $1 placeholder
    const sql = `
        SELECT id, email, role, status, created_at 
        FROM users 
        WHERE manager_id = $1
        AND (status = 'suspended_user' OR status = 'suspended_admin')
        ORDER BY created_at ASC
    `;
    const params = [managerId];

    try {
        const resDb = await query(sql, params);
        logger.info(SERVICE_NAME, `Found ${resDb.rows.length} pending users.`);
        res.status(200).json(resDb.rows);
    } catch (error) {
        logger.error(SERVICE_NAME, `DB error fetching pending users:`, error.message);
        res.status(500).json({ message: "Error fetching pending users." });
    }
};

/**
 * @desc 	  Approve a pending user
 * @route 	 POST /api/users/approve/:userId
 * @access 	 Private (Admin, ProductOwner, CTO)
 */
const approveUser = async (req, res) => {
    const managerId = req.user.id;
    const { userId: targetUserId } = req.params;
    logger.info(SERVICE_NAME, `Manager ${managerId} attempting to approve user ${targetUserId}`);

    // [PG_MIGRATE] Use executeTransaction for atomicity (although not strictly necessary here, it's safer)
    const sql = `
        UPDATE users 
        SET status = 'active' 
        WHERE id = $1
        AND manager_id = $2
        AND (status = 'suspended_user' OR status = 'suspended_admin')
        RETURNING email; -- Use RETURNING for atomicity and fetching email
    `;
    const params = [targetUserId, managerId];
    
    try {
        const updateRes = await query(sql, params);

        if (updateRes.rowCount === 0) {
            logger.warn(SERVICE_NAME, `Manager ${managerId} failed to approve ${targetUserId}. User not found, not their report, or not suspended.`);
            return res.status(403).json({ message: "Failed to approve user: You may not be this user's manager or the user is not pending approval." });
        }

        const approvedUserEmail = updateRes.rows[0].email;
        logger.log(SERVICE_NAME, `User ${targetUserId} is now 'active'. Email: ${approvedUserEmail}`);
        
        // Send REAL email to approved user.
        if (approvedUserEmail) {
            logger.info(SERVICE_NAME, `Sending REAL approval email to ${approvedUserEmail}.`);
            sendEmail(
                approvedUserEmail,
                "Your VAULT Account is Approved!",
                `<h3>Welcome to VAULT!</h3><p>Your account has been approved by your manager and is now active.</p><p>You can now log in to the application.</p><a href="${process.env.FRONTEND_URL}/login" style="background-color:#2563eb;color:white;padding:12px 20px;text-align:center;text-decoration:none;display:inline-block;border-radius:8px;font-size:16px;">Log In</a>`
            );
        }
        
        // EMIT SOCKET EVENT
        logger.log(SERVICE_NAME, `[SOCKET] Emitting 'USER_LIST_UPDATED' event.`);
        req.io.emit('USER_LIST_UPDATED');

        res.status(200).json({ message: `User has been approved and is now active.` });
    } catch (error) {
        logger.error(SERVICE_NAME, `Failed to update user status for ${targetUserId}:`, error.message);
        res.status(500).json({ message: "Database error updating user status." });
    }
};

/**
 * @desc 	  Reject and delete a pending user
 * @route 	 DELETE /api/users/reject/:userId
 * @access 	 Private (Admin, ProductOwner, CTO)
 */
const rejectUser = async (req, res) => {
    const managerId = req.user.id;
    const { userId: targetUserId } = req.params;
    logger.info(SERVICE_NAME, `Manager ${managerId} attempting to REJECT user ${targetUserId}`);

    // [PG_MIGRATE] SQL conversion: using $1, $2 placeholders
    const sql = `
        DELETE FROM users 
        WHERE id = $1
        AND manager_id = $2
        AND (status = 'suspended_user' OR status = 'suspended_admin')
        RETURNING id;
    `;
    const params = [targetUserId, managerId];
    
    try {
        const deleteRes = await query(sql, params);

        if (deleteRes.rowCount === 0) {
            logger.warn(SERVICE_NAME, `Manager ${managerId} failed to reject ${targetUserId}. User not found, not their report, or not suspended.`);
            return res.status(403).json({ message: "Failed to reject user: You may not be this user's manager or the user is not pending approval." });
        }

        logger.info(SERVICE_NAME, `User ${targetUserId} has been deleted.`);
        
        // EMIT SOCKET EVENT
        logger.log(SERVICE_NAME, `[SOCKET] Emitting 'USER_LIST_UPDATED' event.`);
        req.io.emit('USER_LIST_UPDATED');
        
        res.status(200).json({ message: `User has been rejected and deleted.` });
    } catch (error) {
        logger.error(SERVICE_NAME, `Failed to delete user ${targetUserId}:`, error.message);
        res.status(500).json({ message: "Database error deleting user." });
    }
};


/**
 * @desc 	  Get all active team members for the manager
 * @route 	 GET /api/users/team
 * @access 	 Private (Admin, ProductOwner, CTO)
 */
const getTeam = async (req, res) => {
    const managerId = req.user.id;
    logger.info(SERVICE_NAME, `Received GET /team for manager ID: ${managerId}`);
    
    const sql = `
        SELECT id, email, role, status, created_at 
        FROM users 
        WHERE manager_id = $1 
        AND status = 'active'
        ORDER BY role, email ASC
    `;
    const params = [managerId];

    try {
        const resDb = await query(sql, params);
        logger.info(SERVICE_NAME, `Found ${resDb.rows.length} active team members.`);
        res.status(200).json(resDb.rows);
    } catch (error) {
        logger.error(SERVICE_NAME, `DB error fetching team:`, error.message);
        res.status(500).json({ message: "Error fetching team members." });
    }
};

/**
 * @desc 	  Get ALL team members (all statuses) for the manager
 * @route 	 GET /api/users/team/all
 * @access 	 Private (Admin, ProductOwner, CTO)
 */
const getAllTeamMembers = async (req, res) => {
    const managerId = req.user.id;
    logger.info(SERVICE_NAME, `Received GET /team/all for manager ID: ${managerId}`);
    
    const sql = `
        SELECT id, email, role, status, created_at 
        FROM users 
        WHERE manager_id = $1
        ORDER BY status, role, email ASC
    `;
    const params = [managerId];

    try {
        const resDb = await query(sql, params);
        logger.info(SERVICE_NAME, `Found ${resDb.rows.length} total team members.`);
        res.status(200).json(resDb.rows);
    } catch (error) {
        logger.error(SERVICE_NAME, `DB error fetching all team:`, error.message);
        res.status(500).json({ message: "Error fetching all team members." });
    }
};

// --- [BLOCK 2] NEW Function to get Users for an Admin (for "Send Downstream") ---
/**
 * @desc 	  Get all active 'User' role employees for the logged-in 'Administrator'
 * @route 	 GET /api/users/admin-users
 * @access 	 Private (Admin only)
 */
const getUsersForAdmin = async (req, res) => {
    const managerId = req.user.id;
    const managerRole = req.user.role; 
    
    logger.info(SERVICE_NAME, `[BLOCK_2] Received GET /admin-users for manager: ${managerId}, Role: ${managerRole}`);

    // Check against the CORE_ROLE KEY, not the display name.
    if (managerRole !== 'Admin') { 
        logger.warn(SERVICE_NAME, `Forbidden: User ${managerId} (Role: ${managerRole}) attempted to access admin-only route.`);
        return res.status(403).json({ message: 'Forbidden: This action is only available to Administrators.' });
    }

    const sql = `
        SELECT id, email 
        FROM users 
        WHERE manager_id = $1 
        AND role = 'User' -- Note: Role should match the CORE_ROLE key
        AND status = 'active'
        ORDER BY email ASC
    `;
    const params = [managerId];

    try {
        const resDb = await query(sql, params);
        logger.info(SERVICE_NAME, `[BLOCK_2] Found ${resDb.rows.length} active Users for Admin ${managerId}.`);
        res.status(200).json(resDb.rows);
    } catch (error) {
        logger.error(SERVICE_NAME, `[BLOCK_2] DB error fetching users for admin ${managerId}:`, error.message);
        res.status(500).json({ message: "Error fetching team members." });
    }
};
// --- [END BLOCK 2] ---


// --- [BUG_FIX] MODIFIED Function to handle PO deactivation ---
/**
 * @desc 	  Deactivate an active user
 * @route 	 POST /api/users/deactivate/:userId
 * @access 	 Private (Admin, ProductOwner, CTO)
 */
const deactivateUser = async (req, res) => {
    const managerId = req.user.id; 
    const { userId: targetUserId } = req.params; 
    logger.info(SERVICE_NAME, `Manager ${managerId} attempting to DEACTIVATE user ${targetUserId}`);

    // Use executeTransaction to ensure either deactivation AND re-assignment succeed, or neither does.
    try {
        const result = await executeTransaction(async (client) => {
            // 1. Verify existence, manager ownership, and current role.
            const findSql = `
                SELECT role, manager_id 
                FROM users 
                WHERE id = $1
                AND manager_id = $2 
                AND status = 'active'
            `;
            const findRes = await client.query(findSql, [targetUserId, managerId]);
            const userToDeactivate = findRes.rows[0];

            if (!userToDeactivate) {
                logger.warn(SERVICE_NAME, `Verification failed: User ${targetUserId} not found, not active, or manager mismatch.`);
                // Throwing here will trigger the ROLLBACK and propagate the error.
                throw new Error("Verification failed: User is not an active report."); 
            }

            const newManagerIdForOrphans = userToDeactivate.manager_id;
            logger.debug(SERVICE_NAME, `User ${targetUserId} found. Manager for orphans: ${newManagerIdForOrphans}.`);

            // 2. Deactivate the target user
            const deactivateSql = `UPDATE users SET status = 'deactivated' WHERE id = $1`;
            await client.query(deactivateSql, [targetUserId]);
            logger.info(SERVICE_NAME, `User ${targetUserId} successfully set to 'deactivated'.`);

            let reassignSql = null;
            let targetRoleKey = null;
            
            // 3. Handle hierarchical re-assignment (Orphan Fix)
            if (userToDeactivate.role === 'PO') {
                // PO deactivates: Re-assign Admins (whose role key is 'Admin')
                targetRoleKey = 'Admin';
            } else if (userToDeactivate.role === 'Admin') {
                // Admin deactivates: Re-assign Users (whose role key is 'User')
                targetRoleKey = 'User';
            }
            
            if (targetRoleKey) {
                 reassignSql = `
                    UPDATE users 
                    SET manager_id = $1 
                    WHERE manager_id = $2 AND role = $3
                    AND (status = 'active' OR status LIKE 'suspended%')
                `;
                const reassignRes = await client.query(reassignSql, [newManagerIdForOrphans, targetUserId, targetRoleKey]);
                logger.info(SERVICE_NAME, `Re-assigned ${reassignRes.rowCount} orphaned ${targetRoleKey}s.`);
            } else {
                 logger.debug(SERVICE_NAME, `No re-assignment needed (Target role: ${userToDeactivate.role}).`);
            }
            
            return { message: `User ${targetUserId} has been deactivated and ${targetRoleKey ? reassignRes.rowCount : 0} reports reassigned.` };
            
        }); // End executeTransaction

        logger.info(SERVICE_NAME, `Transaction complete. ${result.message}`);
        
        // EMIT SOCKET EVENT
        req.io.emit('USER_LIST_UPDATED');
        res.status(200).json({ message: `User has been deactivated.` });

    } catch (error) {
        logger.error(SERVICE_NAME, `Deactivation failed for ${targetUserId}. Error:`, error.message);
        
        if (error.message.includes("Verification failed")) {
            return res.status(403).json({ message: "Failed to deactivate user: User not found, not their report, or not active." });
        }
        res.status(500).json({ message: "Database error during deactivation process." });
    }
};
// --- [END BUG_FIX] ---

// --- [TASK 10] NEW Function to get ALL Users for CTO ---
const getAllUsersForCto = async (req, res) => {
    // Check against the CORE_ROLE KEY, not the display name.
    if (req.user.role !== 'CTO') {
        logger.warn(SERVICE_NAME, `Forbidden: Non-CTO user attempted to access /all-company.`);
        return res.status(403).json({ message: 'Forbidden: CTO access only.' });
    }

    logger.info(SERVICE_NAME, `Received GET /all-company for CTO ID: ${req.user.id}`);
    
    // PG_MIGRATE: The original query works, no params needed.
    const sql = `
        SELECT id, email, role, status, created_at 
        FROM users 
        ORDER BY role, status, email ASC
    `;

    try {
        const resDb = await query(sql);
        logger.info(SERVICE_NAME, `Found ${resDb.rows.length} total company users for CTO.`);
        res.status(200).json(resDb.rows);
    } catch (error) {
        logger.error(SERVICE_NAME, `DB error fetching all company users:`, error.message);
        res.status(500).json({ message: "Error fetching all users." });
    }
};

// --- [TASK 10] NEW Function to Reactivate a deactivated user ---
const reactivateUser = async (req, res) => {
    const managerId = req.user.id;
    const { userId: targetUserId } = req.params;
    logger.info(SERVICE_NAME, `Manager ${managerId} attempting to REACTIVATE user ${targetUserId}`);
    
    const sql = `
        UPDATE users 
        SET status = 'active' 
        WHERE id = $1
        AND manager_id = $2
        AND status = 'deactivated'
        RETURNING id;
    `;
    const params = [targetUserId, managerId];
    
    try {
        const updateRes = await query(sql, params);

        if (updateRes.rowCount === 0) {
            logger.warn(SERVICE_NAME, `Failed to reactivate ${targetUserId}. User not found, not their report, or not deactivated.`);
            return res.status(403).json({ message: "Failed to reactivate user: You may not be this user's manager or the user is not deactivated." });
        }

        logger.info(SERVICE_NAME, `User ${targetUserId} is now 'active' again.`);
        
        // EMIT SOCKET EVENT
        req.io.emit('USER_LIST_UPDATED');

        res.status(200).json({ message: `User has been reactivated.` });
    } catch (error) {
        logger.error(SERVICE_NAME, `Failed to reactivate user ${targetUserId}:`, error.message);
        res.status(500).json({ message: "Database error." });
    }
};

// --- [SIGNUP_FIX] NEW Function to get ALL active admins for a specific product ---
const getAdminsForProduct = async (req, res) => {
    const { productName } = req.query;
    logger.info(SERVICE_NAME, `Received GET /admins-for-product for product: ${productName}`);

    if (!productName) {
        return res.status(400).json({ message: 'Product name is required.' });
    }

    try {
        // 1. Get the product ID from the name.
        const productSql = `SELECT id FROM products WHERE product_name = $1 AND status = 'confirmed'`;
        const productRes = await query(productSql, [productName]);
        
        if (productRes.rows.length === 0) {
            logger.warn(SERVICE_NAME, `Product '${productName}' not found or not confirmed.`);
            return res.status(404).json({ message: 'Product not found or not confirmed.' });
        }

        const productId = productRes.rows[0].id;
        logger.debug(SERVICE_NAME, `Found product ID ${productId}. Searching for active admins...`);

        // 2. Find all active admins for that product ID (role = 'Admin').
        const adminsSql = `
            SELECT id, email 
            FROM users 
            WHERE product_id = $1 
            AND role = 'Admin' -- Use CORE_ROLE key
            AND status = 'active'
        `;
        const adminsRes = await query(adminsSql, [productId]);

        logger.info(SERVICE_NAME, `Found ${adminsRes.rows.length} active admins for product '${productName}'.`);
        res.status(200).json(adminsRes.rows);

    } catch (error) {
        logger.error(SERVICE_NAME, `Error in getAdminsForProduct:`, error.message);
        res.status(500).json({ message: 'Database error fetching admins.' });
    }
};
// --- [END SIGNUP_FIX] ---


module.exports = {
    getPendingUsers,
    approveUser,
    rejectUser,
    getTeam,
    getAllTeamMembers,
    getUsersForAdmin, 
    deactivateUser, 
    reactivateUser, 
    getAdminsForProduct,
    getAllUsersForCto 
};