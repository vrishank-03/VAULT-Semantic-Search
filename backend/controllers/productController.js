console.log('[LOG] Loading productController.js...'); // V V IMP LOG
const { getDb } = require('../database');
const { CTO_EMAIL } = require('../credentials');
const bcrypt = require('bcryptjs'); 
const crypto = require('crypto'); 
require('dotenv').config();

// --- [TASK 15 REFACTOR] ---
// Import the new centralized email service
const { sendEmail } = require('../services/emailService');
// --- [END REFACTOR] ---

// --- [PHASE 1.E] MODIFIED HELPER FUNCTION: inviteOrPromotePO ---
/**
 * @desc    Handles the logic for inviting a new user as a PO or promoting an existing user.
 * @param   {object} db - The database connection.
 * @param   {string} poEmail - The email of the PO to invite/promote.
 * @param   {number} productId - The ID of the product they are being assigned to.
 * @param   {string} productName - The name of the product for the email.
 * @returns {Promise<string>} - Resolves with 'promoted' or 'invited'.
 */
const inviteOrPromotePO = (db, poEmail, productId, productName) => {
    return new Promise((resolve, reject) => {
        console.log(`[PO_UPSERT] [PHASE 1.E] Checking user status for: ${poEmail}`);
        
        db.get('SELECT * FROM users WHERE email = ?', [poEmail], (err, user) => {
            if (err) {
                console.error(`[PO_UPSERT_ERROR] DB error checking user ${poEmail}:`, err.message);
                return reject(new Error('Database error checking user.'));
            }

            if (user) {
                // --- CASE 1: USER EXISTS (Promote) ---
                console.log(`[PO_UPSERT] [PHASE 1.E] User ${poEmail} exists. Promoting to 'active' ProductOwner.`);
                const promoteSql = `
                    UPDATE users SET 
                        role = 'ProductOwner', 
                        status = 'active', 
                        product_id = ? 
                    WHERE email = ?
                `;
                db.run(promoteSql, [productId, poEmail], function(promoteErr) {
                    if (promoteErr) {
                        console.error(`[PO_UPSERT_ERROR] Failed to promote user ${poEmail}:`, promoteErr.message);
                        return reject(new Error('Database error promoting user.'));
                    }

                    console.log(`[PO_UPSERT_SUCCESS] [PHASE 1.E] User ${poEmail} promoted.`);
                    
                    // Send "You've been promoted" email
                    const subject = `You are now the Product Owner for "${productName}"`;
                    const html = `
                        <h3 style="font-family: sans-serif;">You Have Been Assigned a Product</h3>
                        <p style="font-family: sans-serif;">You have been assigned as the Product Owner for "<strong>${productName}</strong>" in VAULT.</p>
                        <p style="font-family: sans-serif;">Your account ("<strong>${poEmail}</strong>") is now active with Product Owner permissions.</p>
                        <p style="font-family: sans-serif;">You can log in with your existing password.</p>
                    `;
                    sendEmail(poEmail, subject, html);
                    resolve('promoted'); // [CAUSALITY_FIX] Return 'promoted'
                });

            } else {
                // --- CASE 2: USER DOES NOT EXIST (Invite) ---
                console.log(`[PO_UPSERT] [PHASE 1.E] User ${poEmail} does not exist. Creating invitation.`);
                
                const poRole = 'ProductOwner';
                const poStatus = 'invited'; // New status
                const password_hash = 'INVITED_USER_NO_PASS'; // Unusable password
                const invitationToken = crypto.randomBytes(32).toString('hex');
                const invitationExpires = Date.now() + 3600000; // 1 hour

                const inviteSql = `
                    INSERT INTO users (email, password_hash, role, status, product_id, password_reset_token, password_reset_expires, is_email_verified)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 0)
                `;
                const inviteParams = [poEmail, password_hash, poRole, poStatus, productId, invitationToken, invitationExpires];

                db.run(inviteSql, inviteParams, function(inviteErr) {
                    if (inviteErr) {
                        console.error(`[PO_UPSERT_ERROR] Failed to create invitation for ${poEmail}:`, inviteErr.message);
                        return reject(new Error('Database error creating PO invitation.'));
                    }

                    console.log(`[PO_UPSERT_SUCCESS] [PHASE 1.E] Invitation created for ${poEmail}.`);

                    // Send "Invitation" email
                    const setupLink = `${process.env.FRONTEND_URL}/reset-password?token=${invitationToken}`;
                    const subject = `You've been invited to join VAULT as a Product Owner!`;
                    const html = `
                        <h3 style="font-family: sans-serif;">Welcome to VAULT!</h3>
                        <p style="font-family: sans-serif;">You have been invited to be the Product Owner for "<strong>${productName}</strong>".</p>
                        <p style="font-family: sans-serif;">To activate your account, please click the button below to set your password. This link will expire in one hour.</p>
                        <a href="${setupLink}" style="background-color:#2563eb;color:white;padding:12px 20px;text-align:center;text-decoration:none;display:inline-block;border-radius:8px;font-size:16px;font-family: sans-serif;">Set Your Password</a>
                    `;
                    sendEmail(poEmail, subject, html);
                    resolve('invited'); // [CAUSALITY_FIX] Return 'invited'
                });
            }
        });
    });
};
// --- [END HELPER FUNCTION] ---


