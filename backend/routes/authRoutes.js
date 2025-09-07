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

router.post('/register', validateUser, registerUser);
router.post('/login', validateUser, loginUser);
router.post('/logout', logoutUser);
router.get('/me', protect, getCurrentUser); // Protect this route

module.exports = router;