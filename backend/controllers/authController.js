console.log('[LOG] Loading authController.js...');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query, getPool } = require('../database');
const { validationResult } = require('express-validator');
const crypto = require('crypto');
const { CTO_EMAIL } = require('../credentials');
require('dotenv').config();
const { sendEmail } = require('../services/emailService');

// --- [PHASE 1.E] MODIFIED resetPassword ---
exports.resetPassword = async (req, res) => {
    console.log('[Auth] POST /reset-password route hit.');
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { token, password } = req.body;

    try {
        const sql = `SELECT * FROM users WHERE password_reset_token = $1 AND password_reset_expires > $2`;
        const result = await query(sql, [token, Date.now()]);
        const user = result.rows[0];

        if (!user) return res.status(400).json({ message: 'Invalid or expired token.' });

        if (user.status === 'deactivated') return res.status(400).json({ message: 'Invalid token.' });

        const salt = bcrypt.genSaltSync(10);
        const password_hash = bcrypt.hashSync(password, salt);

        const pool = getPool();
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            let updateUserSql, userParams;

            if (user.status === 'invited') {
                // [PG_FIX] Use TRUE instead of 1
                updateUserSql = `
                    UPDATE users SET 
                        password_hash = $1, 
                        password_reset_token = NULL, 
                        password_reset_expires = NULL,
                        status = 'active',
                        is_email_verified = TRUE 
                    WHERE id = $2
                `;
                userParams = [password_hash, user.id];
            } else {
                updateUserSql = `
                    UPDATE users SET 
                        password_hash = $1, 
                        password_reset_token = NULL, 
                        password_reset_expires = NULL 
                    WHERE id = $2
                `;
                userParams = [password_hash, user.id];
            }

            await client.query(updateUserSql, userParams);

            if (user.status === 'invited' && user.product_id) {
                const productSql = "UPDATE products SET status = 'confirmed' WHERE id = $1 AND status = 'awaiting_po_activation'";
                const prodRes = await client.query(productSql, [user.product_id]);
                if (prodRes.rowCount > 0 && req.io) {
                    req.io.emit('PRODUCT_LIST_UPDATED');
                }
            }

            await client.query('COMMIT');
            res.status(200).json({ message: 'Password updated successfully.' });

        } catch (txErr) {
            await client.query('ROLLBACK');
            console.error(`[Auth] Reset Password TX Error:`, txErr.message);
            res.status(500).json({ message: 'Error updating password.' });
        } finally {
            client.release();
        }
    } catch (err) {
        console.error(`[Auth] Reset Password Error:`, err.message);
        res.status(500).json({ message: 'Server error.' });
    }
};

// --- SIGNUP (Standard) ---
exports.signup = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password, productName, adminId } = req.body;
    if (!productName || !adminId) return res.status(400).json({ message: 'Missing required fields.' });

    try {
        const userRes = await query('SELECT email FROM users WHERE email = $1', [email]);
        if (userRes.rows.length > 0) return res.status(400).json({ message: 'User already exists.' });

        const prodRes = await query('SELECT id, status FROM products WHERE product_name = $1', [productName]);
        const product = prodRes.rows[0];

        if (!product) return res.status(404).json({ message: 'Product not found.' });
        if (product.status !== 'confirmed') return res.status(400).json({ message: 'Product not confirmed.' });

        const salt = bcrypt.genSaltSync(10);
        const password_hash = bcrypt.hashSync(password, salt);
        const verificationToken = crypto.randomBytes(32).toString('hex');

        // [PG_FIX] Explicit boolean defaults usually handled by DB, but good to be safe
        const insertSql = `
            INSERT INTO users (email, password_hash, email_verification_token, role, status, product_id, manager_id, is_email_verified) 
            VALUES ($1, $2, $3, 'User', 'pending_email_verification', $4, $5, FALSE)
            RETURNING id
        `;
        await query(insertSql, [email, password_hash, verificationToken, product.id, adminId]);

        const verificationLink = `${process.env.API_URL}/api/auth/verify-email?token=${verificationToken}`;
        sendEmail(email, 'Verify Your VAULT Account', `<a href="${verificationLink}">Verify Email</a>`);

        res.status(201).json({ message: 'Signup successful. Check email.' });

    } catch (err) {
        console.error(`[Auth] Signup Error:`, err.message);
        res.status(500).json({ message: 'Could not register user.' });
    }
};

