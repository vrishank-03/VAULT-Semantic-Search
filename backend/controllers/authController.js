const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../database');
const { validationResult } = require('express-validator');
const { OAuth2Client } = require('google-auth-library'); // Import Google Auth Library

// Initialize the client with the ID from your .env file
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

exports.registerUser = (req, res) => {
    console.log('[API] POST /signup route hit.');
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.error('[API] Validation failed:', errors.array());
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    const db = getDb();
    
    db.get('SELECT email FROM users WHERE email = ?', [email], (err, row) => {
        if (row) {
            return res.status(400).json({ message: 'User already exists.' });
        }
        
        const salt = bcrypt.genSaltSync(10);
        const password_hash = bcrypt.hashSync(password, salt);
        const stmt = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)');
        
        stmt.run(email, password_hash, function (err) {
            if (err) {
                return res.status(500).json({ message: 'Could not register user.' });
            }
            const token = jwt.sign({ id: this.lastID }, process.env.JWT_SECRET, { expiresIn: '30d' });
            res.status(201).json({ 
                id: this.lastID, 
                email: email,
                token: token 
            });
        });
        stmt.finalize();
    });
};

exports.loginUser = (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { email, password } = req.body;
    const db = getDb();
    db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
        if (user && bcrypt.compareSync(password, user.password_hash)) {
            const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
            res.json({ 
                id: user.id, 
                email: user.email,
                token: token
            });
        } else {
            res.status(401).json({ message: 'Invalid email or password.' });
        }
    });
};

// --- NEW: Google Login Controller ---
exports.googleLogin = async (req, res) => {
    console.log('[API] POST /google route hit.');
    const { credential } = req.body;
    try {
        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const { email } = payload;
        
        const db = getDb();
        db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
            if (err) {
                return res.status(500).json({ message: "Server error during auth." });
            }

            if (user) {
                // User exists, log them in
                const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
                res.json({ id: user.id, email: user.email, token });
            } else {
                // User does not exist, create a new one
                const password_hash = 'google_user'; 
                const stmt = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)');
                stmt.run(email, password_hash, function (err) {
                    if (err) {
                        return res.status(500).json({ message: 'Could not register user.' });
                    }
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
    res.cookie('token', '', {
        httpOnly: true,
        expires: new Date(0),
    });
    res.status(200).json({ message: 'Cookie cleared. Client should clear local token.' });
};

exports.getCurrentUser = (req, res) => {
    res.json(req.user);
};
