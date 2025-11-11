console.log('[LOG] Loading authController.js...'); // V V IMP LOG
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../database');
const { validationResult } = require('express-validator');
// [TASK 16] Removed OAuth2Client
const crypto = require('crypto');
const { CTO_EMAIL } = require('../credentials');
require('dotenv').config();

// [TASK 16] Removed axios, fs, path
// [TASK 15] Import centralized email service
const { sendEmail } = require('../services/emailService');

// [TASK 16] Removed Google OAuth client
// const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// [TASK 16] Removed saveProfilePicture helper function
// ...

// --- [PHASE 1.E] MODIFIED resetPassword ---
exports.resetPassword = (req, res) => {
    console.log('[Auth] POST /reset-password route hit.');
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.error('[Auth] Validation failed for reset password:', errors.array());
        return res.status(400).json({ errors: errors.array() });
    }
    const { token, password } = req.body;
    const db = getDb();
    console.log(`[Auth] Attempting to reset password with token: ${token}`);
    const sql = `SELECT * FROM users WHERE password_reset_token = ? AND password_reset_expires > ?`;
    db.get(sql, [token, Date.now()], (err, user) => {
        if (err || !user) {
            console.warn(`[Auth] Invalid or expired token provided for password reset: ${token}`);
            return res.status(400).json({ message: 'Password reset token is invalid or has expired.' });
        }
        
        // --- [BUG_2_FIX] START ---
        // Critical check: If the user's account has been deactivated,
        // their reset/invitation token is void, regardless of its expiry.
        if (user.status === 'deactivated') {
            console.warn(`[Auth] [BUG_2_FIX] User ${user.email} (ID: ${user.id}) is 'deactivated'. Rejecting password reset/activation attempt.`);
            // Return the *same* generic error to prevent account status enumeration.
            return res.status(400).json({ message: 'Password reset token is invalid or has expired.' });
        }
        // --- [BUG_2_FIX] END ---

        console.log(`[Auth] Token is valid for user ${user.email}. Hashing new password.`);
        const salt = bcrypt.genSaltSync(10);
        const password_hash = bcrypt.hashSync(password, salt);

        // --- [PHASE 1.E] INVITATION FLOW LOGIC ---
        let updateUserSql;
        let userParams;

        if (user.status === 'invited') {
            console.log(`[Auth] [PHASE 1.E] Token is for an invited user (${user.email}). Activating account.`);
            updateUserSql = `UPDATE users SET 
                password_hash = ?, 
                password_reset_token = NULL, 
                password_reset_expires = NULL,
                status = 'active',
                is_email_verified = 1
                WHERE id = ?`;
            userParams = [password_hash, user.id];
        } else {
            console.log(`[Auth] Token is for a standard password reset for user ${user.email}.`);
            updateUserSql = `UPDATE users SET 
                password_hash = ?, 
                password_reset_token = NULL, 
                password_reset_expires = NULL 
                WHERE id = ?`;
            userParams = [password_hash, user.id];
        }
        // --- [END PHASE 1.E] ---

        // --- [CAUSALITY_FIX] Transaction to update user AND product ---
        db.serialize(() => {
            db.run("BEGIN TRANSACTION");
            
            // Step 1: Update the user
            db.run(updateUserSql, userParams, function (err) {
                if (err) {
                    console.error(`[Auth] Database error during password update for ${user.email}:`, err.message);
                    db.run("ROLLBACK");
                    return res.status(500).json({ message: 'Error updating password.' });
                }
                console.log(`[Auth] Password successfully updated for user ${user.email}.`);

                // --- [CAUSALITY_FIX] ---
                // Step 2: If user was invited, activate their product
                if (user.status === 'invited' && user.product_id) {
                    console.log(`[Auth] [CAUSALITY_FIX] Activating product ${user.product_id} for new PO ${user.email}.`);
                    const productSql = "UPDATE products SET status = 'confirmed' WHERE id = ? AND status = 'awaiting_po_activation'";
                    
                    db.run(productSql, [user.product_id], function(prodErr) {
                        if (prodErr) {
                            console.error(`[Auth] [CAUSALITY_FIX] Database error activating product ${user.product_id}:`, prodErr.message);
                            db.run("ROLLBACK");
                            return res.status(500).json({ message: 'Error activating product.' });
                        }
                        console.log(`[Auth] [CAUSALITY_FIX] Product ${user.product_id} confirmed (Rows: ${this.changes}).`);
                        
                        // --- [BUG_FIX] EMIT SOCKET EVENT ---
                        if (this.changes > 0) {
                            console.log(`[Auth] [SOCKET] Emitting 'PRODUCT_LIST_UPDATED' event.`);
                            req.io.emit('PRODUCT_LIST_UPDATED'); 
                        }
                        // --- [END BUG_FIX] ---
                        
                        commitAndRespond();
                    });
                } else {
                    // This was a standard password reset, no product to activate.
                    commitAndRespond();
                }
                // --- [END CAUSALITY_FIX] ---
            });

            const commitAndRespond = () => {
                db.run("COMMIT", (commitErr) => {
                    if (commitErr) {
                        console.error('[Auth] [PHASE 1.E] Failed to COMMIT transaction:', commitErr.message);
                        return res.status(500).json({ message: 'Error saving changes.' });
                    }
                    console.log(`[Auth] Transaction committed for user ${user.email}.`);
                    res.status(200).json({ message: 'Password has been updated successfully.' });
                });
            };
        });
        // --- [END CAUSALITY_FIX] ---
    });
};