// --- SIGNUP (Admin) ---
exports.signupAdmin = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password, productName } = req.body;
    if (!productName) return res.status(400).json({ message: 'Product Name required.' });

    try {
        const userRes = await query('SELECT email FROM users WHERE email = $1', [email]);
        if (userRes.rows.length > 0) return res.status(400).json({ message: 'User already exists.' });

        const prodRes = await query('SELECT id, product_owner_email, status FROM products WHERE product_name = $1', [productName]);
        const product = prodRes.rows[0];

        if (!product) return res.status(404).json({ message: 'Product not found.' });
        if (product.status !== 'confirmed') return res.status(400).json({ message: 'Product not confirmed.' });

        const poRes = await query('SELECT id FROM users WHERE email = $1', [product.product_owner_email]);
        const poUser = poRes.rows[0];
        if (!poUser) return res.status(500).json({ message: 'Manager (PO) not found.' });

        const salt = bcrypt.genSaltSync(10);
        const password_hash = bcrypt.hashSync(password, salt);
        const verificationToken = crypto.randomBytes(32).toString('hex');

        const insertSql = `
            INSERT INTO users (email, password_hash, email_verification_token, role, status, product_id, manager_id, is_email_verified) 
            VALUES ($1, $2, $3, 'Administrator', 'pending_email_verification', $4, $5, FALSE)
            RETURNING id
        `;
        await query(insertSql, [email, password_hash, verificationToken, product.id, poUser.id]);

        const verificationLink = `${process.env.API_URL}/api/auth/verify-email?token=${verificationToken}`;
        sendEmail(email, 'Verify Admin Account', `<a href="${verificationLink}">Verify Admin Email</a>`);

        res.status(201).json({ message: 'Signup successful. Check email.' });

    } catch (err) {
        console.error('[Auth] Admin Signup Error:', err.message);
        res.status(500).json({ message: 'Could not register user.' });
    }
};

// --- SIGNUP (CTO) ---
exports.signupCto = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password, ctoSecret } = req.body;

    if (ctoSecret !== process.env.CTO_SIGNUP_SECRET) return res.status(403).json({ message: 'Invalid secret.' });
    if (email.toLowerCase() !== CTO_EMAIL.toLowerCase()) return res.status(400).json({ message: 'Email mismatch.' });

    try {
        const userRes = await query('SELECT email FROM users WHERE email = $1', [email]);
        if (userRes.rows.length > 0) return res.status(400).json({ message: 'CTO already exists.' });

        const salt = bcrypt.genSaltSync(10);
        const password_hash = bcrypt.hashSync(password, salt);
        const verificationToken = crypto.randomBytes(32).toString('hex');

        const insertSql = `
            INSERT INTO users (email, password_hash, email_verification_token, role, status, is_email_verified) 
            VALUES ($1, $2, $3, 'CTO', 'pending_email_verification', FALSE)
            RETURNING id
        `;
        await query(insertSql, [email, password_hash, verificationToken]);

        const verificationLink = `${process.env.API_URL}/api/auth/verify-email?token=${verificationToken}`;
        sendEmail(email, 'Verify CTO Account', `<a href="${verificationLink}">Verify CTO Email</a>`);

        res.status(201).json({ message: 'CTO signup successful.' });

    } catch (err) {
        console.error('[Auth] CTO Signup Error:', err.message);
        res.status(500).json({ message: 'Could not register user.' });
    }
};

