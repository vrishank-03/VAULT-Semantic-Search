const { getDb } = require('../database');
// [SIGNUP_FIX] Removed local nodemailer.
require('dotenv').config();
// [SIGNUP_FIX] Import centralized email service.
const { sendEmail } = require('../services/emailService');

/**
 * @desc    Get all users pending approval for the logged-in manager
 * @route   GET /api/users/pending
 * @access  Private (Admin, ProductOwner, CTO)
 */
const getPendingUsers = (req, res) => {
    // [TASK 10 ATOMIC LOG] Get the logged-in manager's ID from req.user
    const managerId = req.user.id;
    console.log(`[USER_CTRL] Received GET /pending for manager ID: ${managerId}`);
    
    const db = getDb();

    // [TASK 10 ATOMIC LOG] Refactored SQL to use manager_id.
    // This single query correctly finds pending users for ANY manager role.
    // An Admin will see 'suspended_user's.
    // A PO will see 'suspended_admin's.
    const sql = `
        SELECT id, email, role, status, created_at 
        FROM users 
        WHERE manager_id = ? 
        AND (status = 'suspended_user' OR status = 'suspended_admin')
        ORDER BY created_at ASC
    `;
    const params = [managerId];

    console.log(`[USER_CTRL_DB] Executing: ${sql} with params: [${params.join(',')}]`);
    
    db.all(sql, params, (err, users) => {
        if (err) {
            console.error(`[USER_CTRL_DB_ERROR] DB error fetching pending users:`, err.message);
            return res.status(500).json({ message: "Error fetching pending users." });
        }
        console.log(`[USER_CTRL_SUCCESS] Found ${users.length} pending users.`);
        res.status(200).json(users);
    });
};

/**
 * @desc    Approve a pending user
 * @route   POST /api/users/approve/:userId
 * @access  Private (Admin, ProductOwner, CTO)
 */
const approveUser = (req, res) => {
    const managerId = req.user.id;
    const { userId: targetUserId } = req.params;
    console.log(`[USER_CTRL_APPROVE] Manager ${managerId} is attempting to approve user ${targetUserId}`);

    const db = getDb();

    // [TASK 10 ATOMIC LOG] Refactored to a single, secure, atomic SQL query.
    // This query updates the user's status to 'active' ONLY if:
    // 1. The user exists (id = ?)
    // 2. The user reports to the manager (manager_id = ?)
    // 3. The user is currently suspended.
    // This completely replaces the old, insecure authorization logic.
    const sql = `
        UPDATE users 
        SET status = 'active' 
        WHERE id = ? 
        AND manager_id = ?
        AND (status = 'suspended_user' OR status = 'suspended_admin')
    `;
    const params = [targetUserId, managerId];
            
    db.run(sql, params, function(updateErr) {
        if (updateErr) {
            console.error(`[USER_CTRL_APPROVE_ERROR] Failed to update user status for ${targetUserId}:`, updateErr.message);
            return res.status(500).json({ message: "Database error updating user status." });
        }

        // [TASK 10 ATOMIC LOG] Check if any row was actually changed.
        if (this.changes === 0) {
            console.warn(`[USER_CTRL_APPROVE_FAIL] Manager ${managerId} failed to approve ${targetUserId}. User not found, not their report, or not suspended.`);
            return res.status(403).json({ message: "Failed to approve user: You may not be this user's manager or the user is not pending approval." });
        }

        console.log(`[USER_CTRL_APPROVE_SUCCESS] User ${targetUserId} is now 'active'.`);
        
        // [TASK 10 ATOMIC LOG] Send REAL email to approved user. We must fetch their email.
        db.get('SELECT email FROM users WHERE id = ?', [targetUserId], (err, user) => {
            if (user && user.email) {
                console.log(`[USER_CTRL_EMAIL] Sending REAL email to ${user.email}.`);
                sendEmail(
                    user.email,
                    "Your VAULT Account is Approved!",
                    `<h3>Welcome to VAULT!</h3><p>Your account has been approved by your manager and is now active.</p><p>You can now log in to the application.</p><a href="${process.env.FRONTEND_URL}/login" style="background-color:#2563eb;color:white;padding:12px 20px;text-align:center;text-decoration:none;display:inline-block;border-radius:8px;font-size:16px;">Log In</a>`
                );
            }
        });
        
        res.status(200).json({ message: `User has been approved and is now active.` });
    });
};

/**
 * @desc    Reject and delete a pending user
 * @route   DELETE /api/users/reject/:userId
 * @access  Private (Admin, ProductOwner, CTO)
 */
