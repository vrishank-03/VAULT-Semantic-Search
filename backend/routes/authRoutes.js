const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
    registerUser,
    loginUser,
    logoutUser,
    getCurrentUser
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const validateUser = [
    body('email', 'Please include a valid email').isEmail(),
    body('password', 'Password must be at least 8 characters').isLength({ min: 8 })
];

// This line MUST be '/signup' to match the frontend call
router.post('/signup', validateUser, registerUser);

router.post('/login', loginUser);
router.post('/logout', logoutUser);
router.get('/me', protect, getCurrentUser);

module.exports = router;