// --- LOGIN ---
exports.login = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;

    try {
        const sql = `SELECT u.*, p.product_name FROM users u LEFT JOIN products p ON u.product_id = p.id WHERE u.email = $1`;
        const result = await query(sql, [email]);
        const user = result.rows[0];

        if (!user) return res.status(401).json({ message: 'Invalid email or password.' });

        // [PG_FIX] Boolean checks must be explicit
        if (user.status === 'invited') return res.status(403).json({ message: "Account not active. Check invitation." });
        
        // [PG_FIX] Postgres returns 'false', not 0
        if (!user.is_email_verified) return res.status(403).json({ message: "Please verify your email." });

        if (user.status !== 'active') {
            if (user.status === 'deactivated') return res.status(403).json({ message: "Account deactivated." });
            return res.status(403).json({ message: "Account pending approval." });
        }

        if (user.password_hash === 'INVITED_USER_NO_PASS') return res.status(401).json({ message: 'Invalid email or password.' });

        if (bcrypt.compareSync(password, user.password_hash)) {
            const token = jwt.sign({ 
                id: user.id,
                role: user.role,
                product_id: user.product_id
            }, process.env.JWT_SECRET, { expiresIn: '30d' });
            
            res.json({
                id: user.id,
                email: user.email,
                role: user.role,
                product_id: user.product_id,
                productName: user.product_name,
                token: token
            });
        } else {
            res.status(401).json({ message: 'Invalid email or password.' });
        }
    } catch (err) {
        console.error('[Auth] Login Error:', err.message);
        res.status(500).json({ message: 'Database error.' });
    }
};

// --- EMAIL VERIFICATION ---
exports.handleEmailVerification = async (req, res) => {
    const { token } = req.query;
    if (!token) return res.status(400).send('<h1>No token provided.</h1>');

    const pool = getPool();
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const userRes = await client.query('SELECT role, status, product_id FROM users WHERE email_verification_token = $1', [token]);
        const user = userRes.rows[0];

        if (!user) {
            await client.query('ROLLBACK');
            return res.status(400).send('<h1>Invalid token.</h1>');
        }

        let newStatus = user.status;
        if (user.status === 'pending_email_verification') {
            switch (user.role) {
                case 'CTO':
                case 'ProductOwner':
                    newStatus = 'active';
                    break;
                case 'Administrator':
                    newStatus = 'suspended_admin';
                    break;
                default:
                    newStatus = 'suspended_user';
                    break;
            }
        }

        // [PG_FIX] Use TRUE (boolean) instead of 1 (integer)
        const updateSql = `
            UPDATE users SET 
                is_email_verified = TRUE, 
                email_verification_token = NULL,
                status = $1
            WHERE email_verification_token = $2
        `;
        await client.query(updateSql, [newStatus, token]);

        if (user.role === 'ProductOwner' && newStatus === 'active' && user.product_id) {
            await client.query("UPDATE products SET status = 'confirmed' WHERE id = $1 AND status = 'suspended'", [user.product_id]);
        }

        await client.query('COMMIT');
        res.redirect(`${process.env.FRONTEND_URL}/login?verified=true`);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[Auth_Verify_ERROR]', err.message);
        res.status(500).send(`<h1>Error during verification: ${err.message}</h1>`);
    } finally {
        client.release();
    }
};

exports.checkVerificationStatus = async (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: 'Email required.' });
    try {
        const result = await query('SELECT is_email_verified FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'User not found.' });
        // [PG_FIX] Compare with boolean true
        res.json({ isVerified: result.rows[0].is_email_verified === true });
    } catch (err) {
        res.status(500).json({ message: 'Server error.' });
    }
};

exports.forgotPassword = async (req, res) => {
    const { email } = req.body;
    try {
        const result = await query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user) return res.status(200).json({ message: 'Reset link sent (if account exists).' });

        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetExpires = Date.now() + 3600000;

        await query('UPDATE users SET password_reset_token = $1, password_reset_expires = $2 WHERE email = $3', [resetToken, resetExpires, email]);
        
        const link = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
        sendEmail(email, 'Password Reset', `<a href="${link}">Reset Password</a>`);
        
        res.status(200).json({ message: 'Reset link sent (if account exists).' });
    } catch (err) {
        console.error('[Auth] Forgot Password Error:', err.message);
        res.status(500).json({ message: 'Error processing request.' });
    }
};

exports.logoutUser = (req, res) => res.status(200).json({ message: 'Cleared.' });
exports.getCurrentUser = (req, res) => res.json(req.user);