// backend/controllers/productController.js - OPTIMIZED for PostgreSQL and DB-Driven RBAC

console.log('[LOG] Loading productController.js...'); // V V IMP LOG
// Replaced getDb with the PostgreSQL query utilities
const { query, executeTransaction, CORE_ROLES } = require('../database'); 
const { CTO_EMAIL } = require('../credentials');
const bcrypt = require('bcryptjs'); 
const crypto = require('crypto'); 
const logger = require('../utils/logger'); // Use centralized logger
const { sendEmail } = require('../services/emailService');

const SERVICE_NAME = 'productController';

// --- HELPER FUNCTION: inviteOrPromotePO (REFACTORED for PostgreSQL and Role Keys) ---
/**
 * @desc 	  Handles the logic for inviting a new user as a PO or promoting an existing user.
 * @param 	 {object} client - The PostgreSQL transaction client.
 * @param 	 {string} poEmail - The email of the PO to invite/promote.
 * @param 	 {number} productId - The ID of the product they are being assigned to.
 * @param 	 {string} productName - The name of the product for the email.
 * @param 	 {number} ctoId - The ID of the CTO approving the product, to be set as manager.
 * @returns  {Promise<{action: string, userId: number}>} - Resolves with action and new PO's user ID.
 */
const inviteOrPromotePO = async (client, poEmail, productId, productName, ctoId) => {
    logger.info(SERVICE_NAME, `[PO_UPSERT] Checking user status for: ${poEmail}`);
    
    // Use CORE_ROLES for role keys
    const PO_ROLE_KEY = CORE_ROLES.find(r => r.key === 'PO').key; 
    
    // 1. Check if user exists
    const userRes = await client.query('SELECT * FROM users WHERE email = $1', [poEmail]);
    const user = userRes.rows[0];

    if (user) {
        // --- CASE 1: USER EXISTS (Promote) ---
        logger.info(SERVICE_NAME, `[PO_UPSERT] User ${poEmail} exists. Promoting to 'active' PO.`);
        
        const promoteSql = `
            UPDATE users SET 
                role = $1, 
                status = 'active', 
                product_id = $2, 
                manager_id = $3 
            WHERE email = $4
            RETURNING id;
        `;
        const promoteRes = await client.query(promoteSql, [PO_ROLE_KEY, productId, ctoId, poEmail]);

        logger.info(SERVICE_NAME, `[PO_UPSERT_SUCCESS] User ${poEmail} (ID: ${user.id}) promoted and assigned to manager ${ctoId}.`);
        
        // Send "You've been promoted" email (Non-blocking external call)
        const subject = `You are now the Product Owner for "${productName}"`;
        const html = `
            <h3 style="font-family: sans-serif;">You Have Been Assigned a Product</h3>
            <p style="font-family: sans-serif;">You have been assigned as the Product Owner for "<strong>${productName}</strong>" in VAULT.</p>
            <p style="font-family: sans-serif;">Your account ("<strong>${poEmail}</strong>") is now active with Product Owner permissions.</p>
            <p style="font-family: sans-serif;">You can log in with your existing password.</p>
        `;
        sendEmail(poEmail, subject, html);
        
        return { action: 'promoted', userId: user.id }; 

    } else {
        // --- CASE 2: USER DOES NOT EXIST (Invite) ---
        logger.info(SERVICE_NAME, `[PO_UPSERT] User ${poEmail} does not exist. Creating invitation.`);
        
        const poStatus = 'invited';
        const password_hash = 'INVITED_USER_NO_PASS';
        const invitationToken = crypto.randomBytes(32).toString('hex');
        const invitationExpires = Date.now() + 3600000; 

        const inviteSql = `
            INSERT INTO users (email, password_hash, role, status, product_id, manager_id, password_reset_token, password_reset_expires, is_email_verified)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE)
            RETURNING id;
        `;
        const inviteParams = [poEmail, password_hash, PO_ROLE_KEY, poStatus, productId, ctoId, invitationToken, invitationExpires];

        const inviteRes = await client.query(inviteSql, inviteParams);
        const newUserId = inviteRes.rows[0].id;
        
        logger.info(SERVICE_NAME, `[PO_UPSERT_SUCCESS] Invitation created for ${poEmail} (New ID: ${newUserId}), assigned to manager ${ctoId}.`);

        // Send "Invitation" email (Non-blocking external call)
        const setupLink = `${process.env.FRONTEND_URL}/reset-password?token=${invitationToken}`;
        const subject = `You've been invited to join VAULT as a Product Owner!`;
        const html = `
            <h3 style="font-family: sans-serif;">Welcome to VAULT!</h3>
            <p style="font-family: sans-serif;">You have been invited to be the Product Owner for "<strong>${productName}</strong>".</p>
            <p style="font-family: sans-serif;">To activate your account, please click the button below to set your password. This link will expire in one hour.</p>
            <a href="${setupLink}" style="background-color:#2563eb;color:white;padding:12px 20px;text-align:center;text-decoration:none;display:inline-block;border-radius:8px;font-size:16px;font-family: sans-serif;">Set Your Password</a>
        `;
        sendEmail(poEmail, subject, html);
        
        return { action: 'invited', userId: newUserId }; 
    }
};
// --- [END HELPER FUNCTION] ---