/**
 * @desc    Request the creation of a new product
 * @route   POST /api/products/request-product
 * @access  Public
 */
const requestProductCreation = (req, res) => {
    console.log('[PRODUCT_CTRL] Received POST /request-product');
    
    const { productName, productOwnerName, productOwnerEmail } = req.body;
    
    console.log(`[PRODUCT_CTRL] Validating input: ${JSON.stringify(req.body)}`);
    if (!productName || !productOwnerName || !productOwnerEmail) {
        console.warn('[PRODUCT_CTRL_WARN] Validation failed: Missing fields.');
        return res.status(400).json({ 
            message: 'All fields are required: productName, productOwnerName, productOwnerEmail.' 
        });
    }

    const db = getDb();
    const sql = `
        INSERT INTO products (product_name, product_owner_name, product_owner_email, status)
        VALUES (?, ?, ?, 'pending') -- [PHASE 1.B] Changed status from 'suspended' to 'pending'
    `;
    const params = [productName, productOwnerName, productOwnerEmail];

    console.log(`[PRODUCT_CTRL_DB] [PHASE 1.B] Executing SQL: ${sql} with params: [${params.join(', ')}]`);

    db.run(sql, params, function(err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                console.warn(`[PRODUCT_CTRL_DB_WARN] Product name '${productName}' already exists.`);
                return res.status(409).json({ message: `A product with the name '${productName}' already exists.` });
            }
            console.error('[PRODUCT_CTRL_DB_ERROR] Failed to insert new product:', err.message);
            return res.status(500).json({ message: 'Database error while creating product.' });
        }

        const newProductId = this.lastID;
        console.log(`[PRODUCT_CTRL_SUCCESS] [PHASE 1.B] Product created with ID ${newProductId} in 'pending' state.`);
        console.log(`[PRODUCT_CTRL_EMAIL] Skipping redundant email notification to CTO (dashboard now handles this).`);

        res.status(201).json({
            message: 'Product creation request received and is pending approval.',
            productId: newProductId,
            status: 'pending' // [PHASE 1.B] Changed status from 'suspended' to 'pending'
        });
    });
};

/**
 * @desc    Approve a product, creating/activating the PO
 * @route   POST /api/products/approve/:productId
 * @access  Private (CTO/Admin)
 */
