const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../database');
const { validationResult } = require('express-validator');
const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
require('dotenv').config();

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// --- Nodemailer Setup ---
console.log('[Email] Setting up Nodemailer transporter...');
console.log(`[Email Config] Host: ${process.env.EMAIL_HOST}`);
console.log(`[Email Config] Port: ${process.env.EMAIL_PORT}`);
console.log(`[Email Config] User: ${process.env.EMAIL_USER}`);
console.log(`[Email Config] Secure: ${process.env.EMAIL_PORT == 465 ? 'true (recommended for SSL)' : 'false (for TLS/STARTTLS)'}`);


const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT, 10), // Ensure port is an integer
    secure: process.env.EMAIL_PORT == 465, // Use true for 465, false for other ports (like 587)
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    tls: {
        rejectUnauthorized: false
    }
});

// Verify connection configuration
transporter.verify(function(error, success) {
    if (error) {
        console.error('[Email] Nodemailer transporter verification failed:', error);
    } else {
        console.log('[Email] Nodemailer transporter is ready to send messages.');
    }
});


// Reusable email sending function
const sendEmail = async (to, subject, html) => {
    console.log(`[Email] Attempting to send email to: ${to}`);
    try {
        const info = await transporter.sendMail({
            from: `"VAULT" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html,
        });
        console.log(`[Email] Email sent successfully to ${to}. Message ID: ${info.messageId}`);
        console.log(`[Email] Preview URL (if available): ${nodemailer.getTestMessageUrl(info)}`);
        return true; 
    } catch (error) {
        console.error(`[Email] Error sending email to ${to}:`, error);
        return false; 
    }
};

// --- NEW HELPER FUNCTION TO DOWNLOAD IMAGE ---
const saveProfilePicture = async (googlePicUrl, userId) => {
    console.log(`[LOG] saveProfilePicture: Starting download for user ${userId} from ${googlePicUrl}`);
    try {
        // 1. Define where the image will be saved on your server
        const directoryPath = path.resolve(__dirname, '..', 'storage', 'profile_images');
        const filename = `user_${userId}.jpg`; // We'll assume jpeg
        const localFilePath = path.join(directoryPath, filename);

        // 2. Define the path that will be saved in the database (this is a URL path)
        const dbPath = `/storage/profile_images/${filename}`;

        // 3. Ensure the 'profile_images' directory exists
        await fs.promises.mkdir(directoryPath, { recursive: true });
        console.log(`[LOG] saveProfilePicture: Directory ensured at ${directoryPath}`);

        // 4. Download the image using axios
        const response = await axios({
            method: 'GET',
            url: googlePicUrl,
            responseType: 'stream'
        });

        // 5. Save the image to the file system
        const writer = fs.createWriteStream(localFilePath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => {
                console.log(`[LOG] saveProfilePicture: Successfully saved image for user ${userId} to ${localFilePath}`);
                resolve(dbPath); // Return the path to be saved in the DB
            });
            writer.on('error', (err) => {
                console.error('[LOG] saveProfilePicture: Error writing file stream:', err);
                reject(err);
            });
        });
    } catch (error) {
        console.error(`[LOG] saveProfilePicture: Failed to download or save image for user ${userId}:`, error.message);
        return null; // Return null if download fails
    }
};
// --- END NEW HELPER FUNCTION ---


exports.resetPassword = (req, res) => {
    // ... (rest of the function is unchanged)
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

        console.log(`[Auth] Token is valid for user ${user.email}. Hashing new password.`);
        const salt = bcrypt.genSaltSync(10);
        const password_hash = bcrypt.hashSync(password, salt);

        const updateSql = `UPDATE users SET 
            password_hash = ?, 
            password_reset_token = NULL, 
            password_reset_expires = NULL 
            WHERE id = ?`;

        db.run(updateSql, [password_hash, user.id], function (err) {
            if (err) {
                console.error(`[Auth] Database error during password update for ${user.email}:`, err.message);
                return res.status(500).json({ message: 'Error updating password.' });
            }
            console.log(`[Auth] Password successfully updated for user ${user.email}.`);
            res.status(200).json({ message: 'Password has been updated successfully.' });
        });
    });
};

// --- [MODIFIED] Complete Rebuild of Signup Function ---
exports.signup = (req, res) => {
    console.log('[AUTH_SIGNUP] POST /signup route hit.');
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.error('[AUTH_SIGNUP] Validation failed:', errors.array());
        return res.status(400).json({ errors: errors.array() });
    }

    // 1. Get all new fields from body
    const { email, password, role, productName } = req.body;
    console.log(`[AUTH_SIGNUP] Received signup attempt for email: ${email}, role: ${role}, product: ${productName}`);

    // 2. Validate new fields
    if (!role || !productName) {
        console.warn('[AUTH_SIGNUP_WARN] Signup failed: Role or ProductName is missing.');
        return res.status(400).json({ message: 'Role and Product Name are required.' });
    }

    const db = getDb();
    
    // 3. Check for existing user
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
        
        // 4. User does not exist. Now find the product they want to join.
        console.log(`[AUTH_SIGNUP] User ${email} does not exist. Checking product: ${productName}`);
        const productSql = `SELECT id, product_owner_email, status FROM products WHERE product_name = ?`;
        
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
                console.warn(`[AUTH_SIGNUP_WARN] Signup failed: Product "${productName}" is not confirmed and cannot be joined.`);
                return res.status(400).json({ message: `Product "${productName}" is not confirmed and cannot be joined.` });
            }

            // 5. Product is valid. Hash password and set status.
            console.log(`[AUTH_SIGNUP] Product ${productName} is valid (ID: ${product.id}). Hashing password...`);
            const salt = bcrypt.genSaltSync(10);
            const password_hash = bcrypt.hashSync(password, salt);
            const verificationToken = crypto.randomBytes(32).toString('hex');
            
            // 6. Determine the new user's status based on their role
            const newRole = role === 'Administrator' ? 'Administrator' : 'User'; // Sanitize role
            const newStatus = newRole === 'Administrator' ? 'suspended_admin' : 'suspended_user';
            const newProductId = product.id;

            console.log(`[AUTH_SIGNUP] New user will be created with Role: ${newRole}, Status: ${newStatus}, ProductID: ${newProductId}`);

            // 7. Insert the new user into the database
            const insertSql = `
                INSERT INTO users (email, password_hash, email_verification_token, role, status, product_id) 
                VALUES (?, ?, ?, ?, ?, ?)
            `;
            const params = [email, password_hash, verificationToken, newRole, newStatus, newProductId];

            db.run(insertSql, params, function (insertErr) {
                if (insertErr) {
                    console.error(`[AUTH_SIGNUP_ERROR] Database error during user insert for ${email}:`, insertErr.message);
                    return res.status(500).json({ message: 'Could not register user.' });
                }
                
                const newUserId = this.lastID;
                console.log(`[AUTH_SIGNUP] User ${email} registered with ID: ${newUserId}.`);
                
                // 8. Send Email 1: Verification Email (This is a REAL email)
                const verificationLink = `${process.env.API_URL}/api/auth/verify-email?token=${verificationToken}`;
                console.log(`[AUTH_SIGNUP] Generated verification link: ${verificationLink}`);
                sendEmail(
                    email,
                    'Verify Your VAULT Account',
                    `<h3>Welcome to VAULT!</h3><p>Please click the button below to verify your email address. <strong>Your account will also require approval from your administrator before you can log in.</strong></p><a href="${verificationLink}" style="background-color:#2563eb;color:white;padding:12px 20px;text-align:center;text-decoration:none;display:inline-block;border-radius:8px;font-size:16px;">Verify Email</a><p>This link is valid for a single use.</p>`
                );

                // 9. Send Email 2 & 3: Approval Request (This is SIMULATED as requested)
                if (newRole === 'Administrator') {
                    // --- SIMULATE EMAIL TO PRODUCT OWNER ---
                    console.log(`[AUTH_SIGNUP_EMAIL_SIM] *** SIMULATING APPROVAL EMAIL ***`);
                    console.log(`[AUTH_SIGNUP_EMAIL_SIM] TO: ${product.product_owner_email} (Product Owner)`);
                    console.log(`[AUTH_SIGNUP_EMAIL_SIM] SUBJ: New Administrator Request for ${productName}`);
                    console.log(`[AUTH_SIGNUP_EMAIL_SIM] BODY: ${email} (ID: ${newUserId}) has requested Administrator access.`);
                    console.log(`[AUTH_SIGNUP_EMAIL_SIM] *** END SIMULATION ***`);
                } else {
                    // --- SIMULATE EMAIL TO ALL ADMINS OF THAT PRODUCT ---
                    console.log(`[AUTH_SIGNUP_EMAIL_SIM] *** SIMULATING APPROVAL EMAIL ***`);
                    console.log(`[AUTH_SIGNUP_EMAIL_SIM] Finding Admins for Product ID ${newProductId} to notify...`);
                    const adminSql = `SELECT email FROM users WHERE role = 'Administrator' AND status = 'active' AND product_id = ?`;
                    db.all(adminSql, [newProductId], (adminErr, admins) => {
                        if (adminErr) {
                            console.error('[AUTH_SIGNUP_EMAIL_SIM_ERROR] Could not query for admins:', adminErr.message);
                        } else if (admins && admins.length > 0) {
                            console.log(`[AUTH_SIGNUP_EMAIL_SIM] Found ${admins.length} active admins.`);
                            admins.forEach(admin => {
                                console.log(`[AUTH_SIGNUP_EMAIL_SIM] TO: ${admin.email} (Admin)`);
                                console.log(`[AUTH_SIGNUP_EMAIL_SIM] SUBJ: New User Request for ${productName}`);
                                console.log(`[AUTH_SIGNUP_EMAIL_SIM] BODY: ${email} (ID: ${newUserId}) has requested User access.`);
                            });
                        } else {
                            console.warn(`[AUTH_SIGNUP_EMAIL_SIM_WARN] No active admins found for product ${productName} to approve new user.`);
                        }
                        console.log(`[AUTH_SIGNUP_EMAIL_SIM] *** END SIMULATION ***`);
                    });
                }

                // 10. Send final response
                res.status(201).json({ message: 'Signup successful. Please check your email to verify your account.' });
            });
        });
    });
};
// --- [END MODIFIED] Signup Function ---


// --- [MODIFIED] Login Function ---
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
    db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
        if (!user) {
            console.warn(`[AUTH_LOGIN_WARN] Login failed for ${email}: User not found.`);
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        // --- [MODIFIED] RBAC Login Checks ---
        // 1. Check if email is verified
        if (user.is_email_verified === 0) {
            console.warn(`[AUTH_LOGIN_WARN] Login failed for ${email}: Email not verified.`);
            return res.status(403).json({ message: "Please verify your email before logging in." });
        }
        
        // 2. Check if user is 'active' (replaces old logic)
        if (user.status !== 'active') {
            console.warn(`[AUTH_LOGIN_WARN] Login failed for ${email}: User status is "${user.status}".`);
            if (user.status === 'suspended_user' || user.status === 'suspended_admin') {
                return res.status(403).json({ message: "Your account is pending approval by your administrator." });
            }
            if (user.status === 'deactivated') {
                return res.status(403).json({ message: "Your account has been deactivated." });
            }
            // Fallback for any other non-active status
            return res.status(403).json({ message: `Your account is not active (Status: ${user.status}).` });
        }
        // --- [END MODIFIED] RBAC Login Checks ---
        
        // 3. Check password
        if (bcrypt.compareSync(password, user.password_hash)) {
            console.log(`[AUTH_LOGIN_SUCCESS] User ${email} authenticated successfully (Status: ${user.status}).`);
            const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
            res.json({
                id: user.id,
                email: user.email,
                token: token
            });
        } else {
            console.warn(`[AUTH_LOGIN_WARN] Login failed for ${email}: Incorrect password.`);
            res.status(401).json({ message: 'Invalid email or password.' });
        }
    });
};
// --- [END MODIFIED] Login Function ---

exports.forgotPassword = (req, res) => {
    // ... (rest of the function is unchanged)
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

        console.log(`[Auth] User ${email} found. Generating reset token.`);
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetExpires = Date.now() + 3600000; // 1 hour from now

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

// --- [MODIFIED] Email Verification ---
// This function now also sets the user's status, but *only* if they were pending verification.
// It will NOT activate a 'suspended_user' or 'suspended_admin'.
exports.handleEmailVerification = (req, res) => {
    console.log('[Auth] GET /verify-email route hit.');
    const { token } = req.query;
    if (!token) {
        console.warn('[Auth] Email verification failed: No token provided.');
        return res.status(400).send('<h1>Verification failed: No token provided.</h1>');
    }
    console.log(`[Auth] Attempting to verify email with token: ${token}`);

    const db = getDb();
    
    // --- [MODIFIED] Logic ---
    // We only update the status IF the status is 'pending_email_verification'.
    // This prevents a user from verifying their email to bypass an admin suspension.
    const sql = `
        UPDATE users 
        SET 
            is_email_verified = 1, 
            email_verification_token = NULL,
            status = CASE 
                       WHEN status = 'pending_email_verification' THEN 'suspended_user' 
                       ELSE status 
                   END
        WHERE email_verification_token = ?
    `;
    
    // We get the user *first* to check their role, to handle the 'suspended_admin' case.
    db.get('SELECT role, status FROM users WHERE email_verification_token = ?', [token], (err, user) => {
        if (err) {
            console.error(`[Auth] DB error finding user by token ${token}:`, err.message);
            return res.status(500).send('<h1>Error during verification.</h1>');
        }
        if (!user) {
            console.warn(`[Auth] Email verification failed: Invalid or expired token ${token}.`);
            return res.status(400).send('<h1>Invalid or expired verification link.</h1>');
        }

        // Now determine the correct new status
        let newStatus = user.status;
        if (user.status === 'pending_email_verification') {
            newStatus = (user.role === 'Administrator') ? 'suspended_admin' : 'suspended_user';
        }

        console.log(`[Auth] Token is valid. User role is ${user.role}. Old status was ${user.status}. New status will be: ${newStatus}`);

        const updateSql = `
            UPDATE users SET 
                is_email_verified = 1, 
                email_verification_token = NULL,
                status = ?
            WHERE email_verification_token = ?
        `;

        db.run(updateSql, [newStatus, token], function (updateErr) {
            if (updateErr) {
                console.error(`[Auth] Database error during email verification update for token ${token}:`, updateErr.message);
                return res.status(500).send('<h1>Error during verification.</h1>');
            }
            console.log(`[Auth] Email successfully verified for token ${token}. Status set to ${newStatus}. Redirecting.`);
            res.redirect(`${process.env.FRONTEND_URL}/login?verified=true`);
        });
    });
    // --- [END MODIFIED] ---
};

exports.checkVerificationStatus = (req, res) => {
    // ... (rest of the function is unchanged)
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

// --- [MODIFIED] googleLogin Function (to align with new schema) ---
exports.googleLogin = async (req, res) => {
    console.log('[Auth] POST /google route hit.');
    
    const { credential, pictureUrl } = req.body; // pictureUrl is from old flow, 'picture' from payload is new
    console.log("[LOG] authController: Picture URL from req.body (for comparison):", pictureUrl);

    try {
        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        
        const { email, picture } = payload;
        
        console.log("[LOG] authController: Picture URL from Google token payload (to be downloaded):", picture);
        console.log(`[Auth] Google login: Token verified for email: ${email}`);
        
        const db = getDb();
        
        db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => { 
            if (err) {
                console.error(`[Auth] Database error during Google login lookup for ${email}:`, err.message);
                return res.status(500).json({ message: "Server error during auth." });
            }

            if (user) {
                // --- EXISTING USER FLOW ---
                console.log(`[Auth] Google login: User ${email} found. Attempting to update picture.`);
                
                // 1. Download the picture and get the new local path
                const localDbPath = await saveProfilePicture(picture, user.id);
                
                // 2. Update the user's picture_url to the new local path
                // [MODIFIED] Also ensure their status is 'active' if they are a legacy google user
                const updateSql = `
                    UPDATE users SET 
                        picture_url = ?,
                        status = CASE 
                                   WHEN status = 'pending_email_verification' THEN 'active' 
                                   ELSE status 
                               END
                    WHERE id = ?
                `;
                db.run(updateSql, [localDbPath, user.id], (updateErr) => {
                    if (updateErr) {
                        console.error(`[Auth] Failed to update picture/status for user ${user.id}:`, updateErr.message);
                        // Non-fatal, still log them in
                    } else {
                        console.log(`[Auth] Successfully updated picture_url/status for user ${user.id} to ${localDbPath}`);
                    }
                    
                    // [MODIFIED] Add new RBAC checks before login
                    if (user.status !== 'active' && user.status !== 'pending_email_verification') {
                         console.warn(`[AUTH_LOGIN_WARN] Google Login failed for ${email}: User status is "${user.status}".`);
                         return res.status(403).json({ message: `Your account is not active (Status: ${user.status}).` });
                    }
                    
                    // 3. Log them in
                    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
                    res.json({ id: user.id, email: user.email, token });
                });
            } else {
                // --- NEW USER FLOW ---
                console.log(`[Auth] Google login: User ${email} not found, creating new account.`);
                
                // [MODIFIED] Google users bypass the standard signup, so we create them as active.
                // This is a gap, as they won't be associated with a product.
                // For now, we make them 'active' to allow them to log in.
                const password_hash = 'google_user_' + crypto.randomBytes(16).toString('hex'); 
                const newRole = 'User';
                const newStatus = 'active'; // Google users are auto-activated

                console.warn(`[AUTH_SIGNUP_WARN] New Google user ${email} is being created as 'active' and 'User' without a product.`);
                
                // 1. Insert user *without* the picture URL first, so we can get their ID
                const stmt = db.prepare(`
                    INSERT INTO users (email, password_hash, is_email_verified, role, status) 
                    VALUES (?, ?, 1, ?, ?)
                `);
                
                stmt.run(email, password_hash, newRole, newStatus, async function (err) { 
                    if (err) {
                        console.error(`[Auth] Database error during Google user creation for ${email}:`, err.message);
                        return res.status(500).json({ message: 'Could not register user.' });
                    }
                    
                    const newUserId = this.lastID;
                    console.log(`[Auth] Google user ${email} registered with ID: ${newUserId}. Now saving profile pic.`);
                    
                    // 2. Now that we have the ID, download the picture
                    const localDbPath = await saveProfilePicture(picture, newUserId);

                    // 3. Update the new user with their local picture URL
                    db.run('UPDATE users SET picture_url = ? WHERE id = ?', [localDbPath, newUserId], (updateErr) => {
                        if (updateErr) {
                            console.error(`[Auth] Failed to set initial picture_url for new user ${newUserId}:`, updateErr.message);
                        } else {
                            console.log(`[Auth] Successfully set initial picture_url for new user ${newUserId} to ${localDbPath}`);
                        }
                        
                        // 4. Log them in
                        const token = jwt.sign({ id: newUserId }, process.env.JWT_SECRET, { expiresIn: '30d' });
                        res.status(201).json({ id: newUserId, email, token });
                    });
                });
                stmt.finalize();
            }
        });
    } catch (error) {
        console.error("Google token verification failed:", error);
        res.status(401).json({ message: 'Invalid Google token.' });
    }
};
// --- [END MODIFIED] googleLogin Function ---


exports.logoutUser = (req, res) => {
    // ... (rest of the function is unchanged)
    console.log('[Auth] POST /logout route hit. Clearing client token.');
    res.status(200).json({ message: 'Client should clear local token.' });
};

exports.getCurrentUser = (req, res) => {
    // ... (rest of the function is unchanged)
    console.log(`[Auth] GET /me route hit for user ID: ${req.user.id}`);
    res.json(req.user);
};