const { getDb } = require('../database');
const { CTO_EMAIL } = require('../credentials'); // Import CTO email
const bcrypt = require('bcryptjs'); // --- [NEW] For creating PO user
const crypto = require('crypto'); // --- [NEW] For creating PO user

/**
 * @desc    Request the creation of a new product
 * @route   POST /api/products/request-product
 * @access  Public
 */
const requestProductCreation = (req, res) => {
    console.log('[PRODUCT_CTRL] Received POST /request-product');
    
    // 1. Get data from request body
    const { productName, productOwnerName, productOwnerEmail } = req.body;
    
    // 2. Validate input
    console.log(`[PRODUCT_CTRL] Validating input: ${JSON.stringify(req.body)}`);
    if (!productName || !productOwnerName || !productOwnerEmail) {
        console.warn('[PRODUCT_CTRL_WARN] Validation failed: Missing fields.');
        return res.status(400).json({ 
            message: 'All fields are required: productName, productOwnerName, productOwnerEmail.' 
        });
    }

    // 3. Get database connection
    const db = getDb();
    const sql = `
        INSERT INTO products (product_name, product_owner_name, product_owner_email, status)
        VALUES (?, ?, ?, 'suspended')
    `;
    const params = [productName, productOwnerName, productOwnerEmail];

    console.log(`[PRODUCT_CTRL_DB] Executing SQL: ${sql} with params: [${params.join(', ')}]`);

    // 4. Execute insert query
    db.run(sql, params, function(err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                console.warn(`[PRODUCT_CTRL_DB_WARN] Product name '${productName}' already exists.`);
                return res.status(409).json({ message: `A product with the name '${productName}' already exists.` });
            }
            console.error('[PRODUCT_CTRL_DB_ERROR] Failed to insert new product:', err.message);
            return res.status(500).json({ message: 'Database error while creating product.' });
        }

        // 5. Log success and new product ID
        const newProductId = this.lastID;
        console.log(`[PRODUCT_CTRL_SUCCESS] Product created with ID ${newProductId} in 'suspended' state.`);

        // 6. --- EMAIL LOGIC (SIMULATED) ---
        console.log(`[PRODUCT_CTRL_EMAIL] SIMULATING email send to CTO (${CTO_EMAIL}) for approval of product ID ${newProductId}.`);
        // --- END EMAIL LOGIC ---

        // 7. Send response to frontend
        res.status(201).json({
            message: 'Product creation request received and is pending approval.',
            productId: newProductId,
            status: 'suspended'
        });
    });
};

// --- [NEW] Function to approve a product and create/activate the PO ---
/**
 * @desc    Approve a product, creating/activating the PO
 * @route   POST /api/products/approve/:productId
 * @access  Private (CTO/Admin)
 */
const approveProduct = (req, res) => {
    const { productId } = req.params;
    console.log(`[PRODUCT_CTRL_APPROVE] Received request to approve product ID: ${productId}`);

    const db = getDb();
    
    // 1. Get the product details
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
        if (product.status === 'confirmed') {
            console.warn(`[PRODUCT_CTRL_APPROVE_WARN] Product ${productId} is already confirmed.`);
            return res.status(400).json({ message: "Product is already confirmed." });
        }

        console.log(`[PRODUCT_CTRL_APPROVE] Found product "${product.product_name}". Proceeding to create/activate PO: ${product.product_owner_email}`);
        
        // 2. Create or Update the Product Owner user
        const poEmail = product.product_owner_email;
        const fakePassword = crypto.randomBytes(16).toString('hex'); // Create a secure placeholder password
        const password_hash = bcrypt.hashSync(fakePassword, 10);
        const poRole = 'ProductOwner';
        const poStatus = 'active';
        const isVerified = 1; // We auto-verify the PO

        const userSql = `
            INSERT INTO users (email, password_hash, is_email_verified, role, status, product_id)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(email) DO UPDATE SET
                role = excluded.role,
                status = excluded.status,
                product_id = excluded.product_id,
                is_email_verified = excluded.is_email_verified
        `;
        const userParams = [poEmail, password_hash, isVerified, poRole, poStatus, product.id];

        db.run(userSql, userParams, function (userErr) {
            if (userErr) {
                console.error(`[PRODUCT_CTRL_APPROVE_ERROR] Failed to create/update PO user ${poEmail}:`, userErr.message);
                return res.status(500).json({ message: "Database error creating Product Owner user." });
            }

            console.log(`[PRODUCT_CTRL_APPROVE_SUCCESS] Successfully created/activated PO user: ${poEmail}`);

            // 3. Update the product status to 'confirmed'
            const updateProductSql = `UPDATE products SET status = 'confirmed' WHERE id = ?`;
            db.run(updateProductSql, [productId], (prodErr) => {
                if (prodErr) {
                    console.error(`[PRODUCT_CTRL_APPROVE_ERROR] Failed to confirm product ${productId}:`, prodErr.message);
                    return res.status(5.00).json({ message: "Database error confirming product." });
                }

                console.log(`[PRODUCT_CTRL_APPROVE_SUCCESS] Product ${productId} set to 'confirmed'.`);

                // 4. --- SIMULATE EMAIL to PO ---
                console.log(`[PRODUCT_CTRL_EMAIL] SIMULATING email send to PO (${poEmail}).`);
                console.log(`[PRODUCT_CTRL_EMAIL] SUBJ: Your product "${product.product_name}" is approved!`);
                console.log(`[PRODUCT_CTRL_EMAIL] BODY: Welcome! Please log in by using the "Forgot Password" link on the login page to set your password.`);
                // --- END SIMULATION ---

                res.status(200).json({ message: `Product "${product.product_name}" approved and Product Owner ${poEmail} activated.` });
            });
        });
    });
};
// --- [END NEW] ---

/**
 * @desc    Get all confirmed products
 * @route   GET /api/products/confirmed
 * @access  Public
 */
const getConfirmedProducts = (req, res) => {
    console.log('[PRODUCT_CTRL] Received GET /confirmed');

    // 1. Get database connection
    const db = getDb();
    const sql = `
        SELECT id, product_name 
        FROM products 
        WHERE status = 'confirmed'
        ORDER BY product_name ASC
    `;

    console.log(`[PRODUCT_CTRL_DB] Executing SQL: ${sql}`);

    // 2. Execute select query
    db.all(sql, [], (err, products) => {
        if (err) {
            console.error('[PRODUCT_CTRL_DB_ERROR] Failed to fetch confirmed products:', err.message);
            return res.status(500).json({ message: 'Database error fetching products.' });
        }

        // 3. Log success and return data
        console.log(`[PRODUCT_CTRL_SUCCESS] Found ${products.length} confirmed products.`);
        res.status(200).json(products);
    });
};
// --- [END NEW] ---


module.exports = {
    requestProductCreation,
    getConfirmedProducts,
    approveProduct // --- [NEW] Export the new function
};
