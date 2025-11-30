// backend/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const { query } = require('../database'); // Use Postgres query directly
const logger = require('../utils/logger');

const SERVICE_NAME = 'AuthMiddleware';

/**
 * @desc Middleware to protect routes, verify JWT, and load the full user object.
 */
const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            
            // 1. Verify Token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // 2. Fetch User (Postgres syntax $1)
            const sql = `
                SELECT u.id, u.email, u.role, u.status, u.product_id, rd.hierarchy_level
                FROM users u
                JOIN role_definitions rd ON u.role = rd.role_key
                WHERE u.id = $1
            `;
            
            const result = await query(sql, [decoded.id]);
            const user = result.rows[0];

            if (!user) {
                logger.warn(SERVICE_NAME, `User ID ${decoded.id} not found in DB (Token valid but user gone).`);
                // RETURN JSON 401 so frontend clears token
                return res.status(401).json({ message: 'Not authorized, user not found.' });
            }

            if (user.status !== 'active') {
                return res.status(403).json({ message: 'Account is not active.' });
            }

            req.user = user;
            next();

        } catch (error) {
            logger.error(SERVICE_NAME, 'Token verification failed:', error.message);
            return res.status(401).json({ message: 'Not authorized, token failed.' });
        }
    } else {
        return res.status(401).json({ message: 'Not authorized, no token.' });
    }
};

/**
 * @desc Role-based authorization
 */
const authorize = (...minimumRoleKeys) => {
    return async (req, res, next) => {
        if (!req.user || !req.user.role) {
            return res.status(401).json({ message: 'User not authenticated' });
        }

        const userLevel = req.user.hierarchy_level;

        // Dynamically fetch required levels
        const placeholders = minimumRoleKeys.map((_, i) => `$${i + 1}`).join(',');
        const sql = `SELECT hierarchy_level FROM role_definitions WHERE role_key IN (${placeholders})`;
        
        try {
            const result = await query(sql, minimumRoleKeys);
            const levels = result.rows.map(r => r.hierarchy_level);

            if (levels.length === 0) return res.status(500).json({ message: 'Invalid role config' });

            const lowestRequiredLevel = Math.min(...levels); // Lower number = Higher privilege

            if (userLevel <= lowestRequiredLevel) {
                next();
            } else {
                logger.warn(SERVICE_NAME, `User ${req.user.email} denied. Level ${userLevel} > ${lowestRequiredLevel}`);
                res.status(403).json({ message: 'Forbidden: Insufficient permissions.' });
            }
        } catch (err) {
            logger.error(SERVICE_NAME, 'Authorize DB error', err);
            res.status(500).json({ message: 'Authorization error' });
        }
    };
};

module.exports = { protect, authorize };