const approveProduct = (req, res) => {
    const { productId } = req.params;
    console.log(`[PRODUCT_CTRL_APPROVE] Received request to approve product ID: ${productId}`);

    const db = getDb();
    
    const productSql = `SELECT * FROM products WHERE id = ?`;
    db.get(productSql, [productId], async (err, product) => {
        if (err) {
            console.error(`[PRODUCT_CTRL_APPROVE_ERROR] DB error fetching product ${productId}:`, err.message);
            return res.status(500).json({ message: "Database error." });
        }
        if (!product) {
            console.warn(`[PRODUCT_CTRL_APPROVE_WARN] Product ${productId} not found.`);
            return res.status(404).json({ message: "Product not found." });
        }
        if (product.status !== 'pending') {
            console.warn(`[PRODUCT_CTRL_APPROVE_WARN] Product ${productId} is not 'pending'. Current status: ${product.status}`);
            return res.status(400).json({ message: `Product is not pending approval. Current status: ${product.status}` });
        }

        console.log(`[PRODUCT_CTRL_APPROVE] Found product "${product.product_name}". Proceeding to invite/promote PO: ${product.product_owner_email}`);
        
        const poEmail = product.product_owner_email;

        // --- [CAUSALITY_FIX] Refactored Logic ---
        db.serialize(() => {
            db.run("BEGIN TRANSACTION");

            // Step 1: Invite or Promote the PO. This will tell us what to do.
            inviteOrPromotePO(db, poEmail, product.id, product.product_name)
                .then((action) => { // action is 'invited' or 'promoted'
                    
                    // Step 2: Set the product status based on the action.
                    const newStatus = (action === 'invited') ? 'awaiting_po_activation' : 'confirmed';
                    console.log(`[PRODUCT_CTRL_APPROVE] [CAUSALITY_FIX] PO action was '${action}'. Setting product status to '${newStatus}'.`);

                    const updateProductSql = `UPDATE products SET status = ? WHERE id = ?`;
                    db.run(updateProductSql, [newStatus, productId], function(prodErr) {
                        if (prodErr) {
                            console.error(`[PRODUCT_CTRL_APPROVE_ERROR] Failed to set product status to ${newStatus}:`, prodErr.message);
                            db.run("ROLLBACK");
                            return res.status(500).json({ message: "Database error updating product status." });
                        }

                        // Step 3: Commit
                        db.run("COMMIT", (commitErr) => {
                            if (commitErr) {
                                console.error(`[PRODUCT_CTRL_APPROVE_ERROR] Failed to COMMIT transaction:`, commitErr.message);
                                return res.status(500).json({ message: 'Failed to commit changes.' });
                            }
                            console.log(`[PRODUCT_CTRL_APPROVE_SUCCESS] Transaction complete.`);
                            res.status(200).json({ message: `Product "${product.product_name}" approved. PO ${poEmail} has been notified.` });
                        });
                    });
                })
                .catch((inviteErr) => {
                    // Step 4: Rollback on error
                    console.error(`[PRODUCT_CTRL_APPROVE_ERROR] Failed to invite PO, rolling back:`, inviteErr.message);
                    db.run("ROLLBACK");
                    return res.status(500).json({ message: inviteErr.message || "Failed to create/promote PO." });
                });
        });
        // --- [END CAUSALITY_FIX] ---
    });
};

// (getConfirmedProducts function is unchanged)
const getConfirmedProducts = (req, res) => {
    console.log('[PRODUCT_CTRL] Received GET /confirmed');

    const db = getDb();
    const sql = `
        SELECT id, product_name 
        FROM products 
        WHERE status = 'confirmed'
        ORDER BY product_name ASC
    `;

    console.log(`[PRODUCT_CTRL_DB] Executing SQL: ${sql}`);

    db.all(sql, [], (err, products) => {
        if (err) {
            console.error('[PRODUCT_CTRL_DB_ERROR] Failed to fetch confirmed products:', err.message);
            return res.status(500).json({ message: 'Database error fetching products.' });
        }

        console.log(`[PRODUCT_CTRL_SUCCESS] Found ${products.length} confirmed products.`);
        res.status(200).json(products);
    });
};


// (getPendingProducts function is unchanged)
const getPendingProducts = (req, res) => {
    console.log('[PRODUCT_CTRL] [PHASE 1.C] Received GET /pending');
    const db = getDb();
    const sql = `
        SELECT id, product_name, product_owner_name, product_owner_email, created_at 
        FROM products 
        WHERE status = 'pending'
        ORDER BY created_at ASC
    `;
    console.log(`[PRODUCT_CTRL_DB] [PHASE 1.C] Executing SQL: ${sql}`);
    db.all(sql, [], (err, products) => {
        if (err) {
            console.error('[PRODUCT_CTRL_DB_ERROR] [PHASE 1.C] Failed to fetch pending products:', err.message);
            return res.status(500).json({ message: 'Database error fetching pending products.' });
        }
        console.log(`[PRODUCT_CTRL_SUCCESS] [PHASE 1.C] Found ${products.length} pending products.`);
        res.status(200).json(products);
    });
};