/**
 * @desc 	  Request the creation of a new product
 * @route 	 POST /api/products/request-product
 * @access 	 Public
 */
const requestProductCreation = async (req, res) => {
    logger.info(SERVICE_NAME, '[PRODUCT_CTRL] Received POST /request-product');
    
    const { productName, productOwnerName, productOwnerEmail } = req.body;
    
    if (!productName || !productOwnerName || !productOwnerEmail) {
        logger.warn(SERVICE_NAME, 'Validation failed: Missing fields.');
        return res.status(400).json({ 
            message: 'All fields are required: productName, productOwnerName, productOwnerEmail.' 
        });
    }

    // [PG_MIGRATE] Use query and RETURNING
    const sql = `
        INSERT INTO products (product_name, product_owner_name, product_owner_email, status)
        VALUES ($1, $2, $3, 'pending')
        RETURNING id;
    `;
    const params = [productName, productOwnerName, productOwnerEmail];

    try {
        const resDb = await query(sql, params);
        const newProductId = resDb.rows[0].id;
        
        logger.info(SERVICE_NAME, `Product created with ID ${newProductId} in 'pending' state.`);

        // EMIT SOCKET EVENT
        req.io.emit('PRODUCT_LIST_UPDATED');

        res.status(201).json({
            message: 'Product creation request received and is pending approval.',
            productId: newProductId,
            status: 'pending'
        });
    } catch (error) {
        if (error.message.includes('unique constraint "products_product_name_key"')) { // Specific PG error for unique violation
            logger.warn(SERVICE_NAME, `Product name '${productName}' already exists.`);
            return res.status(409).json({ message: `A product with the name '${productName}' already exists.` });
        }
        logger.error(SERVICE_NAME, 'Failed to insert new product:', error.message);
        return res.status(500).json({ message: 'Database error while creating product.' });
    }
};

/**
 * @desc 	  Approve a product, creating/activating the PO
 * @route 	 POST /api/products/approve/:productId
 * @access 	 Private (CTO/Admin)
 */
const approveProduct = async (req, res) => {
    const { productId } = req.params;
    const ctoId = req.user.id; 
    logger.info(SERVICE_NAME, `Request to approve product ID: ${productId} by CTO ID: ${ctoId}`);
    
    try {
        const result = await executeTransaction(async (client) => {
            // 1. Get product and validation (using transaction client)
            const productRes = await client.query('SELECT * FROM products WHERE id = $1', [productId]);
            const product = productRes.rows[0];

            if (!product) throw new Error("Product not found.");
            if (product.status !== 'pending') throw new Error(`Product is not pending approval. Current status: ${product.status}`);

            logger.info(SERVICE_NAME, `Found product "${product.product_name}". Proceeding to invite/promote PO.`);
            
            const poEmail = product.product_owner_email;

            // 2. Invite or Promote the PO (using transaction client)
            const { action, userId } = await inviteOrPromotePO(client, poEmail, product.id, product.product_name, ctoId); 
            
            // 3. Set the product status based on the action.
            const newStatus = (action === 'invited') ? 'awaiting_po_activation' : 'confirmed';
            logger.debug(SERVICE_NAME, `PO action was '${action}'. Setting product status to '${newStatus}'.`);

            const updateProductSql = `UPDATE products SET status = $1 WHERE id = $2`;
            await client.query(updateProductSql, [newStatus, productId]);

            return { product, poEmail, newStatus };
        }); // End executeTransaction

        // EMIT SOCKET EVENT
        req.io.emit('PRODUCT_LIST_UPDATED');

        res.status(200).json({ message: `Product "${result.product.product_name}" approved. PO ${result.poEmail} has been notified.` });
        
    } catch (error) {
        logger.error(SERVICE_NAME, `Failed to approve product ${productId}. Error:`, error.message);
        if (error.message.includes('not found') || error.message.includes('pending')) {
             return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: "Internal server error during product approval." });
    }
};

