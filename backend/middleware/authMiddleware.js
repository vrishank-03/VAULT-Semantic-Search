const jwt = require('jsonwebtoken');
const { getDb } = require('../database');

const protect = (req, res, next) => {
    let token;

    // --- FIX STARTS HERE ---
    // 1. Check for the 'Authorization' header and ensure it starts with 'Bearer'
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // 2. Extract the token from the header ('Bearer TOKEN' -> 'TOKEN')
            token = req.headers.authorization.split(' ')[1];

            // 3. Verify the token using your secret key
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // 4. Find the user from the database using the ID stored in the token
            const db = getDb();
            db.get('SELECT id, email FROM users WHERE id = ?', [decoded.id], (err, user) => {
                if (err || !user) {
                    return res.status(401).json({ message: 'Not authorized, user not found.' });
                }
                
                // 5. Attach the user object to the request for use in your route handlers
                req.user = user;
                next(); // Success, Proceed to the protected route.
            });

        } catch (error) {
            console.error('Token verification failed:', error);
            return res.status(401).json({ message: 'Not authorized, token failed.' });
        }
    }
    // --- FIX ENDS HERE ---

    // If there's no token in the header at all, reject the request.
    if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token provided.' });
    }
};

module.exports = { protect };