const rejectUser = (req, res) => {
    const managerId = req.user.id;
    const { userId: targetUserId } = req.params;
    console.log(`[USER_CTRL_REJECT] Manager ${managerId} is attempting to REJECT user ${targetUserId}`);

    const db = getDb();
    
    // [TASK 10 ATOMIC LOG] Refactored to a single, secure, atomic SQL query.
    // Deletes the user ONLY if they report to this manager AND are suspended.
    const sql = `
        DELETE FROM users 
        WHERE id = ? 
        AND manager_id = ?
        AND (status = 'suspended_user' OR status = 'suspended_admin')
    `;
    const params = [targetUserId, managerId];
            
    db.run(sql, params, function(deleteErr) {
        if (deleteErr) {
            console.error(`[USER_CTRL_REJECT_ERROR] Failed to delete user ${targetUserId}:`, deleteErr.message);
            return res.status(500).json({ message: "Database error deleting user." });
        }

        if (this.changes === 0) {
            console.warn(`[USER_CTRL_REJECT_FAIL] Manager ${managerId} failed to reject ${targetUserId}. User not found, not their report, or not suspended.`);
            return res.status(403).json({ message: "Failed to reject user: You may not be this user's manager or the user is not pending approval." });
        }

        console.log(`[USER_CTRL_REJECT_SUCCESS] User ${targetUserId} has been deleted.`);
        
        // We can't email the user because we don't know their email after deleting them.
        // This is acceptable, as they were rejected.
        
        res.status(200).json({ message: `User has been rejected and deleted.` });
    });
};


/**
 * @desc    Get all active team members for the manager
 * @route   GET /api/users/team
 * @access  Private (Admin, ProductOwner, CTO)
 */
const getTeam = (req, res) => {
    const managerId = req.user.id;
    console.log(`[USER_CTRL] Received GET /team for manager ID: ${managerId}`);
    
    const db = getDb();

    // [TASK 10 ATOMIC LOG] Refactored SQL to use manager_id.
    // This finds all *active* users who report to the logged-in manager.
    const sql = `
        SELECT id, email, role, status, created_at 
        FROM users 
        WHERE manager_id = ? 
        AND status = 'active'
        ORDER BY role, email ASC
    `;
    const params = [managerId];

    db.all(sql, params, (err, users) => {
        if (err) {
            console.error(`[USER_CTRL_DB_ERROR] DB error fetching team:`, err.message);
            return res.status(500).json({ message: "Error fetching team members." });
        }
        console.log(`[USER_CTRL_SUCCESS] Found ${users.length} active team members.`);
        res.status(200).json(users);
    });
};

/**
 * @desc    Get ALL team members (all statuses) for the manager
 * @route   GET /api/users/team/all
 * @access  Private (Admin, ProductOwner, CTO)
 */
const getAllTeamMembers = (req, res) => {
    const managerId = req.user.id;
    console.log(`[USER_CTRL] Received GET /team/all for manager ID: ${managerId}`);
    
    const db = getDb();

    // [TASK 10 ATOMIC LOG] Refactored SQL to use manager_id.
    // This finds all users (active, suspended, deactivated) who report to the manager.
    const sql = `
        SELECT id, email, role, status, created_at 
        FROM users 
        WHERE manager_id = ?
        ORDER BY status, role, email ASC
    `;
    const params = [managerId];

    db.all(sql, params, (err, users) => {
        if (err) {
            console.error(`[USER_CTRL_DB_ERROR] DB error fetching all team:`, err.message);
            return res.status(500).json({ message: "Error fetching all team members." });
        }
        console.log(`[USER_CTRL_SUCCESS] Found ${users.length} total team members.`);
        res.status(200).json(users);
    });
};

// --- [TASK 10] NEW Function to Deactivate an active user ---
/**
 * @desc    Deactivate an active user
 * @route   POST /api/users/deactivate/:userId
 * @access  Private (Admin, ProductOwner, CTO)
 */
const deactivateUser = (req, res) => {
    const managerId = req.user.id;
    const { userId: targetUserId } = req.params;
    console.log(`[USER_CTRL_DEACTIVATE] Manager ${managerId} is attempting to DEACTIVATE user ${targetUserId}`);

    const db = getDb();
    
    // [TASK 10 ATOMIC LOG] New atomic SQL to deactivate.
    // Sets status to 'deactivated' ONLY if user is their report AND is 'active'.
    const sql = `
        UPDATE users 
        SET status = 'deactivated' 
        WHERE id = ? 
        AND manager_id = ?
        AND status = 'active'
    `;
    const params = [targetUserId, managerId];
            
    db.run(sql, params, function(updateErr) {
        if (updateErr) {
            console.error(`[USER_CTRL_DEACTIVATE_ERROR] Failed to deactivate user ${targetUserId}:`, updateErr.message);
            return res.status(500).json({ message: "Database error." });
        }

        if (this.changes === 0) {
            console.warn(`[USER_CTRL_DEACTIVATE_FAIL] Manager ${managerId} failed to deactivate ${targetUserId}. User not found, not their report, or not active.`);
            return res.status(403).json({ message: "Failed to deactivate user: You may not be this user's manager or the user is not active." });
        }

        console.log(`[USER_CTRL_DEACTIVATE_SUCCESS] User ${targetUserId} is now 'deactivated'.`);
        res.status(200).json({ message: `User has been deactivated.` });
    });
};

