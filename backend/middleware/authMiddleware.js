const jwt = require('jsonwebtoken');
const { getDb } = require('../database');

const protect = (req, res, next) => {
    let token;

    // 1. Check for the 'Authorization' header and ensure it starts with 'Bearer'
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // 2. Extract the token from the header
            token = req.headers.authorization.split(' ')[1];

            // 3. Verify the token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // 4. Find the user from the database
            // [TASK 8 ATOMIC LOG] Modified SQL to select role and status for RBAC
            const db = getDb();
            db.get('SELECT id, email, role, status FROM users WHERE id = ?', [decoded.id], (err, user) => {
                if (err || !user) {
                    return res.status(401).json({ message: 'Not authorized, user not found.' });
                }

                // [TASK 8 ATOMIC LOG] NEW: Check if the user is active.
                // A user who is suspended, deactivated, or pending cannot access protected routes.
                if (user.status !== 'active') {
                    console.warn(`[AUTH_MIDDLEWARE_WARN] User ${user.email} (Status: ${user.status}) blocked by protect middleware.`);
                    return res.status(403).json({ message: `Your account is not active (Status: ${user.status}).` });
                }
                
                // 5. Attach the full user object to the request
                req.user = user;
                next(); // Success, Proceed to the protected route.
            });

        } catch (error) {
            console.error('Token verification failed:', error);
            return res.status(401).json({ message: 'Not authorized, token failed.' });
        }
    }

    // If there's no token in the header at all, reject the request.
    if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token provided.' });
    }
};

// --- [TASK 8] NEW: Role-Based Access Control Middleware ---
/**
 * @desc    Middleware to authorize users based on their role.
 * @param   {...string} roles - An array of roles (e.g., 'Administrator', 'ProductOwner', 'CTO')
 * @example router.get('/admin-only', protect, authorize('Administrator', 'CTO'), ...)
 */
const authorize = (...roles) => {
    return (req, res, next) => {
        // [TASK 8 ATOMIC LOG] This middleware MUST run *after* the 'protect' middleware.
        // 'protect' sets req.user, including req.user.role.
        if (!req.user || !req.user.role) {
            console.error('[AUTH_MIDDLEWARE_ERROR] authorize() ran before protect(). req.user is not set.');
            return res.status(401).json({ message: 'Not authorized.' });
        }

        if (!roles.includes(req.user.role)) {
            console.warn(`[AUTH_MIDDLEWARE_WARN] User ${req.user.email} (Role: ${req.user.role}) tried to access a route restricted to roles: [${roles.join(', ')}]. FORBIDDEN.`);
            return res.status(403).json({ message: 'Forbidden: You do not have the required role to perform this action.' });
        }

        // [TASK 8 ATOMIC LOG] User has the required role. Proceed.
        next();
    };
};
// --- [END TASK 8] ---


module.exports = { 
    protect,
    authorize // --- [TASK 8] NEW: Export authorize
};