// (getConfirmedProducts function is migrated)
const getConfirmedProducts = async (req, res) => {
    logger.info(SERVICE_NAME, 'Received GET /confirmed');

    const sql = `
        SELECT id, product_name 
        FROM products 
        WHERE status = 'confirmed'
        ORDER BY product_name ASC
    `;

    try {
        const resDb = await query(sql);
        logger.info(SERVICE_NAME, `Found ${resDb.rows.length} confirmed products.`);
        res.status(200).json(resDb.rows);
    } catch (error) {
        logger.error(SERVICE_NAME, 'Failed to fetch confirmed products:', error.message);
        res.status(500).json({ message: 'Database error fetching products.' });
    }
};


// (getPendingProducts function is migrated)
const getPendingProducts = async (req, res) => {
    logger.info(SERVICE_NAME, 'Received GET /pending');
    
    const sql = `
        SELECT id, product_name, product_owner_name, product_owner_email, created_at 
        FROM products 
        WHERE status = 'pending'
        ORDER BY created_at ASC
    `;
    
    try {
        const resDb = await query(sql);
        logger.info(SERVICE_NAME, `Found ${resDb.rows.length} pending products.`);
        res.status(200).json(resDb.rows);
    } catch (error) {
        logger.error(SERVICE_NAME, 'Failed to fetch pending products:', error.message);
        res.status(500).json({ message: 'Database error fetching pending products.' });
    }
};

// (rejectProduct function is migrated)
const rejectProduct = async (req, res) => {
    const { productId } = req.params;
    logger.info(SERVICE_NAME, `Received request to REJECT product ID: ${productId}`);
    
    try {
        const result = await executeTransaction(async (client) => {
            // 1. Verify existence and status
            const productRes = await client.query('SELECT * FROM products WHERE id = $1 AND status = $2', [productId, 'pending']);
            const product = productRes.rows[0];
            
            if (!product) throw new Error("Product not found or not pending.");
            
            logger.info(SERVICE_NAME, `Found pending product "${product.product_name}". Deleting...`);
            
            // 2. Delete the product. (CASCADE handles clients/rooms/etc.)
            const deleteSql = `DELETE FROM products WHERE id = $1 AND status = 'pending' RETURNING product_owner_email`;
            const deleteRes = await client.query(deleteSql, [productId]);
            
            if (deleteRes.rowCount === 0) throw new Error("Deletion failed or product status changed.");

            return product;
        }); // End executeTransaction

        logger.info(SERVICE_NAME, `Product ${productId} deleted. Sending rejection email.`);
        
        // Send rejection email (Non-blocking external call)
        const subject = `Your VAULT Product Request: "${result.product_name}"`;
        const html = `<p>Your request for "<strong>${result.product_name}</strong>" has been rejected.</p>`;
        sendEmail(result.product_owner_email, subject, html);

        // EMIT SOCKET EVENT
        req.io.emit('PRODUCT_LIST_UPDATED');

        res.status(200).json({ message: `Product "${result.product_name}" rejected and deleted.` });
        
    } catch (error) {
        logger.error(SERVICE_NAME, `Failed to reject product ${productId}:`, error.message);
        if (error.message.includes('not found') || error.message.includes('pending')) {
            return res.status(404).json({ message: "Pending product not found or already handled." });
        }
        res.status(500).json({ message: "Database error during product rejection." });
    }
};

// (getAllProducts function is migrated)
const getAllProducts = async (req, res) => {
    logger.info(SERVICE_NAME, 'Received GET /all');
    
    const sql = `
        SELECT * FROM products 
        ORDER BY product_name ASC
    `;
    
    try {
        const resDb = await query(sql);
        logger.info(SERVICE_NAME, `Found ${resDb.rows.length} total products.`);
        res.status(200).json(resDb.rows);
    } catch (error) {
        logger.error(SERVICE_NAME, 'Failed to fetch all products:', error.message);
        res.status(500).json({ message: 'Database error fetching all products.' });
    }
};

/**
 * @desc 	  Update an existing product's details
 * @route 	 PUT /api/products/:productId
 * @access 	 Private (CTO Only)
 */
