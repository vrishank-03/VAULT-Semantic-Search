const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../database');
const { validationResult } = require('express-validator');
const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
require('dotenv').config();

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// --- Nodemailer Setup ---
console.log('[Email] Setting up Nodemailer transporter...');
console.log(`[Email Config] Host: ${process.env.EMAIL_HOST}`);
console.log(`[Email Config] Port: ${process.env.EMAIL_PORT}`);
console.log(`[Email Config] User: ${process.env.EMAIL_USER}`);
// console.log(`[Email Config] Pass: ${process.env.EMAIL_PASS ? '********' : 'NOT SET'}`); // Don't log full password!
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
        // This is important for some providers, especially if secure is false
        // Allows connection to be made without SSL/TLS, then upgrades
        rejectUnauthorized: false
    }
});

// Verify connection configuration (important for debugging)
transporter.verify(function(error, success) {
    if (error) {
        console.error('[Email] Nodemailer transporter verification failed:', error);
        console.error('[Email] Possible issues: Incorrect host/port, firewall, incorrect user/pass, 2FA/App Password not set for Gmail.');
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
        return true; // Indicate success
    } catch (error) {
        console.error(`[Email] Error sending email to ${to}:`, error);
        console.error(`[Email] Details: SMTP command: ${error.command}, Response: ${error.response}, Code: ${error.code}`);
        return false; // Indicate failure
    }
};

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
    
    // Find user by token AND check if token is not expired
    const sql = `SELECT * FROM users WHERE password_reset_token = ? AND password_reset_expires > ?`;
    db.get(sql, [token, Date.now()], (err, user) => {
        if (err || !user) {
            console.warn(`[Auth] Invalid or expired token provided for password reset: ${token}`);
            return res.status(400).json({ message: 'Password reset token is invalid or has expired.' });
        }

        console.log(`[Auth] Token is valid for user ${user.email}. Hashing new password.`);
        const salt = bcrypt.genSaltSync(10);
        const password_hash = bcrypt.hashSync(password, salt);

        // Update password and clear the reset token fields
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

// --- UPDATED: Signup with Email Verification ---
exports.signup = (req, res) => {
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

// --- UPDATED: Login to check for verification ---
exports.login = (req, res) => {
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


// --- NEW CONTROLLERS ---

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
            // To prevent email enumeration, we send a success response even if the user doesn't exist.
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

// --- EXISTING CONTROLLERS (Unchanged unless noted) ---

exports.googleLogin = async (req, res) => {
    console.log('[Auth] POST /google route hit.');
    const { credential } = req.body;
    try {
        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const { email } = payload;
        console.log(`[Auth] Google login: Token verified for email: ${email}`);
        
        const db = getDb();
        db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
            if (err) {
                console.error(`[Auth] Database error during Google login lookup for ${email}:`, err.message);
                return res.status(500).json({ message: "Server error during auth." });
            }

            if (user) {
                console.log(`[Auth] Google login: User ${email} found, logging in.`);
                const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
                res.json({ id: user.id, email: user.email, token });
            } else {
                console.log(`[Auth] Google login: User ${email} not found, creating new account.`);
                const password_hash = 'google_user_' + crypto.randomBytes(16).toString('hex'); 
                const stmt = db.prepare('INSERT INTO users (email, password_hash, is_email_verified) VALUES (?, ?, 1)');
                stmt.run(email, password_hash, function (err) {
                    if (err) {
                        console.error(`[Auth] Database error during Google user creation for ${email}:`, err.message);
                        return res.status(500).json({ message: 'Could not register user.' });
                    }
                    console.log(`[Auth] Google user ${email} registered with ID: ${this.lastID} and automatically verified.`);
                    const token = jwt.sign({ id: this.lastID }, process.env.JWT_SECRET, { expiresIn: '30d' });
                    res.status(201).json({ id: this.lastID, email, token });
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
    console.log('[Auth] POST /logout route hit. Clearing client token.');
    res.status(200).json({ message: 'Client should clear local token.' });
};

exports.getCurrentUser = (req, res) => {
    console.log(`[Auth] GET /me route hit for user ID: ${req.user.id}`);
    res.json(req.user);
};