// --- [SIGNUP_FIX] MODIFIED 'signup' function ---
exports.signup = (req, res) => {
    console.log('[AUTH_SIGNUP] POST /signup route hit.');
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.error('[AUTH_SIGNUP] Validation failed:', errors.array());
        return res.status(400).json({ errors: errors.array() });
    }
    
    // [SIGNUP_FIX] Get adminId from request body
    const { email, password, productName, adminId } = req.body;
    console.log(`[AUTH_SIGNUP] Received USER signup attempt for email: ${email}, product: ${productName}, admin: ${adminId}`);
    
    if (!productName) {
        console.warn('[AUTH_SIGNUP_WARN] Signup failed: ProductName is missing.');
        return res.status(400).json({ message: 'Product Name is required.' });
    }
    
    // [SIGNUP_FIX] Validate adminId
    if (!adminId) {
        console.warn('[AUTH_SIGNUP_WARN] Signup failed: adminId is missing.');
        return res.status(400).json({ message: 'Administrator ID is required.' });
    }

    const db = getDb();
    console.log(`[AUTH_SIGNUP] Checking if user ${email} already exists.`);
    db.get('SELECT email FROM users WHERE email = ?', [email], (err, row) => {
        if (err) {
            console.error(`[AUTH_SIGNUP_ERROR] DB error checking user ${email}:`, err.message);
            return res.status(500).json({ message: 'Database error.' });
        }
        if (row) {
            console.warn(`[AUTH_SIGNUP_WARN] Signup failed: User ${email} already exists.`);
            return res.status(400).json({ message: 'User already exists.' });
        }
        console.log(`[AUTH_SIGNUP] User ${email} does not exist. Checking product: ${productName}`);
        
        // [SIGNUP_FIX] Simplified product check. We just need the ID.
        const productSql = `SELECT id, status FROM products WHERE product_name = ?`;
        db.get(productSql, [productName], (productErr, product) => {
            if (productErr) {
                console.error(`[AUTH_SIGNUP_ERROR] DB error finding product ${productName}:`, productErr.message);
                return res.status(500).json({ message: 'Database error finding product.' });
            }
            if (!product) {
                console.warn(`[AUTH_SIGNUP_WARN] Signup failed: Product "${productName}" not found.`);
                return res.status(404).json({ message: `Product "${productName}" not found.` });
            }
            if (product.status !== 'confirmed') {
                console.warn(`[AUTH_SIGNUP_WARN] Signup failed: Product "${productName}" is not confirmed (Status: ${product.status}).`);
                return res.status(400).json({ message: `Product "${productName}" is not confirmed and cannot be joined.` });
            }

            // [SIGNUP_FIX] Use the provided adminId as the managerId
            const managerId = adminId;
            const newProductId = product.id;
            console.log(`[AUTH_SIGNUP] [SIGNUP_FIX] Using provided Admin ID ${managerId} as manager. Proceeding with user creation.`);

            console.log(`[AUTH_SIGNUP] Hashing password...`);
            const salt = bcrypt.genSaltSync(10);
            const password_hash = bcrypt.hashSync(password, salt);
            const verificationToken = crypto.randomBytes(32).toString('hex');
            const newRole = 'User'; 
            const newStatus = 'pending_email_verification';
            
            console.log(`[AUTH_SIGNUP] New user will be created with Role: ${newRole}, Status: ${newStatus}, ProductID: ${newProductId}, ManagerID: ${managerId}`);
            
            const insertSql = `
                INSERT INTO users (email, password_hash, email_verification_token, role, status, product_id, manager_id) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            const params = [email, password_hash, verificationToken, newRole, newStatus, newProductId, managerId];
            
            db.run(insertSql, params, function (insertErr) {
                if (insertErr) {
                    console.error(`[AUTH_SIGNUP_ERROR] Database error during user insert for ${email}:`, insertErr.message);
                    return res.status(500).json({ message: 'Could not register user.' });
                }
                const newUserId = this.lastID;
                console.log(`[AUTH_SIGNUP] User ${email} registered with ID: ${newUserId}.`);
                const verificationLink = `${process.env.API_URL}/api/auth/verify-email?token=${verificationToken}`;
                console.log(`[AUTH_SIGNUP] Generated verification link: ${verificationLink}`);
                sendEmail(
                    email,
                    'Verify Your VAULT Account',
                    `<h3>Welcome to VAULT!</h3><p>Please click the button below to verify your email address. <strong>Your account will also require approval from your administrator before you can log in.</strong></p><a href="${verificationLink}" style="background-color:#2563eb;color:white;padding:12px 20px;text-align:center;text-decoration:none;display:inline-block;border-radius:8px;font-size:16px;">Verify Email</a><p>This link is valid for a single use.</p>`
                );
                
                // [SIGNUP_FIX] The approval email simulation is now logically correct,
                // as the new user's manager IS the admin.
                console.log(`[AUTH_SIGNUP_EMAIL_SIM] *** SIMULATING APPROVAL EMAIL (for User) ***`);
                console.log(`[AUTH_SIGNUP_EMAIL_SIM] Finding Admin (Manager ID: ${managerId}) to notify...`);

                const adminSql = `SELECT email FROM users WHERE id = ?`;
                db.get(adminSql, [managerId], (adminErr, admin) => {
                    if (adminErr || !admin) {
                        console.error('[AUTH_SIGNUP_EMAIL_SIM_ERROR] Could not find admin email for manager_id:', managerId, adminErr?.message);
                    } else {
                        console.log(`[AUTH_SIGNUP_EMAIL_SIM] Found Admin: ${admin.email}.`);
                        console.log(`[AUTH_SIGNUP_EMAIL_SIM] TO: ${admin.email} (Admin)`);
                        console.log(`[AUTH_SIGNUP_EMAIL_SIM] SUBJ: New User Request for ${productName}`);
                        console.log(`[AUTH_SIGNUP_EMAIL_SIM] BODY: ${email} (ID: ${newUserId}) has requested User access.`);
                    }
                    console.log(`[AUTH_SIGNUP_EMAIL_SIM] *** END SIMULATION ***`);
                });
                res.status(201).json({ message: 'Signup successful. Please check your email to verify your account.' });
            });
        });
    });
};
// --- [END SIGNUP_FIX] ---

// (signupAdmin function is unchanged)
exports.signupAdmin = (req, res) => {
    console.log('[AUTH_SIGNUP_ADMIN] POST /signup-admin route hit.');
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.error('[AUTH_SIGNUP_ADMIN] Validation failed:', errors.array());
        return res.status(400).json({ errors: errors.array() });
    }
    const { email, password, productName } = req.body;
    console.log(`[AUTH_SIGNUP_ADMIN] Received ADMIN signup attempt for email: ${email}, product: ${productName}`);
    if (!productName) {
        console.warn('[AUTH_SIGNUP_ADMIN_WARN] Signup failed: ProductName is missing.');
        return res.status(400).json({ message: 'Product Name is required.' });
    }
    const db = getDb();
    console.log(`[AUTH_SIGNUP_ADMIN] Checking if user ${email} already exists.`);
    db.get('SELECT email FROM users WHERE email = ?', [email], (err, row) => {
        if (err) {
            console.error(`[AUTH_SIGNUP_ADMIN_ERROR] DB error checking user ${email}:`, err.message);
            return res.status(500).json({ message: 'Database error.' });
        }
        if (row) {
            console.warn(`[AUTH_SIGNUP_ADMIN_WARN] Signup failed: User ${email} already exists.`);
            return res.status(400).json({ message: 'User already exists.' });
        }
        console.log(`[AUTH_SIGNUP_ADMIN] User ${email} does not exist. Checking product: ${productName}`);
        const productSql = `SELECT id, product_owner_email, status FROM products WHERE product_name = ?`;
        db.get(productSql, [productName], (productErr, product) => {
            if (productErr) {
                console.error(`[AUTH_SIGNUP_ADMIN_ERROR] DB error finding product ${productName}:`, productErr.message);
                return res.status(500).json({ message: 'Database error finding product.' });
            }
            if (!product) {
                console.warn(`[AUTH_SIGNUP_ADMIN_WARN] Signup failed: Product "${productName}" not found.`);
                return res.status(404).json({ message: `Product "${productName}" not found.` });
            }
            
            // --- [CAUSALITY_FIX] ---
            if (product.status !== 'confirmed') {
                console.warn(`[AUTH_SIGNUP_ADMIN_WARN] Signup failed: Product "${productName}" is not confirmed (Status: ${product.status}).`);
                return res.status(400).json({ message: `Product "${productName}" is not confirmed and cannot be joined.` });
            }
            // --- [END CAUSALITY_FIX] ---

            console.log(`[AUTH_SIGNUP_ADMIN] Product ${productName} found. Finding manager (PO: ${product.product_owner_email}).`);
            db.get('SELECT id FROM users WHERE email = ?', [product.product_owner_email], (poErr, poUser) => {
                if (poErr) {
                    console.error(`[AUTH_SIGNUP_ADMIN_ERROR] DB error finding Product Owner ${product.product_owner_email}:`, poErr.message);
                    return res.status(500).json({ message: 'Database error finding manager.' });
                }
                if (!poUser) {
                    console.error(`[AUTH_SIGNUP_ADMIN_ERROR] Product Owner user account (${product.product_owner_email}) not found.`);
                    return res.status(500).json({ message: 'Product configuration error. Cannot find manager.' });
                }
                const managerId = poUser.id;
                console.log(`[AUTH_SIGNUP_ADMIN] Found manager_id: ${managerId}. Proceeding with user creation.`);
                console.log(`[AUTH_SIGNUP_ADMIN] Hashing password...`);
                const salt = bcrypt.genSaltSync(10);
                const password_hash = bcrypt.hashSync(password, salt);
                const verificationToken = crypto.randomBytes(32).toString('hex');
                const newRole = 'Administrator'; 
                const newStatus = 'pending_email_verification';
                const newProductId = product.id;
                console.log(`[AUTH_SIGNUP_ADMIN] New user will be created with Role: ${newRole}, Status: ${newStatus}, ProductID: ${newProductId}, ManagerID: ${managerId}`);
                const insertSql = `
                    INSERT INTO users (email, password_hash, email_verification_token, role, status, product_id, manager_id) 
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `;
                const params = [email, password_hash, verificationToken, newRole, newStatus, newProductId, managerId];
                db.run(insertSql, params, function (insertErr) {
                    if (insertErr) {
                        console.error(`[AUTH_SIGNUP_ADMIN_ERROR] Database error during user insert for ${email}:`, insertErr.message);
                        return res.status(500).json({ message: 'Could not register user.' });
                    }
                    const newUserId = this.lastID;
                    console.log(`[AUTH_SIGNUP_ADMIN] Admin User ${email} registered with ID: ${newUserId}.`);
                    const verificationLink = `${process.env.API_URL}/api/auth/verify-email?token=${verificationToken}`;
                    console.log(`[AUTH_SIGNUP_ADMIN] Generated verification link: ${verificationLink}`);
                    sendEmail(
                        email,
                        'Verify Your VAULT Administrator Account',
                        `<h3>Welcome to VAULT!</h3><p>Please click the button below to verify your email address for your new <strong>Administrator</strong> account. <strong>Your account will also require approval from your Product Owner before you can log in.</strong></p><a href="${verificationLink}" style="background-color:#2563eb;color:white;padding:12px 20px;text-align:center;text-decoration:none;display:inline-block;border-radius:8px;font-size:16px;">Verify Admin Email</a><p>This link is valid for a single use.</p>`
                    );
                    console.log(`[AUTH_SIGNUP_ADMIN_EMAIL_SIM] *** SIMULATING APPROVAL EMAIL (for Admin) ***`);
                    console.log(`[AUTH_SIGNUP_ADMIN_EMAIL_SIM] TO: ${product.product_owner_email} (Product Owner)`);
                    console.log(`[AUTH_SIGNUP_ADMIN_EMAIL_SIM] SUBJ: New Administrator Request for ${productName}`);
                    console.log(`[AUTH_SIGNUP_ADMIN_EMAIL_SIM] BODY: ${email} (ID: ${newUserId}) has requested Administrator access.`);
                    console.log(`[AUTH_SIGNUP_ADMIN_EMAIL_SIM] *** END SIMULATION ***`);
                    res.status(201).json({ message: 'Signup successful. Please check your email to verify your account.' });
                });
            }); 
        });
    });
};

// (signupCto function is unchanged)
exports.signupCto = (req, res) => {
    console.log('[AUTH_SIGNUP_CTO] POST /signup-cto route hit.');
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.error('[AUTH_SIGNUP_CTO] Validation failed:', errors.array());
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, ctoSecret } = req.body;

    if (!process.env.CTO_SIGNUP_SECRET || ctoSecret !== process.env.CTO_SIGNUP_SECRET) {
        console.warn(`[AUTH_SIGNUP_CTO_WARN] Invalid or missing CTO secret provided by ${email}.`);
        return res.status(403).json({ message: 'Invalid secret.' });
    }

    if (email.toLowerCase() !== CTO_EMAIL.toLowerCase()) {
        console.warn(`[AUTH_SIGNUP_CTO_WARN] Signup email ${email} does not match configured CTO_EMAIL.`);
        return res.status(400).json({ message: 'Email does not match the configured CTO email address.' });
    }

    console.log(`[AUTH_SIGNUP_CTO] Secret and Email are valid. Proceeding with registration for ${email}.`);
    const db = getDb();

    db.get('SELECT email FROM users WHERE email = ?', [email], (err, row) => {
        if (err) {
            console.error(`[AUTH_SIGNUP_CTO_ERROR] DB error checking user ${email}:`, err.message);
            return res.status(500).json({ message: 'Database error.' });
        }
        if (row) {
            console.warn(`[AUTH_SIGNUP_CTO_WARN] Signup failed: CTO user ${email} already exists.`);
            return res.status(400).json({ message: 'CTO user already exists.' });
        }

        console.log(`[AUTH_SIGNUP_CTO] Hashing password...`);
        const salt = bcrypt.genSaltSync(10);
        const password_hash = bcrypt.hashSync(password, salt);
        const verificationToken = crypto.randomBytes(32).toString('hex');
        
        const newRole = 'CTO';
        const newStatus = 'pending_email_verification';

        const insertSql = `
            INSERT INTO users (email, password_hash, email_verification_token, role, status, product_id, manager_id) 
            VALUES (?, ?, ?, ?, ?, NULL, NULL)
        `;
        const params = [email, password_hash, verificationToken, newRole, newStatus];

        db.run(insertSql, params, function (insertErr) {
            if (insertErr) {
                console.error(`[AUTH_SIGNUP_CTO_ERROR] Database error during CTO user insert for ${email}:`, insertErr.message);
                return res.status(500).json({ message: 'Could not register user.' });
            }
            
            const newUserId = this.lastID;
            console.log(`[AUTH_SIGNUP_CTO] CTO User ${email} registered with ID: ${newUserId}.`);
            
            const verificationLink = `${process.env.API_URL}/api/auth/verify-email?token=${verificationToken}`;
            console.log(`[AUTH_SIGNUP_CTO] Generated verification link: ${verificationLink}`);
            sendEmail(
                email,
                'Verify Your VAULT CTO Account',
                `<h3>Welcome to VAULT!</h3><p>Please click the button below to verify your email address and activate your <strong>CTO</strong> account.</p><a href="${verificationLink}" style="background-color:#2563eb;color:white;padding:12px 20px;text-align:center;text-decoration:none;display:inline-block;border-radius:8px;font-size:16px;">Verify CTO Email</a><p>This link is valid for a single use.</p>`
            );

            res.status(201).json({ message: 'CTO account signup successful. Please check your email to verify your account.' });
        });
    });
};

// --- [BUG_FIX] MODIFIED login function ---
exports.login = (req, res) => {
    console.log('[AUTH_LOGIN] POST /login route hit.');
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.error('[AUTH_LOGIN] Validation failed:', errors.array());
        return res.status(400).json({ errors: errors.array() });
    }
    const { email, password } = req.body;
    const db = getDb();
    console.log(`[AUTH_LOGIN] Attempting login for email: ${email}`);
    
    // --- [BUG_FIX] Join with products table to get product_id and productName
    const sql = `
        SELECT u.*, p.product_name 
        FROM users u
        LEFT JOIN products p ON u.product_id = p.id
        WHERE u.email = ?
    `;
    
    db.get(sql, [email], (err, user) => {
        if (err) {
            console.error(`[AUTH_LOGIN_ERROR] DB error finding user ${email}:`, err.message);
            return res.status(500).json({ message: 'Database error.' });
        }
        if (!user) {
            console.warn(`[AUTH_LOGIN_WARN] Login failed for ${email}: User not found.`);
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        // --- [PHASE 1.E] Add check for 'invited' status ---
        if (user.status === 'invited') {
            console.warn(`[AUTH_LOGIN_WARN] Login failed for ${email}: User status is 'invited'.`);
            return res.status(403).json({ message: "Your account is not yet active. Please check your email for an invitation to set your password." });
        }
        // --- [END PHASE 1.E] ---

        if (user.is_email_verified === 0) {
            console.warn(`[AUTH_LOGIN_WARN] Login failed for ${email}: Email not verified.`);
            return res.status(403).json({ message: "Please verify your email before logging in." });
        }
        if (user.status !== 'active') {
            console.warn(`[AUTH_LOGIN_WARN] Login failed for ${email}: User status is "${user.status}".`);
            if (user.status === 'suspended_user' || user.status === 'suspended_admin') {
                return res.status(403).json({ message: "Your account is pending approval by your administrator." });
            }
            if (user.status === 'deactivated') {
                return res.status(403).json({ message: "Your account has been deactivated." });
            }
            return res.status(403).json({ message: `Your account is not active (Status: ${user.status}).` });
        }
        
        // --- [PHASE 1.E] Check for unusable password ---
        if (user.password_hash === 'INVITED_USER_NO_PASS') {
            console.warn(`[AUTH_LOGIN_WARN] Login failed for ${email}: User has unusable 'INVITED' password.`);
            return res.status(401).json({ message: 'Invalid email or password.' });
        }
        // --- [END PHASE 1.E] ---

        if (bcrypt.compareSync(password, user.password_hash)) {
            console.log(`[AUTH_LOGIN_SUCCESS] User ${email} authenticated successfully (Status: ${user.status}).`);
            
            // --- [BUG_FIX] Add role and product_id to the JWT payload ---
            const token = jwt.sign({ 
                id: user.id,
                role: user.role,
                product_id: user.product_id
            }, process.env.JWT_SECRET, { expiresIn: '30d' });
            
            // --- [BUG_FIX] Send all necessary info in the login response ---
            res.json({
                id: user.id,
                email: user.email,
                role: user.role,
                product_id: user.product_id,
                productName: user.product_name,
                token: token
            });
        } else {
            console.warn(`[AUTH_LOGIN_WARN] Login failed for ${email}: Incorrect password.`);
            res.status(401).json({ message: 'Invalid email or password.' });
        }
    });
};
// --- [END BUG_FIX] ---

// (forgotPassword function is unchanged from last time)
exports.forgotPassword = (req, res) => {
    console.log('[Auth] POST /forgot-password route hit.');
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.error('[Auth] Validation failed for forgot password:', errors.array());
        return res.status(400).json({ errors: errors.array() });
    }
    const { email } = req.body;
    const db = getDb();
    console.log(`[Auth] Forgot password request for email: ${email}`);
    db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
        if (err) {
            console.error(`[Auth] Database error during forgot password lookup for ${email}:`, err.message);
            return res.status(500).json({ message: 'Error processing password reset.' });
        }
        if (!user) {
            console.log(`[Auth] User ${email} not found for password reset (sending generic success to prevent enumeration).`);
            return res.status(200).json({ message: 'If an account with that email exists, a reset link has been sent.' });
        }

        // --- [PHASE 1.E] Block password reset for 'invited' users and resend invitation ---
        if (user.status === 'invited') {
            console.warn(`[Auth] [PHASE 1.E] Forgot password attempt for 'invited' user ${email}. Resending invitation.`);
            
            const resetToken = crypto.randomBytes(32).toString('hex');
            const resetExpires = Date.now() + 3600000; // 1 hour
            const stmt = db.prepare('UPDATE users SET password_reset_token = ?, password_reset_expires = ? WHERE email = ?');
            
            stmt.run(resetToken, resetExpires, email, function (err) {
                if (err) {
                    console.error(`[Auth] [PHASE 1.E] DB error updating token for invited user ${email}:`, err.message);
                    return res.status(500).json({ message: 'Error processing request.' });
                }

                const setupLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
                const subject = `Your VAULT Product Owner Invitation`;
                const html = `
                    <h3 style="font-family: sans-serif;">Welcome to VAULT!</h3>
                    <p style="font-family: sans-serif;">We see you're trying to set your password. Please use this new link to activate your account.</p>
                    <p style="font-family: sans-serif;">To activate your account, please click the button below to set your password. This link will expire in one hour.</p>
                    <a href="${setupLink}" style="background-color:#2563eb;color:white;padding:12px 20px;text-align:center;text-decoration:none;display:inline-block;border-radius:8px;font-size:16px;font-family: sans-serif;">Set Your Password</a>
                `;
                sendEmail(email, subject, html);
                return res.status(200).json({ message: 'If an account with that email exists, a reset link has been sent.' });
            });
            return; // Stop execution for 'invited' user
        }
        // --- [END PHASE 1.E] ---

        console.log(`[Auth] User ${email} found. Generating standard reset token.`);
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetExpires = Date.now() + 3600000;
        console.log(`[Auth] Updating user ${email} with password reset token.`);
        const stmt = db.prepare('UPDATE users SET password_reset_token = ?, password_reset_expires = ? WHERE email = ?');
        stmt.run(resetToken, resetExpires, email, function (err) {
            if (err) {
                console.error(`[Auth] Database error updating reset token for ${email}:`, err.message);
                return res.status(500).json({ message: 'Error processing password reset.' });
            }
            console.log(`[Auth] Password reset token updated for ${email}.`);
            const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
            console.log(`[Auth] Generated password reset link: ${resetLink}`);
            sendEmail(
                email,
                'Password Reset Request for VAULT',
                `<p>You requested a password reset. This link will expire in one hour.</p><p>Click the link to reset your password: <a href="${resetLink}" style="background-color:#2563eb;color:white;padding:12px 20px;text-align:center;text-decoration:none;display:inline-block;border-radius:8px;font-size:16px;">Reset Password</a></p><p>If you did not request this, please ignore this email.</p>`
            );
            res.status(200).json({ message: 'If an account with that email exists, a reset link has been sent.' });
        });
        stmt.finalize();
    });
};

// (handleEmailVerification function is unchanged)
exports.handleEmailVerification = (req, res) => {
    console.log('[Auth] GET /verify-email route hit.');
    const { token } = req.query;
    if (!token) {
        console.warn('[Auth] Email verification failed: No token provided.');
        return res.status(400).send('<h1>Verification failed: No token provided.</h1>');
    }
    console.log(`[Auth] Attempting to verify email with token: ${token}`);

    const db = getDb();
    
    db.get('SELECT role, status, product_id FROM users WHERE email_verification_token = ?', [token], (err, user) => {
        if (err) {
            console.error(`[Auth] DB error finding user by token ${token}:`, err.message);
            return res.status(500).send('<h1>Error during verification.</h1>');
        }
        if (!user) {
            console.warn(`[Auth] Email verification failed: Invalid or expired token ${token}.`);
            return res.status(400).send('<h1>Invalid or expired verification link.</h1>');
        }

        let newStatus = user.status;
        if (user.status === 'pending_email_verification') {
            switch (user.role) {
                case 'CTO':
                case 'ProductOwner': // This case is for the old "signup-admin" flow, can be removed later
                    newStatus = 'active';
                    break;
                case 'Administrator':
                    newStatus = 'suspended_admin';
                    break;
                case 'User':
                default:
                    newStatus = 'suspended_user';
                    break;
            }
        }

        console.log(`[Auth] Token is valid. User role is ${user.role}. Old status was ${user.status}. New status will be: ${newStatus}`);

        db.serialize(() => {
            db.run("BEGIN TRANSACTION", (err) => {
                if (err) {
                    console.error('[Auth_Verify_ERROR] Failed to begin transaction:', err.message);
                    return res.status(500).send('<h1>Error during verification.</h1>');
                }
            });

            const updateSql = `
                UPDATE users SET 
                    is_email_verified = 1, 
                    email_verification_token = NULL,
                    status = ?
                WHERE email_verification_token = ?
            `;
            db.run(updateSql, [newStatus, token], function (updateErr) {
                if (updateErr) {
                    console.error(`[Auth_Verify_ERROR] Database error during user update for token ${token}:`, updateErr.message);
                    db.run("ROLLBACK");
                    return res.status(500).send('<h1>Error during verification.</h1>');
                }
                
                if (user.role === 'ProductOwner' && newStatus === 'active' && user.product_id) {
                    console.log(`[Auth] User is a Product Owner. Attempting to confirm product ID ${user.product_id}.`);
                    // This logic is from an old flow, but we leave it for safety. 
                    // The 'approveProduct' function now handles confirmation.
                    const productSql = "UPDATE products SET status = 'confirmed' WHERE id = ? AND status = 'suspended'";
                    db.run(productSql, [user.product_id], function (prodErr) {
                        if (prodErr) {
                            console.error(`[Auth_Verify_ERROR] Failed to confirm product ${user.product_id}:`, prodErr.message);
                            db.run("ROLLBACK");
                            return res.status(500).send('<h1>Error during verification.</h1>');
                        }
                        if(this.changes > 0) {
                            console.log(`[Auth] Product ${user.product_id} confirmed via PO email verification (legacy flow).`);
                        }
                        commitAndRedirect();
                    });
                } else {
                    commitAndRedirect();
                }
            });

            const commitAndRedirect = () => {
                db.run("COMMIT", (commitErr) => {
                    if (commitErr) {
                        console.error('[Auth_Verify_ERROR] Failed to commit transaction:', commitErr.message);
                        return res.status(500).send('<h1>Error during verification.</h1>');
                    }
                    console.log(`[Auth] Email successfully verified for token ${token}. Status set to ${newStatus}. Redirecting.`);
                    res.redirect(`${process.env.FRONTEND_URL}/login?verified=true`);
                });
            };
        });
    });
};

// (checkVerificationStatus function is unchanged)
exports.checkVerificationStatus = (req, res) => {
    console.log('[Auth] GET /verification-status route hit.');
    const { email } = req.query;
    if (!email) {
        console.warn('[Auth] Check verification status failed: Email query parameter is required.');
        return res.status(400).json({ message: 'Email query parameter is required.' });
    }
    console.log(`[Auth] Checking verification status for email: ${email}`);
    const db = getDb();
    db.get('SELECT is_email_verified FROM users WHERE email = ?', [email], (err, row) => {
        if (err || !row) {
            console.warn(`[Auth] Check verification status failed for ${email}: User not found or DB error.`);
            return res.status(404).json({ message: 'User not found.' });
        }
        console.log(`[Auth] Verification status for ${email}: ${row.is_email_verified === 1 ? 'Verified' : 'Not Verified'}.`);
        res.json({ isVerified: row.is_email_verified === 1 });
    });
};

// --- [TASK 16] REMOVED googleLogin function ---

// (logoutUser function is unchanged)
exports.logoutUser = (req, res) => {
    console.log('[Auth] POST /logout route hit. Clearing client token.');
    res.status(200).json({ message: 'Client should clear local token.' });
};

// (getCurrentUser function is unchanged)
exports.getCurrentUser = (req, res) => {
    console.log(`[Auth] GET /me route hit for user ID: ${req.user.id}`);
    res.json(req.user);
};