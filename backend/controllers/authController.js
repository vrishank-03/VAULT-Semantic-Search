const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../database');
const { validationResult } = require('express-validator');

exports.registerUser = (req, res) => {
    // --- ADDED LOG ---
    console.log('[API] POST /signup route hit.');
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        // --- ADDED LOG ---
        console.error('[API] Validation failed:', errors.array());
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    // --- ADDED LOG ---
    console.log(`[API] Attempting to register user with email: ${email}`);
    
    const db = getDb();
    
    // --- ADDED LOG ---
    console.log('[API] Checking database for existing user...');
    db.get('SELECT email FROM users WHERE email = ?', [email], (err, row) => {
        if (err) {
            // --- ADDED LOG ---
            console.error('[API] Database error during user check:', err.message);
            return res.status(500).json({ message: 'Database error.' });
        }
        
        if (row) {
            // --- ADDED LOG ---
            console.log(`[API] User with email ${email} already exists.`);
            return res.status(400).json({ message: 'User already exists.' });
        }
        
        // --- ADDED LOG ---
        console.log('[API] User does not exist. Proceeding with registration...');
        console.log('[API] Hashing password...');
        const salt = bcrypt.genSaltSync(10);
        const password_hash = bcrypt.hashSync(password, salt);
        
        // --- ADDED LOG ---
        console.log('[API] Inserting new user into database...');
        const stmt = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)');
        
        stmt.run(email, password_hash, function (err) {
            if (err) {
                // --- ADDED LOG ---
                console.error('[API] Could not insert user into database:', err.message);
                return res.status(500).json({ message: 'Could not register user.' });
            }
            
            // --- ADDED LOG ---
            console.log(`[API] User created successfully with ID: ${this.lastID}`);
            
            const token = jwt.sign({ id: this.lastID }, process.env.JWT_SECRET, { expiresIn: '30d' });

            // --- ADDED LOG ---
            console.log('[API] Sending 201 response with user data and token.');
            res.status(201).json({ 
                id: this.lastID, 
                email: email,
                token: token 
            });
        });
        stmt.finalize();
    });
};

// (The rest of your loginUser, logoutUser, etc. functions remain unchanged)
exports.loginUser = (req, res) => {
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