const updateProduct = async (req, res) => {
    const { productId } = req.params;
    const { productName, productOwnerName, productOwnerEmail } = req.body;
    const ctoId = req.user.id;
    
    logger.info(SERVICE_NAME, `Received PUT /${productId} by CTO ${ctoId}`);

    if (!productName || !productOwnerName || !productOwnerEmail) {
        return res.status(400).json({ message: 'All fields are required.' });
    }

    try {
        const result = await executeTransaction(async (client) => {
            // 1. Get current product state
            const productRes = await client.query('SELECT product_owner_email FROM products WHERE id = $1', [productId]);
            const product = productRes.rows[0];
            if (!product) throw new Error("Product not found.");

            const oldPoEmail = product.product_owner_email;
            const newPoEmail = productOwnerEmail;
            const poEmailChanged = oldPoEmail.toLowerCase() !== newPoEmail.toLowerCase();
            logger.debug(SERVICE_NAME, `PO email changed: ${poEmailChanged}`);

            if (!poEmailChanged) {
                // Case 1: PO email unchanged (simple update)
                const updateSql = `UPDATE products SET product_name = $1, product_owner_name = $2 WHERE id = $3`;
                await client.query(updateSql, [productName, productOwnerName, productId]);
                return { action: 'updated', newPoEmail };
            }

            // Case 2: PO email CHANGED (Complex transaction)
            
            // 2a. Deactivate old PO and clear their product_id
            const deactivateSql = `
                UPDATE users 
                SET status = 'deactivated', product_id = NULL 
                WHERE email = $1 AND role = 'PO'
                RETURNING id;
            `;
            const deactivateRes = await client.query(deactivateSql, [oldPoEmail]);
            const oldPoId = deactivateRes.rows.length > 0 ? deactivateRes.rows[0].id : null;

            // 2b. Invite or Promote the new PO
            const { action: newPoAction, userId: newPoId } = await inviteOrPromotePO(client, newPoEmail, productId, productName, ctoId);

            // 2c. Orphan Fix: Re-assign Admins from old PO to new PO
            if (oldPoId && newPoId) {
                const reassignSql = `
                    UPDATE users 
                    SET manager_id = $1 
                    WHERE manager_id = $2 AND role = 'Admin' AND status = 'active'
                `;
                const reassignRes = await client.query(reassignSql, [newPoId, oldPoId]);
                logger.info(SERVICE_NAME, `Re-assigned ${reassignRes.rowCount} Admins.`);
            }

            // 2d. Final Product Update (Set new PO email, name, and status)
            const newStatus = (newPoAction === 'invited') ? 'awaiting_po_activation' : 'confirmed';
            const updateProductSql = `
                UPDATE products SET 
                    product_name = $1, 
                    product_owner_name = $2, 
                    product_owner_email = $3,
                    status = $4
                WHERE id = $5
            `;
            await client.query(updateProductSql, [productName, productOwnerName, newPoEmail, newStatus, productId]);

            return { action: 'updated_po', newPoEmail };
        }); // End executeTransaction

        logger.info(SERVICE_NAME, `Product ${productId} update successful. Action: ${result.action}`);
        req.io.emit('PRODUCT_LIST_UPDATED');
        res.status(200).json({ message: `Product updated successfully. PO: ${result.newPoEmail}` });

    } catch (error) {
        logger.error(SERVICE_NAME, `Update failed for ${productId}:`, error.message);
        if (error.message.includes("Product not found")) {
            return res.status(404).json({ message: error.message });
        }
        res.status(500).json({ message: "Database error during product update." });
    }
};

/**
 * @desc 	  Delete an existing product and deactivate all its users
 * @route 	 DELETE /api/products/:productId
 * @access 	 Private (CTO Only)
 */
const deleteProduct = async (req, res) => {
    const { productId } = req.params;
    logger.info(SERVICE_NAME, `Received DELETE request for product ID: ${productId}`);

    try {
        await executeTransaction(async (client) => {
            // 1. Deactivate all users associated with this product
            const deactivateUsersSql = `
                UPDATE users 
                SET status = 'deactivated', product_id = NULL 
                WHERE product_id = $1
            `;
            const deactivateRes = await client.query(deactivateUsersSql, [productId]);
            logger.info(SERVICE_NAME, `Deactivated ${deactivateRes.rowCount} users for product ${productId}.`);
            
            // 2. Delete the product. ON DELETE CASCADE will handle clients, rooms, etc.
            const deleteProductSql = `DELETE FROM products WHERE id = $1 RETURNING id`;
            const deleteRes = await client.query(deleteProductSql, [productId]);

            if (deleteRes.rowCount === 0) {
                 throw new Error("Product not found or deletion failed.");
            }
            logger.info(SERVICE_NAME, `Successfully deleted product ${productId}.`);
            // Transaction commits here
        });

        // EMIT SOCKET EVENT
        req.io.emit('PRODUCT_LIST_UPDATED');
        res.status(204).send(); // 204 No Content for successful deletion

    } catch (error) {
        logger.error(SERVICE_NAME, `Failed to delete product ${productId}:`, error.message);
        if (error.message.includes('not found')) {
            return res.status(404).json({ message: "Product not found." });
        }
        res.status(500).json({ message: "Database error during product deletion." });
    }
};
// --- [END NEW FUNCTION] ---


module.exports = {
    requestProductCreation,
    approveProduct,
    rejectProduct,
    getConfirmedProducts,
    getPendingProducts,
    getAllProducts,
    updateProduct,
    deleteProduct,
};