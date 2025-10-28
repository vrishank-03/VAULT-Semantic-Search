const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../database');
const { validationResult } = require('express-validator');
const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
require('dotenv').config();

// --- NEW IMPORTS ---
const axios = require('axios');
const fs = require('fs');
const path = require('path');
// --- END NEW IMPORTS ---

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

exports.signup = (req, res) => {
    // ... (rest of the function is unchanged)
    console.log('[Auth] POST /signup route hit.');
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.error('[Auth] Validation failed:', errors.array());
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    const db = getDb();
    
    console.log(`[Auth] Checking if user ${email} already exists.`);
    db.get('SELECT email FROM users WHERE email = ?', [email], (err, row) => {
        if (row) {
            console.warn(`[Auth] Signup failed: User ${email} already exists.`);
            return res.status(400).json({ message: 'User already exists.' });
        }
        
        console.log(`[Auth] User ${email} does not exist. Hashing password.`);
        const salt = bcrypt.genSaltSync(10);
        const password_hash = bcrypt.hashSync(password, salt);
        const verificationToken = crypto.randomBytes(32).toString('hex');
        
        console.log(`[Auth] Inserting new user ${email} into database with verification token.`);
        const stmt = db.prepare('INSERT INTO users (email, password_hash, email_verification_token, is_email_verified) VALUES (?, ?, ?, 0)');
        stmt.run(email, password_hash, verificationToken, function (err) {
            if (err) {
                console.error(`[Auth] Database error during user insert for ${email}:`, err.message);
                return res.status(500).json({ message: 'Could not register user.' });
            }
            console.log(`[Auth] User ${email} registered with ID: ${this.lastID}.`);
            
            const verificationLink = `${process.env.API_URL}/api/auth/verify-email?token=${verificationToken}`;
            console.log(`[Auth] Generated verification link: ${verificationLink}`);

            sendEmail(
                email,
                'Verify Your VAULT Account',
                `<h3>Welcome to VAULT!</h3><p>Please click the button below to verify your email address and activate your account.</p><a href="${verificationLink}" style="background-color:#2563eb;color:white;padding:12px 20px;text-align:center;text-decoration:none;display:inline-block;border-radius:8px;font-size:16px;">Verify Email</a><p>This link is valid for a single use.</p>`
            );

            res.status(201).json({ message: 'Signup successful. Please check your email to verify your account.' });
        });
        stmt.finalize();
    });
};

exports.login = (req, res) => {
    // ... (rest of the function is unchanged)
    console.log('[Auth] POST /login route hit.');
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.error('[Auth] Validation failed:', errors.array());
        return res.status(400).json({ errors: errors.array() });
    }
    const { email, password } = req.body;
    const db = getDb();

    console.log(`[Auth] Attempting login for email: ${email}`);
    db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
        if (!user) {
            console.warn(`[Auth] Login failed for ${email}: User not found.`);
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        if (user.is_email_verified === 0) {
            console.warn(`[Auth] Login failed for ${email}: Email not verified.`);
            return res.status(403).json({ message: "Please verify your email before logging in." });
        }
        
        if (bcrypt.compareSync(password, user.password_hash)) {
            console.log(`[Auth] User ${email} authenticated successfully.`);
            const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
            res.json({
                id: user.id,
                email: user.email,
                token: token
            });
        } else {
            console.warn(`[Auth] Login failed for ${email}: Incorrect password.`);
            res.status(401).json({ message: 'Invalid email or password.' });
        }
    });
};

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

exports.handleEmailVerification = (req, res) => {
    // ... (rest of the function is unchanged)
    console.log('[Auth] GET /verify-email route hit.');
    const { token } = req.query;
    if (!token) {
        console.warn('[Auth] Email verification failed: No token provided.');
        return res.status(400).send('<h1>Verification failed: No token provided.</h1>');
    }
    console.log(`[Auth] Attempting to verify email with token: ${token}`);

    const db = getDb();
    const stmt = db.prepare('UPDATE users SET is_email_verified = 1, email_verification_token = NULL WHERE email_verification_token = ?');

    stmt.run(token, function (err) {
        if (err) {
            console.error(`[Auth] Database error during email verification for token ${token}:`, err.message);
            return res.status(500).send('<h1>Error during verification.</h1>');
        }
        if (this.changes === 0) {
            console.warn(`[Auth] Email verification failed: Invalid or expired token ${token}.`);
            return res.status(400).send('<h1>Invalid or expired verification link.</h1>');
        }
        console.log(`[Auth] Email successfully verified for token ${token}. Redirecting.`);
        res.redirect(`${process.env.FRONTEND_URL}/login?verified=true`);
    });
    stmt.finalize();
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

// --- MODIFIED googleLogin FUNCTION ---
exports.googleLogin = async (req, res) => {
    console.log('[Auth] POST /google route hit.');
    
    // We no longer need the pictureUrl from the body, but we'll log it
    const { credential, pictureUrl } = req.body;
    console.log("[LOG] authController: Picture URL from req.body (for comparison):", pictureUrl);

    try {
        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        
        // This is the URL we will download
        const { email, picture } = payload;
        
        console.log("[LOG] authController: Picture URL from Google token payload (to be downloaded):", picture);
        console.log(`[Auth] Google login: Token verified for email: ${email}`);
        
        const db = getDb();
        
        // Make this callback async to allow 'await' for image download
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
                const updateSql = `UPDATE users SET picture_url = ? WHERE id = ?`;
                db.run(updateSql, [localDbPath, user.id], (updateErr) => {
                    if (updateErr) {
                        console.error(`[Auth] Failed to update picture URL for user ${user.id}:`, updateErr.message);
                        // Non-fatal, still log them in
                    } else {
                        console.log(`[Auth] Successfully updated picture_url for user ${user.id} to ${localDbPath}`);
                    }
                    // 3. Log them in
                    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
                    res.json({ id: user.id, email: user.email, token });
                });
            } else {
                // --- NEW USER FLOW ---
                console.log(`[Auth] Google login: User ${email} not found, creating new account.`);
                
                const password_hash = 'google_user_' + crypto.randomBytes(16).toString('hex'); 
                
                // 1. Insert user *without* the picture URL first, so we can get their ID
                const stmt = db.prepare('INSERT INTO users (email, password_hash, is_email_verified) VALUES (?, ?, 1)');
                
                // Make this callback async
                stmt.run(email, password_hash, async function (err) { 
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