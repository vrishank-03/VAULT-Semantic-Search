const { getDb } = require('../database');

/**
 * @desc    Get all users pending approval for the admin/PO's product
 * @route   GET /api/users/pending
 * @access  Private (Admin or ProductOwner)
 */
// --- [FIX] Changed to const declaration ---
const getPendingUsers = (req, res) => {
    const adminUserId = req.user.id;
    console.log(`[USER_CTRL] Received GET /pending for user ID: ${adminUserId}`);
    
    const db = getDb();

    // 1. Get the logged-in user's role and product ID
    const userSql = `SELECT role, product_id FROM users WHERE id = ?`;
    db.get(userSql, [adminUserId], (err, adminUser) => {
        if (err) {
            console.error(`[USER_CTRL_ERROR] DB error fetching admin user ${adminUserId}:`, err.message);
            return res.status(500).json({ message: "Error fetching user data." });
        }
        if (!adminUser) {
            console.warn(`[USER_CTRL_WARN] Admin user ${adminUserId} not found.`);
            return res.status(404).json({ message: "User not found." });
        }

        console.log(`[USER_CTRL] User ${adminUserId} is Role: ${adminUser.role}, ProductID: ${adminUser.product_id}`);

        // 2. Build the query based on the user's role
        let pendingSql = `SELECT id, email, role, status, created_at FROM users WHERE product_id = ?`;
        const params = [adminUser.product_id];

        if (adminUser.role === 'ProductOwner') {
            // Product Owners see suspended Admins AND Users for their product
            console.log(`[USER_CTRL] User is 'ProductOwner'. Fetching all suspended users for product ${adminUser.product_id}`);
            pendingSql += ` AND (status = 'suspended_admin' OR status = 'suspended_user')`;
        } else if (adminUser.role === 'Administrator') {
            // Admins see ONLY suspended Users for their product
            console.log(`[USER_CTRL] User is 'Administrator'. Fetching only suspended users for product ${adminUser.product_id}`);
            pendingSql += ` AND status = 'suspended_user'`;
        } else {
            // Regular Users have no access
            console.warn(`[USER_CTRL_FAIL] User ${adminUserId} (Role: ${adminUser.role}) tried to get pending list. Forbidden.`);
            return res.status(403).json({ message: "Forbidden: You do not have permission to view this list." });
        }

        pendingSql += ` ORDER BY created_at ASC`;

        // 3. Execute the query
        console.log(`[USER_CTRL_DB] Executing: ${pendingSql} with params: [${params.join(',')}]`);
        db.all(pendingSql, params, (pendingErr, users) => {
            if (pendingErr) {
                console.error(`[USER_CTRL_DB_ERROR] DB error fetching pending users:`, pendingErr.message);
                return res.status(500).json({ message: "Error fetching pending users." });
            }

            console.log(`[USER_CTRL_SUCCESS] Found ${users.length} pending users.`);
            res.status(200).json(users);
        });
    });
};

/**
 * @desc    Approve a pending user
 * @route   POST /api/users/approve/:userId
 * @access  Private (Admin or ProductOwner)
 */
// --- [FIX] Changed to const declaration ---
const approveUser = (req, res) => {
    const adminUserId = req.user.id;
    const { userId: targetUserId } = req.params;
    console.log(`[USER_CTRL_APPROVE] User ${adminUserId} is attempting to approve user ${targetUserId}`);

    const db = getDb();

    // 1. Get the logged-in user's details
    const adminSql = `SELECT role, product_id FROM users WHERE id = ?`;
    db.get(adminSql, [adminUserId], (err, adminUser) => {
        if (err || !adminUser) {
            console.error(`[USER_CTRL_APPROVE_ERROR] DB error fetching admin user ${adminUserId}:`, err ? err.message : "Not Found");
            return res.status(500).json({ message: "Error fetching user data." });
        }
        
        // 2. Get the target user's details
        const targetSql = `SELECT email, role, status, product_id FROM users WHERE id = ?`;
        db.get(targetSql, [targetUserId], (targetErr, targetUser) => {
            if (targetErr || !targetUser) {
                console.error(`[USER_CTRL_APPROVE_ERROR] DB error fetching target user ${targetUserId}:`, targetErr ? targetErr.message : "Not Found");
                return res.status(404).json({ message: "User to approve not found." });
            }

            console.log(`[USER_CTRL_APPROVE] Admin Role: ${adminUser.role}, Target Role: ${targetUser.role}, Target Status: ${targetUser.status}`);

            // 3. Authorize the action
            let isAuthorized = false;
            
            // Check if they are in the same product
            if (adminUser.product_id === targetUser.product_id) {
                if (adminUser.role === 'ProductOwner') {
                    // PO can approve Admins and Users
                    if (targetUser.status === 'suspended_admin' || targetUser.status === 'suspended_user') {
                        isAuthorized = true;
                    }
                } else if (adminUser.role === 'Administrator') {
                    // Admin can ONLY approve Users
                    if (targetUser.status === 'suspended_user') {
                        isAuthorized = true;
                    }
                }
            }

            if (!isAuthorized) {
                console.warn(`[USER_CTRL_APPROVE_FAIL] User ${adminUserId} (Role: ${adminUser.role}) is NOT authorized to approve user ${targetUserId} (Status: ${targetUser.status}). Forbidden.`);
                return res.status(403).json({ message: "Forbidden: You do not have permission to approve this user." });
            }

            // 4. Action: Approve the user
            console.log(`[USER_CTRL_APPROVE_SUCCESS] User ${adminUserId} is authorized. Activating user ${targetUserId}.`);
            
            // --- [MODIFIED] Set status to 'active' AND link the user to their admin ---
            // We set admin_id to the ID of the person *doing the approving*
            // unless the person being approved is an Admin (they don't have an admin_id)
            const newAdminId = targetUser.role === 'Administrator' ? null : adminUserId;
            
            const updateSql = `UPDATE users SET status = 'active', admin_id = ? WHERE id = ?`;
            const params = [newAdminId, targetUserId];
            
            console.log(`[USER_CTRL_APPROVE_DB] Setting user ${targetUserId} to active and admin_id to ${newAdminId}`);
            
            db.run(updateSql, params, function(updateErr) {
                if (updateErr) {
                    console.error(`[USER_CTRL_APPROVE_ERROR] Failed to update user status for ${targetUserId}:`, updateErr.message);
                    return res.status(500).json({ message: "Database error updating user status." });
                }

                console.log(`[USER_CTRL_APPROVE_SUCCESS] User ${targetUserId} (${targetUser.email}) is now 'active'.`);
                
                // 5. --- SIMULATE EMAIL to approved user ---
                console.log(`[USER_CTRL_EMAIL] SIMULATING email send to ${targetUser.email}.`);
                console.log(`[USER_CTRL_EMAIL] SUBJ: Your VAULT Account is Approved!`);
                console.log(`[USER_CTRL_EMAIL] BODY: Your account has been approved by an administrator. You can now log in.`);
                // --- END SIMULATION ---

                res.status(200).json({ message: `User ${targetUser.email} has been approved and is now active.` });
            });
        });
    });
};