// (rejectProduct function is unchanged)
const rejectProduct = (req, res) => {
    const { productId } = req.params;
    console.log(`[PRODUCT_CTRL_REJECT] Received request to REJECT product ID: ${productId}`);
    const db = getDb();
    
    const productSql = `SELECT * FROM products WHERE id = ? AND status = 'pending'`;
    db.get(productSql, [productId], (err, product) => {
        if (err) {
            console.error(`[PRODUCT_CTRL_REJECT_ERROR] DB error fetching product ${productId}:`, err.message);
            return res.status(500).json({ message: "Database error." });
        }
        if (!product) {
            console.warn(`[PRODUCT_CTRL_REJECT_WARN] Pending product ${productId} not found or was already handled.`);
            return res.status(404).json({ message: "Pending product not found." });
        }

        console.log(`[PRODUCT_CTRL_REJECT] Found pending product "${product.product_name}". Proceeding to delete.`);
        
        const deleteSql = `DELETE FROM products WHERE id = ? AND status = 'pending'`;
        db.run(deleteSql, [productId], function(deleteErr) {
            if (deleteErr) {
                console.error(`[PRODUCT_CTRL_REJECT_ERROR] Failed to delete product ${productId}:`, deleteErr.message);
                return res.status(500).json({ message: "Database error deleting product." });
            }
            if (this.changes === 0) {
                 console.warn(`[PRODUCT_CTRL_REJECT_WARN] No product was deleted (race condition?).`);
                 return res.status(404).json({ message: "Product not found or already handled." });
            }

            console.log(`[PRODUCT_CTRL_REJECT_SUCCESS] Product ${productId} deleted.`);
            console.log(`[PRODUCT_CTRL_EMAIL] Sending REAL email to PO (${product.product_owner_email}) about rejection.`);
            
            const subject = `Your VAULT Product Request: "${product.product_name}"`;
            const html = `
                <h3 style="font-family: sans-serif;">VAULT Product Status</h3>
                <p style="font-family: sans-serif;">Thank you for your submission. After careful review, your product request for "<strong>${product.product_name}</strong>" has been rejected.</p>
                <p style="font-family: sans-serif;">If you believe this is in error, please contact the CTO.</p>
            `;
            sendEmail(product.product_owner_email, subject, html);

            res.status(200).json({ message: `Product "${product.product_name}" rejected and deleted.` });
        });
    });
};

// (getAllProducts function is unchanged)
const getAllProducts = (req, res) => {
    console.log('[PRODUCT_CTRL] [PHASE 1.D] Received GET /all');
    const db = getDb();
    const sql = `
        SELECT * FROM products 
        ORDER BY product_name ASC
    `;
    console.log(`[PRODUCT_CTRL_DB] [PHASE 1.D] Executing SQL: ${sql}`);
    db.all(sql, [], (err, products) => {
        if (err) {
            console.error('[PRODUCT_CTRL_DB_ERROR] [PHASE 1.D] Failed to fetch all products:', err.message);
            return res.status(500).json({ message: 'Database error fetching all products.' });
        }
        console.log(`[PRODUCT_CTRL_SUCCESS] [PHASE 1.D] Found ${products.length} total products.`);
        res.status(200).json(products);
    });
};

/**
 * @desc    Update an existing product's details
 * @route   PUT /api/products/:productId
 * @access  Private (CTO Only)
 */