// --- [TASK 10] NEW Function to Reactivate a deactivated user ---
/**
 * @desc    Reactivate a deactivated user
 * @route   POST /api/users/reactivate/:userId
 * @access  Private (Admin, ProductOwner, CTO)
 */
const reactivateUser = (req, res) => {
    const managerId = req.user.id;
    const { userId: targetUserId } = req.params;
    console.log(`[USER_CTRL_REACTIVATE] Manager ${managerId} is attempting to REACTIVATE user ${targetUserId}`);

    const db = getDb();
    
    // [TASK 10 ATOMIC LOG] New atomic SQL to reactivate.
    // Sets status to 'active' ONLY if user is their report AND is 'deactivated'.
    const sql = `
        UPDATE users 
        SET status = 'active' 
        WHERE id = ? 
        AND manager_id = ?
        AND status = 'deactivated'
    `;
    const params = [targetUserId, managerId];
            
    db.run(sql, params, function(updateErr) {
        if (updateErr) {
            console.error(`[USER_CTRL_REACTIVATE_ERROR] Failed to reactivate user ${targetUserId}:`, updateErr.message);
            return res.status(500).json({ message: "Database error." });
        }

        if (this.changes === 0) {
            console.warn(`[USER_CTRL_REACTIVATE_FAIL] Manager ${managerId} failed to reactivate ${targetUserId}. User not found, not their report, or not deactivated.`);
            return res.status(403).json({ message: "Failed to reactivate user: You may not be this user's manager or the user is not deactivated." });
        }

        console.log(`[USER_CTRL_REACTIVATE_SUCCESS] User ${targetUserId} is now 'active' again.`);
        res.status(200).json({ message: `User has been reactivated.` });
    });
};

// --- [SIGNUP_FIX] NEW FUNCTION ---
/**
 * @desc    Get all active admins for a specific product
 * @route   GET /api/users/admins-for-product?productName=...
 * @access  Public
 */
const getAdminsForProduct = (req, res) => {
    const { productName } = req.query;
    console.log(`[USER_CTRL] [SIGNUP_FIX] Received GET /admins-for-product for product: ${productName}`);

    if (!productName) {
        console.warn('[USER_CTRL_WARN] [SIGNUP_FIX] No product name provided.');
        return res.status(400).json({ message: 'Product name is required.' });
    }

    const db = getDb();
    
    // First, get the product ID from the name.
    const productSql = `SELECT id FROM products WHERE product_name = ? AND status = 'confirmed'`;
    db.get(productSql, [productName], (err, product) => {
        if (err) {
            console.error(`[USER_CTRL_DB_ERROR] [SIGNUP_FIX] Error finding product '${productName}':`, err.message);
            return res.status(500).json({ message: 'Database error.' });
        }
        if (!product) {
            console.warn(`[USER_CTRL_WARN] [SIGNUP_FIX] Product '${productName}' not found or not confirmed.`);
            return res.status(404).json({ message: 'Product not found or not confirmed.' });
        }

        const productId = product.id;
        console.log(`[USER_CTRL_DB] [SIGNUP_FIX] Found product ID ${productId}. Searching for active admins...`);

        // Now, find all active admins for that product ID.
        const adminsSql = `
            SELECT id, email 
            FROM users 
            WHERE product_id = ? 
            AND role = 'Administrator' 
            AND status = 'active'
        `;
        db.all(adminsSql, [productId], (adminErr, admins) => {
            if (adminErr) {
                console.error(`[USER_CTRL_DB_ERROR] [SIGNUP_FIX] Error finding admins for product ID ${productId}:`, adminErr.message);
                return res.status(500).json({ message: 'Database error fetching admins.' });
            }

            console.log(`[USER_CTRL_SUCCESS] [SIGNUP_FIX] Found ${admins.length} active admins for product '${productName}'.`);
            res.status(200).json(admins);
        });
    });
};
// --- [END SIGNUP_FIX] ---


module.exports = {
    getPendingUsers,
    approveUser,
    rejectUser,
    getTeam,
    getAllTeamMembers,
    deactivateUser,     // --- [TASK 10] NEW Export
    reactivateUser,     // --- [TASK 10] NEW Export
    getAdminsForProduct // --- [SIGNUP_FIX] NEW Export
};