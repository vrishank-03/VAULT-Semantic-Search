const bcrypt = require('bcryptjs');
const jwt =require('jsonwebtoken');
const { getDb } = require('../database');
const { validationResult } = require('express-validator');

// ❌ REMOVED: The cookie-based generateToken function is no longer needed.
// Your frontend uses localStorage, not cookies, for auth.

exports.registerUser = (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;
    const db = getDb();
    db.get('SELECT email FROM users WHERE email = ?', [email], (err, row) => {
        if (row) return res.status(400).json({ message: 'User already exists.' });
        
        const salt = bcrypt.genSaltSync(10);
        const password_hash = bcrypt.hashSync(password, salt);
        const stmt = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)');
        
        stmt.run(email, password_hash, function (err) {
            if (err) return res.status(500).json({ message: 'Could not register user.' });
            
            // ✅ ADDED: Generate the token directly here.
            const token = jwt.sign({ id: this.lastID }, process.env.JWT_SECRET, { expiresIn: '30d' });

            // ✅ MODIFIED: Send the token back in the JSON response.
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
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;
    const db = getDb();
    db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
        if (user && bcrypt.compareSync(password, user.password_hash)) {
            // ✅ ADDED: Generate the token directly when login is successful.
            const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });

            // ✅ MODIFIED: Send the token back in the JSON response body.
            // This is what your frontend is looking for.
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

// This function is for cookie-based logout. It won't affect the token in localStorage.
// Client-side logout (removing the token from localStorage) is what's needed for your app.
exports.logoutUser = (req, res) => {
    res.cookie('token', '', {
        httpOnly: true,
        expires: new Date(0),
    });
    res.status(200).json({ message: 'Cookie cleared. Client should clear local token.' });
};

exports.getCurrentUser = (req, res) => {
    // This function should work correctly with your existing 'protect' middleware
    // as long as the middleware reads the 'Authorization: Bearer <token>' header.
    res.json(req.user);
};