const updateProduct = (req, res) => {
    const { productId } = req.params;
    const { productName, productOwnerName, productOwnerEmail } = req.body;
    
    console.log(`[PRODUCT_CTRL_UPDATE] [PHASE 1.D] Received PUT /${productId} with data:`, req.body);

    if (!productName || !productOwnerName || !productOwnerEmail) {
        console.warn('[PRODUCT_CTRL_UPDATE_WARN] Validation failed: Missing fields.');
        return res.status(400).json({ 
            message: 'All fields are required: productName, productOwnerName, productOwnerEmail.' 
        });
    }

    const db = getDb();
    
    // Step 1: Get the current product state
    const productSql = `SELECT * FROM products WHERE id = ?`;
    db.get(productSql, [productId], (err, product) => {
        if (err) {
            console.error(`[PRODUCT_CTRL_UPDATE_ERROR] DB error fetching product ${productId}:`, err.message);
            return res.status(500).json({ message: "Database error." });
        }
        if (!product) {
            console.warn(`[PRODUCT_CTRL_UPDATE_WARN] Product ${productId} not found.`);
            return res.status(404).json({ message: "Product not found." });
        }

        const oldPoEmail = product.product_owner_email;
        const newPoEmail = productOwnerEmail;
        const poEmailChanged = oldPoEmail.toLowerCase() !== newPoEmail.toLowerCase();

        console.log(`[PRODUCT_CTRL_UPDATE] [PHASE 1.D] PO email changed: ${poEmailChanged}`);

        // If PO email didn't change, just update the text fields and we're done.
        if (!poEmailChanged) {
            console.log('[PRODUCT_CTRL_UPDATE] [CAUSALITY_FIX] PO Email not changed, only updating text fields.');
            const updateSql = `
                UPDATE products SET 
                    product_name = ?, 
                    product_owner_name = ?
                WHERE id = ?
            `;
            db.run(updateSql, [productName, productOwnerName, productId], function(updateErr) {
                if (updateErr) {
                    console.error(`[PRODUCT_CTRL_UPDATE_ERROR] Failed to update product ${productId}:`, updateErr.message);
                    return res.status(500).json({ message: 'Database error updating product.' });
                }
                console.log(`[PRODUCT_CTRL_UPDATE_SUCCESS] [PHASE 1.D] Product updated. PO email unchanged.`);
                return res.status(200).json({ message: 'Product updated successfully.' });
            });
            return; // Stop execution
        }

        // --- [CAUSALITY_FIX] PO Email *did* change. Run the full transaction. ---
        db.serialize(() => {
            db.run("BEGIN TRANSACTION");

            // Step 2a: Deactivate old PO.
            console.log(`[PRODUCT_CTRL_UPDATE] [PHASE 1.D] PO Email changed. Deactivating old PO: ${oldPoEmail}`);
            const deactivateSql = `
                UPDATE users 
                SET status = 'deactivated', product_id = NULL 
                WHERE email = ? AND role = 'ProductOwner'
            `;
            db.run(deactivateSql, [oldPoEmail], function(deactivateErr) {
                if (deactivateErr) {
                    console.error(`[PRODUCT_CTRL_UPDATE_ERROR] Failed to deactivate old PO ${oldPoEmail}:`, deactivateErr.message);
                    db.run("ROLLBACK");
                    return res.status(500).json({ message: 'Database error deactivating old PO.' });
                }
                console.log(`[PRODUCT_CTRL_UPDATE_SUCCESS] [PHASE 1.D] Old PO ${oldPoEmail} deactivated (Rows: ${this.changes}).`);

                // Step 2b: Invite or Promote the new PO
                inviteOrPromotePO(db, newPoEmail, product.id, productName)
                    .then((action) => { // action is 'invited' or 'promoted'
                        
                        // Step 2c: Set the product status based on the action.
                        const newStatus = (action === 'invited') ? 'awaiting_po_activation' : 'confirmed';
                        console.log(`[PRODUCT_CTRL_UPDATE] [CAUSALITY_FIX] PO action was '${action}'. Setting product status to '${newStatus}'.`);

                        const updateProductSql = `
                            UPDATE products SET 
                                product_name = ?, 
                                product_owner_name = ?, 
                                product_owner_email = ?,
                                status = ?
                            WHERE id = ?
                        `;
                        const productParams = [productName, productOwnerName, newPoEmail, newStatus, productId];

                        db.run(updateProductSql, productParams, function(updateErr) {
                            if (updateErr) {
                                console.error(`[PRODUCT_CTRL_UPDATE_ERROR] Failed to update product ${productId}:`, updateErr.message);
                                db.run("ROLLBACK");
                                return res.status(500).json({ message: 'Database error updating product.' });
                            }
                            console.log(`[PRODUCT_CTRL_UPDATE_SUCCESS] [PHASE 1.D] Product ${productId} details updated.`);

                            // Step 2d: Commit
                            db.run("COMMIT", (commitErr) => {
                                if (commitErr) {
                                    console.error(`[PRODUCT_CTRL_UPDATE_ERROR] Failed to COMMIT transaction:`, commitErr.message);
                                    return res.status(500).json({ message: 'Failed to commit changes.' });
                                }
                                console.log(`[PRODUCT_CTRL_UPDATE_SUCCESS] [PHASE 1.D] Transaction complete.`);
                                res.status(200).json({ message: `Product updated and PO ${newPoEmail} has been notified.` });
                            });
                        });
                    })
                    .catch((inviteErr) => {
                        // Step 2e: Rollback on error
                        console.error(`[PRODUCT_CTRL_UPDATE_ERROR] Failed to invite/promote PO, rolling back:`, inviteErr.message);
                        db.run("ROLLBACK");
                        return res.status(500).json({ message: inviteErr.message || "Failed to create/promote PO." });
                    });
            });
        });
    });
};
// --- [END NEW FUNCTION] ---


module.exports = {
    requestProductCreation,
    getConfirmedProducts,
    approveProduct,
    getPendingProducts, // [PHASE 1.C] Export the new function
    rejectProduct,      // [PHASE 1.C] Export the new reject function
    getAllProducts,     // [PHASE 1.D] Export new function
    updateProduct       // [PHASE 1.D] Export new function
};