// --- [NEW] Function to reject and delete a user ---
/**
 * @desc    Reject and delete a pending user
 * @route   DELETE /api/users/reject/:userId
 * @access  Private (Admin or ProductOwner)
 */
const rejectUser = (req, res) => {
    const adminUserId = req.user.id;
    const { userId: targetUserId } = req.params;
    console.log(`[USER_CTRL_REJECT] User ${adminUserId} is attempting to REJECT user ${targetUserId}`);

    const db = getDb();

    // 1. Get the logged-in user's details
    const adminSql = `SELECT role, product_id FROM users WHERE id = ?`;
    db.get(adminSql, [adminUserId], (err, adminUser) => {
        if (err || !adminUser) {
            console.error(`[USER_CTRL_REJECT_ERROR] DB error fetching admin user ${adminUserId}:`, err ? err.message : "Not Found");
            return res.status(500).json({ message: "Error fetching user data." });
        }
        
        // 2. Get the target user's details
        const targetSql = `SELECT email, role, status, product_id FROM users WHERE id = ?`;
        db.get(targetSql, [targetUserId], (targetErr, targetUser) => {
            if (targetErr || !targetUser) {
                console.error(`[USER_CTRL_REJECT_ERROR] DB error fetching target user ${targetUserId}:`, targetErr ? targetErr.message : "Not Found");
                return res.status(404).json({ message: "User to reject not found." });
            }

            console.log(`[USER_CTRL_REJECT] Admin Role: ${adminUser.role}, Target Role: ${targetUser.role}, Target Status: ${targetUser.status}`);

            // 3. Authorize the action (Same logic as approving)
            let isAuthorized = false;
            
            if (adminUser.product_id === targetUser.product_id) {
                if (adminUser.role === 'ProductOwner') {
                    if (targetUser.status === 'suspended_admin' || targetUser.status === 'suspended_user') {
                        isAuthorized = true;
                    }
                } else if (adminUser.role === 'Administrator') {
                    if (targetUser.status === 'suspended_user') {
                        isAuthorized = true;
                    }
                }
            }

            if (!isAuthorized) {
                console.warn(`[USER_CTRL_REJECT_FAIL] User ${adminUserId} (Role: ${adminUser.role}) is NOT authorized to reject user ${targetUserId} (Status: ${targetUser.status}). Forbidden.`);
                return res.status(403).json({ message: "Forbidden: You do not have permission to reject this user." });
            }

            // 4. Action: Delete the user
            console.log(`[USER_CTRL_REJECT_SUCCESS] User ${adminUserId} is authorized. Deleting user ${targetUserId}.`);
            const deleteSql = `DELETE FROM users WHERE id = ?`;
            
            db.run(deleteSql, [targetUserId], function(deleteErr) {
                if (deleteErr) {
                    console.error(`[USER_CTRL_REJECT_ERROR] Failed to delete user ${targetUserId}:`, deleteErr.message);
                    return res.status(500).json({ message: "Database error deleting user." });
                }

                console.log(`[USER_CTRL_REJECT_SUCCESS] User ${targetUserId} (${targetUser.email}) has been deleted.`);
                
                // 5. --- SIMULATE EMAIL to rejected user ---
                console.log(`[USER_CTRL_EMAIL] SIMULATING email send to ${targetUser.email}.`);
                console.log(`[USER_CTRL_EMAIL] SUBJ: Your VAULT Account Request`);
                console.log(`[USER_CTRL_EMAIL] BODY: Your request to join VAULT has been rejected by an administrator. Please contact support if you believe this is an error.`);
                // --- END SIMULATION ---

                res.status(200).json({ message: `User ${targetUser.email} has been rejected and deleted.` });
            });
        });
    });
};
// --- [END NEW] ---

// --- [FIX] Use const definitions in module.exports ---
module.exports = {
    getPendingUsers,
    approveUser,
    rejectUser // --- [NEW] Export the new function
};